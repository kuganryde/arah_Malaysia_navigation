/*! ARAH drive v0.2.0 - eager loader (about 1 KB). The drive view itself (drive-core.js + drive-ui.js: AR road view, mini guided map,
 * racing speedometer, Normal / Sports / Luxury themes) is fetched only when a trip starts, so it costs nothing until then.
 * Separate layer: it only reads the DOM to learn that a trip is on (the "Tamat" button) and never calls the app's code. */
(function () {
  'use strict';
  if (window.__arahDrive) return;
  var BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href, state = 'idle';
  window.__arahDrive = { version: '0.2.0', status: function () { return { loaded: state === 'loaded', state: state }; } };
  function trip() { var b = document.querySelectorAll('button'); for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') return true; return false; }
  function add(file, next) {
    var s = document.createElement('script'); s.src = BASE + file; s.async = false;
    s.onload = next; s.onerror = function () { state = 'failed'; };
    document.head.appendChild(s);
  }
  var iv = setInterval(function () {
    if (state !== 'idle' || !trip()) { if (state !== 'idle') clearInterval(iv); return; }
    state = 'loading';
    add('drive-core.js', function () { add('drive-ui.js', function () { state = 'loaded'; }); });
  }, 1500);
})();
