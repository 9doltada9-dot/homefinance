/* HomeFinance · module: icons.js · v1.0.0
   Icon mapping & rendering helpers for categories, vendors, and status */

// ─── CATEGORY ICON MAPPING ────────────────────────────────
const CATEGORY_ICONS = {
  // ── ชื่อจริงใน DB (categories table) ──
  'บ้านและที่ดิน': 'icon-cat-house',
  'ลูก':           'icon-cat-food',
  'ส่วนตัว':       'icon-cat-personal',
  'หนี้':          'icon-cat-return',
  'บริษัทหัก':     'icon-cat-other',
  'เงินเดือน':     'icon-cat-salary',
  // ── ชื่อ default (config.js) ──
  'ค่าบ้าน': 'icon-cat-house',
  'ค่าน้ำ': 'icon-cat-water',
  'ค่าไฟ': 'icon-cat-electricity',
  'ค่าอินเตอร์เน็ต': 'icon-cat-internet',
  'ค่าโทรศัพท์': 'icon-cat-phone',
  'ค่าส่วนกลางที่ดิน': 'icon-cat-commonarea',
  'ค่าส่วนกลางบ้าน': 'icon-cat-commonarea',
  'ส่งให้พ่อแม่': 'icon-cat-family',
  'ค่าอาหารลูก': 'icon-cat-food',
  'ค่าของใช้ครัวเรือน': 'icon-cat-household',
  'ค่าของใช้ส่วนตัว': 'icon-cat-personal',
  'อื่นๆ': 'icon-cat-other',
  'ผ่อน/ผลตอบแทน': 'icon-cat-return',
  'ผลพิเศษ': 'icon-cat-bonus',
  'โบนัส': 'icon-cat-bonus',
  'รายได้อื่นๆ': 'icon-cat-otherincome',
  // ── aliases ──
  'ของกินลูก': 'icon-cat-food',
  'ซื้อของใช้บ้าน': 'icon-cat-household',
  'ผ่อนบ้าน': 'icon-cat-house',
  'ค่าน้ำประปา': 'icon-cat-water',
  'ค่าไฟบ้าน': 'icon-cat-electricity',
  'ค่าเน็ต AIS Fiber': 'icon-cat-internet',
  'ส่งเงินแม่': 'icon-cat-family',
  'โบนัสครึ่งปี': 'icon-cat-bonus',
};

// ─── VENDOR ICON MAPPING ──────────────────────────────────
const VENDOR_ICONS = {
  'Makro': 'icon-makro',
  'แม็คโคร': 'icon-makro',
  'Tesco': 'icon-tesco',
  'Tesco Lotus': 'icon-tesco',
  'เทสโก้': 'icon-tesco',
  'BigC': 'icon-bigc',
  'บิ๊กซี': 'icon-bigc',
  'Big C': 'icon-bigc',
  '7-11': 'icon-7eleven',
  '7Eleven': 'icon-7eleven',
  'FamilyMart': 'icon-familymart',
  'Family Mart': 'icon-familymart',
  'แฟมิลี่มาร์ท': 'icon-familymart',
  'Lawson': 'icon-lawson',
  'ร้านสะดวก': 'icon-convenience',
  'ตลาด': 'icon-market',
  'ตลาดนัด': 'icon-market',
  'ห้างสรรพสินค้า': 'icon-mall',
  'The Mall': 'icon-mall',
  'ร้านค้า': 'icon-mall',
  'ร้านอาหาร': 'icon-restaurant',
  'ร้านเสื้อหมี': 'icon-restaurant',
  'ร้านยา': 'icon-pharmacy',
  'ร้านขายยา': 'icon-pharmacy',
  'โฟร์แมน': 'icon-convenience',
  'ธนาคาร': 'icon-bank',
  'โรงเรียน': 'icon-school',
  'โรงแรม': 'icon-hotel',
  'ที่พัก': 'icon-hotel',
  'คาเฟ่': 'icon-cafe',
  'สตาร์บัคส์': 'icon-cafe',
  'Starbucks': 'icon-cafe',
  'ร้านกาแฟ': 'icon-cafe',
  'ร้านน้ำ': 'icon-drinks',
  'ชาไข่มุก': 'icon-drinks',
  'Chatime': 'icon-drinks',
  'ปั๊มน้ำมัน': 'icon-gasstation',
  'ปั๊ม': 'icon-gasstation',
  'PTT': 'icon-gasstation',
  'Shell': 'icon-gasstation',
};

