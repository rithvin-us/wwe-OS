// Web Push service worker. Registered from lib/push.ts. Only handles the
// push lifecycle — no offline caching/PWA shell here, that's a separate
// concern this file deliberately doesn't take on.

self.addEventListener("push", (event) => {
  let payload = { title: "WWE OS", body: "" };
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
