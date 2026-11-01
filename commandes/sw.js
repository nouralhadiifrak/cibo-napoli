/*
 * Cibo Napoli: the staff app's own service worker (scope /commandes/).
 * On Android a notification belongs to the installed app whose scope covers the worker that shows it, so the
 * staff app needs its own (with the site's worker, scope /, they would go to the customer app and be dropped).
 *   - push notifications of new orders (sent by supabase/functions/push), shown even when the phone is locked
 *   - the staff page itself: from the network, the saved copy only when offline
 */
const CACHE = "cn-staff-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put("/commandes/", res.clone());
      return res;
    } catch (e) {
      return (await cache.match("/commandes/")) || Response.error();
    }
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "Cibo Napoli", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || "Cibo Napoli · nouvelle commande", {
    body: data.body || "",
    tag: data.tag || "commande",
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 150, 400, 150, 400],
    icon: "/assets/icons/staff-192.png",
    badge: "/assets/icons/staff-192.png",
    data: { url: data.url || "/commandes/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = wins.find((w) => new URL(w.url).pathname.startsWith("/commandes/"));
    if (open) return open.focus();
    return self.clients.openWindow("/commandes/");
  })());
});
