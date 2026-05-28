/* HomeFinance · module: forecastEngine.js · v3.0.0
 * Forecast algorithm:
 *   Burn Rate   = Total Spent ÷ Days Elapsed
 *   Forecast    = Active Balance ÷ Burn Rate  → days money can last
 *   Daily Allow = Active Balance ÷ Days Remaining  → safe-to-spend/day
 */

// ─── BURN RATE ─────────────────────────────────────────────
/**
 * Average baht spent per day so far in the cycle.
 * Returns 0 if no days have elapsed.
 */
function getBurnRate(cycleId) {
  cycleId = cycleId || getCurrentCycleId();
  var summary = getDashboardSummary(cycleId);
  if (!summary) return 0;
  return summary.daysElapsed > 0 ? summary.totalExpense / summary.daysElapsed : 0;
}

// ─── FORECAST ─────────────────────────────────────────────
/**
 * Full forecast object for a salary cycle.
 *
 * @param {string} cycleId
 * @returns {{
 *   burnRate:             number,   // ฿/day
 *   daysRemaining:        number,   // days left in cycle
 *   projectedEndBalance:  number,   // estimated ฿ at cycle end
 *   willOverspend:        boolean,
 *   daysMoneyCanLast:     number,   // how many days active balance covers
 *   moneyRunsOutDate:     Date|null,
 *   dailyAllowance:       number,   // safe to spend today
 *   safeToSpendToday:     number,
 *   alertLevel:           'safe'|'warning'|'danger',
 *   summary:              object
 * }}
 */
function calculateForecast(cycleId) {
  cycleId = cycleId || getCurrentCycleId();
  var summary  = getDashboardSummary(cycleId);
  if (!summary) return null;

  var burnRate          = getBurnRate(cycleId);
  var daysRemaining     = summary.daysRemaining;
  var activeBalance     = summary.activeBalance;

  // Projected remaining expense if current burn rate continues
  var projectedRemainingExp  = burnRate * daysRemaining;
  var projectedEndBalance    = activeBalance - projectedRemainingExp;
  var willOverspend          = projectedEndBalance < 0;

  // How many days can current balance last at burn rate?
  var daysMoneyCanLast = (burnRate > 0)
    ? Math.floor(activeBalance / burnRate)
    : daysRemaining;

  // Date money runs out (null if it won't)
  var moneyRunsOutDate = null;
  if (willOverspend && burnRate > 0) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var daysLeft = Math.max(0, Math.floor(activeBalance / burnRate));
    moneyRunsOutDate = new Date(today.getTime() + daysLeft * 86400000);
  }

  // Daily allowance = safe amount to spend per remaining day
  var dailyAllowance   = (daysRemaining > 0) ? activeBalance / daysRemaining : 0;
  var safeToSpendToday = Math.max(0, dailyAllowance);

  // Alert level
  var alertLevel = 'safe';
  if (willOverspend) {
    alertLevel = 'danger';
  } else if (summary.received > 0 && projectedEndBalance < summary.received * 0.1) {
    alertLevel = 'warning';
  } else if (burnRate > 0 && dailyAllowance < burnRate * 0.8) {
    alertLevel = 'warning';
  }

  return {
    burnRate:            Math.round(burnRate),
    daysRemaining:       daysRemaining,
    projectedEndBalance: Math.round(projectedEndBalance),
    willOverspend:       willOverspend,
    daysMoneyCanLast:    daysMoneyCanLast,
    moneyRunsOutDate:    moneyRunsOutDate,
    dailyAllowance:      Math.round(dailyAllowance),
    safeToSpendToday:    Math.round(safeToSpendToday),
    alertLevel:          alertLevel,
    summary:             summary,
  };
}

// ─── SPENDING ALERT ───────────────────────────────────────
function getSpendingAlert(cycleId) {
  var fc = calculateForecast(cycleId);
  return fc ? fc.alertLevel : 'safe';
}

// ─── FORECAST CARD HTML ───────────────────────────────────
/**
 * Render a mini forecast card (injected inside the salary cycle card).
 */
