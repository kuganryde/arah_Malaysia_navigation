// Reproducible build of the vendored landmarks 3D bundle (three.js + the models). Run: npm run landmarks:build
// Output is committed so the site never loads code from a CDN; its SHA-384 is pinned into arah-landmarks.js (SRI)
// and `npm run check` fails if the two ever disagree.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const OUT = 'assets/landmarks/vendor/landmarks3d.min.js';
await build({ entryPoints: ['assets/landmarks/landmarks-3d.mjs'], bundle: true, minify: true, format: 'iife', target: ['es2019'], outfile: OUT, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
const buf = readFileSync(OUT);
const sri = 'sha384-' + createHash('sha384').update(buf).digest('base64');
const ver = JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')).version;
const f = 'assets/landmarks/arah-landmarks.js';
let s = readFileSync(f, 'utf8'); s = s.replace(/var LM_SRI = '[^']*';/, `var LM_SRI = '${sri}';`); writeFileSync(f, s);
writeFileSync('assets/landmarks/vendor/THREE.md', `# Vendored 3D bundle\n\n- Packages: three ${ver} (MIT) + assets/landmarks/*.mjs (original models and procedural textures), built with esbuild into one IIFE\n- File: landmarks3d.min.js, ${buf.length} bytes\n- SRI: ${sri}\n- Rebuild: \`npm ci && npm run landmarks:build\` (pinned versions in package-lock.json)\n- Loaded only when the map first looks at a landmark.\n`);
console.log(`landmarks3d.min.js ${(buf.length / 1024).toFixed(1)} KB ${sri}`);
