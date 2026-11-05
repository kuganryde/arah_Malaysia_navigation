# Changelog

Every module has its own version (see `versions.json` and `VERSIONING.md`). Each entry names the module and the version it reached. The product release number groups them. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

- **pwa 0.1.29**: release stamp 0.23.0
- **twa 0.1.8**: version sync to release 0.23.0
## [0.23.0] - 2026-11-05

- **pwa 0.1.28**: drive engine cache refresh
- **docs 0.13.1**: README: trip stats
- **ci 0.20.1**: trip stats unit and E2E checks
- **drive 0.2.0**: trip stats card: distance, average speed while moving, time
- **drive 0.2.0**: trip stats card (distance, average speed while moving, time) between the speedometer and the mini map; GPS jumps ignored; on-device only

- **pwa 0.1.27**: release stamp 0.22.0
- **twa 0.1.7**: version sync to release 0.22.0
## [0.22.0] - 2026-11-05

- **pwa 0.1.26**: Skin v2 scripts precached
- **docs 0.13.0**: README: skin v2
- **ci 0.20.0**: Skin v2 E2E (chip row, circles, handle, classic switch)
- **app 0.4.4**: Skin v2 loader injected into the page head
- **keepawake 0.3.2**: hint positioned from the button's real position (the skin moves it into a row)
- **skin 0.1.0**: Skin v2: rounder look (pill search, circular map buttons, floating sheet with grab handle) and one chip row for the add-on buttons; `?skin=classic` to opt out
- **keepawake**: hint positioned from the button's real position

- **pwa 0.1.25**: release stamp 0.21.1
- **twa 0.1.6**: version sync to release 0.21.1
## [0.21.1] - 2026-11-05

- **places 0.2.1 / resilience 0.1.1**: Makan & Mall no longer feels slow or empty: staged search (near, then wide), two servers raced, 15-minute cache, faster brand query; Overpass first try 12 s instead of 20 s

- **docs 0.12.1**: README: Makan and Mall note
- **ci 0.19.1**: E2E: hung server, widening search and cache for Makan and Mall
- **resilience 0.1.1**: Overpass failover starts at the server the caller names (so two requests race), first try 12 s instead of 20 s
- **places 0.2.1**: search is staged (near then wide), two servers raced, answers cached 15 min, faster brand query (name and brand tags separately) so Makan and Mall no longer feels slow or empty
- **pwa 0.1.24**: release stamp 0.21.0
- **twa 0.1.5**: version sync to release 0.21.0
## [0.21.0] - 2026-11-05

- **pwa 0.1.23**: Easy mode script precached
- **docs 0.12.0**: README: easy mode
- **ci 0.19.0**: Easy mode E2E (sizes, persistence, toggle, no camera); eager budget 45 KB
- **app 0.4.3**: Easy mode script injected into the page head
- **drive 0.1.4**: no AR or camera while easy mode is on (also releases a running camera)
- **easy 0.1.0**: Easy mode (Mod Mudah) for older drivers: 30% larger text and targets, only essential controls, no decoration, motion or camera, big speedometer on trips; remembered, `?easy=1` link

- **pwa 0.1.22**: release stamp 0.20.1
- **twa 0.1.4**: version sync to release 0.20.1
## [0.20.1] - 2026-11-05

- **docs 0.11.4**: README: layout note
- **ci 0.18.1**: E2E: no overlapping floating controls on phones and tablets
- **drive 0.1.3**: turn card found by geometry as well as by style, so the HUD never sits on top of it
- **keepawake 0.3.1**: hint sits below its button so it no longer covers the Makan & Mall row on narrow phones
- **festive 0.2.2**: festive toast moved clear of the buttons and the keep-awake hint (it covered them on phones)
## [0.20.0] - 2026-11-05
- **landmarks 0.1.1**: re-assert the landmark layers after the app hides them when its style settles (fixes an intermittent invisible-landmarks race)
- **drive 0.1.2**: speedometer label settles on the final speed
- **drive 0.1.1**: speedometer label follows big speed changes at once
- **pwa 0.1.21**: release stamp 0.20.0
- **twa 0.1.3**: version sync to release 0.20.0
- **drive 0.1.0**: Drive view for trips: AR road view (opt-in camera, never recorded, virtual road fallback) with route ribbon, chevrons and floating turn marker; heading-up mini guided map; racing speedometer with Normal, Sports and Luxury modes (remembered)

- **pwa 0.1.20**: Drive view loader precached; its engine cached on first use
- **docs 0.11.3**: README: drive view
- **ci 0.18.0**: Drive view tests (maths, projection, themes) and an E2E for the trip HUD; eager budget 43 KB
- **app 0.4.2**: Drive view loader script injected into the page head
## [0.19.0] - 2026-11-04

