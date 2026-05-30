/* HomeFinance · glassSettings.js — Live glass customization panel */

var GLASS_DEFAULTS = {
  gBlur:       160,
  gCardOpacity: 68,
  gSat:        200,
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
  try { return Object.assign({}, GLASS_DEFAULTS, JSON.parse(localStorage.getItem(GLASS_KEY) || '{}')); }
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

// ── Render panel ──────────────────────────────────────────
function renderGlassSettings() {
  var wrap = document.getElementById('glassSettingsPanel');
  if (!wrap) return;
  var s = glassLoad();

  wrap.innerHTML =
    // ── พื้นหลัง
    '<div style="padding:14px 16px 4px;border-bottom:1px solid var(--line)">'
    + '<div style="font-size:12px;font-weight:700;color:var(--ink3);letter-spacing:.5px;margin-bottom:10px">🌈 พื้นหลัง</div>'
    + _color('bgBase','สีพื้นหลัง','bgBase',s)
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px">'
    +   _color('orb1','Orb 1','orb1',s)
    +   _color('orb2','Orb 2','orb2',s)
    +   _color('orb3','Orb 3','orb3',s)
    +   _color('orb4','Orb 4','orb4',s)
    + '</div>'
    + _slider('orbOpacity','ความเข้ม Orb','orbOpacity',0,100,'%',s)
    + _slider('orbBlur','Blur Orb','orbBlur',0,80,'px',s,'(เบลอสี)')
    + '</div>'

    // ── กระจก
    + '<div style="padding:14px 16px 4px;border-bottom:1px solid var(--line)">'
    + '<div style="font-size:12px;font-weight:700;color:var(--ink3);letter-spacing:.5px;margin-bottom:10px">🪟 กระจก (Glass)</div>'
    + _slider('gBlur','Blur กระจก','gBlur',0,200,'px',s,'(ฝ้า)')
    + _slider('gCardOpacity','ความโปร่งใส Card','gCardOpacity',10,100,'%',s)
    + _slider('gSat','Saturation','gSat',100,250,'%',s,'(ความอิ่มสี)')
    + '</div>'

    // ── Modal
    + '<div style="padding:14px 16px 4px;border-bottom:1px solid var(--line)">'
    + '<div style="font-size:12px;font-weight:700;color:var(--ink3);letter-spacing:.5px;margin-bottom:10px">🗔 Modal</div>'
    + _slider('modalDark','ความมืด Backdrop','modalDark',0,100,'%',s)
    + _slider('modalBlur','Blur Modal box','modalBlur',0,80,'px',s)
    + '</div>'

    // ── Actions
    + '<div style="padding:12px 16px;display:flex;gap:8px">'
    + '<button class="btn btn-ghost" onclick="glassReset()" style="flex:1;min-height:40px;font-size:13px">↺ รีเซ็ต</button>'
    + '<div id="glassMsg" class="msg" style="flex:2;display:flex;align-items:center;justify-content:center;font-size:12px"></div>'
    + '</div>';
}
