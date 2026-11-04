// Entry for the vendored Sentry bundle (assets/observability/vendor/sentry.min.js). Built by
// scripts/observability/build-sentry.mjs. Only the pieces below are included: no tracing, replay, feedback widget,
// console/fetch/DOM breadcrumbs. Breadcrumbs are off because fetch URLs would carry coordinates and search text.
import { init, globalHandlersIntegration, dedupeIntegration, linkedErrorsIntegration, browserApiErrorsIntegration, captureException, captureMessage, close, flush } from '@sentry/browser';
import { scrubEvent, makeBudget } from './scrub.mjs';

window.__arahSentryLib = {
  start(o) {
    const allow = makeBudget(10);
    init({
      dsn: o.dsn, release: o.release, environment: o.environment,
      sendDefaultPii: false,          // no IP address, cookies or user data
      defaultIntegrations: false,     // opt in to exactly four integrations below
      integrations: [globalHandlersIntegration(), browserApiErrorsIntegration(), linkedErrorsIntegration(), dedupeIntegration()],
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      autoSessionTracking: false,
      attachStacktrace: true,
      beforeSend: (event) => { const clean = scrubEvent(event); return clean && allow(clean) ? clean : null; },
      beforeBreadcrumb: () => null,
    });
  },
  captureException, captureMessage, close, flush,
};
