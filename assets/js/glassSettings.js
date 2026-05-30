/* HomeFinance · glassSettings.js — Live glass customization panel */

var GLASS_DEFAULTS = {
  gBlur:        24,
  gCardOpacity: 72,
  gSat:        140,
  orbOpacity:   85,
  orbBlur:      36,
  bgBase:      '#e8eaf6',
  orb1:        '#c4b5fd',
  orb2:        '#fbcfe8',
  orb3:        '#bae6fd',
  orb4:        '#bbf7d0',
  modalDark:    82,
  modalBlur:    40,
};

var GLASS_KEY = 'hf_glass_settings';

function glassLoad() {
  try {
    var saved = JSON.parse(localStorage.getItem(GLASS_KEY) || '{}');
    // migrate: ถ้า gBlur เก่าเกิน 80px ให้ reset เป็น default ใหม่
    if (saved.gBlur && saved.gBlur > 80) { saved.gBlur = GLASS_DEFAULTS.gBlur; }
    return Object.assign({}, GLASS_DEFAULTS, saved);
  }
  catch(e) { return Object.assign({}, GLASS_DEFAULTS); }
}

function glassApply(s) {
  var r = document.documentElement;
  r.style.setProperty('--g-blur',        s.gBlur + 'px');
  r.style.setProperty('--g-card',        'rgba(255,255,255,' + (s.gCardOpacity/100).toFixed(2) + ')');
  r.style.setProperty('--g-strong',      'rgba(255,255,255,' + Math.min((s.gCardOpacity/100 + 0.14), 1).toFixed(2) + ')');
  r.style.setProperty('--g-sat',         s.gSat + '%');
  r.style.setProperty('--orb-opacity',   (s.orbOpacity/100).toFixed(2));
  r.style.setProperty('--orb-blur',      s.orbBlur + 'px');
  r.style.setProperty('--bg-base',       s.bgBase);
  r.style.setProperty('--orb-1',         s.orb1);
  r.style.setProperty('--orb-2',         s.orb2);
  r.style.setProperty('--orb-3',         s.orb3);
  r.style.setProperty('--orb-4',         s.orb4);
  r.style.setProperty('--modal-dark',    (s.modalDark/100).toFixed(2));
  r.style.setProperty('--modal-blur',    s.modalBlur + 'px');
}

function glassSave(s) {
  localStorage.setItem(GLASS_KEY, JSON.stringify(s));
}

function glassReset() {
  localStorage.removeItem(GLASS_KEY);
  glassApply(GLASS_DEFAULTS);
  renderGlassSettings();
  showMsg('glassMsg', 'รีเซ็ตเป็นค่าเริ่มต้นแล้ว', 'success');
}

// ── Init: load + apply on page load ───────────────────────
(function(){ glassApply(glassLoad()); })();

// ── Slider helper ─────────────────────────────────────────
function _slider(id, label, key, min, max, unit, s, hint) {
  return '<div style="margin-bottom:14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
    +   '<span style="font-size:13px;color:var(--ink2)">' + label + (hint ? ' <span style="font-size:11px;color:var(--ink3)">'+hint+'</span>' : '') + '</span>'
    +   '<span id="lbl-' + id + '" style="font-size:13px;font-weight:600;color:var(--accent);min-width:48px;text-align:right">' + s[key] + unit + '</span>'
    + '</div>'
    + '<input type="range" min="' + min + '" max="' + max + '" value="' + s[key] + '" '
    +   'style="width:100%;accent-color:var(--accent)" '
    +   'oninput="glassOnSlider(\''+key+'\',this.value,\''+id+'\',\''+unit+'\')">'
    + '</div>';
}

function _color(id, label, key, s) {
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'
    + '<input type="color" value="' + s[key] + '" style="width:36px;height:36px;border:none;border-radius:8px;cursor:pointer;padding:2px" '
    +   'oninput="glassOnColor(\''+key+'\',this.value)">'
    + '<span style="font-size:13px;color:var(--ink2)">' + label + '</span>'
    + '</div>';
}

function glassOnSlider(key, val, id, unit) {
  var s = glassLoad();
  s[key] = Number(val);
  glassSave(s);
  glassApply(s);
  var lbl = document.getElementById('lbl-' + id);
  if (lbl) lbl.textContent = val + unit;
}

function glassOnColor(key, val) {
  var s = glassLoad();
  s[key] = val;
  glassSave(s);
  glassApply(s);
}

