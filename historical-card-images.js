/* Historical Pokémon TCG image reference fallback.
 * Reuses the card ID and image URL format preserved in CardVector's old catalog.
 * Fetches read-only upstream set JSON on demand. Does not rebuild or host a database.
 * This is a historical provider: never use these records to overwrite CardVector identity.
 */
(() => {
  "use strict";
  const ROOT="https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/";
  const SET_LIMIT=16;
  const setCache=new Map();
  let setLoads=0;
  const norm=text=>String(text||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const normNumber=value=>String(value||"").trim().toLowerCase().replace(/^0+(?=\d)/,"");
  function safelyAllowed(url){
    try {const u=new URL(url);return u.protocol==="https:" && u.hostname==="images.pokemontcg.io";}
    catch {return false;}
  }
  function exactMatch(card,row){
    return String(row?.id||"").toLowerCase()===String(card?.id||"").toLowerCase() &&
      norm(row?.name)===norm(card?.name) &&
      normNumber(row?.number)===normNumber(card?.localId);
  }
  async function forCard(card){
    const id=String(card?.id||"");
    const cut=id.lastIndexOf("-");
    if(cut<=0||!card?.name||!card?.localId)return [];
    const set=id.slice(0,cut).toLowerCase();
    if(!/^[a-z0-9.-]{2,35}$/.test(set))return [];
    if(!setCache.has(set)){
      if(setLoads>=SET_LIMIT)return [];
      setLoads++;
      const promise=fetch(ROOT+encodeURIComponent(set)+".json",{cache:"force-cache"}).then(async response=>{
        if(!response.ok) return [];
        const rows=await response.json();
        return Array.isArray(rows)?rows:[];
      }).catch(()=>[]);
      setCache.set(set,promise);
    }
    const rows=await setCache.get(set);
    const matches=rows.filter(row=>exactMatch(card,row));
    if(matches.length!==1)return [];
    const images=matches[0]?.images||{};
    return [images.small,images.large].filter(url=>typeof url==="string"&&safelyAllowed(url));
  }
  window.CardVectorHistoricalImages=Object.freeze({forCard});
})();
