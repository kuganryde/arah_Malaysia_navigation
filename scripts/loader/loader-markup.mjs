// The ARAH loading screen: one source, injected into the page shell by scripts/pwa/inject-head.mjs (npm run pwa:inject).
// Pure HTML + CSS + a few lines of JS, no images and no network, so it paints on the first frame while the 1 MB bundle unpacks,
// then is carried over into the app (the bundler swaps the whole document) and fades once the map has drawn.
// Scene: a neon road rushing toward you under the Kuala Lumpur skyline, with the ARAH navigation arrow floating as a real 3D object
// (stacked layers turning in CSS 3D). Animations use transform/opacity only (compositor), and stop for prefers-reduced-motion.
const STOPS = '<stop offset="0" stop-color="#1fe0a8"/><stop offset=".25" stop-color="#2fd0ec"/><stop offset=".5" stop-color="#4f6bff"/><stop offset=".75" stop-color="#a865f5"/><stop offset="1" stop-color="#ec4899"/>';

const tower = (cx, top, w = 9) => `<path d="M${cx - w} 120V${top + 34}L${cx - w + 3} ${top + 20}L${cx - 3} ${top + 8}L${cx} ${top - 8}L${cx + 3} ${top + 8}L${cx + w - 3} ${top + 20}L${cx + w} ${top + 34}V120Z"/>`;
const SKYLINE = `<svg class="al-city" viewBox="0 0 400 120" aria-hidden="true" focusable="false"><g class="al-bld">
<rect x="6" y="84" width="22" height="36"/><rect x="30" y="72" width="16" height="48"/><rect x="48" y="90" width="20" height="30"/>
<path d="M92 120V58L98 30L104 8L110 30L116 58V120Z"/>
<rect x="124" y="80" width="18" height="40"/><rect x="144" y="92" width="14" height="28"/>
${tower(196, 26)}${tower(224, 26)}<rect x="205" y="70" width="10" height="5"/>
<rect x="244" y="86" width="20" height="34"/>
<path d="M300 120V52h-3V46h-4a10 5 0 0 1 20 0h-4v6h-3V120Z"/><path d="M299.4 46V12h1.2V46Z"/>
<rect x="326" y="76" width="18" height="44"/><rect x="346" y="88" width="22" height="32"/><rect x="370" y="80" width="24" height="40"/>
</g><g class="al-win">${[[34, 80], [40, 94], [130, 90], [196, 60], [224, 64], [196, 78], [224, 82], [250, 98], [334, 86], [352, 98], [378, 92], [100, 70], [100, 90], [38, 106], [150, 104]].map(([x, y]) => `<rect x="${x}" y="${y}" width="2.4" height="3"/>`).join('')}</g></svg>`;

const ARROW = Array.from({ length: 13 }, (_, k) => `<i style="--z:${(k - 6) * 3}px"></i>`).join('');

export const LOADER_HTML = `<div id="arah-loader" role="status" aria-live="polite" aria-label="Memuatkan ARAH · Loading ARAH">
<div class="al-glow"></div>${SKYLINE}
<div class="al-world"><div class="al-floor"><div class="al-grid"><b class="al-lane"></b></div></div></div>
<div class="al-hero"><div class="al-ring"></div><div class="al-arrow">${ARROW}</div></div>
<div class="al-brand"><svg class="al-word" viewBox="0 0 240 64" role="img" aria-label="ARAH"><defs><linearGradient id="alg" x1="0" x2="1" y1="0" y2="0">${STOPS}</linearGradient></defs><text x="120" y="50" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif" font-weight="900" font-style="italic" font-size="60" letter-spacing="3" fill="url(#alg)">ARAH</text></svg>
<p class="al-sub">NAVIGASI MALAYSIA</p></div>
<div class="al-foot"><div class="al-bar"><i></i></div><div id="__bundler_loading" class="al-status">Menyediakan peta · Preparing the map</div></div>
</div><!--/arah-loader-->`;

