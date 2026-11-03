# Changelog

All notable changes to ARAH · Navigasi Malaysia. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/). Changes are additive and leave the app's existing behaviour unchanged unless stated.

## [0.2.0] - 2026-11-03

### Security
- `/api/tts`: origin check, per-IP rate limit (default 30 per minute, optional shared Upstash store), strict input validation with an allow-listed `lang` (closes a prompt-injection path), 15 s upstream timeout, generic error responses (no upstream detail leaked), privacy-safe structured logs.
- Security headers in `vercel.json`: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, tighter `Permissions-Policy` (geolocation still allowed for this origin), and a Content-Security-Policy in report-only mode.
- `SECURITY.md` with reporting contact and the steps to enforce the CSP.

### Added
- In-memory audio cache and `Cache-Control: private, max-age=86400` for repeated voice phrases (lower cost and latency).
- Screen wake lock while navigating, accessible names for icon-only buttons, and reduced-motion support, delivered as a separate `assets/arah-enhancements.js` that does not change the app bundle's logic.
- `privacy.html`, a plain-language privacy notice (served at `/privacy`).
- Tests (`npm test`) for the voice endpoint and its helpers; guard-rail script (`npm run check`) for security headers, page-weight budget and committed secrets.
- GitHub Actions: CI, CodeQL, and Dependabot for pinned actions.
- `package.json` (version 0.2.0, scripts only, no dependencies).

### Performance
- Page weight cut from 7.67 MB to 2.21 MB: the Phosphor icon font now ships as WOFF2 only (the WOFF, TTF and SVG duplicates were never used by current browsers) and the embedded Rydetech logo is a 256 px WebP instead of a 1024 px PNG. Rendering is pixel-identical in the first-screen check; `INDEX_BUDGET_MB` in `scripts/check.mjs` now guards against regressions.

### Changed
- Voice responses are now privately cacheable instead of `no-store`.
- Default voice-rate limit applies per IP; errors return `{ "error": "voice unavailable" }` instead of upstream details.

## [0.1.0] - Baseline
- Beta release as found in the repository before this changelog: 3D low-poly map, four map looks, routing with toll estimates, voice in BM, English, 中文 and தமிழ், nearby search, community reports, offline tiles and saved route.
