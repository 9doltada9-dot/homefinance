/* HomeFinance · module: salary.js · v2.5.0 */

// ─── SALARY HIDE/REVEAL ───────────────────────────────────
function isSalary(e){
  if(e.type!=='income') return false;
  var name = (e.cat_name||'').toLowerCase();
  return name.indexOf('เงินเดือน')>-1 || name.indexOf('salary')>-1 || name.indexOf('โบนัส')>-1;
}
function revealSal(id){ var el=document.getElementById('sal-'+id); if(el) el.style.filter='none'; }
function hideSal(id){ var el=document.getElementById('sal-'+id); if(el) el.style.filter='blur(5px)'; }

// ─── SALARY CYCLE ─────────────────────────────────────────
/**
 * Returns the current salary cycle for a given date:
 * { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', label: 'พ.ค. - มิ.ย. 2569' }
 */
function getSalaryCycle(date){
  var d = date ? new Date(date) : new Date();
  var day = d.getDate();
  var y = d.getFullYear();
  var m = d.getMonth(); // 0-indexed

  var cycleStart, cycleEnd;
  if(day >= SALARY_DAY){
    // e.g. May 25 → cycle: May 25 – Jun 24
    cycleStart = new Date(y, m, SALARY_DAY);
    cycleEnd   = new Date(y, m+1, SALARY_DAY-1);
  } else {
    // e.g. May 10 → cycle: Apr 25 – May 24
    cycleStart = new Date(y, m-1, SALARY_DAY);
    cycleEnd   = new Date(y, m, SALARY_DAY-1);
  }
  var fmt8 = function(d2){ return d2.getFullYear()+'-'+String(d2.getMonth()+1).padStart(2,'0')+'-'+String(d2.getDate()).padStart(2,'0'); };
  var sm = SHORT_M[cycleStart.getMonth()];
  var em = SHORT_M[cycleEnd.getMonth()];
  var sy = cycleStart.getFullYear()+543;
  var ey = cycleEnd.getFullYear()+543;
  return {
    start: fmt8(cycleStart),
    end:   fmt8(cycleEnd),
    label: sy===ey ? (sm+' – '+em+' '+sy) : (sm+' '+sy+' – '+em+' '+ey)
  };
}

/**
 * Is this income entry an "early salary"?
 * Income arrives before the 25th but within EARLY_DAYS buffer.
 */
function isEarlySalary(entry){
  if(entry.type !== 'income') return false;
  var d   = new Date(entry.date);
  var day = d.getDate();
  // early if day is in [25-EARLY_DAYS, 24] i.e. 23 or 24
  return day >= (SALARY_DAY - EARLY_DAYS) && day < SALARY_DAY;
}

/**
 * The date this early salary will activate.
 */
function salaryActivateDate(entry){
  var d = new Date(entry.date);
  return new Date(d.getFullYear(), d.getMonth(), SALARY_DAY);
}

/**
 * Auto-activate pending income entries that have reached their salary day.
 * Called on app startup and when navigating to dashboard.
 */
function autoActivateSalary(){
  var today = new Date(); today.setHours(0,0,0,0);
  var changed = false;
  db.forEach(function(e){
    if(e.type!=='income' || e.status!=='pending') return;
    if(!e._salary_cycle) return; // only auto-activate salary-flagged entries
    var activateOn = salaryActivateDate(e);
    if(today >= activateOn){
      e.status = 'received';
      sbUpdate(e);
      changed = true;
    }
  });
  if(changed){ save(); renderDash(); renderTx(); showCycleToast('💰 รายรับถึงวันที่ 25 แล้ว — อัปเดตสถานะเป็น รับแล้ว'); }
}

var _cycleToastTimer = null;
function showCycleToast(msg){
  var t = document.getElementById('cycleToast');
  if(!t){
    t = document.createElement('div'); t.id='cycleToast';
    t.style.cssText=[
      'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px)',
      'left:50%;transform:translateX(-50%)',
      'background:#1a4fa0;color:#fff',
      'padding:12px 18px;border-radius:16px',
      'font-size:13px;font-weight:600;font-family:Sarabun,sans-serif',
      'z-index:999;max-width:calc(100vw - 40px)',
      'box-shadow:0 4px 20px rgba(0,0,0,.3)',
      'transition:opacity .3s'
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity='1';
  clearTimeout(_cycleToastTimer);
  _cycleToastTimer=setTimeout(function(){ t.style.opacity='0'; }, 5000);
}
