/* HomeFinance · module: cycleEngine.js · v3.0.0
 * Salary-cycle-aware engine:
 *   - Derives cycle_id from any date (25th-to-24th model)
 *   - Manages billing_month separation from transaction_date
 *   - Maintains a local cycle registry in localStorage
 */

// ─── CYCLE ID HELPERS ─────────────────────────────────────
/**
 * Returns 'cycle-YYYY-MM' for the salary cycle that `date` belongs to.
 * e.g.  May 10  → 'cycle-2026-04'  (Apr 25 – May 24)
 *        May 25  → 'cycle-2026-05'  (May 25 – Jun 24)
 */
function cycleIdFromDate(date) {
  var d = date ? new Date(date + (String(date).length === 10 ? 'T00:00:00' : '')) : new Date();
  var day = d.getDate();
  var y   = d.getFullYear();
  var m   = d.getMonth(); // 0-indexed

  var cycleYear, cycleMonth;
  if (day >= SALARY_DAY) {
    cycleYear  = y;
    cycleMonth = m + 1; // 1-indexed
  } else {
    // belongs to previous month's cycle
    if (m === 0) { cycleYear = y - 1; cycleMonth = 12; }
    else          { cycleYear = y;     cycleMonth = m; }
  }
  return 'cycle-' + cycleYear + '-' + String(cycleMonth).padStart(2, '0');
}

/**
 * Build a full cycle object from its ID.
 */
function getCycleById(cycleId) {
  var parts = (cycleId || '').split('-');
  if (parts.length < 3) return null;
  var y = parseInt(parts[1], 10);
  var m = parseInt(parts[2], 10) - 1; // 0-indexed

  var cycleStart = new Date(y, m, SALARY_DAY);
  var cycleEnd   = new Date(y, m + 1, SALARY_DAY - 1);

  var fmt8 = function(dt) {
    return dt.getFullYear() + '-' +
           String(dt.getMonth() + 1).padStart(2, '0') + '-' +
           String(dt.getDate()).padStart(2, '0');
  };

  var sm  = SHORT_M[cycleStart.getMonth()];
  var em  = SHORT_M[cycleEnd.getMonth()];
  var sy  = cycleStart.getFullYear() + 543;
  var ey  = cycleEnd.getFullYear()   + 543;

  return {
    id:    cycleId,
    start: fmt8(cycleStart),
    end:   fmt8(cycleEnd),
    label: sy === ey
      ? (sm + ' – ' + em + ' ' + sy)
      : (sm + ' ' + sy + ' – ' + em + ' ' + ey)
  };
}

/** Returns the cycle ID for today. */
function getCurrentCycleId() {
  return cycleIdFromDate(new Date());
}

/** Returns the full cycle object for today. */
function getCurrentCycle() {
  return getCycleById(getCurrentCycleId());
}

/** Returns the next cycle's ID. */
function getNextCycleId(cycleId) {
  var parts  = (cycleId || getCurrentCycleId()).split('-');
  var y = parseInt(parts[1], 10);
  var m = parseInt(parts[2], 10);
  m++;
  if (m > 12) { m = 1; y++; }
  return 'cycle-' + y + '-' + String(m).padStart(2, '0');
}

/**
 * For a given transaction object, resolve its cycle_id.
 * Falls back to deriving from e.date for backward-compat old records.
 */
function txCycleId(e) {
  return e.cycle_id || cycleIdFromDate(e.date);
}

// ─── BILLING MONTH HELPERS ────────────────────────────────
/**
 * Default billing_month = same YYYY-MM as the transaction_date.
 */
function defaultBillingMonth(txDateStr) {
  return (txDateStr || '').slice(0, 7);
}

/**
 * Smart suggestion: utility bills paid on day 1-10 often belong to prev month.
 */
function suggestBillingMonth(txDateStr, catName) {
  if (!txDateStr) return '';
  var d   = new Date(txDateStr + 'T00:00:00');
  var day = d.getDate();
  var cat = (catName || '').toLowerCase();
  var utilityKw = ['ไฟ', 'น้ำ', 'อินเตอร์เน็ต', 'เน็ต', 'โทรศัพท์', 'ค่าน้ำ', 'ค่าไฟ'];
  var isUtility = utilityKw.some(function(k) { return cat.indexOf(k) > -1; });

  if (isUtility && day <= 10) {
    var prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
  }
  return defaultBillingMonth(txDateStr);
}

// ─── CYCLE REGISTRY (localStorage) ───────────────────────
function loadCycleRegistry() {
  try { return JSON.parse(localStorage.getItem('hf2_cycles') || '[]'); }
  catch(_) { return []; }
}
function saveCycleRegistry(list) {
  localStorage.setItem('hf2_cycles', JSON.stringify(list));
}

function ensureCycleExists(cycleId) {
  if (!cycleId) return;
  var list = loadCycleRegistry();
  if (list.find(function(c) { return c.id === cycleId; })) return;
  var cy = getCycleById(cycleId);
  if (cy) { list.push(cy); saveCycleRegistry(list); }
}

// ─── BILLING MONTH SELECTOR UI ───────────────────────────
/**
 * Update the billing month field when the transaction date or category changes.
 * Supports both <input type="month"> and <select> elements with id="fBillingMonth".
 * Shows smart suggestion for utility bills paid on day 1-10.
 */
function updateBillingMonthSelector(txDateStr, catName) {
  var el = document.getElementById('fBillingMonth');
  if (!el) return;
  if (!txDateStr) { el.value = ''; return; }

  var suggested = suggestBillingMonth(txDateStr, catName);

  // If it's an <input type="month">, just set the value
  if (el.tagName === 'INPUT') {
    el.value = suggested;
    return;
  }

  // Legacy: <select> behaviour — rebuild options
  var d    = new Date(txDateStr + 'T00:00:00');
  var mo   = d.getMonth();
  var yr   = d.getFullYear();
  var prev = new Date(yr, mo - 1, 1);
  var next = new Date(yr, mo + 1, 1);

  el.innerHTML = [prev, d, next].map(function(dt) {
    var ym  = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
    var thY = dt.getFullYear() + 543;
    var thM = SHORT_M[dt.getMonth()];
    var isSuggested = ym === suggested;
    return '<option value="' + ym + '"' + (isSuggested ? ' selected' : '') + '>' +
           thM + ' ' + thY +
           (isSuggested && suggested !== defaultBillingMonth(txDateStr) ? ' (แนะนำ)' : '') +
           '</option>';
  }).join('');
  el.value = suggested;
}

// ─── INIT ─────────────────────────────────────────────────
function initCycleEngine() {
  var curId  = getCurrentCycleId();
  var nextId = getNextCycleId(curId);
  ensureCycleExists(curId);
  ensureCycleExists(nextId);
}
