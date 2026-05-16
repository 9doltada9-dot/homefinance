/* HomeFinance · module: splitGroups.js · v1.0.0 */
/* Settlement Groups — Admin management UI */

// ── Module state ──────────────────────────────────────────────────────────────
var _sgEditId  = null;   // null = create new, string = editing existing id
var _sgMembers = [];     // working copy of member list for modal

// ── Render group list (called when Admin page opens) ─────────────────────────
function renderSplitGroupsSection() {
  var el = document.getElementById('splitGroupsList');
  if (!el) return;

  var groups = getSplitGroups();
  if (!groups.length) {
    el.innerHTML =
      '<div style="text-align:center;padding:24px;color:var(--ink3);font-size:13px">' +
      'ยังไม่มีกลุ่ม — กด <strong>+ สร้างกลุ่ม</strong> เพื่อเริ่มต้น</div>';
    return;
  }

  var typeMap = {
    personal: { label:'ส่วนตัว',      cls:'sg-badge-personal', icon:'💼', bg:'#faeeda' },
    equal:    { label:'หารเท่ากัน',   cls:'sg-badge-equal',    icon:'👥', bg:'#e1f5ee' },
    ratio:    { label:'ตามสัดส่วน %', cls:'sg-badge-ratio',    icon:'📊', bg:'#e6f1fb' },
    custom:   { label:'เลือกคน',      cls:'sg-badge-custom',   icon:'🎯', bg:'#eeedfe' },
  };

  el.innerHTML = groups.map(function(g) {
    var tm = typeMap[g.split_type] || { label:g.split_type, cls:'sg-badge-equal', icon:'🏠', bg:'#e1f5ee' };
    var activeMembers = (g.members || []).filter(function(m) { return m.active; });
    var summary = activeMembers.map(function(m) {
      var p = (typeof persons !== 'undefined') ? persons.find(function(x) { return x.user_id === m.user_id; }) : null;
      var name = p ? p.name : (m.label || '?');
      return g.split_type === 'ratio' ? name + ' ' + m.ratio + '%' : name;
    }).join(' · ') || (activeMembers.length + ' คน');

    var hasActive = activeMembers.length > 0;

    return '<div class="sg-item" onclick="openSplitGroupModal(\'' + _escHtml(g.id) + '\')">' +
      '<div class="sg-item-icon" style="background:' + tm.bg + ';border-radius:10px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + tm.icon + '</div>' +
      '<div class="sg-item-body">' +
        '<div class="sg-item-name" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">' +
          _escHtml(g.name) +
          '<span class="sg-badge ' + tm.cls + '">' + tm.label + '</span>' +
          '<span class="sg-badge ' + (hasActive ? 'sg-badge-active' : 'sg-badge-inactive') + '">' +
            (hasActive ? 'เปิดใช้' : 'ปิดใช้') +
          '</span>' +
        '</div>' +
        '<div class="sg-item-sub">' + _escHtml(summary) + ' · ' + activeMembers.length + ' คน</div>' +
      '</div>' +
      '<div class="sg-item-arrow">›</div>' +
    '</div>';
  }).join('');
}

