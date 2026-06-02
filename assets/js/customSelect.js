/* HomeFinance · customSelect.js — replaces native <select> with glass dropdown */
(function(w,d){
  'use strict';

  var _openWrap = null;   // currently open wrapper div
  var _pollList = [];     // [{sel, syncFn, lastVal}] for programmatic value detection

  // ── Close open panel on outside click ──────────────────────
  d.addEventListener('click', function(){ _closeAll(); }, true);
  d.addEventListener('keydown', function(e){
    if(e.key==='Escape') _closeAll();
  });

  function _closeAll(){
    if(!_openWrap) return;
    var p = _openWrap.querySelector('.csd-panel');
    var b = _openWrap.querySelector('.csd-btn');
    if(p) p.classList.remove('open');
    if(b) b.classList.remove('open');
    _openWrap = null;
  }

  // ── Wrap one <select> ───────────────────────────────────────
  function wrapSelect(sel){
    if(sel._csd) return;                    // already wrapped
    if(sel.style.display === 'none') return; // internal hidden select (fltYear etc.)
    sel._csd = true;

    var chip = sel.classList.contains('hf-chip') || sel.classList.contains('hf-pill-select');

    /* wrapper div */
    var wrap = d.createElement('div');
    wrap.className = 'csd-wrap' + (chip ? ' csd-chip' : '');

    /* copy layout styles to wrapper (not visual styles) */
    var layoutProps = ['flex','flexShrink','flexGrow','minWidth','width','maxWidth',
                       'marginTop','marginBottom','marginLeft','marginRight'];
    layoutProps.forEach(function(p){
      if(sel.style[p]) wrap.style[p] = sel.style[p];
    });
    /* forward any explicit flex:1 written as shorthand */
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

    /* dropdown panel */
    var panel = d.createElement('div');
    panel.className = 'csd-panel';

    wrap.appendChild(btn);
    wrap.appendChild(panel);

    /* insert wrap, then move select inside (hidden) */
    if(sel.parentNode) sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.style.cssText += ';display:none!important;position:absolute!important;';

    /* ── rebuild panel from select.options ── */
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
        el.addEventListener('mousedown', function(e){
          e.preventDefault(); e.stopPropagation();
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

    /* toggle panel on button click */
    btn.addEventListener('mousedown', function(e){
      e.preventDefault(); e.stopPropagation();
      var isOpen = panel.classList.contains('open');
      _closeAll();
      if(!isOpen){
        panel.classList.add('open');
        btn.classList.add('open');
        _openWrap = wrap;
      }
    });

    /* keyboard support */
    btn.addEventListener('keydown', function(e){
      if(e.key==='Enter'||e.key===' '){
        e.preventDefault();
        btn.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      } else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault();
        var items = Array.from(panel.querySelectorAll('.csd-item:not(.csd-dis)'));
        if(!items.length) return;
        var cur = items.findIndex(function(el){ return el.dataset.v === sel.value; });
        var next = e.key==='ArrowDown' ? Math.min(cur+1, items.length-1) : Math.max(cur-1, 0);
        items[next].dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      }
    });

    /* MutationObserver — detects when options are dynamically added */
    new MutationObserver(function(){ rebuild(); }).observe(sel, {
      childList: true, subtree: true
    });

    /* register for polling (catch programmatic sel.value = 'x') */
    _pollList.push({ sel:sel, sync:syncLabel, last:'' });

    rebuild();
  }

  /* ── Poll for programmatic value changes (every 80ms) ─────── */
  setInterval(function(){
    for(var i=0;i<_pollList.length;i++){
      var e = _pollList[i];
      if(e.sel.value !== e.last){
        e.last = e.sel.value;
        e.sync();
      }
    }
  }, 80);

  /* ── Apply to all qualifying selects in container ─────────── */
  function applyAll(root){
    (root||d).querySelectorAll('select').forEach(function(s){
      if(!s._csd && s.style.display !== 'none') wrapSelect(s);
    });
  }

  /* ── Watch for dynamically created selects (budget, vendor edit…) */
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(function(n){
        if(n.nodeType!==1) return;
        if(n.tagName==='SELECT') wrapSelect(n);
        else if(n.querySelectorAll) n.querySelectorAll('select').forEach(wrapSelect);
      });
    });
  }).observe(d.documentElement, {childList:true, subtree:true});

  /* ── Initial + delayed passes (wait for async data + render) ─ */
  [50, 350, 900, 2500].forEach(function(t){
    setTimeout(function(){ applyAll(); }, t);
  });

  /* expose for manual call after custom renders */
  w._csApply = applyAll;

})(window, document);
