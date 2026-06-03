/* HomeFinance · module: settings.js · v3.0.0 */

// ─── SETTINGS ─────────────────────────────────────────────
function renderSettings(){
  applyViewMode();
  if (typeof renderGlassSettings === 'function') renderGlassSettings();
  renderPersonList();
  renderCatList('income');
  renderCatList('expense');
  renderItemCatSel();
  renderVendorList();
  renderTrackedItemSettings();
  // v3: รายการประจำเดือน
  if (typeof renderRecurringList === 'function') renderRecurringList();
  // sync recurring due notif toggle state
  var rdToggle = document.getElementById('recurringDueNotifToggle');
  if (rdToggle) {
    if (typeof recurringDueNotifEnabled !== 'undefined' && !recurringDueNotifEnabled) {
      rdToggle.classList.remove('on');
    } else {
      rdToggle.classList.add('on');
    }
  }
  // v3: notification permission status + balance check
  var notifStatus = document.getElementById('notifStatusText');
  if (notifStatus && 'Notification' in window) {
    var p = Notification.permission;
    notifStatus.textContent = p === 'granted' ? '✅ เปิดอยู่'
                            : p === 'denied'  ? '🚫 ถูกบล็อก (แก้ที่ browser settings)'
                            : '⬜ ยังไม่ได้เปิด';
  }
  // แสดงสถานะยอดเงินทันที (ไม่ต้องกดปุ่ม)
  if (typeof runNotificationChecks === 'function') {
    setTimeout(runNotificationChecks, 80);
  }
}

// ─── TRACKED ITEMS FOR TREND CHART ───────────────────────

function getTrackedItems() {
  try { return JSON.parse(localStorage.getItem('hf_tracked_items') || '[]'); } catch(e) { return []; }
}

function saveTrackedItems(list) {
  localStorage.setItem('hf_tracked_items', JSON.stringify(list));
}

function renderTrackedItemSettings() {
  var el = document.getElementById('trackedItemList');
  if (!el) return;

  // รวมทุก item จาก expense categories
  var expCats = (typeof categories !== 'undefined' ? categories : []).filter(function(c){ return c.type === 'expense'; });
  var allItems = [];
  expCats.forEach(function(c){
    ((typeof itemsData !== 'undefined' ? itemsData : {})[c.id] || []).forEach(function(item){
      allItems.push({ id: item.id, name: item.name, cat_id: c.id, cat_name: c.name });
    });
  });

  if (!allItems.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--ink3);padding:4px 0">ยังไม่มีรายการ — เพิ่มได้ที่หมวด/รายการด้านบน</div>';
    return;
  }

  var tracked = getTrackedItems();
  var trackedIds = tracked.map(function(t){ return t.id; });

  // Group by cat
  var bycat = {};
  allItems.forEach(function(item){
    if (!bycat[item.cat_name]) bycat[item.cat_name] = [];
    bycat[item.cat_name].push(item);
  });

  var html = '';
  Object.keys(bycat).sort().forEach(function(catName){
    html += '<div style="font-size:11px;font-weight:700;color:var(--ink3);letter-spacing:.4px;margin:10px 0 4px;text-transform:uppercase">' + catName + '</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:6px">';
    bycat[catName].forEach(function(item){
      var on = trackedIds.indexOf(item.id) > -1;
      html += '<button onclick="toggleTrackedItem(\'' + item.id.replace(/'/g,"\\'") + '\',\'' + item.name.replace(/'/g,"\\'") + '\',\'' + item.cat_id.replace(/'/g,"\\'") + '\')"'
        + ' style="padding:6px 14px;border-radius:20px;font-size:12px;font-family:Sarabun,sans-serif;cursor:pointer;transition:all .15s;'
        + (on ? 'background:var(--brand,#1a7a4a);color:#fff;border:1.5px solid var(--brand,#1a7a4a);font-weight:700'
              : 'background:transparent;color:var(--ink);border:1.5px solid var(--line)')
        + '">' + item.name + '</button>';
    });
    html += '</div>';
  });
  el.innerHTML = html;
}

function toggleTrackedItem(itemId, itemName, catId) {
  var tracked = getTrackedItems();
  var idx = tracked.findIndex(function(t){ return t.id === itemId; });
  if (idx > -1) {
    tracked.splice(idx, 1);
  } else {
    tracked.push({ id: itemId, name: itemName, cat_id: catId });
  }
  saveTrackedItems(tracked);
  renderTrackedItemSettings();
}
