import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../assets/festive/festivals.mjs';
import * as FX from '../assets/festive/fx.mjs';

const on = (y, m, d) => new Date(y, m - 1, d, 12);
const ymd = (id, y) => F.datesIn(F.byId[id], y).map(F.key);

test('catalogue: unique ids, valid colours, four-language names and greetings, known motifs', () => {
  const ids = new Set();
  for (const f of F.FESTIVALS) {
    assert.ok(!ids.has(f.id), f.id); ids.add(f.id);
    for (const c of [f.c1, f.c2, f.c3]) assert.match(c, F.HEX, f.id);
    for (const l of ['ms', 'en', 'zh', 'ta']) { assert.ok(f.name[l], f.id + ' name ' + l); assert.ok(f.hi[l], f.id + ' hi ' + l); }
    assert.ok(f.lead >= 0 && f.tail >= 0 && f.motifs.length >= 2, f.id);
    for (const m of f.motifs) assert.ok(m === 'sparkle' || FX.SHAPES[m], `${f.id}: missing shape ${m}`);
  }
  assert.ok(F.FESTIVALS.length >= 15);
});

test('fixed and table dates are exact', () => {
  assert.deepEqual(ymd('merdeka', 2027), ['2027-08-31']);
  assert.deepEqual(ymd('malaysiaday', 2026), ['2026-09-16']);
  assert.deepEqual(ymd('christmas', 2026), ['2026-12-25']);
  assert.deepEqual(ymd('deepavali', 2026), ['2026-11-08']);
  assert.deepEqual(ymd('deepavali', 2027), ['2027-10-29']);
  assert.deepEqual(ymd('cny', 2026), ['2026-02-17']);
  assert.deepEqual(ymd('cny', 2027), ['2027-02-06']);
  assert.deepEqual(ymd('thaipusam', 2026), ['2026-02-01']);
  assert.deepEqual(ymd('wesak', 2026), ['2026-05-31']);
});

test('moon-based dates land within a day of the published ones', () => {
  const within = (id, y, iso) => { const got = ymd(id, y)[0]; assert.ok(got, id + y); assert.ok(Math.abs(Date.parse(got) - Date.parse(iso)) <= 86400000, `${id} ${y}: ${got} vs ${iso}`); };
  within('raya', 2026, '2026-03-21'); within('haji', 2026, '2026-05-27'); within('muharram', 2026, '2026-06-17');
  within('maulid', 2026, '2026-08-26'); within('ramadan', 2026, '2026-02-19'); within('midautumn', 2026, '2026-09-25');
  within('midautumn', 2027, '2027-09-15'); within('raya', 2027, '2027-03-10');
});

test('activeFestival: windows, phases and priority', () => {
  const a = F.activeFestival(on(2026, 11, 3)); assert.equal(a.f.id, 'deepavali'); assert.equal(a.phase, 'lead'); assert.equal(a.daysTo, 5);
  assert.equal(F.activeFestival(on(2026, 11, 8)).phase, 'day');
  assert.equal(F.activeFestival(on(2026, 11, 10)).phase, 'after');
  assert.equal(F.activeFestival(on(2026, 11, 13)), null, 'window closed');
  assert.equal(F.activeFestival(on(2026, 12, 20)).f.id, 'christmas');
  assert.equal(F.activeFestival(on(2026, 8, 30)).f.id, 'merdeka');
  assert.equal(F.activeFestival(on(2027, 2, 20)).f.id, 'cny', 'CNY tail covers Chap Goh Meh');
  // Ramadan is calm and yields to Raya when they overlap, but wins on an ordinary Ramadan day
  assert.equal(F.activeFestival(on(2026, 3, 5)).f.id, 'ramadan');
  assert.equal(F.activeFestival(on(2026, 3, 19)).f.id, 'raya');
  // year boundary: CNY 2027's lead-in is seen in January 2027, Christmas tail is seen on 26 Dec
  assert.equal(F.activeFestival(on(2027, 1, 30)).f.id, 'cny');
  assert.equal(F.activeFestival(on(2026, 12, 26)).f.id, 'christmas');
});

test('upcoming lists each festival once, soonest first', () => {
  const u = F.upcoming(on(2026, 11, 3), 99);
  assert.equal(u[0].f.id, 'deepavali');
  assert.equal(new Set(u.map((o) => o.f.id)).size, u.length);
  for (let i = 1; i < u.length; i++) assert.ok(u[i].daysTo >= u[i - 1].daysTo);
});

// ---- graphics: every shape draws with a recording context and never throws or leaves the stack unbalanced
function fakeCtx() {
  const calls = { save: 0, restore: 0, draw: 0 };
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, { get(_, k) {
    if (k === 'save') return () => { calls.save++; }; if (k === 'restore') return () => { calls.restore++; };
    if (k === 'createRadialGradient') return () => grad;
    if (['fill', 'stroke', 'fillRect'].includes(k)) return () => { calls.draw++; };
    if (k === 'calls') return calls; return () => {};
  }, set() { return true; } });
  return ctx;
}
test('every shape draws and keeps save/restore balanced', () => {
  for (const [name, fn] of Object.entries(FX.SHAPES)) { const c = fakeCtx(); fn(c, 50, 50, 24, '#ff0000', '#ffd700', 1.2); assert.equal(c.calls.save, c.calls.restore, name); assert.ok(c.calls.draw > 0, name); }
});
test('scene: runs for every festival, respawns, bursts expire', () => {
  for (const f of F.FESTIVALS) {
    const s = new FX.Scene(f, 390, 844, { max: 22, seed: 7 }); const c = fakeCtx();
    for (let i = 0; i < 120; i++) { s.update(0.05); s.draw(c); }
    assert.ok(s.items.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)), f.id);
    s.burst(100, 100); assert.equal(s.bursts.length, 1); for (let i = 0; i < 40; i++) s.update(0.05); assert.equal(s.bursts.length, 0, 'burst expires');
    FX.garland(c, f, 390, 1);
  }
});
test('scene is deterministic for a seed', () => {
  const a = new FX.Scene(F.byId.cny, 390, 844, { seed: 3 }), b = new FX.Scene(F.byId.cny, 390, 844, { seed: 3 });
  assert.deepEqual(a.items.map((p) => [p.x, p.y]), b.items.map((p) => [p.x, p.y]));
});
test('alongLine interpolates and wraps', () => {
  const c = [[0, 0], [10, 0], [10, 10]], cum = FX.cumulative(c, (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]));
  assert.deepEqual(cum, [0, 10, 20]);
  assert.deepEqual(FX.alongLine(c, [5, 15, 25], 20, cum), [[5, 0], [10, 5], [5, 0]]);
});

test('slim-band scene keeps the decoration small: few items, all inside the strip', () => {
  const f = F.FESTIVALS ? F.FESTIVALS[0] : Object.values(F).find((v) => v && v.motifs);
  const s = new FX.Scene(f, 390, 96, { max: 6, seed: 7, small: true });
  assert.equal(s.items.length, 6); assert.ok(s.stars.length <= 5);
  assert.ok(s.items.every((i) => i.s <= 20), 'items are small');
  s.burst(100, 100); assert.ok(s.bursts[0].sparks.length <= 8, 'tap burst is small');
});
