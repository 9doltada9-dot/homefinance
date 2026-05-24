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
 * คืนวันจ่ายเงินที่แท้จริง: ถ้า SALARY_DAY ตรงเสาร์/อาทิตย์ → วันศุกร์ก่อนหน้า
 * @param {number} year - ปีคริสต์ศักราช
 * @param {number} month - เดือน 0-indexed
 */
function _effectiveSalaryDay(year, month) {
  var d = new Date(year, month, SALARY_DAY);
  var dow = d.getDay(); // 0=อาทิตย์, 6=เสาร์
  if (dow === 6) return SALARY_DAY - 1; // เสาร์ → ศุกร์ก่อนหน้า (เช่น 24)
  if (dow === 0) return SALARY_DAY - 2; // อาทิตย์ → ศุกร์ก่อนหน้า (เช่น 23)
  return SALARY_DAY;
}

/**
 * Returns the current salary cycle for a given date:
 * { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', label: 'พ.ค. - มิ.ย. 2569' }
 */
function getSalaryCycle(date){
  var d = date ? new Date(date) : new Date();
  var day = d.getDate();
  var y = d.getFullYear();
  var m = d.getMonth(); // 0-indexed

  // วันจ่ายที่แท้จริงของเดือนนี้และเดือนก่อน
  var effDay     = _effectiveSalaryDay(y, m);
  var effPrevDay = _effectiveSalaryDay(y, m - 1);

  var cycleStart, cycleEnd;
  if(day >= effDay){
    // เช่น 25 พ.ค. (หรือ 24 ถ้าเสาร์) → รอบ: effDay พ.ค. – effNextDay-1 มิ.ย.
    var effNextDay = _effectiveSalaryDay(y, m + 1);
    cycleStart = new Date(y, m, effDay);
    cycleEnd   = new Date(y, m + 1, effNextDay - 1);
  } else {
    // เช่น 10 พ.ค. → รอบ: effPrevDay เม.ย. – effDay-1 พ.ค.
    cycleStart = new Date(y, m - 1, effPrevDay);
    cycleEnd   = new Date(y, m, effDay - 1);
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
 * "Early salary" = ใช้เฉพาะเมื่อวันที่ 25 ตรงเสาร์/อาทิตย์
 * → effective pay day เลื่อนมาเป็นวันศุกร์ก่อนหน้า
 * Entry ที่ date ตรงกับ effective Friday นั้นถือเป็น "รอรับ" จนถึงวันนั้น
 */
function isEarlySalary(entry){
  if(entry.type !== 'income') return false;
  var d      = new Date(entry.date);
  var day    = d.getDate();
  var effDay = _effectiveSalaryDay(d.getFullYear(), d.getMonth());
  // ไม่มี early window ถ้า 25 เป็นวันธรรมดา
  if(effDay === SALARY_DAY) return false;
  // 25 ตรงเสาร์/อาทิตย์ → early เฉพาะ entry ที่ date = effective Friday นั้น
  return day === effDay;
}

/**
 * The date this early salary will activate (วันจ่ายที่แท้จริง).
 */
function salaryActivateDate(entry){
  var d      = new Date(entry.date);
  var effDay = _effectiveSalaryDay(d.getFullYear(), d.getMonth());
  return new Date(d.getFullYear(), d.getMonth(), effDay);
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
  if(changed){ save(); renderDash(); renderTx(); showCycleToast('💰 ถึงวันจ่ายเงินเดือนแล้ว — อัปเดตสถานะเป็น รับแล้ว'); }
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
