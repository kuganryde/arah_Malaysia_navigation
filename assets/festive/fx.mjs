// festive v0.1.0
// Festival graphics, drawn in code (original vector shapes, no image files) plus a small particle engine.
// Everything draws into a 2D canvas context; no DOM and no network, so the shapes can be tested with a fake context.
const TAU = Math.PI * 2;

/* ---------- shape drawers: (ctx, x, y, s, c1, c2, t) where s is the size in px and t is seconds for animation */
export const SHAPES = {
  lantern(ctx, x, y, s, c1, c2) { // Chinese lantern: rounded body, gold caps, tassel
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = c2; ctx.fillRect(-s * 0.18, -s * 0.62, s * 0.36, s * 0.1); ctx.fillRect(-s * 0.18, s * 0.5, s * 0.36, s * 0.1);
    const g = ctx.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 0.6); g.addColorStop(0, c2); g.addColorStop(0.35, c1); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = c2; ctx.globalAlpha *= 0.55; ctx.lineWidth = Math.max(1, s * 0.04);
    for (const k of [-0.3, 0, 0.3]) { ctx.beginPath(); ctx.ellipse(0, 0, s * (0.5 - Math.abs(k) * 0.4) * (k ? 0.55 : 0.2), s * 0.42, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha /= 0.55; ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath(); ctx.moveTo(0, s * 0.6); ctx.lineTo(0, s * 0.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, s * 0.98, s * 0.05, 0, TAU); ctx.fillStyle = c2; ctx.fill(); ctx.restore();
  },
  crescent(ctx, x, y, s, c1) { // crescent and a small star
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.5, 0.35 * Math.PI, 1.65 * Math.PI, false); ctx.arc(s * 0.16, 0, s * 0.4, 1.6 * Math.PI, 0.4 * Math.PI, true); ctx.closePath(); ctx.fill();
    SHAPES.star(ctx, s * 0.34, -s * 0.05, s * 0.3, c1, c1, 0, 5); ctx.restore();
  },
  star(ctx, x, y, s, c1, c2, t, n = 5) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = c1; ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = (i % 2 ? 0.22 : 0.5) * s * (n > 8 ? 1.15 : 1), a = (i * Math.PI) / n - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  },
  star14(ctx, x, y, s, c1, c2, t) { SHAPES.star(ctx, x, y, s, c1, c2, t, 14); }, // the 14-point star of the federal arms
  ketupat(ctx, x, y, s, c1, c2) { // woven rice-dumpling diamond with a tassel
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.42, 0); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s * 0.42, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1, s * 0.05); ctx.globalAlpha *= 0.8;
    for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(-s * 0.42 * (1 - Math.abs(k)), s * 0.5 * k); ctx.lineTo(s * 0.42 * (1 - Math.abs(k)), s * 0.5 * k); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-s * 0.21, -s * 0.25); ctx.lineTo(s * 0.21, s * 0.25); ctx.moveTo(s * 0.21, -s * 0.25); ctx.lineTo(-s * 0.21, s * 0.25); ctx.stroke(); ctx.globalAlpha /= 0.8;
    ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.lineTo(0, s * 0.85); ctx.stroke(); ctx.restore();
  },
  pelita(ctx, x, y, s, c1, c2, t) { // oil lamp with a flickering flame
    ctx.save(); ctx.translate(x, y); const f = 1 + 0.12 * Math.sin(t * 9 + x);
    ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(-s * 0.3, 0); ctx.quadraticCurveTo(0, s * 0.45, s * 0.3, 0); ctx.closePath(); ctx.fill();
    flame(ctx, 0, -s * 0.05, s * 0.28 * f, c2); ctx.restore();
  },
  diya(ctx, x, y, s, c1, c2, t) { // clay lamp: shallow bowl, bright flame
    ctx.save(); ctx.translate(x, y); const f = 1 + 0.14 * Math.sin(t * 8 + y);
    ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.45, s * 0.16, 0, 0, Math.PI); ctx.lineTo(s * 0.45, 0); ctx.quadraticCurveTo(0, -s * 0.12, -s * 0.45, 0); ctx.fill();
    flame(ctx, 0, -s * 0.06, s * 0.3 * f, c2); ctx.restore();
  },
  marigold(ctx, x, y, s, c1, c2, t) { // layered petals
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.3);
    for (let ring = 0; ring < 2; ring++) { ctx.fillStyle = ring ? c2 : c1; for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate((i / 10) * TAU + ring * 0.3); ctx.beginPath(); ctx.ellipse(0, -s * (0.34 - ring * 0.14), s * 0.1 * (1 - ring * 0.2), s * (0.18 - ring * 0.05), 0, 0, TAU); ctx.fill(); ctx.restore(); } }
    ctx.restore();
  },
  hibiscus(ctx, x, y, s, c1, c2, t) { // bunga raya: five petals, long stamen
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t) * 0.1);
    ctx.fillStyle = c1; for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate((i / 5) * TAU); ctx.beginPath(); ctx.ellipse(0, -s * 0.28, s * 0.2, s * 0.3, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1, s * 0.05); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.12, -s * 0.34); ctx.stroke(); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(s * 0.12, -s * 0.36, s * 0.05, 0, TAU); ctx.fill(); ctx.restore();
  },
  lotus(ctx, x, y, s, c1, c2) { // layered pointed petals
    ctx.save(); ctx.translate(x, y);
    for (const [k, c] of [[-0.55, c1], [0.55, c1], [0, c2]]) { ctx.save(); ctx.rotate(k); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.28, -s * 0.2, 0, -s * 0.55); ctx.quadraticCurveTo(-s * 0.28, -s * 0.2, 0, 0); ctx.fill(); ctx.restore(); }
    ctx.restore();
  },
  coin(ctx, x, y, s, c1, c2) { // gold coin with a square hole
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = c2 || c1; ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = c1; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke(); ctx.fillStyle = c1; ctx.fillRect(-s * 0.1, -s * 0.1, s * 0.2, s * 0.2); ctx.restore();
  },
  blossom(ctx, x, y, s, c1, c2, t) { // plum blossom
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.4); ctx.fillStyle = c1; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(Math.cos((i / 5) * TAU) * s * 0.22, Math.sin((i / 5) * TAU) * s * 0.22, s * 0.2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, TAU); ctx.fill(); ctx.restore();
  },
  paddy(ctx, x, y, s, c1, c2) { // rice stalk heavy with grain
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c1; ctx.lineWidth = Math.max(1, s * 0.06); ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.quadraticCurveTo(s * 0.1, 0, s * 0.3, -s * 0.4); ctx.stroke();
    ctx.fillStyle = c2; for (let i = 0; i < 6; i++) { const u = i / 5; ctx.beginPath(); ctx.ellipse(s * (0.12 + 0.18 * u) + (i % 2 ? s * 0.06 : -s * 0.06), -s * (0.05 + 0.35 * u), s * 0.05, s * 0.1, 0.5, 0, TAU); ctx.fill(); } ctx.restore();
  },
  sparkle(ctx, x, y, s, c1, c2, t) { // four-point twinkle
    const k = 0.6 + 0.4 * Math.sin(t * 3 + x * 0.1); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = c1; ctx.beginPath();
    ctx.moveTo(0, -s * 0.5); ctx.quadraticCurveTo(0, 0, s * 0.5, 0); ctx.quadraticCurveTo(0, 0, 0, s * 0.5); ctx.quadraticCurveTo(0, 0, -s * 0.5, 0); ctx.quadraticCurveTo(0, 0, 0, -s * 0.5); ctx.fill(); ctx.restore();
  },
  snow(ctx, x, y, s, c1, c2, t) { // six-arm snowflake
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.5 + x); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.4, 0); ctx.stroke(); } ctx.restore();
  },
  bauble(ctx, x, y, s, c1, c2) { // hanging bauble
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = c2; ctx.fillRect(-s * 0.08, -s * 0.5, s * 0.16, s * 0.12);
    const g = ctx.createRadialGradient(-s * 0.12, -s * 0.05, s * 0.03, 0, 0, s * 0.42); g.addColorStop(0, '#fff'); g.addColorStop(0.25, c1); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, TAU); ctx.fill(); ctx.restore();
  },
  moon(ctx, x, y, s, c1) { const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.6); g.addColorStop(0, c1); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, TAU); ctx.fill(); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, s * 0.32, 0, TAU); ctx.fill(); },
  vel(ctx, x, y, s, c1, c2) { // the vel (spear): leaf blade on a shaft
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = c2; ctx.lineWidth = Math.max(1, s * 0.06); ctx.beginPath(); ctx.moveTo(0, s * 0.6); ctx.lineTo(0, -s * 0.1); ctx.stroke();
    ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(0, -s * 0.62); ctx.quadraticCurveTo(s * 0.26, -s * 0.34, 0, -s * 0.06); ctx.quadraticCurveTo(-s * 0.26, -s * 0.34, 0, -s * 0.62); ctx.fill(); ctx.restore();
  },
  rangoli(ctx, x, y, s, c1, c2, t) { // geometric kolam / rangoli rosette
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.15);
    for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate((i / 8) * TAU); ctx.fillStyle = i % 2 ? c1 : c2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.18, -s * 0.2, 0, -s * 0.5); ctx.quadraticCurveTo(-s * 0.18, -s * 0.2, 0, 0); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, 0, s * 0.08, 0, TAU); ctx.fill(); ctx.restore();
  },
  confetti(ctx, x, y, s, c1, c2, t) { ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + x); ctx.fillStyle = c1; ctx.fillRect(-s * 0.3, -s * 0.12, s * 0.6, s * 0.24); ctx.restore(); },
};
function flame(ctx, x, y, s, c) {
  const g = ctx.createRadialGradient(x, y - s * 0.4, 0, x, y - s * 0.4, s * 1.1); g.addColorStop(0, '#fff'); g.addColorStop(0.35, c); g.addColorStop(1, 'rgba(255,160,40,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - s * 0.4, s * 1.1, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.35, x, y); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.35, x, y - s); ctx.fill();
}

/* ---------- a soft glow dot, used for lights and sparks */
export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
}

