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
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:var(--red)">฿' + fmt(fc.burnRate) + '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">ใช้ได้วันละ</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:var(--green)">฿' + fmt(fc.safeToSpendToday) + '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">คาดว่าสิ้นรอบเหลือ</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:' + (fc.projectedEndBalance >= 0 ? 'var(--green)' : 'var(--red)') + '">฿' + fmt(fc.projectedEndBalance) + '</div>' +
      '</div>' +
      '<div style="background:rgba(255,255,255,.6);border-radius:8px;padding:7px 9px">' +
        '<div style="font-size:10px;color:var(--ink3)">เงินอยู่ได้อีก</div>' +
        '<div style="font-size:14px;font-weight:700;font-family:monospace;color:' + ac.text + '">' + fc.daysMoneyCanLast + ' วัน</div>' +
      '</div>' +
    '</div>' +
    runOutLine +
  '</div>';
}
