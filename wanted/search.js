/* Public TCGdex catalog search only; no Supabase requests or writes. */
(() => {
  "use strict";
  const API = "https://api.tcgdex.net/v2/en/cards";
  const $ = (id) => document.getElementById(id);
  const input = $("card-query"), results = $("results"), status = $("search-status");
  const cache = new Map();
  const PAGE_SIZE = 24;
  const setNames = new Map();
  const releaseDates = new Map();
  const setLabels = new Map();
  const pocketSetIds = new Set();
  const pocketCatalog = fetch("https://api.tcgdex.net/v2/en/series/tcgp").then(async response => {
    if (!response.ok) throw new Error("Pocket series unavailable");
    const series = await response.json();
    if (!Array.isArray(series.sets)) throw new Error("Pocket series unavailable");
    for (const set of series.sets) if (set.id) pocketSetIds.add(String(set.id).toLowerCase());
  });
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
      for (const [label, id] of setLabels) label.textContent = setNames.get(id) || "Set details on selection";
    } catch (_) { /* Search continues without set names if unavailable. */ }
  }
  loadSetNames();
  let debounce, controller, requestId = 0, matches = [], visible = 0, selectedController, selectedCard = null;
  const supabaseClient = window.supabase?.createClient("https://iqdpfgpkagjxzedfxrvn.supabase.co", "sb_publishable_76aiLaAm5Z4Kv67GkuTo-g_Psx5HINH");
  function feedback(text) { status.textContent = text; }
  // Explicit crosswalk: TCGdex set IDs -> Limitless English set codes.
  // Never infer a set code from the card name; wrong artwork is worse than none.
  const LIMITLESS_SETS = Object.freeze({
    me06:"DLR", swsh7:"EVS", "sv3.5":"MEW", sv01:"SVI", "swsh12.5":"CRZ"
  });
  function imageCandidates(card) {
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
  function picture(card, eager = false) {
    const urls = imageCandidates(card);
    const fallback = () => { const span = document.createElement("span"); span.className = "placeholder"; span.textContent = "Image unavailable"; return span; };
    if (!urls.length) return fallback();
    const img = document.createElement("img"); let index = 0;
    img.src = urls[index]; img.alt = card.name + " card artwork"; img.loading = eager ? "eager" : "lazy"; img.decoding = "async";
    img.onerror = () => { if (++index < urls.length) img.src = urls[index]; else img.replaceWith(fallback()); };
    return img;
  }
  function setIdFor(card) {
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
    preferred.onchange = sync;
    sync();
    fieldset.hidden = keys.length === 1;
    $("finish-status").textContent = keys.length === 1
      ? "This card is available as " + finishNames[keys[0]] + " only."
      : "Only finishes documented for this exact card can be selected.";
  }
  const pendingVariants = [];
  let activeVariantLoads = 0;
  function variantLabel(details) {
    const info=finishInfo(details);
    const available=info.keys.map(key=>finishNames[key]);
    const label=available.length?available.join(" · "):"Finish information not available";
    return info.source==="reviewed"?label+" · Reviewed":label+(info.warning?" · Needs verification":"");
  }
  function enqueueVariant(card, label) {
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
        const label = variantLabel(details);
        variantCache.set(task.card.id,label);
        if (variantCache.size > 1500) variantCache.delete(variantCache.keys().next().value);
        if (task.label.isConnected) task.label.textContent = label;
      }).catch(() => { if (task.label.isConnected) task.label.textContent = "Finishes unavailable"; })
        .finally(() => { activeVariantLoads--; runVariantQueue(); });
    }
  }
  function renderNext() {
    const end = Math.min(visible + PAGE_SIZE, matches.length);
    const fragment = document.createDocumentFragment();
    const variantLabels = [];
    for (; visible < end; visible++) {
      const card = matches[visible];
      const button = document.createElement("button"); button.type = "button"; button.className = "card";
      button.append(picture(card));
      const name = document.createElement("strong"); name.textContent = card.name;
      const setId = card.id.slice(0, card.id.lastIndexOf("-"));
      const info = document.createElement("small");
      info.textContent = setNames.get(setId) || "Set details on selection";
      if (!setNames.size) setLabels.set(info, setId);
      const number = document.createElement("small");
      number.textContent = "Card #" + (card.localId || "—");
      const finish = document.createElement("small");
      finish.textContent = "Checking finishes…";
      button.append(name, info, number, finish);
      button.addEventListener("click", () => selectCard(card));
      fragment.append(button);
      // Fetch finishes only for the visible page of results.
      variantLabels.push({card,finish});
    }
    results.append(fragment);
    for (const {card,finish} of variantLabels) enqueueVariant(card,finish);
    $("result-count").textContent = matches.length + " matching cards";
    $("more-results").hidden = visible >= matches.length;
  }
  function render(cards) {
    matches = cards; visible = 0; results.replaceChildren(); $("result-count").textContent = "";
    if (!cards.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No cards found. Check spelling or try a shorter name."; results.append(empty); return; }
    renderNext();
  }
  async function search(query) {
    const id = ++requestId;
    if (controller) controller.abort();
    const field = mode.value, chosenSet = setFilter.value;
    if (query.length < 2 && !chosenSet) { render([]); results.replaceChildren(); feedback("Enter at least 2 characters, or choose a set."); return; }
    const cacheKey = [field, query, chosenSet].join("|");
    if (cache.has(cacheKey)) { const saved = cache.get(cacheKey); render(saved.cards); feedback(saved.datesIncomplete ? "Oldest known printings first; sets with unavailable dates appear last." : "Oldest printing first by set release date."); return; }
    controller = new AbortController();
    const searchController = controller;
    feedback("Searching Pokémon cards…");
    try {
      await pocketCatalog;
      if (chosenSet && pocketSetIds.has(chosenSet.toLowerCase())) throw new Error("Digital-only set excluded");
      const params = new URLSearchParams();
      if (field === "name" && query) params.set("name", query);
      if (field === "illustrator" && query) params.set("illustrator", query);
      if (chosenSet) params.set("set", chosenSet);
      // Set-name searches resolve the official set ID before retrieving cards.
      if (field === "set" && !chosenSet) {
        const target = [...setNames.entries()].filter(([,name]) => name.toLowerCase().includes(query.toLowerCase())).map(([id]) => id);
        if (target.length !== 1) { feedback(target.length ? "Select the exact set from the dropdown." : "No matching set. Select a set from the dropdown."); render([]); return; }
        params.set("set", target[0]);
      }
      // Sort after resolving actual set release dates below; card briefs lack them.
      // The full set endpoint exposes its cards directly; browse by set with no text.
      const browseSet = Boolean(chosenSet && !query);
      const endpoint = browseSet
        ? "https://api.tcgdex.net/v2/en/sets/" + encodeURIComponent(chosenSet)
        : API + "?" + params.toString();
      const response = await fetch(endpoint, { signal: searchController.signal });
      if (!response.ok) throw new Error("TCGdex returned " + response.status);
      const data = await response.json();
      const cards = browseSet ? data.cards : data;
      if (!Array.isArray(cards)) throw new Error("Unexpected search response");
      if (id !== requestId) return;
      const validCards = cards.filter(c => c && typeof c.id === "string" && typeof c.name === "string" && isPhysicalCard(c));
      let datesIncomplete = false;
      if (!browseSet && validCards.length) {
        feedback("Checking release dates for " + validCards.length + " matching cards…");
        datesIncomplete = await resolveReleaseDates(validCards, searchController.signal, id);
        if (id !== requestId) return;
      }
      const sorted = browseSet ? validCards.sort(cardNumberCompare) : validCards.sort(compareByReleaseDate);
      cache.set(cacheKey, {cards: sorted, datesIncomplete});
      if (cache.size > 30) cache.delete(cache.keys().next().value);
      render(sorted);
      feedback(sorted.length ? (datesIncomplete
        ? "Oldest known printings first; sets with unavailable release dates appear last."
        : "Oldest printing first by set release date.") : "No matching cards found.");
    } catch (error) {
      if (error.name === "AbortError" || id !== requestId) return;
      results.replaceChildren(); $("result-count").textContent = "";
      feedback("Card search is temporarily unavailable. Please try again.");
    }
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
    if (selectedController) selectedController.abort();
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
      const img = picture(details, true);
      const text = document.createElement("div");
      const heading = document.createElement("h3"); heading.textContent = details.name || card.name;
      const set = document.createElement("p"); set.textContent = "Set: " + (details.set?.name || "Unknown");
      const number = document.createElement("p"); number.textContent = "Card #: " + (details.localId || card.localId || "Unknown");
      const reference = document.createElement("p"); reference.textContent = "TCGdex ID: " + card.id;
      const initialFinishInfo=finishInfo(details);
      const finishKeys = initialFinishInfo.keys;
      const finishes = finishKeys.map(key => finishNames[key]);
      populateFinishOptions(finishKeys);
      const finishLabel = document.createElement("p");
      finishLabel.textContent = "Available finishes: " + (finishes.length ? finishes.join(", ") : "Not verified") + (initialFinishInfo.source==="reviewed"?" (reviewed)":initialFinishInfo.warning?" (catalog data requires review)":"");
      text.append(heading, set, number, finishLabel); addMarketReference(text, details); box.append(img, text); body.replaceChildren(box);
      selectedCard = { card_id: card.id, card_name: details.name || card.name, set_name: details.set?.name || "Unknown", card_number: details.localId || card.localId || "Unknown", image_url: details.image || card.image || null, allowedFinishes: finishKeys };
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
        user_id: user.id, source: "tcgdex",
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
  $("more-results").addEventListener("click", renderNext);
  $("change-card").addEventListener("click", () => { $("selected").hidden = true; input.focus(); });
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { input.value = initial.slice(0, 80); input.dispatchEvent(new Event("input")); }
})();
