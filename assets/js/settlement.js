// ─── SPLIT SHARES HELPER (v3.6) ─────────────────────────
/**
 * คืน {personId: บาทที่ควรจ่าย} สำหรับแต่ละคน
 * รองรับทั้ง 4 รูปแบบ + backward-compat (split boolean)
 */
function getSplitShares(entry) {
  var shares = {};
  persons.forEach(function(p) { shares[p.id] = 0; });
  var type = entry.split_type;
  if (!type) type = entry.split ? 'equal' : 'personal';
  if (type === 'personal') {
    return shares;  // ไม่มีส่วนแบ่ง
  } else if (type === 'equal') {
    var n = persons.length;
    persons.forEach(function(p) { shares[p.id] = entry.amt / n; });
  } else if (type === 'ratio') {
    var ratios = entry.split_ratios || {};
    var total  = persons.reduce(function(s,p){ return s+(parseFloat(ratios[p.id])||0); }, 0);
    if (!total) total = 100;
    persons.forEach(function(p) {
      shares[p.id] = entry.amt * ((parseFloat(ratios[p.id]) || 0) / total);
    });
  } else if (type === 'custom') {
    var members = (entry.split_members && entry.split_members.length)
      ? entry.split_members
      : persons.map(function(p){ return p.id; });
    var nm = members.length;
    members.forEach(function(pid) {
      if (shares[pid] !== undefined) shares[pid] = entry.amt / nm;
    });
  }
  return shares;
}

/* HomeFinance · module: settlement.js · v3.2.0 */

// ─── PERSONAL EXPENSE TOGGLE ─────────────────────────────
var _settleShowPersonal = false;

function toggleSettlePersonal() {
  _settleShowPersonal = !_settleShowPersonal;
  var btn = document.getElementById('settlePersonalBtn');
  if (btn) {
    if (_settleShowPersonal) {
      btn.textContent = '🙈 ซ่อนรายจ่ายส่วนตัว';
      btn.style.background = 'var(--surface2)';
      btn.style.color = 'var(--ink2)';
      btn.style.borderColor = 'var(--ink3)';
    } else {
      btn.textContent = '👁 แสดงรายจ่ายส่วนตัว';
      btn.style.background = 'var(--surface)';
      btn.style.color = 'var(--ink3)';
      btn.style.borderColor = 'var(--line)';
    }
  }
  renderSettle();
}

// ─── SETTLEMENT ──────────────────────────────────────────
function _fmtMthLabel(m) {
  if (!m) return m;
  var parts = m.split('-');
  var year = (parseInt(parts[0]) || 0) + 543;
  var idx  = (parseInt(parts[1]) || 1) - 1;
  var FM = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
            'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return (FM[idx] || FM[0]) + ' ' + year;
}

function populateMths(selId){
  var months=Array.from(new Set(db.map(function(e){return e.date.substring(0,7);}))).sort().reverse();
  var sel=document.getElementById(selId);
  var cur=sel.value||months[0];
  sel.innerHTML='<option value="">เลือกเดือน</option>'+months.map(function(m){return '<option value="'+m+'" '+(m===cur?'selected':'')+'>'+_fmtMthLabel(m)+'</option>';}).join('');
  if(!sel.value && months[0]) sel.value=months[0];
  // populate group select
  var grpSel=document.getElementById('settleGroup');
  if(grpSel && typeof getSplitGroups==='function'){
    var curGrp=grpSel.value;
    var groups=getSplitGroups();
    grpSel.innerHTML='<option value="">ทุกกลุ่ม</option>'+
      groups.map(function(g){return '<option value="'+g.id+'"'+(g.id===curGrp?' selected':'')+'>'+g.name+'</option>';}).join('');
  }
}

// ─── HELPERS ──────────────────────────────────────────────

/**
 * คำนวณการโอนเงินที่น้อยที่สุด จาก balance แต่ละ uid
 * balance > 0 = จ่ายเกิน (ได้รับคืน), < 0 = จ่ายขาด (ต้องโอน)
 */
function _computeTransfers(balances, nameMap) {
  var entries = Object.keys(balances).map(function(uid) {
    return { uid: uid, bal: balances[uid], name: nameMap[uid] || uid };
  });
  var creditors = entries.filter(function(e){ return e.bal > 0.5; })
                         .sort(function(a,b){ return b.bal - a.bal; });
  var debtors   = entries.filter(function(e){ return e.bal < -0.5; })
                         .sort(function(a,b){ return a.bal - b.bal; });
  var result = [];
  var ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    var c = creditors[ci], d = debtors[di];
    var amt = Math.min(c.bal, -d.bal);
    if (amt > 0.5) result.push({ from: d.name, fromUid: d.uid, to: c.name, toUid: c.uid, amount: amt });
    c.bal -= amt;
    d.bal += amt;
    if (c.bal < 0.5) ci++;
    if (-d.bal < 0.5) di++;
  }
  return result;
}

/** แปลง person.id (A/B) เป็น user_id (uuid) */
function _pidToUid(pid) {
  if (!pid) return pid;
  var p = persons.find(function(x){ return x.id === pid; });
  return (p && p.user_id) ? p.user_id : pid;
}

/** ดึงชื่อที่แสดง จาก uid — ให้ความสำคัญ _allProfiles (ชื่อล่าสุด) ก่อนเสมอ */
function _uidToName(uid) {
  // 1. _allProfiles (Supabase — ชื่อล่าสุดที่แก้ไขแล้ว)
  if (window._allProfiles && window._allProfiles.length) {
    var prof = window._allProfiles.find(function(x){ return x.id === uid; });
    if (prof && prof.name) return prof.name;
  }
  // 2. persons array (local)
  var p = persons.find(function(x){ return x.user_id === uid; });
  if (p) return p.name;
  p = persons.find(function(x){ return x.id === uid; });
  return p ? p.name : uid;
}

/** ดึงชื่อร้านค้าจาก vendor_id */
function _vendorName(vid) {
  if (!vid) return '';
  var arr = (typeof vendorsData !== 'undefined') ? vendorsData : [];
  var v = arr.find(function(x){ return x.id === vid; });
  return v ? v.name : '';
}

/** สร้าง nameMap: uid → name — รวมจาก persons + _allProfiles + group members */
function _buildNameMap() {
  var m = {};
  // 1. persons array
  persons.forEach(function(p) {
    var uid = p.user_id || p.id;
    if (uid) m[uid] = p.name;
  });
  // 2. Supabase profiles (แม่นที่สุด — override ชื่อเก่า)
  if (window._allProfiles && Array.isArray(window._allProfiles)) {
    window._allProfiles.forEach(function(prof) {
      if (prof.id && prof.name) m[prof.id] = prof.name;
    });
  }
  // 3. group member labels (user_id → label ที่ตั้งไว้ในกลุ่ม)
  if (typeof getSplitGroups === 'function') {
    getSplitGroups().forEach(function(g) {
      (g.members || []).forEach(function(mem) {
        if (mem.user_id && mem.label && !m[mem.user_id]) {
          m[mem.user_id] = mem.label;
        }
      });
    });
  }
  return m;
}

