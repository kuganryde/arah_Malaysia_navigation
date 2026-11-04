// ARAH landmarks v0.1.0 - entry of the vendored bundle: a MapLibre custom layer that draws the textured models in the
// map's own WebGL context (shared depth buffer, so buildings, terrain and the models occlude each other correctly).
// Bundled by scripts/landmarks/build-landmarks.mjs into vendor/landmarks3d.min.js and exposed as window.__arahLm3d.
import { WebGLRenderer, Scene, PerspectiveCamera, Matrix4, Vector3, DirectionalLight, HemisphereLight, AmbientLight, SRGBColorSpace } from 'three';
import { SPECS, LIT } from './models.mjs';
import { T } from './textures.mjs';

const DAY = { sun: 0xfff1d6, sunI: 1.7, sky: 0xe3efff, gnd: 0x5a5a66, hemI: 0.8, amb: 0xffffff, ambI: 0.1, lit: 0 };
const NIGHT = { sun: 0xa9bcff, sunI: 1.5, sky: 0x7d93d6, gnd: 0x2b3260, hemI: 1.3, amb: 0x8090d0, ambI: 0.5, lit: 1.4 };

function create({ map, maplibregl, onFirstDraw }) {
  let renderer, scene, camera, sun, hemi, amb, drawn = false, off = false;
  const built = new Map(); // id -> Group (built lazily the first time a landmark comes into view)

  function isNight() { // the app's night theme paints this background; everything else counts as daylight
    try { return String(map.getPaintProperty('bg', 'background-color')).toLowerCase() === '#0a0c1a' && !(map.getLayer('sat') && map.getLayoutProperty('sat', 'visibility') === 'visible'); } catch (e) { return false; }
  }
  function terrainOn() { try { return !!map.getTerrain(); } catch (e) { return false; } }

  function model(spec) {
    let g = built.get(spec.id);
    if (!g) { g = spec.build(T); scene.add(g); g.visible = false; built.set(spec.id, g); }
    return g;
  }
  // A landmark is worth drawing when zoomed in enough and its circle intersects the screen.
  function inView(spec, b, z) {
    if (z < spec.minZoom) return false;
    const dLat = spec.radius / 110574, dLng = spec.radius / (111320 * Math.cos(spec.c[1] * Math.PI / 180));
    return spec.c[0] + dLng >= b.getWest() && spec.c[0] - dLng <= b.getEast() && spec.c[1] + dLat >= b.getSouth() && spec.c[1] - dLat <= b.getNorth();
  }

  const layer = {
    id: 'landmark-models', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      renderer = new WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false; renderer.outputColorSpace = SRGBColorSpace;
      scene = new Scene(); camera = new PerspectiveCamera();
      sun = new DirectionalLight(DAY.sun, DAY.sunI); sun.position.set(-400, 700, 500); // from the south-east, like the afternoon sun over Malaysia
      hemi = new HemisphereLight(DAY.sky, DAY.gnd, DAY.hemI); amb = new AmbientLight(DAY.amb, DAY.ambI);
      scene.add(sun, hemi, amb);
    },
    render(gl, args) {
      if (off || !renderer) return;
      const z = map.getZoom(), b = map.getBounds(), night = isNight(), L = night ? NIGHT : DAY;
      sun.color.setHex(L.sun); sun.intensity = L.sunI; hemi.color.setHex(L.sky); hemi.groundColor.setHex(L.gnd); hemi.intensity = L.hemI; amb.color.setHex(L.amb); amb.intensity = L.ambI;
      LIT.forEach((m) => { m.emissiveIntensity = L.lit; });
      const view = new Matrix4().fromArray(args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args.modelViewProjectionMatrix);
      const terrain = terrainOn();
      let any = false;
      renderer.resetState();
      SPECS.forEach((spec) => {
        if (spec.id === 'kinabalu' && terrain) return; // the real terrain model replaces the stand-in peak
        if (!inView(spec, b, z)) return;
        const g = model(spec); g.visible = true;
        let alt = 0;
        if (terrain) { try { alt = map.queryTerrainElevation(spec.c) || 0; } catch (e) { alt = 0; } }
        const mc = maplibregl.MercatorCoordinate.fromLngLat(spec.c, alt), s = mc.meterInMercatorCoordinateUnits();
        // three (x east, y up, z south) -> mercator (x east, y south, z up): rotate about x, then mirror y.
        const l = new Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new Vector3(s, -s, s)).multiply(new Matrix4().makeRotationX(Math.PI / 2));
        camera.projectionMatrix = view.clone().multiply(l); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        // only this landmark visible for this pass: one camera matrix per model keeps float precision (each is tiny in mercator units)
        built.forEach((o, id) => { o.visible = id === spec.id; });
        renderer.render(scene, camera); renderer.resetState(); any = true;
      });
      if (any && !drawn) { drawn = true; if (onFirstDraw) onFirstDraw(); }
    },
    onRemove() { built.clear(); if (renderer) renderer.dispose(); },
  };

  return {
    layer,
    setOff(v) { off = !!v; map.triggerRepaint(); },
    state: () => ({ drawn, built: [...built.keys()], night: isNight(), light: scene ? [sun.intensity, hemi.intensity, amb.intensity, sun.color.getHexString(), hemi.color.getHexString()] : null }),
    dispose() { try { map.removeLayer(layer.id); } catch (e) { /* gone */ } },
  };
}

globalThis.__arahLm3d = { create, SPECS: SPECS.map((s) => ({ id: s.id, c: s.c, minZoom: s.minZoom, radius: s.radius, top: s.top })) };
