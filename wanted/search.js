/* Public TCGdex catalog search only; no Supabase requests or writes. */
(() => {
  "use strict";
  const API = "https://api.tcgdex.net/v2/en/cards";
  const $ = (id) => document.getElementById(id);
  const input = $("card-query"), results = $("results"), status = $("search-status");
  const cache = new Map();
  const PAGE_SIZE = 24;
  let debounce, controller, requestId = 0, matches = [], visible = 0, selectedController;
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
      const info = document.createElement("small"); info.textContent = "Card #" + (card.localId || "—") + " · " + card.id;
      button.append(name, info);
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
  async function selectCard(card) {
    if (selectedController) selectedController.abort();
    selectedController = new AbortController();
    const panel = $("selected"), body = $("selected-content");
    panel.hidden = false; body.textContent = "Loading exact card details…";
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
      text.append(heading, set, number, reference); box.append(img, text); body.replaceChildren(box);
    } catch (error) {
      if (error.name !== "AbortError") body.textContent = "Could not load card details. Select the card again to retry.";
    }
  }
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
