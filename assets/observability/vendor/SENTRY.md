# Vendored Sentry browser bundle

- Package: @sentry/browser 11.10.0 (MIT), built with esbuild into one IIFE
- File: sentry.min.js, 93310 bytes
- SRI: sha384-PvHHB5zoMzazwRBH4991IED+fpWUQDHFh6RUSKQLkYJdYbfoTRZim7l5tzqTkrnq
- Rebuild: `npm ci && npm run observe:build` (pinned versions in package-lock.json)
- Included: global error handlers, browser API error wrapping, linked errors, dedupe. Not included: tracing, replay, feedback, breadcrumbs.
- Every event passes through assets/observability/scrub.mjs before it is sent.
