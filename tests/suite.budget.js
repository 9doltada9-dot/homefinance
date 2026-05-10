/* Test suite: budget progress logic
 *
 * จากการอ่าน budget.js: progress bar ใช้ percent = spent/budget
 *   < 80%  → green
 *   80-100 → amber
 *   > 100  → red
 */
function bucketColor(spent, budget){
  if (!budget || budget <= 0) return 'none';
  var pct = (spent / budget) * 100;
  if (pct > 100) return 'red';
  if (pct >= 80) return 'amber';
  return 'green';
}

function progressPercent(spent, budget){
  if (!budget || budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

describe('budget bucket coloring', function(){
  it('0% used → green', function(){
    expect(bucketColor(0, 1000)).toBe('green');
  });
  it('50% used → green', function(){
    expect(bucketColor(500, 1000)).toBe('green');
  });
  it('79% used → green', function(){
    expect(bucketColor(790, 1000)).toBe('green');
  });
  it('80% used → amber', function(){
    expect(bucketColor(800, 1000)).toBe('amber');
  });
  it('100% used → amber (boundary)', function(){
    expect(bucketColor(1000, 1000)).toBe('amber');
  });
  it('101% used → red', function(){
    expect(bucketColor(1010, 1000)).toBe('red');
  });
  it('200% used → red', function(){
    expect(bucketColor(2000, 1000)).toBe('red');
  });
  it('budget = 0 → none (ไม่มีงบ)', function(){
    expect(bucketColor(500, 0)).toBe('none');
  });
});

describe('progress percent (cap 100)', function(){
  it('half', function(){
    expect(progressPercent(500, 1000)).toBe(50);
  });
  it('over 100 capped at 100', function(){
    expect(progressPercent(2000, 1000)).toBe(100);
  });
  it('zero budget → 0', function(){
    expect(progressPercent(500, 0)).toBe(0);
  });
});
