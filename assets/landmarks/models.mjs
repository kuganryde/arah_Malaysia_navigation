// ARAH landmarks v0.1.0 - textured low-poly models of 12 Malaysian landmarks, built in code (original work, no
// third-party meshes, so no licences to track). Sizes follow the real buildings. Every builder takes the texture
// factory `T` so the same code runs under node --test with a stub (no canvas) and in the browser with real textures.
import { MeshLambertMaterial, Float32BufferAttribute, BufferGeometry, Mesh, SphereGeometry, Group, Color } from 'three';
import { ngon, box, shift, loft, prism, lathe, mesh, group, rng } from './geo.mjs';

export const LIT = new Set(); // materials that have lit windows; the layer turns their emissive up after dark

// Material from a texture pair. Lambert (cheap) with an emissive map for night windows.
// Every colour is dimmed to TONE: the app's day map is almost white, and full-white models vanished against it.
const TONE = 0.74;
function mat(t, o = {}) {
  const m = new MeshLambertMaterial({ color: new Color(TONE, TONE, TONE), map: t && t.map || null, emissive: t && t.emissive ? 0xffffff : 0x000000, emissiveMap: t && t.emissive || null, emissiveIntensity: 0, ...o });
  if (t && t.emissive) LIT.add(m);
  return m;
}
const solid = (hex, o = {}) => new MeshLambertMaterial({ color: new Color(hex).multiplyScalar(TONE), ...o });
const place = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// ----- Petronas Twin Towers: 452 m, eight-point star plan, skybridge at levels 41-42
function petronas(T) {
  const steel = mat(T('steel')), roof = solid('#dfe5f0'), g = new Group();
  const tiers = [[27, 0, 175], [25, 175, 268], [22, 268, 330], [18, 330, 368], [13, 368, 390], [8, 390, 410]];
  [[-24, -14], [24, 14]].forEach(([x, z]) => {
    const t = new Group();
    tiers.forEach(([r, y0, y1], i) => t.add(mesh(loft([{ y: y0, ring: ngon(16, r, 0, 0.74) }, { y: y1, ring: ngon(16, i < tiers.length - 1 ? tiers[i + 1][0] + 0.8 : r * 0.9, 0, 0.74) }], 32, 32), steel, roof)));
    t.add(mesh(loft([{ y: 410, ring: ngon(8, 1.8) }, { y: 452, ring: ngon(8, 0.25) }], 8, 8), solid('#e8edf6')));
    g.add(place(t, x, 0, z));
  });
  const len = Math.hypot(48, 28) - 22, br = mesh(prism(box(len, 6), 168, 178, 16, 16), mat(T('steel')), roof);
  br.rotation.y = -Math.atan2(28, 48); g.add(br);
  [-1, 1].forEach((s) => { const leg = mesh(prism(box(1.6, 1.6), 140, 170, 4, 4), solid('#cfd6e2')); leg.position.set(s * 9 * Math.cos(Math.atan2(28, 48)), 0, s * 9 * Math.sin(Math.atan2(28, 48))); leg.rotation.z = s * 0.28; g.add(leg); });
  return g;
}

// ----- Merdeka 118: 679 m, faceted crystalline shaft that twists as it tapers
function merdeka118(T) {
  const glass = mat(T('grid', { wall: '#2d1f55', glass: '#6d7be0', cols: 4, rows: 8, gap: 3, litP: 0.3, seed: 11 })), cap = solid('#c9d3ff');
  const secs = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; secs.push({ y: i * 26, ring: ngon(10, 34 * (1 - t) + 9 * t, i * 5, 0.8) }); }
  const g = group(mesh(loft(secs, 40, 52), glass, cap));
  g.add(mesh(loft([{ y: 520, ring: ngon(10, 9, 100, 0.8) }, { y: 560, ring: ngon(10, 2.4, 100, 0.8) }], 20, 20), mat(T('grid', { wall: '#1a2f58', glass: '#2fd0ec', cols: 4, rows: 4, seed: 12 })), cap));
  g.add(mesh(loft([{ y: 560, ring: ngon(6, 2) }, { y: 679, ring: ngon(6, 0.3) }], 6, 60), solid('#e5ecff')));
  return g;
}

