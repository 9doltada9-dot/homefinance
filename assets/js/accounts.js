/* HomeFinance · module: accounts.js · v3.13.8
 * Multi-account management: bank, cash, e-wallet
 * Stored in localStorage (hf2_accounts) + optionally Supabase.
 */

// ─── DEFAULTS & STORAGE ───────────────────────────────────
var ACCOUNT_TYPES = { bank: 'ธนาคาร', cash: 'เงินสด', ewallet: 'E-Wallet' };
var ACCOUNT_COLORS = ['#1a4fa0','#16a34a','#d97706','#7c3aed','#db2777'];

var accountsData = [];

function loadAccountsLocal() {
  try {
    var all = JSON.parse(localStorage.getItem('hf2_accounts') || '[]');
    var uid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
    // กรองเฉพาะบัญชีของ user ปัจจุบันเท่านั้น (ไม่รวมบัญชีที่ user_id=null — เป็น orphaned records)
    accountsData = uid ? all.filter(function(a){ return a.user_id === uid; }) : [];
  }
  catch(_) { accountsData = []; }
  if (!accountsData.length) {
    var _uid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
    // Migration: กู้คืนบัญชีจาก transaction history เพื่อรักษา account_id เดิม ยอดเงินจะลิงก์ถูกต้อง
    var _restored = false;
    if (_uid && typeof db !== 'undefined' && db.length) {
      var _usedIds = {};
      db.forEach(function(e){ if (e.account_id) _usedIds[e.account_id] = true; });
      var _idList = Object.keys(_usedIds);
      if (_idList.length) {
        // v3.16.21: ไม่ใช้ null-user_id legacy accounts อีกต่อไป
        // เพื่อป้องกัน cross-user claim — Supabase คือ source of truth
        accountsData = _idList.map(function(aid){
          return { id: aid, name: 'บัญชีหลัก', type: 'bank', color: '#1a4fa0',
                   initial_balance: 0, is_active: true, user_id: _uid };
        });
        _restored = true;
        // Claim in Supabase ด้วย ignore-duplicates (ถ้า user อื่น claim ก่อนแล้วก็ไม่ overwrite)
        if (typeof sbSyncAccount === 'function') {
          accountsData.forEach(function(acct){ sbSyncAccount(acct, 'claim'); });
        }
      }
    }
    if (!_restored) {
      // ไม่มี transaction เลย → สร้างบัญชีเริ่มต้นใหม่
      accountsData = [{
        id: 'acct-default-' + (_uid || 'anon'),
        name: 'บัญชีหลัก',
        type: 'bank',
        color: '#1a4fa0',
        initial_balance: 0,
        is_active: true,
        user_id: _uid || null,
      }];
    }
    saveAccountsLocal();
  }
}
function saveAccountsLocal() {
  // Merge กับบัญชีของ user อื่นๆ ที่อาจอยู่ใน localStorage ด้วย
  var uid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
  if (uid) {
    try {
      var all = JSON.parse(localStorage.getItem('hf2_accounts') || '[]');
      var others = all.filter(function(a){ return a.user_id && a.user_id !== uid; });
      localStorage.setItem('hf2_accounts', JSON.stringify(others.concat(accountsData)));
      return;
    } catch(_) {}
  }
  localStorage.setItem('hf2_accounts', JSON.stringify(accountsData));
}

// ─── CRUD ─────────────────────────────────────────────────
function addAccount(name, type, color, initialBalance) {
  var acct = {
    id: 'acct-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: (name || 'บัญชีใหม่').trim(),
    type: type || 'bank',
    color: color || ACCOUNT_COLORS[accountsData.length % ACCOUNT_COLORS.length],
    initial_balance: Number(initialBalance) || 0,
    is_active: true,
    user_id: (typeof getAuthUserId === 'function' ? getAuthUserId() : null) || null,
  };
  accountsData.push(acct);
  saveAccountsLocal();
  sbSyncAccount(acct, 'add');
  return acct;
}

function updateAccount(id, fields) {
  var acct = accountsData.find(function(a) { return a.id === id; });
  if (!acct) return;
  Object.assign(acct, fields);
  saveAccountsLocal();
  sbSyncAccount(acct, 'update');
}

function deleteAccount(id) {
  if (accountsData.length <= 1) {
    showCycleToast('⚠️ ต้องมีบัญชีอย่างน้อย 1 บัญชี');
    return;
  }
  // ห้ามลบถ้าบัญชีมีรายการอยู่
  var hasUsage = db.some(function(e) { return e.account_id === id; });
  if (hasUsage) {
    showCycleToast('⚠️ บัญชีนี้มีรายการอยู่ — ลบไม่ได้');
    return;
  }
  if (!confirm('ลบบัญชีนี้?')) return;
  var acct = accountsData.find(function(a) { return a.id === id; });
  accountsData = accountsData.filter(function(a) { return a.id !== id; });
  saveAccountsLocal();
  if (acct) sbSyncAccount(acct, 'delete');
}

