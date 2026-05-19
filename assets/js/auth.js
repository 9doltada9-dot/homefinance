/* HomeFinance · module: auth.js · v3.4.0
 * Supabase Auth — login, logout, session restore, profile management
 *
 * Must be loaded BEFORE app.js in index.html.
 * Exposes: initAuth(), doLogin(), doLogout(),
 *          getAuthToken(), getAuthUserId(), isAdminUser(), getAuthProfileName()
 */

var _authToken   = null;   // user's JWT access_token
var _authUser    = null;   // { id, email }
var _authProfile = null;   // { id, name, role }
var _tempResetToken = null; // token สำหรับ reset password

// ─── PUBLIC ACCESSORS ─────────────────────────────────────
function getAuthToken()       { return _authToken; }
function getAuthUserId()      { return _authUser   ? _authUser.id    : null; }
function getAuthProfileName() { return _authProfile ? (_authProfile.name || (_authUser && _authUser.email.split('@')[0]) || '') : ''; }
function isAdminUser()        { return !!(_authProfile && _authProfile.role === 'admin'); }
function getAuthLabel()        { return (_authProfile && _authProfile.label) ? _authProfile.label : ''; }

// ─── AUTH CALLBACK HANDLER ────────────────────────────────
// รับ type=signup (email confirm) และ type=recovery (reset password)
function _handleAuthCallback() {
  var hash = window.location.hash;
  if (!hash || hash.indexOf('access_token') === -1) return false;

  var params = {};
  hash.replace(/^#/, '').split('&').forEach(function(pair) {
    var idx = pair.indexOf('=');
    if (idx > -1) {
      params[decodeURIComponent(pair.slice(0, idx))] =
        decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
    }
  });

  // ล้าง hash ออกจาก URL
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (_) {}

  // ── Email Confirmation ──────────────────────────────────
  if (params.type === 'signup') {
    var savedName  = localStorage.getItem('hf2_pending_signup_name')  || '';
    var savedEmail = localStorage.getItem('hf2_pending_signup_email') || '';
    localStorage.removeItem('hf2_pending_signup_name');
    localStorage.removeItem('hf2_pending_signup_email');

    // สร้าง profile ด้วย token ที่ได้จาก email confirm
    if (params.access_token && savedName) {
      var creds = getSbCreds();
      if (creds.ok) {
        fetch(creds.url + '/auth/v1/user', {
          headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + params.access_token }
        }).then(function(r) {
          return r.ok ? r.json() : null;
        }).then(function(user) {
          if (user && user.id) {
            fetch(creds.url + '/rest/v1/profiles', {
              method: 'POST',
              headers: {
                'apikey': creds.key,
                'Authorization': 'Bearer ' + params.access_token,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
              },
              body: JSON.stringify({ id: user.id, name: savedName, role: 'user' })
            }).catch(function(_) {});
          }
        }).catch(function(_) {});
      }
    }

    showLoginPage();
    setTimeout(function() {
      // Pre-fill email ในช่อง login
      var emailEl = document.getElementById('loginEmail');
      if (emailEl && savedEmail) emailEl.value = savedEmail;
      // แสดง success message
      var msgEl = document.getElementById('loginMsg');
      if (msgEl) {
        msgEl.className = 'msg msg-success';
        msgEl.textContent = '✅ ยืนยัน Email สำเร็จแล้ว กรุณา Login';
      }
    }, 120);
    return true;
  }

  // ── Password Recovery ───────────────────────────────────
  if (params.type === 'recovery') {
    _tempResetToken = params.access_token;
    showLoginPage();
    setTimeout(function() {
      showPasswordResetForm(true);
    }, 120);
    return true;
  }

  return false;
}

