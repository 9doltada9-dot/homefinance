/* HomeFinance · module: monthly.js · v3.1.0 */

var _monthlyChart  = null;
var _monthlySelCats  = [];   // selected category names
var _monthlySelItems = [];   // selected item desc names
var _monthlyActiveTab = 'donut';
var _monthlyCurM = '';

// ─── MAIN RENDER ─────────────────────────────────────────────
function renderMonthly() {
  var m = document.getElementById('monthSel').value;
  if (!m) {
    document.getElementById('monthlyContent').innerHTML = '<div class="empty">เลือกเดือน</div>';
    return;
  }

  // reset state on month change
  _monthlyCurM    = m;
  _monthlySelCats  = [];
  _monthlySelItems = [];
  _monthlyActiveTab = 'donut';

  var me = db.filter(function(e) { return e.date.startsWith(m); });
  var incPaid = me.filter(function(e) { return e.type==='income'  && isPaid(e); }).reduce(function(s,e) { return s+e.amt; }, 0);
  var expPaid = me.filter(function(e) { return e.type==='expense' && isPaid(e); }).reduce(function(s,e) { return s+e.amt; }, 0);
  var bal = incPaid - expPaid;

  // expense by category (for table + chips)
  var byCat = {};
  me.filter(function(e) { return e.type==='expense' && isPaid(e); }).forEach(function(e) {
    var k = e.cat_name || '—';
    byCat[k] = (byCat[k] || 0) + e.amt;
  });
  var catEntries = Object.entries(byCat).sort(function(a,b) { return b[1]-a[1]; });

  var incomeBlock = _buildIncomeBlock(me);
  var hasExp = catEntries.length > 0;

  document.getElementById('monthlyContent').innerHTML =
    // ── metrics row
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px">' +
      '<div class="hf-card"><div class="hf-metric-label">รายรับรวม</div><div class="hf-metric-val g">'   + fmtH(incPaid) + '</div><div class="hf-metric-sub">บาท</div></div>' +
      '<div class="hf-card"><div class="hf-metric-label">รายจ่ายรวม</div><div class="hf-metric-val r">'  + fmtH(expPaid) + '</div><div class="hf-metric-sub">บาท</div></div>' +
      '<div class="hf-card"><div class="hf-metric-label">คงเหลือ</div><div class="hf-metric-val '+(bal>=0?'g':'r')+'">' + fmtH(bal) + '</div><div class="hf-metric-sub">บาท</div></div>' +
    '</div>' +

    // ── chart card (show only when there's expense data)
    (hasExp ?
    '<div class="hf-card" style="margin-bottom:16px">' +
      // header + tabs
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">' +
        '<div class="hf-card-title" style="margin:0">แผนภูมิรายจ่าย</div>' +
        '<div style="display:flex;gap:0;border-radius:10px;overflow:hidden;border:1px solid var(--line)">' +
          _mTab('donut', '🥧 สัดส่วน',  true)  +
          _mTab('bar',   '📊 หมวด',      false) +
          _mTab('item',  '📋 รายการ',    false) +
        '</div>' +
      '</div>' +
      // category filter chips
      '<div id="monthlyCatChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px"></div>' +
      // item filter (visible when item tab active)
      '<div id="monthlyItemFilter" style="display:none;margin-bottom:10px">' +
        '<div style="font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">เลือกรายการที่ต้องการ</div>' +
        '<div id="monthlyItemChips" style="display:flex;flex-wrap:wrap;gap:5px"></div>' +
      '</div>' +
      // canvas
      '<div style="position:relative;height:220px"><canvas id="monthlyChartCanvas"></canvas></div>' +
      '<div id="monthlyChartLegend" style="font-size:11px;color:var(--ink3);text-align:center;margin-top:6px"></div>' +
    '</div>'
    : '') +

    // ── detail tables
    '<div class="grid2">' +
      '<div class="hf-card">' +
        '<div class="hf-card-title">รายจ่ายแยกหมวด</div>' +
        (hasExp
          ? '<table class="hf-table"><tr><th>หมวดหมู่</th><th style="text-align:right">จำนวน</th><th style="text-align:right">%</th></tr>' +
            catEntries.map(function(pair) {
              var cat = pair[0], amt = pair[1];
              return '<tr><td>' + cat + '</td>' +
                '<td style="text-align:right;font-family:monospace">' + fmtH(amt) + '</td>' +
                '<td style="text-align:right"><div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">' +
                  '<div style="height:4px;width:' + Math.round((amt/expPaid)*60) + 'px;background:var(--hf-accent);border-radius:2px;min-width:4px"></div>' +
                  '<span style="font-size:12px;color:var(--hf-ink3)">' + (expPaid ? ((amt/expPaid)*100).toFixed(1) : 0) + '%</span>' +
                '</div></td></tr>';
            }).join('') + '</table>'
          : '<div class="empty">ไม่มีรายจ่าย</div>') +
      '</div>' +
      '<div class="hf-card">' +
        '<div class="hf-card-title">รายรับแยกประเภท</div>' +
        incomeBlock +
      '</div>' +
    '</div>';

  if (hasExp) {
    _buildMonthlyCatChips(catEntries);
    _renderMonthlyChart('donut');
  }
}

