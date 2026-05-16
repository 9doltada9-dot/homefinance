/* HomeFinance · module: recurringEngine.js · v3.0.0
 * Recurring transaction engine — replaces the prompt()-based UI in features.js.
 * Uses a proper modal form + supports billing_month + cycle_id.
 *
 * Template schema:
 *   { id, type, cat_id, cat_name, desc, amt, person, split, status, note,
 *     vendor_id, item_id, day_of_month, billing_month_offset,
 *     last_run_yyyymm, account_id }
 *
 * billing_month_offset: -1 = prev month, 0 = same month (default)
 */

// ─── STORAGE ──────────────────────────────────────────────
function getRecurringList() {
  try { return JSON.parse(localStorage.getItem('hf2_recurring') || '[]'); }
  catch(_) { return []; }
}
function saveRecurringList(list) {
  localStorage.setItem('hf2_recurring', JSON.stringify(list));
}

// ─── CRUD ─────────────────────────────────────────────────
function addRecurring(template) {
  var list = getRecurringList();
  template.id = 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  template.last_run_yyyymm = '';
  list.push(template);
  saveRecurringList(list);
  return template.id;
}

function updateRecurring(id, fields) {
  var list = getRecurringList();
  var t = list.find(function(x) { return x.id === id; });
  if (t) Object.assign(t, fields);
  saveRecurringList(list);
}

function deleteRecurring(id) {
  saveRecurringList(getRecurringList().filter(function(t) { return t.id !== id; }));
}

// ─── PROCESS (generate entries) ───────────────────────────
/**
 * Run on startup + every hour.
 * For each template not yet run this month:
 *   - Check if today >= day_of_month
 *   - Create a transaction with proper cycle_id + billing_month
 */
function processRecurring() {
  if (typeof db === 'undefined') return 0;
  var today    = new Date();
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var todayDay = today.getDate();
  var list     = getRecurringList();
  var created  = 0;
  var changed  = false;

  list.forEach(function(t) {
    if (t.last_run_yyyymm === yyyymm) return;
    var dueDay = t.day_of_month || 1;
    if (todayDay < dueDay) return;

    // Build transaction date
    var entryDateStr = yyyymm + '-' + String(dueDay).padStart(2, '0');

    // billing_month: offset from transaction month
    var offset = t.billing_month_offset || 0; // -1 = prev month
    var bm;
    if (offset === -1) {
      var prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      bm = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    } else {
      bm = yyyymm;
    }

    var newEntry = {
      id:             'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      date:           entryDateStr,
      type:           t.type || 'expense',
      cat_id:         t.cat_id || null,
      cat_name:       t.cat_name || '',
      desc:           t.desc || '',
      amt:            Number(t.amt) || 0,
      person:         t.person || (typeof getCurrentPerson==='function' ? getCurrentPerson() : null),
      split:          !!t.split,
      status:         t.status || (t.type === 'income' ? 'received' : 'paid'),
      note:           (t.note || '') + ' [auto]',
      vendor_id:      t.vendor_id || null,
      item_id:        t.item_id || null,
      account_id:     t.account_id || null,
      cycle_id:       cycleIdFromDate(entryDateStr),
      billing_month:  bm,
      _recurring_id:  t.id,
    };

    db.push(newEntry);
    if (typeof save === 'function') save();
    if (typeof sbAdd === 'function') sbAdd(newEntry);
    t.last_run_yyyymm = yyyymm;
    changed = true;
    created++;
  });

  if (changed) saveRecurringList(list);
  return created;
}

// ─── UPCOMING PREVIEW ─────────────────────────────────────
function getUpcomingRecurring(days) {
  days = days || 7;
  var today    = new Date(); today.setHours(0, 0, 0, 0);
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var result   = [];
  var list     = getRecurringList();
  list.forEach(function(t) {
    var dueDay  = t.day_of_month || 1;
    var dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (dueDate < today) {
      // Try next month
      dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
    }
    var diff = Math.round((dueDate - today) / 86400000);
    if (diff <= days) result.push({ template: t, dueDate: dueDate, daysUntil: diff });
  });
  result.sort(function(a, b) { return a.daysUntil - b.daysUntil; });
  return result;
}

