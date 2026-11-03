/*! ARAH keep-awake v0.1.0
 * Keeps the screen on while ARAH is open and visible, on every device:
 *   1. Screen Wake Lock API: Chrome/Edge/Samsung Internet on Android and desktop, Safari 16.4+ (browser and installed app).
 *   2. Fallback where that API does not exist (older iPhone/iPad, some browsers): a tiny silent looping video, the
 *      standard trick. Browsers only allow it after a touch, so it starts on the first tap.
 * Always on during a trip. Otherwise the user can turn it off (it is remembered); a short notice says how.
 * Honest limit: when the user switches app or locks the phone the system sleeps regardless, and a browser may refuse
 * the lock in battery-saver mode. The lock is retried automatically.
 * Separate layer: reads the DOM only and never calls the app's code.
 */
(function () {
  'use strict';
  if (window.__arahKeepAwake) return;
  window.__arahKeepAwake = '0.1.0';

  var KEY = 'arah.awake.v1';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  var sentinel = null, video = null, mode = 'none', toast = null, toastTimer = 0, asking = false, announced = false;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var enabled = function () { return lsGet(KEY) !== '0'; };
  function tripActive() { // the "Tamat" (end trip) button is on screen while navigating
    var b = document.querySelectorAll('button');
    for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true;
    return false;
  }
  var wanted = function () { return document.visibilityState === 'visible' && (enabled() || tripActive()); };
  var hasLockApi = function () { return 'wakeLock' in navigator && navigator.wakeLock && typeof navigator.wakeLock.request === 'function'; };

  /* ---------- Wake Lock API */
  function lockOn() {
    if (!hasLockApi() || asking || (sentinel && !sentinel.released)) return;
    asking = true;
    navigator.wakeLock.request('screen').then(function (s) {
      asking = false;
      if (!wanted()) { try { s.release(); } catch (e) { /* gone */ } return; } // the user switched it off while the request was in flight
      sentinel = s; mode = 'wakelock';
      s.addEventListener('release', function () { if (sentinel === s) sentinel = null; }); // the system took it back; the heartbeat re-requests
      announce();
    }).catch(function () { asking = false; if (!wanted()) return; mode = 'blocked'; videoOn(); }); // refused (battery saver, policy): try the video trick too
  }
  function lockOff() { var s = sentinel; sentinel = null; if (s) { try { s.release(); } catch (e) { /* gone */ } } }

  /* ---------- video fallback */
  function makeVideo() {
    if (video) return video;
    var v = document.createElement('video');
    v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('muted', ''); v.setAttribute('loop', '');
    v.setAttribute('aria-hidden', 'true'); v.setAttribute('tabindex', '-1');
    v.muted = true; v.loop = true; v.playsInline = true; v.disableRemotePlayback = true;
    v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;pointer-events:none;z-index:-1';
    [['awake.webm', 'video/webm'], ['awake.mp4', 'video/mp4']].forEach(function (p) {
      var s = document.createElement('source'); s.src = BASE + p[0]; s.type = p[1]; v.appendChild(s);
    });
    v.addEventListener('pause', function () { if (wanted() && video === v && !document.hidden) setTimeout(videoOn, 250); }); // the system paused it: resume
    document.body.appendChild(v); video = v; return v;
  }
  function videoOn() {
    if (!document.body) return;
    var v = makeVideo(), p = v.play();
    if (p && p.then) p.then(function () { if (!wanted()) return videoOff(); if (mode !== 'wakelock') mode = 'video'; announce(); }).catch(function () { /* needs a tap first; retried on the next gesture */ });
  }
  function videoOff() { if (video) { try { video.pause(); } catch (e) { /* gone */ } } }

  /* ---------- keep it going */
  function sync() {
    if (wanted()) { hasLockApi() ? lockOn() : videoOn(); }
    else { lockOff(); videoOff(); mode = 'none'; }
  }
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pageshow', sync);
  window.addEventListener('focus', sync);
  document.addEventListener('fullscreenchange', sync);
  ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (t) { document.addEventListener(t, function () { if (wanted() && (mode !== 'wakelock' || !sentinel)) sync(); }, { passive: true, capture: true }); }); // gestures unlock the video and retry a refused lock
  setInterval(sync, 15000); // heartbeat: re-request a lock the system released, resume a paused video, follow trip start/stop

  /* ---------- notice with an off switch */
  function say(text, label, fn) {
    if (!document.body) return;
    if (!toast) {
      var st = document.createElement('style');
      st.textContent = '.ak-toast{position:fixed;z-index:55;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 132px);width:min(92vw,380px);display:flex;align-items:center;gap:10px;padding:8px 10px 8px 14px;border-radius:12px;border:1px solid #2fd0ec;background:#141729;color:#eef0fa;font:500 13px/1.3 "Ubuntu","Segoe UI",system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5)}.ak-toast span{flex:1}.ak-toast button{min-height:40px;padding:0 12px;border-radius:8px;border:1px solid #a865f5;background:transparent;color:#eef0fa;font:700 13px "Ubuntu",sans-serif;cursor:pointer}.ak-toast button:focus-visible{outline:2px solid #2fd0ec;outline-offset:2px}';
      document.head.appendChild(st);
      toast = document.createElement('div'); toast.className = 'ak-toast'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); toast.hidden = true;
      document.body.appendChild(toast);
    }
    var s = document.createElement('span'); s.textContent = text;
    var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', function () { toast.hidden = true; fn(); });
    toast.replaceChildren(s, b); toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 7000);
  }
  function announce() { // once per launch, only when it is actually working
    if (announced || !enabled()) return; announced = true;
    say('Skrin kekal hidup · Screen stays on', 'Matikan · Turn off', function () { api.set(false); });
  }

  var api = window.__arahAwake = {
    status: function () { return { enabled: enabled(), mode: mode, locked: !!(sentinel && !sentinel.released), video: !!(video && !video.paused) }; },
    set: function (on) { lsSet(KEY, on ? '1' : '0'); sync(); if (!on && !tripActive()) say('Skrin boleh tidur · Screen may sleep', 'Hidupkan · Turn on', function () { api.set(true); announced = true; }); },
  };

  function init() {
    if (!enabled()) { setTimeout(function () { say('Skrin boleh tidur · Screen may sleep', 'Hidupkan · Turn on', function () { api.set(true); announced = true; }); }, 2500); }
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
