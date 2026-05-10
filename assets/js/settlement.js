/* HomeFinance · module: settlement.js · v2.5.0 */

// ─── SETTLEMENT ──────────────────────────────────────────
function populateMths(selId){
  var months=Array.from(new Set(db.map(function(e){return e.date.substring(0,7);}))).sort().reverse();
  var sel=document.getElementById(selId);
  var cur=sel.value||months[0];
  sel.innerHTML='<option value="">เลือกเดือน</option>'+months.map(function(m){return '<option value="'+m+'" '+(m===cur?'selected':'')+'>'+m+'</option>';}).join('');
  if(!sel.value && months[0]) sel.value=months[0];
}

function renderSettle(){
  var n=names();
  var m=document.getElementById('settleMonth').value;
  if(!m){document.getElementById('settleContent').innerHTML='<div class="empty">เลือกเดือน</div>';return;}
  var showPersonal = document.getElementById('settleShowPersonal')?.checked ?? false;
  var allExp=db.filter(function(e){return e.date.startsWith(m)&&e.type==='expense'&&isPaid(e);});
  // exclude personal (split=false) from settlement calc
  var me=allExp.filter(function(e){return e.split;});
  var personal=allExp.filter(function(e){return !e.split;});
  // build per-person paid & share maps (only split=true expenses)
  var paid={}, share={};
  persons.forEach(function(p){paid[p.id]=0;share[p.id]=0;});
  me.forEach(function(e){
    if(paid[e.person]!==undefined) paid[e.person]+=e.amt;
    // all me entries have split=true
    var each=e.amt/2;
    persons.forEach(function(p){if(share[p.id]!==undefined) share[p.id]+=each;});
  });
  // compute net per person (positive = overpaid = others owe them)
  var net={};
  persons.forEach(function(p){net[p.id]=paid[p.id]-share[p.id];});
  // find biggest creditor and debtor
  var sorted=persons.slice().sort(function(a,b){return net[b.id]-net[a.id];});
  var creditor=sorted[0], debtor=sorted[sorted.length-1];
  var owe=Math.abs(net[creditor.id]);
  var totalExp=Object.values(paid).reduce(function(s,v){return s+v;},0);
  var paidA=paid['A']||0, paidB=paid['B']||0;
  var shareA=share['A']||0, shareB=share['B']||0;

  var isMobile = window.innerWidth <= 900;
  var detailRows = isMobile
    ? me.map(function(e){return '<div style="padding:10px 0;border-bottom:1px solid var(--line)">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">'+
            '<div style="flex:1;min-width:0">'+
              '<div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e.desc+'</div>'+
              '<div style="font-size:11px;color:var(--ink3);margin-top:2px">'+personPill(e.person)+' · '+(e.split?'หาร 2':'ส่วนตัว')+'</div>'+
            '</div>'+
            '<div style="text-align:right;flex-shrink:0">'+
              '<div style="font-size:13px;font-family:monospace;font-weight:500">'+fmt(e.amt)+' บาท</div>'+
              persons.map(function(p){var s=e.split?e.amt/2:(e.person===p.id?e.amt:0);return '<div style="font-size:11px;color:var(--blue)">'+p.name+': '+fmt(s)+'</div>';}).join('')+
            '</div>'+
          '</div>'+
        '</div>';}).join('')
    : '<div class="table-scroll"><table>'+
        '<tr><th>รายการ</th><th>ผู้จ่าย</th><th>จำนวน</th><th>หาร2</th>'+persons.map(function(p){return '<th>'+p.name+'</th>';}).join('')+'</tr>'+
        me.map(function(e){return '<tr><td>'+e.desc+'</td><td>'+personPill(e.person)+'</td><td class="mono">'+fmt(e.amt)+'</td><td>'+(e.split?'÷ 2':'ส่วนตัว')+'</td>'+persons.map(function(p){var s=e.split?e.amt/2:(e.person===p.id?e.amt:0);return '<td class="mono" style="color:var(--blue)">'+fmt(s)+'</td>';}).join('')+'</tr>';}).join('')+
        '<tr style="font-weight:600;background:var(--surface2)"><td colspan="4">รวม</td>'+persons.map(function(p){return '<td class="mono" style="color:var(--blue)">'+fmt(share[p.id]||0)+'</td>';}).join('')+'</tr>'+
      '</table></div>';

  document.getElementById('settleContent').innerHTML=
    '<div class="metrics" style="margin-bottom:12px">'+
      persons.map(function(p){return '<div class="metric"><div class="metric-label">'+p.name+' จ่ายจริง</div><div class="metric-val b mono">'+fmt(paid[p.id]||0)+'</div><div class="metric-sub">บาท</div></div>'+
        '<div class="metric"><div class="metric-label">'+p.name+' ควรจ่าย</div><div class="metric-val mono">'+fmt(share[p.id]||0)+'</div><div class="metric-sub">บาท</div></div>';
      }).join('')+
    '</div>'+
    '<div class="'+(owe<1?'settle-ok':'settle-owe')+' settle-card" style="width:100%">'+
      '<div style="font-size:12px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">'+(owe<1?'ยอดเรียบร้อย':'ยอดที่ต้องชำระคืน')+'</div>'+
      (owe<1
        ? '<div class="settle-amount" style="color:var(--green)">ไม่มียอดค้างชำระ</div><div style="font-size:13px;color:var(--green)">ทุกคนจ่ายเท่ากันพอดี</div>'
        : '<div class="settle-amount" style="color:var(--amber)">'+fmt(owe)+' บาท</div>'+
           '<div style="font-size:14px;font-weight:500">'+debtor.name+' โอนให้ '+creditor.name+'</div>'+
           '<div style="font-size:12px;color:var(--ink3);margin-top:4px">รวม '+fmt(totalExp)+' บาท'+(totalExp?(' · '+n.A+' '+(paidA?((paidA/totalExp)*100).toFixed(0):0)+'% · '+n.B+' '+(paidB?((paidB/totalExp)*100).toFixed(0):0)+'%'):'')+'</div>'
      )+
    '</div>'+
    '<div class="card" style="width:100%">'+
      '<div class="card-title" style="display:flex;align-items:center;justify-content:space-between">'+
        '<span>รายละเอียดเดือน '+m+'</span>'+
        '<button onclick="exportSettlePDF(\''+m+'\')" style="'+
          'background:var(--red);color:#fff;border:none;border-radius:8px;'+
          'padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;'+
          'font-family:Sarabun,sans-serif;display:flex;align-items:center;gap:6px;'+
          'min-height:36px;touch-action:manipulation'+
        '">'+
          '<svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M10 13l-5-5h3V3h4v5h3l-5 5zM3 16h14v2H3v-2z"/></svg>'+
          ' Export PDF'+
        '</button>'+
      '</div>'+
      detailRows+
    '</div>'+
    (showPersonal && personal.length ?
    '<div class="card" style="width:100%;margin-top:8px">'+
      '<div class="card-title" style="color:var(--ink3)">รายจ่ายส่วนตัว (ไม่นำมาคำนวณ Settlement)</div>'+
      personal.map(function(e){return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">'+
          '<div>'+
            '<span>'+e.desc+'</span>'+
            '<span style="font-size:11px;color:var(--ink3);margin-left:6px">'+personPill(e.person)+'</span>'+
            (e.note?'<div style="font-size:11px;color:var(--ink3);font-style:italic">📝 '+e.note+'</div>':'')+
          '</div>'+
          '<span style="font-family:monospace;color:var(--red)">'+fmt(e.amt)+'</span>'+
        '</div>';}).join('')+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;font-weight:600;font-size:13px">'+
        '<span>รวมส่วนตัว</span>'+
        '<span style="font-family:monospace">'+fmt(personal.reduce(function(s,e){return s+e.amt;},0))+'</span>'+
      '</div>'+
    '</div>' : '');
}

function exportSettlePDF(month){
  var n = names();
  var me = db.filter(function(e){return e.date.startsWith(month)&&e.type==='expense'&&isPaid(e);});
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
