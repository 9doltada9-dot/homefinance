/* HomeFinance · module: report.js · v3.2.0
 * Admin report — user list, settlement summary (all users), PDF export
 * All functions guard with isAdminUser() before executing.
 */

var _adminReportData = [];  // last-loaded transaction data for admin report

// ─── POPULATE MONTH SELECTOR ─────────────────────────────
function populateAdminMonths() {
  var sel = document.getElementById('adminReportMonth');
  if (!sel) return;
  var now  = new Date();
  var opts = '<option value="">เลือกเดือน</option>';
  for (var i = 0; i < 18; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var v = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    opts += '<option value="' + v + '" ' + (i === 0 ? 'selected' : '') + '>' + v + '</option>';
  }
  sel.innerHTML = opts;
}

// ─── LOAD ALL-USER TRANSACTIONS (admin only) ──────────────
async function loadAdminReport() {
  if (!isAdminUser()) { if(typeof showCycleToast==='function') showCycleToast('⚠️ ไม่มีสิทธิ์ Admin'); return; }

  var month = ((document.getElementById('adminReportMonth') || {}).value || '').trim();
  if (!month) { if(typeof showCycleToast==='function') showCycleToast('⚠️ เลือกเดือนก่อน'); return; }

  var creds = getSbCreds();
  if (!creds.ok) { if(typeof showCycleToast==='function') showCycleToast('⚠️ ยังไม่ได้ตั้งค่า Supabase'); return; }

  var el = document.getElementById('adminReportContent');
  if (el) el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ink3)">⏳ กำลังโหลด...</div>';

  // Build date range for month
  var parts    = month.split('-').map(Number);
  var lastDay  = new Date(parts[0], parts[1], 0).getDate();
  var dateFrom = month + '-01';
  var dateTo   = month + '-' + String(lastDay).padStart(2, '0');

  try {
    // Admin JWT → RLS admin policy returns ALL users' rows
    var r = await fetch(
      creds.url + '/rest/v1/' + SB_TABLE +
        '?select=*&date=gte.' + dateFrom + '&date=lte.' + dateTo + '&order=date',
      { headers: sbHeadersFrom(creds.key) }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var rows = await r.json();
    _adminReportData = rows.map(function(e){ return typeof mapSbRow==='function' ? mapSbRow(e) : e; });
    renderAdminReport(_adminReportData, month);
  } catch (e) {
    if (el) el.innerHTML = '<div style="color:var(--red);padding:16px;font-size:13px">❌ โหลดไม่ได้: ' + e.message + '</div>';
  }
}

