# Handoff: HomeFinance — Liquid Glass re-skin

## ภาพรวม (Overview)
เปลี่ยนหน้าตา HomeFinance (PWA การเงินครัวเรือน ภาษาไทย, v3.16.33) ทั้งแอปให้เป็นสไตล์ **liquid glass** — กระจกฝ้า โปร่งแสง พื้นหลัง mesh พาสเทลเคลื่อนไหว รองรับ light/dark — โดย **ไม่เปลี่ยนโครงสร้าง, ฟังก์ชัน, หรือ logic เดิมเลย**

แอปเดิมเป็น **modular HTML + CSS + JS (vanilla) + Supabase REST + PWA** โหลด stylesheet 4 ไฟล์ตามลำดับ: `base.css → layout.css → components.css → responsive.css`

---

## สิ่งที่ต้องทำ (The task) — อ่านก่อน
งานนี้ **ไม่ใช่** การสร้าง UI ใหม่ด้วย React/framework ไฟล์ในชุดนี้ **คือโค้ดที่ใช้ได้จริง** ไม่ใช่แค่ภาพ mockup

**`glass-overlay.css` คือ deliverable หลัก** — เป็น CSS layer เดียวที่ "ครอบทับ" (override) class และ CSS variables เดิมของแอป งานของ Claude Code คือ:
1. **ติดตั้ง** ไฟล์นี้เข้า codebase จริง (ดูขั้นตอนด้านล่าง)
2. **ตรวจสอบทุกหน้า** (8 หน้า) ในเบราว์เซอร์จริงว่าเอฟเฟกต์กระจกขึ้นถูกต้อง ไม่มี element ไหนอ่านไม่ออก / contrast ตก
3. **ปรับจูน** ค่าตามที่เจ้าของอยากได้ (สีหลัก, ความเข้มเบลอ, sidebar เข้ม/อ่อน)

> ทำไมเป็น overlay ไม่ใช่แก้ไฟล์เดิม: ปลอดภัยสุด ย้อนกลับได้ทันที (แค่ลบ `<link>` 1 บรรทัด) และไม่เสี่ยงต่อ logic การเงิน/Supabase/auth ที่อยู่ใน JS

---

## Fidelity
**High-fidelity.** สี ความโปร่ง รัศมีขอบ เงา และ token ทั้งหมดเป็นค่าสุดท้ายที่ตั้งใจให้ใช้จริง ทำตามค่าใน `glass-overlay.css` ได้เลย

---

## วิธีติดตั้ง (Integration steps)
1. วางไฟล์ `glass-overlay.css` ที่ `assets/css/glass-overlay.css`
2. ใน `index.html` เพิ่ม `<link>` **บรรทัดสุดท้าย ต่อจาก `responsive.css`** (ลำดับสำคัญ — ต้องมาหลังสุดเพื่อ override ชนะ):
   ```html
   <link rel="stylesheet" href="assets/css/base.css">
   <link rel="stylesheet" href="assets/css/layout.css">
   <link rel="stylesheet" href="assets/css/components.css">
   <link rel="stylesheet" href="assets/css/responsive.css">
   <link rel="stylesheet" href="assets/css/glass-overlay.css">  <!-- เพิ่มบรรทัดนี้ -->
   ```
3. (ออปชัน) ถ้าจะล็อกธีม ใส่ attribute ที่ `<html>`: `data-theme="light"` หรือ `data-theme="dark"`

ไม่ต้องแก้ HTML element หรือ JS ใด ๆ

---

