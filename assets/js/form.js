/* HomeFinance · module: form.js · v3.0.0 */

function initForm(){
  if(!document.getElementById('fDate').value){
    document.getElementById('fDate').value = todayISO();
    updateThaiDate();
  }
  populatePersonSelects();
  var pA=persons.find(function(x){return x.id==='A';}), pB=persons.find(function(x){return x.id==='B';});
  if(pA) document.getElementById('nameA').value=pA.name;
  if(pB) document.getElementById('nameB').value=pB.name;
  setType('expense');
  updatePersonLabels();
  renderNoteHistory();
  fillVendors();
  var pSel = document.getElementById('fPerson');
  if(pSel) pSel.onchange = function(){ fillVendors(); };
  // v3: populate account selector
  if(typeof fillAccountSelectors === 'function') fillAccountSelectors();
  // v3: auto-set billing_month to current month
  var bmSel = document.getElementById('fBillingMonth');
  if(bmSel && !bmSel.value){
    var now = new Date();
    bmSel.value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  }
}

function setType(t){
  cType = t;
  document.getElementById('btnIncome').className = 'type-btn' + (t==='income'?' active-income':'');
  document.getElementById('btnExpense').className = 'type-btn' + (t==='expense'?' active-expense':'');
  document.getElementById('splitSection').style.display = t==='expense'?'block':'none';
  updateStatusOptions();
  fillCats();
  updateThaiDate(); // refresh salary cycle warning
}

function updateStatusOptions(){
  var sel = document.getElementById('fStatus');
  if(!sel) return;
  if(cType==='income'){
    sel.innerHTML = '<option value="received">รับแล้ว</option><option value="pending">รอรับ</option>';
  } else {
    sel.innerHTML = '<option value="paid">จ่ายแล้ว</option><option value="pending">รอจ่าย</option>';
  }
  sel.value = doneStatus(cType);
}

function updateThaiDate(){
  var v = document.getElementById('fDate')?.value;
  var el = document.getElementById('fDateThai');
  if(el) el.textContent = v ? toThaiDateStr(v) : '';
  // salary cycle warning
  var warn = document.getElementById('fDateCycleWarn');
  if(!warn) return;
  if(v && cType==='income' && isEarlySalary({type:'income', date:v})){
    var d = new Date(v);
    var actLabel = SALARY_DAY+' '+SHORT_M[d.getMonth()]+' '+(d.getFullYear()+543);
    warn.innerHTML='⏳ รายรับก่อนวันที่ 25 — จะตั้งเป็น <b>รอรับ</b> อัตโนมัติ และเปลี่ยนเป็น <b>รับแล้ว</b> วันที่ '+actLabel;
    warn.style.display='block';
    // force status to pending in UI
    var fs = document.getElementById('fStatus');
    if(fs){ fs.value='pending'; }
  } else {
    warn.style.display='none';
  }
}

function fillCats(){
  var sel = document.getElementById('fCat');
  if(!sel) return;
  var catsByType = categories.filter(function(c){return c.type === cType;});
  var sorted = catsByType.slice().sort(function(a,b){return (isFavCat(b.id)?1:0)-(isFavCat(a.id)?1:0);});
  sel.innerHTML = sorted.map(function(c){return '<option value="'+c.id+'">'+(isFavCat(c.id)?'⭐ ':'')+c.name+'</option>';}).join('');
  var fav = sorted.find(function(c){return isFavCat(c.id);});
  sel.value = fav ? fav.id : ((sorted[0]||{}).id||'');
  sel.onchange = onCatChange;
  // update star button
  updateCatStar();
  onCatChange();
}

function updateCatStar(){
  var btn = document.getElementById('fCatStar');
  var catId = document.getElementById('fCat')?.value;
  if(btn) btn.textContent = isFavCat(catId) ? '⭐' : '☆';
}

function onCatChange(){
  var catId = document.getElementById('fCat')?.value;
  updateCatStar();
  fillDescByCat(catId);
  autoSplit();
  fillVendors();
}

function fillDescByCat(catId){
  var sel = document.getElementById('fDesc');
  if(!sel) return;
  // only items from items table — no DB history to avoid showing deleted items
  var saved = (itemsData[catId]||[]).map(function(x){return x.name;});
  var sorted = saved.slice().sort(function(a,b){return (isFavItem(b)?1:0)-(isFavItem(a)?1:0);});
  sel.innerHTML = sorted.length
    ? sorted.map(function(d){return '<option value="'+d+'">'+(isFavItem(d)?'⭐ ':'')+d+'</option>';}).join('')
    : '<option value="">-- ยังไม่มีรายการ (เพิ่มที่หน้าตั้งค่า) --</option>';
  var fav = sorted.find(function(d){return isFavItem(d);});
  if(fav) sel.value = fav;
  // update star button
  updateDescStar();
  sel.onchange = updateDescStar;
}

