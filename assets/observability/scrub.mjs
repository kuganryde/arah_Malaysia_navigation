// Privacy filter applied to every Sentry event BEFORE it leaves the device. Pure functions, unit-tested.
// Principle: report what broke, never where the person is or what they searched for. Coordinates, search text,
// query strings and anything user-typed are removed; if in doubt a value is dropped, not sent.
const COORD = /-?\d{1,3}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/g;   // "3.1579,101.7116" in any message or URL
const LONE = /-?\d{1,3}\.\d{4,}/g;                                 // a lone high-precision number is a coordinate too
const MAX = 300;

export function scrubString(s) {
  if (typeof s !== 'string') return s;
  return s.replace(COORD, '[coords]').replace(LONE, '[num]').slice(0, MAX);
}
// Keep origin + path only: query strings carry search text and positions, hashes can carry app state.
export function scrubUrl(u) {
  if (typeof u !== 'string') return u;
  try { const x = new URL(u); return scrubString(x.origin + x.pathname); } catch { return '[url]'; }
}
// Errors that are noise or not ours: extension code, cross-origin "Script error.", browser layout loops.
export function isNoise(event) {
  const ex = event && event.exception && event.exception.values && event.exception.values[0];
  const msg = String((ex && ex.value) || (event && event.message) || '');
  if (/^Script error\.?$/i.test(msg)) return true;
  if (/ResizeObserver loop/i.test(msg)) return true;
  const frames = (ex && ex.stacktrace && ex.stacktrace.frames) || [];
  return frames.some((f) => /^(chrome|moz|safari-web)-extension:|^safari-extension:/i.test(f.filename || ''));
}

export function scrubEvent(event) {
  if (!event || isNoise(event)) return null;
  const e = event;
  delete e.user; delete e.server_name; delete e.breadcrumbs; delete e.extra; delete e.request_headers;
  if (e.request) e.request = { url: scrubUrl(e.request.url) }; // drops headers, cookies, query string, body
  if (typeof e.message === 'string') e.message = scrubString(e.message);
  if (e.logentry && e.logentry.message) e.logentry.message = scrubString(e.logentry.message);
  const vals = (e.exception && e.exception.values) || [];
  for (const v of vals) {
    v.value = scrubString(v.value);
    for (const f of (v.stacktrace && v.stacktrace.frames) || []) { delete f.vars; if (f.filename) f.filename = scrubUrl(f.filename); }
  }
  if (e.tags) for (const k of Object.keys(e.tags)) e.tags[k] = scrubString(String(e.tags[k]));
  if (e.contexts) { // keep browser/os/app only, never device location-ish or culture data
    const keep = {}; for (const k of ['browser', 'os', 'runtime', 'app']) if (e.contexts[k]) keep[k] = e.contexts[k];
    e.contexts = keep;
  }
  return e;
}

// Per-page budget so a crash loop cannot flood the project (or the person's data plan).
export function makeBudget(max = 10) {
  let n = 0; const seen = new Set();
  return (event) => {
    const ex = event && event.exception && event.exception.values && event.exception.values[0];
    const key = (ex ? ex.type + ':' + ex.value : event && event.message) || '';
    if (seen.has(key) || n >= max) return false;
    seen.add(key); n++; return true;
  };
}