// ─── INIT: check saved session on startup ─────────────────
async function initAuth() {
  if (_handleAuthCallback()) return;

  var creds = getSbCreds();
  var saved = _loadSavedSession();

  if (!creds.ok || !saved) {
    showLoginPage();
    return;
  }

  try {
    var r = await fetch(creds.url + '/auth/v1/user', {
      headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + saved.access_token }
    });

    if (r.ok) {
      var user   = await r.json();
      _authToken = saved.access_token;
      _authUser  = { id: user.id, email: user.email };
      await _loadProfile(creds);
      _saveSession(saved.access_token, saved.refresh_token, user); // อัปเดต cache role ล่าสุด
      _showApp();

    } else if (r.status === 401) {
      var ok = await _refreshSession(creds, saved.refresh_token);
      if (ok) { _showApp(); } else { _clearSession(); showLoginPage(); }

    } else {
      showLoginPage();
    }

  } catch (_err) {
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
    showMsg('loginMsg', '⚠️ ยังไม่ได้ตั้งค่า Supabase URL / Key\n(แตะ version 5 ครั้งเพื่อตั้งค่า)', 'error');
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
    if (!r.ok) {
      var errMsg = data.error_description || data.msg || 'Login ไม่สำเร็จ';
      if (errMsg.toLowerCase().indexOf('email not confirmed') > -1) {
        errMsg = 'ยังไม่ได้ยืนยัน Email กรุณาตรวจสอบกล่องจดหมายและกดลิงก์ยืนยัน';
      } else if (errMsg.toLowerCase().indexOf('invalid login') > -1 || errMsg.toLowerCase().indexOf('invalid credentials') > -1) {
        errMsg = 'Email หรือ Password ไม่ถูกต้อง';
      }
      throw new Error(errMsg);
    }

    _authToken = data.access_token;
    _authUser  = { id: data.user.id, email: data.user.email };
    _saveSession(data.access_token, data.refresh_token, data.user);
    await _loadProfile(creds);

    // บันทึก recent account
    _saveRecentAccount(email, getAuthProfileName(), _authUser && _authUser.id);
    // จดจำรหัสผ่าน ถ้าผู้ใช้เลือก checkbox
    var rememberChk = document.getElementById('rememberMeChk');
    if (rememberChk && rememberChk.checked) {
      _saveRememberedLogin(email, passEl ? passEl.value : '');
    } else {
      _clearRememberedLogin();
    }

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

  if (!name)  { _showSignupMsg('⚠️ กรอกชื่อที่แสดง', false); return; }
  if (!email) { _showSignupMsg('⚠️ กรอก Email', false); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { _showSignupMsg('⚠️ รูปแบบ Email ไม่ถูกต้อง', false); return; }
  if (pass.length < 6) { _showSignupMsg('⚠️ Password อย่างน้อย 6 ตัวอักษร', false); return; }

  var creds = getSbCreds();
  if (!creds.ok) { _showSignupMsg('⚠️ ยังไม่ได้ตั้งค่า Supabase (แตะ version 5 ครั้ง)', false); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังสมัคร...'; }
  _showSignupMsg('', null);

  // เก็บ name และ email ชั่วคราว สำหรับสร้าง profile หลัง email confirm
  localStorage.setItem('hf2_pending_signup_name',  name);
  localStorage.setItem('hf2_pending_signup_email', email);

  try {
    var _appUrl = window.location.href.replace(/#.*$/, '').replace(/\?.*$/, '');
    var r = await fetch(creds.url + '/auth/v1/signup?redirect_to=' + encodeURIComponent(_appUrl), {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: pass })
    });
    var data = await r.json();

    if (!r.ok) {
      // แสดง error ที่เข้าใจง่าย
      var errMsg = data.error_description || data.msg || data.message || 'สมัครไม่สำเร็จ';
      if (errMsg.toLowerCase().indexOf('already registered') > -1 ||
          errMsg.toLowerCase().indexOf('already been registered') > -1 ||
          errMsg.toLowerCase().indexOf('user already') > -1) {
        errMsg = '⚠️ Email นี้ลงทะเบียนไว้แล้ว กรุณาเข้าสู่ระบบหรือรีเซ็ต Password';
      } else if (errMsg.toLowerCase().indexOf('invalid email') > -1) {
        errMsg = '⚠️ รูปแบบ Email ไม่ถูกต้อง';
      } else if (errMsg.toLowerCase().indexOf('password') > -1 && errMsg.toLowerCase().indexOf('weak') > -1) {
        errMsg = '⚠️ Password ไม่ปลอดภัยพอ กรุณาใช้ตัวอักษรและตัวเลขผสมกัน';
      }
      throw new Error(errMsg);
    }

    // กรณี Supabase ต้องยืนยัน email (access_token = null)
    if (!data.access_token) {
      _showSignupPendingEmail(name, email);
      if (btn) { btn.disabled = false; btn.textContent = 'สมัครสมาชิก'; }
      return;
    }

    // กรณี email confirm ปิด → login ทันที
    _authToken = data.access_token;
    _authUser  = { id: data.user.id, email: data.user.email };
    try {
      await fetch(creds.url + '/rest/v1/profiles', {
        method: 'POST',
        headers: {
          'apikey': creds.key,
          'Authorization': 'Bearer ' + (_authToken || ''),
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({ id: data.user.id, name: name, role: 'user' })
      });
    } catch(_profileErr) {
      console.warn('[doSignup] profile create failed:', _profileErr);
    }
    localStorage.removeItem('hf2_pending_signup_name');
    localStorage.removeItem('hf2_pending_signup_email');
    _authProfile = { id: data.user.id, name: name, role: 'user' };
    _saveSession(data.access_token, data.refresh_token, data.user);
    _saveRecentAccount(email, name, data.user.id);
    _showSignupMsg('✅ สมัครสำเร็จ! กำลังเข้าสู่ระบบ...', true);
    setTimeout(function() { _showApp(); }, 600);

  } catch (e) {
    _showSignupMsg('❌ ' + e.message, false);
    if (btn) { btn.disabled = false; btn.textContent = 'สมัครสมาชิก'; }
  }
}

// แสดง pending email confirmation UI
function _showSignupPendingEmail(name, email) {
  var formEl = document.getElementById('signupForm');
  if (!formEl) return;
  formEl.innerHTML =
    '<div style="text-align:center;padding:8px 0">' +
      '<div style="font-size:48px;margin-bottom:12px">📧</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--ink);margin-bottom:8px">ตรวจสอบ Email ของคุณ</div>' +
      '<div style="font-size:13px;color:var(--ink2);margin-bottom:4px">สวัสดี <strong>' + name + '</strong></div>' +
      '<div style="font-size:13px;color:var(--ink2);margin-bottom:12px">ส่งลิงก์ยืนยันไปที่</div>' +
      '<div style="font-size:14px;font-weight:600;color:var(--blue);background:var(--blue-bg);padding:8px 16px;border-radius:8px;margin-bottom:12px;word-break:break-all">' + email + '</div>' +
      '<div style="font-size:12px;color:var(--ink3);margin-bottom:6px;line-height:1.6">คลิกลิงก์ยืนยันใน Email เพื่อเปิดใช้งานบัญชี<br>แล้วกลับมา Login ได้เลย</div>' +
      '<div style="font-size:11px;color:#e67e22;background:#fef9f0;border:1px solid #f0c060;border-radius:8px;padding:8px 12px;margin-bottom:16px;line-height:1.6">' +
        '⚠️ ไม่เจอ Email? ลองตรวจ <strong>Spam / Junk</strong><br>Email อาจใช้เวลา 1-5 นาที' +
      '</div>' +
      '<button id="resendEmailBtn" class="btn" onclick="resendConfirmEmail(\'' + email.replace(/'/g,"&#39;") + '\')" style="width:100%;min-height:44px;font-size:13px;margin-bottom:8px;background:var(--surface);border:1.5px solid var(--border);color:var(--ink2)">📤 ส่ง Email ยืนยันใหม่</button>' +
      '<div id="resendMsg" style="font-size:12px;text-align:center;margin-bottom:12px;min-height:16px"></div>' +
      '<button class="btn btn-primary" onclick="switchAuthTab(\'login\')" style="width:100%;min-height:44px;font-size:14px">→ ไปหน้า Login</button>' +
    '</div>';
}

// ส่ง email ยืนยันใหม่
async function resendConfirmEmail(email) {
  var btn = document.getElementById('resendEmailBtn');
  var msgEl = document.getElementById('resendMsg');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่ง...'; }
  if (msgEl) { msgEl.textContent = ''; msgEl.style.color = 'var(--ink3)'; }
  try {
    var creds = getSbCreds();
    if (!creds.ok) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
    var r = await fetch(creds.url + '/auth/v1/resend', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'signup', email: email })
    });
    if (!r.ok) {
      var d = await r.json();
      throw new Error(d.error_description || d.msg || d.message || 'ส่งไม่สำเร็จ');
    }
    if (msgEl) { msgEl.textContent = '✅ ส่งแล้ว! ตรวจ Inbox และ Spam'; msgEl.style.color = '#1a7a4a'; }
    if (btn) { btn.textContent = '✅ ส่งแล้ว'; }
    setTimeout(function() {
      if (btn) { btn.disabled = false; btn.textContent = '📤 ส่ง Email ยืนยันใหม่'; }
      if (msgEl) { msgEl.textContent = ''; }
    }, 30000);
  } catch(e) {
    if (msgEl) { msgEl.textContent = '❌ ' + e.message; msgEl.style.color = '#c0392b'; }
    if (btn) { btn.disabled = false; btn.textContent = '📤 ส่ง Email ยืนยันใหม่'; }
  }
}
function _showSignupMsg(text, ok) {
  var msgEl = document.getElementById('signupMsg');
  if (!msgEl) return;
  if (!text) { msgEl.className = 'msg'; msgEl.textContent = ''; return; }
  msgEl.className = 'msg ' + (ok ? 'msg-success' : 'msg-error');
  msgEl.textContent = text;
}

