/* HomeFinance · module: storage.js · v3.0.0 */

// ─── ENTRIES (transactions) ───────────────────────────────
function seed(){
  var y = new Date().getFullYear(), m = String(new Date().getMonth()+1).padStart(2,'0');
  var d = function(n){ return y+'-'+m+'-'+String(n).padStart(2,'0'); };
  return [
    {id:1,date:d(1),type:'expense',cat:'ค่าบ้าน',desc:'ผ่อนบ้าน',amt:15000,person:'A',split:true,status:'paid',note:''},
    {id:2,date:d(1),type:'expense',cat:'ค่าไฟ',desc:'ค่าไฟบ้าน',amt:1450,person:'B',split:true,status:'paid',note:''},
    {id:3,date:d(2),type:'expense',cat:'ค่าน้ำ',desc:'ค่าน้ำประปา',amt:380,person:'A',split:true,status:'paid',note:''},
    {id:4,date:d(3),type:'expense',cat:'ส่งให้พ่อแม่',desc:'ส่งเงินแม่',amt:3000,person:'A',split:false,status:'paid',note:'ไม่หาร2'},
    {id:5,date:d(5),type:'expense',cat:'ค่าอาหารลูก',desc:'ค่าอาหารลูก',amt:900,person:'B',split:true,status:'paid',note:''},
    {id:6,date:d(7),type:'income',cat:'เงินเดือน',desc:'เงินเดือน',amt:38000,person:'A',split:false,status:'paid',note:''},
    {id:7,date:d(7),type:'income',cat:'เงินเดือน',desc:'เงินเดือน',amt:30000,person:'B',split:false,status:'paid',note:''},
    {id:8,date:d(10),type:'expense',cat:'ค่าอินเตอร์เน็ต',desc:'ค่าเน็ต AIS Fiber',amt:599,person:'A',split:true,status:'pending',note:''},
    {id:9,date:d(12),type:'expense',cat:'ค่าของใช้ครัวเรือน',desc:'ซื้อของใช้บ้าน',amt:1650,person:'B',split:true,status:'paid',note:''},
    {id:10,date:d(14),type:'expense',cat:'ค่าส่วนกลางบ้าน',desc:'ค่าส่วนกลาง',amt:2200,person:'A',split:true,status:'pending',note:''},
    {id:11,date:d(7),type:'income',cat:'โบนัส',desc:'โบนัสครึ่งปี',amt:12000,person:'A',split:false,status:'paid',note:''},
  ];
}

function save(){ localStorage.setItem('hf2_entries', JSON.stringify(db)); }

// ─── CATEGORIES ───────────────────────────────────────────
function loadCats(){
  return {
    income:  JSON.parse(localStorage.getItem('hf2_income_cats') ||'null') || [].concat(DEFAULT_INCOME_CATS),
    expense: JSON.parse(localStorage.getItem('hf2_expense_cats')||'null') || [].concat(DEFAULT_EXPENSE_CATS),
    noSplit: JSON.parse(localStorage.getItem('hf2_no_split')    ||'null') || [].concat(DEFAULT_NO_SPLIT),
  };
}
function saveCats(c){
  localStorage.setItem('hf2_income_cats', JSON.stringify(c.income));
  localStorage.setItem('hf2_expense_cats',JSON.stringify(c.expense));
  localStorage.setItem('hf2_no_split',    JSON.stringify(c.noSplit));
  // push each key to DB
  sbSaveSetting('income_cats',  c.income);
  sbSaveSetting('expense_cats', c.expense);
  sbSaveSetting('no_split',     c.noSplit);
}

// ─── PERSONS ──────────────────────────────────────────────
function loadPersons(){
  return JSON.parse(localStorage.getItem('hf2_persons')||'null') || [
    {id:'A',name:'คนA'},{id:'B',name:'คนB'}
  ];
}
function savePersons(p){
  localStorage.setItem('hf2_persons',JSON.stringify(p));
  sbSaveSetting('persons', p);
}

// ─── ITEMS (per category) ─────────────────────────────────
function saveItemsLocal(){
  var local = {};
  Object.entries(itemsData).forEach(function(kv){ local[kv[0]]=kv[1].map(function(x){return x.name;}); });
  localStorage.setItem('hf2_items', JSON.stringify(local));
}
function loadItemsLocal(){
  var local = JSON.parse(localStorage.getItem('hf2_items')||'{}');
  // build itemsData from local (offline fallback)
  itemsData = {};
  Object.entries(local).forEach(function(kv){
    var catId=kv[0], names=kv[1];
    itemsData[catId] = names.map(function(n,i){ return {id:'local-'+catId+'-'+i, name:n, sort_order:i}; });
  });
}

// ─── VENDORS ──────────────────────────────────────────────
function loadVendorsLocal(){
  vendorsData = JSON.parse(localStorage.getItem('hf2_vendors')||'[]');
}
function saveVendorsLocal(){
  localStorage.setItem('hf2_vendors', JSON.stringify(vendorsData));
}

// ─── FAVORITES ────────────────────────────────────────────
// (definitions moved to favorites.js — uses the later override
//  that includes default {cat:{},item:{}} structure)

// ─── BUDGETS ──────────────────────────────────────────────
function saveBudgets(){ localStorage.setItem('hf2_budgets', JSON.stringify(budgets)); }

// ─── CYCLES REGISTRY ──────────────────────────────────────
// (managed by cycleEngine.js — helpers here for completeness)
function getCyclesFromStorage() {
  try { return JSON.parse(localStorage.getItem('hf2_cycles') || '[]'); }
  catch(_) { return []; }
}

// ─── ACCOUNTS ─────────────────────────────────────────────
// (managed by accounts.js — loadAccountsLocal / saveAccountsLocal)

// ─── SAVINGS GOALS ────────────────────────────────────────
// (managed by savingsGoals.js — loadSavingsGoals / saveSavingsGoalsLocal)

// ─── SUPABASE CREDS ───────────────────────────────────────
function getSbCreds(){
  var url = (localStorage.getItem('hf2_sb_url')||'').trim().replace(/\/+$/,'');
  var key = (localStorage.getItem('hf2_sb_key')||'').trim();
  return { url: url, key: key, ok: !!(url && key) };
}

function sbHeadersFrom(key){
  // If user is authenticated, use their JWT (enables RLS user isolation).
  // Falls back to anon key when auth.js is not loaded or user not yet logged in.
  var token = (typeof getAuthToken === 'function' && getAuthToken()) ? getAuthToken() : key;
  return {
    'Content-Type':'application/json',
    'apikey': key,
    'Authorization': 'Bearer ' + token,
    'Prefer': 'return=minimal',
  };
}

function saveSbCreds(){
  SB_URL = (document.getElementById('sbUrl')?.value||'').trim().replace(/\/+$/,'');
  SB_KEY = (document.getElementById('sbKey')?.value||'').trim();
  localStorage.setItem('hf2_sb_url', SB_URL);
  localStorage.setItem('hf2_sb_key', SB_KEY);
}

function sbHeaders(){
  var token = (typeof getAuthToken === 'function' && getAuthToken()) ? getAuthToken() : SB_KEY;
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + token,
    'Prefer': 'return=minimal',
  };
}