// ─── RENDER SETTLEMENT ────────────────────────────────────
function renderSettle(){
  var m       = document.getElementById('settleMonth').value;
  var groupId = (document.getElementById('settleGroup') || {}).value || '';
  var showPersonal = _settleShowPersonal;
  var out     = document.getElementById('settleContent');
  if (!m) { out.innerHTML = '<div class="empty">เลือกเดือน</div>'; return; }
  try {

  // ── หา group object + members ──────────────────────────────
  var group = null;
  var groupMemberUids = null;  // null = ทุกคน
  if (groupId && typeof getSplitGroups === 'function') {
    group = getSplitGroups().find(function(g){ return g.id === groupId; });
    if (group) {
      groupMemberUids = (group.members || [])
        .filter(function(m){ return m.active; })
        .map(function(m){ return m.user_id; });
    }
  }

  var allExp = db.filter(function(e){ return e.date.startsWith(m) && e.type==='expense' && isPaid(e); });

  // ── แยก split entries กับ personal entries ─────────────────
  var splitExp, personalExp;
  if (groupId) {
    splitExp    = allExp.filter(function(e){ return e.split_group_id === groupId; });
    personalExp = allExp.filter(function(e){ return e.split_group_id !== groupId || !e.split_group_id; });
  } else {
    splitExp    = allExp.filter(function(e){ var t=e.split_type||(e.split?'equal':'personal'); return t!=='personal'; });
    personalExp = allExp.filter(function(e){ var t=e.split_type||(e.split?'equal':'personal'); return t==='personal'; });
  }

  // ── คำนวณ paid / owed per uid ──────────────────────────────
  var nameMap = _buildNameMap();
  // เพิ่มชื่อจาก split_snapshot.label ของรายการในเดือนนี้
  db.filter(function(e){ return e.date.startsWith(m); }).forEach(function(e){
    if (e.split_snapshot) {
      Object.keys(e.split_snapshot).forEach(function(uid){
        if (!nameMap[uid] && e.split_snapshot[uid].label) {
          nameMap[uid] = e.split_snapshot[uid].label;
        }
      });
    }
  });
  // สร้าง active uid set ก่อน — ใช้กรอง snapshot ที่มี user ถูกลบ
  var _activeUidSet = {};
  if (window._allProfiles && window._allProfiles.length) {
    window._allProfiles.forEach(function(p){ if(p.id) _activeUidSet[p.id] = true; });
  }
  persons.forEach(function(p){ _activeUidSet[p.user_id || p.id] = true; });

  var paid = {}, owed = {};

  // เริ่มต้น uid จาก group members ถ้ามี หรือจาก persons
  var initUids = groupMemberUids || persons.map(function(p){ return p.user_id||p.id; });
  initUids.forEach(function(uid){ paid[uid]=0; owed[uid]=0; });

  splitExp.forEach(function(e) {
    var payerUid = e.user_id || e.user_id || _pidToUid(e.person) || e.person;

    if (e.split_snapshot && Object.keys(e.split_snapshot).length) {
      // ตรวจว่า non-payer ใน snapshot ยังมีอยู่ในระบบหรือไม่
      var snapKeys = Object.keys(e.split_snapshot);
      var nonPayerKeys = snapKeys.filter(function(uid){ return uid !== payerUid; });
      var hasDeletedMember = nonPayerKeys.length > 0 &&
        nonPayerKeys.every(function(uid){ return !_activeUidSet[uid]; });

      if (hasDeletedMember && e.split_group_id && typeof buildSplitSnapshot === 'function') {
        // non-payer ทุกคนใน snapshot ถูกลบแล้ว → ใช้นิยามกลุ่มปัจจุบันแทน
        var freshSnap = buildSplitSnapshot(e.split_group_id, e.amt);
        if (Object.keys(freshSnap).length) {
          paid[payerUid] = (paid[payerUid]||0) + e.amt;
          Object.keys(freshSnap).forEach(function(uid){
            owed[uid] = (owed[uid]||0) + (freshSnap[uid].amount||0);
          });
        }
      } else {
        // ✅ snapshot ปกติ — ใช้ตามเดิม
        paid[payerUid] = (paid[payerUid]||0) + e.amt;
        snapKeys.forEach(function(uid){
          owed[uid] = (owed[uid]||0) + (e.split_snapshot[uid].amount||0);
        });
      }
    } else if (e.split_group_id && typeof buildSplitSnapshot === 'function') {
      // ✅ ไม่มี snapshot แต่มี group_id → สร้าง on-the-fly จากนิยามกลุ่ม
      var onTheFly = buildSplitSnapshot(e.split_group_id, e.amt);
      if (Object.keys(onTheFly).length) {
        paid[payerUid] = (paid[payerUid]||0) + e.amt;
        Object.keys(onTheFly).forEach(function(uid){
          owed[uid] = (owed[uid]||0) + (onTheFly[uid].amount||0);
        });
      }
    } else {
      // ⬅ backward compat (split boolean เก่า)
      paid[payerUid] = (paid[payerUid]||0) + e.amt;
      var shares = getSplitShares(e);
      Object.keys(shares).forEach(function(pid){
        var uid = _pidToUid(pid)||pid;
        owed[uid] = (owed[uid]||0) + (shares[pid]||0);
      });
    }
  });

  // รวม uid ทั้งหมดที่มีส่วนร่วม (ไม่ซ้ำ)
  var allUids = Object.keys(paid).concat(Object.keys(owed))
    .filter(function(v,i,a){ return a.indexOf(v)===i && ((paid[v]||0)+(owed[v]||0) > 0); });

  // ถ้ามี group filter → เอา member + payer (แม้ไม่ใช่ member ก็ตาม)
  if (groupMemberUids) {
    allUids = allUids.filter(function(uid){
      return groupMemberUids.indexOf(uid) !== -1 || (paid[uid]||0) > 0.5;
    });
  }

  // กรองเฉพาะ uid ที่ยังมีอยู่ใน system — ไม่แสดง user ที่ถูกลบออกไปแล้ว
  allUids = allUids.filter(function(uid){ return _activeUidSet[uid]; });

  var balances = {};
  allUids.forEach(function(uid){ balances[uid] = (paid[uid]||0) - (owed[uid]||0); });

  var transfers  = _computeTransfers(Object.assign({}, balances), nameMap);
  var totalSplit = splitExp.reduce(function(s,e){ return s+e.amt; }, 0);

  // ── Group title ────────────────────────────────────────────
  var grpTitle = '';
  if (group) {
    var memberNames = (group.members||[])
      .filter(function(m){ return m.active; })
      .map(function(m){ return nameMap[m.user_id] || m.label || m.user_id; })
      .join(' + ');
    grpTitle = ' · ' + group.name + (memberNames ? ' (' + memberNames + ')' : '');
  }

  // ── Summary cards per person ───────────────────────────────
  var personCards = allUids.map(function(uid){
    var name = nameMap[uid] || uid;
    var p    = paid[uid]||0;
    var o    = owed[uid]||0;
    var bal  = p - o;
    var balColor = bal > 0.5 ? 'var(--green)' : (bal < -0.5 ? 'var(--red,#dc2626)' : 'var(--ink3)');
    var balLabel = bal > 0.5 ? '↑ ได้รับคืน' : (bal < -0.5 ? '↓ ต้องโอน' : '✓ เรียบร้อย');
    var initials = name.charAt(0).toUpperCase();
    return '<div style="flex:1;min-width:150px;background:var(--surface);backdrop-filter:blur(16px) saturate(150%);border:1px solid var(--g-brd);border-radius:16px;padding:14px 16px;box-shadow:var(--g-shadow)">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        +'<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700">'+initials+'</div>'
        +'<span style="font-size:14px;font-weight:700;color:var(--ink)">'+name+'</span>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink3);margin-bottom:3px"><span>จ่ายจริง</span><span style="font-family:monospace;font-weight:600;color:var(--ink)">'+fmtH(p)+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink3);margin-bottom:8px"><span>ควรจ่าย</span><span style="font-family:monospace;font-weight:600;color:var(--ink)">'+fmtH(o)+'</span></div>'
      +'<div style="border-top:1px solid var(--line);padding-top:8px;display:flex;justify-content:space-between;align-items:center">'
        +'<span style="font-size:11px;color:'+balColor+';font-weight:700">'+balLabel+'</span>'
        +'<span style="font-family:monospace;font-weight:800;font-size:15px;color:'+balColor+'">'+fmtH(Math.abs(bal))+'</span>'
      +'</div>'
    +'</div>';
  }).join('');

  // ── Transfer instructions ──────────────────────────────────
  var transferHtml = '';
  if (!transfers.length) {
    transferHtml = '<div style="background:var(--green-bg,#f0fdf4);border:1.5px solid var(--green,#22c55e);border-radius:10px;padding:14px;text-align:center">'
      +'<div style="font-size:15px;font-weight:700;color:var(--green,#166534)">✅ ไม่มียอดค้างชำระ</div>'
      +'<div style="font-size:12px;color:var(--green,#166534);margin-top:4px">ทุกคนจ่ายเป็นสัดส่วนที่ถูกต้องแล้ว</div>'
    +'</div>';
  } else {
    transferHtml = transfers.map(function(t){
      return '<div style="background:var(--surface2);border:1.5px solid var(--orange,#f97316);border-radius:12px;padding:14px 16px">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'
          +'<span style="font-size:16px">💸</span>'
          +'<span style="font-size:11px;font-weight:700;color:var(--orange,#ea580c);text-transform:uppercase;letter-spacing:.5px">ต้องโอนเงิน</span>'
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
          +'<span style="font-size:14px;font-weight:700;color:var(--red,#dc2626);background:var(--red-bg,#fef2f2);padding:4px 10px;border-radius:20px">'+t.from+'</span>'
          +'<span style="font-size:12px;color:var(--ink3)">ต้องโอนให้</span>'
          +'<span style="font-size:14px;font-weight:700;color:var(--green,#16a34a);background:var(--green-bg,#f0fdf4);padding:4px 10px;border-radius:20px">'+t.to+'</span>'
          +'<span style="margin-left:auto;font-family:monospace;font-size:18px;font-weight:700;color:var(--orange,#ea580c)">'+fmtH(t.amount)+'</span>'
        +'</div>'
      +'</div>';
    }).join('');
  }

  // ── Detail rows — dynamic columns per member ─────────────
  // รวบรวม uid ทุกคนที่ปรากฏใน snapshot (เรียง: payers ก่อน แล้ว members)
  var detailUids = [];
  splitExp.forEach(function(e){
    var payerU = e.user_id || _pidToUid(e.person) || e.person;
    if (payerU && detailUids.indexOf(payerU) === -1) detailUids.push(payerU);
    var snap = e.split_snapshot;
    if (snap) Object.keys(snap).forEach(function(uid){
      if (detailUids.indexOf(uid) === -1) detailUids.push(uid);
    });
  });
  // กรอง detailUids ให้เหลือเฉพาะ active users (ไม่แสดง user ที่ถูกลบ)
  detailUids = detailUids.filter(function(uid){ return _activeUidSet[uid]; });
  if (!detailUids.length) detailUids = allUids.slice();
  // fallback: ใช้ allUids ถ้าไม่มี snapshot
  if (!detailUids.length) detailUids = allUids.slice();

  var isMobile = window.innerWidth <= 900;

  // ── Mobile: cards ──────────────────────────────────────────
  var detailMobile = splitExp.map(function(e){
    var payerU = e.user_id || _pidToUid(e.person) || e.person;
    var payerName = nameMap[payerU] || e.person;
    var vendor = _vendorName(e.vendor_id);
    var snap = e.split_snapshot;
    // on-the-fly ถ้าไม่มี snapshot
    if (!snap && e.split_group_id && typeof buildSplitSnapshot==='function') {
      snap = buildSplitSnapshot(e.split_group_id, e.amt);
    }
    var memberRows = snap ? Object.keys(snap).map(function(uid){
      var isPayer = uid === payerU;
      var name = nameMap[uid] || snap[uid].label || uid;
      var amt  = snap[uid].amount || 0;
      return '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px">'
        +'<span style="color:'+(isPayer?'var(--green,#16a34a)':'var(--ink2)')+'">'+name+(isPayer?' (จ่ายแล้ว)':'')+'</span>'
        +'<span style="font-family:monospace;font-weight:600;color:'+(isPayer?'var(--green,#16a34a)':'var(--ink)')+'">'+( isPayer?'✓ ':'')+fmtH(amt)+'</span>'
      +'</div>';
    }).join('') : '';
    return '<div style="padding:10px 12px;border-bottom:1px solid var(--line)">'
      +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">'
        +'<span style="font-size:13px;font-weight:600">'+e.desc+'</span>'
        +'<span style="font-family:monospace;font-size:13px;font-weight:700;color:var(--red,#dc2626)">'+fmtH(e.amt)+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--ink3);margin-bottom:4px">📅 '+toThaiDateShort(e.date)+(vendor?' · 🏪 '+vendor:'')+' · 👤 ผู้จ่าย: '+payerName+(e.note&&e.note.trim()?' · 📝 '+e.note.trim():'')+'</div>'
      +(memberRows ? '<div style="background:var(--surface2);border-radius:8px;padding:6px 10px;margin-top:4px">'+memberRows+'</div>' : '')
    +'</div>';
  }).join('');

  // ── Desktop: dynamic table ──────────────────────────────────
  // color palette ต่อ uid (เหมือน personPill)
  var _SETTLE_COLORS = [
    { bg:'#ebf0fe', cl:'#1a4fa0' },
    { bg:'#fef8e7', cl:'#b5600a' },
    { bg:'#eef7f2', cl:'#1a7a4a' },
    { bg:'#f0eef9', cl:'#4a3a9a' },
    { bg:'#fff0f0', cl:'#b91c1c' },
    { bg:'#e8faf4', cl:'#0e7354' },
  ];
  var _uidColorMap = {};
  detailUids.forEach(function(uid, i){
    _uidColorMap[uid] = _SETTLE_COLORS[i % _SETTLE_COLORS.length];
  });

  var thCells = '<th>รายการ</th><th style="white-space:nowrap">ร้านค้า</th><th style="white-space:nowrap">หมายเหตุ</th><th style="white-space:nowrap">ผู้จ่าย</th><th style="text-align:right;white-space:nowrap">รวม</th>'
    + detailUids.map(function(uid){
        var c = _uidColorMap[uid] || { bg:'var(--surface2)', cl:'var(--ink)' };
        return '<th style="text-align:right;white-space:nowrap;background:'+c.bg+';color:'+c.cl+';border-radius:6px;padding:6px 10px">'+( nameMap[uid]||uid)+'</th>';
      }).join('');
  var totalCols = {}; detailUids.forEach(function(u){ totalCols[u]=0; });
  var _sGrp=[], _sDm={};
  splitExp.forEach(function(e){ var d=e.date; if(!_sDm[d]){_sDm[d]=[];_sGrp.push({date:d,items:_sDm[d]});} _sDm[d].push(e); });
  var trRows = (function(){
    return _sGrp.map(function(g){
      return '<tr style="background:var(--surface2)"><td colspan="'+(5+detailUids.length)+'" style="padding:5px 10px;font-size:11px;font-weight:700;color:var(--ink2);border-top:2px solid var(--line)">'+toThaiDateStr(g.date)+'</td></tr>'
        + g.items.map(function(e, rowIdx){
    var payerU = e.user_id || _pidToUid(e.person) || e.person;
    var payerName = nameMap[payerU] || e.person;
    var payerColor = _uidColorMap[payerU] || { bg:'#eef7f2', cl:'#1a7a4a' };
    var snap = e.split_snapshot;
    if (!snap && e.split_group_id && typeof buildSplitSnapshot==='function') {
      snap = buildSplitSnapshot(e.split_group_id, e.amt);
    }
    var cols = detailUids.map(function(uid){
      var amt = snap && snap[uid] ? (snap[uid].amount||0) : 0;
      totalCols[uid] = (totalCols[uid]||0) + amt;
      var isPayer = uid === payerU;
      var c = _uidColorMap[uid] || {};
      return '<td style="text-align:right;font-family:monospace;font-size:12px;'+(isPayer?'color:'+c.cl+';font-weight:700':'')+'">'
        +(isPayer?'✓ ':'')+(amt>0 ? fmtH(amt) : '—')
      +'</td>';
    }).join('');
    var vendor = _vendorName(e.vendor_id);
    var noteText = (e.note || '').trim();
    return '<tr>'
      +'<td style="font-size:13px">'+e.desc+'</td>'
      +'<td style="font-size:12px;color:var(--ink3)">'+vendor+'</td>'
      +'<td style="font-size:12px;color:var(--ink3);max-width:160px">'+noteText+'</td>'
      +'<td><span style="background:'+payerColor.bg+';color:'+payerColor.cl+';font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;white-space:nowrap">'+payerName+'</span></td>'
      +'<td style="text-align:right;font-family:monospace;font-weight:600">'+fmtH(e.amt)+'</td>'
      +cols
    +'</tr>';
        }).join('');
    }).join('');
  })();
  var totalRow = '<tr style="font-weight:700;background:var(--surface2)">'
    +'<td colspan="2">รวม</td>'
    +'<td></td>'
    +'<td></td>'
    +'<td style="text-align:right;font-family:monospace">'+fmtH(totalSplit)+'</td>'
    +detailUids.map(function(uid){
        var c = _uidColorMap[uid] || {};
        return '<td style="text-align:right;font-family:monospace;color:'+(c.cl||'var(--ink)')+';font-weight:700">'+fmtH(totalCols[uid]||0)+'</td>';
      }).join('')
  +'</tr>';
  var detailDesktop = '<div class="table-scroll"><table>'
    +'<tr>'+thCells+'</tr>'+trRows+totalRow+'</table></div>';

  // ── Card layout: date-grouped + 2-line items + clickable ──
  var detailCards = _sGrp.map(function(g){
    var dayTotal = g.items.reduce(function(s,e){ return s+e.amt; },0);
    return '<div style="background:var(--surface);border-radius:14px;border:1px solid var(--line);'
      +'backdrop-filter:blur(var(--g-blur)) saturate(var(--g-sat));'
      +'-webkit-backdrop-filter:blur(var(--g-blur)) saturate(var(--g-sat));'
      +'box-shadow:var(--g-shadow);margin-bottom:12px;overflow:hidden">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;border-bottom:1px solid var(--line);background:var(--surface2)">'
      +  '<span style="font-size:12px;font-weight:700;color:var(--ink2)">'+toThaiDateStr(g.date)+'</span>'
      +  '<span style="font-size:11px;color:var(--red,#dc2626);font-family:monospace;font-weight:600">'+fmtH(dayTotal)+'</span>'
      +'</div>'
      + g.items.map(function(e, idx){
          var payerU = e.user_id || _pidToUid(e.person) || e.person;
          var payerName = nameMap[payerU] || e.person;
          var payerColor = _uidColorMap[payerU] || {bg:'#eef7f2',cl:'#1a7a4a'};
          var vendor = _vendorName(e.vendor_id);
          var snap = e.split_snapshot;
          if (!snap && e.split_group_id && typeof buildSplitSnapshot==='function') snap = buildSplitSnapshot(e.split_group_id, e.amt);
          var memberChips = snap ? Object.keys(snap).map(function(uid){
            var isPayer = uid === payerU;
            var c = _uidColorMap[uid] || {bg:'var(--surface2)',cl:'var(--ink2)'};
            var amt = snap[uid].amount||0;
            return '<span style="font-size:10px;padding:1px 6px;border-radius:20px;background:'+c.bg+';color:'+c.cl+';white-space:nowrap">'
              +(nameMap[uid]||uid)+' '+fmtH(amt)+(isPayer?' ✓':'')+'</span>';
          }).join('') : '';
          var iconId = typeof getDescriptionIconId==='function' ? getDescriptionIconId(e.desc) : null;
          var iconHtml = iconId
            ? '<svg width="18" height="18" viewBox="0 0 24 24" style="display:block"><use href="#'+iconId+'"></use></svg>'
            : '<span style="font-size:14px">💳</span>';
          var noteText = (e.note||'').trim();
          return '<div class="tx-card-row" onclick="txDetailModal(\''+e.id+'\')" '
            +'style="display:flex;align-items:center;gap:10px;padding:10px 18px 10px 14px;cursor:pointer;'
            +(idx>0?'border-top:1px solid var(--line);':'')
            +'">'
            +'<div style="width:34px;height:34px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0">'+iconHtml+'</div>'
            +'<div style="flex:1;min-width:0">'
              +'<div style="font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</div>'
              +'<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;align-items:center">'
                +'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:'+payerColor.bg+';color:'+payerColor.cl+';white-space:nowrap">'+payerName+'</span>'
                +(vendor?'<span style="font-size:11px;color:var(--ink3)"> · 🏪 '+vendor+'</span>':'')
                +(noteText?'<span style="font-size:11px;color:var(--ink3)"> '+noteText+'</span>':'')
                +(memberChips?memberChips:'')
              +'</div>'
            +'</div>'
            +'<div style="flex-shrink:0;text-align:right">'
              +'<div style="font-size:14px;font-weight:700;font-family:monospace;color:var(--red,#dc2626)">'+fmtH(e.amt)+'</div>'
            +'</div>'
          +'</div>';
        }).join('')
    +'</div>';
  }).join('');

  var detailRows = detailCards;

  // ── Personal section — ใช้รูปแบบเดียวกับตาราง detail หลัก ──
  var personalHtml = '';
  if (showPersonal && personalExp.length) {
    var persTotal = personalExp.reduce(function(s,e){ return s+e.amt; }, 0);

    // รวบรวม uid ที่จ่ายรายการส่วนตัว (สำหรับสีผู้จ่าย)
    var persUids = [];
    personalExp.forEach(function(e){
      var pu = e.user_id || _pidToUid(e.person) || e.person;
      if (pu && persUids.indexOf(pu) === -1) persUids.push(pu);
    });
    var _persColorMap = {};
    persUids.forEach(function(uid, i){
      _persColorMap[uid] = _SETTLE_COLORS[i % _SETTLE_COLORS.length];
    });

    if (true) {  // unified card layout
      var _pGrp2=[], _pDm2={};
      personalExp.forEach(function(e){ var d=e.date; if(!_pDm2[d]){_pDm2[d]=[];_pGrp2.push({date:d,items:_pDm2[d]});} _pDm2[d].push(e); });
      var persCards = _pGrp2.map(function(g){
        var persDay = g.items.reduce(function(s,e){ return s+e.amt; },0);
        return '<div style="background:var(--surface);border-radius:14px;border:1px solid var(--line);'
          +'backdrop-filter:blur(var(--g-blur)) saturate(var(--g-sat));'
          +'-webkit-backdrop-filter:blur(var(--g-blur)) saturate(var(--g-sat));'
          +'box-shadow:var(--g-shadow);margin-bottom:10px;overflow:hidden">'
          +'<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 14px;border-bottom:1px solid var(--line);background:var(--surface2)">'
          +  '<span style="font-size:12px;font-weight:700;color:var(--ink2)">'+toThaiDateStr(g.date)+'</span>'
          +  '<span style="font-size:11px;color:var(--red,#dc2626);font-family:monospace;font-weight:600">'+fmtH(persDay)+'</span>'
          +'</div>'
          + g.items.map(function(e, idx){
              var pu = e.user_id || _pidToUid(e.person) || e.person;
              var payerName = nameMap[pu] || e.person;
              var payerColor = _persColorMap[pu] || {bg:'#eef7f2',cl:'#1a7a4a'};
              var vendor = _vendorName(e.vendor_id);
              var noteText = (e.note||'').trim();
              var iconId = typeof getDescriptionIconId==='function' ? getDescriptionIconId(e.desc) : null;
              var iconHtml = iconId
                ? '<svg width="18" height="18" viewBox="0 0 24 24" style="display:block"><use href="#'+iconId+'"></use></svg>'
                : '<span style="font-size:14px">💳</span>';
              return '<div class="tx-card-row" onclick="txDetailModal(\''+e.id+'\')" '
                +'style="display:flex;align-items:center;gap:10px;padding:10px 18px 10px 14px;cursor:pointer;'
                +(idx>0?'border-top:1px solid var(--line);':'')
                +'">'
                +'<div style="width:34px;height:34px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0">'+iconHtml+'</div>'
                +'<div style="flex:1;min-width:0">'
                  +'<div style="font-size:14px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</div>'
                  +'<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;align-items:center">'
                    +'<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:'+payerColor.bg+';color:'+payerColor.cl+';white-space:nowrap">'+payerName+'</span>'
                    +(vendor?'<span style="font-size:11px;color:var(--ink3)"> · 🏪 '+vendor+'</span>':'')
                    +(noteText?'<span style="font-size:11px;color:var(--ink3)"> '+noteText+'</span>':'')
                  +'</div>'
                +'</div>'
                +'<div style="flex-shrink:0;text-align:right">'
                  +'<div style="font-size:14px;font-weight:700;font-family:monospace;color:var(--red,#dc2626)">'+fmtH(e.amt)+'</div>'
                +'</div>'
              +'</div>';
            }).join('')
        +'</div>';
      }).join('');
      personalHtml = '<div style="margin-top:16px">'
        +'<div style="font-size:12px;font-weight:700;color:var(--ink3);letter-spacing:.4px;margin-bottom:8px">💼 รายจ่ายส่วนตัว (ไม่นำมาคำนวณ)</div>'
        +persCards
        +'<div style="display:flex;justify-content:space-between;padding:8px 4px;font-weight:700;font-size:13px;border-top:1px solid var(--line);margin-top:4px">'
          +'<span>รวมส่วนตัว</span>'
          +'<span style="font-family:monospace;color:var(--red,#dc2626)">'+fmtH(persTotal)+'</span>'
        +'</div>'
      +'</div>';
    } else {
      // Desktop: table เหมือน detailDesktop (วันที่, รายการ, ร้านค้า, หมายเหตุ, ผู้จ่าย, รวม)
      var _pGrp=[], _pDm={};
      personalExp.forEach(function(e){ var d=e.date; if(!_pDm[d]){_pDm[d]=[];_pGrp.push({date:d,items:_pDm[d]});} _pDm[d].push(e); });
      var persRows = (function(){
        return _pGrp.map(function(g){
          return '<tr style="background:var(--surface2)"><td colspan="5" style="padding:5px 10px;font-size:11px;font-weight:700;color:var(--ink2);border-top:2px solid var(--line)">'+toThaiDateStr(g.date)+'</td></tr>'
            + g.items.map(function(e, rowIdx){
        var pu = e.user_id || _pidToUid(e.person) || e.person;
        var payerName = nameMap[pu] || e.person;
        var payerColor = _persColorMap[pu] || { bg:'var(--surface2)', cl:'var(--ink2)' };
        var vendor = _vendorName(e.vendor_id);
        var noteText = (e.note || '').trim();
        return '<tr>'
          +'<td style="font-size:13px">'+e.desc+'</td>'
          +'<td style="font-size:12px;color:var(--ink3)">'+vendor+'</td>'
          +'<td style="font-size:12px;color:var(--ink3);max-width:160px">'+noteText+'</td>'
          +'<td><span style="background:'+payerColor.bg+';color:'+payerColor.cl+';font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;white-space:nowrap">'+payerName+'</span></td>'
          +'<td style="text-align:right;font-family:monospace;font-weight:600;color:var(--red,#dc2626)">'+fmtH(e.amt)+'</td>'
        +'</tr>';
          }).join('');
        }).join('');
      })();
    }
  }

  // ── Render ─────────────────────────────────────────────────
  out.innerHTML =
    // summary bar
    '<div style="font-size:12px;color:var(--ink3);margin-bottom:14px;font-weight:500;padding:8px 12px;background:var(--surface2);border-radius:10px">'
      +'📅 '+m+grpTitle+' · '+splitExp.length+' รายการ · รวม <span style="font-family:monospace;color:var(--red,#dc2626);font-weight:700">'+fmtH(totalSplit)+'</span>'
    +'</div>'
    // person cards
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">'+personCards+'</div>'
    // transfer section
    +'<div style="margin-bottom:16px">'
      +'<div style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">💸 สรุปการโอนเงิน</div>'
      +'<div style="display:flex;flex-direction:column;gap:8px">'+transferHtml+'</div>'
    +'</div>'
    // detail section
    +'<div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">'
      +'<span style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px">📋 รายละเอียด</span>'
      +'<button onclick="exportSettleHTML(\'' + m + '\',\'' + groupId + '\')" style="background:var(--blue);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun,sans-serif">📋 HTML</button>'
    +'</div>'
    +(splitExp.length ? detailRows : '<div style="color:var(--ink3);text-align:center;padding:20px;font-size:13px">ไม่มีรายการ'+(groupId?' ในกลุ่มนี้':'')+'</div>')
    +personalHtml;
  } catch(err) {
    console.error('[Settlement] renderSettle error:', err);
    out.innerHTML = '<div style="padding:20px;color:var(--red,#dc2626);background:var(--red-bg,#fef2f2);border-radius:10px;margin:12px 0">'
      +'<div style="font-weight:700;margin-bottom:4px">⚠️ เกิดข้อผิดพลาดในการแสดงผล</div>'
      +'<div style="font-size:12px;color:var(--ink3)">'+(err && err.message ? err.message : String(err))+'</div>'
      +'<div style="font-size:11px;color:var(--ink3);margin-top:8px">กรุณาแจ้ง error นี้ให้นักพัฒนาทราบ</div>'
    +'</div>';
  }
}


