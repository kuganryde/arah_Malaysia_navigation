/*! ARAH PWA v0.1.15
 * Installability and offline support, as a separate layer like arah-enhancements.js: it never calls the app's code.
 *  1. Registers the service worker (sw.js) so the app shell opens offline.
 *  2. Install button: the native prompt on Android/desktop Chrome and Edge, a short how-to on iPhone/iPad.
 *  3. Update notice when a new version is ready. It never reloads during a trip.
 *  4. Asks the browser to keep the offline data (map tiles, AR model) instead of evicting it.
 * Support switch: open the app with ?nosw=1 once to remove the service worker and its caches.
 */
(function () {
  'use strict';
  if (window.__arahPWA) return;
  window.__arahPWA = '0.1.15';

  var DISMISS_KEY = 'arah.pwa.dismissed';
  var DISMISS_DAYS = 7;
  var deferred = null; // the browser's install prompt, held until the user taps our button
  var pill = null, toast = null, waiting = null, reloading = false;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
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
  function tripActive() { // the app shows a "Tamat" (end trip) button while navigating
    var b = document.querySelectorAll('button');
    for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true;
    return false;
  }
  var standalone = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; };
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var recentlyDismissed = function () { var t = Number(lsGet(DISMISS_KEY)); return t && Date.now() - t < DISMISS_DAYS * 864e5; };

  /* ------------------------------------------------------------ support switch */
  if (/[?&]nosw=1\b/.test(location.search)) {
    (navigator.serviceWorker ? navigator.serviceWorker.getRegistrations() : Promise.resolve([])).then(function (rs) {
      return Promise.all(rs.map(function (r) { return r.unregister(); }));
    }).then(function () { return window.caches ? caches.keys() : []; }).then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k.indexOf('arah-pwa-') === 0; }).map(function (k) { return caches.delete(k); })); // never the tile cache
    }).then(function () { location.replace(location.pathname); });
    return;
  }

  /* ------------------------------------------------------------ styles + UI */
  var css = '' +
    '.arah-pwa-pill{position:fixed;z-index:34;left:calc(max(12px,env(safe-area-inset-left)) + 52px);top:80px;height:36px;padding:0 14px;border-radius:10px;border:1px solid rgba(168,101,245,.55);background:var(--surface,#141729);color:#eef0fa;font:700 13px "Ubuntu","Segoe UI",system-ui,sans-serif;cursor:pointer;display:none;align-items:center;gap:6px;box-shadow:0 4px 16px rgba(0,0,0,.4)}' +
    '.arah-pwa-pill b{color:#2fd0ec;font:800 15px "Barlow Condensed","Ubuntu",sans-serif;letter-spacing:.04em}' +
    '.arah-pwa-pill:focus-visible,.arah-pwa-toast button:focus-visible,.arah-pwa-dlg button:focus-visible{outline:2px solid #2fd0ec;outline-offset:2px}' +
    '.arah-pwa-toast{position:fixed;z-index:50;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom) + 100px);width:min(92vw,380px);display:none;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid #a865f5;background:#141729;color:#eef0fa;font:500 13px/1.3 "Ubuntu","Segoe UI",system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5)}' +
    '.arah-pwa-toast span{flex:1}' +
    '.arah-pwa-toast button{min-height:40px;padding:0 14px;border-radius:8px;border:1px solid #a865f5;background:#bf91ff;color:#0a0c1a;font:700 13px "Ubuntu",sans-serif;cursor:pointer}' +
    '.arah-pwa-toast button.q{background:transparent;color:#eef0fa;min-width:40px;padding:0}' +
    '.arah-pwa-scrim{position:fixed;inset:0;z-index:60;background:rgba(5,6,16,.78);display:grid;place-items:end center;padding:16px}' +
    '.arah-pwa-dlg{width:100%;max-width:420px;background:#141729;border:1px solid #a865f5;border-radius:14px;padding:18px;color:#eef0fa;font:400 14px/1.45 "Ubuntu",sans-serif;margin-bottom:env(safe-area-inset-bottom)}' +
    '.arah-pwa-dlg h2{margin:0 0 10px;font:800 24px/1 "Barlow Condensed","Ubuntu",sans-serif;font-style:italic;text-transform:uppercase;color:#2fd0ec}' +
    '.arah-pwa-dlg ol{margin:0 0 14px;padding-left:20px}.arah-pwa-dlg li{margin:0 0 10px}.arah-pwa-dlg li small{display:block;color:#a6acd0}' +
    '.arah-pwa-dlg svg{vertical-align:-5px;margin:0 2px}' +
    '.arah-pwa-dlg button{width:100%;min-height:44px;border-radius:8px;border:1px solid #a865f5;background:#bf91ff;color:#0a0c1a;font:700 14px "Ubuntu",sans-serif;cursor:pointer}';

  function build() {
    if (pill) return;
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    pill = el('button', { class: 'arah-pwa-pill', type: 'button', 'aria-label': 'Pasang · Install the ARAH app' }, [el('b', { text: '+', 'aria-hidden': 'true' }), el('span', { text: 'Pasang · Install' })]);
    pill.addEventListener('click', onInstallTap);
    toast = el('div', { class: 'arah-pwa-toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(pill); document.body.appendChild(toast);
  }

  function refresh() { // show the install button only when it is useful and safe
    if (!pill) return;
    var can = !standalone() && !recentlyDismissed() && !tripActive() && (deferred || isIOS);
    pill.style.display = can ? 'inline-flex' : 'none';
    if (waiting) showUpdate();
  }

  function onInstallTap() {
    if (deferred) {
      var p = deferred; deferred = null; pill.style.display = 'none';
      p.prompt();
      p.userChoice.then(function (c) { if (c && c.outcome !== 'accepted') lsSet(DISMISS_KEY, String(Date.now())); }).catch(function () { /* ignore */ });
    } else if (isIOS) iosSheet();
  }

  function iosSheet() {
    var prev = document.activeElement;
    var share = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2fd0ec" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4M5 11v9h14v-9"/></svg>';
    var ok = el('button', { type: 'button', text: 'Faham · Got it' });
    var dlg = el('div', { class: 'arah-pwa-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'arah-pwa-t' }, [
      el('h2', { id: 'arah-pwa-t', text: 'Pasang ARAH · Install ARAH' }),
      el('ol', null, [
        el('li', { text: 'Ketik butang Kongsi ' }, [el('small', { text: 'Tap the Share button in Safari’s toolbar' })]),
        el('li', { text: 'Pilih "Tambah ke Skrin Utama"' }, [el('small', { text: 'Choose “Add to Home Screen”, then Add' })]),
        el('li', { text: 'Buka ARAH dari skrin utama' }, [el('small', { text: 'Open ARAH from your home screen: full screen, works offline' })]),
      ]), ok]);
    dlg.querySelector('li').insertAdjacentHTML('beforeend', ''); // keep the markup static; the icon is inserted below
    dlg.querySelector('li').firstChild.after((function () { var s = el('span'); s.innerHTML = share; return s; })()); // static SVG string above, no user data
    var scrim = el('div', { class: 'arah-pwa-scrim' }, [dlg]);
    function done() { document.removeEventListener('keydown', key, true); scrim.remove(); if (prev && prev.focus) prev.focus(); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); done(); } if (e.key === 'Tab') { e.preventDefault(); ok.focus(); } }
    ok.addEventListener('click', done);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) done(); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(scrim); ok.focus();
  }

  /* ------------------------------------------------------------ update notice */
  var RELOAD_NOTE = { text: 'Versi baharu tersedia · New version ready', btn: 'Kemas kini · Update', later: 'Selepas perjalanan · Update after your trip' };
  function showUpdate() {
    if (!toast || !waiting || toast.dataset.dismissed) return;
    var trip = tripActive();
    toast.replaceChildren(el('span', { text: trip ? RELOAD_NOTE.later : RELOAD_NOTE.text }));
    if (!trip) {
      toast.appendChild(el('button', { type: 'button', text: RELOAD_NOTE.btn, onclick: applyUpdate }));
      toast.appendChild(el('button', { class: 'q', type: 'button', 'aria-label': 'Tutup · Dismiss', text: '✕', onclick: function () { toast.dataset.dismissed = '1'; toast.style.display = 'none'; } }));
    }
    toast.style.display = 'flex';
  }
  function applyUpdate() {
    if (!waiting || tripActive()) return; // never reload mid-trip
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function watch(reg) {
    function check() { if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; showUpdate(); } }
    check();
    reg.addEventListener('updatefound', function () {
      var w = reg.installing;
      if (w) w.addEventListener('statechange', function () { if (w.state === 'installed') check(); });
    });
    // Look for a new version when the app comes back to the foreground and hourly while open.
    document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
    setInterval(function () { if (!document.hidden) reg.update().catch(function () {}); }, 3600e3);
  }

  function register() {
    if (!('serviceWorker' in navigator)) return;
    var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure) return;
    var hadController = !!navigator.serviceWorker.controller; // false on the very first visit
    navigator.serviceWorker.addEventListener('controllerchange', function () { // an UPDATE took over: load its files once
      // First install also fires this (the worker claims the page); reloading then would only interrupt a new user.
      if (!hadController) { hadController = true; return; }
      if (reloading) return; reloading = true; location.reload();
    });
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(watch).catch(function (e) { console.warn('[ARAH PWA] service worker failed', e && e.message); });
  }

  /* ------------------------------------------------------------ storage + install events */
  function persist() { // keep map tiles and the AR model instead of letting the browser evict them under pressure
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; build(); refresh(); });
  window.addEventListener('appinstalled', function () { deferred = null; persist(); refresh(); });

  function init() {
    build(); refresh();
    if (standalone()) persist();
    setInterval(refresh, 1500);
    if (document.readyState === 'complete') register(); else window.addEventListener('load', register);
  }
  window.__arahPWAApi = { checkUpdate: function () { return navigator.serviceWorker && navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update(); }); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
