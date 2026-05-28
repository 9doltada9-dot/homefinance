/* HomeFinance · module: balanceEngine.js · v3.0.0
 * Computes Active vs Pending balance following the core rule:
 *   Active Balance  = SUM(active income in cycle) – SUM(all expenses in cycle)
 *   Pending Balance = SUM(pending income in cycle)   ← NOT spendable
 *
 * Backward-compat: works with entries that lack cycle_id (uses txCycleId()).
 */

// ─── HELPERS ──────────────────────────────────────────────
/** True if entry counts as received/paid (not pending, not cancelled). */
function isActive(e) {
  var s = (e.status || '').toLowerCase();
  return s !== 'pending' && s !== 'cancelled';
}

/** True if entry is explicitly pending. */
function isPending(e) {
  return (e.status || '').toLowerCase() === 'pending';
}

/** Filter transactions belonging to a cycle (with fallback). */
function txInCycle(cycleId) {
  var cy = getCycleById(cycleId);
  if (!cy) return [];
  // กรองเฉพาะ user ที่ login อยู่ — ป้องกัน cross-user data leak
  var _uid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _db  = _uid ? db.filter(function(e){ return (e.user_id||e.person) === _uid; }) : db;
  return _db.filter(function(e) {
    // Prefer explicit cycle_id; fall back to date range
    if (e.cycle_id) return e.cycle_id === cycleId;
    return e.date >= cy.start && e.date <= cy.end;
  });
}

// ─── ACTIVE BALANCE ───────────────────────────────────────
/**
 * Money you can actually spend:
 *   SUM(active income in cycle) – SUM(expense in cycle)
 */
function getActiveBalance(cycleId) {
  var txs = txInCycle(cycleId);
  var activeIncome = txs
    .filter(function(e) { return e.type === 'income' && isActive(e); })
    .reduce(function(s, e) { return s + e.amt; }, 0);
  var expenses = txs
    .filter(function(e) { return e.type === 'expense' && !isPending(e); })
    .reduce(function(s, e) { return s + e.amt; }, 0);
  return activeIncome - expenses;
}

// ─── PENDING BALANCE ──────────────────────────────────────
/**
 * Money received but NOT yet usable (early salary before 25th).
 */
function getPendingBalance(cycleId) {
  var txs = txInCycle(cycleId);
  return txs
    .filter(function(e) { return e.type === 'income' && isPending(e); })
    .reduce(function(s, e) { return s + e.amt; }, 0);
}

// ─── FULL DASHBOARD SUMMARY ───────────────────────────────
/**
 * Returns a comprehensive snapshot for the given cycle.
 */
function getDashboardSummary(cycleId) {
  cycleId = cycleId || getCurrentCycleId();
  var cy  = getCycleById(cycleId);
  if (!cy) return null;

  var today      = new Date(); today.setHours(0, 0, 0, 0);
  var cycleStart = new Date(cy.start + 'T00:00:00');
  var cycleEnd   = new Date(cy.end   + 'T00:00:00');

  // Clamp elapsed days to [1, totalDays]
  var totalDays      = Math.round((cycleEnd - cycleStart) / 86400000) + 1;
  var daysElapsed    = Math.max(1, Math.min(totalDays, Math.round((today - cycleStart) / 86400000) + 1));
  var daysRemaining  = Math.max(0, Math.round((cycleEnd - today) / 86400000));

  var txs = txInCycle(cycleId);
  var incEntries = txs.filter(function(e) { return e.type === 'income'; });
  var expEntries = txs.filter(function(e) { return e.type === 'expense'; });

  var received   = incEntries.filter(isActive).reduce(function(s, e) { return s + e.amt; }, 0);
  var pending    = incEntries.filter(isPending).reduce(function(s, e) { return s + e.amt; }, 0);
  var totalExp   = expEntries.filter(function(e) { return !isPending(e); }).reduce(function(s, e) { return s + e.amt; }, 0);
  var activeBalance = received - totalExp;

  return {
    cycleId:       cycleId,
    cycle:         cy,
    received:      received,
    pending:       pending,
    totalExpense:  totalExp,
    activeBalance: activeBalance,
    pendingBalance: pending,
    daysElapsed:   daysElapsed,
    daysRemaining: daysRemaining,
    totalDays:     totalDays,
  };
}

// ─── EXPENSE VALIDATION ───────────────────────────────────
/**
 * Check whether a proposed expense amount is within active balance.
 * Returns { ok: bool, activeBalance: number, shortfall: number }
 */
function validateExpense(amount, cycleId) {
  cycleId = cycleId || getCurrentCycleId();
  var active = getActiveBalance(cycleId);
  return {
    ok:            active >= amount,
    activeBalance: active,
    shortfall:     Math.max(0, amount - active),
  };
}
