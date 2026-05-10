/* HomeFinance · module: categories.js · v2.5.0 */

function buildCategoryMap(){
  Object.keys(catMap).forEach(function(k){ delete catMap[k]; });
  categories.forEach(function(c){
    catMap[c.id] = { name: c.name, type: c.type, group: c.group, split_default: c.split_default };
  });
}

function applySettingsFromMap(map){
  if(!map) return;
  if(map.persons)      { persons = map.persons; savePersons(persons); }
  if(map.income_cats)  { cats.income.length=0;  map.income_cats.forEach(function(c){cats.income.push(c);});   localStorage.setItem('hf2_income_cats', JSON.stringify(cats.income)); }
  if(map.expense_cats) { cats.expense.length=0; map.expense_cats.forEach(function(c){cats.expense.push(c);}); localStorage.setItem('hf2_expense_cats',JSON.stringify(cats.expense)); }
  if(map.no_split)     { NO_SPLIT = map.no_split; localStorage.setItem('hf2_no_split',JSON.stringify(NO_SPLIT)); }
  if(map.viewmode)     { viewMode = map.viewmode; localStorage.setItem('hf2_viewmode', viewMode); }
}

function renderCatList(type){
  var listEl = document.getElementById(type+'CatList');
  if(!listEl) return;
  var catsOfType = categories.filter(function(c){return c.type === type;}).sort(function(a,b){return (a.sort_order||0) - (b.sort_order||0);});
  if(!catsOfType.length){
    listEl.innerHTML = '<div style="padding:12px 16px;color:var(--ink3);font-size:13px">ยังไม่มีหมวด</div>';
    return;
  }
  listEl.innerHTML = catsOfType.map(function(c){
    var inUse = db.some(function(e){return e.cat_id === c.id;});
    return '<div class="settings-row">'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-weight:500;color:var(--ink)">'+c.name+'</div>'+
        (type==='expense' ? '<div style="font-size:12px;margin-top:2px;color:'+(c.split_default?'var(--green)':'var(--ink3)')+'">'+
          (c.split_default ? '÷ หาร 2 อัตโนมัติ' : '● ไม่หาร 2')+
        '</div>' : '')+
      '</div>'+
      '<div class="settings-row-right" style="gap:6px">'+
        '<button class="btn btn-sm" onclick="editCat(\''+c.id+'\')" style="min-width:36px;min-height:36px;padding:4px;font-size:14px">✎</button>'+
        (!inUse ? '<button class="btn btn-sm" onclick="delCat(\''+c.id+'\')" style="min-width:36px;min-height:36px;padding:4px;font-size:14px;color:var(--red);border-color:var(--red)">×</button>' : '<button class="btn btn-sm" disabled style="min-width:36px;min-height:36px;padding:4px;font-size:11px;opacity:.4">ใช้อยู่</button>')+
      '</div>'+
    '</div>';
  }).join('');
}

// ─── CAT MODAL ────────────────────────────────────────────
var _catModalType = 'income';
var _catModalEditId = null;

function showAddCatDialog(type){
  _catModalType = type;
  _catModalEditId = null;
  document.getElementById('catModalTitle').textContent = 'เพิ่มหมวด'+(type==='income'?'รายรับ':'รายจ่าย');
  document.getElementById('catModalName').value = '';
  document.getElementById('catModalSplit').checked = false;
  document.getElementById('catModalSplitRow').style.display = type==='expense' ? 'block' : 'none';
  document.getElementById('catModalMsg').className = 'msg';
  document.getElementById('catOverlay').style.display = 'flex';
  setTimeout(function(){ document.getElementById('catModalName').focus(); }, 100);
}

function editCat(catId){
  var cat = categories.find(function(c){return c.id === catId;});
  if(!cat) return;
  _catModalType = cat.type;
  _catModalEditId = catId;
  document.getElementById('catModalTitle').textContent = 'แก้ไขหมวด';
  document.getElementById('catModalName').value = cat.name;
  document.getElementById('catModalSplit').checked = cat.split_default || false;
  document.getElementById('catModalSplitRow').style.display = cat.type==='expense' ? 'block' : 'none';
  document.getElementById('catModalMsg').className = 'msg';
  document.getElementById('catOverlay').style.display = 'flex';
  setTimeout(function(){ document.getElementById('catModalName').focus(); }, 100);
}

function closeCatModal(){
  document.getElementById('catOverlay').style.display = 'none';
  _catModalEditId = null;
}

