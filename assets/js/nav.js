/* HomeFinance · module: nav.js · v2.5.0 */

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
  var bnMap={dashboard:'bn-dashboard',add:'bn-add',transactions:'bn-transactions',settlement:'bn-settlement',settings:'bn-settings'};
  var bnEl=document.getElementById(bnMap[page]);
  if(bnEl) bnEl.classList.add('active');
  closeSidebar();
  if(page==='dashboard') renderDash();
  if(page==='transactions') renderTx();
  if(page==='settlement'){ populateMths('settleMonth'); renderSettle(); }
  if(page==='monthly'){ populateMths('monthSel'); renderMonthly(); }
  if(page==='add'){ initForm(); }
  if(page==='settings'){ renderSettings(); }
  if(page==='supabase'){ initSbPage(); }
  if(page==='budget'){ renderBudget(); }
  if(page==='dashboard'){ autoActivateSalary(); }
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
