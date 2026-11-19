/* Imported into the generated service worker (see vite.config.js → workbox.importScripts). */

// Push from the push server (FCM data message) -> show a notification, even if the app is closed.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }
  const d = payload.data || payload;
  const chatId = d.chatId || '';
  const url = chatId ? '/chat/' + chatId : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // App is open on screen: it shows its own in-app alert, no system notification needed.
      if (clients.some((c) => c.visibilityState === 'visible' && c.focused)) return undefined;
      return self.registration.showNotification(d.title || 'New message', {
        body: d.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: 'chat-' + chatId,
        renotify: true,
        data: { url },
      });
    }),
  );
});

// Tapping a notification focuses the open app (or opens it) on that chat.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'open-url', url });
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
