/*! ARAH skin core v0.1.0 - the Skin v2 style sheet and the chip row. Loaded lazily by arah-skin.js. See the loader for the idea.
 * Security / perf: pure CSS plus one MutationObserver on <body> children (not the subtree) that moves known add-on buttons into the row; no network,
 * no storage, no app code is called. Everything is undone by ?skin=classic. */
(function () {
  'use strict';
  if (window.__arahSkinCore) return; window.__arahSkinCore = '0.1.0';
  var root = document.documentElement, UI = '.maplibregl-map ~ div';
  var CHIPS = ['.arah-pwa-pill', '.arah-ar-fab', '.ap-btn', '.af-btn', '.ak-btn', '.aez'];

  var CSS =
    // --- shape language: big soft radii, floating glass cards, circular map buttons
    'html[data-skin]{--sk-r:28px;--sk-line:rgba(255,255,255,.09)}' +
    // search header: logo tile stays, the search box becomes a pill; suggestions drop over the map buttons instead of hiding behind them
    'html[data-skin] ' + UI + '[style*="pointer-events: none"],html[data-skin] ' + UI + '[style*="pointer-events:none"]{z-index:9!important}' +
    'html[data-skin] ' + UI + '[style*="pointer-events: none"] > div:nth-child(2),html[data-skin] ' + UI + '[style*="pointer-events:none"] > div:nth-child(2){border-radius:var(--sk-r)!important;box-shadow:0 8px 28px rgba(0,0,0,.4)!important}' +
    'html[data-skin] ' + UI + '[style*="pointer-events: none"] > div:first-child,html[data-skin] ' + UI + '[style*="pointer-events:none"] > div:first-child{border-radius:22px!important;box-shadow:0 8px 24px rgba(0,0,0,.35)!important}' +
    // map buttons: a column of circles
    'html[data-skin] ' + UI + ' button[title="Toggle 3D"],html[data-skin] ' + UI + ' button[title="Reset north"],html[data-skin] ' + UI + ' button[title="Map views"],html[data-skin] ' + UI + ' button[title="3D terrain"],html[data-skin] ' + UI + ' button[title="My location"],html[data-skin] ' + UI + ' button[title="Report"]{border-radius:50%!important;box-shadow:0 6px 18px rgba(0,0,0,.4)!important}' +
    // bottom sheet: a floating card with a grab handle
    'html[data-skin] ' + UI + '[style*="58dvh"]{border-radius:var(--sk-r)!important;border:1px solid var(--sk-line)!important;box-shadow:0 -12px 44px rgba(0,0,0,.45)!important}' +
    'html[data-skin] ' + UI + '[style*="58dvh"]::before{content:"";position:absolute;top:7px;left:50%;width:40px;height:4px;margin-left:-20px;border-radius:2px;background:rgba(255,255,255,.28);pointer-events:none}' +
    // --- the chip row
    '.sk-rail{position:fixed;z-index:8;left:12px;right:112px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:4px 2px;pointer-events:none}' + // wraps to a second row rather than hiding a button off-screen
    '.sk-rail > *{pointer-events:auto}' +
    '.sk-rail > *{position:static!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;flex:0 0 auto;margin:0!important;box-shadow:0 6px 18px rgba(0,0,0,.4)}' +
    'html:not([data-easy]) .sk-rail > *{height:44px!important;min-height:44px!important;border-radius:22px!important}' +
    '.sk-rail > .arah-pwa-pill{order:0}.sk-rail > .arah-ar-fab{order:1}.sk-rail > .ap-btn{order:2}.sk-rail > .af-btn{order:3}.sk-rail > .ak-btn{order:4}.sk-rail > .aez{order:5}' +
    // temporary hints stack under the row, wherever it ends
    'html[data-skin] .ak-tip{top:calc(var(--sk-rail-bottom,180px) + 8px)!important}html[data-skin] .af-toast{top:calc(var(--sk-rail-bottom,180px) + 64px)!important}' +
    'html[data-sk-trip] .sk-rail{display:none!important}';

  var rail = null, st = null;
  // The search header: the first layer beside the map that is short and near the top (other full-screen layers can precede it in the page).
  function header() { var all = document.querySelectorAll(UI); for (var i = 0; i < all.length; i++) { var r = all[i].getBoundingClientRect(); if (r.height > 20 && r.height < 240 && r.top < 120) return all[i]; } return null; }
  function adopt() {
    if (!rail) return;
    CHIPS.forEach(function (sel) { var e = document.querySelector(sel); if (e && e.parentNode !== rail) rail.appendChild(e); });
  }
  function place() { // under the header, whatever its scaled size (easy mode zooms it)
    var h = header(), r = h && h.getBoundingClientRect(), bottom = r && r.height ? r.bottom : 70;
    rail.style.top = Math.round(bottom + 6) + 'px';
    root.style.setProperty('--sk-rail-bottom', Math.round(rail.getBoundingClientRect().bottom) + 'px');
    var tam = false, b = document.querySelectorAll('button'); for (var i = 0; i < b.length; i++) if ((b[i].textContent || '').trim() === 'Tamat') { tam = true; break; }
    if (tam) root.setAttribute('data-sk-trip', ''); else root.removeAttribute('data-sk-trip');
  }
  function start() {
    st = document.createElement('style'); st.id = 'arah-skin-css'; st.textContent = CSS; document.head.appendChild(st);
    rail = document.createElement('div'); rail.className = 'sk-rail'; rail.setAttribute('role', 'region'); rail.setAttribute('aria-label', 'Pintasan · Shortcuts'); document.body.appendChild(rail);
    root.setAttribute('data-skin', 'v2'); adopt(); place();
    new MutationObserver(function () { adopt(); }).observe(document.body, { childList: true }); // late buttons from other modules
    setInterval(function () { adopt(); place(); }, 1200); window.addEventListener('resize', place);
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.__arahSkin = Object.assign(window.__arahSkin || {}, { active: function () { return !!rail; } });
})();
