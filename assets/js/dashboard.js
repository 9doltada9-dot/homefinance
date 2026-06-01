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

  var _myUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _dashDb = _myUid ? db.filter(function(e){ return (e.user_id||e.person) === _myUid; }) : db;
  var me = _dashDb.filter(function(e){ return e.date.startsWith(curM); });
  var inc = me.filter(function(e){return e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var exp = me.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
  var pIn = me.filter(function(e){return e.type==='income'&&e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var pOut = me.filter(function(e){return e.type==='expense'&&e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
  var bal = inc-exp;
  document.getElementById('metrics').innerHTML=
    '<div class="hf-card"><div class="hf-metric-label">รายรับ</div><div class="hf-metric-val g">'+fmtH(inc)+'</div><div class="hf-metric-sub">บาท · รับแล้ว</div></div>'+
    '<div class="hf-card"><div class="hf-metric-label">รายจ่าย</div><div class="hf-metric-val r">'+fmtH(exp)+'</div><div class="hf-metric-sub">บาท · จ่ายแล้ว</div></div>'+
    '<div class="hf-card"><div class="hf-metric-label">คงเหลือ</div><div class="hf-metric-val '+(bal>=0?'g':'r')+'">'+fmtH(bal)+'</div><div class="hf-metric-sub">บาท</div></div>'+
    '<div class="hf-card"><div class="hf-metric-label">รอดำเนินการ</div><div class="hf-metric-val a">'+fmtH(pIn+pOut)+'</div><div class="hf-metric-sub">'+(pIn>0?'รับ '+fmtH(pIn)+' ':'')+( pOut>0?'จ่าย '+fmtH(pOut):'ไม่มี')+'</div></div>';
  switchChart('trend', curM);
  // Recent & Pending for selected month
  // เรียง: วันที่ล่าสุดก่อน → ภายในวันเดียวกันเรียงตาม id (= Date.now() ตอนบันทึก) ล่าสุดก่อน
  var _dbFiltered = _dashDb.slice().sort(function(a, b){
    if(a.date > b.date) return -1;
    if(a.date < b.date) return 1;
    return Number(b.id) - Number(a.id);
  });
  var _recentPool = (curM === thisM ? _dbFiltered : _dbFiltered.filter(function(e){return e.date.startsWith(curM);}))
    .filter(function(e){ return e.status !== 'pending'; });
  var recent = _recentPool.slice(0,6);
  document.getElementById('recentTx').innerHTML=recent.length?'<table class="hf-table"><tr><th>วันที่</th><th>รายการ</th><th style="text-align:right">จำนวน (บาท)</th><th>สถานะ</th></tr>'+recent.map(function(e){return '<tr>'+
    '<td style="font-size:12px;color:var(--ink3);white-space:nowrap">'+toThaiDateShort(e.date)+'</td>'+
    '<td>'+e.desc+' <span class="badge '+(e.type==='income'?'badge-income':e.type==='transfer'?'badge-transfer':'badge-expense')+'" style="font-size:10px">'+(e.type==='income'?'รายรับ':e.type==='transfer'?'⇄ โอน':'รายจ่าย')+'</span>'+(e.note?'<div style="font-size:10px;color:var(--ink3);font-style:italic">📝 '+e.note+'</div>':'')+
    '</td>'+
    '<td style="text-align:right;font-family:monospace;color:'+(e.type==='income'?'var(--green)':e.type==='transfer'?'var(--blue)':'var(--red)')+'">'+fmtH(e.amt)+'</td>'+
    '<td><span class="badge '+(isPaid(e)?'badge-paid':'badge-pending')+'" style="font-size:10px">'+(e.type==='transfer'?(isPaid(e)?'โอนแล้ว':'รอโอน'):(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย')))+'</span></td>'+
    '</tr>';}).join('')+'</table>':'<div class="empty">ยังไม่มีรายการ</div>';
  var pend=_dbFiltered.filter(function(e){return e.status==='pending';});
  renderSalaryCycleCard();
  renderDashNetworthCard();
  renderDashBudgetMini();
  renderDashSettleMini(pend);
  renderDashSavingsMini();
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
        '<div style="font-size:11px;font-weight:700;color:var(--blue,#1a4fa0);letter-spacing:.3px;text-transform:uppercase">💼 รอบเงินเดือน</div>'+
        '<div style="font-size:13px;font-weight:600;color:var(--ink);margin-top:1px">'+cycle.label+'</div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink2);background:var(--surface2);padding:4px 12px;border-radius:20px;font-weight:600;flex-shrink:0">'+
        (dayLeft===0?'<span style="color:#f87171">สิ้นสุดวันนี้</span>':'เหลืออีก <b>'+dayLeft+'</b> วัน')+
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
        '<div style="height:100%;width:'+progressPct+'%;background:var(--blue,#1a4fa0);border-radius:3px;transition:width .5s"></div>'+
      '</div>'+
    '</div>'+
    // ── 4-metric grid (2×2)
    '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">'+
      '<div style="background:var(--surface2);border-radius:12px;padding:12px 10px">'+
        '<div style="font-size:10px;color:var(--ink3);margin-bottom:4px">💰 รายรับ</div>'+
        '<div style="font-size:18px;font-weight:800;color:#4ade80;font-family:monospace;letter-spacing:-0.5px">'+fmtH(received)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">รับแล้ว</div>'+
      '</div>'+
      '<div style="background:var(--surface2);border-radius:12px;padding:12px 10px">'+
        '<div style="font-size:10px;color:var(--ink3);margin-bottom:4px">💸 รายจ่าย</div>'+
        '<div style="font-size:18px;font-weight:800;color:#f87171;font-family:monospace;letter-spacing:-0.5px">'+fmtH(totalExp)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">จ่ายแล้ว</div>'+
      '</div>'+
      '<div style="background:var(--surface2);border-radius:12px;padding:12px 10px;'+(remain<0?'border:1px solid #f87171;':'')+'">'+
        '<div style="font-size:10px;color:var(--ink3);margin-bottom:4px">💵 คงเหลือ</div>'+
        '<div style="font-size:18px;font-weight:800;color:'+(remain>=0?'#4ade80':'#f87171')+';font-family:monospace;letter-spacing:-0.5px">'+fmtH(remain)+'</div>'+
        '<div style="font-size:9px;color:var(--ink3);margin-top:2px">สุทธิรอบนี้</div>'+
      '</div>'+
      '<div style="background:'+(pending>0?'rgba(251,191,36,.1)':'var(--surface2)')+';border-radius:12px;padding:12px 10px;'+(pending>0?'border:1px solid rgba(251,191,36,.4);':'')+'">'+
        '<div style="font-size:10px;color:'+(pending>0?'#b5600a':'var(--ink3)')+';margin-bottom:4px">⏳ รอรับ</div>'+
        '<div style="font-size:18px;font-weight:800;color:'+(pending>0?'#fbbf24':'var(--ink3)')+';font-family:monospace;letter-spacing:-0.5px">'+fmtH(pending)+'</div>'+
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
        '<div style="height:100%;width:'+spendPct+'%;border-radius:4px;transition:width .5s;background:'+(spendPct>=90?'#f87171':spendPct>=70?'#fbbf24':'#4ade80')+'"></div>'+
      '</div>'+
    '</div>'
    : '')+
    // ── Pending salary entries
    (pendList.length ?
    '<div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.4);border-radius:10px;padding:10px 12px;margin-bottom:2px">'+
      '<div style="font-size:11px;font-weight:700;color:#b5600a;margin-bottom:6px">⏳ รอรับ — เปิดใช้วันที่ '+SALARY_DAY+'</div>'+
      pendList.map(function(e){ return '<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid rgba(240,195,106,.25)">'+
        '<span>'+e.desc+'</span>'+
        '<span style="font-family:monospace;font-weight:700;color:#fbbf24">'+fmtH(e.amt)+'</span>'+
      '</div>'; }).join('')+
      '<button onclick="activateSalaryNow()" style="margin-top:10px;width:100%;background:var(--blue,#1a4fa0);color:#fff;border:none;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun,sans-serif;touch-action:manipulation">✓ ยืนยันรับเงินทันที</button>'+
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
  var curMonth = passedMonth || document.getElementById('dashMonth')?.value || thisM;
  var _myUidC = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _chartDb = _myUidC ? db.filter(function(e){ return (e.user_id||e.person) === _myUidC; }) : db;
  var me = _chartDb.filter(function(e){return e.date.startsWith(curMonth);});
  var canvas = document.getElementById('chartMain');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');

  var opts = {responsive:true,maintainAspectRatio:false,
    plugins:{legend:{display:false}},
    scales:{y:{ticks:{callback:function(v){return fmt(v);},font:{size:10}},grid:{color:'rgba(128,128,128,0.08)'},border:{dash:[4,4]}},
            x:{grid:{display:false},ticks:{font:{size:10}}}}};

  if(type==='bar'){
    // รายรับ vs รายจ่ายแยกคน — ใช้ _allProfiles (UUID) เป็น source
    var _cu = _getChartUsers();
    var labels = _cu.map(function(u){ return u.name+'\n(รับ)'; }).concat(['รายจ่าย\nรวม']);
    var _incColors = ['#4ade80','#86efac','#60a5fa','#f472b6','#a78bfa'];
    var bgColors   = _cu.map(function(_,i){ return _incColors[i]||PALETTE[i]; }).concat(['#f87171']);
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
    // แนวโน้ม 6 เดือนย้อนหลัง
    var months=[];
    for(var i=5;i>=0;i--){
      var d=new Date(now.getFullYear(), now.getMonth()-i, 1);
      months.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    }
    var incVals = months.map(function(m){return _chartDb.filter(function(e){return e.date.startsWith(m)&&e.type==='income'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);});
    var expVals = months.map(function(m){return _chartDb.filter(function(e){return e.date.startsWith(m)&&e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);});
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
    var _cu2 = _getChartUsers();
    var _expColors = ['rgba(74,222,128,.8)','rgba(96,165,250,.8)','rgba(244,114,182,.8)','rgba(251,191,36,.8)'];
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
          {label:'เสร็จแล้ว',data:[incPaid,expPaid],backgroundColor:['rgba(74,222,128,.85)','rgba(248,113,113,.85)'],borderRadius:4,borderWidth:0},
          {label:'รอดำเนินการ',data:[incPend,expPend],backgroundColor:['rgba(248,189,71,.85)','rgba(251,146,60,.85)'],borderRadius:4,borderWidth:0},
        ]
      },
      options:Object.assign({}, opts, {plugins:{legend:{display:true,position:'top',labels:{font:{size:10},usePointStyle:true,padding:10}}},scales:Object.assign({}, opts.scales, {x:{stacked:false,grid:{display:false},ticks:{font:{size:11}}},y:Object.assign({stacked:false}, opts.scales.y)})})
    });
  }
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
  if (!active.length) {
    el.innerHTML = '<div class="hf-card-title">มูลค่าสุทธิรวม</div>'
      +'<div style="flex:1;display:flex;align-items:center;justify-content:center">'
      +'<div class="empty" onclick="nav(\'accounts\')" style="cursor:pointer;text-align:center">ยังไม่มีบัญชี<br><span style="font-size:11px;color:var(--hf-accent)">+ เพิ่มบัญชี</span></div></div>';
    return;
  }
  el.innerHTML =
    '<div class="hf-card-title">มูลค่าสุทธิรวม</div>'
    +'<div class="hf-mono" style="font-size:32px;font-weight:700;letter-spacing:-1.5px;color:'+(total>=0?'var(--hf-green)':'var(--hf-red)')+'">'+fmtH(total)+'</div>'
    +'<hr class="hf-divider">'
    +'<div style="font-size:11px;color:var(--hf-ink3);font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">บัญชีทั้งหมด</div>'
    +'<div style="flex:1;overflow-y:auto">'
    +active.map(function(a){
      var bal = typeof getAccountBalance === 'function' ? getAccountBalance(a.id) : 0;
      var icon = TYPE_ICON[a.type] || '💳';
      return '<div class="hf-row" onclick="nav(\'accounts\')" style="padding:9px 0;cursor:pointer">'
        +'<div style="width:9px;height:9px;border-radius:50%;background:'+a.color+';flex-shrink:0;margin-top:2px"></div>'
        +'<div class="hf-row-main"><div class="hf-row-name" style="font-size:13px">'+icon+' '+a.name+'</div>'
        +'<div class="hf-row-meta">'+(ACCT_TYPES[a.type]||a.type||'')+'</div></div>'
        +'<div class="hf-row-amt" style="font-size:13px;color:'+(bal>=0?'var(--hf-green)':'var(--hf-red)')+'">'+fmtH(bal)+'</div>'
        +'</div>';
    }).join('')
    +'</div>'
    +'<button class="hf-btn" onclick="nav(\'accounts\')" style="margin-top:12px;width:100%;justify-content:center;font-size:12px">บัญชีทั้งหมด →</button>';
}

function renderDashBudgetMini() {
  var el = document.getElementById('dashBudgetMini');
  if (!el) return;
  var items = typeof budgetItems !== 'undefined' ? budgetItems : [];
  var title = '<div class="hf-card-title">งบประมาณเดือนนี้ <span class="hf-link" onclick="nav(\'budget\')">จัดการ →</span></div>';
  if (!items.length) {
    el.innerHTML = title+'<div class="empty" onclick="nav(\'budget\')" style="cursor:pointer">ยังไม่ได้ตั้งงบประมาณ</div>';
    return;
  }
  var actual = typeof getBudgetSpending === 'function' ? getBudgetSpending() : {};
  var rows = items.slice(0, 4).map(function(bi){
    var spent = actual[bi.catId] || actual[bi.catName] || 0;
    var pct = bi.amount ? Math.min(100, Math.round(spent / bi.amount * 100)) : 0;
    var cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
    return '<div style="margin-bottom:12px">'
      +'<div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">'
        +'<span style="font-weight:600">'+(bi.catName||bi.catId||'—')+'</span>'
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
  var pend = pendList || [];
  var pendAmt = pend.reduce(function(s,e){ return s+(e.amt||0); }, 0);
  var now = new Date();
  var curM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var splitExp = db.filter(function(e){
    return e.date.startsWith(curM) && e.type==='expense' && isPaid(e) && e.split;
  });
  var title = '<div class="hf-card-title">ยอดหารร่วม <span class="hf-link" onclick="nav(\'settlement\')">ดู →</span></div>';
  if (!splitExp.length && !pend.length) {
    el.innerHTML = title+'<div style="text-align:center;padding:16px 0"><div style="font-size:20px;margin-bottom:4px">✓</div><div style="font-size:13px;color:var(--hf-green);font-weight:600">ไม่มียอดหาร</div></div>'
      +'<button class="hf-btn" onclick="nav(\'settlement\')" style="width:100%;justify-content:center;font-size:12px;margin-top:8px">Settlement →</button>';
    return;
  }
  var totalSplit = splitExp.reduce(function(s,e){ return s+e.amt; }, 0);
  var body = '';
  if (splitExp.length) {
    body += '<div style="margin-bottom:10px">'
      +'<div style="font-size:11px;color:var(--hf-ink3)">ค่าใช้จ่ายร่วมเดือนนี้</div>'
      +'<div class="hf-mono" style="font-size:24px;font-weight:700;letter-spacing:-1px;color:var(--hf-amber)">'+fmtH(totalSplit)+'</div>'
      +'<div style="font-size:11px;color:var(--hf-ink3);margin-top:2px">'+splitExp.length+' รายการ · หารคนละ ~'+fmtH(Math.round(totalSplit/2))+'</div>'
    +'</div>';
  }
  if (pend.length) {
    body += '<div style="font-size:11px;color:var(--hf-amber);font-weight:600;margin-bottom:6px">⏳ รอดำเนินการ '+pend.length+' รายการ · '+fmtH(pendAmt)+'</div>';
  }
  body += '<button class="hf-btn hf-btn-primary" onclick="nav(\'settlement\')" style="width:100%;justify-content:center;font-size:12px">Settlement →</button>';
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

