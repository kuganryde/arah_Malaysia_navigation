// ar-vision v0.2.0
// Pure, DOM-free logic for the ARAH AR driving assistant: YOLOX decoding, NMS, tracking,
// monocular distance, closing speed, lane finding and the alert rules. Everything here is
// deterministic and unit-tested (test/ar-core.test.mjs); the camera, WebGL and UI live in arah-ar.js.
//
// SAFETY NOTE: every estimate here comes from one phone camera. Treat distance as +/-25%,
// speed as indicative, and never present any of it as a collision-avoidance system.

export const SIZE = 416; // YOLOX-nano input edge
export const STRIDES = [8, 16, 32];

// COCO-80 order used by the shipped YOLOX model.
export const COCO = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush',
];

const C = Object.fromEntries(COCO.map((n, i) => [n, i]));
export const GROUP = {
  vehicle: new Set([C.car, C.motorcycle, C.bus, C.truck]),
  vulnerable: new Set([C.person, C.bicycle, C.motorcycle]),
  animal: new Set([C.cat, C.dog, C.horse, C.sheep, C.cow, C.elephant, C.bear, C.zebra, C.giraffe]),
  trafficLight: new Set([C['traffic light']]),
  stopSign: new Set([C['stop sign']]),
};
// Classes we draw and track. Everything else the model can see is ignored: less noise, less work.
export const TRACKED = new Set([...GROUP.vehicle, ...GROUP.vulnerable, ...GROUP.animal, ...GROUP.trafficLight, ...GROUP.stopSign]);

// Typical real-world [width, height] in metres, used for pinhole distance. Rider included for two-wheelers.
export const REAL_SIZE = {
  [C.person]: [0.5, 1.7], [C.bicycle]: [0.6, 1.7], [C.motorcycle]: [0.8, 1.5], [C.car]: [1.8, 1.5],
  [C.bus]: [2.5, 3.2], [C.truck]: [2.5, 3.0], [C.cat]: [0.25, 0.3], [C.dog]: [0.3, 0.55], [C.horse]: [0.7, 1.6],
  [C.sheep]: [0.5, 0.9], [C.cow]: [0.8, 1.4], [C.elephant]: [2.0, 2.8], [C.bear]: [0.8, 1.2],
  [C.zebra]: [0.7, 1.4], [C.giraffe]: [0.9, 4.0], [C['traffic light']]: [0.35, 1.0], [C['stop sign']]: [0.75, 0.75],
};

export const CONFIG = Object.freeze({
  scoreThr: 0.35, // detection confidence floor
  nmsIou: 0.45,
  hfovDeg: 65, // typical phone main camera; user can calibrate in the UI
  maxDistance: 120, // metres; beyond this a single-camera estimate is noise
  corridorHalf: 0.2, // fraction of frame width either side of centre treated as "my lane" when no lane lines
  headwayWarn: 2.0, // seconds (the "two-second rule")
  headwayDanger: 1.0,
  ttcWarn: 4.0, // seconds
  ttcDanger: 2.5,
  vruWarnM: 25, // pedestrian / rider ahead inside the corridor
  vruDangerM: 10,
  animalWarnM: 40,
  driftOffset: 0.35, // fraction of lane width from centre
  driftSeconds: 0.6,
  laneJump: 0.6, // sudden re-centring jump that means a lane change completed
  alertCooldownMs: 4000,
});

/* ------------------------------------------------------------------ geometry / decoding */

export function letterbox(w, h, size = SIZE) {
  const r = Math.min(size / w, size / h);
  return { r, nw: Math.round(w * r), nh: Math.round(h * r) };
}

let gridCache = null;
export function grids(size = SIZE, strides = STRIDES) {
  if (gridCache && gridCache.size === size) return gridCache;
  let n = 0;
  for (const s of strides) n += (size / s) ** 2;
  const gx = new Float32Array(n), gy = new Float32Array(n), st = new Float32Array(n);
  let k = 0;
  for (const s of strides) {
    const g = size / s;
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) { gx[k] = x; gy[k] = y; st[k] = s; k++; }
  }
  gridCache = { size, n, gx, gy, st };
  return gridCache;
}

