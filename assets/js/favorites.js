/* HomeFinance · module: favorites.js · v2.9.3 */

// ─── FAVORITES ────────────────────────────────────────────
// เก็บใน localStorage (hf2_favs) AND sync ขึ้น Supabase settings table
// structure: { cat:{catId:bool}, item:{name:bool}, vendor:{name:bool} }

function getFavs(){ return JSON.parse(localStorage.getItem('hf2_favs')||'{"cat":{},"item":{},"vendor":{}}'); }

// เขียน localStorage เท่านั้น (ใช้ตอน apply จาก DB เพื่อไม่ loop กลับ)
function saveFavsLocal(f){ localStorage.setItem('hf2_favs', JSON.stringify(f)); }

// เขียน localStorage + push ขึ้น Supabase (fire-and-forget)
function saveFavs(f){
  saveFavsLocal(f);
  if(typeof sbSaveSetting === 'function') sbSaveSetting('favs', f);
}

function isFavCat(catId)  { return !!getFavs().cat?.[catId]; }
function isFavItem(desc)  { return !!getFavs().item?.[desc]; }
function isFavVendor(name){ return !!getFavs().vendor?.[name]; }

function toggleFavCat(catId){
  var f = getFavs();
  if(!f.cat) f.cat={};
  f.cat[catId] = !f.cat[catId];
  saveFavs(f); fillCats();
}
function toggleFavItem(desc){
  var f = getFavs();
  if(!f.item) f.item={};
  f.item[desc] = !f.item[desc];
  saveFavs(f); fillDescByCat(document.getElementById('fCat')?.value);
}
function toggleFavVendor(name){
  var f = getFavs();
  if(!f.vendor) f.vendor={};
  f.vendor[name] = !f.vendor[name];
  saveFavs(f);
  fillVendors();
  fillEditVendors();
}
