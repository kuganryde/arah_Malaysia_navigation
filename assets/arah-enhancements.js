/*! ARAH enhancements v0.1.0
 * A small, separate layer on top of the app bundle. It reads the DOM only and never calls the app's
 * code, so it cannot change routing, voice or map behaviour. If it fails, the app is unaffected.
 *  1. Screen wake lock while a trip is active (the "Tamat" end-trip button is on screen).
 *  2. Accessible names for icon-only buttons that have no text, title or aria-label.
 *  3. Reduced-motion support for users who ask for it.
 */
(function () {
  'use strict';
  if (window.__arahEnh) return;
  window.__arahEnh = '0.1.0';

  // 3. Reduced motion: stop decorative animation and smooth scrolling. Map camera animation is
  //    controlled by the app; this only covers CSS animation and transitions.
  try {
    var st = document.createElement('style');
    st.textContent = '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}';
    document.head.appendChild(st);
  } catch (e) { /* non-critical */ }

  // 2. Icon-only buttons: label by their Phosphor icon (Malay first, English second, as in the app).
  var ICONS = {
    'ph-x': 'Tutup · Close', 'ph-megaphone': 'Lapor · Report', 'ph-crosshair': 'Lokasi saya · My location',
    'ph-speaker-high': 'Suara hidup · Voice on', 'ph-speaker-slash': 'Suara mati · Voice off',
    'ph-speaker-simple-high': 'Suara hidup · Voice on', 'ph-speaker-simple-slash': 'Suara mati · Voice off',
    'ph-arrows-down-up': 'Tukar mula dan destinasi · Swap start and destination',
    'ph-translate': 'Tukar bahasa · Change language', 'ph-compass': 'Utara · Reset north',
    'ph-stack': 'Paparan peta · Map views', 'ph-mountains': 'Rupa bumi 3D · 3D terrain',
    'ph-magnifying-glass': 'Cari · Search', 'ph-navigation-arrow': 'Mula · Start', 'ph-caret-down': 'Togol panel · Toggle panel', 'ph-caret-up': 'Togol panel · Toggle panel'
  };
  function nameButtons(root) {
    var btns = root.querySelectorAll ? root.querySelectorAll('button:not([aria-label]):not([aria-labelledby])') : [];
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.title || (b.textContent || '').trim()) continue; // already has a name
      var ic = b.querySelector('i[class*="ph"]');
      if (!ic) continue;
      var cls = ic.className.split(/\s+/);
      for (var k = 0; k < cls.length; k++) if (ICONS[cls[k]]) { b.setAttribute('aria-label', ICONS[cls[k]]); break; }
    }
    // Decorative icons should not be read out.
    var ics = root.querySelectorAll ? root.querySelectorAll('i[class*="ph"]:not([aria-hidden])') : [];
    for (var j = 0; j < ics.length; j++) ics[j].setAttribute('aria-hidden', 'true');
  }

  // 1. Wake lock tied to an active trip. Re-acquired when the tab becomes visible again, because the
  //    browser releases the lock whenever the page is hidden.
  var lock = null, want = false;
  function tripActive() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) if ((btns[i].textContent || '').trim() === 'Tamat') return true;
    return false;
  }
  function acquire() {
    if (!('wakeLock' in navigator) || lock || document.visibilityState !== 'visible') return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      l.addEventListener('release', function () { lock = null; });
    }).catch(function () { /* denied (battery saver, permissions policy): the app works without it */ });
  }
  function release() { if (lock) { try { lock.release(); } catch (e) {} lock = null; } }
  function sync() {
    var on = tripActive();
    if (on === want) return;
    want = on; on ? acquire() : release();
  }
  document.addEventListener('visibilitychange', function () { if (want) acquire(); });

  var timer = 0;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = 0;
      try { nameButtons(document); sync(); } catch (e) { /* never break the page */ }
    }, 300);
  }
  function start() {
    schedule();
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
