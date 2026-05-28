/* HomeFinance · module: items.js · v2.6.0 */

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
    ? list.map(function(item){
        return '<div id="item-row-'+item.id+'" style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">'
          +'<span style="font-size:14px;color:var(--ink);flex:1">'+item.name+'</span>'
          +'<div style="display:flex;gap:4px;align-items:center">'
          +'<button onclick="startEditItem(\''+item.id+'\',\''+catId+'\')" title="แก้ไข" style="background:none;border:none;color:var(--ink3);font-size:15px;cursor:pointer;padding:4px 6px;min-width:32px;min-height:36px;line-height:1">✏️</button>'
          +'<button onclick="deleteItem(\''+item.id+'\',\''+catId+'\')" style="background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px">×</button>'
          +'</div>'
          +'</div>';
      }).join('')
    : '<div style="font-size:13px;color:var(--ink3);padding:8px 0">ยังไม่มีรายการ — เพิ่มได้ด้านล่าง</div>';
}

function startEditItem(itemId, catId){
  var row = document.getElementById('item-row-'+itemId);
  if(!row) return;
  var item = (itemsData[catId]||[]).find(function(x){return x.id===itemId;});
  if(!item) return;
  row.innerHTML =
    '<input id="edit-item-input-'+itemId+'" value="'+item.name+'" style="flex:1;font-size:14px;padding:4px 8px;border:1.5px solid var(--brand,#1a7a4a);border-radius:6px;margin-right:8px;min-width:0" />'
    +'<div style="display:flex;gap:4px;align-items:center">'
    +'<button onclick="confirmEditItem(\''+itemId+'\',\''+catId+'\')" style="background:var(--brand,#1a7a4a);color:#fff;border:none;border-radius:6px;padding:4px 12px;font-size:13px;cursor:pointer;min-height:32px">บันทึก</button>'
    +'<button onclick="renderItemList()" style="background:none;border:1px solid var(--line);border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer;min-height:32px">ยกเลิก</button>'
    +'</div>';
  var inp = document.getElementById('edit-item-input-'+itemId);
  if(inp){ inp.focus(); inp.select();
    inp.addEventListener('keydown', function(e){
      if(e.key==='Enter') confirmEditItem(itemId, catId);
      if(e.key==='Escape') renderItemList();
    });
  }
}

async function confirmEditItem(itemId, catId){
  if(!checkOnlineForAction()) return;
  var inp = document.getElementById('edit-item-input-'+itemId);
  if(!inp) return;
  var newName = inp.value.trim();
  if(!newName){ showMsg('itemMsg','กรุณาใส่ชื่อรายการ','error'); return; }
  var list = itemsData[catId]||[];
  var item = list.find(function(x){return x.id===itemId;});
  if(!item) return;
  if(newName===item.name){ renderItemList(); return; }
  if(list.find(function(x){return x.name===newName && x.id!==itemId;})){ showMsg('itemMsg','มีรายการนี้แล้ว','error'); return; }

  var oldName = item.name;
  item.name = newName;
  saveItemsLocal();
  renderItemList();
  showMsg('itemMsg', 'กำลังบันทึก...', 'success');

  if(!String(itemId).startsWith('local-')){
    var ok = await sbUpdateItem(itemId, newName);
    if(!ok){
      item.name = oldName; // rollback
      saveItemsLocal();
      renderItemList();
      showMsg('itemMsg','แก้ไขไม่สำเร็จ กรุณาลองใหม่','error');
      return;
    }
  }
  showMsg('itemMsg', 'แก้ไข "'+newName+'" แล้ว ✓', 'success');
}

async function addItem(){
  if(!checkOnlineForAction()) return;
  var catId = document.getElementById('itemCatSel')?.value;
  var name = document.getElementById('newItemName')?.value.trim();
  if(!catId||!name){ showMsg('itemMsg','กรุณาใส่ชื่อรายการ','error'); return; }
  var existing = itemsData[catId]||[];
  if(existing.find(function(x){return x.name===name;})){ showMsg('itemMsg','มีรายการนี้แล้ว','error'); return; }

  var sortOrder = existing.length;
  var _tempId = 'local-' + Date.now();
  if(!itemsData[catId]) itemsData[catId]=[];
  itemsData[catId].push({id: _tempId, name:name, sort_order:sortOrder});
  saveItemsLocal();
  document.getElementById('newItemName').value='';
  renderItemList();
  showMsg('itemMsg', 'กำลังบันทึก...', 'success');

  var saved = await sbAddItem(catId, name, sortOrder);
  if(saved && saved.id){
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
