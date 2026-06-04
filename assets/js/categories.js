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
  if(map.recurring_due_notif !== undefined && typeof setRecurringDueNotif === 'function'){
    setRecurringDueNotif(map.recurring_due_notif !== false && map.recurring_due_notif !== 'false');
  }
  // sync favorites จาก DB — ใช้ saveFavsLocal เพื่อไม่ push กลับ
  if(map.favs && typeof map.favs === 'object'){
    var f = map.favs;
    // ล้าง vendor_ctx เก่า (legacy) ออก
    if(f.vendor_ctx) delete f.vendor_ctx;
    if(typeof saveFavsLocal === 'function') saveFavsLocal(f);
  }
  // sync split_groups จาก Supabase → localStorage
  // ป้องกัน: ถ้า Supabase ส่งกลับมาว่าง [] แต่ local ยังมีอยู่ → ให้ local ชนะ (กัน data หาย)
  if(map.split_groups && Array.isArray(map.split_groups)){
    var _localGrps = [];
    try { _localGrps = JSON.parse(localStorage.getItem('hf2_split_groups') || '[]'); } catch(_){}
    // Supabase ชนะเฉพาะเมื่อ: มีกลุ่มอยู่ใน Supabase, หรือ local ก็ว่างเปล่าอยู่แล้ว
    if(map.split_groups.length > 0 || _localGrps.length === 0){
      localStorage.setItem('hf2_split_groups', JSON.stringify(map.split_groups));
    }
  }
  // sync recurring_templates จาก Supabase → localStorage (per-user key)
  if(map.recurring_templates && Array.isArray(map.recurring_templates)){
    var _uid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
    var _rKey = _uid ? 'hf2_recurring_' + _uid : null;
    if(_rKey){
      var _localRec = [];
      try { _localRec = JSON.parse(localStorage.getItem(_rKey) || '[]'); } catch(_){}
      // Supabase ชนะเมื่อมีข้อมูล หรือ local ยังว่างอยู่
      if(map.recurring_templates.length > 0 || _localRec.length === 0){
        localStorage.setItem(_rKey, JSON.stringify(map.recurring_templates));
      }
    }
  }
}

function renderCatList(type){
  var listEl = document.getElementById(type+'CatList');
  if(!listEl) return;
  var catsOfType = categories.filter(function(c){return c.type === type;}).sort(function(a,b){return (a.sort_order||0) - (b.sort_order||0);});
  if(!catsOfType.length){
    listEl.innerHTML = '<div style="padding:12px 16px;color:var(--ink3);font-size:13px">ยังไม่มีหมวด</div>';
    return;
  }
  var _isAdmin = typeof isAdminUser === 'function' && isAdminUser();
  // สีตาม type (เหมือน dashboard รอรับ/รอจ่าย)
  var cardBg   = type==='income' ? 'rgba(251,191,36,.10)' : 'rgba(248,113,113,.10)';
  var cardBord = type==='income' ? 'rgba(251,191,36,.35)' : 'rgba(248,113,113,.35)';
  listEl.innerHTML = '<div class="stg-cat-grid">' + catsOfType.map(function(c){
    var inUse = db.some(function(e){return e.cat_id === c.id;});
    var delBtn = '';
    if (inUse) {
      delBtn = '<button class="stg-cat-card-btn" disabled title="มีรายการใช้อยู่">ใช้อยู่</button>';
    } else if (_isAdmin) {
      delBtn = '<button class="stg-cat-card-btn" onclick="delCat(\''+c.id+'\')" style="color:#f87171" title="ลบ (Admin)">×</button>';
    } else {
      delBtn = '<button class="stg-cat-card-btn" disabled title="เฉพาะ Admin">🔒</button>';
    }
    var sub = type==='expense'
      ? '<div class="stg-cat-card-sub" style="color:'+(c.split_default?'var(--green)':'var(--ink3)')+'">'+
          (c.split_default ? '÷ หาร' : '● ส่วนตัว')+'</div>'
      : '';
    return '<div class="stg-cat-card" style="background:'+cardBg+';border:1px solid '+cardBord+'">'+
      '<div class="stg-cat-card-name">'+c.name+'</div>'+
      sub+
      '<div class="stg-cat-card-actions">'+
        '<button class="stg-cat-card-btn" onclick="editCat(\''+c.id+'\')">✎</button>'+
        delBtn+
      '</div>'+
    '</div>';
  }).join('') + '</div>';
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
  if(!checkOnlineForAction()) return;
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
  // แสดง warning ว่ากระทบทุก user
  var msgEl = document.getElementById('catModalMsg');
  msgEl.className = 'msg msg-error';
  msgEl.textContent = '⚠️ หมวดนี้เป็นข้อมูลร่วม — การลบจะมีผลกับผู้ใช้ทุกคน';
  var btns = overlay.querySelector('div[style*="display:flex;gap"]');
  btns.innerHTML =
    '<button class="btn btn-ghost" onclick="cancelDelCat()" style="flex:1;min-height:44px">ยกเลิก</button>'+
    '<button class="btn" onclick="confirmDelCat(\''+catId+'\',\''+catName+'\',\''+catType+'\')" style="flex:1;min-height:44px;background:var(--red);color:#fff"><svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2l1-1h6l1 1h4v2H2V2h4zm1 4h2v9H7V6zm4 0h2v9h-2V6zM3 5h14l-1 13H4L3 5z"/></svg></button>';
  overlay.style.display = 'flex';
}

async function confirmDelCat(catId, catName, catType){
  if(!checkOnlineForAction()) return;
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
