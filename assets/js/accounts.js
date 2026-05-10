/* HomeFinance · module: accounts.js · v3.0.0
 * Multi-account management: bank, cash, e-wallet
 * Stored in localStorage (hf2_accounts) + optionally Supabase.
 */

// ─── DEFAULTS & STORAGE ───────────────────────────────────
var ACCOUNT_TYPES = { bank: 'ธนาคาร', cash: 'เงินสด', ewallet: 'E-Wallet' };
var ACCOUNT_COLORS = ['#1a4fa0','#16a34a','#d97706','#7c3aed','#db2777'];

var accountsData = [];

function loadAccountsLocal() {
  try { accountsData = JSON.parse(localStorage.getItem('hf2_accounts') || '[]'); }
  catch(_) { accountsData = []; }
  if (!accountsData.length) {
    // Seed one default account so the app works immediately
    accountsData = [{
      id: 'acct-default',
      name: 'บัญชีหลัก',
      type: 'bank',
      color: '#1a4fa0',
      initial_balance: 0,
      is_active: true,
    }];
    saveAccountsLocal();
  }
}
function saveAccountsLocal() {
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
    showCycleToast('ต้องมีบัญชีอย่างน้อย 1 บัญชี');
    return;
  }
  accountsData = accountsData.filter(function(a) { return a.id !== id; });
  saveAccountsLocal();
}

// ─── BALANCE CALCULATION ──────────────────────────────────
function getAccountBalance(accountId) {
  var acct = accountsData.find(function(a) { return a.id === accountId; });
  if (!acct) return 0;
  var base = acct.initial_balance || 0;
  // income adds, expense deducts
  var txBalance = db.filter(function(e) {
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
function addTransfer(fromAccountId, toAccountId, amount, dateStr, note) {
  if (!checkOnlineForAction()) return;
  var id = 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  var base = {
    date:       dateStr,
    type:       'transfer',
    cat_id:     null, cat_name: 'โอนเงิน',
    desc:       'โอนเงิน',
    amt:        Number(amount) || 0,
    person:     persons[0] ? persons[0].id : 'A',
    split:      false,
    status:     'paid',
    note:       note || '',
    cycle_id:   cycleIdFromDate(dateStr),
    billing_month: defaultBillingMonth(dateStr),
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
  db.push(outEntry);
  db.push(inEntry);
  save();
  sbAdd(outEntry);
  sbAdd(inEntry);
  showCycleToast('โอนเงิน ' + fmt(amount) + ' บาท เรียบร้อย');
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
    } else if (action === 'delete') {
      await fetch(creds.url + '/rest/v1/accounts?id=eq.' + encodeURIComponent(acct.id), {
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
    var r = await fetch(creds.url + '/rest/v1/accounts?select=*&order=created_at', {
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
    if (cur) sel.value = cur;
  });
}

// ─── RENDER ACCOUNT CARDS (Dashboard) ────────────────────
function renderAccountCards() {
  var el = document.getElementById('accountCards');
  if (!el) return;
  if (!accountsData.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  var total = getTotalBalance();
  el.innerHTML =
    '<div class="card" style="border-left:4px solid #1a4fa0">' +
      '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span>💳 บัญชีการเงิน</span>' +
        '<button onclick="openTransferModal()" style="font-size:11px;padding:4px 10px;background:#1a4fa0;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:Sarabun,sans-serif">↔ โอน</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--ink3);margin-bottom:10px">ยอดรวมทุกบัญชี: <strong style="font-size:15px;color:var(--green);font-family:monospace">' + fmt(total) + '</strong> บาท</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">' +
        accountsData.filter(function(a) { return a.is_active; }).map(function(a) {
          var bal = getAccountBalance(a.id);
          return '<div style="background:var(--surface2);border-radius:10px;padding:10px;border-left:3px solid ' + a.color + '">' +
            '<div style="font-size:11px;font-weight:600;color:var(--ink2)">' + a.name + '</div>' +
            '<div style="font-size:10px;color:var(--ink3)">' + (ACCOUNT_TYPES[a.type] || a.type) + '</div>' +
            '<div style="font-size:16px;font-weight:700;font-family:monospace;color:' + (bal >= 0 ? 'var(--green)' : 'var(--red)') + ';margin-top:4px">' + fmt(bal) + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>';
}

// ─── TRANSFER MODAL ───────────────────────────────────────
function openTransferModal() {
  var modal = document.getElementById('transferModal');
  if (!modal) return;
  fillAccountSelectors();
  document.getElementById('transferAmt').value = '';
  document.getElementById('transferNote').value = '';
  document.getElementById('transferDate').value = new Date().toISOString().slice(0, 10);
  modal.style.display = 'flex';
}
function closeTransferModal() {
  var modal = document.getElementById('transferModal');
  if (modal) modal.style.display = 'none';
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
}

// ─── SETTINGS: ACCOUNT LIST ───────────────────────────────
function renderAccountList() {
  var el = document.getElementById('accountList');
  if (!el) return;
  el.innerHTML = accountsData.map(function(a) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">' +
      '<div style="width:12px;height:12px;border-radius:50%;background:' + a.color + ';flex-shrink:0"></div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:500">' + a.name + '</div>' +
        '<div style="font-size:11px;color:var(--ink3)">' + (ACCOUNT_TYPES[a.type] || a.type) + ' · ยอด: ' + fmt(getAccountBalance(a.id)) + ' บาท</div>' +
      '</div>' +
      '<button onclick="deleteAccount(\'' + a.id + '\');renderAccountList()" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;padding:4px 8px">×</button>' +
    '</div>';
  }).join('') || '<div class="empty">ยังไม่มีบัญชี</div>';
}

function onAddAccount() {
  var name = (document.getElementById('newAcctName') || {}).value || '';
  var type = (document.getElementById('newAcctType') || {}).value || 'bank';
  var bal  = parseFloat((document.getElementById('newAcctBalance') || {}).value) || 0;
  name = name.trim();
  if (!name) { showCycleToast('⚠️ ระบุชื่อบัญชี'); return; }
  addAccount(name, type, null, bal);
  if (document.getElementById('newAcctName')) document.getElementById('newAcctName').value = '';
  if (document.getElementById('newAcctBalance')) document.getElementById('newAcctBalance').value = '';
  renderAccountList();
  fillAccountSelectors();
  showCycleToast('เพิ่มบัญชี "' + name + '" แล้ว');
}