async function saveCatModal(){
  var name = document.getElementById('catModalName').value.trim();
  if(!name){ showMsg('catModalMsg','กรุณาใส่ชื่อหมวด','error'); return; }
  var split = _catModalType==='expense' ? document.getElementById('catModalSplit').checked : false;
  var btn = document.querySelector('#catOverlay .btn-primary');
  btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;

  if(_catModalEditId){
    // edit
    var cat = categories.find(function(c){return c.id === _catModalEditId;});
    if(cat){
      cat.name = name;
      cat.split_default = split;
      await sbUpdateCategory(cat);
      buildCategoryMap();
      renderCatList(cat.type);
      showMsg('settingsMsg', 'แก้ไขหมวด "'+name+'" แล้ว', 'success');
    }
  } else {
    // add — let DB generate UUID
    var payload = {
      name: name,
      type: _catModalType,
      split_default: split,
      sort_order: Math.max.apply(null, [0].concat(categories.filter(function(c){return c.type===_catModalType;}).map(function(c){return c.sort_order||0;}))) + 1
    };
    var saved = await sbAddCategory(payload);
    if(!saved){
      showMsg('catModalMsg', 'บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่อ Supabase', 'error');
      btn.textContent = 'บันทึก'; btn.disabled = false;
      return;
    }
    categories.push(saved); // use row with real DB uuid
    buildCategoryMap();
    renderCatList(_catModalType);
    showMsg('settingsMsg', 'เพิ่มหมวด "'+name+'" แล้ว', 'success');
  }

  btn.textContent = 'บันทึก'; btn.disabled = false;
  closeCatModal();
}

function delCat(catId){
  var cat = categories.find(function(c){return c.id === catId;});
  if(!cat) return;
  var inUse = db.some(function(e){return e.cat_id === catId;});
  if(inUse){
    showMsg('settingsMsg', 'ไม่สามารถลบได้ มีรายการใช้หมวด "'+cat.name+'" อยู่', 'error');
    return;
  }
  // ใช้ custom confirm แทน browser confirm
  showDelCatConfirm(catId, cat.name, cat.type);
}

function showDelCatConfirm(catId, catName, catType){
  var overlay = document.getElementById('catOverlay');
  _catModalEditId = catId;
  _catModalType = catType;
  document.getElementById('catModalTitle').textContent = 'ลบหมวด "'+catName+'"?';
  document.getElementById('catModalName').style.display = 'none';
  document.getElementById('catModalSplitRow').style.display = 'none';
  document.getElementById('catModalMsg').className = 'msg';
  var btns = overlay.querySelector('div[style*="display:flex;gap"]');
  btns.innerHTML =
    '<button class="btn btn-ghost" onclick="cancelDelCat()" style="flex:1;min-height:44px">ยกเลิก</button>'+
    '<button class="btn" onclick="confirmDelCat(\''+catId+'\',\''+catName+'\',\''+catType+'\')" style="flex:1;min-height:44px;background:var(--red);color:#fff">ลบ</button>';
  overlay.style.display = 'flex';
}

async function confirmDelCat(catId, catName, catType){
  await sbDeleteCategory(catId);
  categories = categories.filter(function(c){return c.id !== catId;});
  buildCategoryMap();
  // restore modal buttons for next use
  var btns = document.getElementById('catOverlay').querySelector('div[style*="display:flex;gap"]');
  btns.innerHTML =
    '<button class="btn btn-ghost" onclick="closeCatModal()" style="flex:1;min-height:44px">ยกเลิก</button>'+
    '<button class="btn btn-primary" onclick="saveCatModal()" style="flex:1;min-height:44px">บันทึก</button>';
  document.getElementById('catModalName').style.display = '';
  closeCatModal();
  renderCatList(catType);
  showMsg('settingsMsg', 'ลบหมวด "'+catName+'" แล้ว', 'success');
}

function cancelDelCat(){
  var btns = document.getElementById('catOverlay').querySelector('div[style*="display:flex;gap"]');
  btns.innerHTML =
    '<button class="btn btn-ghost" onclick="closeCatModal()" style="flex:1;min-height:44px">ยกเลิก</button>'+
    '<button class="btn btn-primary" onclick="saveCatModal()" style="flex:1;min-height:44px">บันทึก</button>';
  document.getElementById('catModalName').style.display = '';
  document.getElementById('catModalSplitRow').style.display = _catModalType==='expense'?'block':'none';
  closeCatModal();
}
