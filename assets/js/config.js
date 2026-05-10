/* HomeFinance · module: config.js · v2.5.0 */

// ─── DEFAULT CATS ─────────────────────────────────────────
var DEFAULT_INCOME_CATS = ['เงินเดือน','ผ่อน/ผลตอบแทน','ผลพิเศษ','โบนัส','รายได้อื่นๆ'];
var DEFAULT_EXPENSE_CATS = ['ค่าบ้าน','ค่าน้ำ','ค่าไฟ','ค่าอินเตอร์เน็ต','ค่าโทรศัพท์','ค่าส่วนกลางที่ดิน','ค่าส่วนกลางบ้าน','ส่งให้พ่อแม่','ค่าอาหารลูก','ค่าของใช้ครัวเรือน','ค่าของใช้ส่วนตัว','อื่นๆ'];
var DEFAULT_NO_SPLIT = ['ส่งให้พ่อแม่','ค่าของใช้ส่วนตัว'];

// ─── SUPABASE TABLES ─────────────────────────────────────
var SB_SETTINGS_TABLE = 'settings';
var SB_TABLE = 'transactions';

// ─── SUPABASE DEFAULT CREDENTIALS ────────────────────────
var SB_URL_DEFAULT = 'https://ceudxjghmetbyejhjcxg.supabase.co';
var SB_KEY_DEFAULT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNldWR4amdobWV0YnllamhqY3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTMyMTIsImV4cCI6MjA5MjQyOTIxMn0.CLZ-D4oLSX9B7AdzKcyorPgNK2rShLJogXmCkQfpNiA';

// ─── SALARY CYCLE ─────────────────────────────────────────
var SALARY_DAY = 25;        // รอบเงินเดือน เริ่มทุกวันที่ 25
var EARLY_DAYS = 2;         // รับก่อนได้สูงสุด 2 วัน (23, 24)

// ─── THAI DATE/TIME ───────────────────────────────────────
var THAI_DAYS   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
var THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                   'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
var SHORT_M = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

// ─── COLOR PALETTE ────────────────────────────────────────
var PALETTE = ['#4f85f6','#f97316','#22c55e','#a855f7','#ec4899','#14b8a6','#eab308','#ef4444','#6366f1','#84cc16','#f43f5e','#64748b'];
