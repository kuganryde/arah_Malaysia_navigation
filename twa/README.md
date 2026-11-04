# ARAH for Android (Trusted Web Activity)

The Android app is a thin shell that opens the live PWA full-screen (no browser bar). The web app is the product: every web release reaches Android users without a store update. Only changes to this folder, the icons or the package metadata need a new Play release.

- App id `com.rydetech.arah`, origin `https://arah.rydetechglobal.com` (set in `twa-manifest.json`)
- Built by Google's Bubblewrap CLI (pinned in `.github/workflows/android.yml`), signed with **your** upload key
- `.well-known/assetlinks.json` proves to Android that the site and the app belong together; without it the app shows a browser bar

## Go-live checklist (in order)

1. **Point the domain.** In your DNS add `arah` CNAME `cname.vercel-dns.com`, then in Vercel > Project > Domains add `arah.rydetechglobal.com`. Wait for the certificate. Check `https://arah.rydetechglobal.com/manifest.webmanifest` loads.
2. **Merge this PR** so `/.well-known/assetlinks.json` is served (it is `[]` until step 5).
3. **Create the upload key** on your own machine (keep it and its passwords somewhere safe; losing it blocks updates):
   `keytool -genkeypair -v -keystore android.keystore -alias arah -keyalg RSA -keysize 2048 -validity 10000`
4. **Add GitHub secrets** (repo > Settings > Secrets and variables > Actions): `ANDROID_KEYSTORE_B64` (`base64 -w0 android.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`. Then run **Actions > Android (Play bundle) > Run workflow**. Download `arah-android-bundle` (`app-release-bundle.aab`); the log prints the upload key's SHA-256.
5. **Play Console:** create the app, upload the `.aab` to an internal/closed test track, accept **Play App Signing**, then copy the *App signing key* SHA-256 (Setup > App signing).
6. **Link app and site:** `node scripts/twa/assetlinks.mjs <UPLOAD_SHA256> <PLAY_SIGNING_SHA256>`, commit, merge, deploy. Verify: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://arah.rydetechglobal.com&relation=delegate_permission/common.handle_all_urls`.
7. Fill the store listing (`store/listing.md`), Data safety (`store/data-safety.md`), content rating and the privacy policy URL, then run the test track. New personal developer accounts must run a closed test (12 testers, 14 days) before production; an organisation account does not.

## Releasing an update
`npm run version:release -- minor` then `node scripts/twa/sync-version.mjs` (versionName = release, versionCode = MAJOR*10000+MINOR*100+PATCH) and run the workflow again. Needed only when this folder changes; web-only releases need nothing here.

## Notes
- Location uses Android's permission through Chrome (`locationDelegation`). Camera (AR) is asked by the page as in the browser.
- The 3D vehicle and map need WebGL; Chrome on every supported Android (6.0+) has it.
- The workflow has not been run from this repository yet; the first run may need a small tweak (Bubblewrap/SDK prompts).
