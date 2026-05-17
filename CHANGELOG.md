# 📋 HomeFinance — CHANGELOG

## v3.10.2 — 2026-05-16

### fix: แสดงเศษสตางค์ (ทศนิยม) ในการแสดงผลตัวเลขทุกหน้า

- `fmt(n)` และ `fmtB(n)` ใน utils.js — ปัดเศษสูงสุด 2 ตำแหน่ง
- ถ้าไม่มีเศษ (เช่น 15000.00) → แสดงเป็น 15,000 (ไม่มี .00)
- ถ้ามีเศษ (เช่น 1450.50) → แสดงเป็น 1,450.50
- ครอบคลุมทุกหน้า: Dashboard, Transactions, Settlement, Report, PDF Export


## v3.10.1 — 2026-05-16

### fix: dashboard charts use _allProfiles UUID correctly

- เพิ่ม `_getChartUsers()` — build chart user list จาก `_allProfiles` (UUID) + legacyId mapping ไปยัง A/B
- เพิ่ม `_isEntryByUser(e, user)` — match entry กับ user ถูกต้องทั้ง UUID (entry ใหม่) และ A/B (entry เก่า)
- แก้ bar chart + person chart ไม่แสดงข้อมูลเมื่อ `p.user_id` เป็น null (persons ยังไม่ได้ link)
- desktop table: แก้ person column ใช้ `nm(e.user_id||e.person)` แทน `_personName(e.person)`
- ลบ `var n=names()` ที่ไม่ได้ใช้ใน renderTx()


## v3.10.0 — 2026-05-16

### feat: refactor person system → user system (UUID-based)

- **utils.js** `nm(pid)` — resolve UUID via `_allProfiles` first, fallback to A/B persons array
- **utils.js** `names()` — build name map from `_allProfiles` when available  
- **utils.js** `personPill(pid)` — support UUID as pid, index color by profile order
- **auth.js** `getCurrentPerson()` — now returns Supabase `user_id` (UUID) directly; no more A/B mapping
- **persons.js** `populatePersonSelects()` — populate fPerson/ePerson selects with UUID values from `_allProfiles`
- **dashboard.js** bar + person charts — filter by `e.user_id === p.user_id || e.person === p.id` (backward compat)
- **transactions.js** mobile card — show person name from `e.user_id || e.person` via `nm()`
- **transactions.js** `_personName()` — delegates to `nm()` for unified UUID + A/B resolution
- **form.js** `addEntry()` — set `user_id` on new local entry (matches what sbAdd sends to Supabase)
- **edit.js** `openEdit()` — prefer `e.user_id` over `e.person` for ePerson select
- **edit.js** save — update both `e.person` and `e.user_id` from ePerson select value
- **features.js** CSV export — person column uses `nm(e.user_id || e.person)`
- **supabase.js** CSV export — same fix
- **report.js** admin report — `personPill(e.user_id || e.person)`
- **accounts.js** — remove hardcoded `'A'` fallbacks → use `getCurrentPerson()` or `null`
- **recurringEngine.js** — replace `'A'` fallback with `getCurrentPerson()` or `null`

**ผลลัพธ์:** ทุกหน้าแสดงชื่อผู้ใช้จาก Supabase profiles โดยตรง ไม่มีชื่อ ต้น/เจี๊ยบ hardcode
**Backward compat:** ข้อมูลเก่าที่ใช้ person A/B ยังคงทำงานได้ปกติ


## v3.9.11 — 2026-05-16  (Settlement on-the-fly snapshot fix)

### แก้บัค
- 🐛 **Settlement แสดง "ไม่มียอดค้างชำระ" ผิดพลาด** — เมื่อรายการมี `split_group_id` แต่ไม่มี `split_snapshot` (รายการเก่าที่บันทึกก่อนระบบ snapshot) ตอนนี้จะสร้าง snapshot on-the-fly จากนิยามกลุ่มปัจจุบัน ทำให้คำนวณการโอนเงินได้ถูกต้อง
- 🐛 **PDF Export** — แก้บัคเดียวกันใน `exportSettlePDF()` ด้วย

---

## v3.3.1 — 2026-05-12  (Transfer type — modular)

### ฟีเจอร์ใหม่
- ➕ **ประเภทรายการ "โอน/ฝาก" (transfer)** — เพิ่มปุ่มที่ 3 ในส่วนเลือกประเภท
  - รายการ transfer **ไม่นับ** ในยอดรายรับรวมและยอดรายจ่ายรวม
  - ซ่อนช่องหมวดหมู่อัตโนมัติ (ใช้ค่า `cat_name = 'โอนเงิน'` แทน)
  - ซ่อน split section (ไม่หาร 2)
  - สถานะ: "โอนแล้ว" / "รอโอน"
- 🏷️ **Badge สีฟ้า** — แสดง ⇄ และ badge "โอน" สีฟ้าในหน้ารายการ (ทั้ง mobile card และ desktop table)
- 🔍 **Filter "โอน/ฝาก"** — เพิ่มตัวเลือก transfer ในช่อง filter ประเภท
- 📊 **Total bar แยก** — หน้ารายการแสดง "โอน/ฝาก (n)" แยกต่างหาก (ปรากฏเฉพาะเมื่อมีรายการโอน)

### SQL สำหรับ Supabase (รันใน SQL Editor — type column เป็น ENUM `tx_type`)
```sql
-- เพิ่ม value 'transfer' เข้า ENUM tx_type
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'transfer';
```

---

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
