/* Brique par Brique — service worker : hors-ligne + rappels */
const CACHE = 'bpb-static-v1';
const DATA = 'bpb-data';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bpb-static-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (pour recevoir les mises à jour), cache si lent ou hors-ligne.
async function respond(req) {
  const cache = await caches.open(CACHE);
  const cached = (await cache.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? await cache.match('./index.html') : undefined);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (!cached) return net;
  return Promise.race([
    net.catch(() => cached),
    new Promise((resolve) => setTimeout(() => resolve(cached), 2500)),
  ]);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(respond(e.request));
});

/* ---------- Rappels en arrière-plan (au mieux, selon le navigateur) ---------- */
function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function readJSON(name) {
  const cache = await caches.open(DATA);
  const res = await cache.match(new Request(name));
  return res ? res.json() : null;
}

async function checkReminders() {
  if (self.Notification && Notification.permission !== 'granted') return;
  const state = await readJSON('./__state');
  if (!state || !Array.isArray(state.habits)) return;
  const mine = (await readJSON('./__notified')) || {};
  const today = dateKey();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  let changed = false;
  for (const h of state.habits) {
    if (!h.time || h.time > hhmm) continue;
    if (h.done && h.done[today]) continue;
    if ((state.notified || {})[h.id] === today || mine[h.id] === today) continue;
    await self.registration.showNotification(`C'est l'heure : ${h.name}`, {
      body: h.cue ? `${h.cue} — une brique de plus sur ton mur.` : 'Pose ta brique du jour : +1 %.',
      icon: './icons/icon-192.png',
      badge: './icons/badge-96.png',
      tag: `bpb-${h.id}`,
    });
    mine[h.id] = today;
    changed = true;
  }
  if (changed) {
    const cache = await caches.open(DATA);
    await cache.put(new Request('./__notified'), new Response(JSON.stringify(mine)));
  }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'bpb-rappels') e.waitUntil(checkReminders());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./');
    })
  );
});
