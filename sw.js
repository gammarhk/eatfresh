const CACHE_NAME = "eatfresh-v1";
const ASSETS = ["./", "./index.html", "./manifest.json"];

// ─── Install: cache shell ────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch: network-first, fallback to cache ─────────────────────────
self.addEventListener("fetch", (e) => {
  // Skip non-GET and Google API requests
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("googleapis.com")) return;
  if (e.request.url.includes("accounts.google.com")) return;

  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

// ─── Notification check (called from main app via postMessage) ───────
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "CHECK_EXPIRY") {
    const items = e.data.items || [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const expiring = items.filter((item) => {
      const exp = new Date(item.expiryDate);
      exp.setHours(0, 0, 0, 0);
      let days = Math.ceil((exp - now) / 86400000);
      if (item.frozen) days = Math.round(days * 2);
      return days >= 0 && days <= 2;
    });

    if (expiring.length > 0) {
      const names = expiring.slice(0, 3).map((i) => i.name).join(", ");
      const more = expiring.length > 3 ? ` +${expiring.length - 3} more` : "";
      self.registration.showNotification("🥬 EatFresh Reminder", {
        body: `Expiring soon: ${names}${more}`,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        tag: "eatfresh-expiry",
        renotify: true,
      });
    }
  }
});

// ─── Open app on notification click ──────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("./");
    })
  );
});
