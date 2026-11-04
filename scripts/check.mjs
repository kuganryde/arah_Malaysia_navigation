// Repo guard rails, run in CI and locally: node scripts/check.mjs
// 1) vercel.json parses and carries the security headers  2) page-weight budget  3) no committed secrets.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const errors = [];
const fail = (m) => errors.push(m);

// 1. Security headers must not be silently dropped.
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
const hdrs = Object.fromEntries((cfg.headers?.[0]?.headers || []).map((h) => [h.key.toLowerCase(), h.value]));
for (const k of ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy']) {
  if (!hdrs[k]) fail(`vercel.json is missing header ${k}`);
}
if (!hdrs['content-security-policy'] && !hdrs['content-security-policy-report-only']) fail('vercel.json has no Content-Security-Policy(-Report-Only)');
if (!/geolocation=\(self\)/.test(hdrs['permissions-policy'] || '')) fail('Permissions-Policy must keep geolocation=(self) (navigation needs it)');
if (!/camera=\(self\)/.test(hdrs['permissions-policy'] || '')) fail('Permissions-Policy must keep camera=(self) (AR driver assist needs it)');

// 1b. AR model integrity: the file, the hash pinned in the browser code and MODEL.md must all agree.
const modelSha = createHash('sha256').update(readFileSync('assets/ar/models/yolox_nano.onnx')).digest('hex');
const pinned = /sha256: '([0-9a-f]{64})'/.exec(readFileSync('assets/ar/arah-ar.js', 'utf8'))?.[1];
if (pinned !== modelSha) fail(`assets/ar/arah-ar.js pins model ${pinned} but the file is ${modelSha}`);
if (!readFileSync('assets/ar/models/MODEL.md', 'utf8').includes(modelSha)) fail('assets/ar/models/MODEL.md does not list the shipped model SHA-256');

// 2. Page weight budget: the app ships as one HTML file, so cap it. Lower BUDGET_MB as the bundle is slimmed.
const BUDGET_MB = Number(process.env.INDEX_BUDGET_MB || 2.5);
const indexBuf = readFileSync('index.html'); // read once; reused for the key scan below
const mb = indexBuf.length / 1048576;
if (mb > BUDGET_MB) fail(`index.html is ${mb.toFixed(2)} MB, over the ${BUDGET_MB} MB budget`);
console.log(`index.html ${mb.toFixed(2)} MB (budget ${BUDGET_MB} MB)`);

// 3. Obvious secret shapes in tracked text sources (skips the large bundle and binaries).
const PATTERNS = [/AIza[0-9A-Za-z_-]{35}/, /sk-[A-Za-z0-9]{32,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /gh[pousr]_[A-Za-z0-9]{36,}/, /AKIA[0-9A-Z]{16}/];
const SKIP = new Set(['node_modules', '.git', 'index.html']);
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  if (SKIP.has(e.name)) return [];
  const p = join(d, e.name);
  return e.isDirectory() ? walk(p) : [p];
});
for (const f of walk('.')) {
  if (!/\.(js|mjs|json|md|html|yml|yaml|svg|txt)$/.test(f)) continue;
  // Read once and size-check the buffer: no stat-then-read gap (CodeQL js/file-system-race).
  const buf = readFileSync(f);
  if (buf.length > 1_000_000) continue;
  const t = buf.toString('utf8');
  for (const re of PATTERNS) if (re.test(t)) fail(`possible secret in ${f} (${re})`);
}
// index.html: scan only for the API-key shape, cheaply.
if (/AIza[0-9A-Za-z_-]{35}/.test(indexBuf.toString('utf8'))) fail('possible Google API key inside index.html');

