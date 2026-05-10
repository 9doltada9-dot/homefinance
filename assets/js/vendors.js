/* HomeFinance · module: vendors.js · v2.9.3 */

// fillVendors() — เรียง: fav(⭐) → ปกติ → ไม่ระบุ (ท้ายสุด)
function fillVendors(){
  var sel = document.getElementById('fVendor');
  if(!sel) return;
  var prevVal = sel.value;

  var sorted = vendorsData.slice().sort(function(a,b){
    return (isFavVendor(b.name)?1:0) - (isFavVendor(a.name)?1:0);
  });

  sel.innerHTML = sorted.map(function(v){
    return '<option value="'+v.id+'">'+(isFavVendor(v.name)?'⭐ ':'')+v.name+'</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';

  // คืนค่าเดิมถ้ายังมี มิฉะนั้น auto-select fav แรก หรือ vendor แรก
  if(prevVal !== '' && vendorsData.find(function(v){return v.id===prevVal;})){
    sel.value = prevVal;
  } else if(prevVal === ''){
    sel.value = '';
  } else {
    var firstFav = sorted.find(function(v){return isFavVendor(v.name);});
    if(firstFav) sel.value = firstFav.id;
    else if(sorted.length) sel.value = sorted[0].id;
    else sel.value = '';
  }

  var btn = document.getElementById('fVendorStar');
  _bindVendorStar(sel, btn);
  sel.onchange = function(){ _bindVendorStar(sel, btn); };
}

function _bindVendorStar(sel, btn){
  if(!btn) return;
  var curId = sel.value;
  var n = (vendorsData.find(function(v){return v.id===curId;})||{}).name||'';
  btn.textContent = (n && isFavVendor(n)) ? '⭐' : '☆';
  btn.title = (n && isFavVendor(n)) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
  btn.onclick = function(){
    if(!n) return;
    // inline toggle ไม่เรียก fillVendors() เพื่อไม่ reset selection
    var f = getFavs(); if(!f.vendor) f.vendor={};
    f.vendor[n] = !f.vendor[n]; saveFavs(f);
    _rebuildVendorOptions(sel);
    btn.textContent = isFavVendor(n) ? '⭐' : '☆';
    btn.title = isFavVendor(n) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
    // sync edit overlay ด้วยถ้าเปิดอยู่
    var eVendorStar = document.getElementById('eVendorStar');
    if(eVendorStar){ var eV=document.getElementById('eVendor'); if(eV) _bindEditVendorStar(eV,eVendorStar); }
  };
}

function _rebuildVendorOptions(sel){
  var curId = sel.value;
  var sorted = vendorsData.slice().sort(function(a,b){
    return (isFavVendor(b.name)?1:0) - (isFavVendor(a.name)?1:0);
  });
  sel.innerHTML = sorted.map(function(v){
    return '<option value="'+v.id+'">'+(isFavVendor(v.name)?'⭐ ':'')+v.name+'</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';
  sel.value = curId;
}

// fillEditVendors — สำหรับ editOverlay
function fillEditVendors(){
  var sel = document.getElementById('eVendor');
  if(!sel) return;
  var prevVal = sel.value;
  var sorted = vendorsData.slice().sort(function(a,b){
    return (isFavVendor(b.name)?1:0) - (isFavVendor(a.name)?1:0);
  });
  sel.innerHTML = sorted.map(function(v){
    return '<option value="'+v.id+'">'+(isFavVendor(v.name)?'⭐ ':'')+v.name+'</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';
  if(prevVal !== undefined) sel.value = prevVal;
  var btn = document.getElementById('eVendorStar');
  _bindEditVendorStar(sel, btn);
  sel.onchange = function(){ _bindEditVendorStar(sel, btn); };
}

function _bindEditVendorStar(sel, btn){
  if(!btn) return;
  var curId = sel.value;
  var n = (vendorsData.find(function(v){return v.id===curId;})||{}).name||'';
  btn.textContent = (n && isFavVendor(n)) ? '⭐' : '☆';
  btn.title = (n && isFavVendor(n)) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
  btn.onclick = function(){
    if(!n) return;
    var f = getFavs(); if(!f.vendor) f.vendor={};
    f.vendor[n] = !f.vendor[n]; saveFavs(f);
    _rebuildEditVendorOptions(sel);
    btn.textContent = isFavVendor(n) ? '⭐' : '☆';
    btn.title = isFavVendor(n) ? 'ยกเลิก favorite' : 'ตั้ง favorite';
    // sync form dropdown ด้วย
    var fSel = document.getElementById('fVendor');
    var fBtn = document.getElementById('fVendorStar');
    if(fSel){ _rebuildVendorOptions(fSel); if(fBtn) _bindVendorStar(fSel,fBtn); }
  };
}

function _rebuildEditVendorOptions(sel){
  var curId = sel.value;
  var sorted = vendorsData.slice().sort(function(a,b){
    return (isFavVendor(b.name)?1:0) - (isFavVendor(a.name)?1:0);
  });
  sel.innerHTML = sorted.map(function(v){
    return '<option value="'+v.id+'">'+(isFavVendor(v.name)?'⭐ ':'')+v.name+'</option>';
  }).join('') + '<option value="">-- ไม่ระบุ --</option>';
  sel.value = curId;
}

function renderVendorList(){
  var el = document.getElementById('vendorList');
  if(!el) return;
  el.innerHTML = vendorsData.length
    ? vendorsData.map(function(v){
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)" id="vrow-'+v.id+'">'+
          '<span style="font-size:14px;color:var(--ink);flex:1" id="vname-'+v.id+'">'+v.name+'</span>'+
          '<div style="display:flex;gap:4px">'+
            '<button onclick="startEditVendor(\''+v.id+'\')" style="background:none;border:none;color:var(--ink3);font-size:15px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px" title="แก้ไข">✏️</button>'+
            '<button onclick="deleteVendor(\''+v.id+'\')" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px">×</button>'+
          '</div>'+
        '</div>';
      }).join('')
    : '<div style="font-size:13px;color:var(--ink3);padding:8px 0">ยังไม่มีร้านค้า</div>';
}

function startEditVendor(id){
  var nameEl = document.getElementById('vname-'+id);
  if(!nameEl) return;
  var v = vendorsData.find(function(x){return x.id===id;});
  if(!v) return;
  nameEl.innerHTML =
    '<input id="vedit-'+id+'" value="'+v.name+'" style="font-size:14px;border:1px solid var(--accent);border-radius:6px;padding:4px 8px;flex:1;width:100%" '+
    'onkeydown="if(event.key===\'Enter\')saveEditVendor(\''+id+'\');if(event.key===\'Escape\')renderVendorList()">'+
    '<button onclick="saveEditVendor(\''+id+'\')" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer;margin-left:6px;white-space:nowrap">บันทึก</button>';
  var inp = document.getElementById('vedit-'+id);
  if(inp){ inp.focus(); inp.select(); }
}

async function saveEditVendor(id){
  var inp = document.getElementById('vedit-'+id);
  if(!inp) return;
  var newName = inp.value.trim();
  if(!newName){ showMsg('vendorMsg','กรุณาใส่ชื่อ','error'); return; }
  if(vendorsData.find(function(v){return v.name===newName && v.id!==id;})){
    showMsg('vendorMsg','มีชื่อนี้แล้ว','error'); return;
  }
  var v = vendorsData.find(function(x){return x.id===id;});
  if(!v) return;
  v.name = newName;
  saveVendorsLocal();
  renderVendorList();
  fillVendors();
  if(!String(id).startsWith('local-')) await sbUpdateVendor(id, newName);
  showMsg('vendorMsg','แก้ไข "'+newName+'" แล้ว ✓','success');
}

async function addVendor(){
  var name = document.getElementById('newVendorName')?.value.trim();
  if(!name){ showMsg('vendorMsg','กรุณาใส่ชื่อ','error'); return; }
  if(vendorsData.find(function(v){return v.name===name;})){ showMsg('vendorMsg','มีร้านค้านี้แล้ว','error'); return; }
  var sort = vendorsData.length;
  var saved = await sbAddVendor(name, sort);
  vendorsData.push({id: (saved && saved.id) || ('local-'+Date.now()), name:name, sort_order:sort});
  saveVendorsLocal(); renderVendorList(); fillVendors();
  document.getElementById('newVendorName').value='';
  showMsg('vendorMsg', saved ? ('เพิ่ม "'+name+'" แล้ว ✓') : ('เพิ่ม "'+name+'" (offline)'), 'success');
}

async function deleteVendor(id){
  var v = vendorsData.find(function(x){return x.id===id;});
  if(!v) return;
  vendorsData = vendorsData.filter(function(x){return x.id!==id;});
  saveVendorsLocal(); renderVendorList(); fillVendors();
  if(!String(id).startsWith('local-')) await sbDeleteVendor(id);
  showMsg('vendorMsg','ลบ "'+v.name+'" แล้ว','success');
}
