const CACHE = 'al-qalam-shell-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/app-icon.svg', '/app-icon-192.png', '/app-icon-512.png', '/logo_al-qalam.png']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]))
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ai-api/') || url.pathname.startsWith('/audio/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  if (!url.pathname.startsWith('/assets/') && !SHELL.includes(url.pathname)) return
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone()
      void caches.open(CACHE).then(cache => cache.put(request, copy))
    }
    return response
  })))
})
