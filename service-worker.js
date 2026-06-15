const APP_URL = new URL("./index.html", self.location.origin).href;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      const targetUrl = event.notification.data?.url || APP_URL;

      for (const client of clientsList) {
        if (client.url.startsWith(self.registration.scope) && "focus" in client) {
          return client.focus();
        }
      }

      if ("openWindow" in self.clients) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
