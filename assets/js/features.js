/* HomeFinance · module: features.js · v2.6.0
 * ฟีเจอร์ที่เพิ่มหลังจาก refactor:
 *   1. exportFilteredCSV — ดาวน์โหลด CSV เฉพาะรายการที่ filter อยู่
 *   2. Recurring Transactions — รายการประจำ ทำซ้ำทุกเดือน
 *   3. PWA registration (sw.js)
 */

// ─── 1. CSV EXPORT (ของที่กรองอยู่) ───────────────────────
/**
 * ใช้ filter เดียวกับ renderTx() เพื่อดึง list ที่แสดงอยู่
 * แล้ว serialize เป็น CSV ที่ Excel เปิดได้ (BOM + escape)
 */
function exportFilteredCSV(){
  var rows = (typeof getFilteredTx === 'function') ? getFilteredTx() : (typeof db !== 'undefined' ? db.slice() : []);
  if (!rows.length){
    alert('ไม่มีรายการที่ตรงกับ filter — เปลี่ยน filter แล้วลองใหม่');
    return;
  }
  var header = ['วันที่','ประเภท','หมวด','รายการ','ร้านค้า','จำนวน','ผู้บันทึก','หาร2','สถานะ','หมายเหตุ'];
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
    lines.push([
      e.date,
      e.type === 'income' ? 'รายรับ' : 'รายจ่าย',
      e.cat_name || '',
      e.desc || '',
      vendorName,
      e.amt,
      (typeof nm === 'function' ? nm(e.person) : e.person),
      e.split ? 'TRUE' : 'FALSE',
      e.status || '',
      e.note || ''
    ].map(esc).join(','));
  });
  var csv = '﻿' + lines.join('\r\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'home_finance_' + new Date().toISOString().split('T')[0] + '_' + rows.length + 'rows.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
}

// ─── 2. RECURRING TRANSACTIONS ────────────────────────────
/**
 * เก็บ template ของรายการประจำใน localStorage key: hf2_recurring
 * โครงสร้าง: [{id, type, cat_id, cat_name, desc, amt, person, split, status, note,
 *              vendor_id, item_id, day_of_month, last_run_yyyymm}]
 *
 * ตอน startup: ตรวจว่าเดือนปัจจุบัน + วันถึง day_of_month หรือยัง
 * ถ้าใช่ และยังไม่ได้รันเดือนนี้ → สร้าง entry ใหม่ + อัพเดท last_run
 */
function getRecurringList(){
  try { return JSON.parse(localStorage.getItem('hf2_recurring') || '[]'); }
  catch(_) { return []; }
}
function saveRecurringList(list){
  localStorage.setItem('hf2_recurring', JSON.stringify(list));
}

function addRecurring(template){
  var list = getRecurringList();
  template.id = 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
  template.last_run_yyyymm = '';
  list.push(template);
  saveRecurringList(list);
  return template.id;
}

function deleteRecurring(id){
  var list = getRecurringList().filter(function(t){ return t.id !== id; });
  saveRecurringList(list);
}

/**
 * ตรวจและสร้าง entry ที่ถึงกำหนดในเดือนนี้
 * เรียกตอน startup และทุก ๆ ชั่วโมงโดยอัตโนมัติ
 */
function processRecurring(){
  if (typeof db === 'undefined') return 0;
  var today = new Date();
  var yyyymm = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0');
  var todayDay = today.getDate();
  var list = getRecurringList();
  var created = 0;
  var changed = false;

  list.forEach(function(t){
    if (t.last_run_yyyymm === yyyymm) return;
    if (todayDay < (t.day_of_month || 1)) return;
    // create transaction
    var entryDate = yyyymm + '-' + String(t.day_of_month || 1).padStart(2,'0');
    var newEntry = {
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2,8),
      date: entryDate,
      type: t.type || 'expense',
      cat_id: t.cat_id || null,
      cat_name: t.cat_name || '',
      desc: t.desc || '',
      amt: Number(t.amt) || 0,
      person: t.person || 'A',
      split: !!t.split,
      status: t.status || (t.type === 'income' ? 'received' : 'paid'),
      note: (t.note || '') + ' [auto]',
      vendor_id: t.vendor_id || null,
      item_id: t.item_id || null,
      _recurring_template_id: t.id,
    };
    db.push(newEntry);
    if (typeof save === 'function') save();
    if (typeof sbAdd === 'function') sbAdd(newEntry);
    t.last_run_yyyymm = yyyymm;
    changed = true;
    created++;
  });

  if (changed) saveRecurringList(list);
  return created;
}

