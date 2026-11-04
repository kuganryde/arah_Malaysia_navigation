import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { scrubEvent, scrubString, scrubUrl, makeBudget, isNoise } from '../assets/observability/scrub.mjs';

// ---- scrub ----
test('coordinates and precise numbers never survive', () => {
  assert.equal(scrubString('route 3.157912,101.711633 failed'), 'route [coords] failed');
  assert.equal(scrubString('lat=3.157912'), 'lat=[num]');
  assert.equal(scrubString('x'.repeat(1000)).length, 300);
});
test('urls keep origin and path only', () => {
  assert.equal(scrubUrl('https://arah.example/path?q=klcc&lat=3.1#state'), 'https://arah.example/path');
  assert.equal(scrubUrl('not a url'), '[url]');
});
test('events lose user, breadcrumbs, extra, request details and local variables', () => {
  const e = scrubEvent({ user: { ip_address: '1.2.3.4' }, server_name: 'h', breadcrumbs: [{}], extra: { q: 'secret' },
    request: { url: 'https://a.test/x?lat=3.1234567', headers: { cookie: 'c' }, cookies: { a: 1 } },
    message: 'fail at 3.15791,101.71163',
    exception: { values: [{ type: 'TypeError', value: 'bad 3.15791,101.71163', stacktrace: { frames: [{ filename: 'https://a.test/app.js?v=3.1234567', vars: { secret: 1 } }] } }] },
    tags: { place: 'at 3.15791,101.71163' }, contexts: { browser: { name: 'Chrome' }, device: { model: 'x' }, geo: { city: 'KL' } } });
  assert.equal(e.user, undefined); assert.equal(e.breadcrumbs, undefined); assert.equal(e.extra, undefined);
  assert.deepEqual(e.request, { url: 'https://a.test/x' });
  assert.equal(e.message, 'fail at [coords]'); assert.equal(e.exception.values[0].value, 'bad [coords]');
  assert.equal(e.exception.values[0].stacktrace.frames[0].vars, undefined); assert.equal(e.exception.values[0].stacktrace.frames[0].filename, 'https://a.test/app.js');
  assert.equal(e.tags.place, 'at [coords]'); assert.deepEqual(Object.keys(e.contexts), ['browser']);
});
test('noise is dropped: extensions, cross-origin Script error, ResizeObserver', () => {
  assert.equal(scrubEvent({ exception: { values: [{ value: 'Script error.' }] } }), null);
  assert.equal(scrubEvent({ exception: { values: [{ value: 'ResizeObserver loop limit exceeded' }] } }), null);
  assert.equal(isNoise({ exception: { values: [{ value: 'x', stacktrace: { frames: [{ filename: 'chrome-extension://abc/c.js' }] } }] } }), true);
  assert.equal(scrubEvent(null), null);
});
test('budget allows 10 distinct errors and never repeats one', () => {
  const ok = makeBudget(3), ev = (m) => ({ exception: { values: [{ type: 'E', value: m }] } });
  assert.equal(ok(ev('a')), true); assert.equal(ok(ev('a')), false); assert.equal(ok(ev('b')), true); assert.equal(ok(ev('c')), true); assert.equal(ok(ev('d')), false);
});

