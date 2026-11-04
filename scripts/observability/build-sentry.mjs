// Reproducible build of the vendored Sentry bundle. Run: npm run observe:build
// Output is committed so the site never loads code from a CDN; its SHA-384 is pinned into arah-observe.js (SRI)
// and `npm run check` fails if the two ever disagree.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const OUT = 'assets/observability/vendor/sentry.min.js';
await build({ entryPoints: ['assets/observability/sentry-entry.mjs'], bundle: true, minify: true, format: 'iife', target: ['es2019'], outfile: OUT, legalComments: 'none', define: { __SENTRY_DEBUG__: 'false', __DEBUG_BUILD__: 'false', 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
const buf = readFileSync(OUT);
const sri = 'sha384-' + createHash('sha384').update(buf).digest('base64');
const ver = JSON.parse(readFileSync('node_modules/@sentry/browser/package.json', 'utf8')).version;
const f = 'assets/observability/arah-observe.js';
let s = readFileSync(f, 'utf8');
s = s.replace(/var SENTRY_SRI = '[^']*';/, `var SENTRY_SRI = '${sri}';`);
writeFileSync(f, s);
writeFileSync('assets/observability/vendor/SENTRY.md', `# Vendored Sentry browser bundle\n\n- Package: @sentry/browser ${ver} (MIT), built with esbuild into one IIFE\n- File: sentry.min.js, ${buf.length} bytes\n- SRI: ${sri}\n- Rebuild: \`npm ci && npm run observe:build\` (pinned versions in package-lock.json)\n- Included: global error handlers, browser API error wrapping, linked errors, dedupe. Not included: tracing, replay, feedback, breadcrumbs.\n- Every event passes through assets/observability/scrub.mjs before it is sent.\n`);
console.log(`sentry.min.js ${(buf.length / 1024).toFixed(1)} KB ${sri}`);
