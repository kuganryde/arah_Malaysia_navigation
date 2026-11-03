/*! ARAH AR driver assist v0.1.0
 * Camera + on-device YOLOX (WebGL, onnxruntime-web) shown in two small windows while a trip runs:
 * hazards (vehicles, pedestrians, riders, animals, traffic lights, stop signs), lead-vehicle distance,
 * headway and time-to-collision, GPS speed, lane position and lane-change events.
 *
 * Isolation: a separate layer like arah-enhancements.js. It never calls the app's code and only reads the
 * DOM to learn that a trip is active (the "Tamat" button). If this file fails, the app is unaffected.
 * Privacy: video frames are processed in memory and never uploaded, recorded or stored.
 * Safety: assistance only; estimates come from one phone camera (about +/-25%).
 */
(function () {
  'use strict';
  if (window.__arahAR) return;
  window.__arahAR = '0.1.0';

  /* ---------------------------------------------------------------- config */
  var SCRIPT = document.currentScript && document.currentScript.src;
  var BASE = SCRIPT ? new URL('.', SCRIPT).href : new URL('assets/ar/', document.baseURI).href;
  // Pinned model: its SHA-256 is verified in the browser before use (supply-chain guard). Keep in sync with
  // models/MODEL.md; `npm run check` fails if they differ.
  var MODEL = { url: 'models/yolox_nano.onnx', sha256: 'c8f3da2770dd570ad2569ec159712f00a9e901557c680071860df1d28c94b4a3', size: 416 };
  var ORT_URL = 'vendor/ort.webgl.min.js';
  var PREF_KEY = 'arah.ar.v1', ACK_KEY = 'arah.ar.ack.v1';
  var NS = 'http://www.w3.org/2000/svg';

  var LANG = (function () {
    var l = ((document.documentElement.lang || navigator.language || 'en') + '').toLowerCase();
    return l.indexOf('ms') === 0 || l.indexOf('id') === 0 ? 'ms' : l.indexOf('zh') === 0 ? 'zh' : l.indexOf('ta') === 0 ? 'ta' : 'en';
  })();

  /* ---------------------------------------------------------------- tiny helpers */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'class') n.className = props[k];
      else if (k === 'text') n.textContent = props[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: run without saving */ } }
  var prefs = Object.assign({ on: false, big: false, sound: true, hfov: 65, cam: null }, lsGet(PREF_KEY) || {});
  function savePrefs() { lsSet(PREF_KEY, prefs); }
  function tripActive() {
    var b = document.querySelectorAll('button');
    for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true;
    return false;
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  /* ---------------------------------------------------------------- state */
  var S = { on: false, manual: false, starting: false, core: null, stream: null, session: null, inName: '', outName: '',
    timer: 0, busy: false, frame: 0, gps: null, gpsId: null, ego: null, lane: null, laneW: 0, laneH: 0, fps: 0, inferMs: 0,
    tracker: null, laneMon: null, gate: null, lastAlertAt: 0, audio: null, err: '' };

  /* ---------------------------------------------------------------- styles */
  var css = '' +
    '.arah-ar{position:fixed;z-index:35;font-family:"Ubuntu","Segoe UI",system-ui,sans-serif;color:var(--text,#eef0fa);-webkit-user-select:none;user-select:none}' +
    '.arah-ar *{box-sizing:border-box}' +
    '.arah-ar-fab{left:max(12px,env(safe-area-inset-left));top:76px;width:44px;height:44px;border-radius:14px;border:1px solid rgba(168,101,245,.55);background:var(--surface,#141729);color:#2fd0ec;display:grid;place-items:center;cursor:pointer;font:800 13px "Barlow Condensed","Ubuntu",sans-serif;letter-spacing:.06em;padding:0}' +
    '.arah-ar-fab[aria-pressed=true]{background:#a865f5;color:#0a0c1a;border-color:#a865f5}' +
    '.arah-ar-fab:focus-visible,.arah-ar button:focus-visible{outline:2px solid #2fd0ec;outline-offset:2px}' +
    '.arah-ar-win{background:var(--surface,#141729);border:1px solid rgba(168,101,245,.45);border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.45)}' +
    '.arah-ar-bar{display:flex;align-items:center;gap:4px;height:26px;padding:0 4px 0 8px;background:rgba(10,12,26,.85);font:700 11px "Barlow Condensed","Ubuntu",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:grab;touch-action:none}' +
    '.arah-ar-bar span{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#2fd0ec}' +
    '.arah-ar-bar button{all:unset;box-sizing:border-box;min-width:26px;height:26px;display:grid;place-items:center;cursor:pointer;font:700 13px "JetBrains Mono",monospace;color:#eef0fa;border-radius:6px}' +
    '.arah-ar-vid{position:relative;background:#000;line-height:0}' +
    '.arah-ar-vid video,.arah-ar-vid canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}' +
    '.arah-ar-hud{padding:8px 10px;display:grid;gap:7px}' +
    '.arah-ar-alert{min-height:34px;border-radius:8px;padding:6px 8px;font:800 15px/1.1 "Barlow Condensed","Ubuntu",sans-serif;text-transform:uppercase;letter-spacing:.03em;background:rgba(31,224,168,.12);color:#1fe0a8}' +
    '.arah-ar-alert[data-l=info]{background:rgba(47,208,236,.14);color:#2fd0ec}' +
    '.arah-ar-alert[data-l=warn]{background:#ff7a2f;color:#0a0c1a}' +
    '.arah-ar-alert[data-l=danger]{background:#ec4899;color:#fff;animation:arah-ar-p .6s ease-in-out infinite alternate}' +
    '@keyframes arah-ar-p{to{filter:brightness(1.35)}}' +
    '.arah-ar-row{display:grid;grid-template-columns:1fr auto;align-items:end;column-gap:6px;font:500 10px "JetBrains Mono",monospace;color:#9aa0c4}.arah-ar-row>span{grid-column:1/-1;letter-spacing:.04em}' +
    '.arah-ar-row b{font:800 20px/1 "Barlow Condensed","Ubuntu",sans-serif;color:#eef0fa;letter-spacing:.02em}' +
    '.arah-ar-row small{font:inherit;color:#9aa0c4}' +
    '.arah-ar-lane{position:relative;height:8px;border-radius:4px;background:#1c2040}' +
    '.arah-ar-lane i{position:absolute;top:-2px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#2fd0ec;left:50%;transition:left .15s}' +
    '.arah-ar-lane u{position:absolute;left:50%;top:0;width:2px;height:8px;background:#5b6194}' +
    '.arah-ar-msg{padding:10px;font:500 12px/1.35 "Ubuntu",sans-serif;color:#eef0fa;max-width:260px}' +
    '.arah-ar-scrim{position:fixed;inset:0;z-index:60;background:rgba(5,6,16,.78);display:grid;place-items:center;padding:16px}' +
    '.arah-ar-dlg{max-width:380px;width:100%;background:#141729;border:1px solid #a865f5;border-radius:14px;padding:18px;color:#eef0fa;font:400 14px/1.45 "Ubuntu",sans-serif}' +
    '.arah-ar-dlg h2{margin:0 0 8px;font:800 24px/1 "Barlow Condensed","Ubuntu",sans-serif;font-style:italic;text-transform:uppercase;color:#2fd0ec}' +
    '.arah-ar-dlg ul{margin:0 0 14px;padding-left:18px}.arah-ar-dlg li{margin:0 0 8px}.arah-ar-dlg li small{display:block;color:#9aa0c4}' +
    '.arah-ar-dlg .btns{display:flex;gap:8px}' +
    '.arah-ar-dlg button{flex:1;min-height:44px;border-radius:8px;border:1px solid #a865f5;background:transparent;color:#eef0fa;font:700 14px "Ubuntu",sans-serif;cursor:pointer}' +
    '.arah-ar-dlg button.go{background:#a865f5;color:#0a0c1a}' +
    '@media (prefers-reduced-motion:reduce){.arah-ar-alert[data-l=danger]{animation:none}.arah-ar-lane i{transition:none}}';

  /* ---------------------------------------------------------------- UI */
  var ui = null;
  function build() {
    if (ui) return;
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    var fab = el('button', { class: 'arah-ar arah-ar-fab', type: 'button', 'aria-pressed': 'false', 'aria-label': 'AR pemandu · AR driver assist', title: 'AR pemandu · AR driver assist', text: 'AR' });
    fab.addEventListener('click', function () { if (S.on || S.starting) stop(true); else start(true); });

    var video = el('video', { playsinline: '', muted: '', autoplay: '', 'aria-hidden': 'true' });
    video.muted = true;
    var overlay = el('canvas', { 'aria-hidden': 'true' });
    var vidBox = el('div', { class: 'arah-ar-vid' }, [video, overlay]);
    var camTitle = el('span', { text: 'AR · Kamera' });
    var bigBtn = el('button', { type: 'button', 'aria-label': 'Besar/kecil · Larger/smaller', title: 'Besar/kecil · Larger/smaller', text: '⤢' });
    var closeBtn = el('button', { type: 'button', 'aria-label': 'Tutup AR · Close AR', title: 'Tutup AR · Close AR', text: '✕' });
    var camBar = el('div', { class: 'arah-ar-bar' }, [camTitle, bigBtn, closeBtn]);
    var camWin = el('div', { class: 'arah-ar arah-ar-win', role: 'group', 'aria-label': 'Paparan kamera AR · AR camera view' }, [camBar, vidBox]);

    var alertBox = el('div', { class: 'arah-ar-alert', 'data-l': 'ok', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', text: '…' });
    var speed = el('b', { text: '—' }), lead = el('b', { text: '—' }), leadSub = el('small', { text: '' });
    var laneDot = el('i'), laneBar = el('div', { class: 'arah-ar-lane', role: 'img', 'aria-label': 'Kedudukan lajur · Lane position' }, [el('u'), laneDot]);
    var stat = el('small', { text: '' });
    var soundBtn = el('button', { type: 'button', 'aria-pressed': 'true', 'aria-label': 'Bunyi amaran · Alert sound', title: 'Bunyi amaran · Alert sound', text: '♪' });
    var hudBar = el('div', { class: 'arah-ar-bar' }, [el('span', { text: 'AR · Data' }), soundBtn]);
    var hud = el('div', { class: 'arah-ar-hud' }, [
      alertBox,
      el('div', { class: 'arah-ar-row' }, [el('span', { text: 'KELAJUAN · SPEED' }), speed, el('small', { text: 'km/h' })]),
      el('div', { class: 'arah-ar-row' }, [el('span', { text: 'JARAK · GAP' }), lead, leadSub]),
      laneBar, stat,
    ]);
    var hudWin = el('div', { class: 'arah-ar arah-ar-win', role: 'group', 'aria-label': 'Data AR · AR data' }, [hudBar, hud]);

    ui = { fab: fab, camWin: camWin, hudWin: hudWin, video: video, overlay: overlay, vidBox: vidBox, alertBox: alertBox, speed: speed,
      lead: lead, leadSub: leadSub, laneDot: laneDot, stat: stat, soundBtn: soundBtn, camTitle: camTitle, camBar: camBar, hudBar: hudBar, closeBtn: closeBtn, bigBtn: bigBtn, hud: hud };
    document.body.appendChild(fab);
    closeBtn.addEventListener('click', function () { stop(true); });
    bigBtn.addEventListener('click', function () { prefs.big = !prefs.big; savePrefs(); layout(); });
    soundBtn.addEventListener('click', function () { prefs.sound = !prefs.sound; soundBtn.setAttribute('aria-pressed', String(prefs.sound)); soundBtn.style.opacity = prefs.sound ? '1' : '.4'; savePrefs(); });
    drag(camBar, camWin);
    window.addEventListener('resize', layout);
  }

  function winWidth() { return prefs.big ? Math.min(window.innerWidth - 24, 360) : 156; }
  function layout() {
    if (!ui) return;
    var w = winWidth(), h = Math.round(w * 0.75);
    ui.camWin.style.width = w + 'px';
    ui.vidBox.style.height = h + 'px';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    ui.overlay.width = Math.round(w * dpr); ui.overlay.height = Math.round(h * dpr);
    var pos = prefs.cam || { x: 12, y: 128 };
    var maxX = Math.max(0, window.innerWidth - w - 8), maxY = Math.max(0, window.innerHeight - h - 80);
    pos = { x: Math.min(Math.max(4, pos.x), maxX), y: Math.min(Math.max(4, pos.y), maxY) };
    ui.camWin.style.left = pos.x + 'px'; ui.camWin.style.top = pos.y + 'px';
    // The data window rides along on the right of the camera; below it when there is no room.
    var hudW = 140;
    var side = pos.x + w + 6 + hudW <= window.innerWidth - 56;
    ui.hudWin.style.width = hudW + 'px';
    ui.hudWin.style.left = (side ? pos.x + w + 6 : pos.x) + 'px';
    ui.hudWin.style.top = (side ? pos.y : pos.y + h + 32) + 'px';
  }

  function drag(handle, win) {
    var sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      on = true; sx = e.clientX; sy = e.clientY; ox = win.offsetLeft; oy = win.offsetTop;
      try { handle.setPointerCapture(e.pointerId); } catch (x) { /* older engines */ }
      handle.style.cursor = 'grabbing';
    });
    handle.addEventListener('pointermove', function (e) { if (!on) return; prefs.cam = { x: ox + e.clientX - sx, y: oy + e.clientY - sy }; layout(); });
    function end() { if (!on) return; on = false; handle.style.cursor = ''; savePrefs(); }
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  }

  function setAlert(level, text) {
    if (!ui) return;
    ui.alertBox.setAttribute('data-l', level);
    ui.alertBox.setAttribute('aria-live', level === 'danger' ? 'assertive' : 'polite');
    if (ui.alertBox.textContent !== text) ui.alertBox.textContent = text;
  }

  function notice() {
    return new Promise(function (resolve) {
      if (lsGet(ACK_KEY)) return resolve(true);
      var prev = document.activeElement;
      var li = function (a, b) { return el('li', { text: a }, [el('small', { text: b })]); };
      var go = el('button', { class: 'go', type: 'button', text: 'Teruskan · Continue' });
      var no = el('button', { type: 'button', text: 'Batal · Cancel' });
      var dlg = el('div', { class: 'arah-ar-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'arah-ar-t' }, [
        el('h2', { id: 'arah-ar-t', text: 'AR Pemandu · Driver Assist (Beta)' }),
        el('ul', null, [
          li('Kamera diproses pada peranti anda sahaja. Tiada video dihantar atau disimpan.', 'Camera is processed on your device only. No video is uploaded or saved.'),
          li('Pasang telefon pada pemegang. Jangan sekali-kali pegang telefon semasa memandu.', 'Mount the phone in a holder. Never hold it while driving.'),
          li('Anggaran jarak dan kelajuan ±25%. Ini bantuan sahaja, bukan sistem keselamatan.', 'Distance and speed are ±25% estimates. Assistance only, not a safety system.'),
        ]),
        el('div', { class: 'btns' }, [no, go]),
      ]);
      var scrim = el('div', { class: 'arah-ar-scrim' }, [dlg]);
      function done(v) { document.removeEventListener('keydown', key, true); scrim.remove(); if (prev && prev.focus) prev.focus(); if (v) lsSet(ACK_KEY, { at: Date.now() }); resolve(v); }
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        if (e.key === 'Tab') { // keep focus inside the dialog
          e.preventDefault(); (document.activeElement === go ? no : go).focus();
        }
      }
      go.addEventListener('click', function () { done(true); }); no.addEventListener('click', function () { done(false); });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(scrim); go.focus();
    });
  }

  /* ---------------------------------------------------------------- loading */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = el('script', { src: src, async: '' });
      s.onload = res; s.onerror = function () { rej(new Error('script load failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  async function loadModel() {
    if (S.session) return;
    var gl = document.createElement('canvas');
    if (!(gl.getContext('webgl2') || gl.getContext('webgl'))) throw new Error('nowebgl');
    S.core = S.core || await import(BASE + 'ar-core.mjs');
    if (!window.ort) await loadScript(BASE + ORT_URL);
    var ort = window.ort;
    ort.env.logLevel = 'error';
    var res = await fetch(BASE + MODEL.url, { credentials: 'omit' });
    if (!res.ok) throw new Error('model http ' + res.status);
    var buf = await res.arrayBuffer();
    var digest = hex(await crypto.subtle.digest('SHA-256', buf));
    if (digest !== MODEL.sha256) throw new Error('modelhash'); // never run a model that is not the pinned one
    S.session = await ort.InferenceSession.create(new Uint8Array(buf), { executionProviders: ['webgl'], graphOptimizationLevel: 'all' });
    S.inName = S.session.inputNames[0]; S.outName = S.session.outputNames[0];
  }

  /* ---------------------------------------------------------------- GPS speed */
  function startGps() {
    if (S.gpsId != null || !navigator.geolocation) return;
    var prev = null, v = null;
    S.gpsId = navigator.geolocation.watchPosition(function (p) {
      var c = p.coords, fix = { lat: c.latitude, lon: c.longitude, t: p.timestamp }, s = null;
      if (c.speed != null && isFinite(c.speed)) s = c.speed;
      else if (prev) s = S.core.speedFromFixes(prev, fix);
      prev = fix;
      if (s == null || (c.accuracy && c.accuracy > 60)) return;
      v = v == null ? s : v * 0.5 + s * 0.5; // smooth GPS jitter
      S.gps = { v: v < 0.6 ? 0 : v, t: Date.now() };
    }, function () { /* denied or unavailable: speed shows as — and headway needs speed, TTC still works */ }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
  }
  function stopGps() { if (S.gpsId != null) { navigator.geolocation.clearWatch(S.gpsId); S.gpsId = null; } S.gps = null; }
  function egoSpeed() { return S.gps && Date.now() - S.gps.t < 4000 ? S.gps.v : null; }

  /* ---------------------------------------------------------------- per-frame pipeline */
  var pre = null, preCtx = null, input = null, laneC = null, laneCtx = null, lightC = null, lightCtx = null;
  function canvases(vw, vh) {
    var size = MODEL.size;
    if (!pre) {
      pre = document.createElement('canvas'); pre.width = pre.height = size;
      preCtx = pre.getContext('2d', { willReadFrequently: true });
      input = new Float32Array(3 * size * size);
      lightC = document.createElement('canvas'); lightC.width = lightC.height = 24;
      lightCtx = lightC.getContext('2d', { willReadFrequently: true });
    }
    var lw = 192, lh = Math.round(192 * vh / vw);
    if (!laneC || laneC.width !== lw || laneC.height !== lh) {
      laneC = document.createElement('canvas'); laneC.width = lw; laneC.height = lh;
      laneCtx = laneC.getContext('2d', { willReadFrequently: true });
      S.laneW = lw; S.laneH = lh;
    }
  }

  async function processFrame() {
    var C = S.core, v = ui.video, vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    canvases(vw, vh);
    var size = MODEL.size, lb = C.letterbox(vw, vh, size), t0 = performance.now();
    preCtx.fillStyle = 'rgb(114,114,114)'; preCtx.fillRect(0, 0, size, size);
    preCtx.drawImage(v, 0, 0, lb.nw, lb.nh);
    C.toCHW_BGR(preCtx.getImageData(0, 0, size, size).data, size, input);
    var out = await S.session.run({ [S.inName]: new window.ort.Tensor('float32', input, [1, 3, size, size]) });
    var boxes = C.toFrame(C.nms(C.decodeYolox(out[S.outName].data)), vw, vh, size);
    S.inferMs = S.inferMs * 0.8 + (performance.now() - t0) * 0.2;

    var fr = { w: vw, h: vh, laneW: S.laneW, laneH: S.laneH };
    boxes.forEach(function (b) { b.dist = C.estimateDistance(b, fr, prefs.hfov); });
    var now = performance.now();
    var tracks = S.tracker.update(boxes, now);

    if (S.frame % 2 === 0) { // lanes change slowly: every other frame is plenty and saves battery
      laneCtx.drawImage(v, 0, 0, S.laneW, S.laneH);
      var px = laneCtx.getImageData(0, 0, S.laneW, S.laneH).data, g = new Uint8Array(S.laneW * S.laneH);
      for (var i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (px[p] * 77 + px[p + 1] * 150 + px[p + 2] * 29) >> 8;
      S.lane = C.detectLanes(g, S.laneW, S.laneH);
      S.laneEvent = S.laneMon.update(S.lane, now);
    }
    S.frame++;

    var colors = new Map();
    tracks.forEach(function (t) {
      if (!C.GROUP.trafficLight.has(t.cls)) return;
      lightCtx.drawImage(v, t.x1, t.y1, Math.max(2, t.x2 - t.x1), Math.max(2, t.y2 - t.y1), 0, 0, 24, 24);
      colors.set(t.id, C.classifyLight(lightCtx.getImageData(0, 0, 24, 24).data));
    });

    var res = C.evaluate({ tracks: tracks, ego: { speed: egoSpeed() }, lane: S.lane && S.lane.conf > 0.25 ? S.lane : null, laneEvent: S.laneEvent, frame: fr, lightColors: colors });
    S.laneEvent = null;
    render(res, tracks, fr, colors);
    var pick = S.gate.pick(res.alerts, now);
    if (pick) raise(pick);
  }

  var CLS_COLOR = function (cls, C) { return C.GROUP.vehicle.has(cls) && cls !== 3 ? '#2fd0ec' : C.GROUP.vulnerable.has(cls) ? '#ec4899' : C.GROUP.animal.has(cls) ? '#ff7a2f' : '#a865f5'; };
  function render(res, tracks, fr, colors) {
    var C = S.core, cv = ui.overlay, ctx = cv.getContext('2d'), k = cv.width / fr.w;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineWidth = Math.max(1.5, 2 * k * 2); ctx.font = '600 ' + Math.max(9, 11 * (cv.width / 156)) + 'px "JetBrains Mono",monospace'; ctx.textBaseline = 'top';
    var lane = S.lane;
    if (lane && lane.conf > 0.25) {
      ctx.strokeStyle = 'rgba(31,224,168,.85)';
      [lane.left, lane.right].forEach(function (l) {
        if (!l) return;
        var y0 = S.laneH * 0.58, y1 = S.laneH * 0.95, sx = cv.width / S.laneW, sy = cv.height / S.laneH;
        ctx.beginPath(); ctx.moveTo((l.a + l.b * y0) * sx, y0 * sy); ctx.lineTo((l.a + l.b * y1) * sx, y1 * sy); ctx.stroke();
      });
    }
    var leadId = res.hud.lead && res.hud.lead.id;
    tracks.forEach(function (t) {
      var col = CLS_COLOR(t.cls, C);
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = t.id === leadId ? 4 : 2;
      ctx.strokeRect(t.x1 * k, t.y1 * k, (t.x2 - t.x1) * k, (t.y2 - t.y1) * k);
      var label = t.dist != null && !C.GROUP.trafficLight.has(t.cls) ? Math.round(t.dist) + 'm' : (colors.get(t.id) && colors.get(t.id) !== 'unknown' ? colors.get(t.id) : '');
      if (label) { var tw = ctx.measureText(label).width + 4; ctx.fillRect(t.x1 * k, t.y1 * k, tw, 13 * (cv.width / 156)); ctx.fillStyle = '#0a0c1a'; ctx.fillText(label, t.x1 * k + 2, t.y1 * k + 1); }
    });
    var h = res.hud;
    ui.speed.textContent = h.egoKmh == null ? '—' : String(Math.round(h.egoKmh));
    if (h.lead) {
      ui.lead.textContent = Math.round(h.lead.dist) + ' m';
      var bits = [];
      if (h.lead.headway != null) bits.push(h.lead.headway.toFixed(1) + 's');
      if (h.lead.kmh != null) bits.push('≈' + Math.round(h.lead.kmh));
      ui.leadSub.textContent = bits.join(' ');
    } else { ui.lead.textContent = '—'; ui.leadSub.textContent = ''; }
    ui.laneDot.style.left = (h.lane == null ? 50 : Math.max(5, Math.min(95, 50 - h.lane * 80))) + '%';
    ui.laneDot.style.background = h.lane != null && Math.abs(h.lane) > 0.35 ? '#ff7a2f' : '#2fd0ec';
    ui.stat.textContent = 'WebGL · ' + (S.inferMs ? Math.round(1000 / Math.max(S.inferMs, 1)) : 0) + ' fps · ' + h.count + ' obj';
    if (!res.alerts.length && Date.now() - S.lastAlertAt > 2500) setAlert('ok', OK_TEXT[LANG]);
  }
  var OK_TEXT = { ms: 'Memantau', en: 'Watching', zh: '监测中', ta: 'கண்காணிக்கிறது' };

  function raise(a) {
    S.lastAlertAt = Date.now();
    setAlert(a.level, S.core.alertText(a.key, LANG));
    if (a.level === 'danger') {
      try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) { /* unsupported */ }
      if (prefs.sound) beep();
    }
  }
  function beep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      S.audio = S.audio || new AC();
      var o = S.audio.createOscillator(), g = S.audio.createGain();
      o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(S.audio.destination); o.start(); o.stop(S.audio.currentTime + 0.15);
    } catch (e) { /* audio blocked until a gesture: the visual alert still shows */ }
  }

  /* ---------------------------------------------------------------- loop & lifecycle */
  async function tick() {
    if (!S.on) return;
    var t0 = performance.now();
    if (!document.hidden && !S.busy && ui.video.readyState >= 2) {
      S.busy = true;
      try { await processFrame(); } catch (e) { fatal(e); S.busy = false; return; }
      S.busy = false;
    }
    // Aim for ~9 fps; back off to ~5 fps if the device is slow, to protect battery and the map's frame rate.
    var target = S.inferMs > 180 ? 200 : 110;
    S.timer = setTimeout(tick, Math.max(30, target - (performance.now() - t0)));
  }

  var MSG = {
    nowebgl: 'WebGL tidak disokong pada peranti ini · WebGL is not supported on this device',
    denied: 'Kebenaran kamera ditolak · Camera permission denied',
    nocam: 'Kamera tidak ditemui · No camera found',
    modelhash: 'Model AI gagal pengesahan · AI model failed verification',
    load: 'Gagal memuat AI · Could not load the AI model',
    insecure: 'Kamera memerlukan HTTPS · Camera needs HTTPS',
    run: 'Ralat AR · AR error',
  };
  function fatal(e) {
    var m = String(e && e.name) + ': ' + String(e && e.message ? e.message : e);
    var key = /nowebgl/.test(m) ? 'nowebgl' : /NotAllowed|Permission/i.test(m) ? 'denied' : /NotFound|Devices/i.test(m) ? 'nocam' : /modelhash/.test(m) ? 'modelhash' : /load failed|model http|Failed to fetch/i.test(m) ? 'load' : 'run';
    S.err = MSG[key]; stop(false, true);
    console.warn('[ARAH AR]', m, e && e.stack ? String(e.stack).split('\n').slice(0, 3).join(' | ') : ''); // visible in devtools for support, never sent anywhere
  }

  async function start(manual) {
    if (S.on || S.starting) return;
    build();
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showError(MSG.insecure); return; }
    S.starting = true; S.manual = !!manual; S.err = '';
    if (manual && !(await notice())) { S.starting = false; return; }
    ui.fab.setAttribute('aria-pressed', 'true');
    mount();
    setAlert('info', '…'); ui.stat.textContent = 'Memuat AI · Loading AI…';
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } } });
      ui.video.srcObject = S.stream;
      await ui.video.play().catch(function () { /* autoplay policies: the muted inline video normally plays */ });
      await loadModel();
    } catch (e) { S.starting = false; return fatal(e); }
    S.tracker = new S.core.Tracker(); S.laneMon = new S.core.LaneMonitor(); S.gate = new S.core.AlertGate(); S.frame = 0; S.inferMs = 0;
    S.on = true; S.starting = false; prefs.on = true; savePrefs();
    startGps(); layout(); tick();
  }

  function mount() { if (!ui.camWin.isConnected) { document.body.appendChild(ui.camWin); document.body.appendChild(ui.hudWin); } layout(); }

  function showError(text) {
    build(); mount();
    ui.vidBox.style.display = 'none'; ui.hud.replaceChildren(el('div', { class: 'arah-ar-msg', role: 'alert', text: text }));
  }

  function stop(user, withError) {
    var err = S.err;
    S.on = false; S.starting = false; clearTimeout(S.timer); S.timer = 0;
    stopGps();
    if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; } // release the camera: the indicator light must go off
    if (ui) {
      ui.video.srcObject = null;
      ui.fab.setAttribute('aria-pressed', 'false');
      if (!withError) { ui.camWin.remove(); ui.hudWin.remove(); }
    }
    if (S.session && user) { try { S.session.release(); } catch (e) { /* already gone */ } S.session = null; }
    if (user) { prefs.on = false; savePrefs(); }
    if (withError && err) {
      showError(err);
      // Leave the message up, with a way to dismiss it.
      var x = el('button', { type: 'button', text: 'OK', style: 'margin:0 10px 10px;min-height:36px;padding:0 14px;border-radius:8px;border:1px solid #a865f5;background:transparent;color:#eef0fa;cursor:pointer' });
      x.addEventListener('click', function () { ui.camWin.remove(); ui.hudWin.remove(); ui.vidBox.style.display = ''; });
      ui.hud.appendChild(x);
    }
  }

  /* ---------------------------------------------------------------- trip awareness (read-only DOM check) */
  var wasTrip = false;
  async function cameraGranted() {
    try { var p = await navigator.permissions.query({ name: 'camera' }); return p.state === 'granted'; } catch (e) { return false; }
  }
  async function watchTrip() {
    var now = tripActive();
    if (now && !wasTrip && prefs.on && !S.on && !S.starting && lsGet(ACK_KEY) && await cameraGranted()) start(false); // resume on the next trip only if already allowed
    if (!now && wasTrip && S.on && !S.manual) stop(false); // trip ended: release the camera (the choice to use AR is kept)
    wasTrip = now;
  }

  function init() {
    build();
    setInterval(watchTrip, 1500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.on && !S.timer) tick(); });
    window.addEventListener('pagehide', function () { if (S.on) stop(false); });
  }
  window.__arahARApi = { start: start, stop: stop, state: S }; // small handle for tests and support
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
