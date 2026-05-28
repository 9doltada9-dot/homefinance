/* HomeFinance · module: items.js · v2.5.0 */

function buildItemsData(rows){
  itemsData = {};
  if(!rows) return;
  rows.forEach(function(row){
    if(!itemsData[row.cat_id]) itemsData[row.cat_id]=[];
    itemsData[row.cat_id].push({id:row.id, name:row.name, sort_order:row.sort_order||0});
  });
  saveItemsLocal();
}

function renderItemCatSel(){
  var sel = document.getElementById('itemCatSel');
  if(!sel) return;
  sel.innerHTML = categories.map(function(c){return '<option value="'+c.id+'">['+(c.type==='income'?'รายรับ':'รายจ่าย')+'] '+c.name+'</option>';}).join('');
  renderItemList();
}

function renderItemList(){
  var catId = document.getElementById('itemCatSel')?.value;
  var el = document.getElementById('itemList');
  if(!el||!catId) return;
  var list = itemsData[catId]||[];
  el.innerHTML = list.length
    ? list.map(function(item){return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">'+
          '<span style="font-size:14px;color:var(--ink)">'+item.name+'</span>'+
          '<button onclick="deleteItem(\''+item.id+'\',\''+catId+'\')" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px">×</button>'+
        '</div>';}).join('')
    : '<div style="font-size:13px;color:var(--ink3);padding:8px 0">ยังไม่มีรายการ — เพิ่มได้ด้านล่าง</div>';
}

async function addItem(){
  if(!checkOnlineForAction()) return;
  var catId = document.getElementById('itemCatSel')?.value;
  var name = document.getElementById('newItemName')?.value.trim();
  if(!catId||!name){ showMsg('itemMsg','กรุณาใส่ชื่อรายการ','error'); return; }
  var existing = itemsData[catId]||[];
  if(existing.find(function(x){return x.name===name;})){ showMsg('itemMsg','มีรายการนี้แล้ว','error'); return; }

  var sortOrder = existing.length;
  // Optimistic update — อัปเดต itemsData ทันที ก่อน await Supabase
  // เพื่อให้หน้าฟอร์มเห็นรายการใหม่ทันทีแม้ navigate ไปก่อน response กลับมา
  var _tempId = 'local-' + Date.now();
  if(!itemsData[catId]) itemsData[catId]=[];
  itemsData[catId].push({id: _tempId, name:name, sort_order:sortOrder});
  saveItemsLocal();
  document.getElementById('newItemName').value='';
  renderItemList();
  showMsg('itemMsg', 'กำลังบันทึก...', 'success');

  var saved = await sbAddItem(catId, name, sortOrder);
  if(saved && saved.id){
    // อัปเดต id จาก temp → real Supabase id
    var _idx = (itemsData[catId]||[]).findIndex(function(x){ return x.id === _tempId; });
    if(_idx >= 0) itemsData[catId][_idx].id = saved.id;
    saveItemsLocal();
  }
  showMsg('itemMsg', saved ? ('เพิ่ม "'+name+'" บันทึกแล้ว ✓') : ('เพิ่ม "'+name+'" (offline)'), 'success');
}

async function deleteItem(itemId, catId){
  if(!checkOnlineForAction()) return;
  var _item = (itemsData[catId]||[]).find(function(x){return x.id===itemId;});
  if(!confirm('ลบ "' + (_item?_item.name:itemId) + '" ใช่หรือไม่?')) return;
  var list = itemsData[catId]||[];
  var item = list.find(function(x){return x.id===itemId;});
  if(!item) return;
  itemsData[catId] = list.filter(function(x){return x.id!==itemId;});
  saveItemsLocal();
  renderItemList();
  if(!String(itemId).startsWith('local-')) await sbDeleteItem(itemId);
  showMsg('itemMsg','ลบ "'+item.name+'" แล้ว','success');
}