/** Fill a CHW float tensor in BGR 0..255 order (what YOLOX COCO weights expect) from RGBA pixels. */
export function toCHW_BGR(rgba, size, out) {
  const plane = size * size;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    out[i] = rgba[p + 2]; // B
    out[plane + i] = rgba[p + 1]; // G
    out[2 * plane + i] = rgba[p]; // R
  }
  return out;
}

/**
 * Decode raw YOLOX output [N, 5 + nCls] (xy/wh raw, objectness and class already sigmoided) into boxes
 * in model-input pixels. Rejects on objectness first because score <= obj; that keeps this cheap.
 */
export function decodeYolox(out, { size = SIZE, nCls = 80, scoreThr = CONFIG.scoreThr, only = TRACKED } = {}) {
  const g = grids(size);
  const stride = 5 + nCls;
  if (!out || out.length < g.n * stride) throw new Error('unexpected YOLOX output length');
  const res = [];
  for (let i = 0; i < g.n; i++) {
    const o = i * stride;
    const obj = out[o + 4];
    if (!(obj >= scoreThr)) continue;
    let best = -1, bs = 0;
    for (let c = 0; c < nCls; c++) {
      const s = out[o + 5 + c];
      if (s > bs) { bs = s; best = c; }
    }
    const score = obj * bs;
    if (best < 0 || score < scoreThr || (only && !only.has(best))) continue;
    const s = g.st[i];
    const cx = (out[o] + g.gx[i]) * s, cy = (out[o + 1] + g.gy[i]) * s;
    const w = Math.exp(Math.min(out[o + 2], 10)) * s, h = Math.exp(Math.min(out[o + 3], 10)) * s; // clamp: no Infinity from a bad frame
    res.push({ x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2, score, cls: best });
  }
  return res;
}