// ─── BALANCE CALCULATION ──────────────────────────────────
function getAccountBalance(accountId) {
  var acct = accountsData.find(function(a) { return a.id === accountId; });
  if (!acct) return 0;
  var base = acct.initial_balance || 0;
  // กรองเฉพาะ user ปัจจุบัน
  var _gaUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _gaDb  = _gaUid ? db.filter(function(e){ return (e.user_id||e.person) === _gaUid; }) : db;
  // income adds, expense deducts
  var txBalance = _gaDb.filter(function(e) {
    return (e.account_id === accountId) && e.status !== 'cancelled';
  }).reduce(function(s, e) {
    if (e.type === 'income' && e.status !== 'pending') return s + e.amt;
    if (e.type === 'expense') return s - e.amt;
    if (e.type === 'transfer') {
      // handled by paired entries
      if (e.transfer_direction === 'out') return s - e.amt;
      if (e.transfer_direction === 'in')  return s + e.amt;
    }
    return s;
  }, 0);
  return base + txBalance;
}

function getTotalBalance() {
  return accountsData
    .filter(function(a) { return a.is_active; })
    .reduce(function(s, a) { return s + getAccountBalance(a.id); }, 0);
}

// ─── TRANSFER ─────────────────────────────────────────────
async function addTransfer(fromAccountId, toAccountId, amount, dateStr, note) {
  if (!checkOnlineForAction()) return;
  var id = 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var fromAcct = accountsData.find(function(a){ return a.id === fromAccountId; });
  var toAcct   = accountsData.find(function(a){ return a.id === toAccountId; });
  var fromName = fromAcct ? fromAcct.name : fromAccountId;
  var toName   = toAcct   ? toAcct.name   : toAccountId;
  var base = {
    date:       dateStr,
    type:       'transfer',
    cat_id:     null, cat_name: 'โอนเงิน',
    desc:       '↔ ' + fromName + ' → ' + toName,
    transfer_from_name: fromName,
    transfer_to_name:   toName,
    amt:        Number(amount) || 0,
    person:     (typeof getCurrentPerson==='function' ? getCurrentPerson() : (persons[0] ? persons[0].id : null)),
    split:      false,
    status:     'paid',
    note:       note || '',
    cycle_id:   (typeof cycleIdFromDate==='function' ? cycleIdFromDate(dateStr) : null),
    billing_month: (typeof defaultBillingMonth==='function' ? defaultBillingMonth(dateStr) : dateStr.slice(0,7)),
  };
  // OUT entry
  var outEntry = Object.assign({}, base, {
    id: id + '-out',
    account_id: fromAccountId,
    transfer_direction: 'out',
    transfer_pair_id: id + '-in',
  });
  // IN entry
  var inEntry = Object.assign({}, base, {
    id: id + '-in',
    account_id: toAccountId,
    transfer_direction: 'in',
    transfer_pair_id: id + '-out',
  });
  var _okOut = await sbAdd(outEntry);
  if(!_okOut) return;
  var _okIn = await sbAdd(inEntry);
  if(!_okIn) return;
  db.push(outEntry);
  db.push(inEntry);
  save();
  showCycleToast('โอนเงิน ' + fmtH(amount) + ' บาท เรียบร้อย');
}

// ─── SUPABASE SYNC ────────────────────────────────────────
async function sbSyncAccount(acct, action) {
  var creds = getSbCreds();
  if (!creds.ok) return;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    if (action === 'add' || action === 'update') {
      await fetch(creds.url + '/rest/v1/accounts', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify([acct]),
      });
    } else if (action === 'claim') {
      // Migration claim — ignore-duplicates: ถ้ามีคนอื่น claim บัญชีนี้ไปก่อนแล้วจะไม่ overwrite
      var claimHeaders = Object.assign({}, sbHeadersFrom(creds.key),
        { 'Prefer': 'resolution=ignore-duplicates,return=minimal' });
      await fetch(creds.url + '/rest/v1/accounts', {
        method: 'POST',
        headers: claimHeaders,
        body: JSON.stringify([acct]),
      });
    } else if (action === 'delete') {
      var _delUid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
      var _delFilter = '?id=eq.' + encodeURIComponent(acct.id) +
                       (_delUid ? '&user_id=eq.' + encodeURIComponent(_delUid) : '');
      await fetch(creds.url + '/rest/v1/accounts' + _delFilter, {
        method: 'DELETE',
        headers: sbHeadersFrom(creds.key),
      });
    }
  } catch(_) {}
}

async function sbLoadAccounts() {
  var creds = getSbCreds();
  if (!creds.ok) return null;
  try {
    var uid = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
    var filter = uid ? '&user_id=eq.' + encodeURIComponent(uid) : '';
    var r = await fetch(creds.url + '/rest/v1/accounts?select=*&order=created_at' + filter, {
      headers: sbHeadersFrom(creds.key)
    });
    if (!r.ok) return null;
    return await r.json();
  } catch(_) { return null; }
}

// ─── FILL SELECTORS ───────────────────────────────────────
function fillAccountSelectors() {
  ['fAccount', 'eAccount', 'transferFrom', 'transferTo', 'newGoalAccount'].forEach(function(id) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var cur = sel.value;
    var isTransfer = id === 'transferFrom' || id === 'transferTo';
    sel.innerHTML = (isTransfer ? '' : '<option value="">-- ไม่ระบุ --</option>') +
      accountsData.filter(function(a) { return a.is_active; }).map(function(a) {
        return '<option value="' + a.id + '">' +
               '<span style="color:' + a.color + '">●</span> ' + a.name +
               ' (' + (ACCOUNT_TYPES[a.type] || a.type) + ')' +
               '</option>';
      }).join('');
    if (cur) {
      sel.value = cur;
    } else if (id === 'fAccount' || id === 'eAccount') {
      // ค่าเริ่มต้น: บัญชีธนาคารแรกที่ active
      var defAcct = accountsData.filter(function(a){ return a.is_active; })
        .find(function(a){ return a.type === 'bank'; });
      if (defAcct) sel.value = defAcct.id;
    }
  });
}