function renderRecurringList(){
  var box = document.getElementById('recurringList');
  if (!box) return;
  var list = getRecurringList();
  if (!list.length){
    box.innerHTML = '<div class="empty">ยังไม่มีรายการประจำ — กดปุ่มด้านบนเพื่อเพิ่ม</div>';
    return;
  }
  box.innerHTML = list.map(function(t){
    var typeLbl = t.type === 'income' ? '<span class="badge badge-income">รายรับ</span>' : '<span class="badge badge-expense">รายจ่าย</span>';
    var amtFmt  = (typeof fmt === 'function') ? fmt(t.amt) : t.amt;
    var lastRun = t.last_run_yyyymm ? '· เดือนล่าสุด: '+t.last_run_yyyymm : '· ยังไม่เคยทำงาน';
    return '<div class="settings-row" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">'
      +   '<div style="flex:1;min-width:0">'
      +     '<div style="font-size:13px;font-weight:500">'+typeLbl+' '+(t.cat_name || '')+' — '+(t.desc || '(ไม่มีคำอธิบาย)')+'</div>'
      +     '<div style="font-size:11px;color:var(--ink3);margin-top:2px">วันที่ '+(t.day_of_month || 1)+' ของเดือน · '+amtFmt+' บาท · '+(typeof nm === 'function' ? nm(t.person) : t.person)+' '+lastRun+'</div>'
      +   '</div>'
      +   '<button class="btn-del" onclick="onDeleteRecurring(\''+t.id+'\')">ลบ</button>'
      +'</div>';
  }).join('');
}

function onDeleteRecurring(id){
  if (!confirm('ลบรายการประจำนี้?')) return;
  deleteRecurring(id);
  renderRecurringList();
}

function onAddRecurring(){
  // ใช้ form ง่าย ๆ แบบ prompt ก่อน (มี modal สวย ๆ ในเฟสถัดไป)
  var typ = (prompt('ประเภท: income หรือ expense', 'expense') || '').trim();
  if (typ !== 'income' && typ !== 'expense') return;
  // เลือก category จาก list ที่มี
  var catList = (typeof categories !== 'undefined' ? categories : []).filter(function(c){ return c.type === typ; });
  if (!catList.length){ alert('ยังไม่มีหมวดหมู่ — เพิ่มใน Settings ก่อน'); return; }
  var catNames = catList.map(function(c,i){ return (i+1)+'. '+c.name; }).join('\n');
  var idx = parseInt(prompt('เลือกหมวด:\n'+catNames, '1'), 10);
  if (!idx || idx < 1 || idx > catList.length) return;
  var cat = catList[idx-1];
  var desc = (prompt('คำอธิบายสั้น ๆ', cat.name) || '').trim();
  var amt = parseFloat(prompt('จำนวนเงิน', '0'));
  if (!amt || amt <= 0) return;
  var day = parseInt(prompt('วันที่ของเดือน (1-31)', '1'), 10);
  if (!day || day < 1 || day > 31) return;
  var person = (prompt('ผู้บันทึก (A หรือ B)', 'A') || 'A').toUpperCase();
  var split = (typ === 'expense') && confirm('หาร 2 ระหว่างคู่หรือไม่? (OK = ใช่)');

  addRecurring({
    type: typ,
    cat_id: cat.id,
    cat_name: cat.name,
    desc: desc,
    amt: amt,
    day_of_month: day,
    person: person,
    split: split,
  });
  renderRecurringList();
  if (typeof showCycleToast === 'function') showCycleToast('เพิ่มรายการประจำแล้ว');
}

// ─── 3. PWA REGISTRATION ──────────────────────────────────
function registerServiceWorker(){
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.protocol !== 'file:'){
    // OK to skip on plain http
  }
  // file: protocol can't register SW — bail out silently
  if (location.protocol === 'file:') return;
  try {
    navigator.serviceWorker.register('sw.js').catch(function(err){
      console.warn('[HomeFinance] SW register failed:', err && err.message);
    });
  } catch(_){}
}

// ─── 4. AUTO-RUN HOOKS ────────────────────────────────────
// เรียกตอน app พร้อม โดย app.js ผูก DOMContentLoaded ให้
function initFeatures(){
  try {
    var n = processRecurring();
    if (n > 0 && typeof showCycleToast === 'function'){
      showCycleToast('สร้างรายการประจำ '+n+' รายการ');
    }
  } catch(err){ console.warn('[features] processRecurring err', err); }
  try { registerServiceWorker(); } catch(err){ console.warn('[features] SW err', err); }
  // ทำซ้ำทุก 1 ชั่วโมงเผื่อแอปเปิดทิ้งไว้ข้ามวัน
  setInterval(function(){
    try { processRecurring(); } catch(_){}
  }, 60 * 60 * 1000);
}