// ----- Menara Kuala Lumpur: 421 m telecom tower, fluted shaft, glass pod
function menarakl(T) {
  const flute = mat(T('plaster', { base: '#eef0f7', flute: 12 })), pod = mat(T('grid', { wall: '#27406e', glass: '#4fa8e8', cols: 12, rows: 3, gap: 2, litP: 0.5, seed: 13 })), gold = mat(T('gold'));
  const g = group(
    mesh(prism(ngon(12, 17), 0, 14, 20, 14), mat(T('blocks', { base: '#b9b4a4', seed: 14 }))),
    mesh(loft([{ y: 14, ring: ngon(12, 8.6) }, { y: 276, ring: ngon(12, 5.8) }], 18, 40), flute, solid('#eef0f7')),
    mesh(loft([{ y: 276, ring: ngon(12, 6) }, { y: 280, ring: ngon(12, 12) }, { y: 290, ring: ngon(12, 17) }, { y: 310, ring: ngon(12, 19) }, { y: 322, ring: ngon(12, 19) }, { y: 329, ring: ngon(12, 14) }, { y: 335, ring: ngon(12, 6) }], 24, 20), pod, solid('#8fb8e6')),
    mesh(prism(ngon(12, 19.4), 303, 306, 10, 3), gold),
    mesh(loft([{ y: 335, ring: ngon(8, 4) }, { y: 352, ring: ngon(8, 3.2) }], 12, 20), flute, solid('#eef0f7')),
    mesh(loft([{ y: 352, ring: ngon(6, 1.3) }, { y: 421, ring: ngon(6, 0.2) }], 6, 40), solid('#e24a4a')),
  );
  return g;
}

// ----- Masjid Negara: 18-point star roof, 73 m minaret
function masjidnegara(T) {
  const white = mat(T('plaster', { base: '#f2f3f6', flute: 14, seed: 15 })), roof = mat(T('pleats', { n: 4 })), stone = mat(T('blocks', { base: '#d9d4c6', seed: 16, rows: 4, cols: 4 }));
  const star = (r, y) => ({ y, ring: ngon(36, r, 0, 0.72) });
  return group(
    mesh(prism(box(90, 90), 0, 6, 30, 6), stone, solid('#cfcab9')),
    mesh(prism(box(56, 56), 6, 12, 14, 6), white, solid('#e9ebf1')),
    mesh(loft([star(42, 12), star(30, 17), star(16, 22), star(2, 28)], 20, 14), roof, solid('#1fb6c9')),
    place(group(
      mesh(loft([{ y: 0, ring: ngon(8, 3.6) }, { y: 66, ring: ngon(8, 2.8) }], 8, 40), white, solid('#ffffff')),
      mesh(loft([{ y: 66, ring: ngon(8, 6) }, { y: 69, ring: ngon(8, 6.2) }, { y: 73, ring: ngon(8, 0.4) }], 8, 8), roof, solid('#1fb6c9')),
    ), 55, 0, 30),
  );
}

// ----- Bangunan Sultan Abdul Samad: Moorish-revival, brick and white stripes, copper domes
function sultanabdulsamad(T) {
  const wall = mat(T('brick')), dome = mat(T('roofTile', { base: '#3a9a86' })), cream = solid('#efe5cf'), slate = solid('#59606f');
  const onion = (r, y0) => lathe([[r * 0.8, y0], [r, y0 + r * 0.35], [r * 0.9, y0 + r * 0.75], [r * 0.5, y0 + r * 1.2], [r * 0.12, y0 + r * 1.6]], 8, 8, 8);
  const g = group(
    mesh(prism(box(30, 130), 0, 18, 26, 18), wall, slate),
    mesh(prism(box(9, 9), 18, 32, 18, 14), wall, slate),
    mesh(prism(ngon(8, 5.4), 32, 36, 10, 4), solid('#e6dcc4'), cream),
    place(mesh(onion(6, 36), dome), 0, 0, 0),
  );
  [-55, 55].forEach((z) => { g.add(place(mesh(prism(box(14, 14), 18, 23, 14, 6), wall, slate), 0, 0, z)); g.add(place(mesh(onion(5, 23), dome), 0, 0, z)); });
  g.add(mesh(prism(box(34, 100), 0, 4, 30, 4), mat(T('blocks', { base: '#d8cdb4', seed: 17 })))); // arcade plinth
  return g;
}

