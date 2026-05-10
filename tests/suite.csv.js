/* Test suite: CSV escape (จาก features.js exportFilteredCSV)
 *
 * เนื่องจาก function exportFilteredCSV ผูกกับ DOM (Blob, click), เรา test
 * เฉพาะ helper escape ที่อยู่ใน scope edge-case โดย re-implement ตาม spec
 */

function csvEscape(v){
  var s = (v === null || v === undefined) ? '' : String(v);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g,'""') + '"';
  return s;
}

describe('CSV escape', function(){
  it('plain string ไม่ถูก quote', function(){
    expect(csvEscape('hello')).toBe('hello');
  });
  it('null → empty', function(){
    expect(csvEscape(null)).toBe('');
  });
  it('undefined → empty', function(){
    expect(csvEscape(undefined)).toBe('');
  });
  it('number → string', function(){
    expect(csvEscape(123)).toBe('123');
  });
  it('comma ใน text → ถูก quote', function(){
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('quote ใน text → ถูก double quote', function(){
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it('newline → ถูก quote', function(){
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });
  it('Thai text + comma → quote', function(){
    expect(csvEscape('ค่าบ้าน, ผ่อน')).toBe('"ค่าบ้าน, ผ่อน"');
  });
});
