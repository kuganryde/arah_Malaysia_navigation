/*! ARAH Network Resilience v0.1.0
 * A thin, separate layer around window.fetch for the public map services ARAH depends on. The app's own code is untouched.
 *  - Every call to a known service gets a hard timeout, so a stalled server can never freeze routing or search.
 *  - Overpass (nearby places): tried on up to three public mirrors; a 429/5xx, timeout, or an "out of time" answer moves on.
 *  - Photon (search): falls back to OpenStreetMap Nominatim, converted to the same shape the app already reads.
 *  - OSRM (routing): timeout, and one retry for the walking profile (it has no alternative host).
 *  - A host that fails twice in a row is skipped for a minute (circuit breaker), then tried again.
 * Anything not on the allowlist below passes through to the real fetch unchanged.
 * Security: only fixed https hosts are contacted, requests carry no cookies, and every fallback response is parsed as JSON
 * and rebuilt before the app sees it. Kill switch: add ?nonet=1 to the address.
 */
(function () {
  'use strict';
  if (window.__arahNet || !window.fetch) return;
  try { if (/[?&]nonet=1\b/.test(location.search)) return; } catch (e) { /* no location: carry on */ }
  var VERSION = '0.1.0';
  var cfg = { overpassMs: 20000, overpassRetryMs: 15000, photonMs: 6000, nominatimMs: 8000, osrmMs: 9000, cooldownMs: 60000, trips: 2, toastGapMs: 120000 };
  try { var o = window.__arahNetConfig; if (o) for (var k in o) if (k in cfg) cfg[k] = +o[k]; } catch (e) { /* ignore */ }

  var realFetch = window.fetch.bind(window);
  var OVERPASS = ['overpass-api.de', 'overpass.kumi.systems', 'overpass.private.coffee']; // order = preference
  var PHOTON = 'photon.komoot.io', NOMINATIM = 'nominatim.openstreetmap.org';
  var OSRM = { 'router.project-osrm.org': 1, 'routing.openstreetmap.de': 1 };
  var health = {}, fallbacks = 0, lastToast = 0, lastNote = '';

  function h(host) { return health[host] || (health[host] = { fails: 0, openUntil: 0, lastOk: 0, lastErr: '' }); }
  function ok(host) { var s = h(host); s.fails = 0; s.openUntil = 0; s.lastOk = Date.now(); s.lastErr = ''; }
  function bad(host, why) { var s = h(host); s.fails++; s.lastErr = String(why).slice(0, 80); if (s.fails >= cfg.trips) s.openUntil = Date.now() + cfg.cooldownMs; }
  function isOpen(host) { return h(host).openUntil > Date.now(); }
  function tripActive() { try { return Array.prototype.some.call(document.querySelectorAll('button'), function (b) { return /^\s*Tamat\s*$/.test(b.textContent || ''); }); } catch (e) { return false; } }

  // One attempt with a hard timeout that also honours the caller's own AbortSignal. Resolves to a plain result object;
  // the body is fully read inside the timeout, so a server that stalls mid-answer cannot hang the app either.
  function attempt(url, init, ms, outer) {
    return new Promise(function (resolve) {
      var ctl = new AbortController(), done = false, timer;
      function fin(r) { if (done) return; done = true; clearTimeout(timer); if (outer) outer.removeEventListener('abort', onAbort); resolve(r); }
      function onAbort() { ctl.abort(); fin({ ok: false, aborted: true, why: 'aborted' }); }
      timer = setTimeout(function () { ctl.abort(); fin({ ok: false, why: 'timeout' }); }, ms);
      if (outer) { if (outer.aborted) return onAbort(); outer.addEventListener('abort', onAbort); }
      var i = { method: init.method || 'GET', headers: init.headers, body: init.body, credentials: 'omit', signal: ctl.signal, cache: init.cache };
      realFetch(url, i).then(function (res) {
        return res.text().then(function (text) { fin({ ok: true, status: res.status, statusText: res.statusText, ctype: res.headers.get('content-type'), text: text }); });
      }).catch(function (e) { fin({ ok: false, why: (e && e.name) || 'network' }); });
    });
  }
  var retryable = function (r) { return !r.ok || r.status === 429 || r.status >= 500; };
  function rebuild(r) { return new Response([204, 205, 304].indexOf(r.status) >= 0 ? null : r.text, { status: r.status, statusText: r.statusText, headers: { 'Content-Type': r.ctype || 'application/json' } }); }
  function json(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  function note(msg, kind) {
    fallbacks++; lastNote = msg;
    try { window.dispatchEvent(new CustomEvent('arah:net', { detail: { kind: kind, message: msg, at: Date.now() } })); } catch (e) { /* old browser */ }
    if (Date.now() - lastToast < cfg.toastGapMs || tripActive()) return; // never distract a driver, never nag
    lastToast = Date.now();
    try {
      var t = document.createElement('div');
      t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); t.textContent = msg;
      t.style.cssText = 'position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);max-width:min(92vw,420px);z-index:2147483000;padding:10px 14px;border-radius:12px;background:#141729;color:#e8ebff;border:1px solid #2a2f52;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none';
      document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3500);
    } catch (e) { /* no DOM yet */ }
  }

  // ---- Overpass: mirror failover ----
  function overpass(url, init, outer) {
    var hosts = OVERPASS.filter(function (x) { return !isOpen(x); });
    if (!hosts.length) hosts = OVERPASS.slice(); // everything tripped: try anyway rather than fail by policy
    var i = 0, first = true;
    function next() {
      if (i >= hosts.length) return Promise.reject(new TypeError('All map data servers are unavailable'));
      var host = hosts[i++], u = 'https://' + host + '/api/interpreter';
      return attempt(u, init, first ? cfg.overpassMs : cfg.overpassRetryMs, outer).then(function (r) {
        first = false;
        if (r.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
        var j = r.ok && !retryable(r) ? json(r.text) : null;
        // Overpass reports "out of time/memory" as HTTP 200 with a remark and no elements.
        var hollow = j && j.remark && /runtime error|timed out|out of memory/i.test(j.remark) && !(j.elements && j.elements.length);
        if (!j || hollow) { bad(host, r.ok ? 'status ' + r.status : r.why); if (i < hosts.length) note('Pelayan peta perlahan · guna pelayan sandaran', 'overpass'); return next(); }
        ok(host); return rebuild(r);
      });
    }
    return next();
  }

  // ---- Photon -> Nominatim ----
  function toPhoton(list, limit) {
    var feats = [];
    (Array.isArray(list) ? list : []).forEach(function (r) {
      var lon = +r.lon, lat = +r.lat; if (!isFinite(lon) || !isFinite(lat)) return;
      var a = r.address || {};
      feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {
        name: r.name || String(r.display_name || '').split(',')[0], street: a.road, housenumber: a.house_number,
        district: a.suburb || a.city_district || a.neighbourhood, city: a.city || a.town || a.village, state: a.state, osm_value: r.type } });
    });
    return { type: 'FeatureCollection', features: feats.slice(0, limit) };
  }
  function nominatim(q, limit, init, outer) {
    var u = 'https://' + NOMINATIM + '/search?format=jsonv2&addressdetails=1&countrycodes=my,sg,bn&limit=' + limit + '&q=' + encodeURIComponent(q);
    return attempt(u, { method: 'GET' }, cfg.nominatimMs, outer).then(function (r) {
      if (r.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      var j = r.ok && !retryable(r) ? json(r.text) : null;
      if (!Array.isArray(j)) { bad(NOMINATIM, r.ok ? 'status ' + r.status : r.why); return Promise.reject(new TypeError('Search is unavailable')); }
      ok(NOMINATIM);
      return new Response(JSON.stringify(toPhoton(j, limit)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  }
  function photon(url, init, outer) {
    var p = new URL(url), q = p.searchParams.get('q') || '', limit = Math.min(10, Math.max(1, +p.searchParams.get('limit') || 7));
    function fallback() { note('Carian perlahan · guna pelayan sandaran', 'photon'); return nominatim(q, limit, init, outer); }
    if (isOpen(PHOTON)) return fallback();
    return attempt(url, init, cfg.photonMs, outer).then(function (r) {
      if (r.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      var j = r.ok && !retryable(r) ? json(r.text) : null;
      if (!j || !Array.isArray(j.features)) { bad(PHOTON, r.ok ? 'status ' + r.status : r.why); return fallback(); }
      ok(PHOTON); return rebuild(r);
    });
  }

  // ---- OSRM: timeout, one retry on the single-host walking profile ----
  function osrm(url, init, outer, host) {
    var foot = /\/routed-foot\//.test(url);
    function go(retry) {
      return attempt(url, init, cfg.osrmMs, outer).then(function (r) {
        if (r.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
        if (retryable(r)) {
          bad(host, r.ok ? 'status ' + r.status : r.why);
          if (foot && retry) return new Promise(function (res) { setTimeout(res, 400 + Math.random() * 400); }).then(function () { return go(false); });
          // Hand the failure to the app, which already tries its next routing server.
          return Promise.reject(new TypeError('Routing server unavailable'));
        }
        ok(host); return rebuild(r);
      });
    }
    return go(true);
  }

  window.fetch = function (input, init) {
    var url, i = init || {};
    try {
      if (typeof input !== 'string' && !(input instanceof URL)) return realFetch(input, init); // Request objects: leave alone
      url = new URL(String(input), location.href);
    } catch (e) { return realFetch(input, init); }
    var host = url.hostname, method = String(i.method || 'GET').toUpperCase(), outer = i.signal || null;
    if (url.protocol !== 'https:') return realFetch(input, init);
    var known = OVERPASS.indexOf(host) >= 0 || host === PHOTON || OSRM[host];
    if (!known || (method !== 'GET' && method !== 'POST')) return realFetch(input, init);
    if (navigator.onLine === false) return Promise.reject(new TypeError('Offline')); // fail fast instead of hanging
    if (OVERPASS.indexOf(host) >= 0 && method === 'POST' && /\/api\/interpreter$/.test(url.pathname)) return overpass(url.href, i, outer);
    if (host === PHOTON && method === 'GET' && url.pathname === '/api/') return photon(url.href, i, outer);
    if (OSRM[host] && method === 'GET') return osrm(url.href, i, outer, host);
    return realFetch(input, init);
  };

  window.__arahNet = {
    version: VERSION,
    status: function () {
      var hosts = {}, degraded = false, now = Date.now();
      Object.keys(health).forEach(function (k) { var s = health[k]; hosts[k] = { fails: s.fails, open: s.openUntil > now, lastOk: s.lastOk, lastErr: s.lastErr }; if (s.openUntil > now) degraded = true; });
      return { hosts: hosts, degraded: degraded, fallbacks: fallbacks, last: lastNote };
    },
  };
})();
