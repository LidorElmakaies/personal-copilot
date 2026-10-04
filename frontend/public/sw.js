// Web Push service worker — served from the site root (Expo's web export copies public/ as-is), so
// its scope covers the whole app. Payload: { notificationId, title, body, url? } — see
// backend/apps/notifications/src/models/notification-content.ts.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('push', (event) => {
  let content = {};
  try {
    content = event.data ? event.data.json() : {};
  } catch {
    content = { body: event.data ? event.data.text() : '' };
  }
  // Every push must show a notification. tag = notificationId, so a rare retry duplicate replaces
  // the first one instead of showing twice.
  event.waitUntil(
    self.registration.showNotification(content.title || 'Personal Copilot', {
      body: content.body || '',
      tag: content.notificationId,
      data: { url: content.url || '/' },
    }),
  );
});

// Focuses an open app tab if there is one, else opens the app at the notification's url.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
    .href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const open = windows.find(
        (w) => new URL(w.url).origin === self.location.origin,
      );
      // Just focused, not navigated: navigating reloads the whole app.
      if (open) return open.focus();
      return self.clients.openWindow(url);
    })(),
  );
});

// The browser rotated the subscription: subscribe again with the same key. The app sends the new
// one to the server the next time it opens signed in (no token here); until then the old endpoint
// answers 410 and the server drops it.
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription?.options;
  if (!options?.applicationServerKey) return;
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: options.applicationServerKey,
    }),
  );
});
