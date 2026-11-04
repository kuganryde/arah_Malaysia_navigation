// Keeps the Android version in step with the product release: versionName = release, versionCode = MAJOR*10000 + MINOR*100 + PATCH
// (always increasing, which Google Play requires). Run after `npm run version:release`. `npm run check` fails if they drift.
import { readFileSync, writeFileSync } from 'node:fs';
export const codeFor = (rel) => { const [a, b, c] = rel.split('.').map(Number); return a * 10000 + b * 100 + c; };
if (process.argv[1] && process.argv[1].endsWith('sync-version.mjs')) {
  const rel = JSON.parse(readFileSync('versions.json', 'utf8')).release, f = 'twa/twa-manifest.json', m = JSON.parse(readFileSync(f, 'utf8'));
  m.appVersionName = rel; m.appVersionCode = codeFor(rel); writeFileSync(f, JSON.stringify(m, null, 2) + '\n');
  console.log(`twa: versionName ${rel}, versionCode ${m.appVersionCode}`);
}
