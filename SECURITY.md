# Security

ARAH is a beta, non-profit navigation app. It collects no personal data, has no accounts, and keeps location and reports on the device.

## Reporting a vulnerability

Email **rydetechwizsolutions@proton.me** with steps to reproduce. Please do not open a public issue for security problems. We aim to acknowledge reports within 3 working days.

## What is protected

- **`/api/tts`** (Gemini voice) checks the request origin, rate-limits per IP (`TTS_RATE_PER_MIN`, default 30), validates and caps input (600 characters, allow-listed languages), times out upstream calls after 15 s, caches audio, and logs only structured metadata, never the spoken text.
- **Headers** (`vercel.json`): HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy` (geolocation and camera for this origin only) and a Content-Security-Policy in **report-only** mode.
- **Secrets**: `GEMINI_API_KEY` lives only in Vercel's environment settings. `npm run check` fails the build on committed key shapes.
- **CI**: tests, guard rails and CodeQL run on every pull request; GitHub Actions are pinned to commit SHAs and updated by Dependabot.

- **AR driver assist** (`assets/ar/`): the camera is requested only after an explicit tap and a notice, runs only in a secure context, and is released when AR closes, the trip ends or the page is hidden for good. Frames never leave the device (the page makes no network request carrying image data). The detection model is fetched from this origin and its SHA-256 is verified in the browser before use, so a tampered or swapped model is refused. The AI runtime is vendored (`assets/ar/vendor/`, MIT) rather than loaded from a CDN. Alerts are assistive only.

## Hardening you can turn on

1. **Enforce the CSP.** Watch the browser console on a preview deploy for `Content-Security-Policy-Report-Only` violations while using every feature (map views, search, nearby, voice, offline). When it is quiet, rename the header to `Content-Security-Policy`. Then work toward removing `'unsafe-inline'` and `'unsafe-eval'` from `script-src`, which needs the single-file bundle replaced by a normal build.
2. **Shared rate limit.** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` so the limit holds across serverless instances. Without them the limit is per instance (best effort).
3. **Extra origins.** Set `ALLOWED_ORIGINS` (comma separated) if the app is served from a custom domain.
4. **Third-party assets are bundled, not fetched.** MapLibre 5.24.0, React 18.3.1 and the icon fonts are inlined in `index.html`, so the CSP allows no CDN host (`npm run check` and the E2E suite fail if one comes back). Known advisory: GHSA-jrc7-96c5-q579 (MapLibre `Popup.setHTML` sanitizer bypass, fixed only in 6.x, which is ESM-only and needs a re-bundle). The app never calls `setHTML` (a check fails if it does) and uses `setDOMContent` with DOM nodes, so the path is unreachable; upgrade to 6.x when the bundle is next regenerated.

## Installed app (PWA)

- The service worker handles only same-origin GET requests for a fixed, hash-stamped list of files (`sw-precache.js`, generated and checked in CI). It never handles cross-origin requests, `/api/*` or non-GET requests, and it deletes only caches named `arah-pwa-*`.
- `sw.js` and `sw-precache.js` are served `no-store`, so a fix reaches installed copies on the next visit. Updates are applied only when the user taps *Update* and never during a trip.
- CSP (report-only) adds `manifest-src 'self'` and `worker-src 'self' blob:`.
- AR refuses software-rendered WebGL (`nogpu`) so it cannot silently run on the CPU.

## Known limits

- Origin checks stop casual cross-site use but are not authentication; the rate limit and cache are the cost controls.
- Public routing, search and place services (OSRM demo, Photon, Overpass) have no SLA.
