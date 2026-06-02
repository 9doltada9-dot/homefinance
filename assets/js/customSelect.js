/* HomeFinance · customSelect.js — glass dropdown (portal rendering)
   Panel ต่อที่ <body> โดยตรง เพื่อหลีก CSS compositing layer ของ glass card
   ทำให้ backdrop-filter เห็น orb background เหมือน glass settings panel */
(function(w,d){
  'use strict';

  var _openBtn   = null;   // trigger button ที่เปิดอยู่
  var _openPanel = null;   // panel ที่เปิดอยู่ (attached to body)
  var _pollList  = [];     // [{sel, syncFn, lastVal}]

  // ── Close panel when clicking outside ──────────────────────
  d.addEventListener('click', function(e){
    if(_openPanel && _openBtn &&
       !_openPanel.contains(e.target) &&
       !_openBtn.closest('.csd-wrap').contains(e.target)){
      _closeAll();
    }
  });
  d.addEventListener('keydown', function(e){
    if(e.key==='Escape') _closeAll();
  });
  // Close on scroll / resize (reposition would be complex)
  w.addEventListener('scroll', _closeAll, true);
  w.addEventListener('resize', _closeAll);

  function _closeAll(){
    if(_openPanel){
      _openPanel.classList.remove('open');
      _openPanel = null;
    }
    if(_openBtn){
      _openBtn.classList.remove('open');
      _openBtn = null;
    }
  }

  // ── Position panel over trigger (fixed coords) ─────────────
  function _positionPanel(btn, panel){
    var rect = btn.getBoundingClientRect();
    var vw   = w.innerWidth;
    var vh   = w.innerHeight;

    // ความกว้าง: อย่างน้อยเท่า button, ไม่เกิน viewport
    var pw = Math.max(rect.width, 180);
    pw = Math.min(pw, vw - 16);

    // ตำแหน่ง left: ถ้าชนขอบขวาให้ชิดขวา
    var left = rect.left;
    if(left + pw > vw - 8) left = vw - pw - 8;
    if(left < 8) left = 8;

    // วัด panel height จริง (off-screen) เพื่อตัดสินใจทิศทางเปิด
    panel.style.position   = 'fixed';
    panel.style.top        = '-9999px';
    panel.style.left       = '-9999px';
    panel.style.visibility = 'hidden';
    panel.style.display    = 'block';
    var panelH = Math.min(panel.offsetHeight + 2, 280);
    panel.style.display    = '';
    panel.style.visibility = '';

    // ตำแหน่ง top: เปิดลงล่าง ถ้าไม่พอให้เปิดขึ้นบน
    var topDown = rect.bottom + 4;
    var topUp   = rect.top - 4;
    // เปิดขึ้นบนถ้า panel จะล้นหรือใกล้ขอบล่าง viewport (margin 24px)
    var showUp  = topDown + panelH > vh - 24 && rect.top > panelH + 8;

    panel.style.position  = 'fixed';
    panel.style.left      = left + 'px';
    panel.style.minWidth  = pw + 'px';
    panel.style.maxWidth  = Math.min(pw * 1.5, 400) + 'px';
    panel.style.zIndex    = '99999';

    if(showUp){
      panel.style.top    = '';
      panel.style.bottom = (vh - topUp) + 'px';
      panel.style.maxHeight = Math.min(topUp - 8, 260) + 'px';
    } else {
      panel.style.bottom    = '';
      panel.style.top       = topDown + 'px';
      panel.style.maxHeight = Math.min(vh - topDown - 8, 260) + 'px';
    }
  }

  // ── Wrap one <select> ───────────────────────────────────────
  function wrapSelect(sel){
    if(sel._csd) return;
    if(sel.style.display === 'none') return;
    sel._csd = true;

    var chip = sel.classList.contains('hf-chip') || sel.classList.contains('hf-pill-select');

    /* wrapper */
    var wrap = d.createElement('div');
    wrap.className = 'csd-wrap' + (chip ? ' csd-chip' : '');
    var layoutProps = ['flex','flexShrink','flexGrow','minWidth','width','maxWidth',
                       'marginTop','marginBottom','marginLeft','marginRight'];
    layoutProps.forEach(function(p){ if(sel.style[p]) wrap.style[p] = sel.style[p]; });
    if(sel.style.flex) wrap.style.flex = sel.style.flex;

    /* trigger button */
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'csd-btn';
    btn.setAttribute('tabindex','0');

    var lbl = d.createElement('span');
    lbl.className = 'csd-lbl';
    btn.appendChild(lbl);

    var arrow = d.createElement('span');
    arrow.className = 'csd-arrow';
    arrow.textContent = '▾';
    btn.appendChild(arrow);

    wrap.appendChild(btn);

    /* panel — ต่อที่ body โดยตรง (portal) */
    var panel = d.createElement('div');
    panel.className = 'csd-panel';
    d.body.appendChild(panel);

    /* insert wrap before select, hide select */
    if(sel.parentNode) sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.style.cssText += ';display:none!important;position:absolute!important;';

    /* ── rebuild items ── */
    function rebuild(){
      panel.innerHTML = '';
      Array.from(sel.children).forEach(function(child){
        if(child.tagName === 'OPTGROUP'){
          var gl = d.createElement('div');
          gl.className = 'csd-group';
          gl.textContent = child.label;
          panel.appendChild(gl);
          Array.from(child.children).forEach(function(o){ panel.appendChild(makeItem(o)); });
        } else if(child.tagName === 'OPTION'){
          panel.appendChild(makeItem(child));
        }
      });
      syncLabel();
    }

    function makeItem(o){
      var el = d.createElement('div');
      el.className = 'csd-item'+(o.value===sel.value?' csd-sel':'')+(o.disabled?' csd-dis':'');
      el.dataset.v = o.value;
      el.textContent = o.text || o.label || '';
      if(!o.disabled){
        el.addEventListener('click', function(e){
          e.stopPropagation();
          sel.value = o.value;
          sel.dispatchEvent(new Event('change',{bubbles:true}));
          _closeAll();
          rebuild();
        });
      }
      return el;
    }

    function syncLabel(){
      var o = sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      lbl.textContent = o ? (o.text || '') : '—';
      panel.querySelectorAll('.csd-item').forEach(function(el){
        el.classList.toggle('csd-sel', el.dataset.v === sel.value);
      });
    }

    /* toggle */
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var isOpen = _openPanel === panel;
      _closeAll();
      if(!isOpen){
        _positionPanel(btn, panel);
        panel.classList.add('open');
        btn.classList.add('open');
        _openBtn   = btn;
        _openPanel = panel;
      }
    });

    /* keyboard */
    btn.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault(); e.stopPropagation();
        btn.click();
      } else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();
        var items = Array.from(panel.querySelectorAll('.csd-item:not(.csd-dis)'));
        if(!items.length) return;
        var cur = items.findIndex(function(el){ return el.dataset.v === sel.value; });
        var next = e.key==='ArrowDown' ? Math.min(cur+1,items.length-1) : Math.max(cur-1,0);
        items[next].click();
      }
    });

    /* observe option changes */
    new MutationObserver(function(){ rebuild(); }).observe(sel, {childList:true, subtree:true});

    /* poll for programmatic value changes */
    _pollList.push({ sel:sel, sync:syncLabel, last:'' });

    rebuild();
  }

  /* ── Poll every 80ms ─────────────────────────────────────── */
  setInterval(function(){
    for(var i=0;i<_pollList.length;i++){
      var e = _pollList[i];
      if(e.sel.value !== e.last){ e.last=e.sel.value; e.sync(); }
    }
  }, 80);

  /* ── Apply to all qualifying selects ─────────────────────── */
  function applyAll(root){
    (root||d).querySelectorAll('select').forEach(function(s){
      if(!s._csd && s.style.display !== 'none') wrapSelect(s);
    });
  }

  /* ── Watch for dynamically created selects ────────────────── */
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType!==1) return;
        if(n.tagName==='SELECT') wrapSelect(n);
        else if(n.querySelectorAll) n.querySelectorAll('select').forEach(wrapSelect);
      });
    });
  }).observe(d.documentElement, {childList:true, subtree:true});

  /* ── Initial passes ───────────────────────────────────────── */
  [50, 350, 900, 2500].forEach(function(t){ setTimeout(applyAll, t); });

  w._csApply = applyAll;

})(window, document);
