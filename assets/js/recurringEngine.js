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

// ─── MARK AND DISMISS FROM MODAL ─────────────────────────
function markRecurringDone(id) {
  markRecurringRun(id);
  // Remove this item's row from the modal without closing it
  var row = document.getElementById('rec-row-' + id);
  if (row) {
    row.style.transition = 'opacity .2s';
    row.style.opacity = '0';
    setTimeout(function() {
      if (row.parentNode) row.parentNode.removeChild(row);
      // If modal list is now empty, close it
      var listEl = document.getElementById('recurringDueList');
      if (listEl && !listEl.querySelector('[id^="rec-row-"]')) {
        closeRecurringDueModal();
        if (typeof showCycleToast === 'function') showCycleToast('✅ บันทึกครบทุกรายการแล้ว');
      }
    }, 220);
  }
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

    var actionBtns = isDue
      ? '<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">'
          + '<button onclick="fillFormFromRecurring(\'' + t.id + '\')" '
              + 'style="padding:7px 12px;background:var(--blue);color:#fff;border:none;'
              + 'border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;'
              + 'font-family:Sarabun,sans-serif;white-space:nowrap;touch-action:manipulation">บันทึก →</button>'
          + '<button onclick="markRecurringDone(\'' + t.id + '\')" '
              + 'style="padding:5px 12px;background:none;border:1.5px solid var(--line);color:var(--ink3);'
              + 'border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;'
              + 'font-family:Sarabun,sans-serif;white-space:nowrap;touch-action:manipulation">✓ ทำแล้ว</button>'
        + '</div>'
      : '<span style="flex-shrink:0;font-size:11px;color:var(--ink3);white-space:nowrap">ยังไม่ถึงกำหนด</span>';
    return '<div id="rec-row-' + t.id + '" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;margin-bottom:8px;'
      + 'border-left:4px solid ' + borderColor + ';background:' + bgColor + ';border-radius:0 8px 8px 0">'
      + '<div style="flex:1;min-width:0;padding-right:10px">'
        + '<div style="font-size:13px;font-weight:600;margin-bottom:3px">' + typeLbl + ' ' + label + badge + '</div>'
        + '<div style="font-size:12px;color:var(--ink3)">' + amtStr + ' · ' + dayStr + '</div>'
      + '</div>'
      + actionBtns
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
  _openModal('recurringDueModal');
}

