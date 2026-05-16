/* HomeFinance · module: dashboard.js · v3.0.0 */

// ─── DASHBOARD ───────────────────────────────────────────
function populateDashYears(){
  var selY = document.getElementById('dashYear');
  if(!selY) return;
  var now = new Date();
  var thisY = now.getFullYear();
  var years = Array.from(new Set(db.map(function(e){return Number(e.date.slice(0,4));}))).sort().reverse();
  if(years.indexOf(thisY)===-1) years.unshift(thisY);
  var curY = selY.value ? Number(selY.value) : thisY;
  selY.innerHTML = years.map(function(y){return '<option value="'+y+'" '+(y===curY?'selected':'')+'>'+(y+543)+'</option>';}).join('');
  selY.value = curY;
}

function populateDashMonthsByYear(year){
  var selM = document.getElementById('dashMonth');
  if(!selM) return;
  var now = new Date();
  var thisM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var curM = selM.value;
  // months that have data for this year
  var months = Array.from(new Set(
    db.filter(function(e){return e.date.startsWith(String(year)+'-');}).map(function(e){return e.date.slice(0,7);})
  )).sort().reverse();
  // add current month if current year
  if(year===now.getFullYear() && months.indexOf(thisM)===-1) months.unshift(thisM);
  selM.innerHTML = months.map(function(m){
    var mo = Number(m.split('-')[1]);
    return '<option value="'+m+'" '+(m===curM?'selected':'')+'>'+SHORT_M[mo-1]+'</option>';
  }).join('');
  // คงค่าที่ผู้ใช้เลือกไว้ถ้ายังมีในรายการ มิฉะนั้นใช้เดือนปัจจุบัน/แรกสุด
  if(curM && months.indexOf(curM) !== -1) selM.value = curM;
  else if(year===now.getFullYear()) selM.value = thisM;
  else if(months.length) selM.value = months[0];
}

function onDashYearChange(){
  var year = Number(document.getElementById('dashYear').value);
  populateDashMonthsByYear(year);
  renderDash();
}