/** A tiny seeded random so a festival always looks the same on a given screen size (and tests are stable). */
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

const FLOATERS = new Set(['lantern', 'pelita', 'diya', 'lotus', 'bauble', 'ketupat']);
const FALLERS = new Set(['snow', 'blossom', 'marigold', 'hibiscus', 'confetti', 'coin', 'paddy', 'vel']);

/**
 * Particle scene for one festival. update(dt) then draw(ctx). Kinds:
 *   float: slow rising lanterns/lamps   fall: petals, snow, confetti   twinkle: fixed sparkles   burst: tap fireworks
 */
export class Scene {
  constructor(festival, w, h, opts = {}) {
    this.f = festival; this.w = w; this.h = h; this.t = 0; this.bursts = [];
    this.calm = !!festival.calm; this.max = opts.max || 26; this.seed = opts.seed || 7; this.r = rng(this.seed);
    this.items = []; this.stars = [];
    const motifs = festival.motifs.filter((m) => !['sparkle'].includes(m));
    const n = Math.round((this.calm ? 0.5 : 1) * this.max * Math.min(1.4, (w * h) / 330000));
    for (let i = 0; i < Math.max(8, n); i++) this.items.push(this.spawn(motifs[i % motifs.length], true));
    for (let i = 0; i < Math.max(10, Math.round(n * 1.2)); i++) this.stars.push({ x: this.r() * w, y: this.r() * h * 0.7, s: 6 + this.r() * 10, p: this.r() * 6 });
  }
  spawn(kind, initial) {
    const r = this.r, up = FLOATERS.has(kind);
    return { kind, x: r() * this.w, y: initial ? r() * this.h : (up ? this.h + 40 : -30), s: up ? 22 + r() * 22 : 12 + r() * 14, vy: (up ? -1 : 1) * (10 + r() * 16), sway: 8 + r() * 18, ph: r() * 6, a: 0.55 + r() * 0.4, up };
  }
  burst(x, y) { // tap: a ring of glowing sparks plus two festival shapes
    const n = 14, pal = [this.f.c1, this.f.c2, this.f.c3], sparks = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU + this.r() * 0.3, v = 60 + this.r() * 90; sparks.push({ vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: pal[i % 3] }); }
    this.bursts.push({ x, y, age: 0, life: 1.1, sparks, shape: this.f.motifs[(this.bursts.length) % this.f.motifs.length] });
    if (this.bursts.length > 6) this.bursts.shift();
  }
  update(dt) {
    this.t += dt;
    for (let i = 0; i < this.items.length; i++) { const p = this.items[i]; p.y += p.vy * dt; p.x += Math.sin(this.t * 0.8 + p.ph) * p.sway * dt; if (p.y < -60 || p.y > this.h + 60) this.items[i] = this.spawn(p.kind, false); }
    this.bursts = this.bursts.filter((b) => (b.age += dt) < b.life);
  }
  draw(ctx) {
    const { f, t } = this;
    for (const s of this.stars) glow(ctx, s.x, s.y, s.s * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p)) + 2, f.c2, 0.28 + 0.2 * Math.sin(t * 2 + s.p));
    for (const p of this.items) { ctx.globalAlpha = p.a; if (p.up) glow(ctx, p.x, p.y, p.s * 1.1, f.c2, 0.22); SHAPES[p.kind](ctx, p.x, p.y, p.s, f.c1, f.c2, t); ctx.globalAlpha = 1; }
    for (const b of this.bursts) {
      const u = b.age / b.life, e = 1 - (1 - u) * (1 - u); ctx.globalAlpha = Math.max(0, 1 - u);
      for (const s of b.sparks) glow(ctx, b.x + s.vx * e, b.y + s.vy * e + 40 * u * u, 7 * (1 - u) + 2, s.c, 1);
      SHAPES[b.shape](ctx, b.x, b.y - 28 * e, 26 + 10 * u, f.c1, f.c2, this.t); ctx.globalAlpha = 1;
    }
  }
}

