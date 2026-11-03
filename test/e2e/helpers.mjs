// Shared helpers for the browser tests: a static server for the repo, a locked-down Chromium, and network mocks.
// Hermetic by design: every request that is not to the local server is answered here or aborted, so the tests
// never depend on (or leak to) the internet.
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve('.');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.mp4': 'video/mp4', '.webm': 'video/webm', '.onnx': 'application/octet-stream' };

export function serve() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html'; if (p === '/privacy') p = '/privacy.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT) || !existsSync(f)) { r.writeHead(404); return r.end('not found'); } // no path traversal
    const h = { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' };
    if (p === '/sw.js') { h['Cache-Control'] = 'no-store'; h['Service-Worker-Allowed'] = '/'; }
    r.writeHead(200, h); r.end(readFileSync(f));
  });
  return new Promise((res) => srv.listen(0, '127.0.0.1', () => res({ url: `http://localhost:${srv.address().port}`, close: () => new Promise((d) => srv.close(d)) })));
}

// The app loads MapLibre from a CDN; serve the pinned copy from node_modules instead.
const ML = (f) => join(ROOT, 'node_modules/maplibre-gl/dist', f);
export const OVERPASS = { elements: [
  { type: 'node', lat: 5.4150, lon: 100.3310, tags: { name: 'KFC Test One', brand: 'KFC', 'addr:street': 'Jalan Satu' } },
  { type: 'node', lat: 5.4180, lon: 100.3400, tags: { name: 'KFC Test Two', brand: 'KFC', opening_hours: '24/7' } },
  { type: 'node', lat: 5.4250, lon: 100.3200, tags: { name: '<b>x</b> KFC Markup', brand: 'KFC' } },
] };

export async function launch(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: opts.serviceWorkers || 'block', permissions: ['geolocation', 'camera'], geolocation: { latitude: 3.15, longitude: 101.71 } });
  if (opts.init) await ctx.addInitScript(opts.init);
  const seen = { overpass: [], external: [] };
  await ctx.route('**/*', async (r) => {
    const u = r.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u)) return r.continue();
    if (/maplibre-gl.*\.js$/.test(u)) return r.fulfill({ path: ML('maplibre-gl.js'), contentType: 'application/javascript' });
    if (/maplibre-gl.*\.css$/.test(u)) return r.fulfill({ path: ML('maplibre-gl.css'), contentType: 'text/css' });
    if (u.includes('overpass-api.de')) { seen.overpass.push(decodeURIComponent(r.request().postData() || '')); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(opts.overpass || OVERPASS) }); }
    seen.external.push(u); return r.abort();
  });
  return { browser, ctx, seen, async page() { const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e).slice(0, 200))); return p; }, close: () => browser.close() };
}

export async function openApp(page, base, ready = 4000) {
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__arahMap, null, { timeout: 30000 });
  await page.waitForTimeout(ready > 1500 ? 1500 : ready);
}
