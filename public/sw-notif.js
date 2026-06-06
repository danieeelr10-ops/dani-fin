// Service worker personalizado para notificaciones
// Este archivo es importado por el SW generado por vite-plugin-pwa

self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon = '/pwa-192x192.png', badge = '/pwa-64x64.png' } = event.data
    self.registration.showNotification(title, { body, icon, badge, tag, vibrate: [200, 100, 200] })
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    })
  )
})
