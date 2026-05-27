/* HomeFinance · module: budget.js · v3.1.0
 * Budget tracking — v3.1 redesign:
 *   - แสดงเฉพาะหมวดที่ตั้งงบไว้แล้ว (ไม่ใช่ทุกหมวด)
 *   - เพิ่มหมวดเองจาก dropdown (หมวดรายจ่ายที่มีอยู่)
 *   - แก้ไขและลบแต่ละรายการได้
 *   - Cycle-aware spending (cycle / billing / calendar mode)
 */

var budgets = {};
// budgets: { catId: amount }  — ไม่มี 'custom:' แล้ว เก็บแค่ catId
// โหลดต่อครั้งที่ render เพื่อให้ scoped ตาม user ที่ login อยู่

function _loadBudgetsNow() {
  var _bUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _bKey = _bUid ? 'hf2_budgets_' + _bUid : 'hf2_budgets';
  var _bData = JSON.parse(localStorage.getItem(_bKey) || 'null');
  // migration: ดึงข้อมูลเก่า (shared key) มาใส่ key ใหม่ครั้งเดียว
  if (!_bData && _bUid) {
    var _old = JSON.parse(localStorage.getItem('hf2_budgets') || 'null');
    if (_old && Object.keys(_old).length) {
      _bData = _old;
      localStorage.setItem(_bKey, JSON.stringify(_bData));
    }
  }
  budgets = _bData || {};
}

// ─── BUDGET MODE ──────────────────────────────────────────
var _budgetMode = localStorage.getItem('hf2_budget_mode') || 'cycle';

function setBudgetMode(mode) {
  _budgetMode = mode;
  localStorage.setItem('hf2_budget_mode', mode);
  renderBudget();
}

// ─── SPENDING LOOKUP ──────────────────────────────────────
function getBudgetSpending() {
  var actual = {};
  var now    = new Date();
  var toCheck;
  var _bSpendUid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _bSpendDb  = _bSpendUid ? db.filter(function(e){ return (e.user_id||e.person) === _bSpendUid; }) : db;

  if (_budgetMode === 'cycle') {
    var cycleId = typeof getCurrentCycleId === 'function' ? getCurrentCycleId() : null;
    var cy      = cycleId && typeof getCycleById === 'function' ? getCycleById(cycleId) : null;
    toCheck = cy
      ? _bSpendDb.filter(function(e){ return e.type==='expense' && isPaid(e) && e.date >= cy.start && e.date <= cy.end; })
      : _bSpendDb.filter(function(e){ return e.type==='expense' && isPaid(e); });

  } else if (_budgetMode === 'billing') {
    var curBM = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    toCheck = _bSpendDb.filter(function(e){
      var bm = e.billing_month || e.date.slice(0,7);
      return e.type==='expense' && isPaid(e) && bm === curBM;
    });

  } else {
    var curMonth = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    toCheck = _bSpendDb.filter(function(e){ return e.type==='expense' && isPaid(e) && e.date.startsWith(curMonth); });
  }

  toCheck.forEach(function(e){
    var k = e.cat_id || e.cat_name || '—';
    actual[k] = (actual[k]||0) + e.amt;
  });
  return actual;
}

