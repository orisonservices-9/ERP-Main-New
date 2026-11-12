// Lets the platform admin be installed on a phone's home screen. It does not cache anything: data always comes live from the server.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
