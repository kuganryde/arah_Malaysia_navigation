// Textured low-poly landmarks: model sizes, winding/normals, loader list in step with the models, bundle pinned by SRI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SPECS } from '../assets/landmarks/models.mjs';
import { loft, prism, box, ngon, heightOf } from '../assets/landmarks/geo.mjs';

const EXPECTED = ['petronas', 'merdeka118', 'menarakl', 'masjidnegara', 'sultanabdulsamad', 'batucaves', 'masjidputra', 'komtar', 'alorsetar', 'afamosa', 'dunsarawak', 'kinabalu'];

test('landmarks: every iconic building has a model, in the same order as the app list', () => {
  assert.deepEqual(SPECS.map((s) => s.id), EXPECTED);
});

test('landmarks: each model builds without canvas/DOM and matches the real height within 12%', () => {
  for (const s of SPECS) {
    const g = s.build(() => null); // texture factory stubbed: geometry only
    const { top, bottom } = heightOf(g);
    assert.ok(top > s.top * 0.88 && top < s.top * 1.12, `${s.id}: top ${top.toFixed(1)} m vs expected ${s.top} m`);
    assert.ok(bottom > -1, `${s.id}: sinks below ground (${bottom})`);
    let tris = 0; g.traverse((o) => { if (o.isMesh) tris += o.geometry.getAttribute('position').count / 3; });
    assert.ok(tris > 20 && tris < 12000, `${s.id}: ${tris} triangles is outside the low-poly budget`);
  }
});

test('landmarks: loft winds counter-clockwise from outside with outward, unit normals', () => {
  const g = prism(box(10, 20), 0, 30, 10, 10), p = g.getAttribute('position'), n = g.getAttribute('normal');
  let sides = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = [0, 1, 2].map((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]);
    const e1 = a[1].map((v, k) => v - a[0][k]), e2 = a[2].map((v, k) => v - a[0][k]);
    const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nn = [n.getX(i), n.getY(i), n.getZ(i)];
    assert.ok(Math.abs(Math.hypot(...nn) - 1) < 1e-4, 'normal is not unit length');
    assert.ok(c[0] * nn[0] + c[1] * nn[1] + c[2] * nn[2] > 0, 'triangle winding disagrees with its normal');
    const cx = (a[0][0] + a[1][0] + a[2][0]) / 3, cz = (a[0][2] + a[1][2] + a[2][2]) / 3;
    if (nn[1] === 0) { assert.ok(nn[0] * cx + nn[2] * cz > 0, 'side normal points inward'); sides++; }
    else assert.equal(nn[1], 1, 'cap normal must point up');
  }
  assert.equal(sides, 8 + 0, 'a four-sided prism has 4 quads = 8 side triangles');
});

test('landmarks: UVs are in metres so a 450 m tower is not a stretched 4 m one', () => {
  const g = loft([{ y: 0, ring: ngon(8, 10) }, { y: 100, ring: ngon(8, 10) }], 20, 25, false), uv = g.getAttribute('uv');
  let maxV = 0; for (let i = 0; i < uv.count; i++) maxV = Math.max(maxV, uv.getY(i));
  assert.equal(maxV, 4); // 100 m / 25 m per tile
});

test('landmarks: the loader list is in step with the models (id, position, zoom, radius)', () => {
  const src = readFileSync('assets/landmarks/arah-landmarks.js', 'utf8');
  const list = JSON.parse(src.match(/var LM = (\[\[[\s\S]*?\]\]);/)[1].replace(/'/g, '"'));
  assert.equal(list.length, SPECS.length);
  list.forEach(([id, lng, lat, z, r], i) => {
    const s = SPECS[i];
    assert.deepEqual([id, lng, lat, z, r], [s.id, s.c[0], s.c[1], s.minZoom, s.radius]);
  });
});

test('landmarks: the shipped bundle matches the SRI pinned in the loader', () => {
  const buf = readFileSync('assets/landmarks/vendor/landmarks3d.min.js');
  const sri = 'sha384-' + createHash('sha384').update(buf).digest('base64');
  assert.ok(readFileSync('assets/landmarks/arah-landmarks.js', 'utf8').includes(`var LM_SRI = '${sri}';`), 'run npm run landmarks:build');
});

test('landmarks: positions match the app\'s own landmark centres', () => {
  const html = readFileSync('source/Arah Navigation.dc.html', 'utf8');
  for (const s of SPECS) {
    const m = new RegExp(`id:'${s.id}'[^\\n]*?c:\\[([\\d.]+),([\\d.]+)\\]`).exec(html);
    assert.ok(m, `${s.id} not found in the app source`);
    assert.ok(Math.abs(+m[1] - s.c[0]) < 1e-4 && Math.abs(+m[2] - s.c[1]) < 1e-4, `${s.id} is not where the app puts it`);
  }
});
