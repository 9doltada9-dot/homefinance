/* HomeFinance · module: supabase.js · v3.0.0 */

// ─── ROW MAPPER (Supabase → local JS object) ──────────────
/**
 * Maps a raw Supabase row to the internal transaction object.
 * Handles both v2 (no cycle_id/billing_month) and v3 rows.
 */
function mapSbRow(e) {
  return {
    id:           e.id,
    date:         e.date,
    type:         e.type,
    cat_id:       e.cat_id,
    cat_name:     e.cat_name || ((categories.find(function(c){ return c.id===e.cat_id; })||{}).name||''),
    desc:         e.desc,
    amt:          Number(e.amt)||0,
    person:       e.person,
    split:        e.split===true||e.split==='true'||e.split==='TRUE',
    status:       e.status,
    note:         e.note||'',
    item_id:      e.item_id||null,
    vendor_id:    e.vendor_id||null,
    vendor_name:  e.vendor_name||'',
    // v3 fields
    cycle_id:           e.cycle_id||null,
    billing_month:      e.billing_month||null,
    account_id:         e.account_id||null,
    transfer_direction: e.transfer_direction||null,
    transfer_pair_id:   e.transfer_pair_id||null,
    _recurring_id:      e._recurring_id||null,
    _salary_cycle:      e._salary_cycle||false,
    // settlement group
    split_group_id: e.split_group_id||null,
    split_type:     e.split_type||null,
    split_snapshot: e.split_snapshot||null,
    user_id:        e.user_id||null,
  };
}

// ─── SUPABASE CREDENTIALS ─────────────────────────────────
var SB_URL = localStorage.getItem('hf2_sb_url') || (typeof SB_URL_DEFAULT !== 'undefined' ? SB_URL_DEFAULT : '');
var SB_KEY = localStorage.getItem('hf2_sb_key') || (typeof SB_KEY_DEFAULT !== 'undefined' ? SB_KEY_DEFAULT : '');

// ─── CATEGORIES SYNC ──────────────────────────────────────
async function sbAddCategory(cat){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'return=representation'});
    var r = await fetch(creds.url+'/rest/v1/categories', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        name: cat.name,
        type: cat.type,
        split_default: cat.split_default,
        sort_order: cat.sort_order
      }),
    });
    if(!r.ok){
      var t = await r.text();
      console.error('sbAddCategory error:', r.status, t);
      return null;
    }
    var rows = await r.json();
    return rows[0] || null; // return row with DB-generated uuid
  } catch(e){ console.error('sbAddCategory:', e); return null; }
}

async function sbUpdateCategory(cat){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    await fetch(creds.url+'/rest/v1/categories?id=eq.'+encodeURIComponent(cat.id), {
      method: 'PATCH',
      headers: sbHeadersFrom(creds.key),
      body: JSON.stringify({
        name: cat.name,
        group: cat.group,
        split_default: cat.split_default,
        sort_order: cat.sort_order
      })
    });
  } catch(_){}
}

async function sbDeleteCategory(catId){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    await fetch(creds.url+'/rest/v1/categories?id=eq.'+encodeURIComponent(catId), {
      method: 'DELETE',
      headers: sbHeadersFrom(creds.key)
    });
  } catch(_){}
}

async function sbLoadCategories(){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var r = await fetch(creds.url+'/rest/v1/categories?select=*&order=sort_order', {
      headers: sbHeadersFrom(creds.key)
    });
    if(!r.ok) return null;
    return await r.json();
  } catch(_){ return null; }
}

// ─── SETTINGS SYNC ────────────────────────────────────────
async function sbSaveSetting(key, value){
  localStorage.setItem('hf2_'+key, JSON.stringify(value));
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'resolution=merge-duplicates,return=minimal'});
    await fetch(creds.url+'/rest/v1/'+SB_SETTINGS_TABLE, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ key: key, value: value }),
    });
  } catch(_){}
}

async function sbLoadSettings(){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var r = await fetch(creds.url+'/rest/v1/'+SB_SETTINGS_TABLE+'?select=key,value', {
      headers: sbHeadersFrom(creds.key)
    });
    if(!r.ok) return null;
    var rows = await r.json();
    var map = {};
    rows.forEach(function(row){ map[row.key] = row.value; });
    return map;
  } catch(_){ return null; }
}

async function sbPushAllSettings(){
  var creds = getSbCreds();
  if(!creds.ok){ showMsg('sbMsg','กรุณาใส่ URL และ Key ก่อน','error'); return; }
  var payload = [
    { key:'persons',      value: persons },
    { key:'income_cats',  value: cats.income },
    { key:'expense_cats', value: cats.expense },
    { key:'no_split',     value: NO_SPLIT },
    { key:'viewmode',     value: viewMode },
  ];
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'resolution=merge-duplicates,return=minimal'});
    var r = await fetch(creds.url+'/rest/v1/'+SB_SETTINGS_TABLE, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });
    if(!r.ok){ var t=await r.text(); throw new Error(r.status+' '+t.slice(0,120)); }
    showMsg('sbMsg','Push Settings สำเร็จ! บันทึกการตั้งค่าทั้งหมดขึ้น Supabase แล้ว','success');
  } catch(e){
    showMsg('sbMsg','Push Settings ไม่ได้: '+e.message,'error');
  }
}

