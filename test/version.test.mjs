import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpVersion, cmp, globToRegExp, moduleOf, checkChanges, markerErrors, loadManifest } from '../scripts/version.mjs';

const mods = (v = {}) => ({
  release: '0.2.0',
  modules: {
    a: { version: v.a || '1.0.0', paths: ['api/**'], markers: [] },
    b: { version: v.b || '0.1.0', paths: ['index.html', 'assets/b*.png'], markers: [] },
  },
});

test('bumpVersion and cmp follow SemVer', () => {
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
  assert.throws(() => bumpVersion('1.2', 'patch')); assert.throws(() => bumpVersion('1.2.3', 'huge'));
  assert.equal(cmp('1.10.0', '1.9.9'), 1); assert.equal(cmp('0.2.0', '0.2.0'), 0); assert.equal(cmp('0.1.9', '0.2.0'), -1);
});
test('globs: ** crosses folders, * does not, dots are literal', () => {
  assert.ok(globToRegExp('api/**').test('api/x/y.js')); assert.ok(globToRegExp('assets/b*.png').test('assets/b1.png'));
  assert.ok(!globToRegExp('assets/b*.png').test('assets/sub/b1.png')); assert.ok(!globToRegExp('index.html').test('indexXhtml'));
});
test('moduleOf maps files to owning modules and ignores others', () => {
  const m = mods().modules;
  assert.deepEqual(moduleOf('api/tts.js', m), ['a']); assert.deepEqual(moduleOf('index.html', m), ['b']); assert.deepEqual(moduleOf('LICENSE', m), []);
});
test('a changed module must be bumped, and the changelog updated', () => {
  const base = mods();
  assert.equal(checkChanges({ base, head: mods(), changed: ['LICENSE'], changelogChanged: false }).length, 0);
  let e = checkChanges({ base, head: mods(), changed: ['api/tts.js'], changelogChanged: true });
  assert.equal(e.length, 1); assert.match(e[0], /module "a" changed/);
  assert.deepEqual(checkChanges({ base, head: mods({ a: '1.0.1' }), changed: ['api/tts.js', 'versions.json', 'CHANGELOG.md'], changelogChanged: true }), []);
  e = checkChanges({ base, head: mods({ a: '1.0.1' }), changed: ['api/tts.js'], changelogChanged: false });
  assert.ok(e.some((x) => /CHANGELOG/.test(x)));
});
test('modules are independent: bumping one does not require the other', () => {
  const base = mods();
  assert.deepEqual(checkChanges({ base, head: mods({ b: '0.1.1' }), changed: ['index.html'], changelogChanged: true }), []);
});
test('rejects going backwards and bumps with no file change; new modules pass', () => {
  assert.ok(checkChanges({ base: mods(), head: mods({ a: '0.9.0' }), changed: ['api/x.js'], changelogChanged: true }).some((x) => /backwards/.test(x)));
  assert.ok(checkChanges({ base: mods(), head: mods({ b: '0.2.0' }), changed: [], changelogChanged: true }).some((x) => /none of its files changed/.test(x)));
  assert.deepEqual(checkChanges({ base: null, head: mods(), changed: ['api/x.js'], changelogChanged: false }), []);
});
test('markerErrors detects drift between files and the manifest, and package.json mismatch', () => {
  const m = { release: '0.2.0', modules: { a: { version: '1.0.0', paths: [], markers: [{ file: 'f.js', text: '// a v{v}' }] } } };
  const ok = (f) => (f === 'package.json' ? '{"version":"0.2.0"}' : '// a v1.0.0');
  assert.deepEqual(markerErrors(m, ok), []);
  assert.equal(markerErrors(m, (f) => (f === 'package.json' ? '{"version":"0.2.0"}' : '// a v0.9.0')).length, 1);
  assert.equal(markerErrors(m, (f) => (f === 'package.json' ? '{"version":"9.9.9"}' : '// a v1.0.0')).length, 1);
});
test('the real manifest is consistent with the files in this repo', () => {
  assert.deepEqual(markerErrors(loadManifest()), []);
});
