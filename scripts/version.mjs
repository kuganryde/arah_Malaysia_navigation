// Per-module versioning. Each module in versions.json has its own SemVer and the files it owns.
//   node scripts/version.mjs status
//   node scripts/version.mjs bump <module> <patch|minor|major> "<what changed>"
//   node scripts/version.mjs release <patch|minor|major>        (cuts the product release, moves [Unreleased])
//   node scripts/version.mjs check [baseRef]                    (CI: changed modules must be bumped)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const parse = (v) => { const m = SEMVER.exec(v); if (!m) throw new Error(`invalid version "${v}"`); return [+m[1], +m[2], +m[3]]; };
export const cmp = (a, b) => { const x = parse(a), y = parse(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };
export function bumpVersion(v, level) {
  const [M, m, p] = parse(v);
  if (level === 'major') return `${M + 1}.0.0`;
  if (level === 'minor') return `${M}.${m + 1}.0`;
  if (level === 'patch') return `${M}.${m}.${p + 1}`;
  throw new Error(`level must be patch, minor or major (got "${level}")`);
}

/** Glob: ** crosses folders, * stays inside one. Everything else is literal. */
export const globToRegExp = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
export const moduleOf = (file, modules) => Object.keys(modules).filter((k) => modules[k].paths.some((p) => globToRegExp(p).test(file)));

/** Pure check used by CI and tests. */
export function checkChanges({ base, head, changed, changelogChanged }) {
  const errors = [];
  const touched = new Set();
  for (const f of changed) for (const m of moduleOf(f, head.modules)) touched.add(m);
  for (const m of touched) {
    const b = base?.modules?.[m];
    if (!b) continue; // new module: nothing to compare with
    if (cmp(head.modules[m].version, b.version) <= 0) {
      const files = changed.filter((f) => moduleOf(f, head.modules).includes(m));
      errors.push(`module "${m}" changed (${files.slice(0, 3).join(', ')}${files.length > 3 ? ', ...' : ''}) but its version is still ${b.version}. Run: npm run version:bump -- ${m} patch "what changed"`);
    }
  }
  for (const [m, cur] of Object.entries(head.modules)) {
    const b = base?.modules?.[m];
    if (b && cmp(cur.version, b.version) < 0) errors.push(`module "${m}" went backwards: ${b.version} to ${cur.version}`);
    if (b && cmp(cur.version, b.version) > 0 && !touched.has(m)) errors.push(`module "${m}" is bumped to ${cur.version} but none of its files changed`);
  }
  const bumped = Object.keys(head.modules).some((m) => base?.modules?.[m] && cmp(head.modules[m].version, base.modules[m].version) > 0);
  if (base && (touched.size || bumped) && !changelogChanged) errors.push('CHANGELOG.md must be updated when a module changes');
  return errors;
}

const read = (f) => readFileSync(f, 'utf8');
export const loadManifest = () => JSON.parse(read('versions.json'));
const saveManifest = (m) => writeFileSync('versions.json', JSON.stringify(m, null, 2) + '\n');
const marker = (t, v) => t.replace('{v}', v);

/** In-file markers must match the manifest, so a running file can say which version it is. */
export function markerErrors(manifest, readFile = read) {
  const errs = [];
  for (const [name, mod] of Object.entries(manifest.modules)) {
    for (const mk of mod.markers || []) {
      let txt = ''; try { txt = readFile(mk.file); } catch { errs.push(`${name}: marker file ${mk.file} is missing`); continue; }
      if (!txt.includes(marker(mk.text, mod.version))) errs.push(`${name}: ${mk.file} does not contain "${marker(mk.text, mod.version)}" (version drift)`);
    }
  }
  const pkg = JSON.parse(readFile('package.json'));
  if (pkg.version !== manifest.release) errs.push(`package.json version ${pkg.version} does not match release ${manifest.release}`);
  return errs;
}

function bump(name, level, note) {
  if (!note || !note.trim()) throw new Error('a short note describing the change is required');
  const m = loadManifest(); const mod = m.modules[name];
  if (!mod) throw new Error(`unknown module "${name}". Modules: ${Object.keys(m.modules).join(', ')}`);
  const from = mod.version, to = bumpVersion(from, level);
  for (const mk of mod.markers || []) writeFileSync(mk.file, read(mk.file).replace(marker(mk.text, from), marker(mk.text, to)));
  mod.version = to; saveManifest(m);
  let log = read('CHANGELOG.md');
  const line = `- **${name} ${to}**: ${note.trim()}\n`;
  if (!/^## \[Unreleased\]/m.test(log)) log = log.replace(/^(## \[)/m, '## [Unreleased]\n\n$1');
  log = log.replace(/^## \[Unreleased\]\n\n?/m, (h) => h.replace(/\n*$/, '\n\n') + line);
  writeFileSync('CHANGELOG.md', log);
  console.log(`${name}: ${from} -> ${to}`);
}

function release(level) {
  const m = loadManifest(); const from = m.release, to = bumpVersion(from, level);
  m.release = to; saveManifest(m);
  const pkg = JSON.parse(read('package.json')); pkg.version = to; writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  let log = read('CHANGELOG.md');
  if (!/^## \[Unreleased\]/m.test(log)) throw new Error('nothing under [Unreleased] to release');
  const date = new Date().toISOString().slice(0, 10);
  log = log.replace(/^## \[Unreleased\]/m, `## [Unreleased]\n\n## [${to}] - ${date}`);
  writeFileSync('CHANGELOG.md', log);
  console.log(`release: ${from} -> ${to}`);
}

function status() {
  const m = loadManifest();
  console.log(`release ${m.release}`);
  for (const [k, v] of Object.entries(m.modules)) console.log(`  ${k.padEnd(18)} ${v.version.padEnd(8)} ${v.description}`);
}

function check(baseRef) {
  const head = loadManifest();
  const errors = markerErrors(head);
  if (baseRef) {
    let base = null;
    try { base = JSON.parse(execFileSync('git', ['show', `${baseRef}:versions.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch { /* manifest introduced in this change */ }
    const changed = execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
    errors.push(...checkChanges({ base, head, changed, changelogChanged: changed.includes('CHANGELOG.md') }));
  }
  if (errors.length) { console.error(errors.map((e) => 'FAIL ' + e).join('\n')); process.exit(1); }
  console.log('versions ok');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...a] = process.argv.slice(2);
  try {
    if (cmd === 'status') status();
    else if (cmd === 'bump') bump(a[0], a[1], a.slice(2).join(' '));
    else if (cmd === 'release') release(a[0]);
    else if (cmd === 'check') check(a[0]);
    else { console.log('usage: status | bump <module> <patch|minor|major> "<note>" | release <level> | check [baseRef]'); process.exit(cmd ? 1 : 0); }
  } catch (e) { console.error('error: ' + e.message); process.exit(1); }
}
