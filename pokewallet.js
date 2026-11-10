/* PokéWallet exact card comparison for CardVector. Never expose the private API key. */
(() => {
  "use strict";
  const EDGE = "https://iqdpfgpkagjxzedfxrvn.supabase.co/functions/v1/cardvector-pokewallet-search";
  const KEY = "sb_publishable_76aiLaAm5Z4Kv67GkuTo-g_Psx5HINH";
  const names = {normal:"Non-holo",holo:"Holo",reverse:"Reverse holo"};
  const cache = new Map();
  function normalize(s){return String(s??"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  function number(s){return String(s??"").split("/")[0].replace(/^0+(?=\d)/,"").toLowerCase().trim();}
  function finish(s){
    const t=normalize(s);
    if(t==="normal")return "normal";
    if(t==="holofoil" || t==="holo")return "holo";
    if(t==="reverse holofoil" || t==="reverse holo")return "reverse";
    return null; // Older edition, stamp and special foil variants need separate identity rules.
  }
  async function inspect(card,client){
    if(!client)throw Error("Account service unavailable");
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw Error("Sign in to compare PokéWallet");
    const key=[card.id,card.name,card.set,card.number].join("|");
    if(cache.has(key))return cache.get(key);
    const promise=(async()=>{
      const response=await fetch(EDGE,{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({q:card.name})});
      const raw=await response.json();
      if(!response.ok)throw Error(raw.error||"PokéWallet lookup unavailable");
      const list=Array.isArray(raw.results)?raw.results:[];
      const exact=list.filter(entry=>{
        const info=entry?.card_info||{};
        return info.product_type!=="sealed" &&
          normalize(info.set_name)===normalize(card.set) &&
          number(info.card_number)===number(card.number) &&
          (normalize(info.clean_name||info.name).startsWith(normalize(card.name)) ||
           normalize(card.name).startsWith(normalize(info.clean_name||info.name)));
      });
      if(exact.length!==1)return {status:exact.length?"ambiguous":"not-found",count:exact.length,variants:[],prices:[],provider:"PokéWallet"};
      const entry=exact[0];
      const prices=Array.isArray(entry?.tcgplayer?.prices)?entry.tcgplayer.prices:[];
      const variants=[...new Set(prices.map(p=>finish(p.sub_type_name)).filter(Boolean))];
      return {status:variants.length?"matched":"no-variants",count:1,variants,prices:prices.map(p=>({label:String(p.sub_type_name||"Unknown"),market:typeof p.market_price==="number"?p.market_price:null})),provider:"PokéWallet",name:entry.card_info.name,set:entry.card_info.set_name,number:entry.card_info.card_number};
    })().catch(err=>{cache.delete(key);throw err});
    cache.set(key,promise);
    return promise;
  }
  window.CardVectorPokeWallet=Object.freeze({inspect,names});
})();