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
  var colors=['#ebf0fe:#1a4fa0','#fef8e7:#b5600a','#eef7f2:#1a7a4a','#f0eef9:#4a3a9a','#fdf4e7:#b5600a'];
  // try persons array first, then _allProfiles
  var idx=persons.findIndex(function(x){return x.id===pid;});
  if(idx===-1 && window._allProfiles){
    idx=window._allProfiles.findIndex(function(x){return x.id===pid;});
  }
  var parts=(colors[Math.max(0,idx)]||colors[0]).split(':');
  var bg=parts[0], cl=parts[1];
  return '<span style="background:'+bg+';color:'+cl+';font-size:11px;padding:2px 8px;border-radius:20px;font-weight:500">'+displayName+'</span>';
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
