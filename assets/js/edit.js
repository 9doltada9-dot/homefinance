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
      ? '<strong style="color:var(--blue)">' + (typeof fmt === 'function' ? fmtH(s.amount || 0) : (s.amount || 0)) + '</strong> ฿'
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
  _openModal('editOverlay');
  document.getElementById('editIdLabel').textContent='รายการ: '+e.desc;
  document.getElementById('eDate').value = e.date;
  // person คงค่าเดิม (hidden input — ไม่ให้ user เปลี่ยน)
  // ❌ ห้าม fallback ไป getCurrentPerson() เด็ดขาด เพราะจะทำให้ user อื่น overwrite ผู้จ่ายต้นฉบับ
  var ePersonEl = document.getElementById('ePerson');
  if(ePersonEl) ePersonEl.value = e.user_id || e.person || '';
  document.getElementById('eAmt').value = e.amt;
  document.getElementById('eStatus').value = e.status;
  document.getElementById('eNote').value = e.note||'';
  // populate vendors + always set correct value (incl. empty = -- ไม่ระบุ --)
  fillEditVendors(e.type);
  var _eVendorEl = document.getElementById('eVendor');
  if (_eVendorEl) {
    _eVendorEl.value = e.vendor_id || '';
    var _eVStarEl = document.getElementById('eVendorStar');
    if (typeof _bindEditVendorStar === 'function') _bindEditVendorStar(_eVendorEl, _eVStarEl, e.type);
  }
  // fill accounts + restore correct account (rebuild picker after setting value)
  if(typeof fillAccountSelectors === 'function') fillAccountSelectors();
  var eAcct = document.getElementById('eAccount');
  if(eAcct && e.account_id) {
    eAcct.value = e.account_id;
    if (typeof _buildAcctPicker === 'function') _buildAcctPicker('eAccount');
  }
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
    eUpdateCatStar();
    eUpdateDescStar();
  },10);
}

function closeEdit(){
  _closeModal('editOverlay', function() { editId=null; });
}

function eUpdateDescByCat(catId){
  var sel = document.getElementById('eDesc');
  if(!sel) return;
  var saved = (itemsData[catId]||[]).map(function(x){return x.name;});
  var sorted = saved.slice().sort(function(a,b){ return (isFavItem(b)?1:0)-(isFavItem(a)?1:0); });
  var cur = sel.value;
  sel.innerHTML = sorted.length
    ? sorted.map(function(d){return '<option value="'+d+'">'+d+(isFavItem(d)?' ★':'')+'</option>';}).join('')
    : '<option value="">-- ยังไม่มีรายการ --</option>';
  if(cur && sorted.indexOf(cur)>-1) sel.value = cur;
  eUpdateDescStar();
}

function eUpdateCatStar(){
  var btn = document.getElementById('eCatStar');
  var catId = (document.getElementById('eCat')||{}).value;
  if(btn) btn.innerHTML = (typeof _starBtnHtml==='function') ? _starBtnHtml(isFavCat(catId)) : (isFavCat(catId)?'⭐':'☆');
}

function eUpdateDescStar(){
  var btn = document.getElementById('eDescStar');
  var desc = (document.getElementById('eDesc')||{}).value;
  if(btn) btn.innerHTML = (typeof _starBtnHtml==='function') ? _starBtnHtml(isFavItem(desc)) : (isFavItem(desc)?'⭐':'☆');
}

function eToggleFavCat(){
  var catId = (document.getElementById('eCat')||{}).value;
  if(!catId) return;
  var f = getFavs(); if(!f.cat) f.cat={};
  f.cat[catId] = !f.cat[catId];
  saveFavs(f);
  var sel = document.getElementById('eCat');
  if(sel){
    var cur = sel.value;
    var catsByType = categories.filter(function(c){ return c.type===eType; });
    var sorted2 = catsByType.slice().sort(function(a,b){ return (isFavCat(b.id)?1:0)-(isFavCat(a.id)?1:0); });
    sel.innerHTML = sorted2.map(function(c){return '<option value="'+c.id+'">'+c.name+(isFavCat(c.id)?' ★':'')+'</option>';}).join('');
    sel.value = cur;
  }
  eUpdateCatStar();
}

function eToggleFavItem(){
  var desc = (document.getElementById('eDesc')||{}).value;
  if(!desc) return;
  var f = getFavs(); if(!f.item) f.item={};
  f.item[desc] = !f.item[desc];
  saveFavs(f);
  eUpdateDescByCat((document.getElementById('eCat')||{}).value);
  eUpdateDescStar();
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
  var catSorted = catsByType.slice().sort(function(a,b){ return (isFavCat(b.id)?1:0)-(isFavCat(a.id)?1:0); });
  sel.innerHTML = catSorted.map(function(c){return '<option value="'+c.id+'">'+c.name+(isFavCat(c.id)?' ★':'')+'</option>';}).join('');
  if(autoS && catSorted.length>0){
    sel.value = catSorted[0].id;
    ePopulateGroups('');
  }
  fillEditVendors(t);
  eUpdateCatStar();
  sel.onchange = function(){
    eUpdateDescByCat(sel.value);
    eUpdateCatStar();
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
  // v3: update cycle_id, account_id
  e.cycle_id = (typeof cycleIdFromDate === 'function') ? cycleIdFromDate(date) : e.cycle_id || null;
  e.account_id    = (document.getElementById('eAccount')||{}).value || null;
  save();
  sbUpdate(e);
  // sync paired entry สำหรับ transfer — อัพ amt/date/desc/status/note/cycle_id ให้ตรงกัน
  if (eType === 'transfer' && e.transfer_pair_id) {
    var _paired = db.find(function(x){ return x.id === e.transfer_pair_id; });
    if (_paired) {
      _paired.amt      = amt;
      _paired.date     = date;
      _paired.desc     = desc;
      _paired.status   = e.status;
      _paired.note     = e.note;
      _paired.cycle_id = e.cycle_id;
      save();
      sbUpdate(_paired);
    }
  }
  showMsg('editMsg','บันทึกการแก้ไขแล้ว','success');
  setTimeout(function(){
    closeEdit(); renderTx(); renderDash();
    // อัปเดตยอดบัญชีทุกใบที่อาจได้รับผล (กรณีเปลี่ยนบัญชีจาก A → B)
    if (typeof renderAccountCards === 'function') renderAccountCards();
    if (typeof renderAccountList  === 'function') renderAccountList();
    // re-render รายการประจำ เผื่อสถานะ (pending/paid) เปลี่ยน
    if (typeof renderRecurringList === 'function') renderRecurringList();
  }, 800);
}
