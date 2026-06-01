/* HomeFinance · glassSettings.js v2 — liquid-skin.css compatible */

// ─── DEFAULTS (match liquid-skin.css tokens) ──────────────
var GLASS_DEFAULTS = {
  gBlur: 40, gSat: 220, gCardOpacity: 66,
  orbOpacity: 90, orbBlur: 30,
  bgBase: '#e9edfb',
  orb1: '#9db8ff', orb2: '#ffc2e2', orb3: '#aef0ff', orb4: '#cdc4ff',
  accent: '#3f6fe0',
  modalDark: 45, modalBlur: 24,
};

var GLASS_DARK_PRESET = {
  gBlur: 40, gSat: 220, gCardOpacity: 55,
  orbOpacity: 55, orbBlur: 34,
  bgBase: '#0d111b',
  orb1: '#3f63c8', orb2: '#b5407f', orb3: '#1f8fb0', orb4: '#5848c0',
  accent: '#5c8dff',
  modalDark: 45, modalBlur: 24,
};

var GLASS_KEY = 'hf_glass_v2';

// ─── LOAD / SAVE ──────────────────────────────────────────
function glassLoad() {
  try { return Object.assign({}, GLASS_DEFAULTS, JSON.parse(localStorage.getItem(GLASS_KEY) || '{}')); }
  catch(e) { return Object.assign({}, GLASS_DEFAULTS); }
}
function glassSave(s) { localStorage.setItem(GLASS_KEY, JSON.stringify(s)); }

// ─── THEME DETECT ─────────────────────────────────────────
function _glassIsDark() {
  var dt = document.documentElement.getAttribute('data-theme');
  if (dt === 'dark') return true;
  if (dt === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches);
}

// ─── APPLY — sets all CSS vars used by liquid-skin.css ────
function glassApply(s) {
  var r = document.documentElement;
  var dark = _glassIsDark();
  var op  = (s.gCardOpacity / 100).toFixed(2);
  var op2 = (s.gCardOpacity * 0.62 / 100).toFixed(2);

  // blur + sat (เป็น var ใน backdrop-filter rule ของ liquid-skin.css)
  r.style.setProperty('--g-blur', s.gBlur + 'px');
  r.style.setProperty('--g-sat',  s.gSat  + '%');

  // card surfaces — base color ต่างกันตาม mode
  var base = dark ? '44,52,88' : '255,255,255';
  var card    = 'rgba(' + base + ',' + op  + ')';
  var strong  = dark
    ? 'rgba(56,64,104,' + Math.min((+op + .18), 1).toFixed(2) + ')'
    : 'rgba(255,255,255,' + Math.min((+op + .16), 1).toFixed(2) + ')';
  var surf2   = 'rgba(' + base + ',' + op2 + ')';

  r.style.setProperty('--g-card',     card);
  r.style.setProperty('--g-strong',   strong);
  r.style.setProperty('--surface',    card);
  r.style.setProperty('--surface2',   surf2);
  r.style.setProperty('--hf-g-card',  card);
  r.style.setProperty('--hf-g-strong',strong);

  // orbs
  r.style.setProperty('--orb-opacity', (s.orbOpacity / 100).toFixed(2));
  r.style.setProperty('--orb-blur',    s.orbBlur + 'px');
  r.style.setProperty('--bg-base',     s.bgBase);
  r.style.setProperty('--hf-bg-base',  s.bgBase);
  ['1','2','3','4'].forEach(function(n) {
    r.style.setProperty('--orb-'    + n, s['orb' + n]);
    r.style.setProperty('--hf-orb-' + n, s['orb' + n]);
  });

  // accent — คำนวณ accent-soft จาก hex
  r.style.setProperty('--accent',    s.accent);
  r.style.setProperty('--hf-accent', s.accent);
  r.style.setProperty('--blue',      s.accent);
  r.style.setProperty('--hf-blue',   s.accent);
  try {
    var h = s.accent.replace('#','');
    var ar = parseInt(h.slice(0,2),16), ag = parseInt(h.slice(2,4),16), ab = parseInt(h.slice(4,6),16);
    var soft = 'rgba('+ar+','+ag+','+ab+',.16)';
    r.style.setProperty('--accent-soft',    soft);
    r.style.setProperty('--hf-accent-soft', soft);
    r.style.setProperty('--blue-bg',        soft);
    r.style.setProperty('--hf-blue-bg',     soft);
  } catch(_){}

  // modal
  r.style.setProperty('--modal-dark', (s.modalDark / 100).toFixed(2));
  r.style.setProperty('--modal-blur', s.modalBlur + 'px');
}

