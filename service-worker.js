const APP_URL = new URL("./index.html", self.location.origin).href;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const fallbackPayload = {
    title: "Marivini",
    body: "Você tem uma nova notificação do Marivini.",
    icon: "./assets/icons/icon-192.png",
    badge: "./assets/icons/badge-96.png",
    tag: "marivini-push-notification",
    data: {
      url: APP_URL
    }
  };

  let payload = fallbackPayload;

  if (event.data) {
    try {
      const parsedPayload = event.data.json();
      payload = {
        ...fallbackPayload,
        ...parsedPayload,
        data: {
          ...fallbackPayload.data,
          ...(parsedPayload?.data ?? {})
        }
      };
    } catch {
      payload = {
        ...fallbackPayload,
        body: event.data.text() || fallbackPayload.body
      };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || fallbackPayload.title, {
      body: payload.body || fallbackPayload.body,
      icon: payload.icon || fallbackPayload.icon,
      badge: payload.badge || fallbackPayload.badge,
      tag: payload.tag || fallbackPayload.tag,
      data: {
        url: payload.data?.url || APP_URL
      }
    })
  );
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
