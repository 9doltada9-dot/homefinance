/* HomeFinance · module: dashboard.js · v3.0.0 */

// ─── DASHBOARD ───────────────────────────────────────────
function renderDash(){
  var now = new Date();
  var thisM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var curM = thisM;
  var parts = curM.split('-').map(Number);
  var y=parts[0], mo=parts[1];

  document.getElementById('dashSub').textContent =
    'ภาพรวมการเงิน '+SHORT_M[mo-1]+' '+(y+543);

  var _myUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _dashDb = _myUid ? db.filter(function(e){ return (e.user_id||e.person) === _myUid; }) : db;
  var me = _dashDb.filter(function(e){ return e.date.startsWith(curM); });
  var inc = me.filter(function(e){return e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var exp = me.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var pIn = me.filter(function(e){return e.type==='income'&&e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var pOut = me.filter(function(e){return e.type==='expense'&&e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var bal = inc-exp;
  var _mc = 'flex:1;min-width:150px;flex-shrink:0';
  document.getElementById('metrics').innerHTML=
    '<div class="hf-card" style="'+_mc+'"><div class="hf-metric-label">รายรับ</div><div class="hf-metric-val g">'+fmtH(inc)+'</div><div class="hf-metric-sub">บาท · รับแล้ว</div></div>'+
    '<div class="hf-card" style="'+_mc+'"><div class="hf-metric-label">รายจ่าย</div><div class="hf-metric-val r">'+fmtH(exp)+'</div><div class="hf-metric-sub">บาท · จ่ายแล้ว</div></div>'+
    '<div class="hf-card" style="'+_mc+'"><div class="hf-metric-label">คงเหลือ</div><div class="hf-metric-val '+(bal>=0?'g':'r')+'">'+fmtH(bal)+'</div><div class="hf-metric-sub">บาท</div></div>'+
    '<div class="hf-card" style="'+_mc+'"><div class="hf-metric-label">รอดำเนินการ</div><div class="hf-metric-val a">'+fmtH(pIn+pOut)+'</div><div class="hf-metric-sub">'+(pIn>0?'รับ '+fmtH(pIn)+' ':'')+( pOut>0?'จ่าย '+fmtH(pOut):'ไม่มี')+'</div></div>';
  switchChart('trend', curM);
  // Recent — วันที่ล่าสุดก่อน → ภายในวันเดียวกัน: created_at ล่าสุดก่อน
  var _dbFiltered = _dashDb.slice().sort(function(a, b){
    if(a.date > b.date) return -1;
    if(a.date < b.date) return 1;
    var at = a.created_at||'', bt = b.created_at||'';
    if(bt > at) return 1;
    if(bt < at) return -1;
    return 0;
  });
  var _recentPool = (curM === thisM ? _dbFiltered : _dbFiltered.filter(function(e){return e.date.startsWith(curM);}))
    .filter(function(e){ return e.status !== 'pending'; });
  var recent = _recentPool.slice(0,6);
  document.getElementById('recentTx').innerHTML=recent.length?'<table class="hf-table"><tr><th>วันที่</th><th>รายการ</th><th style="text-align:right">จำนวน (บาท)</th></tr>'+recent.map(function(e){
    var _rc=e.type==='income'?'var(--green)':e.type==='transfer'?'var(--blue)':'var(--red)';
    return '<tr>'+
    '<td style="font-size:12px;color:var(--ink3);white-space:nowrap">'+toThaiDateShort(e.date)+'</td>'+
    '<td><span style="font-weight:600;color:'+_rc+'">'+e.desc+'</span>'+(e.note?'<div style="font-size:10px;color:var(--ink3);font-style:italic">📝 '+e.note+'</div>':'')+
    '</td>'+
    '<td style="text-align:right;font-family:monospace;color:'+_rc+'">'+fmtH(e.amt)+'</td>'+
    '</tr>';}).join('')+'</table>':'<div class="empty">ยังไม่มีรายการ</div>';
  var pend=_dbFiltered.filter(function(e){return e.status==='pending';});
  renderSalaryCycleCard();
  renderDashNetworthCard();
  renderDashBudgetMini();
  renderDashSettleMini(pend);
  renderDashSavingsMini();
  initDashDrag(); // drag-to-reorder (idempotent)
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
    var _myUid2 = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
    var _cycleDb = _myUid2 ? db.filter(function(e){ return (e.user_id||e.person) === _myUid2; }) : db;
    cycleInc  = _cycleDb.filter(function(e){return e.type==='income'&&e.date>=cycle.start&&e.date<=cycle.end;});
    cycleExp  = _cycleDb.filter(function(e){return e.type==='expense'&&e.date>=cycle.start&&e.date<=cycle.end&&isPaid(e);});
    received  = cycleInc.filter(function(e){return isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
    pending   = cycleInc.filter(function(e){return e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
    totalExp  = cycleExp.reduce(function(s,e){return s+e.amt;},0);
    remain    = received - totalExp;
    dayLeft   = Math.max(0, Math.ceil((new Date(cycle.end) - today) / 86400000));
  }

  // Pending salary entries
  var _myUid3 = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _cycleDb2 = _myUid3 ? db.filter(function(e){ return (e.user_id||e.person) === _myUid3; }) : db;
  var allInCycle = _cycleDb2.filter(function(e){ return e.date >= cycle.start && e.date <= cycle.end; });
  var pendList   = allInCycle.filter(function(e){ return e.type==='income'&&e.status==='pending'&&e._salary_cycle; });

  // Progress bar for cycle
  var totalDays   = summary ? summary.totalDays : 31;
  var elapsed     = summary ? summary.daysElapsed : (totalDays - dayLeft);
  var progressPct = Math.min(100, Math.round(elapsed / totalDays * 100));
  var spendPct    = received > 0 ? Math.min(100, Math.round(totalExp / received * 100)) : 0;

  card.style.display='flex';
  content.innerHTML=
    // ── Header
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:6px">'+
      '<div>'+
        '<div style="font-size:11px;font-weight:700;color:var(--accent,#00F5FF);letter-spacing:.3px;text-transform:uppercase">💼 รอบเงินเดือน</div>'+
        '<div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:1px">'+cycle.label+'</div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink2);background:var(--surface2);padding:4px 12px;border-radius:20px;font-weight:600;flex-shrink:0">'+
        (dayLeft===0?'<span style="color:#FF4D6D">สิ้นสุดวันนี้</span>':'เหลืออีก <b>'+dayLeft+'</b> วัน')+
      '</div>'+
    '</div>'+
    // ── Time progress bar
    '<div style="margin-bottom:12px">'+
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-bottom:4px">'+
        '<span>'+toThaiDateShort(cycle.start)+'</span>'+
        '<span style="font-weight:600;color:var(--ink2)">'+progressPct+'%</span>'+
        '<span>'+toThaiDateShort(cycle.end)+'</span>'+
      '</div>'+
      '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+progressPct+'%;background:linear-gradient(90deg,#00F5FF,#009DFF);border-radius:3px;transition:width .5s"></div>'+
      '</div>'+
    '</div>'+
    // ── 4-metric grid (1×4 desktop / 2×2 mobile via CSS class)
    '<div class="salary-metrics-grid">'+
      '<div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.28);border-radius:12px;padding:12px 10px">'+
        '<div style="font-size:10px;color:#00CC6A;margin-bottom:4px;font-weight:700">💰 รายรับ</div>'+
        '<div style="font-size:18px;font-weight:800;color:#00FF88;font-family:monospace;letter-spacing:-0.5px">'+fmtH(received)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">รับแล้ว</div>'+
      '</div>'+
      '<div style="background:rgba(255,77,109,.08);border:1px solid rgba(255,77,109,.28);border-radius:12px;padding:12px 10px">'+
        '<div style="font-size:10px;color:#FF4D6D;margin-bottom:4px;font-weight:700">💸 รายจ่าย</div>'+
        '<div style="font-size:18px;font-weight:800;color:#FF4D6D;font-family:monospace;letter-spacing:-0.5px">'+fmtH(totalExp)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">จ่ายแล้ว</div>'+
      '</div>'+
      '<div style="background:'+(remain>=0?'rgba(0,255,136,.08)':'rgba(255,77,109,.08)')+';border:1px solid '+(remain>=0?'rgba(0,255,136,.28)':'rgba(255,77,109,.28)')+';border-radius:12px;padding:12px 10px">'+
        '<div style="font-size:10px;color:'+(remain>=0?'#00CC6A':'#FF4D6D')+';margin-bottom:4px;font-weight:700">💵 คงเหลือ</div>'+
        '<div style="font-size:18px;font-weight:800;color:'+(remain>=0?'#00FF88':'#FF4D6D')+';font-family:monospace;letter-spacing:-0.5px">'+fmtH(remain)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">สุทธิรอบนี้</div>'+
      '</div>'+
      '<div style="background:'+(pending>0?'rgba(255,200,87,.08)':'rgba(0,245,255,.04)')+';border:1px solid '+(pending>0?'rgba(255,200,87,.32)':'rgba(0,245,255,.08)')+';border-radius:12px;padding:12px 10px">'+
        '<div style="font-size:10px;color:'+(pending>0?'#FFC857':'var(--ink3)')+';margin-bottom:4px;font-weight:700">⏳ รอรับ</div>'+
        '<div style="font-size:18px;font-weight:800;color:'+(pending>0?'#FFC857':'var(--ink3)')+';font-family:monospace;letter-spacing:-0.5px">'+fmtH(pending)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">'+(pending>0?'รอดำเนินการ':'ไม่มีรอรับ')+'</div>'+
      '</div>'+
    '</div>'+
    // ── Spend bar
    (received > 0 ?
    '<div style="margin-bottom:10px">'+
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-bottom:4px">'+
        '<span>ใช้จ่ายไป '+spendPct+'%</span>'+
        '<span>'+fmtH(totalExp)+' / '+fmtH(received)+'</span>'+
      '</div>'+
      '<div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">'+
        '<div style="height:100%;width:'+spendPct+'%;border-radius:4px;transition:width .5s;background:'+(spendPct>=90?'#FF4D6D':spendPct>=70?'#FFC857':'#00FF88')+'"></div>'+
      '</div>'+
    '</div>'
    : '')+
    // ── Pending salary entries
    (pendList.length ?
    '<div style="background:rgba(255,200,87,.08);border:1px solid rgba(255,200,87,.32);border-radius:10px;padding:10px 12px;margin-bottom:2px">'+
      '<div style="font-size:11px;font-weight:700;color:#FFC857;margin-bottom:6px">⏳ รอรับ — เปิดใช้วันที่ '+SALARY_DAY+'</div>'+
      pendList.map(function(e){ return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid rgba(255,200,87,.18)">'+
        '<span>'+e.desc+'</span>'+
        '<span style="font-family:monospace;font-weight:700;color:#FFC857">'+fmtH(e.amt)+'</span>'+
      '</div>'; }).join('')+
      '<button onclick="activateSalaryNow()" style="margin-top:10px;width:100%;background:linear-gradient(135deg,#00F5FF,#009DFF);color:#050505;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">✓ ยืนยันรับเงินทันที</button>'+
    '</div>' : '');
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
var chartCat  = null;

/** ดึงชื่อที่ดีที่สุดสำหรับ person entry (legacy — ใช้กับ persons array) */
function _personDisplayName(p) {
  if (p.user_id && window._allProfiles && window._allProfiles.length) {
    var prof = window._allProfiles.find(function(x) { return x.id === p.user_id; });
    if (prof && prof.name) return prof.name;
  }
  return p.name || '?';
}

/**
 * สร้าง list ผู้ใช้สำหรับ chart จาก _allProfiles (UUID) + persons (A/B legacy map)
 * Returns: [{uid: uuid, name: 'ชื่อ', legacyId: 'A'|'B'|null}]
 */
function _getChartUsers() {
  if (window._allProfiles && window._allProfiles.length) {
    return window._allProfiles.map(function(prof) {
      // หา persons ที่ link กับ UUID นี้ (สำหรับ backward compat ข้อมูลเก่า)
      var linked = (typeof persons !== 'undefined')
        ? persons.find(function(p){ return p.user_id === prof.id; })
        : null;
      return { uid: prof.id, name: prof.name, legacyId: linked ? linked.id : null };
    });
  }
  // fallback: persons array (ไม่มี _allProfiles เช่น offline)
  return (typeof persons !== 'undefined' ? persons : []).map(function(p) {
    return { uid: p.user_id || p.id, name: _personDisplayName(p), legacyId: p.id };
  });
}

/** ตรวจว่า entry e เป็นของ user นี้ (รองรับทั้ง UUID ใหม่ และ A/B เก่า) */
function _isEntryByUser(e, user) {
  if (e.user_id) return e.user_id === user.uid;            // ใหม่: match by UUID
  return !!(user.legacyId && e.person === user.legacyId);  // เก่า: match by A/B
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
  var curMonth = passedMonth || thisM;
  var _myUidC = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _chartDb = _myUidC ? db.filter(function(e){ return (e.user_id||e.person) === _myUidC; }) : db;
  var me = _chartDb.filter(function(e){return e.date.startsWith(curMonth);});
  var canvas = document.getElementById('chartMain');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');

  var opts = {responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{y:{ticks:{callback:function(v){return fmt(v);},font:{size:10},color:'rgba(160,168,192,.7)'},grid:{color:'rgba(0,245,255,0.06)'},border:{dash:[4,4]}},
            x:{grid:{display:false},ticks:{font:{size:10},color:'rgba(160,168,192,.7)'}}},
    color:'rgba(160,168,192,.7)'};

  if(type==='bar'){
    // รายรับ vs รายจ่ายแยกคน — ใช้ _allProfiles (UUID) เป็น source
    var _cu = _getChartUsers();
    var labels = _cu.map(function(u){ return u.name+'\n(รับ)'; }).concat(['รายจ่าย\nรวม']);
    var _incColors = ['#00FF88','#00E5BC','#00F5FF','#C026FF','#FFC857'];
    var bgColors   = _cu.map(function(_,i){ return _incColors[i]||PALETTE[i]; }).concat(['#FF4D6D']);
    var vals = _cu.map(function(u){
      return me.filter(function(e){ return e.type==='income'&&isPaid(e)&&_isEntryByUser(e,u); })
               .reduce(function(s,e){return s+e.amt;},0);
    }).concat([me.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0)]);
    chartMain = new Chart(ctx,{type:'bar',data:{labels:labels,datasets:[{data:vals,backgroundColor:bgColors,borderRadius:6,borderWidth:0}]},options:opts});
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
    // แนวโน้ม 6 เดือนย้อนหลัง — รายรับ vs รายจ่ายรวม
    var months=[];
    for(var i=5;i>=0;i--){
      var d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    }
    var incVals = months.map(function(m){return _chartDb.filter(function(e){return e.date.startsWith(m)&&e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);});
    var expVals = months.map(function(m){return _chartDb.filter(function(e){return e.date.startsWith(m)&&e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);});
    var labelsT = months.map(function(m){ var p=m.split('-').map(Number); return SHORT_M[p[1]-1]+(p[0]+543-2500<100?'':"'"+String(p[0]+543).slice(2)); });
    chartMain = new Chart(ctx,{type:'line',data:{labels:labelsT,datasets:[
      {label:'รายรับ',data:incVals,borderColor:'#00FF88',backgroundColor:'rgba(0,255,136,.08)',tension:.3,fill:true,pointRadius:4,borderWidth:2},
      {label:'รายจ่าย',data:expVals,borderColor:'#FF4D6D',backgroundColor:'rgba(255,77,109,.08)',tension:.3,fill:true,pointRadius:4,borderWidth:2},
    ]},options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:12}}}})});
    // render item trend chips — ใช้ db ทุก user (ไม่กรองเจ้าของ)
    renderItemChips(db, months, labelsT);

  } else if(type==='person'){
    // แยกรายจ่ายตามคน
    var bycat2={};
    me.filter(function(e){return e.type==='expense'&&isPaid(e);}).forEach(function(e){var k=e.cat_name||'—';bycat2[k]=(bycat2[k]||0)+e.amt;});
    var catsP = Object.keys(bycat2);
    if(!catsP.length){ document.getElementById('chartLegend').innerHTML='ยังไม่มีข้อมูลรายจ่าย'; return; }
    var _cu2 = _getChartUsers();
    var _expColors = ['rgba(0,245,255,.80)','rgba(192,38,255,.80)','rgba(0,255,136,.80)','rgba(255,200,87,.80)'];
    var datasets = _cu2.map(function(u,i){return {
      label: u.name,
      data: catsP.map(function(c){return me.filter(function(e){
        return _isEntryByUser(e,u)&&(e.cat_name||'—')===c&&e.type==='expense'&&isPaid(e);
      }).reduce(function(s,e){return s+e.amt;},0);}),
      backgroundColor: _expColors[i]||PALETTE[i],
      borderRadius:4, borderWidth:0
    };});
    chartMain = new Chart(ctx,{type:'bar',data:{labels:catsP,datasets:datasets},
      options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:10}}},indexAxis:'y',scales:{x:{ticks:{callback:function(v){return fmt(v);},font:{size:10}},grid:{color:'rgba(128,128,128,0.08)'}},y:{grid:{display:false},ticks:{font:{size:10}}}}})});

  } else if(type==='status'){
    // สถานะรายการ (paid vs pending แยก income/expense)
    var incPaid  = _chartDb.filter(function(e){return e.type==='income' &&isPaid(e)   &&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    var incPend  = _chartDb.filter(function(e){return e.type==='income' &&e.status==='pending'&&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    var expPaid  = _chartDb.filter(function(e){return e.type==='expense'&&isPaid(e)   &&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    var expPend  = _chartDb.filter(function(e){return e.type==='expense'&&e.status==='pending'&&e.date.startsWith(curMonth);}).reduce(function(s,e){return s+e.amt;},0);
    chartMain = new Chart(ctx,{type:'bar',
      data:{
        labels:['รายรับ','รายจ่าย'],
        datasets:[
          {label:'เสร็จแล้ว',data:[incPaid,expPaid],backgroundColor:['rgba(0,255,136,.80)','rgba(255,77,109,.80)'],borderRadius:4,borderWidth:0},
          {label:'รอดำเนินการ',data:[incPend,expPend],backgroundColor:['rgba(255,200,87,.80)','rgba(255,123,107,.80)'],borderRadius:4,borderWidth:0},
        ]
      },
      options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:10}}},scales:Object.assign({}, opts.scales, {x:{stacked:false,grid:{display:false},ticks:{font:{size:11}}},y:Object.assign({stacked:false}, opts.scales.y)})})
    });
  }
}

// ─── CATEGORY SUB-CHART ──────────────────────────────────

function renderCatChips(chartDb, months, labelsT) {
  window._catChartDb = chartDb;
  window._catMonths  = months;
  window._catLabels  = labelsT;
  if (!window._selCats) window._selCats = [];
  var drop = document.getElementById('catTrendDrop');
  if (!drop) return;
  var catMap = {};
  chartDb.forEach(function(e){ if(e.type==='expense'&&isPaid(e)&&e.cat_name) catMap[e.cat_name]=true; });
  var cats = Object.keys(catMap).sort();
  drop.innerHTML = cats.length
    ? '<div style="padding:8px 10px;display:flex;flex-direction:column;gap:3px">'
      + cats.map(function(c,i){
          var on = window._selCats.indexOf(c) > -1;
          var col = PALETTE[i % PALETTE.length];
          return '<button data-cat="'+c.replace(/"/g,'&quot;')+'" data-col="'+col+'"'
            +' onclick="toggleCatSel(\''+c.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')\"'
            +' style="text-align:left;width:100%;background:'+(on?col+'28':'transparent')+';color:'+(on?col:'var(--ink)')+';border:1px solid '+(on?col:'transparent')+';padding:8px 12px;border-radius:10px;font-size:13px;font-weight:'+(on?700:500)+';cursor:pointer;font-family:Sarabun,sans-serif;display:flex;align-items:center;gap:8px">'
            +'<span style="width:8px;height:8px;border-radius:50%;background:'+col+';flex-shrink:0"></span>'+c+'</button>';
        }).join('')+'</div>'
    : '<div style="padding:12px;font-size:12px;color:var(--hf-ink3)">ยังไม่มีข้อมูล</div>';
  _updateCatLabel();
  renderCatChart(chartDb, months, labelsT);
}

function _updateCatLabel() {
  var lbl = document.getElementById('catTrendLabel');
  if (!lbl) return;
  var n = (window._selCats||[]).length;
  lbl.innerHTML = n===0 ? 'เลือกหมวด ▾' : n===1 ? window._selCats[0]+' ▾' : n+' หมวด ▾';
  lbl.classList.toggle('active', n > 0);
}

function toggleCatSel(c) {
  if (!window._selCats) window._selCats = [];
  var idx = window._selCats.indexOf(c);
  if (idx > -1) window._selCats.splice(idx, 1); else window._selCats.push(c);
  // อัปเดต style ปุ่มใน dropdown โดยไม่ rebuild (dropdown ยังค้างเปิดอยู่)
  var drop = document.getElementById('catTrendDrop');
  if (drop) drop.querySelectorAll('button[data-cat]').forEach(function(btn){
    var cat = btn.getAttribute('data-cat');
    var col = btn.getAttribute('data-col');
    var on  = window._selCats.indexOf(cat) > -1;
    btn.style.background  = on ? col+'28' : 'transparent';
    btn.style.color       = on ? col : 'var(--ink)';
    btn.style.border      = '1px solid '+(on ? col : 'transparent');
    btn.style.fontWeight  = on ? '700' : '500';
  });
  _updateCatLabel();
  renderCatChart(window._catChartDb, window._catMonths, window._catLabels);
}

function renderCatChart(chartDb, months, labelsT) {
  var canvas = document.getElementById('chartCat');
  var legend = document.getElementById('chartCatLegend');
  if (!canvas) return;
  if (chartCat) { chartCat.destroy(); chartCat = null; }
  if (!window._selCats || !window._selCats.length) {
    if (legend) legend.textContent = 'เลือกหมวดด้านบนเพื่อดูแนวโน้ม';
    return;
  }
  if (legend) legend.textContent = '';
  var opts2 = {responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:true,position:'top',labels:{font:{size:9},usePointStyle:true,padding:8,boxWidth:8}}},
    scales:{y:{ticks:{callback:function(v){return typeof fmt==='function'?fmt(v):v;},font:{size:9}},grid:{color:'rgba(128,128,128,0.08)'},border:{dash:[3,3]}},
            x:{grid:{display:false},ticks:{font:{size:9}}}}};
  var datasets = window._selCats.map(function(c,i){
    var col = PALETTE[i % PALETTE.length];
    var vals = months.map(function(m){return chartDb.filter(function(e){return e.date.startsWith(m)&&e.type==='expense'&&isPaid(e)&&(e.cat_name||'—')===c;}).reduce(function(s,e){return s+e.amt;},0);});
    return {label:c,data:vals,borderColor:col,backgroundColor:col+'22',tension:.3,fill:true,pointRadius:3,borderWidth:2};
  });
  chartCat = new Chart(canvas.getContext('2d'),{type:'line',data:{labels:labelsT,datasets:datasets},options:opts2});
}

// ─── ITEM TREND SUB-CHART ─────────────────────────────────

var chartItem = null;

function renderItemChips(chartDb, months, labelsT) {
  window._itemChartDb = chartDb;
  window._itemMonths  = months;
  window._itemLabels  = labelsT;
  if (!window._selItems) window._selItems = [];
  var section = document.getElementById('itemTrendSection');
  var drop    = document.getElementById('itemTrendDrop');
  if (!drop) return;

  var tracked = [];
  try { tracked = JSON.parse(localStorage.getItem('hf_tracked_items') || '[]'); } catch(e) {}

  if (!tracked.length) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = '';

  // กรอง tracked items ที่มีข้อมูลจริงใน chartDb
  drop.innerHTML = '<div style="padding:8px 10px;display:flex;flex-direction:column;gap:3px">'
    + tracked.map(function(item, i){
        var on  = window._selItems.indexOf(item.id) > -1;
        var col = PALETTE[i % PALETTE.length];
        return '<button data-iid="' + item.id.replace(/"/g,'&quot;') + '" data-col="' + col + '"'
          + ' onclick="toggleItemSel(\'' + item.id.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')"'
          + ' style="text-align:left;width:100%;background:' + (on ? col+'28' : 'transparent') + ';color:' + (on ? col : 'var(--ink)') + ';border:1px solid ' + (on ? col : 'transparent') + ';padding:8px 12px;border-radius:10px;font-size:13px;font-weight:' + (on ? 700 : 500) + ';cursor:pointer;font-family:Sarabun,sans-serif;display:flex;align-items:center;gap:8px">'
          + '<span style="width:8px;height:8px;border-radius:50%;background:' + col + ';flex-shrink:0"></span>' + item.name + '</button>';
      }).join('')
    + '</div>';

  _updateItemLabel();
  renderItemChart(chartDb, months, labelsT);
}

function _updateItemLabel() {
  var lbl = document.getElementById('itemTrendLabel');
  if (!lbl) return;
  var n = (window._selItems||[]).length;
  var tracked = [];
  try { tracked = JSON.parse(localStorage.getItem('hf_tracked_items') || '[]'); } catch(e) {}
  if (n === 0) lbl.innerHTML = 'เลือกรายการ ▾';
  else if (n === 1) { var sid0 = String(window._selItems[0]); var t = tracked.find(function(x){ return String(x.id) === sid0; }); lbl.innerHTML = (t ? t.name : sid0) + ' ▾'; }
  else lbl.innerHTML = n + ' รายการ ▾';
  lbl.classList.toggle('active', n > 0);
}

function toggleItemSel(itemId) {
  if (!window._selItems) window._selItems = [];
  var idx = window._selItems.indexOf(itemId);
  if (idx > -1) window._selItems.splice(idx, 1); else window._selItems.push(itemId);
  var drop = document.getElementById('itemTrendDrop');
  if (drop) drop.querySelectorAll('button[data-iid]').forEach(function(btn){
    var iid = btn.getAttribute('data-iid');
    var col = btn.getAttribute('data-col');
    var on  = window._selItems.indexOf(iid) > -1;
    btn.style.background = on ? col+'28' : 'transparent';
    btn.style.color      = on ? col : 'var(--ink)';
    btn.style.border     = '1px solid ' + (on ? col : 'transparent');
    btn.style.fontWeight = on ? '700' : '500';
  });
  _updateItemLabel();
  renderItemChart(window._itemChartDb, window._itemMonths, window._itemLabels);
}

function renderItemChart(chartDb, months, labelsT) {
  var canvas = document.getElementById('chartItem');
  var legend = document.getElementById('chartItemLegend');
  if (!canvas) return;
  if (chartItem) { chartItem.destroy(); chartItem = null; }
  if (!window._selItems || !window._selItems.length) {
    if (legend) legend.textContent = 'เลือกรายการด้านบนเพื่อดูแนวโน้ม';
    return;
  }
  if (legend) legend.textContent = '';
  var tracked = [];
  try { tracked = JSON.parse(localStorage.getItem('hf_tracked_items') || '[]'); } catch(e) {}
  var opts3 = {responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:true,position:'top',labels:{font:{size:9},usePointStyle:true,padding:8,boxWidth:8}}},
    scales:{y:{ticks:{callback:function(v){return typeof fmt==='function'?fmt(v):v;},font:{size:9}},grid:{color:'rgba(128,128,128,0.08)'},border:{dash:[3,3]}},
            x:{grid:{display:false},ticks:{font:{size:9}}}}};
  var datasets = window._selItems.map(function(itemId, i){
    var col  = PALETTE[i % PALETTE.length];
    var sid  = String(itemId);
    var info = tracked.find(function(t){ return String(t.id) === sid; }) || {};
    var vals = months.map(function(m){
      return chartDb.filter(function(e){
        return e.date.startsWith(m) && e.type==='expense' && isPaid(e)
          && (String(e.item_id) === sid || (info.name && e.desc === info.name));
      }).reduce(function(s,e){ return s+e.amt; }, 0);
    });
    return {label: info.name||sid, data:vals, borderColor:col, backgroundColor:col+'22', tension:.3, fill:true, pointRadius:3, borderWidth:2};
  });
  chartItem = new Chart(canvas.getContext('2d'),{type:'line',data:{labels:labelsT,datasets:datasets},options:opts3});
}

// ─── DASHBOARD BENTO MINI WIDGETS ────────────────────────

function renderDashNetworthCard() {
  var el = document.getElementById('networthCard');
  if (!el) return;
  var _uid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var active = (typeof accountsData !== 'undefined' ? accountsData : [])
    .filter(function(a){ return a.is_active !== false && (!_uid || !a.user_id || a.user_id === _uid); });
  var total = active.reduce(function(s, a){ return s + (typeof getAccountBalance === 'function' ? getAccountBalance(a.id) : 0); }, 0);
  var TYPE_ICON = { bank:'🏦', cash:'💵', ewallet:'📱' };
  var ACCT_TYPES = typeof ACCOUNT_TYPES !== 'undefined' ? ACCOUNT_TYPES : {};
  var _acctLogoFn = typeof acctLogoHtml === 'function' ? acctLogoHtml : null;
  if (!active.length) {
    el.innerHTML = '<div class="hf-card-title">มูลค่าสุทธิรวม</div>'
      +'<div style="flex:1;display:flex;align-items:center;justify-content:center">'
      +'<div class="empty" onclick="nav(\'accounts\')" style="cursor:pointer;text-align:center">ยังไม่มีบัญชี<br><span style="font-size:11px;color:var(--hf-accent)">+ เพิ่มบัญชี</span></div></div>';
    return;
  }
  // แสดงเป็น metric cards แนวนอน scroll ได้
  var acctCards = active.map(function(a){
    var bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.id) : 0;
    var logoNode = _acctLogoFn ? _acctLogoFn(a, 28) : '<span style="font-size:18px">'+(TYPE_ICON[a.type]||'💳')+'</span>';
    return '<div onclick="nav(\'accounts\')" style="cursor:pointer;min-width:0;'
      +'background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);padding:12px 14px;'
      +'border-top:3px solid '+a.color+'">'
      +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">'+logoNode
        +'<div style="font-size:11px;color:var(--ink3);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+a.name+'</div>'
      +'</div>'
      +'<div style="font-size:16px;font-weight:700;font-family:monospace;letter-spacing:-.5px;color:'+(bal>=0?'var(--hf-green)':'var(--hf-red)')+'">'+fmtH(bal)+'</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+(ACCT_TYPES[a.type]||a.type||'')+'</div>'
    +'</div>';
  }).join('');

  el.innerHTML =
    '<div class="hf-card-title">มูลค่าสุทธิรวม <span class="hf-link" onclick="nav(\'accounts\')">บัญชี →</span></div>'
    +'<div class="hf-mono" style="font-size:28px;font-weight:700;letter-spacing:-1.5px;color:'+(total>=0?'var(--hf-green)':'var(--hf-red)')+'">'+fmtH(total)+'</div>'
    +'<hr class="hf-divider" style="margin:10px 0 8px">'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px">'
    +acctCards
    +'</div>';
}

