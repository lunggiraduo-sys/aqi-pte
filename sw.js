// 阿奇PTE Service Worker —— 单文件应用离线缓存
// 策略：导航请求「网络优先、失败回退缓存」；同源静态资源「缓存优先、回源补充」。
const CACHE = 'aqi-pte-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(APP_SHELL).catch(function () { /* 离线安装时部分资源可能未达，忽略 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // 导航：先试网络（拿到最新页面并写入缓存），断网则回退已缓存的 index.html
    e.respondWith(
      fetch(req).then(function (r) {
        const cp = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', cp); });
        return r;
      }).catch(function () {
        return caches.match('./index.html').then(function (m) { return m || caches.match('./'); });
      })
    );
    return;
  }

  // 静态资源：先取缓存，未命中再回源并补充缓存
  e.respondWith(
    caches.match(req).then(function (m) {
      if (m) return m;
      return fetch(req).then(function (r) {
        if (r && r.ok) {
          const cp = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); });
        }
        return r;
      }).catch(function () { return caches.match('./'); });
    })
  );
});
