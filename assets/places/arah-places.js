/*! ARAH Makan & Mall v0.2.0
 * A directory of Malaysian fast-food chains and shopping malls with logos. Separate layer, like arah-ar.js:
 * it reads the app's map through window.__arahMap and never calls the app's other code.
 *  - Outlets come live from OpenStreetMap (Overpass), searched around the centre of the map view.
 *  - Logos load from each brand's own website; offline or blocked, a coloured-initials badge is shown instead.
 *    Switch logos off in the sheet to make no requests to brand sites at all.
 * Hidden during a trip so it cannot distract a driver.
 */
(function () {
  'use strict';
  if (window.__arahPlaces) return;
  window.__arahPlaces = '0.2.0';
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  var OVERPASS = 'https://overpass-api.de/api/interpreter';
  var LOGO_KEY = 'arah.places.logos';
  var core, data, btn, scrim, sheet, markers = [], state = { kind: 'food', brand: null, q: '', busy: false, items: null, err: '' };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var logosOn = function () { return lsGet(LOGO_KEY) !== '0'; };
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'class') n.className = props[k]; else if (k === 'text') n.textContent = props[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]); else n.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function tripActive() {
    var b = document.querySelectorAll('button');
    for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true;
    return false;
  }

  /* ---------- logo: brand website first, badge as the fallback (and the only thing shown offline / when off) */
  function badge(b, size) {
    var s = el('span', { class: 'ap-badge', 'aria-hidden': 'true', text: core.initials(b.name) });
    var rd = core.readable(b.color); // brand hue, nudged just enough for 7:1 text contrast (WCAG AAA)
    s.style.cssText = 'background:' + rd.bg + ';color:' + rd.ink + ';width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.38) + 'px';
    return s;
  }
  var io = null;
  function watch(w) {
    if (!('IntersectionObserver' in window)) return w._load();
    io = io || new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); if (e.target._load) e.target._load(); } });
    }, { rootMargin: '120px' });
    io.observe(w);
  }
  function logo(b, size) {
    var wrap = el('span', { class: 'ap-logo' });
    wrap.style.cssText = 'width:' + size + 'px;height:' + size + 'px';
    wrap.appendChild(badge(b, size));
    if (!logosOn() || !navigator.onLine) return wrap;
    var urls = core.logoUrls(b.domain);
    if (!urls.length) return wrap;
    // Fetch the logo only once its tile scrolls into view, so opening the sheet does not contact every brand's site.
    wrap._load = function () {
      var i = 0, img = new Image();
      img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; // no Referer sent to brand sites
      img.width = size; img.height = size;
      img.onload = function () { if (img.naturalWidth >= 16) { wrap.replaceChildren(img); wrap.classList.add('ok'); } };
      img.onerror = function () { i++; if (i < urls.length) img.src = urls[i]; };
      img.src = urls[0];
    };
    watch(wrap);
    return wrap;
  }

  /* ---------- styles */
  var css = '' +
    '.ap-btn{position:fixed;z-index:34;top:80px;height:36px;padding:0 12px;border-radius:10px;border:1px solid rgba(47,208,236,.5);background:var(--surface,#141729);color:#eef0fa;font:700 13px "Ubuntu","Segoe UI",system-ui,sans-serif;cursor:pointer;display:none;align-items:center;gap:6px;box-shadow:0 4px 16px rgba(0,0,0,.4)}' +
    '.ap-btn b{color:#2fd0ec;font:800 15px "Barlow Condensed","Ubuntu",sans-serif}' +
    '.ap-scrim{position:fixed;inset:0;z-index:60;background:rgba(5,6,16,.78);display:grid;place-items:end center}' +
    '.ap-sheet{width:100%;max-width:480px;height:min(82vh,720px);background:#141729;border:1px solid #2fd0ec;border-radius:16px 16px 0 0;color:#eef0fa;font:400 14px/1.4 "Ubuntu",system-ui,sans-serif;display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom)}' +
    '.ap-head{display:flex;align-items:center;gap:8px;padding:14px 14px 8px}.ap-head h2{flex:1;margin:0;font:800 24px/1 "Barlow Condensed","Ubuntu",sans-serif;font-style:italic;text-transform:uppercase;color:#2fd0ec}' +
    '.ap-x,.ap-tab,.ap-chip,.ap-go,.ap-row{font-family:inherit;cursor:pointer}' +
    '.ap-x{min-width:40px;min-height:40px;border-radius:8px;border:1px solid #3a3f66;background:transparent;color:#eef0fa;font-size:16px}' +
    '.ap-tabs{display:flex;gap:6px;padding:0 14px 8px}.ap-tab{flex:1;min-height:40px;border-radius:8px;border:1px solid #3a3f66;background:transparent;color:#eef0fa;font-weight:700;font-size:13px}' +
    '.ap-tab[aria-selected=true]{background:#bf91ff;border-color:#a865f5;color:#0a0c1a}' +
    '.ap-q{margin:0 14px 8px;min-height:42px;border-radius:8px;border:1px solid #3a3f66;background:#0a0c1a;color:#eef0fa;padding:0 12px;font:inherit;font-size:15px}' +
    '.ap-body{flex:1;overflow:auto;padding:0 14px 14px;-webkit-overflow-scrolling:touch}' +
    '.ap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.ap-chip{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 4px;border-radius:10px;border:1px solid #2a2f55;background:#0f1226;color:#eef0fa;font-size:12px;line-height:1.2;text-align:center;min-height:92px}' +
    '.ap-chip.all{grid-column:1/-1;flex-direction:row;justify-content:center;min-height:48px;border-color:#2fd0ec;font-weight:700;font-size:13px}' +
    '.ap-logo,.ap-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;flex:none;overflow:hidden}' +
    '.ap-logo.ok{background:#fff}.ap-logo img{width:100%;height:100%;object-fit:contain;padding:3px;box-sizing:border-box}.ap-badge{font-weight:800;font-family:"Barlow Condensed","Ubuntu",sans-serif;letter-spacing:.02em}' +
    '.ap-row{display:flex;align-items:center;gap:10px;width:100%;padding:8px;margin:0 0 6px;border-radius:10px;border:1px solid #2a2f55;background:#0f1226;color:#eef0fa;text-align:left}' +
    '.ap-row .t{flex:1;min-width:0}.ap-row .t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ap-row .t small{color:#a6acd0;font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.ap-row .d{color:#2fd0ec;font:800 15px "Barlow Condensed","Ubuntu",sans-serif;flex:none}' +
    '.ap-bar{display:flex;gap:8px;align-items:center;margin:0 0 10px}.ap-bar .s{flex:1;color:#a6acd0;font-size:12px}' +
    '.ap-go{min-height:40px;padding:0 12px;border-radius:8px;border:1px solid #a865f5;background:#bf91ff;color:#0a0c1a;font-weight:700;font-size:13px}.ap-go.q{background:transparent;color:#eef0fa;border-color:#3a3f66}' +
    '.ap-msg{padding:24px 8px;text-align:center;color:#a6acd0}.ap-foot{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid #2a2f55;color:#a6acd0;font-size:12px}.ap-foot label{display:flex;gap:6px;align-items:center;flex:1;cursor:pointer}' +
    '.ap-mk{width:36px;height:36px;border-radius:50%;border:3px solid #2fd0ec;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.5);overflow:hidden;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
    '.ap-x:focus-visible,.ap-tab:focus-visible,.ap-chip:focus-visible,.ap-go:focus-visible,.ap-row:focus-visible,.ap-btn:focus-visible,.ap-q:focus-visible{outline:2px solid #2fd0ec;outline-offset:2px}';

  /* ---------- sheet */
  function open() {
    if (scrim) return;
    var prev = document.activeElement;
    scrim = el('div', { class: 'ap-scrim' });
    sheet = el('div', { class: 'ap-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ap-title' });
    scrim.appendChild(sheet);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(prev); });
    scrim.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(prev); });
    document.body.appendChild(scrim);
    render(); var f = sheet.querySelector('.ap-q,.ap-x'); if (f) f.focus();
  }
  function close(prev) { if (!scrim) return; scrim.remove(); scrim = sheet = null; if (prev && prev.focus) prev.focus(); }

  function render() {
    if (!sheet) return;
    var head = el('div', { class: 'ap-head' }, [
      el('h2', { id: 'ap-title', text: 'Makan & Mall' }),
      el('button', { class: 'ap-x', type: 'button', 'aria-label': 'Tutup · Close', text: '✕', onclick: function () { close(btn); } })]);
    var body = el('div', { class: 'ap-body' });
    sheet.replaceChildren(head);
    if (!state.brand && !state.items) {
      var tabs = el('div', { class: 'ap-tabs', role: 'tablist' }, [['food', 'Makanan segera · Fast food'], ['mall', 'Pusat beli-belah · Malls']].map(function (t) {
        return el('button', { class: 'ap-tab', type: 'button', role: 'tab', 'aria-selected': String(state.kind === t[0]), text: t[1], onclick: function () { state.kind = t[0]; state.q = ''; render(); } });
      }));
      var q = el('input', { class: 'ap-q', type: 'search', placeholder: 'Cari jenama · Filter brands', 'aria-label': 'Filter brands', value: state.q, autocomplete: 'off' });
      q.addEventListener('input', function () { state.q = q.value; list(body); });
      sheet.appendChild(tabs); sheet.appendChild(q);
      list(body);
    } else results(body);
    sheet.appendChild(body);
    var sw = el('input', { type: 'checkbox' }); sw.checked = logosOn();
    sw.addEventListener('change', function () { lsSet(LOGO_KEY, sw.checked ? '1' : '0'); render(); });
    sheet.appendChild(el('div', { class: 'ap-foot' }, [el('label', null, [sw, el('span', { text: 'Logo dari laman jenama · Logos from brand sites' })]), el('span', { text: data.BRANDS.length + ' ' + 'jenama' })]));
  }

  function list(body) {
    body.replaceChildren();
    var grid = el('div', { class: 'ap-grid' }), q = state.q.trim().toLowerCase();
    var all = el('button', { class: 'ap-chip all', type: 'button', onclick: function () { search(null); } }, [el('span', { text: state.kind === 'food' ? 'Semua makanan berdekatan · All food nearby' : 'Semua mall berdekatan · All malls nearby' })]);
    if (!q) grid.appendChild(all);
    var n = 0;
    data.BRANDS.forEach(function (b) {
      if (b.kind !== state.kind || (q && b.name.toLowerCase().indexOf(q) < 0)) return;
      n++;
      grid.appendChild(el('button', { class: 'ap-chip', type: 'button', onclick: function () { search(b); } }, [logo(b, 44), el('span', { text: b.name })]));
    });
    body.appendChild(grid);
    if (!n) body.appendChild(el('p', { class: 'ap-msg', text: 'Tiada padanan. Cuba "Semua berdekatan". · No match. Try "All nearby".' }));
  }

  function results(body) {
    var b = state.brand;
    var bar = el('div', { class: 'ap-bar' }, [
      el('button', { class: 'ap-go q', type: 'button', text: '← Kembali · Back', onclick: function () { state.brand = null; state.items = null; state.err = ''; render(); } }),
      el('span', { class: 's', text: (b ? b.name : (state.kind === 'food' ? 'Semua makanan' : 'Semua mall')) + (state.items ? ' · ' + state.items.length : '') })]);
    body.appendChild(bar);
    if (state.busy) return body.appendChild(el('p', { class: 'ap-msg', role: 'status', text: 'Mencari… · Searching…' }));
    if (state.err) return body.appendChild(el('p', { class: 'ap-msg', role: 'alert', text: state.err }));
    if (!state.items || !state.items.length) return body.appendChild(el('p', { class: 'ap-msg', text: 'Tiada hasil dalam kawasan ini. Alihkan peta lalu cuba lagi. · Nothing found here. Move the map and try again.' }));
    state.items.forEach(function (o) {
      var ob = o.brand || b || { name: o.name, color: '#3a3f66', domain: '' };
      body.appendChild(el('button', { class: 'ap-row', type: 'button', onclick: function () { show(o, ob); } }, [
        logo(ob, 40),
        el('span', { class: 't' }, [el('b', { text: o.name }), el('small', { text: [o.addr, o.hours].filter(Boolean).join(' · ') || (state.kind === 'food' ? 'Makanan · Food' : 'Pusat beli-belah · Mall') })]),
        el('span', { class: 'd', text: o.dist })]));
    });
    var all = state.items.slice(0, 60);
    body.appendChild(el('button', { class: 'ap-go', type: 'button', style: 'width:100%;margin-top:6px', text: 'Tunjuk semua di peta · Show all on map', onclick: function () { showMany(all); } }));
  }

  /* ---------- search + map */
  function map() { return window.__arahMap || null; }
  function clearMarkers() { markers.forEach(function (m) { m.remove(); }); markers = []; }
  function search(b) {
    var m = map();
    if (!m) { state.brand = b || {}; state.items = []; state.err = 'Peta belum sedia · The map is not ready yet'; return render(); }
    if (!navigator.onLine) { state.brand = b || {}; state.items = []; state.err = 'Tiada internet. Carian memerlukan sambungan. · You are offline. Search needs a connection.'; return render(); }
    var c = m.getCenter(), ref = [c.lng, c.lat];
    state.brand = b || {}; state.busy = true; state.err = ''; state.items = []; render();
    // A specific mall is searched across Malaysia (its name is selective); everything else around the map centre.
    var scope = (b && state.kind === 'mall') ? { malaysia: true } : { around: [c.lat, c.lng, state.kind === 'mall' ? 12000 : 5000] };
    var q;
    try { q = core.buildQuery(state.kind, b, scope); } catch (e) { state.busy = false; state.err = 'Ralat · Error'; return render(); }
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 28000);
    fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), credentials: 'omit', signal: ctl.signal })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { state.items = core.parseOutlets(j, ref, state.kind, data.BRANDS); state.busy = false; render(); })
      .catch(function () { state.busy = false; state.err = 'Carian sibuk atau gagal. Cuba lagi. · Search is busy or failed. Try again.'; render(); })
      .then(function () { clearTimeout(to); });
  }
  function marker(o, ob) {
    var gl = window.maplibregl; if (!gl || !map()) return null;
    var e = el('div', { class: 'ap-mk', role: 'img', 'aria-label': o.name }); e.appendChild(logo(ob, 30));
    var pop = new gl.Popup({ offset: 22, closeButton: false, maxWidth: '240px' });
    var box = el('div', { style: 'font:600 13px Ubuntu,sans-serif;color:#eef0fa' }, [el('div', { text: o.name }), el('div', { style: 'font-weight:400;color:#b4b9d8', text: [o.addr, o.dist].filter(Boolean).join(' · ') }),
      el('button', { class: 'ap-go', type: 'button', style: 'margin-top:6px;min-height:34px', text: 'Cari laluan · Find route', onclick: function () { route(o); } })]);
    pop.setDOMContent(box);
    var mk = new gl.Marker({ element: e }).setLngLat(o.c).setPopup(pop).addTo(map());
    markers.push(mk); return mk;
  }
  function pad() { // the app's panel covers the lower part of the screen on phones: keep points in the visible top
    var h = window.innerHeight, narrow = window.innerWidth < 760;
    return narrow ? { top: 100, bottom: Math.round(h * 0.5), left: 30, right: 30 } : { top: 100, bottom: 40, left: Math.min(460, Math.round(window.innerWidth * 0.4)), right: 70 };
  }
  function show(o, ob) { clearMarkers(); var mk = marker(o, ob); close(btn); map().flyTo({ center: o.c, zoom: 16, duration: 900, padding: pad() }); if (mk) setTimeout(function () { try { mk.togglePopup(); } catch (e) { /* gone */ } }, 950); }
  function showMany(items) {
    clearMarkers(); var gl = window.maplibregl, b = new gl.LngLatBounds();
    items.forEach(function (o) { marker(o, o.brand || state.brand || { name: o.name, color: '#3a3f66', domain: '' }); b.extend(o.c); });
    close(btn); if (items.length) map().fitBounds(b, { padding: pad(), maxZoom: 16, duration: 900 });
  }
  function route(o) { // hand off to the app's own search box so its normal place and route flow is used
    var inp = document.querySelector('input[placeholder^="Cari tempat"]');
    if (!inp) return;
    var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, [o.name, o.addr].filter(Boolean).join(' '));
    inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); inp.focus();
  }

  /* ---------- button */
  function place() {
    if (!btn) return;
    var show = !tripActive() && !!map();
    btn.style.display = show ? 'inline-flex' : 'none';
    if (!show) return;
    var pill = document.querySelector('.arah-pwa-pill'), vis = pill && getComputedStyle(pill).display !== 'none';
    btn.style.left = (vis ? Math.round(pill.getBoundingClientRect().right) + 8 : 64) + 'px';
  }
  function init() {
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    btn = el('button', { class: 'ap-btn', type: 'button', 'aria-label': 'Makan & Mall · Makan dan pusat beli-belah, fast food and malls', onclick: open }, [el('b', { text: '◉', 'aria-hidden': 'true' }), el('span', { text: 'Makan & Mall' })]);
    document.body.appendChild(btn); place(); setInterval(place, 1500);
  }
  Promise.all([import(BASE + 'places-core.mjs'), import(BASE + 'brands.mjs')]).then(function (r) {
    core = r[0]; data = r[1];
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }).catch(function (e) { console.warn('[ARAH places] failed to load', e && e.message); });
  window.__arahPlacesApi = { open: open, clear: clearMarkers };
})();
