# HomeFinance — Claude Code Instructions

## Git Workflow
- Push ผ่าน Bash tool โดยตรง: `git add [files] && git commit -m "..." && git push origin main`
- Credential: Windows Credential Manager เก็บ GitHub token ไว้แล้ว ไม่ต้องใส่ซ้ำ
- ไม่ต้องถามยืนยันก่อน push (ทำได้เลย)

## Version Sync

**รูปแบบ:** `v[major].[minor].[patch]` เช่น `v3.16.59`

### แต่ละตำแหน่ง bump เมื่อไหร่

| ตำแหน่ง | เมื่อไหร่ | ตัวอย่าง |
|---|---|---|
| **major** `X`.xx.xx | redesign ใหม่ทั้งหมด / breaking change / เปลี่ยน stack | v2→v3 |
| **minor** x.`XX`.xx | เพิ่ม module/หน้า/feature ใหม่ที่ใหญ่ | เพิ่มหน้า Settlement, Recurring |
| **patch** x.xx.`XX` | แก้ bug, แก้ CSS/design, แก้ logic, แก้ HTML, เพิ่มฟีเจอร์เล็ก | ทุก commit ปกติ |

### กฎ patch
| การเปลี่ยนแปลง | bump? |
|---|---|
| แก้ JS logic / bug fix | ✅ +1 |
| แก้ CSS / design / glass effect | ✅ +1 |
| แก้ HTML โครงสร้าง | ✅ +1 |
| เพิ่ม icon / mapping | ✅ +1 |
| แก้หลายไฟล์ใน commit เดียว | ✅ +1 ครั้งเดียว |
| แก้เฉพาะ CLAUDE.md / docs | ❌ ไม่ bump |

**กฎ:** ทุก commit ที่กระทบ UI หรือ behavior → bump patch +1 เสมอ

### ตำแหน่งที่ต้องอัปเดตทุกครั้ง

**`index.html`** — 4 จุด (ใช้ sed แทนทั้งหมดพร้อมกัน):
- `<title>HomeFinance vX.XX.XX</title>`
- `<div class="brand-sub">vX.XX.XX · THB</div>`
- `HomeFinance vX.XX.XX © 2025` (footer)
- `HomeFinance vX.XX.XX` (hidden auth tap ล่างสุด)

**`sw.js`** — 2 จุด:
- comment บรรทัด 1: `/* HomeFinance · Service Worker · vX.XX.XX`
- `const CACHE_VERSION = 'hf-vX.XX.XX';` ← **สำคัญ** บังคับ browser โหลดไฟล์ใหม่

### คำสั่งอัปเดต (แทน OLD → NEW)
```bash
sed -i 's/v3\.16\.OLD/v3.16.NEW/g' index.html
sed -i 's/hf-v3\.16\.OLD/hf-v3.16.NEW/' sw.js
sed -i 's/Service Worker · v3\.16\.OLD/Service Worker · v3.16.NEW/' sw.js
```

## Stack
- Static PWA (HTML/CSS/JS) — ไม่มี build step
- Backend: Supabase (project: ceudxjghmetbyejhjcxg)
- Deploy: GitHub Pages (9doltada9-dot.github.io/homefinance/)
- Service Worker: sw.js — cache-first สำหรับ static, network-first สำหรับ Supabase API

## Commit Style
```
v3.16.XX — [scope]: [description]
```