// ─── TAB SWITCH ───────────────────────────────────────────
function switchAuthTab(tab) {
  // ถ้า signupForm ถูกแทนที่ด้วย pending email UI ให้ rebuild ก่อน
  var signupForm = document.getElementById('signupForm');
  if (signupForm && !signupForm.querySelector('#signupName') && tab === 'signup') {
    _rebuildSignupForm();
  }

  var loginForm  = document.getElementById('loginForm');
  signupForm = document.getElementById('signupForm');
  var tabL = document.getElementById('tabLoginBtn');
  var tabS = document.getElementById('tabSignupBtn');
  if (!loginForm || !signupForm) return;
  var isLogin = tab === 'login';
  loginForm.style.display  = isLogin ? 'block' : 'none';
  signupForm.style.display = isLogin ? 'none'  : 'block';

  // ซ่อน forgot/reset form
  var forgotForm = document.getElementById('forgotForm');
  var resetForm  = document.getElementById('resetPasswordForm');
  if (forgotForm) forgotForm.style.display = 'none';
  if (resetForm)  resetForm.style.display  = 'none';

  if (tabL) { tabL.style.background = isLogin ? 'var(--blue)' : 'var(--surface2)'; tabL.style.color = isLogin ? '#fff' : 'var(--ink2)'; }
  if (tabS) { tabS.style.background = isLogin ? 'var(--surface2)' : 'var(--blue)'; tabS.style.color = isLogin ? 'var(--ink2)' : '#fff'; }

  if (isLogin) {
    _renderRecentAccounts();
    _applyRememberedLogin();
  }
}

