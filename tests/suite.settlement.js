/* Test suite: settlement / split-cost calculation
 *
 * Logic ที่ test (สรุปจากการอ่าน settlement.js):
 *   - รายจ่ายที่ split=true หาร 2 ระหว่าง 2 คน
 *   - รายจ่ายที่ split=false ตกเป็นภาระคนที่จ่าย
 *   - "owes" = (สิ่งที่ควรจ่ายร่วม) - (ที่จ่ายไปแล้วร่วม)
 */

// re-implement logic เพื่อ unit-test ไม่ต้องผูก DOM
function calcSettlement(entries, persons){
  var paid = {}, share = {};
  persons.forEach(function(p){ paid[p.id]=0; share[p.id]=0; });
  var totalSplit = 0;

  entries.filter(function(e){return e.type==='expense';}).forEach(function(e){
    paid[e.person] = (paid[e.person]||0) + e.amt;
    if (e.split){
      totalSplit += e.amt;
      var per = e.amt / persons.length;
      persons.forEach(function(p){ share[p.id] += per; });
    } else {
      // personal: ตัวเองรับผิดชอบ
      share[e.person] = (share[e.person]||0) + e.amt;
    }
  });

  // ใครต้องจ่ายใคร = share - paid
  var balances = persons.map(function(p){
    return { id: p.id, diff: Math.round(share[p.id] - paid[p.id]) };
  });
  return { paid: paid, share: share, balances: balances, totalSplit: totalSplit };
}

describe('settlement: equal split', function(){
  var persons = [{id:'A'},{id:'B'}];
  var entries = [
    {type:'expense', person:'A', amt:1000, split:true},
    {type:'expense', person:'B', amt:500,  split:true},
  ];

  it('totalSplit = 1500', function(){
    var s = calcSettlement(entries, persons);
    expect(s.totalSplit).toBe(1500);
  });
  it('A จ่าย 1000 ควรจ่าย 750 → ได้คืน 250', function(){
    var s = calcSettlement(entries, persons);
    expect(s.balances.find(function(b){return b.id==='A';}).diff).toBe(-250);
  });
  it('B จ่าย 500 ควรจ่าย 750 → ติด 250', function(){
    var s = calcSettlement(entries, persons);
    expect(s.balances.find(function(b){return b.id==='B';}).diff).toBe(250);
  });
});

describe('settlement: personal expense (split=false)', function(){
  var persons = [{id:'A'},{id:'B'}];
  it('personal expense ไม่หาร — เจ้าของรับเอง', function(){
    var entries = [
      {type:'expense', person:'A', amt:3000, split:false}, // ส่วนตัว A
    ];
    var s = calcSettlement(entries, persons);
    expect(s.totalSplit).toBe(0);
    expect(s.balances.find(function(b){return b.id==='A';}).diff).toBe(0);
    expect(s.balances.find(function(b){return b.id==='B';}).diff).toBe(0);
  });
});

describe('settlement: mixed (split + personal)', function(){
  var persons = [{id:'A'},{id:'B'}];
  it('A: 1000 split + 2000 personal | B: 500 split → A diff = -250, B diff = 250', function(){
    var entries = [
      {type:'expense', person:'A', amt:1000, split:true},
      {type:'expense', person:'A', amt:2000, split:false},
      {type:'expense', person:'B', amt:500,  split:true},
    ];
    var s = calcSettlement(entries, persons);
    // A จ่ายจริง 3000 ควรจ่าย (750 ส่วนแบ่ง + 2000 ส่วนตัว) = 2750 → diff -250
    expect(s.balances.find(function(b){return b.id==='A';}).diff).toBe(-250);
    expect(s.balances.find(function(b){return b.id==='B';}).diff).toBe(250);
  });
});

describe('settlement: balanced case (no debt)', function(){
  var persons = [{id:'A'},{id:'B'}];
  it('ทั้งสองจ่ายเท่ากัน → ไม่มีหนี้', function(){
    var entries = [
      {type:'expense', person:'A', amt:1000, split:true},
      {type:'expense', person:'B', amt:1000, split:true},
    ];
    var s = calcSettlement(entries, persons);
    expect(s.balances.find(function(b){return b.id==='A';}).diff).toBe(0);
    expect(s.balances.find(function(b){return b.id==='B';}).diff).toBe(0);
  });
});

describe('settlement: ignore income entries', function(){
  var persons = [{id:'A'},{id:'B'}];
  it('income ไม่นำมาคำนวณ', function(){
    var entries = [
      {type:'income',  person:'A', amt:30000, split:false},
      {type:'expense', person:'A', amt:1000,  split:true},
      {type:'expense', person:'B', amt:1000,  split:true},
    ];
    var s = calcSettlement(entries, persons);
    expect(s.balances.find(function(b){return b.id==='A';}).diff).toBe(0);
  });
});
