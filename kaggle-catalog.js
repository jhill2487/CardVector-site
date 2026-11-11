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
    const old = stem.match(/^en_US-[^/]+?-([A-Za-z]*\d+)-(.+)$/i);
    if (old) { number = old[1]; name = old[2].replace(/[_-]+/g," "); }
    else {
      const modern = stem.match(/^[a-z0-9-]+_en_([a-z0-9]+)_(?:std|rev|holo)$/i);
      if (modern) number = modern[1]; // No name inferred from a modern numeric-only filename.
    }
    return {
      path: "archive/" + raw,
      url: IMAGE_ROOT + segments.map(encodeURIComponent).join("/"),
      setSlug: folder, number, name,
      // Search all filename formats without asserting an unverified card identity.
      filename: file,
      searchable: normalize(stem),
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
  // Browse every Kaggle folder, including cards whose image filenames lack names.
  async function listSets() {
    const cards = await load();
    return [...new Set(cards.map(card => card.setSlug))].filter(Boolean)
      .sort((a,b) => a.localeCompare(b));
  }
  async function search(query, mode = "name", limit = 36, setSlug = "") {
    const cards = await load();
    const needle = normalize(query);
    if (!setSlug && needle.length < 2) return [];
    const found = cards.filter(card => {
      if (setSlug && card.setSlug !== setSlug) return false;
      if (!needle) return Boolean(setSlug);
      if (mode === "set" && !setSlug) return normalize(card.setSlug).includes(needle);
      // A filename is searchable evidence even if its naming convention is unknown.
      // Matching never turns its inferred name or finish into a verified identity.
      return card.searchable.includes(needle);
    });
    return found.sort((a,b) => a.setSlug.localeCompare(b.setSlug) ||
      a.number.localeCompare(b.number,undefined,{numeric:true}) || a.path.localeCompare(b.path)).slice(0,limit);
  }

  // Exact set + collector number identifies the printing; a provided name
  // must agree. Numeric-only filenames are accepted only for one unique match.
  // This lookup never changes the card's catalog identity or supported finishes.
  const aliases = {
    swshp:["swsh black star promos","sword shield promos","sword and shield promos"],
    smp:["sm black star promos","sun moon promos"],
    svp:["sv black star promos","scarlet violet promos"],
    xyp:["xy black star promos","xy promos"]
  };
  const cardNumber = value => {
    const raw=String(value||"").trim().toLowerCase().split("/")[0];
    return raw.replace(/^0+(?=\d)/,"");
  };
  async function forCard(card,setName="") {
    const id=String(card?.id||""), cut=id.lastIndexOf("-");
    const setId=cut>0?id.slice(0,cut).toLowerCase():"";
    const name=normalize(card?.name), number=cardNumber(card?.localId);
    if(!setId||!name||!number)return null;
    const sets=new Set([setName,card?.set?.name,...(aliases[setId]||[])].map(normalize).filter(Boolean));
    if(!sets.size)return null;
    const matches=(await load()).filter(row=>
      row.number && cardNumber(row.number)===number &&
      sets.has(normalize(row.setSlug)) &&
      (!row.name || normalize(row.name)===name)
    );
    return matches.length===1?matches[0].url:null;
  }
  window.CardVectorKaggleCatalog = Object.freeze({load,listSets,search,forCard,parseCSV,fromRow});
})();
