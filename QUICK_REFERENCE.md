# 🏠 HomeFinance — Quick Reference

## 📱 8 Pages Overview

| # | Page | Purpose | Key Features |
|---|------|---------|--------------|
| 1️⃣ | **Dashboard** | Overview | Metrics, Salary Cycle, 5 Charts, Year/Month |
| 2️⃣ | **Add Entry** | B记录 | Income/Expense, Category+Item, Vendor, Salary Cycle |
| 3️⃣ | **Transactions** | Filter & View | 6 Multi-filters, Mobile+Desktop, Vendor display |
| 4️⃣ | **Settlement** | Split calc | Who owes who, PDF export, Personal expenses toggle |
| 5️⃣ | **Monthly** | Trends | Month selector, Category breakdown, 6-month chart |
| 6️⃣ | **Budget** | Targets | Category budgets, Custom items, Progress bars |
| 7️⃣ | **Settings** | Manage | Persons, Categories, Items, Vendors |
| 8️⃣ | **Supabase** | Sync | Credentials, Manual pull, Status indicator |

---

## 🔑 Key Keyboard Shortcuts & Gestures

| Action | How |
|--------|-----|
| Navigate pages | Click sidebar menu |
| Edit transaction | Click row (desktop) or swipe (mobile) |
| Delete transaction | Swipe right → Delete button |
| Search filters | Type in multi-filter dropdowns |
| Reset all filters | Click "× รีเซ็ต" button |
| Toggle dark mode | Click 🌙 in sidebar |
| Export settlement PDF | Click "Print Settlement" button |

---

## 💾 Data Storage

### Where Data Lives
```
Browser
  ├── localStorage (offline backup)
  │   └── 11 keys (entries, vendors, budgets, etc)
  └── Supabase (cloud)
      ├── transactions (4140 max)
      ├── categories (income/expense)
      ├── items (per category)
      ├── vendors (new)
      └── settings

Auto-sync: Every 10 minutes via silentPull()
Manual-sync: Click "Pull from Supabase" in Supabase page
```

---

## 💰 Salary Cycle Rules

**Standard Flow:**
```
Entry Date → Check if < 25th?
  ├─ YES (income 23-24) → Status = "รอรับ" (pending)
  │   └─ Auto-activate on the 25th of that month
  └─ NO (>= 25th) → Status = "รับแล้ว" (received) immediately
```

**Dashboard Salary Card Shows:**
- Current cycle: 25th - 24th (next month)
- Pending salary breakdown
- "ยืนยันรับเงินทันที" button to activate manually

---

## 📊 Multi-Filter Syntax

**Select Multiple:**
1. Click filter label (e.g. "ประเภท ▾")
2. Check multiple checkboxes
3. Label shows count or names

**Example:**
- Select: Income + Expense (both checked)
- Label: "รายรับ, รายจ่าย ▾"

**Reset:**
- Click "× รีเซ็ต" → all filters clear

---

## 🎨 Favorites System

**How to Set:**
1. In **Add Entry** form:
   - Click ⭐ next to Category/Item/Vendor
   - Star fills → becomes favorite
2. Next time: Auto-selected & sorted to top

**View:**
- Favorites show with ⭐ prefix in dropdowns
- Auto-select first favorite on form load

**Clear:**
- Click ⭐ again to unfavorite

---

## 📝 Note History

**Auto-save:**
- Every note you type → saved to browser memory
- Last 20 notes kept

**Quick-pick:**
- Click any chip below Note field
- Note auto-fills

**Clear:**
- Manual delete (no bulk clear yet)

---

## 📈 Budget Tracking

**Set Budget:**
1. Go to **Budget** page
2. Enter number in "งบ" field
3. Auto-saves to localStorage

**Colors:**
- 🟢 Green: < 80% used
- 🟡 Yellow: 80-100% used
- 🔴 Red: > 100% (over budget)

**Custom Items:**
1. Add name + budget amount
2. Click "+ เพิ่ม"
3. Shows with `custom` badge
4. Click × to remove

---

## 🔄 Sync Status

**Green 🟢** = Connected to Supabase  
**Red 🔴** = Offline (using localStorage)  
**Orange 🟠** = Connecting...

**Manual Pull:**
1. Go to **Supabase** page
2. Click "Pull from Supabase Now"
3. Wait for "✓ ดึงข้อมูลเรียบร้อย"

**Manual Push:**
- Happens automatically when:
  - Add entry
  - Edit transaction
  - Delete item
  - Add vendor