// ----- Batu Caves: limestone massif, 272 rainbow steps, 43 m golden Lord Murugan
function vertexTint(geo, fn) { // per-vertex colour by height so the hill reads green at the foot and pale grey rock above
  const p = geo.getAttribute('position'), c = [];
  for (let i = 0; i < p.count; i++) { const [r, g, b] = fn(p.getY(i)); c.push(r, g, b); }
  geo.setAttribute('color', new Float32BufferAttribute(c, 3)); return geo;
}
function batucaves(T) {
  const r = rng(77), hill = [[210, 0], [165, 60], [120, 140], [70, 220], [30, 300]];
  const secs = hill.map(([rad, y]) => ({ y, ring: ngon(16, rad).map(([x, z]) => [x * (1 + (r() - 0.5) * 0.28), z * (1 + (r() - 0.5) * 0.28)]) }));
  const geo = vertexTint(loft(secs, 40, 40), (y) => (y < 40 ? [0.42, 0.62, 0.36] : y < 220 ? [0.72, 0.7, 0.64] : [0.82, 0.8, 0.74]));
  const rock = new MeshLambertMaterial({ color: new Color(TONE, TONE, TONE), map: T('rock', { tint: '#b3ac9c' }) && T('rock', { tint: '#b3ac9c' }).map, vertexColors: true });
  const g = new Group();
  g.add(place(mesh(geo, rock, new MeshLambertMaterial({ color: new Color('#7a8a5a').multiplyScalar(TONE), vertexColors: true })), -60, 0, -250));
  const goldM = mat(T('gold'));
  const statue = group(
    mesh(prism(box(11, 11), 0, 5, 8, 5), solid('#cfc9b8')),
    mesh(loft([{ y: 5, ring: ngon(8, 3.6) }, { y: 17, ring: ngon(8, 2.9) }, { y: 24, ring: ngon(8, 3.8) }, { y: 30, ring: ngon(8, 3.2) }], 8, 12), goldM, goldM),
    place(new Mesh(new SphereGeometry(2.6, 8, 6), goldM), 0, 33, 0),
    mesh(loft([{ y: 35, ring: ngon(8, 2.4) }, { y: 38.5, ring: ngon(8, 1.8) }, { y: 43, ring: ngon(8, 0.3) }], 6, 8), goldM, goldM),
  );
  statue.children[2].frustumCulled = false;
  [-1, 1].forEach((s) => { const arm = mesh(prism(box(1.4, 1.4), 0, 14, 4, 4), goldM, goldM); arm.position.set(s * 4.6, 18, 0); arm.rotation.z = s * -0.25; statue.add(arm); });
  g.add(place(statue, 3, 0, 0));
  const cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#5e35b1', '#d81b60'];
  for (let k = 0; k < 14; k++) g.add(place(mesh(prism(box(8, 8.4), k * 3.2, (k + 1) * 3.2, 8, 3), solid(cols[k % 7]), solid(cols[k % 7])), -5 - k * 0.6, 0, -16 - k * 8));
  return g;
}

// ----- Masjid Putra: rose-granite dome, 116 m minaret
function masjidputra(T) {
  const tile = mat(T('tiles', { base: '#c9708a' })), stone = mat(T('blocks', { base: '#e6d6d2', seed: 18, rows: 4, cols: 4 })), white = mat(T('plaster', { base: '#f4eceb', flute: 10, seed: 19 }));
  return group(
    mesh(prism(box(70, 70), 0, 14, 28, 14), stone, solid('#dbc9c5')),
    mesh(prism(ngon(16, 27), 14, 24, 28, 10), mat(T('plaster', { base: '#eadbd8', flute: 24, seed: 20 })), solid('#c9708a')),
    mesh(lathe([[27, 24], [27, 27], [24, 31], [19, 35], [12, 39], [5, 43], [0.6, 46]], 16, 18, 12), tile, tile),
    place(group(
      mesh(loft([{ y: 0, ring: ngon(8, 4.4) }, { y: 108, ring: ngon(8, 3.2) }], 10, 50), white, solid('#ffffff')),
      mesh(loft([{ y: 108, ring: ngon(8, 5.4) }, { y: 111, ring: ngon(8, 5.6) }, { y: 116, ring: ngon(8, 0.4) }], 8, 8), tile, tile),
    ), 62, 0, 0),
  );
}

