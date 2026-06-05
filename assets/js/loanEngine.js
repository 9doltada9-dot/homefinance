/* HomeFinance · loanEngine.js v1.0
 * Loan Tracking — ให้ยืม / ยืม / รับคืน / คืนเงิน
 * ใช้ระบบ accounts + transfer ที่มีอยู่
 */

// ─── CONSTANTS ────────────────────────────────────────────
var LOAN_ACCOUNT_TYPE = 'loan';

// ─── HELPERS ──────────────────────────────────────────────
function getLoanAccounts() {
  return (typeof accountsData !== 'undefined' ? accountsData : [])
    .filter(function(a) { return a.type === LOAN_ACCOUNT_TYPE && a.is_active; });
}

function getLoanBalance(accountId) {
  return typeof getAccountBalance === 'function' ? getAccountBalance(accountId) : 0;
}

// ─── CREATE LOAN ACCOUNT ──────────────────────────────────
/**
 * สร้าง loan account ใหม่
 * direction: 'lent' = เราให้ยืม (ลูกหนี้) | 'borrowed' = เรายืม (เจ้าหนี้)
 */
async function createLoanAccount(counterpartName, direction, note) {
  if (!counterpartName || !counterpartName.trim()) return null;
  var prefix = direction === 'lent' ? 'ลูกหนี้' : 'เจ้าหนี้';
  var acct = {
    id:              'loan-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name:            prefix + ' – ' + counterpartName.trim(),
    type:            LOAN_ACCOUNT_TYPE,
    loan_direction:  direction,       // lent | borrowed
    loan_counterpart:counterpartName.trim(),
    initial_balance: 0,
    is_active:       true,
    note:            note || '',
    logo_url:        '',
  };
  if (typeof accountsData !== 'undefined') accountsData.push(acct);
  if (typeof saveAccountsLocal === 'function') saveAccountsLocal();
  if (typeof sbSyncAccount     === 'function') await sbSyncAccount(acct, 'add');
  return acct;
}

// ─── LEND MONEY (ให้ยืม) ──────────────────────────────────
/**
 * ให้คนอื่นยืมเงินจากบัญชีของเรา
 * → transfer: fromAccountId → loanAccountId (+ลูกหนี้)
 */
async function lendMoney(fromAccountId, counterpartName, amount, dateStr, note) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var loanAcct = await _findOrCreateLoanAccount(counterpartName, 'lent', note);
  if (!loanAcct) return;
  if (typeof addTransfer === 'function') {
    await addTransfer(fromAccountId, loanAcct.id, amount, dateStr,
      '📤 ให้ยืม: ' + counterpartName + (note ? ' · ' + note : ''));
  }
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderLoanList      === 'function') renderLoanList();
  if (typeof showCycleToast      === 'function')
    showCycleToast('📤 ให้ยืม ' + (typeof fmtH === 'function' ? fmtH(amount) : amount) + ' แก่ ' + counterpartName);
}

/**
 * รับเงินคืนจากลูกหนี้
 * → transfer: loanAccountId → toAccountId (-ลูกหนี้)
 */
async function receiveLoanRepayment(loanAccountId, toAccountId, amount, dateStr, note) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var loanAcct = (typeof accountsData !== 'undefined' ? accountsData : [])
    .find(function(a) { return a.id === loanAccountId; });
  if (!loanAcct) return;
  if (typeof addTransfer === 'function') {
    await addTransfer(loanAccountId, toAccountId, amount, dateStr,
      '📥 รับคืน: ' + (loanAcct.loan_counterpart || loanAcct.name) + (note ? ' · ' + note : ''));
  }
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderLoanList      === 'function') renderLoanList();
  if (typeof showCycleToast      === 'function')
    showCycleToast('📥 รับคืน ' + (typeof fmtH === 'function' ? fmtH(amount) : amount) + ' จาก ' + (loanAcct.loan_counterpart || loanAcct.name));
}

/**
 * ยืมเงินจากคนอื่น (รับเงินเข้าบัญชีเรา)
 * → transfer: loanAccountId(เจ้าหนี้) → toAccountId
 */
