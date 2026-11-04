import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOADER_HTML, LOADER_CSS, LOADER_JS } from '../scripts/loader/loader-markup.mjs';

test('loader is self-contained: no network, no images, no inline handlers', () => {
  const all = LOADER_HTML + LOADER_CSS + LOADER_JS;
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(all), 'no external URLs');
  assert.ok(!/url\((?!#)|<img|<link|onload=|onclick=|javascript:/i.test(all));
});
test('loader is announced to screen readers and keeps the bundler status element', () => {
  assert.match(LOADER_HTML, /role="status"/); assert.match(LOADER_HTML, /aria-label="Memuatkan ARAH/);
  assert.match(LOADER_HTML, /id="__bundler_loading"/); // the bundler writes its progress text here
  assert.match(LOADER_HTML, /aria-hidden="true"/); // decorative skyline
});
test('loader stops animating for reduced motion and moves only transform/opacity', () => {
  assert.match(LOADER_CSS, /prefers-reduced-motion:reduce\)\{#arah-loader \*\{animation:none!important/);
  const kf = [...LOADER_CSS.matchAll(/@keyframes [\w-]+\{([^@]*?)\}(?=\n@|\n@media|$)/g)].map((m) => m[1]);
  for (const k of kf) assert.ok(!/(width|height|top|left|margin)\s*:/.test(k), 'keyframes animate layout: ' + k);
});
test('loader stays small (it is inlined in the page shell)', () => {
  assert.ok((LOADER_HTML + LOADER_CSS + LOADER_JS).length < 10 * 1024);
});
test('the shipped index.html carries the current loader and the hand-over hooks', () => {
  const s = readFileSync('index.html', 'utf8');
  assert.ok(s.includes(LOADER_HTML), 'index.html loader is stale: run npm run pwa:inject');
  assert.ok(s.includes(LOADER_CSS) && s.includes(LOADER_JS));
  assert.match(s, /__arahLoader\.hold\(\);\s*document\.documentElement\.replaceWith\(doc\.documentElement\);\s*window\.__arahLoader && window\.__arahLoader\.show\(\)/);
});