/** Bunting along the top edge: a sagging string with the festival's shapes hanging and bulbs that twinkle. */
export function garland(ctx, f, w, t, h = 44) {
  const step = 58, n = Math.ceil(w / step) + 1;
  ctx.save(); ctx.lineWidth = 1.5; ctx.strokeStyle = f.c2; ctx.globalAlpha = 0.7; ctx.beginPath();
  for (let i = 0; i <= n; i++) { const x = i * step, y = 4 + Math.sin(i * 0.9) * 0; if (i === 0) ctx.moveTo(x, 2); ctx.quadraticCurveTo(x + step / 2, 2 + 9, x + step, 2); } ctx.stroke(); ctx.globalAlpha = 1;
  const kinds = f.motifs.filter((m) => !['snow', 'confetti', 'sparkle', 'rangoli', 'coin', 'paddy', 'moon'].includes(m)); const list = kinds.length ? kinds : ['star'];
  for (let i = 0; i < n; i++) {
    const x = i * step + step / 2, sway = Math.sin(t * 1.4 + i) * 2.5, kind = list[i % list.length], size = Math.min(26, h * 0.6);
    ctx.save(); ctx.translate(x + sway, 11); SHAPES[kind](ctx, 0, size * 0.5, size, f.c1, f.c2, t); ctx.restore();
    glow(ctx, i * step + sway * 0.4, 3, 7, [f.c1, f.c2, f.c3][i % 3], 0.55 + 0.4 * Math.sin(t * 2.3 + i * 1.7)); // bulbs on the string
  }
  ctx.restore();
}

/** Points along a polyline at the given distances (metres or any unit) for travelling lights. coords: [[x,y]...] */
export function alongLine(coords, dists, total, cum) {
  const out = [];
  for (const d0 of dists) {
    const d = ((d0 % total) + total) % total; let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; (cum[m] <= d ? (lo = m) : (hi = m)); }
    const seg = cum[hi] - cum[lo] || 1, u = (d - cum[lo]) / seg;
    out.push([coords[lo][0] + (coords[hi][0] - coords[lo][0]) * u, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * u]);
  }
  return out;
}
export function cumulative(coords, dist) { const cum = [0]; for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + dist(coords[i - 1], coords[i])); return cum; }