export function iou(a, b) {
  const iw = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const ih = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  if (iw <= 0 || ih <= 0) return 0;
  const inter = iw * ih;
  return inter / ((a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter);
}

export function nms(boxes, thr = CONFIG.nmsIou) {
  const sorted = [...boxes].sort((a, b) => b.score - a.score);
  const keep = [];
  for (const b of sorted) if (keep.every((k) => k.cls !== b.cls || iou(k, b) < thr)) keep.push(b);
  return keep;
}

/** Model-input boxes -> source frame pixels (undo letterbox), clamped to the frame. */
export function toFrame(boxes, frameW, frameH, size = SIZE) {
  const { r } = letterbox(frameW, frameH, size);
  const cl = (v, m) => Math.max(0, Math.min(m, v));
  return boxes.map((b) => ({ ...b, x1: cl(b.x1 / r, frameW), y1: cl(b.y1 / r, frameH), x2: cl(b.x2 / r, frameW), y2: cl(b.y2 / r, frameH) }));
}

/* ------------------------------------------------------------------ distance / speed */

/**
 * Pinhole distance from apparent size. A box touching the frame edge is truncated, so we then trust
 * only the dimension that is not cut. Camera pitch and lens distortion are ignored on purpose.
 */
export function estimateDistance(box, frame, hfovDeg = CONFIG.hfovDeg) {
  const real = REAL_SIZE[box.cls];
  if (!real) return null;
  const f = frame.w / (2 * Math.tan((hfovDeg * Math.PI) / 360));
  const w = box.x2 - box.x1, h = box.y2 - box.y1;
  if (w < 4 || h < 4) return null;
  const cutSide = box.x1 <= 1 || box.x2 >= frame.w - 1;
  const cutBottom = box.y2 >= frame.h - 1;
  const cutTop = box.y1 <= 1;
  let d;
  if (cutSide && !(cutBottom || cutTop)) d = (f * real[1]) / h;
  else if ((cutBottom || cutTop) && !cutSide) d = (f * real[0]) / w;
  else if (cutSide && (cutBottom || cutTop)) d = Math.min((f * real[1]) / h, (f * real[0]) / w);
  else d = f * Math.sqrt((real[0] * real[1]) / (w * h)); // geometric mean of both estimates
  return Math.max(1, Math.min(CONFIG.maxDistance, d));
}

/** Haversine speed (m/s) between two GPS fixes {lat, lon, t(ms)}; fallback when coords.speed is null. */
export function speedFromFixes(a, b) {
  const dt = (b.t - a.t) / 1000;
  if (!(dt > 0.2)) return null;
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / dt;
}

/* ------------------------------------------------------------------ tracking */

export class Tracker {
  constructor({ maxMissed = 5, iouMin = 0.25, histMs = 1500 } = {}) {
    this.maxMissed = maxMissed; this.iouMin = iouMin; this.histMs = histMs;
    this.tracks = []; this.nextId = 1;
  }

  /** dets: frame-pixel boxes with .dist (m, may be null). t: ms timestamp. */
  update(dets, t) {
    const used = new Set();
    for (const tr of this.tracks) {
      let best = null, bi = this.iouMin;
      dets.forEach((d, i) => {
        if (used.has(i) || d.cls !== tr.cls) return;
        const v = iou(tr, d);
        if (v > bi) { bi = v; best = i; }
      });
      if (best === null) { tr.missed++; continue; }
      used.add(best);
      const d = dets[best];
      Object.assign(tr, { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, score: d.score, missed: 0, seen: tr.seen + 1 });
      if (d.color) tr.color = d.color;
      if (d.dist != null) {
        tr.dist = tr.dist == null ? d.dist : tr.dist * 0.6 + d.dist * 0.4; // EMA: single-frame size jitter is large
        tr.hist.push({ t, d: tr.dist });
      }
      while (tr.hist.length && t - tr.hist[0].t > this.histMs) tr.hist.shift();
      tr.closing = closingSpeed(tr.hist);
    }
    dets.forEach((d, i) => {
      if (used.has(i)) return;
      const tr = { id: this.nextId++, cls: d.cls, x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, score: d.score, missed: 0, seen: 1, dist: d.dist ?? null, hist: [], closing: null, color: d.color || null };
      if (d.dist != null) tr.hist.push({ t, d: d.dist });
      this.tracks.push(tr);
    });
    this.tracks = this.tracks.filter((tr) => tr.missed <= this.maxMissed);
    return this.tracks.filter((tr) => tr.missed === 0 && tr.seen >= 2); // confirmed after two sightings: kills one-frame ghosts
  }
}

/** Closing speed in m/s (positive = getting closer) from a least-squares slope; null if too little data. */
export function closingSpeed(hist) {
  if (hist.length < 4) return null;
  const span = hist[hist.length - 1].t - hist[0].t;
  if (span < 500) return null;
  const n = hist.length, t0 = hist[0].t;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of hist) { const x = (p.t - t0) / 1000; sx += x; sy += p.d; sxx += x * x; sxy += x * p.d; }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return null;
  return -((n * sxy - sx * sy) / den);
}

/* ------------------------------------------------------------------ lanes */

/** Tiny deterministic PRNG so lane fitting is reproducible in tests. */
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/**
 * Find the two lane lines in the lower part of a grayscale frame (g: Uint8 w*h).
 * Scans rows for bright thin stripes (dark->bright->dark), then RANSAC-fits x = a + b*y per side.
 * Returns {left, right, center, width, offset, conf}. offset > 0 means the car sits right of lane centre.
 */
