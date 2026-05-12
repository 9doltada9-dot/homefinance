/* HomeFinance · module: transactions.js · v3.0.0 */

// ─── MULTI FILTER ─────────────────────────────────────────
function toggleMF(id){
  var el = document.getElementById(id);
  var dd = el.querySelector('.mf-dropdown');
  var wasOpen = dd.classList.contains('open');
  document.querySelectorAll('.mf-dropdown.open').forEach(function(d){d.classList.remove('open');});
  if(!wasOpen) dd.classList.add('open');
}

function getMFValues(id){
  return [].slice.call(document.querySelectorAll('#'+id+' input[type=checkbox]:checked')).map(function(c){return c.value;});
}

var MF_LABELS = {
  income:'รายรับ', expense:'รายจ่าย',
  paid:'จ่ายแล้ว', received:'รับแล้ว', pending:'รอดำเนินการ'
};

function updateMFLabel(id, def){
  var vals = getMFValues(id);
  var label = document.querySelector('#'+id+' .mf-label');
  if(!label) return;
  if(vals.length===0){
    label.textContent = def+' ▾';
    label.classList.remove('active');
  } else if(vals.length<=2 && vals.every(function(v){return MF_LABELS[v];})){
    // show names for small selections like type/status
    label.textContent = vals.map(function(v){return MF_LABELS[v];}).join(', ')+' ▾';
    label.classList.add('active');
  } else {
    label.textContent = vals.length+' รายการ ▾';
    label.classList.add('active');
  }
}

function populateMFItem(){
  var el = document.getElementById('mfItemList');
  if(!el) return;
  var cur = getMFValues('mfItem');
  var fcats = getMFValues('mfCat');
  // get items from selected categories (or all)
  var items = [];
  if(fcats.length){
    fcats.forEach(function(catId){ items.push.apply(items, (itemsData[catId]||[]).map(function(x){return x.name;})); });
  } else {
    Object.values(itemsData).forEach(function(arr){ items.push.apply(items, arr.map(function(x){return x.name;})); });
  }
  items = Array.from(new Set(items)).sort();
  el.innerHTML = items.length
    ? items.map(function(name){return '<label>'+
        '<input type="checkbox" value="'+name+'" '+(cur.indexOf(name)>-1?'checked':'')+' onchange="updateMFLabel(\'mfItem\',\'รายการ\');renderTx()">'+
        ' '+name+'</label>';}).join('')
    : '<div style="padding:8px 14px;font-size:12px;color:var(--ink3)">ไม่มีรายการ</div>';
}

function populateMFVendor(){
  var el = document.getElementById('mfVendorList');
  if(!el) return;
  var cur = getMFValues('mfVendor');
  el.innerHTML = vendorsData.length
    ? vendorsData.map(function(v){return '<label>'+
        '<input type="checkbox" value="'+v.id+'" '+(cur.indexOf(v.id)>-1?'checked':'')+' onchange="updateMFLabel(\'mfVendor\',\'ร้านค้า\');renderTx()">'+
        ' '+v.name+'</label>';}).join('')
    : '<div style="padding:8px 14px;font-size:12px;color:var(--ink3)">ยังไม่มีร้านค้า</div>';
}

function populateMFCat(){
  var el = document.getElementById('mfCatList');
  if(!el) return;
  var cur = getMFValues('mfCat');
  el.innerHTML = categories.map(function(c){return '<label>'+
    '<input type="checkbox" value="'+c.id+'" '+(cur.indexOf(c.id)>-1?'checked':'')+' onchange="updateMFLabel(\'mfCat\',\'หมวด\');populateMFItem();renderTx()">'+
    ' '+c.name+'</label>';}).join('');
}

function populateMFPerson(){
  var el = document.getElementById('mfPersonList');
  if(!el) return;
  var cur = getMFValues('mfPerson');
  el.innerHTML = persons.map(function(p){return '<label>'+
    '<input type="checkbox" value="'+p.id+'" '+(cur.indexOf(p.id)>-1?'checked':'')+' onchange="updateMFLabel(\'mfPerson\',\'คน\');renderTx()">'+
    ' '+p.name+'</label>';}).join('');
}

