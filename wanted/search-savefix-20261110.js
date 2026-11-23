/* Public CardVector-approved printings plus TCGdex historical fallback. */
(() => {
  "use strict";
  const API = "https://api.tcgdex.net/v2/en/cards";
  const $ = (id) => document.getElementById(id);
  const input = $("card-query"), results = $("results"), status = $("search-status");
  const cache = new Map();
  // Compact customer-facing search. Exact identity and finish before pricing.
  const setNames = new Map();
  const releaseDates = new Map();
  const setLabels = new Map();
  const pocketSetIds = new Set();
  const pocketCatalog = fetch("https://api.tcgdex.net/v2/en/series/tcgp").then(async response => {
    if (!response.ok) return;
    const series = await response.json();
    if (!Array.isArray(series.sets)) return;
    for (const set of series.sets) if (set.id) pocketSetIds.add(String(set.id).toLowerCase());
  }).catch(() => { /* Pocket exclusion must never prevent physical card searches. */ });
  function isPhysicalCard(card) {
    const id = String(card?.id || ""), setId = id.slice(0,id.lastIndexOf("-")).toLowerCase();
    return !pocketSetIds.has(setId) && !String(card?.image || "").toLowerCase().includes("/tcgp/");
  }
  const mode = $("search-by"), setFilter = $("filter-set");
  async function loadSetNames() {
    try {
      const response = await fetch("https://api.tcgdex.net/v2/en/sets");
      if (!response.ok) return;
      const sets = await response.json();
      await pocketCatalog;
      if (!Array.isArray(sets)) return;
      for (const set of sets) if (set.id && set.name && !pocketSetIds.has(String(set.id).toLowerCase())) { setNames.set(set.id, set.name); if (/^\\d{4}-\\d{2}-\\d{2}$/.test(String(set.releaseDate || ""))) releaseDates.set(set.id, set.releaseDate); }
      for (const set of [...sets].filter(s => s.id && s.name && !pocketSetIds.has(String(s.id).toLowerCase())).sort((a,b) => a.name.localeCompare(b.name))) setFilter.add(new Option(set.name, set.id));
      for (const [label,id] of setLabels) label.textContent=label.dataset.cardName+" - "+label.dataset.cardNumber+" - "+(setNames.get(id)||"Pokémon TCG");
    } catch (_) { /* Search continues without set names if unavailable. */ }
  }
  const setNamesReady=loadSetNames();
  // Populate the verified-set dropdown even if the external TCGdex list fails.
  // Deferred until after client initialization below.

  let debounce, controller, requestId = 0, matches = [], visible = 0, selectedController, selectedCard = null;
  const supabaseClient = window.supabase?.createClient("https://iqdpfgpkagjxzedfxrvn.supabase.co", "sb_publishable_76aiLaAm5Z4Kv67GkuTo-g_Psx5HINH");
  function feedback(text) { status.textContent = text; }

  // Canonical public CardVector records: only R2 images explicitly approved
  // for the exact PokéWallet provider ID are exposed by the server.
  const PW_SET_PREFIX="pw:";
  const approvedSetNames=new Map();
  const canonicalResultCache=new Map();
  function isApprovedCard(card){return card?._cvApproved===true;}
  const marketUSD=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});
  function validatedTcgplayerUrl(url) {
    const raw=String(url||"");
    return /^https:\/\/(?:www\.)?tcgplayer\.com\/product\/\d+(?:[/?#][^\s]*)?$/i.test(raw)?raw:null;
  }
  function cardMarketRows(card) {
    return (Array.isArray(card?.marketPrices)?card.marketPrices:[])
      .filter(p=>p && typeof p.sub_type_name==="string" &&
         Number.isFinite(Number(p.market_price)) && Number(p.market_price)>0);
  }
  function marketUpdatedAt(card) {
    const dates=cardMarketRows(card).map(p=>new Date(p.updated_at||""))
      .filter(d=>!Number.isNaN(d.getTime()));
    return dates.length?new Date(Math.min(...dates.map(d=>d.getTime()))):null;
  }
  function tcgdexPriceRows(details) {
    const pricing=details?.pricing?.tcgplayer;
    if(!pricing)return [];
    const known={normal:"Non-holo",holo:"Holofoil",reverse:"Reverse holo",
      holofoil:"Holofoil","reverse-holofoil":"Reverse holo",
      "1st-edition":"1st Edition","1st-edition-holofoil":"1st Edition holofoil",
      unlimited:"Unlimited","unlimited-holofoil":"Unlimited holofoil"};
    return Object.entries(pricing).flatMap(([key,row])=>{
      if(!row || typeof row!=="object")return [];
      const market=Number(row.marketPrice);
      return Number.isFinite(market)&&market>0?[{key,label:known[key]||key.replace(/([a-z])([A-Z])/g,"$1 $2"),market}]:[];
    });
  }
  function visiblePriceRows(card){
    return card?._cvDetails
      ?tcgdexPriceRows(card._cvDetails)
      :cardMarketRows(card).map(p=>({key:String(p.sub_type_name).toLowerCase().trim(),
           label:p.sub_type_name,market:Number(p.market_price)}));
  }
  function marketLine(card) {
    const prices=visiblePriceRows(card);
    if(!prices.length)return "";
    return "TCGplayer market: "+prices.slice(0,2)
      .map(p=>p.label+" "+marketUSD.format(p.market)).join(" · ")+
      (prices.length>2?" · +more":"");
  }
  function priceForSelectedFinish(card,finish){
    const names=finish==="normal"?["normal","non holofoil","non holo"]:
      finish==="holo"?["holo","holofoil"]:
      finish==="reverse"?["reverse","reverse holo","reverse holofoil","reverse-holofoil"]:null;
    if(!names)return null;
    const matching=visiblePriceRows(card).filter(p=>
      names.includes(String(p.key).toLowerCase().trim()) ||
      names.includes(String(p.label).toLowerCase().trim()));
    return matching.length===1?matching[0].market:null;
  }
  function showInlinePricing(card){
    const panel=$("inline-market-guide");
    if(!panel)return;
    const finish=$("preferred-finish")?.value;
    const price=finish?priceForSelectedFinish(card,finish):null;
    panel.replaceChildren();
    const note=document.createElement("span");
    note.textContent=price===null
      ?"Market price unavailable for the selected finish. Set your own maximum."
      :"TCGplayer market ("+finishNames[finish]+"): "+marketUSD.format(price)+
        " · Not a verified NM-only price";
    panel.append(note);
    if(price!==null){
      const copy=document.createElement("button");
      copy.type="button";copy.className="use-market-price";
      copy.textContent="Use "+marketUSD.format(price);
      copy.addEventListener("click",()=>{
        if(!selectedCard)return;
        $("max-price").value=price.toFixed(2);
        $("max-price").focus();
      });
      panel.append(copy);
    }
  }
  function appendTcgplayerMarket(parent,card){
    const priceRows=cardMarketRows(card);
    const url=validatedTcgplayerUrl(card?.tcgplayerUrl);
    if(!priceRows.length&&!url)return;
    const section=document.createElement("div");
    section.className="tcgplayer-reference";
    if(priceRows.length){
      const heading=document.createElement("strong");
      heading.textContent="TCGplayer market reference";
      section.append(heading);
      for(const p of priceRows){
        const line=document.createElement("p");
        line.textContent=p.sub_type_name+" · "+marketUSD.format(Number(p.market_price));
        section.append(line);
      }
      const date=marketUpdatedAt(card);
      const foot=document.createElement("small");
      foot.textContent=date?"Price updated "+date.toLocaleDateString("en-US")+
        " · Market values may have changed":"Last price update unavailable · Verify before buying";
      section.append(foot);
    }
    if(url){
      const a=document.createElement("a");
      a.href=url;a.target="_blank";a.rel="noopener noreferrer";
      a.textContent="View exact product on TCGplayer";
      section.append(a);
    }
    parent.append(section);
  }
  function approvedFinishKeys(card){
    const keys=new Set();
    for(const raw of Array.isArray(card?.variants)?card.variants:[]){
      const type=String(typeof raw==="string"?raw:raw?.type||"").toLowerCase().replace(/[^a-z]+/g," ").trim();
      if(type==="normal"||type==="non holo"||type==="non holofoil")keys.add("normal");
      if(type==="holo"||type==="holofoil")keys.add("holo");
      if(type==="reverse holo"||type==="reverse holofoil")keys.add("reverse");
    }
    return ["normal","holo","reverse"].filter(key=>keys.has(key));
  }
  function approvedImageUrl(path){
    // Every public path already passed server-side approval and match checks.
    // Preserve all historical R2 folder schemes instead of a small hardcoded list.
    if(!path||!/^[-a-z0-9 _./]+\.(?:jpg|jpeg|png|webp)$/i.test(path)||
      path.startsWith("/")||path.split("/").some(segment=>!segment||segment==="."||segment==="..")||
      /[?#\\]/.test(path))return null;
    return "https://images.cardvector.app/archive/"+
      path.split("/").map(segment=>encodeURIComponent(segment)).join("/");
  }
  async function loadApprovedSets(){
    if(!supabaseClient)return;
    const {data,error}=await supabaseClient.rpc("cv_public_catalog_sets");
    if(error)throw error;
    for(const row of data||[]){
      const id=PW_SET_PREFIX+String(row.set_id);
      if(approvedSetNames.has(id))continue;
      const label=String(row.set_name||"").trim();
      if(!label)continue;
      approvedSetNames.set(id,label);
      setNames.set(id,label);
      setFilter.add(new Option(label,id));
    }
  }
  async function approvedCards(query,field,chosenSet){
    if(!supabaseClient||field==="illustrator"||(query.length<2&&!chosenSet))return [];
    let providerSetId=chosenSet?chosenSet.startsWith(PW_SET_PREFIX)
      ?chosenSet.slice(PW_SET_PREFIX.length):null:null;
    if(chosenSet&&!providerSetId){
      await Promise.all([catalogSetsReady,setNamesReady]);
      const sourceName=comparableSetName(setNames.get(chosenSet));
      const candidates=[...approvedSetNames.entries()].filter(([id,name])=>
        comparableSetName(name)===sourceName||
        (chosenSet==="svp"&&id===PW_SET_PREFIX+"22872"));
      if(candidates.length!==1)return [];
      providerSetId=candidates[0][0].slice(PW_SET_PREFIX.length);
    }
    const {data,error}=await supabaseClient.rpc("cv_public_catalog_search",{
      p_query:query,p_mode:field,p_set_id:providerSetId,p_limit:1000
    });
    if(error)throw error;
    return (data||[]).flatMap(row=>{
      const image=approvedImageUrl(row.image_path);
      if(!/^pk_[a-f0-9]{40,128}$/i.test(String(row.provider_id||"")))return [];
      return [{
        id:PW_SET_PREFIX+row.provider_id,
        _cvProviderId:row.provider_id,_cvApproved:true,_cvArtworkApproved:!!image,
        name:row.card_name,localId:row.card_number,
        set:{name:row.set_name,id:PW_SET_PREFIX+row.set_id},
        image,variants:row.variants||[],rarity:row.rarity||null,
        tcgplayerUrl:validatedTcgplayerUrl(row.tcgplayer_url),
        marketPrices:Array.isArray(row.tcgplayer_prices)?row.tcgplayer_prices:[],
        marketFetchedAt:row.price_fetched_at||null
      }];
    });
  }

  function deduplicateIdenticalPrintings(cards){
    // PokéWallet can provide multiple product IDs for an identical exact printing.
    // Keep separate records for different finish lists, stamps or patterns.
    // Prefer a record with approved art; always keep the choice deterministic.
    const byKey=new Map();
    for(const card of cards){
      const variantKey=(Array.isArray(card.variants)?card.variants:[])
        .map(v=>String(typeof v==="string"?v:v?.type||"").toLowerCase().trim())
        .sort().join("|");
      const key=[String(card.set?.id||"").toLowerCase(),
        String(card.localId||"").toLowerCase().trim(),
        String(card.name||"").toLowerCase().trim(),variantKey].join("::");
      const prior=byKey.get(key);
      if(!prior){
        byKey.set(key,card);
      }else if((!prior._cvArtworkApproved&&card._cvArtworkApproved)||
        (!prior.tcgplayerUrl&&card.tcgplayerUrl)||
        (!card._cvArtworkApproved&&!prior._cvArtworkApproved&&
         String(card._cvProviderId).localeCompare(String(prior._cvProviderId))<0)){
        byKey.set(key,card);
      }
    }
    return [...byKey.values()];
  }
  const catalogSetsReady=loadApprovedSets().catch(()=>{ /* TCGdex remains available. */ });
  // Explicit crosswalk: TCGdex set IDs -> Limitless English set codes.
  // Never infer a set code from the card name; wrong artwork is worse than none.
  const LIMITLESS_SETS = Object.freeze({
    me06:"DLR", swsh7:"EVS", "sv3.5":"MEW", sv01:"SVI", "swsh12.5":"CRZ"
  });
  function imageCandidates(card) {
    if(card._cvFallbackImage)return [card._cvFallbackImage];
    const rawId = String(card.id || "");
    const cut = rawId.lastIndexOf("-");
    const setId = cut > 0 ? rawId.slice(0, cut).toLowerCase() : "";
    const localId = String(card.localId || "");
    const urls = [];
    const code = LIMITLESS_SETS[setId];
    if (code && /^[0-9]{1,3}$/.test(localId)) {
      const number = String(Number(localId)).padStart(3, "0");
      urls.push("https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/" + code + "/" + code + "_" + number + "_R_EN.png");
    }
    // Keep TCGdex for artwork when a verified Limitless mapping is unavailable
    // or when Limitless has no image for this specific printing.
    const base = card.image || (() => {
      if (!setId || !localId || !/^[a-z0-9.-]+$/i.test(setId) || !/^[a-z0-9-]+$/i.test(localId)) return "";
      const seriesId = setId.replace(/[0-9].*$/, "");
      return seriesId ? "https://assets.tcgdex.net/en/" + seriesId + "/" + setId + "/" + encodeURIComponent(localId) : "";
    })();
    if (base) urls.push(...["/low.webp", "/low.png", "/high.png", "/high.jpg"].map(ext => base + ext));
    return urls;
  }
  // Globally applied to all name, illustrator, and set search results.
  // Limit PokéWallet image calls in each browser session to protect the free quota.
  const IMAGE_FALLBACK_BUDGET = 10;
  let imageFallbackCalls = 0;
  async function addSecondaryArtwork(card, currentNode, fallback) {
    if(!window.CardVectorPokeWallet?.imageForCard || !supabaseClient ||
       imageFallbackCalls>=IMAGE_FALLBACK_BUDGET) {
      currentNode.replaceWith(fallback()); return;
    }
    const setId=String(card.id||"").slice(0,String(card.id||"").lastIndexOf("-"));
    const set=card.set?.name || setNames.get(setId);
    if(!set || !card.localId || !card.name) {
      currentNode.replaceWith(fallback()); return;
    }
    imageFallbackCalls++;
    try {
      const url=await window.CardVectorPokeWallet.imageForCard({
        id:card.id,name:card.name,set,number:card.localId
      },supabaseClient);
      if(!url)throw Error("No exact-match artwork");
      // No guessed cross-printing images: the helper requires one exact set+number match.
      const image=document.createElement("img");
      image.alt=card.name+" card artwork (PokéWallet)";
      image.loading="lazy";
      image.decoding="async";
      image.onerror=()=>image.replaceWith(fallback());
      image.src=url;
      if(currentNode.isConnected)currentNode.replaceWith(image);
    }catch {if(currentNode.isConnected)currentNode.replaceWith(fallback());}
  }
  async function addHistoricalOrSecondary(card,node,fallback) {
    let urls=[];
    try { urls=await (window.CardVectorHistoricalImages?.forCard(card)||[]); }
    catch { /* An unavailable historical record is not an error for search. */ }
    if(!node.isConnected)return;
    if(!urls.length) {addSecondaryArtwork(card,node,fallback);return;}
    let offset=0;
    function tryNext() {
      if(!node.isConnected)return;
      if(offset>=urls.length) {addSecondaryArtwork(card,node,fallback);return;}
      const alt=document.createElement("img");
      alt.alt=card.name+" card artwork (historical source)";
      // Detached fallback images must load eagerly; lazy images may never fire load/error off-DOM.
      alt.loading="eager";
      alt.decoding="async";
      alt.onload=()=>{
        if(node.isConnected){alt.dataset.imageSource="historical";node.replaceWith(alt);}
      };
      alt.onerror=tryNext;
      alt.src=urls[offset++];
    }
    tryNext();
  }
  function noArtwork(){
    const span=document.createElement("span");
    span.className="placeholder";
    span.textContent="Artwork unavailable";
    return span;
  }
  function picture(card, eager = false) {
    if(isApprovedCard(card)){
      if(card._cvArtworkApproved&&card.image){
        const image=document.createElement("img");
        image.alt=card.name+" card artwork";
        image.loading=eager?"eager":"lazy";
        image.decoding="async";
        image.src=card.image;
        image.onerror=()=>image.replaceWith(noArtwork());
        return image;
      }
      const fallbackCard=card._cvArtworkCard;
      if(fallbackCard){
        // Only use an externally verified unique exact printing. Never
        // substitute regular artwork for a Staff or special print.
        return picture(fallbackCard,eager);
      }
      return noArtwork();
    }
    const urls = imageCandidates(card);
    const fallback = () => {
      const span = document.createElement("span");
      span.className = "placeholder";
      span.textContent = "Image unavailable";
      return span;
    };
    const img = document.createElement("img");
    let index=0;
    img.alt=card.name+" card artwork";
    img.loading=eager?"eager":"lazy";
    img.decoding="async";
    img.onerror=()=>{
      if(++index<urls.length)img.src=urls[index];
      else addHistoricalOrSecondary(card,img,fallback);
    };
    // Kaggle artwork is only used after identifying the exact card.
    (async()=>{
      let kaggleUrl=null;
      try {
        kaggleUrl=await window.CardVectorKaggleCatalog?.forCard(card,card.set?.name||setNames.get(setIdFor(card))||"");
      } catch (_) { /* Existing artwork providers remain available. */ }
      if (!img.isConnected)return;
      if(kaggleUrl&&!card._cvFallbackImage)urls.unshift(kaggleUrl);
      if (urls.length)img.src=urls[0];
      else addHistoricalOrSecondary(card,img,fallback);
    })();
    return img;
  }
  function setIdFor(card) {
    if(isApprovedCard(card))return String(card.set?.id||"");
    const id = String(card.id || "");
    return id.slice(0, id.lastIndexOf("-"));
  }
  function cardNumberCompare(a, b) {
    const parts = value => {
      const text = String(value || "");
      const match = text.match(/^(\d+)(.*)$/);
      return match ? [Number(match[1]), match[2]] : [Number.POSITIVE_INFINITY, text];
    };
    const [an, as] = parts(a.localId), [bn, bs] = parts(b.localId);
    return an - bn || as.localeCompare(bs, undefined, {numeric:true}) || a.id.localeCompare(b.id);
  }
  function compareByReleaseDate(a, b) {
    const dateA = releaseDates.get(setIdFor(a)) || "9999-12-31";
    const dateB = releaseDates.get(setIdFor(b)) || "9999-12-31";
    return dateA.localeCompare(dateB) || cardNumberCompare(a, b);
  }
  // Card brief search responses do not carry set release dates. Resolve them
  // from the set endpoint, with a bounded parallel queue and per-session cache.
  async function resolveReleaseDates(cards, signal, searchId) {
    const ids = [...new Set(cards.map(setIdFor))].filter(Boolean);
    const pending = ids.filter(id => !releaseDates.has(id));
    let cursor = 0;
    let unavailable = 0;
    async function worker() {
      while (cursor < pending.length && searchId === requestId) {
        const setId = pending[cursor++];
        try {
          const response = await fetch("https://api.tcgdex.net/v2/en/sets/" + encodeURIComponent(setId), {signal});
          if (!response.ok) throw new Error("Set details unavailable");
          const details = await response.json();
          if (typeof details.releaseDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(details.releaseDate)) throw new Error("No release date");
          releaseDates.set(setId, details.releaseDate);
          if (details.name) setNames.set(setId, details.name);
        } catch (error) {
          if (error.name === "AbortError") throw error;
          unavailable++;
        }
      }
    }
    await Promise.all(Array.from({length: Math.min(8, pending.length)}, () => worker()));
    return unavailable || ids.some(id => !releaseDates.has(id));
  }
  const variantCache = new Map();
  const finishNames = {normal:"Non-holo",holo:"Holo",reverse:"Reverse holo",firstEdition:"1st Edition",wPromo:"Promo"};
  function finishInfo(details) {
    return window.CardVectorCardFinishes?.resolve(details) ||
      {keys:[],source:"unavailable",verified:false,warning:"Finish resolver unavailable."};
  }
  function availableFinishKeys(details) { return finishInfo(details).keys; }
  function populateFinishOptions(keys) {
    const preferred = $("preferred-finish"), fieldset = $("accepted-finish-fieldset"), choices = $("accepted-finish-options");
    preferred.replaceChildren();
    choices.replaceChildren();
    preferred.disabled = !keys.length;
    fieldset.disabled = !keys.length;
    if (!keys.length) {
      preferred.add(new Option("Finish data unavailable", ""));
      $("finish-status").textContent = "Card finish availability is not confirmed. Please try another card or retry later; this request cannot be saved with an unverified finish.";
      return;
    }
    if (keys.length > 1) preferred.add(new Option("Select a finish", ""));
    for (const key of keys) {
      preferred.add(new Option(finishNames[key], key));
      if (keys.length > 1) {
        const label = document.createElement("label");
        label.className = "finish-check";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.value = key;
        label.append(check, document.createTextNode(" " + finishNames[key]));
        choices.append(label);
      }
    }
    function sync() {
      for (const check of choices.querySelectorAll('input[type="checkbox"]')) {
        check.disabled = check.value === preferred.value;
        if (check.disabled) check.checked = false;
      }
    }
    preferred.onchange = ()=>{sync();if(selectedCard?.priceCard)showInlinePricing(selectedCard.priceCard);};
    sync();
    fieldset.hidden = keys.length === 1;
    $("finish-status").textContent = keys.length === 1
      ? "This card is available as " + finishNames[keys[0]] + " only."
      : "Only finishes documented for this exact card can be selected.";
  }
  const pendingVariants = [];
  // Request additional card finish metadata only when a result enters the
  // viewport, rather than fetching every result at once.
  const variantObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        variantObserver.unobserve(entry.target);
        const task = waitingVariants.get(entry.target);
        waitingVariants.delete(entry.target);
        if (task) enqueueVariant(task.card, task.label);
      }
    }, {rootMargin:"250px"}) : null;
  const waitingVariants = new Map();
  let activeVariantLoads = 0;
  function variantLabel(details) {
    const info=finishInfo(details);
    const available=info.keys.map(key=>finishNames[key]);
    const label=available.length?available.join(" · "):"Finish information not available";
    return info.source==="reviewed"?label+" · Reviewed":label+(info.warning?" · Needs verification":"");
  }
  function enqueueVariant(card, label) {
    if(isApprovedCard(card)){
      const keys=approvedFinishKeys(card);
      label.textContent=keys.length?keys.map(k=>finishNames[k]).join(" · ")+" · Approved PokéWallet":"Finish information requires verification";
      return;
    }
    if (variantCache.has(card.id)) { label.textContent = variantCache.get(card.id); return; }
    pendingVariants.push({card,label});
    runVariantQueue();
  }
  function runVariantQueue() {
    while (activeVariantLoads < 3 && pendingVariants.length) {
      const task = pendingVariants.shift();
      if (!task.label.isConnected) continue;
      activeVariantLoads++;
      fetch(API + "/" + encodeURIComponent(task.card.id)).then(r => {
        if (!r.ok) throw Error("No card details");
        return r.json();
      }).then(details => {
        // Brief search records sometimes omit images; full details may supply them.
        if(details.image && !task.card.image){
          task.card.image=details.image;
          const frame=task.label.parentElement;
          const placeholder=frame?.querySelector(".placeholder");
          if(placeholder)placeholder.replaceWith(picture(task.card));
        }
        task.card._cvDetails=details;
        const tile=task.label.closest(".card");
        const market=tile?.querySelector(".card-market");
        const priceText=marketLine(task.card);
        if(market){market.textContent=priceText;market.hidden=!priceText;}
        const label = variantLabel(details);
        variantCache.set(task.card.id,label);
        if (variantCache.size > 1500) variantCache.delete(variantCache.keys().next().value);
        if (task.label.isConnected) task.label.textContent = label;
      }).catch(() => { if (task.label.isConnected) task.label.textContent = "Finishes unavailable"; })
        .finally(() => { activeVariantLoads--; runVariantQueue(); });
    }
  }
  function renderNext() {
    const end = matches.length;
    const fragment = document.createDocumentFragment();
    const variantLabels = [];
    for (; visible < end; visible++) {
      const card = matches[visible];
      const button = document.createElement("button"); button.type = "button"; button.className = "card";
      button.append(picture(card));
      const setId=setIdFor(card);
      const name = document.createElement("strong");
      name.textContent=card.name;
      const subline=document.createElement("small");
      subline.className="card-identity";
      subline.textContent=(setNames.get(setId)||card.set?.name||"Pokémon TCG")+" · #"+(card.localId||"—");
      button.append(name,subline);
      if(card.rarity){
        const rarity=document.createElement("small");
        rarity.className="card-rarity";
        rarity.textContent=card.rarity;
        button.append(rarity);
      }
      const market=marketLine(card);
      const line=document.createElement("small");
      line.className="card-market";
      line.textContent=market;
      line.hidden=!market;
      button.append(line);
      if (!setNames.has(setId) && !isApprovedCard(card)) {
        name.dataset.cardName=card.name;
        name.dataset.cardNumber=card.localId||"—";
        setLabels.set(name,setId);
      }
      const finish=document.createElement("small");
      finish.className="card-finishes";
      finish.textContent=isApprovedCard(card)
        ?(approvedFinishKeys(card).map(k=>finishNames[k]).join(" · ")||"")
        :"";
      button.append(finish);
      button.addEventListener("click", () => selectCard(card));
      fragment.append(button);
      // Fetch finishes only for the visible page of results.
      variantLabels.push({card,finish});
    }
    results.append(fragment);
    for (const {card,finish} of variantLabels) {
      if (variantObserver) {
        waitingVariants.set(finish,{card,label:finish});
        variantObserver.observe(finish);
      } else enqueueVariant(card,finish);
    }
    $("result-count").textContent = matches.length + " matching cards";
    $("more-results").hidden = true;
  }
  function render(cards) {
    if (variantObserver) {
      for (const element of waitingVariants.keys()) variantObserver.unobserve(element);
      waitingVariants.clear();
    }
    matches = cards; visible = 0; results.replaceChildren(); $("result-count").textContent = "";
    if (!cards.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No cards found. Check spelling or try a shorter name."; results.append(empty); return; }
    renderNext();
  }
  function comparableSetName(name){
    return String(name||"").replace(/^[A-Za-z]{1,6}[0-9]{0,3}:\s*/,"")
      .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }
  function localNumber(value){
    return String(value||"").split("/")[0].replace(/^0+(?=\d)/,"").toLowerCase();
  }
  function isSpecialPrinting(name){
    const cleaned=String(name||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
    return /\b(staff|prerelease|pokemon center|stamped|cosmos|winner|alternate|league|championship|first edition|1st edition)\b/i.test(cleaned);
  }
  function canonicalPrintingKey(name,set,number){
    return comparableSetName(set)+"|"+localNumber(number)+"|"+String(name||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }
  // Explicit, audited crosswalks. Never infer equivalence from a set prefix.
  const PROVIDER_TCGDEX_SET_IDS=Object.freeze({"22872":"svp"});
  async function externalArtForSet(setId,signal){
    await setNamesReady;
    const matched=[...setNames.entries()].filter(([id,name])=>
      !id.startsWith(PW_SET_PREFIX)&&
      comparableSetName(name)===comparableSetName(approvedSetNames.get(PW_SET_PREFIX+setId)));
    const tcgdexId=PROVIDER_TCGDEX_SET_IDS[setId]||(matched.length===1?matched[0][0]:null);
    if(!tcgdexId)return [];
    try{
      const response=await fetch("https://api.tcgdex.net/v2/en/sets/"+tcgdexId,{signal});
      if(!response.ok)return [];
      const data=await response.json();
      return Array.isArray(data.cards)?data.cards.filter(isPhysicalCard):[];
    }catch(error){if(error.name==="AbortError")throw error;return [];}
  }
  function attachExactFallbackArtwork(canonical,external){
    const canonicalNumbers=new Map();
    for(const c of canonical){
      const k=c.set?.id+"|"+localNumber(c.localId);
      canonicalNumbers.set(k,(canonicalNumbers.get(k)||0)+1);
    }
    const aliases=new Map([["22872",["scarlet violet black star promos","scarlet violet promos"]]]);
    for(const c of canonical){
      if(c._cvArtworkApproved||isSpecialPrinting(c.name))continue;
      const sid=String(c.set?.id||"").slice(PW_SET_PREFIX.length);
      const knownSets=[comparableSetName(c.set.name),...(aliases.get(sid)||[])];
      const num=localNumber(c.localId);
      // No guessed fallback when a number has multiple catalog printings;
      // they may differ by stamp, finish, or other printing attributes.
      const siblingCount=canonicalNumbers.get(c.set?.id+"|"+num)||0;
      if(siblingCount!==1)continue;
      const matching=external.filter(e=>{
        const name=comparableSetName(e.set?.name||setNames.get(setIdFor(e)));
        return knownSets.includes(name)&&localNumber(e.localId)===num&&
          comparableSetName(e.name)===comparableSetName(c.name)&&!isSpecialPrinting(e.name);
      });
      if(matching.length===1)c._cvArtworkCard=matching[0];
    }
    return canonical;
  }
  function removeDuplicateUnverifiedCards(approved,external){
    // Cross-provider duplicates are only removed when an exact, unambiguous
    // printing exists in the canonical catalog. Never merge Staff, stamps,
    // promos, or multiple PokéWallet printings sharing a collector number.
    const keys=new Map();
    const namesFor=c=>{
      const id=String(c.set?.id||"").replace(/^pw:/,"");
      const name=comparableSetName(c.set?.name||setNames.get(setIdFor(c)));
      return id==="22872"
        ?[name,"scarlet violet black star promos","scarlet violet promos",
            "svp black star promos"]
        :[name];
    };
    for(const c of approved){
      for(const name of namesFor(c)){
        if(!name)continue;
        const key=name+"|"+localNumber(c.localId);
        if(!keys.has(key))keys.set(key,[]);
        keys.get(key).push(c);
      }
    }
    const seenExternal=new Set();
    return external.filter(c=>{
      if(seenExternal.has(c.id))return false;
      seenExternal.add(c.id);
      const setName=comparableSetName(c.set?.name||setNames.get(setIdFor(c)));
      if(!setName)return true;
      const peers=keys.get(setName+"|"+localNumber(c.localId))||[];
      // Distinct variants remain visible. A uniquely matched canonical
      // card supersedes a duplicate TCGdex search hit.
      return !(peers.length===1&&
        comparableSetName(peers[0].name)===comparableSetName(c.name)&&
        isSpecialPrinting(peers[0].name)===isSpecialPrinting(c.name));
    });
  }
  async function attachPokewalletGapImages(cards){
    if(!supabaseClient)return;
    const missing=cards.filter(c=>!c.image&&typeof c.id==="string"&&
      /^[a-z0-9.-]{1,40}-[a-z0-9.-]{1,20}$/i.test(c.id));
    if(!missing.length)return;
    // One public cached lookup per page, no PokéWallet requests in the browser.
    const byId=new Map(missing.map(c=>[c.id,c]));
    for(let i=0;i<missing.length;i+=400){
      const ids=missing.slice(i,i+400).map(c=>c.id);
      const {data,error}=await supabaseClient.rpc("cv_public_tcgdex_pokewallet_images",{p_ids:ids});
      if(error)continue;
      for(const row of data||[]){
        const card=byId.get(row.tcgdex_id);
        const image=approvedImageUrl(row.image_path);
        if(card&&image)card._cvFallbackImage=image;
      }
    }
  }
  async function search(query) {
    const id=++requestId;
    if(controller)controller.abort();
    const field=mode.value,chosenSet=setFilter.value;
    if(query.length<2&&!chosenSet){
      render([]);results.replaceChildren();
      feedback("Enter at least 2 characters, or choose a set.");return;
    }
    const cacheKey=[field,query,chosenSet].join("|");
    if(cache.has(cacheKey)){
      const saved=cache.get(cacheKey);
      render(saved.cards);
      feedback(saved.message);
      return;
    }
    controller=new AbortController();
    const searchController=controller;
    feedback("Searching cards…");
    const approvedPromise=approvedCards(query,field,chosenSet)
      .catch(()=>null); // Distinguish unavailable public catalog from no matches.
    try{
      // Verified CardVector set IDs are independent of TCGdex set IDs.
      if(chosenSet.startsWith(PW_SET_PREFIX)){
        const approved=await approvedPromise;
        if(id!==requestId)return;
        if(approved===null)throw Error("Approved catalog temporarily unavailable");
        const setId=chosenSet.slice(PW_SET_PREFIX.length);
        const historical=approved.some(c=>!c._cvArtworkApproved)
          ?await externalArtForSet(setId,searchController.signal):[];
        if(id!==requestId)return;
        const cards=attachExactFallbackArtwork(deduplicateIdenticalPrintings(approved),historical).sort(cardNumberCompare);
        const message=cards.length?cards.length+" cards found.":"No matching cards found.";
        cache.set(cacheKey,{cards,message});
        render(cards);feedback(message);return;
      }
      await pocketCatalog;
      if(chosenSet&&pocketSetIds.has(chosenSet.toLowerCase()))throw Error("Digital-only set excluded");
      const params=new URLSearchParams();
      if(field==="name"&&query)params.set("name",query);
      if(field==="illustrator"&&query)params.set("illustrator",query);
      if(chosenSet)params.set("set",chosenSet);
      let skipExternal=false;
      if(field==="set"&&!chosenSet){
        const targets=[...setNames.entries()].filter(([id,name])=>
          !id.startsWith(PW_SET_PREFIX)&&name.toLowerCase().includes(query.toLowerCase()))
          .map(([id])=>id);
        if(targets.length===1)params.set("set",targets[0]);
        else skipExternal=true; // Public matched sets may have no TCGdex equivalent.
      }
      const browseSet=Boolean(chosenSet&&!query);
      let external=[],externalError=false;
      if(!skipExternal){
        try{
          const endpoint=browseSet
            ?"https://api.tcgdex.net/v2/en/sets/"+encodeURIComponent(chosenSet)
            :API+"?"+params.toString();
          const response=await fetch(endpoint,{signal:searchController.signal});
          if(!response.ok)throw Error("TCGdex returned "+response.status);
          const data=await response.json();
          external=browseSet?data.cards:data;
          if(!Array.isArray(external))throw Error("Unexpected external search response");
          if(!browseSet&&!external.length&&field==="name"&&query.length>=2){
            const allResponse=await fetch(API,{signal:searchController.signal});
            if(allResponse.ok){
              const all=await allResponse.json();
              if(Array.isArray(all))external=all.filter(c=>String(c.name||"").toLowerCase().includes(query.toLowerCase())&&
                (!chosenSet||String(c.id||"").toLowerCase().startsWith(chosenSet.toLowerCase()+"-")));
            }
          }
        }catch(error){
          if(error.name==="AbortError")throw error;
          externalError=true;
          external=[];
        }
      }
      const approved=await approvedPromise;
      if(id!==requestId)return;
      if(approved===null&&externalError)throw Error("Both card catalogs unavailable");
      const validExternal=external.filter(c=>c&&typeof c.id==="string"&&typeof c.name==="string"&&isPhysicalCard(c));
      await attachPokewalletGapImages(validExternal);
      if(id!==requestId)return;
      let datesIncomplete=false;
      if(validExternal.length&&!browseSet){
        feedback("Checking set release dates…");
        datesIncomplete=await resolveReleaseDates(validExternal,searchController.signal,id);
        if(id!==requestId)return;
      }
      const verified=attachExactFallbackArtwork(deduplicateIdenticalPrintings(approved||[]),validExternal);
      const cards=[...verified,...removeDuplicateUnverifiedCards(verified,validExternal)];
      const sorted=browseSet?cards.sort(cardNumberCompare):cards.sort(compareByReleaseDate);
      const message=sorted.length
        ?sorted.length+" cards found"+(datesIncomplete?" · unknown release dates listed last":"")
        :approved===null?"Search is temporarily unavailable.":"No matching cards found.";
      cache.set(cacheKey,{cards:sorted,message});
      if(cache.size>30)cache.delete(cache.keys().next().value);
      render(sorted);feedback(message);
    }catch(error){
      if(error.name==="AbortError"||id!==requestId)return;
      results.replaceChildren();$("result-count").textContent="";
      feedback("Card search is temporarily unavailable. Please try again.");
    }
  }

  function appendTcgplayerSearchLink(parent,card){
    const query=[card.name,card.set?.name,card.localId].filter(Boolean).join(" ");
    const link=document.createElement("a");
    link.href="https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&view=grid&q="+encodeURIComponent(query);
    link.target="_blank";link.rel="noopener noreferrer";
    link.className="tcgplayer-search-link";
    link.textContent="Find this printing on TCGplayer";
    parent.append(link);
  }
  function addMarketReference(container, details) {
    const pricing = details.pricing?.tcgplayer;
    const section = document.createElement("details");
    section.className = "market-reference";
    const variants = pricing ? Object.entries(pricing).filter(([key, value]) =>
      key !== "updated" && key !== "unit" && value && typeof value === "object" &&
      Number.isFinite(value.marketPrice) && value.marketPrice > 0) : [];
    const summary = document.createElement("summary");
    summary.textContent = "TCGplayer market prices by finish · details";
    section.append(summary);
    if (pricing?.unit === "USD" && variants.length) {
      for (const [variant, data] of variants) {
        const line = document.createElement("p");
        const variantLabel = variant.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
        line.textContent = variantLabel + ": " + new Intl.NumberFormat("en-US", {style:"currency",currency:"USD"}).format(data.marketPrice);
        section.append(line);
      }
      const updated = pricing.updated ? new Date(pricing.updated) : null;
      if (updated && !Number.isNaN(updated.getTime())) {
        const time = document.createElement("small");
        time.textContent = "Pricing updated " + updated.toLocaleDateString();
        section.append(time);
      }
    } else {
      const unavailable = document.createElement("p");
      unavailable.textContent = "No reliable USD market reference available for this card.";
      section.append(unavailable);
    }
    const note = document.createElement("small");
    note.textContent = "Informational only. Verify the printing and finish; set your own maximum.";
    section.append(note);
    container.append(section);
  }
  async function selectCard(card) {
    if(selectedController)selectedController.abort();
    if(isApprovedCard(card)){
      const panel=$("selected"),body=$("selected-content");
      panel.hidden=false;
      panel.scrollIntoView({behavior:"smooth",block:"nearest"});
      const finishKeys=approvedFinishKeys(card);
      populateFinishOptions(finishKeys);
      const box=document.createElement("div");box.className="selected-detail";
      const details=document.createElement("div"),heading=document.createElement("h3");
      heading.textContent=card.name;
      const set=document.createElement("p");set.textContent="Set: "+card.set.name;
      const number=document.createElement("p");number.textContent="Card #: "+card.localId;
      // Keep provider identities internal; names, card numbers and finishes are sufficient on-screen.
      const note=document.createElement("p");
      note.textContent="Finish details are unavailable for this printing.";
      details.append(heading,set,number);
      if(card.rarity){
        const rarity=document.createElement("p");rarity.textContent="Rarity: "+card.rarity;details.append(rarity);
      }
      appendTcgplayerMarket(details,card);
      if(!finishKeys.length)details.append(note);
      box.append(picture(card,true),details);body.replaceChildren(box);
      selectedCard={source:"pokewallet",card_id:card._cvProviderId,
        card_name:card.name,set_name:card.set.name,card_number:card.localId,
        image_url:card.image,allowedFinishes:finishKeys,priceCard:card};
      showInlinePricing(card);
      return;
    }
    selectedController = new AbortController();
    const panel = $("selected"), body = $("selected-content");
    panel.hidden = false; selectedCard = null; populateFinishOptions([]); body.textContent = "Loading exact card details…";
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const response = await fetch(API + "/" + encodeURIComponent(card.id), {signal: selectedController.signal});
      if (!response.ok) throw new Error("Unable to fetch card details");
      const details = await response.json();
      if (!isPhysicalCard(details) || String(details.set?.serie?.id || details.set?.serie || "").toLowerCase() === "tcgp") { body.textContent = "Digital-only cards are not supported."; return; }
      const box = document.createElement("div"); box.className = "selected-detail";
      const img = picture({...card,...details,image:details.image||card.image||null}, true);
      const text = document.createElement("div");
      const heading = document.createElement("h3"); heading.textContent = details.name || card.name;
      const set = document.createElement("p"); set.textContent = "Set: " + (details.set?.name || "Unknown");
      const number = document.createElement("p"); number.textContent = "Card #: " + (details.localId || card.localId || "Unknown");
      const reference = document.createElement("p"); reference.textContent = "Collector number: " + (details.localId || card.localId || "—");
      const initialFinishInfo=finishInfo(details);
      const finishKeys = initialFinishInfo.keys;
      const finishes = finishKeys.map(key => finishNames[key]);
      populateFinishOptions(finishKeys);
      const finishLabel = document.createElement("p");
      finishLabel.textContent = "Available finishes: " + (finishes.length ? finishes.join(", ") : "Not verified") + (initialFinishInfo.source==="reviewed"?" (reviewed)":initialFinishInfo.warning?" (catalog data requires review)":"");
      text.append(heading, set, number, finishLabel);
      addMarketReference(text, details);
      appendTcgplayerSearchLink(text,{name:details.name||card.name,set:details.set||card.set,localId:details.localId||card.localId});
      box.append(img, text); body.replaceChildren(box);
      card._cvDetails=details;
      selectedCard = { card_id: card.id, card_name: details.name || card.name, set_name: details.set?.name || "Unknown", card_number: details.localId || card.localId || "Unknown", image_url: details.image || card.image || null, allowedFinishes: finishKeys, priceCard:card };
      showInlinePricing(card);
      // Live PokéWallet enrichment is optional; TCGdex remains a working fallback.
      const walletNote = document.createElement("p");
      walletNote.className = "hint";
      walletNote.textContent = "Loading additional finish information…";
      text.append(walletNote);
      if (window.CardVectorPokeWallet && supabaseClient) {
        const selectedId = card.id;
        window.CardVectorPokeWallet.inspect({
          id: selectedId,
          name: details.name || card.name,
          set: details.set?.name || "",
          number: details.localId || card.localId || ""
        }, supabaseClient).then(result => {
          if (selectedCard?.card_id !== selectedId || !walletNote.isConnected) return;
          if (result.status !== "matched") {
            walletNote.textContent = result.status === "ambiguous"
              ? "Multiple printings share this number; select the exact artwork and finish."
              : "Available finishes are based on catalog data.";
            return;
          }
          // Market categories can be incomplete. Display evidence but only replace the
          // picker when PokéWallet recognizes a unique card and known finishes.
          const verified = result.variants;
          const previous = $("preferred-finish").value;
          const current=window.CardVectorCardFinishes?.resolve(details);
          if(current?.source==="reviewed") {
            walletNote.textContent="Reviewed printing correction takes priority. PokéWallet price categories are informational.";
            return;
          }
          selectedCard.allowedFinishes = verified;
          populateFinishOptions(verified);
          finishLabel.textContent="Available finishes: "+verified.map(k=>finishNames[k]).join(", ")+" (PokéWallet pricing evidence)";
          if (verified.includes(previous)) $("preferred-finish").value = previous;
          walletNote.textContent = "PokéWallet: " + verified.map(k => finishNames[k]).join(", ") +
            ". Verified against the product listing.";
          if (result.prices.length) {
            const prices = document.createElement("small");
            prices.textContent = "Market references: " + result.prices.map(p =>
              p.label + (p.market == null ? "" : " $" + p.market.toFixed(2))).join(" · ");
            walletNote.append(document.createElement("br"), prices);
          }
        }).catch(err => {
          if (selectedCard?.card_id === selectedId && walletNote.isConnected)
            walletNote.textContent = "Additional finish details are unavailable.";
        });
      } else walletNote.textContent = "Available finishes are based on catalog data.";
    } catch (error) {
      if (error.name !== "AbortError") body.textContent = "Could not load card details. Select the card again to retry.";
    }
  }
  $("want-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("save-want"), message = $("want-status");
    if (!selectedCard) { message.textContent = "Select a card and wait for its details to load."; return; }
    try { await pocketCatalog; } catch (_) { message.textContent = "Physical-card verification unavailable."; return; }
    if (!isPhysicalCard({id:selectedCard.card_id, image:selectedCard.image_url})) { message.textContent = "Digital-only cards cannot be requested."; return; }
    const preferred = $("preferred-finish").value;
    const accepted = [preferred, ...[...$("accepted-finish-options").querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value)];
    if (!preferred || !selectedCard.allowedFinishes?.includes(preferred) || accepted.some(key => !selectedCard.allowedFinishes.includes(key))) {
      message.textContent = "Choose a verified available finish for this card.";
      return;
    }
    if (!supabaseClient) { message.textContent = "Account service unavailable. Reload the page."; return; }
    button.disabled = true;
    message.textContent = "Saving request…";
    try {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) { message.textContent = "Sign in to save your wanted card. Open My account, then return here."; return; }
      const { error } = await supabaseClient.from("cv_wanted_requests").insert({
        user_id: user.id, source: selectedCard.source||"tcgdex",
        card_id: selectedCard.card_id,
        card_name: selectedCard.card_name,
        set_name: selectedCard.set_name,
        card_number: selectedCard.card_number,
        image_url: selectedCard.image_url,
        minimum_condition: $("minimum-condition").value,
        max_price_usd: Number($("max-price").value),
        quantity: Number($("want-quantity").value),
        consider_lower_condition: $("consider-lower-condition").checked,
        preferred_finish: preferred,
        accepted_finishes: accepted
      });
      if (error) throw error;
      message.textContent = "Added to your wanted list. View it in your account dashboard.";
      $("want-form").reset();
      populateFinishOptions(selectedCard.allowedFinishes);
    } catch (error) { message.textContent = error.message || "Could not save request."; }
    finally { button.disabled = false; }
  });
  function updateSearchMode() {
    const selected = mode.value;
    $("query-label").textContent = selected === "illustrator" ? "Illustrator name" : selected === "set" ? "Set name (or select a set)" : "Card name";
    input.placeholder = selected === "illustrator" ? "Try Mitsuhiro Arita" : selected === "set" ? "Try Evolving Skies" : "Try Umbreon VMAX or Charizard";
    const matchSection = results.closest('section[aria-label="Matching cards"]');
    if (matchSection) matchSection.hidden = false;
    input.value = ""; results.replaceChildren(); $("result-count").textContent = ""; $("more-results").hidden = true;
    feedback(selected === "set" ? "Choose a set or enter its name." : "Enter at least 2 characters to search.");
  }
  mode.addEventListener("change", updateSearchMode);
  setFilter.addEventListener("change", () => { input.dispatchEvent(new Event("input")); });
  input.addEventListener("input", () => {
    const query = input.value.trim().replace(/\s+/g, " ");
    $("clear-search").hidden = !query;
    clearTimeout(debounce);
    if (controller) controller.abort();
   
    if (query.length < 2 && !setFilter.value) { ++requestId; results.replaceChildren(); $("result-count").textContent = ""; $("more-results").hidden = true; feedback("Enter at least 2 characters, or select a set."); return; }
    if (cache.has([mode.value,query.toLocaleLowerCase(),setFilter.value].join("|"))) { search(query.toLocaleLowerCase()); return; }
    feedback("Searching…");
    debounce = setTimeout(() => search(query.toLocaleLowerCase()), 220);
  });
  $("clear-search").addEventListener("click", () => { input.value = ""; input.dispatchEvent(new Event("input")); input.focus(); });

  $("change-card").addEventListener("click", () => { $("selected").hidden = true; input.focus(); });
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { input.value = initial.slice(0, 80); input.dispatchEvent(new Event("input")); }
})();