- **twa 0.1.2**: version sync to release 0.19.0
- **pwa 0.1.19**: release stamp 0.19.0
- **docs 0.11.2**: README: textured 3D landmarks
- **ci 0.17.0**: Landmarks tests (sizes, winding, SRI, loader in step with models) and SRI guard
- **pwa 0.1.18**: Landmarks loader precached; its 3D bundle cached on first use
- **app 0.4.1**: Landmarks layer script injected into the page head
- **landmarks 0.1.0**: Textured low-poly 3D models of 12 iconic landmarks (original, built in code), night windows, lazy SRI-pinned three.js bundle; switches the landmark layers on, since the app shipped with `showLandmarks` false
## [0.18.0] - 2026-11-04

- **twa 0.1.1**: version sync to release 0.18.0
- **pwa 0.1.17**: release stamp 0.18.0
- **docs 0.11.1**: README: loading screen
- **ci 0.16.0**: loader unit + E2E tests, shell guard
- **app 0.4.0**: branded 3D loading screen in the page shell, carried over into the app until the map draws
- **loader 0.1.0**: branded 3D loading screen (neon road, KL skyline, turning 3D ARAH arrow, gradient wordmark); inline in the shell, carried over into the app, fades when the map draws; reduced-motion safe
## [0.17.0] - 2026-11-04

- **pwa 0.1.16**: release stamp 0.17.0
- **ci 0.15.0**: android guard (twa manifest vs web manifest and release, asset links format, no tracked keystores), twa unit tests, manual Android bundle workflow
- **security-headers 0.7.0**: serve /.well-known/assetlinks.json as JSON (Android app link verification)
- **twa 0.1.0**: Android (Trusted Web Activity) package for Google Play: Bubblewrap manifest for arah.rydetechglobal.com (com.rydetech.arah), asset-links generator, version sync, manual signed-bundle workflow, store listing (ms/en) and Data safety drafts
## [0.16.0] - 2026-11-04

- **pwa 0.1.15**: contrast fixes, a11y layer precached
- **docs 0.11.0**: README: accessibility section
- **app 0.3.2**: script tag for the a11y layer injected into the bundle head
- **ci 0.14.0**: axe WCAG 2.2 A/AA/AAA guard on the main screens, e2e timeout 5 min, overlap test, readable() unit test
- **a11y 0.1.0**: landmarks, 7:1 muted text, 44 px targets, right-hand column wraps instead of covering the bottom panel; exposes __arahLayout
- **keepawake 0.3.0**: button moves to a new column beside the stack when there is no room above the bottom panel
- **ar-vision 0.3.1**: muted text and pressed-button contrast to 7:1 (AAA)
- **observability 0.1.2**: consent button contrast to 7:1 (AAA)
- **festive 0.2.1**: muted text lifted to 7:1 (AAA)
- **places 0.2.0**: brand badges reach WCAG AAA text contrast (readable()), muted text lifted to 7:1, selected tab lighter violet
## [0.15.0] - 2026-11-04

- **app 0.3.1**: script tag for the vehicles layer injected into the bundle head
- **vehicles 0.1.0**: 3D vehicle (car, motorbike, lorry, bus) replaces the route arrow while navigating; tap to hop and change colour; wheels follow speed; lazy-loaded, integrity-pinned three.js; free models (Kenney CC0 car, built-in shapes)
- **pwa 0.1.14**: precache: vehicles layer (core) and 3D bundle + models (lazy)
- **docs 0.10.0**: README: 3D vehicles section, slimmer festive description
- **ci 0.13.0**: SRI guard for the vendored 3D bundle, vehicles layer in the eager budget, E2E for vehicles, festive slim-band unit test
- **festive 0.2.0**: decoration confined to a slim strip at the top (6 small items, 5 sparkles), smaller tap sparkle, no screen-wide icon/marker pulsing
## [0.14.0] - 2026-11-04

- **ci 0.12.1**: tests for the keep-awake button (unit + E2E)
- **pwa 0.1.13**: precache stamp refreshed (keep-awake button)
- **keepawake 0.2.0**: Keep-awake notice is now a small sun/moon toggle button in the right-hand map button column (no toast over the map buttons)
## [0.13.0] - 2026-11-04

- **docs 0.9.2**: README: font diet; VERSIONING: re-run order after regenerating the bundle
- **ci 0.12.0**: font guards (Latin-only, 600 KB budget, every used icon present), tighter page budget 1.3 MB, E2E glyph check; perf:fonts build step
- **pwa 0.1.12**: precache stamp refreshed (smaller index.html)
- **app 0.3.0**: font diet: non-Latin UI font subsets dropped and Phosphor icon fonts subset to the 65 icons in use (index.html 2.3 MB -> 1.1 MB, bundled fonts 1087 KB -> 272 KB); no visual change (pixel-compared)
## [0.12.0] - 2026-11-04

