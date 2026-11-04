/*! ARAH vehicles v0.1.0
 * While a trip is running, the plain arrow that marks you on the route is replaced by a small 3D vehicle that matches
 * the travel mode (car, motorbike, lorry, bus). Free models: Kenney's CC0 car; the rest are built in code.
 * Interactive: tap the vehicle and it hops and changes colour (remembered); the wheels turn with your speed.
 * Separate layer: finds the arrow marker on the page and lays its own tiny canvas over it. It never calls the app's code.
 * The 3D engine (vendor/vehicles3d.min.js, three.js) is fetched only when the first trip starts, checked against a pinned SRI hash.
 * Off switch: window.__arahVehicle.set(false). Skipped on Data Saver and when WebGL is unavailable (the arrow stays).
 */
(function () {
  'use strict';
  if (window.__arahVehicles) return;
  window.__arahVehicles = '0.1.0';

  var VEH_SRI = 'sha384-Y/wSoL7wqDO6OYE/fTg488eSabqRSkSvM688W0ofI6kVZ6gVLI2vY1beCyw6Calg';
  var KEY = 'arah.vehicle.v1', HINT = 'arah.vehicle.hint.v1';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  var SIZE = 120; // css px of the overlay canvas
  var engine = null, loading = false, failed = false, canvas = null, view = null, puck = null, raf = 0, last = 0, lastCenter = null, speed = 0, hintEl = null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function prefs() { try { var p = JSON.parse(lsGet(KEY) || '{}'); return { on: p.on !== false, c: (p.c | 0) & 3 }; } catch (e) { return { on: true, c: 0 }; } }
  function save(p) { lsSet(KEY, JSON.stringify(p)); }
  function mode() { try { var m = (JSON.parse(lsGet('arah.prefs.v1') || '{}')).mode; return m === 'moto' || m === 'bus' || m === 'truck' || m === 'walk' ? m : 'car'; } catch (e) { return 'car'; } }
  var calm = function () { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  var map = function () { return window.__arahMap || null; };

  function findPuck() { // the map marker whose child is the cyan-violet arrow
    var ms = document.querySelectorAll('.maplibregl-marker');
    for (var i = 0; i < ms.length; i++) { var c = ms[i].firstElementChild; if (c && /clip-path/.test(c.getAttribute('style') || '') && ms[i].offsetWidth === 30) return ms[i]; }
    return null;
  }
  function webgl() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }
  function dataSaver() { var c = navigator.connection; return !!(c && c.saveData); }

  function load(done) { // one same-origin script, integrity-pinned
    if (engine) return done();
    if (loading || failed) return; loading = true;
    var s = document.createElement('script'); s.src = BASE + 'vendor/vehicles3d.min.js'; s.async = true;
    if (VEH_SRI) { s.integrity = VEH_SRI; s.crossOrigin = 'anonymous'; }
    s.onload = function () { loading = false; engine = window.__arahVeh3d; if (engine) done(); else failed = true; };
    s.onerror = function () { loading = false; failed = true; };
    document.head.appendChild(s);
  }

  function hint() { // once per device: tells people they can tap it
    if (lsGet(HINT) || !document.body) return; lsSet(HINT, '1');
    hintEl = document.createElement('div'); hintEl.setAttribute('role', 'status'); hintEl.setAttribute('aria-live', 'polite');
    hintEl.style.cssText = 'position:fixed;z-index:8;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 150px);padding:8px 14px;border-radius:12px;background:#141729;color:#eef0fa;border:1px solid #2fd0ec;font:500 13px/1.3 "Ubuntu","Segoe UI",system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5);pointer-events:none';
    hintEl.textContent = 'Ketik kenderaan untuk tukar warna · Tap the vehicle to change colour';
    document.body.appendChild(hintEl); setTimeout(function () { if (hintEl) hintEl.remove(); hintEl = null; }, 5000);
  }

  function metres(a, b) { var k = Math.PI / 180, dy = (b.lat - a.lat) * 111320, dx = (b.lng - a.lng) * 111320 * Math.cos(a.lat * k); return Math.sqrt(dx * dx + dy * dy); }
  function heading(el) { var m = /rotateZ\((-?[\d.]+)deg\)/.exec(el.style.transform || ''); return m ? parseFloat(m[1]) : 0; }

  function start(p) {
    if (view || !engine) return;
    puck = p; canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:' + SIZE + 'px;height:' + SIZE + 'px;z-index:7;pointer-events:none;will-change:transform';
    document.body.appendChild(canvas);
    try { view = engine.create(canvas, { base: BASE }); view.fit(SIZE); } catch (e) { failed = true; if (canvas) canvas.remove(); canvas = null; view = null; return; }
    var q = prefs(); view.set(mode(), q.c); puck.firstElementChild.style.visibility = 'hidden'; hint();
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); failed = true; }); // GPU reset: fall back to the arrow
    last = 0; lastCenter = null; raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    if (puck && puck.firstElementChild) puck.firstElementChild.style.visibility = '';
    if (view) { try { view.dispose(); } catch (e) { /* gone */ } }
    if (canvas) canvas.remove();
    view = canvas = puck = null;
  }
  function frame(ts) {
    raf = 0; if (!view) return;
    if (!puck || !puck.isConnected || !prefs().on) return stop();
    raf = requestAnimationFrame(frame);
    if (document.visibilityState !== 'visible') return; // hidden tab: no drawing
    if (ts - last < 33) return; var dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts; // ~30 fps is plenty for a 120 px sprite
    var r = puck.getBoundingClientRect(), m = map(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas.style.transform = 'translate(' + Math.round(cx - SIZE / 2) + 'px,' + Math.round(cy - SIZE / 2) + 'px)';
    if (m) { var c = m.getCenter(); if (lastCenter && dt > 0) speed = speed * 0.8 + 0.2 * Math.min(60, metres(lastCenter, c) / dt); lastCenter = c; }
    view.set(mode(), prefs().c); view.aim(heading(puck), m ? m.getPitch() : 0); view.draw(dt, speed, calm());
  }

  // tap on the vehicle (checked on the document so the canvas never blocks map gestures)
  document.addEventListener('pointerup', function (e) {
    if (!view || !canvas || e.target.closest && e.target.closest('button,a,input,[role=dialog]')) return;
    var r = canvas.getBoundingClientRect(), dx = e.clientX - (r.left + SIZE / 2), dy = e.clientY - (r.top + SIZE / 2);
    if (dx * dx + dy * dy > 34 * 34) return;
    var q = prefs(); q.c = (q.c + 1) & 3; save(q); view.set(mode(), q.c); view.tap();
    try { navigator.vibrate && navigator.vibrate(10); } catch (x) { /* optional */ }
  }, { passive: true, capture: true });

  setInterval(function () { // cheap idle poll: starts when a trip puts the arrow on the map, stops when it goes
    var q = prefs(); if (!q.on || failed || document.visibilityState !== 'visible') { if (view && !q.on) stop(); return; }
    var p = findPuck();
    if (!p) { if (view) stop(); return; }
    if (mode() === 'walk' || dataSaver() || !webgl()) { if (view) stop(); return; }
    if (!view) load(function () { var np = findPuck(); if (np) start(np); });
  }, 700);

  window.__arahVehicle = {
    status: function () { return { on: prefs().on, running: !!view, loaded: !!engine, failed: failed, mode: mode(), colour: prefs().c }; },
    set: function (on) { var q = prefs(); q.on = !!on; save(q); if (!on && view) stop(); },
  };
})();
