/* HomeFinance · module: app.js · v3.2.0 */

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

// ─── DOMContentLoaded — STATIC INIT ONLY ─────────────────
// Data loading is deferred to startAppAfterAuth() (called by auth.js after login).
document.addEventListener('DOMContentLoaded', function(){
  updateTopbarClock();
  initForm();
  applyViewMode();
  var editOverlay = document.getElementById('editOverlay');
  if(editOverlay){
    editOverlay.addEventListener('click', function(e){
      if(e.target===this) closeEdit();
    });
  }
  // auth.js handles session check; on success it calls startAppAfterAuth().
  // If auth.js is absent (no-auth build), fall through directly.
  if (typeof initAuth === 'function') {
    initAuth();
  } else {
    startAppAfterAuth();
  }
});

// ─── CALLED AFTER AUTH IS CONFIRMED ──────────────────────
function startAppAfterAuth() {
  // ล้าง db ก่อนทุกครั้ง — ป้องกันข้อมูล user เก่าค้างอยู่ระหว่างรอ Supabase
  db = [];
  if (typeof accountsData !== 'undefined') accountsData = [];
  if (typeof budgets    !== 'undefined') budgets    = {};
  var startCreds = getSbCreds();
  if(startCreds.ok){
    // Admin ดึง transactions ทั้งหมด, User ดึงเฉพาะของตัวเอง
    var _startUserId = (typeof getAuthUserId === 'function' ? getAuthUserId() : null);
    var _isAdmin     = (typeof isAdminUser   === 'function' && isAdminUser());
    var _txUrl = startCreds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc' +
                 (!_isAdmin && _startUserId ? '&user_id=eq.'+encodeURIComponent(_startUserId) : '');
    Promise.all([
      fetch(_txUrl, { headers: sbGetHeaders(startCreds.key) })
        .then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      sbLoadSettings(),
      sbLoadCategories(),
      sbLoadItems(),
      sbLoadVendors(),
      // v3: load accounts + savings goals from Supabase
      (typeof sbLoadAccounts      === 'function' ? sbLoadAccounts()      : Promise.resolve(null)),
      (typeof sbLoadSavingsGoals  === 'function' ? sbLoadSavingsGoals()  : Promise.resolve(null))
    ]).then(function(results){
      var rows = results[0], settingsMap = results[1], catsData = results[2],
          itemsRows = results[3], vendorRows = results[4],
          sbAccounts = results[5], sbGoals = results[6];
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
        // Merge: ถ้า Supabase ไม่มี vendor_type ให้เอาค่าจาก local มาแทน
        var _localVendors = JSON.parse(localStorage.getItem('hf2_vendors') || '[]');
        var _localVMap = {};
        _localVendors.forEach(function(v){ _localVMap[v.id] = v; });
        vendorsData = vendorRows.map(function(v){
          var lv = _localVMap[v.id];
          if(lv && lv.vendor_type && !v.vendor_type) v.vendor_type = lv.vendor_type;
          return v;
        });
        saveVendorsLocal();
      } else {
        loadVendorsLocal();
      }
      // apply settings
      if(settingsMap){
        applySettingsFromMap(settingsMap);
        updatePersonLabels(); applyViewMode();
      }
      // Supabase เป็น source of truth — null = offline, [] = online ไม่มีข้อมูล
      if(rows !== null){
        db = rows.map(mapSbRow);
        db.sort(function(a,b){ return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });
        save();
      }
      // merge รายการค้าง offline (hf2_pending_sync) เข้า db เสมอ
      // เพื่อให้ user เห็นรายการที่คีย์ไว้ขณะ offline แม้ยังไม่ถึง Supabase
      (function(){
        try {
          var _pq = JSON.parse(localStorage.getItem('hf2_pending_sync') || '[]');
          if (!_pq.length) return;
          var _dbIds = {};
          db.forEach(function(e){ _dbIds[String(e.id)] = true; });
          _pq.forEach(function(e){
            if (!_dbIds[String(e.id)]) { db.push(e); }
          });
          db.sort(function(a,b){ return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });
        } catch(_) {}
      })();
      // v3: merge Supabase accounts into local store
      if(sbAccounts && sbAccounts.length && typeof saveAccountsLocal === 'function'){
        accountsData = sbAccounts;
        saveAccountsLocal();
      }
      // v3: merge Supabase savings goals into local store
      if(sbGoals && sbGoals.length && typeof saveSavingsGoalsLocal === 'function'){
        savingsGoals = sbGoals;
        saveSavingsGoalsLocal();
      }
      initV3Modules();
      renderDash();
      if (typeof renderAccountCards === 'function') renderAccountCards();
      startConnectionMonitor();
      startSilentPullInterval();
    }).catch(function(){
      initV3Modules();
      renderDash();
      startConnectionMonitor();
      startSilentPullInterval();
    });
  } else {
    initV3Modules();
    renderDash();
  }
}

// ─── V3 MODULE INIT ───────────────────────────────────────
function initV3Modules() {
  // Cycle engine: ensure current + next cycle exist
  if (typeof initCycleEngine === 'function') initCycleEngine();

  // Accounts
  if (typeof loadAccountsLocal === 'function') loadAccountsLocal();
  if (typeof fillAccountSelectors === 'function') fillAccountSelectors();

  // Savings goals
  if (typeof loadSavingsGoals === 'function') loadSavingsGoals();

  // Recurring engine (replaces features.js recurring)
  if (typeof initRecurringEngine === 'function') initRecurringEngine();

  // Notification engine
  if (typeof initNotificationEngine === 'function') initNotificationEngine();

  // Salary auto-activate (from salary.js)
  if (typeof autoActivateSalary === 'function') autoActivateSalary();

  // PWA service worker (from features.js)
  if (typeof registerServiceWorker === 'function') registerServiceWorker();
}