async function borrowMoney(toAccountId, counterpartName, amount, dateStr, note) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var loanAcct = await _findOrCreateLoanAccount(counterpartName, 'borrowed', note);
  if (!loanAcct) return;
  if (typeof addTransfer === 'function') {
    await addTransfer(loanAcct.id, toAccountId, amount, dateStr,
      '💸 ยืม: ' + counterpartName + (note ? ' · ' + note : ''));
  }
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderLoanList      === 'function') renderLoanList();
  if (typeof showCycleToast      === 'function')
    showCycleToast('💸 ยืมเงิน ' + (typeof fmtH === 'function' ? fmtH(amount) : amount) + ' จาก ' + counterpartName);
}

/**
 * คืนเงินให้เจ้าหนี้
 * → transfer: fromAccountId → loanAccountId(เจ้าหนี้)
 */
async function repayBorrowedMoney(loanAccountId, fromAccountId, amount, dateStr, note) {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var loanAcct = (typeof accountsData !== 'undefined' ? accountsData : [])
    .find(function(a) { return a.id === loanAccountId; });
  if (!loanAcct) return;
  if (typeof addTransfer === 'function') {
    await addTransfer(fromAccountId, loanAccountId, amount, dateStr,
      '💳 คืนเงิน: ' + (loanAcct.loan_counterpart || loanAcct.name) + (note ? ' · ' + note : ''));
  }
  if (typeof renderAccountCards === 'function') renderAccountCards();
  if (typeof renderLoanList      === 'function') renderLoanList();
  if (typeof showCycleToast      === 'function')
    showCycleToast('💳 คืนเงิน ' + (typeof fmtH === 'function' ? fmtH(amount) : amount) + ' ให้ ' + (loanAcct.loan_counterpart || loanAcct.name));
}

// ─── FIND OR CREATE LOAN ACCOUNT ──────────────────────────
async function _findOrCreateLoanAccount(counterpartName, direction, note) {
  var name = counterpartName.trim();
  var prefix = direction === 'lent' ? 'ลูกหนี้' : 'เจ้าหนี้';
  var existing = (typeof accountsData !== 'undefined' ? accountsData : [])
    .find(function(a) {
      return a.type === LOAN_ACCOUNT_TYPE
          && a.loan_direction === direction
          && a.loan_counterpart === name
          && a.is_active;
    });
  return existing || (await createLoanAccount(name, direction, note));
}

// ─── CLOSE LOAN ACCOUNT ───────────────────────────────────
async function closeLoanAccount(accountId) {
  var bal = getLoanBalance(accountId);
  if (Math.abs(bal) > 0.5) {
    if (!confirm('ยอดคงเหลือในบัญชีนี้ยังไม่เป็น 0 (' + (typeof fmtH === 'function' ? fmtH(bal) : bal) + ')\nยืนยันปิดบัญชีหรือไม่?')) return;
  }
  var acct = (typeof accountsData !== 'undefined' ? accountsData : [])
    .find(function(a) { return a.id === accountId; });
  if (!acct) return;
  acct.is_active = false;
  if (typeof saveAccountsLocal   === 'function') saveAccountsLocal();
  if (typeof sbSyncAccount       === 'function') await sbSyncAccount(acct, 'update');
  if (typeof renderAccountCards  === 'function') renderAccountCards();
  if (typeof renderLoanList      === 'function') renderLoanList();
  if (typeof showCycleToast      === 'function') showCycleToast('✅ ปิดบัญชีกู้ยืมแล้ว');
}

