/*! ARAH AR driver assist v0.2.0
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
  window.__arahAR = '0.2.0';

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

  /* ---------------------------------------------------------------- state */
  var S = { on: false, manual: false, starting: false, core: null, stream: null, worker: null, engine: null,
    timer: 0, paintT: 0, painting: false, paint: null, busy: false, frame: 0, gps: null, gpsId: null, ego: null, lane: null, laneW: 0, laneH: 0, fps: 0, inferMs: 0,
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
    '.arah-ar-vid canvas{position:absolute;inset:0;width:100%;height:100%}' +
    '.arah-ar-ov{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none;font-family:"Ubuntu","Segoe UI",system-ui,sans-serif}' +
    '.arah-ar-alert{align-self:flex-start;max-width:calc(100% - 8px);margin:4px;border-radius:6px;padding:2px 7px;font:800 calc(12px*var(--u,1))/1.15 "Barlow Condensed","Ubuntu",sans-serif;text-transform:uppercase;letter-spacing:.03em;background:rgba(5,6,16,.62);color:#1fe0a8;text-shadow:0 1px 2px #000}' +
    '.arah-ar-alert[data-l=info]{color:#2fd0ec}' +
    '.arah-ar-alert[data-l=warn]{background:#ff7a2f;color:#0a0c1a;text-shadow:none}' +
    '.arah-ar-alert[data-l=danger]{align-self:stretch;text-align:center;background:#ec4899;color:#fff;text-shadow:none;animation:arah-ar-p .6s ease-in-out infinite alternate}' +
    '@keyframes arah-ar-p{to{filter:brightness(1.35)}}' +
    '.arah-ar-foot{padding:16px 6px 6px;background:linear-gradient(to top,rgba(5,6,16,.9),rgba(5,6,16,.55) 60%,rgba(5,6,16,0))}' +
    '.arah-ar-stats{display:flex;justify-content:space-between;align-items:flex-end;gap:6px;margin-bottom:5px}' +
    '.arah-ar-st{display:flex;flex-direction:column;line-height:1;text-shadow:0 1px 2px #000}.arah-ar-st.r{align-items:flex-end;text-align:right}' +
    '.arah-ar-st small{font:600 9px "JetBrains Mono",monospace;color:#b4b9da;letter-spacing:.03em;white-space:nowrap}' +
    '.arah-ar-st b{font:800 calc(22px*var(--u,1))/1 "Barlow Condensed","Ubuntu",sans-serif;color:#eef0fa;letter-spacing:.02em;margin:1px 0}' +
    '.arah-ar-lane{position:relative;height:6px;border-radius:3px;background:rgba(91,97,148,.55)}' +
    '.arah-ar-lane i{position:absolute;top:-2px;width:10px;height:10px;margin-left:-5px;border-radius:50%;background:#2fd0ec;left:50%;transition:left .15s}' +
    '.arah-ar-lane u{position:absolute;left:50%;top:0;width:2px;height:6px;background:#eef0fa;opacity:.7}' +
    '.arah-ar-msg{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:center;gap:8px;padding:10px;background:#141729;font:500 12px/1.35 "Ubuntu",sans-serif;color:#eef0fa;line-height:1.35}' +
    '.arah-ar-msg[hidden]{display:none}' +
    '.arah-ar-msg button{all:unset;box-sizing:border-box;align-self:flex-start;min-height:36px;padding:0 16px;display:grid;place-items:center;border-radius:8px;border:1px solid #a865f5;color:#eef0fa;cursor:pointer;font:700 13px "Ubuntu",sans-serif;pointer-events:auto}' +
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
  var LABELS = { ms: ['LAJU', 'JARAK'], en: ['SPEED', 'GAP'], zh: ['速度', '距离'], ta: ['வேகம்', 'தூரம்'] };
  function build() {
    if (ui) return;
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    var fab = el('button', { class: 'arah-ar arah-ar-fab', type: 'button', 'aria-pressed': 'false', 'aria-label': 'AR pemandu · AR driver assist', title: 'AR pemandu · AR driver assist', text: 'AR' });
    fab.addEventListener('click', function () { if (S.on || S.starting) stop(true); else start(true); });

    var video = el('video', { playsinline: '', muted: '', autoplay: '', 'aria-hidden': 'true' });
    video.muted = true;
    var overlay = el('canvas', { 'aria-hidden': 'true' });
    var vidBox = el('div', { class: 'arah-ar-vid' }, [overlay]);
    video.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none'; // decoded off-screen, painted via canvas
    document.body.appendChild(video);
    var camTitle = el('span', { text: 'AR' });
    var bigBtn = el('button', { type: 'button', 'aria-label': 'Besar/kecil · Larger/smaller', title: 'Besar/kecil · Larger/smaller', text: '⤢' });
    var closeBtn = el('button', { type: 'button', 'aria-label': 'Tutup AR · Close AR', title: 'Tutup AR · Close AR', text: '✕' });
    var camBar = el('div', { class: 'arah-ar-bar' }, [camTitle, bigBtn, closeBtn]);
    var camWin = el('div', { class: 'arah-ar arah-ar-win', role: 'group', 'aria-label': 'AR pemandu · AR driver assist' }, [camBar, vidBox]);

    var L = LABELS[LANG];
    var alertBox = el('div', { class: 'arah-ar-alert', 'data-l': 'ok', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', text: '…' });
    var speed = el('b', { text: '—' }), lead = el('b', { text: '—' }), leadSub = el('small', { text: ' ' });
    var laneDot = el('i'), laneBar = el('div', { class: 'arah-ar-lane', role: 'img', 'aria-label': 'Kedudukan lajur · Lane position' }, [el('u'), laneDot]);
    var soundBtn = el('button', { type: 'button', 'aria-pressed': 'true', 'aria-label': 'Bunyi amaran · Alert sound', title: 'Bunyi amaran · Alert sound', text: '♪' });
    var errBox = el('div', { class: 'arah-ar-msg', role: 'alert', hidden: '' });
    var ov = el('div', { class: 'arah-ar-ov' }, [alertBox, el('div', { class: 'arah-ar-foot' }, [
      el('div', { class: 'arah-ar-stats' }, [
        el('div', { class: 'arah-ar-st' }, [el('small', { text: L[0] }), speed, el('small', { text: 'km/h' })]),
        el('div', { class: 'arah-ar-st r' }, [el('small', { text: L[1] }), lead, leadSub]),
      ]), laneBar])]);
    vidBox.appendChild(ov); vidBox.appendChild(errBox);
    camBar.insertBefore(soundBtn, bigBtn);

    ui = { fab: fab, camWin: camWin, video: video, overlay: overlay, vidBox: vidBox, ov: ov, errBox: errBox, alertBox: alertBox, speed: speed,
      lead: lead, leadSub: leadSub, laneDot: laneDot, soundBtn: soundBtn, camTitle: camTitle, camBar: camBar, closeBtn: closeBtn, bigBtn: bigBtn };
    document.body.appendChild(fab);
    closeBtn.addEventListener('click', function () { stop(true); });
    bigBtn.addEventListener('click', function () { prefs.big = !prefs.big; savePrefs(); layout(); });
    soundBtn.addEventListener('click', function () { prefs.sound = !prefs.sound; soundBtn.setAttribute('aria-pressed', String(prefs.sound)); soundBtn.style.opacity = prefs.sound ? '1' : '.4'; savePrefs(); });
    drag(camBar, camWin);
    window.addEventListener('resize', layout);
  }

  function winWidth() { return prefs.big ? Math.min(window.innerWidth - 24, 360) : 176; }
  // The turn banner occupies the top of the screen during a trip, so the AR button and windows sit below it.
  function topBase() { return tripActive() ? 118 : 76; }
  function layout() {
    if (!ui) return;
    ui.fab.style.top = topBase() + 'px';
    var w = winWidth(), h = Math.round(w * 0.75);
    ui.camWin.style.width = w + 'px';
    ui.vidBox.style.height = h + 'px';
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    ui.overlay.width = Math.round(w * dpr); ui.overlay.height = Math.round(h * dpr);
    var pos = prefs.cam || { x: 12, y: topBase() + 52 };
    var maxX = Math.max(0, window.innerWidth - w - 8), maxY = Math.max(0, window.innerHeight - h - 80);
    pos = { x: Math.min(Math.max(4, pos.x), maxX), y: Math.min(Math.max(4, pos.y), maxY) };
    ui.camWin.style.left = pos.x + 'px'; ui.camWin.style.top = pos.y + 'px';
    ui.camWin.style.setProperty('--u', String(Math.max(1, w / 176))); // overlay text scales with the window
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

  /* ---------------------------------------------------------------- engine (worker, or main-thread fallback) */
  // The model runs in a Web Worker when the browser supports OffscreenCanvas: the map's main thread and WebGL
  // context stay untouched. Otherwise the same engine runs on the main thread.
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = el('script', { src: src, async: '' });
      s.onload = res; s.onerror = function () { rej(Object.assign(new Error('script load failed'), { code: 'load' })); };
      document.head.appendChild(s);
    });
  }
  var rpcId = 0, pending = {};
  function startWorker() {
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker(BASE + 'ar-worker.js'); } catch (e) { return reject(Object.assign(new Error('worker'), { code: 'noworker' })); }
      var settled = false;
      w.onmessage = function (e) {
        var m = e.data;
        if (m.type === 'ready') { settled = true; resolve(w); }
        else if (m.type === 'result' || m.type === 'error') {
          if (!settled && m.type === 'error') { settled = true; return reject(Object.assign(new Error(m.message), { code: m.code })); }
          var p = pending[m.id]; if (!p) return; delete pending[m.id];
          if (m.type === 'error') p.rej(Object.assign(new Error(m.message), { code: m.code })); else p.res(m);
        }
      };
      w.onerror = function () { if (!settled) { settled = true; reject(Object.assign(new Error('worker'), { code: 'noworker' })); } };
      w.postMessage({ type: 'init', sha256: MODEL.sha256, size: MODEL.size }); // the worker derives all URLs itself
    });
  }
  async function loadEngine() {
    if (S.worker || S.engine) return;
    S.core = S.core || await import(BASE + 'ar-core.mjs');
    if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function' && typeof Worker === 'function') {
      try { S.worker = await startWorker(); return; } catch (e) {
        if (e && e.code && e.code !== 'noworker') throw e; // a real failure (model hash, WebGL, network): do not mask it
        /* worker unsupported or blocked: fall through to the main thread */
      }
    }
    if (!window.ort) await loadScript(BASE + ORT_URL);
    var mod = await import(BASE + 'ar-engine.mjs');
    S.engine = await mod.Engine.create({ ort: window.ort, modelUrl: BASE + MODEL.url, sha256: MODEL.sha256, size: MODEL.size });
  }
  function disposeEngine() {
    if (S.worker) { try { S.worker.postMessage({ type: 'close' }); } catch (e) { /* gone */ } S.worker.terminate(); S.worker = null; } // terminate frees the GPU at once
    if (S.engine) { S.engine.dispose(); S.engine = null; }
    Object.keys(pending).forEach(function (k) { pending[k].rej(new Error('closed')); delete pending[k]; });
  }
  async function detect(vw, vh, wantLane) {
    if (S.worker) {
      var bmp = await createImageBitmap(ui.video); // GPU-backed snapshot; transferred, not copied
      var id = ++rpcId;
      return new Promise(function (res, rej) { pending[id] = { res: res, rej: rej }; S.worker.postMessage({ type: 'frame', id: id, bitmap: bmp, vw: vw, vh: vh, lane: wantLane }, [bmp]); });
    }
    return S.engine.detect(ui.video, vw, vh, wantLane);
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
  async function processFrame() {
    var C = S.core, v = ui.video, vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return;
    var r = await detect(vw, vh, S.frame % 2 === 0); // lanes change slowly: every other frame saves battery
    S.inferMs = S.inferMs ? S.inferMs * 0.8 + r.inferMs * 0.2 : r.inferMs;
    var fr = { w: vw, h: vh, laneW: r.laneW || S.laneW, laneH: r.laneH || S.laneH };
    S.laneW = fr.laneW; S.laneH = fr.laneH;
    var now = performance.now();
    r.boxes.forEach(function (b) { b.dist = C.estimateDistance(b, fr, prefs.hfov); });
    var tracks = S.tracker.update(r.boxes, now);
    if (r.lane) { S.lane = r.lane; S.laneEvent = S.laneMon.update(S.lane, now); }
    S.frame++;
    var colors = new Map();
    tracks.forEach(function (t) { if (t.color) colors.set(t.id, t.color); });
    var res = C.evaluate({ tracks: tracks, ego: { speed: egoSpeed() }, lane: S.lane && S.lane.conf > 0.25 ? S.lane : null, laneEvent: S.laneEvent, frame: fr, lightColors: colors });
    S.laneEvent = null;
    render(res, tracks, fr, colors);
    var pick = S.gate.pick(res.alerts, now);
    if (pick) raise(pick);
  }

  var CLS_COLOR = function (cls, C) { return C.GROUP.vehicle.has(cls) && cls !== 3 ? '#2fd0ec' : C.GROUP.vulnerable.has(cls) ? '#ec4899' : C.GROUP.animal.has(cls) ? '#ff7a2f' : '#a865f5'; };
  // The camera picture is painted on a canvas (not shown as a <video> layer): cheaper to composite on phones, and the
  // boxes are drawn in the same pass so they always line up with the frame on screen.
  function paintOnce() {
    var v = ui.video, cv = ui.overlay, ctx = cv.getContext('2d'), d = S.paint, C = S.core;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (v.readyState < 2 || !v.videoWidth) return;
    var k = cv.width / v.videoWidth, oy = (cv.height - v.videoHeight * k) / 2;
    ctx.drawImage(v, 0, oy, v.videoWidth * k, v.videoHeight * k);
    if (!d || !C) return;
    ctx.translate(0, oy);
    ctx.lineWidth = Math.max(1.5, 2 * k * 2); ctx.font = '600 ' + Math.max(9, 11 * (cv.width / 176)) + 'px "JetBrains Mono",monospace'; ctx.textBaseline = 'top';
    var lane = d.lane;
    if (lane && lane.conf > 0.25 && S.laneW) {
      ctx.strokeStyle = 'rgba(31,224,168,.85)';
      var lk = cv.width / S.laneW;
      [lane.left, lane.right].forEach(function (l) {
        if (!l) return;
        var y0 = S.laneH * 0.58, y1 = S.laneH * 0.95;
        ctx.beginPath(); ctx.moveTo((l.a + l.b * y0) * lk, y0 * lk); ctx.lineTo((l.a + l.b * y1) * lk, y1 * lk); ctx.stroke();
      });
    }
    d.tracks.forEach(function (t) {
      var col = CLS_COLOR(t.cls, C);
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = t.id === d.leadId ? 4 : 2;
      ctx.strokeRect(t.x1 * k, t.y1 * k, (t.x2 - t.x1) * k, (t.y2 - t.y1) * k);
      var c = d.colors.get(t.id);
      var label = t.dist != null && !C.GROUP.trafficLight.has(t.cls) ? Math.round(t.dist) + 'm' : (c && c !== 'unknown' ? c : '');
      if (label) { var tw = ctx.measureText(label).width + 4; ctx.fillRect(t.x1 * k, t.y1 * k, tw, 13 * (cv.width / 176)); ctx.fillStyle = '#0a0c1a'; ctx.fillText(label, t.x1 * k + 2, t.y1 * k + 1); }
    });
  }
  function paintLoop() {
    if (!ui || (!S.on && !S.starting)) { S.painting = false; return; }
    paintOnce();
    if (ui.video.requestVideoFrameCallback) ui.video.requestVideoFrameCallback(paintLoop); else S.paintT = setTimeout(paintLoop, 66);
  }
  function startPaint() { if (S.painting) return; S.painting = true; paintLoop(); }

  function render(res, tracks, fr, colors) {
    S.paint = { tracks: tracks, colors: colors, lane: S.lane, leadId: res.hud.lead && res.hud.lead.id };
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
    var fps = S.inferMs ? 1000 / Math.max(S.inferMs, 1) : 0;
    ui.camTitle.textContent = 'AR · ' + (fps < 2 ? fps.toFixed(1) : Math.round(fps)) + ' fps';
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
      try { await processFrame(); } catch (e) {
        S.busy = false;
        if (S.on) fatal(e); // a frame still in flight when the user closed AR is not an error
        return;
      }
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
    var key = (e && e.code && MSG[e.code]) ? e.code : /nowebgl/.test(m) ? 'nowebgl' : /NotAllowed|Permission/i.test(m) ? 'denied' : /NotFound|Devices/i.test(m) ? 'nocam' : /modelhash/.test(m) ? 'modelhash' : /load failed|model http|Failed to fetch/i.test(m) ? 'load' : 'run';
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
    setAlert('info', 'Memuat AI · Loading AI…'); ui.camTitle.textContent = 'AR';
    try {
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 30 } } });
      ui.video.srcObject = S.stream;
      await ui.video.play().catch(function () { /* autoplay policies: the muted inline video normally plays */ });
      startPaint();
      await loadEngine();
    } catch (e) { S.starting = false; return fatal(e); }
    S.tracker = new S.core.Tracker(); S.laneMon = new S.core.LaneMonitor(); S.gate = new S.core.AlertGate(); S.frame = 0; S.inferMs = 0;
    S.on = true; S.starting = false; prefs.on = true; savePrefs();
    startGps(); layout(); tick();
  }

  function mount() { if (!ui.camWin.isConnected) document.body.appendChild(ui.camWin); layout(); }

  function showError(text) {
    build(); mount();
    var ok = el('button', { type: 'button', text: 'OK' });
    ok.addEventListener('click', function () { ui.errBox.hidden = true; ui.camWin.remove(); });
    ui.errBox.replaceChildren(el('div', { text: text }), ok);
    ui.errBox.hidden = false;
  }

  function stop(user, withError) {
    var err = S.err;
    S.on = false; S.starting = false; clearTimeout(S.timer); S.timer = 0; clearTimeout(S.paintT); S.paint = null;
    stopGps();
    if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; } // release the camera: the indicator light must go off
    if (ui) {
      ui.video.srcObject = null;
      ui.fab.setAttribute('aria-pressed', 'false');
      if (!withError) { ui.camWin.remove(); ui.errBox.hidden = true; }
    }
    disposeEngine(); // free the model and GPU memory; it reloads from the HTTP cache next time
    if (user) { prefs.on = false; savePrefs(); }
    if (withError && err) showError(err); // the message stays up until dismissed
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
    if (now !== wasTrip) layout();
    wasTrip = now;
  }

  function init() {
    build(); layout();
    setInterval(watchTrip, 1500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.on && !S.timer) tick(); });
    window.addEventListener('pagehide', function () { if (S.on) stop(false); });
  }
  window.__arahARApi = { start: start, stop: stop, state: S }; // small handle for tests and support
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
