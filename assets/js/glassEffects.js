/* HomeFinance · glassEffects.js — Card tap ripple + Glass shatter close */

/* ── CSS animations ─────────────────────────────────────── */
(function(){
  var s = document.createElement('style');
  s.textContent = [
    '@keyframes gfRipple{0%{transform:scale(0);opacity:.5}100%{transform:scale(2.5);opacity:0}}',
    '@keyframes gfCardOpen{0%{transform:scale(1)}40%{transform:scale(.97)}100%{transform:scale(1)}}',
    '.gf-ripple{position:absolute;inset:0;border-radius:inherit;background:rgba(99,102,241,.18);',
    '  transform-origin:center;animation:gfRipple .35s ease-out forwards;pointer-events:none}',
    '.tx-card-row{position:relative;overflow:hidden}',
  ].join('');
  document.head.appendChild(s);
})();

/* ── 1) Card tap ripple ────────────────────────────────── */
function gfCardTap(el, cb) {
  var r = document.createElement('div');
  r.className = 'gf-ripple';
  el.appendChild(r);
  el.style.animation = 'gfCardOpen .25s ease';
  setTimeout(function(){
    r.remove();
    el.style.animation = '';
    if (cb) cb();
  }, 200);
}

/* ── 2) Glass shatter close ────────────────────────────── */
function gfShatter(overlayEl, onDone) {
  var box = overlayEl ? overlayEl.querySelector('div') : null;
  if (!box) { if (onDone) onDone(); return; }

  var rect = box.getBoundingClientRect();
  var W = rect.width, H = rect.height;
  var L = rect.left,  T = rect.top;

  /* Shard definitions: [polygon points as %], [dx,dy,rot] destination */
  var shards = [
    { pts:'0 0,38 0,22 45',        dx:-110, dy:-130, r:-50 },
    { pts:'38 0,65 0,52 38',       dx:  10, dy:-170, r: 20 },
    { pts:'65 0,100 0,78 42',      dx: 120, dy:-110, r: 55 },
    { pts:'0 0,22 45,0 55',        dx:-160, dy: -30, r:-35 },
    { pts:'22 45,52 38,42 68',     dx: -50, dy:  30, r:-20 },
    { pts:'52 38,78 42,62 70',     dx:  55, dy:  25, r: 25 },
    { pts:'78 42,100 0,100 55',    dx: 150, dy: -20, r: 40 },
    { pts:'0 55,22 45,30 80',      dx:-130, dy: 100, r:-65 },
    { pts:'42 68,62 70,50 100',    dx:  10, dy: 140, r: 30 },
    { pts:'100 55,78 42,70 80',    dx: 130, dy:  95, r: 60 },
    { pts:'0 100,30 80,50 100',    dx: -90, dy: 130, r:-40 },
    { pts:'50 100,70 80,100 100',  dx:  90, dy: 125, r: 45 },
    { pts:'30 80,42 68,50 100',    dx: -10, dy: 110, r:-15 },
    { pts:'22 45,42 68,30 80',     dx: -70, dy:  70, r: 30 },
    { pts:'62 70,78 42,70 80',     dx:  80, dy:  70, r:-30 },
  ];

  /* Container */
  var cont = document.createElement('div');
  cont.style.cssText = 'position:fixed;inset:0;z-index:'+(parseInt(overlayEl.style.zIndex||3000)+10)+';pointer-events:none;overflow:hidden';

  /* Crack overlay — SVG lines */
  var cx = L + W/2, cy = T + H/2;
  var svg = '<svg style="position:absolute;left:'+L+'px;top:'+T+'px;width:'+W+'px;height:'+H+'px;'
    +'pointer-events:none;opacity:0;transition:opacity .05s" id="gfCracks">'
    +'<line x1="50%" y1="50%" x2="5%"  y2="0%"  stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>'
    +'<line x1="50%" y1="50%" x2="40%" y2="0%"  stroke="rgba(255,255,255,.8)" stroke-width="1"/>'
    +'<line x1="50%" y1="50%" x2="85%" y2="0%"  stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>'
    +'<line x1="50%" y1="50%" x2="0%"  y2="45%" stroke="rgba(255,255,255,.8)" stroke-width="1"/>'
    +'<line x1="50%" y1="50%" x2="100%" y2="35%" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>'
    +'<line x1="50%" y1="50%" x2="10%" y2="100%" stroke="rgba(255,255,255,.8)" stroke-width="1"/>'
    +'<line x1="50%" y1="50%" x2="55%" y2="100%" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>'
    +'<line x1="50%" y1="50%" x2="95%" y2="90%" stroke="rgba(255,255,255,.8)" stroke-width="1"/>'
    +'</svg>';
  cont.innerHTML = svg;

  /* Shards */
  shards.forEach(function(sh) {
    var pts = sh.pts.split(',').map(function(p){
      var xy = p.trim().split(' ');
      return (parseFloat(xy[0])/100*W)+'px '+(parseFloat(xy[1])/100*H)+'px';
    }).join(',');

    var d = document.createElement('div');
    d.style.cssText = [
      'position:absolute',
      'left:'+L+'px','top:'+T+'px',
      'width:'+W+'px','height:'+H+'px',
      'background:rgba(255,255,255,.78)',
      'backdrop-filter:blur(20px) saturate(160%)',
      '-webkit-backdrop-filter:blur(20px) saturate(160%)',
      'border:1px solid rgba(255,255,255,.6)',
      'clip-path:polygon('+pts+')',
      'will-change:transform,opacity',
      'transition:transform .38s cubic-bezier(.2,.1,.6,1),opacity .32s ease',
    ].join(';');
    cont.appendChild(d);

    requestAnimationFrame(function(){ requestAnimationFrame(function(){
      d.style.transform = 'translate('+sh.dx+'px,'+sh.dy+'px) rotate('+sh.r+'deg) scale(.4)';
      d.style.opacity   = '0';
    }); });
  });

  document.body.appendChild(cont);

  /* Flash cracks briefly, then hide modal, then clean up */
  var cracks = cont.querySelector('#gfCracks');
  if (cracks) { requestAnimationFrame(function(){ cracks.style.opacity='1'; setTimeout(function(){ cracks.style.opacity='0'; }, 80); }); }

  overlayEl.style.transition = 'opacity .05s';
  overlayEl.style.opacity    = '0';

  setTimeout(function(){
    cont.remove();
    if (onDone) onDone();
  }, 420);
}