// ─── SPLIT GROUPS SYNC ───────────────────────────────────
/** บันทึก split_groups ขึ้น Supabase settings (key=split_groups, value=JSON array) */
async function sbSaveSplitGroups(groups){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'resolution=merge-duplicates,return=minimal'});
    await fetch(creds.url+'/rest/v1/'+SB_SETTINGS_TABLE, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify([{ key: 'split_groups', value: groups }]),
    });
  } catch(e){ console.warn('[sg] sbSaveSplitGroups:', e); }
}

// ─── ITEMS SYNC ───────────────────────────────────────────
async function sbLoadItems(){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/items?select=*&order=sort_order',
      { headers: sbHeadersFrom(creds.key) }, 8000
    );
    if(!r.ok) return null;
    return await r.json();
  } catch(_){ return null; }
}

async function sbAddItem(catId, name, sortOrder){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'return=representation'});
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/items',
      { method:'POST', headers: headers,
        body: JSON.stringify({cat_id:catId, name:name, sort_order:sortOrder}) }, 8000
    );
    if(!r.ok) return null;
    var rows = await r.json();
    return rows[0]||null;
  } catch(_){ return null; }
}

async function sbDeleteItem(itemId){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    await fetchWithTimeout(
      creds.url+'/rest/v1/items?id=eq.'+encodeURIComponent(itemId),
      { method:'DELETE', headers:sbHeadersFrom(creds.key) }, 8000
    );
  } catch(_){}

async function sbUpdateItem(itemId, newName){
  var creds = getSbCreds();
  if(!creds.ok) return false;
  try {
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/items?id=eq.'+encodeURIComponent(itemId),
      { method:'PATCH', headers:sbHeadersFrom(creds.key),
        body: JSON.stringify({name:newName}) }, 8000
    );
    return r.ok;
  } catch(_){ return false; }
}
}

// ─── VENDORS SYNC ─────────────────────────────────────────
async function sbLoadVendors(){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/vendors?select=*&order=sort_order',
      { headers: sbHeadersFrom(creds.key) }, 8000
    );
    if(!r.ok) return null;
    return await r.json();
  } catch(_){ return null; }
}

async function sbAddVendor(name, sortOrder, vendorType){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'return=representation'});
    var payload = {name:name, sort_order:sortOrder};
    if(vendorType) payload.vendor_type = vendorType;
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/vendors',
      { method:'POST', headers: headers,
        body: JSON.stringify(payload) }, 8000
    );
    if(!r.ok) return null;
    var rows = await r.json();
    return rows[0]||null;
  } catch(_){ return null; }
}

async function sbUpdateVendor(id, newName, vendorType){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var payload = {name: newName};
    if(vendorType !== undefined) payload.vendor_type = vendorType;
    await fetchWithTimeout(
      creds.url+'/rest/v1/vendors?id=eq.'+encodeURIComponent(id),
      { method:'PATCH', headers:sbHeadersFrom(creds.key),
        body: JSON.stringify(payload) }, 8000
    );
  } catch(_){}
}

async function sbDeleteVendor(id){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    await fetchWithTimeout(
      creds.url+'/rest/v1/vendors?id=eq.'+encodeURIComponent(id),
      { method:'DELETE', headers:sbHeadersFrom(creds.key) }, 8000
    );
  } catch(_){}
}

// ─── SILENT PULL ──────────────────────────────────────────
var _lastPullTs = 0;
var _pullInProgress = false;

/** ผลลัพธ์: db array จาก Supabase หรือ null ถ้าล้มเหลว
 *  Admin ดึงทั้งหมด | User ดึงเฉพาะของตัวเอง | Supabase = source of truth */
async function _fetchAndMerge(creds, timeoutMs) {
  var ctrl = new AbortController();
  var t = setTimeout(function(){ ctrl.abort(); }, timeoutMs || 8000);
  var userId   = (typeof getAuthUserId === 'function' ? getAuthUserId() : null);
  var _isAdmin = (typeof isAdminUser   === 'function' && isAdminUser());
  var r = await fetch(
    creds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc' +
    (!_isAdmin && userId ? '&user_id=eq.'+encodeURIComponent(userId) : ''),
    { headers: sbGetHeaders(creds.key), signal: ctrl.signal }
  );
  clearTimeout(t);
  if(!r.ok) throw new Error('HTTP '+r.status);
  var rows = await r.json();
  if(!rows) return null;
  var merged = rows.map(mapSbRow);
  merged.sort(function(a,b){ return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });
  return merged;
}