function renderDash(){
  var selM = document.getElementById('dashMonth');
  var savedMonth = selM ? selM.value : '';
  populateDashYears();
  var yearVal = document.getElementById('dashYear')?.value;
  if(yearVal) populateDashMonthsByYear(Number(yearVal));
  // คืนค่าเดือนที่ user เลือกไว้ (กันไม่ให้ populateDashMonthsByYear reset)
  if(savedMonth && selM && selM.querySelector('option[value="'+savedMonth+'"]')) selM.value = savedMonth;

  var sel = document.getElementById('dashMonth');
  var now = new Date();
  var thisM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var curM = (sel && sel.value) || thisM;
  var parts = curM.split('-').map(Number);
  var y=parts[0], mo=parts[1];

  document.getElementById('dashSub').textContent =
    'ภาพรวมการเงิน '+SHORT_M[mo-1]+' '+(y+543);

  var me = db.filter(function(e){ return e.date.startsWith(curM); });
  var inc = me.filter(function(e){return e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var exp = me.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var pIn = me.filter(function(e){return e.type==='income'&&e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var pOut = me.filter(function(e){return e.type==='expense'&&e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var bal = inc-exp;
  document.getElementById('metrics').innerHTML=
    '<div class="metric"><div class="metric-label">รายรับ</div><div class="metric-val g mono">'+fmt(inc)+'</div><div class="metric-sub">บาท · รับแล้ว</div></div>'+
    '<div class="metric"><div class="metric-label">รายจ่าย</div><div class="metric-val r mono">'+fmt(exp)+'</div><div class="metric-sub">บาท · จ่ายแล้ว</div></div>'+
    '<div class="metric"><div class="metric-label">คงเหลือ</div><div class="metric-val '+(bal>=0?'g':'r')+' mono">'+fmt(bal)+'</div><div class="metric-sub">บาท</div></div>'+
    '<div class="metric"><div class="metric-label">รอรับ</div><div class="metric-val a mono">'+fmt(pIn)+'</div><div class="metric-sub">บาท</div></div>'+
    '<div class="metric"><div class="metric-label">รอจ่าย</div><div class="metric-val r mono">'+fmt(pOut)+'</div><div class="metric-sub">บาท</div></div>';
  // Charts — pass curM
  var activeChart = localStorage.getItem('hf2_chart')||'bar';
  switchChart(activeChart, curM);
  // Recent & Pending for selected month
  var _dbFiltered = db;
  var recent = curM === thisM ? _dbFiltered.slice(0,6) : _dbFiltered.filter(function(e){return e.date.startsWith(curM);}).slice(0,6);
  document.getElementById('recentTx').innerHTML=recent.length?'<table><tr><th>วันที่</th><th>รายการ</th><th style="text-align:right">จำนวน (บาท)</th><th>สถานะ</th></tr>'+recent.map(function(e){return '<tr>'+
    '<td style="font-size:12px;color:var(--ink3);white-space:nowrap">'+toThaiDateShort(e.date)+'</td>'+
    '<td>'+e.desc+' <span class="badge '+(e.type==='income'?'badge-income':e.type==='transfer'?'badge-transfer':'badge-expense')+'" style="font-size:10px">'+(e.type==='income'?'รายรับ':e.type==='transfer'?'⇄ โอน':'รายจ่าย')+'</span>'+(e.note?'<div style="font-size:10px;color:var(--ink3);font-style:italic">📝 '+e.note+'</div>':'')+
    '</td>'+
    '<td style="text-align:right;font-family:monospace;color:'+(e.type==='income'?'var(--green)':e.type==='transfer'?'var(--blue)':'var(--red)')+'">'+fmt(e.amt)+'</td>'+
    '<td><span class="badge '+(isPaid(e)?'badge-paid':'badge-pending')+'" style="font-size:10px">'+(e.type==='transfer'?(isPaid(e)?'โอนแล้ว':'รอโอน'):(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย')))+'</span></td>'+
    '</tr>';}).join('')+'</table>':'<div class="empty">ยังไม่มีรายการ</div>';
  var pend=_dbFiltered.filter(function(e){return e.status==='pending';});
  document.getElementById('pendingTx').innerHTML=pend.length?'<table><tr><th>รายการ</th><th style="text-align:right">จำนวน</th><th>สถานะ</th><th></th></tr>'+pend.map(function(e){return '<tr>'+
    '<td>'+e.desc+'<br><span style="font-size:11px;color:var(--ink3)">'+toThaiDateShort(e.date)+'</span>'+(e.note?'<br><span style="font-size:10px;color:var(--ink3);font-style:italic">📝 '+e.note+'</span>':'')+
    '</td>'+
    '<td style="text-align:right;font-family:monospace">'+fmt(e.amt)+'</td>'+
    '<td><span class="badge badge-pending" style="font-size:10px">'+(e.type==='income'?'รอรับ':e.type==='transfer'?'รอโอน':'รอจ่าย')+'</span></td>'+
    '<td><button class="btn btn-confirm" onclick="markPaid(\''+e.id+'\');renderDash()">✓</button></td>'+
    '</tr>';}).join('')+'</table>':'<div class="empty">ไม่มีรายการรอดำเนินการ</div>';
  renderSalaryCycleCard();
  // v3: render account summary cards on dashboard
  if (typeof renderAccountCards === 'function') renderAccountCards();
}

function renderSalaryCycleCard(){
  var card    = document.getElementById('salaryCycleCard');
  var content = document.getElementById('salaryCycleContent');
  if(!card||!content) return;

  // Use v3 engines when available, fallback to v2 logic
  var cycleId  = typeof getCurrentCycleId === 'function' ? getCurrentCycleId() : null;
  var summary  = (cycleId && typeof getDashboardSummary === 'function') ? getDashboardSummary(cycleId) : null;

  // Fallback v2 values
  var cycle    = getSalaryCycle();
  var cycleInc, cycleExp, received, pending, totalExp, remain, dayLeft;

  if (summary) {
    received = summary.received;
    pending  = summary.pendingBalance;
    totalExp = summary.totalExpense;
    remain   = summary.activeBalance;
    dayLeft  = summary.daysRemaining;
  } else {
    var today = new Date();
    cycleInc  = db.filter(function(e){return e.type==='income'&&e.date>=cycle.start&&e.date<=cycle.end;});
    cycleExp  = db.filter(function(e){return e.type==='expense'&&e.date>=cycle.start&&e.date<=cycle.end&&isPaid(e);});
    received  = cycleInc.filter(function(e){return isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
    pending   = cycleInc.filter(function(e){return e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
    totalExp  = cycleExp.reduce(function(s,e){return s+e.amt;},0);
    remain    = received - totalExp;
    dayLeft   = Math.max(0, Math.ceil((new Date(cycle.end) - today) / 86400000));
  }

  // Forecast (v3)
  var forecastHtml = '';
  if (cycleId && typeof renderForecastCard === 'function') {
    forecastHtml = renderForecastCard(cycleId);
  }

  // Pending salary entries
  var allInCycle = db.filter(function(e){ return e.date >= cycle.start && e.date <= cycle.end; });
  var pendList   = allInCycle.filter(function(e){ return e.type==='income'&&e.status==='pending'&&e._salary_cycle; });

  // Progress bar for cycle
  var totalDays   = summary ? summary.totalDays : 31;
  var elapsed     = summary ? summary.daysElapsed : (totalDays - dayLeft);
  var progressPct = Math.min(100, Math.round(elapsed / totalDays * 100));
  var spendPct    = received > 0 ? Math.min(100, Math.round(totalExp / received * 100)) : 0;

  card.style.display='block';
  content.innerHTML=
    // Header
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">'+
      '<div>'+
        '<div style="font-size:12px;font-weight:700;color:#1a4fa0;letter-spacing:.3px">💼 รอบเงินเดือน</div>'+
        '<div style="font-size:11px;color:var(--ink3);margin-top:2px">'+cycle.label+'</div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink3);background:var(--surface2);padding:3px 10px;border-radius:12px">'+
        'เหลืออีก <b>'+dayLeft+'</b> วัน'+
      '</div>'+
    '</div>'+
    // Cycle progress bar
    '<div style="margin-bottom:10px">'+
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-bottom:3px">'+
        '<span>เริ่ม '+toThaiDateShort(cycle.start)+'</span>'+
        '<span>'+progressPct+'% ของรอบ</span>'+
        '<span>สิ้นสุด '+toThaiDateShort(cycle.end)+'</span>'+
      '</div>'+
      '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+progressPct+'%;background:#1a4fa0;border-radius:3px;transition:width .4s"></div>'+
      '</div>'+
    '</div>'+
    // 4-metric grid
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">'+
      '<div style="background:var(--surface2);border-radius:8px;padding:8px">'+
        '<div style="font-size:10px;color:var(--ink3)">✅ รับแล้ว (Active)</div>'+
        '<div style="font-size:15px;font-weight:700;color:var(--green);font-family:monospace">'+fmt(received)+'</div>'+
      '</div>'+
      '<div style="background:var(--surface2);border-radius:8px;padding:8px">'+
        '<div style="font-size:10px;color:var(--ink3)">💸 รายจ่ายรอบนี้</div>'+
        '<div style="font-size:15px;font-weight:700;color:var(--red);font-family:monospace">'+fmt(totalExp)+'</div>'+
      '</div>'+
      '<div style="background:var(--surface2);border-radius:8px;padding:8px">'+
        '<div style="font-size:10px;color:var(--ink3)">💰 คงเหลือ (Active)</div>'+
        '<div style="font-size:15px;font-weight:700;color:'+(remain>=0?'var(--green)':'var(--red)')+';font-family:monospace">'+fmt(remain)+'</div>'+
      '</div>'+
      (pending > 0 ?
      '<div style="background:#fdf4e7;border:1px solid #f0c36a;border-radius:8px;padding:8px">'+
        '<div style="font-size:10px;color:#b5600a">⏳ รอรับ (Pending)</div>'+
        '<div style="font-size:15px;font-weight:700;color:#b5600a;font-family:monospace">'+fmt(pending)+'</div>'+
      '</div>'
      :
      '<div style="background:var(--surface2);border-radius:8px;padding:8px">'+
        '<div style="font-size:10px;color:var(--ink3)">📊 ใช้จ่ายไป</div>'+
        '<div style="font-size:15px;font-weight:700;color:var(--ink2);font-family:monospace">'+spendPct+'%</div>'+
      '</div>') +
    '</div>'+
    // Pending salary activation
    (pendList.length ?
    '<div style="background:#fdf4e7;border:1px solid #f0c36a;border-radius:8px;padding:8px 10px;margin-bottom:10px">'+
      '<div style="font-size:11px;font-weight:700;color:#b5600a;margin-bottom:6px">⏳ รอรับ — จะเปิดใช้งานวันที่ '+SALARY_DAY+'</div>'+
      pendList.map(function(e){return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid rgba(240,195,106,.3)">'+
          '<span>'+e.desc+'</span>'+
          '<span style="font-family:monospace;font-weight:600;color:#b5600a">+'+fmt(e.amt)+'</span>'+
        '</div>';}).join('')+
      '<button onclick="activateSalaryNow()" style="margin-top:8px;width:100%;background:#1a4fa0;color:#fff;border:none;border-radius:8px;padding:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">✓ ยืนยันรับเงินทันที</button>'+
    '</div>' : '')+
    // Forecast card (v3)
    forecastHtml;
}

function activateSalaryNow(){
  if(!checkOnlineForAction()) return;
  db.forEach(function(e){
    if(e.type==='income'&&e.status==='pending'&&e._salary_cycle){
      e.status='received'; sbUpdate(e);
    }
  });
  save(); renderDash(); renderTx();
  showCycleToast('✅ ยืนยันรับเงินเรียบร้อย');
}

// ─── DASHBOARD CHARTS ─────────────────────────────────────
var chartMain = null;

/** ดึงชื่อที่ดีที่สุดสำหรับ person entry */
function _personDisplayName(p) {
  if (p.user_id && window._allProfiles && window._allProfiles.length) {
    var prof = window._allProfiles.find(function(x) { return x.id === p.user_id; });
    if (prof && prof.name) return prof.name;
  }
  return p.name || '?';
}

function switchChart(type, passedMonth){
  localStorage.setItem('hf2_chart', type);
  document.querySelectorAll('.chart-tab').forEach(function(b){
    b.classList.toggle('active', b.id === 'ct-'+type);
  });
  if(chartMain){ chartMain.destroy(); chartMain=null; }
  document.getElementById('chartLegend').innerHTML='';

  var now = new Date();
  var thisM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var curMonth = passedMonth || document.getElementById('dashMonth')?.value || thisM;
  var me = db.filter(function(e){return e.date.startsWith(curMonth);});
  var canvas = document.getElementById('chartMain');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');

  var opts = {responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{y:{ticks:{callback:function(v){return fmt(v);},font:{size:10}},grid:{color:'rgba(128,128,128,0.08)'},border:{dash:[4,4]}},
            x:{grid:{display:false},ticks:{font:{size:10}}}}};

  if(type==='bar'){
    // รายรับ vs รายจ่ายแยกคน
    var labels = persons.map(function(p){return _personDisplayName(p)+'\n(รับ)';}).concat(['รายจ่าย\nรวม']);
    var vals = persons.map(function(p){return me.filter(function(e){
      return e.type==='income'&&isPaid(e)&&(e.user_id?e.user_id===p.user_id:e.person===p.id);
    }).reduce(function(s,e){return s+e.amt;},0);})
      .concat([me.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0)]);
    chartMain = new Chart(ctx,{type:'bar',data:{labels:labels,datasets:[{data:vals,backgroundColor:['#4ade80','#86efac','#f87171'],borderRadius:6,borderWidth:0}]},options:opts});
    document.getElementById('chartLegend').innerHTML='รายรับ vs รายจ่ายเดือนนี้';

  } else if(type==='donut'){
    // สัดส่วนรายจ่ายแต่ละหมวด
    var bycat={};
    me.filter(function(e){return e.type==='expense'&&isPaid(e);}).forEach(function(e){var k=e.cat_name||'—';bycat[k]=(bycat[k]||0)+e.amt;});
    var catsKeys=Object.keys(bycat), valsD=catsKeys.map(function(c){return bycat[c];});
    if(!catsKeys.length){ document.getElementById('chartLegend').innerHTML='ยังไม่มีข้อมูลรายจ่าย'; return; }
    chartMain = new Chart(ctx,{type:'doughnut',data:{labels:catsKeys,datasets:[{data:valsD,backgroundColor:PALETTE.slice(0,catsKeys.length),borderWidth:0,hoverOffset:4}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:{legend:{display:true,position:'bottom',labels:{font:{size:10},padding:8,boxWidth:8,usePointStyle:true}}}}});

  } else if(type==='trend'){
    // แนวโน้ม 6 เดือนย้อนหลัง
    var months=[];
    for(var i=5;i>=0;i--){
      var d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    }
    var incVals = months.map(function(m){return db.filter(function(e){return e.date.startsWith(m)&&e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);});
    var expVals = months.map(function(m){return db.filter(function(e){return e.date.startsWith(m)&&e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);});
    var labelsT = months.map(function(m){ var p=m.split('-').map(Number); return SHORT_M[p[1]-1]+(p[0]+543-2500<100?'':"'"+String(p[0]+543).slice(2)); });
    chartMain = new Chart(ctx,{type:'line',data:{labels:labelsT,datasets:[
      {label:'รายรับ',data:incVals,borderColor:'#4ade80',backgroundColor:'rgba(74,222,128,.1)',tension:.3,fill:true,pointRadius:4,borderWidth:2},
      {label:'รายจ่าย',data:expVals,borderColor:'#f87171',backgroundColor:'rgba(248,113,113,.1)',tension:.3,fill:true,pointRadius:4,borderWidth:2},
    ]},options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:12}}}})});

  } else if(type==='person'){
    // แยกรายจ่ายตามคน
    var bycat2={};
    me.filter(function(e){return e.type==='expense'&&isPaid(e);}).forEach(function(e){var k=e.cat_name||'—';bycat2[k]=(bycat2[k]||0)+e.amt;});
    var catsP = Object.keys(bycat2);
    if(!catsP.length){ document.getElementById('chartLegend').innerHTML='ยังไม่มีข้อมูลรายจ่าย'; return; }
    var datasets = persons.map(function(p,i){return {
      label:_personDisplayName(p),
      data:catsP.map(function(c){return me.filter(function(e){
        return (e.user_id?e.user_id===p.user_id:e.person===p.id)&&(e.cat_name||'—')===c&&e.type==='expense'&&isPaid(e);
      }).reduce(function(s,e){return s+e.amt;},0);}),
      backgroundColor:['rgba(74,222,128,.8)','rgba(96,165,250,.8)'][i]||PALETTE[i],
      borderRadius:4,borderWidth:0
    };});
    chartMain = new Chart(ctx,{type:'bar',data:{labels:catsP,datasets:datasets},
      options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:10}}},indexAxis:'y',scales:{x:{ticks:{callback:function(v){return fmt(v);},font:{size:10}},grid:{color:'rgba(128,128,128,0.08)'}},y:{grid:{display:false},ticks:{font:{size:10}}}}})});

  } else if(type==='status'){
    // สถานะรายการ (paid vs pending แยก income/expense)
    var incPaid  = db.filter(function(e){return e.type==='income' &&isPaid(e)   &&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    var incPend  = db.filter(function(e){return e.type==='income' &&e.status==='pending'&&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    var expPaid  = db.filter(function(e){return e.type==='expense'&&isPaid(e)   &&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    var expPend  = db.filter(function(e){return e.type==='expense'&&e.status==='pending'&&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    chartMain = new Chart(ctx,{type:'bar',
      data:{
        labels:['รายรับ','รายจ่าย'],
        datasets:[
          {label:'เสร็จแล้ว',data:[incPaid,expPaid],backgroundColor:'rgba(74,222,128,.85)',borderRadius:4,borderWidth:0},
          {label:'รอดำเนินการ',data:[incPend,expPend],backgroundColor:'rgba(248,189,71,.85)',borderRadius:4,borderWidth:0},
        ]
      },
      options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:10}}},scales:Object.assign({}, opts.scales, {x:{stacked:false,grid:{display:false},ticks:{font:{size:11}}},y:Object.assign({stacked:false}, opts.scales.y)})})
    });
  }
}
