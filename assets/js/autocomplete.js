/* HomeFinance · module: autocomplete.js · v2.5.0 */

// ─── AUTOCOMPLETE ─────────────────────────────────────────
function acGetSuggestions(q){
  if(!q||q.length<1) return [];
  var seen = {};
  var all = [];
  db.forEach(function(e){
    if(e.desc && !seen[e.desc]){ seen[e.desc] = true; all.push(e.desc); }
  });
  var ql = q.toLowerCase();
  return all.filter(function(d){return d.toLowerCase().indexOf(ql)>-1;}).slice(0,8);
}

function acShow(inputId, listId){
  var inp = document.getElementById(inputId);
  var list = document.getElementById(listId);
  if(!inp||!list) return;
  var q = inp.value.trim();
  var suggs = acGetSuggestions(q);
  if(!suggs.length||!q){ list.style.display='none'; return; }
  list.innerHTML = suggs.map(function(s){
    return '<div class="ac-item" onclick="acPick(\''+inputId+'\',\''+listId+'\',\''+s.replace(/'/g,"\\'")+'\')">'+s+'</div>';
  }).join('');
  list.style.display='block';
}

function acPick(inputId, listId, val){
  document.getElementById(inputId).value = val;
  document.getElementById(listId).style.display = 'none';
}

function acKey(e, inputId, listId){
  var list = document.getElementById(listId);
  var items = [].slice.call(list.querySelectorAll('.ac-item'));
  var active = list.querySelector('.ac-active');
  var idx = items.indexOf(active);
  if(e.key==='ArrowDown'){
    e.preventDefault();
    var next = items[idx<items.length-1?idx+1:0];
    if(next) next.classList.add('ac-active');
    if(active) active.classList.remove('ac-active');
  }
  else if(e.key==='ArrowUp'){
    e.preventDefault();
    var prev = items[idx>0?idx-1:items.length-1];
    if(prev) prev.classList.add('ac-active');
    if(active) active.classList.remove('ac-active');
  }
  else if(e.key==='Enter' && active){
    e.preventDefault();
    acPick(inputId, listId, active.textContent);
  }
  else if(e.key==='Escape'){
    list.style.display='none';
  }
}
