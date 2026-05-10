/* HomeFinance · module: budget.js · v2.5.0 */

// ─── BUDGET MODULE ────────────────────────────────────────
var budgets = JSON.parse(localStorage.getItem('hf2_budgets')||'{}');
// budgets: { catId|'custom:NAME': amount }

function renderBudget(){
  var el = document.getElementById('budgetContent');
  if(!el) return;
  var now = new Date();
  var curMonth = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var expCats = categories.filter(function(c){return c.type==='expense';});
  var actual = {};
  db.filter(function(e){return e.type==='expense'&&isPaid(e)&&e.date.startsWith(curMonth);})
    .forEach(function(e){
      var k = e.cat_id || e.cat_name || '—';
      actual[k] = (actual[k]||0) + e.amt;
    });

  // --- category rows ---
  var catRows = expCats.map(function(cat){
    var spent = actual[cat.id] || actual[cat.name] || 0;
    var budget = budgets[cat.id] || 0;
    return budgetRow(cat.id, cat.name, spent, budget);
  }).join('');

  // --- custom rows ---
  var customs = Object.keys(budgets).filter(function(k){return k.startsWith('custom:');});
  var customRows = customs.map(function(k){
    var name = k.slice(7);
    var budget = budgets[k] || 0;
    return budgetRow(k, name, 0, budget, true);
  }).join('');

  var totalBudget = expCats.map(function(c){return budgets[c.id]||0;})
    .concat(customs.map(function(k){return budgets[k]||0;}))
    .reduce(function(s,v){return s+v;},0);
  var totalSpent = expCats.reduce(function(s,cat){return s+(actual[cat.id]||actual[cat.name]||0);},0);
  var overallPct = totalBudget>0 ? Math.min(100,Math.round(totalSpent/totalBudget*100)) : 0;

  el.innerHTML = '<div class="card">'+
    '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center">'+
      '<span>งบประมาณรายจ่าย</span>'+
      '<span style="font-size:11px;font-weight:400;color:var(--ink3)">'+THAI_MONTHS[now.getMonth()]+' '+(now.getFullYear()+543)+'</span>'+
    '</div>'+
    (totalBudget>0?'<div style="padding:10px;background:var(--surface2);border-radius:var(--r);margin-bottom:12px">'+
      '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">'+
        '<span>ภาพรวมทั้งหมด</span>'+
        '<span style="font-family:monospace;font-weight:600">'+fmt(totalSpent)+' / '+fmt(totalBudget)+' บาท</span>'+
      '</div>'+
      '<div style="height:8px;background:var(--line);border-radius:4px;overflow:hidden">'+
        '<div style="height:100%;width:'+overallPct+'%;background:'+(totalSpent>totalBudget?'var(--red)':overallPct>80?'var(--amber)':'var(--green)')+';border-radius:4px;transition:width .4s"></div>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--ink3);text-align:right;margin-top:3px">'+overallPct+'%</div>'+
    '</div>':'')+
    '<div style="font-size:12px;font-weight:600;color:var(--ink2);margin-bottom:6px">ตามหมวดหมู่</div>'+
    catRows+
    (customRows ? '<div style="font-size:12px;font-weight:600;color:var(--ink2);margin:12px 0 6px">รายการกำหนดเอง</div>'+customRows : '')+
    '<div style="margin-top:12px;padding:10px;background:var(--surface2);border-radius:var(--r)">'+
      '<div style="font-size:12px;font-weight:600;margin-bottom:8px">+ เพิ่มรายการกำหนดเอง</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        '<input type="text" id="customBudgetName" placeholder="ชื่อรายการ เช่น ท่องเที่ยว" style="flex:1;font-size:14px !important;min-width:120px">'+
        '<input type="number" id="customBudgetAmt" placeholder="งบประมาณ" min="0" style="width:120px;font-size:14px !important;font-family:monospace">'+
        '<button onclick="addCustomBudget()" class="btn btn-primary" style="white-space:nowrap;min-height:40px">+ เพิ่ม</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}

function budgetRow(key, name, spent, budget, isCustom){
  isCustom = isCustom || false;
  var pct = budget>0 ? Math.min(100,Math.round(spent/budget*100)) : 0;
  var over = budget>0 && spent>budget;
  var bar = over ? 'var(--red)' : pct>80 ? 'var(--amber)' : 'var(--green)';
  return '<div style="padding:10px 0;border-bottom:1px solid var(--line)">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'+
      '<span style="flex:1;font-size:13px;font-weight:500">'+name+(isCustom?' <span style="font-size:10px;color:var(--ink3);border:1px solid var(--line);border-radius:4px;padding:1px 4px">custom</span>':'')+'</span>'+
      (isCustom?'<button onclick="deleteCustomBudget(\''+key+'\')" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;padding:2px 6px">×</button>':'')+
      '<span style="font-size:12px;font-family:monospace;color:'+(over?'var(--red)':'var(--ink2)')+'">'+(isCustom?'—':fmt(spent))+'</span>'+
      '<span style="font-size:11px;color:var(--ink3)">/</span>'+
      '<input type="number" value="'+(budget||'')+'" placeholder="งบ" min="0"'+
        ' onchange="budgets[\''+key+'\']=parseFloat(this.value)||0;saveBudgets();renderBudget()"'+
        ' style="width:76px;font-size:13px !important;padding:4px 6px;border:1px solid var(--line);border-radius:6px;font-family:monospace;text-align:right;background:var(--surface2)">'+
    '</div>'+
    (budget>0?
      '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;width:'+pct+'%;background:'+bar+';border-radius:3px;transition:width .4s"></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ink3);margin-top:3px">'+
        '<span>'+(isCustom?'งบ '+fmt(budget)+' บาท':over?'⚠ เกิน '+fmt(spent-budget)+' บาท':pct+'% ใช้แล้ว')+'</span>'+
        '<span>'+(isCustom?'':fmt(Math.max(0,budget-spent))+' เหลือ')+'</span>'+
      '</div>'
      :'<div style="font-size:11px;color:var(--ink3)">ยังไม่ตั้งงบ</div>')+
  '</div>';
}

function addCustomBudget(){
  var name = (document.getElementById('customBudgetName')||{}).value;
  name = name ? name.trim() : '';
  var amt = parseFloat((document.getElementById('customBudgetAmt')||{}).value) || 0;
  if(!name||!amt) return;
  budgets['custom:'+name] = amt;
  saveBudgets();
  document.getElementById('customBudgetName').value='';
  document.getElementById('customBudgetAmt').value='';
  renderBudget();
}

function deleteCustomBudget(key){
  delete budgets[key];
  saveBudgets();
  renderBudget();
}
