// Adds the PWA tags to the app's two heads (the static shell and the bundled template that replaces it at runtime).
// Idempotent: re-running changes nothing. Also patches the editable source copy.
import { readFileSync, writeFileSync } from 'node:fs';
const SPLASH = [
  [1290, 2796, 3], [1179, 2556, 3], [1284, 2778, 3], [1170, 2532, 3], [1125, 2436, 3],
  [828, 1792, 2], [750, 1334, 2], [1242, 2208, 3], [1668, 2388, 2], [2048, 2732, 2],
];
export const TAGS = [
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">',
  '<link rel="icon" type="image/png" sizes="48x48" href="assets/icons/favicon-48.png">',
  ...SPLASH.map(([w, h, r]) => `<link rel="apple-touch-startup-image" href="assets/splash/launch-${w}x${h}.png" media="(device-width: ${w / r}px) and (device-height: ${h / r}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)">`),
].join('\n');
const MARK = 'rel="manifest"';
const PWA_SCRIPT = '<script src="assets/arah-pwa.js" defer></script>';
const PLACES_SCRIPT = '<script src="assets/places/arah-places.js" defer></script>';
const FESTIVE_SCRIPT = '<script src="assets/festive/arah-festive.js" defer></script>';
const KEEP_SCRIPT = '<script src="assets/keepawake/arah-keepawake.js" defer></script>';
const OBS_SCRIPT = '<script src="assets/observability/arah-observe.js" defer></script>';
const VEH_SCRIPT = '<script src="assets/vehicles/arah-vehicles.js" defer></script>';
const NET_SCRIPT = '<script src="assets/resilience/arah-resilience.js" defer></script>';
// Read-only handle so the Makan & Mall layer can place markers; the app's own code is otherwise untouched.
const MAP_FROM = 'this.map=new gl.Map(', MAP_TO = 'this.map=window.__arahMap=new gl.Map(';
const ENH = '<script src="assets/arah-enhancements.js" defer></script>';

export function patchHead(html) { // for plain HTML heads
  let out = html;
  if (/^\s*(<!doctype[^>]*>\s*)?<html>/i.test(out)) out = out.replace('<html>', '<html lang="ms">'); // screen readers pick the voice from lang
  if (!out.includes(MARK)) out = out.replace('</head>', TAGS + '\n</head>');
  if (!out.includes('arah-pwa.js')) out = out.replace(ENH, ENH + '\n' + PWA_SCRIPT);
  if (!out.includes('arah-places.js')) out = out.replace(PWA_SCRIPT, PWA_SCRIPT + '\n' + PLACES_SCRIPT);
  if (!out.includes('arah-festive.js')) out = out.replace(PLACES_SCRIPT, PLACES_SCRIPT + '\n' + FESTIVE_SCRIPT);
  if (!out.includes('arah-keepawake.js')) out = out.replace(FESTIVE_SCRIPT, FESTIVE_SCRIPT + '\n' + KEEP_SCRIPT);
  if (!out.includes('arah-resilience.js')) out = out.replace(KEEP_SCRIPT, KEEP_SCRIPT + '\n' + NET_SCRIPT);
  if (!out.includes('arah-observe.js')) out = out.replace(NET_SCRIPT, NET_SCRIPT + '\n' + OBS_SCRIPT);
  if (!out.includes('arah-vehicles.js')) out = out.replace(OBS_SCRIPT, OBS_SCRIPT + '\n' + VEH_SCRIPT);
  if (out.includes(MAP_FROM)) out = out.replace(MAP_FROM, MAP_TO);
  return out;
}

// The bundle writes every "</" inside the JSON as "<\u002F" so the string can sit inside a <script> element.
const encode = (v) => JSON.stringify(v).replace(/<\//g, '<\\u002F');

function patchBundle(file) {
  let s = readFileSync(file, 'utf8');
  const re = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
  const m = s.match(re);
  const raw = m[2];
  const tpl = JSON.parse(raw);
  const roundTrip = encode(tpl);
  if (roundTrip !== raw.trim()) throw new Error('template does not round-trip byte-identically; refusing to rewrite');
  let t = tpl;
  if (/^\s*(<!doctype[^>]*>\s*)?<html>/i.test(t)) t = t.replace('<html>', '<html lang="ms">');
  const head = t.indexOf('</head>');
  const headPart = t.slice(0, head);
  if (!headPart.includes(MARK)) t = t.slice(0, head) + TAGS + '\n' + t.slice(head);
  if (!t.includes('arah-pwa.js')) t = t.replace(ENH, ENH + '\n' + PWA_SCRIPT);
  if (!t.includes('arah-places.js')) t = t.replace(PWA_SCRIPT, PWA_SCRIPT + '\n' + PLACES_SCRIPT);
  if (!t.includes('arah-festive.js')) t = t.replace(PLACES_SCRIPT, PLACES_SCRIPT + '\n' + FESTIVE_SCRIPT);
  if (!t.includes('arah-keepawake.js')) t = t.replace(FESTIVE_SCRIPT, FESTIVE_SCRIPT + '\n' + KEEP_SCRIPT);
  if (!t.includes('arah-resilience.js')) t = t.replace(KEEP_SCRIPT, KEEP_SCRIPT + '\n' + NET_SCRIPT);
  if (!t.includes('arah-observe.js')) t = t.replace(NET_SCRIPT, NET_SCRIPT + '\n' + OBS_SCRIPT);
  if (!t.includes('arah-vehicles.js')) t = t.replace(OBS_SCRIPT, OBS_SCRIPT + '\n' + VEH_SCRIPT);
  if (t.includes(MAP_FROM)) t = t.replace(MAP_FROM, MAP_TO);
  const enc = encode(t);
  s = s.replace(re, (_, a, _b, c) => a + enc + c);
  // outer shell: manifest tags in the static head; dark loading screen instead of a white flash
  s = patchHead(s.slice(0, s.indexOf('</head>') + 7)) + s.slice(s.indexOf('</head>') + 7);
  s = s.replace('body { background: #faf9f5;', 'body { background: #0a0c1a;')
       .replace('background: #faf9f5; z-index: 9999', 'background: #0a0c1a; z-index: 9999')
       .replace(/(#__bundler_loading \{[^}]*?)color: #666; background: #fff;/, '$1color: #9aa0c4; background: #141729;');
  writeFileSync(file, s);
}
if (process.argv[1].endsWith('inject-head.mjs')) {
  patchBundle('index.html');
  const src = 'source/Arah Navigation.dc.html';
  writeFileSync(src, patchHead(readFileSync(src, 'utf8')));
  console.log('head tags in place');
}