function renderDashBudgetMini() {
  var el = document.getElementById('dashBudgetMini');
  if (!el) return;
  // โหลด budget จาก localStorage ก่อนถ้ายังไม่ได้โหลด
  if (typeof _loadBudgetsNow === 'function') _loadBudgetsNow();
  var items = typeof budgetItems !== 'undefined' ? budgetItems : [];
  var mode = (typeof _budgetMode !== 'undefined' ? _budgetMode : null) || localStorage.getItem('hf2_budget_mode') || 'cycle';
  var modeTitleMap = { cycle: 'รอบเงินเดือน', calendar: 'ปฏิทิน' };
  var title = '<div class="hf-card-title">งบประมาณ <span style="font-size:11px;font-weight:400;color:var(--hf-ink3)">' + (modeTitleMap[mode]||mode) + '</span> <span class="hf-link" onclick="nav(\'budget\')">จัดการ →</span></div>';
  if (!items.length) {
    el.innerHTML = title + '<div class="empty" onclick="nav(\'budget\')" style="cursor:pointer">ยังไม่ได้ตั้งงบประมาณ</div>';
    return;
  }
  var actual = typeof getBudgetSpending === 'function' ? getBudgetSpending() : {};
  var rows = items.slice(0, 4).map(function(bi){
    var spent = bi.itemId
      ? ((actual._byItem || {})[bi.itemId] || 0)
      : (actual[bi.catId] || actual[bi.catName] || 0);
    var pct = bi.amount ? Math.min(100, Math.round(spent / bi.amount * 100)) : 0;
    var cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
    var label = (bi.catName||bi.catId||'—') + (bi.itemName ? ' <span style="color:var(--hf-ink3)">› '+bi.itemName+'</span>' : '');
    return '<div style="margin-bottom:12px">'
      +'<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">'
        +'<span style="font-weight:600">'+label+'</span>'
        +'<span class="hf-mono" style="font-size:11.5px;color:'+(cls==='over'?'var(--hf-red)':'var(--hf-ink2)')+'">'+fmtH(spent)+' / '+fmtH(bi.amount)+'</span>'
      +'</div>'
      +'<div class="hf-prog"><div class="hf-prog-fill '+cls+'" style="width:'+pct+'%"></div></div>'
    +'</div>';
  }).join('');
  el.innerHTML = title + rows + (items.length > 4 ? '<div style="font-size:11px;color:var(--hf-ink3);text-align:right">+' + (items.length-4) + ' หมวดอื่น</div>' : '');
}