// ─── RESET / PRESETS ──────────────────────────────────────
function glassReset() {
  localStorage.removeItem(GLASS_KEY);
  var def = _glassIsDark()
    ? Object.assign({}, GLASS_DEFAULTS, GLASS_DARK_PRESET)
    : Object.assign({}, GLASS_DEFAULTS);
  glassSave(def);
  glassApply(def);
  _glassRefreshPanel();
  if (typeof showCycleToast === 'function') showCycleToast('✓ รีเซ็ต Glass Settings แล้ว');
}

function glassPresetLight() {
  var s = Object.assign(glassLoad(), GLASS_DEFAULTS);
  glassSave(s); glassApply(s); _glassRefreshPanel();
}

function glassPresetDark() {
  var s = Object.assign(glassLoad(), GLASS_DARK_PRESET);
  glassSave(s); glassApply(s); _glassRefreshPanel();
}

// ─── INIT on load ─────────────────────────────────────────
(function(){ glassApply(glassLoad()); })();

// ─── SLIDER / COLOR helpers ───────────────────────────────
function _gSlider(id, label, key, min, max, unit, s, hint) {
  return '<div style="margin-bottom:13px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
    +   '<span style="font-size:12px;color:var(--ink2)">' + label
    +     (hint ? ' <span style="font-size:10px;color:var(--ink3)">'+hint+'</span>' : '') + '</span>'
    +   '<span id="glbl-'+id+'" style="font-size:12px;font-weight:700;color:var(--accent);min-width:44px;text-align:right">' + s[key] + unit + '</span>'
    + '</div>'
    + '<input type="range" min="'+min+'" max="'+max+'" value="'+s[key]+'" '
    +   'style="width:100%;accent-color:var(--accent)" '
    +   'oninput="glassOnSlider(\''+key+'\',this.value,\''+id+'\',\''+unit+'\')">'
    + '</div>';
}

function _gColor(id, label, key, s) {
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">'
    + '<input type="color" value="' + s[key] + '" '
    +   'style="width:30px;height:30px;border:none;border-radius:8px;cursor:pointer;padding:2px;background:none;flex-shrink:0" '
    +   'oninput="glassOnColor(\''+key+'\',this.value)">'
    + '<span style="font-size:12px;color:var(--ink2)">' + label + '</span>'
    + '</div>';
}

function _gSection(icon, title, body) {
  return '<div style="padding:11px 16px;border-bottom:1px solid var(--line)">'
    + '<div style="font-size:9.5px;font-weight:700;color:var(--ink3);letter-spacing:.7px;text-transform:uppercase;margin-bottom:9px">' + icon + ' ' + title + '</div>'
    + body + '</div>';
}

function glassOnSlider(key, val, id, unit) {
  var s = glassLoad(); s[key] = Number(val); glassSave(s); glassApply(s);
  var lbl = document.getElementById('glbl-' + id);
  if (lbl) lbl.textContent = val + unit;
}

function glassOnColor(key, val) {
  var s = glassLoad(); s[key] = val; glassSave(s); glassApply(s);
}

// ─── FLOATING PANEL ───────────────────────────────────────
function glassTogglePanel() {
  var p = document.getElementById('glassFP');
  if (p) { p.remove(); return; }
  _glassCreatePanel();
}

function _glassRefreshPanel() {
  if (document.getElementById('glassFP')) { document.getElementById('glassFP').remove(); _glassCreatePanel(); }
}