/** อัปเดต UI ทุกหน้าที่เกี่ยวข้องกับข้อมูล */
function _renderAllDataPages() {
  renderDash();
  var activePage = (document.querySelector('.page.active')||{}).id;
  if(activePage==='page-transactions') renderTx();
  if(activePage==='page-accounts'){
    if(typeof renderAccountCards==='function') renderAccountCards();
    if(typeof renderAccountList ==='function') renderAccountList();
  }
  if(activePage==='page-settlement'){ if(typeof renderSettle==='function') renderSettle(); }
  if(activePage==='page-budget')    { if(typeof renderBudget==='function')  renderBudget(); }
  if(activePage==='page-savings')   { if(typeof renderSavingsGoals==='function') renderSavingsGoals(); }
}

async function silentPull(){
  if(_pullInProgress) return;
  if(isFileProtocol()) return;
  var creds = getSbCreds();
  if(!creds.ok) return;
  var now = Date.now();
  if(now - _lastPullTs < 5000) return; // throttle 5 วิ
  _pullInProgress = true;
  _lastPullTs = now;
  try {
    var merged = await _fetchAndMerge(creds, 8000);
    if(!merged){ _pullInProgress=false; return; }
    // checksum — ไม่ render ถ้าข้อมูลเหมือนเดิม
    var hash = merged.map(function(e){return String(e.id)+String(e.status)+String(e.amt);}).join('|');
    var old  = db.map(function(e){return String(e.id)+String(e.status)+String(e.amt);}).join('|');
    if(hash !== old){
      db = merged;
      save();
      _renderAllDataPages();
    }
  } catch(_){} // abort หรือ error ใดๆ → fail silently
  _pullInProgress = false;
}

/** Force-pull — ไม่สนใจ throttle, แสดง UI feedback */
var _forceRefreshing = false;
async function forceRefreshFromDB(){
  if(_forceRefreshing) return;
  if(isFileProtocol()){ showCycleToast('⚠️ ไม่มี Database — เปิดจาก file://'); return; }
  var creds = getSbCreds();
  if(!creds.ok){ showCycleToast('⚠️ ยังไม่ได้ตั้งค่า Database'); return; }

  _forceRefreshing = true;
  var btn = document.getElementById('topbarRefreshBtn');
  if(btn) { btn.style.opacity = '0.4'; btn.style.pointerEvents = 'none'; }

  try {
    var merged = await _fetchAndMerge(creds, 12000);
    if(!merged) throw new Error('ไม่ได้รับข้อมูล');
    db = merged;
    save();
    _lastPullTs = Date.now();
    _renderAllDataPages();
    // อัปเดต sync panel ถ้าเปิดอยู่
    var localEl = document.getElementById('syncLocalCount');
    if(localEl) refreshSyncStatus();
    showCycleToast('✅ ดึงข้อมูลล่าสุดสำเร็จ (' + db.length + ' รายการ)');
  } catch(e){
    showCycleToast('❌ ดึงข้อมูลไม่ได้: ' + (e.message||'network error'));
  }

  _forceRefreshing = false;
  if(btn) { btn.style.opacity = ''; btn.style.pointerEvents = ''; }
}

// pull ทุก 30 วินาที (เริ่มหลัง 10 วิ เพื่อไม่ชนกับ startup)
function startSilentPullInterval(){
  setTimeout(function(){
    silentPull();
    setInterval(silentPull, 30000);
  }, 10000);
}

// ─── CONNECTION MONITOR ───────────────────────────────────
var _isOnline = true; // assume online until proven otherwise
var _checkTimer = null;

function sbStatus(state, msg){
  msg = msg || '';
  var dot=document.getElementById('sbDot'), txt=document.getElementById('sbStatusText');
  if(!dot||!txt) return;
  var map={
    idle:['#d4d1c8','ยังไม่ได้ทดสอบ'],
    ok:['#1a7a4a','เชื่อมต่อสำเร็จ ✓'],
    error:['#c0392b','เชื่อมต่อไม่ได้'],
    loading:['#b5600a','กำลังเชื่อมต่อ...']
  };
  var pair = map[state]||map.idle;
  var c = pair[0], l = pair[1];
  dot.style.background=c; txt.textContent=msg||l;
}

function initSbPage(){
  var ui=document.getElementById('sbUrl'), ki=document.getElementById('sbKey');
  if(ui) ui.value=SB_URL;
  if(ki) ki.value=SB_KEY;
  if(isFileProtocol()){
    showMsg('sbMsg','⚠️ เปิดจาก file:// — กรุณา deploy ขึ้น Netlify หรือเปิดผ่าน http://localhost:8080 เพื่อใช้ Supabase','error');
    sbStatus('error','เปิดจาก file:// — ไม่สามารถเชื่อมต่อได้');
    return;
  }
  sbStatus(SB_URL&&SB_KEY?'idle':'idle');
}

