/*! ARAH drive UI v0.1.4
 * While a trip runs: an AR road view (camera + the route painted on the road, or a virtual road when there is no camera), a mini
 * guided map, a racing-style speedometer, and three drive modes (Normal, Sports, Luxury) that restyle all of it.
 * Privacy: the camera is opt-in (the AR button), is only displayed, and is never recorded, stored or uploaded; it stops when AR is
 * closed, the trip ends or the page is hidden. GPS stays on the device. Guidance only: a phone camera view is not a substitute for
 * looking at the road. Separate layer: reads window.__arahMap (the route source) and the DOM; never calls the app's code. */
(function () {
  'use strict';
  var C = window.__arahDriveCore, VERSION = '0.1.4';
  if (!C || window.__arahDriveUI) return;
  window.__arahDriveUI = VERSION;

  var PREF = 'arah.drive.v1', NS = 'http://www.w3.org/2000/svg';
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  var prefs = Object.assign({ theme: 'normal', ar: false }, lsGet(PREF) || {});
  if (!C.THEMES[prefs.theme]) prefs.theme = 'normal';
  function save() { lsSet(PREF, prefs); }
  var arPref = lsGet('arah.ar.v1'), HFOV = arPref && arPref.hfov >= 40 && arPref.hfov <= 110 ? arPref.hfov : 65; // reuse the AR assist calibration if the user set one
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var S = { active: false, root: null, map: null, line: null, hint: 0, pos: null, fixAt: 0, speed: 0, shown: 0, heading: 0, compass: null, beta: 90,
    stream: null, video: null, watch: null, demo: false, timers: [], themeOpen: false, camMsgAt: 0, cam: null, speedo: null, mini: null, ar: false, srcOn: null };
  var T = function () { return C.theme(prefs.theme); };

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) { if (k === 'class') n.className = props[k]; else if (k === 'text') n.textContent = props[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]); else n.setAttribute(k, props[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); }); return n;
  }
  function svg(tag, attrs, parent) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function tripActive() { var b = document.querySelectorAll('button'); for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return b[i]; return null; }

  /* ---------------------------------------------------------------- styles (tokens come from the active theme) */
  var CSS = '.adr{--a:#2fd0ec;--a2:#7be3f5;--face:#0f1226;--ink:#eef0fa;--warn:#ff5a7a;position:fixed;inset:0;z-index:9;pointer-events:none;font-family:"Ubuntu","Segoe UI",system-ui,sans-serif;color:var(--ink)}' +
    '.adr button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;pointer-events:auto}' +
    '.adr button:focus-visible{outline:3px solid var(--a2);outline-offset:2px}' +
    '.adr-cam{position:fixed;left:12px;right:68px;max-width:560px;border-radius:18px;overflow:hidden;background:#05070f;border:2px solid var(--a);box-shadow:0 8px 28px rgba(0,0,0,.55);pointer-events:auto}' +
    '.adr-cam video,.adr-cam canvas{position:absolute;inset:0;width:100%;height:100%;display:block}.adr-cam video{object-fit:cover}' +
    '.adr-x{position:absolute;top:8px;right:8px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(8,10,20,.78);display:grid;place-items:center}' +
    '.adr-msg{position:absolute;left:10px;right:60px;bottom:8px;padding:6px 10px;border-radius:10px;background:rgba(8,10,20,.82);color:#fff;font-size:12px;line-height:1.35}' +
    '.adr-pill{position:fixed;left:12px;min-height:44px;display:flex;align-items:center;gap:8px;padding:0 16px;border-radius:22px;border:2px solid var(--a);background:rgba(10,12,26,.9);font-weight:700;font-size:14px;letter-spacing:.04em}' +
    '.adr-speedo{position:fixed;left:12px;width:132px;height:132px;padding:0;border-radius:50%;border:0;background:transparent;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}' +
    '.adr-mini{position:fixed;right:12px;width:132px;height:132px;border-radius:50%;border:3px solid var(--a);background:var(--face);box-shadow:0 6px 18px rgba(0,0,0,.5);pointer-events:none}' +
    '.adr-themes{position:fixed;left:12px;display:flex;gap:6px;padding:6px;border-radius:26px;background:rgba(10,12,26,.94);border:1px solid rgba(255,255,255,.2);box-shadow:0 8px 24px rgba(0,0,0,.5)}' +
    '.adr-themes button{min-height:44px;min-width:44px;padding:0 14px;border-radius:22px;border:2px solid transparent;background:rgba(255,255,255,.08);font-weight:700;font-size:13px}' +
    '.adr-themes button[aria-pressed=true]{border-color:var(--a);background:rgba(255,255,255,.18)}' +
    '.adr [hidden]{display:none!important}.adr-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}';

  /* ---------------------------------------------------------------- speedometer (SVG; sports adds shift lights, luxury serif numerals) */
  function buildSpeedo() {
    var t = T(), s = svg('svg', { viewBox: '0 0 132 132', width: 132, height: 132, 'aria-hidden': 'true' }), g = {};
    var defs = svg('defs', {}, s), rg = svg('radialGradient', { id: 'adr-face', cx: '50%', cy: '40%', r: '70%' }, defs);
    svg('stop', { offset: '0%', 'stop-color': '#1d2140' }, rg); svg('stop', { offset: '100%', 'stop-color': t.face }, rg);
    svg('circle', { cx: 66, cy: 66, r: 64, fill: t.id === 'sports' ? '#0b0b0e' : 'url(#adr-face)', stroke: t.accent, 'stroke-width': t.id === 'luxury' ? 1.5 : 3 }, s);
    if (t.id === 'luxury') svg('circle', { cx: 66, cy: 66, r: 59, fill: 'none', stroke: t.accent, 'stroke-width': 0.6, opacity: 0.7 }, s);
    if (t.id === 'sports') { // carbon-weave hint + diagonal racing stripe
      svg('path', { d: 'M20 112 L112 20', stroke: t.accent, 'stroke-width': 1, opacity: 0.18 }, s);
      for (var i = 0; i < t.ledN; i++) { var a = 205 + i * (130 / (t.ledN - 1)), p = C.arcPoint(66, 66, 57, a); (g.leds = g.leds || []).push(svg('circle', { cx: p[0], cy: p[1], r: 2.8, fill: '#33363f' }, s)); }
    }
    var R = t.id === 'sports' ? 48 : 50;
    svg('path', { d: C.arcPath(66, 66, R, C.SWEEP.start, C.SWEEP.end), fill: 'none', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
    svg('path', { d: C.arcPath(66, 66, R, C.gaugeAngle(t.redFrom, t.max), C.SWEEP.end), fill: 'none', stroke: t.warn, 'stroke-width': 6, opacity: 0.85 }, s);
    g.arc = svg('path', { d: '', fill: 'none', stroke: t.accent, 'stroke-width': 6, 'stroke-linecap': 'round' }, s);
    for (var v = 0; v <= t.max; v += 10) { // ticks: major every 20 km/h, labels every 40
      var major = v % 20 === 0, a2 = C.gaugeAngle(v, t.max), p1 = C.arcPoint(66, 66, R - 6, a2), p2 = C.arcPoint(66, 66, R - (major ? 12 : 9), a2);
      svg('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: v >= t.redFrom ? t.warn : '#cfd3ea', 'stroke-width': major ? 1.6 : 0.8 }, s);
      if (v % 40 === 0) { var pl = C.arcPoint(66, 66, R - 20, a2), tx = svg('text', { x: pl[0], y: pl[1] + 3, 'text-anchor': 'middle', 'font-size': 8, fill: '#e6e9fa', 'font-family': t.font }, s); tx.textContent = v; }
    }
    g.needle = svg('line', { x1: 66, y1: 66, x2: 66, y2: 66 - (R - 4), stroke: t.id === 'luxury' ? t.accent2 : t.accent2, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, s);
    svg('circle', { cx: 66, cy: 66, r: 5, fill: t.accent, stroke: '#0b0d1a', 'stroke-width': 1.5 }, s);
    g.num = svg('text', { x: 66, y: 92, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: t.ink, 'font-family': t.font, 'font-style': t.italic ? 'italic' : 'normal' }, s); g.num.textContent = '0';
    var u = svg('text', { x: 66, y: 104, 'text-anchor': 'middle', 'font-size': 8, fill: '#c7cbe4', 'letter-spacing': '1.5', 'font-family': t.font }, s); u.textContent = 'KM/J';
    S.speedo.svg = s; S.speedo.g = g; S.speedo.btn.replaceChildren(s); drawSpeedo(true);
  }
  function drawSpeedo(force) {
    var t = T(), g = S.speedo && S.speedo.g; if (!g) return;
    var v = S.shown, ang = C.gaugeAngle(v, t.max);
    g.needle.setAttribute('transform', 'rotate(' + (ang - 270) + ' 66 66)');
    g.arc.setAttribute('d', v < 0.5 ? '' : C.arcPath(66, 66, t.id === 'sports' ? 48 : 50, C.SWEEP.start, Math.max(C.SWEEP.start + 0.5, ang)));
    g.arc.setAttribute('stroke', v >= t.redFrom ? t.warn : t.accent);
    g.num.textContent = String(Math.round(v)); g.num.setAttribute('fill', v >= t.redFrom ? t.warn : t.ink);
    if (g.leds) g.leds.forEach(function (d, i) { var on = v / t.max > (i + 0.5) / g.leds.length; d.setAttribute('fill', on ? (i > g.leds.length - 4 ? t.warn : i > g.leds.length - 7 ? t.accent2 : t.accent) : '#33363f'); });
    var now = Date.now(); if (force || now - S.speedo.say > 5000 || Math.abs(v - (S.speedo.lastV || 0)) >= 10) { S.speedo.say = now; S.speedo.lastV = v; S.speedo.btn.setAttribute('aria-label', 'Meter laju ' + Math.round(v) + ' km/j. Mod ' + t.name.ms + ' · ' + t.name.en + '. Tekan untuk tukar mod · press to change mode'); }
  }
  function easeSpeed() { // needle glides to the GPS speed; the timer only runs while it is moving (nothing redraws when idle)
    if (S.easing) return; S.easing = true;
    (function step() {
      var d = S.speed - S.shown; if (Math.abs(d) < 0.25 || reduce) { S.shown = S.speed; drawSpeedo(true); S.easing = false; return; }
      S.shown += d * 0.22; drawSpeedo(); requestAnimationFrame(step);
    })();
  }

  /* ---------------------------------------------------------------- route + position */
  function readRoute() {
    var m = S.map, src = m && m.getSource && m.getSource('route'); if (!src || !src.getData) return;
    Promise.resolve(src.getData()).then(function (d) {
      var f = d && (d.type === 'FeatureCollection' ? d.features[0] : d), g = f && (f.geometry || f), line = null;
      if (g && g.type === 'LineString') line = g.coordinates; else if (g && g.type === 'MultiLineString') line = [].concat.apply([], g.coordinates);
      S.line = line && line.length > 1 ? line : null; S.hint = 0;
    }).catch(function () { /* route not ready */ });
  }
  function onFix(p) {
    var c = p.coords, v = c.speed != null && c.speed >= 0 ? c.speed * 3.6 : S.speed;
    S.pos = [c.longitude, c.latitude]; S.fixAt = p.timestamp || Date.now(); S.speed = v; if (S.speed < 2) S.speed = 0;
    if (c.heading != null && !isNaN(c.heading) && v > 9) S.gpsHeading = c.heading; easeSpeed();
  }
  function startGps() {
    if (S.watch != null || !navigator.geolocation) return;
    S.watch = navigator.geolocation.watchPosition(function (p) { if (!S.demo) onFix(p); }, function () { /* denied: the app shows its own message */ }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  function onOrient(e) {
    var h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
    if (h != null && !isNaN(h)) S.compass = h; if (e.beta != null) S.beta = e.beta;
  }
  function startOrient() {
    var go = function () { window.addEventListener('deviceorientationabsolute', onOrient, true); window.addEventListener('deviceorientation', onOrient, true); };
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') go(); }).catch(function () { /* no compass: GPS heading only */ }); else go();
  }
  // Position now: last fix pushed forward along the heading by speed x elapsed (max 2.5 s) so the view glides between 1 Hz fixes.
  function livePos() {
    if (!S.pos) return null; var dt = Math.min(2.5, (Date.now() - S.fixAt) / 1000), v = S.speed / 3.6; if (!v || dt <= 0) return S.pos;
    var h = (S.gpsHeading != null ? S.gpsHeading : S.heading) * Math.PI / 180, dm = v * dt;
    return [S.pos[0] + dm * Math.sin(h) / (111320 * Math.cos(S.pos[1] * Math.PI / 180)), S.pos[1] + dm * Math.cos(h) / 110574];
  }
  function updateHeading(path) {
    var target = null;
    if (S.gpsHeading != null && S.speed > 9) target = S.gpsHeading;
    else if (S.compass != null) target = S.compass;
    else if (path && path.pts.length > 1) { var q = path.pts[Math.min(path.pts.length - 1, 3)]; target = C.bearingOf([0, 0], [q.x, q.y]); }
    if (target != null) S.heading = C.lerpAngle(S.heading, target, 0.3);
  }

  /* ---------------------------------------------------------------- AR road view */
  function pointAt(pts, s) {
    for (var i = 1; i < pts.length; i++) if (pts[i].d >= s) { var a = pts[i - 1], b = pts[i], l = (b.d - a.d) || 1, k = (s - a.d) / l; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l }; }
    return null;
  }
  function rgba(rgb, a) { return 'rgba(' + rgb + ',' + a + ')'; }
  function drawCam(path) {
    var cv = S.cam.cv, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
    var t = T(), pitch = Math.max(-20, Math.min(20, S.beta - 90)) * Math.PI / 180, horizon = H * 0.42 + (S.beta === 90 ? 0 : (W / 2) / Math.tan(HFOV * Math.PI / 360) * Math.tan(pitch));
    horizon = Math.max(H * 0.2, Math.min(H * 0.7, horizon));
    if (!S.video || !S.video.videoWidth) { // virtual road when there is no camera: dark sky, glowing horizon, perspective grid
      var sky = x.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#05070f'); sky.addColorStop(1, rgba(t.ribbon[1], 0.32)); x.fillStyle = sky; x.fillRect(0, 0, W, horizon);
      var gr = x.createLinearGradient(0, horizon, 0, H); gr.addColorStop(0, '#171a2e'); gr.addColorStop(1, '#07080f'); x.fillStyle = gr; x.fillRect(0, horizon, W, H - horizon);
      x.strokeStyle = rgba(t.ribbon[0], 0.16); x.lineWidth = 1;
      for (var i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(W / 2 + i * 14, horizon); x.lineTo(W / 2 + i * W * 0.22, H); x.stroke(); }
      for (var j = 1; j < 8; j++) { var yy = horizon + (H - horizon) * Math.pow(j / 8, 2); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
    }
    if (!path || path.pts.length < 2) return;
    var cam = C.camera(S.heading, HFOV, W, H, horizon, 1.3), quads = C.ribbon(path.pts, cam, 1.7, 150);
    for (var q = quads.length - 1; q >= 0; q--) { // far to near
      var k = quads[q], fade = Math.max(0.08, 1 - k.d / 150), P = k.poly;
      x.beginPath(); x.moveTo(P[0][0], P[0][1]); for (var n = 1; n < 4; n++) x.lineTo(P[n][0], P[n][1]); x.closePath();
      x.fillStyle = rgba(t.ribbon[0], 0.62 * fade); x.fill(); x.strokeStyle = rgba(t.ribbon[0], 0.62 * fade); x.lineWidth = 0.6; x.stroke();
    }
    x.lineWidth = 2; x.strokeStyle = rgba('255,255,255', 0.75); [[0, 3], [1, 2]].forEach(function (pair) { // bright edges
      x.beginPath(); var first = true; quads.forEach(function (k) { var a = k.poly[pair[0]], b = k.poly[pair[1]]; if (k.d > 110) return; var p = pair[0] === 0 ? a : b; if (first) { x.moveTo(p[0], p[1]); first = false; } else x.lineTo(p[0], p[1]); }); x.stroke();
    });
    var phase = reduce ? 0 : (performance.now() / 1000 * 7) % 10; // chevrons stream towards the car's heading
    for (var s = 4 + (10 - phase) % 10; s < 120; s += 10) {
      var pt = pointAt(path.pts, s); if (!pt) break;
      var tip = C.project(cam, pt.x + pt.tx * 1.5, pt.y + pt.ty * 1.5, 0), wl = C.project(cam, pt.x - pt.tx * 0.6 - pt.ty * 1.0, pt.y - pt.ty * 0.6 + pt.tx * 1.0, 0), inn = C.project(cam, pt.x - pt.tx * 0.1, pt.y - pt.ty * 0.1, 0), wr = C.project(cam, pt.x - pt.tx * 0.6 + pt.ty * 1.0, pt.y - pt.ty * 0.6 - pt.tx * 1.0, 0);
      if (!tip || !wl || !inn || !wr) continue;
      x.fillStyle = 'rgba(255,255,255,' + (0.9 * Math.max(0.15, 1 - s / 120)) + ')'; x.beginPath(); x.moveTo(tip[0], tip[1]); x.lineTo(wl[0], wl[1]); x.lineTo(inn[0], inn[1]); x.lineTo(wr[0], wr[1]); x.closePath(); x.fill();
    }
    var turn = C.nextTurn(path.pts);
    if (turn && turn.d < 260) { // floating turn marker: a pole at the corner topped with an arrow badge and the distance
      var base = C.project(cam, turn.at.x, turn.at.y, 0), top = C.project(cam, turn.at.x, turn.at.y, 5.2);
      if (base && top) {
        var r = Math.max(15, Math.min(40, 700 / base[2]));
        x.strokeStyle = rgba('255,255,255', 0.85); x.lineWidth = 2; x.beginPath(); x.moveTo(base[0], base[1]); x.lineTo(top[0], top[1]); x.stroke();
        x.fillStyle = t.face; x.strokeStyle = t.accent; x.lineWidth = 3; x.beginPath(); x.arc(top[0], top[1] - r, r, 0, 7); x.fill(); x.stroke();
        x.save(); x.translate(top[0], top[1] - r); x.rotate(Math.max(-2.4, Math.min(2.4, turn.angle * Math.PI / 180))); x.fillStyle = t.ink;
        x.beginPath(); x.moveTo(0, -r * 0.62); x.lineTo(r * 0.46, r * 0.1); x.lineTo(r * 0.14, r * 0.1); x.lineTo(r * 0.14, r * 0.58); x.lineTo(-r * 0.14, r * 0.58); x.lineTo(-r * 0.14, r * 0.1); x.lineTo(-r * 0.46, r * 0.1); x.closePath(); x.fill(); x.restore();
        x.font = '800 ' + Math.max(12, Math.round(r * 0.7)) + 'px ' + t.font; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.75)'; var lab = C.fmtDist(turn.d); x.strokeText(lab, top[0], top[1] - 2 * r - 6); x.fillStyle = '#fff'; x.fillText(lab, top[0], top[1] - 2 * r - 6);
      }
    }
    if (path.total < 150) { var end = path.pts[path.pts.length - 1], fb = C.project(cam, end.x, end.y, 0), ft = C.project(cam, end.x, end.y, 6); if (fb && ft) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(fb[0], fb[1]); x.lineTo(ft[0], ft[1]); x.stroke(); x.fillStyle = '#2ee6a6'; x.fillRect(ft[0], ft[1], 22, 14); } }
  }

  /* ---------------------------------------------------------------- mini guided map (heading-up, drawn from the route: no tiles, works offline) */
  function drawMini(path) {
    var cv = S.mini, Z = 132, dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Z * dpr) { cv.width = Z * dpr; cv.height = Z * dpr; }
    var x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, Z, Z);
    var t = T(), cx = Z / 2, cy = Z * 0.64, range = 260, sc = Z * 0.5 / range * 1.05, h = S.heading * Math.PI / 180, ch = Math.cos(h), sh = Math.sin(h);
    function to(px, py) { return [cx + (px * ch - py * sh) * sc, cy - (px * sh + py * ch) * sc]; }
    x.save(); x.beginPath(); x.arc(Z / 2, Z / 2, Z / 2 - 3, 0, 7); x.clip();
    x.fillStyle = t.face; x.fillRect(0, 0, Z, Z);
    x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1; [100, 200].forEach(function (rr) { x.beginPath(); x.arc(cx, cy, rr * sc, 0, 7); x.stroke(); });
    if (path && path.pts.length > 1) {
      var line = function (w, col) { x.lineWidth = w; x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); path.pts.forEach(function (p, i) { var q = to(p.x, p.y); if (i) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke(); };
      line(8, 'rgba(0,0,0,.7)'); line(5, t.accent);
      var turn = C.nextTurn(path.pts);
      if (turn) {
        var q1 = to(turn.at.x, turn.at.y); x.fillStyle = t.ink; x.strokeStyle = t.face; x.lineWidth = 2; x.beginPath(); x.arc(q1[0], q1[1], 5.5, 0, 7); x.fill(); x.stroke();
        var rest = path.pts.filter(function (p) { return p.d > turn.d + 25; }).map(function (p) { return { x: p.x, y: p.y, d: p.d - turn.d - 25 }; }), t2 = rest.length > 3 ? C.nextTurn(rest) : null;
        if (t2) { var q2 = to(t2.at.x, t2.at.y); x.fillStyle = t.accent2; x.beginPath(); x.arc(q2[0], q2[1], 3.5, 0, 7); x.fill(); }
      }
      if (path.total < range) { var e = path.pts[path.pts.length - 1], qe = to(e.x, e.y); x.fillStyle = '#2ee6a6'; x.fillRect(qe[0] - 1, qe[1] - 11, 2, 11); x.fillRect(qe[0], qe[1] - 11, 9, 6); }
    }
    x.fillStyle = t.ink; x.strokeStyle = '#0b0d1a'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy - 11); x.lineTo(cx + 8, cy + 8); x.lineTo(cx, cy + 4); x.lineTo(cx - 8, cy + 8); x.closePath(); x.fill(); x.stroke();
    var np = [cx + Math.sin(-h) * (Z / 2 - 14), (Z / 2) - Math.cos(-h) * (Z / 2 - 14)]; x.font = '700 10px ' + t.font; x.textAlign = 'center'; x.fillStyle = t.warn; x.fillText('U', np[0], np[1] + 4); // U = Utara (north)
    x.restore();
  }

  /* ---------------------------------------------------------------- camera */
  function msg(text) { if (!S.cam) return; S.cam.msg.textContent = text; S.cam.msg.hidden = !text; clearTimeout(S.msgT); if (text) S.msgT = setTimeout(function () { if (S.cam) S.cam.msg.hidden = true; }, 6000); }
  function camOn() {
    if (S.stream || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { if (!navigator.mediaDevices) msg('Kamera tidak tersedia · Camera unavailable: showing the virtual road'); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }).then(function (st) {
      if (!S.ar || !S.active) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      S.stream = st; S.video.srcObject = st; S.video.play().catch(function () { /* autoplay blocked: retried on the next tap */ });
    }).catch(function () { msg('Kamera tidak dibenarkan · Camera not allowed: showing the virtual road'); });
  }
  function camOff() { if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; } if (S.video) S.video.srcObject = null; }
  function easy() { return document.documentElement.hasAttribute('data-easy'); } // easy mode: no camera at all
  function setAR(on) {
    on = !!on && !easy(); if (on === S.ar) return; S.ar = on; prefs.ar = on; save();
    if (!S.root) return; S.cam.box.hidden = !on; S.pill.hidden = on;
    if (on) { startOrient(); camOn(); msg('Letakkan telefon di pendiri · Mount the phone; guidance only'); } else camOff();
    layout(); tick();
  }

  // The app's turn card: by its inline style first, otherwise by geometry (absolute/fixed box pinned top-left, 68 px short of the right edge),
  // so a re-written style attribute or a re-skin cannot silently drop the card from the layout maths and let the HUD sit on top of it.
  function turnCard() {
    var c = document.querySelector('div[style*="right:68px"], div[style*="right: 68px"]'); if (c) return c;
    var all = document.querySelectorAll('body div');
    for (var i = 0; i < all.length && i < 4000; i++) { var e = all[i]; if (e.closest('.adr')) continue; var cs = getComputedStyle(e); if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.left === '12px' && cs.right === '68px' && parseFloat(cs.top) < 40) return e; }
    return null;
  }

  /* ---------------------------------------------------------------- layout: sits between the app's own cards, never over them */
  function layout() {
    if (!S.root) return;
    var vh = window.innerHeight, vw = window.innerWidth, tam = tripActive(), bar = tam && tam.parentElement, barTop = bar ? bar.getBoundingClientRect().top : vh - 100;
    var card = turnCard(), cardBottom = card ? card.getBoundingClientRect().bottom : 130;
    var low = barTop - 10 - 132; // top edge of the speedo / mini-map row
    S.speedo.btn.style.top = low + 'px'; S.mini.style.top = low + 'px'; S.speedo.btn.style.bottom = S.mini.style.bottom = 'auto';
    S.mini.hidden = vh < 560 || vw < 330;
    // the existing AR hazard-assist button floats just under the turn card: the road view sits below it and the pill beside it
    var fab = document.querySelector('.arah-ar-fab'), fr = fab && fab.getBoundingClientRect(), fabB = fr && fr.height ? fr.bottom : 0, top = Math.max(cardBottom, fabB) + 8;
    S.pill.style.top = cardBottom + 8 + 'px'; S.pill.style.left = (fr && fr.height && fr.top < cardBottom + 40 ? fr.right + 8 : 12) + 'px';
    var room = low - 8 - top, h = Math.min(Math.max(150, vh * 0.3), room);
    if (S.ar && room >= 130) { S.cam.box.hidden = false; S.cam.box.style.top = top + 'px'; S.cam.box.style.height = h + 'px'; }
    else if (S.ar) S.cam.box.hidden = true; // no room (landscape / small screen): the map stays visible
    S.themes.style.top = low - 56 + 'px';
  }

  /* ---------------------------------------------------------------- frame */
  function tick() {
    if (!S.active || document.hidden) return;
    if (S.ar && easy()) setAR(false); // easy mode switched on mid-trip: release the camera at once, not just hide the view
    var lp = livePos(), path = lp && S.line ? C.ahead(S.line, lp, 300, S.hint) : null;
    if (path && path.off < 60) S.hint = path.index;
    if (path && path.off >= 60) path = null; // off the route (the app will reroute): do not draw a ribbon over the wrong road
    updateHeading(path);
    if (S.ar && S.cam && !S.cam.box.hidden) drawCam(path);
    if (!S.mini.hidden) drawMini(path);
  }

  /* ---------------------------------------------------------------- build / teardown */
  function applyTheme() {
    var t = T(), r = S.root; r.style.setProperty('--a', t.accent); r.style.setProperty('--a2', t.accent2); r.style.setProperty('--face', t.face); r.style.setProperty('--ink', t.ink); r.style.setProperty('--warn', t.warn);
    buildSpeedo(); S.themeBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.id === prefs.theme ? 'true' : 'false'); }); tick();
  }
  function setTheme(id) { if (!C.THEMES[id]) return; prefs.theme = id; save(); if (S.root) applyTheme(); }
  function build() {
    var st = el('style', { text: CSS }); document.head.appendChild(st); S.style = st;
    S.root = el('div', { class: 'adr', 'data-drive': 'on' });
    S.cam = { box: el('div', { class: 'adr-cam', role: 'region', 'aria-label': 'Paparan AR jalan · AR road view' }), cv: el('canvas', { 'aria-hidden': 'true' }), msg: el('div', { class: 'adr-msg', role: 'status', hidden: '' }) };
    S.video = el('video', { playsinline: '', muted: '', autoplay: '', 'aria-hidden': 'true', tabindex: '-1' }); S.video.muted = true; S.video.playsInline = true; S.video.disableRemotePlayback = true;
    var x = el('button', { class: 'adr-x', type: 'button', 'aria-label': 'Tutup paparan AR · Close AR view', onclick: function () { setAR(false); } }); x.appendChild(xIcon());
    S.cam.box.append(S.video, S.cam.cv, x, S.cam.msg); S.cam.box.hidden = true;
    S.pill = el('button', { class: 'adr-pill', type: 'button', 'aria-label': 'Buka paparan AR · Open AR road view', onclick: function () { setAR(true); } }, [camIcon(), el('span', { text: 'AR JALAN' })]);
    S.speedo = { btn: el('button', { class: 'adr-speedo', type: 'button', 'aria-haspopup': 'true', onclick: function () { S.themeOpen = !S.themeOpen; S.themes.hidden = !S.themeOpen; } }), say: 0 };
    S.mini = el('canvas', { class: 'adr-mini', role: 'img', 'aria-label': 'Peta panduan mini · Mini guided map' });
    S.themes = el('div', { class: 'adr-themes', role: 'group', 'aria-label': 'Mod pemanduan · Drive mode', hidden: '' }); S.themeBtns = [];
    Object.keys(C.THEMES).forEach(function (id) { var b = el('button', { type: 'button', 'data-id': id, 'aria-pressed': 'false', text: C.THEMES[id].name.ms + ' · ' + C.THEMES[id].name.en, onclick: function () { setTheme(id); S.themeOpen = false; S.themes.hidden = true; } }); S.themeBtns.push(b); S.themes.appendChild(b); });
    S.root.append(S.cam.box, S.pill, S.speedo.btn, S.mini, S.themes); document.body.appendChild(S.root);
    applyTheme(); S.pill.hidden = prefs.ar; // saved AR choice is applied below
  }
  function camIcon() { var s = svg('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); svg('path', { d: 'M4 8h3l2-3h6l2 3h3v11H4z' }, s); svg('circle', { cx: 12, cy: 13, r: 3.5 }, s); return s; }
  function xIcon() { var s = svg('svg', { viewBox: '0 0 24 24', width: 20, height: 20, 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' }); svg('path', { d: 'M6 6l12 12M18 6L6 18' }, s); return s; }

  function start() {
    if (S.active) return; S.active = true; S.map = window.__arahMap; build(); readRoute(); startGps();
    if (S.map && S.map.on) { S.srcOn = function (e) { if (e.sourceId === 'route' && e.isSourceLoaded) { clearTimeout(S.rt); S.rt = setTimeout(readRoute, 250); } }; S.map.on('sourcedata', S.srcOn); }
    S.timers.push(setInterval(tick, 100), setInterval(layout, 800), setInterval(function () { if (!tripActive()) stop(); }, 1000));
    window.addEventListener('resize', layout); document.addEventListener('visibilitychange', onVis); layout();
    if (prefs.ar && !easy()) { S.ar = false; setAR(true); } // the user left AR on last time
  }
  function onVis() { if (document.hidden) camOff(); else if (S.ar) camOn(); }
  function stop() {
    if (!S.active) return; S.active = false; S.timers.forEach(clearInterval); S.timers = []; clearTimeout(S.rt); clearTimeout(S.msgT);
    if (S.map && S.srcOn) S.map.off('sourcedata', S.srcOn);
    camOff(); if (S.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(S.watch); S.watch = null;
    window.removeEventListener('resize', layout); document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('deviceorientationabsolute', onOrient, true); window.removeEventListener('deviceorientation', onOrient, true);
    if (S.root) S.root.remove(); if (S.style) S.style.remove(); S.root = null; S.ar = false; S.line = null; S.pos = null; S.speed = 0; S.shown = 0; S.demo = false;
    setTimeout(function () { if (tripActive()) start(); }, 1200); // a new trip may begin right away
  }

  var base = window.__arahDrive || {};
  window.__arahDrive = Object.assign(base, {
    version: VERSION,
    status: function () { return { loaded: true, active: S.active, ar: S.ar, camera: !!S.stream, theme: prefs.theme, speed: Math.round(S.shown), heading: Math.round(S.heading), route: S.line ? S.line.length : 0, demo: S.demo }; },
    setTheme: setTheme, setAR: setAR,
    // Demo / test hook: feed a position as if it came from GPS (speed in km/h). Real GPS is ignored while a demo is running.
    feed: function (f) { S.demo = true; onFix({ coords: { longitude: f.lng, latitude: f.lat, speed: f.speed / 3.6, heading: f.heading == null ? null : f.heading }, timestamp: Date.now() }); },
  });
  if (tripActive()) start();
  var watchTrip = setInterval(function () { if (!S.active && tripActive()) start(); }, 1000);
  window.addEventListener('pagehide', function () { clearInterval(watchTrip); camOff(); });
})();