// ─── RENDER SETTLEMENT SUMMARY ────────────────────────────
function renderAdminReport(data, month) {
  var el = document.getElementById('adminReportContent');
  if (!el) return;

  if (!data.length) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--ink3)">ไม่มีรายการในเดือนนี้</div>';
    return;
  }

  // Split: รายจ่ายส่วนกลาง (split=true) เท่านั้น
  var expenses = data.filter(function(e){ return e.type==='expense' && (typeof isPaid==='function'?isPaid(e):e.status!=='pending'); });
  var shared   = expenses.filter(function(e){ return e.split; });
  var personal = expenses.filter(function(e){ return !e.split; });

  // Settlement calc
  var paid = {}, share = {};
  persons.forEach(function(p){ paid[p.id]=0; share[p.id]=0; });
  shared.forEach(function(e){
    if (paid[e.person] !== undefined) paid[e.person] += e.amt;
    var each = e.amt / 2;
    persons.forEach(function(p){ if (share[p.id] !== undefined) share[p.id] += each; });
  });
  var net    = {};
  persons.forEach(function(p){ net[p.id] = paid[p.id] - share[p.id]; });
  var sorted   = persons.slice().sort(function(a,b){ return net[b.id]-net[a.id]; });
  var creditor = sorted[0], debtor = sorted[sorted.length-1];
  var owe      = Math.abs(net[creditor.id]);
  var totalSh  = shared.reduce(function(s,e){ return s+e.amt; }, 0);
  var totalAll = expenses.reduce(function(s,e){ return s+e.amt; }, 0);

  // Metric cards per person
  var metrics = '<div class="metrics" style="margin-bottom:12px">' +
    persons.map(function(p){
      return '<div class="metric">' +
        '<div class="metric-label">' + p.name + ' จ่าย(หาร2)</div>' +
        '<div class="metric-val mono">' + (typeof fmt==='function'?fmtH(paid[p.id]||0):(paid[p.id]||0)) + '</div>' +
        '<div class="metric-sub">ควรจ่าย ' + (typeof fmt==='function'?fmtH(share[p.id]||0):(share[p.id]||0)) + '</div>' +
      '</div>';
    }).join('') +
  '</div>';

  // Settlement result box
  var settleBox = '<div class="' + (owe<1?'settle-ok':'settle-owe') + ' settle-card" style="margin-bottom:12px">' +
    (owe < 1
      ? '<div style="font-size:14px;color:var(--green);font-weight:600">✓ ไม่มียอดค้างชำระ</div>'
      : '<div style="font-size:12px;font-weight:600;color:var(--amber);margin-bottom:4px">ยอดที่ต้องชำระคืน</div>' +
        '<div class="settle-amount" style="color:var(--amber)">' + (typeof fmt==='function'?fmtH(owe):owe) + ' บาท</div>' +
        '<div style="font-size:14px;font-weight:600;margin-top:4px">' + debtor.name + ' โอนให้ ' + creditor.name + '</div>') +
    '<div style="font-size:11px;color:var(--ink3);margin-top:6px">' +
      'รายจ่ายส่วนกลาง ' + (typeof fmt==='function'?fmtH(totalSh):totalSh) + ' บาท · รวมทั้งหมด ' + (typeof fmt==='function'?fmtH(totalAll):totalAll) + ' บาท' +
    '</div>' +
  '</div>';

  // Transaction detail table
  var tableHTML = '<div class="table-scroll"><table>' +
    '<tr><th>วันที่</th><th>รายการ</th><th>หมวด</th><th>ผู้จ่าย</th>' +
    '<th style="text-align:right">จำนวน</th><th style="text-align:center">แบ่ง</th></tr>' +
    shared.map(function(e){
      return '<tr>' +
        '<td style="font-size:12px;white-space:nowrap">' + e.date + '</td>' +
        '<td style="font-size:12px">' + (e.desc||'—') + '</td>' +
        '<td style="font-size:12px">' + (e.cat_name||'—') + '</td>' +
        '<td>' + (typeof personPill==='function'?personPill(e.user_id||e.person):e.person) + '</td>' +
        '<td style="text-align:right;font-family:monospace;font-size:12px">' + (typeof fmt==='function'?fmtH(e.amt):e.amt) + '</td>' +
        '<td style="text-align:center;font-size:11px">÷2</td>' +
      '</tr>';
    }).join('') +
    '<tr style="font-weight:700;background:var(--surface2)">' +
      '<td colspan="4" style="font-size:12px">รวมส่วนกลาง</td>' +
      '<td style="text-align:right;font-family:monospace">' + (typeof fmt==='function'?fmtH(totalSh):totalSh) + '</td>' +
      '<td></td>' +
    '</tr>' +
  '</table></div>';

  // Personal expenses (collapsed info)
  var personalHTML = personal.length
    ? '<div style="margin-top:10px;padding:10px 12px;background:var(--surface2);border-radius:var(--r);font-size:12px">' +
        '<div style="font-weight:600;color:var(--ink3);margin-bottom:4px">รายจ่ายส่วนตัว (' + personal.length + ' รายการ · ' + (typeof fmt==='function'?fmtH(personal.reduce(function(s,e){return s+e.amt;},0)):personal.reduce(function(s,e){return s+e.amt;},0)) + ' บาท)</div>' +
        personal.map(function(e){
          return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)">' +
            '<span>' + (typeof personPill==='function'?personPill(e.user_id||e.person):e.person) + ' · ' + (e.desc||'—') + '</span>' +
            '<span style="font-family:monospace">' + (typeof fmt==='function'?fmtH(e.amt):e.amt) + '</span>' +
          '</div>';
        }).join('') +
      '</div>'
    : '';

  el.innerHTML = metrics + settleBox + tableHTML + personalHTML;
}

// ─── EXPORT ADMIN PDF ─────────────────────────────────────
function exportAdminPDF() {
  if (!_adminReportData.length) {
    if(typeof showCycleToast==='function') showCycleToast('⚠️ กด "โหลดรายงาน" ก่อน');
    return;
  }
  var month = ((document.getElementById('adminReportMonth') || {}).value || '');
  if (typeof exportSettlePDFFromData === 'function') {
    exportSettlePDFFromData(_adminReportData, month);
  } else if (typeof exportSettlePDF === 'function') {
    exportSettlePDF(month);
  }
}

