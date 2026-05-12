/* HomeFinance · module: auth.js · v3.2.0
 * Supabase Auth — login, logout, session restore, profile management
 *
 * Must be loaded BEFORE app.js in index.html.
 * Exposes: initAuth(), doLogin(), doLogout(),
 *          getAuthToken(), getAuthUserId(), isAdminUser(), getAuthProfileName()
 */

var _authToken   = null;   // user's JWT access_token
var _authUser    = null;   // { id, email }
var _authProfile = null;   // { id, name, role }

// ─── PUBLIC ACCESSORS ─────────────────────────────────────
function getAuthToken()       { return _authToken; }
function getAuthUserId()      { return _authUser   ? _authUser.id    : null; }
function getAuthProfileName() { return _authProfile ? (_authProfile.name || (_authUser && _authUser.email.split('@')[0]) || '') : ''; }
function isAdminUser()        { return !!(  _authProfile && _authProfile.role === 'admin'); }

// ─── INIT: check saved session on startup ─────────────────
async function initAuth() {
  var creds = getSbCreds();
  var saved = _loadSavedSession();

  // ไม่มี Supabase หรือไม่มี session → แสดง login เสมอ
  if (!creds.ok || !saved) {
    showLoginPage();
    return;
  }

  try {
    // Verify token still valid
    var r = await fetch(creds.url + '/auth/v1/user', {
      headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + saved.access_token }
    });

    if (r.ok) {
      var user   = await r.json();
      _authToken = saved.access_token;
      _authUser  = { id: user.id, email: user.email };
      await _loadProfile(creds);
      _showApp();

    } else if (r.status === 401) {
      // Token expired — try refresh
      var ok = await _refreshSession(creds, saved.refresh_token);
      if (ok) { _showApp(); } else { _clearSession(); showLoginPage(); }

    } else {
      showLoginPage();
    }

  } catch (_err) {
    // Network offline — use cached credentials
    _authToken   = saved.access_token;
    _authUser    = { id: saved.user_id, email: saved.email };
    _authProfile = saved.profile || null;
    _showApp();
  }
}

// ─── LOGIN ────────────────────────────────────────────────
async function doLogin() {
  var emailEl = document.getElementById('loginEmail');
  var passEl  = document.getElementById('loginPassword');
  var btn     = document.getElementById('loginBtn');

  var email    = ((emailEl || {}).value || '').trim();
  var password = ((passEl  || {}).value || '').trim();

  if (!email || !password) {
    showMsg('loginMsg', '⚠️ กรุณากรอก Email และ Password', 'error');
    return;
  }

  var creds = getSbCreds();
  if (!creds.ok) {
    showMsg('loginMsg', '⚠️ ยังไม่ได้ตั้งค่า Supabase URL / Key\n(แก้ในไฟล์ config.js)', 'error');
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...'; }
  showMsg('loginMsg', '', '');

  try {
    var r = await fetch(creds.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });

    var data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'Login ไม่สำเร็จ');

    _authToken = data.access_token;
    _authUser  = { id: data.user.id, email: data.user.email };
    _saveSession(data.access_token, data.refresh_token, data.user);

    await _loadProfile(creds);

    if (passEl) passEl.value = '';
    showMsg('loginMsg', '', '');
    _showApp();

  } catch (e) {
    showMsg('loginMsg', '❌ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  }
}

// ─── SIGNUP ───────────────────────────────────────────────
async function doSignup() {
  var name  = ((document.getElementById('signupName')    || {}).value || '').trim();
  var email = ((document.getElementById('signupEmail')   || {}).value || '').trim();
  var pass  = ((document.getElementById('signupPassword')|| {}).value || '').trim();
  var btn   = document.getElementById('signupBtn');
  var msgEl = document.getElementById('signupMsg');

  if (!name)  { if(msgEl){msgEl.className='msg msg-error';msgEl.textContent='⚠️ กรอกชื่อที่แสดง';} return; }
  if (!email) { if(msgEl){msgEl.className='msg msg-error';msgEl.textContent='⚠️ กรอก Email';} return; }
  if (pass.length < 6) { if(msgEl){msgEl.className='msg msg-error';msgEl.textContent='⚠️ Password อย่างน้อย 6 ตัว';} return; }

  var creds = getSbCreds();
  if (!creds.ok) { if(msgEl){msgEl.className='msg msg-error';msgEl.textContent='⚠️ ยังไม่ได้ตั้งค่า Supabase';} return; }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังสมัคร...'; }
  if (msgEl) { msgEl.className='msg'; msgEl.textContent=''; }

  try {
    var r = await fetch(creds.url + '/auth/v1/signup', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });
    var data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'สมัครไม่สำเร็จ');

    // สร้าง profile พร้อมชื่อ
    _authToken = data.access_token;
    _authUser  = { id: data.user.id, email: data.user.email };
    await fetch(creds.url + '/rest/v1/profiles', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + _authToken,
                 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ id: data.user.id, name: name, role: 'user' })
    });

    // Login ทันทีหลังสมัคร
    _authRefresh = data.refresh_token;
    _authProfile = { id: data.user.id, name: name, role: 'user' };
    _saveSession(data.access_token, data.refresh_token, data.user);
    if (msgEl) { msgEl.className='msg msg-success'; msgEl.textContent='✅ สมัครสำเร็จ! กำลังเข้าสู่ระบบ...'; }
    setTimeout(function(){ _showApp(); }, 600);
  } catch (e) {
    if (msgEl) { msgEl.className='msg msg-error'; msgEl.textContent='❌ ' + e.message; }
    if (btn)   { btn.disabled = false; btn.textContent = 'สมัครสมาชิก'; }
  }
}

