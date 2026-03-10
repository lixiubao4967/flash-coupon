// Service Worker for Flash Coupon PWA
// 版本号更新会触发 activate 阶段的旧缓存清理
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `flash-coupon-static-${CACHE_VERSION}`;
const API_CACHE = `flash-coupon-api-${CACHE_VERSION}`;

// 安装时预缓存的静态资源
const PRECACHE_URLS = [
  '/',
  '/merchant',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ─── install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log('[SW] Pre-cache complete');
        // 立即接管，不等旧 SW 失效
        return self.skipWaiting();
      })
      .catch((err) => {
        // 预缓存失败时（例如图标还不存在）不阻塞安装
        console.warn('[SW] Pre-cache partial failure:', err.message);
        return self.skipWaiting();
      })
  );
});

// ─── activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== STATIC_CACHE && key !== API_CACHE
            )
            .map((key) => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // Socket.io 轮询不走缓存
  if (url.pathname.startsWith('/socket.io')) return;

  // API 请求：网络优先，失败时返回缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
    return;
  }

  // 静态资源 & 页面：缓存优先，缺失时请求网络并更新缓存
  event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
});

// ─── 推送通知 ─────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: '闪购优惠券',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png',
    };
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'flash-coupon-push',
    renotify: true,
    data: payload.data || {},
    actions: [
      { action: 'view', title: '查看优惠' },
      { action: 'dismiss', title: '忽略' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '闪购优惠券', options)
  );
});

// ─── 通知点击 ─────────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // 点击通知后聚焦或打开 App
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 如果已有打开的窗口，聚焦它
        for (const client of clientList) {
          if ('focus' in client) return client.focus();
        }
        // 否则打开新窗口
        return clients.openWindow('/');
      })
  );
});

// ─── 策略函数 ─────────────────────────────────────────────────────────────────

/**
 * 网络优先：先尝试网络，成功则更新缓存；失败则返回缓存
 */
async function networkFirstStrategy(request, cacheName) {
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'Offline - no cached data available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * 缓存优先：先查缓存；命中则在后台更新缓存（stale-while-revalidate）；
 * 未命中则请求网络并存入缓存
 */
async function cacheFirstStrategy(request, cacheName) {
  const cached = await caches.match(request);

  if (cached) {
    // 后台刷新缓存（stale-while-revalidate）
    const revalidate = fetch(request.clone())
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(cacheName);
          cache.put(request, response);
        }
      })
      .catch(() => {/* 忽略后台刷新失败 */});

    // 不阻塞响应
    void revalidate;
    return cached;
  }

  // 缓存未命中，从网络获取
  try {
    const networkResponse = await fetch(request.clone());
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // 离线且无缓存：返回离线页面占位
    return new Response(
      `<!DOCTYPE html><html lang="zh-CN"><body style="font-family:sans-serif;text-align:center;padding:2rem">
        <h1>离线状态</h1><p>请检查网络连接后重试。</p>
      </body></html>`,
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}