// ── Open create / edit modal ──────────────────────────────────────────────────
function openSplitGroupModal(groupId) {
  _sgEditId = groupId || null;
  var modal = document.getElementById('splitGroupModal');
  if (!modal) return;

  var g = null;
  if (groupId) {
    var list = getSplitGroups();
    g = list.find(function(x) { return x.id === groupId; });
  }

  // Title
  document.getElementById('sgModalTitle').textContent = g ? 'แก้ไขกลุ่ม' : 'สร้างกลุ่มใหม่';

  // Name
  document.getElementById('sgName').value = g ? g.name : '';

  // Split type buttons
  var type = g ? g.split_type : 'equal';
  document.querySelectorAll('.sg-type-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // แสดง loading ก่อน แล้วดึง profiles จาก Supabase
  var el = document.getElementById('sgMemberList');
  if (el) el.innerHTML = '<div style="text-align:center;padding:12px;font-size:12px;color:var(--ink3)">⏳ กำลังโหลดสมาชิก...</div>';
  modal.style.display = 'flex';

  _sgLoadProfilesAndRender(g, type);
  _updateSgValidation(type);

  // Show/hide delete button
  var delBtn = document.getElementById('sgDeleteBtn');
  if (delBtn) delBtn.style.display = g ? '' : 'none';

  _sgSetModalMsg('', false);
}

function closeSplitGroupModal() {
  var modal = document.getElementById('splitGroupModal');
  if (modal) modal.style.display = 'none';
}

// ── โหลด profiles จาก Supabase แล้ว render สมาชิก ─────────────────────────────
async function _sgLoadProfilesAndRender(g, type) {
  var creds = (typeof getSbCreds === 'function') ? getSbCreds() : { ok: false };
  var token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
  var profiles = [];

  if (creds.ok && token) {
    try {
      var r = await fetch(
        creds.url + '/rest/v1/profiles?select=id,name,label&order=name',
        { headers: { 'apikey': creds.key, 'Authorization': 'Bearer ' + token } }
      );
      if (r.ok) profiles = await r.json();
    } catch (e) { console.warn('[sg] loadProfiles:', e); }
  }

  // fallback: ใช้ persons ถ้าดึงไม่ได้
  if (!profiles.length && typeof persons !== 'undefined') {
    profiles = persons
      .filter(function(p) { return p.user_id; })
      .map(function(p) { return { id: p.user_id, name: p.name, label: p.label || '' }; });
  }

  var myId = typeof getAuthUserId === 'function' ? getAuthUserId() : null;

  _sgMembers = profiles.map(function(p) {
    var existing = g ? (g.members || []).find(function(m) { return m.user_id === p.id; }) : null;
    // สำหรับกลุ่มใหม่ (ไม่มี existing) ให้ auto-activate ตาม type
    var defaultActive = false;
    if (!g) {
      if (type === 'equal' || type === 'custom') defaultActive = true;
      else if (type === 'personal') defaultActive = (p.id === myId);
      else defaultActive = false; // ratio: ให้ผู้ใช้เลือกเอง
    }
    return {
      user_id: p.id,
      label:   existing ? existing.label : (p.label || p.name),
      ratio:   existing ? (parseFloat(existing.ratio) || 0) : 0,
      active:  existing ? !!existing.active : defaultActive,
      _name:   p.name,
    };
  });

  _renderSgMembers(type);
  _updateSgValidation(type);
}

// ── Render member rows inside modal ──────────────────────────────────────────
function _renderSgMembers(type) {
  var el = document.getElementById('sgMemberList');
  if (!el) return;

  if (!_sgMembers.length) {
    el.innerHTML = '<div style="color:var(--ink3);font-size:12px;padding:8px 0">ไม่มีสมาชิกในระบบ</div>';
    return;
  }

  var myId = type === 'personal'
    ? (typeof getAuthUserId === 'function' ? getAuthUserId() : null)
    : null;

  el.innerHTML = _sgMembers.map(function(m, i) {
    var initials = (m._name || '?').charAt(0);
    // ส่วนตัว: toggle ของคนอื่นเป็น disabled
    var isDisabled = (type === 'personal' && myId && m.user_id !== myId);

    var pctHtml = '';
    if (type === 'ratio' && m.active) {
      pctHtml = '<input type="number" class="sg-pct-inp" min="0" max="100" step="1" ' +
        'value="' + (m.ratio || 0) + '" ' +
        'oninput="_sgUpdateRatio(' + i + ',this.value)">' +
        '<span style="font-size:11px;color:var(--ink3);margin-left:2px">%</span>';
    } else if (type === 'ratio' && !m.active) {
      pctHtml = '<span style="font-size:12px;color:var(--ink3);min-width:44px;text-align:right">—</span>';
    }
    // ส่วนตัว: badge แสดงว่าเป็น "ฉัน"
    var meBadge = (type === 'personal' && myId && m.user_id === myId)
      ? '<span style="font-size:10px;background:#e6f1fb;color:#185fa5;border-radius:8px;padding:1px 7px;margin-left:4px;font-weight:600">ฉัน</span>'
      : '';

    return '<div class="sg-mem-row" id="sgMem_' + i + '"' +
      (m.active ? '' : ' style="opacity:.5"') + '>' +
      '<div class="sg-avatar">' + _escHtml(initials) + '</div>' +
      '<div class="sg-mem-info">' +
        '<div class="sg-mem-name">' + _escHtml(m._name) + meBadge + '</div>' +
      '</div>' +
      pctHtml +
      '<div class="sg-toggle ' + (m.active ? '' : 'off') + (isDisabled ? ' disabled' : '') + '" ' +
        (isDisabled ? '' : 'onclick="_sgToggleMember(' + i + ')"') + ' ' +
        'title="' + (isDisabled ? 'ส่วนตัว — ไม่สามารถเปลี่ยนได้' : (m.active ? 'Active — คลิกเพื่อปิด' : 'Inactive — คลิกเพื่อเปิด')) + '">' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── Member interaction ────────────────────────────────────────────────────────
function _sgToggleMember(i) {
  _sgMembers[i].active = !_sgMembers[i].active;
  var type = _sgGetSelectedType();
  if (type === 'ratio' && !_sgMembers[i].active) {
    _sgMembers[i].ratio = 0;  // reset ratio when deactivating
  }
  _renderSgMembers(type);
  _updateSgValidation(type);
}

function _sgUpdateRatio(i, val) {
  _sgMembers[i].ratio = parseFloat(val) || 0;
  _updateSgValidation('ratio');
}

function _sgGetSelectedType() {
  var btn = document.querySelector('.sg-type-btn.active');
  return btn ? btn.dataset.type : 'equal';
}

function sgSelectType(type) {
  document.querySelectorAll('.sg-type-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === type);
  });
  // ส่วนตัว: เปิดเฉพาะ user ปัจจุบัน, ปิดคนอื่น
  if (type === 'personal') {
    var myId = typeof getAuthUserId === 'function' ? getAuthUserId() : null;
    _sgMembers.forEach(function(m) {
      m.active = myId ? (m.user_id === myId) : false;
      if (!m.active) m.ratio = 0;
    });
  }
  _renderSgMembers(type);
  _updateSgValidation(type);
}

// ── Validation bar ────────────────────────────────────────────────────────────
function _updateSgValidation(type) {
  var bar    = document.getElementById('sgValidBar');
  var balBtn = document.getElementById('sgAutoBalanceBtn');
  var saveBtn = document.getElementById('sgSaveBtn');
  if (!bar) return;

  if (type !== 'ratio') {
    bar.style.display  = 'none';
    if (balBtn)  balBtn.style.display  = 'none';
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  var active = _sgMembers.filter(function(m) { return m.active; });
  var total  = active.reduce(function(s, m) { return s + (parseFloat(m.ratio) || 0); }, 0);
  var ok     = active.length > 0 && Math.abs(total - 100) < 0.5;

  bar.style.display = 'flex';
  bar.className = 'sg-val-bar ' + (ok ? 'ok' : 'err');
  bar.querySelector('.sg-val-text').textContent = ok
    ? '✅ รวม 100% — พร้อมบันทึก'
    : '⚠️ รวม ' + Math.round(total) + '% — ต้องเท่ากับ 100%';

  if (balBtn)  balBtn.style.display  = (!ok && active.length > 0) ? '' : 'none';
  if (saveBtn) saveBtn.disabled = !ok;
}

// ── Auto-balance ratios ───────────────────────────────────────────────────────
function sgAutoBalance() {
  var active = _sgMembers.filter(function(m) { return m.active; });
  if (!active.length) return;
  var each = Math.floor(100 / active.length);
  var rem  = 100 - each * active.length;
  active.forEach(function(m, i) { m.ratio = each + (i === 0 ? rem : 0); });
  _renderSgMembers('ratio');
  _updateSgValidation('ratio');
}

// ── Save group ────────────────────────────────────────────────────────────────
function _sgSetModalMsg(text, isError) {
  var el = document.getElementById('sgMsg');
  if (!el) return;
  el.textContent = text;
  // .msg class มี display:none — ต้อง override ด้วย inline style
  el.style.display = text ? 'block' : 'none';
  el.style.color = isError ? 'var(--red,#dc2626)' : 'var(--green,#166534)';
  el.style.background = isError ? '#fef2f2' : 'var(--green-bg,#f0fdf4)';
  el.style.borderRadius = '8px';
  el.style.padding = '8px 12px';
  el.style.fontSize = '13px';
  el.style.fontWeight = '600';
}

function saveSplitGroupFromModal() {
  _sgSetModalMsg('', false);  // clear

  var name = (document.getElementById('sgName').value || '').trim();
  if (!name) {
    _sgSetModalMsg('⚠️ กรุณาใส่ชื่อกลุ่ม', true);
    document.getElementById('sgName').focus();
    return;
  }

  var type = _sgGetSelectedType();
  var activeMembers = _sgMembers.filter(function(m) { return m.active; });

  if (!activeMembers.length) {
    _sgSetModalMsg('⚠️ เลือกสมาชิกอย่างน้อย 1 คน (กด toggle เพื่อเปิด)', true);
    return;
  }

  if (type === 'ratio') {
    var total = activeMembers.reduce(function(s, m) { return s + (parseFloat(m.ratio) || 0); }, 0);
    if (Math.abs(total - 100) > 0.5) {
      _sgSetModalMsg('⚠️ % รวมต้องเท่ากับ 100 (ตอนนี้ ' + Math.round(total) + '%)', true);
      return;
    }
  }

  try {
    var groupData = {
      name:       name,
      split_type: type,
      members:    _sgMembers.map(function(m) {
        return {
          user_id: m.user_id,
          label:   m.label || m._name,
          ratio:   parseFloat(m.ratio) || 0,
          active:  !!m.active,
        };
      }),
    };

    if (_sgEditId) {
      updateSplitGroup(_sgEditId, groupData);
    } else {
      addSplitGroup(groupData);
    }

    closeSplitGroupModal();
    renderSplitGroupsSection();
    _sgShowMsg(_sgEditId ? 'อัปเดตกลุ่มเรียบร้อย ✅' : 'สร้างกลุ่มใหม่เรียบร้อย ✅');
  } catch(err) {
    _sgSetModalMsg('❌ เกิดข้อผิดพลาด: ' + err.message, true);
    console.error('[sg] saveSplitGroup error:', err);
  }
}

// ── Delete group ──────────────────────────────────────────────────────────────
function deleteSplitGroupConfirm() {
  if (!_sgEditId) return;
  if (!confirm('ลบกลุ่มนี้?\n\nรายการที่บันทึกไว้แล้วจะไม่ถูกลบ (snapshot คงอยู่)')) return;
  deleteSplitGroup(_sgEditId);
  closeSplitGroupModal();
  renderSplitGroupsSection();
  _sgShowMsg('ลบกลุ่มแล้ว');
}

// ── Get groups for dropdowns (used by form.js) ────────────────────────────────
function getSplitGroupOptions() {
  return getSplitGroups().map(function(g) {
    return { id: g.id, name: g.name, split_type: g.split_type, members: g.members };
  });
}

// Get active members + ratios for a specific group (snapshot helper for form.js)
function buildSplitSnapshot(groupId, totalAmount) {
  var groups = getSplitGroups();
  var g = groups.find(function(x) { return x.id === groupId; });
  if (!g) return {};

  var activeMembers = (g.members || []).filter(function(m) { return m.active; });
  if (!activeMembers.length) return {};

  var snapshot = {};
  var type = g.split_type;

  if (type === 'equal') {
    var each = totalAmount / activeMembers.length;
    activeMembers.forEach(function(m) {
      snapshot[m.user_id] = {
        label: m.label,
        pct: Math.round(100 / activeMembers.length),
        amount: Math.round(each * 100) / 100,
      };
    });

  } else if (type === 'ratio') {
    var totalPct = activeMembers.reduce(function(s, m) { return s + (m.ratio || 0); }, 0);
    activeMembers.forEach(function(m) {
      var pct = totalPct > 0 ? (m.ratio / totalPct) * 100 : 0;
      snapshot[m.user_id] = {
        label: m.label,
        pct: Math.round(pct * 10) / 10,
        amount: Math.round((m.ratio / totalPct) * totalAmount * 100) / 100,
      };
    });

  } else if (type === 'custom') {
    // 'custom' — equal split among active; let form.js override per transaction
    var each2 = totalAmount / activeMembers.length;
    activeMembers.forEach(function(m) {
      snapshot[m.user_id] = {
        label: m.label,
        pct: Math.round(100 / activeMembers.length),
        amount: Math.round(each2 * 100) / 100,
      };
    });
  }

  return snapshot;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _sgShowMsg(text) {
  // Try the admin page msg element, fall back to settingsMsg
  var el = document.getElementById('adminMsg') || document.getElementById('settingsMsg');
  if (!el) return;
  el.textContent = text;
  setTimeout(function() { el.textContent = ''; }, 3000);
}