// ─── RENDER LOAN LIST ─────────────────────────────────────
function renderLoanList() {
  var box = document.getElementById('loanList');
  if (!box) return;
  var loans = getLoanAccounts();
  if (!loans.length) {
    box.innerHTML = '<div style="text-align:center;padding:20px 12px;color:var(--ink3);font-size:13px">'
      + 'ยังไม่มีรายการกู้ยืม<br>'
      + '<span style="font-size:12px">กด "+ ให้ยืม" หรือ "+ ยืม" เพื่อเริ่มต้น</span>'
      + '</div>';
    return;
  }

  // แยก lent / borrowed
  var lentList     = loans.filter(function(a) { return a.loan_direction === 'lent'; });
  var borrowedList = loans.filter(function(a) { return a.loan_direction === 'borrowed'; });

  function renderSection(list, dir) {
    if (!list.length) return '';
    var icon  = dir === 'lent' ? '📤' : '💸';
    var label = dir === 'lent' ? 'เราให้ยืม (ลูกหนี้)' : 'เรายืม (เจ้าหนี้)';
    var items = list.map(function(a) {
      var bal = getLoanBalance(a.id);
      var isSettled = Math.abs(bal) < 0.5;
      var balColor  = isSettled ? 'var(--green)' : (dir === 'lent' ? '#00F5FF' : '#FF4D6D');
      var balLabel  = isSettled ? '✅ คืนครบแล้ว' : (dir === 'lent' ? 'ยังค้าง' : 'ยังค้าง');
      var actionBtn = isSettled
        ? '<button onclick="closeLoanAccount(\'' + a.id + '\')" '
            + 'style="padding:5px 10px;background:none;border:1px solid var(--line);color:var(--ink3);'
            + 'border-radius:8px;font-size:11px;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">ปิดบัญชี</button>'
        : (dir === 'lent'
            ? '<button onclick="openLoanRepayModal(\'' + a.id + '\')" '
                + 'style="padding:5px 10px;background:rgba(0,245,255,.12);color:#00F5FF;border:1px solid rgba(0,245,255,.35);'
                + 'border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">📥 รับคืน</button>'
            : '<button onclick="openLoanRepayModal(\'' + a.id + '\')" '
                + 'style="padding:5px 10px;background:rgba(255,77,109,.12);color:#FF4D6D;border:1px solid rgba(255,77,109,.35);'
                + 'border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">💳 คืนเงิน</button>');
      return '<div style="display:flex;align-items:center;padding:11px 0;border-bottom:1px solid var(--line);gap:10px">'
        + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:13px;font-weight:600;color:var(--ink)">' + (a.loan_counterpart || a.name) + '</div>'
          + '<div style="font-size:11px;color:var(--ink3);margin-top:2px">'
            + (a.note ? '📝 ' + a.note + ' · ' : '')
            + '<span style="color:' + balColor + ';font-weight:700">' + balLabel + '</span>'
          + '</div>'
        + '</div>'
        + '<div style="flex-shrink:0;text-align:right;margin-right:8px">'
          + '<div style="font-family:monospace;font-size:15px;font-weight:800;color:' + balColor + '">'
            + (typeof fmtH === 'function' ? fmtH(Math.abs(bal)) : Math.abs(bal))
          + '</div>'
        + '</div>'
        + actionBtn
      + '</div>';
    }).join('');

    return '<div style="margin-bottom:14px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--ink2);text-transform:uppercase;'
        + 'letter-spacing:.5px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--line)">'
        + icon + ' ' + label
      + '</div>'
      + items
    + '</div>';
  }

  box.innerHTML = renderSection(lentList, 'lent') + renderSection(borrowedList, 'borrowed');
}

// ─── MODAL LOGIC ──────────────────────────────────────────
var _loanModalMode    = 'lend';    // lend | borrow
var _loanRepayAcctId  = null;

function openLoanModal(mode) {
  _loanModalMode = mode || 'lend';
  var titleEl = document.getElementById('loanModalTitle');
  if (titleEl) titleEl.textContent = mode === 'lend' ? '📤 ให้ยืมเงิน' : '💸 ยืมเงิน';
  var lbl = document.getElementById('loanCounterpartLabel');
  if (lbl) lbl.textContent = mode === 'lend' ? 'ชื่อผู้ยืม' : 'ชื่อเจ้าหนี้';

  // reset
  ['loanCounterpart','loanAmt','loanNote'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var dateEl = document.getElementById('loanDate');
  if (dateEl) dateEl.value = (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0,10));

  // fill account selector
  _fillLoanAccountSelector('loanFromAccount');
  if (typeof _openModal === 'function') _openModal('loanModal');
}

function closeLoanModal() {
  if (typeof _closeModal === 'function') _closeModal('loanModal');
}

