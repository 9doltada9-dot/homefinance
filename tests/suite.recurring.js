/* Test suite: recurring transactions (features.js)
 *
 * processRecurring() ต้อง:
 *   - สร้าง entry ลง db ถ้าวันถึง day_of_month แล้วและยังไม่ทำเดือนนี้
 *   - ตั้ง last_run_yyyymm = current month
 *   - ไม่ทำซ้ำในเดือนเดียวกัน
 */

// stub global state ที่ features.js ต้องการ
function setupRecurringEnv(){
  window.db = [];
  window.save = function(){};
  window.sbAdd = function(){};
  window.localStorage.removeItem('hf2_recurring');
}

describe('recurring: storage helpers', function(){
  it('getRecurringList ตอนเริ่ม → []', function(){
    setupRecurringEnv();
    expect(getRecurringList()).toEqual([]);
  });

  it('addRecurring + getRecurringList', function(){
    setupRecurringEnv();
    addRecurring({type:'expense', cat_name:'ค่าบ้าน', desc:'ผ่อน', amt:15000, day_of_month:1, person:'A', split:true});
    var list = getRecurringList();
    expect(list.length).toBe(1);
    expect(list[0].cat_name).toBe('ค่าบ้าน');
    expect(list[0].last_run_yyyymm).toBe('');
  });

  it('deleteRecurring ลบตาม id', function(){
    setupRecurringEnv();
    var id = addRecurring({type:'expense', cat_name:'X', desc:'X', amt:100, day_of_month:1, person:'A'});
    expect(getRecurringList().length).toBe(1);
    deleteRecurring(id);
    expect(getRecurringList().length).toBe(0);
  });
});

describe('recurring: processRecurring', function(){
  it('สร้าง entry ถ้าถึงกำหนด', function(){
    setupRecurringEnv();
    addRecurring({type:'expense', cat_name:'ค่าบ้าน', desc:'ผ่อน', amt:15000, day_of_month:1, person:'A', split:true});
    var n = processRecurring();
    expect(n).toBe(1);
    expect(window.db.length).toBe(1);
    expect(window.db[0].amt).toBe(15000);
    expect(window.db[0].note).toContain('[auto]');
  });

  it('ไม่ทำซ้ำในเดือนเดียวกัน', function(){
    setupRecurringEnv();
    addRecurring({type:'expense', cat_name:'X', desc:'X', amt:100, day_of_month:1, person:'A'});
    processRecurring();
    var n2 = processRecurring();
    expect(n2).toBe(0);
    expect(window.db.length).toBe(1);
  });

  it('skip ถ้าวันยังไม่ถึง day_of_month', function(){
    setupRecurringEnv();
    // ตั้งวันเป็น 31 (เกือบทุกเดือนไม่ถึง)
    addRecurring({type:'expense', cat_name:'X', desc:'X', amt:100, day_of_month:31, person:'A'});
    var today = new Date();
    if (today.getDate() < 31){
      var n = processRecurring();
      expect(n).toBe(0);
    } else {
      // ถ้า test รันวันที่ 31 จริง ๆ ข้าม assertion
      expect(true).toBeTruthy();
    }
  });
});
