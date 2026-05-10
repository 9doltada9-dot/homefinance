/* HomeFinance · module: app.js · v2.5.0 */

// ─── GLOBAL TICKERS / LISTENERS ───────────────────────────
setInterval(updateTopbarClock, 1000);

// bind ONCE at module level — never re-added on re-render
window.addEventListener('scroll', _swipeScrollClose, {passive:true, capture:true});
document.addEventListener('scroll', _swipeScrollClose, {passive:true, capture:true});

// ─── CLICK OUTSIDE: close note history dropdown ───────────
document.addEventListener('click', function(e){
  var drop = document.getElementById('noteHistoryDrop');
  if(drop && !e.target.closest('#noteWrap')) drop.style.display='none';
});

// ─── CLICK OUTSIDE: close multi-filter dropdowns ──────────
document.addEventListener('click', function(e){
  if(!e.target.closest('.multi-filter')){
    document.querySelectorAll('.mf-dropdown.open').forEach(function(d){d.classList.remove('open');});
  }
});

// ─── CLICK OUTSIDE: close autocomplete lists ──────────────
document.addEventListener('click', function(e){
  if(!e.target.closest('.ac-wrap')){
    document.querySelectorAll('.ac-list').forEach(function(l){l.style.display='none';});
  }
});

// ─── BROWSER ONLINE/OFFLINE EVENTS ────────────────────────
window.addEventListener('online',  function(){ checkConnection(); });
window.addEventListener('offline', function(){ setOnlineState(false); });

// ─── VISIBILITY CHANGE (กลับมาที่แท็บ) ────────────────────
var _lastVisible = Date.now();
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState==='visible'){
    var away = Date.now() - _lastVisible;
    if(away > 15000) checkConnection();
    if(away > 10000) silentPull();
  } else {
    _lastVisible = Date.now();
  }
});

// ─── MIGRATE: ลบ vendor_ctx legacy ออกจาก localStorage ────
(function migrateFavs(){
  try {
    var raw = localStorage.getItem('hf2_favs');
    if(!raw) return;
    var f = JSON.parse(raw);
    if(f.vendor_ctx){ delete f.vendor_ctx; localStorage.setItem('hf2_favs', JSON.stringify(f)); }
  } catch(_){}
})();

// ─── DOMContentLoaded — APP STARTUP ───────────────────────
document.addEventListener('DOMContentLoaded', function(){
  var pA=persons.find(function(x){return x.id==='A';}), pB=persons.find(function(x){return x.id==='B';});
  if(pA) document.getElementById('nameA').value=pA.name;
  if(pB) document.getElementById('nameB').value=pB.name;
  updateTopbarClock();
  initForm();
  applyViewMode();
  var editOverlay = document.getElementById('editOverlay');
  if(editOverlay){
    editOverlay.addEventListener('click', function(e){
      if(e.target===this) closeEdit();
    });
  }
  // auto-load from Supabase on startup
  var startCreds = getSbCreds();
  if(startCreds.ok){
    Promise.all([
      fetch(startCreds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc', { headers: sbHeadersFrom(startCreds.key) })
        .then(function(r){return r.ok?r.json():[];}).catch(function(){return [];}),
      sbLoadSettings(),
      sbLoadCategories(),
      sbLoadItems(),
      sbLoadVendors()
    ]).then(function(results){
      var rows = results[0], settingsMap = results[1], catsData = results[2], itemsRows = results[3], vendorRows = results[4];
      // load categories first
      if(catsData && Array.isArray(catsData)){
        categories = catsData;
        buildCategoryMap();
      }
      if(itemsRows && Array.isArray(itemsRows)){
        buildItemsData(itemsRows);
      } else {
        loadItemsLocal();
      }
      if(vendorRows && Array.isArray(vendorRows)){
        vendorsData = vendorRows;
        saveVendorsLocal();
      } else {
        loadVendorsLocal();
      }
      // apply settings
      if(settingsMap){
        applySettingsFromMap(settingsMap);
        updatePersonLabels(); applyViewMode();
        var pA2=persons.find(function(x){return x.id==='A';}), pB2=persons.find(function(x){return x.id==='B';});
        if(pA2) document.getElementById('nameA').value=pA2.name;
        if(pB2) document.getElementById('nameB').value=pB2.name;
      }
      // apply transactions
      if(rows.length>0){
        db = rows.map(function(e){
          return {
            id:e.id, date:e.date, type:e.type, cat_id:e.cat_id, cat_name:e.cat_name||((categories.find(function(c){return c.id===e.cat_id;})||{}).name||''),
            desc:e.desc, amt:Number(e.amt)||0, person:e.person,
            split:e.split===true||e.split==='true'||e.split==='TRUE',
            status:e.status, note:e.note||''
          };
        });
        save();
      }
      renderDash();
      startConnectionMonitor();
      startSilentPullInterval();
      if (typeof initFeatures === 'function') initFeatures();
    }).catch(function(){
      renderDash();
      startConnectionMonitor();
      startSilentPullInterval();
      if (typeof initFeatures === 'function') initFeatures();
    });
  } else {
    renderDash();
    if (typeof initFeatures === 'function') initFeatures();
  }
});
