/* ============================================================
   BEAM — Service Worker
   ライブ会場は電波が悪いことが多いので、圏外でも起動できるように
   全ファイルをキャッシュしておく。
   ただし更新が届かないと困るので「まずネット、ダメならキャッシュ」方式。
   ============================================================ */

var CACHE = 'beam-v1';

var ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './sets.js',
  './vendor/qrcode.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    fetchWithTimeout(req, 2500)
      .then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
  );
});

function fetchWithTimeout(req, ms) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, ms);
    fetch(req).then(function (res) {
      if (done) return;
      done = true; clearTimeout(timer); resolve(res);
    }).catch(function (err) {
      if (done) return;
      done = true; clearTimeout(timer); reject(err);
    });
  });
}
