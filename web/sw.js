// Service worker: lets the game open and keep playing when the connection drops (a walk through Bovisa with
// patchy 4G). Network first, always revalidated, so a new version is never hidden behind an old copy; the cache is
// only the fallback. Everything the game loads is cached as it is used; the shell and the story data are cached up front.
// Not cached: video, audio and range requests (large, and the player streams them), map tiles (other servers).
const CACHE = 'petronius-v1';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/main.js', 'js/story.js', 'js/save.js', 'js/game.js', 'js/clue.js', 'js/map.js', 'js/journal.js', 'js/geo.js', 'js/dom.js',
  'fonts/archivo-latin.woff2', 'fonts/caveat-latin.woff2', 'icons/icon-192.png',
  '../data/story/flow.json', '../data/story/clues.json', '../data/story/cast.json', '../data/story/media.json',
];
const CDN = 'https://unpkg.com/';

self.addEventListener('install', (event) => {
  // One missing file must not abort the install: add each on its own.
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const ours = url.origin === self.location.origin;
  if (req.method !== 'GET' || req.headers.has('range') || !(ours || req.url.startsWith(CDN))) return;
  if (/\.(mp4|mp3|webm)$/i.test(url.pathname)) return;
  event.respondWith(networkFirst(req, ours));
});

async function networkFirst(req, ours) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req, ours ? { cache: 'no-cache' } : undefined);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true }) ?? (req.mode === 'navigate' ? await cache.match('./') : undefined);
    if (hit) return hit;
    throw err;
  }
}