// ----- Komtar: 249 m twelve-sided civic tower with a podium
function komtar(T) {
  const tow = mat(T('grid', { wall: '#d8dbe6', glass: '#4d6285', cols: 6, rows: 12, gap: 2, litP: 0.35, seed: 21 })), pod = mat(T('grid', { wall: '#c9cdd9', glass: '#5a6f92', cols: 8, rows: 2, gap: 2, litP: 0.4, seed: 22 }));
  return group(
    mesh(prism(ngon(12, 52), 0, 14, 40, 14), pod, solid('#aeb4c4')),
    mesh(prism(ngon(12, 24), 14, 249, 26, 48), tow, solid('#e4e7f0')),
    mesh(loft([{ y: 249, ring: ngon(12, 20) }, { y: 253, ring: ngon(12, 20) }, { y: 258, ring: ngon(12, 9) }], 20, 12), mat(T('grid', { wall: '#1f3c5c', glass: '#2fd0ec', cols: 6, rows: 2, seed: 23 })), solid('#9fe8f7')),
  );
}

// ----- Menara Alor Setar: 165 m, rice-bowl observation pod
function alorsetar(T) {
  const conc = mat(T('plaster', { base: '#dfe2ea', flute: 8, seed: 24 })), pod = mat(T('grid', { wall: '#25406a', glass: '#58b0ea', cols: 10, rows: 2, gap: 2, litP: 0.5, seed: 25 }));
  return group(
    mesh(loft([{ y: 0, ring: ngon(8, 7) }, { y: 88, ring: ngon(8, 4.6) }], 10, 40), conc, solid('#dfe2ea')),
    mesh(loft([{ y: 88, ring: ngon(12, 7) }, { y: 91, ring: ngon(12, 14) }, { y: 98, ring: ngon(12, 15.5) }, { y: 105, ring: ngon(12, 15.5) }, { y: 110, ring: ngon(12, 9) }, { y: 114, ring: ngon(12, 4) }], 18, 14), pod, solid('#a3cbee')),
    mesh(loft([{ y: 114, ring: ngon(6, 1.8) }, { y: 165, ring: ngon(6, 0.25) }], 6, 40), solid('#e8465f')),
  );
}

// ----- A Famosa (Porta de Santiago): 1511 laterite gate, 11 m
function afamosa(T) {
  const st = mat(T('blocks', { base: '#a8623a', seed: 26, rows: 4, cols: 3 })), top = solid('#8e5230');
  return group(
    place(mesh(prism(box(3.6, 6), 0, 9, 4, 4), st, top), -4.2, 0, 0),
    place(mesh(prism(box(3.6, 6), 0, 9, 4, 4), st, top), 4.2, 0, 0),
    mesh(prism(box(6, 6), 6.4, 9, 4, 4), st, top),
    mesh(loft([{ y: 9, ring: box(12, 6) }, { y: 11, ring: box(8, 3.6) }], 4, 4), st, top),
  );
}

// ----- Bangunan DUN Sarawak: hexagonal tower under a golden umbrella (payung) roof, 50 m
function dunsarawak(T) {
  const roof = mat(T('gold')), wall = mat(T('plaster', { base: '#f3f0e6', band: '#d4a52e', seed: 27 }));
  return group(
    mesh(prism(ngon(9, 38), 0, 18, 24, 18), wall, solid('#e6e0cc')),
    mesh(loft([{ y: 18, ring: ngon(9, 50, 20) }, { y: 24, ring: ngon(9, 42, 20) }, { y: 34, ring: ngon(9, 28, 20) }, { y: 42, ring: ngon(9, 14, 20) }, { y: 50, ring: ngon(9, 1.2, 20) }], 18, 14), roof, roof),
  );
}

