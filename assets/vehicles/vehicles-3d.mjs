// ARAH vehicles v0.1.0: the 3D part. Bundled with three.js into vendor/vehicles3d.min.js (npm run vehicles:build) and
// loaded only when a trip starts, so it costs nothing on the first screen.
// Car: Kenney's CC0 low-poly car (4 colours). Bus, lorry and motorbike: built here from primitive shapes (original work).
// Everything is drawn in its own tiny transparent canvas laid over the map, never inside the map's GL context.
import { WebGLRenderer, Scene, OrthographicCamera, AmbientLight, DirectionalLight, Group, Mesh, BoxGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, CircleGeometry, CanvasTexture, SRGBColorSpace, Color, SphereGeometry } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PALETTE = ['#f5b942', '#e5484d', '#3ecf8e', '#a865f5']; // matches the four car models, reused for built shapes
const CAR_FILES = ['yellow', 'red', 'green', 'purple'];
const DARK = new MeshStandardMaterial({ color: '#1b1f33', roughness: 0.6 });
const GLASS = new MeshStandardMaterial({ color: '#8fd8ff', roughness: 0.15, metalness: 0.2 });
const TYRE = new MeshStandardMaterial({ color: '#15171f', roughness: 0.9 });
const LIGHT = new MeshBasicMaterial({ color: '#fff6c8' });
const RED = new MeshBasicMaterial({ color: '#ff3b3b' });

