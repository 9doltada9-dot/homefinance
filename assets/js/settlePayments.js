/* HomeFinance · settlePayments.js v1.0
 * Settlement Payment Tracking — lock, carry-forward, partial pay
 */

var _SP_KEY = 'hf2_settle_pay_v1';

// ─── STORAGE ──────────────────────────────────────────────
function getSettlePayments() {
  try { return JSON.parse(localStorage.getItem(_SP_KEY) || '[]'); }
  catch(_) { return []; }
}
function _saveSettlePayments(list) {
  localStorage.setItem(_SP_KEY, JSON.stringify(list));
  if (typeof sbSaveSetting === 'function') sbSaveSetting('settle_pay_v1', list);
}

/** โหลดจาก Supabase settings map (เรียกจาก applySettingsFromMap) */
function applySettlePaymentsFromMap(data) {
  if (!Array.isArray(data) || !data.length) return;
  var local = getSettlePayments();
  if (data.length >= local.length) {
    localStorage.setItem(_SP_KEY, JSON.stringify(data));
  }
}

// ─── LOCK SETTLEMENT ──────────────────────────────────────
/**
 * ล็อก settlement ของเดือนนี้ สร้าง record สำหรับแต่ละ transfer
 * transfers = [{ fromUid, toUid, amount, fromName, toName }]
 */
function lockSettlement(month, transfers) {
  if (!month || !transfers || !transfers.length) {
    if (typeof showCycleToast === 'function') showCycleToast('ℹ️ ไม่มียอดค้างในเดือนนี้');
    return;
  }
  var list = getSettlePayments();
  var created = 0;
  transfers.forEach(function(t) {
    var existing = list.find(function(r) {
      return r.month === month
          && r.from_uid === t.fromUid
          && r.to_uid   === t.toUid;
    });
    if (!existing) {
      list.push({
        id:           'sp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        month:        month,
        from_uid:     t.fromUid,
        to_uid:       t.toUid,
        from_name:    t.fromName || t.fromUid,
        to_name:      t.toName   || t.toUid,
        amount_owed:  Math.round(t.amount * 100) / 100,
        amount_paid:  0,
        status:       'unpaid',    // unpaid | partial | paid
        payments:     [],
        locked_at:    new Date().toISOString().slice(0, 10),
      });
      created++;
    }
  });
  if (created > 0) {
    _saveSettlePayments(list);
    if (typeof showCycleToast === 'function')
      showCycleToast('🔒 ล็อก Settlement ' + month + ' แล้ว (' + created + ' รายการ)');
    return true;
  } else {
    if (typeof showCycleToast === 'function')
      showCycleToast('ℹ️ เดือน ' + month + ' ล็อกไปแล้ว');
    return false;
  }
}

// ─── RECORD PAYMENT ────────────────────────────────────────
/**
 * บันทึกการชำระ (ทั้งหมดหรือบางส่วน)
 * @returns true ถ้าสำเร็จ
 */
function recordSettlePayment(recordId, amount, date, note) {
  var list = getSettlePayments();
  var rec  = list.find(function(r) { return r.id === recordId; });
  if (!rec) return false;
  if (amount <= 0) return false;

  rec.payments.push({ date: date, amount: amount, note: note || '' });
  rec.amount_paid = rec.payments.reduce(function(s, p) { return s + p.amount; }, 0);

  if (rec.amount_paid >= rec.amount_owed - 0.5) {
    rec.status = 'paid';
  } else if (rec.amount_paid > 0) {
    rec.status = 'partial';
  }
  _saveSettlePayments(list);
  return true;
}

// ─── MARK FULLY PAID ──────────────────────────────────────
function markSettleFullyPaid(recordId, date) {
  var list = getSettlePayments();
  var rec  = list.find(function(r) { return r.id === recordId; });
  if (!rec) return false;
  var remaining = rec.amount_owed - rec.amount_paid;
  if (remaining > 0.5) {
    rec.payments.push({ date: date || new Date().toISOString().slice(0,10), amount: remaining, note: 'จ่ายครบ' });
    rec.amount_paid = rec.amount_owed;
  }
  rec.status = 'paid';
  _saveSettlePayments(list);
  return true;
}

// ─── DELETE RECORD ─────────────────────────────────────────
function deleteSettleRecord(recordId) {
  if (!confirm('ลบ record นี้?')) return;
  var list = getSettlePayments().filter(function(r) { return r.id !== recordId; });
  _saveSettlePayments(list);
  if (typeof renderSettle === 'function') renderSettle();
}

// ─── CARRY-FORWARD BALANCES ────────────────────────────────
/**
 * คืน { uid: netBalance } จากเดือนก่อนที่ยังค้างชำระ
 * + = ควรได้รับ, - = ยังต้องจ่าย
 */
function getCarryForwardBalances(currentMonth) {
  var list = getSettlePayments().filter(function(r) {
    return r.month < currentMonth && r.status !== 'paid';
  });
  var carry = {};
  list.forEach(function(r) {
    var remaining = r.amount_owed - r.amount_paid;
    if (remaining < 0.5) return;
    carry[r.from_uid] = (carry[r.from_uid] || 0) - remaining;
    carry[r.to_uid]   = (carry[r.to_uid]   || 0) + remaining;
  });
  return carry;
}

/**
 * คืน records ที่ยังค้างชำระ ก่อนเดือนนี้
 */
function getCarryForwardRecords(currentMonth) {
  return getSettlePayments()
    .filter(function(r) { return r.month < currentMonth && r.status !== 'paid'; })
    .sort(function(a, b) { return a.month < b.month ? -1 : 1; });
}