// ─── USER LIST (admin: list all profiles) ─────────────────
async function renderAdminUserList() {
  var el = document.getElementById('adminUserList');
  if (!el) return;
  if (!isAdminUser()) {
    el.innerHTML = '<div style="color:var(--ink3);font-size:13px;text-align:center;padding:16px">⚠️ ต้องมีสิทธิ์ Admin</div>';
    return;
  }

  var creds = getSbCreds();
  if (!creds.ok) {
    el.innerHTML = '<div style="color:var(--ink3);font-size:13px">ยังไม่ได้ตั้งค่า Supabase</div>';
    return;
  }

  el.innerHTML = '<div style="font-size:12px;color:var(--ink3);padding:8px 0;text-align:center">⏳ กำลังโหลด...</div>';

  try {
    // ดึง profiles พร้อม email (ถ้า column มีอยู่)
    var r = await fetch(
      creds.url + '/rest/v1/profiles_with_email?select=id,name,role,label,email&order=name',
      { headers: sbHeadersFrom(creds.key) }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var profiles = await r.json();

    if (!profiles.length) {
      el.innerHTML = '<div style="color:var(--ink3);font-size:13px;text-align:center;padding:12px">ยังไม่มีผู้ใช้งาน</div>';
      return;
    }

    var myId = getAuthUserId();
    var html = '<div style="font-size:11px;color:var(--ink3);margin-bottom:8px">พบ ' + profiles.length + ' ผู้ใช้</div>';
    html += profiles.map(function(p){
      var isSelf  = p.id === myId;
      var isAdm   = p.role === 'admin';
      var safeName = (p.name || '—').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var safeEmail = (p.email || p.id || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var initials = (p.name || '?').charAt(0).toUpperCase();
      var avatarBg = isAdm ? 'var(--green-bg)' : 'var(--blue-bg)';
      var avatarColor = isAdm ? 'var(--green)' : 'var(--blue)';

      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">' +
        // Avatar
        '<div style="width:36px;height:36px;border-radius:50%;background:' + avatarBg + ';color:' + avatarColor + ';' +
          'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">' + initials + '</div>' +
        // Info
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:var(--ink)">' +
            safeName +
            (isSelf ? ' <span style="font-size:10px;background:var(--blue-bg);color:var(--blue);padding:1px 6px;border-radius:8px">(คุณ)</span>' : '') +
          '</div>' +
          (safeEmail
            ? '<div style="font-size:11px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + safeEmail + '</div>'
            : '<div style="font-size:10px;color:var(--ink3);font-family:monospace">' + p.id.slice(0,16) + '…</div>') +
        '</div>' +
        // Role badge + toggle
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
          '<span style="font-size:11px;padding:3px 9px;border-radius:12px;white-space:nowrap;' +
            'background:' + (isAdm ? 'var(--green-bg)' : 'var(--surface2)') + ';' +
            'color:'      + (isAdm ? 'var(--green)'    : 'var(--ink3)')     + '">' +
            (isAdm ? '🛡 Admin' : '👤 User') +
          '</span>' +
          (!isSelf
            ? '<button onclick="toggleUserRole(\'' + p.id + '\',\'' + safeName.replace(/'/g,'') + '\',\'' + p.role + '\')" ' +
                'style="font-size:11px;padding:4px 10px;border:1px solid var(--line);border-radius:6px;' +
                'background:var(--surface);cursor:pointer;font-family:Sarabun,sans-serif;min-height:32px;white-space:nowrap;' +
                'color:' + (isAdm ? 'var(--red)' : 'var(--green)') + '">' +
                (isAdm ? '→ User' : '→ Admin') +
              '</button>'
            : '<span style="font-size:11px;color:var(--ink3);padding:4px 10px">—</span>') +
        '</div>' +
      '</div>';
    }).join('');
    el.innerHTML = html;

  } catch (e) {
    var errMsg = e.message || 'เชื่อมต่อไม่ได้';
    if (errMsg.indexOf('42501') > -1 || errMsg.indexOf('403') > -1) {
      errMsg = 'ถูกปฏิเสธ (RLS) — ตรวจสอบ policy ของ profiles table ว่า Admin อ่านได้ทุก row';
    }
    el.innerHTML = '<div style="color:var(--red);font-size:13px">❌ โหลดไม่ได้: ' + errMsg + '</div>';
  }
}

async function toggleUserRole(userId, userName, currentRole) {
  if (!isAdminUser()) return;
  var newRole = currentRole === 'admin' ? 'user' : 'admin';
  var roleLabel = newRole === 'admin' ? 'Admin 🛡' : 'User 👤';
  if (!confirm('เปลี่ยน "' + userName + '" เป็น ' + roleLabel + '?')) return;

  var creds = getSbCreds();
  try {
    var r = await fetch(creds.url + '/rest/v1/profiles?id=eq.' + userId, {
      method: 'PATCH',
      headers: sbHeadersFrom(creds.key),
      body: JSON.stringify({ role: newRole })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if(typeof showCycleToast==='function') showCycleToast('✅ เปลี่ยน "' + userName + '" เป็น ' + roleLabel + ' แล้ว');
    renderAdminUserList();
  } catch (e) {
    if(typeof showCycleToast==='function') showCycleToast('❌ อัปเดตไม่ได้: ' + e.message);
  }
}
