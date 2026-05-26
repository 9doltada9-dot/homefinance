/* HomeFinance · module: vendors.js · v3.1.0 */

// vendor_type: 'expense' = ร้านค้า, 'income' = แหล่งรายรับ, 'both' = ทั้งคู่ (default)

// ─── HELPER: กรอง vendor ตาม txType ──────────────────────
function _filterVendorsByType(txType) {
  var t = txType || (typeof cType !== 'undefined' ? cType : 'expense');
  return vendorsData.filter(function(v) {
    var vt = v.vendor_type || 'both';
    return vt === 'both' || vt === t;
  });
}

function _vendorLabelFor(txType) {
  var t = txType || (typeof cType !== 'undefined' ? cType : 'expense');
  return t === 'income' ? 'แหล่งรายรับ' : 'ร้านค้า';
}

function _sortedVendors(list) {
  return list.slice().sort(function(a, b) {
    return (isFavVendor(b.name) ? 1 : 0) - (isFavVendor(a.name) ? 1 : 0);
  });
}

// ─── FILL FORM VENDOR (fVendor) ───────────────────────────
function fillVendors(txType) {
  var sel = document.getElementById('fVendor');
  if (!sel) return;
  var prevVal = sel.value;
  var list   = _filterVendorsByType(txType);
  var sorted = _sortedVendors(list);

  sel.innerHTML = sorted.map(function(v) {
    return '<option value="' + v.id + '">' + (isFavVendor(v.name) ? '⭐ ' : '') + v.name + '</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';

  // คืนค่าเดิมถ้ายังอยู่ในลิสต์ปัจจุบัน
  if (prevVal !== '' && list.find(function(v) { return v.id === prevVal; })) {
    sel.value = prevVal;
  } else if (prevVal === '') {
    sel.value = '';
  } else {
    var firstFav = sorted.find(function(v) { return isFavVendor(v.name); });
    if (firstFav) sel.value = firstFav.id;
    else if (sorted.length) sel.value = sorted[0].id;
    else sel.value = '';
  }

  // อัปเดต label
  var lbl = document.getElementById('fVendorLabel');
  if (lbl) lbl.textContent = _vendorLabelFor(txType) + ' ';

  var btn = document.getElementById('fVendorStar');
  _bindVendorStar(sel, btn, txType);
  sel.onchange = function() { _bindVendorStar(sel, btn, txType); };
}

function _bindVendorStar(sel, btn, txType) {
  if (!btn) return;
  var curId = sel.value;
  var n = (vendorsData.find(function(v) { return v.id === curId; }) || {}).name || '';
  btn.textContent = (n && isFavVendor(n)) ? '⭐' : '☆';
  btn.title = (n && isFavVendor(n)) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
  btn.onclick = function() {
    if (!n) return;
    var f = getFavs(); if (!f.vendor) f.vendor = {};
    f.vendor[n] = !f.vendor[n]; saveFavs(f);
    _rebuildVendorOptions(sel, txType);
    btn.textContent = isFavVendor(n) ? '⭐' : '☆';
    btn.title = isFavVendor(n) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
    var eVendorStar = document.getElementById('eVendorStar');
    if (eVendorStar) { var eV = document.getElementById('eVendor'); if (eV) _bindEditVendorStar(eV, eVendorStar); }
  };
}

function _rebuildVendorOptions(sel, txType) {
  var curId  = sel.value;
  var list   = _filterVendorsByType(txType);
  var sorted = _sortedVendors(list);
  sel.innerHTML = sorted.map(function(v) {
    return '<option value="' + v.id + '">' + (isFavVendor(v.name) ? '⭐ ' : '') + v.name + '</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';
  sel.value = curId;
}

// ─── FILL EDIT VENDOR (eVendor) ───────────────────────────
function fillEditVendors(txType) {
  var sel = document.getElementById('eVendor');
  if (!sel) return;
  var prevVal = sel.value;
  var list   = _filterVendorsByType(txType);
  var sorted = _sortedVendors(list);

  sel.innerHTML = sorted.map(function(v) {
    return '<option value="' + v.id + '">' + (isFavVendor(v.name) ? '⭐ ' : '') + v.name + '</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';

  if (prevVal !== undefined) sel.value = prevVal;

  // อัปเดต label
  var lbl = document.getElementById('eVendorLabel');
  if (lbl) lbl.textContent = _vendorLabelFor(txType) + ' ';

  var btn = document.getElementById('eVendorStar');
  _bindEditVendorStar(sel, btn, txType);
  sel.onchange = function() { _bindEditVendorStar(sel, btn, txType); };
}

function _bindEditVendorStar(sel, btn, txType) {
  if (!btn) return;
  var curId = sel.value;
  var n = (vendorsData.find(function(v) { return v.id === curId; }) || {}).name || '';
  btn.textContent = (n && isFavVendor(n)) ? '⭐' : '☆';
  btn.title = (n && isFavVendor(n)) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
  btn.onclick = function() {
    if (!n) return;
    var f = getFavs(); if (!f.vendor) f.vendor = {};
    f.vendor[n] = !f.vendor[n]; saveFavs(f);
    _rebuildEditVendorOptions(sel, txType);
    btn.textContent = isFavVendor(n) ? '⭐' : '☆';
    btn.title = isFavVendor(n) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
    var fSel = document.getElementById('fVendor');
    var fBtn = document.getElementById('fVendorStar');
    if (fSel) { _rebuildVendorOptions(fSel, txType); if (fBtn) _bindVendorStar(fSel, fBtn, txType); }
  };
}

function _rebuildEditVendorOptions(sel, txType) {
  var curId  = sel.value;
  var list   = _filterVendorsByType(txType);
  var sorted = _sortedVendors(list);
  sel.innerHTML = sorted.map(function(v) {
    return '<option value="' + v.id + '">' + (isFavVendor(v.name) ? '⭐ ' : '') + v.name + '</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';
  sel.value = curId;
}

// ─── SETTINGS: RENDER VENDOR LIST ────────────────────────
var _VTYPE_LABELS = { expense: '🛒 ร้านค้า', income: '💰 แหล่งรายรับ', both: '🔄 ทั้งคู่' };
var _VTYPE_COLORS = { expense: 'var(--amber)', income: 'var(--green)', both: 'var(--ink3)' };

function renderVendorList() {
  var el = document.getElementById('vendorList');
  if (!el) return;
  el.innerHTML = vendorsData.length
    ? vendorsData.map(function(v) {
        var vt = v.vendor_type || 'both';
        var badge = '<span style="font-size:10px;padding:1px 7px;border-radius:10px;'
          + 'background:var(--surface2);color:' + (_VTYPE_COLORS[vt] || 'var(--ink3)') + ';white-space:nowrap;font-weight:600">'
          + (_VTYPE_LABELS[vt] || vt) + '</span>';
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)" id="vrow-' + v.id + '">'
          + '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0" id="vname-' + v.id + '">'
          +   '<span style="font-size:14px;color:var(--ink)">' + v.name + '</span>'
          +   badge
          + '</div>'
          + '<div style="display:flex;gap:4px;flex-shrink:0">'
          +   '<button onclick="startEditVendor(\'' + v.id + '\')" style="background:none;border:none;color:var(--ink3);font-size:15px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px" title="แก้ไข">✏️</button>'
          +   '<button onclick="deleteVendor(\'' + v.id + '\')" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px">×</button>'
          + '</div>'
          + '</div>';
      }).join('')
    : '<div style="font-size:13px;color:var(--ink3);padding:8px 0">ยังไม่มีรายการ</div>';
}

function startEditVendor(id) {
  var nameEl = document.getElementById('vname-' + id);
  if (!nameEl) return;
  var v = vendorsData.find(function(x) { return x.id === id; });
  if (!v) return;
  var vt = v.vendor_type || 'both';
  nameEl.innerHTML =
    '<input id="vedit-' + id + '" value="' + v.name + '" style="font-size:14px;border:1px solid var(--accent);border-radius:6px;padding:4px 8px;width:120px" '
    + 'onkeydown="if(event.key===\'Enter\')saveEditVendor(\'' + id + '\');if(event.key===\'Escape\')renderVendorList()">'
    + '<select id="vedit-type-' + id + '" style="font-size:13px;border:1px solid var(--line);border-radius:6px;padding:4px 6px">'
    +   '<option value="both"'  + (vt==='both'?' selected':'')  + '>🔄 ทั้งคู่</option>'
    +   '<option value="expense"' + (vt==='expense'?' selected':'') + '>🛒 ร้านค้า</option>'
    +   '<option value="income"'  + (vt==='income'?' selected':'')  + '>💰 แหล่งรายรับ</option>'
    + '</select>'
    + '<button onclick="saveEditVendor(\'' + id + '\')" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer;white-space:nowrap">บันทึก</button>';
  var inp = document.getElementById('vedit-' + id);
  if (inp) { inp.focus(); inp.select(); }
}

async function saveEditVendor(id) {
  var inp     = document.getElementById('vedit-' + id);
  var typeSel = document.getElementById('vedit-type-' + id);
  if (!inp) return;
  var newName = inp.value.trim();
  var newType = typeSel ? typeSel.value : 'both';
  if (!newName) { showMsg('vendorMsg', 'กรุณาใส่ชื่อ', 'error'); return; }
  if (vendorsData.find(function(v) { return v.name === newName && v.id !== id; })) {
    showMsg('vendorMsg', 'มีชื่อนี้แล้ว', 'error'); return;
  }
  var v = vendorsData.find(function(x) { return x.id === id; });
  if (!v) return;
  v.name = newName;
  v.vendor_type = newType;
  saveVendorsLocal();
  renderVendorList();
  fillVendors();
  if (!String(id).startsWith('local-')) await sbUpdateVendor(id, newName, newType);
  showMsg('vendorMsg', 'แก้ไข "' + newName + '" แล้ว ✓', 'success');
}

async function addVendor() {
  var name = (document.getElementById('newVendorName') || {}).value;
  if (name) name = name.trim();
  var vendorType = (document.getElementById('newVendorType') || {}).value || 'both';
  if (!name) { showMsg('vendorMsg', 'กรุณาใส่ชื่อ', 'error'); return; }
  if (vendorsData.find(function(v) { return v.name === name; })) {
    showMsg('vendorMsg', 'มีชื่อนี้แล้ว', 'error'); return;
  }
  var sort  = vendorsData.length;
  var saved = await sbAddVendor(name, sort, vendorType);
  vendorsData.push({
    id: (saved && saved.id) || ('local-' + Date.now()),
    name: name,
    sort_order: sort,
    vendor_type: vendorType,
  });
  saveVendorsLocal();
  renderVendorList();
  fillVendors();
  document.getElementById('newVendorName').value = '';
  showMsg('vendorMsg', saved ? ('เพิ่ม "' + name + '" แล้ว ✓') : ('เพิ่ม "' + name + '" (offline)'), 'success');
}

async function deleteVendor(id) {
  var v = vendorsData.find(function(x) { return x.id === id; });
  if (!v) return;
  vendorsData = vendorsData.filter(function(x) { return x.id !== id; });
  saveVendorsLocal(); renderVendorList(); fillVendors();
  if (!String(id).startsWith('local-')) await sbDeleteVendor(id);
  showMsg('vendorMsg', 'ลบ "' + v.name + '" แล้ว', 'success');
}

// ─── INLINE VENDOR PANEL (จากหน้าบันทึกรายการ) ────────────
function toggleFVendorPanel() {
  var panel = document.getElementById('fVendorPanel');
  if (!panel) return;
  var isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    renderFVendorPanelList();
    var inp = document.getElementById('fVendorNewName');
    if (inp) { inp.value = ''; setTimeout(function(){ inp.focus(); }, 50); }
  }
}

function renderFVendorPanelList() {
  var el = document.getElementById('fVendorPanelList');
  if (!el) return;
  var txType = (typeof cType !== 'undefined') ? cType : 'expense';
  var list = _filterVendorsByType(txType);
  var sorted = _sortedVendors(list);
  if (!sorted.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--ink3);padding:4px 0">ยังไม่มีร้านค้า</div>';
    return;
  }
  el.innerHTML = sorted.map(function(v) {
    var sid = v.id;
    var sn  = v.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
    return '<div id="fvrow-'+sid+'" style="display:flex;align-items:center;gap:4px;padding:5px 0;border-bottom:1px solid var(--line)">'
      + '<span id="fvname-'+sid+'" style="flex:1;font-size:13px">'+sn+'</span>'
      + '<input id="fvinput-'+sid+'" type="text" value="'+sn+'" style="flex:1;font-size:13px !important;display:none;padding:2px 6px" '
      +   'onkeydown="if(event.key===\'Enter\')fVendorPanelSaveRename(\''+sid+'\');else if(event.key===\'Escape\')fVendorPanelCancelRename(\''+sid+'\')">'
      + '<button id="fvbtn-edit-'+sid+'" onclick="fVendorPanelStartRename(\''+sid+'\')" '
      +   'style="background:none;border:none;font-size:13px;cursor:pointer;padding:2px 5px;color:var(--blue)" title="แก้ไข">✏️</button>'
      + '<button id="fvbtn-save-'+sid+'" onclick="fVendorPanelSaveRename(\''+sid+'\')" '
      +   'style="display:none;background:none;border:none;font-size:14px;cursor:pointer;padding:2px 5px;color:var(--green)">✓</button>'
      + '<button onclick="fVendorPanelDelete(\''+sid+'\')" '
      +   'style="background:none;border:none;font-size:17px;cursor:pointer;padding:2px 5px;color:var(--red)" title="ลบ">×</button>'
      + '</div>';
  }).join('');
}

async function fVendorAdd() {
  var inp  = document.getElementById('fVendorNewName');
  var name = inp ? inp.value.trim() : '';
  if (!name) { showMsg('fVendorPanelMsg','กรุณาใส่ชื่อ','error'); return; }
  if (vendorsData.find(function(v){ return v.name === name; })) {
    showMsg('fVendorPanelMsg','มีชื่อนี้แล้ว','error'); return;
  }
  var txType = (typeof cType !== 'undefined') ? cType : 'expense';
  var vType  = txType === 'income' ? 'income' : 'expense';
  var sort   = vendorsData.length;
  // optimistic
  var tempId = 'local-' + Date.now();
  vendorsData.push({ id: tempId, name: name, sort_order: sort, vendor_type: vType });
  saveVendorsLocal();
  if (inp) inp.value = '';
  fillVendors(txType);
  renderFVendorPanelList();
  showMsg('fVendorPanelMsg', 'เพิ่ม "'+name+'" แล้ว ✓', 'success');
  // sync Supabase
  var saved = await sbAddVendor(name, sort, vType);
  if (saved && saved.id) {
    var idx = vendorsData.findIndex(function(v){ return v.id === tempId; });
    if (idx >= 0) vendorsData[idx].id = saved.id;
    saveVendorsLocal();
  }
}

function fVendorPanelStartRename(id) {
  var nameEl  = document.getElementById('fvname-'+id);
  var inputEl = document.getElementById('fvinput-'+id);
  var editBtn = document.getElementById('fvbtn-edit-'+id);
  var saveBtn = document.getElementById('fvbtn-save-'+id);
  if (nameEl)  nameEl.style.display  = 'none';
  if (inputEl) { inputEl.style.display = ''; inputEl.focus(); inputEl.select(); }
  if (editBtn) editBtn.style.display = 'none';
  if (saveBtn) saveBtn.style.display = '';
}

function fVendorPanelCancelRename(id) {
  var v = vendorsData.find(function(x){ return x.id === id; });
  var nameEl  = document.getElementById('fvname-'+id);
  var inputEl = document.getElementById('fvinput-'+id);
  var editBtn = document.getElementById('fvbtn-edit-'+id);
  var saveBtn = document.getElementById('fvbtn-save-'+id);
  if (nameEl)  nameEl.style.display  = '';
  if (inputEl) { inputEl.style.display = 'none'; if (v) inputEl.value = v.name; }
  if (editBtn) editBtn.style.display = '';
  if (saveBtn) saveBtn.style.display = 'none';
}

async function fVendorPanelSaveRename(id) {
  var inputEl = document.getElementById('fvinput-'+id);
  var newName = inputEl ? inputEl.value.trim() : '';
  if (!newName) return;
  var v = vendorsData.find(function(x){ return x.id === id; });
  if (!v) return;
  var oldName = v.name;
  v.name = newName;
  saveVendorsLocal();
  var txType = (typeof cType !== 'undefined') ? cType : 'expense';
  fillVendors(txType);
  renderFVendorPanelList();
  showMsg('fVendorPanelMsg', '"'+oldName+'" → "'+newName+'" แก้ไขแล้ว ✓', 'success');
  if (!String(id).startsWith('local-')) await sbUpdateVendor(id, newName);
}

async function fVendorPanelDelete(id) {
  var v = vendorsData.find(function(x){ return x.id === id; });
  if (!v) return;
  if (!confirm('ลบร้านค้า "'+v.name+'" ?')) return;
  vendorsData = vendorsData.filter(function(x){ return x.id !== id; });
  saveVendorsLocal();
  var txType = (typeof cType !== 'undefined') ? cType : 'expense';
  fillVendors(txType);
  renderFVendorPanelList();
  showMsg('fVendorPanelMsg', 'ลบ "'+v.name+'" แล้ว', 'success');
  if (!String(id).startsWith('local-')) await sbDeleteVendor(id);
}
