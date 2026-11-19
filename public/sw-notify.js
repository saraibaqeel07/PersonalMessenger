/* Imported into the generated service worker (see vite.config.js → workbox.importScripts).
 * Tapping a message notification focuses the open app (or opens it) on that chat. */
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