export function detectLanes(g, w, h, { y0 = 0.58, y1 = 0.95, step = 3, minContrast = 22, seed = 7 } = {}) {
  const pts = [];
  const ya = Math.floor(h * y0), yb = Math.floor(h * y1);
  for (let y = ya; y <= yb; y += step) {
    const frac = (y - ya) / Math.max(1, yb - ya);
    const maxW = Math.max(2, Math.round(w * (0.012 + 0.05 * frac))); // marking widens toward the bottom (perspective)
    const row = y * w;
    for (let x = 2; x < w - 2; x++) {
      if (g[row + x + 1] - g[row + x - 1] < minContrast) continue;
      for (let k = 1; k <= maxW && x + k < w - 2; k++) {
        if (g[row + x + k + 1] - g[row + x + k - 1] <= -minContrast) { pts.push({ x: x + k / 2, y }); x += k; break; }
      }
    }
  }
  const rows = Math.max(1, Math.floor((yb - ya) / step) + 1);
  const rnd = lcg(seed);
  const fit = (cands, sign) => {
    if (cands.length < 6) return null;
    let best = null;
    const tol = Math.max(2, w * 0.018);
    for (let it = 0; it < 60; it++) {
      const p = cands[Math.floor(rnd() * cands.length)], q = cands[Math.floor(rnd() * cands.length)];
      if (Math.abs(p.y - q.y) < 6) continue;
      const b = (q.x - p.x) / (q.y - p.y);
      if (Math.sign(b) !== sign || Math.abs(b) < 0.2 || Math.abs(b) > 3) continue; // left lines lean left going down, right lines right
      const a = p.x - b * p.y;
      let n = 0;
      for (const c of cands) if (Math.abs(c.x - (a + b * c.y)) <= tol) n++;
      if (!best || n > best.n) best = { a, b, n };
    }
    if (!best || best.n < 6) return null;
    const inl = cands.filter((c) => Math.abs(c.x - (best.a + best.b * c.y)) <= tol);
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const c of inl) { sx += c.y; sy += c.x; sxx += c.y * c.y; sxy += c.y * c.x; }
    const n = inl.length, den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) return null;
    const b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n;
    return { a, b, conf: Math.min(1, n / (rows * 0.7)) };
  };
  const cx = w / 2;
  const left = fit(pts.filter((p) => p.x < cx), -1);
  const right = fit(pts.filter((p) => p.x > cx), 1);
  const out = { left, right, center: null, width: null, offset: null, conf: 0 };
  if (left && right) {
    const y = h * y1;
    const xl = left.a + left.b * y, xr = right.a + right.b * y;
    const width = xr - xl;
    if (width > w * 0.3 && width < w * 1.05 && xr > xl) {
      out.center = (xl + xr) / 2; out.width = width;
      out.offset = (cx - out.center) / width;
      out.conf = Math.min(left.conf, right.conf);
    }
  }
  return out;
}

/** Remember lane offset over time and turn it into drift / lane-change events. */
export class LaneMonitor {
  constructor(cfg = CONFIG) { this.cfg = cfg; this.last = null; this.driftSince = null; }

  /** @returns {null|{type:'drift'|'change', side:'left'|'right'}} */
  update(lane, t) {
    if (!lane || lane.offset == null || lane.conf < 0.25) { this.driftSince = null; return null; }
    const o = lane.offset;
    let ev = null;
    if (this.last && t - this.last.t < 800) {
      // After a lane change the detector re-centres on the new lane, so the offset jumps by ~1 lane.
      if (Math.abs(o - this.last.o) > this.cfg.laneJump && Math.sign(o) !== Math.sign(this.last.o)) {
        ev = { type: 'change', side: this.last.o > 0 ? 'right' : 'left' };
        this.driftSince = null;
      }
    }
    if (!ev) {
      if (Math.abs(o) > this.cfg.driftOffset) {
        this.driftSince ??= t;
        if (t - this.driftSince >= this.cfg.driftSeconds * 1000) ev = { type: 'drift', side: o > 0 ? 'right' : 'left' };
      } else this.driftSince = null;
    }
    this.last = { o, t };
    return ev;
  }
}

