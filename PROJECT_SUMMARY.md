# 🏠 HomeFinance — โครงสร้าง Project

**Version:** v2.6.0 | **Tech:** Modular HTML + CSS + JS + Supabase REST API + PWA  
**Status:** Production | **Deploy:** GitHub Pages

> 🆕 **v2.6 Modular**: โปรเจกต์ refactor เป็น module ย่อย (CSS 4 ไฟล์, JS 23 ไฟล์) แล้ว — เปิดผ่าน `index.html`  
> ไฟล์เดิม `household_finance.html` (single file) ยังเก็บไว้เป็น backup ทำงานได้ปกติ

---

## 📋 สารบัญ

1. [Architecture Overview](#architecture-overview)
2. [Database Schema](#database-schema)
3. [Features (Complete)](#features-complete)
4. [File & Folder Structure](#file--folder-structure)
5. [Data Flow](#data-flow)
6. [Deployment](#deployment)
7. [Configuration](#configuration)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────┐
│     Browser (Single HTML File)                  │
│  household_finance.html (4140+ lines)           │
├─────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐             │
│ │   HTML UI    │  │   CSS Theme  │             │
│ │  (8 pages)   │  │  (Dark/Light)│             │
│ └──────────────┘  └──────────────┘             │
├─────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐   │
│ │        JavaScript (2500+ lines)           │   │
│ │  • Sync & API calls                       │   │
│ │  • State management (localStorage)        │   │
│ │  • UI rendering & event handlers          │   │
│ │  • Salary cycle & budget logic            │   │
│ └───────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐             │
│ │ localStorage │  │  Supabase    │             │
│ │  (offline)   │  │  (cloud)     │             │
│ └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

---

## 💾 Database Schema (Supabase PostgreSQL)

### 1. **transactions** (Core)
```sql
CREATE TABLE transactions (
  id                TEXT PRIMARY KEY,
  date              DATE,
  type              tx_type ENUM (income|expense),
  cat_id            UUID REFERENCES categories(id),
  desc              TEXT,
  amt               NUMERIC,
  person            TEXT,
  split             BOOLEAN,
  status            tx_status ENUM (paid|received|pending),
  note              TEXT,
  item_id           UUID REFERENCES items(id),
  vendor_id         UUID REFERENCES vendors(id),
  user_id           UUID,
  created_at        TIMESTAMPTZ
);
```

### 2. **categories** (รายรับ/รายจ่าย)
```sql
CREATE TABLE categories (
  id                UUID PRIMARY KEY,
  name              TEXT,
  type              TEXT (income|expense),
  split_default     BOOLEAN,
  sort_order        INT,
  created_at        TIMESTAMPTZ
);
```

### 3. **items** (รายการรายจ่ายแต่ละหมวด)
```sql
CREATE TABLE items (
  id                UUID PRIMARY KEY,
  cat_id            UUID REFERENCES categories(id),
  name              TEXT,
  sort_order        INT,
  created_at        TIMESTAMPTZ
);
```

### 4. **vendors** (ร้านค้า/แหล่งรายรับ) [NEW]
```sql
CREATE TABLE vendors (
  id                UUID PRIMARY KEY,
  name              TEXT,
  sort_order        INT,
  created_at        TIMESTAMPTZ
);
```

### 5. **settings** (Configuration)
```sql
CREATE TABLE settings (
  key               TEXT PRIMARY KEY,
  value             JSONB
);
```

---

## ✨ Features (Complete List)

### 📊 Dashboard
- ✅ Salary cycle view (25ths-24th เดือนถัดไป)
- ✅ Pending salary auto-activate on the 25th
- ✅ 5 interactive charts (bar, donut, trend, person, status)
- ✅ Year/Month selector (ย้อนหลังได้)
- ✅ Summary metrics (รับ/จ่าย/เหลือ/รอ)
- ✅ Recent transactions (6 รายการล่าสุด)
- ✅ Pending transactions counter

### ➕ Add Entry (บันทึก)
- ✅ Income/Expense toggle
- ✅ Smart date Thai date display
- ✅ Category + Item (linked dropdown)
- ✅ Vendor selector + ⭐ favorite
- ✅ Note with history (20 recent)
- ✅ Split/Personal toggle (expense only)
- ✅ Auto-pending for early salary (23-24)
- ✅ Default status = paid/received
- ✅ Favorites for category + item + vendor

### 📋 Transaction List (รายการทั้งหมด)
- ✅ Current month default (ขึ้นเดือนนี้เสมอ)
- ✅ Multi-filter (ไม่จำกัดจำนวน):
  - Type (ประเภท) ✓ count label
  - Category (หมวด)
  - Item (รายการ) - dynamic per category
  - Vendor (ร้านค้า) ✓ NEW
  - Status (สถานะ) ✓ count label
  - Person (คน)
- ✅ Reset all filters button
- ✅ Mobile cards + Desktop table
- ✅ Vendor display (both views)
- ✅ Note indicator (📝)
- ✅ Total bar (รับ/จ่าย/รอ/สุทธิ)
- ✅ Inline edit/delete

### ✏️ Edit Modal
- ✅ All fields editable
- ✅ Vendor dropdown
- ✅ Dynamic item list per category
- ✅ Status enum (paid/received/pending)

### 🏦 Settlement
- ✅ Split only (ไม่รวม personal)
- ✅ Person-to-person payment calc
- ✅ Payment box (who owes who)
- ✅ Summary table
- ✅ Full transaction detail table
- ✅ Show/hide personal expenses
- ✅ PDF export (print-ready)

### 📈 Monthly Summary
- ✅ Month selector
- ✅ Category breakdown
- ✅ Person breakdown
- ✅ Monthly trend (6 months)

### 💰 Budget
- ✅ Category-based budgets
- ✅ Custom budget items (ท่องเที่ยว, etc)
- ✅ Progress bars (green/amber/red)
- ✅ Current month view
- ✅ Add/delete custom items
- ✅ Summary bar

### 🛠️ Settings
- ✅ Person names + IDs
- ✅ Income categories
- ✅ Expense categories
- ✅ Item management per category
- ✅ Vendor management [NEW]
- ✅ View mode toggle

### 🔄 Supabase Sync
- ✅ Pull transactions/categories/items/vendors
- ✅ Auto-sync on startup
- ✅ Silent pull every 10 min
- ✅ Online/offline indicator
- ✅ Credentials manager
- ✅ Push (upsert) all local data

### 💼 Salary Cycle [NEW]
- ✅ Fixed cycle: 25th–24th of next month
- ✅ Early salary detection (23-24)
- ✅ Auto-pending until 25th
- ✅ Auto-activate on the 25th
- ✅ Manual activation button
- ✅ Toast notifications
- ✅ Cycle dashboard card

---

## 📁 File & Folder Structure (v2.6 Modular)

```
HomeFinance/
├── index.html                ← entry point (~770 lines, ลิงก์ไปยัง CSS/JS)
├── household_finance.html    ← ไฟล์เดิม v2.5 (backup, 4140 lines, ใช้ได้อิสระ)
├── manifest.json             ← PWA manifest
├── sw.js                     ← Service Worker (cache-first static, network-first API)
├── PROJECT_SUMMARY.md        ← เอกสารนี้
├── QUICK_REFERENCE.md
├── CHANGELOG.md              ← ประวัติเวอร์ชัน
│
├── assets/
│   ├── css/
│   │   ├── base.css           ← reset, root vars, body, font
│   │   ├── layout.css         ← sidebar, topbar, bottomnav, page
│   │   ├── components.css     ← cards, metrics, table, badges, buttons, form, modal, swipe-row
│   │   └── responsive.css     ← @media (mobile/desktop), view-mobile mode
│   │
│   └── js/                    ← 23 module ย่อย โหลดแบบ defer ตามลำดับ dependency
│       ├── config.js          ← constants (SALARY_DAY, THAI_MONTHS, PALETTE, ...)
│       ├── storage.js         ← localStorage wrappers (entries, persons, items, vendors, ...)
│       ├── utils.js           ← fmt, nm, personPill, toThaiDateStr, fetchWithTimeout, ...
│       ├── nav.js             ← page navigation
│       ├── salary.js          ← salary cycle logic + auto-activate + toast
│       ├── favorites.js       ← cat/item/vendor favorites
│       ├── notes.js           ← note history (20 ล่าสุด)
│       ├── persons.js         ← person CRUD
│       ├── categories.js      ← category modal + CRUD
│       ├── items.js           ← items per category
│       ├── vendors.js         ← vendor list + fillVendors
│       ├── form.js            ← Add Entry form
│       ├── edit.js            ← Edit modal
│       ├── transactions.js    ← Transaction list + multi-filter + getFilteredTx
│       ├── dashboard.js       ← metrics, salary card, 5 charts
│       ├── settlement.js      ← split-cost + PDF export
│       ├── monthly.js         ← monthly summary
│       ├── budget.js          ← budget per category + custom items
│       ├── settings.js        ← Settings page orchestrator
│       ├── supabase.js        ← Supabase REST sync, online/offline, silentPull
│       ├── autocomplete.js    ← suggestion list
│       ├── features.js        ← v2.6: filtered CSV export, Recurring tx, PWA register
│       └── app.js             ← DOMContentLoaded startup, listeners
│
└── tests/                     ← Unit test runner (เปิดใน browser)
    ├── index.html             ← เปิดที่นี่เพื่อรัน test ทั้งหมด
    ├── suite.salary.js
    ├── suite.settlement.js
    ├── suite.budget.js
    ├── suite.recurring.js
    └── suite.csv.js
```

### โครงสร้างเดิม (single file v2.5)
```
household_finance.html (4140+ lines, 160 KB)
├── <style> ────────────────────── CSS (280 lines)
│   ├── Variables (colors, spacing, typography)
│   ├── Responsive layout (mobile/desktop)
│   ├── Dark theme support
│   ├── Animations & transitions
│   └── Multi-filter UI (.multi-filter, .mf-*)
│
├── <body> ─────────────────────── HTML (3400+ lines)
│   ├── Sidebar (nav + menu)
│   ├── Page: Dashboard
│   ├── Page: Add Entry
│   ├── Page: Transaction List
│   ├── Page: Settlement
│   ├── Page: Monthly Summary
│   ├── Page: Budget
│   ├── Page: Settings
│   ├── Page: Supabase
│   ├── Edit Modal (popup)
│   ├── Category Modal
│   ├── Item Modal
│   └── Vendor Modal [NEW]
│
└── <script> ──────────────────── JavaScript (2500+ lines)
    ├── Constants & Config
    │   ├── SALARY_DAY, EARLY_DAYS
    │   ├── SHORT_M, THAI_MONTHS
    │   ├── Theme variables
    │   └── SB_TABLE
    │
    ├── Data Management
    │   ├── localStorage keys:
    │   │   ├── hf2_entries (transactions)
    │   │   ├── hf2_persons (person list)
    │   │   ├── hf2_items (itemsData)
    │   │   ├── hf2_vendors (vendorsData) [NEW]
    │   │   ├── hf2_favs (favorites)
    │   │   ├── hf2_note_hist (note history)
    │   │   ├── hf2_budgets (budget targets)
    │   │   ├── hf2_chart (dashboard chart choice)
    │   │   ├── hf2_viewmode (dark/light)
    │   │   ├── hf2_sb_url, hf2_sb_key (credentials)
    │   │   └── hf2_*.json files
    │   │
    │   ├── In-memory:
    │   │   ├── db[] (all transactions)
    │   │   ├── categories[] (income/expense cats)
    │   │   ├── persons[] (A, B)
    │   │   ├── itemsData{catId: [...]}
    │   │   ├── vendorsData[] [NEW]
    │   │   ├── budgets{catId: amount}
    │   │   └── catMap (lookup by id)
    │
    ├── Salary Cycle [NEW]
    │   ├── getSalaryCycle(date)
    │   ├── isEarlySalary(entry)
    │   ├── salaryActivateDate(entry)
    │   ├── autoActivateSalary()
    │   └── showCycleToast(msg)
    │
    ├── Vendors [NEW]
    │   ├── loadVendorsLocal()
    │   ├── sbLoadVendors()
    │   ├── sbAddVendor(name)
    │   ├── sbDeleteVendor(id)
    │   ├── isFavVendor(name)
    │   ├── toggleFavVendor(name)
    │   ├── fillVendors()
    │   ├── populateMFVendor()
    │   ├── renderVendorList()
    │   ├── addVendor()
    │   └── deleteVendor(id)
    │
    ├── Form Functions
    │   ├── initForm() — date, persons, vendors, note
    │   ├── setType(t) — income|expense
    │   ├── updateStatusOptions() — enum per type
    │   ├── fillCats() — favorites sort
    │   ├── fillDescByCat(catId) — items only
    │   ├── fillVendors() — vendor list
    │   ├── onCatChange()
    │   ├── updateThaiDate() — salary warning
    │   ├── autoSplit() — default split logic
    │   ├── addEntry() — with salary cycle logic
    │   └── clearForm()
    │
    ├── Multi-Filter
    │   ├── toggleMF(id) — open/close dropdown
    │   ├── getMFValues(id) — get checked items
    │   ├── updateMFLabel(id, def) — count/names
    │   ├── populateMFCat()
    │   ├── populateMFPerson()
    │   ├── populateMFItem() — dynamic per cat
    │   ├── populateMFVendor() [NEW]
    │   └── resetFilters() — all to default
    │
    ├── Favorites
    │   ├── getFavs() — get object
    │   ├── saveFavs() — save to localStorage
    │   ├── isFavCat(catId)
    │   ├── isFavItem(desc)
    │   ├── isFavVendor(name) [NEW]
    │   ├── toggleFavCat(catId)
    │   ├── toggleFavItem(desc)
    │   └── toggleFavVendor(name) [NEW]
    │
    ├── Note History
    │   ├── getNoteHistory()
    │   ├── addNoteHistory(note)
    │   └── renderNoteHistory()
    │
    ├── Dashboard
    │   ├── populateDashYears()
    │   ├── populateDashMonthsByYear(y)
    │   ├── onDashYearChange()
    │   ├── renderDash() — metrics + cycle
    │   ├── renderSalaryCycleCard() [NEW]
    │   ├── activateSalaryNow() [NEW]
    │   ├── switchChart(type, month)
    │   └── renderChart* (bar/donut/trend/person/status)
    │
    ├── Transaction List
    │   ├── renderTx() — with all filters
    │   └── auto-populate filter dropdowns
    │
    ├── Edit Modal
    │   ├── openEdit(id) — populate eVendor
    │   ├── eSetType(t)
    │   ├── eUpdateDescByCat(catId)
    │   ├── saveEdit() — with vendor_id
    │   ├── closeEdit()
    │   └── delConfirm(id)
    │
    ├── Settlement
    │   ├── populateMths(selId)
    │   ├── renderSettle() — split only + toggle
    │   └── exportSettlePDF(month)
    │
    ├── Budget
    │   ├── renderBudget() — categories + custom
    │   ├── budgetRow(key, name, spent, budget)
    │   ├── addCustomBudget()
    │   └── deleteCustomBudget(key)
    │
    ├── Monthly Summary
    │   ├── renderMonthly()
    │   └── category breakdown charts
    │
    ├── Supabase Sync
    │   ├── getSbCreds()
    │   ├── saveSbCreds()
    │   ├── sbHeadersFrom(key)
    │   ├── sbLoadCategories()
    │   ├── sbLoadItems()
    │   ├── sbLoadVendors() [NEW]
    │   ├── sbLoadTransactions()
    │   ├── sbPull() — Promise.all all tables
    │   ├── sbAdd(e) — includes vendor_id
    │   ├── sbUpdate(e) — includes vendor_id
    │   ├── sbDelete(id)
    │   ├── sbAddCategory()
    │   ├── sbDeleteCategory()
    │   ├── sbAddItem()
    │   ├── sbDeleteItem()
    │   ├── sbAddVendor() [NEW]
    │   ├── sbDeleteVendor() [NEW]
    │   ├── silentPull() — auto every 10m
    │   ├── startSilentPullInterval()
    │   ├── startConnectionMonitor()
    │   └── checkOnlineForAction()
    │
    ├── Settings
    │   ├── renderSettings()
    │   ├── renderPersonList()
    │   ├── renderCatList(type)
    │   ├── renderItemCatSel()
    │   ├── renderVendorList() [NEW]
    │   ├── addPerson()
    │   ├── deletePerson(id)
    │   ├── addCategory()
    │   ├── deleteCategory(id)
    │   ├── addItem()
    │   ├── deleteItem(id)
    │   ├── addVendor() [NEW]
    │   └── deleteVendor(id) [NEW]
    │
    ├── UI Helpers
    │   ├── showMsg(elId, msg, type)
    │   ├── showCycleToast(msg) [NEW]
    │   ├── toThaiDateStr(iso)
    │   ├── toThaiDateShort(iso)
    │   ├── fmt(num) — number format
    │   ├── personPill(id)
    │   ├── applyViewMode()
    │   ├── navTo(page)
    │   ├── toggleNav()
    │   ├── todayISO()
    │   ├── closeAllSwipe()
    │   ├── buildCategoryMap()
    │   ├── buildItemsData(rows)
    │   └── names() — get person list
    │
    └── Startup (DOMContentLoaded)
        ├── Load all data from localStorage
        ├── Load Supabase credentials
        ├── Initialize theme
        ├── Set up event listeners
        ├── silentPull() data
        ├── startConnectionMonitor()
        ├── startSilentPullInterval()
        └── autoActivateSalary() [NEW]
```

---

## 🔄 Data Flow

### 1️⃣ **App Startup**
```
Page Load
  ↓
Load localStorage (entries, persons, vendors, etc)
  ↓
Load Supabase credentials (if any)
  ↓
Initialize UI + theme
  ↓
silentPull() → fetch categories, items, vendors, transactions
  ↓
renderDash() + autoActivateSalary()
  ↓
Start 10-min silent pull interval + connection monitor
```

### 2️⃣ **Add Entry**
```
User fills form (date, desc, amount, vendor)
  ↓
isEarlySalary() check → auto-pending if income 23-24
  ↓
addEntry() → save to db[] + localStorage
  ↓
sbAdd() → POST to Supabase (async)
  ↓
clearForm() + toast notification
```

### 3️⃣ **View & Filter**
```
User navigates to Transaction List
  ↓
renderTx() called
  ↓
Always rebuild:
  ├─ fltMonth dropdown (current month default)
  ├─ populateMFCat() (from categories[])
  ├─ populateMFPerson() (from persons[])
  ├─ populateMFItem() (from itemsData[selected cats])
  └─ populateMFVendor() (from vendorsData[])
  ↓
Apply all selected filters → filtered list[]
  ↓
Render mobile cards or desktop table
```

### 4️⃣ **Sync Cycle**
```
Every 10 minutes:
  ↓
silentPull() → fetch all 4 tables from Supabase
  ↓
Update local db[], categories, items, vendors
  ↓
Update UI (if on dashboard or transactions)
  ↓
Wait 10 min → repeat
```

### 5️⃣ **Salary Activation**
```
On app startup OR navigate to dashboard:
  ↓
autoActivateSalary()
  ↓
Find all pending income with _salary_cycle flag
  ↓
Check if today >= salaryActivateDate
  ↓
Set status = 'received' + sbUpdate()
  ↓
Show toast: "💰 รายรับถึงวันที่ 25 แล้ว"
```

---

## 🚀 Deployment

### GitHub Pages (Free)
```bash
# 1. Create repo: github.com/USERNAME/homefinance
# 2. Upload index.html to root
# 3. Enable Pages in Settings → Deploy from main
# 4. Access at: https://USERNAME.github.io/homefinance/

# For custom domain:
#   Add CNAME file with domain name
#   Update DNS CNAME to github.io
```

### Supabase Setup
```sql
-- Run in Supabase SQL Editor:

-- 1. Create enums
create type tx_type as enum ('income','expense');
create type tx_status as enum ('paid','received','pending');

-- 2. Create tables
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null, type text,
  split_default bool, sort_order int,
  created_at timestamptz default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid references categories(id),
  name text not null, sort_order int,
  created_at timestamptz default now()
);

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null, sort_order int,
  created_at timestamptz default now()
);

create table transactions (
  id text primary key, date date, type tx_type,
  cat_id uuid, desc text, amt numeric, person text,
  split bool, status tx_status, note text,
  item_id uuid, vendor_id uuid, user_id uuid,
  created_at timestamptz default now()
);

create table settings (
  key text primary key, value jsonb
);

-- 3. Enable RLS
alter table categories enable row level security;
alter table items enable row level security;
alter table vendors enable row level security;
alter table transactions enable row level security;
alter table settings enable row level security;

-- 4. Create public access policies
create policy "public_read" on categories for select using (true);
create policy "public_write" on categories for all using (true);
create policy "public_read" on items for select using (true);
create policy "public_write" on items for all using (true);
create policy "public_read" on vendors for select using (true);
create policy "public_write" on vendors for all using (true);
create policy "public_read" on transactions for select using (true);
create policy "public_write" on transactions for all using (true);
create policy "public_read" on settings for select using (true);
create policy "public_write" on settings for all using (true);

-- 5. Get credentials:
-- Project URL: Settings → Project settings → API
-- Anon Key: Settings → Project settings → API → Service role key
```

---

## ⚙️ Configuration

### localStorage Keys (User Preferences)
```javascript
hf2_entries       // stringified db[] transactions
hf2_persons       // [{id:'A',name:'Name'}, ...]
hf2_items         // {catId: [{id, name, sort_order}]}
hf2_vendors       // [{id, name, sort_order}] [NEW]
hf2_favs          // {cat:{}, item:{}, vendor:{}}
hf2_note_hist     // ["note1", "note2", ...]
hf2_budgets       // {catId: 5000, 'custom:ท่องเที่ยว': 2000}
hf2_chart         // 'bar'|'donut'|'trend'|'person'|'status'
hf2_viewmode      // 'dark'|'light'
hf2_sb_url        // Supabase project URL
hf2_sb_key        // Supabase anon key
```

### Theme Colors (CSS Variables)
```css
--green       #22c55e (income, balance+)
--red         #ef4444 (expense, balance-)
--amber       #f59e0b (pending)
--blue        #1a4fa0 (primary)
--surface     #ffffff (light) / #1a1a1a (dark)
--surface2    #f5f5f5 (light) / #262626 (dark)
--line        #e0e0e0 (light) / #333 (dark)
--ink         #1a1a1a (light) / #ffffff (dark)
--ink2        #666 (light) / #ccc (dark)
--ink3        #999 (light) / #888 (dark)
```

### Constants
```javascript
SALARY_DAY = 25          // Salary cycle starts on 25th
EARLY_DAYS = 2           // Can receive 2 days early (23-24)
SB_TABLE = 'transactions'
SHORT_M = ['ม.ค.', 'ก.พ.', ...] // Month abbreviations Thai
```

---

## 📊 Statistics (Current)

| Metric | Value |
|--------|-------|
| **HTML File Size** | ~160 KB |
| **Total Lines** | 4140+ |
| **HTML Lines** | 3400+ |
| **CSS Lines** | 280 |
| **JS Lines** | 2500+ |
| **Functions** | 150+ |
| **localStorage Keys** | 11 |
| **Database Tables** | 5 |
| **Pages** | 8 |
| **Features** | 50+ |
| **Responsive Breakpoint** | 900px (mobile/desktop) |

---

## 🔐 Security Notes

- ⚠️ All data stored in **public Supabase table** (no auth required)
- ✅ Browser-side encryption recommended for sensitive data
- ✅ RLS policies allow any user to read/write
- ⚠️ Not suitable for multi-user shared environment
- ✅ Perfect for personal finance tracking

---

## 🎯 Future Enhancements

- [ ] User authentication (Google/Email)
- [ ] Multi-user sharing with permissions
- [ ] Recurring transactions
- [ ] Bill reminders
- [ ] Receipt image upload
- [ ] Bank API integration
- [ ] Data export (CSV/Excel/PDF)
- [ ] Dark mode schedule
- [ ] Progressive Web App (PWA)
- [ ] Offline service worker
- [ ] Transaction tags/keywords

---

## 📞 Support

**Bug Report:** Create issue on GitHub  
**Feedback:** Email or submit GitHub discussion  
**Deploy:** Follow Deployment section above  
**Questions:** Check documentation in-app (Settings page)

---

**Last Updated:** 2024-12-20  
**Author:** HomeFinance Dev Team  
**License:** MIT
