import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { codeFor } from '../scripts/twa/sync-version.mjs';

test('versionCode always increases with the release number', () => {
  assert.equal(codeFor('0.16.0'), 1600); assert.equal(codeFor('1.0.0'), 10000);
  const rels = ['0.9.9', '0.10.0', '0.16.0', '0.16.1', '1.0.0'].map(codeFor);
  assert.deepEqual([...rels].sort((a, b) => a - b), rels);
});
test('assetlinks generator refuses a malformed fingerprint and writes nothing', () => {
  const before = readFileSync('.well-known/assetlinks.json', 'utf8');
  for (const bad of [[], ['abc'], ['AA:BB'], ['GG:' + Array(31).fill('00').join(':')]]) {
    const r = spawnSync(process.execPath, ['scripts/twa/assetlinks.mjs', ...bad], { encoding: 'utf8' });
    assert.equal(r.status, 1, JSON.stringify(bad));
  }
  assert.equal(readFileSync('.well-known/assetlinks.json', 'utf8'), before);
});
test('twa manifest binds the bare production host and an Android-valid package id', () => {
  const t = JSON.parse(readFileSync('twa/twa-manifest.json', 'utf8'));
  assert.equal(t.host, 'arah.rydetechglobal.com'); assert.equal(t.packageId, 'com.rydetech.arah');
  assert.equal(t.enableNotifications, false); assert.equal(t.fallbackType, 'customtabs');
  assert.ok(!JSON.stringify(t).includes('password'), 'no secrets in the manifest');
});
test('Vercel serves assetlinks as JSON with no redirect headers', () => {
  const v = JSON.parse(readFileSync('vercel.json', 'utf8')), h = v.headers.find((x) => x.source === '/.well-known/assetlinks.json');
  assert.ok(h); assert.equal(h.headers.find((x) => x.key === 'Content-Type').value, 'application/json');
});