async function testSupabase(){
  saveSbCreds();
  if(!SB_URL||!SB_KEY){ showMsg('sbMsg','กรุณาใส่ URL และ Key ก่อน','error'); return; }
  if(isFileProtocol()){
    sbStatus('error','เปิดจาก file:// — ต้อง deploy หรือใช้ local server');
    showMsg('sbMsg','⚠️ เปิดจาก file:// — browser บล็อก CORS\nกรุณา deploy ขึ้น Netlify หรือเปิดผ่าน python -m http.server 8080','error');
    return;
  }
  sbStatus('loading');
  try {
    var headers = Object.assign({}, sbHeaders(), {'Prefer':'count=exact'});
    var r = await fetchWithTimeout(
      SB_URL+'/rest/v1/'+SB_TABLE+'?select=id&limit=1',
      { headers: headers }, 10000
    );
    if(!r.ok){ var t=await r.text(); throw new Error(r.status+' '+t.slice(0,100)); }
    var count = r.headers.get('content-range') || '';
    sbStatus('ok');
    showMsg('sbMsg','เชื่อมต่อสำเร็จ! Table transactions พร้อมใช้งาน ('+count+')','success');
    startConnectionMonitor();
  } catch(e){
    sbStatus('error');
    var msg = 'เชื่อมต่อไม่ได้: '+e.message;
    if(e.name==='AbortError') msg = 'หมดเวลาเชื่อมต่อ — ตรวจสอบ URL และ Key';
    if(e.name==='TypeError') msg = 'เชื่อมต่อไม่ได้ — ตรวจสอบ URL และ Anon Key';
    showMsg('sbMsg', msg, 'error');
  }
}

async function checkConnection(){
  if(isFileProtocol()){ setOnlineState(true); return; }
  var creds = getSbCreds();
  if(!creds.ok){ setOnlineState(true); return; }
  try {
    // ใช้ /auth/v1/settings — public endpoint ไม่ต้องการ JWT
    var r = await fetchWithTimeout(
      creds.url + '/auth/v1/settings',
      { headers: { 'apikey': creds.key } }, 8000
    );
    setOnlineState(r.ok);
  } catch(_){ setOnlineState(false); }
}

function setOnlineState(online){
  var wasOffline = !_isOnline;
  _isOnline = online;
  updateConnectionUI(online);
  if(online && wasOffline) hideOfflineBanner();
  if(!online) showOfflineBanner();
}

function updateConnectionUI(online){
  var color = online ? '#1a7a4a' : '#c0392b';
  var sidebarDot = document.getElementById('sidebarOnlineDot');
  var sidebarTxt = document.getElementById('sidebarOnlineTxt');
  if(sidebarDot) sidebarDot.style.background = color;
  if(sidebarTxt){ sidebarTxt.textContent = online ? 'Online' : 'Offline'; sidebarTxt.style.color = color; }
  var dot = document.getElementById('sbDot');
  var txt = document.getElementById('sbStatusText');
  var rtDot = document.getElementById('rtDot');
  var rtDot2 = document.getElementById('rtDot2');
  var rtTxt = document.getElementById('rtStatusText');
  if(dot) dot.style.background = color;
  if(txt) txt.textContent = online ? 'เชื่อมต่อแล้ว ✓' : 'ขาดการเชื่อมต่อ';
  if(rtDot) rtDot.style.background = color;
  if(rtDot2) rtDot2.style.background = color;
  if(rtTxt) rtTxt.textContent = online ? 'สถานะ: ออนไลน์ ✓' : 'สถานะ: ออฟไลน์';
}

// ─── OFFLINE BANNER + TOAST ───────────────────────────────
function showOfflineBanner(){
  var b = document.getElementById('offlineBanner');
  if(!b){
    b = document.createElement('div');
    b.id = 'offlineBanner';
    b.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:500',
      'background:#c0392b;color:#fff',
      'padding:10px 16px 10px',
      'font-size:13px;font-weight:600;font-family:Sarabun,sans-serif',
      'display:flex;align-items:center;justify-content:center;gap:8px',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)',
      'animation:slideDown .25s ease'
    ].join(';');
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">'+
      '<path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 4v5m0 2v1"/>'+
      '<circle cx="10" cy="13" r="1"/>'+
      '<path d="M10 6v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>'+
      '</svg>'+
      'ขาดการเชื่อมต่อ Supabase — กำลังลองใหม่...';
    document.body.prepend(b);
  }
  b.style.display = 'flex';
  document.body.classList.add('ui-offline');
}

