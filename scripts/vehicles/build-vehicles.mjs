// Reproducible build of the vendored 3D bundle (three.js + the vehicle shapes). Run: npm run vehicles:build
// Output is committed so the site never loads code from a CDN; its SHA-384 is pinned into arah-vehicles.js (SRI)
// and `npm run check` fails if the two ever disagree.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const OUT = 'assets/vehicles/vendor/vehicles3d.min.js';
await build({ entryPoints: ['assets/vehicles/vehicles-3d.mjs'], bundle: true, minify: true, format: 'iife', target: ['es2019'], outfile: OUT, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
const buf = readFileSync(OUT);
const sri = 'sha384-' + createHash('sha384').update(buf).digest('base64');
const ver = JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')).version;
const f = 'assets/vehicles/arah-vehicles.js';
try { let s = readFileSync(f, 'utf8'); s = s.replace(/var VEH_SRI = '[^']*';/, `var VEH_SRI = '${sri}';`); writeFileSync(f, s); } catch (e) { /* loader not written yet */ }
writeFileSync('assets/vehicles/vendor/THREE.md', `# Vendored 3D bundle\n\n- Packages: three ${ver} (MIT) + assets/vehicles/vehicles-3d.mjs, built with esbuild into one IIFE\n- File: vehicles3d.min.js, ${buf.length} bytes\n- SRI: ${sri}\n- Rebuild: \`npm ci && npm run vehicles:build\` (pinned versions in package-lock.json)\n- Loaded only when a trip starts.\n`);
console.log(`vehicles3d.min.js ${(buf.length / 1024).toFixed(1)} KB ${sri}`);
