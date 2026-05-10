/* HomeFinance · module: vendors.js · v2.9.1 */

// fillVendors(personId, catId) — เรียง: ctx-fav → global-fav → ปกติ
function fillVendors(personId, catId){
  var sel = document.getElementById('fVendor');
  if(!sel) return;
  var prevVal = sel.value;

  // รับ context จาก form ถ้าไม่ได้ส่งมา
  if(!personId) personId = document.getElementById('fPerson')?.value || '';
  if(!catId)    catId    = document.getElementById('fCat')?.value    || '';

  var sorted = vendorsData.slice().sort(function(a,b){
    var aCtx = isFavVendorCtx(personId, catId, a.name) ? 2 : (isFavVendor(a.name) ? 1 : 0);
    var bCtx = isFavVendorCtx(personId, catId, b.name) ? 2 : (isFavVendor(b.name) ? 1 : 0);
    return bCtx - aCtx;
  });

  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>'+
    sorted.map(function(v){
      var isCtx = isFavVendorCtx(personId, catId, v.name);
      var isGlb = isFavVendor(v.name);
      var icon  = isCtx ? '⭐ ' : (isGlb ? '☆ ' : '');
      return '<option value="'+v.id+'">'+icon+v.name+'</option>';
    }).join('');

  // คืนค่าเดิมถ้ายังมี มิฉะนั้น auto-select ctx-fav แรก
  if(prevVal && vendorsData.find(function(v){return v.id===prevVal;})){
    sel.value = prevVal;
  } else {
    var firstCtx = sorted.find(function(v){return isFavVendorCtx(personId,catId,v.name);});
    var firstGlb = sorted.find(function(v){return isFavVendor(v.name);});
    var auto = firstCtx || firstGlb;
    if(auto) sel.value = auto.id;
  }

  // star button — inline toggle ไม่ reset selection
  var btn = document.getElementById('fVendorStar');
  _bindVendorStar(sel, btn, personId, catId);
  sel.onchange = function(){ _bindVendorStar(sel, btn, personId, catId); };
}

function _bindVendorStar(sel, btn, personId, catId){
  if(!btn) return;
  var curId = sel.value;
  var n = (vendorsData.find(function(v){return v.id===curId;})||{}).name||'';
  var isCtx = n && isFavVendorCtx(personId, catId, n);
  var isGlb = n && isFavVendor(n);
  btn.textContent = isCtx ? '⭐' : (isGlb ? '★' : '☆');
  btn.title = isCtx ? 'เป็น fav ของ context นี้' : (isGlb ? 'เป็น fav ทั่วไป' : 'ตั้ง favorite');
  btn.onclick = function(){
    if(!n) return;
    if(personId && catId){
      // toggle context fav
      toggleFavVendorCtx(personId, catId, n);
    } else {
      // toggle global fav
      var f=getFavs(); if(!f.vendor) f.vendor={};
      f.vendor[n]=!f.vendor[n]; saveFavs(f);
    }
    // อัปเดต icon + label ใน dropdown โดยไม่เปลี่ยน selection
    _rebuildVendorOptions(sel, personId, catId);
    var isCtxNow = n && isFavVendorCtx(personId, catId, n);
    var isGlbNow = n && isFavVendor(n);
    btn.textContent = isCtxNow ? '⭐' : (isGlbNow ? '★' : '☆');
  };
}

function _rebuildVendorOptions(sel, personId, catId){
  var curId = sel.value;
  var sorted = vendorsData.slice().sort(function(a,b){
    var aS = isFavVendorCtx(personId,catId,a.name)?2:(isFavVendor(a.name)?1:0);
    var bS = isFavVendorCtx(personId,catId,b.name)?2:(isFavVendor(b.name)?1:0);
    return bS-aS;
  });
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>'+
    sorted.map(function(v){
      var icon = isFavVendorCtx(personId,catId,v.name)?'⭐ ':(isFavVendor(v.name)?'★ ':'');
      return '<option value="'+v.id+'">'+icon+v.name+'</option>';
    }).join('');
  sel.value = curId;
}

// fillEditVendors — สำหรับ editOverlay (ใช้ ePerson + eCat)
function fillEditVendors(){
  var sel = document.getElementById('eVendor');
  if(!sel) return;
  var personId = document.getElementById('ePerson')?.value||'';
  var catId    = document.getElementById('eCat')?.value||'';
  var prevVal  = sel.value;
  var sorted = vendorsData.slice().sort(function(a,b){
    var aS = isFavVendorCtx(personId,catId,a.name)?2:(isFavVendor(a.name)?1:0);
    var bS = isFavVendorCtx(personId,catId,b.name)?2:(isFavVendor(b.name)?1:0);
    return bS-aS;
  });
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>'+
    sorted.map(function(v){
      var icon = isFavVendorCtx(personId,catId,v.name)?'⭐ ':(isFavVendor(v.name)?'★ ':'');
      return '<option value="'+v.id+'">'+icon+v.name+'</option>';
    }).join('');
  if(prevVal) sel.value = prevVal;
  var btn = document.getElementById('eVendorStar');
  _bindVendorStar(sel, btn, personId, catId);
  sel.onchange = function(){ _bindVendorStar(sel, btn, personId, catId); };
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
  var row = document.getElementById('vrow-'+id);
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