// ─── UI HELPERS ────────────────────────────────────────────
var _spModal_recordId = null;

function openSettlePayModal(recordId) {
  var list = getSettlePayments();
  var rec  = list.find(function(r) { return r.id === recordId; });
  if (!rec) return;
  _spModal_recordId = recordId;

  var remaining = rec.amount_owed - rec.amount_paid;
  var infoEl = document.getElementById('spInfo');
  if (infoEl) {
    infoEl.innerHTML =
      '<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:10px">'
      + '<div style="font-size:12px;color:var(--ink3);margin-bottom:2px">Settlement เดือน <b>' + rec.month + '</b></div>'
      + '<div style="font-size:13px;font-weight:600;margin-bottom:4px">'
        + (rec.from_name || rec.from_uid) + ' → ' + (rec.to_name || rec.to_uid)
      + '</div>'
      + '<div style="display:flex;gap:12px;font-size:12px">'
        + '<span>ค้างทั้งหมด: <b style="font-family:monospace;color:var(--red)">' + fmtH(rec.amount_owed) + '</b></span>'
        + '<span>จ่ายแล้ว: <b style="font-family:monospace;color:var(--green)">' + fmtH(rec.amount_paid) + '</b></span>'
        + '<span>คงค้าง: <b style="font-family:monospace;color:var(--amber)">' + fmtH(remaining) + '</b></span>'
      + '</div>'
      + '</div>';
  }

  var amtEl  = document.getElementById('spAmt');
  var dateEl = document.getElementById('spDate');
  var noteEl = document.getElementById('spNote');
  if (amtEl)  amtEl.value  = remaining.toFixed(2);
  if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
  if (noteEl) noteEl.value = '';

  if (typeof _openModal === 'function') _openModal('settlePayModal');
}

function closeSettlePayModal() {
  _spModal_recordId = null;
  if (typeof _closeModal === 'function') _closeModal('settlePayModal');
}

function submitSettlePayment() {
  if (!_spModal_recordId) return;
  var amt  = parseFloat(document.getElementById('spAmt').value)  || 0;
  var date = document.getElementById('spDate').value || new Date().toISOString().slice(0, 10);
  var note = document.getElementById('spNote').value || '';
  if (amt <= 0) {
    if (typeof showCycleToast === 'function') showCycleToast('⚠️ ระบุจำนวนเงิน');
    return;
  }
  var ok = recordSettlePayment(_spModal_recordId, amt, date, note);
  if (ok) {
    closeSettlePayModal();
    if (typeof showCycleToast === 'function') showCycleToast('✅ บันทึกการชำระแล้ว');
    if (typeof renderSettle === 'function') renderSettle();
  }
}

// ─── CARRY-FORWARD HTML BANNER ─────────────────────────────
/**
 * สร้าง HTML แสดงยอดค้างจากเดือนก่อน (แทรกเหนือส่วน transfer)
 */
function buildCarryForwardBanner(currentMonth) {
  var records = getCarryForwardRecords(currentMonth);
  if (!records.length) return '';

  var rows = records.map(function(r) {
    var remaining = r.amount_owed - r.amount_paid;
    var statusLabel = r.status === 'partial'
      ? '<span style="color:#FFC857;font-size:10px;font-weight:700">จ่ายบางส่วน</span>'
      : '<span style="color:#FF4D6D;font-size:10px;font-weight:700">ยังไม่จ่าย</span>';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;'
      + 'border-bottom:1px solid var(--line);gap:8px">'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:600;color:var(--ink)">'
          + (r.from_name || r.from_uid) + ' → ' + (r.to_name || r.to_uid)
        + '</div>'
        + '<div style="font-size:10px;color:var(--ink3);margin-top:1px">เดือน ' + r.month + ' · ' + statusLabel + '</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
        + '<span style="font-family:monospace;font-size:13px;font-weight:700;color:#FFC857">' + fmtH(remaining) + '</span>'
        + '<button onclick="openSettlePayModal(\'' + r.id + '\')" '
          + 'style="padding:4px 10px;background:rgba(0,245,255,.12);color:#00F5FF;border:1px solid rgba(0,245,255,.35);'
          + 'border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;'
          + 'white-space:nowrap;touch-action:manipulation">💳 จ่าย</button>'
        + '<button onclick="deleteSettleRecord(\'' + r.id + '\')" '
          + 'style="padding:4px 6px;background:none;border:none;color:var(--ink3);font-size:14px;cursor:pointer;'
          + 'touch-action:manipulation" title="ลบ">×</button>'
      + '</div>'
    + '</div>';
  }).join('');

  return '<div style="background:rgba(255,200,87,.08);border:1px solid rgba(255,200,87,.35);'
    + 'border-radius:14px;overflow:hidden;margin-bottom:14px">'
    + '<div style="padding:8px 14px;border-bottom:1px solid rgba(255,200,87,.25);'
      + 'display:flex;align-items:center;justify-content:space-between">'
      + '<div style="font-size:11px;font-weight:800;color:#FFC857;letter-spacing:.5px;text-transform:uppercase">'
        + '⏳ ยอดค้างจากเดือนก่อน · ' + records.length + ' รายการ'
      + '</div>'
      + '<span style="font-family:monospace;font-size:12px;font-weight:700;color:#FFC857">'
        + fmtH(records.reduce(function(s, r) { return s + (r.amount_owed - r.amount_paid); }, 0))
      + '</span>'
    + '</div>'
    + rows
  + '</div>';
}