function _glassCreatePanel() {
  var s = glassLoad();
  var fp = document.createElement('div');
  fp.id = 'glassFP';
  fp.style.cssText = [
    'position:fixed;top:60px;right:12px;z-index:9999',
    'width:300px;max-height:calc(100vh - 80px);overflow-y:auto',
    'background:var(--g-strong)',
    'backdrop-filter:blur(var(--g-blur,40px)) saturate(var(--g-sat,180%))',
    '-webkit-backdrop-filter:blur(var(--g-blur,40px)) saturate(var(--g-sat,180%))',
    'border:1px solid var(--g-brd,rgba(255,255,255,.7))',
    'border-radius:var(--r2,22px)',
    'box-shadow:var(--g-shadow)',
    'font-family:Sarabun,sans-serif',
    'color:var(--ink)',
  ].join(';');

  fp.innerHTML =
    // header
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px 10px;'
    +   'border-bottom:1px solid var(--line);position:sticky;top:0;z-index:1;'
    +   'background:var(--surface2);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);'
    +   'border-radius:var(--r2,22px) var(--r2,22px) 0 0">'
    + '<span style="font-size:14px;font-weight:700;color:var(--accent)">✦ Liquid Glass</span>'
    + '<button onclick="glassTogglePanel()" style="background:none;border:none;font-size:20px;color:var(--ink3);cursor:pointer;padding:0 4px;line-height:1">×</button>'
    + '</div>'

    // preset buttons
    + '<div style="padding:10px 16px;border-bottom:1px solid var(--line);display:flex;gap:6px">'
    + '<button onclick="glassPresetLight()" style="flex:1;background:rgba(240,243,255,.72);border:1px solid rgba(200,210,255,.8);border-radius:10px;padding:7px;font-size:12px;cursor:pointer;font-weight:600;color:#2d3a6e;font-family:Sarabun,sans-serif;touch-action:manipulation">☀️ Light</button>'
    + '<button onclick="glassPresetDark()"  style="flex:1;background:rgba(20,26,58,.7);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:7px;font-size:12px;cursor:pointer;font-weight:600;color:#c2c8ec;font-family:Sarabun,sans-serif;touch-action:manipulation">🌙 Dark</button>'
    + '<button onclick="glassReset()" title="รีเซ็ต" style="flex:0 0 auto;background:transparent;border:1px solid var(--line);border-radius:10px;padding:7px 11px;font-size:13px;cursor:pointer;color:var(--ink3);font-family:Sarabun,sans-serif;touch-action:manipulation">↺</button>'
    + '</div>'

    + _gSection('🎨','Accent / สี',
        _gColor('accent','สี Accent (ปุ่ม, Link, Active)','accent',s))

    + _gSection('🌈','Aurora Background',
        _gColor('bgBase','พื้นหลัง bg-base','bgBase',s)
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 8px">'
        + _gColor('orb1','Orb 1','orb1',s) + _gColor('orb2','Orb 2','orb2',s)
        + _gColor('orb3','Orb 3','orb3',s) + _gColor('orb4','Orb 4','orb4',s)
        + '</div>'
        + _gSlider('orbOpacity','ความเข้ม Orb','orbOpacity',0,100,'%',s)
        + _gSlider('orbBlur','Blur Orb','orbBlur',0,80,'px',s))

    + _gSection('🪟','Glass Cards',
        _gSlider('gBlur','Blur กระจก','gBlur',0,80,'px',s)
        + _gSlider('gCardOpacity','ความทึบการ์ด','gCardOpacity',10,100,'%',s,'(light=66 / dark=55)')
        + _gSlider('gSat','Saturation','gSat',100,300,'%',s))

    + _gSection('🗔','Modal / Overlay',
        _gSlider('modalDark','ความมืด backdrop','modalDark',0,100,'%',s)
        + _gSlider('modalBlur','Blur Modal','modalBlur',0,80,'px',s))

    + '<div style="padding:8px 16px 12px;text-align:center;font-size:10px;color:var(--ink3)">บันทึกอัตโนมัติ · มีผลทันที · รองรับ Light/Dark</div>';

  document.body.appendChild(fp);
}

// ─── Settings page embed ──────────────────────────────────
function renderGlassSettings() {
  var wrap = document.getElementById('glassSettingsPanel');
  if (!wrap) return;
  wrap.innerHTML =
    '<div style="padding:14px 16px">'
    + '<button onclick="glassTogglePanel()" class="btn btn-primary" style="width:100%;min-height:44px;font-size:14px">'
    + '✦ เปิด Liquid Glass Settings</button>'
    + '<p style="font-size:11px;color:var(--ink3);margin:8px 0 0;text-align:center">panel ลอยมุมขวาบน · ปรับแล้วเห็นผลทันที · รองรับ Light &amp; Dark mode</p>'
    + '</div>';
}
