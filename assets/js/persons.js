/* HomeFinance · module: persons.js · v2.5.0 */

function populatePersonSelects(){
  ['fPerson','ePerson'].forEach(function(sid){
    var sel=document.getElementById(sid);
    if(!sel) return;
    var cur=sel.value;
    // ระบบใหม่: ใช้ UUID จาก _allProfiles เป็น value
    if(window._allProfiles && window._allProfiles.length){
      sel.innerHTML=window._allProfiles.map(function(p){
        return '<option value="'+p.id+'">'+p.name+'</option>';
      }).join('');
    } else {
      // fallback: A/B persons array
      sel.innerHTML=persons.map(function(p){return '<option value="'+p.id+'">'+p.name+'</option>';}).join('');
    }
    // คืนค่าที่เลือกไว้ก่อนหน้า (UUID หรือ A/B)
    if(cur && sel.querySelector('option[value="'+cur+'"]')) sel.value=cur;
    else {
      // ถ้าไม่มีค่าเดิม — ใช้ UUID ของ user ที่ login อยู่
      var myUid=(typeof getAuthUserId==='function')?getAuthUserId():null;
      if(myUid && sel.querySelector('option[value="'+myUid+'"]')) sel.value=myUid;
    }
  });
}

function renderPersonList(){
  var el=document.getElementById('personList');
  if(!el) return;
  var colors=[['#ebf0fe','#1a4fa0'],['#fef8e7','#b5600a'],['#eef7f2','#1a7a4a'],['#f0eef9','#4a3a9a'],['#fce8f3','#9a1a6a']];
  el.innerHTML=persons.map(function(p,i){
    var pair=colors[i%5]; var bg=pair[0], cl=pair[1];
    var isLinked = !!p.user_id;
    var badge = isLinked
      ? '<span style="font-size:10px;font-weight:600;background:#eef7f2;color:#1a7a4a;padding:2px 8px;border-radius:10px;border:1px solid #b2dfcc">\U0001f517 บัญชีแอป</span>'
      : '<span style="font-size:10px;font-weight:600;background:var(--surface2);color:var(--ink3);padding:2px 8px;border-radius:10px;border:1px solid var(--line)">\U0001f464 สมาชิกครัวเรือน</span>';
    var isAdmin = (typeof isAdminUser==='function' && isAdminUser());
    return '<div class="settings-row" style="gap:10px;flex-wrap:wrap">'+
      '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:160px">'+
        '<div class="person-avatar" style="background:'+bg+';color:'+cl+';font-size:16px;font-weight:700;min-width:38px;min-height:38px;display:flex;align-items:center;justify-content:center;border-radius:50%">'+p.name.charAt(0).toUpperCase()+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<input value="'+p.name+'" onchange="renamePerson(\''+p.id+'\',this.value)"'+
            ' class="person-name-input" placeholder="ชื่อสมาชิก" style="font-size:14px;font-weight:600;width:100%">'+
          '<div style="margin-top:4px">'+badge+'</div>'+
        '</div>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'+
        (isAdmin&&!isLinked ? '<button onclick="openLinkPersonModal(\''+p.id+'\')" style="font-size:11px;padding:4px 8px;border:1px solid var(--blue);border-radius:6px;background:var(--blue-bg);color:var(--blue);cursor:pointer;font-family:Sarabun,sans-serif;white-space:nowrap">เชื่อมบัญชี</button>' : '')+
        (persons.length>1 ? '<button onclick="deletePerson(\''+p.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:20px;padding:4px;min-width:36px;min-height:36px;display:flex;align-items:center;justify-content:center;touch-action:manipulation;line-height:1">×</button>' : '')+
      '</div>'+
    '</div>';
  }).join('');
}

function openLinkPersonModal(personId) {
  var p = persons.find(function(x){ return x.id===personId; });
  if (!p) return;
  var userId = prompt('กรอก User ID (จากหน้า Supabase Auth → Users) เพื่อเชื่อม "'+p.name+'" กับบัญชีแอป:\n(เว้นว่างไว้ถ้าไม่ต้องการเชื่อม)');
  if (userId === null) return;
  userId = userId.trim();
  if (userId) {
    if (typeof linkPersonToUser === 'function') linkPersonToUser(userId, personId);
    showMsg('personMsg', '✅ เชื่อม "'+p.name+'" กับ User ID แล้ว', 'success');
  } else {
    p.user_id = null;
    if (typeof savePersons === 'function') savePersons(persons);
    showMsg('personMsg', 'ยกเลิกการเชื่อมบัญชีแล้ว', 'success');
  }
  renderPersonList();
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
  persons.push({id:id, name:name, user_id:null});
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
