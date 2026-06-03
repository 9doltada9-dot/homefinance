/* HomeFinance · module: savingsGoals.js · v3.0.0
 * Savings goals — target amount, deadline, monthly contribution.
 * Stored in localStorage (hf2_savings_goals).
 */

var savingsGoals = [];

// ─── STORAGE ──────────────────────────────────────────────
function loadSavingsGoals() {
  try { savingsGoals = JSON.parse(localStorage.getItem('hf2_savings_goals') || '[]'); }
  catch(_) { savingsGoals = []; }
}
function saveSavingsGoalsLocal() {
  localStorage.setItem('hf2_savings_goals', JSON.stringify(savingsGoals));
}

// ─── CRUD ─────────────────────────────────────────────────
function addSavingsGoal(name, targetAmount, targetDate, currentAmount) {
  var goal = {
    id:             'goal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name:           (name || 'เป้าหมายใหม่').trim(),
    target_amount:  Number(targetAmount) || 0,
    current_amount: Number(currentAmount) || 0,
    target_date:    targetDate || '',
    created_at:     new Date().toISOString(),
  };
  savingsGoals.push(goal);
  saveSavingsGoalsLocal();
  sbSyncSavingsGoal(goal, 'add');
  return goal;
}

function updateSavingsGoal(id, fields) {
  var goal = savingsGoals.find(function(g) { return g.id === id; });
  if (!goal) return;
  Object.assign(goal, fields);
  saveSavingsGoalsLocal();
  sbSyncSavingsGoal(goal, 'update');
  renderSavingsGoals();
}

function deleteSavingsGoal(id) {
  if (!confirm('ลบเป้าหมายนี้?')) return;
  savingsGoals = savingsGoals.filter(function(g) { return g.id !== id; });
  saveSavingsGoalsLocal();
  renderSavingsGoals();
}

function depositToGoal(id) {
  var goal = savingsGoals.find(function(g) { return g.id === id; });
  if (!goal) return;
  var amt = parseFloat(prompt('ฝากเพิ่มกี่บาท?', '0'));
  if (!amt || amt <= 0) return;
  goal.current_amount = (goal.current_amount || 0) + amt;
  saveSavingsGoalsLocal();
  sbSyncSavingsGoal(goal, 'update');
  renderSavingsGoals();
  showCycleToast('ฝากเพิ่ม ' + fmt(amt) + ' บาท ✅');
}

// ─── CALCULATION ──────────────────────────────────────────
function calcGoalMonthlyRequired(goal) {
  if (!goal.target_date) return 0;
  var remaining = (goal.target_amount || 0) - (goal.current_amount || 0);
  if (remaining <= 0) return 0;
  var today  = new Date();
  var target = new Date(goal.target_date + 'T00:00:00');
  var months = (target.getFullYear() - today.getFullYear()) * 12 +
               (target.getMonth() - today.getMonth());
  return months > 0 ? Math.ceil(remaining / months) : remaining;
}

function calcGoalProgress(goal) {
  var target = goal.target_amount || 1;
  return Math.min(100, Math.round((goal.current_amount || 0) / target * 100));
}