function hideOfflineBanner(){
  var b = document.getElementById('offlineBanner');
  if(b){
    b.style.transition = 'opacity .3s';
    b.style.opacity = '0';
    setTimeout(function(){ b.style.display='none'; b.style.opacity=''; }, 300);
  }
  document.body.classList.remove('ui-offline');
  showConnectToast('เชื่อมต่อแล้ว — อัปเดตข้อมูลล่าสุดเรียบร้อย');
}

// toast แจ้งเตือนตอน offline พยายามทำ action
var _offlineToastTimer = null;
function showOfflineActionToast(){
  var t = document.getElementById('offlineActionToast');
  if(!t){
    t = document.createElement('div');
    t.id = 'offlineActionToast';
    t.style.cssText = [
      'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px)',
      'left:50%;transform:translateX(-50%)',
      'background:#c0392b;color:#fff',
      'padding:11px 20px;border-radius:24px',
      'font-size:13px;font-weight:600;font-family:Sarabun,sans-serif',
      'z-index:999;white-space:nowrap',
      'box-shadow:0 4px 20px rgba(0,0,0,.3)',
      'display:flex;align-items:center;gap:8px',
      'transition:opacity .3s,transform .3s',
    ].join(';');
    t.innerHTML = '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">'+
      '<path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" opacity=".2"/>'+
      '<path d="M10 6v5M10 13v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>'+
      '</svg>'+
      'ไม่สามารถดำเนินการได้ — ขาดการเชื่อมต่อ';
    document.body.appendChild(t);
  }
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(_offlineToastTimer);
  _offlineToastTimer = setTimeout(function(){
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(8px)';
  }, 3000);
}

// เรียกก่อนทุก action ที่เขียนข้อมูล — return true = ผ่าน, false = ห้าม
function checkOnlineForAction(){
  if(!_isOnline && getSbCreds().ok){
    showOfflineActionToast();
    return false;
  }
  return true;
}

var _toastTimer = null;
function showConnectToast(msg){
  var t = document.getElementById('connToast');
  if(!t){
    t = document.createElement('div'); t.id = 'connToast';
    t.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px);left:50%;transform:translateX(-50%);background:#1a7a4a;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3);transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.style.opacity='0'; }, 4000);
}

// ตรวจสอบทุก 10 วินาที
function startConnectionMonitor(){
  checkConnection();
  _checkTimer = setInterval(checkConnection, 10000);
}

// ─── PUSH / PULL (manual) ─────────────────────────────────
async function sbPush(){
  saveSbCreds();
  if(!SB_URL||!SB_KEY){ showMsg('sbMsg','กรุณาใส่ URL และ Key ก่อน','error'); return; }
  sbStatus('loading','กำลัง Push...');
  try {
    // upsert all entries
    var rows = db.map(function(e){
      return {
        id: String(e.id), date: e.date, type: e.type, cat_id: e.cat_id||null,
        desc: e.desc, amt: e.amt, person: e.person,
        split: e.split, status: e.status||doneStatus(e.type),
        note: e.note||'', item_id: e.item_id||null
      };
    });
    var headers = Object.assign({}, sbHeaders(), {'Prefer':'resolution=merge-duplicates,return=minimal'});
    var r = await fetch(SB_URL+'/rest/v1/'+SB_TABLE, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(rows),
    });
    if(!r.ok){ var t=await r.text(); throw new Error(r.status+' '+t.slice(0,120)); }
    sbStatus('ok');
    showMsg('sbMsg','Push สำเร็จ! อัปเดต '+rows.length+' รายการขึ้น Supabase', 'success');
  } catch(e){
    sbStatus('error');
    showMsg('sbMsg','Push ไม่ได้: '+e.message,'error');
  }
}