/* ------------------------------------------------------------------ traffic light colour */

/** Classify a small RGBA patch of a traffic light as red / amber / green / unknown. */
export function classifyLight(rgba, minPixels = 3) {
  let r = 0, a = 0, gr = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const R = rgba[i], G = rgba[i + 1], B = rgba[i + 2];
    if (R > 190 && G < 120 && B < 120) r++;
    else if (R > 210 && G > 150 && B < 100) a++;
    else if (G > 170 && R < 150 && B > 80 && B < 230) gr++;
  }
  const m = Math.max(r, a, gr);
  if (m < minPixels) return 'unknown';
  return m === r ? 'red' : m === a ? 'amber' : 'green';
}

/* ------------------------------------------------------------------ alert rules */

const TEXT = {
  fcwDanger: { ms: 'Awas! Terlalu dekat', en: 'Too close! Brake', zh: '太近了！请刹车', ta: 'மிக அருகில்! பிரேக் செய்யுங்கள்' },
  headway: { ms: 'Jarak terlalu rapat', en: 'Following too closely', zh: '跟车过近', ta: 'மிக நெருக்கமாக பின்தொடர்கிறீர்கள்' },
  pedestrian: { ms: 'Pejalan kaki di hadapan', en: 'Pedestrian ahead', zh: '前方有行人', ta: 'முன்னால் பாதசாரி' },
  rider: { ms: 'Penunggang di hadapan', en: 'Rider ahead', zh: '前方有骑行者', ta: 'முன்னால் ஓட்டுநர்' },
  animal: { ms: 'Haiwan di jalan', en: 'Animal on road', zh: '路上有动物', ta: 'சாலையில் விலங்கு' },
  driftLeft: { ms: 'Terkeluar lajur ke kiri', en: 'Drifting left', zh: '向左偏离车道', ta: 'இடப்புறம் விலகல்' },
  driftRight: { ms: 'Terkeluar lajur ke kanan', en: 'Drifting right', zh: '向右偏离车道', ta: 'வலப்புறம் விலகல்' },
  changeLeft: { ms: 'Tukar lajur ke kiri', en: 'Lane change left', zh: '向左变道', ta: 'இடப்புறம் பாதை மாற்றம்' },
  changeRight: { ms: 'Tukar lajur ke kanan', en: 'Lane change right', zh: '向右变道', ta: 'வலப்புறம் பாதை மாற்றம்' },
  redLight: { ms: 'Lampu merah di hadapan', en: 'Red light ahead', zh: '前方红灯', ta: 'முன்னால் சிவப்பு விளக்கு' },
  stopSign: { ms: 'Papan tanda berhenti', en: 'Stop sign ahead', zh: '前方停车标志', ta: 'முன்னால் நிறுத்தக் குறி' },
};
export const alertText = (key, lang = 'en') => (TEXT[key] || TEXT.headway)[lang] || TEXT[key]?.en || key;

const LEVEL = { info: 1, warn: 2, danger: 3 };

/** Is this box inside "my lane"? Uses fitted lane lines when we have them, else a centred corridor. */
export function inCorridor(box, frame, lane, cfg = CONFIG) {
  const cx = (box.x1 + box.x2) / 2;
  if (lane && lane.left && lane.right && lane.conf > 0.25) {
    const lw = frame.laneW || frame.w, lh = frame.laneH || frame.h; // lane fit lives in the (smaller) lane canvas
    const yFrame = box.y2 * (lh / frame.h);
    const xl = (lane.left.a + lane.left.b * yFrame) * (frame.w / lw);
    const xr = (lane.right.a + lane.right.b * yFrame) * (frame.w / lw);
    if (xr > xl) return cx > xl - 0.05 * (xr - xl) && cx < xr + 0.05 * (xr - xl);
  }
  return Math.abs(cx / frame.w - 0.5) < cfg.corridorHalf;
}

