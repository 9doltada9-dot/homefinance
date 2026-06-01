/* HomeFinance · module: transactions.js · v3.0.0 */

// ─── ADMIN "SHOW ALL USERS" TOGGLE ───────────────────────
var _txShowAllUsers = false;  // false = เฉพาะของตัวเอง, true = ทุก user (admin)
var _txFilterMode = 'calendar'; // 'calendar' | 'salary'

function _updateTxModeUI() {
  var mode = _txFilterMode;
  var fltSC = document.getElementById('fltSalaryCycle');
  var mfM   = document.getElementById('mfMonth');
  var btnC  = document.getElementById('btnTxModeCalendar');
  var btnS  = document.getElementById('btnTxModeSalary');
  if (mfM)   mfM.style.display   = mode === 'calendar' ? '' : 'none';
  if (fltSC) fltSC.style.display = mode === 'salary'   ? '' : 'none';
  if (btnC) { btnC.style.background = mode==='calendar' ? 'var(--blue)' : 'transparent';
              btnC.style.color      = mode==='calendar' ? '#fff'        : 'var(--ink2)'; }
  if (btnS) { btnS.style.background = mode==='salary'   ? 'var(--blue)' : 'transparent';
              btnS.style.color      = mode==='salary'   ? '#fff'        : 'var(--ink2)'; }
}

// ── custom glass dropdown helpers ──────────────────────────
function _syncYearDrop(years, cur) {
  var drop = document.getElementById('fltYearDrop');
  var lbl  = document.getElementById('fltYearLabel');
  if (!drop) return;
  var opts = [{val:'',label:'ทุกปี'}].concat(years.map(function(y){return {val:y,label:String(Number(y)+543)};}));
  drop.innerHTML = '<div style="padding:6px 8px;display:flex;flex-direction:column;gap:2px">'
    + opts.map(function(o){
        var on = o.val===cur||(!o.val&&!cur);
        return '<button onclick="setFltYear(\''+o.val+'\')" style="text-align:left;width:100%;background:'+(on?'var(--accent-soft)':'transparent')+';color:'+(on?'var(--accent)':'var(--ink)')+';border:none;padding:8px 12px;border-radius:10px;font-size:13px;font-weight:'+(on?700:500)+';cursor:pointer;font-family:Sarabun,sans-serif;white-space:nowrap">'+o.label+'</button>';
      }).join('') + '</div>';
  if (lbl) { lbl.innerHTML=(cur?String(Number(cur)+543):'ทุกปี')+' ▾'; lbl.classList.toggle('active',!!cur); }
}
function setFltYear(y) {
  var sel=document.getElementById('fltYear'); if(sel)sel.value=y;
  var mf=document.getElementById('mfYear'); if(mf){var d=mf.querySelector('.mf-dropdown');if(d)d.classList.remove('open');}
  renderTx();
}
function _syncMonthDrop(months, cur) {
  var drop = document.getElementById('fltMonthDrop');
  var lbl  = document.getElementById('fltMonthLabel');
  if (!drop) return;
  var opts = [{val:'',label:'ทุกเดือน'}].concat(months.map(function(m){var p=m.split('-').map(Number);return {val:m,label:SHORT_M[p[1]-1]+' '+(p[0]+543)};}));
  drop.innerHTML = '<div style="padding:6px 8px;display:flex;flex-direction:column;gap:2px">'
    + opts.map(function(o){
        var on = o.val===cur||(!o.val&&!cur);
        return '<button onclick="setFltMonth(\''+o.val+'\')" style="text-align:left;width:100%;background:'+(on?'var(--accent-soft)':'transparent')+';color:'+(on?'var(--accent)':'var(--ink)')+';border:none;padding:8px 12px;border-radius:10px;font-size:13px;font-weight:'+(on?700:500)+';cursor:pointer;font-family:Sarabun,sans-serif;white-space:nowrap">'+o.label+'</button>';
      }).join('') + '</div>';
  if (lbl) {
    var txt = cur?(function(){var p=cur.split('-').map(Number);return SHORT_M[p[1]-1]+' '+(p[0]+543);})():'ทุกเดือน';
    lbl.innerHTML=txt+' ▾'; lbl.classList.toggle('active',!!cur);
  }
}
function setFltMonth(m) {
  var sel=document.getElementById('fltMonth'); if(sel)sel.value=m;
  var mf=document.getElementById('mfMonth'); if(mf){var d=mf.querySelector('.mf-dropdown');if(d)d.classList.remove('open');}
  renderTx();
}

function setTxFilterMode(mode) {
  _txFilterMode = mode;
  _updateTxModeUI();
  renderTx();
}

function txAdminUnlockAll() {
  if (typeof isAdminUser !== 'function' || !isAdminUser()) return;
  _txShowAllUsers = true;
  _txUpdateAdminBar();
  renderTx();
}

function txAdminLockAll() {
  _txShowAllUsers = false;
  _txUpdateAdminBar();
  renderTx();
}

/** อัปเดต UI ของ admin bar ตาม state */
function _txUpdateAdminBar() {
  var isAdmin = typeof isAdminUser === 'function' && isAdminUser();
  var unlockBtn = document.getElementById('txAdminUnlockBtn');
  var lockBtn   = document.getElementById('txAdminLockBtn');
  var banner    = document.getElementById('txAdminBanner');
  var mfUser    = document.getElementById('mfUser');
  if (!isAdmin) {
    if (unlockBtn) unlockBtn.style.display = 'none';
    if (lockBtn)   lockBtn.style.display   = 'none';
    if (banner)    banner.style.display    = 'none';
    if (mfUser)    mfUser.style.display    = 'none';
    return;
  }
  if (_txShowAllUsers) {
    if (unlockBtn) unlockBtn.style.display = 'none';
    if (lockBtn)   lockBtn.style.display   = '';
    if (banner)    banner.style.display    = '';
    if (mfUser)  { mfUser.style.display = ''; populateMFUser(); }
  } else {
    if (unlockBtn) unlockBtn.style.display = '';
    if (lockBtn)   lockBtn.style.display   = 'none';
    if (banner)    banner.style.display    = 'none';
    if (mfUser)    mfUser.style.display    = 'none';
  }
}

