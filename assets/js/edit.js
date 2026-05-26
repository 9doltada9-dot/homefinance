/* HomeFinance · module: edit.js · v3.0.0 */

// ─── EDIT MODAL ──────────────────────────────────────────
var editId = null;
var eType = 'expense';

// ── Populate กลุ่มหาร (icon buttons) ──────────────────────────────
function ePopulateGroups(selectedGroupId) {
  var container = document.getElementById('eSplitBtnContainer');
  var hidden    = document.getElementById('eSplitGroup');
  if (!container || !hidden) return;
  var groups   = (typeof getSplitGroups === 'function') ? getSplitGroups() : [];
  var typeIcon = { personal:'💼', equal:'👥', ratio:'📊', custom:'🎯' };
  var items = [{ id:'', icon:'💼', label:'ส่วนตัว\n(ไม่หาร)' }].concat(
    groups.map(function(g){
      return { id: g.id, icon: typeIcon[g.split_type] || '🏠', label: g.name };
    })
  );
  var cur = selectedGroupId || '';
  hidden.value = cur;
  container.innerHTML = items.map(function(item){
    var active = item.id === cur;
    var lines  = item.label.split('\n');
    return '<button type="button" onclick="eSetSplitGroup(\''+item.id+'\')" data-sgid="'+item.id+'"'
      +' style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;'
      +'padding:8px 12px;font-size:11px;font-weight:600;border:1.5px solid '+(active?'var(--blue)':'var(--line)')+';'
      +'border-radius:10px;background:'+(active?'var(--blue)':'var(--surface2)')+';'
      +'color:'+(active?'#fff':'var(--ink2)')+';'
      +'cursor:pointer;font-family:Sarabun,sans-serif;transition:.15s;min-width:64px;line-height:1.3">'
      +'<span style="font-size:18px;line-height:1">'+item.icon+'</span>'
      +'<span>'+lines[0]+'</span>'
      +(lines[1]?'<span style="font-size:10px;opacity:.8">'+lines[1]+'</span>':'')
      +'</button>';
  }).join('');
}

function eSetSplitGroup(id) {
  var hidden    = document.getElementById('eSplitGroup');
  var container = document.getElementById('eSplitBtnContainer');
  if (hidden) hidden.value = id;
  if (!container) return;
  [].slice.call(container.querySelectorAll('button[data-sgid]')).forEach(function(btn){
    var active = btn.getAttribute('data-sgid') === id;
    btn.style.borderColor = active ? 'var(--blue)' : 'var(--line)';
    btn.style.background  = active ? 'var(--blue)' : 'var(--surface2)';
    btn.style.color       = active ? '#fff'        : 'var(--ink2)';
  });
  eUpdateSplitPreview();
}

/** Preview สมาชิก + จำนวนเงินแต่ละคนข้างๆ ปุ่มกลุ่มหาร */
function eUpdateSplitPreview() {
  var previewRow = document.getElementById('eSplitPreviewRow');
  var previewEl  = document.getElementById('eSplitPreviewContent');
  if (!previewRow || !previewEl) return;
  var groupId = (document.getElementById('eSplitGroup') || {}).value || '';
  if (!groupId) { previewRow.style.display = 'none'; return; }
  var amt = parseFloat((document.getElementById('eAmt') || {}).value) || 0;
  var snapshot = (typeof buildSplitSnapshot === 'function') ? buildSplitSnapshot(groupId, amt || 1000) : {};
  var keys = Object.keys(snapshot);
  if (!keys.length) { previewRow.style.display = 'none'; return; }
  previewRow.style.display = '';
  previewEl.innerHTML = keys.map(function(uid) {
    var s = snapshot[uid];
    var mName = s.label || (typeof nm === 'function' ? nm(uid) : uid);
    var amtStr = amt > 0
      ? '<strong style="color:var(--blue)">' + (typeof fmt === 'function' ? fmt(s.amount || 0) : (s.amount || 0)) + '</strong> ฿'
      : '<strong style="color:var(--blue)">' + (s.pct || 0).toFixed(0) + '%</strong>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;gap:8px">'
      + '<span style="color:var(--ink2);white-space:nowrap">👤 ' + mName + '</span>'
      + '<span style="white-space:nowrap">' + amtStr + '</span>'
      + '</div>';
  }).join('');
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
  // ❌ ห้าม fallback ไป getCurrentPerson() เด็ดขาด เพราะจะทำให้ user อื่น overwrite ผู้จ่ายต้นฉบับ
  var ePersonEl = document.getElementById('ePerson');
  if(ePersonEl) ePersonEl.value = e.user_id || e.person || '';
  document.getElementById('eAmt').value = e.amt;
  document.getElementById('eStatus').value = e.status;
  document.getElementById('eNote').value = e.note||'';
  // populate vendors (with smart sort via fillEditVendors) — filter by tx type
  fillEditVendors(e.type);
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
    ePopulateGroups(e.split_group_id || '');
    eUpdateSplitPreview();
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
  fillEditVendors(t);
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
  e.desc=desc; e.amt=amt;
  // คงผู้จ่ายเดิม — ไม่ overwrite ด้วย user ที่กำลัง login อยู่
  var _ePersonVal = document.getElementById('ePerson').value || e.user_id || e.person || '';
  if (_ePersonVal) { e.person = _ePersonVal; e.user_id = _ePersonVal; }
  // settlement group
  var eSplitGroupEl = document.getElementById('eSplitGroup');
  var eSplitGroupId = eSplitGroupEl ? eSplitGroupEl.value : '';
  if (eType === 'expense' && eSplitGroupId) {
    var selGroup = (typeof getSplitGroups==='function' ? getSplitGroups() : []).find(function(g){ return g.id===eSplitGroupId; });
    e.split_group_id = eSplitGroupId;
    e.split_type = selGroup ? selGroup.split_type : 'equal';
    e.split = true;
    // rebuild split_snapshot ใหม่จาก group ปัจจุบัน
    var newSnap = (typeof buildSplitSnapshot === 'function') ? buildSplitSnapshot(eSplitGroupId, amt) : {};
    e.split_snapshot = Object.keys(newSnap).length ? newSnap : null;
  } else {
    e.split_group_id = null;
    e.split_type = eType==='expense' ? 'personal' : null;
    e.split = false;
    e.split_snapshot = null;
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
  setTimeout(function(){
    closeEdit(); renderTx(); renderDash();
    // อัปเดตยอดบัญชีทุกใบที่อาจได้รับผล (กรณีเปลี่ยนบัญชีจาก A → B)
    if (typeof renderAccountCards === 'function') renderAccountCards();
    if (typeof renderAccountList  === 'function') renderAccountList();
  }, 800);
}