// ─── RENDER LIST ──────────────────────────────────────────
function renderRecurringList() {
  var box = document.getElementById('recurringList');
  if (!box) return;
  var _myPerson = (typeof getCurrentPerson === 'function') ? getCurrentPerson() : null;
  var list = getRecurringList().filter(function(t) {
    return !_myPerson || t.person === _myPerson;
  });
  if (!list.length) {
    box.innerHTML = '<div class="empty">ยังไม่มีรายการประจำ</div>';
    return;
  }
  box.innerHTML = list.map(function(t) {
    var typeLbl = t.type === 'income'
      ? '<span class="badge badge-income">รายรับ</span>'
      : '<span class="badge badge-expense">รายจ่าย</span>';
    var offsetLbl = t.billing_month_offset === -1 ? ' · บิลเดือนก่อน' : '';
    var lastRun = t.last_run_yyyymm ? '· เดือนล่าสุด: ' + t.last_run_yyyymm : '· ยังไม่เคยทำงาน';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:500">' + typeLbl + ' ' + (t.cat_name || '') + ' — ' + (t.desc || '(ไม่มีคำอธิบาย)') + '</div>' +
        '<div style="font-size:11px;color:var(--ink3);margin-top:2px">' +
          'วันที่ ' + (t.day_of_month || 1) + ' · ฿' + fmt(t.amt) + ' · ' +
          (typeof nm === 'function' ? nm(t.person) : t.person) + offsetLbl + ' ' + lastRun +
        '</div>' +
      '</div>' +
      '<button onclick="onDeleteRecurring(\'' + t.id + '\')" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;touch-action:manipulation">×</button>' +
    '</div>';
  }).join('');
}

function onDeleteRecurring(id) {
  if (!confirm('ลบรายการประจำนี้?')) return;
  deleteRecurring(id);
  renderRecurringList();
}

// ─── MODAL OPEN/CLOSE ─────────────────────────────────────
function openRecurringModal() {
  var modal = document.getElementById('recurringModal');
  if (!modal) return;

  // Populate category dropdown
  var catSel = document.getElementById('recCat');
  if (catSel) {
    var curType = (document.getElementById('recType') || {}).value || 'expense';
    catSel.innerHTML = (typeof categories !== 'undefined' ? categories : [])
      .filter(function(c) { return c.type === curType; })
      .map(function(c) { return '<option value="' + c.id + '" data-name="' + c.name + '">' + c.name + '</option>'; })
      .join('');
  }

  // Auto-assign person จาก user ที่ login อยู่ (ซ่อน dropdown แล้ว)
  var perSel = document.getElementById('recPerson');
  if (perSel) {
    var _myPerson = (typeof getCurrentPerson === 'function') ? getCurrentPerson() : null;
    perSel.innerHTML = '<option value="' + _myPerson + '">' + _myPerson + '</option>';
    perSel.value = _myPerson;
  }

  modal.style.display = 'flex';
}

function closeRecurringModal() {
  var modal = document.getElementById('recurringModal');
  if (modal) modal.style.display = 'none';
}

function onRecurringTypeChange() {
  var type   = (document.getElementById('recType') || {}).value || 'expense';
  var catSel = document.getElementById('recCat');
  if (!catSel) return;
  catSel.innerHTML = (typeof categories !== 'undefined' ? categories : [])
    .filter(function(c) { return c.type === type; })
    .map(function(c) { return '<option value="' + c.id + '" data-name="' + c.name + '">' + c.name + '</option>'; })
    .join('');

  var splitSection = document.getElementById('recSplitSection');
  if (splitSection) splitSection.style.display = type === 'expense' ? 'flex' : 'none';
}

function onSaveRecurring() {
  var type    = (document.getElementById('recType')    || {}).value || 'expense';
  var catSel  = document.getElementById('recCat');
  var cat     = catSel ? catSel.options[catSel.selectedIndex] : null;
  var catId   = catSel ? catSel.value : '';
  var catName = cat ? (cat.dataset.name || cat.text) : '';
  var desc    = ((document.getElementById('recDesc')   || {}).value || '').trim();
  var amt     = parseFloat((document.getElementById('recAmt')    || {}).value) || 0;
  var day     = parseInt((document.getElementById('recDay')      || {}).value, 10) || 1;
  var person  = (document.getElementById('recPerson')  || {}).value || null;
  var split   = !!(document.getElementById('recSplit') || {}).checked;
  var offset  = parseInt((document.getElementById('recBillingOffset') || {}).value, 10) || 0;
  var note    = ((document.getElementById('recNote')   || {}).value || '').trim();

  if (!catId || !amt || day < 1 || day > 31) {
    showCycleToast('⚠️ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  addRecurring({
    type:                 type,
    cat_id:               catId,
    cat_name:             catName,
    desc:                 desc || catName,
    amt:                  amt,
    day_of_month:         day,
    billing_month_offset: offset,
    person:               person,
    split:                split,
    note:                 note,
    status:               type === 'income' ? 'received' : 'paid',
  });

  closeRecurringModal();
  renderRecurringList();
  showCycleToast('เพิ่มรายการประจำ "' + (desc || catName) + '" แล้ว');
}

// ─── INIT ─────────────────────────────────────────────────
function initRecurringEngine() {
  var n = processRecurring();
  if (n > 0 && typeof showCycleToast === 'function') {
    showCycleToast('สร้างรายการประจำ ' + n + ' รายการ 🔄');
  }
  // Re-check every hour when app stays open
  setInterval(function() {
    try { processRecurring(); } catch(_) {}
  }, 60 * 60 * 1000);
}