function renderForecastCard(cycleId) {
  cycleId = cycleId || getCurrentCycleId();
  var fc = calculateForecast(cycleId);
  if (!fc) return '';

  var alertColors = {
    safe:    { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', icon: '✅' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
    danger:  { bg: '#fef2f2', border: '#ef4444', text: '#b91c1c', icon: '🔴' },
  };
  var ac = alertColors[fc.alertLevel] || alertColors.safe;

  var runOutLine = '';
  if (fc.moneyRunsOutDate) {
    var d = fc.moneyRunsOutDate;
    runOutLine = '<div style="font-size:11px;color:' + ac.text + ';margin-top:3px">' +
      '⛔ คาดว่าเงินจะหมดวันที่ ' + toThaiDateShort(d.toISOString().slice(0, 10)) +
      '</div>';
  }

  return '<div style="background:' + ac.bg + ';border:1px solid ' + ac.border + ';border-radius:10px;padding:10px 12px;margin-top:10px">' +
    '<div style="font-size:12px;font-weight:700;color:' + ac.text + ';margin-bottom:8px">' + ac.icon + ' Forecast</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">อัตราใช้จ่าย/วัน</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:var(--red)">' + fmtH(fc.burnRate) + '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">ใช้ได้วันละ</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:var(--green)">' + fmtH(fc.safeToSpendToday) + '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">คาดว่าสิ้นรอบเหลือ</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:' + (fc.projectedEndBalance >= 0 ? 'var(--green)' : 'var(--red)') + '">' + fmtH(fc.projectedEndBalance) + '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">เงินอยู่ได้อีก</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:' + ac.text + '">' + fc.daysMoneyCanLast + ' วัน</div>' +
      '</div>' +
    '</div>' +
    runOutLine +
  '</div>';
}

// ─── BUDGET PLAN PANEL ────────────────────────────────────
/**
 * แสดงรายการแผนรายจ่ายจาก budgetItems vs actual
 * เรียกจาก renderForecastCard() หรือแยกแสดงใน dashboard
 */
function renderForecastBudgetPanel(cycleId) {
  if (typeof budgetItems === 'undefined' || !budgetItems.length) return '';
  if (typeof getBudgetSpending !== 'function') return '';

  var actual  = getBudgetSpending();
  var expCats = (typeof categories !== 'undefined' ? categories : []).filter(function(c){ return c.type === 'expense'; });

  // Aggregate per catId
  var catActual  = {};
  var catPlanned = {};
  budgetItems.forEach(function(bi) {
    catPlanned[bi.catId] = (catPlanned[bi.catId] || 0) + bi.amount;
    var cat    = expCats.find(function(c){ return c.id === bi.catId; });
    var spent  = actual[bi.catId] || (cat ? actual[cat.name] : 0) || 0;
    catActual[bi.catId]  = spent;
  });

  var totalPlanned = budgetItems.reduce(function(s,bi){ return s + bi.amount; }, 0);
  var totalActual  = (function(){
    var seen = {};
    return budgetItems.reduce(function(s,bi){
      if (!seen[bi.catId]) { seen[bi.catId]=true; return s + (catActual[bi.catId]||0); }
      return s;
    }, 0);
  })();
  var remaining = Math.max(0, totalPlanned - totalActual);
  var pct = totalPlanned > 0 ? Math.min(100, Math.round(totalActual / totalPlanned * 100)) : 0;
  var over = totalActual > totalPlanned;
  var barCol = over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e';

  var rows = budgetItems.map(function(bi) {
    var spent  = catActual[bi.catId] || 0;
    var p      = bi.amount > 0 ? Math.min(100, Math.round(spent / bi.amount * 100)) : 0;
    var ov     = spent > bi.amount;
    var bCol   = ov ? '#ef4444' : p > 80 ? '#f59e0b' : '#22c55e';
    var label  = bi.catName + (bi.itemName ? ' › ' + bi.itemName : '');
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(0,0,0,.06)">' +
      '<span style="flex:1;font-size:11px;color:var(--ink)">' + label + '</span>' +
      '<div style="width:60px;height:5px;background:rgba(0,0,0,.08);border-radius:3px;overflow:hidden">' +
        '<div style="height:100%;width:'+p+'%;background:'+bCol+';border-radius:3px"></div>' +
      '</div>' +
      '<span style="font-size:11px;font-family:monospace;color:' + (ov?'#ef4444':'var(--ink2)') + ';width:56px;text-align:right">' + fmtH(spent) + '</span>' +
      '<span style="font-size:10px;color:var(--ink3);width:4px">/</span>' +
      '<span style="font-size:11px;font-family:monospace;color:var(--ink3);width:56px;text-align:right">' + fmtH(bi.amount) + '</span>' +
    '</div>';
  }).join('');

  return '<div style="background:var(--surface2);border-radius:10px;padding:10px 12px;margin-top:10px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<span style="font-size:12px;font-weight:700;color:var(--ink)">📋 แผนรายจ่าย</span>' +
      '<span style="font-size:11px;font-family:monospace;color:' + (over ? '#ef4444' : 'var(--ink2)') + '">' +
        fmtH(totalActual) + ' / ' + fmtH(totalPlanned) + '</span>' +
    '</div>' +
    '<div style="height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin-bottom:8px">' +
      '<div style="height:100%;width:'+pct+'%;background:'+barCol+';border-radius:3px;transition:width .4s"></div>' +
    '</div>' +
    rows +
    (remaining > 0
      ? '<div style="font-size:11px;color:var(--ink3);text-align:right;margin-top:5px">คงเหลือตามแผน ' + fmtH(remaining) + ' บาท</div>'
      : '<div style="font-size:11px;color:#ef4444;text-align:right;margin-top:5px">⚠ ใช้เกินแผน ' + fmtH(totalActual - totalPlanned) + ' บาท</div>') +
  '</div>';
}
