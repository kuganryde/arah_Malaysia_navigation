// Unit tests for the AR driving assistant's pure logic (assets/ar/ar-core.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE, COCO, CONFIG, grids, letterbox, toCHW_BGR, decodeYolox, nms, iou, toFrame, estimateDistance,
  speedFromFixes, Tracker, closingSpeed, detectLanes, LaneMonitor, classifyLight, evaluate, AlertGate, alertText, inCorridor,
} from '../assets/ar/ar-core.mjs';

const CAR = COCO.indexOf('car'), PERSON = COCO.indexOf('person'), DOG = COCO.indexOf('dog'), LIGHT = COCO.indexOf('traffic light');
const frame = { w: 640, h: 480 };
const F = frame.w / (2 * Math.tan((CONFIG.hfovDeg * Math.PI) / 360)); // focal length in px

test('grids cover 3549 anchors for 416 input', () => {
  assert.equal(grids(SIZE).n, 3549);
});

test('decodeYolox turns one confident anchor into a correctly placed box', () => {
  const g = grids(SIZE), stride = 85;
  const out = new Float32Array(g.n * stride);
  const i = 2704 + 10 * 26 + 12; // stride-16 level, cell (12,10)
  const o = i * stride;
  out[o] = 0.5; out[o + 1] = 0.5; out[o + 2] = Math.log(3); out[o + 3] = Math.log(2); out[o + 4] = 0.9; out[o + 5 + CAR] = 0.8;
  const [b, ...rest] = decodeYolox(out);
  assert.equal(rest.length, 0);
  assert.equal(b.cls, CAR);
  assert.ok(Math.abs(b.score - 0.72) < 1e-6);
  const cx = (0.5 + 12) * 16, cy = (0.5 + 10) * 16;
  assert.ok(Math.abs((b.x1 + b.x2) / 2 - cx) < 1e-3 && Math.abs((b.y1 + b.y2) / 2 - cy) < 1e-3);
  assert.ok(Math.abs(b.x2 - b.x1 - 48) < 1e-3 && Math.abs(b.y2 - b.y1 - 32) < 1e-3);
});

test('decodeYolox ignores low scores, untracked classes and survives huge wh', () => {
  const g = grids(SIZE), stride = 85, out = new Float32Array(g.n * stride);
  out[4] = 0.2; out[5 + CAR] = 0.9; // below threshold
  out[stride + 4] = 0.9; out[stride + 5 + COCO.indexOf('banana')] = 0.9; // not tracked
  out[2 * stride + 2] = 1e9; out[2 * stride + 3] = 1e9; out[2 * stride + 4] = 0.9; out[2 * stride + 5 + CAR] = 0.9;
  const r = decodeYolox(out);
  assert.equal(r.length, 1);
  assert.ok(Number.isFinite(r[0].x2) && Number.isFinite(r[0].y2));
});

test('decodeYolox rejects a wrongly sized tensor instead of reading garbage', () => {
  assert.throws(() => decodeYolox(new Float32Array(10)), /unexpected/);
});

test('nms removes overlapping same-class boxes but keeps different classes', () => {
  const a = { x1: 0, y1: 0, x2: 100, y2: 100, score: 0.9, cls: CAR };
  const b = { x1: 5, y1: 5, x2: 105, y2: 105, score: 0.6, cls: CAR };
  const c = { x1: 5, y1: 5, x2: 105, y2: 105, score: 0.6, cls: PERSON };
  assert.deepEqual(nms([b, a, c]).map((x) => x.score), [0.9, 0.6]);
  assert.ok(iou(a, b) > 0.8);
});

test('letterbox + toFrame round-trip a box to source pixels', () => {
  const { r } = letterbox(640, 480);
  assert.ok(Math.abs(r - 0.65) < 1e-9);
  const [b] = toFrame([{ x1: 65, y1: 65, x2: 130, y2: 130, score: 1, cls: CAR }], 640, 480);
  assert.ok(Math.abs(b.x1 - 100) < 1e-6 && Math.abs(b.x2 - 200) < 1e-6);
  const [c] = toFrame([{ x1: -50, y1: 0, x2: 9999, y2: 9999, score: 1, cls: CAR }], 640, 480);
  assert.equal(c.x1, 0); assert.equal(c.x2, 640); assert.equal(c.y2, 480);
});

test('toCHW_BGR writes channels in B,G,R order', () => {
  const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
  const out = toCHW_BGR(rgba, 1, new Float32Array(3)); // size 1 reads only the first pixel
  assert.deepEqual([...out], [30, 20, 10]);
});

test('estimateDistance: a 1.8 m wide car 20 m ahead', () => {
  const w = (1.8 * F) / 20, h = (1.5 * F) / 20;
  const d = estimateDistance({ x1: 300, x2: 300 + w, y1: 200, y2: 200 + h, cls: CAR }, frame);
  assert.ok(Math.abs(d - 20) < 0.5, `got ${d}`);
});