---

## 🛠️ Settings Workflow

### Add Person
1. Type name in "ชื่อใหม่"
2. Click "+ เพิ่มคน"
3. Auto-assigned ID: A, B, C...

### Add Category
1. Select Type (Income/Expense)
2. Type category name
3. Click "+ เพิ่มหมวด"
4. Appears in dropdown immediately

### Add Item (per Category)
1. Select category
2. Type item name
3. Click "+ เพิ่มรายการ"
4. Shows in Item dropdown when that category selected

### Add Vendor
1. Type vendor name
2. Click "+ เพิ่ม"
3. Can favorite with ⭐
4. Appears in Vendor dropdown

---

## 📍 Vendor Display

**Mobile Card:**
- Shows vendor name in gray pill after category

**Desktop Table:**
- Dedicated "ร้านค้า" column
- Shows vendor name or "—" if none

**Edit Modal:**
- Dropdown selector with all vendors
- Can be left blank (— ไม่ระบุ)

---

## 📱 Mobile vs Desktop

**Responsive Breakpoint:** 900px width

### Mobile (< 900px)
- Sidebar collapses (hamburger ☰)
- Swipeable transaction cards
- Stacked forms (vertical)
- Bottom navigation optional
- Full-width filters

### Desktop (>= 900px)
- Sidebar always visible
- Table view for transactions
- Side-by-side forms
- More compact layout

---

## 🔐 Supabase Setup Checklist

- [ ] Create Supabase project
- [ ] Run 5 CREATE TABLE statements
- [ ] Enable RLS on all tables
- [ ] Create 10 public access policies
- [ ] Copy Project URL → paste in app Settings
- [ ] Copy Anon Key → paste in app Settings
- [ ] Test Pull from Supabase

**Common Issues:**
- ❌ Tables not created → Run SQL first
- ❌ Can't sync → Check URL & key
- ❌ 404 errors → Verify table names in SQL
- ❌ Policies blocked → Enable RLS + create policies

---

## 💡 Tips & Tricks

1. **Bulk Pending:** Add multiple entries before the 25th, auto-pending
2. **Favorites:** Set ⭐ for frequently used category/vendor
3. **PDF Export:** Settlement → Print → Save as PDF (browser)
4. **Month View:** Use Monthly page to check trends
5. **Budget Alert:** Check Budget page to see % used
6. **Personal Expense:** Mark split=false for solo purchases
7. **Offline Mode:** Works fine without internet (sync later)
8. **Dark Mode:** Toggle 🌙 anytime (saved in settings)
9. **Note Search:** Quick-pick from history instead of typing
10. **Reset All:** Use "× รีเซ็ต" to clear all filters at once

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Data not showing | Click sidebar → Dashboard (refresh) |
| Filter not working | Check if "เลือกทั้งหมด" (select all) is active |
| Vendor not showing | Add vendors in Settings first |
| Salary not activating | Check auto-activate ran (app startup or Dashboard nav) |
| Sync failing | Check Supabase credentials in Settings |
| Mobile layout broken | Check window size (try rotate phone) |
| Dark mode not saving | Try refresh (localStorage might be full) |
| Notes lost | Reload app (check Browser Dev Tools > Storage) |

---

## 📊 Example Workflows

### Workflow 1: Daily Entry
```
1. Go to "Add Entry" → "รายจ่าย"
2. Pick today's date
3. Select category (favorite auto-picks)
4. Select item from category
5. Add vendor (optional)
6. Enter amount
7. Click "บันทึกเรียบร้อย"
8. → Syncs to Supabase in background
```

### Workflow 2: Month-End Settlement
```
1. Go to "Settlement"
2. Pick month
3. Check "แสดงรายจ่ายส่วนตัว" if needed
4. Note who owes who from payment box
5. Click "Export Settlement PDF"
6. Print or share screenshot
```

### Workflow 3: Set Monthly Budget
```
1. Go to "Budget"
2. For each expense category:
   - Enter budget amount
   - See progress bar (green/amber/red)
3. Add custom item (e.g. "ท่องเที่ยว 2000")
4. Monitor throughout month
5. Adjust as needed
```

### Workflow 4: Sync to Cloud
```
1. Entry added → Auto-syncs in background
2. Or manually: Go to "Supabase" → Pull Now
3. Check green 🟢 indicator = online
4. Old data persists in localStorage (offline)
```

---

**Last Updated:** 2024-12-20  
**Quick Ref v1.0**
