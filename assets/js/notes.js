/* HomeFinance · module: notes.js · v2.5.0 */

// ─── NOTE HISTORY ─────────────────────────────────────────
function getNoteHistory(){ return JSON.parse(localStorage.getItem('hf2_notes')||'[]'); }
function addNoteHistory(note){
  if(!note) return;
  var h = getNoteHistory().filter(function(n){return n!==note;});
  h.unshift(note);
  localStorage.setItem('hf2_notes', JSON.stringify(h.slice(0,20)));
}
function renderNoteHistory(){
  var list = getNoteHistory();
  var el = document.getElementById('noteHistoryList');
  if(!el) return;
  el.innerHTML = list.length
    ? list.map(function(n){return '<div onclick="pickNote(\''+n.replace(/'/g,"\\'")+'\')" style="padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--line);color:var(--ink)">'+n+'</div>';}).join('')
    : '<div style="padding:8px 10px;font-size:12px;color:var(--ink3)">ยังไม่มีประวัติ</div>';
}
function pickNote(n){
  document.getElementById('fNote').value=n;
  document.getElementById('noteHistoryDrop').style.display='none';
}
function toggleNoteHistory(){
  var d=document.getElementById('noteHistoryDrop');
  renderNoteHistory();
  d.style.display=d.style.display==='none'?'block':'none';
}
