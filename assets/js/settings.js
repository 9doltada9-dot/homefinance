/* HomeFinance · module: settings.js · v3.0.0 */

// ─── SETTINGS ─────────────────────────────────────────────
function renderSettings(){
  applyViewMode();
  renderPersonList();
  renderCatList('income');
  renderCatList('expense');
  renderItemCatSel();
  renderVendorList();
  // v3: รายการประจำเดือน
  if (typeof renderRecurringList === 'function') renderRecurringList();
  // v3: notification permission status
  var notifStatus = document.getElementById('notifStatusText');
  if (notifStatus && 'Notification' in window) {
    var p = Notification.permission;
    notifStatus.textContent = p === 'granted' ? '✅ เปิดอยู่'
                            : p === 'denied'  ? '🚫 ถูกบล็อก (แก้ที่ browser settings)'
                            : '⬜ ยังไม่ได้เปิด';
  }
}