function renderDashSettleMini(pendList) {
  var el = document.getElementById('dashSettleMini');
  if (!el) return;
  var now = new Date();
  var curM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var splitExp = db.filter(function(e){
    return e.date.startsWith(curM) && e.type==='expense' && isPaid(e) && e.split;
  });
  var title = '<div class="hf-card-title">สรุป Settlement <span class="hf-link" onclick="nav(\'settlement\')">ดูทั้งหมด →</span></div>';

  if (!splitExp.length) {
    el.innerHTML = title
      +'<div style="text-align:center;padding:20px 0">'
        +'<div style="font-size:28px;margin-bottom:6px">✅</div>'
        +'<div style="font-size:13px;color:var(--hf-green);font-weight:600">ไม่มียอดค้างชำระ</div>'
      +'</div>';
    return;
  }

  // คำนวณ balances เหมือน settlement.js (simplified)
  var nameMap = (typeof _buildNameMap === 'function') ? _buildNameMap() : {};
  if (!Object.keys(nameMap).length && typeof persons !== 'undefined') {
    persons.forEach(function(p){ nameMap[p.user_id||p.id] = p.name||p.id; });
  }
  var paid = {}, owed = {};
  var _myUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  if (_myUid) paid[_myUid] = owed[_myUid] = 0;
  if (typeof persons !== 'undefined') {
    persons.forEach(function(p){ var u=p.user_id||p.id; paid[u]=paid[u]||0; owed[u]=owed[u]||0; });
  }
  splitExp.forEach(function(e){
    var pu = e.user_id || e.person;
    paid[pu] = (paid[pu]||0) + e.amt;
    if (e.split_snapshot && Object.keys(e.split_snapshot).length) {
      Object.keys(e.split_snapshot).forEach(function(u){ owed[u]=(owed[u]||0)+(e.split_snapshot[u].amount||0); });
    } else {
      var n = (typeof persons!=='undefined'&&persons.length) ? persons.length : 2;
      var sh = e.amt/n;
      (typeof persons!=='undefined'?persons:[]).forEach(function(p){ var u=p.user_id||p.id; owed[u]=(owed[u]||0)+sh; });
    }
  });
  var allUids = Object.keys(paid).concat(Object.keys(owed)).filter(function(v,i,a){return a.indexOf(v)===i;});
  var balances = {};
  allUids.forEach(function(u){ balances[u]=(paid[u]||0)-(owed[u]||0); });
  var transfers = (typeof _computeTransfers==='function') ? _computeTransfers(Object.assign({},balances),nameMap) : [];

  var totalSplit = splitExp.reduce(function(s,e){ return s+e.amt; }, 0);
  var body = '<div style="font-size:11px;color:var(--ink3);margin-bottom:8px">'
    +'ค่าใช้จ่ายร่วม <strong class="hf-mono" style="color:var(--amber,#f59e0b)">'+fmtH(totalSplit)+'</strong> · '+splitExp.length+' รายการ</div>';

  if (!transfers.length) {
    body += '<div style="background:var(--green-bg,#f0fdf4);border:1px solid var(--green);border-radius:10px;padding:12px;text-align:center">'
      +'<div style="font-size:13px;font-weight:700;color:var(--green)">✅ เรียบร้อยแล้ว</div></div>';
  } else {
    body += transfers.map(function(t){
      var fi = (t.from||'?').charAt(0).toUpperCase();
      var ti = (t.to||'?').charAt(0).toUpperCase();
      return '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)">'
        // FROM circle
        +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">'
          +'<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#f97316);'
            +'display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;'
            +'box-shadow:0 3px 10px rgba(220,38,38,.4)">'+fi+'</div>'
          +'<span style="font-size:10px;font-weight:600;color:var(--ink);max-width:56px;text-align:center;'
            +'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.from+'</span>'
        +'</div>'
        // arrow + amount
        +'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">'
          +'<span style="font-family:monospace;font-size:14px;font-weight:800;color:var(--orange,#ea580c)">'+fmtH(t.amount)+'</span>'
          +'<div style="display:flex;align-items:center;width:100%;gap:0">'
            +'<div style="flex:1;height:2px;background:linear-gradient(90deg,#dc2626,#ea580c,#16a34a)"></div>'
            +'<span style="font-size:14px;color:var(--green,#16a34a);line-height:1">▶</span>'
          +'</div>'
          +'<span style="font-size:9px;color:var(--ink3);letter-spacing:.4px">โอนให้</span>'
        +'</div>'
        // TO circle
        +'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">'
          +'<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#16a34a,#22c55e);'
            +'display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#fff;'
            +'box-shadow:0 3px 10px rgba(22,163,74,.4)">'+ti+'</div>'
          +'<span style="font-size:10px;font-weight:600;color:var(--ink);max-width:56px;text-align:center;'
            +'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.to+'</span>'
        +'</div>'
      +'</div>';
    }).join('');
    // remove last border
    body = body.replace(/border-bottom:1px solid var\(--line\)">[^<]*<\/div>\s*$/, function(m){ return m.replace('border-bottom:1px solid var(--line)','border-bottom:none'); });
  }
  el.innerHTML = title + body;
}

function renderDashSavingsMini() {
  var el = document.getElementById('dashSavingsMini');
  if (!el) return;
  var goals = typeof savingsGoals !== 'undefined' ? savingsGoals : [];
  var title = '<div class="hf-card-title">เป้าหมายออม <span class="hf-link" onclick="nav(\'savings\')">ดู →</span></div>';
  if (!goals.length) {
    el.innerHTML = title+'<div class="empty" onclick="nav(\'savings\')" style="cursor:pointer">ยังไม่มีเป้าหมายออม<br><span style="font-size:11px;color:var(--hf-accent)">+ ตั้งเป้าหมาย</span></div>';
    return;
  }
  var totalSaved = goals.reduce(function(s,g){ return s+(g.current_amount||0); }, 0);
  var rows = goals.slice(0,3).map(function(g){
    var pct = g.target_amount ? Math.min(100,Math.round((g.current_amount||0)/g.target_amount*100)) : 0;
    return '<div class="hf-row" style="padding:8px 0">'
      +'<div style="width:38px;height:38px;border-radius:50%;flex-shrink:0;'
        +'background:conic-gradient(var(--hf-accent) '+( pct*3.6)+'deg, rgba(92,104,158,.16) 0);'
        +'display:flex;align-items:center;justify-content:center">'
        +'<div style="width:26px;height:26px;border-radius:50%;background:var(--hf-g-card,#fff);'
          +'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:9px" class="hf-mono">'+pct+'%</div>'
      +'</div>'
      +'<div class="hf-row-main">'
        +'<div class="hf-row-name" style="font-size:13px">'+g.name+'</div>'
        +'<div class="hf-row-meta hf-mono">'+fmtH(g.current_amount||0)+' / '+fmtH(g.target_amount||0)+'</div>'
      +'</div>'
    +'</div>';
  }).join('');
  el.innerHTML = title
    +'<div style="font-size:11px;color:var(--hf-ink3);margin-bottom:6px">ออมรวม <span class="hf-mono" style="font-weight:700;color:var(--hf-ink)">'+fmtH(totalSaved)+'</span></div>'
    +rows
    +(goals.length>3 ? '<div style="font-size:11px;color:var(--hf-ink3);text-align:center;margin-top:4px">+' + (goals.length-3) + ' เป้าหมายอื่น</div>' : '');
}

function renderAddFavCats() {
  var el = document.getElementById('addFavCats');
  if (!el) return;
  var cats = typeof categories !== 'undefined' ? categories.filter(function(c){ return c.type==='expense'; }).slice(0,8) : [];
  if (!cats.length) { el.innerHTML = '<div style="font-size:12px;color:var(--hf-ink3)">—</div>'; return; }
  el.innerHTML = cats.map(function(c){
    return '<span onclick="(function(){var s=document.getElementById(\'fCat\');if(s){s.value=\''+c.id+'\';onCatChange();}})()" '
      +'style="padding:6px 12px;border-radius:20px;background:var(--surface2);border:1px solid var(--line);font-size:12px;font-weight:600;cursor:pointer;display:inline-block">'
      +c.name+'</span>';
  }).join('');
}

// ─── DASHBOARD DRAG-TO-REORDER ────────────────────────────
var _dashDragInit = false;
var _dashDragSrc  = null;

function initDashDrag() {
  var grid = document.querySelector('#page-dashboard .hf-dash-grid');
  if (!grid || _dashDragInit) return;
  _dashDragInit = true;

  // Restore saved order
  _dashRestoreOrder(grid);

  // Init each draggable card
  Array.from(grid.querySelectorAll('[data-dash-id]')).forEach(function(card) {
    _dashInitCard(card, grid);
  });
}

function _dashRestoreOrder(grid) {
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem('hf2_dash_order') || '[]'); } catch(_) {}
  if (!saved.length) return;
  // Move cards in saved order (append to grid in sequence)
  saved.forEach(function(id) {
    var el = grid.querySelector('[data-dash-id="'+id+'"]');
    if (el) grid.appendChild(el);
  });
}

