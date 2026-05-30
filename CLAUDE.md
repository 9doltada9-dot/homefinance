# HomeFinance — Claude Code Instructions

## Git Workflow
- Push ผ่าน Bash tool โดยตรง: `git add [files] && git commit -m "..." && git push origin main`
- Credential: Windows Credential Manager เก็บ GitHub token ไว้แล้ว ไม่ต้องใส่ซ้ำ
- ไม่ต้องถามยืนยันก่อน push (ทำได้เลย)

## Version Sync

**รูปแบบ:** `v[major].[minor].[patch]` เช่น `v3.16.57`  
**กฎ:** increment patch +1 ทุก commit — ห้ามข้าม

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