// ─── RENDER ───────────────────────────────────────────────
function renderBudget() {
  _loadBudgetsNow();
  var el = document.getElementById('budgetContent');
  if (!el) return;

  var now     = new Date();
  var cycleId = typeof getCurrentCycleId === 'function' ? getCurrentCycleId() : null;
  var cy      = cycleId && typeof getCycleById === 'function' ? getCycleById(cycleId) : null;
  var modeLabel = _budgetMode === 'cycle'
    ? (cy ? cy.label : 'รอบปัจจุบัน')
    : _budgetMode === 'billing'
    ? 'เดือนบิล ' + THAI_MONTHS[now.getMonth()] + ' ' + (now.getFullYear()+543)
    : THAI_MONTHS[now.getMonth()] + ' ' + (now.getFullYear()+543);

  var actual  = getBudgetSpending();
  var expCats = categories.filter(function(c){ return c.type === 'expense'; });

  // เฉพาะ key ที่ตั้งงบไว้ (> 0)
  var activeKeys = Object.keys(budgets).filter(function(k){ return budgets[k] > 0; });

  // summary
  var totalBudget = activeKeys.reduce(function(s,k){ return s + (budgets[k]||0); }, 0);
  var totalSpent  = activeKeys.reduce(function(s,k){
    var cat = expCats.find(function(c){ return c.id === k; });
    return s + (actual[k] || (cat ? actual[cat.name] : 0) || 0);
  }, 0);
  var overallPct = totalBudget > 0 ? Math.min(100, Math.round(totalSpent / totalBudget * 100)) : 0;

  // mode tabs
  var modeTabs =
    '<div style="display:flex;gap:4px;margin-bottom:14px;background:var(--surface2);border-radius:8px;padding:3px">' +
    ['cycle','billing','calendar'].map(function(m){
      var labels = { cycle:'💼 รอบเงินเดือน', billing:'📋 เดือนบิล', calendar:'📅 ปฏิทิน' };
      var active = _budgetMode === m;
      return '<button onclick="setBudgetMode(\''+m+'\')" style="flex:1;padding:5px 6px;border:none;border-radius:6px;' +
        'font-size:11px;font-family:Sarabun,sans-serif;cursor:pointer;font-weight:600;' +
        (active ? 'background:#1a4fa0;color:#fff' : 'background:transparent;color:var(--ink2)') +
        '">' + labels[m] + '</button>';
    }).join('') + '</div>';

  // overall bar
  var summaryBar = totalBudget > 0
    ? '<div style="padding:10px;background:var(--surface2);border-radius:var(--r);margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">' +
          '<span style="font-weight:600">ภาพรวมทั้งหมด</span>' +
          '<span style="font-family:monospace;font-weight:600">' + fmtH(totalSpent) + ' / ' + fmtH(totalBudget) + ' บาท</span>' +
        '</div>' +
        '<div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden">' +
          '<div style="height:100%;width:' + overallPct + '%;background:' +
            (totalSpent > totalBudget ? 'var(--red)' : overallPct > 80 ? 'var(--amber)' : 'var(--green)') +
            ';border-radius:4px;transition:width .4s"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--ink3);text-align:right;margin-top:3px">' + overallPct + '%</div>' +
      '</div>'
    : '';

  // rows (only categories with budget set)
  var rows = activeKeys.map(function(k) {
    var cat    = expCats.find(function(c){ return c.id === k; });
    var name   = cat ? cat.name : k;
    var spent  = actual[k] || (cat ? actual[cat.name] : 0) || 0;
    var budget = budgets[k] || 0;
    return budgetRow(k, name, spent, budget);
  }).join('');

  var emptyHint = activeKeys.length === 0
    ? '<div style="text-align:center;padding:28px 0;color:var(--ink3);font-size:13px">' +
        '📋 ยังไม่มีงบประมาณ<br>' +
        '<span style="font-size:12px">กดปุ่ม + เพิ่มหมวด ด้านล่างเพื่อเริ่มต้น</span>' +
      '</div>'
    : '';

  // add-from-category UI
  var unset = expCats.filter(function(c){ return !(budgets[c.id] > 0); });
  var addRow =
    '<div style="margin-top:14px;padding:12px;background:var(--surface2);border-radius:var(--r)">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px">+ เพิ่มหมวด</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<select id="budgetAddCat" style="flex:1;min-width:130px;font-size:14px !important">' +
          '<option value="">— เลือกหมวดหมู่ —</option>' +
          unset.map(function(c){
            return '<option value="' + c.id + '">' + c.name + '</option>';
          }).join('') +
        '</select>' +
        '<input type="number" id="budgetAddAmt" placeholder="งบประมาณ (฿)" min="0"' +
          ' style="width:140px;font-size:14px !important;font-family:monospace;text-align:right">' +
        '<button onclick="addBudgetItem()" class="btn btn-primary" style="white-space:nowrap;min-height:40px">+ เพิ่ม</button>' +
      '</div>' +
    '</div>';

  el.innerHTML =
    '<div class="card">' +
      '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span>งบประมาณรายจ่าย</span>' +
        '<span style="font-size:11px;font-weight:400;color:var(--ink3)">' + modeLabel + '</span>' +
      '</div>' +
      modeTabs +
      summaryBar +
      emptyHint +
      rows +
      addRow +
    '</div>';
}

// ─── BUDGET ROW ───────────────────────────────────────────
function budgetRow(catId, name, spent, budget) {
  var pct  = budget > 0 ? Math.min(100, Math.round(spent / budget * 100)) : 0;
  var over = spent > budget;
  var bar  = over ? 'var(--red)' : pct > 80 ? 'var(--amber)' : 'var(--green)';

  return '<div style="padding:11px 0;border-bottom:1px solid var(--line)">' +
    // header row: name | spent | / | input | delete
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span style="flex:1;font-size:13px;font-weight:600">' + name + '</span>' +
      '<span style="font-size:12px;font-family:monospace;color:' + (over ? 'var(--red)' : 'var(--ink2)') + '">' + fmtH(spent) + '</span>' +
      '<span style="font-size:11px;color:var(--ink3)">/</span>' +
      '<input type="number" value="' + budget + '" min="0"' +
        ' onchange="budgets[\'' + catId + '\']=parseFloat(this.value)||0;saveBudgets();renderBudget()"' +
        ' style="width:86px;font-size:13px !important;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-family:monospace;text-align:right;background:var(--surface2)">' +
      '<button onclick="deleteBudgetItem(\'' + catId + '\')"' +
        ' style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 8px;line-height:1;touch-action:manipulation" title="ลบ">×</button>' +
    '</div>' +
    // progress bar
    '<div style="height:7px;background:var(--surface2);border-radius:4px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + bar + ';border-radius:4px;transition:width .5s"></div>' +
    '</div>' +
    // stats row
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-top:3px">' +
      '<span>' + (over ? '⚠ เกิน ' + fmtH(spent - budget) + ' บาท' : pct + '% ใช้แล้ว') + '</span>' +
      '<span>' + (over ? '' : fmtH(Math.max(0, budget - spent)) + ' เหลือ') + '</span>' +
    '</div>' +
  '</div>';
}

// ─── ADD / DELETE ─────────────────────────────────────────
function addBudgetItem() {
  if(!checkOnlineForAction()) return;
  var catId = ((document.getElementById('budgetAddCat')||{}).value||'').trim();
  var amt   = parseFloat((document.getElementById('budgetAddAmt')||{}).value) || 0;
  if (!catId) { showCycleToast('⚠️ เลือกหมวดหมู่ก่อน'); return; }
  if (!amt)   { showCycleToast('⚠️ ระบุงบประมาณ'); return; }
  budgets[catId] = amt;
  saveBudgets();
  renderBudget();
}

function deleteBudgetItem(catId) {
  if(!checkOnlineForAction()) return;
  delete budgets[catId];
  saveBudgets();
  renderBudget();
}
