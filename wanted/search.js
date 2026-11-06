/* Public TCGdex catalog search only; no Supabase requests or writes. */
(() => {
  "use strict";
  const API = "https://api.tcgdex.net/v2/en/cards";
  const $ = (id) => document.getElementById(id);
  const input = $("card-query"), results = $("results"), status = $("search-status");
  const cache = new Map();
  const PAGE_SIZE = 24;
  const setNames = new Map();
  const setLabels = new Map();
  async function loadSetNames() {
    try {
      const response = await fetch("https://api.tcgdex.net/v2/en/sets");
      if (!response.ok) return;
      const sets = await response.json();
      if (!Array.isArray(sets)) return;
      for (const set of sets) if (set.id && set.name) setNames.set(set.id, set.name);
      for (const [label, id] of setLabels) label.textContent = setNames.get(id) || "Set details on selection";
    } catch (_) { /* Search continues without set names if unavailable. */ }
  }
  loadSetNames();
  let debounce, controller, requestId = 0, matches = [], visible = 0, selectedController, selectedCard = null;
  const supabaseClient = window.supabase?.createClient("https://iqdpfgpkagjxzedfxrvn.supabase.co", "sb_publishable_76aiLaAm5Z4Kv67GkuTo-g_Psx5HINH");
  function feedback(text) { status.textContent = text; }
  function imageUrl(card) { return card.image ? card.image + "/low.webp" : ""; }
  function picture(card, eager = false) {
    const url = imageUrl(card);
    if (!url) { const span = document.createElement("span"); span.className = "placeholder"; span.textContent = "Image unavailable"; return span; }
    const img = document.createElement("img"); img.src = url; img.alt = card.name + " card artwork"; img.loading = eager ? "eager" : "lazy"; img.decoding = "async";
    img.onerror = () => { const placeholder = document.createElement("span"); placeholder.className = "placeholder"; placeholder.textContent = "Image unavailable"; img.replaceWith(placeholder); };
    return img;
  }
  function renderNext() {
    const end = Math.min(visible + PAGE_SIZE, matches.length);
    const fragment = document.createDocumentFragment();
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
      finish.textContent = "Select to see available finishes";
      button.append(name, info, number, finish);
      button.addEventListener("click", () => selectCard(card));
      fragment.append(button);
    }
    results.append(fragment);
    $("result-count").textContent = matches.length + " matching cards";
    $("more-results").hidden = visible >= matches.length;
  }
  function render(cards) {
    matches = cards; visible = 0; results.replaceChildren(); $("result-count").textContent = "";
    if (!cards.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No cards found. Check spelling or try a shorter name."; results.append(empty); return; }
    renderNext();
  }
  function rank(cards, query) {
    const q = query.toLocaleLowerCase();
    return cards.slice().sort((a, b) => {
      const score = (c) => { const n = c.name.toLocaleLowerCase(); return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3; };
      return score(a) - score(b) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
  }
  async function search(query) {
    const id = ++requestId;
    if (controller) controller.abort();
    if (query.length < 2) { render([]); results.replaceChildren(); feedback("Enter at least 2 characters to search."); return; }
    if (cache.has(query)) { render(cache.get(query)); feedback("Results ready."); return; }
    controller = new AbortController();
    feedback("Searching Pokémon cards…");
    try {
      const response = await fetch(API + "?name=" + encodeURIComponent(query), { signal: controller.signal });
      if (!response.ok) throw new Error("TCGdex returned " + response.status);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected search response");
      if (id !== requestId) return;
      const sorted = rank(data.filter(c => c && typeof c.id === "string" && typeof c.name === "string"), query);
      cache.set(query, sorted);
      if (cache.size > 30) cache.delete(cache.keys().next().value);
      render(sorted); feedback(sorted.length ? "Select a card to confirm its exact printing." : "No matching cards found.");
    } catch (error) {
      if (error.name === "AbortError" || id !== requestId) return;
      results.replaceChildren(); $("result-count").textContent = "";
      feedback("Card search is temporarily unavailable. Please try again.");
    }
  }
  function addMarketReference(container, details) {
    const pricing = details.pricing?.tcgplayer;
    const section = document.createElement("div");
    section.className = "market-reference";
    const label = document.createElement("strong");
    label.textContent = "TCGplayer market reference";
    section.append(label);
    const variants = pricing ? Object.entries(pricing).filter(([key, value]) =>
      key !== "updated" && key !== "unit" && value && typeof value === "object" &&
      Number.isFinite(value.marketPrice) && value.marketPrice > 0) : [];
    if (pricing?.unit === "USD" && variants.length) {
      for (const [variant, data] of variants) {
        const line = document.createElement("p");
        const variantLabel = variant.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
        line.textContent = variantLabel + ": " + new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"}).format(data.marketPrice);
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
    note.textContent = "Informational only. Check the correct printing and finish. Your maximum offer is entirely your choice; this does not set it automatically.";
    section.append(note);
    container.append(section);
  }
  async function selectCard(card) {
    if (selectedController) selectedController.abort();
    selectedController = new AbortController();
    const panel = $("selected"), body = $("selected-content");
    panel.hidden = false; selectedCard = null; body.textContent = "Loading exact card details…";
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const response = await fetch(API + "/" + encodeURIComponent(card.id), {signal: selectedController.signal});
      if (!response.ok) throw new Error("Unable to fetch card details");
      const details = await response.json();
      const box = document.createElement("div"); box.className = "selected-detail";
      const img = picture(details, true);
      const text = document.createElement("div");
      const heading = document.createElement("h3"); heading.textContent = details.name || card.name;
      const set = document.createElement("p"); set.textContent = "Set: " + (details.set?.name || "Unknown");
      const number = document.createElement("p"); number.textContent = "Card #: " + (details.localId || card.localId || "Unknown");
      const reference = document.createElement("p"); reference.textContent = "TCGdex ID: " + card.id;
      const finishes = Object.entries({normal:"Non-holo",holo:"Holo",reverse:"Reverse holo",firstEdition:"1st Edition",wPromo:"Promo"}).filter(([key]) => details.variants?.[key] === true).map(([, label]) => label);
      const finishLabel = document.createElement("p");
      finishLabel.textContent = "Available finishes: " + (finishes.length ? finishes.join(", ") : "Not specified by TCGdex");
      text.append(heading, set, number, finishLabel); addMarketReference(text, details); box.append(img, text); body.replaceChildren(box);
      selectedCard = { card_id: card.id, card_name: details.name || card.name, set_name: details.set?.name || "Unknown", card_number: details.localId || card.localId || "Unknown", image_url: details.image || card.image || null };
    } catch (error) {
      if (error.name !== "AbortError") body.textContent = "Could not load card details. Select the card again to retry.";
    }
  }
  $("want-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("save-want"), message = $("want-status");
    if (!selectedCard) { message.textContent = "Select a card and wait for its details to load."; return; }
    if (!supabaseClient) { message.textContent = "Account service unavailable. Reload the page."; return; }
    button.disabled = true;
    message.textContent = "Saving request…";
    try {
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !user) { message.textContent = "Sign in to save your wanted card. Open My account, then return here."; return; }
      const { error } = await supabaseClient.from("cv_wanted_requests").insert({
        user_id: user.id, source: "tcgdex", ...selectedCard,
        minimum_condition: $("minimum-condition").value,
        max_price_usd: Number($("max-price").value),
        quantity: Number($("want-quantity").value),
        consider_lower_condition: $("consider-lower-condition").checked
      });
      if (error) throw error;
      message.textContent = "Added to your wanted list. View it in your account dashboard.";
      $("want-form").reset();
    } catch (error) { message.textContent = error.message || "Could not save request."; }
    finally { button.disabled = false; }
  });
  input.addEventListener("input", () => {
    const query = input.value.trim().replace(/\s+/g, " ");
    $("clear-search").hidden = !query;
    clearTimeout(debounce);
    if (controller) controller.abort();
    if (query.length < 2) { ++requestId; results.replaceChildren(); $("result-count").textContent = ""; $("more-results").hidden = true; feedback("Enter at least 2 characters to search."); return; }
    if (cache.has(query.toLocaleLowerCase())) { search(query.toLocaleLowerCase()); return; }
    feedback("Searching…");
    debounce = setTimeout(() => search(query.toLocaleLowerCase()), 220);
  });
  $("clear-search").addEventListener("click", () => { input.value = ""; input.dispatchEvent(new Event("input")); input.focus(); });
  $("more-results").addEventListener("click", renderNext);
  $("change-card").addEventListener("click", () => { $("selected").hidden = true; input.focus(); });
  const initial = new URLSearchParams(location.search).get("q");
  if (initial) { input.value = initial.slice(0, 80); input.dispatchEvent(new Event("input")); }
})();