/**
 * Turn tracks + ego speed + lane state into a HUD summary and a priority-ordered alert list.
 * ego: { speed: m/s | null }. lightColors: Map(trackId -> colour). laneEvent from LaneMonitor.
 */
export function evaluate({ tracks, ego, lane, laneEvent, frame, lightColors = new Map(), cfg = CONFIG }) {
  const alerts = [];
  const add = (key, level, id) => alerts.push({ key, level, id, rank: LEVEL[level] });
  const egoV = ego && ego.speed != null ? ego.speed : null;

  let lead = null;
  for (const t of tracks) {
    if (t.dist == null || !GROUP.vehicle.has(t.cls) || !inCorridor(t, frame, lane, cfg)) continue;
    if (!lead || t.dist < lead.dist) lead = t;
  }
  const hud = { egoKmh: egoV == null ? null : egoV * 3.6, lead: null, lane: lane && lane.offset != null ? lane.offset : null, count: tracks.length };

  if (lead) {
    const closing = lead.closing; // m/s, + closing
    const headway = egoV != null && egoV > 2 ? lead.dist / egoV : null;
    const ttc = closing != null && closing > 0.5 ? lead.dist / closing : null;
    const leadV = egoV != null && closing != null ? Math.max(0, egoV - closing) : null;
    hud.lead = { id: lead.id, dist: lead.dist, headway, ttc, kmh: leadV == null ? null : leadV * 3.6, closing };
    if ((ttc != null && ttc < cfg.ttcDanger) || (headway != null && headway < cfg.headwayDanger)) add('fcwDanger', 'danger', lead.id);
    else if ((ttc != null && ttc < cfg.ttcWarn) || (headway != null && headway < cfg.headwayWarn)) add('headway', 'warn', lead.id);
  }

  for (const t of tracks) {
    if (t.dist == null) continue;
    const inLane = inCorridor(t, frame, lane, cfg);
    if (GROUP.vulnerable.has(t.cls) && !GROUP.vehicle.has(t.cls) && inLane) {
      const lvl = t.dist < cfg.vruDangerM ? 'danger' : t.dist < cfg.vruWarnM ? 'warn' : null;
      if (lvl) add(t.cls === 0 ? 'pedestrian' : 'rider', lvl, t.id);
    }
    if (t.cls === 3 && inLane && t.dist < cfg.vruWarnM && !(lead && lead.id === t.id)) add('rider', 'warn', t.id);
    if (GROUP.animal.has(t.cls) && inLane && t.dist < cfg.animalWarnM) add('animal', t.dist < 15 ? 'danger' : 'warn', t.id);
    if (GROUP.trafficLight.has(t.cls) && lightColors.get(t.id) === 'red' && Math.abs((t.x1 + t.x2) / 2 / frame.w - 0.5) < 0.35) add('redLight', 'info', t.id);
    if (GROUP.stopSign.has(t.cls) && t.dist < 60) add('stopSign', 'info', t.id);
  }

  if (laneEvent) {
    if (laneEvent.type === 'drift') add(laneEvent.side === 'left' ? 'driftLeft' : 'driftRight', 'warn', 0);
    else add(laneEvent.side === 'left' ? 'changeLeft' : 'changeRight', 'info', 0);
  }

  alerts.sort((a, b) => b.rank - a.rank);
  return { hud, alerts };
}

/** Throttle repeated alerts: the same key re-fires only after cooldown, unless it escalated. */
export class AlertGate {
  constructor(cooldownMs = CONFIG.alertCooldownMs) { this.cd = cooldownMs; this.seen = new Map(); }
  pick(alerts, now) {
    for (const a of alerts) {
      const prev = this.seen.get(a.key);
      if (!prev || now - prev.t > this.cd || a.rank > prev.rank) {
        this.seen.set(a.key, { t: now, rank: a.rank });
        return a;
      }
    }
    return null;
  }
}
