/* Read-only Kaggle-first catalog source. A filename is not a verified printing or finish. */
(() => {
  "use strict";
  const CSV_URL = "https://images.cardvector.app/archive/card-image-index.csv";
  const IMAGE_ROOT = "https://images.cardvector.app/archive/";
  let pending;
  function parseCSV(source) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '"') {
        if (quoted && source[i+1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === "," && !quoted) { row.push(field); field = ""; }
      else if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && source[i+1] === "\n") i++;
        row.push(field); if (row.some(Boolean)) rows.push(row);
        row = []; field = "";
      } else field += ch;
    }
    row.push(field); if (row.some(Boolean)) rows.push(row);
    return rows;
  }
  const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  function fromRow(row) {
    const raw = String(row[0] || "").replace(/\\/g,"/");
    if (!raw || raw.includes("..") || raw.startsWith("/") || !/\.(jpg|jpeg|png|webp)$/i.test(raw)) return null;
    const segments = raw.split("/");
    if (segments.some(segment => !segment)) return null;
    const file = segments[segments.length-1];
    const folder = segments[segments.length-2] || "";
    const stem = file.replace(/\.[^.]+$/,"");
    let number = "", name = "";
    const old = stem.match(/^en_US-[A-Za-z0-9]+-([A-Za-z]*\d+)-(.+)$/i);
    if (old) { number = old[1]; name = old[2].replace(/[_-]+/g," "); }
    else {
      const modern = stem.match(/^[a-z0-9-]+_en_([a-z0-9]+)_(?:std|rev|holo)$/i);
      if (modern) number = modern[1]; // No name inferred from a modern numeric-only filename.
    }
    return {
      path: "archive/" + raw,
      url: IMAGE_ROOT + segments.map(encodeURIComponent).join("/"),
      setSlug: folder, number, name,
      searchable: normalize([name, folder, number].join(" ")),
      nameVerified: false, finishVerified: false
    };
  }
  async function load() {
    if (!pending) pending = fetch(CSV_URL, {mode:"cors", cache:"force-cache"}).then(async response => {
      if (!response.ok) throw Error("R2 index HTTP " + response.status);
      const csv = await response.text();
      const rows = parseCSV(csv.replace(/^\uFEFF/,""));
      if (!rows.length || rows[0][0] !== "RelativePath") throw Error("Unexpected Kaggle index headers");
      return rows.slice(1).map(fromRow).filter(Boolean);
    }).catch(error => { pending = null; throw error; });
    return pending;
  }
  async function search(query, mode = "name", limit = 36) {
    const cards = await load();
    const needle = normalize(query);
    if (needle.length < 2) return [];
    return cards.filter(card => mode === "set"
      ? normalize(card.setSlug).includes(needle)
      : mode === "name" && card.name && normalize(card.name).includes(needle))
      .sort((a,b) => a.setSlug.localeCompare(b.setSlug) || a.number.localeCompare(b.number,undefined,{numeric:true}))
      .slice(0,limit);
  }
  window.CardVectorKaggleCatalog = Object.freeze({load,search,parseCSV,fromRow});
})();