function updateDescStar(){
  var btn = document.getElementById('fDescStar');
  var desc = document.getElementById('fDesc')?.value;
  if(btn) btn.textContent = isFavItem(desc) ? '⭐' : '☆';
}

function autoSplit(){
  if(cType!=='expense') return;
  var catId = document.getElementById('fCat')?.value;
  if(!catId) return;
  var cat = catMap[catId];
  splitOn = cat ? cat.split_default : false;
  updateSplitUI();
}

function toggleSplit(){
  splitOn = !splitOn;
  updateSplitUI();
}

function updateSplitUI(){
  var t = document.getElementById('splitToggle');
  var d = document.getElementById('splitDesc');
  if(splitOn){ t.classList.add('on'); d.textContent='แบ่งค่าใช้จ่ายส่วนกลางเท่ากัน (คนละครึ่ง)'; }
  else { t.classList.remove('on'); d.textContent='ค่าใช้จ่ายส่วนตัว ไม่นำมาหาร'; }
}

function addEntry(){
  if(!checkOnlineForAction()) return;
  var date   = document.getElementById('fDate').value;
  var person = document.getElementById('fPerson').value;
  var desc   = (document.getElementById('fDesc')?.value||'').trim();
  var cat_id = document.getElementById('fCat').value;
  var catObj = catMap[cat_id];
  var cat_name = catObj ? catObj.name : '';
  var amt    = parseFloat(document.getElementById('fAmt').value)||0;
  var status = document.getElementById('fStatus').value || doneStatus(cType);
  var note   = document.getElementById('fNote').value.trim();
  var vendor_id = document.getElementById('fVendor')?.value||null;
  if(!date||!desc||!amt||!cat_id){
    showMsg('formMsg','กรุณากรอกวันที่ รายการ หมวด และจำนวนเงิน','error'); return;
  }
  var itemObj = (itemsData[cat_id]||[]).find(function(x){return x.name===desc;});
  var item_id = (itemObj && itemObj.id)||null;

  // v3: billing_month and account_id
  var billing_month = (document.getElementById('fBillingMonth')||{}).value || null;
  var account_id    = (document.getElementById('fAccount')||{}).value    || null;

  // v3: compute cycle_id from date
  var cycle_id = (typeof cycleIdFromDate === 'function') ? cycleIdFromDate(date) : null;

  // v3: auto-suggest billing_month for utility categories if not set
  if(!billing_month && cType==='expense' && typeof suggestBillingMonth === 'function'){
    billing_month = suggestBillingMonth(date, cat_name) || (date ? date.slice(0,7) : null);
  }
  if(!billing_month && date) billing_month = date.slice(0,7);

  // ── SALARY CYCLE: auto-pending if income before 25th ──────
  var _salary_cycle = null;
  if(cType==='income' && isEarlySalary({type:cType, date:date})){
    status = 'pending';
    var d = new Date(date);
    _salary_cycle = toISO(new Date(d.getFullYear(), d.getMonth(), SALARY_DAY));
    var actLabel = SALARY_DAY+' '+SHORT_M[d.getMonth()]+' '+(d.getFullYear()+543);
    showCycleToast('⏳ รายรับก่อนวันที่ 25 — จะเป็น "รับแล้ว" อัตโนมัติวันที่ '+actLabel);
  }

  db.unshift({id:Date.now(), date:date, type:cType, cat_id:cat_id, cat_name:cat_name, desc:desc, amt:amt, person:person,
    split:cType==='expense'?splitOn:false, status:status, note:note, item_id:item_id, vendor_id:vendor_id,
    _salary_cycle:_salary_cycle,
    cycle_id:cycle_id, billing_month:billing_month, account_id:account_id||null});
  save();
  addNoteHistory(note);
  sbAdd(db[0]);
  showMsg('formMsg','บันทึกเรียบร้อย!','success');
  setTimeout(function(){ document.getElementById('formMsg').className='msg'; clearForm(); }, 1500);
}

function clearForm(){
  document.getElementById('fDesc').value='';
  document.getElementById('fAmt').value='';
  document.getElementById('fNote').value='';
  // reset billing_month back to current month
  var bmSel = document.getElementById('fBillingMonth');
  if(bmSel){
    var now = new Date();
    bmSel.value = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  }
  var acctSel = document.getElementById('fAccount');
  if(acctSel) acctSel.value = '';
}
