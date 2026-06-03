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

/** คืน HTML สำหรับ vendor logo/avatar (ใช้ทุกที่) */
function vendorLogoHtml(v, size) {
  size = size || 24;
  if (!v) return '';
  var name = v.name || '?';
  if (v.logo_url) {
    return '<img src="'+v.logo_url+'" title="'+name.replace(/"/g,'&quot;')+'" '
      +'style="width:'+size+'px;height:'+size+'px;border-radius:50%;object-fit:cover;flex-shrink:0;display:inline-block;vertical-align:middle">';
  }
  // fallback: ตัวอักษรแรก + สีเฉพาะ
  var code = 0; for(var _i=0;_i<name.length;_i++) code = (code*31+name.charCodeAt(_i))&0xffff;
  var bgs  = ['#dbeafe','#dcfce7','#fef3c7','#ede9fe','#fce7f3','#e0f2fe','#fee2e2','#fef9c3'];
  var fgs  = ['#1e40af','#166534','#92400e','#5b21b6','#9d174d','#0c4a6e','#991b1b','#713f12'];
  var bg = bgs[code%bgs.length], fg = fgs[code%fgs.length];
  return '<span style="display:inline-flex;width:'+size+'px;height:'+size+'px;border-radius:50%;'
    +'background:'+bg+';color:'+fg+';align-items:center;justify-content:center;'
    +'font-size:'+(size*0.55)+'px;font-weight:700;flex-shrink:0;vertical-align:middle">'+name.charAt(0)+'</span>';
}

function renderVendorList() {
  var el = document.getElementById('vendorList');
  if (!el) return;
  el.innerHTML = vendorsData.length
    ? '<div class="stg-vendor-grid">' + vendorsData.map(function(v) {
        var vt = v.vendor_type || 'both';
        var vtColor = _VTYPE_COLORS[vt] || 'var(--ink3)';
        return '<div class="stg-vendor-card" id="vrow-' + v.id + '">'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'
          +   '<div onclick="openVendorLogoModal(\''+v.id+'\')" title="เปลี่ยนโลโก้" style="cursor:pointer;flex-shrink:0">'+vendorLogoHtml(v,28)+'</div>'
          +   '<div id="vname-' + v.id + '" style="font-weight:600;font-size:12px;color:var(--ink);word-break:break-word;line-height:1.35;flex:1">'
          +     v.name
          +   '</div>'
          + '</div>'
          + '<div style="font-size:10px;color:' + vtColor + ';font-weight:600;margin-top:2px">' + (_VTYPE_LABELS[vt] || vt) + '</div>'
          + '<div style="display:flex;gap:4px;justify-content:flex-end;margin-top:6px">'
          +   '<button onclick="openVendorLogoModal(\''+v.id+'\')" class="stg-cat-card-btn" title="โลโก้">🖼</button>'
          +   '<button onclick="startEditVendor(\'' + v.id + '\')" class="stg-cat-card-btn" title="แก้ไข">✎</button>'
          +   '<button onclick="deleteVendor(\'' + v.id + '\')" class="stg-cat-card-btn" style="color:#f87171">×</button>'
          + '</div>'
          + '</div>';
      }).join('') + '</div>'
    : '<div style="font-size:13px;color:var(--ink3);padding:8px 14px">ยังไม่มีรายการ</div>';
}

// ─── VENDOR LOGO MODAL ────────────────────────────────────
var _vendorLogoState = { id: null, src: '', posX: 0, posY: 0, scale: 1 };

function openVendorLogoModal(id) {
  var v = vendorsData.find(function(x){ return x.id === id; });
  if (!v) return;
  _vendorLogoState.id   = id;
  _vendorLogoState.posX = 0; _vendorLogoState.posY = 0; _vendorLogoState.scale = 1;
  _vendorLogoState.src  = v.logo_url || '';
  var urlEl = document.getElementById('vendorLogoUrl');
  if (urlEl) urlEl.value = (v.logo_url && !v.logo_url.startsWith('data:')) ? v.logo_url : '';
  var fileEl = document.getElementById('vendorLogoFile');
  if (fileEl) fileEl.value = '';
  _vendorLogoRender(v.logo_url || '');
  var m = document.getElementById('vendorLogoModal');
  if (m) { m.style.display = 'flex'; }
}
function closeVendorLogoModal() {
  _vendorLogoRender('');
  _vendorLogoState.id = null;
  var m = document.getElementById('vendorLogoModal');
  if (m) m.style.display = 'none';
}
function _vendorLogoRender(src) {
  var el   = document.getElementById('vendorLogoPreview');
  var hint = document.getElementById('vendorLogoDragHint');
  if (!el) return;
  if (src) {
    var st = _vendorLogoState;
    el.style.border  = '2px solid var(--accent,#6366f1)';
    el.style.cursor  = 'grab';
    el.setAttribute('onmousedown',  '_vendorLogoDragStart(event)');
    el.setAttribute('ontouchstart', '_vendorLogoDragStart(event)');
    el.setAttribute('onwheel',      '_vendorLogoWheel(event)');
    el.innerHTML = '<img id="vendorLogoPreviewImg" src="'+src+'" '
      +'style="position:absolute;min-width:115%;min-height:115%;max-width:none;'
      +'top:50%;left:50%;transform:translate(calc(-50% + '+st.posX+'px),calc(-50% + '+st.posY+'px)) scale('+st.scale+');'
      +'pointer-events:none;user-select:none;border-radius:0;transform-origin:center center">';
    if (hint) hint.style.display = 'block';
  } else {
    el.innerHTML = '🛒'; el.style.border='2px dashed var(--line)'; el.style.cursor='default';
    el.removeAttribute('onmousedown'); el.removeAttribute('ontouchstart'); el.removeAttribute('onwheel');
    if (hint) hint.style.display = 'none';
    _vendorLogoState.src=''; _vendorLogoState.posX=0; _vendorLogoState.posY=0; _vendorLogoState.scale=1;
  }
}
function _vendorLogoApply() {
  var img = document.getElementById('vendorLogoPreviewImg');
  if (!img) return;
  var st = _vendorLogoState;
  img.style.transform = 'translate(calc(-50% + '+st.posX+'px),calc(-50% + '+st.posY+'px)) scale('+st.scale+')';
}
// Drag
var _vlDrag = { on:false, sx:0, sy:0, ox:0, oy:0 };
(function(){
  function _mv(e){
    if(_vlDrag.on){ e.preventDefault();
      var pt=e.touches?e.touches[0]:e;
      _vendorLogoState.posX=_vlDrag.ox+(pt.clientX-_vlDrag.sx);
      _vendorLogoState.posY=_vlDrag.oy+(pt.clientY-_vlDrag.sy);
      _vendorLogoApply(); }
  }
  function _up(){ if(_vlDrag.on){ _vlDrag.on=false; var el=document.getElementById('vendorLogoPreview'); if(el)el.style.cursor='grab'; } }
  window.addEventListener('mousemove',_mv); window.addEventListener('touchmove',_mv,{passive:false});
  window.addEventListener('mouseup',_up);   window.addEventListener('touchend',_up);
})();
function _vendorLogoDragStart(e) {
  if(!_vendorLogoState.src) return; e.preventDefault();
  _vlDrag.on=true; _vlDrag.sx=(e.touches?e.touches[0]:e).clientX; _vlDrag.sy=(e.touches?e.touches[0]:e).clientY;
  _vlDrag.ox=_vendorLogoState.posX; _vlDrag.oy=_vendorLogoState.posY;
  var el=document.getElementById('vendorLogoPreview'); if(el)el.style.cursor='grabbing';
}
function _vendorLogoWheel(e) {
  if(!_vendorLogoState.src) return; e.preventDefault();
  _vendorLogoState.scale=Math.min(6,Math.max(0.2,_vendorLogoState.scale*(e.deltaY<0?1.1:0.9)));
  _vendorLogoApply();
}
function onVendorLogoInput(val) {
  _vendorLogoState.src=val.trim(); _vendorLogoState.posX=0; _vendorLogoState.posY=0; _vendorLogoState.scale=1;
  _vendorLogoRender(val.trim());
}
function onVendorLogoFile(input) {
  var file=input.files[0]; if(!file) return;
  var r=new FileReader();
  r.onload=function(e){
    var urlEl=document.getElementById('vendorLogoUrl'); if(urlEl)urlEl.value='';
    _vendorLogoState.src=e.target.result; _vendorLogoState.posX=0; _vendorLogoState.posY=0; _vendorLogoState.scale=1;
    _vendorLogoRender(e.target.result);
  };
  r.readAsDataURL(file);
}
function onVendorLogoClear() {
  var urlEl=document.getElementById('vendorLogoUrl'); if(urlEl)urlEl.value='';
  var fileEl=document.getElementById('vendorLogoFile'); if(fileEl)fileEl.value='';
  _vendorLogoRender('');
}
async function saveVendorLogo() {
  var id = _vendorLogoState.id;
  if (!id) return;
  var v = vendorsData.find(function(x){ return x.id===id; });
  if (!v) return;
  var src = _vendorLogoState.src;
  // canvas crop ถ้าเป็น data URL
  function _doSave(logoUrl) {
    v.logo_url = logoUrl || null;
    saveVendorsLocal();
    if (!String(id).startsWith('local-')) sbUpdateVendorLogo(id, logoUrl);
    closeVendorLogoModal();
    renderVendorList();
    fillVendors(); fillEditVendors();
    showCycleToast('บันทึกโลโก้ "'+v.name+'" แล้ว');
  }
  if (!src) { _doSave(null); return; }
  if (!src.startsWith('data:')) { _doSave(src); return; }
  var S=72, cv=document.createElement('canvas'); cv.width=cv.height=S;
  var ctx=cv.getContext('2d');
  ctx.beginPath(); ctx.arc(S/2,S/2,S/2,0,Math.PI*2); ctx.clip();
  var img=new Image();
  img.onload=function(){
    var sc=Math.max(S/img.naturalWidth,S/img.naturalHeight)*_vendorLogoState.scale;
    var dw=img.naturalWidth*sc, dh=img.naturalHeight*sc;
    ctx.drawImage(img,(S-dw)/2+_vendorLogoState.posX,(S-dh)/2+_vendorLogoState.posY,dw,dh);
    try{ _doSave(cv.toDataURL('image/png')); }catch(ex){ _doSave(src); }
  };
  img.onerror=function(){ _doSave(src); };
  img.src=src;
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
    + '<select id="vedit-type-' + id + '" class="hf-chip" style="font-size:13px !important">'
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
  if (!confirm('ลบ "' + v.name + '" ใช่หรือไม่?')) return;
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
