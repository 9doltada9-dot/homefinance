/* HomeFinance ยท Service Worker ยท v3.18.70
 * เธเธฅเธขเธธเธ—เธเน:
 *   - Static asset (HTML, CSS, JS, fonts, Chart.js): cache-first โ’ เนเธเนเธเธฒเธ offline เนเธ”เน
 *   - Supabase API call: network-first โ’ เธ”เธถเธเธเนเธญเธกเธนเธฅเธฅเนเธฒเธชเธธเธ”เน€เธชเธกเธญ เธ–เนเธฒเนเธกเนเธกเธต net เนเธเนเธเธญเธเน€เธเนเธฒ
 *
 * NOTE: เน€เธเธฅเธตเนเธขเธ CACHE_VERSION เธ—เธธเธเธเธฃเธฑเนเธเธ—เธตเน deploy เนเธซเธกเน เน€เธเธทเนเธญเนเธซเน user เนเธ”เนเธเธญเธเนเธซเธกเน
 */
const CACHE_VERSION = 'hf-v3.18.95';
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
  './assets/css/glass.css',
  './assets/css/liquid-skin.css',
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
  './assets/js/glassEffects.js',
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

// โ”€โ”€โ”€ INSTALL: precache shell โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache){
      return cache.addAll(PRECACHE_URLS).catch(function(err){
        console.warn('[sw] precache partial:', err && err.message);
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

// โ”€โ”€โ”€ ACTIVATE: เธฅเธ cache เน€เธเนเธฒ + เธเธฑเธเธเธฑเธ reload เธ—เธธเธ client โ”€โ”€
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k.indexOf('hf-') === 0 && k !== STATIC_CACHE) return caches.delete(k);
      }));
    }).then(function(){
      return self.clients.claim();
    }).then(function(){
      // เธเธฑเธเธเธฑเธเนเธซเนเธ—เธธเธ client เนเธซเธฅเธ”เนเธซเธกเนเน€เธเธทเนเธญเนเธเนเนเธเธฅเน version เนเธซเธกเน
      return self.clients.matchAll({ type: 'window' });
    }).then(function(clients){
      clients.forEach(function(client){
        client.navigate(client.url);
      });
    })
  );
});

// โ”€โ”€โ”€ FETCH: route เธ•เธฒเธก URL โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Supabase API โ’ network-first
  if (url.hostname.indexOf('supabase') !== -1){
    event.respondWith(
      fetch(req).then(function(res){ return res; })
        .catch(function(){ return caches.match(req); })
    );
    return;
  }

  // Static (same-origin เธซเธฃเธทเธญ CDN เธ—เธตเน precache) โ’ cache-first
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
