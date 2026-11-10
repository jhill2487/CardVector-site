/* Shared CardVector Pokémon finish resolver.
 * A finish is not the same thing as an edition, stamp, or language.
 * TCGdex provides initial catalog evidence. A manually reviewed correction
 * takes priority; pricing buckets from other providers are review evidence,
 * not proof of a distinct physical printing.
 */
(() => {
  "use strict";
  const FINISHES=Object.freeze({normal:"Non-holo",holo:"Holo",reverse:"Reverse holo"});
  const KEYS=Object.keys(FINISHES);
  const REVIEWED=Object.freeze({
    "sm9-39":Object.freeze(["holo","reverse"]) // Electrode, Team Up #39/181
  });
  function resolve(details) {
    const id=String(details?.id||"").toLowerCase();
    const reviewed=REVIEWED[id];
    if(reviewed)return {keys:[...reviewed],source:"reviewed",verified:true,warning:null};
    const raw=details?.variants;
    const basic=(raw && !Array.isArray(raw) && typeof raw==="object")?raw:null;
    const detailed=Array.isArray(details?.variants_detailed)?details.variants_detailed:(Array.isArray(raw)?raw:[]);
    const basicKeys=KEYS.filter(key=>basic?.[key]===true);
    const detailKeys=KEYS.filter(key=>detailed.some(v=>v?.type===key));
    const contradictions=detailKeys.filter(k=>basic?.[k]===false);
    // Holo variations in detailed records might carry distinct stamps/patterns.
    // Those need richer variant identity before matching; never silently merge.
    const special=detailed.some(v=>v && typeof v==="object" && Object.keys(v).some(k=>k!=="type"));
    const keys=KEYS.filter(key=>basicKeys.includes(key)||detailKeys.includes(key));
    const warning=contradictions.length
      ?"Basic and detailed TCGdex variants disagree; verify physical printing."
      :special?"Special printing attributes require verification before exact matching."
      :!keys.length?"No documented finish found.":null;
    return {keys,source:"tcgdex",verified:!!keys.length&&!warning,warning};
  }
  window.CardVectorCardFinishes=Object.freeze({resolve,labels:FINISHES});
})();
