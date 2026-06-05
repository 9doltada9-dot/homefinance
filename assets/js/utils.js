/* HomeFinance · module: utils.js · v2.5.0 */

// ─── GLOBAL STATE (mutable across modules) ────────────────
var categories = []; // load from Supabase at startup
var catMap = {}; // { id: {name, type, group} } for fast lookup
var cats = loadCats();
var INCOME_CATS = cats.income;   // live refs — mutate these
var EXPENSE_CATS = cats.expense;
var NO_SPLIT = cats.noSplit;
var persons = loadPersons();

var db = JSON.parse(localStorage.getItem('hf2_entries') || 'null') || seed();
var cType = 'income';
var splitOn = false;

var vendorsData = []; // [{id, name, sort_order}]
var itemsData = {};   // { catId: [{id, name, sort_order}] }

var viewMode = localStorage.getItem('hf2_viewmode') || 'desktop';

// ─── PERSON COLOR PALETTE (neon-glass theme) ──────────────
// ใช้ index เดียวกับ persons array / _allProfiles order
// .gradient  → circle avatar (dark bg)
// .glow      → box-shadow rgba
// .pillBg    → small pill background (rgba, glass)
// .pillText  → pill text / small avatar text
// .pdfBg     → opaque bg สำหรับ PDF export (white bg)
// .pdfText   → text สำหรับ PDF export
var PERSON_COLORS = [
  { gradient:'linear-gradient(135deg,#007ACC,#00F5FF)', glow:'rgba(0,245,255,.45)',
    pillBg:'rgba(0,245,255,.15)', pillText:'#00E8FF', pillBorder:'rgba(0,245,255,.35)',
    pdfBg:'#dbeafe', pdfText:'#1e3a8a' },
  { gradient:'linear-gradient(135deg,#7B10CC,#C026FF)', glow:'rgba(192,38,255,.45)',
    pillBg:'rgba(192,38,255,.15)', pillText:'#D464FF', pillBorder:'rgba(192,38,255,.35)',
    pdfBg:'#f3e8ff', pdfText:'#6b21a8' },
  { gradient:'linear-gradient(135deg,#059669,#00FF88)', glow:'rgba(0,255,136,.4)',
    pillBg:'rgba(0,255,136,.12)', pillText:'#00CC6A', pillBorder:'rgba(0,255,136,.3)',
    pdfBg:'#dcfce7', pdfText:'#166534' },
  { gradient:'linear-gradient(135deg,#DC2626,#FF4D6D)', glow:'rgba(255,77,109,.4)',
    pillBg:'rgba(255,77,109,.12)', pillText:'#FF6080', pillBorder:'rgba(255,77,109,.3)',
    pdfBg:'#fee2e2', pdfText:'#991b1b' },
];
/** หา PERSON_COLORS index จาก pid (UUID หรือ A/B) */
function personColorIndex(pid){
  var idx = persons.findIndex(function(x){ return x.id===pid || x.user_id===pid; });
  if(idx===-1 && window._allProfiles){
    idx = window._allProfiles.findIndex(function(x){ return x.id===pid; });
  }
  return Math.max(0, idx);
}
/** คืน PERSON_COLORS entry จาก pid */
function personColor(pid){
  return PERSON_COLORS[personColorIndex(pid) % PERSON_COLORS.length];
}

