/* HomeFinance · module: recurringEngine.js · v3.1.0
 * Recurring transaction engine — notification + confirm flow.
 * processRecurring() finds due templates and shows a modal.
 * User clicks "บันทึก →" → form is pre-filled → user reviews and saves.
 *
 * Template schema:
 *   { id, type, cat_id, cat_name, desc, amt, status, note,
 *     day_of_month, billing_month_offset, last_run_yyyymm, account_id }
 *
 * billing_month_offset: -1 = prev month, 0 = same month (default)
 */

// ─── STORAGE (user-scoped key) ────────────────────────────
function _recurringKey() {
  var p = (typeof getCurrentPerson === 'function') ? getCurrentPerson() : null;
  return p ? 'hf2_recurring_' + p : 'hf2_recurring';
}
function getRecurringList() {
  try { return JSON.parse(localStorage.getItem(_recurringKey()) || '[]'); }
  catch(_) { return []; }
}
function saveRecurringList(list) {
  localStorage.setItem(_recurringKey(), JSON.stringify(list));
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

// ─── MARK RUN ─────────────────────────────────────────────
function markRecurringRun(id) {
  var today  = new Date();
  var yyyymm = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  updateRecurring(id, { last_run_yyyymm: yyyymm });
}

// ─── PROCESS (find due, show modal) ───────────────────────
/**
 * Run on startup + every hour.
 * Finds templates due this month, shows notification modal.
 * Does NOT auto-create transactions anymore.
 */
function processRecurring() {
  var today    = new Date();
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var todayDay = today.getDate();
  var list     = getRecurringList();
  var dueList  = [];

  list.forEach(function(t) {
    if (t.last_run_yyyymm === yyyymm) return;
    var dueDay = t.day_of_month || 1;
    if (todayDay < dueDay) return;
    dueList.push(t);
  });

  if (dueList.length > 0) {
    showRecurringDueModal(dueList);
  }

  return dueList.length;
}

// ─── DUE MODAL ────────────────────────────────────────────
function showRecurringDueModal(dueList) {
  var modal  = document.getElementById('recurringDueModal');
  var listEl = document.getElementById('recurringDueList');
  if (!modal || !listEl) return;

  listEl.innerHTML = dueList.map(function(t) {
    var typeLbl = t.type === 'income'
      ? '<span class="badge badge-income">รายรับ</span>'
      : '<span class="badge badge-expense">รายจ่าย</span>';
    var label = (t.cat_name || '');
    if (t.desc && t.desc !== t.cat_name) label += ' — ' + t.desc;
    var amtStr = (typeof fmtH === 'function') ? fmtH(t.amt) : ('฿' + (Number(t.amt)||0).toLocaleString());
    var dayStr = 'วันที่ ' + (t.day_of_month || 1);
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)">'
      + '<div style="flex:1;min-width:0;padding-right:10px">'
        + '<div style="font-size:13px;font-weight:600;margin-bottom:3px">' + typeLbl + ' ' + label + '</div>'
        + '<div style="font-size:12px;color:var(--ink3)">' + amtStr + ' · ' + dayStr + '</div>'
      + '</div>'
      + '<button onclick="fillFormFromRecurring(\'' + t.id + '\')" '
        + 'style="flex-shrink:0;padding:8px 14px;background:var(--blue);color:#fff;border:none;'
        + 'border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;'
        + 'font-family:Sarabun,sans-serif;white-space:nowrap;touch-action:manipulation">'
        + 'บันทึก →</button>'
    + '</div>';
  }).join('');

  modal.style.display = 'flex';
}

function closeRecurringDueModal() {
  var modal = document.getElementById('recurringDueModal');
  if (modal) modal.style.display = 'none';
}

// ─── FILL FORM FROM RECURRING ─────────────────────────────
/**
 * Navigate to add form and pre-fill from recurring template.
 * Sets window._pending_recurring_id so addEntry() can mark it as run.
 */