// ----- Gunung Kinabalu: 4,095 m low-poly peak, flat-shaded facets, cloud-forest green to granite
function kinabalu(T) {
  const R = 7000, H = 4095, RINGS = 14, SEG = 28, r = rng(99);
  const peaks = [[0, 0, 1, 420], [-900, 350, 0.82, 360], [700, -500, 0.74, 330], [1500, 600, 0.62, 300], [-1700, -800, 0.55, 300]];
  const hAt = (x, z, rr, th) => {
    let h = H * Math.pow(Math.max(0, 1 - rr / R), 1.55);
    h = h * 0.96 + peaks.reduce((s, [px, pz, a, w]) => s + a * 330 * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (w * w)), 0);
    return h * (1 + 0.06 * Math.sin(th * 5 + rr / 900));
  };
  const V = []; // [ring][seg] -> [x,y,z]
  for (let i = 0; i <= RINGS; i++) {
    const rr = R * (i / RINGS) ** 1.25, row = [];
    for (let j = 0; j < SEG; j++) {
      const th = j * 2 * Math.PI / SEG + (i % 2) * Math.PI / SEG, jit = i === 0 ? 0 : 1 + (r() - 0.5) * 0.12 * Math.min(1, i / 4);
      const x = rr * jit * Math.cos(th), z = rr * jit * Math.sin(th);
      row.push([x, i === RINGS ? 0 : hAt(x, z, rr, th) * (1 + (r() - 0.5) * 0.05), z]);
    }
    V.push(row);
  }
  const pos = [], nor = [], col = [], uv = [];
  const tint = (y) => (y < 900 ? [0.20, 0.42, 0.24] : y < 2300 ? [0.26, 0.5, 0.3] : y < 3000 ? [0.42, 0.52, 0.34] : y < 3700 ? [0.64, 0.64, 0.62] : [0.82, 0.82, 0.8]);
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
    const o = n[1] > 0 ? [a, b, c] : [a, c, b]; // counter-clockwise seen from above (see geo.mjs on winding)
    if (n[1] < 0) n = n.map((v) => -v);
    const k = tint((a[1] + b[1] + c[1]) / 3);
    o.forEach((p) => { pos.push(...p); nor.push(0, 0, 0); col.push(...k); uv.push(p[0] / 600, p[2] / 600); });
    for (let q = 0; q < 3; q++) { const idx = nor.length - 9 + q * 3; nor[idx] = n[0]; nor[idx + 1] = n[1]; nor[idx + 2] = n[2]; }
  };
  for (let j = 0; j < SEG; j++) tri([0, V[0][0][1], 0], V[1][j], V[1][(j + 1) % SEG]);
  for (let i = 1; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
    const a = V[i][j], b = V[i][(j + 1) % SEG], c = V[i + 1][(j + 1) % SEG], d = V[i + 1][j];
    tri(a, d, b); tri(b, d, c);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new Float32BufferAttribute(col, 3)); geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  const t = T('rock', { tint: '#c9c5ba', seed: 31 });
  return group(mesh(geo, new MeshLambertMaterial({ color: new Color(TONE, TONE, TONE), map: t && t.map || null, vertexColors: true, flatShading: true })));
}

// id, centre [lng,lat] (matches the app's LANDMARKS), minZoom to start drawing, visible radius in metres, expected top in metres
export const SPECS = [
  { id: 'petronas', c: [101.7116, 3.15787], minZoom: 13.2, radius: 120, top: 452, build: petronas },
  { id: 'merdeka118', c: [101.7005, 3.1416], minZoom: 13.2, radius: 90, top: 679, build: merdeka118 },
  { id: 'menarakl', c: [101.7038, 3.1528], minZoom: 13.2, radius: 60, top: 421, build: menarakl },
  { id: 'masjidnegara', c: [101.6918, 3.1419], minZoom: 14, radius: 110, top: 73, build: masjidnegara },
  { id: 'sultanabdulsamad', c: [101.6946, 3.1487], minZoom: 14, radius: 90, top: 42, build: sultanabdulsamad },
  { id: 'batucaves', c: [101.684, 3.2371], minZoom: 13, radius: 520, top: 300, build: batucaves },
  { id: 'masjidputra', c: [101.6895, 2.936], minZoom: 14, radius: 110, top: 116, build: masjidputra },
  { id: 'komtar', c: [100.3296, 5.4146], minZoom: 13.2, radius: 90, top: 258, build: komtar },
  { id: 'alorsetar', c: [100.3675, 6.1215], minZoom: 13.2, radius: 60, top: 165, build: alorsetar },
  { id: 'afamosa', c: [102.2505, 2.1916], minZoom: 15.5, radius: 30, top: 11, build: afamosa },
  { id: 'dunsarawak', c: [110.3463, 1.5633], minZoom: 14, radius: 90, top: 50, build: dunsarawak },
  { id: 'kinabalu', c: [116.5585, 6.075], minZoom: 8.5, radius: 9000, top: 4095, build: kinabalu },
];
export { Color };
