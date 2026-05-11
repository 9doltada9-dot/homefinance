/* HomeFinance · module: nav.js · v3.2.0 */

// ─── NAV ────────────────────────────────────────────────
function nav(page){
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.nav-item').forEach(function(i){i.classList.remove('active');});
  document.getElementById('page-'+page).classList.add('active');
  // highlight sidebar item
  var navItems=[].slice.call(document.querySelectorAll('.nav-item'));
  navItems.forEach(function(i){
    if(i.getAttribute('onclick')&&i.getAttribute('onclick').indexOf("'"+page+"'")>-1) i.classList.add('active');
  });
  // highlight bottom nav
  document.querySelectorAll('.bn-item').forEach(function(b){b.classList.remove('active');});
  var bnMap={
    dashboard:'bn-dashboard', add:'bn-add',
    transactions:'bn-transactions', settlement:'bn-settlement',
    accounts:'bn-accounts', settings:'bn-settings'
  };
  var bnEl=document.getElementById(bnMap[page]);
  if(bnEl) bnEl.classList.add('active');
  closeSidebar();
  if(page==='dashboard'){ renderDash(); autoActivateSalary(); }
  if(page==='transactions') renderTx();
  if(page==='settlement'){ populateMths('settleMonth'); renderSettle(); }
  if(page==='monthly'){ populateMths('monthSel'); renderMonthly(); }
  if(page==='add'){ initForm(); }
  if(page==='settings'){ renderSettings(); }
  if(page==='supabase'){ initSbPage(); }
  if(page==='budget'){ renderBudget(); }
  if(page==='accounts'){
    if(typeof renderAccountCards==='function') renderAccountCards();
    if(typeof renderAccountList==='function') renderAccountList();
  }
  if(page==='savings'){
    if(typeof renderSavingsGoals==='function') renderSavingsGoals();
    if(typeof fillAccountSelectors==='function') fillAccountSelectors();
  }
  if(page==='admin'){
    // Guard — redirect non-admins
    if(typeof isAdminUser==='function' && !isAdminUser()){ nav('dashboard'); return; }
    if(typeof populateAdminMonths==='function') populateAdminMonths();
    if(typeof renderAdminUserList==='function') renderAdminUserList();
  }
}

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').style.display =
    document.getElementById('sidebar').classList.contains('open') ? 'block' : 'none';
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display='none';
}