// ---- loader in a fake browser ----
const DSN = 'https://0123456789abcdef0123456789abcdef@o123.ingest.us.sentry.io/456';
function boot({ config = { dsn: DSN }, pref = null, trip = false, ar = false, hidden = false } = {}) {
  const store = new Map(pref ? [['arah.observe.v1', pref]] : []), appended = [], listeners = {}, timers = [];
  const mk = (tag) => ({ tag, style: {}, children: [], attrs: {}, parentNode: null, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); }, addEventListener(t, f) { (this.l ||= {})[t] = f; } });
  const head = mk('head'); head.appendChild = function (c) { appended.push(c); this.children.push(c); return c; };
  const document = { head, body: mk('body'), readyState: 'complete', visibilityState: hidden ? 'hidden' : 'visible', currentScript: { src: 'https://x.test/assets/observability/arah-observe.js' },
    createElement: mk, querySelectorAll: () => (trip ? [{ textContent: 'Tamat' }] : []) };
  const calls = [];
  const win = { addEventListener(t, f) { (listeners[t] ||= []).push(f); }, __arahARApi: { state: { on: ar } } };
  const ctx = vm.createContext({ window: win, document, URL, location: { hostname: 'x.test' }, Promise, Array, JSON, RegExp,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    fetch: async (u) => ({ ok: true, json: async () => (String(u).endsWith('config.json') ? config : { release: '0.10.0' }) }),
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {} });
  vm.runInContext(readFileSync('assets/observability/arah-observe.js', 'utf8'), ctx);
  return { win, document, appended, store, timers, listeners, calls, async settle() { await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); },
    runTimers() { const t = timers.splice(0); t.forEach((x) => x.f()); } };
}
const cards = (s) => s.document.body.children.filter((c) => c.attrs && c.attrs.class === 'ao-card');
const click = (card, label) => { const row = card.children[2]; row.children.find((b) => b.textContent.includes(label)).l.click(); };

test('no DSN: completely inert (no card, no script, nothing scheduled)', async () => {
  const s = boot({ config: { dsn: '' } }); await s.settle();
  assert.equal(s.timers.length, 0); assert.equal(cards(s).length, 0); assert.equal(s.appended.length, 0);
});
test('hostile DSN is rejected', async () => {
  for (const dsn of ['https://evil.test/1', 'http://0123456789abcdef0123456789abcdef@o1.ingest.sentry.io/1', 'https://0123456789abcdef0123456789abcdef@o1.ingest.sentry.io.evil.com/1']) {
    const s = boot({ config: { dsn } }); await s.settle(); assert.equal(s.timers.length, 0, dsn);
  }
});
test('first visit: asks after a delay, loads nothing before consent', async () => {
  const s = boot(); await s.settle(); assert.equal(s.timers.length, 1); assert.equal(cards(s).length, 0);
  assert.equal(s.appended.filter((a) => a.tag === 'script').length, 0);
  s.runTimers(); assert.equal(cards(s).length, 1);
});
test('Yes: stores the choice and loads the pinned SDK with integrity', async () => {
  const s = boot(); await s.settle(); s.runTimers(); click(cards(s)[0], 'Yes');
  assert.equal(s.store.get('arah.observe.v1'), 'on'); assert.equal(cards(s).length, 0);
  const sc = s.appended.find((a) => a.tag === 'script');
  assert.match(sc.src, /vendor\/sentry\.min\.js$/); assert.match(sc.integrity, /^sha384-/); assert.equal(sc.crossOrigin, 'anonymous');
});
test('No: stores off, never loads Sentry, never asks again', async () => {
  const s = boot(); await s.settle(); s.runTimers(); click(cards(s)[0], 'No thanks');
  assert.equal(s.store.get('arah.observe.v1'), 'off'); assert.equal(s.appended.filter((a) => a.tag === 'script').length, 0);
  const s2 = boot({ pref: 'off' }); await s2.settle(); assert.equal(s2.timers.length, 0);
});
test('returning opted-in visitor loads the SDK straight away, without a card', async () => {
  const s = boot({ pref: 'on' }); await s.settle();
  assert.equal(s.appended.filter((a) => a.tag === 'script').length, 1); assert.equal(s.timers.length, 0);
});
test('never asks during a trip or AR; retries later', async () => {
  for (const o of [{ trip: true }, { ar: true }, { hidden: true }]) {
    const s = boot(o); await s.settle(); s.runTimers(); assert.equal(cards(s).length, 0, JSON.stringify(o)); assert.equal(s.timers.length, 1);
  }
});
test('Escape counts as No', async () => {
  const s = boot(); await s.settle(); s.runTimers(); cards(s)[0].l.keydown({ key: 'Escape' }); assert.equal(s.store.get('arah.observe.v1'), 'off');
});