function exportSettleHTML(month, groupId) {
  try {
  var nameMap = _buildNameMap();
  var allExp  = db.filter(function(e){ return e.date.startsWith(month) && e.type==='expense' && isPaid(e); });

  // ── หา group ─────────────────────────────────────────────
  var group = null;
  var groupMemberUids = null;
  if (groupId && typeof getSplitGroups === 'function') {
    group = getSplitGroups().find(function(g){ return g.id === groupId; });
    if (group) groupMemberUids = (group.members||[]).filter(function(m){ return m.active; }).map(function(m){ return m.user_id; });
  }

  var splitExp = groupId
    ? allExp.filter(function(e){ return e.split_group_id === groupId; })
    : allExp.filter(function(e){ var t=e.split_type||(e.split?'equal':'personal'); return t!=='personal'; });

  // ── คำนวณ balances ────────────────────────────────────────
  // สร้าง active uid set — กรอง snapshot ที่มี user ถูกลบ
  var _pdfActiveUidSet = {};
  if (window._allProfiles && window._allProfiles.length) {
    window._allProfiles.forEach(function(p){ if(p.id) _pdfActiveUidSet[p.id] = true; });
  }
  persons.forEach(function(p){ _pdfActiveUidSet[p.user_id || p.id] = true; });

  var paid = {}, owed = {};
  var initUids = groupMemberUids || persons.map(function(p){ return p.user_id||p.id; });
  initUids.forEach(function(uid){ paid[uid]=0; owed[uid]=0; });

  splitExp.forEach(function(e){
    var payerUid = e.user_id || _pidToUid(e.person) || e.person;
    if (e.split_snapshot && Object.keys(e.split_snapshot).length) {
      var snapKeys2 = Object.keys(e.split_snapshot);
      var nonPayers2 = snapKeys2.filter(function(uid){ return uid !== payerUid; });
      var hasDeleted2 = nonPayers2.length > 0 &&
        nonPayers2.every(function(uid){ return !_pdfActiveUidSet[uid]; });

      if (hasDeleted2 && e.split_group_id && typeof buildSplitSnapshot === 'function') {
        // non-payer ทุกคนใน snapshot ถูกลบ → ใช้กลุ่มปัจจุบันแทน
        var freshSnap2 = buildSplitSnapshot(e.split_group_id, e.amt);
        if (Object.keys(freshSnap2).length) {
          paid[payerUid] = (paid[payerUid]||0) + e.amt;
          Object.keys(freshSnap2).forEach(function(uid){
            owed[uid] = (owed[uid]||0) + (freshSnap2[uid].amount||0);
          });
        }
      } else {
        paid[payerUid] = (paid[payerUid]||0) + e.amt;
        snapKeys2.forEach(function(uid){
          owed[uid] = (owed[uid]||0) + (e.split_snapshot[uid].amount||0);
        });
      }
    } else if (e.split_group_id && typeof buildSplitSnapshot === 'function') {
      var onTheFly2 = buildSplitSnapshot(e.split_group_id, e.amt);
      if (Object.keys(onTheFly2).length) {
        paid[payerUid] = (paid[payerUid]||0) + e.amt;
        Object.keys(onTheFly2).forEach(function(uid){
          owed[uid] = (owed[uid]||0) + (onTheFly2[uid].amount||0);
        });
      }
    } else {
      paid[payerUid] = (paid[payerUid]||0) + e.amt;
      var shares = getSplitShares(e);
      Object.keys(shares).forEach(function(pid){
        var uid = _pidToUid(pid)||pid;
        owed[uid] = (owed[uid]||0) + (shares[pid]||0);
      });
    }
  });

  var allUids = Object.keys(paid).concat(Object.keys(owed))
    .filter(function(v,i,a){ return a.indexOf(v)===i && ((paid[v]||0)+(owed[v]||0)>0); });
  // กรองเฉพาะ active users (ไม่แสดง user ที่ถูกลบ)
  allUids = allUids.filter(function(uid){ return _pdfActiveUidSet[uid]; });
  if (groupMemberUids) {
    allUids = allUids.filter(function(u){
      return groupMemberUids.indexOf(u) !== -1 || (paid[u]||0) > 0.5;
    });
  }

  var balances = {};
  allUids.forEach(function(uid){ balances[uid]=(paid[uid]||0)-(owed[uid]||0); });
  var transfers = _computeTransfers(Object.assign({},balances), nameMap);

  // ── Color palette ต่อ uid (เหมือน personPill) ─────────────
  var _PDF_COLORS = [
    { bg:'#ebf0fe', cl:'#1a4fa0' },
    { bg:'#fef8e7', cl:'#b5600a' },
    { bg:'#eef7f2', cl:'#1a7a4a' },
    { bg:'#f0eef9', cl:'#4a3a9a' },
    { bg:'#fee2e2', cl:'#c0392b' },
    { bg:'#e8faf4', cl:'#0e7354' },
  ];
  var pdfUidColorMap = {};
  allUids.forEach(function(uid, i){ pdfUidColorMap[uid] = _PDF_COLORS[i % _PDF_COLORS.length]; });

  // ── Thai date ─────────────────────────────────────────────
  var mp = month.split('-').map(Number);
  var monthThai = THAI_MONTHS[mp[1]-1]+' '+(mp[0]+543);
  var groupTitle = group ? group.name : 'ทุกกลุ่ม';
  var totalExp   = splitExp.reduce(function(s,e){ return s+e.amt; },0);

  // ── Member summary rows ───────────────────────────────────
  var summaryRows = allUids.map(function(uid){
    var name = nameMap[uid]||uid;
    var c = pdfUidColorMap[uid] || { bg:'#eef7f2', cl:'#1a7a4a' };
    var p=paid[uid]||0, o=owed[uid]||0, bal=p-o;
    var pill = '<span style="background:'+c.bg+';color:'+c.cl+';font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;white-space:nowrap">'+name+'</span>';
    return '<tr>'
      +'<td>'+pill+'</td>'
      +'<td style="text-align:right">'+fmtH(p)+'</td>'
      +'<td style="text-align:right">'+fmtH(o)+'</td>'
      +'<td style="text-align:right;font-weight:600;color:'+(bal>=0?'#1a7a4a':'#c0392b')+'">'+fmtH(Math.abs(bal))+'</td>'
    +'</tr>';
  }).join('');

  // ── Transfer box ──────────────────────────────────────────
  var settleBox = !transfers.length
    ? '<div style="background:#eef7f2;border:1.5px solid #1a7a4a;border-radius:6px;padding:8px;text-align:center">'
        +'<div style="font-size:12px;color:#1a7a4a;font-weight:600">✅ ไม่มียอดค้างชำระ</div>'
      +'</div>'
    : transfers.map(function(t){
        return '<div style="background:#fdf4e7;border:1.5px solid #b5600a;border-radius:6px;padding:8px 10px;margin-bottom:5px">'
          +'<div style="font-size:9px;font-weight:700;color:#b5600a;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">💸 ต้องโอนเงิน</div>'
          +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
            +'<span style="font-size:11px;font-weight:700;color:#c0392b;background:#fee2e2;padding:2px 8px;border-radius:20px">'+t.from+'</span>'
            +'<span style="font-size:10px;color:#666">ต้องโอนให้</span>'
            +'<span style="font-size:11px;font-weight:700;color:#1a7a4a;background:#d1fae5;padding:2px 8px;border-radius:20px">'+t.to+'</span>'
            +'<span style="margin-left:auto;font-size:13px;font-weight:700;color:#b5600a;font-family:monospace">'+fmtH(t.amount)+'</span>'
          +'</div>'
        +'</div>';
      }).join('');

  // ── Detail rows — dynamic columns per uid ────────────────
  var pdfUids = [];
  splitExp.forEach(function(e){
    var pu = e.user_id || _pidToUid(e.person) || e.person;
    if (pu && pdfUids.indexOf(pu)===-1) pdfUids.push(pu);
    var sn = e.split_snapshot;
    // ถ้า snapshot มี deleted members → ใช้ fresh snap แทน
    if (sn && Object.keys(sn).length) {
      var snNonPayers = Object.keys(sn).filter(function(uid){ return uid !== pu; });
      var snHasDeleted = snNonPayers.length > 0 &&
        snNonPayers.every(function(uid){ return !_pdfActiveUidSet[uid]; });
      if (snHasDeleted && e.split_group_id && typeof buildSplitSnapshot==='function') {
        sn = buildSplitSnapshot(e.split_group_id, e.amt);
      }
    } else if (!sn && e.split_group_id && typeof buildSplitSnapshot==='function') {
      sn = buildSplitSnapshot(e.split_group_id, e.amt);
    }
    if (sn) Object.keys(sn).forEach(function(uid){
      if (_pdfActiveUidSet[uid] && pdfUids.indexOf(uid)===-1) pdfUids.push(uid);
    });
  });

  // ── ขยาย color map ให้ครอบ pdfUids ด้วย ────────────────────
  pdfUids.forEach(function(uid){
    if (!pdfUidColorMap[uid]) {
      var i = Object.keys(pdfUidColorMap).length;
      pdfUidColorMap[uid] = _PDF_COLORS[i % _PDF_COLORS.length];
    }
  });

  var pdfTotals = {}; pdfUids.forEach(function(u){ pdfTotals[u]=0; });
  var _pdfGrp=[], _pdfDm={};
  splitExp.forEach(function(e){ var d=e.date; if(!_pdfDm[d]){_pdfDm[d]=[];_pdfGrp.push({date:d,items:_pdfDm[d]});} _pdfDm[d].push(e); });
  var detailRows = (function(){
    return _pdfGrp.map(function(g){
      return '<tr style="background:#e8edf2"><td colspan="'+(5+pdfUids.length)+'" style="padding:5px 8px;font-size:11px;font-weight:700;color:#334">'+toThaiDateStr(g.date)+'</td></tr>\n'
        + g.items.map(function(e, rowIdx){
    var pu = e.user_id || _pidToUid(e.person) || e.person;
    var payerName = nameMap[pu] || e.person;
    var payerColor = pdfUidColorMap[pu] || { bg:'#eef7f2', cl:'#1a7a4a' };
    var snap = e.split_snapshot;
    // ถ้า snapshot มี deleted non-payer → ใช้ fresh snap
    if (snap && Object.keys(snap).length) {
      var drNonPayers = Object.keys(snap).filter(function(uid){ return uid !== pu; });
      var drHasDeleted = drNonPayers.length > 0 &&
        drNonPayers.every(function(uid){ return !_pdfActiveUidSet[uid]; });
      if (drHasDeleted && e.split_group_id && typeof buildSplitSnapshot==='function') {
        snap = buildSplitSnapshot(e.split_group_id, e.amt);
      }
    } else if (!snap && e.split_group_id && typeof buildSplitSnapshot==='function') {
      snap = buildSplitSnapshot(e.split_group_id, e.amt);
    }
    var vname = _vendorName(e.vendor_id);
    var pdfNote = (e.note || '').trim();
    var cols = pdfUids.map(function(uid){
      var amt = snap && snap[uid] ? (snap[uid].amount||0) : 0;
      pdfTotals[uid] = (pdfTotals[uid]||0) + amt;
      var isPayer = uid === pu;
      var uc = pdfUidColorMap[uid] || {};
      return '<td style="text-align:right;'+(isPayer?'color:'+uc.cl+';font-weight:700':'')+'">'+(isPayer?'✓ ':'')+(amt>0?fmtH(amt):'—')+'</td>';
    }).join('');
    var payerPill = '<span style="background:'+payerColor.bg+';color:'+payerColor.cl+';font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;white-space:nowrap">'+payerName+'</span>';
    return '<tr>'
      +'<td>'+e.desc+'</td>'
      +'<td style="color:#555">'+vname+'</td>'
      +'<td style="color:#666;font-size:12px">'+pdfNote+'</td>'
      +'<td>'+payerPill+'</td>'
      +'<td style="text-align:right;font-weight:600">'+fmtH(e.amt)+'</td>'
      +cols
    +'</tr>';
        }).join('');
    }).join('');
  })();
  var detailTotalRow = '<tr style="font-weight:700;background:#f0f0f0">'
    +'<td colspan="3">รวม</td>'
    +'<td></td>'
    +'<td style="text-align:right">'+fmtH(totalExp)+'</td>'
    +pdfUids.map(function(uid){
        var c = pdfUidColorMap[uid] || {};
        return '<td style="text-align:right;color:'+(c.cl||'#1a1a1a')+';font-weight:700">'+fmtH(pdfTotals[uid]||0)+'</td>';
      }).join('')
  +'</tr>';
  var pdfThCols = pdfUids.map(function(uid){
    var c = pdfUidColorMap[uid] || { bg:'#f0f0f0', cl:'#333' };
    return '<th style="text-align:right;background:'+c.bg+';color:'+c.cl+'">'+(nameMap[uid]||uid)+'</th>';
  }).join('');

  // ── Person summary cards (PDF) ────────────────────────────
  var pdfPersonCards = allUids.map(function(uid){
    var name = nameMap[uid]||uid;
    var c = pdfUidColorMap[uid]||{bg:'#eef7f2',cl:'#1a7a4a'};
    var p=paid[uid]||0, o=owed[uid]||0, bal=p-o;
    var balColor = bal>0.5?'#166534':(bal<-0.5?'#dc2626':'#64748b');
    var balLabel = bal>0.5?'↑ ได้รับคืน':(bal<-0.5?'↓ ต้องโอน':'✓ เรียบร้อย');
    return '<div style="flex:1;min-width:130px;border:1.5px solid '+c.bg+';border-radius:12px;padding:12px;background:#fff">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        +'<div style="width:28px;height:28px;border-radius:50%;background:'+c.bg+';color:'+c.cl+';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">'+name.charAt(0)+'</div>'
        +'<span style="font-size:12px;font-weight:700">'+name+'</span>'
      +'</div>'
      +'<div style="font-size:11px;color:#64748b;display:flex;justify-content:space-between;margin-bottom:2px"><span>จ่ายจริง</span><span style="font-family:monospace;font-weight:600;color:#1a1a1a">'+fmtH(p)+'</span></div>'
      +'<div style="font-size:11px;color:#64748b;display:flex;justify-content:space-between;margin-bottom:8px"><span>ควรจ่าย</span><span style="font-family:monospace;font-weight:600;color:#1a1a1a">'+fmtH(o)+'</span></div>'
      +'<div style="border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between;align-items:center">'
        +'<span style="font-size:10px;font-weight:700;color:'+balColor+'">'+balLabel+'</span>'
        +'<span style="font-family:monospace;font-weight:800;font-size:13px;color:'+balColor+'">'+fmtH(Math.abs(bal))+'</span>'
      +'</div>'
    +'</div>';
  }).join('');

  // ── Detail cards (PDF) ─────────────────────────────────────
  var pdfDetailCards = _pdfGrp.map(function(g){
    var dayTotal = g.items.reduce(function(s,e){ return s+e.amt; },0);
    return '<div style="margin-bottom:16px">'
      +'<div style="display:flex;justify-content:space-between;padding:4px 0 6px;border-bottom:2px solid #e2e8f0;margin-bottom:6px">'
        +'<span style="font-size:11px;font-weight:700;color:#475569">'+toThaiDateStr(g.date)+'</span>'
        +'<span style="font-size:11px;font-family:monospace;font-weight:700;color:#dc2626">'+fmtH(dayTotal)+'</span>'
      +'</div>'
      + g.items.map(function(e){
          var pu = e.user_id||_pidToUid(e.person)||e.person;
          var payerName = nameMap[pu]||e.person;
          var payerColor = pdfUidColorMap[pu]||{bg:'#eef7f2',cl:'#1a7a4a'};
          var snap = e.split_snapshot;
          if (!snap && e.split_group_id && typeof buildSplitSnapshot==='function') snap = buildSplitSnapshot(e.split_group_id, e.amt);
          var chips = snap ? Object.keys(snap).filter(function(uid){ return _pdfActiveUidSet[uid]; }).map(function(uid){
            var isPayer = uid===pu;
            var uc = pdfUidColorMap[uid]||{bg:'#f0f0f0',cl:'#333'};
            var amt = snap[uid].amount||0;
            return '<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:'+uc.bg+';color:'+uc.cl+'">'
              +(nameMap[uid]||uid)+' '+fmtH(amt)+(isPayer?' ✓':'')+'</span>';
          }).join(' ') : '';
          var vname = _vendorName(e.vendor_id);
          var note = (e.note||'').trim();
          return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;margin-bottom:5px;border:1px solid #e2e8f0;border-radius:10px;background:#fafafa">'
            +'<div style="flex:1;min-width:0">'
              +'<div style="font-size:12px;font-weight:600;color:#1a1a1a">'+e.desc+'</div>'
              +(vname||note?'<div style="font-size:10px;color:#94a3b8;margin-top:2px">'+(vname?'🏪 '+vname:'')+(vname&&note?' · ':'')+note+'</div>':'')
              +(chips?'<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px">'+chips+'</div>':'')
            +'</div>'
            +'<div style="text-align:right;flex-shrink:0">'
              +'<div style="font-size:13px;font-weight:700;font-family:monospace;color:#dc2626">'+fmtH(e.amt)+'</div>'
              +'<span style="font-size:10px;padding:1px 7px;border-radius:20px;background:'+payerColor.bg+';color:'+payerColor.cl+'">'+payerName+'</span>'
            +'</div>'
          +'</div>';
        }).join('')
    +'</div>';
  }).join('');

  // ── HTML ──────────────────────────────────────────────────
  var todayStr = toThaiDateStr(new Date().toISOString().split('T')[0]);
  var html = '<!DOCTYPE html>\n<html lang="th">\n<head>\n<meta charset="UTF-8">\n'
    +'<meta name="viewport" content="width=device-width,initial-scale=1">\n'
    +'<title>Settlement '+monthThai+' · '+groupTitle+'</title>\n'
    +'<style>\n'
    +'*{box-sizing:border-box;margin:0;padding:0}\n'
    +'body{font-family:\'Sarabun\',\'TH Sarabun New\',\'Noto Sans Thai\',Arial,sans-serif;font-size:13px;color:#1a1a1a;padding:20px;background:#f8fafc}\n'
    +'.page{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 16px rgba(0,0,0,.08)}\n'
    +'.section-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;margin:16px 0 8px}\n'
    +'.footer{margin-top:16px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0;padding-top:8px}\n'
    +'@media print{body{padding:0;background:#fff}.page{box-shadow:none;border-radius:0;padding:12px}@page{margin:8mm}}\n'
    +'</style>\n</head>\n<body>\n<div class="page">\n'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
      +'<h1 style="font-size:16px;font-weight:700">Settlement Report</h1>'
      +'<span style="font-size:10px;color:#94a3b8">'+todayStr+'</span>'
    +'</div>\n'
    +'<div style="font-size:11px;color:#64748b;margin-bottom:16px;padding:6px 10px;background:#f1f5f9;border-radius:8px">'
      +'กลุ่ม: <strong>'+groupTitle+'</strong> · เดือน '+monthThai+' · '+splitExp.length+' รายการ · รวม <strong>'+fmtH(totalExp)+'</strong>'
    +'</div>\n'
    +'<div class="section-label">💸 สรุปการโอนเงิน</div>\n'
    +'<div style="margin-bottom:8px">'+settleBox+'</div>\n'
    +'<div class="section-label">👤 สรุปรายบุคคล</div>\n'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">'+pdfPersonCards+'</div>\n'
    +'<div class="section-label">📋 รายการทั้งหมด</div>\n'
    +pdfDetailCards
    +'<div class="footer">HomeFinance · Settlement Report · '+monthThai+' · ส่งออกเมื่อ '+todayStr+'</div>\n'
    +'</div>\n</body>\n</html>';

  var blob = new Blob([html], {type:'text/html;charset=utf-8'});
  var url  = URL.createObjectURL(blob);
  var win  = window.open(url, '_blank');
  if (!win) {
    // fallback: ถ้า popup ถูกบล็อก → ดาวน์โหลดแทน
    var fname = 'settlement-' + month + '.html';
    var a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }
  setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
  } catch(err) {
    console.error('[Settlement] exportSettlePDF error:', err);
    alert('เกิดข้อผิดพลาด: ' + (err && err.message ? err.message : String(err)));
  }
}