## หลักการของ overlay (สำคัญต่อการแก้/ขยายต่อ)
- **ห้ามแตะ `--ink`** — แอปเดิมใช้ `--ink` (#0f0f0f) เป็น **ทั้ง** สีตัวอักษรหลัก, พื้น `.sidebar`, พื้น `.topbar/.bottomnav`, และพื้น `.btn-primary` ถ้ารีแมป `--ink` จะพังหลายจุดพร้อมกัน → overlay จึง override พื้นหลังของ element เหล่านั้น "เป็นรายตัว" แทน
- **รีแมปเฉพาะ** `--surface`, `--surface2`, `--line`, `--line2`, `--accent` ให้โปร่งแสง/เป็นโทนกระจก
- เพิ่ม `backdrop-filter: blur() saturate()` ที่ container หลัก (`.card .metric .sidebar .topbar .bottomnav .mf-dropdown` ฯลฯ)
- พื้นหลัง mesh เคลื่อนไหวฉีดผ่าน `body::before` (orbs 4 จุด) + `body::after` (grain) — z-index ติดลบ อยู่หลัง content; ปิดอัตโนมัติเมื่อ `prefers-reduced-motion`
- หลาย rule ใช้ `!important` เพราะต้องชนะทั้ง rule เดิมที่ specificity เท่ากันและ inline style จำนวนมากในแอป

---

## Design Tokens (อยู่ใน `:root` ของ glass-overlay.css)

### Light (ค่าเริ่มต้น)
| Token | ค่า | ใช้กับ |
|---|---|---|
| `--accent` | `#6366f1` (indigo) | ปุ่ม primary, nav active, focus, ลิงก์ |
| `--accent-2` | `#8b5cf6` | ปลายไล่เฉดของ accent |
| `--accent-soft` | `rgba(99,102,241,.16)` | พื้นอ่อน, hover |
| `--surface` | `rgba(255,255,255,.60)` | พื้นการ์ด/ฟอร์ม (โปร่ง) |
| `--surface2` | `rgba(255,255,255,.40)` | พื้นรอง |
| `--line` | `rgba(92,104,158,.16)` | เส้นแบ่ง/ขอบ |
| `--g-card` | `rgba(255,255,255,.58)` | พื้นกระจกการ์ด |
| `--g-strong` | `rgba(255,255,255,.74)` | กระจกทึบขึ้น (dropdown) |
| `--g-brd` | `rgba(255,255,255,.65)` | ขอบกระจก (rim light) |
| `--g-blur` | `22px` | ความเข้มเบลอ |
| `--g-sat` | `170%` | saturate ของ backdrop |
| `--bg-base` | `#eceefb` | สีพื้นหลังฐาน |
| orbs | `#c7b9ff #ffc6e6 #bfe3ff #d6f3e2` | สี 4 จุดของ mesh |
| `--r / --r2 / --r3` | `13 / 20 / 26 px` | รัศมีขอบ (เพิ่มจากเดิม 8/12/16) |

### Dark (`html[data-theme="dark"]` หรือ auto ตาม `prefers-color-scheme`)
- `--ink #f2f3ff` · `--ink2 #b6bce0` · `--ink3 #838ab0`
- `--surface rgba(40,46,80,.50)` · `--g-card rgba(46,53,90,.55)` · `--g-brd rgba(255,255,255,.16)`
- `--accent #818cf8` · `--accent-2 #a78bfa`
- semantic เร่งสว่าง: green `#34d399` · red `#ff8a76` · amber `#fbbf24` · blue `#7fb1ff` · violet `#b69bff`
- `--bg-base #0a0d1f` · orbs `#4f3bd6 #b5337f #1f6fd4 #107a5a`

### สีเชิงความหมาย (คงความหมายเดิมของแอป)
เขียว = รายรับ/จ่ายแล้ว · แดง = รายจ่าย · เหลือง = รอดำเนินการ · น้ำเงิน = หลัก/โอน · ม่วง = ส่วนตัว

---

## หน้าจอที่ครอบคลุม (8 หน้า — ตรวจให้ครบ)
ทุกหน้าใช้ class ชุดเดียวกัน overlay จึงครอบพร้อมกัน แต่ต้องตรวจตาเปล่าทุกหน้า:
1. **Dashboard** — `.metrics .metric`, การ์ดกราฟ (`.chart-tab`), `#salaryCycleCard` (มี accent rim ซ้าย), `#accountCards`
2. **บันทึกรายการ (add)** — `.type-toggle/.type-btn` (รับ/จ่าย/โอน), `.form-row .field`, split preview
3. **รายการทั้งหมด (transactions)** — `table .tx-row`, `.multi-filter/.mf-dropdown`, `.swipe-row` (มือถือ)
4. **Settlement** — `.settle-card .settle-owe/.settle-ok .settle-amount`, `.pill-a/.pill-b`
5. **สรุปรายเดือน (monthly)** — การ์ด + กราฟ
6. **งบประมาณ (budget)** — การ์ด progress
7. **บัญชี & เป้าหมายออม (accounts/savings)** — การ์ดบัญชี + donut
8. **ตั้งค่า (settings)** — `.settings-section .stg-sect-head .stg-icon`, `.vm-card` (เลือก desktop/mobile), sync panel, version history

### Component ที่ override (อ้างชื่อ class จริง)
`.card` `.metric` `.settings-section` `.sidebar` `.topbar` `.bottomnav` `.nav-item` `.btn` `.btn-primary` `.btn-ghost` `.field input/select/textarea` `.filter-row select` `.mf-label` `.mf-dropdown` `.ac-list` `.type-toggle` `.type-btn` `.badge-*` `.cat-tag` `.cat-chip` `.chart-tab` `table tr:hover` `.tx-row:hover` `.settle-card` `.vm-card` `.stg-icon` `body.view-mobile .layout`

---

## Interactions & Behavior (เพิ่มจาก overlay เท่านั้น — ไม่แตะ JS)
- `.metric:hover` → ยกขึ้น `translateY(-3px)` + เงา accent (180ms)
- `.btn-primary:hover` → `brightness(1.07)` + ยกขึ้น 1px
- focus ของ input → ขอบ accent + `box-shadow 0 0 0 4px var(--accent-soft)`
- พื้นหลัง mesh → keyframes `gMesh` 26s ease-in-out alternate (translate + scale เล็กน้อย)
- **Responsive / mobile / `body.view-mobile`** — overlay เคารพ media query เดิมทั้งหมด (ไม่เปลี่ยน breakpoint, grid, หรือ off-canvas sidebar)
- **โหมดมืด** ขับเคลื่อนด้วย CSS ล้วน: auto ตาม `prefers-color-scheme` หรือล็อกด้วย `data-theme` บน `<html>` ถ้าอยากได้ปุ่มสลับ ผูกกับ:
  ```js
  document.documentElement.setAttribute('data-theme',
    document.documentElement.getAttribute('data-theme')==='dark' ? 'light' : 'dark');
  ```

## State Management
ไม่มี state ใหม่ การเปลี่ยนธีมเป็น attribute เดียวบน `<html>` (ถ้าจะให้จำค่า ให้เก็บใน `localStorage` แล้ว set ตอนโหลด — ออปชัน ไม่บังคับ)

## Assets
ไม่ต้องใช้ asset ใหม่ ไม่มีรูป/ฟอนต์เพิ่ม (ใช้ Sarabun + IBM Plex Mono เดิมของแอป) ไอคอนทั้งหมดเป็น inline SVG เดิม

---

## จุดที่ต้องระวัง (Acceptance checklist)
- [ ] `glass-overlay.css` ถูกโหลด **หลังสุด** จริง (ไม่งั้น override ไม่ติด)
- [ ] sidebar ตัวอักษรขาวยังอ่านออกบนกระจกเข้มทั้ง light & dark
- [ ] `.mf-dropdown` / `.ac-list` (เมนูลอย) มีพื้นทึบพอ อ่านออก ไม่โปร่งจนตัวหนังสือจม
- [ ] ตาราง `.tx-row` hover เห็นชัด, badge สีถูกต้องตามความหมาย
- [ ] ทดสอบบน Chrome + Safari (iOS PWA) — `backdrop-filter` ต้องมี `-webkit-` prefix (มีให้แล้ว)
- [ ] โหมดมืดอัตโนมัติไม่ชนกับ logic เดิมของแอป (แอปนี้ไม่มีธีมมืดเดิม จึงปลอดภัย)
- [ ] ปิดเอฟเฟกต์เคลื่อนไหวเมื่อตั้ง reduce-motion (มี `@media` ให้แล้ว)

## ไฟล์ในชุดนี้
- `glass-overlay.css` — **deliverable หลัก** ที่เอาไปติดตั้ง
- `preview.html` — เดโมใช้ markup จริงของแอป (เปิดในเบราว์เซอร์เพื่อเทียบผล)
- `orig/` — สำเนา CSS เดิม 4 ไฟล์ (ให้ preview ทำงาน + ใช้อ้างอิง class/variable เดิม)

> หมายเหตุ: ตัวพรีวิวในเครื่องมือบางตัวเรนเดอร์ `backdrop-filter` ไม่ได้ การ์ดอาจดูจาง — บนเบราว์เซอร์จริง (Chrome/Safari/Edge) จะเป็นกระจกฝ้าชัดเจน
