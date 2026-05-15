/* HomeFinance · module: form.js · v3.0.0 */

function initForm(){
  if(!document.getElementById('fDate').value){
    document.getElementById('fDate').value = todayISO();
    updateThaiDate();
  }
  // auto-set person จาก logged-in user
  var pSel = document.getElementById('fPerson');
  if(pSel) pSel.value = (typeof getCurrentPerson==='function') ? getCurrentPerson() : 'A';
  setType('expense');
  updatePersonLabels();
  renderNoteHistory();
  fillVendors();
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
  var btnTr = document.getElementById('btnTransfer');
  if(btnTr) btnTr.className = 'type-btn' + (t==='transfer'?' active-transfer':'');
  document.getElementById('splitSection').style.display = t==='expense'?'block':'none';
  var fCatRow = document.getElementById('fCatRow');
  if(fCatRow) fCatRow.style.display = t==='transfer'?'none':'';
  updateStatusOptions();
  fillCats();
  updateThaiDate(); // refresh salary cycle warning
}

function updateStatusOptions(){
  var sel = document.getElementById('fStatus');
  if(!sel) return;
  if(cType==='income'){
    sel.innerHTML = '<option value="received">รับแล้ว</option><option value="pending">รอรับ</option>';
  } else if(cType==='transfer'){
    sel.innerHTML = '<option value="paid">โอนแล้ว</option><option value="pending">รอโอน</option>';
  } else {
    sel.innerHTML = '<option value="paid">จ่ายแล้ว</option><option value="pending">รอจ่าย</option>';
  }
  sel.value = doneStatus(cType);
}