test('estimateDistance uses only the uncut dimension when the box touches the frame edge', () => {
  const h = (1.5 * F) / 8; // 8 m away, wider than the frame so cut at both sides
  const d = estimateDistance({ x1: 0, x2: 640, y1: 100, y2: 100 + h, cls: CAR }, frame);
  assert.ok(Math.abs(d - 8) < 0.3, `got ${d}`);
  assert.equal(estimateDistance({ x1: 0, x2: 2, y1: 0, y2: 2, cls: CAR }, frame), null);
  assert.equal(estimateDistance({ x1: 0, x2: 50, y1: 0, y2: 50, cls: 999 }, frame), null);
});

test('speedFromFixes matches a known distance and rejects tiny dt', () => {
  const a = { lat: 3.139, lon: 101.6869, t: 0 };
  const b = { lat: 3.139 + 100 / 111195, lon: 101.6869, t: 5000 }; // ~100 m north in 5 s
  assert.ok(Math.abs(speedFromFixes(a, b) - 20) < 0.2);
  assert.equal(speedFromFixes(a, { ...b, t: 50 }), null);
});

test('closingSpeed recovers a constant approach rate and refuses short histories', () => {
  const hist = Array.from({ length: 8 }, (_, i) => ({ t: i * 150, d: 30 - 5 * (i * 0.15) })); // closing at 5 m/s
  assert.ok(Math.abs(closingSpeed(hist) - 5) < 0.05);
  assert.equal(closingSpeed(hist.slice(0, 3)), null);
});

test('Tracker confirms after two sightings, keeps ids, and drops lost tracks', () => {
  const tk = new Tracker({ maxMissed: 2 });
  const d = (x) => ({ x1: x, y1: 100, x2: x + 60, y2: 140, cls: CAR, score: 0.8, dist: 20 });
  assert.equal(tk.update([d(100)], 0).length, 0);
  const t2 = tk.update([d(104)], 100);
  assert.equal(t2.length, 1);
  const id = t2[0].id;
  assert.equal(tk.update([d(108)], 200)[0].id, id);
  tk.update([], 300); tk.update([], 400); tk.update([], 500);
  assert.equal(tk.tracks.length, 0);
});

// Synthetic road: grey asphalt with two white lane lines converging on a vanishing point.
function road(w, h, { shift = 0 } = {}) {
  const g = new Uint8Array(w * h).fill(70);
  const vx = w / 2 + shift, vy = h * 0.4;
  for (let y = Math.floor(vy) + 1; y < h; y++) {
    const t = (y - vy) / (h * 0.95 - vy);
    for (const side of [-1, 1]) {
      const x = Math.round(vx + side * t * w * 0.28);
      const half = Math.max(1, Math.round(1 + t * 2));
      for (let k = -half; k <= half; k++) if (x + k >= 0 && x + k < w) g[y * w + x + k] = 230;
    }
  }
  return g;
}

test('detectLanes finds both lines of a centred lane with ~zero offset', () => {
  const w = 192, h = 108;
  const lane = detectLanes(road(w, h), w, h);
  assert.ok(lane.left && lane.right, 'both lines');
  assert.ok(lane.conf > 0.3, `conf ${lane.conf}`);
  assert.ok(Math.abs(lane.offset) < 0.06, `offset ${lane.offset}`);
  assert.ok(Math.abs(lane.width - w * 0.56) < w * 0.06, `width ${lane.width}`);
});

test('detectLanes reports the car right of centre when the lane sits to the left', () => {
  const w = 192, h = 108;
  const lane = detectLanes(road(w, h, { shift: -24 }), w, h);
  assert.ok(lane.offset > 0.12, `offset ${lane.offset}`);
});

test('detectLanes returns no lane on featureless frames', () => {
  const w = 160, h = 90;
  const lane = detectLanes(new Uint8Array(w * h).fill(100), w, h);
  assert.equal(lane.offset, null);
  assert.equal(lane.conf, 0);
});

test('LaneMonitor: sustained drift warns, centred driving stays quiet', () => {
  const m = new LaneMonitor();
  const L = (o) => ({ offset: o, conf: 0.8 });
  let ev = null;
  for (let t = 0; t <= 1000; t += 100) ev = m.update(L(0.05), t) || ev;
  assert.equal(ev, null);
  for (let t = 1100; t <= 2000; t += 100) ev = m.update(L(0.42), t) || ev;
  assert.deepEqual(ev, { type: 'drift', side: 'right' });
});

test('LaneMonitor: offset jump across centre means a completed lane change', () => {
  const m = new LaneMonitor();
  const L = (o) => ({ offset: o, conf: 0.8 });
  m.update(L(0.3), 0);
  const ev = m.update(L(-0.45), 150);
  assert.deepEqual(ev, { type: 'change', side: 'right' });
  assert.equal(m.update({ offset: null, conf: 0 }, 300), null); // unreliable frames never alert
});