/** Populate ผู้บันทึก filter จาก _allProfiles */
function populateMFUser() {
  var el = document.getElementById('mfUserList');
  if (!el) return;
  var cur = getMFValues('mfUser');
  var profiles = window._allProfiles || [];
  el.innerHTML = profiles.length
    ? profiles.map(function(p){
        var safeId = p.id;
        var safeName = (p.name||p.id.slice(0,8)).replace(/</g,'&lt;').replace(/>/g,'&gt;');
        return _dpPill('mfUser', safeId, safeName, cur.indexOf(safeId)>-1, '');
      }).join('')
    : '<span style="font-size:12px;color:var(--ink3)">ไม่มีข้อมูลผู้ใช้</span>';
}

// ─── MULTI FILTER ─────────────────────────────────────────
function toggleMF(id){
  var el = document.getElementById(id);
  if (!el) return;
  var dd = el.querySelector('.mf-dropdown');
  if (!dd) return;
  var wasOpen = dd.classList.contains('open');
  // close all + reset fixed positioning
  document.querySelectorAll('.mf-dropdown.open').forEach(function(d){
    d.classList.remove('open');
    d.style.position=''; d.style.top=''; d.style.left=''; d.style.zIndex='';
  });
  if (!wasOpen) {
    // position:fixed → หลุด stacking context ของ card → backdrop-filter ใช้ glass settings ได้จริง
    var lbl = el.querySelector('.mf-label') || el;
    var rect = lbl.getBoundingClientRect();
    dd.style.position = 'fixed';
    dd.style.top      = (rect.bottom + 4) + 'px';
    dd.style.left     = rect.left + 'px';
    dd.style.zIndex   = '9000';
    dd.classList.add('open');
    // แก้ overflow ขวา (หลัง paint)
    requestAnimationFrame(function(){
      var r = dd.getBoundingClientRect();
      if (r.right > window.innerWidth - 8)
        dd.style.left = Math.max(8, window.innerWidth - r.width - 8) + 'px';
    });
  }
}

var _MF_NAMES = { mfType:'ประเภท', mfStatus:'สถานะ', mfCat:'หมวด', mfVendor:'ร้านค้า', mfItem:'รายการ', mfUser:'ผู้บันทึก' };

function togglePill(mfId, val, btn) {
  var el = document.getElementById(mfId);
  if (!el) return;
  var chk = el.querySelector('input[value="'+val+'"]');
  if (chk) chk.checked = !chk.checked;
  var active = chk ? chk.checked : (btn.getAttribute('data-active') !== '1');
  btn.setAttribute('data-active', active ? '1' : '0');
  updateMFLabel(mfId, _MF_NAMES[mfId] || mfId);
  renderTx();
}

function getMFValues(id){
  return [].slice.call(document.querySelectorAll('#'+id+' input[type=checkbox]:checked')).map(function(c){return c.value;});
}

var MF_LABELS = {
  income:'รายรับ', expense:'รายจ่าย', transfer:'โอน/ฝาก',
  paid:'จ่ายแล้ว', received:'รับแล้ว', pending:'รอดำเนินการ'
};

function updateMFLabel(id, def){
  var vals = getMFValues(id);
  var label = document.querySelector('#'+id+' .mf-label');
  if(!label) return;
  if(vals.length===0){
    label.innerHTML = def+' ▾';
    label.classList.remove('active');
  } else {
    label.innerHTML = def
      +' <span style="display:inline-flex;align-items:center;justify-content:center;'
      +'min-width:18px;height:18px;padding:0 5px;border-radius:20px;'
      +'background:var(--blue);color:#fff;font-size:10px;font-weight:700;'
      +'line-height:1;vertical-align:middle;margin:0 1px">'
      +vals.length+'</span> ▾';
    label.classList.add('active');
  }
}

function _dpPill(mfId, val, label, active, extra) {
  var chg = 'updateMFLabel(\''+mfId+'\',\''+mfId+'\');renderTx()'+(extra?';'+extra:'');
  return '<input type="checkbox" value="'+val+'" style="display:none" '+(active?'checked':'')+' onchange="'+chg+'">'
    +'<button class="tx-pill" data-val="'+val+'" data-active="'+(active?'1':'0')+'" '
    +'onclick="togglePill(\''+mfId+'\',\''+val+'\',this)">'+label+'</button>';
}

function populateMFItem(){
  var el = document.getElementById('mfItemList');
  if(!el) return;
  var cur = getMFValues('mfItem');
  var fcats = getMFValues('mfCat');
  var items = [];
  if(fcats.length){
    fcats.forEach(function(catId){ items.push.apply(items, (itemsData[catId]||[]).map(function(x){return x.name;})); });
  } else {
    Object.values(itemsData).forEach(function(arr){ items.push.apply(items, arr.map(function(x){return x.name;})); });
  }
  items = Array.from(new Set(items)).sort();
  el.innerHTML = items.length
    ? items.map(function(name){ return _dpPill('mfItem', name, name, cur.indexOf(name)>-1, ''); }).join('')
    : '<span style="font-size:12px;color:var(--ink3)">ไม่มีรายการ</span>';
}

function populateMFVendor(){
  var el = document.getElementById('mfVendorList');
  if(!el) return;
  var cur = getMFValues('mfVendor');
  el.innerHTML = vendorsData.length
    ? vendorsData.map(function(v){ return _dpPill('mfVendor', v.id, v.name, cur.indexOf(v.id)>-1, ''); }).join('')
    : '<span style="font-size:12px;color:var(--ink3)">ยังไม่มีร้านค้า</span>';
}

function populateMFCat(){
  var el = document.getElementById('mfCatList');
  if(!el) return;
  var cur = getMFValues('mfCat');
  el.innerHTML = categories.map(function(c){
    return _dpPill('mfCat', c.id, c.name, cur.indexOf(c.id)>-1, 'populateMFItem()');
  }).join('');
}


function resetFilters(){
  _txFilterMode = 'calendar';
  var fltMr = document.getElementById('fltMonth');
  if (fltMr) { fltMr.value = ''; fltMr._initialized = false; }
  var fltSCr = document.getElementById('fltSalaryCycle');
  if (fltSCr) { fltSCr.value = ''; fltSCr._initialized = false; }
  var fltYr = document.getElementById('fltYear');
  if (fltYr) { fltYr.value = ''; fltYr._initialized = false; }
  _updateTxModeUI();
  document.querySelectorAll('.mf-dropdown input[type=checkbox]').forEach(function(cb){cb.checked=false;});
  document.querySelectorAll('.tx-pill').forEach(function(p){ p.setAttribute('data-active','0'); });
  [['mfType','ประเภท'],['mfCat','หมวด'],['mfItem','รายการ'],['mfVendor','ร้านค้า'],['mfStatus','สถานะ'],['mfUser','ผู้บันทึก']].forEach(function(pair){
    var label=document.querySelector('#'+pair[0]+' .mf-label');
    if(label){ label.innerHTML=pair[1]+' ▾'; label.classList.remove('active'); }
  });
  renderTx();
}

