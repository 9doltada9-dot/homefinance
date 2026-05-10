# 📋 HomeFinance — CHANGELOG

## v2.6.0 — 2026-05-10  (Modular refactor + new features)

### Refactor (BREAKING ในระดับโครงสร้างไฟล์ — runtime ทำงานเหมือนเดิม)
- **แยก `household_finance.html` (4140 บรรทัด) เป็น modular structure:**
  - `index.html` — entry point ใหม่ที่โหลด assets
  - `assets/css/{base,layout,components,responsive}.css`
  - `assets/js/*.js` — 23 module ย่อย (config, storage, utils, nav, salary, favorites, notes, persons, categories, items, vendors, form, edit, transactions, dashboard, settlement, monthly, budget, settings, supabase, autocomplete, features, app)
- ไฟล์เดิม `household_finance.html` ยังเก็บไว้เป็น backup — ยังเปิดและใช้งานได้ปกติ

### ฟีเจอร์ใหม่
- ⬇ **Export CSV ของรายการที่กรอง** — ปุ่มใหม่ในหน้า "รายการทั้งหมด" → ส่งออก CSV เฉพาะรายการที่ filter อยู่ (รองรับ comma, quote, newline ใน text)
- 🔁 **Recurring Transactions** — สร้างรายการประจำเดือน (เช่น ค่าบ้าน เงินเดือน) ที่ระบบจะสร้าง entry อัตโนมัติเมื่อถึงวันกำหนด — เข้าผ่าน Settings → "รายการประจำเดือน"
- 📱 **PWA Support** — เพิ่ม `manifest.json` + `sw.js` (cache-first สำหรับ static, network-first สำหรับ Supabase) → ติดตั้งแอปบนมือถือ/desktop ได้ และใช้งาน offline ได้สมบูรณ์ขึ้น
- 🧪 **Unit Tests** — `tests/index.html` พร้อม test suite สำหรับ salary cycle, settlement, budget, recurring, CSV escape

### ปรับปรุง
- รวมโค้ดที่ duplicate (`exportCSV`, `getFavs`, `saveFavs`) ให้เหลือ definition เดียว
- เพิ่ม `getFilteredTx()` helper ใน `transactions.js` ให้ module อื่นเรียกใช้ filter logic ได้

---

## v2.5.0 — 2024-12-20  (Production)

- เพิ่มหน้า Vendor management
- เพิ่ม Salary Cycle (25th-24th cycle, early salary auto-pending)
- เพิ่ม Multi-filter พร้อม Reset all
- เพิ่ม Settlement PDF export
- เพิ่ม 5 charts ใน Dashboard
- รองรับ Supabase sync + offline localStorage
