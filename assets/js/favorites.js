/* HomeFinance · module: favorites.js · v2.5.0 */

// ─── FAVORITES ────────────────────────────────────────────
// NOTE: shadowed earlier definition removed — using the later
// override (line ~3282 in original) that initializes with
// {cat:{},item:{}} structure.

function getFavs(){ return JSON.parse(localStorage.getItem('hf2_favs')||'{"cat":{},"item":{}}'); }
function saveFavs(f){ localStorage.setItem('hf2_favs', JSON.stringify(f)); }
function isFavCat(catId){ return !!getFavs().cat?.[catId]; }
function isFavItem(desc){ return !!getFavs().item?.[desc]; }
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
  var f=getFavs(); if(!f.vendor) f.vendor={};
  f.vendor[name]=!f.vendor[name]; saveFavs(f); fillVendors();
}