function _rebuildSignupForm() {
  var signupForm = document.getElementById('signupForm');
  if (!signupForm) return;
  signupForm.innerHTML =
    '<div class="field" style="margin-bottom:14px">' +
      '<label>👤 ชื่อที่แสดง</label>' +
      '<input type="text" id="signupName" placeholder="เช่น สมชาย" autocomplete="name" style="width:100%;font-size:16px !important" onkeydown="if(event.key===\'Enter\') document.getElementById(\'signupEmail\').focus()">' +
    '</div>' +
    '<div class="field" style="margin-bottom:14px">' +
      '<label>📧 Email</label>' +
      '<input type="email" id="signupEmail" placeholder="your@email.com" autocomplete="email" style="width:100%;font-size:16px !important" onkeydown="if(event.key===\'Enter\') document.getElementById(\'signupPassword\').focus()">' +
    '</div>' +
    '<div class="field" style="margin-bottom:20px">' +
      '<label>🔒 Password</label>' +
      '<input type="password" id="signupPassword" placeholder="อย่างน้อย 6 ตัวอักษร" autocomplete="new-password" style="width:100%;font-size:16px !important" onkeydown="if(event.key===\'Enter\') doSignup()">' +
    '</div>' +
    '<button id="signupBtn" class="btn btn-primary" onclick="doSignup()" style="width:100%;min-height:48px;font-size:15px;font-weight:600">สมัครสมาชิก</button>' +
    '<div id="signupMsg" class="msg" style="margin-top:12px;text-align:center"></div>';
}

// ─── FORGOT PASSWORD ──────────────────────────────────────
async function doForgotPassword() {
  var emailEl = document.getElementById('forgotEmail');
  var msgEl   = document.getElementById('forgotMsg');
  var btn     = document.getElementById('forgotBtn');
  var email   = ((emailEl || {}).value || '').trim();

  if (!email) {
    if (msgEl) { msgEl.className = 'msg msg-error'; msgEl.textContent = '⚠️ กรอก Email ที่ลงทะเบียนไว้'; }
    return;
  }

  var creds = getSbCreds();
  if (!creds.ok) {
    if (msgEl) { msgEl.className = 'msg msg-error'; msgEl.textContent = '⚠️ ยังไม่ได้ตั้งค่า Supabase'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังส่ง...'; }
  if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }

  try {
    var appUrl = window.location.href.replace(/#.*$/, '').replace(/\?.*$/, '');
    var r = await fetch(creds.url + '/auth/v1/recover', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, redirect_to: appUrl })
    });
    // Supabase ส่ง 200 แม้ email ไม่มีในระบบ (เพื่อ security)
    if (msgEl) {
      msgEl.className = 'msg msg-success';
      msgEl.textContent = '📧 ถ้า Email นี้มีในระบบ จะได้รับลิงก์รีเซ็ต Password กรุณาตรวจสอบกล่องจดหมาย';
    }
    setTimeout(function() { showForgotForm(false); }, 5000);
  } catch(e) {
    if (msgEl) { msgEl.className = 'msg msg-error'; msgEl.textContent = '❌ ' + (e.message || 'ส่งไม่สำเร็จ'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📨 ส่ง Email รีเซ็ต Password'; }
  }
}

function showForgotForm(show) {
  var loginForm  = document.getElementById('loginForm');
  var forgotForm = document.getElementById('forgotForm');
  var tabRow     = document.getElementById('authTabRow');
  if (!loginForm || !forgotForm) return;

  loginForm.style.display  = show ? 'none' : 'block';
  forgotForm.style.display = show ? 'block' : 'none';
  if (tabRow) tabRow.style.display = show ? 'none' : '';

  if (show) {
    // Pre-fill email จาก login form
    var loginEmail  = document.getElementById('loginEmail');
    var forgotEmail = document.getElementById('forgotEmail');
    if (forgotEmail && loginEmail) forgotEmail.value = loginEmail.value;
    var msgEl = document.getElementById('forgotMsg');
    if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }
    setTimeout(function() { if (forgotEmail) forgotEmail.focus(); }, 100);
  }
}