function updateThaiDate(){
  var v = document.getElementById('fDate')?.value;
  var el = document.getElementById('fDateThai');
  if(el) el.textContent = v ? toThaiDateStr(v) : '';
  // v3: update billing month suggestion when date changes
  if(typeof updateBillingMonthSelector === 'function'){
    var catName = '';
    var catSel = document.getElementById('fCat');
    if(catSel) { var catObj = catMap[catSel.value]; catName = catObj ? catObj.name : ''; }
    updateBillingMonthSelector(v, catName);
  }
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
  // v3: re-suggest billing_month when category changes
  if(typeof updateBillingMonthSelector === 'function'){
    var date = (document.getElementById('fDate')||{}).value || '';
    var cat  = catMap[catId]; var catName = cat ? cat.name : '';
    updateBillingMonthSelector(date, catName);
  }
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

// ─── SPLIT TYPE (v3.6) ───────────────────────────────────
// splitType: 'personal' | 'equal' | 'ratio' | 'custom'
var splitType = 'personal';
var splitMembers = [];   // สำหรับ custom
var splitRatios  = {};   // สำหรับ ratio {personId: percent}

function setSplitType(type) {
  splitType = type;
  splitOn   = (type !== 'personal');
  // update button styles
  ['personal','equal','ratio','custom'].forEach(function(t) {
    var btn = document.getElementById('stBtn-' + t);
    if (!btn) return;
    var active = (t === type);
    btn.style.background   = active ? 'var(--blue)'     : 'var(--surface2)';
    btn.style.color        = active ? '#fff'             : 'var(--ink2)';
    btn.style.borderColor  = active ? 'var(--blue)'     : 'var(--line)';
  });
  var ratioRow  = document.getElementById('splitRatioRow');
  var customRow = document.getElementById('splitCustomRow');
  var desc      = document.getElementById('splitDesc');
  if (ratioRow)  ratioRow.style.display  = (type === 'ratio')  ? 'flex'  : 'none';
  if (customRow) customRow.style.display = (type === 'custom') ? 'flex'  : 'none';
  if (type === 'personal') {
    if (desc) desc.textContent = 'ค่าใช้จ่ายส่วนตัว ไม่นำมาหาร';
  } else if (type === 'equal') {
    var n = (typeof persons !== 'undefined') ? persons.length : 2;
    if (desc) desc.textContent = 'หารเท่ากันทุกคน (คนละ ' + (100/n).toFixed(0) + '%)';
  } else if (type === 'ratio') {
    _buildRatioUI();
    _updateRatioDesc();
  } else if (type === 'custom') {
    _buildCustomUI();
    if (desc) desc.textContent = 'เลือกคนที่ร่วมจ่ายค่าใช้จ่ายนี้';
  }
}

function _buildRatioUI() {
  var row = document.getElementById('splitRatioRow');
  if (!row || typeof persons === 'undefined') return;
  if (row.dataset.built === 'true') return;  // สร้างครั้งเดียว
  var n = persons.length;
  var defaultPct = Math.floor(100 / n);
  var leftover   = 100 - (defaultPct * (n - 1));
  row.innerHTML = persons.map(function(p, i) {
    var pct = (i === n - 1) ? leftover : defaultPct;
    if (!splitRatios[p.id]) splitRatios[p.id] = pct;
    return '<div style="display:flex;align-items:center;gap:4px;flex:1;min-width:80px">' +
      '<span style="font-size:12px;font-weight:600;color:var(--ink2)">' + p.name + '</span>' +
      '<input type="number" id="ratio-' + p.id + '" value="' + pct + '" min="0" max="100"' +
      ' onchange="_onRatioChange()" oninput="_onRatioChange()"' +
      ' style="width:52px;padding:4px 6px;border:1.5px solid var(--line);border-radius:6px;font-size:13px;font-family:monospace;text-align:center">' +
      '<span style="font-size:12px;color:var(--ink3)">%</span>' +
      '</div>';
  }).join('');
  row.dataset.built = 'true';
  _updateRatioDesc();
}

function _onRatioChange() {
  if (typeof persons === 'undefined') return;
  persons.forEach(function(p) {
    var inp = document.getElementById('ratio-' + p.id);
    splitRatios[p.id] = inp ? (parseFloat(inp.value) || 0) : 0;
  });
  _updateRatioDesc();
}

function _updateRatioDesc() {
  var desc = document.getElementById('splitDesc');
  if (!desc || typeof persons === 'undefined') return;
  var total = persons.reduce(function(s, p) {
    return s + (parseFloat(splitRatios[p.id]) || 0);
  }, 0);
  var parts = persons.map(function(p) {
    return p.name + ' ' + (splitRatios[p.id] || 0) + '%';
  }).join(' / ');
  desc.textContent = 'ตามสัดส่วน: ' + parts + (total !== 100 ? ' (รวม ' + total + '%)' : '');
  desc.style.color = (total !== 100) ? 'var(--amber)' : 'var(--ink3)';
}

function _buildCustomUI() {
  var row = document.getElementById('splitCustomRow');
  if (!row || typeof persons === 'undefined') return;
  if (row.dataset.built === 'true') return;
  row.innerHTML = persons.map(function(p) {
    var checked = (splitMembers.length === 0 || splitMembers.indexOf(p.id) !== -1);
    return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:500">' +
      '<input type="checkbox" id="custom-' + p.id + '"' + (checked ? ' checked' : '') +
      ' onchange="_onCustomChange()"' +
      ' style="width:16px;height:16px;cursor:pointer">' +
      p.name + '</label>';
  }).join('');
  row.dataset.built = 'true';
  _onCustomChange();
}

function _onCustomChange() {
  if (typeof persons === 'undefined') return;
  splitMembers = persons.filter(function(p) {
    var el = document.getElementById('custom-' + p.id);
    return el && el.checked;
  }).map(function(p) { return p.id; });
  var desc = document.getElementById('splitDesc');
  if (desc) {
    if (!splitMembers.length) {
      desc.textContent = '⚠️ กรุณาเลือกอย่างน้อย 1 คน';
      desc.style.color = 'var(--red)';
    } else {
      var names = persons.filter(function(p){ return splitMembers.indexOf(p.id)!==-1; }).map(function(p){return p.name;});
      var n = splitMembers.length;
      desc.textContent = 'แบ่งเท่ากัน: ' + names.join(', ') + ' (คนละ ' + (100/n).toFixed(0) + '%)';
      desc.style.color = 'var(--ink3)';
    }
  }
}

function autoSplit() {
  if (cType !== 'expense') return;
  var catId = document.getElementById('fCat')?.value;
  if (!catId) return;
  var cat = catMap[catId];
  var shouldSplit = cat ? cat.split_default : false;
  setSplitType(shouldSplit ? 'equal' : 'personal');
}

function addEntry(){
  if(!checkOnlineForAction()) return;
  var date   = document.getElementById('fDate').value;
  var person = document.getElementById('fPerson').value;
  var desc   = (document.getElementById('fDesc')?.value||'').trim();
  var cat_id = cType==='transfer' ? null : document.getElementById('fCat').value;
  var catObj = cat_id ? catMap[cat_id] : null;
  var cat_name = cType==='transfer' ? 'โอนเงิน' : (catObj ? catObj.name : '');
  var amt    = parseFloat(document.getElementById('fAmt').value)||0;
  var status = document.getElementById('fStatus').value || doneStatus(cType);
  var note   = document.getElementById('fNote').value.trim();
  var vendor_id = document.getElementById('fVendor')?.value||null;
  if(!date||!desc||!amt||(cType!=='transfer'&&!cat_id)){
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
    split:cType==='expense'?splitOn:false,
    split_type:cType==='expense'?splitType:'personal',
    split_members:cType==='expense'&&splitType==='custom'?splitMembers.slice():[],
    split_ratios:cType==='expense'&&splitType==='ratio'?Object.assign({},splitRatios):{},
    status:status, note:note, item_id:item_id, vendor_id:vendor_id,
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
