// Service worker: Web Push + the offline shell that makes the app
// installable. Registered from components/service-worker-register.tsx on
// every page load (it used to be registered only when a user opted into
// push, which meant most visitors had no worker and Chromium never offered
// "Install app").

const CACHE = "wwe-os-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"])));
  // Take over as soon as this version is installed rather than waiting for
  // every existing tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Navigations are network-first: this app renders live business data, so a
// cached shell must never be served in preference to the real page. The cache
// exists only so a navigation while offline lands somewhere honest instead of
// the browser's error page. Non-navigation requests are left entirely alone —
// Next's own asset hashing and the CDN already handle those correctly.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      const offline = await cache.match(OFFLINE_URL);
      return offline ?? Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Water Works Engineering", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push payload — fall back to the default title/body.
  }

  const { title, ...options } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: options.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: options.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
