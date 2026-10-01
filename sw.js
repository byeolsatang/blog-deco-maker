// アメブロ装飾タグメーカー Service Worker
// 更新したら VERSION を上げると、利用者に「更新」ボタンが表示されます
const VERSION = "v1";
const APP_CACHE = `deco-app-${VERSION}`;
const FONT_CACHE = "deco-fonts";
const APP_SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("deco-app-") && k !== APP_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts：キャッシュ優先（オフラインでも同じ見た目に）
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === "opaque") c.put(req, res.clone());
          return res;
        } catch { return hit || Response.error(); }
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // ページ本体：ネット優先、オフライン時はキャッシュ
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(APP_CACHE).then(c => c.put("index.html", copy));
        return res;
      }).catch(() => caches.match("index.html", { ignoreSearch: true }))
    );
    return;
  }

  // 画像など：キャッシュ優先
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP_CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
