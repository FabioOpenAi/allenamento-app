// Salva i file dell'app sul telefono, così si apre anche in palestra senza rete.
const NOME_CACHE = 'allenamento-v2';
const FILE = ['./', './index.html', './link.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(NOME_CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n !== NOME_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Prima la rete (per prendere gli aggiornamenti), se non c'è rete usa la copia salvata.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(NOME_CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
