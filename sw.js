/*
 * Cibo Napoli: the site's service worker. Keeps a copy of the site so the installed app opens on a weak or
 * missing connection. Pages, styles and scripts: network first (menu and prices stay fresh; the saved copy only
 * if the network fails or takes more than 4 s). Pictures, fonts and libraries: the saved copy, refreshed in the
 * background. Orders, maps and the staff app are never cached here. Raise VERSION to drop every saved copy.
 */
const VERSION = "cn-v2";
const CORE = [
  "/", "/commander/", "/reserver/", "/css/style.css?v=2", "/js/intro.js?v=2", "/js/config.js?v=2", "/js/i18n.js?v=2",
  "/js/menu-data.js?v=2", "/js/reviews.js?v=2", "/js/art.js?v=2", "/js/orders.js?v=2", "/js/common.js?v=2",
  "/js/order.js?v=2", "/js/reserve.js?v=2",
  "/assets/brand/logo-white.webp", "/assets/icons/icon-192.png", "/assets/hero/pizza-peperoni-400.webp",
  "/assets/fonts/dm-sans-latin.woff2", "/assets/fonts/playfair-display-italic-latin.woff2",
  "/assets/fonts/playfair-display-latin.woff2", "/assets/fonts/pinyon-script-latin.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k.startsWith("cn-v")).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), ms));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/commandes/")) return;
  const isPage = req.mode === "navigate";
  const isCode = /\.(css|js)$/.test(url.pathname) && !url.pathname.startsWith("/vendor/");
  if (isPage || isCode) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req).then((res) => { if (res.ok) cache.put(isPage ? url.pathname : req, res.clone()); return res; });
      try {
        return await Promise.race([net, timeout(4000)]);
      } catch (e) {
        const hit = await cache.match(isPage ? url.pathname : req) || (isPage && await cache.match("/"));
        return hit || net;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })());
});
