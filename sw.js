const CACHE_NAME = 'studyflow-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// Instalar SW
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// Activar SW
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// Fetch
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

// Notificaciones Push
self.addEventListener('push', (e) => {
    const data = e.data ? e.data.json() : {};
    const title = data.title || 'StudyFlow AI';
    const options = {
        body: data.body || 'Tienes una nueva actualización',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: data.url || '/',
        actions: [
            { action: 'open', title: 'Ver' },
            { action: 'close', title: 'Cerrar' }
        ]
    };
    
    e.waitUntil(self.registration.showNotification(title, options));
});

// Click en notificación
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    
    if (e.action === 'open' || !e.action) {
        e.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (let client of clientList) {
                    if (client.url === e.notification.data && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(e.notification.data);
                }
            })
        );
    }
});