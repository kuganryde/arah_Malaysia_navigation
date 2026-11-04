/*! ARAH a11y v0.1.0
 * Accessibility and layout fixes for the app's own screens, applied from outside (the bundled app is not edited):
 *   1. Landmarks: the app root becomes <main> so every control and heading sits inside a landmark (WCAG 1.3.1 / 2.4.1).
 *   2. Contrast: the muted grey text token is lifted to 7:1 (WCAG 1.4.6 AAA) on the dark surfaces.
 *   3. Target size: buttons are at least 44x44 px (WCAG 2.5.5 AAA, above the 24 px of 2.5.8 AA).
 *   4. Overlap: the right-hand button column never sits on top of the bottom panel (it wraps into a second column
 *      when the panel is tall), so the panel's own toggle stays reachable (WCAG 2.5.8 target size, 2.4.11 not obscured).
 * Exposes window.__arahLayout so other layers can place themselves beside the column without overlapping the panel.
 * Reads the DOM only; never calls the app's code.
 */
(function () {
  'use strict';
  if (window.__arahA11y) return;
  window.__arahA11y = '0.1.0';

  var st = document.createElement('style');
  st.textContent = 'html:root{--color-neutral-500:#a2a7c2}' + // 7.5:1 on #141729, 8.2:1 on #0a0c1a (was 4.9 / 5.3)
    'button.btn{min-height:44px!important;min-width:44px}'; // AAA target size; icon buttons keep their own width where larger
  (document.head || document.documentElement).appendChild(st);

  function column() { // the stack of map buttons on the right edge
    var bs = document.querySelectorAll('button.btn');
    for (var i = 0; i < bs.length; i++) {
      var p = bs[i].parentElement; if (!p) continue;
      var cs = getComputedStyle(p);
      if (cs.position === 'absolute' && /^column/.test(cs.flexDirection) && p.querySelectorAll(':scope > button.btn').length >= 4) return p;
    }
    return null;
  }
  function panelTop() { // top edge of the bottom sheet (found through its own toggle button)
    var t = document.querySelector('button[aria-label^="Togol panel"]'), p = t;
    while (p && p !== document.body) { var cs = getComputedStyle(p); if ((cs.position === 'absolute' || cs.position === 'fixed') && cs.bottom !== 'auto') return p.getBoundingClientRect().top; p = p.parentElement; }
    return null;
  }
  window.__arahLayout = { column: column, panelTop: panelTop };

  function apply() {
    var root = document.getElementById('dc-root');
    if (root && !root.getAttribute('role')) { root.setAttribute('role', 'main'); root.setAttribute('aria-label', 'ARAH · Navigasi Malaysia'); }
    var col = column(), pt = panelTop();
    if (col && pt !== null) { // keep the column above the panel: wrap into a second column instead of overlapping
      var top = col.getBoundingClientRect().top, room = Math.floor(pt - 8 - top), cur = col.style.maxHeight;
      var want = room >= 96 ? room + 'px' : '';
      if (cur !== want) col.style.maxHeight = want;
      if (want && col.style.flexWrap !== 'wrap-reverse') { col.style.flexWrap = 'wrap-reverse'; col.style.alignContent = 'flex-start'; col.style.columnGap = '8px'; }
      if (!want && col.style.flexWrap) { col.style.flexWrap = ''; col.style.alignContent = ''; }
    }
  }
  var tick = function () { try { apply(); } catch (e) { /* never break the page */ } };
  window.addEventListener('resize', tick); window.addEventListener('orientationchange', tick);
  setInterval(tick, 500); // the panel opens, closes and resizes with the app's own state; a cheap read + rare write
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick); else tick();
})();
