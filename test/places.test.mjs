import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANDS } from '../assets/places/brands.mjs';
import * as P from '../assets/places/places-core.mjs';

test('directory: unique ids, valid domains and colours, both kinds present', () => {
  const ids = new Set();
  for (const b of BRANDS) {
    assert.ok(!ids.has(b.id), 'duplicate id ' + b.id); ids.add(b.id);
    assert.ok(P.KINDS.includes(b.kind), b.id);
    assert.match(b.domain, P.DOMAIN_RE, b.id);
    assert.match(b.color, P.COLOR_RE, b.id);
    assert.ok(b.name.length > 1, b.id);
  }
  assert.ok(BRANDS.filter((b) => b.kind === 'food').length >= 35);
  assert.ok(BRANDS.filter((b) => b.kind === 'mall').length >= 45);
});

test('every brand pattern compiles and matches its own name', () => {
  for (const b of BRANDS) {
    const re = new RegExp(P.brandPattern(b), 'i');
    assert.ok(re.test(b.name), `${b.id}: "${b.name}" vs /${P.brandPattern(b)}/`);
  }
});

test('queries: valid shape, scoped, and injection-safe', () => {
  const kfc = BRANDS.find((b) => b.id === 'kfc');
  const q = P.buildQuery('food', kfc, { around: [3.15, 101.71, 5000] });
  assert.match(q, /^\[out:json\]\[timeout:25\];\(nwr\["amenity"~/);
  assert.ok(q.includes('["brand"~') && q.includes('["name"~'), 'brand matched on name and brand separately (fast)');
  assert.match(P.buildQuery('food', null, { around: [3, 101, 1500] }, 80, 10), /^\[out:json\]\[timeout:10\];nwr\["amenity"~.*\["name"\]\(around:1500/);
  assert.ok(q.includes('(around:5000,3.15000,101.71000)'));
  assert.match(P.buildQuery('mall', BRANDS.find((b) => b.id === 'suria-klcc'), { malaysia: true }), /"shop"="mall"/);
  const evil = { name: 'x"];out;node(1);//', kind: 'food' };
  const qe = P.buildQuery('food', evil, { around: [3, 101, 1000] });
  assert.ok(!/x"\];out/.test(qe), 'quote must be escaped: ' + qe);
  assert.throws(() => P.buildQuery('food', null, { around: [3, 101, 999999] }));
  assert.throws(() => P.buildQuery('food', null, { around: ['a', 101, 1000] }));
  assert.throws(() => P.buildQuery('bank', null, {}));
});

test('logo urls only for valid domains and always https', () => {
  assert.deepEqual(P.logoUrls('kfc.com.my'), ['https://kfc.com.my/apple-touch-icon.png', 'https://kfc.com.my/favicon.ico']);
  for (const bad of ['', 'javascript:alert(1)', 'a.com/../x', 'evil.com@x.com', 'http://x.com', 'x']) assert.deepEqual(P.logoUrls(bad), [], bad);
});

test('badge helpers', () => {
  assert.equal(P.initials("McDonald's"), 'MC');
  assert.equal(P.initials('Burger King'), 'BK');
  assert.equal(P.inkFor('#ffc72c'), '#111');
  assert.equal(P.inkFor('#111827'), '#fff');
});

test('parseOutlets: sorts by distance, dedupes, matches brand, keeps text plain', () => {
  const ref = [101.71, 3.15];
  const j = { elements: [
    { type: 'node', lat: 3.16, lon: 101.72, tags: { name: 'KFC Pavilion', brand: 'KFC', opening_hours: '24/7' } },
    { type: 'node', lat: 3.151, lon: 101.711, tags: { name: '<img src=x onerror=alert(1)>', amenity: 'fast_food' } },
    { type: 'node', lat: 3.16, lon: 101.72, tags: { name: 'KFC Pavilion' } },
    { type: 'way', center: { lat: 3.2, lon: 101.8 }, tags: { brand: 'McDonald\'s' } },
    { type: 'node', tags: { name: 'no coords' } },
  ] };
  const r = P.parseOutlets(j, ref, 'food', BRANDS);
  assert.equal(r.length, 3);
  assert.ok(r[0].d < r[1].d && r[1].d < r[2].d);
  assert.equal(r[1].brand.id, 'kfc'); assert.equal(r[1].hours, '24 jam');
  assert.equal(r[2].brand.id, 'mcdonalds');
  assert.equal(r[0].brand, null);
  assert.equal(r[0].name, '<img src=x onerror=alert(1)>'); // returned verbatim as data; the UI inserts it with textContent
  assert.deepEqual(P.parseOutlets(null, ref, 'food'), []);
});

test('escapeRegex never emits a backslash or a quote, and still matches the literal text', () => {
  for (const s of ['plain', 'A&W', 'J.CO (x)', 'a"b\\c^d', 'x"];out;node(1);//', '*+?{}|$']) {
    const e = P.escapeRegex(s);
    assert.ok(!/["\\]/.test(e), e);
  }
  assert.ok(new RegExp(P.escapeRegex('J.CO (x)'), 'i').test('j.co (x) donuts'));
  assert.ok(!new RegExp(P.escapeRegex('J.CO'), 'i').test('JxCO'));
});

test('readable(): every brand badge reaches WCAG AAA (7:1) and keeps close to its hue', async () => {
  const B = await import('../assets/places/brands.mjs');
  for (const b of (B.BRANDS || B.default || [])) { const r = P.readable(b.color); assert.ok(P.contrast(r.bg, r.ink) >= 7, b.name + ' ' + r.bg); assert.ok(r.t < 0.7, b.name + ' moved too far'); }
  assert.equal(P.readable('#ffffff').ink, '#111111');
});