/**
 * คืนรายการ transactions ที่ถูก filter อยู่ตาม UI ปัจจุบัน
 * (ใช้ตอน export CSV ของรายการที่กรอง)
 */
function getFilteredTx(){
  var fltM  = document.getElementById('fltMonth');
  var fltSC = document.getElementById('fltSalaryCycle');
  var list  = db.slice();
  // ซ่อน transfer IN — แสดงเฉพาะ OUT
  list = list.filter(function(e){ return e.transfer_direction !== 'in'; });
  // กรอง: เฉพาะของ user ปัจจุบัน (Admin ปลดล็อกด้วยรหัสผ่านเพื่อดูทั้งหมด)
  var _myUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  if (!_txShowAllUsers && _myUid) {
    list = list.filter(function(e){ return (e.user_id || e.person) === _myUid; });
  }
  // year filter
  var fltY2 = document.getElementById('fltYear');
  if(fltY2 && fltY2.value) list = list.filter(function(e){ return e.date.startsWith(fltY2.value); });

  // date filter — calendar: by month prefix, salary: by date range
  if (_txFilterMode === 'calendar') {
    if(fltM && fltM.value) list = list.filter(function(e){ return e.date.startsWith(fltM.value); });
  } else {
    if(fltSC && fltSC.value){
      var _gp = fltSC.value.split('|');
      list = list.filter(function(e){ return e.date >= _gp[0] && e.date <= _gp[1]; });
    }
  }
  var ftypes   = getMFValues('mfType');
  if(ftypes.length)   list = list.filter(function(e){ return ftypes.indexOf(e.type)>-1; });
  var fcats    = getMFValues('mfCat');
  if(fcats.length)    list = list.filter(function(e){ return fcats.indexOf(e.cat_id)>-1; });
  var fitems   = getMFValues('mfItem');
  if(fitems.length)   list = list.filter(function(e){ return fitems.indexOf(e.desc)>-1; });
  var fstats   = getMFValues('mfStatus');
  if(fstats.length)   list = list.filter(function(e){ return fstats.indexOf(e.status)>-1; });
  var fvendors = getMFValues('mfVendor');
  if(fvendors.length) list = list.filter(function(e){ return fvendors.indexOf(e.vendor_id)>-1; });
  var fusers = getMFValues('mfUser');
  if(fusers.length && _txShowAllUsers) {
    list = list.filter(function(e){ return fusers.indexOf(e.user_id || e.person) > -1; });
  }
  return list;
}

/** Populate year <select> from years present in db */
function populateFltYear(sel) {
  if (!sel) sel = document.getElementById('fltYear');
  if (!sel) return;
  var thisY = String(new Date().getFullYear());
  // default to current year on first load
  if (!sel._initialized) { sel._initialized = true; sel.value = thisY; }
  var cur = sel.value || thisY;
  var years = Array.from(new Set(db.map(function(e){ return e.date.slice(0,4); }))).sort().reverse();
  sel.innerHTML = '<option value="">ทุกปี</option>' +
    years.map(function(y){
      return '<option value="'+y+'"'+(y===cur?' selected':'')+'>'+(Number(y)+543)+'</option>';
    }).join('');
  sel.value = cur;
  _syncYearDrop(years, cur);
}

/** Populate salary-cycle <select> — last 14 cycles going backward */
function populateFltSalaryCycle(sel) {
  if (!sel) sel = document.getElementById('fltSalaryCycle');
  if (!sel) return;
  var cur = sel.value;
  var cycles = [], seen = {};
  var d = new Date();
  for (var i = 0; i < 14; i++) {
    var c = getSalaryCycle(d);
    var val = c.start + '|' + c.end;
    if (!seen[val]) {
      seen[val] = true;
      cycles.push({ val: val, label: c.label });
    }
    d = new Date(d.getFullYear(), d.getMonth() - 1, 10);
  }
  sel.innerHTML = '<option value="">— รอบเงินเดือน —</option>' +
    cycles.map(function(c){
      return '<option value="'+c.val+'"'+(c.val===cur?' selected':'')+'>'+c.label+'</option>';
    }).join('');
  if (cur) sel.value = cur;
}


/** badge แสดงสถานะการหารต่อรายการ */
function _splitBadge(e) {
  if (e.type !== 'expense') return '-';
  if (e.split_group_id) {
    var groups = (typeof getSplitGroups === 'function') ? getSplitGroups() : [];
    var grp = groups.find(function(g){ return g.id === e.split_group_id; });
    var typeIcon = { equal:'👥', ratio:'📊', custom:'🎯', personal:'💼' };
    var icon = grp ? (typeIcon[grp.split_type] || '🏠') : '🏠';
    var name = grp ? grp.name : '(กลุ่ม)';
    // สร้างรายชื่อสมาชิกสำหรับ tooltip
    var lines = [];
    if (e.split_snapshot && typeof e.split_snapshot === 'object') {
      Object.keys(e.split_snapshot).forEach(function(uid) {
        var s = e.split_snapshot[uid];
        var mName = s.label || (typeof nm === 'function' ? nm(uid) : uid);
        var fmtAmt = (typeof fmt === 'function') ? fmt(s.amount || 0) : (+(s.amount || 0)).toFixed(2);
        lines.push(mName + ' — ' + fmtAmt + ' บาท' + (s.pct ? ' (' + s.pct + '%)' : ''));
      });
    } else if (grp && grp.members) {
      (grp.members || []).filter(function(m){ return m.active; }).forEach(function(m){
        lines.push(m.label || (typeof nm === 'function' ? nm(m.user_id) : m.user_id));
      });
    }
    var _tipObj  = { title: name, lines: lines };
    var _tipJson = JSON.stringify(_tipObj).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
    return '<span class="badge badge-split" style="font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default"'
      +' data-split-tip="'+_tipJson+'"'
      +' onmouseenter="_showSplitTipAttr(this)"'
      +' onmouseleave="_hideSplitTip()"'
      +' onclick="event.stopPropagation();_toggleSplitTipAttr(this)"'
      +'>'+icon+' '+name+'</span>';
  }
  if (e.split) {
    return '<span class="badge badge-split">÷ หาร</span>';
  }
  return '<span class="badge badge-personal">💼 ส่วนตัว</span>';
}