test('classifyLight picks the dominant lit colour', () => {
  const patch = (rgb, n) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([...rgb, 255], i * 4); return a; };
  assert.equal(classifyLight(patch([240, 40, 40], 30)), 'red');
  assert.equal(classifyLight(patch([250, 190, 40], 30)), 'amber');
  assert.equal(classifyLight(patch([40, 230, 120], 30)), 'green');
  assert.equal(classifyLight(patch([90, 90, 90], 30)), 'unknown');
});

function track(over) {
  return { id: 1, cls: CAR, x1: 290, x2: 350, y1: 250, y2: 300, dist: 30, closing: 0, hist: [], missed: 0, seen: 5, ...over };
}

test('evaluate: lead car at 0.8 s headway raises a danger alert and fills the HUD', () => {
  const { hud, alerts } = evaluate({ tracks: [track({ dist: 16 })], ego: { speed: 20 }, lane: null, frame });
  assert.equal(alerts[0].key, 'fcwDanger');
  assert.equal(alerts[0].level, 'danger');
  assert.ok(Math.abs(hud.lead.headway - 0.8) < 1e-9);
  assert.ok(Math.abs(hud.egoKmh - 72) < 1e-9);
});

test('evaluate: low time-to-collision from closing speed is danger even with unknown ego speed', () => {
  const { alerts, hud } = evaluate({ tracks: [track({ dist: 20, closing: 10 })], ego: { speed: null }, lane: null, frame });
  assert.equal(alerts[0].key, 'fcwDanger');
  assert.equal(hud.lead.kmh, null);
});

test('evaluate: safe following distance is silent and shows lead speed', () => {
  const { alerts, hud } = evaluate({ tracks: [track({ dist: 60, closing: 2 })], ego: { speed: 20 }, lane: null, frame });
  assert.equal(alerts.length, 0);
  assert.ok(Math.abs(hud.lead.kmh - 64.8) < 1e-6); // (20 - 2) m/s
});

test('evaluate: a car in the next lane is not the lead vehicle', () => {
  const side = track({ x1: 520, x2: 600, dist: 8 });
  const { alerts, hud } = evaluate({ tracks: [side], ego: { speed: 20 }, lane: null, frame });
  assert.equal(hud.lead, null);
  assert.equal(alerts.length, 0);
});

test('evaluate: pedestrian, animal, red light, stop sign and lane events', () => {
  const tracks = [
    track({ id: 2, cls: PERSON, dist: 8 }),
    track({ id: 3, cls: DOG, dist: 30, x1: 300, x2: 330 }),
    track({ id: 4, cls: LIGHT, dist: 40, x1: 300, x2: 320 }),
  ];
  const { alerts } = evaluate({ tracks, ego: { speed: 10 }, lane: null, laneEvent: { type: 'change', side: 'left' }, frame, lightColors: new Map([[4, 'red']]) });
  const keys = alerts.map((a) => a.key);
  assert.deepEqual(keys.slice(0, 2), ['pedestrian', 'animal']);
  assert.ok(keys.includes('redLight') && keys.includes('changeLeft'));
  assert.equal(alerts[0].level, 'danger');
});

test('inCorridor uses fitted lane lines when confident, scaled from the lane canvas', () => {
  const lane = { left: { a: 20, b: -0.5 }, right: { a: 100, b: 0.5 }, conf: 0.9 };
  const f = { w: 640, h: 480, laneW: 160, laneH: 120 };
  // At lane y = 100: xl = -30 -> clipped logic still compares in frame px; pick a clear inside/outside case.
  const lane2 = { left: { a: 40, b: 0 }, right: { a: 120, b: 0 }, conf: 0.9 }; // vertical lines at x=40 and 120 (lane px)
  assert.equal(inCorridor({ x1: 220, x2: 300, y2: 300 }, f, lane2), true); // cx=260 within 160..480
  assert.equal(inCorridor({ x1: 520, x2: 600, y2: 300 }, f, lane2), false);
  assert.equal(inCorridor({ x1: 280, x2: 360, y2: 300 }, f, null), true); // fallback corridor
  void lane;
});

test('AlertGate throttles repeats, re-fires on escalation and after cooldown', () => {
  const g = new AlertGate(1000);
  const warn = { key: 'headway', level: 'warn', rank: 2 }, danger = { key: 'headway', level: 'danger', rank: 3 };
  assert.equal(g.pick([warn], 0), warn);
  assert.equal(g.pick([warn], 500), null);
  assert.equal(g.pick([danger], 600), danger);
  assert.equal(g.pick([danger], 1200), null);
  assert.equal(g.pick([danger], 1700), danger);
});

test('alert text exists in all four app languages and falls back to English', () => {
  for (const l of ['ms', 'en', 'zh', 'ta']) assert.ok(alertText('fcwDanger', l).length > 2);
  assert.equal(alertText('fcwDanger', 'xx'), alertText('fcwDanger', 'en'));
});