// ─── RENDER ───────────────────────────────────────────────
function renderSavingsGoals() {
  var el = document.getElementById('savingsGoalsList');
  if (!el) return;

  if (!savingsGoals.length) {
    el.innerHTML = '<div class="empty">ยังไม่มีเป้าหมายการออม — กดปุ่มด้านบนเพื่อเพิ่ม</div>';
    return;
  }

  el.innerHTML = savingsGoals.map(function(g) {
    var pct      = calcGoalProgress(g);
    var monthly  = calcGoalMonthlyRequired(g);
    var remaining = Math.max(0, (g.target_amount || 0) - (g.current_amount || 0));
    var dateStr  = g.target_date ? toThaiDateShort(g.target_date) : '—';
    var isDone   = pct >= 100;

    // สีแบบเดียวกับ รอรับ/รอจ่าย card บน Dashboard
    var bg, bord, headerCol, amtCol, barBg;
    if (isDone) {
      bg = 'rgba(74,222,128,.10)'; bord = '1px solid rgba(74,222,128,.35)';
      headerCol = '#15803d'; amtCol = '#4ade80'; barBg = '#4ade80';
    } else if (pct >= 60) {
      bg = 'rgba(96,165,250,.10)'; bord = '1px solid rgba(96,165,250,.35)';
      headerCol = '#1d4ed8'; amtCol = '#60a5fa'; barBg = '#60a5fa';
    } else {
      bg = 'rgba(251,191,36,.10)'; bord = '1px solid rgba(251,191,36,.40)';
      headerCol = '#b5600a'; amtCol = '#fbbf24'; barBg = '#fbbf24';
    }

    return '<div style="margin-bottom:14px;background:' + bg + ';border:' + bord + ';border-radius:14px;padding:14px 16px">' +
      // ── header row
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
        '<div>' +
          '<div style="font-size:10px;font-weight:700;color:' + headerCol + ';letter-spacing:.5px;margin-bottom:3px">' +
            (isDone ? '🎉 สำเร็จแล้ว' : '🎯 เป้าหมายการออม') +
          '</div>' +
          '<div style="font-size:15px;font-weight:700;color:' + amtCol + ';font-family:monospace;letter-spacing:-0.5px">' +
            fmtH(g.current_amount) +
            '<span style="font-size:11px;font-weight:400;color:var(--ink3)"> / ' + fmtH(g.target_amount) + '</span>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--ink3);margin-top:2px">' + g.name + ' · ครบ ' + dateStr + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button onclick="depositToGoal(\'' + g.id + '\')" style="font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid ' + amtCol + ';background:transparent;color:' + amtCol + ';cursor:pointer;font-family:Sarabun,sans-serif;font-weight:700">+ ฝาก</button>' +
          '<button onclick="deleteSavingsGoal(\'' + g.id + '\')" style="font-size:11px;padding:4px 8px;border-radius:8px;border:1px solid rgba(248,113,113,.5);background:transparent;color:#f87171;cursor:pointer"><svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2l1-1h6l1 1h4v2H2V2h4zm1 4h2v9H7V6zm4 0h2v9h-2V6zM3 5h14l-1 13H4L3 5z"/></svg></button>' +
        '</div>' +
      '</div>' +
      // ── progress bar
      '<div style="background:rgba(255,255,255,.08);border-radius:6px;height:5px;margin-bottom:8px;overflow:hidden">' +
        '<div style="height:100%;width:' + Math.min(pct, 100) + '%;border-radius:6px;transition:width .5s;background:' + barBg + '"></div>' +
      '</div>' +
      // ── footer
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink3)">' +
        '<span>' + (isDone ? '✅ ถึงเป้าหมายแล้ว!' :
          'ยังขาด <strong style="color:' + amtCol + '">' + fmtH(remaining) + '</strong>' +
          (monthly > 0 ? ' · ออมเดือนละ <strong style="color:' + amtCol + '">' + fmtH(monthly) + '</strong>' : '')) +
        '</span>' +
        '<span style="font-weight:700;color:' + amtCol + '">' + pct + '%</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ─── ADD FORM ─────────────────────────────────────────────
function onAddSavingsGoal() {
  if(!checkOnlineForAction()) return;
  var name   = (document.getElementById('goalName')   || {}).value || '';
  var target = parseFloat((document.getElementById('goalTarget') || {}).value) || 0;
  var date   = (document.getElementById('goalDate')   || {}).value || '';
  var cur    = parseFloat((document.getElementById('goalCurrent') || {}).value) || 0;
  name = name.trim();
  if (!name || !target) { showCycleToast('⚠️ ระบุชื่อและยอดเป้าหมาย'); return; }
  addSavingsGoal(name, target, date, cur);
  ['goalName','goalTarget','goalDate','goalCurrent'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  renderSavingsGoals();
  showCycleToast('เพิ่มเป้าหมาย "' + name + '" แล้ว 🎯');
}

// ─── SUPABASE SYNC ────────────────────────────────────────
async function sbSyncSavingsGoal(goal, action) {
  var creds = getSbCreds();
  if (!creds.ok) return;
  try {
    var headers = Object.assign({}, sbHeadersFrom(creds.key), { 'Prefer': 'resolution=merge-duplicates,return=minimal' });
    if (action === 'add' || action === 'update') {
      await fetch(creds.url + '/rest/v1/savings_goals', {
        method: 'POST', headers: headers, body: JSON.stringify([goal]),
      });
    } else if (action === 'delete') {
      await fetch(creds.url + '/rest/v1/savings_goals?id=eq.' + encodeURIComponent(goal.id), {
        method: 'DELETE', headers: sbHeadersFrom(creds.key),
      });
    }
  } catch(_) {}
}

async function sbLoadSavingsGoals() {
  var creds = getSbCreds();
  if (!creds.ok) return null;
  try {
    var r = await fetch(creds.url + '/rest/v1/savings_goals?select=*&order=created_at', {
      headers: sbHeadersFrom(creds.key)
    });
    if (!r.ok) return null;
    return await r.json();
  } catch(_) { return null; }
}