// ─── RESET PASSWORD (หลังคลิก link ใน email) ─────────────
async function doResetPassword() {
  var passEl    = document.getElementById('resetNewPassword');
  var confirmEl = document.getElementById('resetConfirmPassword');
  var btn       = document.getElementById('resetPasswordBtn');
  var msgEl     = document.getElementById('resetPasswordMsg');

  var newPass     = ((passEl    || {}).value || '').trim();
  var confirmPass = ((confirmEl || {}).value || '').trim();

  if (newPass.length < 6) {
    if (msgEl) { msgEl.className='msg msg-error'; msgEl.textContent='⚠️ Password อย่างน้อย 6 ตัวอักษร'; }
    return;
  }
  if (newPass !== confirmPass) {
    if (msgEl) { msgEl.className='msg msg-error'; msgEl.textContent='⚠️ Password ไม่ตรงกัน'; }
    return;
  }

  var creds = getSbCreds();
  if (!creds.ok || !_tempResetToken) {
    if (msgEl) { msgEl.className='msg msg-error'; msgEl.textContent='⚠️ Session หมดอายุ กรุณาขอ link ใหม่'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก...'; }
  if (msgEl) { msgEl.className = 'msg'; msgEl.textContent = ''; }

  try {
    var r = await fetch(creds.url + '/auth/v1/user', {
      method: 'PUT',
      headers: {
        'apikey': creds.key,
        'Authorization': 'Bearer ' + _tempResetToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPass })
    });
    if (!r.ok) {
      var d = await r.json();
      throw new Error(d.error_description || d.msg || 'เปลี่ยนไม่สำเร็จ');
    }
    if (msgEl) { msgEl.className='msg msg-success'; msgEl.textContent='✅ เปลี่ยน Password สำเร็จ กรุณา Login ใหม่'; }
    _tempResetToken = null;
    setTimeout(function() { showPasswordResetForm(false); }, 2500);
  } catch(e) {
    if (msgEl) { msgEl.className='msg msg-error'; msgEl.textContent='❌ ' + e.message; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔐 บันทึก Password ใหม่'; }
  }
}

function showPasswordResetForm(show) {
  var loginForm  = document.getElementById('loginForm');
  var resetForm  = document.getElementById('resetPasswordForm');
  var tabRow     = document.getElementById('authTabRow');
  if (!loginForm || !resetForm) return;
  loginForm.style.display = show ? 'none' : 'block';
  resetForm.style.display = show ? 'block' : 'none';
  if (tabRow) tabRow.style.display = show ? 'none' : '';
  if (show) {
    var msgEl = document.getElementById('resetPasswordMsg');
    if (msgEl) { msgEl.className='msg'; msgEl.textContent=''; }
  }
}

// ─── RECENT ACCOUNTS ──────────────────────────────────────
// ─── REMEMBER LOGIN ──────────────────────────────────────
function _saveRememberedLogin(email, password) {
  try { localStorage.setItem('hf2_remember', JSON.stringify({ email: email, password: password })); }
  catch(_) {}
}
function _clearRememberedLogin() {
  localStorage.removeItem('hf2_remember');
}
function _loadRememberedLogin() {
  try { return JSON.parse(localStorage.getItem('hf2_remember') || 'null'); }
  catch(_) { return null; }
}
/** เรียกตอน showLoginPage() เพื่อ autofill ถ้า remember เปิดอยู่ */
function _applyRememberedLogin() {
  var saved = _loadRememberedLogin();
  if (!saved) return;
  var emailEl = document.getElementById('loginEmail');
  var passEl  = document.getElementById('loginPassword');
  var chkEl   = document.getElementById('rememberMeChk');
  if (emailEl) emailEl.value = saved.email || '';
  if (passEl)  passEl.value  = saved.password || '';
  if (chkEl)   chkEl.checked = true;
}

function _saveRecentAccount(email, name, uid) {
  try {
    var accounts = JSON.parse(localStorage.getItem('hf2_recent_accounts') || '[]');
    accounts = accounts.filter(function(a) { return a.email !== email; });
    accounts.unshift({ email: email, name: name || email.split('@')[0], uid: uid || null, ts: Date.now() });
    if (accounts.length > 5) accounts = accounts.slice(0, 5);
    localStorage.setItem('hf2_recent_accounts', JSON.stringify(accounts));
  } catch(_) {}
}

function _getRecentAccounts() {
  try { return JSON.parse(localStorage.getItem('hf2_recent_accounts') || '[]'); }
  catch(_) { return []; }
}

function _renderRecentAccounts() {
  var el = document.getElementById('recentAccountsList');
  if (!el) return;
  var accounts = _getRecentAccounts();
  if (!accounts.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML =
    '<div style="font-size:12px;color:var(--ink3);margin-bottom:6px;font-weight:500">บัญชีที่เคยเข้าระบบ</div>' +
    accounts.map(function(a) {
      var safeEmail = a.email.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      // ดึงชื่อล่าสุดจาก _allProfiles ก่อน (ถ้ามี uid ที่ตรงกัน) ไม่อย่างนั้นใช้ชื่อ cached
      var currentName = a.name || a.email.split('@')[0];
      if (a.uid && window._allProfiles && window._allProfiles.length) {
        var prof = window._allProfiles.find(function(p){ return p.id === a.uid; });
        if (prof && prof.name) {
          currentName = prof.name;
          // อัปเดต cache ด้วย
          a.name = prof.name;
        }
      }
      var safeName = currentName.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      return '<div onclick="_fillRecentAccount(\'' + safeEmail.replace(/'/g,'\\\'') + '\')" ' +
        'style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;' +
        'border:1px solid var(--line);margin-bottom:6px;background:var(--surface2);transition:background .15s" ' +
        'onmouseover="this.style.background=\'var(--surface3,var(--surface2))\'" ' +
        'onmouseout="this.style.background=\'var(--surface2)\'">' +
        '<div style="width:30px;height:30px;border-radius:50%;background:var(--blue-bg);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">👤</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:var(--ink)">' + safeName + '</div>' +
          '<div style="font-size:11px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + safeEmail + '</div>' +
        '</div>' +
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--ink3)" stroke-width="1.5"><path d="M6 3l5 5-5 5"/></svg>' +
      '</div>';
    }).join('');
  // persist updated names back to cache
  try { localStorage.setItem('hf2_recent_accounts', JSON.stringify(accounts)); } catch(_) {}
}

function _fillRecentAccount(email) {
  var emailEl = document.getElementById('loginEmail');
  var passEl  = document.getElementById('loginPassword');
  if (emailEl) emailEl.value = email;
  if (passEl)  passEl.focus();
}

// ─── CHANGE PASSWORD (ขณะ logged in) ─────────────────────
async function doChangePassword() {
  var currentEl = document.getElementById('stgCurrentPassword');
  var newEl     = document.getElementById('stgNewPassword');
  var confirmEl = document.getElementById('stgConfirmPassword');
  var msgEl     = document.getElementById('changePasswordMsg');
  var btn       = document.getElementById('changePasswordBtn');

  var currentPass = ((currentEl || {}).value || '');
  var newPass     = ((newEl     || {}).value || '').trim();
  var confirmPass = ((confirmEl || {}).value || '').trim();

  function _showPassMsg(text, ok) {
    if (!msgEl) return;
    msgEl.style.display = 'block';
    msgEl.style.color = ok ? 'var(--green)' : 'var(--red)';
    msgEl.textContent = text;
    if (ok) setTimeout(function(){ msgEl.style.display='none'; }, 4000);
  }

  if (!currentPass)        { _showPassMsg('⚠️ กรอก Password ปัจจุบัน', false); return; }
  if (newPass.length < 6)  { _showPassMsg('⚠️ Password ใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', false); return; }
  if (newPass !== confirmPass) { _showPassMsg('⚠️ Password ใหม่ไม่ตรงกัน', false); return; }

  var creds = getSbCreds();
  if (!creds.ok) { _showPassMsg('⚠️ ยังไม่ได้ตั้งค่า Supabase', false); return; }
  if (!_authToken || !_authUser) { _showPassMsg('⚠️ ยังไม่ได้เข้าสู่ระบบ', false); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...'; }

  try {
    // ตรวจสอบ password ปัจจุบันก่อน
    var verifyR = await fetch(creds.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { 'apikey': creds.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _authUser.email, password: currentPass })
    });
    if (!verifyR.ok) { _showPassMsg('❌ Password ปัจจุบันไม่ถูกต้อง', false); return; }

    if (btn) btn.textContent = 'กำลังบันทึก...';

    // เปลี่ยน password
    var r = await fetch(creds.url + '/auth/v1/user', {
      method: 'PUT',
      headers: {
        'apikey': creds.key,
        'Authorization': 'Bearer ' + _authToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: newPass })
    });
    if (!r.ok) {
      var errData = await r.json();
      throw new Error(errData.error_description || errData.msg || 'เปลี่ยนไม่สำเร็จ');
    }
    if (currentEl) currentEl.value = '';
    if (newEl)     newEl.value     = '';
    if (confirmEl) confirmEl.value = '';
    _showPassMsg('✅ เปลี่ยน Password สำเร็จ', true);
  } catch(e) {
    _showPassMsg('❌ ' + e.message, false);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔐 เปลี่ยน Password'; }
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

  _authToken   = null;
  _authUser    = null;
  _authProfile = null;

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
      creds.url + '/rest/v1/profiles?id=eq.' + _authUser.id + '&select=id,name,role,label',
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

  // ── sync person names จาก Supabase profiles ──
  await _syncPersonNamesFromProfiles(creds);
}

/** อัปเดตชื่อใน persons[] ให้ตรงกับ Supabase profiles (แก้ปัญหาชื่อเก่า ต้น/เจี๊ยบ) */
async function _syncPersonNamesFromProfiles(creds) {
  if (!creds || !creds.ok || !_authToken) return;
  try {
    var r = await fetch(
      creds.url + '/rest/v1/profiles?select=id,name&order=name',
      { headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + _authToken } }
    );
    if (!r.ok) return;
    var profiles = await r.json();
    // เก็บ profiles ไว้ใช้ทั่วทั้งแอป (chart labels ฯลฯ)
    window._allProfiles = profiles;

    var changed = false;
    profiles.forEach(function(prof) {
      if (!prof.id || !prof.name) return;
      var p = persons.find(function(x) { return x.user_id === prof.id; });
      if (p && p.name !== prof.name) {
        p.name = prof.name;
        changed = true;
      }
    });
    if (changed) {
      if (typeof savePersons === 'function') savePersons(persons);
      if (typeof populatePersonSelects === 'function') populatePersonSelects();
      // re-render dashboard chart ถ้าอยู่หน้า dashboard
      if (typeof renderChart === 'function') {
        try { renderChart(); } catch(_) {}
      }
    }
  } catch (e) { console.warn('[auth] syncPersonNames:', e); }
}

