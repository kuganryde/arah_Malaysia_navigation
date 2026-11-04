// ARAH landmarks v0.1.0 - procedural textures. Drawn once on small canvases (128-256 px) at first use, so there are
// no image downloads, no licences and nothing to cache. Each painter returns { map, emissive }: `emissive` holds
// only the lit windows and is switched on after dark. Mipmapped + anisotropic so they stay crisp at the grazing
// angles of a tilted map.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from 'three';
import { rng } from './geo.mjs';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const toTex = (c, aniso = 4) => {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = aniso;
  t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.generateMipmaps = true;
  return t;
};
const shade = (hex, k) => { // multiply an #rrggbb colour by k (>1 lighter, <1 darker)
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
};

// Window grid: tower, concrete block, glass curtain wall. cols x rows of cells in one tile.
function grid({ wall, glass, cols = 8, rows = 8, gap = 2, lit = '#ffd98a', litP = 0.35, seed = 1, size = 128, glassVar = 0.18 }) {
  const c = mk(size, size), e = mk(size, size), x = c.getContext('2d'), y = e.getContext('2d'), r = rng(seed);
  x.fillStyle = wall; x.fillRect(0, 0, size, size); y.fillStyle = '#000'; y.fillRect(0, 0, size, size);
  const cw = size / cols, ch = size / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const g = x.createLinearGradient(0, j * ch, 0, (j + 1) * ch);
    const k = 1 + (r() - 0.5) * glassVar;
    g.addColorStop(0, shade(glass, 1.25 * k)); g.addColorStop(1, shade(glass, 0.8 * k));
    x.fillStyle = g; x.fillRect(i * cw + gap / 2, j * ch + gap / 2, cw - gap, ch - gap);
    if (r() < litP) { y.fillStyle = lit; y.fillRect(i * cw + gap / 2 + 1, j * ch + gap / 2 + 1, cw - gap - 2, ch - gap - 2); }
  }
  return { map: toTex(c), emissive: toTex(e) };
}

// Horizontal glass bands between steel fins: Petronas cladding.
function steel({ seed = 2, size = 128 } = {}) {
  const c = mk(size, size), e = mk(size, size), x = c.getContext('2d'), y = e.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, size, 0); g.addColorStop(0, '#d9dfea'); g.addColorStop(0.5, '#f4f6fb'); g.addColorStop(1, '#c4ccdb');
  x.fillStyle = g; x.fillRect(0, 0, size, size); y.fillStyle = '#000'; y.fillRect(0, 0, size, size);
  const bands = 8, bh = size / bands;
  for (let j = 0; j < bands; j++) {
    x.fillStyle = '#5f86b4'; x.fillRect(0, j * bh + bh * 0.28, size, bh * 0.44);
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, j * bh + bh * 0.28, size, 1);
    for (let i = 0; i < 16; i++) if (r() < 0.45) { y.fillStyle = '#ffe2a0'; y.fillRect(i * size / 16 + 1, j * bh + bh * 0.3, size / 16 - 2, bh * 0.4); }
  }
  x.fillStyle = 'rgba(40,50,70,.55)'; for (let i = 0; i < 16; i++) x.fillRect(i * size / 16, 0, 1, size);
  return { map: toTex(c), emissive: toTex(e) };
}

// Brick wall with pale stripes and a row of arched windows (Sultan Abdul Samad).
function brick({ seed = 3, size = 256 } = {}) {
  const c = mk(size, size), e = mk(size, size), x = c.getContext('2d'), y = e.getContext('2d'), r = rng(seed);
  x.fillStyle = '#a8482a'; x.fillRect(0, 0, size, size); y.fillStyle = '#000'; y.fillRect(0, 0, size, size);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 16; i++) {
    x.fillStyle = shade('#b4532f', 0.85 + r() * 0.3); x.fillRect(((i + (j % 2) * 0.5) * 16) % size, j * 8 + 1, 15, 6);
  }
  x.fillStyle = '#f0e6d2'; x.fillRect(0, 0, size, 10); x.fillRect(0, size * 0.5 - 5, size, 10); x.fillRect(0, size - 10, size, 10);
  for (let k = 0; k < 4; k++) {
    const cx = k * size / 4 + size / 8;
    [[0.12, 0.38], [0.62, 0.88]].forEach(([a, b]) => {
      x.fillStyle = '#f0e6d2'; x.beginPath(); x.moveTo(cx - 17, size * b); x.lineTo(cx - 17, size * a + 14); x.arc(cx, size * a + 14, 17, Math.PI, 0); x.lineTo(cx + 17, size * b); x.fill();
      x.fillStyle = '#26324a'; x.beginPath(); x.moveTo(cx - 12, size * b); x.lineTo(cx - 12, size * a + 15); x.arc(cx, size * a + 15, 12, Math.PI, 0); x.lineTo(cx + 12, size * b); x.fill();
      if (r() < 0.5) { y.fillStyle = '#ffd98a'; y.beginPath(); y.moveTo(cx - 12, size * b); y.lineTo(cx - 12, size * a + 15); y.arc(cx, size * a + 15, 12, Math.PI, 0); y.lineTo(cx + 12, size * b); y.fill(); }
    });
  }
  return { map: toTex(c), emissive: toTex(e) };
}

