/* HomeFinance · module: supabase.js · v2.5.0 */

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

async function sbAddVendor(name, sortOrder){
  var creds = getSbCreds();
  if(!creds.ok) return null;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'return=representation'});
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/vendors',
      { method:'POST', headers: headers,
        body: JSON.stringify({name:name, sort_order:sortOrder}) }, 8000
    );
    if(!r.ok) return null;
    var rows = await r.json();
    return rows[0]||null;
  } catch(_){ return null; }
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
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 6000);
    var r = await fetch(
      creds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc',
      { headers: sbHeadersFrom(creds.key), signal: ctrl.signal }
    );
    clearTimeout(t);
    if(!r.ok){ _pullInProgress=false; return; }
    var rows = await r.json();
    if(!rows || !rows.length){ _pullInProgress=false; return; }
    // checksum — ไม่ render ถ้าข้อมูลเหมือนเดิม
    var hash = rows.map(function(e){return String(e.id)+String(e.status)+String(e.amt);}).join('|');
    var old  = db.map(function(e){return String(e.id)+String(e.status)+String(e.amt);}).join('|');
    if(hash !== old){
      db = rows.map(function(e){
        return {
          id:e.id, date:e.date, type:e.type,
          cat_id:e.cat_id, cat_name:e.cat_name||((categories.find(function(c){return c.id===e.cat_id;})||{}).name||''),
          desc:e.desc, amt:Number(e.amt)||0, person:e.person,
          split:e.split===true||e.split==='true'||e.split==='TRUE',
          status:e.status, note:e.note||''
        };
      });
      save();
      renderDash();
      var activePage = (document.querySelector('.page.active')||{}).id;
      if(activePage==='page-transactions') renderTx();
    }
  } catch(_){} // abort หรือ error ใดๆ → fail silently
  _pullInProgress = false;
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
    var r = await fetchWithTimeout(
      creds.url+'/rest/v1/'+SB_TABLE+'?select=id&limit=1',
      { headers: sbHeadersFrom(creds.key) }, 8000
    );
    setOnlineState(r.ok);
  } catch(_){ setOnlineState(false); }
}

function setOnlineState(online){
  var wasOffline = !_isOnline;
  _isOnline = online;
  updateConnectionUI(online);
  if(online && wasOffline){
    hideOfflineBanner();
    syncOnReconnect();
  }
  if(!online) showOfflineBanner();
}

function updateConnectionUI(online){
  var dot = document.getElementById('sbDot');
  var txt = document.getElementById('sbStatusText');
  var rtDot = document.getElementById('rtDot');
  var rtDot2 = document.getElementById('rtDot2');
  var rtTxt = document.getElementById('rtStatusText');
  var color = online ? '#1a7a4a' : '#c0392b';
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

async function syncOnReconnect(){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var results = await Promise.all([
      fetch(creds.url+'/rest/v1/'+SB_TABLE+'?select=*&order=date.desc', {
        headers: sbHeadersFrom(creds.key)
      }).then(function(r){return r.ok?r.json():[];}).catch(function(){return [];}),
      sbLoadCategories()
    ]);
    var rows = results[0], catsData = results[1];
    if(rows.length > 0){
      db = rows.map(function(e){
        return {
          id:e.id, date:e.date, type:e.type,
          cat_id:e.cat_id, cat_name:e.cat_name||((categories.find(function(c){return c.id===e.cat_id;})||{}).name||''),
          desc:e.desc, amt:Number(e.amt)||0, person:e.person,
          split:e.split===true||e.split==='true'||e.split==='TRUE',
          status:e.status, note:e.note||''
        };
      });
      save();
    }
    if(catsData && Array.isArray(catsData)){
      categories = catsData; buildCategoryMap();
    }
    renderDash(); renderTx();
    showConnectToast('เชื่อมต่อแล้ว — อัปเดตข้อมูลล่าสุดเรียบร้อย');
  } catch(_){}
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
    db = rows.map(function(e){
      return {
        id:e.id, date:e.date, type:e.type, cat_id:e.cat_id, cat_name:e.cat_name||((categories.find(function(c){return c.id===e.cat_id;})||{}).name||''),
        desc:e.desc, amt:Number(e.amt)||0, person:e.person,
        split:e.split===true||e.split==='true'||e.split==='TRUE',
        status:e.status, note:e.note||''
      };
    });
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
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var catId = e.cat_id || ((categories.find(function(c){return c.name===e.cat_name;})||{}).id) || null;
    var headers = Object.assign({}, sbHeadersFrom(creds.key), {'Prefer':'resolution=merge-duplicates,return=minimal'});
    await fetch(creds.url+'/rest/v1/'+SB_TABLE, {
      method:'POST',
      headers: headers,
      body:JSON.stringify([{
        id:String(e.id), date:e.date,
        type:e.type,           // enum: income|expense
        cat_id:catId,
        desc:e.desc, amt:e.amt, person:e.person,
        split:e.split,
        status:e.status||doneStatus(e.type),
        note:e.note||'',
        item_id:e.item_id||null,
        vendor_id:e.vendor_id||null,
      }])
    });
  } catch(_){}
}

async function sbUpdate(e){
  var creds = getSbCreds();
  if(!creds.ok) return;
  try {
    var catId = e.cat_id || ((categories.find(function(c){return c.name===e.cat_name;})||{}).id) || null;
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

// keep old export CSV working (point to sbExportMsg)
function exportCSV(){
  var n=names();
  var hdr='วันที่,ประเภท,หมวด,รายการ,จำนวน,ผู้บันทึก,หาร2,สถานะ,หมายเหตุ\n';
  var rows=db.map(function(e){return [e.date,e.type,e.cat_name||'—',e.desc,e.amt,nm(e.person),e.split?'TRUE':'FALSE',e.status,e.note||''].join(',');}).join('\n');
  var blob=new Blob(['﻿'+hdr+rows],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='home_finance_'+new Date().toISOString().split('T')[0]+'.csv';a.click();
  showMsg('sbExportMsg','Export CSV เรียบร้อย!','success');
}
