// Font diet for the bundled index.html. Run: npm run perf:fonts  (needs: pip install fonttools brotli)
//  1. Drops the non-Latin subsets (Greek, Cyrillic, Vietnamese, Latin-extended) of the UI fonts: a Malaysian map never
//     shows them, and any such text falls back to the system font like it would for any other missing glyph.
//  2. Subsets the two Phosphor icon fonts to the icons the app really uses, and drops the CSS rules of the rest.
// Idempotent, with a byte-exact round-trip guard on both bundler blocks. `npm run check` fails if an icon is used
// in the code but missing from the trimmed font (so adding an icon later cannot silently render blank).
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FILE = 'index.html';
const encode = (v) => JSON.stringify(v).replace(/<\//g, '<\\u002F');
const MAN = /(<script type="__bundler\/manifest">)([\s\S]*?)(<\/script>)/;
const TPL = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;

// Every icon name the code can show: template markup, app scripts in the bundle, and our own layer scripts.
export function usedIcons({ template, manifest, repoFiles }) {
  const sources = [template.replace(/<style>[\s\S]*?<\/style>/g, '')];
  for (const e of Object.values(manifest)) {
    if (!/javascript/.test(e.mime)) continue;
    let b = Buffer.from(e.data, 'base64'); if (e.compressed) b = gunzipSync(b);
    if (b.length < 500000) sources.push(b.toString('utf8')); // MapLibre (1 MB) has no icon names
  }
  sources.push(...repoFiles);
  const used = new Set();
  for (const s of sources) for (const m of s.matchAll(/\bph-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) used.add(m[1]);
  used.delete('fill'); // the style modifier, not an icon
  return used;
}

if (process.argv[1].endsWith('trim-fonts.mjs')) {
  let s = readFileSync(FILE, 'utf8');
  const mm = s.match(MAN), tm = s.match(TPL);
  const man = JSON.parse(mm[2]); let t = JSON.parse(tm[2]);
  if (encode(man) !== mm[2].trim() || encode(t) !== tm[2].trim()) throw new Error('bundle blocks do not round-trip byte-identically; refusing to rewrite');
  const before = s.length;

  // 1. UI font subsets
  let dropped = 0;
  t = t.replace(/@font-face\s*\{[^}]*\}\s*/g, (blk) => {
    const fam = (blk.match(/font-family:\s*["']?([^;"']+)/) || [])[1] || '';
    if (/^Phosphor/.test(fam)) return blk;
    const range = (blk.match(/unicode-range:\s*([^;]+)/) || [])[1] || '';
    if (/U\+0000-00FF/.test(range)) return blk;            // the Latin subset stays
    const id = (blk.match(/url\(\s*["']?([0-9a-f-]{36})/) || [])[1];
    if (id) delete man[id];
    dropped++; return '';
  });

  // 2. icon fonts
  const repoFiles = execFileSync('git', ['ls-files', 'assets']).toString().split('\n').filter((f) => /\.(m?js)$/.test(f)).map((f) => readFileSync(f, 'utf8'));
  const used = usedIcons({ template: t, manifest: man, repoFiles });
  const rule = /\.(ph|ph-fill)\.ph-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-f]+)";\s*\}\s*/g;
  const cps = { ph: new Set(), 'ph-fill': new Set() }; let kept = 0, removed = 0;
  t = t.replace(rule, (all, style, name, cp) => {
    if (!used.has(name)) { removed++; return ''; }
    cps[style].add(cp); kept++; return all;
  });
  const dir = mkdtempSync(join(tmpdir(), 'arah-fonts-'));
  for (const [style, fam] of [['ph', 'Phosphor'], ['ph-fill', 'Phosphor-Fill']]) {
    const blk = t.match(new RegExp('@font-face\\s*\\{[^}]*font-family:\\s*"' + fam + '"[^}]*\\}'));
    const id = blk && (blk[0].match(/url\(\s*["']?([0-9a-f-]{36})/) || [])[1];
    if (!id || !man[id]) throw new Error('cannot find the ' + fam + ' font in the bundle');
    const inp = join(dir, style + '.in.woff2'), out = join(dir, style + '.out.woff2');
    writeFileSync(inp, Buffer.from(man[id].data, 'base64'));
    execFileSync('python3', ['-I', 'scripts/perf/subset_font.py', inp, out, [...cps[style]].join(',')], { stdio: 'inherit' });
    const buf = readFileSync(out);
    if (buf.length < Buffer.from(man[id].data, 'base64').length) { man[id] = { ...man[id], compressed: false, data: buf.toString('base64') }; }
  }
  s = s.replace(MAN, (_, a, _b, c) => a + encode(man) + c).replace(TPL, (_, a, _b, c) => a + encode(t) + c);
  writeFileSync(FILE, s);
  console.log(`dropped ${dropped} font faces; icons kept ${kept / 2 | 0} of ${(kept + removed) / 2 | 0}; index.html ${(before / 1024).toFixed(0)} KB -> ${(s.length / 1024).toFixed(0)} KB`);
}
