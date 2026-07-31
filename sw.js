/* ==========================================================
 * 学成选择题 · Service Worker
 * 提供离线缓存能力，首次加载后可离线使用
 * ========================================================== */

const CACHE_NAME = 'xuecheng-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

/* ====== 安装：预缓存核心资源 ====== */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

/* ====== 激活：清理旧缓存 ====== */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* ====== 拦截请求：缓存优先，网络回退 ====== */
self.addEventListener('fetch', event => {
  // 仅处理 GET 请求，跳过 API 调用（Gist 同步等）
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  // 跳过跨域请求和 API 请求
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 有缓存就返回缓存
      if (cachedResponse) {
        // 后台静默更新缓存
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // 无缓存，从网络获取
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // 离线且无缓存时返回首页
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

/* ====== 消息监听：支持手动更新 ====== */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
