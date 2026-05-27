/* HomeFinance · module: transactions.js · v3.0.0 */

// ─── ADMIN "SHOW ALL USERS" TOGGLE ───────────────────────
var _txShowAllUsers = false;  // false = เฉพาะของตัวเอง, true = ทุก user (admin)

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
  var cur      = getMFValues('mfUser');
  var profiles = window._allProfiles || [];
  el.innerHTML = profiles.length
    ? profiles.map(function(p) {
        var safeId   = p.id;
        var safeName = (p.name || p.id.slice(0, 8)).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return '<label><input type="checkbox" value="' + safeId + '" ' +
          (cur.indexOf(safeId) > -1 ? 'checked' : '') +
          ' onchange="updateMFLabel(\'mfUser\',\'ผู้บันทึก\');renderTx()"> ' + safeName + '</label>';
      }).join('')
    : '<div style="padding:8px 14px;font-size:12px;color:var(--ink3)">ไม่มีข้อมูลผู้ใช้</div>';
}

// ─── MULTI FILTER ─────────────────────────────────────────
function toggleMF(id){
  var el = document.getElementById(id);
  var dd = el.querySelector('.mf-dropdown');
  var wasOpen = dd.classList.contains('open');
  document.querySelectorAll('.mf-dropdown.open').forEach(function(d){d.classList.remove('open');});
  if(!wasOpen) dd.classList.add('open');
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

function populateMFItem(){
  var el = document.getElementById('mfItemList');
  if(!el) return;
  var cur = getMFValues('mfItem');
  var fcats = getMFValues('mfCat');
  // get items from selected categories (or all)
  var items = [];
  if(fcats.length){
    fcats.forEach(function(catId){ items.push.apply(items, (itemsData[catId]||[]).map(function(x){return x.name;})); });
  } else {
    Object.values(itemsData).forEach(function(arr){ items.push.apply(items, arr.map(function(x){return x.name;})); });
  }
  items = Array.from(new Set(items)).sort();
  el.innerHTML = items.length
    ? items.map(function(name){return '<label>'+
        '<input type="checkbox" value="'+name+'" '+(cur.indexOf(name)>-1?'checked':'')+' onchange="updateMFLabel(\'mfItem\',\'รายการ\');renderTx()">'+
        ' '+name+'</label>';}).join('')
    : '<div style="padding:8px 14px;font-size:12px;color:var(--ink3)">ไม่มีรายการ</div>';
}

function populateMFVendor(){
  var el = document.getElementById('mfVendorList');
  if(!el) return;
  var cur = getMFValues('mfVendor');
  el.innerHTML = vendorsData.length
    ? vendorsData.map(function(v){return '<label>'+
        '<input type="checkbox" value="'+v.id+'" '+(cur.indexOf(v.id)>-1?'checked':'')+' onchange="updateMFLabel(\'mfVendor\',\'ร้านค้า\');renderTx()">'+
        ' '+v.name+'</label>';}).join('')
    : '<div style="padding:8px 14px;font-size:12px;color:var(--ink3)">ยังไม่มีร้านค้า</div>';
}

function populateMFCat(){
  var el = document.getElementById('mfCatList');
  if(!el) return;
  var cur = getMFValues('mfCat');
  el.innerHTML = categories.map(function(c){return '<label>'+
    '<input type="checkbox" value="'+c.id+'" '+(cur.indexOf(c.id)>-1?'checked':'')+' onchange="updateMFLabel(\'mfCat\',\'หมวด\');populateMFItem();renderTx()">'+
    ' '+c.name+'</label>';}).join('');
}


function resetFilters(){
  document.getElementById('fltMonth').value='';
  // Rebuild billing_month filter dropdown
  var fltBM = document.getElementById('fltBillingMonth');
  if (fltBM) { fltBM.value = ''; populateFltBillingMonth(fltBM); }
  document.querySelectorAll('.mf-dropdown input[type=checkbox]').forEach(function(cb){cb.checked=false;});
  [['mfType','ประเภท'],['mfCat','หมวด'],['mfItem','รายการ'],['mfVendor','ร้านค้า'],['mfStatus','สถานะ'],['mfUser','ผู้บันทึก']].forEach(function(pair){
    var id=pair[0], def=pair[1];
    var label=document.querySelector('#'+id+' .mf-label');
    if(label){ label.textContent=def+' ▾'; label.classList.remove('active'); }
  });
  renderTx();
}

/**
 * คืนรายการ transactions ที่ถูก filter อยู่ตาม UI ปัจจุบัน
 * (ใช้ตอน export CSV ของรายการที่กรอง)
 */
function getFilteredTx(){
  var fltM  = document.getElementById('fltMonth');
  var fltBM = document.getElementById('fltBillingMonth');
  var list  = db.slice();
  // ซ่อน transfer IN — แสดงเฉพาะ OUT
  list = list.filter(function(e){ return e.transfer_direction !== 'in'; });
  // กรอง: เฉพาะของ user ปัจจุบัน (Admin ปลดล็อกด้วยรหัสผ่านเพื่อดูทั้งหมด)
  var _myUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  if (!_txShowAllUsers && _myUid) {
    list = list.filter(function(e){ return (e.user_id || e.person) === _myUid; });
  }
  // transaction_date filter
  if(fltM  && fltM.value)  list = list.filter(function(e){ return e.date.startsWith(fltM.value); });
  // billing_month filter (v3)
  if(fltBM && fltBM.value){
    list = list.filter(function(e){
      var bm = e.billing_month || e.date.slice(0,7);
      return bm === fltBM.value;
    });
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

/** Populate billing_month <select> from unique values in db */
function populateFltBillingMonth(sel) {
  if (!sel) sel = document.getElementById('fltBillingMonth');
  if (!sel) return;
  var cur = sel.value;
  var months = Array.from(new Set(db.map(function(e){
    return e.billing_month || e.date.slice(0,7);
  }))).sort().reverse();
  sel.innerHTML = '<option value="">เดือนบิล (billing)</option>' +
    months.map(function(m){
      var parts = m.split('-').map(Number);
      return '<option value="'+m+'" '+(m===cur?'selected':'')+'>'+
             SHORT_M[parts[1]-1]+' '+(parts[0]+543)+'</option>';
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
        var fmtAmt = (typeof fmtH === 'function') ? fmtH(s.amount || 0) : (s.amount || 0);
        lines.push(mName + ' — ' + fmtAmt + ' บาท' + (s.pct ? ' (' + s.pct + '%)' : ''));
      });
    } else if (grp && grp.members) {
      (grp.members || []).filter(function(m){ return m.active; }).forEach(function(m){
        lines.push(m.label || (typeof nm === 'function' ? nm(m.user_id) : m.user_id));
      });
    }
    var tipData = encodeURIComponent(JSON.stringify({ title: name, lines: lines }));
    return '<span class="badge badge-split" style="font-size:10px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default"'
      +' onmouseenter="_showSplitTip(this,\''+tipData+'\')"'
      +' onmouseleave="_hideSplitTip()"'
      +' onclick="_toggleSplitTip(this,\''+tipData+'\')"'
      +'>'+icon+' '+name+'</span>';
  }
  if (e.split) {
    return '<span class="badge badge-split">÷ หาร</span>';
  }
  return '<span class="badge badge-personal">💼 ส่วนตัว</span>';
}

/** Tooltip helpers สำหรับ split badge */
var _splitTipVisible = false;
function _showSplitTip(el, tipData) {
  try {
    var data = JSON.parse(decodeURIComponent(tipData));
    var tip = document.getElementById('splitMemberTip');
    if (!tip) return;
    tip.innerHTML =
      '<div style="font-weight:700;margin-bottom:6px;font-size:12px">'+_escTip(data.title)+'</div>'+
      (data.lines.length
        ? data.lines.map(function(l){ return '<div style="font-size:12px;padding:2px 0">👤 '+_escTip(l)+'</div>'; }).join('')
        : '<div style="font-size:11px;color:rgba(255,255,255,.6)">ไม่มีข้อมูลสมาชิก</div>');
    var rect = el.getBoundingClientRect();
    tip.style.display = 'block';
    var tipW = tip.offsetWidth || 200;
    var left = Math.min(rect.left + window.scrollX, window.innerWidth - tipW - 8);
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
    _splitTipVisible = true;
  } catch(_){}
}
function _hideSplitTip() {
  var tip = document.getElementById('splitMemberTip');
  if (tip) tip.style.display = 'none';
  _splitTipVisible = false;
}
function _toggleSplitTip(el, tipData) {
  if (_splitTipVisible) { _hideSplitTip(); } else { _showSplitTip(el, tipData); }
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
  // default to current month on first load
  if(!fltM._initialized){ fltM._initialized=true; fltM.value=thisM; }
  var curM=fltM.value;
  fltM.innerHTML=months.map(function(m){
    var parts=m.split('-').map(Number);
    var y=parts[0], mo=parts[1];
    return '<option value="'+m+'" '+(m===curM?'selected':'')+'>'+SHORT_M[mo-1]+' '+(y+543)+'</option>';
  }).join('');
  if(curM) fltM.value=curM;

  // always rebuild multi filters
  populateMFCat();
  populateMFVendor();
  populateFltBillingMonth();

  var list = db.slice();
  // ซ่อน transfer IN entry — แสดงเฉพาะ OUT (ตัวเดียวต่อการโอน)
  list = list.filter(function(e){ return e.transfer_direction !== 'in'; });
  // กรอง: เฉพาะของ user ปัจจุบัน (Admin ปลดล็อกด้วยรหัสผ่านเพื่อดูทั้งหมด)
  var _myUid2 = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  if (!_txShowAllUsers && _myUid2) {
    list = list.filter(function(e){ return (e.user_id || e.person) === _myUid2; });
  }
  if(fltM.value) list=list.filter(function(e){return e.date.startsWith(fltM.value);});

  // billing_month filter (v3)
  var fltBM = document.getElementById('fltBillingMonth');
  if(fltBM && fltBM.value){
    list = list.filter(function(e){
      return (e.billing_month || e.date.slice(0,7)) === fltBM.value;
    });
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

  // เรียง: วันที่ล่าสุดก่อน → ภายในวันเดียวกัน เรียงตาม id (= Date.now() ตอนบันทึก) ล่าสุดก่อน
  list.sort(function(a, b){
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
    totalEl.style.display='flex';
    totalEl.innerHTML=
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">รายรับ ('+list.filter(function(e){return e.type==='income'&&isPaid(e);}).length+')</div><div style="font-size:15px;font-weight:700;color:var(--green);font-family:monospace">'+fmtH(inc)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">รายจ่าย ('+list.filter(function(e){return e.type==='expense'&&isPaid(e);}).length+')</div><div style="font-size:15px;font-weight:700;color:var(--red);font-family:monospace">'+fmtH(exp)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">รอดำเนินการ ('+list.filter(function(e){return e.status==='pending';}).length+')</div><div style="font-size:15px;font-weight:700;color:var(--amber);font-family:monospace">'+fmtH(pend)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">สุทธิ ('+list.length+' รายการ)</div><div style="font-size:15px;font-weight:700;font-family:monospace;color:'+(inc-exp>=0?'var(--green)':'var(--red)')+'">'+fmtH(inc-exp)+'</div></div>';
  } else if(totalEl){ totalEl.style.display='none'; }

  var isMobile = window.innerWidth <= 900;
  var revertBtn = function(e){ return '<button class="btn-revert" onclick="markPending(\''+e.id+'\')">'+
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 4v4.31l2.97 1.71-.75 1.3L5.75 9.1V4h1.5z"/></svg>'+
    ' คืนสถานะ'+
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
            return '<div style="background:var(--surface2);padding:5px 12px;font-size:11px;font-weight:600;color:var(--ink2);border-bottom:1px solid var(--line);border-top:1px solid var(--line)">'+toThaiDateStr(g.date)+'</div>'+
              g.items.map(function(e){return '<div class="swipe-row" id="srow-'+e.id+'">'+
          '<div class="swipe-actions">'+
            '<button class="sa-btn sa-edit" onclick="closeAllSwipe();openEdit(\''+e.id+'\')">'+
              '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9-3.314.485.485-3.314 9.9-9.9z"/></svg>'+
              ' แก้ไข'+
            '</button>'+
            (isPaid(e)
              ? '<button class="sa-btn sa-status-paid" onclick="closeAllSwipe();markPending(\''+e.id+'\')">'+
                  '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm.75 4v4.5l2.7 1.56-.75 1.3L9.25 11V6h1.5z"/></svg>'+
                  ' คืนสถานะ'+
                '</button>'
              : '<button class="sa-btn sa-status-pending" onclick="closeAllSwipe();markPaid(\''+e.id+'\')">'+
                  '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>'+
                  ' ยืนยัน'+
                '</button>'
            )+
            '<button class="sa-btn sa-delete" onclick="closeAllSwipe();delConfirm(\''+e.id+'\')">'+
              '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2l1-1h6l1 1h4v2H2V2h4zm1 4h2v9H7V6zm4 0h2v9h-2V6zM3 5h14l-1 13H4L3 5z"/></svg>'+
              ' ลบ'+
            '</button>'+
          '</div>'+
          '<div class="swipe-content" id="sc-'+e.id+'">'+
            '<div style="padding:12px 12px 10px">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
                '<div style="flex:1;min-width:0">'+
                  '<div style="font-size:14px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</div>'+
                  '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">'+

                    '<span style="font-size:11px;color:var(--ink3)">'+(e.cat_name||'—')+'</span>'+
                    (e.vendor_id ? '<span style="font-size:11px;color:var(--ink3);background:var(--surface2);padding:1px 6px;border-radius:4px">'+(((vendorsData.find(function(v){return v.id===e.vendor_id;}))||{}).name||'—')+'</span>' : '')+
                    (_txShowAllUsers && (e.user_id||e.person) ? personPill(e.user_id||e.person) : '')+
                  '</div>'+
                  (e.type==='expense' ? '<div style="margin-top:4px">'+_splitBadge(e)+'</div>' : '')+
                  (e.note ? '<div style="font-size:11px;color:var(--ink3);margin-top:3px;font-style:italic">📝 '+e.note+'</div>' : '')+
                '</div>'+
                '<div style="text-align:right;flex-shrink:0">'+
                  (isSalary(e) ?
                  '<div style="font-size:15px;font-weight:600;font-family:monospace;color:var(--green);display:flex;align-items:center;gap:4px;justify-content:flex-end">'+
                    '<span id="sal-'+e.id+'" style="filter:blur(5px);user-select:none;transition:filter .15s">+'+fmtH(e.amt)+'</span>'+
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
                  
                  '<span style="font-size:15px;font-weight:600;font-family:monospace;color:'+(e.type==='income'?'var(--green)':'var(--red)')+'">'+
                    (e.type==='income'?'+':'−')+fmtH(e.amt)+
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
          '</div>'+
        '</div>';}).join('');
          }).join('');
        })()
      : '<div class="empty">ไม่พบรายการ</div>';

    // ── Swipe via event delegation on container ───────────────
    // Bound ONCE on container — survives re-renders from pull/add/edit
    var SWIPE_W = 200;
    var container = document.getElementById('txContent');
    if(!container) return;

    // Remove old delegated handler if exists, then re-add
    if(container._swipeHandler){
      container.removeEventListener('touchstart', container._swipeHandler, {passive:true});
      container.removeEventListener('touchmove',  container._swipeMoveHandler);
      container.removeEventListener('touchend',   container._swipeEndHandler, {passive:true});
      container.removeEventListener('touchcancel',container._swipeCancelHandler, {passive:true});
    }

    var _sc=null, _sx=0, _sy=0, _cx=0, _cy=0, _axis=null, _active=false;

    function getSwipeContent(target){
      return target.closest('.swipe-content');
    }

    container._swipeHandler = function(ev){
      var sc = getSwipeContent(ev.target);
      if(!sc) return;
      // init _open every time — works for new renders and pulled data
      if(sc._open === undefined) sc._open = false;
      _sc=sc; _active=true;
      _sx=_cx=ev.touches[0].clientX;
      _sy=_cy=ev.touches[0].clientY;
      _axis=null;
    };

    container._swipeMoveHandler = function(ev){
      if(!_active||!_sc) return;
      _cx=ev.touches[0].clientX;
      _cy=ev.touches[0].clientY;
      var dx=_cx-_sx, dy=_cy-_sy;
      if(!_axis && (Math.abs(dx)>5||Math.abs(dy)>5)){
        _axis=Math.abs(dx)>=Math.abs(dy)?'h':'v';
      }
      if(_axis==='h'){
        ev.preventDefault();
        var base=_sc._open?-SWIPE_W:0;
        var clamped=Math.max(-SWIPE_W,Math.min(0,base+dx));
        _sc.style.transition='none';
        _sc.style.transform='translateX('+clamped+'px)';
      } else if(_axis==='v'){
        if(_sc._open){
          _sc.style.transition='transform .2s cubic-bezier(.4,0,.2,1)';
          _sc.style.transform='translateX(0)';
          _sc._open=false;
          if(_swipeOpenSc===_sc) _swipeOpenSc=null;
        }
        _active=false; _sc=null;
      }
    };

    container._swipeEndHandler = function(){
      if(!_active||!_sc){ _active=false; return; }
      _active=false;
      if(_axis!=='h'){ _axis=null; _sc=null; return; }
      var dx=_cx-_sx;
      var sc=_sc; _sc=null;
      sc.style.transition='transform .25s cubic-bezier(.4,0,.2,1)';
      if(!sc._open){
        if(dx < -50){
          if(_swipeOpenSc&&_swipeOpenSc!==sc){
            _swipeOpenSc.style.transition='transform .25s cubic-bezier(.4,0,.2,1)';
            _swipeOpenSc.style.transform='translateX(0)';
            _swipeOpenSc._open=false;
          }
          sc.style.transform='translateX(-'+SWIPE_W+'px)';
          sc._open=true; _swipeOpenSc=sc;
        } else { sc.style.transform='translateX(0)'; }
      } else {
        if(dx>40){
          sc.style.transform='translateX(0)';
          sc._open=false; if(_swipeOpenSc===sc) _swipeOpenSc=null;
        } else { sc.style.transform='translateX(-'+SWIPE_W+'px)'; }
      }
      _axis=null;
    };

    container._swipeCancelHandler = function(){
      if(!_sc){ _active=false; return; }
      var sc=_sc; _sc=null; _active=false; _axis=null;
      sc.style.transition='transform .15s';
      sc.style.transform=sc._open?('translateX(-'+SWIPE_W+'px)'):'translateX(0)';
    };

    container.addEventListener('touchstart', container._swipeHandler,      {passive:true});
    container.addEventListener('touchmove',  container._swipeMoveHandler,  {passive:false});
    container.addEventListener('touchend',   container._swipeEndHandler,   {passive:true});
    container.addEventListener('touchcancel',container._swipeCancelHandler,{passive:true});

    // bind .main scroll (removeEventListener safe — same named fn)
    var mainEl = document.querySelector('.main');
    if(mainEl){ mainEl.removeEventListener('scroll',_swipeScrollClose); mainEl.addEventListener('scroll',_swipeScrollClose,{passive:true}); }

  } else {
    document.getElementById('txContent').innerHTML = list.length ? '<table>'+
      '<tr><th>รายการ</th><th>หมวด</th><th>ร้านค้า</th>'+(_txShowAllUsers?'<th>ผู้บันทึก</th>':'')+'<th>รูปแบบหาร</th><th style="text-align:right">จำนวน (บาท)</th><th style="text-align:center">บัญชี</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr>'+
      (function(){
        var _groups=[], _dmap={};
        list.forEach(function(e){
          var d=e.date;
          if(!_dmap[d]){_dmap[d]=[];_groups.push({date:d,items:_dmap[d]});}
          _dmap[d].push(e);
        });
        return _groups.map(function(g){
          return '<tr><td colspan="'+(_txShowAllUsers?'10':'9')+'" style="padding:6px 10px;font-size:11px;font-weight:700;color:var(--ink2);background:var(--surface2);border-top:2px solid var(--line)">'+toThaiDateStr(g.date)+'</td></tr>'+
            g.items.map(function(e){return '<tr class="tx-row" id="row-'+e.id+'" onclick="openEdit(\''+e.id+'\')">'+

        '<td>'+e.desc+' <span class="edit-hint">✎ แก้ไข</span></td>'+
        '<td style="font-size:12px;color:var(--ink3)">'+(e.cat_name||'—')+'</td>'+
        '<td style="font-size:12px;color:var(--ink3)">'+(e.vendor_id ? (((vendorsData.find(function(v){return v.id===e.vendor_id;}))||{}).name||'—') : '—')+'</td>'+
        (_txShowAllUsers?'<td>'+personPill(e.user_id||e.person)+'</td>':'')+
        '<td>'+_splitBadge(e)+'</td>'+
        '<td style="text-align:right;font-family:monospace;font-weight:500;color:'+(e.type==='transfer'?'var(--blue)':e.type==='income'?'var(--green)':'var(--red)')+'">'+
          (e.type==='transfer'?'↗ ':e.type==='income'?'+':'−')+fmtH(e.amt)+
        '</td>'+
        '<td style="text-align:center;vertical-align:middle">'+(function(){ var a=(typeof accountsData!=='undefined'?accountsData:[]).find(function(x){return x.id===e.account_id;}); return a ? '<span title="'+(a.name||'').replace(/"/g,'&quot;')+'" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+(a.color||'#1a4fa0')+'"></span>' : ''; })()+
        '</td>'+
        '<td>'+(e.type==='transfer'
          ? '<span class="badge badge-paid" style="background:var(--blue-bg);color:var(--blue)">โอนแล้ว</span>'
          : '<span class="badge '+(isPaid(e)?(e.type==='income'?'badge-received':'badge-paid'):'badge-pending')+'">'+(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย'))+'</span>'
        )+'</td>'+
        '<td style="font-size:11px;color:var(--ink3);font-style:italic">'+(e.note||'—')+'</td>'+
        '<td style="white-space:nowrap;display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">'+
          (e.status==='pending'
            ? '<button class="btn btn-confirm" onclick="markPaid(\''+e.id+'\')">✓ ยืนยัน</button>'
            : revertBtn(e)
          )+
          '<button class="btn btn-del" id="del-'+e.id+'" onclick="delStep1(\''+e.id+'\')"><svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2l1-1h6l1 1h4v2H2V2h4zm1 4h2v9H7V6zm4 0h2v9h-2V6zM3 5h14l-1 13H4L3 5z"/></svg></button>'+
        '</td>'+
      '</tr>';}).join('');
        }).join('');
      })()+
      
    '</table>' : '<div class="empty">ไม่พบรายการ</div>';
  }
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
  if (modal) modal.style.display = 'flex';
}

function closeDeleteConfirmModal() {
  var modal = document.getElementById('deleteConfirmModal');
  if (modal) modal.style.display = 'none';
  _pendingDeleteId = null;
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
