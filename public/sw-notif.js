// Service worker personalizado para notificaciones
// Este archivo es importado por el SW generado por vite-plugin-pwa

self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon = '/pwa-192x192.png', badge = '/pwa-64x64.png' } = event.data
    self.registration.showNotification(title, { body, icon, badge, tag, vibrate: [200, 100, 200] })
  }
})

// Notificaciones push reales, enviadas por el servidor (funciona con la app
// cerrada o el teléfono bloqueado) — a diferencia de 'message' arriba, que
// solo funciona con la app abierta en esta misma pestaña.
self.addEventListener('push', event => {
  const data = event.data?.json() || {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Rumbo', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
