// Runs the real arah-keepawake.js in a vm with a fake browser, to check lock/retry/fallback behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function boot({ wakeLock = true, pref = null, hidden = false, trip = false, reject = false } = {}) {
  const listeners = {}, docL = {}, calls = { request: 0, release: 0, play: 0 }, store = new Map(pref === null ? [] : [['arah.awake.v1', pref]]);
  const sentinels = [];
  const mkEl = (tag) => ({ tag, style: {}, children: [], attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; },
    addEventListener(t, f) { (this.l ||= {})[t] = f; }, pause() { this.paused = true; }, play() { calls.play++; this.paused = false; return Promise.resolve(); }, remove() {}, paused: true });
  const document = { visibilityState: hidden ? 'hidden' : 'visible', hidden, readyState: 'complete', currentScript: { src: 'https://x.test/assets/keepawake/arah-keepawake.js' },
    body: mkEl('body'), head: mkEl('head'), createElement: mkEl, createElementNS: (ns, t) => mkEl(t), querySelectorAll: () => (trip ? [{ textContent: ' Tamat ' }] : []),
    addEventListener(t, f) { (docL[t] ||= []).push(f); } };
  const navigator = wakeLock ? { wakeLock: { request: async () => { calls.request++; if (reject) throw new Error('NotAllowedError'); const s = { released: false, l: {}, addEventListener(t, f) { this.l[t] = f; }, release() { calls.release++; this.released = true; this.l.release && this.l.release(); } }; sentinels.push(s); return s; } } } : {};
  const win = { addEventListener(t, f) { (listeners[t] ||= []).push(f); } };
  const ctx = vm.createContext({ window: win, getComputedStyle: () => ({}), MutationObserver: class { observe() {} }, document, navigator, URL, location: { href: 'https://x.test/' }, setTimeout, clearTimeout, setInterval: () => 0,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) } });
  win.window = win; Object.assign(ctx, { window: win });
  vm.runInContext(readFileSync('assets/keepawake/arah-keepawake.js', 'utf8'), ctx);
  return { win, document, calls, docL, sentinels, store, fire: (t) => (docL[t] || []).forEach((f) => f()) };
}
const tick = () => new Promise((r) => setImmediate(r));

test('requests a wake lock when visible', async () => {
  const s = boot(); await tick();
  assert.equal(s.calls.request, 1); assert.equal(s.win.__arahAwake.status().locked, true);
});
test('no lock while hidden; asks again when visible; releases when hidden', async () => {
  const s = boot({ hidden: true }); await tick();
  assert.equal(s.calls.request, 0);
  s.document.visibilityState = 'visible'; s.fire('visibilitychange'); await tick();
  assert.equal(s.calls.request, 1);
  s.document.visibilityState = 'hidden'; s.fire('visibilitychange'); await tick();
  assert.equal(s.calls.release, 1);
});
test('re-requests after the system releases the lock', async () => {
  const s = boot(); await tick();
  s.sentinels[0].released = true; s.sentinels[0].l.release(); // system took it back
  s.fire('visibilitychange'); await tick();
  assert.equal(s.calls.request, 2);
});
test('user can turn it off, and it is remembered; a trip overrides', async () => {
  const off = boot({ pref: '0' }); await tick();
  assert.equal(off.calls.request, 0);
  const trip = boot({ pref: '0', trip: true }); await tick();
  assert.equal(trip.calls.request, 1, 'always on during a trip');
  const s = boot(); await tick(); s.win.__arahAwake.set(false);
  assert.equal(s.store.get('arah.awake.v1'), '0'); assert.equal(s.calls.release, 1);
});
test('falls back to a silent looping video when the API is missing', async () => {
  const s = boot({ wakeLock: false }); await tick();
  const v = s.document.body.children.find((c) => c.tag === 'video');
  assert.ok(v, 'video created'); assert.ok(v.muted && v.loop && v.playsInline);
  assert.deepEqual(v.children.map((c) => c.type), ['video/webm', 'video/mp4']);
  assert.ok(v.children.every((c) => c.src.startsWith('https://x.test/assets/keepawake/')));
  assert.ok(s.calls.play >= 1);
});
test('a refused lock falls back to the video', async () => {
  const s = boot({ reject: true }); await tick(); await tick();
  assert.ok(s.document.body.children.some((c) => c.tag === 'video'));
});

test('switching off while a request is in flight does not leave a lock behind', async () => {
  const s = boot(); s.win.__arahAwake.set(false); await tick(); await tick();
  assert.equal(s.win.__arahAwake.status().locked, false);
  assert.equal(s.calls.release, s.sentinels.length);
});

test('shows a small toggle button that flips the saved preference', async () => {
  const s = boot(); await tick();
  const btn = s.document.body.children.find((c) => c.className === 'ak-btn');
  assert.ok(btn, 'button is in the page');
  assert.equal(btn.attrs['aria-pressed'], 'true');
  btn.l.click();
  assert.equal(s.store.get('arah.awake.v1'), '0'); assert.equal(btn.attrs['aria-pressed'], 'false');
  btn.l.click();
  assert.equal(s.store.get('arah.awake.v1'), '1'); assert.equal(btn.attrs['aria-pressed'], 'true');
});
test('button is hidden during a trip', async () => {
  const s = boot({ trip: true }); await tick();
  assert.equal(s.document.body.children.find((c) => c.className === 'ak-btn').hidden, true);
});