function closeRecurringDueModal() {
  _closeModal('recurringDueModal');
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

    var acctSel = document.getElementById('fAccount');
    if (acctSel && t.account_id) acctSel.value = t.account_id;

    // Vendor (fillVendors already ran inside onCatChange above)
    var vendorSel = document.getElementById('fVendor');
    if (vendorSel && t.vendor_id) vendorSel.value = t.vendor_id;

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
    box.innerHTML = '<div style="text-align:center;padding:24px 16px;color:var(--ink3);font-size:14px">ยังไม่มีรายการประจำ<br><span style="font-size:12px">กด "+ เพิ่มรายการประจำ" เพื่อเริ่มต้น</span></div>';
    return;
  }
  box.innerHTML = list.map(function(t) {
    var typeLbl = t.type === 'income'
      ? '<span class="badge badge-income">รายรับ</span>'
      : '<span class="badge badge-expense">รายจ่าย</span>';
    var label = (t.cat_name || '');
    if (t.desc && t.desc !== t.cat_name) label += ' — ' + t.desc;
    var dueDay = t.day_of_month || 1;

    // ─── ตรวจหา transaction เดือนนี้จาก db ─────────
    var existingTx = null;
    if (typeof db !== 'undefined' && Array.isArray(db)) {
      existingTx = db.find(function(tx) {
        return tx._recurring_id && String(tx._recurring_id) === String(t.id)
          && tx.date && tx.date.slice(0, 7) === yyyymm;
      });
    }

    // สถานะหลัก
    var isPaid       = existingTx && (existingTx.status === 'paid' || existingTx.status === 'received');
    var isPending    = existingTx && existingTx.status === 'pending';
    var isDoneLegacy = !existingTx && t.last_run_yyyymm === yyyymm; // บันทึกผ่านฟอร์ม (ไม่มี _recurring_id)
    var isDone       = isPaid || isDoneLegacy;
    var noTx         = !existingTx && t.last_run_yyyymm !== yyyymm;

    // Urgency dot
    var statusDot;
    if (isDone) {
      statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-left:6px;vertical-align:middle" title="ทำแล้วเดือนนี้"></span>';
    } else if (isPending) {
      statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f97316;margin-left:6px;vertical-align:middle" title="รอจ่าย/รอรับ — ยังไม่เสร็จสิ้น"></span>';
    } else if (noTx && todayDay >= dueDay) {
      statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ef4444;margin-left:6px;vertical-align:middle" title="ถึงกำหนดแล้ว"></span>';
    } else if (noTx && dueDay - todayDay <= 7) {
      statusDot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f59e0b;margin-left:6px;vertical-align:middle" title="ใกล้ถึงกำหนด"></span>';
    } else {
      statusDot = '';
    }

    // Info line (บรรทัดสอง)
    var lastRun = t.last_run_yyyymm ? '· เดือนล่าสุด: ' + t.last_run_yyyymm : '· ยังไม่เคยทำงาน';
    var statusHint = '';
    if (isPending) {
      statusHint = ' · <span style="color:#f97316;font-weight:600">⏳ รอ' + (t.type === 'income' ? 'รับ' : 'จ่าย') + '</span>';
    } else if (noTx && t.status === 'pending') {
      statusHint = ' · <span style="color:var(--ink3);font-size:10px">(จะบันทึกเป็น รอ' + (t.type === 'income' ? 'รับ' : 'จ่าย') + ')</span>';
    }

    // Action button
    var doNowBtn;
    if (isDone) {
      doNowBtn = '<span style="font-size:10px;color:#22c55e;font-weight:700;white-space:nowrap;padding:0 2px">✅ ทำแล้ว</span>';
    } else if (isPending) {
      // มี transaction pending อยู่ → เปิดหน้าแก้ไขรายการนั้น
      var payLabel = t.type === 'income' ? '💰 รับทันที' : '💳 จ่ายทันที';
      doNowBtn = '<button onclick="openEdit(' + existingTx.id + ')" id="recNowBtn-' + t.id + '" '
        + 'style="padding:5px 10px;background:#f97316;color:#fff;border:none;border-radius:8px;'
        + 'font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;'
        + 'white-space:nowrap;touch-action:manipulation;min-width:72px;letter-spacing:.3px">' + payLabel + '</button>';
    } else {
      // ยังไม่มี transaction → เปิดหน้าบันทึกพร้อมกรอกข้อมูลล่วงหน้า
      doNowBtn = '<button onclick="fillFormFromRecurring(\'' + t.id + '\')" id="recNowBtn-' + t.id + '" '
        + 'style="padding:5px 10px;background:#22c55e;color:#fff;border:none;border-radius:8px;'
        + 'font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;'
        + 'white-space:nowrap;touch-action:manipulation;min-width:72px;letter-spacing:.3px">⚡ ทำทันที</button>';
    }

    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--line)">'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:500">' + typeLbl + ' ' + label + statusDot + '</div>'
        + '<div style="font-size:11px;color:var(--ink3);margin-top:2px">'
          + 'วันที่ ' + dueDay + ' · ' + (typeof fmtH === 'function' ? fmtH(t.amt) : t.amt)
          + statusHint
          + ' ' + lastRun
        + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;margin-left:10px">'
        + doNowBtn
        + '<div style="display:flex;gap:0">'
          + '<button onclick="openEditRecurringModal(\'' + t.id + '\')" '
            + 'style="background:none;border:none;color:var(--ink3);font-size:15px;cursor:pointer;padding:3px 6px;touch-action:manipulation" title="แก้ไข">✏️</button>'
          + '<button onclick="onDeleteRecurring(\'' + t.id + '\')" '
            + 'style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:3px 6px;touch-action:manipulation">×</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }).join('');
}

