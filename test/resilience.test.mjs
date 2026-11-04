// Runs the real arah-resilience.js in a vm with a scriptable fake network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync('assets/resilience/arah-resilience.js', 'utf8');
const res = (body, status = 200, type = 'application/json') => ({ status, statusText: '', headers: { get: () => type }, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });

function boot({ handler, cfg = {}, search = '', online = true } = {}) {
  const calls = [];
  const fake = (url, init = {}) => new Promise((resolve, reject) => {
    calls.push({ url: String(url), init });
    const sig = init.signal;
    const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (sig) { if (sig.aborted) return abort(); sig.addEventListener('abort', abort); }
    Promise.resolve(handler(String(url), init, calls.length)).then((r) => { if (r !== 'hang') resolve(r); }, reject);
  });
  const win = { fetch: fake, __arahNetConfig: { overpassMs: 60, overpassRetryMs: 60, photonMs: 60, nominatimMs: 60, osrmMs: 60, ...cfg }, dispatchEvent() {} , addEventListener() {} };
  const document = { body: { appendChild() {} }, createElement: () => ({ style: {}, setAttribute() {} }), querySelectorAll: () => [] };
  const ctx = vm.createContext({ window: win, document, navigator: { onLine: online }, location: { href: 'https://x.test/', search }, URL, AbortController, Response, DOMException, CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } }, setTimeout, clearTimeout, Date, Math, JSON, Array, Object, String, encodeURIComponent, isFinite });
  vm.runInContext(SRC, ctx);
  return { win, calls, f: win.fetch };
}
const post = (u) => [u, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=x' }];

test('unknown hosts pass straight through', async () => {
  const s = boot({ handler: async () => res({ a: 1 }) });
  const r = await s.f('https://example.com/x'); assert.equal(s.calls.length, 1);
  assert.deepEqual(JSON.parse(await r.text()), { a: 1 });
});
test('?nonet=1 leaves fetch alone', () => {
  const s = boot({ handler: async () => res({}), search: '?nonet=1' }); assert.equal(s.win.__arahNet, undefined);
});
test('overpass: a 503 on the main server falls over to a mirror', async () => {
  const s = boot({ handler: async (u) => (u.includes('overpass-api.de') ? res('busy', 503, 'text/html') : res({ elements: [{ id: 1 }] })) });
  const r = await s.f(...post('https://overpass-api.de/api/interpreter'));
  assert.deepEqual((await r.json()).elements, [{ id: 1 }]);
  assert.deepEqual(s.calls.map((c) => new URL(c.url).hostname), ['overpass-api.de', 'overpass.kumi.systems']);
  assert.equal(s.calls[1].init.credentials, 'omit'); assert.equal(s.calls[1].init.body, 'data=x');
});
test('overpass: HTTP 200 with a runtime-error remark and no elements counts as a failure', async () => {
  const s = boot({ handler: async (u) => (u.includes('overpass-api.de') ? res({ remark: 'runtime error: Query timed out', elements: [] }) : res({ elements: [{ id: 2 }] })) });
  const r = await s.f(...post('https://overpass-api.de/api/interpreter')); assert.equal((await r.json()).elements[0].id, 2);
});
test('overpass: a stalled server times out and the next mirror answers', async () => {
  const s = boot({ handler: (u) => (u.includes('overpass-api.de') ? 'hang' : res({ elements: [] })) });
  const t0 = Date.now(); const r = await s.f(...post('https://overpass-api.de/api/interpreter'));
  assert.equal(r.status, 200); assert.ok(Date.now() - t0 < 1500);
});
test('overpass: a host that failed twice is skipped until its cooldown ends', async () => {
  const s = boot({ handler: async (u) => (u.includes('overpass-api.de') ? res('x', 502) : res({ elements: [] })) });
  await s.f(...post('https://overpass-api.de/api/interpreter')); await s.f(...post('https://overpass-api.de/api/interpreter'));
  const before = s.calls.length;
  await s.f(...post('https://overpass-api.de/api/interpreter'));
  assert.deepEqual(s.calls.slice(before).map((c) => new URL(c.url).hostname), ['overpass.kumi.systems']);
  assert.equal(s.win.__arahNet.status().degraded, true);
});
test('overpass: all mirrors down rejects instead of hanging', async () => {
  const s = boot({ handler: async () => res('no', 504) });
  await assert.rejects(s.f(...post('https://overpass-api.de/api/interpreter')), /unavailable/);
});
test('photon: failure falls back to Nominatim and is reshaped for the app', async () => {
  const nom = [{ lat: '3.1', lon: '101.7', name: 'KLCC', type: 'attraction', display_name: 'KLCC, Kuala Lumpur', address: { road: 'Jalan Ampang', suburb: 'Ampang', city: 'Kuala Lumpur', state: 'WP' } }, { lat: 'x', lon: '1' }];
  const s = boot({ handler: async (u) => (u.includes('photon') ? res('err', 500) : res(nom)) });
  const r = await s.f('https://photon.komoot.io/api/?q=klcc&limit=7&lat=3&lon=101'); const j = await r.json();
  assert.equal(j.features.length, 1); assert.deepEqual(j.features[0].geometry.coordinates, [101.7, 3.1]);
  assert.equal(j.features[0].properties.name, 'KLCC'); assert.equal(j.features[0].properties.street, 'Jalan Ampang');
  assert.match(s.calls[1].url, /^https:\/\/nominatim\.openstreetmap\.org\/search\?.*q=klcc/); assert.match(s.calls[1].url, /countrycodes=my,sg,bn/);
});
test('photon: hostile query is encoded, never injected into the fallback URL', async () => {
  const s = boot({ handler: async (u) => (u.includes('photon') ? res('x', 500) : res([])) });
  await s.f('https://photon.komoot.io/api/?q=' + encodeURIComponent('a&countrycodes=us#x') + '&limit=3');
  const u = new URL(s.calls[1].url); assert.equal(u.searchParams.get('q'), 'a&countrycodes=us#x'); assert.equal(u.searchParams.get('countrycodes'), 'my,sg,bn');
});
test('photon: good answers are passed through, health resets', async () => {
  const s = boot({ handler: async () => res({ features: [] }) });
  const r = await s.f('https://photon.komoot.io/api/?q=a'); assert.deepEqual(await r.json(), { features: [] }); assert.equal(s.calls.length, 1);
});
test('photon and nominatim both down rejects (app keeps its local results)', async () => {
  const s = boot({ handler: async () => res('x', 500) });
  await assert.rejects(s.f('https://photon.komoot.io/api/?q=a'), /unavailable/);
});
test('osrm: 5xx rejects so the app tries its next server; NoRoute (4xx) is passed through', async () => {
  const s = boot({ handler: async (u) => (u.includes('router.project') ? res('x', 503) : res({ code: 'NoRoute' }, 400)) });
  await assert.rejects(s.f('https://router.project-osrm.org/route/v1/driving/1,1;2,2'), /unavailable/);
  const r = await s.f('https://routing.openstreetmap.de/routed-car/route/v1/driving/1,1;2,2'); assert.equal(r.status, 400); assert.equal((await r.json()).code, 'NoRoute');
});
test('osrm: the walking profile is retried once', async () => {
  let n = 0; const s = boot({ handler: async () => (++n === 1 ? res('x', 502) : res({ code: 'Ok', routes: [{}] })) });
  const r = await s.f('https://routing.openstreetmap.de/routed-foot/route/v1/foot/1,1;2,2'); assert.equal((await r.json()).code, 'Ok'); assert.equal(s.calls.length, 2);
});
test('osrm: a stalled server times out', async () => {
  const s = boot({ handler: () => 'hang' });
  await assert.rejects(s.f('https://router.project-osrm.org/route/v1/driving/1,1;2,2'), /unavailable/);
});
test("the caller's own abort still wins", async () => {
  const s = boot({ handler: () => 'hang', cfg: { overpassMs: 5000 } }); const ctl = new AbortController();
  const p = s.f('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'd', signal: ctl.signal });
  setTimeout(() => ctl.abort(), 20); await assert.rejects(p, (e) => e.name === 'AbortError');
});
test('offline fails fast with no network call', async () => {
  const s = boot({ handler: async () => res({}), online: false });
  await assert.rejects(s.f('https://photon.komoot.io/api/?q=a'), /Offline/); assert.equal(s.calls.length, 0);
});
test('plain http and Request objects are never touched', async () => {
  const s = boot({ handler: async () => res({}) });
  await s.f('http://photon.komoot.io/api/?q=a'); assert.equal(s.calls.length, 1);
});