// helper: tab button HTML
function _mTab(type, label, active) {
  return '<button id="mct-' + type + '" onclick="switchMonthlyChart(\'' + type + '\')"'
    + ' class="chart-tab' + (active ? ' active' : '') + '"'
    + ' style="padding:6px 12px;font-size:11.5px;font-weight:600;border:none;cursor:pointer;'
    + 'font-family:Sarabun,sans-serif;background:' + (active ? 'var(--hf-accent)' : 'transparent') + ';'
    + 'color:' + (active ? '#fff' : 'var(--ink2)') + ';transition:all .15s">'
    + label + '</button>';
}

// helper: income breakdown table
function _buildIncomeBlock(me) {
  var incCat = {};
  me.filter(function(e) { return e.type==='income' && isPaid(e); }).forEach(function(e) {
    var k = e.cat_name || 'อื่นๆ';
    incCat[k] = (incCat[k] || 0) + e.amt;
  });
  var ic = Object.entries(incCat).sort(function(a,b) { return b[1]-a[1]; });
  return ic.length
    ? '<table><tr><th>ประเภท</th><th style="text-align:right">จำนวน</th></tr>' +
      ic.map(function(pair) {
        return '<tr><td>' + pair[0] + '</td><td style="text-align:right;font-family:monospace;color:var(--green)">' + fmtH(pair[1]) + '</td></tr>';
      }).join('') + '</table>'
    : '<div class="empty">ไม่มีรายรับ</div>';
}

