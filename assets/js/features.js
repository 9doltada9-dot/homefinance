/* HomeFinance · module: features.js · v3.0.0
 * ฟีเจอร์หลักที่ไม่ได้อยู่ใน module เฉพาะ:
 *   1. exportFilteredCSV  — export CSV พร้อม billing_month (v3)
 *   2. registerServiceWorker — PWA
 *
 * NOTE: Recurring Transactions ย้ายไปอยู่ใน recurringEngine.js แล้ว
 */

// ─── 1. CSV EXPORT (v3 — รวม billing_month + cycle_id) ───
function exportFilteredCSV(){
  var rows = (typeof getFilteredTx === 'function') ? getFilteredTx()
           : (typeof db !== 'undefined' ? db.slice() : []);
  if (!rows.length){
    alert('ไม่มีรายการที่ตรงกับ filter — เปลี่ยน filter แล้วลองใหม่');
    return;
  }

  var header = [
    'วันที่ (transaction_date)',
    'เดือนบิล (billing_month)',
    'รอบเงินเดือน (cycle_id)',
    'ประเภท','หมวด','รายการ','ร้านค้า',
    'จำนวน','ผู้บันทึก','หาร2','สถานะ','หมายเหตุ'
  ];

  var esc = function(v){
    var s = (v === null || v === undefined) ? '' : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
    return s;
  };

  var lines = [header.map(esc).join(',')];

  rows.forEach(function(e){
    var vendorName = '';
    if (e.vendor_name) vendorName = e.vendor_name;
    else if (e.vendor_id && typeof vendorsData !== 'undefined'){
      var v = vendorsData.find(function(x){ return x.id === e.vendor_id; });
      if (v) vendorName = v.name;
    }

    // v3: resolve billing_month and cycle_id with fallbacks
    var billingMonth = e.billing_month || (e.date ? e.date.slice(0,7) : '');
    var cycleId      = e.cycle_id      ||
                       (typeof cycleIdFromDate === 'function' ? cycleIdFromDate(e.date) : '');

    lines.push([
      e.date,
      billingMonth,
      cycleId,
      e.type === 'income' ? 'รายรับ' : (e.type === 'transfer' ? 'โอน' : 'รายจ่าย'),
      e.cat_name || '',
      e.desc || '',
      vendorName,
      e.amt,
      (typeof nm === 'function' ? nm(e.user_id||e.person) : (e.user_id||e.person)),
      e.split ? 'TRUE' : 'FALSE',
      e.status || '',
      e.note || ''
    ].map(esc).join(','));
  });

  var csv  = '﻿' + lines.join('\r\n'); // BOM for Excel Thai
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a    = document.createElement('a');
  a.href  = URL.createObjectURL(blob);
  a.download = 'home_finance_' + new Date().toISOString().split('T')[0] +
               '_' + rows.length + 'rows.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
}

// ─── 2. PWA SERVICE WORKER ────────────────────────────────
function registerServiceWorker(){
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return; // can't register from file://
  try {
    navigator.serviceWorker.register('sw.js').catch(function(err){
      console.warn('[HomeFinance] SW register failed:', err && err.message);
    });
  } catch(_){}
}
