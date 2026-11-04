/*! ARAH Crash Reports v0.1.1
 * Optional, opt-in crash reporting to Sentry. A separate layer: it never calls app code.
 *  - Does nothing until a Sentry DSN is set in config.json AND the person says yes (one small card, once).
 *  - Before consent no Sentry code is downloaded and nothing is sent. After "No thanks" the card never returns.
 *  - Reports carry the error, a scrubbed stack and the browser name. They never carry location, searches, addresses,
 *    query strings, cookies, an IP address or breadcrumbs (see scrub.mjs; filtered on the device before sending).
 *  - The Sentry SDK is a vendored, pinned file loaded with Subresource Integrity, never from a CDN.
 * Change the choice any time: Privacy page, or window.__arahObserve.set(true|false). Never prompts during a trip or AR.
 */
(function () {
  'use strict';
  if (window.__arahObserve) return;
  var VERSION = '0.1.1';
  var SENTRY_SRI = 'sha384-PvHHB5zoMzazwRBH4991IED+fpWUQDHFh6RUSKQLkYJdYbfoTRZim7l5tzqTkrnq';
  var KEY = 'arah.observe.v1';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  // sentry.io ingest DSNs only: keeps the CSP allow-list to *.ingest.sentry.io and rejects look-alike hosts.
  var DSN_RE = /^https:\/\/[0-9a-f]{32}@o\d+\.ingest(\.[a-z]{2})?\.sentry\.io\/\d+$/;
  var cfg = null, release = 'unknown', started = false, loading = false, card = null, timer = 0;

  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: choice lasts this visit only */ } }
  function tripActive() { try { return Array.prototype.some.call(document.querySelectorAll('button'), function (b) { return /^\s*Tamat\s*$/.test(b.textContent || ''); }); } catch (e) { return false; } }
  function arOn() { try { return !!(window.__arahARApi && window.__arahARApi.state && window.__arahARApi.state.on); } catch (e) { return false; } }
  function json(url) { return fetch(url, { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  function start() {
    if (started || loading || !cfg || !SENTRY_SRI) return;
    loading = true;
    var s = document.createElement('script');
    s.src = BASE + 'vendor/sentry.min.js'; s.integrity = SENTRY_SRI; s.crossOrigin = 'anonymous'; s.async = true;
    s.onload = function () {
      loading = false;
      try {
        window.__arahSentryLib.start({ dsn: cfg.dsn, release: 'arah@' + release, environment: /^(localhost|127\.)/.test(location.hostname) ? 'dev' : 'production' });
        started = true;
      } catch (e) { /* reporting must never break the app */ }
    };
    s.onerror = function () { loading = false; };
    document.head.appendChild(s);
  }
  function stop() {
    started = false;
    try { if (window.__arahSentryLib) window.__arahSentryLib.close(0); } catch (e) { /* ignore */ }
  }

  function set(on) {
    lsSet(on ? 'on' : 'off'); hide();
    if (on) start(); else stop();
    return on;
  }

  // ---- the one-time ask ----
  var CSS = '.ao-card{position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(92vw,420px);z-index:2147482000;box-sizing:border-box;padding:14px 16px;border-radius:16px;background:var(--color-surface,#141729);color:var(--color-text,#e8ebff);border:1px solid var(--color-border,#2a2f52);box-shadow:0 12px 32px rgba(0,0,0,.5);font:14px/1.45 var(--font-body,system-ui,sans-serif)}' +
    '.ao-card h2{margin:0 0 4px;font:600 15px/1.3 var(--font-display,system-ui,sans-serif)}.ao-card p{margin:0 0 12px;color:var(--color-text-muted,#aab0d6)}' +
    '.ao-row{display:flex;gap:8px}.ao-card button{flex:1;min-height:44px;border-radius:12px;border:1px solid var(--color-border,#2a2f52);background:transparent;color:inherit;font:inherit;cursor:pointer}' +
    '.ao-card button.ao-yes{background:var(--color-primary,#5b8cff);border-color:transparent;color:#0a0c1a;font-weight:600}.ao-card button:focus-visible{outline:2px solid var(--color-primary,#5b8cff);outline-offset:2px}' +
    '@media (prefers-reduced-motion:no-preference){.ao-card{animation:ao-in .25s ease-out}@keyframes ao-in{from{opacity:0;transform:translate(-50%,8px)}}}';
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    for (var k in props || {}) { if (k === 'text') n.textContent = props[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]); else n.setAttribute(k, props[k]); }
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function show() {
    if (card || !document.body) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    card = el('div', { class: 'ao-card', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'ao-t', 'aria-describedby': 'ao-d' }, [
      el('h2', { id: 'ao-t', text: 'Bantu baiki ralat · Help fix crashes?' }),
      el('p', { id: 'ao-d', text: 'Hantar laporan ralat tanpa nama. Tiada lokasi, carian atau akaun dihantar. Send anonymous crash reports: no location, searches or account. Change it any time on the Privacy page.' }),
      el('div', { class: 'ao-row' }, [
        el('button', { type: 'button', text: 'Tidak · No thanks', onclick: function () { set(false); } }),
        el('button', { type: 'button', class: 'ao-yes', text: 'Ya · Yes, send', onclick: function () { set(true); } }),
      ]),
    ]);
    card.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    document.body.appendChild(card);
  }
  function hide() { if (card && card.parentNode) card.parentNode.removeChild(card); card = null; clearTimeout(timer); }
  function maybeAsk() {
    if (lsGet() || card) return;
    if (document.visibilityState !== 'visible' || tripActive() || arOn()) { timer = setTimeout(maybeAsk, 20000); return; } // never interrupt driving
    show();
  }

  function onNet(e) { // failover events from the resilience layer: counts, no content
    try { if (started && window.__arahSentryLib && e.detail && /^(overpass|photon)$/.test(e.detail.kind)) window.__arahSentryLib.captureMessage('Failover: ' + e.detail.kind, 'warning'); } catch (x) { /* ignore */ }
  }

  window.__arahObserve = {
    version: VERSION,
    status: function () { return { configured: !!cfg, choice: lsGet(), active: started, sdkPinned: !!SENTRY_SRI }; },
    set: set,
  };
  window.addEventListener('arah:net', onNet);

  Promise.all([json(BASE + 'config.json'), json(BASE + 'release.json')]).then(function (r) {
    var c = r[0]; if (r[1] && typeof r[1].release === 'string') release = r[1].release.slice(0, 32);
    if (!c || typeof c.dsn !== 'string' || !DSN_RE.test(c.dsn)) return; // not configured: stay completely inert
    cfg = { dsn: c.dsn };
    var choice = lsGet();
    if (choice === 'on') start();
    else if (!choice) timer = setTimeout(maybeAsk, 10000);
  });
})();