// ─── RENDER ACCOUNT CARDS (Dashboard) ────────────────────
function renderAccountCards() {
  var el = document.getElementById('accountCards');
  if (!el) return;
  var _rcUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _rcAccts = _rcUid ? accountsData.filter(function(a){ return a.user_id === _rcUid; }) : accountsData;
  var active = _rcAccts.filter(function(a){ return a.is_active !== false; });
  if (!active.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';

  var total = active.reduce(function(s,a){ return s + getAccountBalance(a.id); }, 0);
  var TYPE_ICON = { bank:'🏦', cash:'💵', ewallet:'📱' };

  // แถวบัตรบัญชี — horizontal scroll เหมือน metric row
  el.innerHTML =
    '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;margin-bottom:16px;'
      +'scrollbar-width:none;-webkit-overflow-scrolling:touch">'

      // card รวม (สีฟ้า)
      +'<div onclick="nav(\'accounts\')" style="flex-shrink:0;min-width:130px;cursor:pointer;'
        +'background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);'
        +'padding:14px 16px;border-top:3px solid #1a4fa0">'
        +'<div style="font-size:11px;color:var(--ink3);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">ยอดรวม</div>'
        +'<div style="font-size:19px;font-weight:700;font-family:monospace;letter-spacing:-.5px;color:'+(total>=0?'var(--green)':'var(--red)')+'">'+fmtH(total)+'</div>'
        +'<div style="font-size:11px;color:var(--ink3);margin-top:3px">'+active.length+' บัญชี</div>'
      +'</div>'

      // card แต่ละบัญชี
      + active.map(function(a){
          var bal = getAccountBalance(a.id);
          var icon = TYPE_ICON[a.type] || '💳';
          return '<div onclick="nav(\'accounts\')" style="flex-shrink:0;min-width:130px;cursor:pointer;'
            +'background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);'
            +'padding:14px 16px;border-top:3px solid '+a.color+'">'
            +'<div style="font-size:11px;color:var(--ink3);font-weight:500;text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">'
              +icon+' '+a.name
            +'</div>'
            +'<div style="font-size:19px;font-weight:700;font-family:monospace;letter-spacing:-.5px;color:'+(bal>=0?'var(--green)':'var(--red)')+'">'+fmtH(bal)+'</div>'
            +'<div style="font-size:11px;color:var(--ink3);margin-top:3px">'+(ACCOUNT_TYPES[a.type]||a.type)+'</div>'
          +'</div>';
        }).join('')

    +'</div>';
}

// ─── TRANSFER MODAL ───────────────────────────────────────
function openTransferModal() {
  var modal = document.getElementById('transferModal');
  if (!modal) return;
  fillAccountSelectors();
  document.getElementById('transferAmt').value = '';
  document.getElementById('transferNote').value = '';
  document.getElementById('transferDate').value = new Date().toISOString().slice(0, 10);
  _openModal('transferModal');
}
function closeTransferModal() {
  _closeModal('transferModal');
}
function doTransfer() {
  var from = document.getElementById('transferFrom').value;
  var to   = document.getElementById('transferTo').value;
  var amt  = parseFloat(document.getElementById('transferAmt').value);
  var date = document.getElementById('transferDate').value;
  var note = document.getElementById('transferNote').value;
  if (!from || !to) { showCycleToast('⚠️ เลือกบัญชีต้นทางและปลายทาง'); return; }
  if (from === to)  { showCycleToast('⚠️ บัญชีต้นทางและปลายทางต้องต่างกัน'); return; }
  if (!amt || amt <= 0) { showCycleToast('⚠️ ระบุจำนวนเงินที่ถูกต้อง'); return; }
  addTransfer(from, to, amt, date, note);
  closeTransferModal();
  renderAccountCards();
  renderAccountList();  // 3.1: refresh ยอดทันที
}

// ─── DEPOSIT ──────────────────────────────────────────────
function openDepositModal(accountId) {
  document.getElementById('depositAccountId').value = accountId;
  document.getElementById('depositAmt').value = '';
  document.getElementById('depositDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('depositNote').value = '';
  _openModal('depositModal');
}
function closeDepositModal() {
  _closeModal('depositModal');
}
async function doDeposit() {
  var accountId = document.getElementById('depositAccountId').value;
  var amt  = parseFloat(document.getElementById('depositAmt').value);
  var date = document.getElementById('depositDate').value;
  var note = document.getElementById('depositNote').value;
  if (!amt || amt <= 0) { showCycleToast('⚠️ ระบุจำนวนเงิน'); return; }
  var acct = accountsData.find(function(a) { return a.id === accountId; });
  var id = 'tx-dep-' + Date.now();
  var entry = {
    id: id, date: date, type: 'income',
    cat_id: null, cat_name: 'ฝากเงิน',
    desc: 'ฝากเงิน' + (acct ? ' – ' + acct.name : ''),
    amt: amt, person: (typeof getCurrentPerson==='function' ? getCurrentPerson() : null),
    split: false, status: 'received', note: note || '',
    account_id: accountId,
    cycle_id: (typeof cycleIdFromDate==='function' ? cycleIdFromDate(date) : null),
    billing_month: (typeof defaultBillingMonth==='function' ? defaultBillingMonth(date) : date.slice(0,7)),
  };
  var _okDep = await sbAdd(entry);
  if(!_okDep) return;
  db.push(entry);
  save();
  closeDepositModal();
  renderAccountCards();
  renderAccountList();
  showCycleToast('ฝากเงิน ' + fmtH(amt) + ' บาท เรียบร้อย');
}

// ─── EDIT ACCOUNT ─────────────────────────────────────────
function openEditAccountModal(id) {
  var acct = accountsData.find(function(a) { return a.id === id; });
  if (!acct) return;
  document.getElementById('editAcctId').value = id;
  document.getElementById('editAcctName').value = acct.name;
  document.getElementById('editAcctType').value = acct.type || 'bank';
  _openModal('editAccountModal');
}
function closeEditAccountModal() {
  _closeModal('editAccountModal');
}
function doEditAccount() {
  var id   = document.getElementById('editAcctId').value;
  var name = (document.getElementById('editAcctName').value || '').trim();
  var type = document.getElementById('editAcctType').value;
  if (!name) { showCycleToast('⚠️ ระบุชื่อบัญชี'); return; }
  updateAccount(id, { name: name, type: type });
  closeEditAccountModal();
  renderAccountList();
  renderAccountCards();
  showCycleToast('แก้ไขบัญชีแล้ว');
}

// ─── ADJUST BALANCE ───────────────────────────────────────
function openAdjustModal(accountId) {
  var acct = accountsData.find(function(a) { return a.id === accountId; });
  if (!acct) return;
  var currentBal = getAccountBalance(accountId);
  document.getElementById('adjustAcctId').value = accountId;
  document.getElementById('adjustCurrentBal').innerHTML = fmtH(currentBal) + ' บาท';
  document.getElementById('adjustCurrentBal').style.color = currentBal >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('adjustTargetAmt').value = '';
  document.getElementById('adjustDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('adjustNote').value = '';
  document.getElementById('adjustDiffBox').style.display = 'none';
  _openModal('adjustModal');
}
function closeAdjustModal() {
  _closeModal('adjustModal');
}
function updateAdjustDiff() {
  var accountId = document.getElementById('adjustAcctId').value;
  var targetVal = document.getElementById('adjustTargetAmt').value;
  var diffBox   = document.getElementById('adjustDiffBox');
  var diffLabel = document.getElementById('adjustDiffLabel');
  if (targetVal === '' || targetVal === null) { diffBox.style.display = 'none'; return; }
  var target    = parseFloat(targetVal);
  var current   = getAccountBalance(accountId);
  var diff      = target - current;
  if (isNaN(diff)) { diffBox.style.display = 'none'; return; }
  if (Math.abs(diff) < 0.01) {
    diffBox.style.display = 'block';
    diffBox.style.background = 'var(--surface2)';
    diffLabel.innerHTML = '✓ ยอดตรงกันอยู่แล้ว ไม่ต้องปรับ';
    diffLabel.style.color = 'var(--ink3)';
  } else if (diff > 0) {
    diffBox.style.display = 'block';
    diffBox.style.background = 'var(--green-bg)';
    diffLabel.innerHTML = '📥 ปรับเพิ่ม <strong style="font-family:monospace">+' + fmtH(diff) + ' บาท</strong> (บันทึกเป็นรายรับ)';
    diffLabel.style.color = 'var(--green)';
  } else {
    diffBox.style.display = 'block';
    diffBox.style.background = 'var(--red-bg,#fff0f0)';
    diffLabel.innerHTML = '📤 ปรับลด <strong style="font-family:monospace">−' + fmtH(Math.abs(diff)) + ' บาท</strong> (บันทึกเป็นรายจ่าย)';
    diffLabel.style.color = 'var(--red)';
  }
}
async function doAdjustBalance() {
  var accountId = document.getElementById('adjustAcctId').value;
  var targetVal = parseFloat(document.getElementById('adjustTargetAmt').value);
  var date      = document.getElementById('adjustDate').value;
  var note      = document.getElementById('adjustNote').value;
  if (isNaN(targetVal)) { showCycleToast('⚠️ ระบุยอดที่ถูกต้อง'); return; }
  var current = getAccountBalance(accountId);
  var diff    = targetVal - current;
  if (Math.abs(diff) < 0.01) {
    showCycleToast('✓ ยอดตรงกันอยู่แล้ว ไม่ต้องปรับ');
    closeAdjustModal();
    return;
  }
  var acct = accountsData.find(function(a) { return a.id === accountId; });
  var entryType = diff > 0 ? 'income' : 'expense';
  var id = 'tx-adj-' + Date.now();
  var entry = {
    id: id, date: date,
    type: entryType,
    cat_id: null, cat_name: 'ปรับยอดบัญชี',
    desc: 'ปรับยอด' + (acct ? ' – ' + acct.name : '') + ' (' + (diff > 0 ? '+' : '') + fmtH(diff) + ')',
    amt: Math.abs(diff),
    person: (typeof getCurrentPerson === 'function' ? getCurrentPerson() : null),
    split: false, status: entryType === 'income' ? 'received' : 'paid',
    note: note || '',
    account_id: accountId,
    cycle_id: (typeof cycleIdFromDate === 'function' ? cycleIdFromDate(date) : null),
    billing_month: (typeof defaultBillingMonth === 'function' ? defaultBillingMonth(date) : date.slice(0, 7)),
  };
  var _okAdj = await sbAdd(entry);
  if(!_okAdj) return;
  db.push(entry);
  save();
  closeAdjustModal();
  renderAccountCards();
  renderAccountList();
  if (typeof renderDash === 'function') renderDash();
  showCycleToast('ปรับยอด ' + (diff > 0 ? '+' : '') + fmtH(diff) + ' บาท เรียบร้อย');
}

// ─── SETTINGS: ACCOUNT LIST ───────────────────────────────
var _currentDetailAcctId = null;

function renderAccountList() {
  var el = document.getElementById('accountList');
  if (!el) return;

  var GROUPS = [
    { key:'bank',    label:'🏦 ธนาคาร',  icon:'🏦' },
    { key:'ewallet', label:'📱 E-Wallet', icon:'📱' },
    { key:'cash',    label:'💵 เงินสด',   icon:'💵' },
  ];
  var buckets = {};
  GROUPS.forEach(function(g){ buckets[g.key] = []; });
  accountsData.forEach(function(a){
    if (buckets[a.type]) buckets[a.type].push(a);
    else buckets['bank'].push(a);
  });

  var TYPE_ICON = { bank:'🏦', cash:'💵', ewallet:'📱' };

  var groupsHtml = GROUPS.filter(function(g){ return buckets[g.key].length; }).map(function(g){
    var list = buckets[g.key];
    var groupTotal = list.reduce(function(s,a){ return s + getAccountBalance(a.id); }, 0);

    var cardsHtml = list.map(function(a){
      var bal = getAccountBalance(a.id);
      var icon = TYPE_ICON[a.type] || '💳';
      var hasUsage = db.some(function(e){ return e.account_id === a.id; });
      var cantDel  = hasUsage || accountsData.filter(function(x){ return x.is_active !== false; }).length <= 1;
      return '<div style="background:var(--surface2);border-radius:var(--r2);padding:14px 12px;border:1.5px solid var(--line);border-top:3px solid '+a.color+'">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
          +'<div style="font-size:22px">'+icon+'</div>'
          +'<div style="flex:1;min-width:0">'
            +'<div style="font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+a.name+'</div>'
            +'<div style="font-size:10px;color:var(--hf-ink3)">'+(ACCOUNT_TYPES[a.type]||a.type)+'</div>'
          +'</div>'
        +'</div>'
        +'<div style="font-size:17px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;color:'+(bal>=0?'var(--hf-green)':'var(--hf-red)')+';margin-bottom:10px">'+fmtH(bal)+'</div>'
        +'<div style="display:flex;gap:4px;border-top:1px solid var(--line);padding-top:8px">'
          +'<button onclick="openAccountLedger(\''+a.id+'\')" title="รายการ" style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:6px 2px;font-size:12px;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">📋</button>'
          +'<button onclick="openDepositModal(\''+a.id+'\')" title="ฝากเงิน" style="flex:1;background:var(--surface);border:1px solid var(--green);border-radius:6px;padding:6px 2px;font-size:12px;cursor:pointer;color:var(--green);font-family:Sarabun,sans-serif;touch-action:manipulation">+ฝาก</button>'
          +'<button onclick="openAdjustModal(\''+a.id+'\')" title="ปรับยอด" style="flex:1;background:var(--surface);border:1px solid #d97706;border-radius:6px;padding:6px 2px;font-size:12px;cursor:pointer;color:#d97706;font-family:Sarabun,sans-serif;touch-action:manipulation">⚖️</button>'
          +'<button onclick="openEditAccountModal(\''+a.id+'\')" title="แก้ไข" style="flex:1;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:6px 2px;font-size:12px;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">✏️</button>'
          +(cantDel?'':'<button onclick="deleteAccountInline(\''+a.id+'\')" title="ลบ" style="flex:0 0 auto;background:var(--surface);border:1px solid #fca5a5;border-radius:6px;padding:6px 8px;font-size:12px;cursor:pointer;color:var(--red);font-family:Sarabun,sans-serif;touch-action:manipulation">🗑</button>')
        +'</div>'
      +'</div>';
    }).join('');

    return '<div class="hf-card" style="margin-bottom:14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<span style="font-size:13px;font-weight:700;color:var(--hf-ink2)">' + g.label + '</span>'
        + '<span style="font-size:14px;font-weight:700;font-family:\'IBM Plex Mono\',monospace;color:'
        + (groupTotal>=0?'var(--hf-green)':'var(--hf-red)') + '">' + fmtH(groupTotal) + ' ฿</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px">'
      + cardsHtml
      + '</div>'
      + '</div>';
  }).join('');

  var addCardHtml = '<div onclick="openAddAccountModal()" '
    + 'style="cursor:pointer;border:2px dashed var(--line2);border-radius:var(--r2);padding:18px;'
    + 'text-align:center;color:var(--ink3)">'
    + '<div style="font-size:24px;margin-bottom:4px">+</div>'
    + '<div style="font-size:13px;font-weight:600">เพิ่มบัญชีใหม่</div>'
    + '</div>';

  el.innerHTML = groupsHtml + addCardHtml;
}

function openAccountDetailModal(id) {
  var acct = accountsData.find(function(a){ return a.id === id; });
  if (!acct) return;
  _currentDetailAcctId = id;

  var bal = getAccountBalance(id);
  var TYPE_ICON = { bank:'🏦', cash:'💵', ewallet:'📱' };
  var icon = TYPE_ICON[acct.type] || '💳';
  var hasUsage = db.some(function(e){ return e.account_id === id; });

  var header = document.getElementById('acctDetailHeader');
  if (header) {
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">'
        + '<div style="width:48px;height:48px;border-radius:50%;background:' + acct.color + '22;'
        + 'border:2px solid ' + acct.color + ';display:flex;align-items:center;justify-content:center;'
        + 'font-size:22px;flex-shrink:0">' + icon + '</div>'
        + '<div><div style="font-size:16px;font-weight:700;color:var(--ink)">' + acct.name + '</div>'
        + '<div style="font-size:12px;color:var(--ink3)">' + (ACCOUNT_TYPES[acct.type]||acct.type) + '</div></div>'
      + '</div>'
      + '<div style="background:var(--surface2);border-radius:10px;padding:12px 14px;margin-bottom:16px;'
      + 'display:flex;justify-content:space-between;align-items:center">'
        + '<div style="font-size:11px;color:var(--ink3)">ยอดคงเหลือ</div>'
        + '<div style="font-size:22px;font-weight:700;font-family:monospace;color:'
        + (bal>=0?'var(--green)':'var(--red)') + '">' + fmtH(bal) + ' ฿</div>'
      + '</div>';
  }

  var delBtn = document.getElementById('acctDetailDeleteBtn');
  if (delBtn) {
    var cantDel = hasUsage || accountsData.filter(function(a){ return a.is_active; }).length <= 1;
    delBtn.disabled = cantDel;
    delBtn.style.opacity = cantDel ? '.35' : '1';
    delBtn.style.cursor = cantDel ? 'not-allowed' : 'pointer';
  }

  _openModal('accountDetailModal');
}

function closeAccountDetailModal(e) {
  if (e && e.target !== document.getElementById('accountDetailModal')) return;
  _closeModal('accountDetailModal', function() { _currentDetailAcctId = null; });
}

function deleteAccountFromDetail(id) {
  if (!id) return;
  var hasUsage = db.some(function(e){ return e.account_id === id; });
  if (hasUsage) { showCycleToast('⚠️ บัญชีนี้มีรายการอยู่ — ลบไม่ได้'); return; }
  if (accountsData.length <= 1) { showCycleToast('⚠️ ต้องมีบัญชีอย่างน้อย 1 บัญชี'); return; }
  var acct = accountsData.find(function(a){ return a.id === id; });
  _closeModal('accountDetailModal', function() {
    _currentDetailAcctId = null;
    document.getElementById('delConfirmDesc').textContent = 'ลบบัญชี "' + (acct ? acct.name : '') + '" ออกจากระบบ?';
    document.getElementById('delConfirmNote').textContent = 'การลบนี้ไม่สามารถกู้คืนได้';
    var btn = document.getElementById('delConfirmBtn');
    btn.onclick = function(){
      var a = accountsData.find(function(x){ return x.id === id; });
      accountsData = accountsData.filter(function(x){ return x.id !== id; });
      saveAccountsLocal();
      if (a) sbSyncAccount(a, 'delete');
      closeDeleteConfirmModal();
      renderAccountList();
      renderAccountCards();
      showCycleToast('ลบบัญชีแล้ว');
      btn.onclick = execDeleteConfirmed;
    };
    _openModal('deleteConfirmModal');
  });
}

/** ลบบัญชีโดยตรงจากการ์ด (ไม่ผ่าน detail modal) */
function deleteAccountInline(id) {
  var hasUsage = db.some(function(e){ return e.account_id === id; });
  if (hasUsage) { showCycleToast('⚠️ บัญชีนี้มีรายการอยู่ — ลบไม่ได้'); return; }
  if (accountsData.filter(function(a){ return a.is_active !== false; }).length <= 1) {
    showCycleToast('⚠️ ต้องมีบัญชีอย่างน้อย 1 บัญชี'); return;
  }
  var acct = accountsData.find(function(a){ return a.id === id; });
  var descEl = document.getElementById('delConfirmDesc');
  var noteEl = document.getElementById('delConfirmNote');
  if (descEl) descEl.textContent = 'ลบบัญชี "' + (acct ? acct.name : '') + '" ออกจากระบบ?';
  if (noteEl) noteEl.textContent = 'การลบนี้ไม่สามารถกู้คืนได้';
  var btn = document.getElementById('delConfirmBtn');
  var _prev = btn.onclick;
  btn.onclick = function(){
    accountsData = accountsData.filter(function(x){ return x.id !== id; });
    saveAccountsLocal();
    if (acct && typeof sbSyncAccount === 'function') sbSyncAccount(acct, 'delete');
    closeDeleteConfirmModal();
    renderAccountList();
    renderAccountCards();
    showCycleToast('ลบบัญชีแล้ว');
    btn.onclick = _prev;
  };
  _openModal('deleteConfirmModal');
}

/** นำทางไปยังหน้ารายการ กรองตามวันที่และเลื่อนไปหาวันนั้น (เรียกจาก ledger row) */
function navToTxDate(date, accountId) {
  _closeModal('accountLedgerModal', function() {
    _ledgerAccountId = null;
    if (typeof nav === 'function') nav('transactions');
    // switch to calendar mode + set month
    if (typeof _txFilterMode !== 'undefined') _txFilterMode = 'calendar';
    var fltM = document.getElementById('fltMonth');
    if (fltM) { fltM._initialized = true; fltM.value = date.slice(0, 7); }
    if (typeof _updateTxModeUI === 'function') _updateTxModeUI();
    if (typeof renderTx === 'function') renderTx();
    // scroll to the date group
    setTimeout(function() {
      var el = document.getElementById('txdate-' + date);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  });
}

// ─── ADD ACCOUNT MODAL ────────────────────────────────────
function openAddAccountModal() {
  var m = document.getElementById('addAccountModal');
  if (!m) return;
  var nEl = document.getElementById('newAcctName');
  var bEl = document.getElementById('newAcctBalance');
  var tEl = document.getElementById('newAcctType');
  var cEl = document.getElementById('newAcctColor');
  if (nEl) nEl.value = '';
  if (bEl) bEl.value = '';
  if (tEl) tEl.value = 'bank';
  if (cEl) cEl.value = '#1a4fa0';
  var msg = document.getElementById('acctMsg');
  if (msg) msg.textContent = '';
  _openModal('addAccountModal');
  setTimeout(function(){ if (nEl) nEl.focus(); }, 100);
}
function closeAddAccountModal() {
  _closeModal('addAccountModal');
}

// ─── ACCOUNT LEDGER (สมุดรายวัน ต่อบัญชี) ────────────────
var _ledgerAccountId = null;

function openAccountLedger(accountId) {
  var acct = accountsData.find(function(a){ return a.id === accountId; });
  if (!acct) return;
  _ledgerAccountId = accountId;

  // header
  var nameEl = document.getElementById('ledgerAcctName');
  var subEl  = document.getElementById('ledgerAcctSub');
  if (nameEl) nameEl.textContent = acct.name;
  if (subEl)  subEl.innerHTML  = (ACCOUNT_TYPES[acct.type] || acct.type) + ' · ยอดเปิดบัญชี: ' + fmtH(acct.initial_balance || 0) + ' บาท';

  // populate month dropdown from transactions of this account
  var sel = document.getElementById('ledgerMonthFilter');
  if (sel) {
    var _oalUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
    var _oalDb  = _oalUid ? db.filter(function(e){ return (e.user_id||e.person) === _oalUid; }) : db;
    var months = Array.from(new Set(
      _oalDb.filter(function(e){ return e.account_id === accountId && e.status !== 'cancelled'; })
        .map(function(e){ return e.date.slice(0, 7); })
    )).sort().reverse();
    var now = new Date();
    var thisM = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    // default: current month if has data, else most recent month
    var defM = months.indexOf(thisM) > -1 ? thisM : (months[0] || thisM);
    sel.innerHTML = '<option value="">ทุกเดือน</option>' +
      months.map(function(m){
        var parts = m.split('-').map(Number);
        return '<option value="' + m + '" ' + (m === defM ? 'selected' : '') + '>' +
               (typeof SHORT_M !== 'undefined' ? SHORT_M[parts[1]-1] : m) + ' ' + (parts[0]+543) +
               '</option>';
      }).join('');
  }

  _openModal('accountLedgerModal');
  renderLedger();
}

/** Render ledger table + totals ตาม _ledgerAccountId + ledgerMonthFilter */
function renderLedger() {
  var accountId = _ledgerAccountId;
  if (!accountId) return;
  var acct = accountsData.find(function(a){ return a.id === accountId; });
  if (!acct) return;

  var selMonth = (document.getElementById('ledgerMonthFilter') || {}).value || '';

  // เรียง ASC ทั้งหมด (ใช้คำนวณ running balance)
  var _rlUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _rlDb  = _rlUid ? db.filter(function(e){ return (e.user_id||e.person) === _rlUid; }) : db;
  var allEntries = _rlDb
    .filter(function(e){ return e.account_id === accountId && e.status !== 'cancelled'; })
    .slice()
    .sort(function(a, b){
      if(a.date < b.date) return -1;
      if(a.date > b.date) return 1;
      return Number(a.id) - Number(b.id);
    });

  // คำนวณ opening balance สำหรับ period ที่เลือก
  var openBal = acct.initial_balance || 0;
  if (selMonth) {
    // รวมทุก transaction ก่อนหน้า period ที่เลือก เพื่อหา opening balance ของ period
    allEntries.filter(function(e){ return e.date.slice(0,7) < selMonth; })
      .forEach(function(e){
        if (e.type === 'income')  openBal += e.amt;
        else if (e.type === 'expense') openBal -= e.amt;
        else if (e.type === 'transfer') {
          if (e.transfer_direction === 'in')  openBal += e.amt;
          if (e.transfer_direction === 'out') openBal -= e.amt;
        }
      });
  }

  // filter เฉพาะ period
  var entries = selMonth
    ? allEntries.filter(function(e){ return e.date.slice(0,7) === selMonth; })
    : allEntries;

  var running  = openBal;
  var totalIn  = 0;
  var totalOut = 0;

  // group entries by date (ASC order maintained for running balance)
  var _rowGroups = [], _rowDmap = {};
  entries.forEach(function(e) {
    var d = e.date;
    if (!_rowDmap[d]) { _rowDmap[d] = []; _rowGroups.push({date: d, rows: _rowDmap[d]}); }
    _rowDmap[d].push(e);
  });
  var rows = entries.map(function(e) {
    var debit  = 0;
    var credit = 0;
    var typeLabel = '';
    var typeColor = 'var(--ink2)';

    if (e.type === 'income') {
      credit = e.amt; running += e.amt; totalIn += e.amt;
      typeLabel = 'รายรับ'; typeColor = 'var(--green)';
    } else if (e.type === 'expense') {
      debit = e.amt; running -= e.amt; totalOut += e.amt;
      typeLabel = 'รายจ่าย'; typeColor = 'var(--red)';
    } else if (e.type === 'transfer') {
      if (e.transfer_direction === 'in') {
        credit = e.amt; running += e.amt; totalIn += e.amt;
        typeLabel = '↙ รับโอน'; typeColor = 'var(--green)';
      } else {
        debit = e.amt; running -= e.amt; totalOut += e.amt;
        typeLabel = '↗ โอนออก'; typeColor = 'var(--red)';
      }
    }

    var balColor = running >= 0 ? 'var(--green)' : 'var(--red)';
    return '<tr style="border-bottom:1px solid var(--line);cursor:pointer" onclick="navToTxDate(\''+e.date+'\',\''+accountId+'\')" title="ดูรายการวันนี้ในหน้ารายการ">' +

      '<td style="padding:8px 6px;max-width:180px">' +
        '<div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (e.desc || '—') + '</div>' +
        '<div style="font-size:11px;color:' + typeColor + ';font-weight:600">' + typeLabel + (e.cat_name ? ' · ' + e.cat_name : '') + '</div>' +
      '</td>' +
      '<td style="text-align:right;font-family:monospace;font-size:13px;color:var(--red);padding:8px 6px;white-space:nowrap">' +
        (debit ? '−' + fmtH(debit) : '—') +
      '</td>' +
      '<td style="text-align:right;font-family:monospace;font-size:13px;color:var(--green);padding:8px 6px;white-space:nowrap">' +
        (credit ? '+' + fmtH(credit) : '—') +
      '</td>' +
      '<td style="text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:' + balColor + ';padding:8px 6px;white-space:nowrap">' +
        fmtH(running) +
      '</td>' +
    '</tr>';
  });

  // opening balance row (ยอดยกมา)
  var openLabel = selMonth ? 'ยอดยกมา ณ ต้นเดือน' : 'ยอดยกมา (Opening Balance)';
  var openRow = '<tr style="background:var(--surface2);font-size:12px">' +
    '<td style="padding:8px 6px;color:var(--ink3);font-style:italic">' + openLabel + '</td>' +
    '<td></td><td></td>' +
    '<td style="text-align:right;font-family:monospace;font-weight:700;padding:8px 6px">' + fmtH(openBal) + '</td>' +
  '</tr>';

  // map entry.id → HTML row string (เพื่อใช้ใน group render)
  var _rowHtmlMap = {};
  entries.forEach(function(e, i){ _rowHtmlMap[String(e.id)] = rows[i]; });

  var wrap = document.getElementById('ledgerTableWrap');
  if (wrap) {
    wrap.innerHTML = rows.length
      ? '<table style="width:100%;border-collapse:collapse;margin-top:8px">' +
          '<thead><tr style="font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">' +
            '<th style="text-align:left;padding:6px 6px;font-weight:600">รายการ</th>' +
            '<th style="text-align:right;padding:6px 6px;font-weight:600">รายจ่าย</th>' +
            '<th style="text-align:right;padding:6px 6px;font-weight:600">รายรับ</th>' +
            '<th style="text-align:right;padding:6px 6px;font-weight:600">ยอดคงเหลือ</th>' +
          '</tr></thead>' +
          '<tbody>' + (function(){
            var reversed = _rowGroups.slice().reverse();
            return reversed.map(function(g){
              return '<tr style="background:var(--surface2)"><td colspan="4" style="padding:5px 8px;font-size:11px;font-weight:700;color:var(--ink2);border-top:2px solid var(--line)">'+toThaiDateStr(g.date)+'</td></tr>'+
                g.rows.slice().reverse().map(function(e){ return _rowHtmlMap[String(e.id)]||''; }).join('');
            }).join('');
          })() + openRow + '</tbody>' +
        '</table>'
      : '<div style="text-align:center;padding:32px;color:var(--ink3);font-size:14px">ไม่มีรายการในช่วงที่เลือก</div>';
  }

  // summary totals
  var finalBal  = getAccountBalance(accountId);
  var balEl     = document.getElementById('ledgerBalance');
  var totalInEl = document.getElementById('ledgerTotalIn');
  var totalOutEl= document.getElementById('ledgerTotalOut');
  if (balEl)     { balEl.innerHTML = fmtH(finalBal) + ' บาท'; balEl.style.color = finalBal >= 0 ? 'var(--green)' : 'var(--red)'; }
  if (totalInEl) totalInEl.innerHTML  = '+' + fmtH(totalIn)  + ' บาท';
  if (totalOutEl)totalOutEl.innerHTML = '−' + fmtH(totalOut) + ' บาท';
}

function closeAccountLedger() {
  _closeModal('accountLedgerModal', function() { _ledgerAccountId = null; });
}

function onAddAccount() {
  var name = (document.getElementById('newAcctName') || {}).value || '';
  var type = (document.getElementById('newAcctType') || {}).value || 'bank';
  var bal  = parseFloat((document.getElementById('newAcctBalance') || {}).value) || 0;
  name = name.trim();
  if (!name) { showCycleToast('⚠️ ระบุชื่อบัญชี'); return; }
  addAccount(name, type, null, bal);
  closeAddAccountModal();
  renderAccountList();
  fillAccountSelectors();
  showCycleToast('เพิ่มบัญชี "' + name + '" แล้ว');
}