// ─── TAB SWITCH ───────────────────────────────────────────
function switchAuthTab(tab) {
  var loginForm  = document.getElementById('loginForm');
  var signupForm = document.getElementById('signupForm');
  var tabL = document.getElementById('tabLoginBtn');
  var tabS = document.getElementById('tabSignupBtn');
  if (!loginForm || !signupForm) return;
  var isLogin = tab === 'login';
  loginForm.style.display  = isLogin ? 'block' : 'none';
  signupForm.style.display = isLogin ? 'none'  : 'block';
  if (tabL) { tabL.style.background = isLogin ? 'var(--blue)' : 'var(--surface2)'; tabL.style.color = isLogin ? '#fff' : 'var(--ink2)'; }
  if (tabS) { tabS.style.background = isLogin ? 'var(--surface2)' : 'var(--blue)'; tabS.style.color = isLogin ? 'var(--ink2)' : '#fff'; }
}

// ─── LOGOUT ───────────────────────────────────────────────
async function doLogout() {
  if (!confirm('ออกจากระบบ?')) return;

  var creds = getSbCreds();
  try {
    if (creds.ok && _authToken) {
      await fetch(creds.url + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + _authToken }
      });
    }
  } catch (_) {}

  _authToken = null;
  _authUser  = null;
  _authProfile = null;

  // Clear local data
  db = [];
  try { save(); } catch (_) {}

  _clearSession();
  showLoginPage();
}

// ─── PROFILE ──────────────────────────────────────────────
async function _loadProfile(creds) {
  if (!_authUser || !creds.ok) return;
  try {
    var r = await fetch(
      creds.url + '/rest/v1/profiles?id=eq.' + _authUser.id + '&select=id,name,role',
      { headers: {
          'apikey': creds.key,
          'Authorization': 'Bearer ' + _authToken,
          'Content-Type': 'application/json'
        }
      }
    );
    if (r.ok) {
      var rows = await r.json();
      if (rows.length) { _authProfile = rows[0]; }
      else             { await _createProfile(creds); }
    }
  } catch (e) { console.warn('[auth] loadProfile:', e); }
}

async function _createProfile(creds) {
  var name = _authUser.email.split('@')[0];
  try {
    var r = await fetch(creds.url + '/rest/v1/profiles', {
      method: 'POST',
      headers: {
        'apikey': creds.key,
        'Authorization': 'Bearer ' + _authToken,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ id: _authUser.id, name: name, role: 'user' })
    });
    if (r.ok) {
      var rows = await r.json();
      _authProfile = rows[0] || null;
    }
  } catch (e) { console.warn('[auth] createProfile:', e); }

  if (!_authProfile) {
    _authProfile = { id: _authUser.id, name: name, role: 'user' };
  }
}

// ─── SESSION STORAGE ──────────────────────────────────────
function _saveSession(access_token, refresh_token, user) {
  try {
    localStorage.setItem('hf2_auth_session', JSON.stringify({
      access_token:  access_token,
      refresh_token: refresh_token,
      user_id:       user.id,
      email:         user.email,
      profile:       _authProfile,
      saved_at:      Date.now()
    }));
  } catch (_) {}
}

function _loadSavedSession() {
  try {
    return JSON.parse(localStorage.getItem('hf2_auth_session') || 'null');
  } catch (_) { return null; }
}

function _clearSession() {
  localStorage.removeItem('hf2_auth_session');
}

async function _refreshSession(creds, refresh_token) {
  if (!refresh_token) return false;
  try {
    var r = await fetch(creds.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh_token })
    });
    if (!r.ok) return false;
    var data   = await r.json();
    _authToken = data.access_token;
    _authUser  = { id: data.user.id, email: data.user.email };
    _saveSession(data.access_token, data.refresh_token, data.user);
    await _loadProfile(creds);
    return true;
  } catch (_) { return false; }
}

