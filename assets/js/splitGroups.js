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
      '<div style="text-align:center;padding:20px;color:var(--ink3);font-size:13px">' +
      'ยังไม่มีกลุ่ม — กด "<strong>+ สร้างกลุ่ม</strong>" เพื่อเริ่มต้น</div>';
    return;
  }

  var typeLabel = { personal:'ส่วนตัว', equal:'หารเท่ากัน', ratio:'ตามสัดส่วน', custom:'เลือกคน' };

  el.innerHTML = groups.map(function(g) {
    var label = typeLabel[g.split_type] || g.split_type;
    var activeMembers = (g.members || []).filter(function(m) { return m.active; });
    var summary = activeMembers.map(function(m) {
      var p = (typeof persons !== 'undefined') ? persons.find(function(p) { return p.user_id === m.user_id; }) : null;
      var name = p ? p.name : (m.label || '?');
      return g.split_type === 'ratio' ? name + ' ' + m.ratio + '%' : name;
    }).join(' · ') || (activeMembers.length + ' คน');

    return '<div class="sg-item" onclick="openSplitGroupModal(\'' + _escHtml(g.id) + '\')">' +
      '<div class="sg-item-icon">🏠</div>' +
      '<div class="sg-item-body">' +
        '<div class="sg-item-name">' + _escHtml(g.name) + '</div>' +
        '<div class="sg-item-sub">' + _escHtml(label) + ' · ' + _escHtml(summary) + '</div>' +
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

  // Build member working list from persons array
  var allPersons = (typeof persons !== 'undefined') ? persons : [];
  _sgMembers = allPersons.map(function(p) {
    var existing = g ? (g.members || []).find(function(m) { return m.user_id === p.user_id; }) : null;
    return {
      user_id: p.user_id || ('__legacy_' + p.id),
      label:   existing ? existing.label : p.name,
      ratio:   existing ? (parseFloat(existing.ratio) || 0) : 0,
      active:  existing ? !!existing.active : false,
      _name:   p.name,   // display name (internal)
      _hasAccount: !!p.user_id,
    };
  });

  _renderSgMembers(type);
  _updateSgValidation(type);

  // Show/hide delete button
  var delBtn = document.getElementById('sgDeleteBtn');
  if (delBtn) delBtn.style.display = g ? '' : 'none';

  document.getElementById('sgMsg').textContent = '';
  modal.style.display = 'flex';
}

function closeSplitGroupModal() {
  var modal = document.getElementById('splitGroupModal');
  if (modal) modal.style.display = 'none';
}

// ── Render member rows inside modal ──────────────────────────────────────────
function _renderSgMembers(type) {
  var el = document.getElementById('sgMemberList');
  if (!el) return;

  if (!_sgMembers.length) {
    el.innerHTML = '<div style="color:var(--ink3);font-size:12px;padding:8px 0">ไม่มีสมาชิกในระบบ</div>';
    return;
  }

  el.innerHTML = _sgMembers.map(function(m, i) {
    var initials = (m._name || '?').charAt(0);
    var accountBadge = m._hasAccount
      ? '<span style="font-size:10px;color:var(--green);background:var(--green-bg);border-radius:4px;padding:1px 5px">มีบัญชี</span>'
      : '<span style="font-size:10px;color:#f97316;background:#fff7ed;border-radius:4px;padding:1px 5px">ยังไม่มีบัญชี</span>';

    var pctHtml = '';
    if (type === 'ratio' && m.active) {
      pctHtml = '<input type="number" class="sg-pct-inp" min="0" max="100" step="1" ' +
        'value="' + (m.ratio || 0) + '" ' +
        'oninput="_sgUpdateRatio(' + i + ',this.value)">' +
        '<span style="font-size:11px;color:var(--ink3);margin-left:2px">%</span>';
    } else if (type === 'ratio' && !m.active) {
      pctHtml = '<span style="font-size:12px;color:var(--ink3);min-width:44px;text-align:right">—</span>';
    }

    return '<div class="sg-mem-row" id="sgMem_' + i + '"' +
      (m.active ? '' : ' style="opacity:.5"') + '>' +
      '<div class="sg-avatar">' + _escHtml(initials) + '</div>' +
      '<div class="sg-mem-info">' +
        '<div class="sg-mem-name">' + _escHtml(m._name) + '</div>' +
        '<div style="margin-top:2px">' + accountBadge + '</div>' +
      '</div>' +
      pctHtml +
      '<div class="sg-toggle ' + (m.active ? '' : 'off') + '" ' +
        'onclick="_sgToggleMember(' + i + ')" ' +
        'title="' + (m.active ? 'Active — คลิกเพื่อปิด' : 'Inactive — คลิกเพื่อเปิด') + '">' +
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
function saveSplitGroupFromModal() {
  var name = (document.getElementById('sgName').value || '').trim();
  if (!name) {
    document.getElementById('sgMsg').textContent = '⚠️ กรุณาใส่ชื่อกลุ่ม';
    return;
  }

  var type = _sgGetSelectedType();
  var activeMembers = _sgMembers.filter(function(m) { return m.active; });

  if (!activeMembers.length) {
    document.getElementById('sgMsg').textContent = '⚠️ เลือกสมาชิกอย่างน้อย 1 คน';
    return;
  }

  if (type === 'ratio') {
    var total = activeMembers.reduce(function(s, m) { return s + (parseFloat(m.ratio) || 0); }, 0);
    if (Math.abs(total - 100) > 0.5) {
      document.getElementById('sgMsg').textContent = '⚠️ % รวมต้องเท่ากับ 100 (' + Math.round(total) + '%)';
      return;
    }
  }

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