// ─── CATEGORY CHIPS ──────────────────────────────────────────
function _buildMonthlyCatChips(catEntries) {
  var el = document.getElementById('monthlyCatChips');
  if (!el || !catEntries.length) return;

  var chips = catEntries.map(function(pair, i) {
    var cat = pair[0];
    var col = PALETTE[i % PALETTE.length];
    var on  = _monthlySelCats.indexOf(cat) > -1;
    return '<button onclick="monthlyToggleCat(\'' + cat.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')"'
      + ' data-cat="' + cat.replace(/"/g,'&quot;') + '" data-col="' + col + '"'
      + ' style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:12px;'
      + 'cursor:pointer;font-family:Sarabun,sans-serif;transition:all .15s;'
      + 'background:' + (on ? col+'28' : 'transparent') + ';color:' + (on ? col : 'var(--ink2)') + ';'
      + 'border:1px solid ' + (on ? col : 'var(--line)') + ';font-weight:' + (on ? 700 : 500) + '">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:' + col + ';flex-shrink:0"></span>'
      + cat + '</button>';
  }).join('');

  // "ทุกหมวด" pill
  var allOn = !_monthlySelCats.length;
  var allBtn = '<button id="mcat-all" onclick="monthlyToggleCat(\'__all__\')"'
    + ' style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;'
    + 'font-family:Sarabun,sans-serif;transition:all .15s;border:none;'
    + 'background:' + (allOn ? 'var(--hf-accent)' : 'var(--surface2)') + ';'
    + 'color:' + (allOn ? '#fff' : 'var(--ink2)') + '">ทุกหมวด</button>';

  el.innerHTML = allBtn + chips;
}

function monthlyToggleCat(cat) {
  if (cat === '__all__') {
    _monthlySelCats  = [];
    _monthlySelItems = [];
  } else {
    var idx = _monthlySelCats.indexOf(cat);
    if (idx > -1) _monthlySelCats.splice(idx, 1);
    else _monthlySelCats.push(cat);
    _monthlySelItems = []; // reset items when cats change
  }

  // update chip styles (no full rebuild)
  var el = document.getElementById('monthlyCatChips');
  if (el) {
    var allOn = !_monthlySelCats.length;
    var allBtn = document.getElementById('mcat-all');
    if (allBtn) {
      allBtn.style.background = allOn ? 'var(--hf-accent)' : 'var(--surface2)';
      allBtn.style.color      = allOn ? '#fff' : 'var(--ink2)';
    }
    el.querySelectorAll('button[data-cat]').forEach(function(btn) {
      var bc  = btn.getAttribute('data-cat');
      var col = btn.getAttribute('data-col');
      var on  = _monthlySelCats.indexOf(bc) > -1;
      btn.style.background  = on ? col+'28' : 'transparent';
      btn.style.color       = on ? col : 'var(--ink2)';
      btn.style.border      = '1px solid ' + (on ? col : 'var(--line)');
      btn.style.fontWeight  = on ? '700' : '500';
    });
  }

  _renderMonthlyChart(_monthlyActiveTab);
  if (_monthlyActiveTab === 'item') _buildMonthlyItemChips();
}

// ─── ITEM CHIPS ───────────────────────────────────────────────
function _buildMonthlyItemChips() {
  var el = document.getElementById('monthlyItemChips');
  if (!el) return;

  var me = db.filter(function(e) {
    return e.date.startsWith(_monthlyCurM)
      && e.type === 'expense' && isPaid(e)
      && (_monthlySelCats.length === 0 || _monthlySelCats.indexOf(e.cat_name || '—') > -1);
  });

  var byDesc = {};
  me.forEach(function(e) { var k = e.desc || '—'; byDesc[k] = (byDesc[k]||0)+e.amt; });
  var items = Object.entries(byDesc).sort(function(a,b) { return b[1]-a[1]; }).slice(0, 16);

  if (!items.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--ink3)">ไม่มีรายการ</div>';
    return;
  }

  el.innerHTML = items.map(function(pair, i) {
    var name = pair[0];
    var col  = PALETTE[i % PALETTE.length];
    var on   = _monthlySelItems.indexOf(name) > -1;
    return '<button onclick="monthlyToggleItem(\'' + name.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')"'
      + ' data-item="' + name.replace(/"/g,'&quot;') + '" data-col="' + col + '"'
      + ' style="padding:4px 10px;border-radius:20px;font-size:11.5px;cursor:pointer;'
      + 'font-family:Sarabun,sans-serif;transition:all .15s;'
      + 'background:' + (on ? col+'28' : 'transparent') + ';color:' + (on ? col : 'var(--ink2)') + ';'
      + 'border:1px solid ' + (on ? col : 'var(--line)') + ';font-weight:' + (on ? 700 : 400) + '">'
      + name + '</button>';
  }).join('');
}

function monthlyToggleItem(name) {
  var idx = _monthlySelItems.indexOf(name);
  if (idx > -1) _monthlySelItems.splice(idx, 1);
  else _monthlySelItems.push(name);

  var el = document.getElementById('monthlyItemChips');
  if (el) el.querySelectorAll('button[data-item]').forEach(function(btn) {
    var iname = btn.getAttribute('data-item');
    var col   = btn.getAttribute('data-col');
    var on    = _monthlySelItems.indexOf(iname) > -1;
    btn.style.background = on ? col+'28' : 'transparent';
    btn.style.color      = on ? col : 'var(--ink2)';
    btn.style.border     = '1px solid ' + (on ? col : 'var(--line)');
    btn.style.fontWeight = on ? '700' : '400';
  });
  _renderMonthlyChart('item');
}

// ─── CHART SWITCH ─────────────────────────────────────────────
function switchMonthlyChart(type) {
  _monthlyActiveTab = type;

  // update tab button styles
  ['donut','bar','item'].forEach(function(t) {
    var btn = document.getElementById('mct-' + t);
    if (!btn) return;
    var on = t === type;
    btn.style.background = on ? 'var(--hf-accent)' : 'transparent';
    btn.style.color      = on ? '#fff' : 'var(--ink2)';
    btn.classList.toggle('active', on);
  });

  // show/hide item chips panel
  var itemFilter = document.getElementById('monthlyItemFilter');
  if (itemFilter) itemFilter.style.display = type === 'item' ? '' : 'none';
  if (type === 'item') _buildMonthlyItemChips();

  _renderMonthlyChart(type);
}

// ─── CHART RENDER ─────────────────────────────────────────────
function _renderMonthlyChart(type) {
  var canvas = document.getElementById('monthlyChartCanvas');
  var legend = document.getElementById('monthlyChartLegend');
  if (!canvas) return;
  if (_monthlyChart) { _monthlyChart.destroy(); _monthlyChart = null; }
  if (legend) legend.textContent = '';

  var me = db.filter(function(e) { return e.date.startsWith(_monthlyCurM) && e.type==='expense' && isPaid(e); });
  // apply category filter
  var filtered = _monthlySelCats.length
    ? me.filter(function(e) { return _monthlySelCats.indexOf(e.cat_name || '—') > -1; })
    : me;

  var ctx = canvas.getContext('2d');

  var baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { ticks: { callback: function(v) { return fmt(v); }, font: { size: 10 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { dash: [4,4] } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };

  var hBarOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    indexAxis: 'y',
    scales: {
      x: { ticks: { callback: function(v) { return fmt(v); }, font: { size: 9 } }, grid: { color: 'rgba(128,128,128,0.08)' }, border: { dash: [4,4] } },
      y: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } }
    }
  };

  // ── Donut: expense proportion by category ──
  if (type === 'donut') {
    var byCat = {};
    filtered.forEach(function(e) { var k = e.cat_name||'—'; byCat[k] = (byCat[k]||0)+e.amt; });
    var cats = Object.keys(byCat).sort(function(a,b) { return byCat[b]-byCat[a]; });
    if (!cats.length) { if (legend) legend.textContent = 'ไม่มีข้อมูล'; return; }
    _monthlyChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{ data: cats.map(function(c) { return byCat[c]; }), backgroundColor: PALETTE.slice(0, cats.length), borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '58%',
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 10, boxWidth: 10, usePointStyle: true } } }
      }
    });

  // ── Bar horizontal: by category ──
  } else if (type === 'bar') {
    var byCat2 = {};
    filtered.forEach(function(e) { var k = e.cat_name||'—'; byCat2[k] = (byCat2[k]||0)+e.amt; });
    var cats2 = Object.keys(byCat2).sort(function(a,b) { return byCat2[b]-byCat2[a]; });
    if (!cats2.length) { if (legend) legend.textContent = 'ไม่มีข้อมูล'; return; }
    _monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cats2,
        datasets: [{ data: cats2.map(function(c) { return byCat2[c]; }), backgroundColor: cats2.map(function(_,i) { return PALETTE[i % PALETTE.length]; }), borderRadius: 5, borderWidth: 0 }]
      },
      options: hBarOpts
    });

  // ── Bar horizontal: by item desc ──
  } else if (type === 'item') {
    var byItem = {};
    filtered.forEach(function(e) {
      var k = e.desc || '—';
      // apply item filter only if some items are selected
      if (_monthlySelItems.length === 0 || _monthlySelItems.indexOf(k) > -1)
        byItem[k] = (byItem[k]||0) + e.amt;
    });
    var items = Object.entries(byItem).sort(function(a,b) { return b[1]-a[1]; }).slice(0, 14);
    if (!items.length) {
      if (legend) legend.textContent = _monthlySelItems.length ? 'ไม่พบรายการที่เลือก' : 'ไม่มีข้อมูล';
      return;
    }
    var inames = items.map(function(p) { return p[0]; });
    var ivals  = items.map(function(p) { return p[1]; });
    _monthlyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: inames,
        datasets: [{ data: ivals, backgroundColor: inames.map(function(_,i) { return PALETTE[i % PALETTE.length]; }), borderRadius: 5, borderWidth: 0 }]
      },
      options: hBarOpts
    });
  }
}
