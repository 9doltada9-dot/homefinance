/* HomeFinance · module: recurringEngine.js · v3.2.0
 * Recurring transaction engine — notification + confirm flow.
 * - Storage key is per Supabase UID (not household person ID)
 * - Due modal shows urgency: overdue (red) / today (orange) / upcoming (amber)
 */

// ─── STORAGE (per Supabase UID — never falls back to person ID) ───
function _recurringKey() {
  // getAuthUserId() returns Supabase UUID unique per email account.
  // getCurrentPerson() has a legacy fallback to household role ("A"/"B") shared
  // between accounts — intentionally avoided here.
  var uid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
  return uid ? 'hf2_recurring_' + uid : null;
}
function getRecurringList() {
  var k = _recurringKey();
  if (!k) return []; // no authenticated user — return empty
  try { return JSON.parse(localStorage.getItem(k) || '[]'); }
  catch(_) { return []; }
}
function saveRecurringList(list) {
  var k = _recurringKey();
  if (!k) return; // no authenticated user — refuse to write
  localStorage.setItem(k, JSON.stringify(list));
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

// ─── PROCESS (find due + upcoming, show modal) ────────────
function processRecurring() {
  var today    = new Date();
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var todayDay = today.getDate();
  var list     = getRecurringList();
  var dueList      = []; // today >= dueDay (must record now)
  var upcomingList = []; // dueDay within next 7 days

  list.forEach(function(t) {
    if (t.last_run_yyyymm === yyyymm) return;
    var dueDay = t.day_of_month || 1;
    if (todayDay >= dueDay) {
      dueList.push(t);
    } else if (dueDay - todayDay <= 7) {
      upcomingList.push(t);
    }
  });

  if (dueList.length > 0 || upcomingList.length > 0) {
    showRecurringDueModal(dueList, upcomingList);
  }

  return dueList.length;
}

// ─── DUE MODAL (urgency colors) ───────────────────────────
function showRecurringDueModal(dueList, upcomingList) {
  var modal  = document.getElementById('recurringDueModal');
  var listEl = document.getElementById('recurringDueList');
  if (!modal || !listEl) return;
  upcomingList = upcomingList || [];

  var todayDay = new Date().getDate();

  function _renderItem(t, isDue) {
    var typeLbl = t.type === 'income'
      ? '<span class="badge badge-income">รายรับ</span>'
      : '<span class="badge badge-expense">รายจ่าย</span>';
    var label   = (t.cat_name || '');
    if (t.desc && t.desc !== t.cat_name) label += ' — ' + t.desc;
    var amtStr  = (typeof fmtH === 'function') ? fmtH(t.amt) : ('\u0e3f' + (Number(t.amt)||0).toLocaleString());
    var dueDay  = t.day_of_month || 1;
    var dayStr  = 'วันที่ ' + dueDay;

    var borderColor, bgColor, badge;
    if (isDue) {
      var overdue = todayDay - dueDay;
      if (overdue === 0) {
        borderColor = '#f97316';
        bgColor     = 'rgba(249,115,22,.07)';
        badge = '<span style="font-size:10px;padding:2px 7px;background:#f97316;color:#fff;border-radius:10px;font-weight:700;margin-left:6px;vertical-align:middle">วันนี้</span>';
      } else {
        borderColor = '#ef4444';
        bgColor     = 'rgba(239,68,68,.07)';
        badge = '<span style="font-size:10px;padding:2px 7px;background:#ef4444;color:#fff;border-radius:10px;font-weight:700;margin-left:6px;vertical-align:middle">เลย ' + overdue + ' วัน</span>';
      }
    } else {
      var daysLeft = dueDay - todayDay;
      borderColor = '#f59e0b';
      bgColor     = 'rgba(245,158,11,.07)';
      badge = '<span style="font-size:10px;padding:2px 7px;background:#f59e0b;color:#fff;border-radius:10px;font-weight:700;margin-left:6px;vertical-align:middle">อีก ' + daysLeft + ' วัน</span>';
    }

    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;margin-bottom:8px;'
      + 'border-left:4px solid ' + borderColor + ';background:' + bgColor + ';border-radius:0 8px 8px 0">'
      + '<div style="flex:1;min-width:0;padding-right:10px">'
        + '<div style="font-size:13px;font-weight:600;margin-bottom:3px">' + typeLbl + ' ' + label + badge + '</div>'
        + '<div style="font-size:12px;color:var(--ink3)">' + amtStr + ' · ' + dayStr + '</div>'
      + '</div>'
      + (isDue
          ? '<button onclick="fillFormFromRecurring(\'' + t.id + '\')" '
              + 'style="flex-shrink:0;padding:8px 14px;background:var(--blue);color:#fff;border:none;'
              + 'border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;'
              + 'font-family:Sarabun,sans-serif;white-space:nowrap;touch-action:manipulation">บันทึก →</button>'
          : '<span style="flex-shrink:0;font-size:11px;color:var(--ink3);white-space:nowrap">ยังไม่ถึงกำหนด</span>')
    + '</div>';
  }

  var html = '';
  if (dueList.length > 0) {
    html += '<div style="font-size:11px;font-weight:700;color:#ef4444;letter-spacing:.5px;margin-bottom:6px">ถึงกำหนดแล้ว · ' + dueList.length + ' รายการ</div>';
    html += dueList.map(function(t) { return _renderItem(t, true); }).join('');
  }
  if (upcomingList.length > 0) {
    if (dueList.length > 0) html += '<div style="height:10px"></div>';
    html += '<div style="font-size:11px;font-weight:700;color:#f59e0b;letter-spacing:.5px;margin-bottom:6px">ใกล้ถึงกำหนด · ' + upcomingList.length + ' รายการ</div>';
    html += upcomingList.map(function(t) { return _renderItem(t, false); }).join('');
  }

  listEl.innerHTML = html;
  modal.style.display = 'flex';
}

function closeRecurringDueModal() {
  var modal = document.getElementById('recurringDueModal');
  if (modal) modal.style.display = 'none';
}

// ─── FILL FORM FROM RECURRING ─────────────────────────────
function fillFormFromRecurring(templateId) {
  var list = getRecurringList();
  var t = list.find(function(x) { return x.id === templateId; });
  if (!t) return;

  closeRecurringDueModal();
  if (typeof nav === 'function') nav('add');

  setTimeout(function() {
    var today  = new Date();
    var yyyymm = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    var dueDay = t.day_of_month || 1;
    var entryDate = yyyymm + '-' + String(dueDay).padStart(2, '0');

    var offset = t.billing_month_offset || 0;
    var bm;
    if (offset === -1) {
      var prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      bm = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    } else {
      bm = yyyymm;
    }

    if (typeof setType === 'function') setType(t.type || 'expense');

    var catSel = document.getElementById('fCat');
    if (catSel && t.cat_id) {
      catSel.value = t.cat_id;
      if (typeof onCatChange === 'function') onCatChange();
    }

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

    var dateEl = document.getElementById('fDate');
    if (dateEl) { dateEl.value = entryDate; if (typeof updateThaiDate === 'function') updateThaiDate(); }

    var amtEl = document.getElementById('fAmt');
    if (amtEl && t.amt) amtEl.value = t.amt;

    var bmSel = document.getElementById('fBillingMonth');
    if (bmSel) bmSel.value = bm;

    var acctSel = document.getElementById('fAccount');
    if (acctSel && t.account_id) acctSel.value = t.account_id;

    var statusSel = document.getElementById('fStatus');
    if (statusSel && t.status) statusSel.value = t.status;

    var noteEl = document.getElementById('fNote');
    if (noteEl) noteEl.value = t.note || '';

    window._pending_recurring_id = templateId;

    if (typeof showCycleToast === 'function') showCycleToast('\ud83d\udccb กรอกแล้ว — ตรวจสอบและกดบันทึก');
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
    if (dueDate < today) dueDate = new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
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
  var today    = new Date();
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var todayDay = today.getDate();
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
    // Urgency dot
    var dueDay = t.day_of_month || 1;
    var statusDot = '';
    if (t.last_run_yyyymm !== yyyymm) {
      if (todayDay >= dueDay) {
        statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-left:6px;vertical-align:middle" title="ถึงกำหนดแล้ว"></span>';
      } else if (dueDay - todayDay <= 7) {
        statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-left:6px;vertical-align:middle" title="ใกล้ถึงกำหนด"></span>';
      }
    }
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:500">' + typeLbl + ' ' + label + statusDot + '</div>'
        + '<div style="font-size:11px;color:var(--ink3);margin-top:2px">'
          + 'วันที่ ' + dueDay + ' · ' + (typeof fmtH === 'function' ? fmtH(t.amt) : t.amt) + offsetLbl + ' ' + lastRun
        + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;align-items:center">'
        + '<button onclick="openEditRecurringModal(\'' + t.id + '\')" '
          + 'style="background:none;border:none;color:var(--ink3);font-size:15px;cursor:pointer;padding:4px 6px;touch-action:manipulation" title="แก้ไข">✏️</button>'
        + '<button onclick="onDeleteRecurring(\'' + t.id + '\')" '
          + 'style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 6px;touch-action:manipulation">×</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

function onDeleteRecurring(id) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  if (!confirm('ลบรายการประจำนี้?')) return;
  deleteRecurring(id);
  renderRecurringList();
}

// ─── TEMPLATE MODAL ───────────────────────────────────────
var _editingRecurringId = null; // null = add mode, string = edit mode

function _fillRecurringDescByCat(catId) {
  var sel = document.getElementById('recDesc');
  if (!sel) return;
  var items = (typeof itemsData !== 'undefined' && catId) ? (itemsData[catId] || []) : [];
  var names = items.map(function(x) { return x.name; });
  sel.innerHTML = names.length
    ? names.map(function(n) { return '<option value="' + n + '">' + n + '</option>'; }).join('')
    : '<option value="">-- ยังไม่มีรายการ --</option>';
}

function onRecurringCatChange() {
  var catSel = document.getElementById('recCat');
  if (catSel) _fillRecurringDescByCat(catSel.value);
}

function openRecurringModal() {
  _editingRecurringId = null;
  var titleEl = document.getElementById('recurringModalTitle');
  if (titleEl) titleEl.textContent = '+ เพิ่มรายการประจำ';

  var modal = document.getElementById('recurringModal');
  if (!modal) return;

  // Reset fields
  var typeEl = document.getElementById('recType'); if (typeEl) typeEl.value = 'expense';
  var amtEl  = document.getElementById('recAmt');  if (amtEl)  amtEl.value = '';
  var dayEl  = document.getElementById('recDay');  if (dayEl)  dayEl.value = '';
  var offEl  = document.getElementById('recBillingOffset'); if (offEl) offEl.value = '0';
  var noteEl = document.getElementById('recNote'); if (noteEl) noteEl.value = '';

  _buildRecurringCatOptions('expense');
  modal.style.display = 'flex';
}

function openEditRecurringModal(id) {
  var list = getRecurringList();
  var t = list.find(function(x) { return x.id === id; });
  if (!t) return;
  _editingRecurringId = id;

  var titleEl = document.getElementById('recurringModalTitle');
  if (titleEl) titleEl.textContent = '✏️ แก้ไขรายการประจำ';

  var modal = document.getElementById('recurringModal');
  if (!modal) return;

  var typeEl = document.getElementById('recType'); if (typeEl) typeEl.value = t.type || 'expense';
  _buildRecurringCatOptions(t.type || 'expense');

  var catSel = document.getElementById('recCat');
  if (catSel && t.cat_id) catSel.value = t.cat_id;

  _fillRecurringDescByCat(t.cat_id);
  var descSel = document.getElementById('recDesc');
  if (descSel) {
    // Ensure saved desc is in options
    var optVals = [].slice.call(descSel.options).map(function(o) { return o.value; });
    if (t.desc && optVals.indexOf(t.desc) === -1) {
      var opt = document.createElement('option');
      opt.value = t.desc; opt.textContent = t.desc;
      descSel.insertBefore(opt, descSel.firstChild);
    }
    if (t.desc) descSel.value = t.desc;
  }

  var amtEl = document.getElementById('recAmt'); if (amtEl) amtEl.value = t.amt || '';
  var dayEl = document.getElementById('recDay'); if (dayEl) dayEl.value = t.day_of_month || '';
  var offEl = document.getElementById('recBillingOffset'); if (offEl) offEl.value = String(t.billing_month_offset || 0);
  var noteEl = document.getElementById('recNote'); if (noteEl) noteEl.value = t.note || '';

  modal.style.display = 'flex';
}

function closeRecurringModal() {
  var modal = document.getElementById('recurringModal');
  if (modal) modal.style.display = 'none';
  _editingRecurringId = null;
}

function _buildRecurringCatOptions(type) {
  var catSel = document.getElementById('recCat');
  if (!catSel) return;
  catSel.innerHTML = (typeof categories !== 'undefined' ? categories : [])
    .filter(function(c) { return c.type === type; })
    .map(function(c) { return '<option value="' + c.id + '" data-name="' + c.name + '">' + c.name + '</option>'; })
    .join('');
  // Also refresh desc
  if (catSel.value) _fillRecurringDescByCat(catSel.value);
}

function onRecurringTypeChange() {
  var type = (document.getElementById('recType') || {}).value || 'expense';
  _buildRecurringCatOptions(type);
}

function onSaveRecurring() {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var type    = (document.getElementById('recType')    || {}).value || 'expense';
  var catSel  = document.getElementById('recCat');
  var cat     = catSel ? catSel.options[catSel.selectedIndex] : null;
  var catId   = catSel ? catSel.value : '';
  var catName = cat ? (cat.dataset.name || cat.text) : '';
  var descSel = document.getElementById('recDesc');
  var desc    = descSel ? (descSel.value || '').trim() : '';
  var amt     = parseFloat((document.getElementById('recAmt')    || {}).value) || 0;
  var day     = parseInt((document.getElementById('recDay')      || {}).value, 10) || 1;
  var offset  = parseInt((document.getElementById('recBillingOffset') || {}).value, 10) || 0;
  var note    = ((document.getElementById('recNote')   || {}).value || '').trim();

  if (!catId || !amt || day < 1 || day > 31) {
    if (typeof showCycleToast === 'function') showCycleToast('\u26a0\ufe0f กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  var person = (typeof getCurrentPerson === 'function') ? getCurrentPerson() : null;
  var payload = {
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
  };

  if (_editingRecurringId) {
    updateRecurring(_editingRecurringId, payload);
    if (typeof showCycleToast === 'function') showCycleToast('\u2705 แก้ไขรายการประจำแล้ว');
  } else {
    addRecurring(payload);
    if (typeof showCycleToast === 'function') showCycleToast('เพิ่มรายการประจำ "' + (desc || catName) + '" แล้ว');
  }

  closeRecurringModal();
  renderRecurringList();
}

// ─── INIT ─────────────────────────────────────────────────
var _recurringIntervalId = null;

function initRecurringEngine() {
  if (_recurringIntervalId) { clearInterval(_recurringIntervalId); _recurringIntervalId = null; }
  processRecurring();
  _recurringIntervalId = setInterval(function() {
    try { processRecurring(); } catch(_) {}
  }, 60 * 60 * 1000);
}
