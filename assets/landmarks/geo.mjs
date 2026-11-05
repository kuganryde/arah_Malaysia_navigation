// ARAH landmarks v0.1.1 - geometry helpers (pure three.js, no DOM, so they run under node --test).
// Everything is built in METRES in three's usual frame: x = east, y = up, z = south (-z is north).
import { BufferGeometry, Float32BufferAttribute, Mesh, Group } from 'three';

// Ring of n points (x,z). `inner` < 1 makes every second point shorter = a star plan (Petronas, Masjid Negara).
export function ngon(n, r, rotDeg = 0, inner = 1) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const a = rotDeg * Math.PI / 180 + i * 2 * Math.PI / n, rr = inner !== 1 && i % 2 ? r * inner : r;
    p.push([rr * Math.cos(a), rr * Math.sin(a)]);
  }
  return p;
}
export const box = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
export const shift = (ring, dx, dz) => ring.map(([x, z]) => [x + dx, z + dz]);

// A loft between rings at different heights. sections: [{ y, ring }], every ring the same length.
// Side faces use material 0, the flat top cap material 1. UVs are in METRES / (uM, vM), so one texture tile always
// covers the same real-world size and a 450 m tower is not a stretched 4 m one. Normals are written explicitly
// (outward) and triangles are wound counter-clockwise seen from outside, so FrontSide materials (cheaper than
// DoubleSide) show the outside of every wall. The mercator mirror in the layer's matrix is handled by the layer
// (it flips the GL front-face rule), not here.
export function loft(sections, uM = 16, vM = 16, cap = true) {
  const pos = [], nor = [], uv = [], cpos = [], cnor = [], cuv = [];
  const cen = (r) => r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]);
  for (let s = 0; s < sections.length - 1; s++) {
    const A = sections[s], B = sections[s + 1], n = A.ring.length, c = cen(A.ring);
    let acc = 0;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n, a0 = A.ring[j], a1 = A.ring[k], b0 = B.ring[j], b1 = B.ring[k];
      const len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), u0 = acc / uM, u1 = (acc + len) / uM; acc += len;
      const v0 = A.y / vM, v1 = B.y / vM;
      const P = [[a0[0], A.y, a0[1]], [a1[0], A.y, a1[1]], [b1[0], B.y, b1[1]], [b0[0], B.y, b0[1]]];
      const U = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      // face normal from the quad's two edges, forced to point away from the ring centre
      const e1 = [P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]], e2 = [P[3][0] - P[0][0], P[3][1] - P[0][1], P[3][2] - P[0][2]];
      let N = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const mx = (P[0][0] + P[2][0]) / 2 - c[0], mz = (P[0][2] + P[2][2]) / 2 - c[1];
      if (N[0] * mx + N[2] * mz < 0) N = N.map((v) => -v);
      const l = Math.hypot(...N) || 1; N = N.map((v) => v / l);
      // counter-clockwise seen from outside, whichever way the ring runs: pick the order by the sign of (e1 x e2) . N
      const order = (e1[1] * e2[2] - e1[2] * e2[1]) * N[0] + (e1[2] * e2[0] - e1[0] * e2[2]) * N[1] + (e1[0] * e2[1] - e1[1] * e2[0]) * N[2] > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      order.forEach((i) => { pos.push(...P[i]); nor.push(...N); uv.push(...U[i]); });
    }
  }
  let capCount = 0;
  if (cap) {
    const T = sections[sections.length - 1], c = cen(T.ring), n = T.ring.length;
    for (let j = 0; j < n; j++) {
      const a = T.ring[j], b = T.ring[(j + 1) % n], v = [[c[0], T.y, c[1]], [a[0], T.y, a[1]], [b[0], T.y, b[1]]];
      // wind counter-clockwise seen from above (cr is minus the triangle normal's y)
      const cr = (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]) - (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]);
      (cr < 0 ? [0, 1, 2] : [0, 2, 1]).forEach((i) => { cpos.push(...v[i]); cnor.push(0, 1, 0); cuv.push(v[i][0] / uM, v[i][2] / uM); });
      capCount += 3;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos.concat(cpos), 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor.concat(cnor), 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv.concat(cuv), 2));
  g.addGroup(0, pos.length / 3, 0);
  if (capCount) g.addGroup(pos.length / 3, capCount, 1);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// Straight prism: the same ring from y0 to y1.
export const prism = (ring, y0, y1, uM, vM) => loft([{ y: y0, ring }, { y: y1, ring }], uM, vM);

// Mesh helper: geometry + [side, cap] materials, never frustum-culled (the custom layer positions each model itself).
export function mesh(geo, side, cap) {
  const m = new Mesh(geo, cap ? [side, cap] : side); m.frustumCulled = false; return m;
}

// Rounded dome / onion / cone by revolving a profile [[radius, y], ...] around the vertical axis.
export function lathe(profile, seg = 12, uM = 12, vM = 12) {
  return loft(profile.map(([r, y]) => ({ y, ring: ngon(seg, Math.max(r, 0.001)) })), uM, vM);
}

// Deterministic pseudo-random for jittered rock and texture noise.
export const rng = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export const group = (...kids) => { const g = new Group(); kids.forEach((k) => k && g.add(k)); return g; };

// Axis-aligned height (max y) of any object: used by the tests to check each model against the real building height.
export function heightOf(obj) {
  let top = -Infinity, bottom = Infinity;
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    top = Math.max(top, b.max.y); bottom = Math.min(bottom, b.min.y);
  });
  return { top, bottom };
}
