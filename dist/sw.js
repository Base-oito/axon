self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'notify') {
    const { title, body, icon, tag, url } = event.data
    self.registration.showNotification(title, {
      body,
      icon: icon || '/logo.png',
      tag: tag || 'base8',
      data: { url: url || '/' },
      requireInteraction: true,
    })
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})
