// Writes .well-known/assetlinks.json (Digital Asset Links) for the Android app.
// Usage: node scripts/twa/assetlinks.mjs <SHA-256 fingerprint> [more fingerprints...]
// Give BOTH the upload key and the Play App Signing key (Play Console > Setup > App signing); Android checks the key that signed the installed app.
import { readFileSync, writeFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('twa/twa-manifest.json', 'utf8')).packageId;
const fps = process.argv.slice(2).map((s) => s.trim().toUpperCase());
const FP = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
if (!fps.length || fps.some((f) => !FP.test(f))) { console.error('usage: node scripts/twa/assetlinks.mjs AA:BB:..:FF [more]   (SHA-256, 32 colon-separated bytes)'); process.exit(1); }
const out = [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fps } }];
writeFileSync('.well-known/assetlinks.json', JSON.stringify(out, null, 2) + '\n');
console.log(`.well-known/assetlinks.json written for ${pkg} with ${fps.length} fingerprint(s)`);
