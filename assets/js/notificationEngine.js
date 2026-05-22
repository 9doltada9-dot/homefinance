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

// ─── BALANCE STATUS ───────────────────────────────────────
/**
 * ตรวจสอบสถานะยอดเงิน — คืน { negative, low, balance }
 * negative: ยอดเงินติดลบ
 * low: ยอดเงินต่ำกว่า 20% ของรายรับ (แต่ไม่ติดลบ)
 */
function _checkBalanceStatus() {
  try {
    var summary = getDashboardSummary(getCurrentCycleId());
    if (!summary) return { negative: false, low: false, balance: 0 };
    var neg = summary.activeBalance < 0;
    var low = !neg && !!summary.received && summary.activeBalance < summary.received * 0.2;
    return { negative: neg, low: low, balance: summary.activeBalance };
  } catch(_) { return { negative: false, low: false, balance: 0 }; }
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
  var results = [];

  // 1. ตรวจยอดเงิน (ทำงานเสมอ ไม่ต้องรอ push permission)
  var bs = _checkBalanceStatus();
  if (bs.negative) {
    results.push({ type: 'error', msg: '🔴 ยอดเงินติดลบ ' + (typeof fmt === 'function' ? fmt(bs.balance) : bs.balance) + ' บาท' });
    if (hasNotifPermission()) sendNotification('🔴 ยอดเงินติดลบ!', 'ยอดเงิน ' + (typeof fmt === 'function' ? fmt(bs.balance) : bs.balance) + ' บาท');
  } else if (bs.low) {
    results.push({ type: 'warn', msg: '⚠️ ยอดเงินเหลือน้อย ' + (typeof fmt === 'function' ? fmt(bs.balance) : bs.balance) + ' บาท' });
    if (hasNotifPermission()) sendNotification('⚠️ ยอดเงินเหลือน้อย', 'ยอดเงินใช้งานได้เหลือ ' + (typeof fmt === 'function' ? fmt(bs.balance) : bs.balance) + ' บาท');
  }

  if (hasNotifPermission()) {
    // 2. Upcoming recurring bills
    var upcoming = checkUpcomingRecurring(3);
    upcoming.forEach(function(item) {
      var t    = item.template;
      var when = item.daysUntilDue === 0 ? 'วันนี้' : 'ใน ' + item.daysUntilDue + ' วัน';
      sendNotification('📅 รายการประจำใกล้ถึงกำหนด', (t.cat_name || t.desc) + ' ' + (typeof fmt === 'function' ? fmt(t.amt) : t.amt) + ' บาท · ครบกำหนด' + when);
      results.push({ type: 'info', msg: '📅 ' + (t.cat_name || t.desc) + ' ครบกำหนด' + when });
    });

    // 3. Cycle ending soon
    if (checkCycleEndingSoon(3)) {
      var s = getDashboardSummary(getCurrentCycleId());
      sendNotification('🔄 รอบเงินเดือนใกล้สิ้นสุด', 'เหลืออีก ' + s.daysRemaining + ' วัน · คงเหลือ ' + (typeof fmt === 'function' ? fmt(s.activeBalance) : s.activeBalance) + ' บาท');
      results.push({ type: 'info', msg: '🔄 รอบเงินเดือนใกล้สิ้นสุด เหลือ ' + s.daysRemaining + ' วัน' });
    }
  }

  // อัปเดต in-app status text ในหน้าตั้งค่า
  var statusEl = document.getElementById('notifStatusText');
  if (statusEl) {
    if (!results.length) {
      statusEl.style.cssText = 'font-size:12px;color:var(--green)';
      statusEl.textContent = '✅ ยอดเงินปกติ';
    } else {
      statusEl.style.cssText = 'font-size:12px';
      statusEl.innerHTML = results.map(function(r) {
        var color = r.type === 'error' ? 'var(--red)'
                  : r.type === 'warn'  ? 'var(--amber)'
                  : 'var(--ink2)';
        var weight = r.type === 'error' ? '700' : '500';
        return '<span style="color:' + color + ';font-weight:' + weight + '">' + r.msg + '</span>';
      }).join('<br>');
    }
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
  try {
    var bs = _checkBalanceStatus();
    var count = checkUpcomingRecurring(3).length +
                (bs.negative || bs.low ? 1 : 0) +
                (checkCycleEndingSoon(3) ? 1 : 0);
    badge.textContent = count || '';
    badge.style.display = count ? 'inline-flex' : 'none';
    // badge สีแดงถ้าติดลบ
    badge.style.background = bs.negative ? 'var(--red)' : 'var(--blue)';
  } catch(_) {
    badge.textContent = '';
    badge.style.display = 'none';
  }
}

// ─── INIT ─────────────────────────────────────────────────
function initNotificationEngine() {
  _notifPermission = ('Notification' in window) ? Notification.permission : 'denied';
  renderNotificationBadge();
  if (hasNotifPermission()) startNotificationSchedule();
}
