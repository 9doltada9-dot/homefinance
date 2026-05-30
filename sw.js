/* HomeFinance · Service Worker · v3.16.60
 * กลยุทธ์:
 *   - Static asset (HTML, CSS, JS, fonts, Chart.js): cache-first → ใช้งาน offline ได้
 *   - Supabase API call: network-first → ดึงข้อมูลล่าสุดเสมอ ถ้าไม่มี net ใช้ของเก่า
 *
 * NOTE: เปลี่ยน CACHE_VERSION ทุกครั้งที่ deploy ใหม่ เพื่อให้ user ได้ของใหม่
 */
const CACHE_VERSION = 'hf-v3.16.60';
const STATIC_CACHE  = CACHE_VERSION + '-static';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/base.css',
  './assets/css/layout.css',
  './assets/css/components.css',
  './assets/css/responsive.css',
  './assets/css/glass-overlay.css',
  './assets/js/config.js',
  './assets/js/storage.js',
  './assets/js/utils.js',
  './assets/js/nav.js',
  './assets/js/salary.js',
  './assets/js/favorites.js',
  './assets/js/notes.js',
  './assets/js/persons.js',
  './assets/js/categories.js',
  './assets/js/items.js',
  './assets/js/vendors.js',
  './assets/js/form.js',
  './assets/js/edit.js',
  './assets/js/transactions.js',
  './assets/js/dashboard.js',
  './assets/js/settlement.js',
  './assets/js/monthly.js',
  './assets/js/budget.js',
  './assets/js/settings.js',
  './assets/js/supabase.js',
  './assets/js/autocomplete.js',
  './assets/js/icons.js',
  './assets/js/glassSettings.js',
  // v3 modules
  './assets/js/cycleEngine.js',
  './assets/js/balanceEngine.js',
  './assets/js/forecastEngine.js',
  './assets/js/accounts.js',
  './assets/js/savingsGoals.js',
  './assets/js/notificationEngine.js',
  './assets/js/recurringEngine.js',
  './assets/js/features.js',
  // v3.2 auth modules
  './assets/js/auth.js',
  './assets/js/report.js',
  './assets/js/app.js',
];

// ─── INSTALL: precache shell ──────────────────────────────
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache){
      return cache.addAll(PRECACHE_URLS).catch(function(err){
        console.warn('[sw] precache partial:', err && err.message);
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

// ─── ACTIVATE: ลบ cache เก่า + บังคับ reload ทุก client ──
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k.indexOf('hf-') === 0 && k !== STATIC_CACHE) return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    }).then(function(){
      // บังคับให้ทุก client โหลดใหม่เพื่อใช้ไฟล์ version ใหม่
      return self.clients.matchAll({ type: 'window' });
    }).then(function(clients){
      clients.forEach(function(client){
        client.navigate(client.url);
      });
    })
  );
});

// ─── FETCH: route ตาม URL ─────────────────────────────────
self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Supabase API → network-first
  if (url.hostname.indexOf('supabase') !== -1){
    event.respondWith(
      fetch(req).then(function(res){ return res; })
        .catch(function(){ return caches.match(req); })
    );
    return;
  }

  // Static (same-origin หรือ CDN ที่ precache) → cache-first
  event.respondWith(
    caches.match(req).then(function(cached){
      if (cached) return cached;
      return fetch(req).then(function(res){
        if (res && res.ok && url.origin === location.origin){
          var copy = res.clone();
          caches.open(STATIC_CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});