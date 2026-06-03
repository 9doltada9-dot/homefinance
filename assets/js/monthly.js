/* HomeFinance · module: monthly.js · v3.2.0 */

var _mlyChart    = null;
var _mlyMode     = 'cat'; // 'cat' | 'item'
var _mlySelCats  = [];   // selected category names (for cat trend lines)
var _mlySelItems = [];   // selected item desc names
var _mlyCurM     = '';   // current selected month "YYYY-MM"
var _mlyMonths   = [];   // 6 months ending at _mlyCurM
var _mlyLabels   = [];   // Thai short labels for those months

// ─── MAIN RENDER ─────────────────────────────────────────────
function renderMonthly() {
  var m = document.getElementById('monthSel').value;
  if (!m) {
    document.getElementById('monthlyContent').innerHTML = '<div class="empty">เลือกเดือน</div>';
    return;
  }

  // reset state on month change
  _mlyCurM    = m;
  _mlyMode    = 'cat';
  _mlySelCats  = [];
  _mlySelItems = [];

  // build 6-month window ending at m
  var parts = m.split('-').map(Number);
  var ym = { y: parts[0], mo: parts[1] };
  _mlyMonths = [];
  for (var i = 5; i >= 0; i--) {
    var mo = ym.mo - i;
    var yr = ym.y;
    while (mo < 1) { mo += 12; yr--; }
    _mlyMonths.push(yr + '-' + String(mo).padStart(2, '0'));
  }
  _mlyLabels = _mlyMonths.map(function(mm) {
    var p = mm.split('-').map(Number);
    return SHORT_M[p[1]-1] + "'" + String(p[0]+543).slice(2);
  });

  // ── per-month aggregates
  var me = db.filter(function(e) { return e.date.startsWith(m); });
  var incPaid = me.filter(function(e) { return e.type==='income'  && isPaid(e); }).reduce(function(s,e) { return s+e.amt; }, 0);
  var expPaid = me.filter(function(e) { return e.type==='expense' && isPaid(e); }).reduce(function(s,e) { return s+e.amt; }, 0);
  var bal = incPaid - expPaid;

  // expense by category (for table)
  var byCat = {};
  me.filter(function(e) { return e.type==='expense' && isPaid(e); }).forEach(function(e) {
    var k = e.cat_name || '—';
    byCat[k] = (byCat[k]||0) + e.amt;
  });
  var catEntries = Object.entries(byCat).sort(function(a,b) { return b[1]-a[1]; });

  document.getElementById('monthlyContent').innerHTML =

    // ── 3 metric cards
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px">' +
      '<div class="hf-card"><div class="hf-metric-label">รายรับรวม</div><div class="hf-metric-val g">'  + fmtH(incPaid) + '</div><div class="hf-metric-sub">บาท</div></div>' +
      '<div class="hf-card"><div class="hf-metric-label">รายจ่ายรวม</div><div class="hf-metric-val r">' + fmtH(expPaid) + '</div><div class="hf-metric-sub">บาท</div></div>' +
      '<div class="hf-card"><div class="hf-metric-label">คงเหลือ</div><div class="hf-metric-val '+(bal>=0?'g':'r')+'">' + fmtH(bal) + '</div><div class="hf-metric-sub">บาท</div></div>' +
    '</div>' +

    // ── Trend chart card
    '<div class="hf-card" style="margin-bottom:16px">' +
      // header
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">' +
        '<div>' +
          '<div class="hf-card-title" style="margin:0">แนวโน้ม 6 เดือน</div>' +
          '<div id="mlyTrendSub" style="font-size:11px;color:var(--ink3);margin-top:2px">รายรับ vs รายจ่าย</div>' +
        '</div>' +
        // mode toggle: หมวด | รายการ
        '<div style="display:flex;gap:0;border-radius:10px;overflow:hidden;border:1px solid var(--line)">' +
          '<button id="mlyTab-cat"  onclick="mlySwitch(\'cat\')"  style="'  + _mlyTabStyle(true)  + '">📂 หมวด</button>'  +
          '<button id="mlyTab-item" onclick="mlySwitch(\'item\')" style="'  + _mlyTabStyle(false) + '">📋 รายการ</button>' +
        '</div>' +
      '</div>' +

      // category chips
      '<div id="mlyCatChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' +
        _buildMlyCatChipsHTML(catEntries) +
      '</div>' +

      // item chips (hidden until "รายการ" tab)
      '<div id="mlyItemFilter" style="display:none;margin-bottom:12px">' +
        '<div style="font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">เลือกรายการ</div>' +
        '<div id="mlyItemChips" style="display:flex;flex-wrap:wrap;gap:5px"></div>' +
      '</div>' +

      // main trend canvas
      '<div style="position:relative;height:210px"><canvas id="mlyTrendCanvas"></canvas></div>' +
      '<div id="mlyTrendLegend" style="font-size:11px;color:var(--ink3);text-align:center;margin-top:4px"></div>' +
    '</div>' +

    // ── detail tables
    '<div class="grid2">' +
      '<div class="hf-card">' +
        '<div class="hf-card-title">รายจ่ายแยกหมวด</div>' +
        (catEntries.length
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
        _buildIncomeBlock(me) +
      '</div>' +
    '</div>';

  // init chart (default: income vs expense lines)
  _mlyRenderTrend();
}

// ─── TAB SWITCH ───────────────────────────────────────────────
function mlySwitch(mode) {
  _mlyMode = mode;
  var isItem = mode === 'item';

  ['cat','item'].forEach(function(t) {
    var btn = document.getElementById('mlyTab-' + t);
    if (btn) btn.style.cssText = _mlyTabStyle(t === mode);
  });

  var itemFilter = document.getElementById('mlyItemFilter');
  var catChips   = document.getElementById('mlyCatChips');
  if (itemFilter) itemFilter.style.display = isItem ? '' : 'none';
  if (catChips)   catChips.style.display   = isItem ? 'none' : '';

  if (isItem) {
    _mlySelCats = [];
    _buildMlyItemChips();
  } else {
    _mlySelItems = [];
  }
  _mlyRenderTrend();
}

function _mlyTabStyle(active) {
  return 'padding:6px 13px;font-size:11.5px;font-weight:600;border:none;cursor:pointer;'
    + 'font-family:Sarabun,sans-serif;transition:all .15s;'
    + 'background:' + (active ? 'var(--hf-accent)' : 'transparent') + ';'
    + 'color:'      + (active ? '#fff' : 'var(--ink2)') + ';';
}

// ─── CATEGORY CHIPS ──────────────────────────────────────────
function _buildMlyCatChipsHTML(catEntries) {
  if (!catEntries || !catEntries.length) return '';
  var allOn = !_mlySelCats.length;
  var allBtn = '<button id="mcat-all" onclick="mlyToggleCat(\'__all__\')"'
    + ' style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;'
    + 'font-family:Sarabun,sans-serif;transition:all .15s;border:none;'
    + 'background:' + (allOn ? 'var(--hf-accent)' : 'var(--surface2)') + ';'
    + 'color:'      + (allOn ? '#fff' : 'var(--ink2)') + '">รายรับ/จ่ายรวม</button>';

  var chips = catEntries.map(function(pair, i) {
    var cat = pair[0];
    var col = PALETTE[i % PALETTE.length];
    var on  = _mlySelCats.indexOf(cat) > -1;
    return '<button onclick="mlyToggleCat(\'' + cat.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')"'
      + ' data-cat="' + cat.replace(/"/g,'&quot;') + '" data-col="' + col + '"'
      + ' style="display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:20px;font-size:12px;'
      + 'cursor:pointer;font-family:Sarabun,sans-serif;transition:all .15s;'
      + 'background:' + (on ? col+'28' : 'transparent') + ';color:' + (on ? col : 'var(--ink2)') + ';'
      + 'border:1px solid ' + (on ? col : 'var(--line)') + ';font-weight:' + (on ? 700 : 500) + '">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:' + col + ';flex-shrink:0"></span>'
      + cat + '</button>';
  }).join('');
  return allBtn + chips;
}

function mlyToggleCat(cat) {
  if (cat === '__all__') {
    _mlySelCats = [];
  } else {
    var idx = _mlySelCats.indexOf(cat);
    if (idx > -1) _mlySelCats.splice(idx, 1); else _mlySelCats.push(cat);
  }
  // update styles without full rebuild
  var el = document.getElementById('mlyCatChips');
  if (el) {
    var allOn = !_mlySelCats.length;
    var allBtn = document.getElementById('mcat-all');
    if (allBtn) {
      allBtn.style.background = allOn ? 'var(--hf-accent)' : 'var(--surface2)';
      allBtn.style.color      = allOn ? '#fff' : 'var(--ink2)';
    }
    el.querySelectorAll('button[data-cat]').forEach(function(btn) {
      var bc  = btn.getAttribute('data-cat');
      var col = btn.getAttribute('data-col');
      var on  = _mlySelCats.indexOf(bc) > -1;
      btn.style.background = on ? col+'28' : 'transparent';
      btn.style.color      = on ? col : 'var(--ink2)';
      btn.style.border     = '1px solid ' + (on ? col : 'var(--line)');
      btn.style.fontWeight = on ? '700' : '500';
    });
  }
  // update subtitle
  var sub = document.getElementById('mlyTrendSub');
  if (sub) sub.textContent = _mlySelCats.length
    ? 'รายจ่ายหมวด: ' + _mlySelCats.join(', ')
    : 'รายรับ vs รายจ่าย';
  _mlyRenderTrend();
}

// ─── ITEM CHIPS ───────────────────────────────────────────────
function _buildMlyItemChips() {
  var el = document.getElementById('mlyItemChips');
  if (!el) return;

  // all expense items in the 6-month window
  var byDesc = {};
  db.filter(function(e) {
    return _mlyMonths.indexOf(e.date.slice(0,7)) > -1
      && e.type==='expense' && isPaid(e);
  }).forEach(function(e) {
    var k = e.desc || '—';
    byDesc[k] = (byDesc[k]||0) + e.amt;
  });
  var items = Object.entries(byDesc).sort(function(a,b) { return b[1]-a[1]; }).slice(0, 16);

  if (!items.length) { el.innerHTML = '<div style="font-size:12px;color:var(--ink3)">ไม่มีรายการ</div>'; return; }

  el.innerHTML = items.map(function(pair, i) {
    var name = pair[0];
    var col  = PALETTE[i % PALETTE.length];
    var on   = _mlySelItems.indexOf(name) > -1;
    return '<button onclick="mlyToggleItem(\'' + name.replace(/\\/g,'\\\\').replace(/'/g,"\\'") + '\')"'
      + ' data-item="' + name.replace(/"/g,'&quot;') + '" data-col="' + col + '"'
      + ' style="padding:4px 10px;border-radius:20px;font-size:11.5px;cursor:pointer;'
      + 'font-family:Sarabun,sans-serif;transition:all .15s;'
      + 'background:' + (on ? col+'28' : 'transparent') + ';color:' + (on ? col : 'var(--ink2)') + ';'
      + 'border:1px solid ' + (on ? col : 'var(--line)') + ';font-weight:' + (on ? 700 : 400) + '">'
      + name + '</button>';
  }).join('');
}

function mlyToggleItem(name) {
  var idx = _mlySelItems.indexOf(name);
  if (idx > -1) _mlySelItems.splice(idx, 1); else _mlySelItems.push(name);
  var el = document.getElementById('mlyItemChips');
  if (el) el.querySelectorAll('button[data-item]').forEach(function(btn) {
    var iname = btn.getAttribute('data-item');
    var col   = btn.getAttribute('data-col');
    var on    = _mlySelItems.indexOf(iname) > -1;
    btn.style.background = on ? col+'28' : 'transparent';
    btn.style.color      = on ? col : 'var(--ink2)';
    btn.style.border     = '1px solid ' + (on ? col : 'var(--line)');
    btn.style.fontWeight = on ? '700' : '400';
  });
  var sub = document.getElementById('mlyTrendSub');
  if (sub) sub.textContent = _mlySelItems.length
    ? 'รายการ: ' + _mlySelItems.join(', ')
    : 'แนวโน้มรายการ';
  _mlyRenderTrend();
}

// ─── TREND CHART ─────────────────────────────────────────────
function _mlyRenderTrend() {
  var canvas = document.getElementById('mlyTrendCanvas');
  var legend = document.getElementById('mlyTrendLegend');
  if (!canvas) return;
  if (_mlyChart) { _mlyChart.destroy(); _mlyChart = null; }
  if (legend) legend.textContent = '';

  var months = _mlyMonths;
  var labelsT = _mlyLabels;
  var ctx = canvas.getContext('2d');

  var chartOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { font: { size: 10 }, usePointStyle: true, padding: 12 } }
    },
    scales: {
      y: {
        ticks: { callback: function(v) { return fmt(v); }, font: { size: 10 } },
        grid: { color: 'rgba(128,128,128,0.08)' },
        border: { dash: [4,4] }
      },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };

  var datasets = [];

  if (_mlyMode === 'item') {
    // Item trend: one line per selected item (or top-5 if none selected)
    var byDesc = {};
    db.filter(function(e) {
      return months.indexOf(e.date.slice(0,7)) > -1 && e.type==='expense' && isPaid(e);
    }).forEach(function(e) { var k = e.desc||'—'; byDesc[k] = (byDesc[k]||0)+e.amt; });

    var toShow = _mlySelItems.length
      ? _mlySelItems
      : Object.entries(byDesc).sort(function(a,b){return b[1]-a[1];}).slice(0,5).map(function(p){return p[0];});

    if (!toShow.length) { if (legend) legend.textContent = 'ไม่มีข้อมูล'; return; }

    datasets = toShow.map(function(name, i) {
      var col  = PALETTE[i % PALETTE.length];
      var vals = months.map(function(mm) {
        return db.filter(function(e) {
          return e.date.startsWith(mm) && e.type==='expense' && isPaid(e) && (e.desc||'—') === name;
        }).reduce(function(s,e) { return s+e.amt; }, 0);
      });
      return { label: name, data: vals, borderColor: col, backgroundColor: col+'22', tension: .3, fill: true, pointRadius: 4, borderWidth: 2 };
    });

  } else if (_mlySelCats.length) {
    // ── Mode B: Per-category expense trend lines ──────────────
    datasets = _mlySelCats.map(function(cat, i) {
      var col  = PALETTE[i % PALETTE.length];
      var vals = months.map(function(mm) {
        return db.filter(function(e) {
          return e.date.startsWith(mm) && e.type==='expense' && isPaid(e) && (e.cat_name||'—') === cat;
        }).reduce(function(s,e) { return s+e.amt; }, 0);
      });
      return { label: cat, data: vals, borderColor: col, backgroundColor: col+'22', tension: .3, fill: true, pointRadius: 4, borderWidth: 2 };
    });

  } else {
    // ── Mode C: Default — income vs expense (same as dashboard trend) ──
    var incVals = months.map(function(mm) {
      return db.filter(function(e) { return e.date.startsWith(mm) && e.type==='income'  && isPaid(e); }).reduce(function(s,e){return s+e.amt;},0);
    });
    var expVals = months.map(function(mm) {
      return db.filter(function(e) { return e.date.startsWith(mm) && e.type==='expense' && isPaid(e); }).reduce(function(s,e){return s+e.amt;},0);
    });
    datasets = [
      { label: 'รายรับ',  data: incVals, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,.1)',  tension: .3, fill: true, pointRadius: 4, borderWidth: 2 },
      { label: 'รายจ่าย', data: expVals, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,.1)', tension: .3, fill: true, pointRadius: 4, borderWidth: 2 }
    ];
  }

  _mlyChart = new Chart(ctx, {
    type: 'line',
    data: { labels: labelsT, datasets: datasets },
    options: chartOpts
  });
}

// ─── HELPERS ─────────────────────────────────────────────────
function _buildIncomeBlock(me) {
  var incCat = {};
  me.filter(function(e) { return e.type==='income' && isPaid(e); }).forEach(function(e) {
    var k = e.cat_name || 'อื่นๆ';
    incCat[k] = (incCat[k]||0) + e.amt;
  });
  var ic = Object.entries(incCat).sort(function(a,b) { return b[1]-a[1]; });
  return ic.length
    ? '<table><tr><th>ประเภท</th><th style="text-align:right">จำนวน</th></tr>' +
      ic.map(function(pair) {
        return '<tr><td>' + pair[0] + '</td><td style="text-align:right;font-family:monospace;color:var(--green)">' + fmtH(pair[1]) + '</td></tr>';
      }).join('') + '</table>'
    : '<div class="empty">ไม่มีรายรับ</div>';
}
