/* HomeFinance · module: persons.js · v2.5.0 */

function populatePersonSelects(){
  ['fPerson','ePerson'].forEach(function(sid){
    var sel=document.getElementById(sid);
    if(!sel) return;
    var cur=sel.value;
    sel.innerHTML=persons.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
    if(cur) sel.value=cur;
  });
}

function renderPersonList(){
  var el=document.getElementById('personList');
  if(!el) return;
  var colors=[['#ebf0fe','#1a4fa0'],['#fef8e7','#b5600a'],['#eef7f2','#1a7a4a'],['#f0eef9','#4a3a9a']];
  el.innerHTML=persons.map(function(p,i){
    var pair=colors[i%4]; var bg=pair[0], cl=pair[1];
    return '<div class="settings-row">'+
      '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'+
        '<div class="person-avatar" style="background:'+bg+';color:'+cl+'">'+p.name.charAt(0).toUpperCase()+'</div>'+
        '<input value="'+p.name+'" onchange="renamePerson(\''+p.id+'\',this.value)" '+
          'class="person-name-input" placeholder="ชื่อผู้บันทึก">'+
      '</div>'+
      '<div class="settings-row-right">'+
        '<span style="font-size:10px;color:var(--ink3);font-family:monospace;background:var(--surface2);padding:2px 6px;border-radius:4px">'+p.id+'</span>'+
        (persons.length>1?'<button onclick="deletePerson(\''+p.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:18px;padding:4px;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center;touch-action:manipulation">×</button>':'')+
      '</div>'+
    '</div>';
  }).join('');
}

function renamePerson(id, newName){
  var p=persons.find(function(x){return x.id===id;});
  if(p){ p.name=newName.trim()||p.name; savePersons(persons); }
  populatePersonSelects();
  // sync sidebar
  var pA=persons.find(function(x){return x.id==='A';}), pB=persons.find(function(x){return x.id==='B';});
  if(pA) document.getElementById('nameA').value=pA.name;
  if(pB) document.getElementById('nameB').value=pB.name;
}

function addPerson(){
  var inp=document.getElementById('newPersonName');
  var name=inp.value.trim();
  if(!name){showMsg('personMsg','กรุณาระบุชื่อ','error');return;}
  var id='P'+Date.now();
  persons.push({id:id,name:name});
  savePersons(persons);
  inp.value='';
  renderPersonList();
  populatePersonSelects();
  showMsg('personMsg','เพิ่ม "'+name+'" แล้ว','success');
}

function deletePerson(id){
  var inUse=db.some(function(e){return e.person===id;});
  if(inUse){showMsg('personMsg','ไม่สามารถลบได้ เพราะมีรายการที่ใช้ชื่อนี้อยู่','error');return;}
  persons=persons.filter(function(x){return x.id!==id;});
  savePersons(persons);
  renderPersonList();
  populatePersonSelects();
}
