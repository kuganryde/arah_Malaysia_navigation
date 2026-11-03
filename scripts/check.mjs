// Repo guard rails, run in CI and locally: node scripts/check.mjs
// 1) vercel.json parses and carries the security headers  2) page-weight budget  3) no committed secrets.
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

// 2. Page weight budget: the app ships as one HTML file, so cap it. Lower BUDGET_MB as the bundle is slimmed.
const BUDGET_MB = Number(process.env.INDEX_BUDGET_MB || 2.5);
const mb = statSync('index.html').size / 1048576;
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
  if (!/\.(js|mjs|json|md|html|yml|yaml|svg|txt)$/.test(f) || statSync(f).size > 1_000_000) continue;
  const t = readFileSync(f, 'utf8');
  for (const re of PATTERNS) if (re.test(t)) fail(`possible secret in ${f} (${re})`);
}
// index.html: scan only for the API-key shape, cheaply.
if (/AIza[0-9A-Za-z_-]{35}/.test(readFileSync('index.html', 'utf8'))) fail('possible Google API key inside index.html');

if (errors.length) { console.error(errors.map((e) => 'FAIL ' + e).join('\n')); process.exit(1); }
console.log('check ok');
