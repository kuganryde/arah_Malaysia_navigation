# Changelog

Every module has its own version (see `versions.json` and `VERSIONING.md`). Each entry names the module and the version it reached. The product release number groups them. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.6.0] - 2026-11-03
- **festive 0.1.0** (new): festival themes for 15 Malaysian celebrations (CNY, Ramadan, Raya Aidilfitri/Aidiladha, Muharram, Maulidur Rasul, Deepavali, Thaipusam, Wesak, Kaamatan, Gawai, Merdeka, Malaysia Day, Mid-Autumn, Christmas). Auto by date or manual, palette tokens and glowing icons, lit route with travelling lights, pulsing sights, string-light bunting, floating lanterns/diyas/ketupat/lotus, tap fireworks, daily greeting. Calm during trips and AR, honours reduce-motion

- **ci 0.5.0**: festive tests (calendar, windows, shapes, scene); inject-head adds the festive script
- **docs 0.6.0**: README: festive themes
- **pwa 0.1.3**: precache covers the festive module
- **app 0.2.3**: head loads assets/festive/arah-festive.js
## [0.5.1] - 2026-11-03

- **ci 0.4.1**: places test: escapeRegex emits no backslash or quote
- **places 0.1.1**: queries contain no backslashes or quotes: regex specials become character classes (CodeQL incomplete-escaping)
## [0.5.0] - 2026-11-03
- **places 0.1.0** (new): Makan & Mall. Directory of 39 fast-food/cafe chains and 48 malls with logos loaded lazily from each brand's website (initials badge fallback, switch to turn off, no referrer), live outlets from OpenStreetMap around the map view, logo markers, route hand-off to the app's search; hidden during a trip

- **ci 0.4.0**: places tests (directory, query safety, parsing); inject-head adds places script and map handle
- **docs 0.5.0**: README: Makan & Mall directory
- **privacy 0.4.0**: Makan & Mall section: brand logos load from brand sites, what they can see, how to switch off
- **pwa 0.1.2**: precache list covers the places module
- **app 0.2.2**: exposes the map as window.__arahMap (read-only handle for the Makan & Mall layer); head loads assets/places/arah-places.js
## [0.4.2] - 2026-11-03

- **ci 0.3.1**: pwa test: service worker ignores foreign-origin messages
## [0.4.1] - 2026-11-03

- **pwa 0.1.1**: service worker checks the message origin before acting on SKIP_WAITING / GET_VERSION (CodeQL)
## [0.4.0] - 2026-11-03

- **pwa 0.1.0** (new): installable app. Web app manifest, maskable and Apple icons, 10 iOS splash screens, offline-first service worker (versioned precache, never touches map-tile cache, `/api` or cross-origin), Android install button, iOS Add to Home Screen guide, update notice that never reloads mid-trip, `?nosw=1` support switch
- **ci 0.3.0**: pwa tests (manifest, icons, service worker run in a sandbox), pwa:stamp and pwa:inject scripts, check.mjs validates manifest and precache freshness
- **docs 0.4.0**: README: install on iPhone and Android, offline behaviour, hardware-acceleration explanation; VERSIONING: npm run pwa:stamp
- **privacy 0.3.0**: offline copy section: what the service worker stores and how to clear it
- **security-headers 0.4.0**: service-worker and manifest headers (no-store sw.js, Service-Worker-Allowed), icon caching, CSP manifest-src and worker-src; SECURITY.md PWA section
- **app 0.2.1**: head: web app manifest, apple-touch-icon, 10 iOS startup images and the PWA script; dark loading shell
- **ar-vision 0.3.0**: hardware-acceleration guard: AR refuses software-rendered WebGL (SwiftShader, llvmpipe) with a clear message instead of running on the CPU
## [0.3.2] - 2026-11-03

- **docs 0.3.1**: README describes the single AR window
- **ar-vision 0.2.0**: one window: speed, gap, lane and alerts are drawn over the camera picture instead of a second data window
## [0.3.1] - 2026-11-03

- **ar-vision 0.1.1**: worker builds its script, engine and model URLs from its own location instead of trusting the init message (CodeQL)
## [0.3.0] - 2026-11-03

- **docs 0.3.0**: README: AR driver assist, privacy and repository notes
- **ci 0.2.0**: AR core tests, model-hash check, camera permission guard, scripts/ar/webgl_compat.py
- **privacy 0.2.0**: camera / AR driver assist section: on-device analysis, nothing uploaded or stored
- **security-headers 0.3.0**: Permissions-Policy allows the camera for this origin only (AR driver assist); SECURITY.md documents the AR model pinning and camera handling
- **enhancements 0.2.0**: loads the AR module's small UI script (assets/ar/arah-ar.js); nothing else changes
- **ar-vision 0.1.0** (new): AR driver assist. Camera view and data card while navigating, YOLOX-nano on WebGL (onnxruntime-web, in a Web Worker so the map stays smooth; main-thread fallback) finding vehicles, pedestrians, riders, animals, traffic lights and stop signs; monocular distance, following gap and time-to-collision; GPS speed; lane position, drift and lane-change events; alerts in BM, EN, 中文 and தமிழ். On-device only, opt-in with a safety notice, model SHA-256 pinned.

## [0.2.2] - 2026-11-03

- **ci 0.1.1**: check.mjs reads each file once (fixes CodeQL file-system-race alerts)
## [0.2.1] - 2026-11-03

- **docs 0.2.1**: README documents TTS_STYLE; accent claims removed
- **api-tts 0.2.1**: voice reads only the sentence: the style/language instruction is no longer sent to Gemini (it was sometimes spoken aloud); optional TTS_STYLE env restores a short tone hint
## [0.2.0] - 2026-11-03

- **api-tts 0.2.0** (from 0.1.0): origin check, per-IP rate limit (default 30 per minute, optional shared Upstash store), strict input validation with an allow-listed `lang` (closes a prompt-injection path), 15 s upstream timeout, generic error responses (no upstream detail leaked), privacy-safe structured logs, in-memory audio cache with `Cache-Control: private, max-age=86400` (was `no-store`).
- **security-headers 0.2.0** (from 0.1.0): HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, tighter `Permissions-Policy` (geolocation still allowed for this origin), Content-Security-Policy in report-only mode; added `SECURITY.md` with the steps to enforce it.
- **app 0.2.0** (from 0.1.0): loads the enhancements script; page weight cut from 7.67 MB to 2.21 MB (icon font as WOFF2 only, logo as a 256 px WebP), first-screen render unchanged. No change to routing, voice or map logic.
- **enhancements 0.1.0** (new): screen wake lock while a trip is active, accessible names for icon-only buttons, reduced-motion support. Reads the DOM only.
- **privacy 0.1.0** (new): plain-language privacy notice at `/privacy`, listing the third-party services the app contacts.
- **ci 0.1.0** (new): `npm test` (voice endpoint and versioning tests), `npm run check` (headers, page-weight budget, committed secrets), CI and CodeQL workflows with SHA-pinned actions, Dependabot, and the per-module version check.
- **docs 0.2.0** (from 0.1.0): animated README with banner, feature grid and divider; `VERSIONING.md`.

## [0.1.0] - Baseline
- Beta release as found in the repository before this changelog: 3D low-poly map, four map looks, routing with toll estimates, voice in BM, English, 中文 and தமிழ், nearby search, community reports, offline tiles and saved route. All modules start at 0.1.0.