async function sbPull(){
  saveSbCreds();
  var creds = getSbCreds();
  if(!creds.ok){ showMsg('sbMsg','กรุณาใส่ URL และ Key ก่อน','error'); return; }
  sbStatus('loading','กำลัง Pull...');
  try {
    var results = await Promise.all([
      fetch(creds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc', { headers: sbHeadersFrom(creds.key) })
        .then(function(r){return r.ok?r.json():Promise.reject(r.status);}),
      sbLoadSettings(),
      sbLoadCategories(),
      sbLoadItems(),
      sbLoadVendors()
    ]);
    var rows = results[0], settingsMap = results[1], catsData = results[2], itemsRows = results[3], vendorRows = results[4];
    if(catsData && Array.isArray(catsData)){
      categories = catsData; buildCategoryMap(); fillCats();
      // refresh filter dropdowns if on transactions page
      populateMFCat(); populateMFItem();
    }
    if(itemsRows && Array.isArray(itemsRows)){
      buildItemsData(itemsRows);
      populateMFItem();
    }
    if(vendorRows && Array.isArray(vendorRows)){
      vendorsData = vendorRows;
      saveVendorsLocal();
      fillVendors();
    }
    // apply settings
    if(settingsMap){
      applySettingsFromMap(settingsMap);
      updatePersonLabels(); applyViewMode();
      var pA=persons.find(function(x){return x.id==='A';}), pB=persons.find(function(x){return x.id==='B';});
      if(pA) document.getElementById('nameA').value=pA.name;
      if(pB) document.getElementById('nameB').value=pB.name;
    }
    // apply transactions
    db = rows.map(mapSbRow);
    save();
    sbStatus('ok');
    showMsg('sbMsg','Pull สำเร็จ! ได้ '+db.length+' รายการ + settings + '+categories.length+' หมวด จาก Supabase', 'success');
    renderDash();
    var pg=(document.querySelector('.page.active')||{}).id;
    if(pg) pg = pg.replace('page-','');
    if(pg==='settings') renderSettings();
  } catch(e){
    sbStatus('error');
    showMsg('sbMsg','Pull ไม่ได้: '+e.message,'error');
  }
}

// ─── TRANSACTION SYNC (single row) ────────────────────────
async function sbAdd(e){
  if(!_isOnline){ showCycleToast('❌ ไม่มีการเชื่อมต่อ กรุณาตรวจสอบอินเทอร์เน็ต'); return false; }
  var creds = getSbCreds();
  if(!creds.ok) return false;
  try {
    var catId = e.cat_id || ((categories.find(function(c){return c.name===e.cat_name;})||{}).id) || null;
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'resolution=merge-duplicates,return=minimal'});
    var cycleId      = e.cycle_id      || (typeof cycleIdFromDate === 'function' ? cycleIdFromDate(e.date) : null);
    var billingMonth = e.billing_month || (e.date ? e.date.slice(0,7) : null);
    var r = await fetch(creds.url+'/rest/v1/'+SB_TABLE, {
      method:'POST',
      headers: headers,
      body:JSON.stringify([{
        id:String(e.id), date:e.date,
        type:e.type,
        cat_id:catId,
        desc:e.desc, amt:e.amt, person:e.person,
        split:e.split,
        status:e.status||doneStatus(e.type),
        note:e.note||'',
        item_id:e.item_id||null,
        vendor_id:e.vendor_id||null,
        cycle_id:       cycleId||null,
        billing_month:  billingMonth||null,
        account_id:     e.account_id||null,
        transfer_direction: e.transfer_direction||null,
        transfer_pair_id:   e.transfer_pair_id||null,
        _recurring_id:  e._recurring_id||null,
        split_group_id: e.split_group_id||null,
        split_type:     e.split_type||null,
        split_snapshot: e.split_snapshot||null,
        user_id: (typeof getAuthUserId==='function' ? getAuthUserId() : null) || e.user_id || null,
      }])
    });
    if(r.ok) return true;
    if(r.status === 401){ showCycleToast('❌ Session หมดอายุ กรุณา Login ใหม่'); return false; }
    showCycleToast('❌ บันทึกไม่สำเร็จ ('+r.status+') กรุณาลองใหม่');
    return false;
  } catch(_){ showCycleToast('❌ บันทึกไม่สำเร็จ กรุณาลองใหม่'); return false; }
}

async function sbUpdate(e){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var catId = e.cat_id || ((categories.find(function(c){return c.name===e.cat_name;})||{}).id) || null;
    var cycleId      = e.cycle_id      || (typeof cycleIdFromDate === 'function' ? cycleIdFromDate(e.date) : null);
    var billingMonth = e.billing_month || (e.date ? e.date.slice(0,7) : null);
    await fetch(creds.url+'/rest/v1/'+SB_TABLE+'?id=eq.'+encodeURIComponent(String(e.id)), {
      method:'PATCH',
      headers:sbHeadersFrom(creds.key),
      body:JSON.stringify({
        date:e.date,
        type:e.type,
        cat_id:catId,
        desc:e.desc, amt:e.amt, person:e.person, split:e.split,
        status:e.status||doneStatus(e.type),
        note:e.note||'',
        item_id:e.item_id||null,
        vendor_id:e.vendor_id||null,
        // v3 new fields
        cycle_id:      cycleId||null,
        billing_month: billingMonth||null,
        account_id:    e.account_id||null,
        // v3.2: คงผู้จ่ายต้นฉบับ — ❌ ห้ามใช้ getAuthUserId() ตอน PATCH เพราะ admin แก้ไขจะ overwrite user_id ของ user อื่น
        user_id: e.user_id || null,
        // settlement group
        split_group_id: e.split_group_id||null,
        split_type:     e.split_type||null,
        split_snapshot: e.split_snapshot||null,
      })
    });
  } catch(_){}
}

async function sbDelete(id){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    await fetch(creds.url+'/rest/v1/'+SB_TABLE+'?id=eq.'+encodeURIComponent(String(id)), {
      method:'DELETE', headers:sbHeadersFrom(creds.key)
    });
  } catch(_){}
}

