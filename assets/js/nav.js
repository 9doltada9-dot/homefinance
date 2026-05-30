/* HomeFinance · module: nav.js · v3.2.1 */

// ─── disable browser scroll-restoration ──────────────────
// ป้องกัน SW client.navigate() reload แล้ว browser คืน Y เดิม ทับ scroll reset ของเรา
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ─── NAV ────────────────────────────────────────────────
function nav(page){
  var targetEl = document.getElementById('page-' + page);
  if (!targetEl) return; // guard — unknown page name

  // Step 1: ซ่อนทุก page — class + inline style (fallback กรณี CSS cache เก่าไม่มี !important)
  document.querySelectorAll('.page').forEach(function(p){
    p.classList.remove('active');
    p.style.display = 'none'; // belt-and-suspenders: ป้องกัน CSS !important ไม่โหลด
  });

  // Step 2: แสดง target page — set display:block อย่างชัดเจน (ไม่พึ่ง CSS cascade)
  document.querySelectorAll('.nav-item').forEach(function(i){i.classList.remove('active');});
  targetEl.classList.add('active');
  targetEl.style.display = 'block'; // explicit — ไม่ขึ้นกับ CSS !important cascade

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

  // แสดง/ซ่อนปุ่ม refresh ใน topbar
  var refreshBtn = document.getElementById('topbarRefreshBtn');
  var dataPages  = ['dashboard','transactions','accounts','settlement','budget','savings'];
  if(refreshBtn) refreshBtn.style.display = dataPages.indexOf(page) > -1 ? '' : 'none';

  closeSidebar();

  // reset scroll — ทำหลายรูปแบบ ครอบทุก container ที่ Chrome อาจใช้
  function _resetScroll(){
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    var el = document.querySelector('.main');
    if (el) el.scrollTop = 0;
  }
  _resetScroll(); // before render

  if(page==='dashboard'){ renderDash(); autoActivateSalary(); }
  if(page==='transactions'){
    if(typeof _txUpdateAdminBar === 'function') _txUpdateAdminBar();
    renderTx();
  }
  if(page==='settlement'){ populateMths('settleMonth'); renderSettle(); }
  if(page==='monthly'){ populateMths('monthSel'); renderMonthly(); }
  if(page==='add'){ initForm(); }
  if(page==='settings'){
    renderSettings();
    // refresh sync status เมื่อเข้าหน้าตั้งค่า
    if(typeof refreshSyncStatus==='function'){
      var localEl = document.getElementById('syncLocalCount');
      if(localEl) localEl.textContent = (window.db||[]).length + ' รายการ';
    }
  }
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
    if(typeof renderSplitGroupsSection==='function') renderSplitGroupsSection();
  }

  // silentPull เมื่อสลับไปหน้าข้อมูล (ถ้าผ่านมา >30 วิแล้ว)
  if(dataPages.indexOf(page) > -1 && typeof silentPull === 'function'){
    silentPull();
  }

  // double-rAF scroll reset after render — catches late layout shifts
  requestAnimationFrame(function(){
    _resetScroll();
    requestAnimationFrame(function(){
      _resetScroll();
      // setTimeout 300ms: ครอบ browser scroll-restoration ที่อาจ override หลัง rAF
      setTimeout(_resetScroll, 300);
    });
  });
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
