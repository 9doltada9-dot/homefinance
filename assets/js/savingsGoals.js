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
    var barColor  = pct >= 100 ? 'var(--green)' : pct >= 60 ? '#1a4fa0' : 'var(--amber)';
    var dateStr   = g.target_date ? toThaiDateShort(g.target_date) : '—';
    var isDone    = pct >= 100;

    return '<div class="card" style="border-left:4px solid ' + barColor + ';padding:12px 14px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700">' + (isDone ? '🎉 ' : '🎯 ') + g.name + '</div>' +
          '<div style="font-size:11px;color:var(--ink3);margin-top:2px">ครบกำหนด: ' + dateStr + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button onclick="depositToGoal(\'' + g.id + '\')" style="font-size:11px;padding:4px 8px;background:#1a4fa0;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:Sarabun,sans-serif">+ ฝาก</button>' +
          '<button onclick="deleteSavingsGoal(\'' + g.id + '\')" style="font-size:11px;padding:4px 8px;background:none;border:1px solid var(--red);color:var(--red);border-radius:8px;cursor:pointer;font-family:Sarabun,sans-serif">ลบ</button>' +
        '</div>' +
      '</div>' +
      '<div style="height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;margin-bottom:6px">' +
        '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width .4s"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink2)">' +
        '<span style="font-family:monospace;font-weight:600">฿' + fmt(g.current_amount) + ' / ฿' + fmt(g.target_amount) + '</span>' +
        '<span>' + pct + '%</span>' +
      '</div>' +
      (isDone ? '<div style="font-size:12px;color:var(--green);font-weight:600;margin-top:6px">✅ ถึงเป้าหมายแล้ว!</div>' :
        '<div style="font-size:11px;color:var(--ink3);margin-top:4px">' +
          'ยังขาด: <strong>฿' + fmt(remaining) + '</strong>' +
          (monthly > 0 ? ' · ควรออมเดือนละ: <strong style="color:#1a4fa0">฿' + fmt(monthly) + '</strong>' : '') +
        '</div>') +
    '</div>';
  }).join('');
}

// ─── ADD FORM ─────────────────────────────────────────────
function onAddSavingsGoal() {
  var name   = (document.getElementById('sgName')   || {}).value || '';
  var target = parseFloat((document.getElementById('sgTarget') || {}).value) || 0;
  var date   = (document.getElementById('sgDate')   || {}).value || '';
  var cur    = parseFloat((document.getElementById('sgCurrent') || {}).value) || 0;
  name = name.trim();
  if (!name || !target) { showCycleToast('⚠️ ระบุชื่อและยอดเป้าหมาย'); return; }
  addSavingsGoal(name, target, date, cur);
  ['sgName','sgTarget','sgDate','sgCurrent'].forEach(function(id) {
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
