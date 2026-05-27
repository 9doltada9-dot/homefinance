/* HomeFinance · module: monthly.js · v2.5.0 */

function renderMonthly(){
  var m=document.getElementById('monthSel').value;
  if(!m){document.getElementById('monthlyContent').innerHTML='<div class="empty">เลือกเดือน</div>';return;}
  var me=db.filter(function(e){return e.date.startsWith(m);});
  var incPaid=me.filter(function(e){return e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var expPaid=me.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var pend=me.filter(function(e){return e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var bycat={};
  me.filter(function(e){return e.type==='expense'&&isPaid(e);}).forEach(function(e){var k=e.cat_name||'—';bycat[k]=(bycat[k]||0)+e.amt;});
  var catEntries=Object.entries(bycat).sort(function(a,b){return b[1]-a[1];});

  var incomeBlock = (function(){
    var incCat={};
    me.filter(function(e){return e.type==='income'&&isPaid(e);}).forEach(function(e){
      var k=(e.cat_name||'อื่นๆ');
      incCat[k]=(incCat[k]||0)+e.amt;
    });
    var ic=Object.entries(incCat).sort(function(a,b){return b[1]-a[1];});
    return ic.length?'<table><tr><th>ประเภท</th><th style="text-align:right">จำนวน</th></tr>'+
      ic.map(function(pair){var k=pair[0],v=pair[1];return '<tr><td>'+k+'</td><td style="text-align:right;font-family:monospace;color:var(--green)">'+fmtH(v)+'</td></tr>';}).join('')+'</table>':'<div class="empty">ไม่มีรายรับ</div>';
  })();

  document.getElementById('monthlyContent').innerHTML=
    '<div class="metrics" style="margin-bottom:16px">'+
      '<div class="metric"><div class="metric-label">รายรับรวม</div><div class="metric-val g mono">'+fmtH(incPaid)+'</div><div class="metric-sub">บาท</div></div>'+
      '<div class="metric"><div class="metric-label">รายจ่ายรวม</div><div class="metric-val r mono">'+fmtH(expPaid)+'</div><div class="metric-sub">บาท</div></div>'+
      '<div class="metric"><div class="metric-label">คงเหลือ</div><div class="metric-val '+(incPaid-expPaid>=0?'g':'r')+' mono">'+fmtH(incPaid-expPaid)+'</div><div class="metric-sub">บาท</div></div>'+
    '</div>'+
    '<div class="grid2">'+
      '<div class="card">'+
        '<div class="card-title">รายจ่ายแยกหมวด</div>'+
        (catEntries.length?'<table><tr><th>หมวดหมู่</th><th style="text-align:right">จำนวน</th><th style="text-align:right">%</th></tr>'+
        catEntries.map(function(pair){var cat=pair[0],amt=pair[1];return '<tr><td>'+cat+'</td><td style="text-align:right;font-family:monospace">'+fmtH(amt)+'</td>'+
          '<td style="text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">'+
            '<div style="height:4px;width:'+Math.round((amt/expPaid)*60)+'px;background:var(--blue);border-radius:2px;min-width:4px"></div>'+
            '<span style="font-size:12px;color:var(--ink3)">'+(expPaid?((amt/expPaid)*100).toFixed(1):0)+'%</span>'+
          '</div></td></tr>';}).join('')+
        '</table>':'<div class="empty">ไม่มีรายจ่าย</div>')+
      '</div>'+
      '<div class="card">'+
        '<div class="card-title">รายรับแยกประเภท</div>'+
        incomeBlock+
      '</div>'+
    '</div>';
}