function resetFilters(){
  document.getElementById('fltMonth').value='';
  // Rebuild billing_month filter dropdown
  var fltBM = document.getElementById('fltBillingMonth');
  if (fltBM) { fltBM.value = ''; populateFltBillingMonth(fltBM); }
  document.querySelectorAll('.mf-dropdown input[type=checkbox]').forEach(function(cb){cb.checked=false;});
  [['mfType','ประเภท'],['mfCat','หมวด'],['mfItem','รายการ'],['mfVendor','ร้านค้า'],['mfStatus','สถานะ'],['mfPerson','คน']].forEach(function(pair){
    var id=pair[0], def=pair[1];
    var label=document.querySelector('#'+id+' .mf-label');
    if(label){ label.textContent=def+' ▾'; label.classList.remove('active'); }
  });
  renderTx();
}

/**
 * คืนรายการ transactions ที่ถูก filter อยู่ตาม UI ปัจจุบัน
 * (ใช้ตอน export CSV ของรายการที่กรอง)
 */
function getFilteredTx(){
  var fltM  = document.getElementById('fltMonth');
  var fltBM = document.getElementById('fltBillingMonth');
  var list  = db.slice();
  // transaction_date filter
  if(fltM  && fltM.value)  list = list.filter(function(e){ return e.date.startsWith(fltM.value); });
  // billing_month filter (v3)
  if(fltBM && fltBM.value){
    list = list.filter(function(e){
      var bm = e.billing_month || e.date.slice(0,7);
      return bm === fltBM.value;
    });
  }
  var ftypes   = getMFValues('mfType');
  if(ftypes.length)   list = list.filter(function(e){ return ftypes.indexOf(e.type)>-1; });
  var fcats    = getMFValues('mfCat');
  if(fcats.length)    list = list.filter(function(e){ return fcats.indexOf(e.cat_id)>-1; });
  var fitems   = getMFValues('mfItem');
  if(fitems.length)   list = list.filter(function(e){ return fitems.indexOf(e.desc)>-1; });
  var fstats   = getMFValues('mfStatus');
  if(fstats.length)   list = list.filter(function(e){ return fstats.indexOf(e.status)>-1; });
  var fpers    = getMFValues('mfPerson');
  if(fpers.length)    list = list.filter(function(e){ return fpers.indexOf(e.person)>-1; });
  var fvendors = getMFValues('mfVendor');
  if(fvendors.length) list = list.filter(function(e){ return fvendors.indexOf(e.vendor_id)>-1; });
  return list;
}

/** Populate billing_month <select> from unique values in db */
function populateFltBillingMonth(sel) {
  if (!sel) sel = document.getElementById('fltBillingMonth');
  if (!sel) return;
  var cur = sel.value;
  var months = Array.from(new Set(db.map(function(e){
    return e.billing_month || e.date.slice(0,7);
  }))).sort().reverse();
  sel.innerHTML = '<option value="">เดือนบิล (billing)</option>' +
    months.map(function(m){
      var parts = m.split('-').map(Number);
      return '<option value="'+m+'" '+(m===cur?'selected':'')+'>'+
             SHORT_M[parts[1]-1]+' '+(parts[0]+543)+'</option>';
    }).join('');
  if (cur) sel.value = cur;
}

