// Repo guard rails, run in CI and locally: node scripts/check.mjs
// 1) vercel.json parses and carries the security headers  2) page-weight budget  3) no committed secrets.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

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
const BUDGET_MB = Number(process.env.INDEX_BUDGET_MB || 1.3);
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
  const veh = readFileSync('assets/vehicles/vendor/vehicles3d.min.js');
  const vsri = 'sha384-' + createHash('sha384').update(veh).digest('base64');
  if (!readFileSync('assets/vehicles/arah-vehicles.js', 'utf8').includes(`var VEH_SRI = '${vsri}';`)) fail('arah-vehicles.js SRI does not match vendor/vehicles3d.min.js: run npm run vehicles:build');
  console.log('crash reporting ok (' + (dsn ? 'DSN set' : 'inactive: no DSN') + ', bundle ' + (bundle.length / 1024).toFixed(0) + ' KB)');
}

// 8b. Android (TWA): the package metadata agrees with the web manifest and the product release, asset links are well-formed,
//     and no signing material is tracked.
{
  const { codeFor } = await import('./twa/sync-version.mjs');
  const t = JSON.parse(readFileSync('twa/twa-manifest.json', 'utf8')), w = JSON.parse(readFileSync('manifest.webmanifest', 'utf8')), rel = JSON.parse(readFileSync('versions.json', 'utf8')).release;
  if (t.appVersionName !== rel || t.appVersionCode !== codeFor(rel)) fail(`twa-manifest version (${t.appVersionName}/${t.appVersionCode}) differs from release ${rel}/${codeFor(rel)}: run node scripts/twa/sync-version.mjs`);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(t.packageId)) fail('twa packageId is not a valid Android package name');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(t.host) || /^https?:/.test(t.host)) fail('twa host must be a bare domain');
  for (const k of ['iconUrl', 'maskableIconUrl', 'webManifestUrl', 'fullScopeUrl']) if (!t[k].startsWith('https://' + t.host + '/')) fail(`twa ${k} must be on https://${t.host}/`);
  if (t.themeColor.toLowerCase() !== w.theme_color.toLowerCase() || t.backgroundColor.toLowerCase() !== w.background_color.toLowerCase()) fail('twa colours differ from manifest.webmanifest');
  if (!w.icons.some((i) => i.purpose === 'maskable' && /512/.test(i.sizes))) fail('manifest needs a 512 px maskable icon for Android');
  const al = JSON.parse(readFileSync('.well-known/assetlinks.json', 'utf8'));
  if (!Array.isArray(al)) fail('assetlinks.json must be an array');
  for (const e of al) { const fp = e.target && e.target.sha256_cert_fingerprints; if (e.target?.package_name !== t.packageId || !Array.isArray(fp) || !fp.length || fp.some((f) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))) fail('assetlinks.json entry does not match the package id / SHA-256 fingerprint format'); }
  const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter((f) => /\.(keystore|jks|aab|apk)$/.test(f));
  if (tracked.length) fail('signing material or build output is tracked by git: ' + tracked.join(', '));
  console.log(`android ok (${t.packageId} on ${t.host}, v${t.appVersionName}/${t.appVersionCode}, ${al.length ? 'asset links set' : 'asset links pending signing key'})`);
}

// 7. Performance and accessibility budgets for the layers that load on every visit.
//    Eager layer scripts (gzip) stay under 40 KB together; the page declares its language for screen readers.
{
  const { gzipSync } = await import('node:zlib');
  const EAGER = ['assets/arah-enhancements.js', 'assets/arah-pwa.js', 'assets/places/arah-places.js', 'assets/festive/arah-festive.js', 'assets/keepawake/arah-keepawake.js', 'assets/resilience/arah-resilience.js', 'assets/observability/arah-observe.js', 'assets/vehicles/arah-vehicles.js', 'assets/a11y/arah-a11y.js'];
  const gz = EAGER.reduce((n, f) => n + gzipSync(readFileSync(f)).length, 0);
  const BUDGET_KB = 40;
  if (gz > BUDGET_KB * 1024) fail(`eager layer scripts are ${(gz / 1024).toFixed(1)} KB gzip, over the ${BUDGET_KB} KB budget: lazy-load something`);
  const html = indexBuf.toString('utf8');
  if (!/<html lang=(\\?")ms\1>/.test(html)) fail('index.html <html> needs lang="ms" (run node scripts/pwa/inject-head.mjs)');
  console.log(`budgets ok (eager layers ${(gz / 1024).toFixed(1)} KB gzip of ${BUDGET_KB}, lang set)`);
}

// 8. Font diet guards: only Latin UI fonts and the icon fonts are bundled, and every icon the code uses is in the trimmed font.
{
  const { usedIcons } = await import('./perf/trim-fonts.mjs');
  const { execFileSync } = await import('node:child_process');
  const html = indexBuf.toString('utf8');
  const man = JSON.parse(html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
  const tpl = JSON.parse(html.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1].replace(/<\\u002F/g, '</'));
  const fontKB = Object.values(man).filter((e) => /font/.test(e.mime)).reduce((n, e) => n + Buffer.from(e.data, 'base64').length, 0) / 1024;
  if (fontKB > 600) fail(`bundled fonts are ${fontKB.toFixed(0)} KB (budget 600 KB): run npm run perf:fonts`);
  const faces = [...tpl.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]).filter((b) => !/font-family:\s*"?Phosphor/.test(b) && !/U\+0000-00FF/.test(b));
  if (faces.length) fail(`${faces.length} non-Latin font face(s) are bundled: run npm run perf:fonts`);
  const repo = execFileSync('git', ['ls-files', 'assets']).toString().split('\n').filter((f) => /\.(m?js)$/.test(f)).map((f) => readFileSync(f, 'utf8'));
  const used = usedIcons({ template: tpl, manifest: man, repoFiles: repo });
  const have = new Set([...tpl.matchAll(/\.ph\.ph-([a-z0-9-]+):before/g)].map((m) => m[1]));
  const missing = [...used].filter((n) => !have.has(n));
  if (missing.length) fail(`icon(s) used in the code but missing from the trimmed icon font: ${missing.join(', ')} (run npm run perf:fonts after adding them)`);
  console.log(`fonts ok (${fontKB.toFixed(0)} KB, ${used.size} icons)`);
}

if (errors.length) { console.error(errors.map((e) => 'FAIL ' + e).join('\n')); process.exit(1); }
console.log('check ok');