/** Tooltip helpers สำหรับ split badge */
var _splitTipVisible = false;
function _showSplitTipAttr(el) {
  try {
    var raw = el.getAttribute('data-split-tip');
    if (!raw) return;
    var jsonStr = raw.replace(/&quot;/g,'"').replace(/&amp;/g,'&');
    var data = JSON.parse(jsonStr);
    var tip = document.getElementById('splitMemberTip');
    if (!tip) return;
    tip.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px;font-size:12px">'+_escTip(data.title)+'</div>'+
      (data.lines && data.lines.length
        ? data.lines.map(function(l){ return '<div style="font-size:12px;padding:2px 0">👤 '+_escTip(l)+'</div>'; }).join('')
        : '<div style="font-size:11px;color:rgba(255,255,255,.6)">ไม่มีข้อมูลสมาชิก</div>');
    var rect = el.getBoundingClientRect();
    tip.style.display = 'block';
    var tipW = tip.offsetWidth || 200;
    var left = Math.min(rect.left + window.scrollX, window.innerWidth - tipW - 8);
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
    _splitTipVisible = true;
  } catch(err){ console.warn('splitTip err', err); }
}
function _hideSplitTip() {
  var tip = document.getElementById('splitMemberTip');
  if (tip) tip.style.display = 'none';
  _splitTipVisible = false;
}
function _toggleSplitTipAttr(el) {
  if (_splitTipVisible) { _hideSplitTip(); } else { _showSplitTipAttr(el); }
}
function _escTip(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** ชื่อผู้บันทึก — รองรับทั้ง UUID (user system) และ A/B (legacy) */
function _personName(pid) {
  if (!pid) return '—';
  return (typeof nm === 'function') ? nm(pid) : pid;
}

function renderTx(){
  var now = new Date();
  var thisM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var months=Array.from(new Set(db.map(function(e){return e.date.substring(0,7);}))).sort().reverse();
  if(months.indexOf(thisM)===-1) months.unshift(thisM);
  var fltM=document.getElementById('fltMonth');
  var fltSC=document.getElementById('fltSalaryCycle');
  // calendar: default to current month on first load
  if(!fltM._initialized){ fltM._initialized=true; fltM.value=thisM; }
  var curM=fltM.value;
  fltM.innerHTML='<option value="">ทุกเดือน</option>'+months.map(function(m){
    var parts=m.split('-').map(Number);
    var y=parts[0], mo=parts[1];
    return '<option value="'+m+'" '+(m===curM?'selected':'')+'>'+SHORT_M[mo-1]+' '+(y+543)+'</option>';
  }).join('');
  if(curM) fltM.value=curM;
  _syncMonthDrop(months, curM);

  // salary cycle: populate + default to current cycle on first load
  populateFltSalaryCycle(fltSC);
  if(fltSC && !fltSC._initialized && _txFilterMode==='salary'){
    fltSC._initialized=true;
    var _cc=getSalaryCycle(); fltSC.value=_cc.start+'|'+_cc.end;
  }

  // sync toggle UI
  _updateTxModeUI();

  // always rebuild multi filters
  var fltY=document.getElementById('fltYear');
  populateFltYear(fltY);
  populateMFCat();
  populateMFVendor();

  var list = db.slice();
  // ซ่อน transfer IN entry — แสดงเฉพาะ OUT (ตัวเดียวต่อการโอน)
  list = list.filter(function(e){ return e.transfer_direction !== 'in'; });
  // กรอง: เฉพาะของ user ปัจจุบัน (Admin ปลดล็อกด้วยรหัสผ่านเพื่อดูทั้งหมด)
  var _myUid2 = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  if (!_txShowAllUsers && _myUid2) {
    list = list.filter(function(e){ return (e.user_id || e.person) === _myUid2; });
  }
  // year filter (applies in all modes)
  if(fltY && fltY.value) list=list.filter(function(e){return e.date.startsWith(fltY.value);});

  // date filter — calendar: month prefix, salary: date range
  if(_txFilterMode==='calendar'){
    if(fltM.value) list=list.filter(function(e){return e.date.startsWith(fltM.value);});
  } else {
    if(fltSC && fltSC.value){
      var _scp=fltSC.value.split('|');
      list=list.filter(function(e){return e.date>=_scp[0]&&e.date<=_scp[1];});
    }
  }

  var ftypes = getMFValues('mfType');
  if(ftypes.length) list=list.filter(function(e){return ftypes.indexOf(e.type)>-1;});

  var fcats = getMFValues('mfCat');
  if(fcats.length) list=list.filter(function(e){return fcats.indexOf(e.cat_id)>-1;});

  // rebuild item filter based on selected categories
  populateMFItem();

  var fitems = getMFValues('mfItem');
  if(fitems.length) list=list.filter(function(e){return fitems.indexOf(e.desc)>-1;});

  var fstats = getMFValues('mfStatus');
  if(fstats.length) list=list.filter(function(e){return fstats.indexOf(e.status)>-1;});


  var fvendors = getMFValues('mfVendor');
  if(fvendors.length) list=list.filter(function(e){return fvendors.indexOf(e.vendor_id)>-1;});

  // filter ผู้บันทึก (เฉพาะ admin mode)
  var fusers2 = getMFValues('mfUser');
  if(fusers2.length && _txShowAllUsers) {
    list = list.filter(function(e){ return fusers2.indexOf(e.user_id || e.person) > -1; });
  }

  // เรียง: pending ลงล่างสุด → วันที่ล่าสุดก่อน → ภายในวันเดียวกัน เรียงตาม id ล่าสุดก่อน
  list.sort(function(a, b){
    var aPend = a.status==='pending' ? 1 : 0;
    var bPend = b.status==='pending' ? 1 : 0;
    if(aPend !== bPend) return aPend - bPend;
    if(a.date > b.date) return -1;
    if(a.date < b.date) return 1;
    return Number(b.id) - Number(a.id);
  });

  // Total bar
  var totalEl = document.getElementById('txTotal');
  if(totalEl && list.length){
    var inc  = list.filter(function(e){return e.type==='income' &&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
    var exp  = list.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
    var pendIn  = list.filter(function(e){return e.status==='pending'&&e.type==='income';}).reduce(function(s,e){return s+e.amt;},0);
    var pendOut = list.filter(function(e){return e.status==='pending'&&e.type==='expense';}).reduce(function(s,e){return s+e.amt;},0);
    var pend = pendIn - pendOut; // net: รอรับ − รอจ่าย
    totalEl.classList.add('shown');
    var incCnt=list.filter(function(e){return e.type==='income'&&isPaid(e);}).length;
    var expCnt=list.filter(function(e){return e.type==='expense'&&isPaid(e);}).length;
    var pendCnt=list.filter(function(e){return e.status==='pending';}).length;
    totalEl.innerHTML=
      '<div style="flex:1;min-width:110px"><div class="hf-metric-label">รายรับ ('+incCnt+')</div><div class="hf-metric-val g">'+fmtH(inc)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div class="hf-metric-label">รายจ่าย ('+expCnt+')</div><div class="hf-metric-val r">'+fmtH(exp)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div class="hf-metric-label">รอดำเนินการ ('+pendCnt+')</div><div class="hf-metric-val a">'+fmtH(pend)+'</div></div>'+
      '<div style="flex:1;min-width:110px;margin-left:auto;text-align:right"><div class="hf-metric-label">สุทธิ ('+list.length+' รายการ)</div><div class="hf-metric-val '+(inc-exp>=0?'g':'r')+'">'+fmtH(inc-exp)+'</div></div>';
  } else if(totalEl){ totalEl.classList.remove('shown'); }

  var isMobile = window.innerWidth <= 900;

  // ─── VENDOR AVATAR: วงกลมตัวอักษรแรก ─────────────────────
  var _vendorAvatar = function(name) {
    if (!name || name === '—') return '';
    var code = 0; for(var _ci=0;_ci<name.length;_ci++) code = (code*31 + name.charCodeAt(_ci)) & 0xffff;
    var palette = ['#dbeafe','#dcfce7','#fef3c7','#ede9fe','#fce7f3','#e0f2fe','#fee2e2','#fef9c3'];
    var textPal = ['#1e40af','#166534','#92400e','#5b21b6','#9d174d','#0c4a6e','#991b1b','#713f12'];
    var bg = palette[code % palette.length];
    var fg = textPal[code % textPal.length];
    return '<span style="display:inline-flex;align-items:center;padding:2px 7px;border-radius:20px;background:'+bg+';color:'+fg+';'
         + 'font-size:11px;font-weight:600;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis;'
         + 'font-family:Sarabun,sans-serif">'+name+'</span>';
  };

  var revertBtn = function(e){ return '<button class="btn-revert" title="คืนสถานะ" onclick="if(confirm(\'คืนรายการนี้เป็น รอดำเนินการ?\'))markPending(\''+e.id+'\')">'+
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 4v4.31l2.97 1.71-.75 1.3L5.75 9.1V4h1.5z"/></svg>'+
  '</button>'; };

  // จุดสีธนาคาร: คืน <span> สีตาม account หรือ '' ถ้าไม่ระบุ
  var _acctDot = function(e){
    if (!e.account_id) return '';
    var acct = (typeof accountsData !== 'undefined' ? accountsData : []).find(function(a){ return a.id === e.account_id; });
    if (!acct) return '';
    var col  = acct.color || '#1a4fa0';
    var name = (acct.name || '').replace(/"/g,'&quot;');
    return '<span title="'+name+'" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+col+';flex-shrink:0"></span>';
  };

  if(isMobile){
    document.getElementById('txContent').innerHTML = list.length
      ? (function(){
          var _groups=[], _dmap={};
          list.forEach(function(e){
            var d=e.date;
            if(!_dmap[d]){_dmap[d]=[];_groups.push({date:d,items:_dmap[d]});}
            _dmap[d].push(e);
          });
          return _groups.map(function(g){
            return '<div id="txdate-'+g.date+'" style="background:var(--surface2);padding:5px 12px;font-size:11px;font-weight:600;color:var(--ink2);border-bottom:1px solid var(--line);border-top:1px solid var(--line)">'+toThaiDateStr(g.date)+'</div>'+
              g.items.map(function(e){
                var _mIid=(typeof getDescriptionIconId==='function')?getDescriptionIconId(e.desc):null;
                var _mIhtml=_mIid
                  ?'<svg width="22" height="22" viewBox="0 0 24 24" style="display:block"><use href="#'+_mIid+'"></use></svg>'
                  :'<span style="font-size:20px;line-height:1">'+(e.type==='income'?'💰':e.type==='transfer'?'↗️':'💳')+'</span>';
                var _mCircle='<div style="width:46px;height:46px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">'+_mIhtml+'</div>';
                return '<div class="tx-card-row" onclick="txDetailModal(\''+e.id+'\')'+'" id="srow-'+e.id+'" style="cursor:pointer;border-bottom:1px solid var(--line)">'+
            '<div style="padding:12px 12px 10px">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
                _mCircle+
                '<div style="flex:1;min-width:0">'+
                  '<div style="font-size:14px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</div>'+
                  '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">'+

                    '<span style="font-size:11px;color:var(--ink3)">'+(e.cat_name||'—')+'</span>'+
                    (e.vendor_id ? (function(){ var _vn=(((vendorsData.find(function(v){return v.id===e.vendor_id;}))||{}).name||''); return _vn ? _vendorAvatar(_vn) : ''; })() : '')+
                    (_txShowAllUsers && (e.user_id||e.person) ? personPill(e.user_id||e.person) : '')+
                  '</div>'+
                  (e.type==='expense' ? '<div style="margin-top:4px">'+_splitBadge(e)+'</div>' : '')+
                  (e.note ? '<div style="font-size:11px;color:var(--ink3);margin-top:3px;font-style:italic">📝 '+e.note+'</div>' : '')+
                '</div>'+
                '<div style="text-align:right;flex-shrink:0">'+
                  (isSalary(e) ?
                  '<div style="font-size:15px;font-weight:600;font-family:monospace;color:#4ade80;display:flex;align-items:center;gap:4px;justify-content:flex-end">'+
                    '<span id="sal-'+e.id+'" style="filter:blur(5px);user-select:none;transition:filter .15s">'+fmtH(e.amt)+'</span>'+
                    '<button '+
                      'onpointerdown="revealSal(\''+e.id+'\')" '+
                      'onpointerup="hideSal(\''+e.id+'\')" '+
                      'onpointerleave="hideSal(\''+e.id+'\')" '+
                      'style="background:none;border:none;padding:2px;color:var(--ink3);cursor:pointer;touch-action:none">'+
                      '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4C5 4 1.5 10 1.5 10S5 16 10 16s8.5-6 8.5-6S15 4 10 4zm0 9a3 3 0 110-6 3 3 0 010 6z"/></svg>'+
                    '</button>'+
                  '</div>' :
                  e.type==='transfer' ?
                  '<div style="font-size:15px;font-weight:600;font-family:monospace;color:var(--blue)">↗ '+fmtH(e.amt)+'</div>' :
                  '<span style="font-size:16px;font-weight:700;font-family:monospace;color:'+(e.type==='income'?'#4ade80':'#f87171')+'">'+
                    fmtH(e.amt)+
                  '</span>')+
                  '<div style="margin-top:3px;display:flex;align-items:center;gap:5px;justify-content:flex-end">'+
                    _acctDot(e)+
                    (e.type==='transfer'
                      ? '<span class="badge badge-paid" style="font-size:10px;background:var(--blue-bg);color:var(--blue)">โอนแล้ว</span>'
                      : '<span class="badge '+(isPaid(e)?(e.type==='income'?'badge-received':'badge-paid'):'badge-pending')+'" style="font-size:10px">'+(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย'))+'</span>'
                    )+
                  '</div>'+
                '</div>'+
              '</div>'+
            '</div>'+
        '</div>';}).join('');
          }).join('');
        })()
      : '<div class="empty">ไม่พบรายการ</div>';

    // Mobile tap-to-detail (swipe removed v3.16.24)

  } else {
    // ── group by date ──
    var _groups=[], _dmap={};
    list.forEach(function(e){
      var d=e.date;
      if(!_dmap[d]){_dmap[d]=[];_groups.push({date:d,items:_dmap[d]});}
      _dmap[d].push(e);
    });

    document.getElementById('txContent').innerHTML = list.length ? _groups.map(function(g){
      // ── day total ──
      var dayIn=0, dayOut=0;
      g.items.forEach(function(e){ if(e.type==='income') dayIn+=e.amt; else if(e.type==='expense') dayOut+=e.amt; });

      return '<div class="hf-card" id="txdate-'+g.date+'" style="margin-bottom:14px;padding:12px 20px 8px">'
        // date header
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--hf-line);margin-bottom:8px">'
        +  '<div style="font-size:13px;font-weight:700;color:var(--hf-accent)">'+toThaiDateStr(g.date)+' <span style="color:var(--hf-ink3);font-weight:500">· '+g.items.length+' รายการ</span></div>'
        +  '<span style="font-size:12px;font-family:monospace">'
        +    (dayIn?'<span style="color:#4ade80;font-weight:600">'+fmtH(dayIn)+'</span>':'')+
             (dayIn&&dayOut?' <span style="color:var(--hf-ink3)">·</span> ':'')+
             (dayOut?'<span style="color:#f87171;font-weight:600">'+fmtH(dayOut)+'</span>':'')
        +  '</span>'
        +'</div>'
        // cards
        + g.items.map(function(e){
            var amtColor  = e.type==='transfer'?'var(--blue)':e.type==='income'?'#4ade80':'#f87171';
            var amtPrefix = e.type==='transfer'?'↗ ':'';
            var acct = (typeof accountsData!=='undefined'?accountsData:[]).find(function(x){return x.id===e.account_id;});
            var iconId = (typeof getDescriptionIconId==='function')?getDescriptionIconId(e.desc):null;
            var iconHtml = iconId
              ? '<svg width="28" height="28" viewBox="0 0 24 24" style="display:block"><use href="#'+iconId+'"></use></svg>'
              : '<span style="font-size:24px;line-height:1">'+(e.type==='income'?'💰':e.type==='transfer'?'↗️':'💳')+'</span>';
            var vendorName = e.vendor_id ? (((vendorsData||[]).find(function(v){return v.id===e.vendor_id;})||{}).name||'') : '';
            var statusBadge = e.type==='transfer'
              ? '<span class="badge" style="background:var(--blue-bg);color:var(--blue)">โอน</span>'
              : '<span class="badge '+(isPaid(e)?(e.type==='income'?'badge-received':'badge-paid'):'badge-pending')+'">'+(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย'))+'</span>';

            return '<div class="tx-card-row" id="row-'+e.id+'" onclick="(typeof gfCardTap===\'function\'?gfCardTap(this,function(){txDetailModal(\''+e.id+'\')}):txDetailModal(\''+e.id+'\'))" '
              // glass card — เหมือน Settlement
              +'style="display:flex;align-items:flex-start;gap:12px;padding:10px 14px;margin-bottom:6px;cursor:pointer;'
              +'background:var(--surface);border-radius:14px;border:1px solid var(--line);'
              +'backdrop-filter:blur(var(--g-blur)) saturate(var(--g-sat));'
              +'-webkit-backdrop-filter:blur(var(--g-blur)) saturate(var(--g-sat));'
              +'box-shadow:var(--g-shadow);transition:box-shadow .15s">'

              // icon circle
              +'<div style="width:52px;height:52px;border-radius:50%;background:var(--surface2);'
              +'display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">'+iconHtml+'</div>'

              // center: desc + meta
              +'<div style="flex:1;min-width:0">'
              +  '<div style="font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</div>'
              +  '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;align-items:center">'
              +    (e.cat_name?'<span style="font-size:11px;color:var(--ink3)">'+e.cat_name+'</span>':'')
              +    (e.cat_name&&(vendorName||_splitBadge(e))?' <span style="color:var(--line2)">·</span> ':'')
              +    (vendorName?_vendorAvatar(vendorName):'')
              +    (vendorName&&_splitBadge(e)?' ':'')
              +    _splitBadge(e)
              +    (_txShowAllUsers?' '+personPill(e.user_id||e.person):'')
              +  '</div>'
              +  (e.note?'<div style="font-size:11px;color:var(--ink3);margin-top:3px">'+e.note+'</div>':'')
              +'</div>'

              // right: amount + status + account
              +'<div style="text-align:right;flex-shrink:0">'
              +  '<div style="font-size:16px;font-weight:700;font-family:monospace;color:'+amtColor+'">'+amtPrefix+fmtH(e.amt)+'</div>'
              +  '<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:4px">'
              +    statusBadge
              +    (acct?'<span title="'+(acct.name||'')+'" style="width:8px;height:8px;border-radius:50%;background:'+(acct.color||'#1a4fa0')+';display:inline-block"></span>':'')
              +  '</div>'
              +'</div>'

            +'</div>';
          }).join('')
      +'</div>';
    }).join('') : '<div class="empty">ไม่พบรายการ</div>';
  }
}


// ─── TRANSACTION DETAIL MODAL ────────────────────────────────────
function txDetailModal(id) {
  var sid = String(id);
  var e   = db.find(function(x){ return String(x.id) === sid; });
  if (!e) return;

  var wrap = document.getElementById('txDetailModalWrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'txDetailModalWrap'; document.body.appendChild(wrap); }

  var vendorName = '';
  if (e.vendor_id) { var vobj = (vendorsData||[]).find(function(v){ return v.id===e.vendor_id; }); if(vobj) vendorName = vobj.name||''; }
  var acctName = '', acctColor = '';
  if (e.account_id) { var aobj = (typeof accountsData!=='undefined'?accountsData:[]).find(function(a){ return a.id===e.account_id; }); if(aobj){acctName=aobj.name||'';acctColor=aobj.color||'#1a4fa0';} }
  var typeLabel = e.type==='income'?'รายรับ':e.type==='expense'?'รายจ่าย':'โอน/ฝาก';
  var typeColor = e.type==='income'?'var(--green)':e.type==='expense'?'var(--red)':'var(--blue)';
  var amtSign   = e.type==='income'?'+':e.type==='transfer'?'↗':'−';
  var statusLabel = e.type==='transfer'?'โอนแล้ว':(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย'));
  var statusBg    = e.type==='transfer'?'var(--blue-bg)':(isPaid(e)?'var(--green-bg,#dcfce7)':'var(--amber-bg,#fef3c7)');
  var statusFg    = e.type==='transfer'?'var(--blue)':(isPaid(e)?'var(--green)':'var(--amber,#d97706)');

  // split info
  var splitHtml = '';
  if (e.type==='expense') {
    if (e.split_group_id) {
      var grps = (typeof getSplitGroups==='function') ? getSplitGroups() : [];
      var grp  = grps.find(function(g){ return g.id===e.split_group_id; });
      var gName = grp ? grp.name : '(กลุ่ม)';
      var mLines = [];
      if (e.split_snapshot && typeof e.split_snapshot==='object') {
        Object.keys(e.split_snapshot).forEach(function(uid){ var s=e.split_snapshot[uid]; var mN=s.label||(typeof nm==='function'?nm(uid):uid); var mA=(typeof fmt==='function')?fmt(s.amount||0):(+(s.amount||0)).toFixed(2); mLines.push(mN+' — '+mA+' บาท'+(s.pct?' ('+s.pct+'%)':'')); });
      } else if (grp&&grp.members) { (grp.members||[]).filter(function(m){return m.active;}).forEach(function(m){mLines.push(m.label||(typeof nm==='function'?nm(m.user_id):m.user_id));}); }
      splitHtml = '<div style="background:var(--surface2);border-radius:10px;padding:12px 14px;margin-bottom:0">'
        +'<div style="font-size:11px;color:var(--ink3);margin-bottom:6px;font-weight:600">👥 รูปแบบหาร · '+gName+'</div>'
        +mLines.map(function(l){ return '<div style="font-size:12px;color:var(--ink2);padding:2px 0">• '+l+'</div>'; }).join('')+'</div>';
    } else if (e.split) {
      splitHtml = '<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--ink2)">÷ หาร (ส่วนตัว)</div>';
    }
  }

  var bmStr = '';
  if (e.billing_month) { var bmp=e.billing_month.split('-').map(Number); bmStr=SHORT_M[bmp[1]-1]+' '+(bmp[0]+543); }

  // vendor name chip (detail modal)
  var bigAvatar = '';
  if (vendorName) {
    var c2=0; for(var _ci2=0;_ci2<vendorName.length;_ci2++) c2=(c2*31+vendorName.charCodeAt(_ci2))&0xffff;
    var p2=['#dbeafe','#dcfce7','#fef3c7','#ede9fe','#fce7f3','#e0f2fe','#fee2e2','#fef9c3'];
    var t2=['#1e40af','#166534','#92400e','#5b21b6','#9d174d','#0c4a6e','#991b1b','#713f12'];
    bigAvatar='<span style="display:inline-flex;align-items:center;padding:4px 14px;border-radius:20px;background:'+p2[c2%p2.length]+';color:'+t2[c2%t2.length]+';font-size:14px;font-weight:600;font-family:Sarabun,sans-serif">'+vendorName+'</span>';
  }

  function row(icon, label, val, valStyle) {
    if (!val) return '';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:var(--surface2);border-radius:10px">'
      +'<span style="font-size:12px;color:var(--ink3)">'+icon+' '+label+'</span>'
      +'<span style="font-size:13px;font-weight:500;color:var(--ink);'+(valStyle||'')+'">'+val+'</span>'
    +'</div>';
  }

  wrap.innerHTML =
    '<div id="txDetailOverlay" onclick="closeTxDetailModal()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:3000;display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:520px;overflow:hidden;padding-bottom:env(safe-area-inset-bottom,0)">'

      // drag handle + header
      +'<div style="display:flex;justify-content:center;padding:10px 0 0"><div style="width:36px;height:4px;border-radius:2px;background:var(--line)"></div></div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px 4px">'
        +'<span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:'+typeColor+';color:#fff;letter-spacing:.3px">'+typeLabel+'</span>'
        +'<button onclick="closeTxDetailModal()" style="background:none;border:none;padding:4px 8px;font-size:20px;color:var(--ink3);cursor:pointer;line-height:1">×</button>'
      +'</div>'

      // amount hero
      +'<div style="text-align:center;padding:8px 16px 16px">'
        +'<div style="font-size:38px;font-weight:800;font-family:monospace;color:'+typeColor+';letter-spacing:-1px">'+amtSign+' '+fmtH(e.amt)+'</div>'
        +'<div style="font-size:15px;font-weight:600;color:var(--ink);margin-top:4px">'+e.desc+'</div>'
        +(vendorName?'<div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-top:8px">'+bigAvatar+'<span style="font-size:13px;color:var(--ink2)">'+vendorName+'</span></div>':'')
      +'</div>'

      // detail rows
      +'<div style="padding:0 16px 16px;display:grid;gap:6px">'
        +row('📅','วันที่', toThaiDateStr(e.date))
        +row('📂','หมวด', e.cat_name||'—')
        +(acctName?'<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:var(--surface2);border-radius:10px"><span style="font-size:12px;color:var(--ink3)">💳 บัญชี</span><span style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--ink)"><span style="width:10px;height:10px;border-radius:50%;background:'+acctColor+';display:inline-block"></span>'+acctName+'</span></div>':'')
        +(bmStr?row('📆','เดือนบิล', bmStr):'')
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 14px;background:var(--surface2);border-radius:10px"><span style="font-size:12px;color:var(--ink3)">✅ สถานะ</span><span style="font-size:13px;font-weight:700;padding:2px 10px;border-radius:20px;background:'+statusBg+';color:'+statusFg+'">'+statusLabel+'</span></div>'
        +splitHtml
        +(e.note?'<div style="padding:9px 14px;background:var(--surface2);border-radius:10px"><div style="font-size:12px;color:var(--ink3);margin-bottom:4px">📝 หมายเหตุ</div><div style="font-size:13px;color:var(--ink);font-style:italic">'+e.note+'</div></div>':'')
      +'</div>'

      // action buttons
      +'<div style="padding:0 16px 20px;display:flex;gap:10px">'
        +'<button onclick="closeTxDetailModal();delConfirm(\''+e.id+'\')" style="flex:1;padding:13px;border-radius:12px;background:#fee2e2;color:#dc2626;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif"><svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="M6 2l1-1h6l1 1h4v2H2V2h4zm1 4h2v9H7V6zm4 0h2v9h-2V6zM3 5h14l-1 13H4L3 5z"/></svg>ลบ</button>'
        +'<button onclick="closeTxDetailModal();openEdit(\''+e.id+'\')" style="flex:2;padding:13px;border-radius:12px;background:var(--blue);color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif"><svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:middle;margin-right:4px"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9-3.314.485.485-3.314 9.9-9.9z"/></svg>แก้ไข</button>'
      +'</div>'
    +'</div>'
  +'</div>';

  var overlay = document.getElementById('txDetailOverlay');
  if (overlay) {
    overlay.style.opacity = '0';
    var sheet = overlay.querySelector('div');
    if (sheet) sheet.style.transform = 'translateY(60px)';
    requestAnimationFrame(function(){
      overlay.style.transition = 'opacity .2s';
      overlay.style.opacity = '1';
      if (sheet) { sheet.style.transition = 'transform .25s cubic-bezier(.4,0,.2,1)'; sheet.style.transform = 'translateY(0)'; }
    });
  }
}

function closeTxDetailModal() {
  var wrap = document.getElementById('txDetailModalWrap');
  if (!wrap) return;
  var overlay = document.getElementById('txDetailOverlay');
  var sheet = overlay ? overlay.querySelector('div') : null;
  if (sheet) {
    sheet.style.transition = 'transform .32s cubic-bezier(.4,0,.8,1), opacity .28s ease';
    sheet.style.transform  = 'translateY(4px) scale(1.02)';
    sheet.style.opacity    = '1';
    setTimeout(function(){
      sheet.style.transition = 'transform .34s cubic-bezier(.4,0,1,1), opacity .28s ease';
      sheet.style.transform  = 'translateY(110%)';
      sheet.style.opacity    = '0';
      if (overlay) { overlay.style.transition = 'opacity .3s'; overlay.style.opacity = '0'; }
      setTimeout(function(){ wrap.innerHTML = ''; }, 340);
    }, 80);
  } else { wrap.innerHTML = ''; }
}

// ─── MARK / DELETE ────────────────────────────────────────
function markPaid(id){
  if(!checkOnlineForAction()) return;
  var sid=String(id);
  var e=db.find(function(x){return String(x.id)===sid;});
  if(e){ e.status=doneStatus(e.type); sbUpdate(e); }
  save(); renderDash(); renderTx();
}
function markPending(id){
  if(!checkOnlineForAction()) return;
  var sid=String(id);
  var e=db.find(function(x){return String(x.id)===sid;});
  if(e){ e.status='pending'; sbUpdate(e); }
  save(); renderDash(); renderTx();
}
function delStep1(id){
  // Desktop — ใช้ confirm modal เหมือนกัน
  delConfirm(id);
}

// ─── DELETE CONFIRM MODAL ─────────────────────────────────
var _pendingDeleteId = null;

function delConfirm(id) {
  if (!checkOnlineForAction()) return;
  var entry = db.find(function(e){ return String(e.id) === String(id); });
  if (!entry) return;

  var pairId = entry.transfer_pair_id || null;
  var modal  = document.getElementById('deleteConfirmModal');
  var descEl = document.getElementById('delConfirmDesc');
  var noteEl = document.getElementById('delConfirmNote');

  _pendingDeleteId = id;

  if (descEl) {
    if (entry.type === 'transfer') {
      descEl.innerHTML =
        '↔ <strong>' + entry.desc + '</strong><br>' +
        '<span style="font-size:12px;color:var(--ink3)">รายการโอนเงิน</span>';
    } else {
      var sign = entry.type === 'income' ? '+' : '−';
      descEl.innerHTML =
        '<strong>' + entry.desc + '</strong><br>' +
        '<span style="font-size:12px;color:var(--ink3)">' + (entry.cat_name || '—') + ' · ' + sign + fmtH(entry.amt) + ' บาท</span>';
    }
  }
  if (noteEl) {
    noteEl.textContent = pairId
      ? '⚠️ การโอนเงินจะลบทั้ง 2 รายการ (ต้นทางและปลายทาง) พร้อมกัน'
      : 'รายการที่ลบแล้วไม่สามารถกู้คืนได้';
  }
  if (modal) _openModal('deleteConfirmModal');
}

function closeDeleteConfirmModal() {
  _closeModal('deleteConfirmModal', function() { _pendingDeleteId = null; });
}

function execDeleteConfirmed() {
  if (!_pendingDeleteId) return;
  var id    = _pendingDeleteId;
  var entry = db.find(function(e){ return String(e.id) === String(id); });
  closeDeleteConfirmModal();
  if (!entry) return;

  var pairId     = entry.transfer_pair_id || null;
  var idsToRemove = [String(id)];
  if (pairId) idsToRemove.push(String(pairId));

  db = db.filter(function(e){ return idsToRemove.indexOf(String(e.id)) === -1; });
  save(); renderTx(); renderDash();
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderAccountList  === 'function') renderAccountList();

  // sync to Supabase
  sbDelete(id);
  if (pairId) sbDelete(pairId);

  var msg = entry.type === 'transfer'
    ? '🗑 ลบการโอนเงิน "' + entry.desc + '" แล้ว (ทั้งคู่)'
    : '🗑 ลบ "' + entry.desc + '" แล้ว';
  showCycleToast(msg);
}

// (undo toast removed — replaced by confirm-before-delete modal)

// ─── EXPORT CSV ───────────────────────────────────────────
// NOTE: definition lives in supabase.js (later override wins)
//       and a richer filtered version is in features.js (exportFilteredCSV)