function renderTx(){
  var n=names();
  var now = new Date();
  var thisM = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var months=Array.from(new Set(db.map(function(e){return e.date.substring(0,7);}))).sort().reverse();
  if(months.indexOf(thisM)===-1) months.unshift(thisM);
  var fltM=document.getElementById('fltMonth');
  // default to current month on first load
  if(!fltM._initialized){ fltM._initialized=true; fltM.value=thisM; }
  var curM=fltM.value;
  fltM.innerHTML=months.map(function(m){
    var parts=m.split('-').map(Number);
    var y=parts[0], mo=parts[1];
    return '<option value="'+m+'" '+(m===curM?'selected':'')+'>'+SHORT_M[mo-1]+' '+(y+543)+'</option>';
  }).join('');
  if(curM) fltM.value=curM;

  // always rebuild multi filters
  populateMFCat();
  populateMFPerson();
  populateMFVendor();
  populateFltBillingMonth();

  var list = db.slice();
  if(fltM.value) list=list.filter(function(e){return e.date.startsWith(fltM.value);});

  // billing_month filter (v3)
  var fltBM = document.getElementById('fltBillingMonth');
  if(fltBM && fltBM.value){
    list = list.filter(function(e){
      return (e.billing_month || e.date.slice(0,7)) === fltBM.value;
    });
  }

  var ftypes = getMFValues('mfType');
  if(ftypes.length) list=list.filter(function(e){return ftypes.indexOf(e.type)>-1;});

  var fcats = getMFValues('mfCat');
  if(fcats.length) list=list.filter(function(e){return fcats.indexOf(e.cat_id)>-1;});

  // rebuild item filter based on selected categories
  populateMFItem();

  var fitems = getMFValues('mfItem');
  if(fitems.length) list=list.filter(function(e){return fitems.indexOf(e.desc)>-1;});

  var fstats = getMFValues('mfStatus');
  if(fstats.length) list=list.filter(function(e){return fstats.indexOf(e.status)>-1;});

  var fpers = getMFValues('mfPerson');
  if(fpers.length) list=list.filter(function(e){return fpers.indexOf(e.person)>-1;});

  var fvendors = getMFValues('mfVendor');
  if(fvendors.length) list=list.filter(function(e){return fvendors.indexOf(e.vendor_id)>-1;});

  // Total bar
  var totalEl = document.getElementById('txTotal');
  if(totalEl && list.length){
    var inc  = list.filter(function(e){return e.type==='income' &&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
    var exp  = list.filter(function(e){return e.type==='expense'&&isPaid(e);}).reduce(function(s,e){return s+e.amt;},0);
    var pend = list.filter(function(e){return e.status==='pending';}).reduce(function(s,e){return s+e.amt;},0);
    totalEl.style.display='flex';
    totalEl.innerHTML=
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">รายรับ ('+list.filter(function(e){return e.type==='income'&&isPaid(e);}).length+')</div><div style="font-size:15px;font-weight:700;color:var(--green);font-family:monospace">'+fmt(inc)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">รายจ่าย ('+list.filter(function(e){return e.type==='expense'&&isPaid(e);}).length+')</div><div style="font-size:15px;font-weight:700;color:var(--red);font-family:monospace">'+fmt(exp)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">รอดำเนินการ ('+list.filter(function(e){return e.status==='pending';}).length+')</div><div style="font-size:15px;font-weight:700;color:var(--amber);font-family:monospace">'+fmt(pend)+'</div></div>'+
      '<div style="flex:1;min-width:110px"><div style="font-size:11px;color:var(--ink3)">สุทธิ ('+list.length+' รายการ)</div><div style="font-size:15px;font-weight:700;font-family:monospace;color:'+(inc-exp>=0?'var(--green)':'var(--red)')+'">'+fmt(inc-exp)+'</div></div>';
  } else if(totalEl){ totalEl.style.display='none'; }

  var isMobile = window.innerWidth <= 900;
  var revertBtn = function(e){ return '<button class="btn-revert" onclick="markPending(\''+e.id+'\')">'+
    '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM7.25 4v4.31l2.97 1.71-.75 1.3L5.75 9.1V4h1.5z"/></svg>'+
    ' คืนสถานะ'+
  '</button>'; };

  if(isMobile){
    document.getElementById('txContent').innerHTML = list.length
      ? list.map(function(e){return '<div class="swipe-row" id="srow-'+e.id+'">'+
          '<div class="swipe-actions">'+
            '<button class="sa-btn sa-edit" onclick="closeAllSwipe();openEdit(\''+e.id+'\')">'+
              '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-9.9 9.9-3.314.485.485-3.314 9.9-9.9z"/></svg>'+
              ' แก้ไข'+
            '</button>'+
            (isPaid(e)
              ? '<button class="sa-btn sa-status-paid" onclick="closeAllSwipe();markPending(\''+e.id+'\')">'+
                  '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm.75 4v4.5l2.7 1.56-.75 1.3L9.25 11V6h1.5z"/></svg>'+
                  ' คืนสถานะ'+
                '</button>'
              : '<button class="sa-btn sa-status-pending" onclick="closeAllSwipe();markPaid(\''+e.id+'\')">'+
                  '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>'+
                  ' ยืนยัน'+
                '</button>'
            )+
            '<button class="sa-btn sa-delete" onclick="closeAllSwipe();delConfirm(\''+e.id+'\')">'+
              '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2l1-1h6l1 1h4v2H2V2h4zm1 4h2v9H7V6zm4 0h2v9h-2V6zM3 5h14l-1 13H4L3 5z"/></svg>'+
              ' ลบ'+
            '</button>'+
          '</div>'+
          '<div class="swipe-content" id="sc-'+e.id+'">'+
            '<div style="padding:12px 12px 10px">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
                '<div style="flex:1;min-width:0">'+
                  '<div style="font-size:14px;font-weight:500;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e.desc+'</div>'+
                  '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap">'+
                    personPill(e.person)+
                    '<span style="font-size:11px;color:var(--ink3)">'+toThaiDateShort(e.date)+'</span>'+
                    '<span style="font-size:11px;color:var(--ink3)">'+(e.cat_name||'—')+'</span>'+
                    (e.vendor_id ? '<span style="font-size:11px;color:var(--ink3);background:var(--surface2);padding:1px 6px;border-radius:4px">'+(((vendorsData.find(function(v){return v.id===e.vendor_id;}))||{}).name||'—')+'</span>' : '')+
                  '</div>'+
                  (e.note ? '<div style="font-size:11px;color:var(--ink3);margin-top:3px;font-style:italic">📝 '+e.note+'</div>' : '')+
                '</div>'+
                '<div style="text-align:right;flex-shrink:0">'+
                  (isSalary(e) ?
                  '<div style="font-size:15px;font-weight:600;font-family:monospace;color:var(--green);display:flex;align-items:center;gap:4px;justify-content:flex-end">'+
                    '<span id="sal-'+e.id+'" style="filter:blur(5px);user-select:none;transition:filter .15s">+'+fmt(e.amt)+'</span>'+
                    '<button '+
                      'onpointerdown="revealSal(\''+e.id+'\')" '+
                      'onpointerup="hideSal(\''+e.id+'\')" '+
                      'onpointerleave="hideSal(\''+e.id+'\')" '+
                      'style="background:none;border:none;padding:2px;color:var(--ink3);cursor:pointer;touch-action:none">'+
                      '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 4C5 4 1.5 10 1.5 10S5 16 10 16s8.5-6 8.5-6S15 4 10 4zm0 9a3 3 0 110-6 3 3 0 010 6z"/></svg>'+
                    '</button>'+
                  '</div>' :
                  '<div style="font-size:15px;font-weight:600;font-family:monospace;color:'+(e.type==='income'?'var(--green)':'var(--red)')+'">'+
                    (e.type==='income'?'+':'−')+fmt(e.amt)+
                  '</div>')+
                  '<div style="margin-top:3px">'+
                    '<span class="badge '+(isPaid(e)?'badge-paid':'badge-pending')+'" style="font-size:10px">'+(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย'))+'</span>'+
                  '</div>'+
                '</div>'+
              '</div>'+
            '</div>'+
          '</div>'+
        '</div>';}).join('')
      : '<div class="empty">ไม่พบรายการ</div>';

    // ── Swipe via event delegation on container ───────────────
    // Bound ONCE on container — survives re-renders from pull/add/edit
    var SWIPE_W = 200;
    var container = document.getElementById('txContent');
    if(!container) return;

    // Remove old delegated handler if exists, then re-add
    if(container._swipeHandler){
      container.removeEventListener('touchstart', container._swipeHandler, {passive:true});
      container.removeEventListener('touchmove',  container._swipeMoveHandler);
      container.removeEventListener('touchend',   container._swipeEndHandler, {passive:true});
      container.removeEventListener('touchcancel',container._swipeCancelHandler, {passive:true});
    }

    var _sc=null, _sx=0, _sy=0, _cx=0, _cy=0, _axis=null, _active=false;

    function getSwipeContent(target){
      return target.closest('.swipe-content');
    }

    container._swipeHandler = function(ev){
      var sc = getSwipeContent(ev.target);
      if(!sc) return;
      // init _open every time — works for new renders and pulled data
      if(sc._open === undefined) sc._open = false;
      _sc=sc; _active=true;
      _sx=_cx=ev.touches[0].clientX;
      _sy=_cy=ev.touches[0].clientY;
      _axis=null;
    };

    container._swipeMoveHandler = function(ev){
      if(!_active||!_sc) return;
      _cx=ev.touches[0].clientX;
      _cy=ev.touches[0].clientY;
      var dx=_cx-_sx, dy=_cy-_sy;
      if(!_axis && (Math.abs(dx)>5||Math.abs(dy)>5)){
        _axis=Math.abs(dx)>=Math.abs(dy)?'h':'v';
      }
      if(_axis==='h'){
        ev.preventDefault();
        var base=_sc._open?-SWIPE_W:0;
        var clamped=Math.max(-SWIPE_W,Math.min(0,base+dx));
        _sc.style.transition='none';
        _sc.style.transform='translateX('+clamped+'px)';
      } else if(_axis==='v'){
        if(_sc._open){
          _sc.style.transition='transform .2s cubic-bezier(.4,0,.2,1)';
          _sc.style.transform='translateX(0)';
          _sc._open=false;
          if(_swipeOpenSc===_sc) _swipeOpenSc=null;
        }
        _active=false; _sc=null;
      }
    };

    container._swipeEndHandler = function(){
      if(!_active||!_sc){ _active=false; return; }
      _active=false;
      if(_axis!=='h'){ _axis=null; _sc=null; return; }
      var dx=_cx-_sx;
      var sc=_sc; _sc=null;
      sc.style.transition='transform .25s cubic-bezier(.4,0,.2,1)';
      if(!sc._open){
        if(dx < -50){
          if(_swipeOpenSc&&_swipeOpenSc!==sc){
            _swipeOpenSc.style.transition='transform .25s cubic-bezier(.4,0,.2,1)';
            _swipeOpenSc.style.transform='translateX(0)';
            _swipeOpenSc._open=false;
          }
          sc.style.transform='translateX(-'+SWIPE_W+'px)';
          sc._open=true; _swipeOpenSc=sc;
        } else { sc.style.transform='translateX(0)'; }
      } else {
        if(dx>40){
          sc.style.transform='translateX(0)';
          sc._open=false; if(_swipeOpenSc===sc) _swipeOpenSc=null;
        } else { sc.style.transform='translateX(-'+SWIPE_W+'px)'; }
      }
      _axis=null;
    };

    container._swipeCancelHandler = function(){
      if(!_sc){ _active=false; return; }
      var sc=_sc; _sc=null; _active=false; _axis=null;
      sc.style.transition='transform .15s';
      sc.style.transform=sc._open?('translateX(-'+SWIPE_W+'px)'):'translateX(0)';
    };

    container.addEventListener('touchstart', container._swipeHandler,      {passive:true});
    container.addEventListener('touchmove',  container._swipeMoveHandler,  {passive:false});
    container.addEventListener('touchend',   container._swipeEndHandler,   {passive:true});
    container.addEventListener('touchcancel',container._swipeCancelHandler,{passive:true});

    // bind .main scroll (removeEventListener safe — same named fn)
    var mainEl = document.querySelector('.main');
    if(mainEl){ mainEl.removeEventListener('scroll',_swipeScrollClose); mainEl.addEventListener('scroll',_swipeScrollClose,{passive:true}); }

  } else {
    document.getElementById('txContent').innerHTML = list.length ? '<table>'+
      '<tr><th>วันที่</th><th>รายการ</th><th>หมวด</th><th>ร้านค้า</th><th>ผู้บันทึก</th><th>หาร2</th><th style="text-align:right">จำนวน (บาท)</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr>'+
      list.map(function(e){return '<tr class="tx-row" id="row-'+e.id+'" onclick="openEdit(\''+e.id+'\')">'+
        '<td style="font-size:12px;color:var(--ink3);white-space:nowrap">'+toThaiDateShort(e.date)+'</td>'+
        '<td>'+e.desc+' <span class="edit-hint">✎ แก้ไข</span></td>'+
        '<td style="font-size:12px;color:var(--ink3)">'+(e.cat_name||'—')+'</td>'+
        '<td style="font-size:12px;color:var(--ink3)">'+(e.vendor_id ? (((vendorsData.find(function(v){return v.id===e.vendor_id;}))||{}).name||'—') : '—')+'</td>'+
        '<td>'+(e.type==='expense'?'<span class="badge '+(e.split?'badge-split':'badge-personal')+'">'+(e.split?'÷2':'ส่วนตัว')+'</span>':'-')+'</td>'+
        '<td style="text-align:right;font-family:monospace;font-weight:500;color:'+(e.type==='income'?'var(--green)':'var(--red)')+'">'+fmt(e.amt)+'</td>'+
        '<td><span class="badge '+(isPaid(e)?'badge-paid':'badge-pending')+'">'+(isPaid(e)?(e.type==='income'?'รับแล้ว':'จ่ายแล้ว'):(e.type==='income'?'รอรับ':'รอจ่าย'))+'</span></td>'+
        '<td style="font-size:11px;color:var(--ink3);font-style:italic">'+(e.note||'—')+'</td>'+
        '<td style="white-space:nowrap;display:flex;gap:4px;align-items:center" onclick="event.stopPropagation()">'+
          (e.status==='pending'
            ? '<button class="btn btn-confirm" onclick="markPaid(\''+e.id+'\')">✓ ยืนยัน</button>'
            : revertBtn(e)
          )+
          '<button class="btn btn-del" id="del-'+e.id+'" onclick="delStep1(\''+e.id+'\')">ลบ</button>'+
        '</td>'+
      '</tr>';}).join('')+
    '</table>' : '<div class="empty">ไม่พบรายการ</div>';
  }
}

// ─── MARK / DELETE ────────────────────────────────────────
function markPaid(id){
  if(!checkOnlineForAction()) return;
  var sid=String(id);
  var e=db.find(function(x){return String(x.id)===sid;});
  if(e){ e.status=doneStatus(e.type); sbUpdate(e); }
  save(); renderDash(); renderTx();
}
function markPending(id){
  if(!checkOnlineForAction()) return;
  var sid=String(id);
  var e=db.find(function(x){return String(x.id)===sid;});
  if(e){ e.status='pending'; sbUpdate(e); }
  save(); renderDash(); renderTx();
}
function delStep1(id){
  var btn=document.getElementById('del-'+id);
  if(!btn) return;
  btn.textContent='ยืนยันลบ?';
  btn.style.background='var(--red)';
  btn.style.color='#fff';
  btn.style.borderColor='var(--red)';
  btn.onclick=function(){ delConfirm(id); };
  setTimeout(function(){
    if(document.getElementById('del-'+id)){
      btn.textContent='ลบ';
      btn.style.background='';btn.style.color='';btn.style.borderColor='';
      btn.onclick=function(){ delStep1(id); };
    }
  },3000);
}

var _lastDeleted = null;
var _undoTimer = null;
var _delTimer = null; // delayed sbDelete — runs after undo window closes

function delConfirm(id){
  if(!checkOnlineForAction()) return;
  var entry = db.find(function(e){return String(e.id)===String(id);});
  if(!entry) return;

  // cancel any pending real delete from previous action
  clearTimeout(_delTimer);
  if(_lastDeleted && _lastDeleted._pendingDelete){
    sbDelete(_lastDeleted.id);
    if(_lastDeleted._pairId) sbDelete(_lastDeleted._pairId);
  }

  // ถ้าเป็น transfer — ลบ entry คู่พร้อมกัน (atomic)
  var pairId    = entry.transfer_pair_id || null;
  var pairEntry = pairId ? db.find(function(e){ return String(e.id)===String(pairId); }) : null;

  _lastDeleted = Object.assign({}, entry, {
    _pendingDelete: true,
    _pairId:   pairId,
    _pairSnap: pairEntry ? Object.assign({}, pairEntry) : null,
  });

  var idsToRemove = [String(id)];
  if(pairId) idsToRemove.push(String(pairId));
  db = db.filter(function(e){ return idsToRemove.indexOf(String(e.id)) === -1; });
  save(); renderTx(); renderDash();
  if(typeof renderAccountCards==='function') renderAccountCards();

  var msg = entry.type === 'transfer'
    ? 'ลบการโอนเงิน "' + entry.desc + '" แล้ว (ทั้งคู่)'
    : 'ลบ "' + entry.desc + '" แล้ว';
  showUndoToast(msg);

  _delTimer = setTimeout(function(){
    if(_lastDeleted && _lastDeleted.id === entry.id){
      sbDelete(entry.id);
      if(_lastDeleted._pairId) sbDelete(_lastDeleted._pairId);
      _lastDeleted = null;
    }
  }, 5200);
}

function showUndoToast(msg){
  var t = document.getElementById('undoToast');
  if(!t){
    t = document.createElement('div'); t.id='undoToast';
    t.style.cssText = [
      'position:fixed',
      'bottom:calc(env(safe-area-inset-bottom,0px) + 80px)',
      'left:50%;transform:translateX(-50%)',
      'background:#1a1a1a;color:#fff',
      'padding:12px 16px',
      'border-radius:16px',
      'font-size:13px;font-family:Sarabun,sans-serif',
      'z-index:999',
      'display:flex;align-items:center;gap:12px',
      'box-shadow:0 4px 20px rgba(0,0,0,.35)',
      'transition:opacity .3s,transform .3s',
      'min-width:240px;max-width:calc(100vw - 40px)',
    ].join(';');
    document.body.appendChild(t);
  }

  t.innerHTML =
    '<div style="flex:1;min-width:0">'+
      '<div style="font-weight:600;margin-bottom:2px">'+msg+'</div>'+
      '<div style="font-size:11px;color:rgba(255,255,255,.55)">จะลบถาวรใน 5 วินาที</div>'+
      '<div style="height:3px;background:rgba(255,255,255,.15);border-radius:2px;margin-top:6px;overflow:hidden">'+
        '<div id="undoProgress" style="height:100%;background:var(--green);border-radius:2px;width:100%;transition:width 5s linear"></div>'+
      '</div>'+
    '</div>'+
    '<button onclick="undoDelete()" style="'+
      'background:var(--green);color:#fff;border:none;'+
      'border-radius:12px;padding:8px 14px;'+
      'font-size:13px;font-weight:600;cursor:pointer;'+
      'font-family:Sarabun,sans-serif;'+
      'white-space:nowrap;flex-shrink:0;'+
      'min-height:40px;touch-action:manipulation'+
    '">↩ คืนค่า</button>';

  t.style.opacity='1';
  t.style.transform='translateX(-50%) translateY(0)';

  // animate progress bar
  requestAnimationFrame(function(){
    var bar = document.getElementById('undoProgress');
    if(bar){ bar.style.width='100%'; setTimeout(function(){ bar.style.width='0%'; },50); }
  });

  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(function(){
    t.style.opacity='0';
    t.style.transform='translateX(-50%) translateY(8px)';
  }, 5000);
}

function undoDelete(){
  if(!_lastDeleted) return;
  clearTimeout(_undoTimer);
  clearTimeout(_delTimer); // cancel the pending DB delete

  var restored = Object.assign({}, _lastDeleted);
  var pairId   = restored._pairId || null;
  var pairSnap = restored._pairSnap || null;
  delete restored._pendingDelete;
  delete restored._pairId;
  delete restored._pairSnap;
  _lastDeleted = null;

  db.unshift(restored);
  // Restore the paired transfer entry too (if any)
  if(pairSnap){
    db.unshift(pairSnap);
  }
  save(); renderTx(); renderDash();
  if(typeof renderAccountCards==='function') renderAccountCards();

  var t = document.getElementById('undoToast');
  if(t){
    t.style.opacity='0';
    t.style.transform='translateX(-50%) translateY(8px)';
  }
  var msg = pairId
    ? 'คืนค่าการโอนเงิน "'+restored.desc+'" แล้ว (ทั้งคู่)'
    : 'คืนค่า "'+restored.desc+'" แล้ว';
  showRestoreToast(msg);
}

var _restoreTimer = null;
function showRestoreToast(msg){
  var t = document.getElementById('restoreToast');
  if(!t){
    t = document.createElement('div'); t.id='restoreToast';
    t.style.cssText = [
      'position:fixed',
      'bottom:calc(env(safe-area-inset-bottom,0px) + 80px)',
      'left:50%;transform:translateX(-50%)',
      'background:#1a7a4a;color:#fff',
      'padding:10px 18px;border-radius:16px',
      'font-size:13px;font-weight:600;font-family:Sarabun,sans-serif',
      'z-index:999;white-space:nowrap',
      'box-shadow:0 4px 16px rgba(0,0,0,.25)',
      'transition:opacity .3s',
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent = '✓ '+msg;
  t.style.opacity='1';
  clearTimeout(_restoreTimer);
  _restoreTimer = setTimeout(function(){ t.style.opacity='0'; }, 3000);
}

// ─── EXPORT CSV ───────────────────────────────────────────
// NOTE: definition lives in supabase.js (later override wins)
//       and a richer filtered version is in features.js (exportFilteredCSV)
