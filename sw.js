/* ==========================================================
 * 学成选择题 · Service Worker
 * 提供离线缓存能力，首次加载后可离线使用
 *
 * 【勘误后部署步骤】
 *   1. 修改下方 CACHE_VERSION 数字（如 v2 → v3）
 *   2. 推送到 GitHub（git add . && git commit -m "更新题库" && git push）
 *   3. 其他设备打开网页时会自动检测到新版本，弹出更新提示
 * ========================================================== */

const CACHE_VERSION = 'v3';  // ← 每次勘误后修改此版本号
const CACHE_NAME = `xuecheng-cache-${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
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

/* ====== 拦截请求：核心文件网络优先，静态资源缓存优先 ====== */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // HTML 和 JS 文件：网络优先（确保勘误更新及时生效）
  const isCoreFile = url.pathname.endsWith('/') ||
                     url.pathname.endsWith('/index.html') ||
                     url.pathname.endsWith('/app.js') ||
                     url.pathname.endsWith('/sw.js');

  if (isCoreFile) {
    event.respondWith(
      fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request).then(cached => {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 其他资源：缓存优先
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

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
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
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
