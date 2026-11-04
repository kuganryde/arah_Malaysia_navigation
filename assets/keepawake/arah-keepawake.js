/*! ARAH keep-awake v0.2.0
 * Keeps the screen on while ARAH is open and visible, on every device:
 *   1. Screen Wake Lock API: Chrome/Edge/Samsung Internet on Android and desktop, Safari 16.4+ (browser and installed app).
 *   2. Fallback where that API does not exist (older iPhone/iPad, some browsers): a tiny silent looping video, the
 *      standard trick. Browsers only allow it after a touch, so it starts on the first tap.
 * Always on during a trip. Otherwise the user can turn it off with a small sun/moon button in the right-hand map button column (remembered).
 * Honest limit: when the user switches app or locks the phone the system sleeps regardless, and a browser may refuse
 * the lock in battery-saver mode. The lock is retried automatically.
 * Separate layer: reads the DOM only and never calls the app's code.
 */
(function () {
  'use strict';
  if (window.__arahKeepAwake) return;
  window.__arahKeepAwake = '0.2.0';

  var KEY = 'arah.awake.v1';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  var sentinel = null, video = null, mode = 'none', asking = false, announced = false;

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

  /* ---------- small toggle button in the right-hand map button column */
  // Replaces the old full-width toast, which covered the map buttons. Same 44x44 size, surface and shadow as the
  // column's own buttons so it reads as one of them. Pure DOM + inline SVG: no innerHTML, no icon-font dependency.
  var btn = null, tip = null, tipTimer = 0, SVGNS = 'http://www.w3.org/2000/svg';
  var ON_LABEL = 'Skrin kekal hidup · Screen stays on', OFF_LABEL = 'Skrin boleh tidur · Screen may sleep';
  function icon(on) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '22'); s.setAttribute('height', '22'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    var d = [];
    if (on) { // sun: screen stays awake
      var c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '4'); s.appendChild(c);
      d = ['M12 2v2', 'M12 20v2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M2 12h2', 'M20 12h2', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'];
    } else d = ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z']; // moon: screen may sleep
    d.forEach(function (v) { var p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', v); s.appendChild(p); });
    return s;
  }
  function column() { // the stack of map buttons (2D, compass, layers, terrain, locate, report) on the right edge
    var bs = document.querySelectorAll('button.btn');
    for (var i = 0; i < bs.length; i++) {
      var p = bs[i].parentElement;
      if (!p || p === btn) continue;
      var cs = getComputedStyle(p);
      if (cs.position === 'absolute' && cs.flexDirection === 'column' && p.querySelectorAll(':scope > button.btn').length >= 4) return p;
    }
    return null;
  }
  function place() { // sit directly under the last button of that column, same right edge
    if (!btn) return;
    btn.hidden = tripActive(); // navigating: the lock is forced on, nothing to toggle
    var col = column(), top = null;
    if (col && col.lastElementChild) { var r = col.lastElementChild.getBoundingClientRect(); if (r.height) top = r.bottom + 8; }
    btn.style.top = top === null ? 'calc(env(safe-area-inset-top,0px) + 74px + 6 * 52px)' : Math.round(top) + 'px';
    if (tip) tip.style.top = btn.style.top;
  }
  function paint() {
    if (!btn) return;
    var on = enabled();
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? ON_LABEL + ' (tekan untuk matikan · press to turn off)' : OFF_LABEL + ' (tekan untuk hidupkan · press to turn on)');
    btn.style.opacity = on ? '1' : '.75';
    btn.replaceChildren(icon(on));
  }
  function say(text) { // brief label beside the button; a polite live region so screen readers hear the state change
    if (!tip) return;
    tip.textContent = text; tip.hidden = false;
    clearTimeout(tipTimer); tipTimer = setTimeout(function () { tip.hidden = true; }, 3000);
  }
  function build() {
    if (btn || !document.body) return;
    var st = document.createElement('style');
    st.textContent = '.ak-btn{position:fixed;z-index:8;right:12px;width:44px;height:44px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);background:color-mix(in srgb,var(--color-surface,#141729) 90%,transparent);color:var(--color-text,#eef0fa);box-shadow:var(--shadow-md,0 4px 14px rgba(0,0,0,.35));cursor:pointer;-webkit-tap-highlight-color:transparent}.ak-btn[aria-pressed=true]{color:#f5b942}.ak-btn:focus-visible{outline:2px solid #2fd0ec;outline-offset:2px}.ak-btn[hidden],.ak-tip[hidden]{display:none}.ak-tip{position:fixed;z-index:8;right:64px;min-height:44px;max-width:min(70vw,260px);display:flex;align-items:center;padding:6px 12px;border-radius:12px;background:#141729;color:#eef0fa;border:1px solid #2fd0ec;font:500 13px/1.3 "Ubuntu","Segoe UI",system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5);pointer-events:none}';
    document.head.appendChild(st);
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ak-btn'; btn.hidden = true;
    btn.addEventListener('click', function () { api.set(!enabled()); });
    tip = document.createElement('div'); tip.className = 'ak-tip'; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite'); tip.hidden = true;
    document.body.appendChild(btn); document.body.appendChild(tip);
    paint(); place();
    window.addEventListener('resize', place); window.addEventListener('orientationchange', place);
    setInterval(place, 1000); // the column moves with panel state and safe areas; cheap read-only check
    new MutationObserver(function () { if (!btn.isConnected) { document.body.appendChild(btn); document.body.appendChild(tip); } }).observe(document.body, { childList: true }); // the app swaps the document on boot: re-attach if we were dropped
  }
  function announce() { // once per launch, only when it is actually working
    if (announced || !enabled()) return; announced = true;
    say(ON_LABEL);
  }

  var api = window.__arahAwake = {
    status: function () { return { enabled: enabled(), mode: mode, locked: !!(sentinel && !sentinel.released), video: !!(video && !video.paused) }; },
    set: function (on) { lsSet(KEY, on ? '1' : '0'); sync(); paint(); say(on ? ON_LABEL : OFF_LABEL); if (on) announced = true; },
  };

  function init() {
    build();
    if (!enabled()) setTimeout(function () { say(OFF_LABEL); }, 2500);
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