const box = (w, h, d, m, x, y, z) => { const o = new Mesh(new BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
function wheel(r, w, x, y, z) { // axle along X, so rotation.x spins it
  const g = new Mesh(new CylinderGeometry(r, r, w, 16), TYRE); g.rotation.z = Math.PI / 2;
  const hub = new Mesh(new CylinderGeometry(r * 0.45, r * 0.45, w * 1.05, 10), new MeshStandardMaterial({ color: '#cfd3e6', metalness: 0.5, roughness: 0.4 }));
  hub.rotation.z = Math.PI / 2; const pivot = new Group(); pivot.add(g, hub); pivot.position.set(x, y, z); return pivot;
}
function lights(g, w, front, back, y) { g.add(box(w * 0.22, 0.07, 0.04, LIGHT, -w * 0.32, y, front), box(w * 0.22, 0.07, 0.04, LIGHT, w * 0.32, y, front), box(w * 0.22, 0.07, 0.04, RED, -w * 0.32, y, back), box(w * 0.22, 0.07, 0.04, RED, w * 0.32, y, back)); }

/** Built shapes. Forward is +Z, ground is y=0, about 1.7 units long for the car so everything shares one scale. */
export function build(kind, colour) {
  const g = new Group(), body = new MeshStandardMaterial({ color: colour, roughness: 0.45, metalness: 0.1 }), wheels = [];
  g.userData.tint = [body];
  if (kind === 'bus') {
    g.add(box(0.74, 0.62, 2.5, body, 0, 0.5, 0), box(0.76, 0.2, 2.1, GLASS, 0, 0.62, -0.05), box(0.7, 0.04, 2.4, body, 0, 0.83, 0), box(0.62, 0.22, 0.04, GLASS, 0, 0.66, 1.26));
    lights(g, 0.74, 1.26, -1.26, 0.28);
    for (const z of [-0.8, 0.85]) for (const x of [-0.42, 0.42]) { const w = wheel(0.2, 0.14, x, 0.2, z); wheels.push(w); g.add(w); }
  } else if (kind === 'truck') { // lorry: cab + cargo box
    g.add(box(0.72, 0.5, 0.75, body, 0, 0.42, 0.85), box(0.64, 0.22, 0.04, GLASS, 0, 0.55, 1.24), box(0.8, 0.75, 1.6, new MeshStandardMaterial({ color: '#e9ecf8', roughness: 0.6 }), 0, 0.66, -0.55), box(0.76, 0.12, 2.5, DARK, 0, 0.2, 0.05));
    lights(g, 0.72, 1.24, -1.36, 0.3);
    for (const z of [-1.0, -0.4, 0.95]) for (const x of [-0.44, 0.44]) { const w = wheel(0.19, 0.14, x, 0.19, z); wheels.push(w); g.add(w); }
  } else if (kind === 'moto') { // motorbike with a rider
    g.add(box(0.2, 0.22, 0.7, body, 0, 0.42, 0.05), box(0.14, 0.12, 0.34, DARK, 0, 0.58, -0.28), box(0.5, 0.05, 0.05, DARK, 0, 0.7, 0.42));
    const rider = new Mesh(new SphereGeometry(0.12, 12, 10), new MeshStandardMaterial({ color: '#eef0fa', roughness: 0.4 })); rider.position.set(0, 0.98, -0.05);
    g.add(rider, box(0.2, 0.34, 0.16, new MeshStandardMaterial({ color: '#2fd0ec', roughness: 0.6 }), 0, 0.76, -0.1), box(0.16, 0.05, 0.04, LIGHT, 0, 0.5, 0.58), box(0.12, 0.05, 0.04, RED, 0, 0.5, -0.5));
    for (const z of [-0.5, 0.55]) { const w = wheel(0.22, 0.09, 0, 0.22, z); wheels.push(w); g.add(w); }
  }
  if (kind === 'moto') g.scale.setScalar(1.3); // a bike is small next to a bus: keep it readable at 120 px
  g.userData.wheels = wheels; return g;
}

export function create(canvas, opts = {}) {
  const base = opts.base || '', loader = new GLTFLoader(), cache = new Map();
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  const scene = new Scene(), cam = new OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 50);
  scene.add(new AmbientLight('#ffffff', 1.5)); const sun = new DirectionalLight('#ffffff', 2.4); sun.position.set(-2, 4, 2); scene.add(sun);
  const holder = new Group(); scene.add(holder);
  // soft contact shadow: a radial gradient disc under the vehicle
  const c2 = document.createElement('canvas'); c2.width = c2.height = 64; const x2 = c2.getContext('2d'), gr = x2.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
  const shadow = new Mesh(new CircleGeometry(0.85, 24), new MeshBasicMaterial({ map: new CanvasTexture(c2), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; holder.add(shadow);
  let model = null, kind = null, colour = -1, spin = 0, hop = 0, hopT = 0, size = 0, token = 0;

  function fit(px) { size = px; const d = Math.min(window.devicePixelRatio || 1, 2); renderer.setPixelRatio(d); renderer.setSize(px, px, false); }
  function carModel(i) { // the CC0 car, cloned from a cached load
    const f = CAR_FILES[i % CAR_FILES.length];
    if (!cache.has(f)) cache.set(f, new Promise((ok, no) => loader.load(base + 'models/vehicle-truck-' + f + '.glb', (r) => ok(r.scene), undefined, no)));
    return cache.get(f).then((s) => { const c = s.clone(true); c.userData.wheels = []; c.traverse((n) => { if (/^wheel-/.test(n.name)) c.userData.wheels.push(n); }); return c; });
  }
  async function show() {
    const my = ++token; let m;
    try { m = kind === 'car' ? await carModel(colour) : build(kind, PALETTE[colour % PALETTE.length]); } catch (e) { m = build('bus', PALETTE[colour % PALETTE.length]); }
    if (my !== token) return; // a newer request replaced this one
    if (model) holder.remove(model);
    model = m; holder.add(model);
  }
  function aim(headingDeg, pitchDeg) { // heading: clockwise from screen-up; pitch: map tilt (0 = looking straight down)
    const p = (Math.max(0, Math.min(75, pitchDeg || 0)) * Math.PI) / 180, d = 10;
    cam.position.set(0, Math.cos(p) * d, Math.sin(p) * d); cam.up.set(0, 0, -1); cam.lookAt(0, 0.3, 0);
    holder.rotation.y = Math.PI - (headingDeg * Math.PI) / 180;
  }
  return {
    fit, aim, show,
    set(k, c) { if (k !== kind || c !== colour) { kind = k; colour = c; show(); } },
    tap() { hop = 1; hopT = 0; }, // a little jump
    draw(dt, speedMps, calm) {
      if (!model) return;
      const w = model.userData.wheels || []; spin += (speedMps || 0) * dt / 0.22; // wheel radius ~0.2
      for (const x of w) x.rotation.x = spin;
      if (hop > 0 && !calm) { hopT += dt; const u = Math.min(1, hopT / 0.5); holder.position.y = Math.sin(u * Math.PI) * 0.45; if (u >= 1) { hop = 0; holder.position.y = 0; } }
      renderer.render(scene, cam);
    },
    dispose() { token++; renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); },
  };
}
globalThis.__arahVeh3d = { create, build, PALETTE };
