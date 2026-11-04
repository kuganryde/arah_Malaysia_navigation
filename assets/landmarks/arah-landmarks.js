/*! ARAH landmarks v0.1.0
 * Replaces the flat-coloured block landmarks with textured low-poly 3D models of 12 Malaysian icons (Petronas Twin
 * Towers, Merdeka 118, Menara KL, Masjid Negara, Sultan Abdul Samad, Batu Caves, Masjid Putra, Komtar, Menara Alor
 * Setar, A Famosa, DUN Sarawak, Gunung Kinabalu). Free: the models and textures are original, built in code.
 * Separate layer: it adds one custom map layer and never calls the app's code. The old extruded shapes stay underneath
 * as an almost invisible hit target (so tapping a landmark still opens its guide) and come back if anything fails.
 * The 3D engine (vendor/landmarks3d.min.js, three.js) is fetched only when the map first looks at a landmark, checked
 * against a pinned SRI hash. Skipped on Data Saver and without WebGL. Off switch: window.__arahLandmarks.set(false).
 */
(function () {
  'use strict';
  if (window.__arahLandmarks) return;
  window.__arahLandmarks = '0.1.0';

  var LM_SRI = 'sha384-obe0grfYcEIhBSU3oq5oDdx81ROHzR3rtRHJVAhv1wzHiCmqCMEsc5IZbqqnrKYn';
  var KEY = 'arah.landmarks3d.v1', LAYER = 'landmark-models', OLD = 'landmark-3d';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  // id, [lng, lat], minZoom, radius in metres: kept in step with models.mjs by test/landmarks.test.mjs
  var LM = [['petronas', 101.7116, 3.15787, 13.2, 120], ['merdeka118', 101.7005, 3.1416, 13.2, 90], ['menarakl', 101.7038, 3.1528, 13.2, 60], ['masjidnegara', 101.6918, 3.1419, 14, 110], ['sultanabdulsamad', 101.6946, 3.1487, 14, 90], ['batucaves', 101.684, 3.2371, 13, 520], ['masjidputra', 101.6895, 2.936, 14, 110], ['komtar', 100.3296, 5.4146, 13.2, 90], ['alorsetar', 100.3675, 6.1215, 13.2, 60], ['afamosa', 102.2505, 2.1916, 15.5, 30], ['dunsarawak', 110.3463, 1.5633, 14, 90], ['kinabalu', 116.5585, 6.075, 8.5, 9000]];
  var engine = null, loading = false, failed = false, inst = null, map = null, active = true;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function dataSaver() { var c = navigator.connection; return !!(c && c.saveData); }

  function wanted() { // is any landmark on screen and close enough to be worth the download?
    var z = map.getZoom(), b = map.getBounds();
    for (var i = 0; i < LM.length; i++) {
      var l = LM[i]; if (z < l[3]) continue;
      var dLat = l[4] / 110574, dLng = l[4] / (111320 * Math.cos(l[2] * Math.PI / 180));
      if (l[1] + dLng >= b.getWest() && l[1] - dLng <= b.getEast() && l[2] + dLat >= b.getSouth() && l[2] - dLat <= b.getNorth()) return true;
    }
    return false;
  }
  function load(done) { // one same-origin script, integrity-pinned
    if (engine) return done();
    if (loading || failed) return; loading = true;
    var s = document.createElement('script'); s.src = BASE + 'vendor/landmarks3d.min.js'; s.async = true;
    if (LM_SRI && LM_SRI !== 'sha384-PENDING') { s.integrity = LM_SRI; s.crossOrigin = 'anonymous'; }
    s.onload = function () { loading = false; engine = window.__arahLm3d; if (engine) done(); else failed = true; };
    s.onerror = function () { loading = false; failed = true; };
    document.head.appendChild(s);
  }
  function hideOld(on) { // 1% opacity keeps the extrusion queryable (tap -> guide) without showing it under the model
    try { if (map.getLayer(OLD)) map.setPaintProperty(OLD, 'fill-extrusion-opacity', on ? 0.01 : 1); } catch (e) { /* style swapping */ }
  }
  // The app ships with its `showLandmarks` property defaulting to false, which hides the landmark layers and their
  // labels, and it has no screen to change it. This module is the landmarks feature now, so it switches them on
  // (and off again with its own switch) instead of leaving the icons invisible.
  function reveal(on) {
    ['lm-label', OLD].forEach(function (id) { try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); } catch (e) { /* style swapping */ } });
  }
  function attach() {
    if (inst || !active || !map.getLayer(OLD)) return;
    try {
      reveal(true);
      inst = engine.create({ map: map, maplibregl: window.maplibregl, onFirstDraw: function () { if (active) hideOld(true); } });
      // directly BELOW the old shapes: they still write depth, and drawn first the models are not hidden behind them
      map.addLayer(inst.layer, OLD);
    } catch (e) { inst = null; failed = true; hideOld(false); }
  }
  function check() { if (active && !inst && !failed && wanted()) load(attach); }

  function boot() {
    var m = window.__arahMap;
    if (!m || !m.getLayer || !m.getLayer(OLD)) return false;
    map = m;
    if (lsGet(KEY) === '0') active = false;
    if (!webgl() || dataSaver()) { failed = true; return true; }
    map.on('moveend', check); map.on('zoomend', check);
    if (map.loaded()) check(); else map.once('idle', check);
    return true;
  }
  var tries = 0, iv = setInterval(function () { if (boot() || ++tries > 180) clearInterval(iv); }, 500);

  window.__arahLandmark3d = {
    set: function (on) {
      active = !!on; lsSet(KEY, on ? '1' : '0');
      if (!map) return;
      if (inst) inst.setOff(!on);
      reveal(!!on); hideOld(!!on && !!inst && inst.state().drawn);
      if (on) check();
    },
    status: function () { return { active: active, loaded: !!engine, failed: failed, attached: !!inst, state: inst ? inst.state() : null }; },
  };
})();
