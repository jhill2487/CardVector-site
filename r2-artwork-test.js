/* CardVector R2 CSV artwork-first preview. Read-only; never writes review decisions. */
(() => {
 "use strict";
 const norm=value=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const number=value=>String(value||"").split("/")[0].replace(/^0+(?=\d)/,"").toLowerCase();
 const folderNames=setName=>[String(setName||"").replace(/^[^:]{2,12}:\s*/,"").trim(),String(setName||"")].map(norm).filter(Boolean);
 const isStd=row=>/_std\.(?:jpg|jpeg|png|webp)$/i.test(row.filename||"");
 function chooseFolder(rows,setName,mapping,selectedFolder){
  if(mapping?.folder)return {folder:mapping.folder,source:"registry"};
  if(selectedFolder)return {folder:selectedFolder,source:"admin selection"};
  const names=folderNames(setName);
  const hits=[...new Set(rows.map(r=>r.setSlug))].filter(folder=>folder&&names.includes(norm(folder)));
  return hits.length===1?{folder:hits[0],source:"CSV exact set name"}:{folder:null,source:hits.length?"ambiguous folder":"folder unavailable"};
 }
 function plan(rows,cards,setName,mapping,selectedFolder){
  const choice=chooseFolder(rows,setName,mapping,selectedFolder);
  if(!choice.folder)return {choice,matched:[],missing:cards.map(card=>({card,reason:"R2 folder unverified"})),ambiguous:[],indexed:0};
  const indexed=rows.filter(r=>r.setSlug===choice.folder),groups=new Map();
  for(const row of indexed){
   if(!row.number||!isStd(row))continue;
   if(mapping?.code&&!String(row.filename).toLowerCase().startsWith(mapping.code.toLowerCase()+"_en_"))continue;
   const key=number(row.number);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(row);
  }
  const matched=[],missing=[],ambiguous=[];
  for(const card of cards){
   if(mapping?.denominator&&String(card.card_number||"").split("/")[1]!==mapping.denominator){
    missing.push({card,reason:"collector denominator differs from verified R2 series"});continue;
   }
   const candidates=groups.get(number(card.card_number))||[];
   // Modern numeric-only filename is resolved using the set folder and number.
   // When the image filename contains a card name, also require agreement.
   const suitable=candidates.filter(row=>!row.name||norm(row.name)===norm(card.card_name));
   const unique=new Map(suitable.map(row=>[row.path,row]));
   if(unique.size===1)matched.push({card,row:[...unique.values()][0]});
   else if(unique.size>1)ambiguous.push({card,reason:"multiple standard images for same number"});
   else missing.push({card,reason:candidates.length?"card name mismatch":"standard artwork not indexed"});
  }
  return {choice,matched,missing,ambiguous,indexed:indexed.length};
 }
 window.CardVectorR2ArtworkTest=Object.freeze({plan,chooseFolder});
})();
