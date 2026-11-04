/*! ARAH festive theme v0.1.1
 * Festival themes for Malaysia's celebrations: colours, glowing icons, a lit route with travelling lights, pulsing
 * sights, string-light bunting, floating lanterns and tap fireworks on the map.
 * Separate layer, like arah-ar.js: it reads the map through window.__arahMap and the DOM, and never calls the app's
 * other code. The festival is picked by date (Auto), or by hand, or switched off.
 * Safety: while a trip is active, or AR is on, all moving decoration stops (a static route colour stays), and
 * nothing flashes: every effect is a slow fade. Honours "reduce motion". No network, nothing stored but the choice.
 */
(function () {
  'use strict';
  if (window.__arahFestive) return;
  window.__arahFestive = '0.1.1';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  var PREF = 'arah.festive.v1', SEEN = 'arah.festive.hi';
  var F, FX, cur = null, canvas, ctx, scene, btn, scrim, raf = 0, last = 0, mapFx = null, forcedBy = 'auto';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function prefs() { var p = {}; try { p = JSON.parse(lsGet(PREF) || '{}') || {}; } catch (e) { p = {}; } return { mode: typeof p.mode === 'string' ? p.mode : 'auto', motion: p.motion !== false }; }
  function savePrefs(p) { lsSet(PREF, JSON.stringify(p)); moAt = 0; }
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) { if (k === 'class') n.className = props[k]; else if (k === 'text') n.textContent = props[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]); else n.setAttribute(k, props[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function tripActive() { var b = document.querySelectorAll('button'); for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true; return false; }
  function arOn() { try { return !!(window.__arahARApi && window.__arahARApi.state && window.__arahARApi.state.on); } catch (e) { return false; } }
  function map() { return window.__arahMap || null; }
  // Cached for 300 ms: this runs 30x/s from the canvas loop and 9x/s from the map loop, and used to rescan every <button>
  // and re-parse the stored preferences each time. A trip/AR/tab change is still noticed within a third of a second.
  var moAt = 0, moVal = false;
  var motionOk = function () {
    var n = performance.now();
    if (n - moAt > 300 || n < moAt) { moAt = n; moVal = !reduce && prefs().motion && !tripActive() && !arOn() && !document.hidden; }
    return moVal;
  };

  /* ---------- which festival */
  function resolve() {
    var p = prefs();
    if (p.mode === 'off') return null;
    if (p.mode !== 'auto' && F.byId[p.mode]) return { f: F.byId[p.mode], phase: 'manual', daysTo: 0 };
    return F.activeFestival(new Date());
  }

  /* ---------- theme: colours + glowing icons (CSS only, so it costs nothing per frame) */
  var css = '' +
    '.af-btn{position:fixed;z-index:34;top:80px;width:36px;height:36px;border-radius:10px;border:1px solid var(--af-c2,#2fd0ec);background:var(--surface,#141729);color:#eef0fa;font-size:18px;line-height:1;cursor:pointer;display:none;align-items:center;justify-content:center;box-shadow:0 0 12px var(--af-glow,rgba(47,208,236,.4))}' +
    '.af-cv{position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2}' +
    '.af-scrim{position:fixed;inset:0;z-index:60;background:rgba(5,6,16,.78);display:grid;place-items:end center}' +
    '.af-sheet{width:100%;max-width:480px;height:min(80vh,700px);background:#141729;border:1px solid var(--af-c2,#2fd0ec);border-radius:16px 16px 0 0;color:#eef0fa;font:400 14px/1.4 "Ubuntu",system-ui,sans-serif;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}' +
    '.af-head{display:flex;align-items:center;gap:8px;padding:14px 14px 8px}.af-head h2{flex:1;margin:0;font:800 24px/1 "Barlow Condensed","Ubuntu",sans-serif;font-style:italic;text-transform:uppercase;color:var(--af-c2,#2fd0ec)}' +
    '.af-x{min-width:40px;min-height:40px;border-radius:8px;border:1px solid #3a3f66;background:transparent;color:#eef0fa;font-size:16px;cursor:pointer}' +
    '.af-body{flex:1;overflow:auto;padding:0 14px 12px}.af-note{color:#9aa0c4;font-size:12px;margin:0 0 10px}' +
    '.af-row{display:flex;align-items:center;gap:10px;width:100%;padding:10px;margin:0 0 6px;border-radius:10px;border:1px solid #2a2f55;background:#0f1226;color:#eef0fa;text-align:left;font:inherit;cursor:pointer;min-height:52px}' +
    '.af-row[aria-pressed=true]{border-color:var(--af-c2,#2fd0ec);box-shadow:0 0 12px var(--af-glow,rgba(47,208,236,.35))}' +
    '.af-sw{flex:none;width:30px;height:30px;border-radius:50%}.af-t{flex:1;min-width:0}.af-t b{display:block;font-size:14px}.af-t small{color:#9aa0c4;font-size:12px}' +
    '.af-foot{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid #2a2f55;color:#9aa0c4;font-size:12px}.af-foot label{display:flex;gap:6px;align-items:center;flex:1;cursor:pointer}' +
    '.af-toast{position:fixed;z-index:55;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 132px);width:min(92vw,400px);padding:12px 16px;border-radius:14px;border:1px solid var(--af-c2,#2fd0ec);background:rgba(20,23,41,.94);color:#eef0fa;text-align:center;font:500 13px/1.4 "Ubuntu",system-ui,sans-serif;box-shadow:0 0 28px var(--af-glow,rgba(47,208,236,.45));animation:af-in .6s ease-out both}' +
    '.af-toast b{display:block;font:800 22px/1.1 "Barlow Condensed","Ubuntu",sans-serif;font-style:italic;text-transform:uppercase;color:var(--af-c2,#2fd0ec);margin-bottom:2px}' +
    '@keyframes af-in{from{opacity:0;transform:translate(-50%,-10px) scale(.96)}to{opacity:1;transform:translate(-50%,0) scale(1)}}' +
    '/* twinkle = opacity only: it runs on the GPU compositor. Animating text-shadow/filter repaints on the main thread every frame (measured ~300 ms of CPU per second) */' +
    '@keyframes af-tw{0%,100%{opacity:1}50%{opacity:.78}}' +
    '@keyframes af-pu{0%,100%{opacity:1}50%{opacity:.82}}' +
    'html[data-festive] .ph{text-shadow:0 0 7px var(--af-glow),0 0 14px var(--af-glow)}' +
    'html[data-festive]:not([data-festive-calm]) .ph:nth-of-type(3n){animation:af-tw 3.4s ease-in-out infinite}' +
    'html[data-festive]:not([data-festive-calm]) .ph:nth-of-type(3n+1){animation:af-tw 4.6s ease-in-out -1.4s infinite}' +
    'html[data-festive] .btn-primary{box-shadow:0 0 16px var(--af-glow)}' +
    'html[data-festive] .maplibregl-marker{filter:drop-shadow(0 0 7px var(--af-glow));animation:af-pu 2.6s ease-in-out infinite}' +
    'html[data-festive-still] *,html[data-festive-still] .maplibregl-marker{animation:none!important}' +
    '@media (prefers-reduced-motion:reduce){html[data-festive] .ph,html[data-festive] .maplibregl-marker,.af-toast{animation:none!important}}' +
    '.af-btn:focus-visible,.af-x:focus-visible,.af-row:focus-visible{outline:2px solid #fff;outline-offset:2px}';

  function mix(a, b, pct) { return 'color-mix(in srgb, ' + a + ' ' + pct + '%, ' + b + ')'; }
  function applyTheme(f) {
    var r = document.documentElement, s = r.style;
    var VARS = ['--color-accent', '--color-accent-2', '--af-c1', '--af-c2', '--af-glow', '--glow-accent', '--glow-cyan'];
    ['100', '200', '300', '400', '500', '600', '700', '800', '900'].forEach(function (k) { VARS.push('--color-accent-' + k, '--color-accent-2-' + k); });
    if (!f) { VARS.forEach(function (v) { s.removeProperty(v); }); ['data-festive', 'data-festive-calm', 'data-festive-still'].forEach(function (a) { r.removeAttribute(a); }); return; }
    var p = mix(f.c1, '#ffffff', 85), q = mix(f.c2, '#ffffff', 90); // lift dark brand colours so text and buttons stay readable
    s.setProperty('--color-accent', p); s.setProperty('--color-accent-2', q); s.setProperty('--af-c1', f.c1); s.setProperty('--af-c2', f.c2);
    s.setProperty('--af-glow', mix(f.c2, 'transparent', 70));
    s.setProperty('--glow-accent', '0 0 14px ' + mix(f.c1, 'transparent', 60)); s.setProperty('--glow-cyan', '0 0 14px ' + mix(f.c2, 'transparent', 60));
    var shade = { 100: [8, '#fff'], 200: [20, '#fff'], 300: [40, '#fff'], 400: [72, '#fff'], 500: [100, '#fff'], 600: [78, '#000'], 700: [58, '#000'], 800: [38, '#000'], 900: [22, '#000'] };
    Object.keys(shade).forEach(function (k) {
      var pr = shade[k][0], base = shade[k][1];
      s.setProperty('--color-accent-' + k, k < 500 ? mix(p, base, 100 - pr) : mix(p, base, pr));
      s.setProperty('--color-accent-2-' + k, k < 500 ? mix(q, base, 100 - pr) : mix(q, base, pr));
    });
    r.setAttribute('data-festive', f.id); f.calm ? r.setAttribute('data-festive-calm', '') : r.removeAttribute('data-festive-calm');
  }

  /* ---------- canvas: bunting, lanterns, sparkles, tap fireworks */
  function sizeCanvas() {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cur) scene = new FX.Scene(cur.f, w, h, { max: 22, seed: 7 });
  }
  function frame(ts) {
    raf = 0;
    if (!cur) return;
    var run = motionOk();
    if (!run && !reduce) { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; return schedule(500); } // paused: trip, AR, hidden tab
    canvas.style.display = '';
    var dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts;
    var t0 = performance.now();
    scene.update(dt);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    FX.garland(ctx, cur.f, window.innerWidth, scene.t);
    scene.draw(ctx);
    // Self-tuning frame rate: ~30 fps normally; a slow phone (frames costing >4 ms / >8 ms) backs off to ~20 / ~10 fps
    // so the glow never competes with the map or the driver's navigation for the main thread.
    cost = cost * 0.9 + (performance.now() - t0) * 0.1;
    schedule(cost > 8 ? 100 : cost > 4 ? 50 : 33);
  }
  var cost = 0;
  function schedule(ms) { if (raf || reduce) return; raf = setTimeout(function () { raf = requestAnimationFrame(frame); }, ms); }
  function drawStill() { if (!canvas || !cur) return; canvas.style.display = ''; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); FX.garland(ctx, cur.f, window.innerWidth, 0.5); scene.update(0); scene.draw(ctx); }

  /* ---------- map effects */
  var HAV = function (a, b) { var R = 6371000, k = Math.PI / 180, dLa = (b[1] - a[1]) * k, dLo = (b[0] - a[0]) * k, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.sqrt(x)); };
  function routeCoords(m) {
    try {
      var s = m.getSource('route'); if (!s) return null;
      var d = typeof s.serialize === 'function' ? s.serialize().data : s._data; if (!d) return null;
      var g = d.type === 'FeatureCollection' ? (d.features[0] && d.features[0].geometry) : d.type === 'Feature' ? d.geometry : d;
      return g && g.type === 'LineString' && g.coordinates.length > 1 ? g.coordinates : null;
    } catch (e) { return null; }
  }
  function startMapFx(m) {
    if (mapFx && mapFx.m === m) return;
    mapFx = { m: m, t0: performance.now(), orig: {}, coords: null, cum: null, total: 0, sig: '', on: false, timer: 0 };
    var st = mapFx;
    // Write a paint value only when it differs. setPaintProperty fires 'styledata', and our styledata handler calls ensure()
    // again, so an unconditional write looped forever: the map redrew ~30x/s and never went idle (battery, heat, jank).
    function sp(layer, prop, val) {
      var cur0 = m.getPaintProperty(layer, prop);
      if (cur0 === val || JSON.stringify(cur0) === JSON.stringify(val)) return;
      m.setPaintProperty(layer, prop, val);
    }
    function ensure() {
      if (!cur) return;
      try {
        if (m.getLayer('route-glow') && !('rg' in st.orig)) { st.orig.rg = [m.getPaintProperty('route-glow', 'line-color'), m.getPaintProperty('route-glow', 'line-opacity')]; st.orig.r = m.getPaintProperty('route', 'line-color'); }
        if (m.getLayer('route-glow')) { sp('route-glow', 'line-color', cur.f.c2); sp('route', 'line-color', cur.f.c1); }
        if (!m.getSource('festive-lights')) m.addSource('festive-lights', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        var before = m.getLayer('route-arrows') ? 'route-arrows' : undefined;
        if (!m.getLayer('festive-lights-halo')) m.addLayer({ id: 'festive-lights-halo', type: 'circle', source: 'festive-lights', paint: { 'circle-radius': 11, 'circle-color': cur.f.c2, 'circle-opacity': 0.5, 'circle-blur': 1 } }, before);
        if (!m.getLayer('festive-lights-core')) m.addLayer({ id: 'festive-lights-core', type: 'circle', source: 'festive-lights', paint: { 'circle-radius': 3.2, 'circle-color': '#fffdf0', 'circle-opacity': 0.95 } }, before);
        if (m.getSource('sights') && !m.getLayer('festive-sights-halo')) m.addLayer({ id: 'festive-sights-halo', type: 'circle', source: 'sights', paint: { 'circle-radius': 12, 'circle-color': cur.f.c2, 'circle-opacity': 0.25, 'circle-blur': 0.8 } }, m.getLayer('sights') ? 'sights' : undefined);
        if (m.getLayer('festive-lights-halo')) { sp('festive-lights-halo', 'circle-color', cur.f.c2); }
        if (m.getLayer('festive-sights-halo')) sp('festive-sights-halo', 'circle-color', cur.f.c2);
        if (m.getLayer('lm-label')) { st.orig.lm = st.orig.lm || m.getPaintProperty('lm-label', 'text-color'); sp('lm-label', 'text-color', cur.f.c2); }
      } catch (e) { /* style not ready yet: the next tick retries */ }
    }
    function tick() {
      if (!cur || mapFx !== st) return;
      var moving = motionOk(), t = (performance.now() - st.t0) / 1000;
      ensure();
      try {
        var cs = routeCoords(m), sig = cs ? cs.length + ':' + cs[0] + ':' + cs[cs.length - 1] : '';
        if (sig !== st.sig) { st.sig = sig; st.coords = cs; if (cs) { st.cum = FX.cumulative(cs, HAV); st.total = st.cum[st.cum.length - 1] || 1; if (moving && scene) { var p = m.project(cs[cs.length - 1]); scene.burst(p.x, p.y); } } }
        var lights = m.getSource('festive-lights');
        if (lights) {
          // Every setData and every changed paint value makes MapLibre redraw the whole 3D scene, so an idle map is left alone:
          // the lights source is cleared once (not every tick) and the pulses run only where something is on screen.
          if (st.coords && moving) {
            var n = Math.min(14, Math.max(5, Math.round(st.total / 900))), gap = Math.max(60, st.total / (n + 2)), speed = Math.max(40, Math.min(160, st.total / 18)), dists = [];
            for (var i = 0; i < n; i++) dists.push(t * speed + i * gap);
            var pts = FX.alongLine(st.coords, dists, st.total, st.cum);
            lights.setData({ type: 'FeatureCollection', features: pts.map(function (c, k) { return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }; }) });
            st.lit = true;
          } else if (st.lit) { lights.setData({ type: 'FeatureCollection', features: [] }); st.lit = false; }
        }
        var Q = function (v) { return Math.round(v * 24) / 24; }; // steps: an unchanged value is a no-op for MapLibre, so no redraw
        if (m.getLayer('route-glow')) { var live = moving && !!st.coords; /* animate only while a route is lit: an idle map must stay idle */ var g = live ? Q(0.38 + 0.22 * Math.sin(t * 2.2)) : 0.5; sp('route-glow', 'line-opacity', g); } // slow breathing glow, never a flash
        if (m.getLayer('festive-sights-halo')) {
          var seen = m.getZoom() >= 6; // the sights layer is hidden below zoom 6: nothing to pulse
          var pr = live && seen ? Q(11 + 5 * Math.sin(t * 1.8)) : 12, po = live && seen ? Q(0.2 + 0.12 * Math.sin(t * 1.8)) : 0.25;
          sp('festive-sights-halo', 'circle-radius', pr);
          sp('festive-sights-halo', 'circle-opacity', po);
        }
      } catch (e) { /* never break the page */ }
    }
    st.timer = setInterval(tick, 110);
    st.click = function (e) { if (cur && motionOk() && scene) scene.burst(e.point.x, e.point.y); };
    m.on('click', st.click);
    st.style = function () { setTimeout(ensure, 50); };
    m.on('styledata', st.style);
    ensure();
  }
  function stopMapFx() {
    var st = mapFx; if (!st) return; var m = st.m; mapFx = null; clearInterval(st.timer);
    try {
      m.off('click', st.click); m.off('styledata', st.style);
      ['festive-lights-halo', 'festive-lights-core', 'festive-sights-halo'].forEach(function (id) { if (m.getLayer(id)) m.removeLayer(id); });
      if (m.getSource('festive-lights')) m.removeSource('festive-lights');
      if (st.orig.rg) { m.setPaintProperty('route-glow', 'line-color', st.orig.rg[0]); m.setPaintProperty('route-glow', 'line-opacity', st.orig.rg[1]); m.setPaintProperty('route', 'line-color', st.orig.r); }
      if (st.orig.lm !== undefined && m.getLayer('lm-label')) m.setPaintProperty('lm-label', 'text-color', st.orig.lm);
    } catch (e) { /* style gone */ }
  }

  /* ---------- greeting once a day per festival */
  var LANG = { cny: 'zh', midautumn: 'zh', wesak: 'zh', christmas: 'zh', deepavali: 'ta', thaipusam: 'ta' };
  function greet(c) {
    if (!c || c.phase === 'manual' || !document.body) return;
    var d = F.key(F.dayOf(new Date())), tag = c.f.id + ':' + d;
    if (lsGet(SEEN) === tag) return; lsSet(SEEN, tag);
    var lines = [c.f.hi.ms]; if (c.f.hi.en !== c.f.hi.ms) lines.push(c.f.hi.en); if (LANG[c.f.id]) lines.push(c.f.hi[LANG[c.f.id]]);
    var sub = c.daysTo > 0 ? ' · ' + c.daysTo + ' hari lagi · ' + c.daysTo + ' day' + (c.daysTo > 1 ? 's' : '') + ' to go' : '';
    var t = el('div', { class: 'af-toast', role: 'status', 'aria-live': 'polite' }, [el('b', { text: c.f.name.ms }), el('div', { text: lines.join(' · ') }), el('div', { style: 'color:#9aa0c4;font-size:12px;margin-top:2px', text: (c.f.name.en + sub) })]);
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 7000); t.addEventListener('click', function () { t.remove(); });
  }

  /* ---------- picker sheet */
  function close(prev) { if (!scrim) return; scrim.remove(); scrim = null; if (prev && prev.focus) prev.focus(); }
  function open() {
    if (scrim) return; var prev = document.activeElement;
    scrim = el('div', { class: 'af-scrim' }); scrim.addEventListener('click', function (e) { if (e.target === scrim) close(prev); });
    scrim.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(prev); });
    document.body.appendChild(scrim); render(prev); var f = scrim.querySelector('.af-x'); if (f) f.focus();
  }
  function choose(mode, prev) { var p = prefs(); p.mode = mode; savePrefs(p); refresh(); render(prev); }
  function render(prev) {
    if (!scrim) return;
    var p = prefs(), auto = F.activeFestival(new Date()), up = F.upcoming(new Date(), 99), nextOf = {}; up.forEach(function (o) { nextOf[o.f.id] = o; });
    var sheet = el('div', { class: 'af-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'af-h' });
    sheet.appendChild(el('div', { class: 'af-head' }, [el('h2', { id: 'af-h', text: 'Perayaan · Festive' }), el('button', { class: 'af-x', type: 'button', 'aria-label': 'Tutup · Close', text: '✕', onclick: function () { close(prev); } })]));
    var body = el('div', { class: 'af-body' });
    body.appendChild(el('p', { class: 'af-note', text: 'Tema meraikan perayaan Malaysia. Tarikh berasaskan bulan mungkin berbeza sehari. · Themes for Malaysia’s festivals. Moon-based dates can be a day off.' }));
    function row(sw, title, sub, mode) {
      var r = el('button', { class: 'af-row', type: 'button', 'aria-pressed': String(p.mode === mode), onclick: function () { choose(mode, prev); } }, [sw, el('span', { class: 'af-t' }, [el('b', { text: title }), el('small', { text: sub })])]);
      return r;
    }
    var gradient = function (a, b) { var s = el('span', { class: 'af-sw' }); s.style.background = 'linear-gradient(135deg,' + a + ',' + b + ')'; return s; };
    body.appendChild(row(gradient('#a865f5', '#2fd0ec'), 'Auto', auto ? 'Sekarang: ' + auto.f.name.ms + ' · Now: ' + auto.f.name.en : 'Tiada perayaan sekarang · No festival right now', 'auto'));
    body.appendChild(row(gradient('#3a3f66', '#141729'), 'Mati · Off', 'Tema ARAH asal · Original ARAH look', 'off'));
    F.FESTIVALS.slice().sort(function (a, b) { return (nextOf[a.id] ? nextOf[a.id].daysTo : 999) - (nextOf[b.id] ? nextOf[b.id].daysTo : 999); }).forEach(function (f) {
      var n = nextOf[f.id], date = n ? n.day.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
      body.appendChild(row(gradient(f.c1, f.c2), f.name.ms === f.name.en ? f.name.ms : f.name.ms + ' · ' + f.name.en, (date ? '≈ ' + date + (n.daysTo ? ' · ' + n.daysTo + ' hari · days' : ' · hari ini · today') : '') + ((f.name.zh && /[^\x00-\x7f]/.test(f.name.zh)) ? '  ' + f.name.zh : ''), f.id));
    });
    sheet.appendChild(body);
    var sw = el('input', { type: 'checkbox' }); sw.checked = p.motion; sw.addEventListener('change', function () { var q = prefs(); q.motion = sw.checked; savePrefs(q); refresh(); });
    sheet.appendChild(el('div', { class: 'af-foot' }, [el('label', null, [sw, el('span', { text: 'Animasi · Animations' + (reduce ? ' (dimatikan oleh tetapan peranti · off by device setting)' : '') })])]));
    scrim.replaceChildren(sheet);
    var focus = scrim.querySelector('.af-row[aria-pressed=true]'); void focus;
  }

  /* ---------- put it together */
  function refresh() {
    var next = resolve(), changed = (cur && cur.f.id) !== (next && next.f.id);
    cur = next; applyTheme(cur && cur.f);
    if (btn) { btn.setAttribute('aria-label', 'Tema perayaan · Festive theme' + (cur ? ': ' + cur.f.name.en : ': off')); btn.firstChild.textContent = cur ? '✦' : '☆'; }
    if (!cur) { stopMapFx(); if (canvas) { canvas.style.display = 'none'; ctx.clearRect(0, 0, canvas.width, canvas.height); } return; }
    if (changed || !scene) sizeCanvas();
    document.documentElement.toggleAttribute('data-festive-still', !prefs().motion || reduce);
    if (reduce || !prefs().motion) drawStill(); else { last = 0; schedule(0); }
    if (map()) startMapFx(map());
    if (changed) greet(cur);
  }
  function place() {
    if (!btn) return;
    var show = !tripActive(); btn.style.display = show ? 'flex' : 'none'; if (!show) return;
    var prior = document.querySelector('.ap-btn'), pill = document.querySelector('.arah-pwa-pill'), x = 64, y = 80;
    [pill, prior].forEach(function (e) { if (e && getComputedStyle(e).display !== 'none') x = Math.max(x, Math.round(e.getBoundingClientRect().right) + 8); });
    if (x + 36 > window.innerWidth - 56) { x = 12; y = 124; } // no room beside the other buttons: use the second row
    btn.style.left = x + 'px'; btn.style.top = y + 'px';
  }
  function init() {
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    canvas = el('canvas', { class: 'af-cv', 'aria-hidden': 'true' }); ctx = canvas.getContext('2d'); document.body.appendChild(canvas);
    btn = el('button', { class: 'af-btn', type: 'button', onclick: function () { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* optional */ } open(); } }, [el('span', { text: '✦', 'aria-hidden': 'true' })]);
    document.body.appendChild(btn);
    window.addEventListener('resize', function () { if (cur) { sizeCanvas(); if (reduce || !prefs().motion) drawStill(); } place(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && cur) { last = 0; schedule(0); } });
    refresh(); place();
    setInterval(function () { place(); var m = map(); if (cur && m && (!mapFx || mapFx.m !== m)) startMapFx(m); var still = !motionOk() && !reduce; document.documentElement.toggleAttribute('data-festive-still', still || reduce || !prefs().motion); }, 1000);
    setInterval(function () { var n = resolve(); if (n && cur && n.f.id !== cur.f.id) refresh(); else if (!!n !== !!cur) refresh(); }, 600000); // midnight roll-over while the app stays open
  }
  Promise.all([import(BASE + 'festivals.mjs'), import(BASE + 'fx.mjs')]).then(function (r) {
    F = r[0]; FX = r[1];
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }).catch(function (e) { console.warn('[ARAH festive] failed to load', e && e.message); });
  window.__arahFestiveApi = { open: open, refresh: refresh, current: function () { return cur && cur.f.id; } };
})();
