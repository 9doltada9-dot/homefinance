/* HomeFinance · module: notificationEngine.js · v3.0.0
 * Web Push notifications + in-app reminder checks.
 * Triggers: upcoming recurring bills, low balance, cycle end.
 */

var _notifPermission = 'default';

// ─── PERMISSION ───────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  try {
    var result = await Notification.requestPermission();
    _notifPermission = result;
    if (result === 'granted') showCycleToast('🔔 เปิดการแจ้งเตือนแล้ว');
    return result === 'granted';
  } catch(_) { return false; }
}

function hasNotifPermission() {
  return 'Notification' in window && Notification.permission === 'granted';
}

// ─── SEND NOTIFICATION ────────────────────────────────────
function sendNotification(title, body, icon) {
  if (!hasNotifPermission()) return;
  try {
    new Notification(title, {
      body: body,
      icon: icon || '/assets/icons/icon-192.png',
      badge: '/assets/icons/icon-72.png',
      tag: 'homefinance-' + Date.now(),
      lang: 'th',
    });
  } catch(e) { console.warn('[Notif]', e); }
}

// ─── REMINDER CHECKS ──────────────────────────────────────
/**
 * Check for recurring bills due within `days` days.
 * Returns array of { template, daysUntilDue }.
 */
function checkUpcomingRecurring(days) {
  days = days || 3;
  var today    = new Date(); today.setHours(0, 0, 0, 0);
  var upcoming = [];
  var list     = getRecurringList ? getRecurringList() : [];
  var yyyymm   = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');

  list.forEach(function(t) {
    if (t.last_run_yyyymm === yyyymm) return; // already generated this month
    var dueDay  = t.day_of_month || 1;
    var dueDate = new Date(today.getFullYear(), today.getMonth(), dueDay);
    if (dueDate < today) return; // already past
    var diff = Math.round((dueDate - today) / 86400000);
    if (diff <= days) {
      upcoming.push({ template: t, daysUntilDue: diff });
    }
  });
  return upcoming;
}

/**
 * Check if active balance is below a threshold (default 20% of received).
 */
function checkLowBalance(thresholdFraction) {
  thresholdFraction = thresholdFraction || 0.2;
  var cycleId = getCurrentCycleId();
  var summary = getDashboardSummary(cycleId);
  if (!summary || !summary.received) return false;
  return summary.activeBalance < summary.received * thresholdFraction;
}

/**
 * Check if cycle ends in ≤ 3 days.
 */
function checkCycleEndingSoon(days) {
  days = days || 3;
  var summary = getDashboardSummary(getCurrentCycleId());
  return summary && summary.daysRemaining <= days;
}

// ─── RUN ALL CHECKS ───────────────────────────────────────
var _notifCheckTimer = null;

function runNotificationChecks() {
  if (!hasNotifPermission()) return;

  // 1. Upcoming recurring bills
  var upcoming = checkUpcomingRecurring(3);
  upcoming.forEach(function(item) {
    var t    = item.template;
    var when = item.daysUntilDue === 0 ? 'วันนี้' : 'ใน ' + item.daysUntilDue + ' วัน';
    sendNotification(
      '📅 รายการประจำใกล้ถึงกำหนด',
      (t.cat_name || t.desc) + ' ' + fmt(t.amt) + ' บาท · ครบกำหนด' + when,
    );
  });

  // 2. Low balance warning
  if (checkLowBalance(0.2)) {
    var summary = getDashboardSummary(getCurrentCycleId());
    sendNotification(
      '⚠️ ยอดเงินเหลือน้อย',
      'ยอดเงินใช้งานได้เหลือ ' + fmt(summary.activeBalance) + ' บาท',
    );
  }

  // 3. Cycle ending soon
  if (checkCycleEndingSoon(3)) {
    var s = getDashboardSummary(getCurrentCycleId());
    sendNotification(
      '🔄 รอบเงินเดือนใกล้สิ้นสุด',
      'เหลืออีก ' + s.daysRemaining + ' วัน · คงเหลือ ' + fmt(s.activeBalance) + ' บาท',
    );
  }
}

function startNotificationSchedule() {
  clearInterval(_notifCheckTimer);
  // Run once on startup (after 3s delay), then every 6 hours
  setTimeout(runNotificationChecks, 3000);
  _notifCheckTimer = setInterval(runNotificationChecks, 6 * 60 * 60 * 1000);
}

// ─── IN-APP NOTIFICATION BADGE ────────────────────────────
function renderNotificationBadge() {
  var badge = document.getElementById('notifBadge');
  if (!badge) return;
  var count = checkUpcomingRecurring(3).length +
              (checkLowBalance(0.2) ? 1 : 0) +
              (checkCycleEndingSoon(3) ? 1 : 0);
  badge.textContent = count || '';
  badge.style.display = count ? 'inline-flex' : 'none';
}

// ─── INIT ─────────────────────────────────────────────────
function initNotificationEngine() {
  _notifPermission = ('Notification' in window) ? Notification.permission : 'denied';
  renderNotificationBadge();
  if (hasNotifPermission()) startNotificationSchedule();
}