// Plain painted surface with optional vertical flutes / horizontal bands.
function plaster({ base = '#eceff6', flute = 0, band = null, seed = 4, size = 128 } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.05})`; x.fillRect(r() * size, r() * size, 2 + r() * 6, 2 + r() * 6); }
  if (flute) { for (let i = 0; i < flute; i++) { x.fillStyle = 'rgba(0,0,0,.10)'; x.fillRect(i * size / flute, 0, 2, size); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(i * size / flute + 2, 0, 1, size); } }
  if (band) { x.fillStyle = band; x.fillRect(0, size * 0.42, size, size * 0.16); }
  return { map: toTex(c), emissive: null };
}

// Folded-plate roof: alternating light/dark pleats in one colour (Masjid Negara) or tiled dome rings (Masjid Putra).
function pleats({ a = '#1fb6c9', b = '#0f8da2', n = 8, seed = 5, size = 128 } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * size / n, 0, size / n, size); }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.07})`; x.fillRect(r() * size, r() * size, 3, 3); }
  return { map: toTex(c), emissive: null };
}
function tiles({ base = '#c2677f', seed = 6, size = 128 } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { x.fillStyle = shade(base, 0.88 + r() * 0.24); x.fillRect(i * 8 + 0.5, j * 8 + 0.5, 7, 7); }
  return { map: toTex(c), emissive: null };
}
function gold({ seed = 7, size = 128 } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#f6d56a'); g.addColorStop(0.5, '#d9a52c'); g.addColorStop(1, '#f2cd5a');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  for (let j = 0; j < 8; j++) { x.fillStyle = `rgba(110,70,0,${0.25 + r() * 0.1})`; x.fillRect(0, j * 16, size, 2); }
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(120,80,0,.18)'; x.fillRect(i * 16, 0, 1, size); }
  return { map: toTex(c), emissive: null };
}
// Stone blocks: A Famosa laterite (warm) or generic limestone.
function blocks({ base = '#a9663a', seed = 8, size = 256, rows = 8, cols = 4 } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  const bh = size / rows, bw = size / cols;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols + 1; i++) {
    x.fillStyle = shade(base, 0.8 + r() * 0.35); x.fillRect(i * bw - (j % 2) * bw / 2 + 1, j * bh + 1, bw - 2, bh - 2);
  }
  for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(30,20,10,${r() * 0.12})`; x.fillRect(r() * size, r() * size, 2, 2); }
  return { map: toTex(c), emissive: null };
}
// Rock: grey-brown streaks with moss; used with vertex colours on the hills.
function rock({ seed = 9, size = 256, tint = '#8b8578' } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = tint; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { const v = r(); x.fillStyle = v < 0.5 ? `rgba(0,0,0,${r() * 0.18})` : `rgba(255,255,255,${r() * 0.12})`; x.fillRect(r() * size, r() * size, 2 + r() * 4, 6 + r() * 26); }
  return { map: toTex(c), emissive: null };
}
function rainbow({ size = 128 } = {}) {
  const c = mk(size, size), x = c.getContext('2d'), cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#5e35b1', '#d81b60'];
  const h = size / cols.length; cols.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * h, size, h); });
  x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < cols.length; i++) x.fillRect(0, i * h, size, 1.5);
  return { map: toTex(c), emissive: null };
}
function roofTile({ base = '#2f8f7a', size = 128 } = {}) { // copper-green / turquoise ribbed domes
  const c = mk(size, size), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(i * size / 12, 0, 2, size); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(i * size / 12 + 2, 0, 1, size); }
  return { map: toTex(c), emissive: null };
}

export const PAINT = { grid, steel, brick, plaster, pleats, tiles, gold, blocks, rock, rainbow, roofTile };

// Cache by painter + parameters so e.g. two towers share one texture and a rebuild never repaints.
const cache = new Map();
export function T(name, params = {}) {
  const key = name + JSON.stringify(params);
  if (!cache.has(key)) cache.set(key, PAINT[name](params));
  return cache.get(key);
}
export function disposeTextures() { cache.forEach((v) => { v.map && v.map.dispose(); v.emissive && v.emissive.dispose(); }); cache.clear(); }