// ─── ADMIN VARIANT: export PDF from arbitrary data ────────
// Called by report.js exportAdminPDF() with all-user data
function exportSettlePDFFromData(data, month) {
  var n = names();
  var me = data.filter(function(e){return e.type==='expense'&&isPaid(e);});
  var paid={}, share={};
  persons.forEach(function(p){paid[p.id]=0;share[p.id]=0;});
  me.forEach(function(e){
    if(paid[e.person]!==undefined) paid[e.person]+=e.amt;
    if(e.split){ var each=e.amt/2; persons.forEach(function(p){if(share[p.id]!==undefined) share[p.id]+=each;}); }
    else { if(share[e.person]!==undefined) share[e.person]+=e.amt; }
  });
  var net={};
  persons.forEach(function(p){net[p.id]=paid[p.id]-share[p.id];});
  var sorted=persons.slice().sort(function(a,b){return net[b.id]-net[a.id];});
  var creditor=sorted[0], debtor=sorted[sorted.length-1];
  var owe=Math.abs(net[creditor.id]);
  var totalExp=Object.values(paid).reduce(function(s,v){return s+v;},0);

  var mp=month.split('-').map(Number);
  var monthThai=THAI_MONTHS[mp[1]-1]+' '+(mp[0]+543);

  var rows=me.map(function(e){
    var shares=persons.map(function(p){
      var s=e.split?e.amt/2:(e.person===p.id?e.amt:0);
      return '<td style="text-align:right">'+fmtH(s)+'</td>';
    }).join('');
    return '<tr><td>'+toThaiDateShort(e.date)+'</td><td>'+e.desc+'</td><td>'+(e.cat_name||'—')+'</td>'+
      '<td style="text-align:right">'+fmtH(e.amt)+'</td><td style="text-align:center">'+(e.split?'÷2':'ส่วนตัว')+'</td>'+shares+'</tr>';
  }).join('');

  var summaryRows=persons.map(function(p){return '<tr>'+
    '<td>'+p.name+'</td>'+
    '<td style="text-align:right">'+fmtH(paid[p.id]||0)+'</td>'+
    '<td style="text-align:right">'+fmtH(share[p.id]||0)+'</td>'+
    '<td style="text-align:right;font-weight:600;color:'+(net[p.id]>=0?'#1a7a4a':'#c0392b')+'">'+
      (net[p.id]>=0?'+':'')+fmtH(net[p.id])+'</td></tr>';}).join('');

  var settleBox=owe<1
    ?'<div style="background:#eef7f2;border:1.5px solid #1a7a4a;border-radius:6px;padding:8px;text-align:center"><div style="font-size:14px;color:#1a7a4a;font-weight:600">✓ ไม่มียอดค้างชำระ</div></div>'
    :'<div style="background:#fdf4e7;border:1.5px solid #b5600a;border-radius:6px;padding:8px;text-align:center">'+
      '<div style="font-size:12px;color:#b5600a;font-weight:600;margin-bottom:4px">ยอดที่ต้องชำระคืน</div>'+
      '<div style="font-size:24px;font-weight:700;color:#b5600a;font-family:monospace">'+fmtH(owe)+' บาท</div>'+
      '<div style="font-size:14px;font-weight:600;margin-top:4px">'+debtor.name+' โอนให้ '+creditor.name+'</div></div>';

  var label = (typeof getAuthProfileName==='function'&&getAuthProfileName()) ? ' · Admin: '+getAuthProfileName() : '';
  var html='<!DOCTYPE html>\n<html lang="th">\n<head>\n<meta charset="UTF-8">\n'+
    '<title>Settlement '+monthThai+'</title>\n'+
    '<style>\n@import url(\'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap\');\n'+
    '*{box-sizing:border-box;margin:0;padding:0}body{font-family:\'Sarabun\',sans-serif;font-size:13px;color:#1a1a1a;padding:24px}\n'+
    'h1{font-size:20px;font-weight:700;margin-bottom:4px}h2{font-size:14px;font-weight:600;margin:16px 0 8px;color:#444}\n'+
    '.sub{font-size:12px;color:#888;margin-bottom:16px}.meta{display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap}\n'+
    '.meta-box{border:1px solid #ddd;border-radius:6px;padding:10px 14px;flex:1;min-width:140px}\n'+
    '.meta-label{font-size:11px;color:#888}.meta-val{font-size:18px;font-weight:700;font-family:monospace}\n'+
    'table{width:100%;border-collapse:collapse;margin-bottom:16px}\n'+
    'th{background:#f0f0f0;padding:7px 8px;text-align:left;font-size:12px;font-weight:600;border-bottom:1.5px solid #ccc}\n'+
    'td{padding:6px 8px;border-bottom:1px solid #eee}\n'+
    '.settle{margin:16px 0}.footer{margin-top:24px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}\n'+
    '@media print{body{padding:12px}@page{margin:15mm}}\n</style>\n</head>\n<body>\n'+
    '<h1>HomeFinance — สรุป Settlement (Admin Report)</h1>\n'+
    '<div class="sub">เดือน '+monthThai+' · ออกเมื่อ '+toThaiDateStr(new Date().toISOString().split('T')[0])+label+'</div>\n'+
    '<div class="meta">'+
      persons.map(function(p){return '<div class="meta-box"><div class="meta-label">'+p.name+' จ่ายจริง</div>'+
        '<div class="meta-val">'+fmtH(paid[p.id]||0)+' <small style="font-size:12px;font-weight:400">บาท</small></div></div>'+
        '<div class="meta-box"><div class="meta-label">'+p.name+' ควรจ่าย</div>'+
        '<div class="meta-val">'+fmtH(share[p.id]||0)+' <small style="font-size:12px;font-weight:400">บาท</small></div></div>';}).join('')+
      '<div class="meta-box"><div class="meta-label">รวมรายจ่ายทั้งหมด</div>'+
      '<div class="meta-val">'+fmtH(totalExp)+' <small style="font-size:12px;font-weight:400">บาท</small></div></div>'+
    '</div>\n'+
    '<div class="settle">'+settleBox+'</div>\n'+
    '<h2>สรุปรายบุคคล</h2>\n<table>\n'+
    '<tr><th>ชื่อ</th><th style="text-align:right">จ่ายจริง</th><th style="text-align:right">ควรจ่าย</th><th style="text-align:right">ส่วนต่าง</th></tr>\n'+
    summaryRows+'</table>\n'+
    '<h2>รายการทั้งหมดเดือน '+monthThai+'</h2>\n<table>\n'+
    '<tr><th>วันที่</th><th>รายการ</th><th>หมวด</th><th style="text-align:right">จำนวน</th><th style="text-align:center">แบ่ง</th>'+
    persons.map(function(p){return '<th style="text-align:right">ส่วน'+p.name+'</th>';}).join('')+'</tr>\n'+
    rows+
    '<tr style="font-weight:700;background:#f0f0f0"><td colspan="3">รวม</td>'+
    '<td style="text-align:right">'+fmtH(totalExp)+'</td><td></td>'+
    persons.map(function(p){return '<td style="text-align:right">'+fmtH(share[p.id]||0)+'</td>';}).join('')+'</tr>\n'+
    '</table>\n<div class="footer">HomeFinance v3.2.0 · Admin Settlement Report</div>\n</body>\n</html>';

  var win=window.open('','_blank','width=900,height=700');
  if(!win){alert('กรุณาอนุญาต popup เพื่อพิมพ์ PDF');return;}
  win.document.write(html);
  win.document.close();
  win.onload=function(){win.focus();win.print();};
}