// 4. PWA: manifest valid, icons real, offline file list complete, generated precache fresh, tags present.
{
  const { build, render } = await import('./pwa/stamp.mjs');
  const mf = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color', 'icons']) if (!mf[k]) fail(`manifest.webmanifest missing ${k}`);
  if (mf.display !== 'standalone') fail('manifest display must be standalone');
  if (!String(mf.start_url).startsWith(mf.scope || '/')) fail('manifest start_url is outside its scope');
  const purposes = new Set();
  for (const ic of mf.icons || []) {
    const b = readFileSync(ic.src.replace(/^\//, ''));
    const [w, h] = ic.sizes.split('x').map(Number);
    if (b.readUInt32BE(16) !== w || b.readUInt32BE(20) !== h) fail(`icon ${ic.src} is not ${ic.sizes}`);
    purposes.add(ic.purpose || 'any');
  }
  for (const p of ['any', 'maskable']) if (!purposes.has(p)) fail(`manifest needs a ${p} icon`);
  if (!(mf.icons || []).some((i) => i.sizes === '512x512')) fail('manifest needs a 512x512 icon');
  try {
    if (readFileSync('sw-precache.js', 'utf8') !== render(build())) fail('sw-precache.js is stale: run npm run pwa:stamp');
  } catch (e) { fail('sw-precache.js unreadable: ' + e.message); }
  const html = indexBuf.toString('utf8');
  for (const needle of ['rel="manifest"', 'rel=\\"manifest\\"', 'assets/arah-pwa.js', 'assets/resilience/arah-resilience.js', 'assets/observability/arah-observe.js']) if (!html.includes(needle)) fail(`index.html is missing ${needle} (run node scripts/pwa/inject-head.mjs)`);
  console.log('pwa ok (' + mf.icons.length + ' icons)');
}

// 5. Supply chain: MapLibre, React and the icon fonts are bundled inside index.html, so no CDN host belongs in the CSP,
//    and the app must never call Popup.setHTML (the MapLibre sanitizer advisory GHSA-jrc7-96c5-q579 only affects setHTML;
//    the app uses setDOMContent with DOM nodes, so the vulnerable path stays unreachable until the bundled library is upgraded).
{
  const csp = hdrs['content-security-policy'] || hdrs['content-security-policy-report-only'] || '';
  if (/unpkg\.com|cdn\.jsdelivr|cdnjs/.test(csp)) fail('CSP must not allow a CDN host: the app is fully bundled');
  const { gunzipSync } = await import('node:zlib');
  const html = indexBuf.toString('utf8');
  const man = JSON.parse(html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
  let calls = 0;
  for (const e of Object.values(man)) {
    if (!/javascript/.test(e.mime)) continue;
    let b = Buffer.from(e.data, 'base64'); if (e.compressed) b = gunzipSync(b);
    const t = b.toString('utf8');
    if (/maplibre/i.test(t) && t.length > 500000) continue; // the library itself defines setHTML; we only police callers
    calls += (t.match(/\.setHTML\s*\(/g) || []).length;
  }
  calls += (html.match(/\.setHTML\s*\(/g) || []).length;
  for (const f of readdirSync('assets', { recursive: true })) if (/\.(m?js)$/.test(f)) calls += (readFileSync('assets/' + f, 'utf8').match(/\.setHTML\s*\(/g) || []).length;
  if (calls) fail(`Popup.setHTML is called ${calls}x: use setDOMContent with DOM nodes (MapLibre sanitizer advisory)`);
  console.log('supply chain ok (no CDN in CSP, no setHTML callers)');
}

// 6. Crash reporting: the vendored Sentry bundle matches the SRI pinned in the loader, release.json is fresh,
//    and the DSN (public by design) is either empty or a sentry.io ingest URL.
{
  const { build, renderRelease } = await import('./pwa/stamp.mjs');
  const bundle = readFileSync('assets/observability/vendor/sentry.min.js');
  const sri = 'sha384-' + createHash('sha384').update(bundle).digest('base64');
  if (!readFileSync('assets/observability/arah-observe.js', 'utf8').includes(`var SENTRY_SRI = '${sri}';`)) fail('arah-observe.js SRI does not match vendor/sentry.min.js: run npm run observe:build');
  if (readFileSync('assets/observability/release.json', 'utf8') !== renderRelease(build())) fail('assets/observability/release.json is stale: run npm run pwa:stamp');
  const dsn = JSON.parse(readFileSync('assets/observability/config.json', 'utf8')).dsn;
  if (dsn && !/^https:\/\/[0-9a-f]{32}@o\d+\.ingest(\.[a-z]{2})?\.sentry\.io\/\d+$/.test(dsn)) fail('assets/observability/config.json dsn is not a sentry.io ingest DSN');
  console.log('crash reporting ok (' + (dsn ? 'DSN set' : 'inactive: no DSN') + ', bundle ' + (bundle.length / 1024).toFixed(0) + ' KB)');
}

if (errors.length) { console.error(errors.map((e) => 'FAIL ' + e).join('\n')); process.exit(1); }
console.log('check ok');
