/* HomeFinance · module: edit.js · v3.0.0 */

// ─── EDIT MODAL ──────────────────────────────────────────
var editId = null;
var eSplitOn = false;
var eType = 'expense';

function openEdit(id){
  var sid=String(id);
  var e = db.find(function(x){return String(x.id)===sid;});
  if(!e) return;
  editId = id;
  eType = e.type;
  eSplitOn = e.split;
  document.getElementById('editOverlay').style.display='flex';
  document.getElementById('editIdLabel').textContent='รายการ: '+e.desc;
  document.getElementById('eDate').value = e.date;
  populatePersonSelects();
  document.getElementById('ePerson').value = e.person;
  document.getElementById('eAmt').value = e.amt;
  document.getElementById('eStatus').value = e.status;
  document.getElementById('eNote').value = e.note||'';
  // populate vendors (with smart sort via fillEditVendors)
  fillEditVendors();
  if(e.vendor_id) document.getElementById('eVendor').value = e.vendor_id;
  // v3: billing_month + account
  var eBM = document.getElementById('eBillingMonth');
  if(eBM) eBM.value = e.billing_month || (e.date ? e.date.slice(0,7) : '');
  if(typeof fillAccountSelectors === 'function') fillAccountSelectors();
  var eAcct = document.getElementById('eAccount');
  if(eAcct && e.account_id) eAcct.value = e.account_id;
  eSetType(e.type, false);
  setTimeout(function(){
    var catVal = e.cat_id || ((categories.find(function(c){return c.name === e.cat_name;})||{}).id) || '';
    document.getElementById('eCat').value = catVal;
    eUpdateDescByCat(catVal);
    var dSel = document.getElementById('eDesc');
    if(dSel && e.desc){
      var exists = [].slice.call(dSel.options).some(function(o){return o.value===e.desc;});
      if(!exists){
        var opt = document.createElement('option');
        opt.value=e.desc; opt.textContent=e.desc;
        dSel.prepend(opt);
      }
      dSel.value = e.desc;
    }
    eSplitOn = e.split;
    updateESplitUI();
  },10);
}

function closeEdit(){
  document.getElementById('editOverlay').style.display='none';
  editId=null;
}

function eUpdateDescByCat(catId){
  var sel = document.getElementById('eDesc');
  if(!sel) return;
  // only items from items table — no DB history
  var saved = (itemsData[catId]||[]).map(function(x){return x.name;});
  var cur = sel.value;
  sel.innerHTML = saved.length
    ? saved.map(function(d){return '<option value="'+d+'">'+(isFavItem(d)?'⭐ ':'')+d+'</option>';}).join('')
    : '<option value="">-- ยังไม่มีรายการ --</option>';
  if(cur && saved.indexOf(cur)>-1) sel.value = cur;
}

function eSetType(t, autoS){
  if(autoS===undefined) autoS = true;
  eType = t;
  document.getElementById('eBtnIncome').className = 'type-btn'+(t==='income'?' active-income':'');
  document.getElementById('eBtnExpense').className = 'type-btn'+(t==='expense'?' active-expense':'');
  document.getElementById('eSplitSection').style.display = t==='expense'?'block':'none';
  // update status options
  var eStat = document.getElementById('eStatus');
  if(eStat){
    var cur = eStat.value;
    eStat.innerHTML = t==='income'
      ? '<option value="pending">รอรับ</option><option value="received">รับแล้ว</option>'
      : '<option value="pending">รอจ่าย</option><option value="paid">จ่ายแล้ว</option>';
    eStat.value = cur && eStat.querySelector('option[value="'+cur+'"]') ? cur : doneStatus(t);
  }
  var sel = document.getElementById('eCat');
  var catsByType = categories.filter(function(c){return c.type === t;});
  sel.innerHTML = catsByType.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  if(autoS && catsByType.length>0){
    sel.value = catsByType[0].id;
    var cat = catMap[sel.value];
    eSplitOn = t==='expense' && (cat ? cat.split_default : false);
    updateESplitUI();
  }
  sel.onchange = function(){
    if(t==='expense'){
      var cat2 = catMap[sel.value];
      eSplitOn = cat2 ? cat2.split_default : false;
      updateESplitUI();
    }
    // update eDesc based on category
    eUpdateDescByCat(sel.value);
  };
}

function eToggleSplit(){ eSplitOn=!eSplitOn; updateESplitUI(); }

function updateESplitUI(){
  var t=document.getElementById('eSplitToggle');
  var d=document.getElementById('eSplitDesc');
  if(eSplitOn){t.classList.add('on');d.textContent='แบ่งค่าใช้จ่ายส่วนกลางเท่ากัน (คนละครึ่ง)';}
  else{t.classList.remove('on');d.textContent='ค่าใช้จ่ายส่วนตัว ไม่นำมาหาร';}
}

function saveEdit(){
  if(!checkOnlineForAction()) return;
  var e = db.find(function(x){return String(x.id)===String(editId);});
  if(!e){ closeEdit(); return; }
  var date=document.getElementById('eDate').value;
  var desc=document.getElementById('eDesc').value.trim();
  var amt=parseFloat(document.getElementById('eAmt').value)||0;
  if(!date||!desc||!amt){ showMsg('editMsg','กรุณากรอกวันที่ รายการ และจำนวนเงิน','error'); return; }
  var cat_id = document.getElementById('eCat').value;
  var catObj = catMap[cat_id];
  var cat_name = catObj ? catObj.name : '';
  var itemObj = (itemsData[cat_id]||[]).find(function(x){return x.name===desc;});
  e.date=date; e.type=eType; e.cat_id=cat_id; e.cat_name=cat_name;
  e.desc=desc; e.amt=amt; e.person=document.getElementById('ePerson').value;
  e.split=eType==='expense'?eSplitOn:false;
  e.status=document.getElementById('eStatus').value || doneStatus(eType);
  e.note=document.getElementById('eNote').value.trim();
  e.item_id=(itemObj && itemObj.id)||e.item_id||null;
  e.vendor_id=document.getElementById('eVendor').value||null;
  // v3: update cycle_id, billing_month, account_id
  e.cycle_id = (typeof cycleIdFromDate === 'function') ? cycleIdFromDate(date) : e.cycle_id || null;
  e.billing_month = (document.getElementById('eBillingMonth')||{}).value || date.slice(0,7);
  e.account_id    = (document.getElementById('eAccount')||{}).value || null;
  save();
  sbUpdate(e);
  showMsg('editMsg','บันทึกการแก้ไขแล้ว','success');
  setTimeout(function(){ closeEdit(); renderTx(); renderDash(); },800);
}