// ─── STATUS ICON MAPPING ──────────────────────────────────
const STATUS_ICONS = {
  'paid': 'icon-status-paid',
  'pending': 'icon-status-pending',
  'transfer': 'icon-status-transfer',
};

// ─── HELPER: Get category icon ID ──────────────────────────
function getCategoryIconId(categoryName) {
  if (!categoryName) return null;
  return CATEGORY_ICONS[categoryName] || null;
}

// ─── HELPER: Get vendor icon ID ────────────────────────────
function getVendorIconId(vendorName) {
  if (!vendorName) return null;
  return VENDOR_ICONS[vendorName] || null;
}

// ─── HELPER: Get status icon ID ────────────────────────────
function getStatusIconId(status) {
  if (!status) return null;
  return STATUS_ICONS[status.toLowerCase()] || null;
}

// ─── RENDER ICON SVG ──────────────────────────────────────
function renderIcon(iconId, size = '20') {
  if (!iconId) return '';
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" style="display:inline-block;vertical-align:middle;margin-right:6px;flex-shrink:0">
    <use href="#${iconId}"></use>
  </svg>`;
}

// ─── RENDER ICON WITH LABEL ────────────────────────────────
function renderIconWithLabel(iconId, label, size = '20') {
  if (!iconId || !label) return label || '';
  return renderIcon(iconId, size) + '<span>' + label + '</span>';
}

// ─── RENDER CATEGORY ICON + NAME ───────────────────────────
function renderCategoryIcon(categoryName, size = '18') {
  const iconId = getCategoryIconId(categoryName);
  return renderIconWithLabel(iconId, categoryName, size);
}

// ─── RENDER VENDOR ICON + NAME ────────────────────────────
function renderVendorIcon(vendorName, size = '18') {
  const iconId = getVendorIconId(vendorName);
  return renderIconWithLabel(iconId, vendorName, size);
}

// ─── RENDER STATUS ICON + TEXT ────────────────────────────
function renderStatusIcon(status, size = '16') {
  const iconId = getStatusIconId(status);
  const labels = {
    'paid': '✓ ชำระแล้ว',
    'pending': '⏳ รอดำเนินการ',
    'transfer': '↔ โอน',
  };
  const label = labels[status.toLowerCase()] || status;
  return renderIconWithLabel(iconId, label, size);
}

// ─── GET ALL CATEGORIES WITH ICONS ──────────────────────────
function getCategoriesWithIcons(categoryList) {
  if (!Array.isArray(categoryList)) return [];
  return categoryList.map(function(cat) {
    return {
      ...cat,
      iconId: getCategoryIconId(cat.name),
      renderIcon: function() { return renderCategoryIcon(this.name); }
    };
  });
}

// ─── GET ALL VENDORS WITH ICONS ────────────────────────────
function getVendorsWithIcons(vendorList) {
  if (!Array.isArray(vendorList)) return [];
  return vendorList.map(function(vendor) {
    return {
      ...vendor,
      iconId: getVendorIconId(vendor.name),
      renderIcon: function() { return renderVendorIcon(this.name); }
    };
  });
}

// ─── UTILITY: Map category name by ID (for transactions) ───
function getCategoryNameById(catId) {
  if (!categories) return '';
  var cat = categories.find(function(c) { return c.id === catId; });
  return (cat && cat.name) || '';
}

// ─── UTILITY: Map vendor name by ID ────────────────────────
function getVendorNameById(vendorId) {
  if (!vendorsData) return '';
  var vendor = vendorsData.find(function(v) { return v.id === vendorId; });
  return (vendor && vendor.name) || '';
}