// ─── FORMATTERS ───────────────────────────────────────────
function fmt(n){
  // ปัดเศษทศนิยมสูงสุด 2 ตำแหน่ง — ถ้าไม่มีเศษให้แสดงเป็นจำนวนเต็ม
  var r = Math.round(n * 100) / 100;
  if(r % 1 === 0) return r.toLocaleString('th-TH');
  return r.toLocaleString('th-TH', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtB(n){ return fmt(n)+' บาท'; }
/** fmt แต่ทศนิยมแสดงเล็กกว่า (HTML context เท่านั้น) */
function fmtH(n){
  var s = fmt(n);
  var dot = s.indexOf('.');
  if(dot === -1) return s+'<span style="font-size:.72em;opacity:.85">.00</span>';
  return s.slice(0,dot)+'<span style="font-size:.72em;opacity:.85">'+s.slice(dot)+'</span>';
}
function nm(pid){
  if(!pid) return '—';
  // 1. UUID lookup via _allProfiles (new user system)
  if(window._allProfiles && window._allProfiles.length){
    var prof=window._allProfiles.find(function(x){return x.id===pid;});
    if(prof && prof.name) return prof.name;
  }
  // 2. Legacy A/B persons array
  var p=persons.find(function(x){return x.id===pid;});
  return p?p.name:pid;
}
function names(){
  // backward compat — prefer _allProfiles if available
  if(window._allProfiles && window._allProfiles.length){
    var map={};
    window._allProfiles.forEach(function(p){ map[p.id]=p.name; });
    return map;
  }
  return { A: nm('A'), B: nm('B') };
}
function personPill(pid){
  var displayName=nm(pid);
  var c=personColor(pid);
  return '<span style="background:'+c.pillBg+';color:'+c.pillText+';font-size:11px;padding:2px 8px;border-radius:20px;font-weight:600;border:1px solid '+c.pillBorder+'">'+displayName+'</span>';
}

// ─── THAI DATE/TIME helpers ───────────────────────────────
function toThaiDateStr(dateStr){
  if(!dateStr) return '';
  var parts = dateStr.split('-').map(Number);
  var y=parts[0], m=parts[1], d=parts[2];
  var dow = new Date(y, m-1, d).getDay();
  return THAI_DAYS[dow]+' '+d+' '+THAI_MONTHS[m-1]+' '+(y+543);
}
function toThaiDateShort(dateStr){
  if(!dateStr) return '';
  var parts = dateStr.split('-').map(Number);
  var y=parts[0], m=parts[1], d=parts[2];
  return d+' '+SHORT_M[m-1]+' '+(y+543);
}
function todayISO(){
  var n=new Date();
  return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}
function toISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

function updateTopbarClock(){
  var el = document.getElementById('topbarDate');
  if(!el) return;
  var now = new Date();
  var hh=String(now.getHours()).padStart(2,'0');
  var mm=String(now.getMinutes()).padStart(2,'0');
  el.textContent=THAI_DAYS[now.getDay()]+' '+now.getDate()+' '+THAI_MONTHS[now.getMonth()]+' '+(now.getFullYear()+543)+'  '+hh+':'+mm;
}

// ─── NETWORK helpers ──────────────────────────────────────
function fetchWithTimeout(url, options, ms){
  ms = ms || 8000;
  var ctrl = new AbortController();
  var timer = setTimeout(function(){ ctrl.abort(); }, ms);
  return fetch(url, Object.assign({}, options, { signal: ctrl.signal }))
    .finally(function(){ clearTimeout(timer); });
}

function isFileProtocol(){ return window.location.protocol === 'file:'; }

// ─── VIEW MODE ────────────────────────────────────────────
function setViewMode(m){
  viewMode = m;
  localStorage.setItem('hf2_viewmode', m);
  sbSaveSetting('viewmode', m);
  applyViewMode();
}
function applyViewMode(){
  document.body.classList.toggle('view-mobile', viewMode==='mobile');
  var dBtn=document.getElementById('btnViewDesktop');
  var mBtn=document.getElementById('btnViewMobile');
  if(dBtn&&mBtn){
    dBtn.classList.toggle('active', viewMode==='desktop');
    mBtn.classList.toggle('active', viewMode==='mobile');
    var desc=document.getElementById('viewModeDesc');
    if(desc) desc.textContent='กำลังใช้: '+(viewMode==='desktop'?'Desktop':'มือถือ');
  }
}

// ─── REFRESH / LABELS ─────────────────────────────────────
function refreshAll(){
  var pg = document.querySelector('.page.active')?.id?.replace('page-','');
  if(pg==='dashboard') renderDash();
  updatePersonLabels();
}
function updatePersonLabels(){
  populatePersonSelects();
  var pA=persons.find(function(x){return x.id==='A';}), pB=persons.find(function(x){return x.id==='B';});
  var nA=document.getElementById('nameA'), nB=document.getElementById('nameB');
  if(nA&&pA) nA.value=pA.name;
  if(nB&&pB) nB.value=pB.name;
}

// ─── SHOW MSG ─────────────────────────────────────────────
function showMsg(id, txt, cls){
  var el=document.getElementById(id);
  if(!el) return;
  el.textContent=txt; el.className='msg '+cls;
  setTimeout(function(){ el.className='msg'; },3000);
}

// ─── STATUS HELPERS ───────────────────────────────────────
// income: 'received' | 'pending'
// expense: 'paid'    | 'pending'
function isPaid(e){
  return e.status==='paid' || e.status==='received';
}
function doneStatus(type){
  return type==='income' ? 'received' : 'paid';
}

// ─── SWIPE STATE (global, persists across renderTx calls) ─
var _swipeOpenSc = null;

// ─── MODAL ANIMATION HELPERS ─────────────────────────────
function _openModal(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hf-mo-out');
  el.style.display = 'flex';
  void el.offsetWidth;
  el.classList.add('hf-mo-in');
}
function _closeModal(id, cb) {
  var el = document.getElementById(id);
  if (!el || el.style.display === 'none') { if (typeof cb === 'function') cb(); return; }
  el.classList.remove('hf-mo-in');
  el.classList.add('hf-mo-out');
  setTimeout(function() {
    el.style.display = 'none';
    el.classList.remove('hf-mo-out');
    if (typeof cb === 'function') cb();
  }, 180);
}

// ─── BOTTOM NAV AUTO-HIDE ON SCROLL ──────────────────────
(function(){
  var _lastSY = 0, _ticking = false, _bnav = null;
  function _onScroll(){
    if (!_bnav) _bnav = document.querySelector('.bottomnav');
    if (!_bnav){ _ticking=false; return; }
    var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (sy > _lastSY + 10 && sy > 80){
      _bnav.classList.add('bnav-hidden');
    } else if (sy < _lastSY - 5){
      _bnav.classList.remove('bnav-hidden');
    }
    _lastSY = sy < 0 ? 0 : sy;
    _ticking = false;
  }
  window.addEventListener('scroll', function(){
    if (!_ticking){ requestAnimationFrame(_onScroll); _ticking=true; }
  }, {passive:true});
})();

/** เรียกเมื่อ navigate page ใหม่ — คืน bottom nav เสมอ */
function showBottomNav(){
  var nav = document.querySelector('.bottomnav');
  if (nav) nav.classList.remove('bnav-hidden');
}

// ─── CLOSE MODAL ON BACKDROP CLICK ───────────────────────
// คลิกนอก card (บน overlay) → ปิด modal อัตโนมัติ
// deleteConfirmModal ไม่รวม (ป้องกัน dismiss โดยบังเอิญ)
(function(){
  var _map = {
    'editOverlay':        'closeEdit',
    'catOverlay':         'closeCatModal',
    'splitGroupModal':    null,
    'transferModal':      'closeTransferModal',
    'recurringModal':     'closeRecurringModal',
    'recurringDueModal':  'closeRecurringDueModal',
    'depositModal':       'closeDepositModal',
    'editAccountModal':   'closeEditAccountModal',
    'accountLedgerModal': 'closeAccountLedger',
    'adjustModal':        'closeAdjustModal',
    // accountDetailModal มี onclick บน element อยู่แล้ว ไม่ต้องเพิ่ม
    'addAccountModal':    'closeAddAccountModal',
    'txDetailOverlay':    'closeTxDetailModal',
    'settlePayModal':     'closeSettlePayModal',
    'loanModal':          'closeLoanModal',
    'loanRepayModal':     'closeLoanRepayModal',
  };
  document.addEventListener('click', function(e) {
    var id = e.target && e.target.id;
    if (!id || !Object.prototype.hasOwnProperty.call(_map, id)) return;
    if (e.target.style.display === 'none') return;
    var fn = _map[id];
    if (fn && typeof window[fn] === 'function') { window[fn](); }
    else { _closeModal(id); }
  });
})();

window.closeAllSwipe = function(except){
  var target = _swipeOpenSc;
  if(target && target !== except){
    _swipeOpenSc = null;
    setTimeout(function(){
      target.style.transition='transform .25s cubic-bezier(.4,0,.2,1)';
      target.style.transform='translateX(0)';
      target._open=false;
    }, 50);
  }
};

function _swipeScrollClose(){
  if(_swipeOpenSc){
    _swipeOpenSc.style.transition='transform .25s cubic-bezier(.4,0,.2,1)';
    _swipeOpenSc.style.transform='translateX(0)';
    _swipeOpenSc._open=false; _swipeOpenSc=null;
  }
}
