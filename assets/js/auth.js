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
  var saved = _loadSavedSession();
  var creds = getSbCreds();

  if (!saved || !creds.ok) {
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
}

function _showApp() {
  document.body.classList.remove('login-visible');
  document.body.classList.add('app-ready');
  _updateUserBar();
  _updateAdminNav();
  if (typeof startAppAfterAuth === 'function') startAppAfterAuth();
}

function _updateUserBar() {
  // Topbar user chip
  var nameEl = document.getElementById('topbarUser');
  if (nameEl) {
    nameEl.textContent = getAuthProfileName() + (isAdminUser() ? ' 🛡' : '');
  }
  // Logout button
  var lb = document.getElementById('logoutBtn');
  if (lb) lb.style.display = '';
  // Sidebar footer
  var sf = document.getElementById('sidebarUserInfo');
  if (sf && _authProfile) {
    sf.textContent = _authProfile.name + ' · ' + (_authProfile.role === 'admin' ? '🛡 Admin' : '👤 User');
  }
}

function _updateAdminNav() {
  var show = isAdminUser();
  document.querySelectorAll('.admin-only').forEach(function (el) {
    el.style.display = show ? '' : 'none';
  });
}
