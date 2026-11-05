/*! ARAH easy mode v0.1.0 - "Mod Mudah": a calmer, larger version of the app for older drivers and anyone who finds small controls hard.
 * Bigger text and touch targets (about 30% larger), only the controls that matter on screen (find a place, my location, report, the route),
 * no festival decoration or animation, no AR or camera, and a big speedometer on trips. One button turns it on and off; the choice is
 * remembered on this device and `?easy=1` / `?easy=0` in the link sets it (handy for setting up a parent's phone).
 * Separate layer: it only adds a style sheet and a data attribute, and never calls the app's code. Nothing leaves the device. */
(function () {
  'use strict';
  if (window.__arahEasy) return;
  var KEY = 'arah.easy.v1', VERSION = '0.1.0', root = document.documentElement, btn = null, on = false;
  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }
  var q = (location.search.match(/[?&]easy=([01])/) || [])[1];
  if (q) lsSet(q); // an explicit link choice wins and is remembered

  // The app draws its screens as three absolutely positioned layers next to the map (search header, map buttons, bottom sheet / trip cards).
  // `zoom` scales a layer and its offsets together, so nothing is cut off at the screen edge; the map itself is left alone.
  var UI = '.maplibregl-map ~ div';
  var CSS =
    'html[data-easy] ' + UI + '{zoom:1.3}' +
    // every button is 44 px in the standard layout, so the zoom makes each touch target about 57 px (WCAG AAA asks for 44)
    'html[data-easy] ' + UI + '[style*="pointer-events: none"] > div:first-child,html[data-easy] ' + UI + '[style*="pointer-events:none"] > div:first-child{display:none!important}' + // the logo block makes way for a full-width search box
    'html[data-easy] ' + UI + '[style*="58dvh"]{max-height:44dvh!important}' + // the bottom sheet must not grow into the map buttons after scaling
    'html[data-easy] ' + UI + ' *{font-weight:600}' +
    // keep only what an everyday driver needs: search, my location, report, the route
    'html[data-easy] ' + UI + ' button[title="Toggle 3D"],html[data-easy] ' + UI + ' button[title="Reset north"],html[data-easy] ' + UI + ' button[title="Map views"],html[data-easy] ' + UI + ' button[title="3D terrain"],' +
    'html[data-easy] .arah-ar-fab,html[data-easy] .ap-btn,html[data-easy] .af-btn,html[data-easy] .af-toast,html[data-easy] .af-cv,html[data-easy] .adr-mini,html[data-easy] .adr-pill,html[data-easy] .adr-cam,html[data-easy] .adr-themes{display:none!important}' +
    // calm: no decoration, no motion
    'html[data-easy] *,html[data-easy] *::before,html[data-easy] *::after{animation-duration:.001s!important;animation-iteration-count:1!important;transition-duration:.001s!important}' +
    'html[data-easy] .adr-speedo{transform:scale(1.35);transform-origin:left bottom}' +
    '.aez{position:fixed;z-index:35;left:12px;top:128px;min-height:56px;display:none;align-items:center;gap:8px;padding:0 18px;border-radius:28px;border:2px solid #f5b942;background:#141729;color:#fff;font:800 17px/1 "Barlow Condensed","Ubuntu",system-ui,sans-serif;letter-spacing:.04em;box-shadow:0 6px 20px rgba(0,0,0,.45);cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.aez:focus-visible{outline:3px solid #7be3f5;outline-offset:2px}.aez b{font-size:24px;color:#f5b942}' +
    'html[data-easy] .aez{top:calc(env(safe-area-inset-top,0px) + 112px);background:#f5b942;color:#0a0c1a}html[data-easy] .aez b{color:#0a0c1a}' +
    'html[data-trip] .aez{display:none!important}';

  function trip() { var b = document.querySelectorAll('button'); for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true; return false; }
  function paint() {
    if (on) root.setAttribute('data-easy', ''); else root.removeAttribute('data-easy');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Kembali ke paparan biasa · Back to the standard view' : 'Mod Mudah: tulisan besar, kawalan ringkas · Easy mode: large text, simple controls');
      btn.lastChild.textContent = on ? 'Paparan biasa' : 'Mod Mudah';
    }
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browser */ } // the map and the drive view re-measure after the layers scale
  }
  function set(v) { on = !!v; lsSet(on ? '1' : '0'); paint(); }

  function build() {
    var st = document.createElement('style'); st.id = 'arah-easy-css'; st.textContent = CSS; document.head.appendChild(st);
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'aez';
    var mark = document.createElement('b'); mark.setAttribute('aria-hidden', 'true'); mark.textContent = 'A+'; var t = document.createElement('span');
    btn.appendChild(mark); btn.appendChild(t); btn.addEventListener('click', function () { set(!on); }); document.body.appendChild(btn); paint();
    setInterval(function () { // hidden while navigating: a trip is no time to change modes; shown again afterwards
      var tr = trip(); if (tr) root.setAttribute('data-trip', ''); else root.removeAttribute('data-trip');
      btn.style.display = tr ? 'none' : 'flex';
    }, 1000); btn.style.display = 'flex';
  }

  on = lsGet() === '1';
  if (on) root.setAttribute('data-easy', ''); // before the app paints: no flash of the small layout
  window.__arahEasy = { version: VERSION, set: set, status: function () { return { on: on }; } };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
