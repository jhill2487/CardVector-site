/* Verified PokéWallet set IDs to Cloudflare R2 archive folders.
   Map only reviewed, exact set identities. Never infer an unreviewed folder from a card name. */
(() => {
 "use strict";
 const entries = Object.freeze({
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