// ─── PAY NOW (อัปเดต pending → paid/received) ─────────────
async function payRecurringNow(txId, recurringId) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var btn = document.getElementById('recNowBtn-' + recurringId);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  var txIdx = (typeof db !== 'undefined' && Array.isArray(db))
    ? db.findIndex(function(x) { return String(x.id) === String(txId); })
    : -1;
  if (txIdx < 0) {
    if (btn) { btn.disabled = false; }
    if (typeof showCycleToast === 'function') showCycleToast('❌ ไม่พบรายการ');
    return;
  }

  var tx       = db[txIdx];
  var newStatus = tx.type === 'income' ? 'received' : 'paid';
  tx.status = newStatus;
  save();
  sbUpdate(tx); // async — ไม่รอ ใช้ fire-and-forget แบบเดียวกับ dashboard.js

  if (typeof renderDash         === 'function') renderDash();
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderAccountList  === 'function') renderAccountList();
  if (typeof showCycleToast     === 'function') showCycleToast('✅ อัปเดต "' + tx.desc + '" เป็น' + (tx.type === 'income' ? 'รับแล้ว' : 'จ่ายแล้ว'));
  renderRecurringList();
}

// ─── EXECUTE NOW (บันทึกทันทีจาก template) ────────────────
async function executeRecurringNow(id) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var list = getRecurringList();
  var t = list.find(function(x) { return x.id === id; });
  if (!t) return;

  // disable button while saving
  var btn = document.getElementById('recNowBtn-' + id);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  var today  = new Date();
  var yyyymm = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var dueDay = t.day_of_month || 1;
  var entryDate = yyyymm + '-' + String(dueDay).padStart(2, '0');

  var cycle_id = (typeof cycleIdFromDate === 'function') ? cycleIdFromDate(entryDate) : null;
  var _currentUserId = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
  var person   = t.person || (typeof getCurrentPerson === 'function' ? getCurrentPerson() : null);
  var _status  = t.status || (t.type === 'income' ? 'received' : 'paid');

  var _entry = {
    id:              Date.now(),
    date:            entryDate,
    type:            t.type || 'expense',
    cat_id:          t.cat_id,
    cat_name:        t.cat_name || '',
    desc:            t.desc || t.cat_name || '',
    amt:             t.amt,
    person:          person,
    user_id:         _currentUserId || person,
    split:           false,
    split_type:      'personal',
    split_members:   [],
    split_ratios:    {},
    split_group_id:  null,
    split_snapshot:  null,
    status:          _status,
    note:            t.note || '',
    item_id:         null,
    vendor_id:       t.vendor_id || null,
    _salary_cycle:   null,
    cycle_id:        cycle_id,
    account_id:      t.account_id || null,
    _recurring_id:   id,
  };

  var _ok = await sbAdd(_entry);
  if (!_ok) {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ ทำทันที'; }
    return;
  }
  db.unshift(_entry);
  save();
  markRecurringRun(id);
  if (typeof renderDash         === 'function') renderDash();
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderAccountList  === 'function') renderAccountList();
  if (typeof showCycleToast     === 'function') showCycleToast('✅ บันทึก "' + _entry.desc + '" แล้ว');
  renderRecurringList();
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

function _fillRecurringAccounts() {
  var sel = document.getElementById('recAccount');
  if (!sel) return;
  var list = (typeof accountsData !== 'undefined') ? accountsData : [];
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>'
    + list.map(function(a) {
        return '<option value="' + a.id + '">' + a.name + '</option>';
      }).join('');
}