function fillFormFromRecurring(templateId) {
  var list = getRecurringList();
  var t = list.find(function(x) { return x.id === templateId; });
  if (!t) return;

  closeRecurringDueModal();

  // Navigate to add form (calls initForm which resets fields)
  if (typeof nav === 'function') nav('add');

  // Fill fields after initForm has run
  setTimeout(function() {
    var today  = new Date();
    var yyyymm = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    var dueDay = t.day_of_month || 1;
    var entryDate = yyyymm + '-' + String(dueDay).padStart(2, '0');

    // Compute billing_month from offset
    var offset = t.billing_month_offset || 0;
    var bm;
    if (offset === -1) {
      var prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      bm = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    } else {
      bm = yyyymm;
    }

    // Type first — rebuilds category list
    if (typeof setType === 'function') setType(t.type || 'expense');

    // Category
    var catSel = document.getElementById('fCat');
    if (catSel && t.cat_id) {
      catSel.value = t.cat_id;
      if (typeof onCatChange === 'function') onCatChange();
    }

    // Description — may not be in dropdown, insert if needed
    var descSel = document.getElementById('fDesc');
    if (descSel && t.desc) {
      var optVals = [].slice.call(descSel.options).map(function(o) { return o.value; });
      if (optVals.indexOf(t.desc) === -1) {
        var opt = document.createElement('option');
        opt.value = t.desc; opt.textContent = t.desc;
        descSel.insertBefore(opt, descSel.firstChild);
      }
      descSel.value = t.desc;
    }

    // Date
    var dateEl = document.getElementById('fDate');
    if (dateEl) {
      dateEl.value = entryDate;
      if (typeof updateThaiDate === 'function') updateThaiDate();
    }

    // Amount
    var amtEl = document.getElementById('fAmt');
    if (amtEl && t.amt) amtEl.value = t.amt;

    // Billing month
    var bmSel = document.getElementById('fBillingMonth');
    if (bmSel) bmSel.value = bm;

    // Account
    var acctSel = document.getElementById('fAccount');
    if (acctSel && t.account_id) acctSel.value = t.account_id;

    // Status
    var statusSel = document.getElementById('fStatus');
    if (statusSel && t.status) statusSel.value = t.status;

    // Note
    var noteEl = document.getElementById('fNote');
    if (noteEl) noteEl.value = t.note || '';

    // Tag this save as recurring
    window._pending_recurring_id = templateId;

    if (typeof showCycleToast === 'function') {
      showCycleToast('📋 กรอกแล้ว — ตรวจสอบและกดบันทึก');
    }
  }, 50);
}

// ─── UPCOMING PREVIEW ─────────────────────────────────────
function getUpcomingRecurring(days) {
  days = days || 7;
  var today  = new Date(); today.setHours(0, 0, 0, 0);
  var result = [];
  var list   = getRecurringList();
  list.forEach(function(t) {
    var dueDay  = t.day_of_month || 1;
    var dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (dueDate < today) {
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
  var list = getRecurringList();
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
    var label = (t.cat_name || '');
    if (t.desc && t.desc !== t.cat_name) label += ' — ' + t.desc;
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:500">' + typeLbl + ' ' + label + '</div>'
        + '<div style="font-size:11px;color:var(--ink3);margin-top:2px">'
          + 'วันที่ ' + (t.day_of_month || 1) + ' · ' + (typeof fmtH === 'function' ? fmtH(t.amt) : t.amt) + offsetLbl + ' ' + lastRun
        + '</div>'
      + '</div>'
      + '<button onclick="onDeleteRecurring(\'' + t.id + '\')" '
        + 'style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;touch-action:manipulation">×</button>'
    + '</div>';
  }).join('');
}

function onDeleteRecurring(id) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  if (!confirm('ลบรายการประจำนี้?')) return;
  deleteRecurring(id);
  renderRecurringList();
}

// ─── TEMPLATE MODAL OPEN/CLOSE ────────────────────────────
function openRecurringModal() {
  var modal = document.getElementById('recurringModal');
  if (!modal) return;

  var catSel = document.getElementById('recCat');
  if (catSel) {
    var curType = (document.getElementById('recType') || {}).value || 'expense';
    catSel.innerHTML = (typeof categories !== 'undefined' ? categories : [])
      .filter(function(c) { return c.type === curType; })
      .map(function(c) { return '<option value="' + c.id + '" data-name="' + c.name + '">' + c.name + '</option>'; })
      .join('');
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
}

function onSaveRecurring() {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var type    = (document.getElementById('recType')    || {}).value || 'expense';
  var catSel  = document.getElementById('recCat');
  var cat     = catSel ? catSel.options[catSel.selectedIndex] : null;
  var catId   = catSel ? catSel.value : '';
  var catName = cat ? (cat.dataset.name || cat.text) : '';
  var desc    = ((document.getElementById('recDesc')   || {}).value || '').trim();
  var amt     = parseFloat((document.getElementById('recAmt')    || {}).value) || 0;
  var day     = parseInt((document.getElementById('recDay')      || {}).value, 10) || 1;
  var offset  = parseInt((document.getElementById('recBillingOffset') || {}).value, 10) || 0;
  var note    = ((document.getElementById('recNote')   || {}).value || '').trim();

  if (!catId || !amt || day < 1 || day > 31) {
    if (typeof showCycleToast === 'function') showCycleToast('⚠️ กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  var person = (typeof getCurrentPerson === 'function') ? getCurrentPerson() : null;

  addRecurring({
    type:                 type,
    cat_id:               catId,
    cat_name:             catName,
    desc:                 desc || catName,
    amt:                  amt,
    day_of_month:         day,
    billing_month_offset: offset,
    person:               person,
    note:                 note,
    status:               type === 'income' ? 'received' : 'paid',
  });

  closeRecurringModal();
  renderRecurringList();
  if (typeof showCycleToast === 'function') showCycleToast('เพิ่มรายการประจำ "' + (desc || catName) + '" แล้ว');
}

// ─── INIT ─────────────────────────────────────────────────
function initRecurringEngine() {
  processRecurring();
  setInterval(function() {
    try { processRecurring(); } catch(_) {}
  }, 60 * 60 * 1000);
}
