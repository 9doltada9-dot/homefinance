/* Test suite: salary cycle logic */
describe('salary cycle (getSalaryCycle)', function(){

  it('วันที่ ≥ 25 → cycle เริ่มเดือนนี้', function(){
    var c = getSalaryCycle('2026-05-25');
    expect(c.start).toBe('2026-05-25');
    expect(c.end).toBe('2026-06-24');
  });

  it('วันที่ 26 พ.ค. → cycle 25 พ.ค. – 24 มิ.ย.', function(){
    var c = getSalaryCycle('2026-05-26');
    expect(c.start).toBe('2026-05-25');
    expect(c.end).toBe('2026-06-24');
  });

  it('วันที่ < 25 → cycle เริ่มเดือนก่อน', function(){
    var c = getSalaryCycle('2026-05-10');
    expect(c.start).toBe('2026-04-25');
    expect(c.end).toBe('2026-05-24');
  });

  it('วันที่ 1 มกราคม → cycle ข้ามปี (25 ธ.ค. – 24 ม.ค.)', function(){
    var c = getSalaryCycle('2026-01-01');
    expect(c.start).toBe('2025-12-25');
    expect(c.end).toBe('2026-01-24');
  });

  it('label ใช้ปี พ.ศ.', function(){
    var c = getSalaryCycle('2026-05-26');
    // ปี 2026 → พ.ศ. 2569
    expect(c.label).toContain('2569');
  });
});

describe('isEarlySalary', function(){
  it('income วันที่ 23 = early', function(){
    expect(isEarlySalary({type:'income',date:'2026-05-23'})).toBeTruthy();
  });
  it('income วันที่ 24 = early', function(){
    expect(isEarlySalary({type:'income',date:'2026-05-24'})).toBeTruthy();
  });
  it('income วันที่ 25 = ไม่ใช่ early', function(){
    expect(isEarlySalary({type:'income',date:'2026-05-25'})).toBeFalsy();
  });
  it('income วันที่ 22 = ไม่ใช่ early (เกิน buffer)', function(){
    expect(isEarlySalary({type:'income',date:'2026-05-22'})).toBeFalsy();
  });
  it('expense วันที่ 24 = ไม่ใช่ early (ต้องเป็น income เท่านั้น)', function(){
    expect(isEarlySalary({type:'expense',date:'2026-05-24'})).toBeFalsy();
  });
});

describe('salaryActivateDate', function(){
  it('early salary 24 พ.ค. → activate 25 พ.ค.', function(){
    var d = salaryActivateDate({date:'2026-05-24'});
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-indexed: May
    expect(d.getDate()).toBe(25);
  });
});

describe('isSalary (เงินเดือน detection)', function(){
  it('cat_name "เงินเดือน" → true', function(){
    expect(isSalary({type:'income',cat_name:'เงินเดือน'})).toBeTruthy();
  });
  it('cat_name "โบนัส" → true', function(){
    expect(isSalary({type:'income',cat_name:'โบนัส'})).toBeTruthy();
  });
  it('cat_name "ผลพิเศษ" → false', function(){
    expect(isSalary({type:'income',cat_name:'ผลพิเศษ'})).toBeFalsy();
  });
  it('expense type → false (ไม่ว่า cat ชื่ออะไร)', function(){
    expect(isSalary({type:'expense',cat_name:'เงินเดือน'})).toBeFalsy();
  });
});
