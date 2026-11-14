/* Verified PokéWallet set IDs to Cloudflare R2 archive folders.
   Map only reviewed, exact set identities. Never infer an unreviewed folder from a card name. */
(() => {
 "use strict";
 const entries = Object.freeze({
  "24541": Object.freeze({
   set:"ME: Ascended Heroes",
   folder:"ascended-heroes",
   code:"me2-5",
   denominator:"217",
   pathPrefix:"ascended-heroes/ascended-heroes/",
   evidence:"295 indexed Ascended Heroes R2 files; me2-5_en_001,002,003,293,294,295_std.jpg independently returned HTTP 200 image/jpeg"
  }),
  "24326": Object.freeze({
   set:"SV: White Flare",
   folder:"white-flare",
   code:"rsv10-5",
   denominator:"086",
   pathPrefix:"Pokemon TCG/Pokemon TCG/white-flare/",
   evidence:"173 R2-indexed images rsv10-5_en_001..173_std.jpg; sampled 001,002,172,173 returned HTTP 200 image/jpeg"
  }),
  "24325": Object.freeze({
   set:"SV: Black Bolt",
   folder:"black-bolt",
   code:"zsv10-5",
   denominator:"086",
   pathPrefix:"Pokemon TCG/Pokemon TCG/black-bolt/",
   evidence:"Admin-approved Snivy 001/086 zsv10-5_en_001_std.jpg. R2 CSV does not index Black Bolt images."
  }),
  "24380": Object.freeze({
   set:"ME01: Mega Evolution",
   folder:"mega-evolution",
   code:"me1",
   denominator:"132",
   pathPrefix:"Pokemon TCG/Pokemon TCG/mega-evolution/",
   evidence:"Admin-approved Bulbasaur 001/132 and R2 HTTP 200 for me1_en_001_std.jpg, 002 and 003; index lacks this set"
  }),
  "24587": Object.freeze({
   set:"ME03: Perfect Order",
   folder:"perfect-order",
   code:"me3",
   denominator:"088",
   evidence:"Admin-approved Spinarak 001/088, me3_en_001_std.jpg"
  })
 });
 function get(setId){return entries[String(setId)]||null;}
 function validCandidate(setId,row){
  const entry=get(setId);
  if(!entry||!row)return false;
  const parts=String(row.path||"").split("/");
  const filename=String(row.filename||parts[parts.length-1]||"");
  return parts.length>=2&&parts[parts.length-2]===entry.folder&&
   filename.toLowerCase().startsWith(entry.code.toLowerCase()+"_en_");
 }
 window.CardVectorR2SetMappings=Object.freeze({get,validCandidate});
})();
