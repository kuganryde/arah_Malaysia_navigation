// Drive view maths: route ahead, turn detection, camera projection, gauge geometry, themes.
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/drive/drive-core.js'); // classic script: attaches itself to the global like in the browser
const C = globalThis.__arahDriveCore;

// a route heading north for ~400 m then turning right (east): lng/lat near KL
const O = [101.7, 3.15], m = (e, n) => [O[0] + e / (111320 * Math.cos(3.15 * Math.PI / 180)), O[1] + n / 110574];
const ROUTE = [m(0, 0), m(0, 100), m(0, 200), m(0, 300), m(0, 400), m(5, 410), m(30, 415), m(100, 415), m(300, 415)];

test('drive: bearing, signed angle and angle lerp wrap correctly around north', () => {
  assert.equal(Math.round(C.bearingOf([0, 0], [0, 10])), 0);
  assert.equal(Math.round(C.bearingOf([0, 0], [10, 0])), 90);
  assert.equal(C.angDiff(10, 350), 20); assert.equal(C.angDiff(350, 10), -20);
  assert.equal(Math.round(C.lerpAngle(350, 10, 0.5)), 0);
});

test('drive: ahead() starts at the car, accumulates distance and reports how far off the route it is', () => {
  const a = C.ahead(ROUTE, m(3, 50), 250, 0);
  assert.ok(a.off < 4, `off ${a.off}`);
  assert.equal(a.pts[0].d, 0);
  assert.ok(a.pts[a.pts.length - 1].d > 250 && a.pts[a.pts.length - 1].d < 520);
  for (let i = 1; i < a.pts.length; i++) assert.ok(a.pts[i].d >= a.pts[i - 1].d);
  assert.ok(a.total > 600, 'remaining distance includes the part beyond the look-ahead');
});

test('drive: snap keeps to the right leg of a route that doubles back', () => {
  const U = [m(0, 0), m(0, 300), m(8, 300), m(8, 0)]; // out and back, 8 m apart
  assert.equal(C.snap(U, m(8, 100), 2).i, 2, 'with the hint on the return leg it stays there');
  assert.equal(C.snap(U, m(0, 100), 0).i, 0);
  assert.equal(C.snap(U, m(5000, 5000), 0).d > 60, true);
});

test('drive: nextTurn finds the right turn about 410 m ahead and ignores a gentle curve', () => {
  const a = C.ahead(ROUTE, m(0, 0), 600, 0), t = C.nextTurn(a.pts);
  assert.ok(t, 'turn found'); assert.ok(t.angle > 40, `right turn is positive (${t.angle})`); assert.ok(t.d > 380 && t.d < 440, `d ${t.d}`);
  const gentle = [m(0, 0), m(0, 100), m(10, 200), m(30, 300), m(60, 400)];
  assert.equal(C.nextTurn(C.ahead(gentle, m(0, 0), 500, 0).pts), null);
});

test('drive: a point straight ahead lands on the centre line, left of it lands left; behind the car is dropped', () => {
  const c = C.camera(0, 65, 400, 300, 120, 1.3);
  const p = C.project(c, 0, 20, 0); assert.ok(Math.abs(p[0] - 200) < 1e-9); assert.ok(p[1] > 120, 'road is below the horizon');
  assert.ok(C.project(c, -5, 20, 0)[0] < 200); assert.ok(C.project(c, 5, 20, 0)[0] > 200);
  assert.equal(C.project(c, 0, -10, 0), null);
  const far = C.project(c, 0, 200, 0), near = C.project(c, 0, 10, 0); assert.ok(far[1] < near[1], 'farther is closer to the horizon');
  const east = C.camera(90, 65, 400, 300, 120, 1.3); assert.ok(Math.abs(C.project(east, 20, 0, 0)[0] - 200) < 1e-9, 'heading east sees east');
});

test('drive: the ribbon is clipped at the near plane and gets narrower with distance', () => {
  const c = C.camera(0, 65, 400, 300, 120, 1.3), a = C.ahead(ROUTE, m(0, 20), 200, 0), q = C.ribbon(a.pts, c, 1.6, 150);
  assert.ok(q.length >= 1);
  const wid = (k) => Math.abs(k.poly[1][0] - k.poly[2][0]);
  assert.ok(wid(q[0]) > wid(q[q.length - 1]), 'perspective: far end is narrower');
  q.forEach((k) => k.poly.forEach((p) => assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]))));
});

test('drive: gauge sweeps 270 degrees and clamps', () => {
  assert.equal(C.gaugeAngle(0, 200), 135); assert.equal(C.gaugeAngle(200, 200), 405); assert.equal(C.gaugeAngle(100, 200), 270);
  assert.equal(C.gaugeAngle(999, 200), 405); assert.equal(C.gaugeAngle(-5, 200), 135);
  assert.match(C.arcPath(50, 50, 40, 135, 405), /^M[\d. ]+A40 40 0 1 1 /);
});

test('drive: three themes with distinct accents, sane gauge scales, and an unknown id falls back to Normal', () => {
  assert.deepEqual(Object.keys(C.THEMES), ['normal', 'sports', 'luxury']);
  const accents = new Set(Object.values(C.THEMES).map((t) => t.accent)); assert.equal(accents.size, 3);
  Object.values(C.THEMES).forEach((t) => { assert.ok(t.redFrom < t.max); assert.ok(t.name.en && t.name.ms); });
  assert.equal(C.theme('nope').id, 'normal');
  assert.ok(C.THEMES.sports.ledN > 0 && C.THEMES.normal.ledN === 0);
});

test('drive: distance labels', () => {
  assert.equal(C.fmtDist(7), '10 m'); assert.equal(C.fmtDist(143), '140 m'); assert.equal(C.fmtDist(1234), '1.2 km'); assert.equal(C.fmtDist(12000), '12 km');
});
