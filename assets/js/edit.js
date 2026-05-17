/* HomeFinance · module: edit.js · v3.0.0 */

// ─── EDIT MODAL ──────────────────────────────────────────
var editId = null;
var eType = 'expense';

// ── Edit-form split type state ─────────────────────────────────
var eSplitType    = 'personal';
var eSplitGroupId = null;   // กลุ่ม Settlement ที่เลือก (ถ้า type==='group')

function eSetSplitType(type) {
  eSplitType = type;
  // button highlights
  ['personal','equal','ratio','custom','group'].forEach(function(t){
    var btn = document.getElementById('estBtn-' + t);
    if (!btn) return;
    var active = (t === type);
    btn.style.background  = active ? 'var(--blue)'   : 'var(--surface2)';
    btn.style.color       = active ? '#fff'           : 'var(--ink2)';
    btn.style.borderColor = active ? 'var(--blue)'   : 'var(--line)';
  });
  // group row visibility
  var groupRow = document.getElementById('eSplitGroupRow');
  if (groupRow) groupRow.style.display = (type === 'group') ? 'block' : 'none';
  // description text
  var desc = document.getElementById('eSplitDesc');
  if (desc) {
    if      (type === 'personal') desc.textContent = 'ค่าใช้จ่ายส่วนตัว ไม่นำมาหาร';
    else if (type === 'equal')    desc.textContent = 'หารเท่ากันทุกคน';
    else if (type === 'ratio')    desc.textContent = 'ตามสัดส่วนที่กำหนด';
    else if (type === 'custom')   desc.textContent = 'เลือกคนที่ร่วมจ่ายค่าใช้จ่ายนี้';
    else if (type === 'group')    desc.textContent = 'เลือกกลุ่ม Settlement ด้านบน';
  }
  if (type === 'group') _eBuildGroupSel();
  // clear group if not group mode
  if (type !== 'group') eSplitGroupId = null;
}

function _eBuildGroupSel() {
  var sel = document.getElementById('eSplitGroupSel');
  if (!sel) return;
  var groups = (typeof getSplitGroups === 'function') ? getSplitGroups() : [];
  var typeIcon = { personal:'💼', equal:'👥', ratio:'📊', custom:'🎯' };
  if (!groups.length) {
    sel.innerHTML = '<option value="">ยังไม่มีกลุ่ม — สร้างที่หน้า Admin</option>';
    return;
  }
  sel.innerHTML = '<option value="">-- เลือกกลุ่ม --</option>'
    + groups.map(function(g){
        var icon = typeIcon[g.split_type] || '🏠';
        return '<option value="'+g.id+'"'+(g.id===eSplitGroupId?' selected':'')+'>'
          +icon+' '+g.name+'</option>';
      }).join('');
  if (eSplitGroupId) sel.value = eSplitGroupId;
}

function _eOnGroupChange() {
  var sel = document.getElementById('eSplitGroupSel');
  eSplitGroupId = sel ? (sel.value || null) : null;
}

// ── Populate / restore split state when opening edit ──────────
function ePopulateGroups(e) {
  // e = the entry object from db
  var type    = e.split_type || (e.split ? 'equal' : 'personal');
  var groupId = e.split_group_id || null;
  eSplitGroupId = groupId;
  // If it's a group-based entry, switch to 'group' mode
  if (groupId) type = 'group';
  eSetSplitType(type);
  // If group mode, pre-select the group in the select
  if (type === 'group' && groupId) {
    _eBuildGroupSel();
    var sel = document.getElementById('eSplitGroupSel');
    if (sel) sel.value = groupId;
  }
}

function openEdit(id){
  var sid=String(id);
  var e = db.find(function(x){return String(x.id)===sid;});
  if(!e) return;
  editId = id;
  eType = e.type;
  document.getElementById('editOverlay').style.display='flex';
  document.getElementById('editIdLabel').textContent='รายการ: '+e.desc;
  document.getElementById('eDate').value = e.date;
  // person คงค่าเดิม (hidden input — ไม่ให้ user เปลี่ยน)
  var ePersonEl = document.getElementById('ePerson');
  if(ePersonEl) ePersonEl.value = e.user_id || e.person || (typeof getCurrentPerson==='function' ? getCurrentPerson() : '');
  document.getElementById('eAmt').value = e.amt;
  document.getElementById('eStatus').value = e.status;
  document.getElementById('eNote').value = e.note||'';
  // populate vendors (with smart sort via fillEditVendors)
  fillEditVendors();
  if(e.vendor_id) document.getElementById('eVendor').value = e.vendor_id;
  // v3: billing_month + account
  var eBM = document.getElementById('eBillingMonth');
  if(eBM) eBM.value = e.billing_month || (e.date ? e.date.slice(0,7) : '');
  if(typeof fillAccountSelectors === 'function') fillAccountSelectors();
  var eAcct = document.getElementById('eAccount');
  if(eAcct && e.account_id) eAcct.value = e.account_id;
  eSetType(e.type, false);
  setTimeout(function(){
    var catVal = e.cat_id || ((categories.find(function(c){return c.name === e.cat_name;})||{}).id) || '';
    document.getElementById('eCat').value = catVal;
    eUpdateDescByCat(catVal);
    var dSel = document.getElementById('eDesc');
    if(dSel && e.desc){
      var exists = [].slice.call(dSel.options).some(function(o){return o.value===e.desc;});
      if(!exists){
        var opt = document.createElement('option');
        opt.value=e.desc; opt.textContent=e.desc;
        dSel.prepend(opt);
      }
      dSel.value = e.desc;
    }
    ePopulateGroups(e);
  },10);
}

