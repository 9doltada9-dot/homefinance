/* HomeFinance · module: vendors.js · v2.5.0 */

function fillVendors(){
  var sel = document.getElementById('fVendor');
  if(!sel) return;
  var prevVal = sel.value; // จำค่าที่เลือกอยู่ก่อน re-render
  var sorted = vendorsData.slice().sort(function(a,b){return (isFavVendor(b.name)?1:0)-(isFavVendor(a.name)?1:0);});
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>'+
    sorted.map(function(v){return '<option value="'+v.id+'">'+(isFavVendor(v.name)?'⭐ ':'')+v.name+'</option>';}).join('');
  // คืนค่าเดิมถ้ายังมีอยู่ใน list มิฉะนั้นเลือก fav แรก
  if(prevVal && vendorsData.find(function(v){return v.id===prevVal;})){
    sel.value = prevVal;
  } else {
    var fav = sorted.find(function(v){return isFavVendor(v.name);});
    if(fav) sel.value = fav.id;
  }
  // star button — อัปเดต icon + onclick โดยไม่ให้กระทบ selection
  var btn = document.getElementById('fVendorStar');
  function updateVendorStar(){
    var curId = sel.value;
    var n = (vendorsData.find(function(v){return v.id===curId;})||{}).name||'';
    if(!btn) return;
    btn.textContent = isFavVendor(n) ? '⭐' : '☆';
    btn.onclick = function(){
      if(!n) return;
      // toggle fav แบบ inline — ไม่เรียก fillVendors() ผ่าน toggleFavVendor
      var f = getFavs();
      if(!f.vendor) f.vendor={};
      f.vendor[n] = !f.vendor[n];
      saveFavs(f);
      btn.textContent = isFavVendor(n) ? '⭐' : '☆';
      // อัปเดต label ใน dropdown เฉพาะตัวที่เปลี่ยน โดยไม่เปลี่ยน selection
      var opts = sel.options;
      for(var i=0;i<opts.length;i++){
        var v2 = vendorsData.find(function(v){return v.id===opts[i].value;});
        if(v2) opts[i].text = (isFavVendor(v2.name)?'⭐ ':'')+v2.name;
      }
    };
  }
  updateVendorStar();
  sel.onchange = updateVendorStar;
}

function renderVendorList(){
  var el = document.getElementById('vendorList');
  if(!el) return;
  el.innerHTML = vendorsData.length
    ? vendorsData.map(function(v){return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">'+
          '<span style="font-size:14px;color:var(--ink)">'+v.name+'</span>'+
          '<button onclick="deleteVendor(\''+v.id+'\')" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px">×</button>'+
        '</div>';}).join('')
    : '<div style="font-size:13px;color:var(--ink3);padding:8px 0">ยังไม่มีร้านค้า</div>';
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