async function _createProfile(creds) {
  var name = _authUser.email.split('@')[0];
  // ตรวจสอบถ้ามี pending signup name
  var pendingName = localStorage.getItem('hf2_pending_signup_name');
  if (pendingName) {
    name = pendingName;
    localStorage.removeItem('hf2_pending_signup_name');
    localStorage.removeItem('hf2_pending_signup_email');
  }
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
  var panel = document.getElementById('loginDbPanel');
  if (panel) panel.style.display = 'none';
  _dbTapCount = 0;
  switchAuthTab('login');
  setTimeout(_renderRecentAccounts, 50);
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

  localStorage.setItem('hf2_sb_url', url);
  localStorage.setItem('hf2_sb_key', key);

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'กำลังทดสอบ...'; }
  if (msgEl) {
    msgEl.style.cssText = 'margin-top:8px;font-size:12px;text-align:center;color:var(--ink3)';
    msgEl.textContent = '⏳ กำลังทดสอบการเชื่อมต่อ...';
  }

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
  var roleLabel = isAdminUser() ? '🛡 Admin' : '👤 User';

  var nameEl = document.getElementById('topbarUser');
  if (nameEl) nameEl.textContent = name + (isAdminUser() ? ' 🛡' : '');

  var lb = document.getElementById('logoutBtn');
  if (lb) lb.style.display = '';
  var rb = document.getElementById('topbarRefreshBtn');
  if (rb) rb.style.display = (typeof getSbCreds==='function' && getSbCreds().ok) ? '' : 'none';

  var sidebarName   = document.getElementById('sidebarAuthName');
  var sidebarRole   = document.getElementById('sidebarAuthRole');
  var sidebarAvatar = document.getElementById('sidebarAvatar');
  if (sidebarName)   sidebarName.textContent = name || email.split('@')[0] || '—';
  var sidebarEmail = document.getElementById('sidebarAuthEmail');
  if (sidebarEmail)  sidebarEmail.textContent = email || '';
  if (sidebarRole)   sidebarRole.textContent = roleLabel ? ('· ' + roleLabel) : '';
  if (sidebarAvatar) {
    var avatarColor = isAdminUser() ? '#0f6e56' : '#185fa5';
    var avatarBg    = isAdminUser() ? '#e1f5ee' : '#e6f1fb';
    sidebarAvatar.style.background = avatarBg;
    sidebarAvatar.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="' + avatarColor + '">' +
        '<circle cx="12" cy="8" r="4"/>' +
        '<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>' +
      '</svg>';
  }

  var sf = document.getElementById('sidebarUserInfo');
  if (sf) sf.style.display = 'none';

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
        headers: {
          'apikey': creds.key,
          'Authorization': 'Bearer ' + _authToken,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ name: newName, id: _authUser.id })
      }
    );
    if (!r.ok) {
      var errBody = '';
      try { errBody = await r.text(); } catch(_) {}
      throw new Error('HTTP ' + r.status + (errBody ? ' — ' + errBody.slice(0, 120) : ''));
    }
    if (!_authProfile) _authProfile = {};
    _authProfile.name = newName;
    var saved = _loadSavedSession();
    if (saved) { saved.profile = _authProfile; try { localStorage.setItem('hf2_auth_session', JSON.stringify(saved)); } catch(_){} }
    _updateUserBar();
    if (input) input.value = '';
    _showNameMsg('✅ เปลี่ยนชื่อเป็น "' + newName + '" แล้ว', true);
  } catch (e) {
    _showNameMsg('❌ เปลี่ยนชื่อไม่สำเร็จ: ' + e.message, false);
  }
}