async function submitLoanModal() {
  if (typeof checkOnlineForAction === 'function' && !checkOnlineForAction()) return;
  var counterpart = (document.getElementById('loanCounterpart').value || '').trim();
  var amt  = parseFloat(document.getElementById('loanAmt').value)  || 0;
  var date = document.getElementById('loanDate').value || new Date().toISOString().slice(0,10);
  var note = (document.getElementById('loanNote').value || '').trim();
  var acctId = document.getElementById('loanFromAccount').value;

  if (!counterpart) { if (typeof showCycleToast === 'function') showCycleToast('⚠️ ระบุชื่อ'); return; }
  if (!amt || amt <= 0) { if (typeof showCycleToast === 'function') showCycleToast('⚠️ ระบุจำนวนเงิน'); return; }
  if (!acctId) { if (typeof showCycleToast === 'function') showCycleToast('⚠️ เลือกบัญชี'); return; }

  closeLoanModal();
  if (_loanModalMode === 'lend') {
    await lendMoney(acctId, counterpart, amt, date, note);
  } else {
    await borrowMoney(acctId, counterpart, amt, date, note);
  }
}

// ─── REPAY MODAL ──────────────────────────────────────────
function openLoanRepayModal(loanAccountId) {
  _loanRepayAcctId = loanAccountId;
  var acct = (typeof accountsData !== 'undefined' ? accountsData : [])
    .find(function(a) { return a.id === loanAccountId; });
  if (!acct) return;

  var bal = getLoanBalance(loanAccountId);
  var isLent = acct.loan_direction === 'lent';
  var titleEl = document.getElementById('loanRepayTitle');
  if (titleEl) titleEl.textContent = isLent ? '📥 บันทึกรับคืน' : '💳 บันทึกคืนเงิน';

  var infoEl = document.getElementById('loanRepayInfo');
  if (infoEl) {
    infoEl.innerHTML =
      '<div style="background:var(--surface2);border-radius:10px;padding:10px 14px;margin-bottom:10px">'
      + '<div style="font-size:12px;color:var(--ink3)">บัญชี: <b>' + acct.name + '</b></div>'
      + '<div style="font-size:13px;font-weight:700;color:' + (isLent ? '#00F5FF' : '#FF4D6D') + ';margin-top:4px">'
        + 'ยอดค้าง: ' + (typeof fmtH === 'function' ? fmtH(Math.abs(bal)) : Math.abs(bal))
      + '</div>'
      + '</div>';
  }

  var amtEl  = document.getElementById('loanRepayAmt');
  var dateEl = document.getElementById('loanRepayDate');
  var noteEl = document.getElementById('loanRepayNote');
  if (amtEl)  amtEl.value  = Math.abs(bal).toFixed(2);
  if (dateEl) dateEl.value = (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0,10));
  if (noteEl) noteEl.value = '';

  _fillLoanAccountSelector('loanRepayToAccount');
  if (typeof _openModal === 'function') _openModal('loanRepayModal');
}

function closeLoanRepayModal() {
  _loanRepayAcctId = null;
  if (typeof _closeModal === 'function') _closeModal('loanRepayModal');
}

async function submitLoanRepay() {
  if (!_loanRepayAcctId) return;
  var amt    = parseFloat(document.getElementById('loanRepayAmt').value) || 0;
  var date   = document.getElementById('loanRepayDate').value || new Date().toISOString().slice(0,10);
  var note   = (document.getElementById('loanRepayNote').value || '').trim();
  var acctId = document.getElementById('loanRepayToAccount').value;

  if (!amt || amt <= 0) { if (typeof showCycleToast === 'function') showCycleToast('⚠️ ระบุจำนวน'); return; }
  if (!acctId) { if (typeof showCycleToast === 'function') showCycleToast('⚠️ เลือกบัญชี'); return; }

  var acct  = (typeof accountsData !== 'undefined' ? accountsData : [])
    .find(function(a) { return a.id === _loanRepayAcctId; });
  if (!acct) return;

  closeLoanRepayModal();
  if (acct.loan_direction === 'lent') {
    await receiveLoanRepayment(_loanRepayAcctId, acctId, amt, date, note);
  } else {
    await repayBorrowedMoney(_loanRepayAcctId, acctId, amt, date, note);
  }
}

// ─── ACCOUNT SELECTOR FILL ────────────────────────────────
function _fillLoanAccountSelector(selId) {
  var sel = document.getElementById(selId);
  if (!sel) return;
  var list = (typeof accountsData !== 'undefined' ? accountsData : [])
    .filter(function(a) { return a.is_active && a.type !== LOAN_ACCOUNT_TYPE; });
  sel.innerHTML = '<option value="">-- เลือกบัญชี --</option>'
    + list.map(function(a) {
        return '<option value="' + a.id + '">' + a.name + '</option>';
      }).join('');
}
