// PWA invariants: manifest, icons, generated precache list, and the service worker's routing rules (run in a vm
// with stubbed caches/fetch, so the real sw.js file is what is tested).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { build, render } from '../scripts/pwa/stamp.mjs';
import { isSoftwareGpu } from '../assets/ar/ar-core.mjs';

const mf = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));

test('manifest is installable on Android and iOS', () => {
  assert.equal(mf.display, 'standalone');
  assert.ok(mf.start_url.startsWith(mf.scope));
  assert.ok(mf.icons.some((i) => i.purpose === 'maskable' && i.sizes === '512x512'));
  assert.ok(mf.icons.some((i) => (i.purpose || 'any') === 'any' && i.sizes === '192x192'));
  for (const i of mf.icons) assert.ok(existsSync(i.src.slice(1)), i.src);
});

test('every iOS splash image exists and the head tags reference only real files', () => {
  const html = readFileSync('index.html', 'utf8');
  const refs = [...html.matchAll(/assets\/(?:splash|icons)\/[\w.-]+\.png/g)].map((m) => m[0]);
  assert.ok(refs.length >= 12);
  for (const r of refs) assert.ok(existsSync(r), r);
});

test('precache list is fresh, same-origin, and covers the shell', () => {
  assert.equal(readFileSync('sw-precache.js', 'utf8'), render(build()));
  const b = build();
  for (const u of ['/', '/offline.html', '/manifest.webmanifest', '/assets/arah-pwa.js']) assert.ok(b.core.includes(u), u);
  assert.ok(b.lazy.some((u) => u.endsWith('.onnx')));
  assert.ok([...b.core, ...b.lazy].every((u) => u.startsWith('/') && !u.startsWith('//')));
});

// ---- run the real sw.js in a sandbox
function boot(opts = {}) {
  const store = new Map(); // cacheName -> Map(path -> Response-like)
  const listeners = {};
  const fetched = [];
  const mk = (b, ok = true, type = 'basic') => ({ ok, type, body: b, clone() { return this; } });
  const caches = {
    async open(n) { if (!store.has(n)) store.set(n, new Map()); const m = store.get(n); return {
      async addAll(reqs) { for (const r of reqs) m.set(new URL(r.url, 'https://x.test').pathname, mk('cached:' + r.url)); },
      async match(u) { return m.get(new URL(u, 'https://x.test').pathname); },
      async put(u, r) { m.set(new URL(u, 'https://x.test').pathname, r); } }; },
    async keys() { return [...store.keys()]; },
    async delete(n) { return store.delete(n); },
  };
  const self = { __ARAH_PRECACHE: undefined, location: { origin: 'https://x.test' }, registration: {}, addEventListener(t, f) { listeners[t] = f; }, skipWaiting() { self.skipped = true; } };
  const ctx = vm.createContext({
    self, caches, URL, console,
    clients: { claim: async () => { self.claimed = true; } },
    Request: class { constructor(u, o) { this.url = u; Object.assign(this, o); } },
    Response: class { constructor(b, o) { this.body = b; Object.assign(this, o); this.ok = true; this.type = 'basic'; } },
    fetch: async (r) => { fetched.push(r.url || r); if (opts.offline) throw new Error('offline'); return mk('net:' + (r.url || r)); },
    importScripts: () => { self.__ARAH_PRECACHE = build(); },
  });
  vm.runInContext(readFileSync('sw.js', 'utf8'), ctx);
  return { store, listeners, fetched, self, caches, mk };
}
const event = (url, extra = {}) => { const e = { request: { url: 'https://x.test' + url, method: 'GET', mode: 'cors', ...extra }, p: null, respondWith(p) { e.p = p; } }; return e; };

test('sw: install caches the whole shell; activate removes old arah-pwa caches only', async () => {
  const s = boot();
  s.store.set('arah-pwa-core-old', new Map()); s.store.set('arah-tiles-v1', new Map()); s.store.set('other', new Map());
  let w; s.listeners.install({ waitUntil: (p) => { w = p; } }); await w;
  assert.ok([...s.store.keys()].some((k) => k.startsWith('arah-pwa-core-') && k !== 'arah-pwa-core-old'));
  s.listeners.activate({ waitUntil: (p) => { w = p; } }); await w;
  assert.ok(!s.store.has('arah-pwa-core-old'));
  assert.ok(s.store.has('arah-tiles-v1'), 'tile cache must survive');
  assert.ok(s.store.has('other'));
  assert.ok(s.self.claimed);
  assert.ok(!s.self.skipped, 'no skipWaiting on install');
});

test('sw: navigation is served from cache offline; unknown navigation falls back to offline page', async () => {
  const s = boot({ offline: true });
  let w; s.listeners.install({ waitUntil: (p) => { w = p; } }); await w;
  const e = event('/?source=pwa', { mode: 'navigate' }); s.listeners.fetch(e);
  assert.match((await e.p).body, /cached:/);
  const e2 = event('/nope', { mode: 'navigate' }); s.listeners.fetch(e2);
  assert.match((await e2.p).body, /cached:.*offline\.html/);
});

test('sw: ignores POST, cross-origin and /api/', async () => {
  const s = boot();
  let w; s.listeners.install({ waitUntil: (p) => { w = p; } }); await w;
  for (const e of [event('/api/tts', {}), event('/', { method: 'POST' }), { request: { url: 'https://tiles.openfreemap.org/a.pbf', method: 'GET', mode: 'cors' }, respondWith() { throw new Error('should not handle'); } }]) {
    let handled = false; const orig = e.respondWith; e.respondWith = (p) => { handled = true; orig && orig.call(e, p); };
    s.listeners.fetch(e);
    assert.equal(handled, false);
  }
});

test('sw: AR model is fetched once then served from cache', async () => {
  const s = boot();
  const url = '/assets/ar/models/yolox_nano.onnx';
  const e1 = event(url); s.listeners.fetch(e1); await e1.p;
  const n = s.fetched.length;
  const e2 = event(url); s.listeners.fetch(e2); await e2.p;
  assert.equal(s.fetched.length, n, 'second load must not hit the network');
});

test('sw: SKIP_WAITING message activates the waiting worker', () => {
  const s = boot(); s.listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.ok(s.self.skipped);
});

test('gpu guard: software renderers are recognised, real GPUs are not', () => {
  for (const n of ['Google SwiftShader', 'llvmpipe (LLVM 15)', 'Microsoft Basic Render Driver', 'Mesa OffScreen']) assert.ok(isSoftwareGpu(n), n);
  for (const n of ['Apple GPU', 'Adreno (TM) 740', 'Mali-G78', 'ANGLE (NVIDIA GeForce RTX 3060)', '']) assert.ok(!isSoftwareGpu(n), n);
});