function _fillRecurringVendors(type) {
  var sel = document.getElementById('recVendor');
  var lbl = document.getElementById('recVendorLabel');
  if (!sel) return;
  var t   = type || 'expense';
  var all = (typeof vendorsData !== 'undefined') ? vendorsData : [];
  var list = all.filter(function(v) {
    var vt = v.vendor_type || 'both';
    return vt === 'both' || vt === t;
  });
  sel.innerHTML = '<option value="">-- ไม่ระบุ --</option>'
    + list.map(function(v) {
        return '<option value="' + v.id + '">' + v.name + '</option>';
      }).join('');
  if (lbl) lbl.textContent = (t === 'income' ? 'แหล่งรายรับ' : 'ร้านค้า');
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
  var typeEl = document.getElementById('recType');    if (typeEl) typeEl.value = 'expense';
  var amtEl  = document.getElementById('recAmt');     if (amtEl)  amtEl.value = '';
  var dayEl  = document.getElementById('recDay');     if (dayEl)  dayEl.value = '';
  var noteEl = document.getElementById('recNote');    if (noteEl) noteEl.value = '';
  var accEl  = document.getElementById('recAccount'); if (accEl)  accEl.value = '';
  var venEl  = document.getElementById('recVendor');  if (venEl)  venEl.value = '';
  var stEl   = document.getElementById('recStatus');  if (stEl)   stEl.value = 'paid';

  _buildRecurringCatOptions('expense');
  _openModal('recurringModal');
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
  var noteEl    = document.getElementById('recNote');    if (noteEl)    noteEl.value = t.note || '';
  var acctEl    = document.getElementById('recAccount');
  if (acctEl) { _fillRecurringAccounts(); acctEl.value = t.account_id || ''; }
  var vendorEl  = document.getElementById('recVendor');
  if (vendorEl) { _fillRecurringVendors(t.type || 'expense'); vendorEl.value = t.vendor_id || ''; }
  var statusEl  = document.getElementById('recStatus');
  if (statusEl) { _fillRecurringStatus(t.type || 'expense'); statusEl.value = t.status || (t.type === 'income' ? 'received' : 'paid'); }

  _openModal('recurringModal');
}

function closeRecurringModal() {
  _closeModal('recurringModal', function() { _editingRecurringId = null; });
}

function _fillRecurringStatus(type) {
  var sel = document.getElementById('recStatus');
  var lbl = document.getElementById('recStatusLabel');
  if (!sel) return;
  if (type === 'income') {
    sel.innerHTML = '<option value="received">✅ รับแล้ว</option><option value="pending">⏳ รอรับ</option>';
  } else {
    sel.innerHTML = '<option value="paid">✅ จ่ายแล้ว</option><option value="pending">⏳ รอจ่าย</option>';
  }
  if (lbl) lbl.textContent = 'สถานะเมื่อ "ทำทันที"';
}

function _buildRecurringCatOptions(type) {
  var catSel = document.getElementById('recCat');
  if (!catSel) return;
  catSel.innerHTML = (typeof categories !== 'undefined' ? categories : [])
    .filter(function(c) { return c.type === type; })
    .map(function(c) { return '<option value="' + c.id + '" data-name="' + c.name + '">' + c.name + '</option>'; })
    .join('');
  if (catSel.value) _fillRecurringDescByCat(catSel.value);
  _fillRecurringVendors(type);
  _fillRecurringAccounts();
  _fillRecurringStatus(type);
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
  var note      = ((document.getElementById('recNote')    || {}).value || '').trim();
  var account_id = (document.getElementById('recAccount') || {}).value || null;
  var vendor_id  = (document.getElementById('recVendor')  || {}).value || null;
  var status    = (document.getElementById('recStatus')  || {}).value || (type === 'income' ? 'received' : 'paid');

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
    person:               person,
    note:                 note,
    account_id:           account_id,
    vendor_id:            vendor_id,
    status:               status,
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

// ─── MANUAL CHECK ─────────────────────────────────────────
/**
 * Called from the "รายการถึงกำหนด" button in settings.
 * Shows due + upcoming items — including ones already dismissed this session.
 * If nothing is due, shows a toast instead.
 */
function checkRecurringDueNow() {
  var today    = new Date();
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var todayDay = today.getDate();
  var list     = getRecurringList();
  var dueList      = [];
  var upcomingList = [];

  list.forEach(function(t) {
    if (t.last_run_yyyymm === yyyymm) return; // already done this month — skip
    var dueDay = t.day_of_month || 1;
    if (todayDay >= dueDay) {
      dueList.push(t);
    } else if (dueDay - todayDay <= 7) {
      upcomingList.push(t);
    }
  });

  if (dueList.length === 0 && upcomingList.length === 0) {
    if (typeof showCycleToast === 'function') showCycleToast('✅ บันทึกครบทุกรายการแล้ว');
    return;
  }
  showRecurringDueModal(dueList, upcomingList);
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
