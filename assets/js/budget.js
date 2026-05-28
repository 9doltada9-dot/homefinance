/* HomeFinance · module: budget.js · v3.2.0
 * Budget planning — v3.2 redesign:
 *   - budgetItems: [{id, catId, catName, itemId, itemName, amount}]
 *   - เลือกหมวด → เลือกรายการ (cascade) → ใส่ยอด
 *   - นำขึ้น Forecast: renderForecastBudgetPanel() ใน forecastEngine
 *   - Migration: budgets {catId:amount} → budgetItems array อัตโนมัติ
 */

var budgets     = {};  // legacy compat — { catId: totalPlanned }
var budgetItems = [];  // v3.2 primary store

// ─── BUDGET MODE ──────────────────────────────────────────
var _budgetMode = localStorage.getItem('hf2_budget_mode') || 'cycle';

function setBudgetMode(mode) {
  _budgetMode = mode;
  localStorage.setItem('hf2_budget_mode', mode);
  renderBudget();
}

// ─── LOAD ─────────────────────────────────────────────────
function _loadBudgetsNow() {
  var _uid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _key = _uid ? 'hf2_budget_items_' + _uid : 'hf2_budget_items';
  var _data = JSON.parse(localStorage.getItem(_key) || 'null');

  // Migration: old {catId:amount} dict → budgetItems array
  if (!_data) {
    var _oldKey = _uid ? 'hf2_budgets_' + _uid : 'hf2_budgets';
    var _old = JSON.parse(localStorage.getItem(_oldKey) || 'null');
    if (!_old && _uid) _old = JSON.parse(localStorage.getItem('hf2_budgets') || 'null');
    if (_old && typeof _old === 'object' && !Array.isArray(_old)) {
      var _cats = typeof categories !== 'undefined' ? categories : [];
      _data = Object.keys(_old).filter(function(k){ return _old[k] > 0; }).map(function(k){
        var cat = _cats.find(function(c){ return c.id === k; });
        return { id: 'bi-' + k, catId: k, catName: cat ? cat.name : k,
                 itemId: '', itemName: '', amount: _old[k] };
      });
      localStorage.setItem(_key, JSON.stringify(_data));
    }
  }

  budgetItems = Array.isArray(_data) ? _data : [];
  // sync legacy budgets dict
  budgets = {};
  budgetItems.forEach(function(bi){ budgets[bi.catId] = (budgets[bi.catId] || 0) + bi.amount; });
}

// ─── SAVE ─────────────────────────────────────────────────
function _saveBudgetItems() {
  var _uid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _key = _uid ? 'hf2_budget_items_' + _uid : 'hf2_budget_items';
  localStorage.setItem(_key, JSON.stringify(budgetItems));
  // sync legacy
  budgets = {};
  budgetItems.forEach(function(bi){ budgets[bi.catId] = (budgets[bi.catId] || 0) + bi.amount; });
  if (typeof saveBudgets === 'function') saveBudgets(); // keep hf2_budgets_<uid> in sync
}

// ─── SPENDING LOOKUP ──────────────────────────────────────
function getBudgetSpending() {
  var actual = {};
  var now    = new Date();
  var toCheck;
  var _uid = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
  var _db  = _uid ? db.filter(function(e){ return (e.user_id||e.person) === _uid; }) : db;

  if (_budgetMode === 'cycle') {
    var cycleId = typeof getCurrentCycleId === 'function' ? getCurrentCycleId() : null;
    var cy      = cycleId && typeof getCycleById === 'function' ? getCycleById(cycleId) : null;
    toCheck = cy
      ? _db.filter(function(e){ return e.type==='expense' && isPaid(e) && e.date >= cy.start && e.date <= cy.end; })
      : _db.filter(function(e){ return e.type==='expense' && isPaid(e); });
  } else if (_budgetMode === 'billing') {
    var curBM = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    toCheck = _db.filter(function(e){
      var bm = e.billing_month || e.date.slice(0,7);
      return e.type==='expense' && isPaid(e) && bm === curBM;
    });
  } else {
    var curM = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    toCheck = _db.filter(function(e){ return e.type==='expense' && isPaid(e) && e.date.startsWith(curM); });
  }

  toCheck.forEach(function(e){
    var k = e.cat_id || e.cat_name || '—';
    actual[k] = (actual[k]||0) + e.amt;
  });
  return actual;
}