// ── Floating panel toggle ─────────────────────────────────
function glassTogglePanel() {
  var panel = document.getElementById('glassFP');
  if (panel) { panel.remove(); return; }
  _glassCreatePanel();
}

function _glassCreatePanel() {
  var s = glassLoad();
  var fp = document.createElement('div');
  fp.id = 'glassFP';
  fp.style.cssText = [
    'position:fixed;top:60px;right:12px;z-index:9999',
    'width:300px;max-height:calc(100vh - 80px);overflow-y:auto',
    'background:rgba(255,255,255,.92)',
    'backdrop-filter:blur(24px) saturate(160%)',
    '-webkit-backdrop-filter:blur(24px) saturate(160%)',
    'border:1px solid rgba(200,206,255,.7)',
    'border-radius:18px',
    'box-shadow:0 20px 60px -16px rgba(40,46,96,.30),0 4px 16px -6px rgba(40,46,96,.18)',
    'font-family:Sarabun,sans-serif'
  ].join(';');

  fp.innerHTML =
    // header + close
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px;border-bottom:1px solid rgba(92,104,158,.12);position:sticky;top:0;background:rgba(255,255,255,.95);border-radius:18px 18px 0 0;z-index:1">'
    + '<span style="font-size:14px;font-weight:700;color:#3730a3">🎨 Glass Settings</span>'
    + '<button onclick="glassTogglePanel()" style="background:none;border:none;font-size:20px;color:#94a3b8;cursor:pointer;padding:0 4px;line-height:1">×</button>'
    + '</div>'

    // ── พื้นหลัง
    + '<div style="padding:12px 16px 4px;border-bottom:1px solid rgba(92,104,158,.10)">'
    + '<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.6px;margin-bottom:8px">🌈 พื้นหลัง</div>'
    + _color('bgBase','สีพื้นหลัง','bgBase',s)
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px">'
    +   _color('orb1','Orb 1','orb1',s) + _color('orb2','Orb 2','orb2',s)
    +   _color('orb3','Orb 3','orb3',s) + _color('orb4','Orb 4','orb4',s)
    + '</div>'
    + _slider('orbOpacity','ความเข้ม Orb','orbOpacity',0,100,'%',s)
    + _slider('orbBlur','Blur Orb','orbBlur',0,80,'px',s,'')
    + '</div>'

    // ── กระจก
    + '<div style="padding:12px 16px 4px;border-bottom:1px solid rgba(92,104,158,.10)">'
    + '<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.6px;margin-bottom:8px">🪟 กระจก</div>'
    + _slider('gBlur','Blur กระจก','gBlur',0,200,'px',s,'')
    + _slider('gCardOpacity','ความโปร่งใส','gCardOpacity',10,100,'%',s,'')
    + _slider('gSat','Saturation','gSat',100,250,'%',s,'')
    + '</div>'

    // ── Modal
    + '<div style="padding:12px 16px 4px;border-bottom:1px solid rgba(92,104,158,.10)">'
    + '<div style="font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:.6px;margin-bottom:8px">🗔 Modal</div>'
    + _slider('modalDark','ความมืด backdrop','modalDark',0,100,'%',s,'')
    + _slider('modalBlur','Blur Modal','modalBlur',0,80,'px',s,'')
    + '</div>'

    // ── actions
    + '<div style="padding:10px 16px;display:flex;gap:8px">'
    + '<button onclick="glassReset()" style="flex:1;padding:8px;border-radius:10px;border:1px solid rgba(92,104,158,.2);background:rgba(255,255,255,.6);font-size:12px;cursor:pointer;color:#475569">↺ รีเซ็ต</button>'
    + '<div id="glassMsg" style="flex:2;font-size:11px;color:#22c55e;display:flex;align-items:center;justify-content:center"></div>'
    + '</div>';

  document.body.appendChild(fp);
}

// ── Settings page embed (ปุ่มเปิด floating panel) ─────────
function renderGlassSettings() {
  var wrap = document.getElementById('glassSettingsPanel');
  if (!wrap) return;
  wrap.innerHTML =
    '<div style="padding:14px 16px">'
    + '<button onclick="glassTogglePanel()" class="btn btn-primary" style="width:100%;min-height:44px;font-size:14px">'
    + '🎨 เปิดหน้าต่างปรับแต่ง Glass (แบบ live preview)'
    + '</button>'
    + '<p style="font-size:12px;color:var(--ink3);margin:8px 0 0;text-align:center">panel จะลอยอยู่มุมขวาบน — เห็นผลจริงขณะปรับ</p>'
    + '</div>';
}