- **docs 0.9.1**: README: performance notes
- **ci 0.11.0**: budgets: eager layer scripts <= 40 KB gzip and page language; E2E: idle map stays idle with a theme on, label-in-name
- **app 0.2.7**: page declares lang=ms (screen reader voice selection)
- **pwa 0.1.11**: accessibility: install button name starts with its visible text; precache stamp refreshed
- **places 0.1.2**: accessibility: button name starts with its visible text (WCAG 2.5.3), decorative glyph hidden from screen readers
- **festive 0.1.1**: performance: an idle map no longer redraws ~30x/s (style-change feedback loop fixed, pulses only while a route is lit); glow animations moved to opacity (compositor); motion check cached; frame rate self-tunes on slow devices. Main-thread load with a theme on: ~1000 ms/s -> ~130 ms/s
## [0.11.1] - 2026-11-04

- **ci 0.10.1**: E2E: the no-DSN case forces an empty DSN now that the real one ships
- **pwa 0.1.10**: precache stamp refreshed (config.json changed)
- **observability 0.1.1**: DSN set for the arah-navigation Sentry project (public ingest key); reporting is live once a visitor opts in
## [0.11.0] - 2026-11-04

- **observability 0.1.0** (new): opt-in crash reports to Sentry. One-time consent card (never during a trip or AR); nothing is downloaded or sent before yes. Vendored, SRI-pinned SDK (global handlers only, no breadcrumbs/tracing/replay); events scrubbed on the device (no coordinates, searches, URLs' queries, cookies, IP), 10 per visit; failover events counted. Inactive until a DSN is set in assets/observability/config.json
- **docs 0.9.0**: README/SECURITY: opt-in Sentry crash reports and maintainer setup
- **ci 0.10.0**: observability tests (scrub, consent flow, hostile DSN) and E2E with the real vendored SDK; guard for SRI, release stamp and DSN shape
- **pwa 0.1.9**: precache covers crash-report loader, config and release stamp; Sentry bundle cached on first use
- **app 0.2.6**: head loads assets/observability/arah-observe.js
- **security-headers 0.6.0**: CSP connect-src allows *.ingest.sentry.io (crash reports, opt-in)
- **privacy 0.7.0**: crash reports section and Sentry row (opt-in only), with an on/off switch
## [0.10.0] - 2026-11-04

- **pwa 0.1.8**: no page reload on first install (only when an update takes over): fixes a flaky offline test and an interruption for new users
- **resilience 0.1.0** (new): timeouts and failover for the public map services. Overpass tries up to three servers, search falls back from Photon to OpenStreetMap Nominatim, routing gets a hard timeout (walking is retried once), a host that fails twice is skipped for a minute, and a short note says when a backup is used (never during a trip). `?nonet=1` switches it off
- **docs 0.8.0**: README: resilient when public services stumble; SECURITY: resilience layer
- **ci 0.9.0**: resilience tests (vm fake network: failover, timeout, breaker, abort, offline) and an E2E for Overpass/Photon failover
- **pwa 0.1.7**: precache covers the resilience layer
- **app 0.2.5**: head loads assets/resilience/arah-resilience.js
- **security-headers 0.5.1**: CSP connect-src allows the Overpass mirrors and Nominatim
- **privacy 0.6.0**: backup hosts listed: Overpass mirrors and Nominatim (used only when the main service fails)
## [0.9.0] - 2026-11-04

- **pwa 0.1.6**: precache stamp refreshed (privacy page changed)
- **privacy 0.5.0**: unpkg removed from the third-party list: nothing is fetched from it
- **ci 0.8.0**: supply-chain guard: no CDN in CSP, no Popup.setHTML callers (MapLibre advisory); E2E asserts no CDN requests and the bundled MapLibre line
- **security-headers 0.5.0**: CSP no longer allows unpkg (map library, React and icon fonts are bundled); duplicate worker-src removed
## [0.8.0] - 2026-11-03

- **ci 0.7.0**: browser E2E tests (Playwright, mocked network) as a parallel CI job; maplibre-gl pinned as a dev dependency for hermetic runs
- **pwa 0.1.5**: precache stamp refreshed for release 0.8.0
## [0.7.1] - 2026-11-03

- **ci 0.6.1**: keepawake test: remove a no-op string replacement (CodeQL)
## [0.7.0] - 2026-11-03
- **keepawake 0.1.0** (new): the screen stays on while ARAH is open and visible. Screen Wake Lock API where available (Android, desktop, Safari 16.4+ incl. installed app) with automatic re-request, silent looping video fallback for older iOS and refused locks, always on during a trip, remembered off switch

- **ci 0.6.0**: keep-awake tests (fake browser: lock, retry, release, video fallback, off switch)
- **docs 0.7.0**: README: screen stays awake
- **pwa 0.1.4**: precache covers the keep-awake module and its silent video
- **app 0.2.4**: head loads assets/keepawake/arah-keepawake.js
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