function closeEdit(){
  document.getElementById('editOverlay').style.display='none';
  editId=null;
}

function eUpdateDescByCat(catId){
  var sel = document.getElementById('eDesc');
  if(!sel) return;
  // only items from items table — no DB history
  var saved = (itemsData[catId]||[]).map(function(x){return x.name;});
  var cur = sel.value;
  sel.innerHTML = saved.length
    ? saved.map(function(d){return '<option value="'+d+'">'+(isFavItem(d)?'⭐ ':'')+d+'</option>';}).join('')
    : '<option value="">-- ยังไม่มีรายการ --</option>';
  if(cur && saved.indexOf(cur)>-1) sel.value = cur;
}

function eSetType(t, autoS){
  if(autoS===undefined) autoS = true;
  eType = t;
  document.getElementById('eBtnIncome').className = 'type-btn'+(t==='income'?' active-income':'');
  document.getElementById('eBtnExpense').className = 'type-btn'+(t==='expense'?' active-expense':'');
  var eBtnTr = document.getElementById('eBtnTransfer');
  if(eBtnTr) eBtnTr.className = 'type-btn'+(t==='transfer'?' active-transfer':'');
  document.getElementById('eSplitSection').style.display = t==='expense'?'block':'none';
  var eCatRow = document.getElementById('eCatRow');
  if(eCatRow) eCatRow.style.display = t==='transfer'?'none':'';
  // update status options
  var eStat = document.getElementById('eStatus');
  if(eStat){
    var cur = eStat.value;
    if(t==='income'){
      eStat.innerHTML = '<option value="pending">รอรับ</option><option value="received">รับแล้ว</option>';
    } else if(t==='transfer'){
      eStat.innerHTML = '<option value="paid">โอนแล้ว</option><option value="pending">รอโอน</option>';
    } else {
      eStat.innerHTML = '<option value="pending">รอจ่าย</option><option value="paid">จ่ายแล้ว</option>';
    }
    eStat.value = cur && eStat.querySelector('option[value="'+cur+'"]') ? cur : doneStatus(t);
  }
  var sel = document.getElementById('eCat');
  var catsByType = categories.filter(function(c){return c.type === t;});
  sel.innerHTML = catsByType.map(function(c){return '<option value="'+c.id+'">'+c.name+'</option>';}).join('');
  if(autoS && catsByType.length>0){
    sel.value = catsByType[0].id;
    var cat = catMap[sel.value];
    ePopulateGroups('');
  }
  sel.onchange = function(){
    if(t==='expense'){
      var cat2 = catMap[sel.value];
    }
    // update eDesc based on category
    eUpdateDescByCat(sel.value);
  };
}


function saveEdit(){
  if(!checkOnlineForAction()) return;
  var e = db.find(function(x){return String(x.id)===String(editId);});
  if(!e){ closeEdit(); return; }
  var date=document.getElementById('eDate').value;
  var desc=document.getElementById('eDesc').value.trim();
  var amt=parseFloat(document.getElementById('eAmt').value)||0;
  if(!date||!desc||!amt){ showMsg('editMsg','กรุณากรอกวันที่ รายการ และจำนวนเงิน','error'); return; }
  var cat_id = eType==='transfer' ? null : document.getElementById('eCat').value;
  var catObj = cat_id ? catMap[cat_id] : null;
  var cat_name = eType==='transfer' ? 'โอนเงิน' : (catObj ? catObj.name : '');
  var itemObj = (itemsData[cat_id]||[]).find(function(x){return x.name===desc;});
  e.date=date; e.type=eType; e.cat_id=cat_id; e.cat_name=cat_name;
  e.desc=desc; e.amt=amt; var _ePersonVal=document.getElementById('ePerson').value; e.person=_ePersonVal; e.user_id=_ePersonVal;
  // settlement group / split type
  if (eType === 'expense') {
    if (eSplitType === 'group' && eSplitGroupId) {
      var selGroup = (typeof getSplitGroups==='function' ? getSplitGroups() : []).find(function(g){ return g.id===eSplitGroupId; });
      e.split_group_id = eSplitGroupId;
      e.split_type     = selGroup ? selGroup.split_type : 'equal';
      e.split          = true;
    } else {
      e.split_group_id = null;
      e.split_type     = eSplitType || 'personal';
      e.split          = (eSplitType !== 'personal');
    }
  } else {
    e.split_group_id = null;
    e.split_type     = null;
    e.split          = false;
  }
  e.status=document.getElementById('eStatus').value || doneStatus(eType);
  e.note=document.getElementById('eNote').value.trim();
  e.item_id=(itemObj && itemObj.id)||e.item_id||null;
  e.vendor_id=document.getElementById('eVendor').value||null;
  // v3: update cycle_id, billing_month, account_id
  e.cycle_id = (typeof cycleIdFromDate === 'function') ? cycleIdFromDate(date) : e.cycle_id || null;
  e.billing_month = (document.getElementById('eBillingMonth')||{}).value || date.slice(0,7);
  e.account_id    = (document.getElementById('eAccount')||{}).value || null;
  save();
  sbUpdate(e);
  showMsg('editMsg','บันทึกการแก้ไขแล้ว','success');
  setTimeout(function(){ closeEdit(); renderTx(); renderDash(); },800);
}