// ─── SYNC PANEL HELPERS ───────────────────────────────────
async function getSbTxCount(){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/'+SB_TABLE+'?select=id',
      { headers: Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'count=exact'}) }, 8000
    );
    if(!r.ok) return null;
    var cr = r.headers.get('content-range') || '';
    // content-range: 0-24/25 → total = 25
    var m = cr.match(/\/(\d+)$/);
    return m ? parseInt(m[1]) : (await r.json()).length;
  } catch(_){ return null; }
}

async function refreshSyncStatus(){
  var localEl = document.getElementById('syncLocalCount');
  var dbEl    = document.getElementById('syncDbCount');
  var msgEl   = document.getElementById('syncStatusMsg');
  if(localEl) localEl.textContent = db.length + ' รายการ';
  if(dbEl)    dbEl.textContent    = '⏳ กำลังตรวจสอบ...';
  if(msgEl)   { msgEl.textContent = ''; }

  var creds = getSbCreds();
  if(!creds.ok){
    if(dbEl)  dbEl.textContent  = 'ไม่มี Database';
    if(msgEl) { msgEl.style.color='var(--ink3)'; msgEl.textContent='ยังไม่ได้ตั้งค่า Supabase URL/Key'; }
    return;
  }

  try {
    // ดึงข้อมูลจริงและ merge พร้อมกัน (ไม่ใช่แค่นับ)
    var merged = await _fetchAndMerge(creds, 10000);
    var dbCount = merged ? (merged.length - db.filter(function(e){
      var inSb = false;
      merged.forEach(function(m){ if(String(m.id)===String(e.id)) inSb=true; });
      return !inSb;
    }).length) : null;

    // อ่าน count ตรงจาก DB
    var countR = await fetchWithTimeout(
      creds.url+'/rest/v1/'+SB_TABLE+'?select=id',
      { headers: Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'count=exact'}) }, 8000
    );
    var dbCount2 = null;
    if(countR.ok){
      var cr = countR.headers.get('content-range') || '';
      var m2 = cr.match(/\/(\d+)$/);
      dbCount2 = m2 ? parseInt(m2[1]) : null;
    }

    if(dbEl) dbEl.textContent = dbCount2 !== null ? dbCount2 + ' รายการ' : 'อ่านไม่ได้';

    // apply merge ถ้าข้อมูลต่างจากเดิม
    if(merged){
      var hash = merged.map(function(e){return String(e.id)+String(e.status);}).join('|');
      var old  = db.map(function(e){return String(e.id)+String(e.status);}).join('|');
      if(hash !== old){
        db = merged;
        save();
        _renderAllDataPages();
      }
    }

    if(localEl) localEl.textContent = db.length + ' รายการ';

    if(msgEl && dbCount2 !== null){
      var localCount = db.filter(function(e){
        // นับเฉพาะที่ยังไม่ใน DB (local-only)
        return true;
      }).length;
      var diff = db.length - dbCount2;
      if(diff > 0){
        msgEl.style.color = 'var(--amber,#d97706)';
        msgEl.textContent = '⚠️ ในเครื่องมีมากกว่า Database ' + diff + ' รายการ — กด "อัปโหลด" เพื่อซิงก์';
      } else if(diff < 0){
        msgEl.style.color = 'var(--blue)';
        msgEl.textContent = '📥 Database มีมากกว่าในเครื่อง ' + Math.abs(diff) + ' รายการ (ดึงมาแล้ว)';
      } else {
        msgEl.style.color = 'var(--green)';
        msgEl.textContent = '✅ ข้อมูลตรงกัน — อัปเดตล่าสุดแล้ว (' + db.length + ' รายการ)';
      }
    }
  } catch(e){
    if(dbEl)  dbEl.textContent  = 'เชื่อมต่อไม่ได้';
    if(msgEl) { msgEl.style.color='var(--red)'; msgEl.textContent='❌ ตรวจสอบไม่ได้: '+(e.message||'network error'); }
  }
}