// ─── SHOW / HIDE ──────────────────────────────────────────
function showLoginPage() {
  document.body.classList.remove('app-ready');
  document.body.classList.add('login-visible');
  // ซ่อน DB panel, reset tab กลับ login
  var panel = document.getElementById('loginDbPanel');
  if (panel) panel.style.display = 'none';
  _dbTapCount = 0;
  switchAuthTab('login');
}

// ─── HIDDEN DB SETUP — แตะ version text 5 ครั้ง ──────────
var _dbTapCount = 0;
var _dbTapTimer = null;

function authDbTap() {
  _dbTapCount++;
  clearTimeout(_dbTapTimer);
  if (_dbTapCount >= 5) {
    _dbTapCount = 0;
    var panel = document.getElementById('loginDbPanel');
    if (!panel) return;
    var isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
      // pre-fill existing values
      var urlEl = document.getElementById('loginSbUrl');
      var keyEl = document.getElementById('loginSbKey');
      if (urlEl) urlEl.value = localStorage.getItem('hf2_sb_url') || '';
      if (keyEl) keyEl.value = localStorage.getItem('hf2_sb_key') || '';
      var msgEl = document.getElementById('loginDbMsg');
      if (msgEl) { msgEl.textContent = ''; }
    }
  } else {
    _dbTapTimer = setTimeout(function () { _dbTapCount = 0; }, 2000);
  }
}

function saveDbSetup() {
  var urlEl = document.getElementById('loginSbUrl');
  var keyEl = document.getElementById('loginSbKey');
  var msgEl = document.getElementById('loginDbMsg');
  var btnEl = document.getElementById('loginDbSaveBtn');
  var url = ((urlEl || {}).value || '').trim().replace(/\/+$/, '');
  var key = ((keyEl || {}).value || '').trim();

  if (!url || !key) {
    if (msgEl) {
      msgEl.style.cssText = 'margin-top:8px;font-size:12px;text-align:center;color:var(--red)';
      msgEl.textContent = '⚠️ กรอกให้ครบทั้ง URL และ Key';
    }
    return;
  }

  // บันทึกก่อน แล้วทดสอบ
  localStorage.setItem('hf2_sb_url', url);
  localStorage.setItem('hf2_sb_key', key);

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'กำลังทดสอบ...'; }
  if (msgEl) {
    msgEl.style.cssText = 'margin-top:8px;font-size:12px;text-align:center;color:var(--ink3)';
    msgEl.textContent = '⏳ กำลังทดสอบการเชื่อมต่อ...';
  }

  // ทดสอบด้วย /auth/v1/settings — public endpoint ไม่ต้อง login
  fetch(url + '/auth/v1/settings', {
    headers: { 'apikey': key }
  }).then(function (r) {
    if (r.ok) {
      _showDbStatus(msgEl, btnEl, { ok: true, msg: '✅ เชื่อมต่อสำเร็จ — พร้อมใช้งาน' });
    } else if (r.status === 404) {
      _showDbStatus(msgEl, btnEl, { ok: false, msg: '❌ URL ไม่ถูกต้อง หรือ Project ไม่พบ (404)' });
    } else if (r.status === 401 || r.status === 403) {
      _showDbStatus(msgEl, btnEl, { ok: false, msg: '❌ API Key ไม่ถูกต้อง (HTTP ' + r.status + ')' });
    } else {
      _showDbStatus(msgEl, btnEl, { ok: false, msg: '❌ เชื่อมต่อไม่ได้ (HTTP ' + r.status + ')' });
    }
  }).catch(function (e) {
    _showDbStatus(msgEl, btnEl, { ok: false, msg: '❌ เชื่อมต่อไม่ได้: ' + (e.message || 'network error') });
  });
}

function _showDbStatus(msgEl, btnEl, result) {
  if (btnEl) { btnEl.disabled = false; btnEl.textContent = '💾 บันทึก'; }
  if (!msgEl) return;
  msgEl.style.cssText = 'margin-top:10px;font-size:13px;text-align:center;font-weight:600;padding:8px 12px;border-radius:8px;' +
    (result.ok
      ? 'background:var(--green-bg);color:var(--green)'
      : 'background:var(--red-bg);color:var(--red)');
  msgEl.textContent = result.msg;

  if (result.ok) {
    setTimeout(function () {
      var panel = document.getElementById('loginDbPanel');
      if (panel) panel.style.display = 'none';
      _dbTapCount = 0;
      var em = document.getElementById('loginEmail');
      if (em) em.focus();
    }, 1500);
  }
}

function _showApp() {
  document.body.classList.remove('login-visible');
  document.body.classList.add('app-ready');
  _updateUserBar();
  _updateAdminNav();
  if (typeof startAppAfterAuth === 'function') startAppAfterAuth();
}

