/*! ARAH skin v0.1.0 - loader (about 0.6 KB). "Skin v2" gives the app a softer, rounder look (pill search, circular map buttons, floating sheet with a grab handle)
 * and gathers the add-on buttons (AR, Makan & Mall, festive, keep awake, easy mode, install) into ONE tidy chip row under the search box, so they can no
 * longer pile up over each other on phones and tablets. Colours, fonts and icons stay ARAH's own. The engine loads once the page is idle.
 * `?skin=classic` (or `?skin=v2`) switches it off (on) and is remembered on the device. Separate layer: it never calls the app's code. */
(function () {
  'use strict';
  if (window.__arahSkin) return;
  var KEY = 'arah.skin.v1', BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href, state = 'idle';
  try { var q = (location.search.match(/[?&]skin=(classic|v2)/) || [])[1]; if (q) localStorage.setItem(KEY, q); } catch (e) { /* private mode */ }
  var off; try { off = localStorage.getItem(KEY) === 'classic'; } catch (e) { off = false; }
  window.__arahSkin = { version: '0.1.0', status: function () { return { off: off, state: state }; } };
  if (off) return;
  function go() { var s = document.createElement('script'); s.src = BASE + 'skin-core.js'; s.async = false; s.onload = function () { state = 'loaded'; }; s.onerror = function () { state = 'failed'; }; state = 'loading'; document.head.appendChild(s); }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 800);
})();