// ─── PROFILE LABEL (deprecated — ใช้ชื่อ user แทน) ────────────────────────────
// getAuthLabel() คงไว้เพื่อ backward compat (split_snapshot เก่าอาจอ้างถึง label)
// doSaveLabel() เป็น no-op แล้ว — ไม่ได้ใช้ label system อีกต่อไป
async function doSaveLabel(label) { /* no-op: label system ถูกยกเลิกแล้ว */ }

// ─── CURRENT USER → UUID ──────────────────────────────────
/**
 * คืน UUID (user_id) ของผู้ใช้ที่ login อยู่
 * — ใช้แทน A/B person ID (ระบบเก่า)
 * Backward compat: ถ้ายังไม่ login → คืน 'A' (old default)
 */
function getCurrentPerson() {
  // ระบบใหม่: คืน UUID จาก Supabase Auth โดยตรง
  var userId = (typeof getAuthUserId === 'function') ? getAuthUserId() : null;
  if (userId) return userId;
  // Fallback legacy: คืน person.id (A/B) ถ้ายังไม่ login
  if (typeof persons !== 'undefined' && persons.length) {
    var linked = persons.find(function(p){ return !!p.user_id; });
    return linked ? linked.id : persons[0].id;
  }
  return null;
}

function _updateAdminNav() {
  var show = isAdminUser();
  document.querySelectorAll('.admin-only').forEach(function (el) {
    el.style.display = show ? 'flex' : 'none';
  });
}

// รีเฟรช profile จาก Supabase (ใช้ใน Settings → ปุ่มรีเฟรช)
async function refreshAuthProfile() {
  var creds = getSbCreds();
  if (!creds.ok || !_authUser) {
    showMsg('settingsMsg', '⚠️ ไม่ได้เชื่อมต่อ Supabase', 'error');
    return;
  }
  var old = _authProfile ? _authProfile.role : '—';
  await _loadProfile(creds);
  var saved = _loadSavedSession();
  if (saved) {
    saved.profile = _authProfile;
    try { localStorage.setItem('hf2_auth_session', JSON.stringify(saved)); } catch(_) {}
  }
  _updateAdminNav();
  var newRole = _authProfile ? _authProfile.role : '—';
  showMsg('settingsMsg',
    'รีเฟรชแล้ว — role: ' + newRole + (old !== newRole ? ' (เปลี่ยนจาก ' + old + ')' : ''),
    'success');
}