function _updateUserBar() {
  var name  = getAuthProfileName();
  var email = _authUser ? (_authUser.email || '') : '';
  var role  = isAdminUser() ? 'admin' : 'user';
  var roleLabel = isAdminUser() ? '🛡 Admin' : '👤 User';

  // Topbar chip
  var nameEl = document.getElementById('topbarUser');
  if (nameEl) nameEl.textContent = name + (isAdminUser() ? ' 🛡' : '');

  // Logout button
  var lb = document.getElementById('logoutBtn');
  if (lb) lb.style.display = '';

  // Sidebar: auth info block (ชื่อ + role)
  var sidebarName = document.getElementById('sidebarAuthName');
  var sidebarRole = document.getElementById('sidebarAuthRole');
  if (sidebarName) sidebarName.textContent = name;
  if (sidebarRole) sidebarRole.textContent = roleLabel;

  // Sidebar footer (เก่า — ยังคงไว้เผื่อมี)
  var sf = document.getElementById('sidebarUserInfo');
  if (sf) sf.textContent = name + ' · ' + roleLabel;

  // Settings page — user card
  var stgName  = document.getElementById('stgUserName');
  var stgEmail = document.getElementById('stgUserEmail');
  var stgRole  = document.getElementById('stgUserRole');
  if (stgName)  stgName.textContent  = name;
  if (stgEmail) stgEmail.textContent = email;
  if (stgRole)  {
    stgRole.textContent = roleLabel;
    stgRole.style.background = isAdminUser() ? 'var(--green-bg)' : 'var(--surface2)';
    stgRole.style.color      = isAdminUser() ? 'var(--green)'    : 'var(--ink3)';
  }
}

// ─── CHANGE DISPLAY NAME ──────────────────────────────────
async function doChangeName() {
  var input  = document.getElementById('stgNewName');
  var msgEl  = document.getElementById('changeNameMsg');
  var newName = ((input || {}).value || '').trim();

  function _showNameMsg(text, ok) {
    if (!msgEl) return;
    msgEl.style.display  = 'block';
    msgEl.style.color    = ok ? 'var(--green)' : 'var(--red)';
    msgEl.textContent    = text;
    setTimeout(function(){ msgEl.style.display = 'none'; }, 3000);
  }

  if (!newName) { _showNameMsg('⚠️ กรอกชื่อที่ต้องการเปลี่ยน', false); return; }
  if (!_authUser) { _showNameMsg('⚠️ ยังไม่ได้เข้าสู่ระบบ', false); return; }

  var creds = getSbCreds();
  if (!creds.ok) {
    // local-only mode — just update in memory
    if (_authProfile) _authProfile.name = newName;
    _updateUserBar();
    if (input) input.value = '';
    _showNameMsg('✅ เปลี่ยนชื่อเป็น "' + newName + '" แล้ว', true);
    return;
  }

  try {
    var r = await fetch(
      creds.url + '/rest/v1/profiles?id=eq.' + _authUser.id,
      {
        method: 'PATCH',
        headers: Object.assign({}, sbHeadersFrom(creds.key), {
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        }),
        body: JSON.stringify({ name: newName })
      }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!_authProfile) _authProfile = {};
    _authProfile.name = newName;
    // Update saved session
    var saved = _loadSavedSession();
    if (saved) { saved.profile = _authProfile; try { localStorage.setItem('hf2_auth_session', JSON.stringify(saved)); } catch(_){} }
    _updateUserBar();
    if (input) input.value = '';
    _showNameMsg('✅ เปลี่ยนชื่อเป็น "' + newName + '" แล้ว', true);
  } catch (e) {
    _showNameMsg('❌ เปลี่ยนชื่อไม่สำเร็จ: ' + e.message, false);
  }
}

// ─── MAP LOGGED-IN USER → PERSON A/B ─────────────────────
// ใช้สำหรับ auto-set ฟิลด์ person ในฟอร์ม
function getCurrentPerson() {
  var name = getAuthProfileName().toLowerCase();
  if (!name || typeof persons === 'undefined') return 'A';
  for (var i = 0; i < persons.length; i++) {
    if (persons[i].name.toLowerCase() === name) return persons[i].id;
  }
  // fallback: user ตัวที่ 1 = A, ตัวที่ 2 = B ตาม email hash
  var email = _authUser ? (_authUser.email || '') : '';
  return email ? (email.charCodeAt(0) % 2 === 0 ? 'A' : 'B') : 'A';
}

function _updateAdminNav() {
  var show = isAdminUser();
  document.querySelectorAll('.admin-only').forEach(function (el) {
    el.style.display = show ? '' : 'none';
  });
}