function _dashSaveOrder(grid) {
  var order = Array.from(grid.querySelectorAll('[data-dash-id]')).map(function(c) {
    return c.dataset.dashId;
  });
  localStorage.setItem('hf2_dash_order', JSON.stringify(order));
}

function _dashInitCard(card, grid) {
  card.setAttribute('draggable', 'true');

  card.addEventListener('dragstart', function(e) {
    _dashDragSrc = card;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.dashId);
    setTimeout(function() {
      card.style.opacity = '0.45';
      card.style.outline = '2px dashed var(--accent)';
    }, 0);
  });

  card.addEventListener('dragend', function() {
    card.style.opacity = '';
    card.style.outline = '';
    _dashDragSrc = null;
    grid.querySelectorAll('[data-dash-id]').forEach(function(c) {
      c.classList.remove('dd-over');
    });
    _dashSaveOrder(grid);
  });

  card.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  });

  card.addEventListener('dragenter', function(e) {
    e.preventDefault();
    if (_dashDragSrc && card !== _dashDragSrc) card.classList.add('dd-over');
  });

  card.addEventListener('dragleave', function(e) {
    // ตรวจว่า mouse ออกจาก card จริงๆ (ไม่ใช่ child element)
    if (!card.contains(e.relatedTarget)) card.classList.remove('dd-over');
  });

  card.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    card.classList.remove('dd-over');
    if (!_dashDragSrc || card === _dashDragSrc) return;
    // วางก่อนหรือหลัง card ปลายทาง โดยดูจากตำแหน่ง mouse
    var rect = card.getBoundingClientRect();
    var midY = rect.top + rect.height / 2;
    var midX = rect.left + rect.width / 2;
    var after = e.clientY > midY || (e.clientY === midY && e.clientX > midX);
    if (after) {
      grid.insertBefore(_dashDragSrc, card.nextSibling);
    } else {
      grid.insertBefore(_dashDragSrc, card);
    }
    _dashSaveOrder(grid);
    return false;
  });
}

/** รีเซ็ต order กลับค่าเริ่มต้น */
function resetDashOrder() {
  localStorage.removeItem('hf2_dash_order');
  _dashDragInit = false;
  location.reload();
}

