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
function populateMths(selId){
  var months=Array.from(new Set(db.map(function(e){return e.date.substring(0,7);}))).sort().reverse();
  var sel=document.getElementById(selId);
  var cur=sel.value||months[0];
  sel.innerHTML='<option value="">เลือกเดือน</option>'+months.map(function(m){return '<option value="'+m+'" '+(m===cur?'selected':'')+'>'+m+'</option>';}).join('');
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

/** ดึงชื่อที่แสดง จาก uid */
function _uidToName(uid) {
  var p = persons.find(function(x){ return x.user_id === uid; });
  if (p) return p.name;
  // fallback: person.id
  p = persons.find(function(x){ return x.id === uid; });
  return p ? p.name : uid;
}

/** สร้าง nameMap: uid → name สำหรับ persons ทั้งหมด */
function _buildNameMap() {
  var m = {};
  persons.forEach(function(p) {
    var uid = p.user_id || p.id;
    m[uid] = p.name;
  });
  return m;
}

// ─── RENDER SETTLEMENT ────────────────────────────────────
function renderSettle(){
  var m       = document.getElementById('settleMonth').value;
  var groupId = (document.getElementById('settleGroup') || {}).value || '';
  var showPersonal = _settleShowPersonal;
  var out     = document.getElementById('settleContent');
  if (!m) { out.innerHTML = '<div class="empty">เลือกเดือน</div>'; return; }

  var allExp = db.filter(function(e){ return e.date.startsWith(m) && e.type==='expense' && isPaid(e); });

  // แยก split entries กับ personal entries
  var splitExp, personalExp;
  if (groupId) {
    // กรองเฉพาะ group นั้น
    splitExp    = allExp.filter(function(e){ return e.split_group_id === groupId; });
    personalExp = allExp.filter(function(e){ return e.split_group_id !== groupId || !e.split_group_id; });
  } else {
    splitExp    = allExp.filter(function(e){ var t=e.split_type||(e.split?'equal':'personal'); return t!=='personal'; });
    personalExp = allExp.filter(function(e){ var t=e.split_type||(e.split?'equal':'personal'); return t==='personal'; });
  }

  // ── คำนวณ paid / owed per uid ──────────────────────────
  var paid = {}, owed = {};
  persons.forEach(function(p){ var u=p.user_id||p.id; paid[u]=0; owed[u]=0; });

  splitExp.forEach(function(e) {
    var payerUid = _pidToUid(e.person) || e.person;
    paid[payerUid] = (paid[payerUid] || 0) + e.amt;

    if (e.split_snapshot && Object.keys(e.split_snapshot).length) {
      // ✅ ใช้ snapshot โดยตรง (immutable)
      Object.keys(e.split_snapshot).forEach(function(uid) {
        owed[uid] = (owed[uid] || 0) + (e.split_snapshot[uid].amount || 0);
      });
    } else {
      // ⬅ backward compat: ใช้ getSplitShares() map pid → uid
      var shares = getSplitShares(e);
      Object.keys(shares).forEach(function(pid) {
        var uid = _pidToUid(pid) || pid;
        owed[uid] = (owed[uid] || 0) + (shares[pid] || 0);
      });
    }
  });

  // รวม uid ทั้งหมดที่มีส่วนร่วม
  var allUids = Object.keys(paid).concat(Object.keys(owed));
  allUids = allUids.filter(function(v,i,a){ return a.indexOf(v)===i; });

  var balances = {};
  var nameMap  = _buildNameMap();
  allUids.forEach(function(uid) {
    balances[uid] = (paid[uid]||0) - (owed[uid]||0);
  });

  var transfers = _computeTransfers(Object.assign({}, balances), nameMap);
  var totalSplit = splitExp.reduce(function(s,e){ return s+e.amt; }, 0);

  // ── สร้าง HTML ─────────────────────────────────────────
  var grpTitle = '';
  if (groupId && typeof getSplitGroups === 'function') {
    var g = getSplitGroups().find(function(x){ return x.id===groupId; });
    if (g) grpTitle = ' · ' + g.name;
  }

  // summary cards per person
  var personCards = allUids.map(function(uid) {
    var name = nameMap[uid] || uid;
    var p    = paid[uid]||0;
    var o    = owed[uid]||0;
    var bal  = p - o;
    var balColor = bal > 0.5 ? 'var(--green)' : (bal < -0.5 ? 'var(--red,#dc2626)' : 'var(--ink3)');
    var balLabel = bal > 0.5 ? 'ได้รับคืน' : (bal < -0.5 ? 'ต้องโอน' : 'เรียบร้อย');
    return '<div style="flex:1;min-width:140px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:8px">' + name + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink3);margin-bottom:3px"><span>จ่ายจริง</span><span style="font-family:monospace;font-weight:600;color:var(--ink)">' + fmt(p) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink3);margin-bottom:6px"><span>ควรจ่าย</span><span style="font-family:monospace;font-weight:600;color:var(--ink)">' + fmt(o) + '</span></div>' +
      '<div style="border-top:1px solid var(--line);padding-top:6px;display:flex;justify-content:space-between;align-items:center">' +
        '<span style="font-size:11px;color:' + balColor + ';font-weight:600">' + balLabel + '</span>' +
        '<span style="font-family:monospace;font-weight:700;font-size:14px;color:' + balColor + '">' + (bal>=0?'+':'') + fmt(Math.abs(bal)) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  // transfer instructions
  var transferHtml = '';
  if (!transfers.length) {
    transferHtml = '<div style="background:var(--green-bg,#f0fdf4);border:1.5px solid var(--green,#22c55e);border-radius:10px;padding:14px;text-align:center">' +
      '<div style="font-size:15px;font-weight:700;color:var(--green,#166534)">✅ ไม่มียอดค้างชำระ</div>' +
      '<div style="font-size:12px;color:var(--green,#166534);margin-top:4px">ทุกคนจ่ายเป็นสัดส่วนที่ถูกต้องแล้ว</div>' +
    '</div>';
  } else {
    transferHtml = transfers.map(function(t) {
      return '<div style="background:var(--surface2);border:1.5px solid var(--line);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<span style="font-size:13px;font-weight:600">' + t.from + '</span>' +
        '<span style="font-size:18px;color:var(--blue)">→</span>' +
        '<span style="font-size:13px;font-weight:600">' + t.to + '</span>' +
        '<span style="margin-left:auto;font-family:monospace;font-size:16px;font-weight:700;color:var(--blue)">฿' + fmt(t.amount) + '</span>' +
      '</div>';
    }).join('');
  }

  // detail rows
  var isMobile = window.innerWidth <= 900;
  var detailRows = isMobile
    ? splitExp.map(function(e) {
        var payer = nameMap[_pidToUid(e.person)||e.person] || e.person;
        var typeLabel = {personal:'ส่วนตัว',equal:'หารเท่า',ratio:'สัดส่วน',custom:'เลือกคน',group:'ตามกลุ่ม'}[e.split_type||'equal']||'';
        var snap = e.split_snapshot;
        var parts = snap
          ? Object.keys(snap).map(function(uid){ return (snap[uid].label||nameMap[uid]||uid)+' ฿'+fmt(snap[uid].amount); }).join(' / ')
          : '';
        return '<div style="padding:10px 0;border-bottom:1px solid var(--line)">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + e.desc + '</div>' +
              '<div style="font-size:11px;color:var(--ink3);margin-top:2px">' + payer + (typeLabel?' · '+typeLabel:'') + (e.split_group_id?' 🏠':'') + '</div>' +
              (parts ? '<div style="font-size:11px;color:var(--blue);margin-top:2px">' + parts + '</div>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;font-size:13px;font-family:monospace;font-weight:600">' + fmt(e.amt) + '</div>' +
          '</div>' +
        '</div>';
      }).join('')
    : '<div class="table-scroll"><table>' +
        '<tr><th>รายการ</th><th>ผู้จ่าย</th><th>รูปแบบ</th><th>จำนวน</th><th>การแบ่ง</th></tr>' +
        splitExp.map(function(e) {
          var payer = nameMap[_pidToUid(e.person)||e.person] || e.person;
          var typeLabel = {personal:'ส่วนตัว',equal:'หารเท่า',ratio:'สัดส่วน',custom:'เลือกคน',group:'ตามกลุ่ม'}[e.split_type||(e.split?'equal':'personal')]||'';
          var snap = e.split_snapshot;
          var breakdown = snap
            ? Object.keys(snap).map(function(uid){ return '<span style="white-space:nowrap">'+(snap[uid].label||nameMap[uid]||uid)+' <b>฿'+fmt(snap[uid].amount)+'</b></span>'; }).join(' · ')
            : persons.map(function(p){ var uid=p.user_id||p.id; var s=getSplitShares(e); return '<span>'+p.name+' <b>฿'+fmt(s[p.id]||0)+'</b></span>'; }).join(' · ');
          return '<tr>' +
            '<td>' + e.desc + '</td>' +
            '<td>' + payer + '</td>' +
            '<td style="white-space:nowrap">' + typeLabel + (e.split_group_id?' 🏠':'') + '</td>' +
            '<td class="mono" style="text-align:right">' + fmt(e.amt) + '</td>' +
            '<td style="font-size:11px;color:var(--blue)">' + breakdown + '</td>' +
          '</tr>';
        }).join('') +
        '<tr style="font-weight:700;background:var(--surface2)"><td colspan="3">รวม</td>' +
        '<td class="mono" style="text-align:right">' + fmt(totalSplit) + '</td><td></td></tr>' +
      '</table></div>';

  // personal section
  var personalHtml = '';
  if (showPersonal && personalExp.length) {
    personalHtml = '<div class="card" style="width:100%;margin-top:8px">' +
      '<div class="card-title" style="color:var(--ink3)">รายจ่ายส่วนตัว (ไม่นำมาคำนวณ Settlement)</div>' +
      personalExp.map(function(e){
        var payer = nameMap[_pidToUid(e.person)||e.person] || e.person;
        return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">' +
          '<div><span>' + e.desc + '</span><span style="font-size:11px;color:var(--ink3);margin-left:6px">' + payer + '</span></div>' +
          '<span style="font-family:monospace;color:var(--red,#dc2626)">' + fmt(e.amt) + '</span>' +
        '</div>';
      }).join('') +
      '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600;font-size:13px">' +
        '<span>รวมส่วนตัว</span>' +
        '<span style="font-family:monospace">' + fmt(personalExp.reduce(function(s,e){return s+e.amt;},0)) + '</span>' +
      '</div>' +
    '</div>';
  }

  out.innerHTML =
    // month + group title
    '<div style="font-size:12px;color:var(--ink3);margin-bottom:12px;font-weight:500">' +
      '📅 ' + m + grpTitle + ' · ' + splitExp.length + ' รายการ · รวม ฿' + fmt(totalSplit) +
    '</div>' +
    // person summary cards
    '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">' + personCards + '</div>' +
    // transfer section
    '<div style="margin-bottom:14px">' +
      '<div style="font-size:12px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">สรุปการโอนเงิน</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px">' + transferHtml + '</div>' +
    '</div>' +
    // detail entries
    '<div class="card" style="width:100%">' +
      '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between">' +
        '<span>รายละเอียด</span>' +
        '<button onclick="exportSettlePDF(\''+m+'\')" style="background:var(--red,#dc2626);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun,sans-serif;min-height:36px">📄 PDF</button>' +
      '</div>' +
      (splitExp.length ? detailRows : '<div style="color:var(--ink3);text-align:center;padding:20px;font-size:13px">ไม่มีรายการ' + (groupId ? 'ในกลุ่มนี้' : '') + '</div>') +
    '</div>' +
    personalHtml;
}

function exportSettlePDF(month){
  var n = names();
  var allExpPDF = db.filter(function(e){return e.date.startsWith(month)&&e.type==='expense'&&isPaid(e);});
  var me = allExpPDF.filter(function(e){ var t=e.split_type||(e.split?'equal':'personal'); return t!=='personal'; });
  var paid={}, share={};
  persons.forEach(function(p){paid[p.id]=0;share[p.id]=0;});
  me.forEach(function(e){
    if(paid[e.person]!==undefined) paid[e.person]+=e.amt;
    var shares=getSplitShares(e);
    persons.forEach(function(p){ share[p.id]=(share[p.id]||0)+(shares[p.id]||0); });
  });
  var net={};
  persons.forEach(function(p){net[p.id]=paid[p.id]-share[p.id];});
  var sorted=persons.slice().sort(function(a,b){return net[b.id]-net[a.id];});
  var creditor=sorted[0], debtor=sorted[sorted.length-1];
  var owe=Math.abs(net[creditor.id]);
  var totalExp=Object.values(paid).reduce(function(s,v){return s+v;},0);

  // format month to Thai
  var mp = month.split('-').map(Number);
  var y=mp[0], mo=mp[1];
  var monthThai = THAI_MONTHS[mo-1]+' '+(y+543);

  var rows = me.map(function(e){
    var shares = persons.map(function(p){
      var s = e.split ? e.amt/2 : (e.person===p.id ? e.amt : 0);
      return '<td style="text-align:right">'+fmt(s)+'</td>';
    }).join('');
    return '<tr>'+
      '<td>'+toThaiDateShort(e.date)+'</td>'+
      '<td>'+e.desc+'</td>'+
      '<td>'+(e.cat_name||'—')+'</td>'+
      '<td style="text-align:right">'+fmt(e.amt)+'</td>'+
      '<td style="text-align:center">'+(e.split?'÷2':'ส่วนตัว')+'</td>'+
      shares+
    '</tr>';
  }).join('');

  var summaryRows = persons.map(function(p){return '<tr>'+
      '<td>'+p.name+'</td>'+
      '<td style="text-align:right">'+fmt(paid[p.id]||0)+'</td>'+
      '<td style="text-align:right">'+fmt(share[p.id]||0)+'</td>'+
      '<td style="text-align:right;font-weight:600;color:'+(net[p.id]>=0?'#1a7a4a':'#c0392b')+'">'+
        (net[p.id]>=0?'+':'')+fmt(net[p.id])+
      '</td>'+
    '</tr>';}).join('');

  var settleBox = owe < 1
    ? '<div style="background:#eef7f2;border:1.5px solid #1a7a4a;border-radius:8px;padding:14px;text-align:center">'+
        '<div style="font-size:14px;color:#1a7a4a;font-weight:600">✓ ไม่มียอดค้างชำระ — ทุกคนจ่ายเท่ากันพอดี</div>'+
       '</div>'
    : '<div style="background:#fdf4e7;border:1.5px solid #b5600a;border-radius:8px;padding:14px;text-align:center">'+
        '<div style="font-size:12px;color:#b5600a;font-weight:600;margin-bottom:4px">ยอดที่ต้องชำระคืน</div>'+
        '<div style="font-size:24px;font-weight:700;color:#b5600a;font-family:monospace">'+fmt(owe)+' บาท</div>'+
        '<div style="font-size:14px;font-weight:600;margin-top:4px">'+debtor.name+' โอนให้ '+creditor.name+'</div>'+
       '</div>';

  var html = '<!DOCTYPE html>\n'+
'<html lang="th">\n'+
'<head>\n'+
'  <meta charset="UTF-8">\n'+
'  <title>Settlement '+monthThai+'</title>\n'+
'  <style>\n'+
'    @import url(\'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap\');\n'+
'    * { box-sizing:border-box; margin:0; padding:0; }\n'+
'    body { font-family:\'Sarabun\',sans-serif; font-size:13px; color:#1a1a1a; padding:24px; }\n'+
'    h1 { font-size:20px; font-weight:700; margin-bottom:4px; }\n'+
'    h2 { font-size:14px; font-weight:600; margin:16px 0 8px; color:#444; }\n'+
'    .sub { font-size:12px; color:#888; margin-bottom:16px; }\n'+
'    .meta { display:flex; gap:24px; margin-bottom:16px; }\n'+
'    .meta-box { border:1px solid #ddd; border-radius:6px; padding:10px 14px; flex:1; }\n'+
'    .meta-label { font-size:11px; color:#888; }\n'+
'    .meta-val { font-size:18px; font-weight:700; font-family:monospace; }\n'+
'    .meta-val.green { color:#1a7a4a; }\n'+
'    .meta-val.red { color:#c0392b; }\n'+
'    table { width:100%; border-collapse:collapse; margin-bottom:16px; }\n'+
'    th { background:#f0f0f0; padding:7px 8px; text-align:left; font-size:12px; font-weight:600; border-bottom:1.5px solid #ccc; }\n'+
'    td { padding:6px 8px; border-bottom:1px solid #eee; vertical-align:top; }\n'+
'    tr:nth-child(even) td { background:#fafafa; }\n'+
'    .settle { margin:16px 0; }\n'+
'    .footer { margin-top:24px; font-size:11px; color:#aaa; text-align:center; border-top:1px solid #eee; padding-top:12px; }\n'+
'    @media print {\n'+
'      body { padding:12px; }\n'+
'      @page { margin:15mm; }\n'+
'    }\n'+
'  </style>\n'+
'</head>\n'+
'<body>\n'+
'  <h1>HomeFinance — สรุป Settlement</h1>\n'+
'  <div class="sub">เดือน '+monthThai+' · ออกเมื่อ '+toThaiDateStr(new Date().toISOString().split('T')[0])+'</div>\n'+
'\n'+
'  <div class="meta">\n'+
    persons.map(function(p){return '<div class="meta-box">'+
        '<div class="meta-label">'+p.name+' จ่ายจริง</div>'+
        '<div class="meta-val">'+fmt(paid[p.id]||0)+' <small style="font-size:12px;font-weight:400">บาท</small></div>'+
      '</div>'+
      '<div class="meta-box">'+
        '<div class="meta-label">'+p.name+' ควรจ่าย</div>'+
        '<div class="meta-val">'+fmt(share[p.id]||0)+' <small style="font-size:12px;font-weight:400">บาท</small></div>'+
      '</div>';}).join('')+
'    <div class="meta-box">\n'+
'      <div class="meta-label">รวมรายจ่ายทั้งหมด</div>\n'+
'      <div class="meta-val red">'+fmt(totalExp)+' <small style="font-size:12px;font-weight:400">บาท</small></div>\n'+
'    </div>\n'+
'  </div>\n'+
'\n'+
'  <div class="settle">'+settleBox+'</div>\n'+
'\n'+
'  <h2>สรุปรายบุคคล</h2>\n'+
'  <table>\n'+
'    <tr><th>ชื่อ</th><th style="text-align:right">จ่ายจริง</th><th style="text-align:right">ควรจ่าย</th><th style="text-align:right">ส่วนต่าง</th></tr>\n'+
    summaryRows+
'  </table>\n'+
'\n'+
'  <h2>รายการทั้งหมดเดือน '+monthThai+'</h2>\n'+
'  <table>\n'+
'    <tr>\n'+
'      <th>วันที่</th><th>รายการ</th><th>หมวด</th>\n'+
'      <th style="text-align:right">จำนวน</th><th style="text-align:center">แบ่ง</th>\n'+
      persons.map(function(p){return '<th style="text-align:right">ส่วน'+p.name+'</th>';}).join('')+
'    </tr>\n'+
    rows+
'    <tr style="font-weight:700;background:#f0f0f0">\n'+
'      <td colspan="3">รวม</td>\n'+
'      <td style="text-align:right">'+fmt(totalExp)+'</td>\n'+
'      <td></td>\n'+
      persons.map(function(p){return '<td style="text-align:right">'+fmt(share[p.id]||0)+'</td>';}).join('')+
'    </tr>\n'+
'  </table>\n'+
'\n'+
'  <div class="footer">HomeFinance v2.1.0 · สร้างโดยอัตโนมัติ</div>\n'+
'</body>\n'+
'</html>';

  var win = window.open('','_blank','width=900,height=700');
  if(!win){ alert('กรุณาอนุญาต popup เพื่อพิมพ์ PDF'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = function(){ win.focus(); win.print(); };
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
      return '<td style="text-align:right">'+fmt(s)+'</td>';
    }).join('');
    return '<tr><td>'+toThaiDateShort(e.date)+'</td><td>'+e.desc+'</td><td>'+(e.cat_name||'—')+'</td>'+
      '<td style="text-align:right">'+fmt(e.amt)+'</td><td style="text-align:center">'+(e.split?'÷2':'ส่วนตัว')+'</td>'+shares+'</tr>';
  }).join('');

  var summaryRows=persons.map(function(p){return '<tr>'+
    '<td>'+p.name+'</td>'+
    '<td style="text-align:right">'+fmt(paid[p.id]||0)+'</td>'+
    '<td style="text-align:right">'+fmt(share[p.id]||0)+'</td>'+
    '<td style="text-align:right;font-weight:600;color:'+(net[p.id]>=0?'#1a7a4a':'#c0392b')+'">'+
      (net[p.id]>=0?'+':'')+fmt(net[p.id])+'</td></tr>';}).join('');

  var settleBox=owe<1
    ?'<div style="background:#eef7f2;border:1.5px solid #1a7a4a;border-radius:8px;padding:14px;text-align:center"><div style="font-size:14px;color:#1a7a4a;font-weight:600">✓ ไม่มียอดค้างชำระ</div></div>'
    :'<div style="background:#fdf4e7;border:1.5px solid #b5600a;border-radius:8px;padding:14px;text-align:center">'+
      '<div style="font-size:12px;color:#b5600a;font-weight:600;margin-bottom:4px">ยอดที่ต้องชำระคืน</div>'+
      '<div style="font-size:24px;font-weight:700;color:#b5600a;font-family:monospace">'+fmt(owe)+' บาท</div>'+
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
    'td{padding:6px 8px;border-bottom:1px solid #eee}\ntr:nth-child(even) td{background:#fafafa}\n'+
    '.settle{margin:16px 0}.footer{margin-top:24px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px}\n'+
    '@media print{body{padding:12px}@page{margin:15mm}}\n</style>\n</head>\n<body>\n'+
    '<h1>HomeFinance — สรุป Settlement (Admin Report)</h1>\n'+
    '<div class="sub">เดือน '+monthThai+' · ออกเมื่อ '+toThaiDateStr(new Date().toISOString().split('T')[0])+label+'</div>\n'+
    '<div class="meta">'+
      persons.map(function(p){return '<div class="meta-box"><div class="meta-label">'+p.name+' จ่ายจริง</div>'+
        '<div class="meta-val">'+fmt(paid[p.id]||0)+' <small style="font-size:12px;font-weight:400">บาท</small></div></div>'+
        '<div class="meta-box"><div class="meta-label">'+p.name+' ควรจ่าย</div>'+
        '<div class="meta-val">'+fmt(share[p.id]||0)+' <small style="font-size:12px;font-weight:400">บาท</small></div></div>';}).join('')+
      '<div class="meta-box"><div class="meta-label">รวมรายจ่ายทั้งหมด</div>'+
      '<div class="meta-val">'+fmt(totalExp)+' <small style="font-size:12px;font-weight:400">บาท</small></div></div>'+
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
    '<td style="text-align:right">'+fmt(totalExp)+'</td><td></td>'+
    persons.map(function(p){return '<td style="text-align:right">'+fmt(share[p.id]||0)+'</td>';}).join('')+'</tr>\n'+
    '</table>\n<div class="footer">HomeFinance v3.2.0 · Admin Settlement Report</div>\n</body>\n</html>';

  var win=window.open('','_blank','width=900,height=700');
  if(!win){alert('กรุณาอนุญาต popup เพื่อพิมพ์ PDF');return;}
  win.document.write(html);
  win.document.close();
  win.onload=function(){win.focus();win.print();};
}