export const LOADER_CSS = `#arah-loader{position:fixed;inset:0;z-index:9999;overflow:hidden;color:#eef0fa;font:500 13px/1.4 "Ubuntu",-apple-system,"Segoe UI",system-ui,sans-serif;background:radial-gradient(120% 70% at 50% 38%,#17193a 0,#0a0c1a 62%);transition:opacity .5s ease,visibility 0s .5s}
#arah-loader.al-out{opacity:0;visibility:hidden}
#arah-loader *{box-sizing:border-box}
#arah-loader .al-glow{position:absolute;left:50%;top:34%;width:120vmin;height:120vmin;margin:-60vmin 0 0 -60vmin;background:radial-gradient(closest-side,rgba(79,107,255,.28),rgba(168,101,245,.14) 45%,transparent 70%);animation:al-pulse 3.6s ease-in-out infinite}
#arah-loader .al-city{position:absolute;left:50%;bottom:44%;width:min(112vw,640px);transform:translateX(-50%);filter:drop-shadow(0 0 6px rgba(47,208,236,.35))}
#arah-loader .al-bld{fill:#0f1330;stroke:#2fd0ec;stroke-opacity:.55;stroke-width:.8}
#arah-loader .al-win{fill:#ffd166;animation:al-tw 2.8s ease-in-out infinite}
#arah-loader .al-world{position:absolute;left:0;right:0;bottom:0;height:44%;perspective:360px;perspective-origin:50% 0;overflow:hidden;border-top:1px solid rgba(47,208,236,.5);box-shadow:0 -1px 18px rgba(47,208,236,.35)}
#arah-loader .al-floor{position:absolute;left:-60%;width:220%;top:0;height:260%;transform-origin:50% 0;transform:rotateX(74deg);-webkit-mask-image:linear-gradient(#000 0,#000 55%,transparent 100%);mask-image:linear-gradient(#000 0,#000 55%,transparent 100%)}
#arah-loader .al-grid{position:absolute;inset:-72px 0 0;background:repeating-linear-gradient(90deg,rgba(47,208,236,.55) 0 2px,transparent 2px 72px),repeating-linear-gradient(0deg,rgba(168,101,245,.5) 0 2px,transparent 2px 72px);animation:al-run .9s linear infinite}
#arah-loader .al-lane{position:absolute;left:50%;width:14px;margin-left:-7px;top:0;bottom:0;background:repeating-linear-gradient(#ff8f1f 0 36px,transparent 36px 72px);filter:drop-shadow(0 0 6px #ff8f1f)}
#arah-loader .al-hero{position:absolute;left:50%;top:27%;width:104px;height:124px;margin-left:-52px;perspective:520px;animation:al-bob 3.2s ease-in-out infinite}
#arah-loader .al-arrow{position:absolute;inset:0;transform-style:preserve-3d;transform:rotateX(-18deg) rotateY(-28deg);animation:al-spin 6.5s linear infinite}
#arah-loader .al-arrow i{position:absolute;inset:0;clip-path:polygon(50% 0,100% 100%,50% 76%,0 100%);background:linear-gradient(180deg,#2fd0ec,#4f6bff 55%,#a865f5);transform:translateZ(var(--z))}
#arah-loader .al-arrow i:first-child,#arah-loader .al-arrow i:last-child{filter:brightness(1.45)}
#arah-loader .al-ring{position:absolute;left:50%;bottom:-34px;width:150px;height:34px;margin-left:-75px;border-radius:50%;border:2px solid rgba(47,208,236,.7);box-shadow:0 0 18px rgba(47,208,236,.6),inset 0 0 14px rgba(168,101,245,.5);animation:al-ring 3.2s ease-in-out infinite}
#arah-loader .al-brand{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 7%);text-align:center}
#arah-loader .al-word{width:min(62vw,300px);height:auto;filter:drop-shadow(0 0 14px rgba(79,107,255,.65))}
#arah-loader .al-sub{margin-top:2px;letter-spacing:.42em;padding-left:.42em;font-size:11px;font-weight:700;color:#bfc4e6}
#arah-loader .al-foot{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 6%);display:flex;flex-direction:column;align-items:center;gap:10px}
#arah-loader .al-bar{width:min(56vw,240px);height:3px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}
#arah-loader .al-bar i{display:block;width:40%;height:100%;border-radius:3px;background:linear-gradient(90deg,#1fe0a8,#2fd0ec,#a865f5,#ec4899);animation:al-sweep 1.3s ease-in-out infinite}
#arah-loader #__bundler_loading{position:static;background:none;box-shadow:none;padding:0;font:inherit;font-size:12px;color:#b4bad9;letter-spacing:.02em}
@keyframes al-spin{to{transform:rotateX(-18deg) rotateY(332deg)}}
@keyframes al-bob{50%{transform:translateY(-10px)}}
@keyframes al-run{to{transform:translateY(72px)}}
@keyframes al-sweep{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
@keyframes al-ring{50%{transform:scale(1.18);opacity:.55}}
@keyframes al-pulse{50%{opacity:.7;transform:scale(1.06)}}
@keyframes al-tw{50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){#arah-loader *{animation:none!important}#arah-loader .al-bar i{width:100%;opacity:.6}}`;

// Runs in the shell. hold(): remember the loader before the bundler swaps the document; show(): put it back over the app and fade it
// once the map has drawn (or after 20 s so a stuck network never traps the screen). Held at least 900 ms so a warm start does not flash.
export const LOADER_JS = `(function(){var n,s,t0=Date.now(),done=0;function fin(){if(done)return;done=1;var w=Math.max(0,900-(Date.now()-t0));setTimeout(function(){if(n)n.classList.add('al-out');setTimeout(function(){try{n&&n.remove();s&&s.remove()}catch(e){}},700)},w)}
window.__arahLoader={hold:function(){n=document.getElementById('arah-loader');s=document.getElementById('arah-loader-css')},
show:function(){if(!n)return;try{if(s)document.head.appendChild(s);document.body.appendChild(n)}catch(e){return}
var k=setInterval(function(){var m=window.__arahMap;if(!m)return;clearInterval(k);try{m.loaded&&m.loaded()?fin():m.once('load',fin)}catch(e){fin()}},150);setTimeout(fin,20000)}}})();`;
