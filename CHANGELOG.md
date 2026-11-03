# Changelog

Every module has its own version (see `versions.json` and `VERSIONING.md`). Each entry names the module and the version it reached. The product release number groups them. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

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
