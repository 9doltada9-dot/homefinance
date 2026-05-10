/* HomeFinance · module: settings.js · v2.6.0 */

// ─── SETTINGS ─────────────────────────────────────────────
function renderSettings(){
  applyViewMode();
  renderPersonList();
  renderCatList('income');
  renderCatList('expense');
  renderItemCatSel();
  renderVendorList();
  // v2.6: รายการประจำเดือน (อยู่ใน features.js)
  if (typeof renderRecurringList === 'function') renderRecurringList();
}
