# HomeFinance — Claude Code Instructions

## Git Workflow
- Push ผ่าน Bash tool โดยตรง: `git add [files] && git commit -m "..." && git push origin main`
- Credential: Windows Credential Manager เก็บ GitHub token ไว้แล้ว ไม่ต้องใส่ซ้ำ
- ไม่ต้องถามยืนยันก่อน push (ทำได้เลย)

## Version Sync
- อัปเดต version ใน `index.html` (title, brand-sub, footer) ทุกครั้งที่ push
- อัปเดต `CACHE_VERSION` ใน `sw.js` ให้ตรงกันทุกครั้ง เพื่อ force SW cache invalidation

## Stack
- Static PWA (HTML/CSS/JS) — ไม่มี build step
- Backend: Supabase (project: ceudxjghmetbyejhjcxg)
- Deploy: GitHub Pages (9doltada9-dot.github.io/homefinance/)
- Service Worker: sw.js — cache-first สำหรับ static, network-first สำหรับ Supabase API

## Commit Style
```
v3.16.XX — [scope]: [description]
```