async function sbPushAllLocal(){
  if(!checkOnlineForAction()) return;
  var creds = getSbCreds();
  if(!creds.ok){ showCycleToast('⚠️ ยังไม่ได้ตั้งค่า Database'); return; }
  var btnEl = document.getElementById('syncPushBtn');
  var msgEl = document.getElementById('syncStatusMsg');
  if(btnEl){ btnEl.disabled=true; btnEl.textContent='⏳ กำลังอัปโหลด...'; }
  try {
    // upsert ทีละ 500 rows (Supabase limit)
    var BATCH = 500;
    var total = 0;
    var userId = (typeof getAuthUserId==='function' ? getAuthUserId() : null);
    for(var i=0; i<db.length; i+=BATCH){
      var chunk = db.slice(i, i+BATCH).map(function(e){
        var catId = e.cat_id || ((categories.find(function(c){return c.name===e.cat_name;})||{}).id)||null;
        return {
          id: String(e.id), date: e.date, type: e.type,
          cat_id: catId, desc: e.desc, amt: e.amt,
          person: e.person, split: e.split||false,
          status: e.status||doneStatus(e.type), note: e.note||'',
          item_id: e.item_id||null, vendor_id: e.vendor_id||null,
          cycle_id: e.cycle_id||null, billing_month: e.billing_month||null,
          account_id: e.account_id||null,
          transfer_direction: e.transfer_direction||null,
          transfer_pair_id:   e.transfer_pair_id||null,
          user_id: e.user_id || userId || null,
        };
      });
      var r = await fetch(creds.url+'/rest/v1/'+SB_TABLE, {
        method: 'POST',
        headers: Object.assign({}, sbHeadersFrom(creds.key), {
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        }),
        body: JSON.stringify(chunk)
      });
      if(!r.ok){ var t=await r.text(); throw new Error('HTTP '+r.status+': '+t.slice(0,120)); }
      total += chunk.length;
    }
    if(typeof updateConnectionUI==='function') updateConnectionUI(true);
    if(msgEl){ msgEl.style.color='var(--green)'; msgEl.textContent='✅ อัปโหลด '+total+' รายการสำเร็จ'; }
    showCycleToast('✅ อัปโหลด '+total+' รายการขึ้น Database สำเร็จ');
    setTimeout(refreshSyncStatus, 1000);
  } catch(e){
    if(msgEl){ msgEl.style.color='var(--red)'; msgEl.textContent='❌ อัปโหลดไม่สำเร็จ: '+e.message; }
    showCycleToast('❌ อัปโหลดไม่สำเร็จ');
  }
  if(btnEl){ btnEl.disabled=false; btnEl.textContent='📤 อัปโหลดทั้งหมด'; }
}

async function sbPullAllFull(){
  if(!checkOnlineForAction()) return;
  var creds = getSbCreds();
  if(!creds.ok){ showCycleToast('⚠️ ยังไม่ได้ตั้งค่า Database'); return; }
  var btnEl = document.getElementById('syncPullBtn');
  var msgEl = document.getElementById('syncStatusMsg');
  if(btnEl){ btnEl.disabled=true; btnEl.textContent='⏳ กำลังดาวน์โหลด...'; }
  try {
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc',
      { headers: sbHeadersFrom(creds.key) }, 15000
    );
    if(!r.ok) throw new Error('HTTP '+r.status);
    var rows = await r.json();
    // merge — keep local-only rows too
    var sbMapped3 = rows.map(mapSbRow);
    var sbIdSet3  = {};
    sbMapped3.forEach(function(r){ sbIdSet3[String(r.id)] = true; });
    var localOnly3 = db.filter(function(e){ return !sbIdSet3[String(e.id)]; });
    db = sbMapped3.concat(localOnly3);
    db.sort(function(a,b){ return a.date > b.date ? -1 : a.date < b.date ? 1 : 0; });
    save();
    renderDash(); renderTx();
    if(typeof renderAccountCards==='function') renderAccountCards();
    if(msgEl){ msgEl.style.color='var(--green)'; msgEl.textContent='✅ ดาวน์โหลด '+rows.length+' รายการสำเร็จ (รวมเครื่อง '+db.length+' รายการ)'; }
    if(typeof updateConnectionUI==='function') updateConnectionUI(true);
    showCycleToast('✅ ดาวน์โหลด '+rows.length+' รายการจาก Database');
    setTimeout(refreshSyncStatus, 500);
  } catch(e){
    if(msgEl){ msgEl.style.color='var(--red)'; msgEl.textContent='❌ ดาวน์โหลดไม่สำเร็จ: '+e.message; }
    showCycleToast('❌ ดาวน์โหลดไม่สำเร็จ');
  }
  if(btnEl){ btnEl.disabled=false; btnEl.textContent='📥 ดาวน์โหลดทั้งหมด'; }
}

// keep old export CSV working (point to sbExportMsg)
function exportCSV(){
  var n=names();
  var hdr='วันที่,ประเภท,หมวด,รายการ,จำนวน,ผู้บันทึก,หาร2,สถานะ,หมายเหตุ\n';
  var rows=db.map(function(e){return [e.date,e.type,e.cat_name||'—',e.desc,e.amt,nm(e.user_id||e.person),e.split?'TRUE':'FALSE',e.status,e.note||''].join(',');}).join('\n');
  var blob=new Blob(['﻿'+hdr+rows],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='home_finance_'+new Date().toISOString().split('T')[0]+'.csv';a.click();
  showMsg('sbExportMsg','Export CSV เรียบร้อย!','success');
}