// ─── CASCADE: fill item dropdown when cat changes ─────────
function _onBudgetCatChange() {
  var catSel  = document.getElementById('budgetAddCat');
  var itemSel = document.getElementById('budgetAddItem');
  if (!catSel || !itemSel) return;
  var catId = catSel.value;
  var items = (typeof itemsData !== 'undefined' && catId) ? (itemsData[catId] || []) : [];
  itemSel.innerHTML =
    '<option value="">— ทุกรายการในหมวด —</option>' +
    items.map(function(it){
      return '<option value="' + it.id + '" data-name="' + (it.name||'').replace(/"/g,'&quot;') + '">' + it.name + '</option>';
    }).join('');
}

// ─── RENDER ───────────────────────────────────────────────
function renderBudget() {
  _loadBudgetsNow();
  var el = document.getElementById('budgetContent');
  if (!el) return;

  var now      = new Date();
  var cycleId  = typeof getCurrentCycleId === 'function' ? getCurrentCycleId() : null;
  var cy       = cycleId && typeof getCycleById === 'function' ? getCycleById(cycleId) : null;
  var modeLabel = _budgetMode === 'cycle'
    ? (cy ? cy.label : 'รอบปัจจุบัน')
    : _budgetMode === 'billing'
    ? 'เดือนบิล ' + THAI_MONTHS[now.getMonth()] + ' ' + (now.getFullYear()+543)
    : THAI_MONTHS[now.getMonth()] + ' ' + (now.getFullYear()+543);

  var actual   = getBudgetSpending();
  var expCats  = categories.filter(function(c){ return c.type === 'expense'; });

  // Group budgetItems by catId for spending lookup
  var catActual = {}; // catId → actual spent
  budgetItems.forEach(function(bi){
    var cat = expCats.find(function(c){ return c.id === bi.catId; });
    var spent = actual[bi.catId] || (cat ? actual[cat.name] : 0) || 0;
    catActual[bi.catId] = spent;
  });

  // Summary
  var totalBudget = budgetItems.reduce(function(s,bi){ return s + bi.amount; }, 0);
  var totalSpent  = (function(){
    var seenCats = {};
    return budgetItems.reduce(function(s,bi){
      if (!seenCats[bi.catId]) {
        seenCats[bi.catId] = true;
        return s + (catActual[bi.catId] || 0);
      }
      return s;
    }, 0);
  })();
  var overallPct = totalBudget > 0 ? Math.min(100, Math.round(totalSpent / totalBudget * 100)) : 0;

  // Mode tabs
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

  // Overall bar
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
        '<div style="font-size:11px;color:var(--ink3);text-align:right;margin-top:3px">' + overallPct + '% ใช้แล้ว</div>' +
      '</div>'
    : '';

  // Rows
  var rows = budgetItems.map(function(bi) {
    var cat = expCats.find(function(c){ return c.id === bi.catId; });
    var spent  = catActual[bi.catId] || 0;
    return budgetRow(bi, spent);
  }).join('');

  var emptyHint = budgetItems.length === 0
    ? '<div style="text-align:center;padding:28px 0;color:var(--ink3);font-size:13px">' +
        '📋 ยังไม่มีแผนรายจ่าย<br>' +
        '<span style="font-size:12px">เพิ่มหมวด+รายการด้านล่างเพื่อวางแผนและ Forecast</span>' +
      '</div>'
    : '';

  // Add form: category → item (dynamic) → amount
  var addForm = _renderBudgetAddForm(expCats);

  el.innerHTML =
    '<div class="card">' +
      '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span>แผนรายจ่าย → Forecast</span>' +
        '<span style="font-size:11px;font-weight:400;color:var(--ink3)">' + modeLabel + '</span>' +
      '</div>' +
      modeTabs +
      summaryBar +
      emptyHint +
      rows +
      addForm +
    '</div>';
}

// ─── ADD FORM ─────────────────────────────────────────────
function _renderBudgetAddForm(expCats) {
  return (
    '<div style="margin-top:14px;padding:12px;background:var(--surface2);border-radius:var(--r)">' +
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px">+ เพิ่มแผนรายจ่าย</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">' +
        // row 1: cat + item
        '<div style="display:flex;gap:6px;flex:1;min-width:200px;flex-wrap:wrap">' +
          '<select id="budgetAddCat" onchange="_onBudgetCatChange()" style="flex:1;min-width:120px;font-size:13px !important">' +
            '<option value="">— เลือกหมวด —</option>' +
            expCats.map(function(c){
              return '<option value="' + c.id + '" data-name="' + (c.name||'').replace(/"/g,'&quot;') + '">' + c.name + '</option>';
            }).join('') +
          '</select>' +
          '<select id="budgetAddItem" style="flex:1;min-width:120px;font-size:13px !important">' +
            '<option value="">— ทุกรายการในหมวด —</option>' +
          '</select>' +
        '</div>' +
        // amount + button
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<input type="number" id="budgetAddAmt" placeholder="ยอด (บาท)" min="0"' +
            ' style="width:130px;font-size:13px !important;font-family:monospace;text-align:right">' +
          '<button onclick="addBudgetItem()" class="btn btn-primary" style="white-space:nowrap;min-height:40px">+ เพิ่ม</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// ─── BUDGET ROW ───────────────────────────────────────────
function budgetRow(bi, spent) {
  var pct  = bi.amount > 0 ? Math.min(100, Math.round(spent / bi.amount * 100)) : 0;
  var over = spent > bi.amount;
  var bar  = over ? 'var(--red)' : pct > 80 ? 'var(--amber)' : 'var(--green)';
  var label = bi.catName + (bi.itemName ? '<span style="color:var(--ink3)"> › ' + bi.itemName + '</span>' : '');

  return '<div style="padding:11px 0;border-bottom:1px solid var(--line)">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span style="flex:1;font-size:13px;font-weight:600">' + label + '</span>' +
      '<span style="font-size:12px;font-family:monospace;color:' + (over ? 'var(--red)' : 'var(--ink2)') + '">' + fmtH(spent) + '</span>' +
      '<span style="font-size:11px;color:var(--ink3)">/</span>' +
      '<input type="number" value="' + bi.amount + '" min="0"' +
        ' onchange="(function(){ var idx=budgetItems.findIndex(function(x){return x.id===\''+bi.id+'\';});if(idx>=0){budgetItems[idx].amount=parseFloat(this.value)||0;_saveBudgetItems();renderBudget();}}).call(this)"' +
        ' style="width:86px;font-size:13px !important;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-family:monospace;text-align:right;background:var(--surface2)">' +
      '<button onclick="deleteBudgetItem(\'' + bi.id + '\')"' +
        ' style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:2px 8px;line-height:1;touch-action:manipulation" title="ลบ">×</button>' +
    '</div>' +
    '<div style="height:7px;background:var(--surface2);border-radius:4px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + bar + ';border-radius:4px;transition:width .5s"></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-top:3px">' +
      '<span>' + (over ? '⚠ เกิน ' + fmtH(spent - bi.amount) + ' บาท' : pct + '% ใช้แล้ว') + '</span>' +
      '<span>' + (over ? '' : fmtH(Math.max(0, bi.amount - spent)) + ' เหลือ') + '</span>' +
    '</div>' +
  '</div>';
}

// ─── ADD / DELETE ─────────────────────────────────────────
function addBudgetItem() {
  if (!checkOnlineForAction()) return;
  var catSel  = document.getElementById('budgetAddCat');
  var itemSel = document.getElementById('budgetAddItem');
  var catId   = ((catSel||{}).value||'').trim();
  var amt     = parseFloat((document.getElementById('budgetAddAmt')||{}).value) || 0;
  if (!catId) { showCycleToast('⚠️ เลือกหมวดหมู่ก่อน'); return; }
  if (!amt)   { showCycleToast('⚠️ ระบุยอดงบประมาณ');   return; }

  var catName = (catSel.selectedOptions[0]||{}).dataset.name
             || (catSel.selectedOptions[0]||{}).text || catId;
  var itemId  = ((itemSel||{}).value||'').trim();
  var itemName = itemId
    ? ((itemSel.selectedOptions[0]||{}).dataset.name || (itemSel.selectedOptions[0]||{}).text || '')
    : '';

  var biId = 'bi-' + Date.now();
  _loadBudgetsNow();
  budgetItems.push({ id: biId, catId: catId, catName: catName,
                     itemId: itemId, itemName: itemName, amount: amt });
  _saveBudgetItems();
  renderBudget();
}

function deleteBudgetItem(id) {
  if (!checkOnlineForAction()) return;
  _loadBudgetsNow();
  budgetItems = budgetItems.filter(function(bi){ return bi.id !== id; });
  _saveBudgetItems();
  renderBudget();
}
