// ARAH service worker  pwa v0.1.0
// Offline-first app shell. The app is one self-contained HTML file (React, MapLibre and icons are bundled in
// it), so the whole shell is a handful of same-origin files that are cached together and swapped atomically.
//
// What it does NOT touch, on purpose:
//   - cross-origin requests (map tiles, routing, search, weather): the app has its own tile cache
//     ("arah-tiles-v1") and needs fresh data, so they go straight to the network;
//   - /api/*: the voice endpoint must always reach the server and is never cached here;
//   - non-GET requests.
// It only ever deletes caches whose names start with "arah-pwa-"; it never touches "arah-tiles-v1".
/* global clients */
'use strict';
importScripts('/sw-precache.js'); // generated: file lists + content hashes (npm run pwa:stamp); part of the update check
const P = self.__ARAH_PRECACHE;
const CORE_CACHE = 'arah-pwa-core-' + P.coreHash;
const LAZY_CACHE = 'arah-pwa-lazy-' + P.lazyHash;

self.addEventListener('install', (event) => {
  // cache:'reload' bypasses the HTTP cache so a new version never installs half-stale files. One failure fails
  // the install, and the browser retries later, which is what we want for an app shell.
  event.waitUntil(caches.open(CORE_CACHE).then((c) => c.addAll(P.core.map((u) => new Request(u, { cache: 'reload' })))));
  // No skipWaiting here: the page offers "Update" and never reloads in the middle of a trip.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('arah-pwa-') && name !== CORE_CACHE && name !== LAZY_CACHE) await caches.delete(name);
    }
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch (e) { /* optional */ } }
    await clients.claim(); // the first install controls the open page, so it works offline straight away
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION', release: P.release, build: P.coreHash });
});

const isCacheable = (res) => res && res.ok && res.type === 'basic';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // network, untouched
  if (url.pathname.startsWith('/api/')) return;

  // App shell navigations: cache first (instant start, works with no signal). start_url carries ?source=pwa, so
  // match the shell ignoring the query string.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CORE_CACHE);
      const hit = (await cache.match(url.pathname === '/index.html' ? '/' : url.pathname, { ignoreSearch: true }));
      if (hit) return hit;
      try { return await fetch(req); } catch (e) {
        return (await cache.match('/offline.html')) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  if (P.core.includes(url.pathname)) {
    event.respondWith((async () => (await (await caches.open(CORE_CACHE)).match(url.pathname)) || fetch(req))());
    return;
  }

  // AR runtime and model: fetched once on first use, then served from cache. They are pinned by hash in the app,
  // so a stale copy can never run; a changed file gets a new cache name.
  if (P.lazy.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(LAZY_CACHE);
      const hit = await cache.match(url.pathname);
      if (hit) return hit;
      const res = await fetch(req);
      if (isCacheable(res)) await cache.put(url.pathname, res.clone());
      return res;
    })());
  }
  // Everything else falls through to the network.
});
