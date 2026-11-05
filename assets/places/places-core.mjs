// places v0.2.1
// Pure logic for the Makan & Mall directory: validation, OpenStreetMap query building, result parsing.
// No DOM and no network here, so it is unit-tested in Node.
export const KINDS = ['food', 'mall'];
export const DOMAIN_RE = /^(?=.{4,80}$)([a-z0-9-]+\.)+[a-z]{2,}$/;
export const COLOR_RE = /^#[0-9a-f]{6}$/i;
export const MY_BBOX = '0.8,99.5,7.5,119.4'; // south,west,north,east: Peninsular + Borneo Malaysia

/**
 * Make text safe as a literal inside an Overpass QL regex string, without using any backslash or quote: regex
 * specials become one-character classes ("." -> "[.]"), and characters that cannot be classed ('"', "\\", "^") become
 * "." (any character). So nothing in the result can end the string literal or start an escape.
 */
export const escapeRegex = (s) => String(s).replace(/["\\^]/g, '.').replace(/[.*+?{}()|[$\]]/g, '[$&]');

/** Regex source for a brand: an explicit override (quotes and backslashes neutralised) or the escaped name. */
export const brandPattern = (b) => (b.osm ? String(b.osm).replace(/["\\]/g, '.') : escapeRegex(b.name));

export const initials = (name) => {
  const w = String(name).replace(/['’.]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  const t = w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2);
  return t.toUpperCase();
};

/** Readable text colour (black or white) for a hex background. */
export const inkFor = (hex) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
};

const lum = (hex) => { const n = parseInt(hex.slice(1), 16), f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (hex, to, t) => { const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1); };
/** Brand colour + readable ink at WCAG AAA (7:1): nudge the brand colour toward black (white ink) or white (dark ink), whichever moves it least, keeping the hue. */
export const readable = (hex, min = 7) => {
  let best = null;
  for (const [ink, to] of [['#ffffff', '#000000'], ['#111111', '#ffffff']]) {
    let t = 0, bg = hex; while (contrast(bg, ink) < min && t < 1) { t += 0.02; bg = mix(hex, to, t); }
    if (contrast(bg, ink) >= min && (!best || t < best.t)) best = { bg, ink, t };
  }
  return best || { bg: '#000000', ink: '#ffffff', t: 1 };
};

/** Logo candidates, tried in order, all served by the brand's own website. */
export const logoUrls = (domain) => (DOMAIN_RE.test(domain)
  ? [`https://${domain}/apple-touch-icon.png`, `https://${domain}/favicon.ico`] : []);

const ff = '["amenity"~"^(fast_food|restaurant|cafe|ice_cream)$"]';
/**
 * Overpass query. scope: {around:[lat,lon,metres]} or {malaysia:true}.
 * brand: a BRANDS entry, or null for "everything of this kind nearby".
 */
export function buildQuery(kind, brand, scope, limit = 80, timeoutS = 25) {
  if (!KINDS.includes(kind)) throw new Error('bad kind');
  const base = kind === 'mall' ? '["shop"="mall"]' : ff;
  let where;
  if (scope && scope.around) {
    const [lat, lon, r] = scope.around.map(Number);
    if (![lat, lon, r].every(Number.isFinite) || r < 100 || r > 50000) throw new Error('bad scope');
    where = `(around:${Math.round(r)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  } else where = `(${MY_BBOX})`;
  const t = Math.max(5, Math.min(60, Math.round(Number(timeoutS)) || 25)), n = Math.min(150, limit);
  // A brand is matched on its two tags separately and unioned: one key-regex over every tag of every object in the area (the old
  // [~"^(name|brand)$"~...] form) is much slower on the public Overpass servers and was a main cause of timeouts.
  const body = brand
    ? `(nwr${base}["name"~"${brandPattern(brand)}",i]${where};nwr${base}["brand"~"${brandPattern(brand)}",i]${where};)`
    : `nwr${base}["name"]${where}`;
  return `[out:json][timeout:${t}];${body};out center ${n};`;
}

export const haversine = (a, b) => { // [lon,lat] pairs, metres
  const R = 6371000, k = Math.PI / 180, dLa = (b[1] - a[1]) * k, dLo = (b[0] - a[0]) * k;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
export const fmtDist = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

/** Which known brand an OSM element belongs to (for the logo), or null. */
export function matchBrand(tags, kind, brands = []) {
  const hay = `${tags.brand || ''}|${tags.name || ''}|${tags['name:en'] || ''}`;
  for (const b of brands) {
    if (b.kind !== kind) continue;
    try { if (new RegExp(brandPattern(b), 'i').test(hay)) return b; } catch (e) { /* skip bad pattern */ }
  }
  return null;
}

/** Overpass JSON -> sorted, de-duplicated outlet list. Every string is plain text (inserted with textContent). */
export function parseOutlets(json, ref, kind, brands = []) {
  const out = [], seen = new Set();
  for (const e of (json && json.elements) || []) {
    const t = e.tags || {};
    const c = e.center ? [e.center.lon, e.center.lat] : [e.lon, e.lat];
    if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    const name = String(t.name || t.brand || '').slice(0, 120);
    if (!name) continue;
    const key = name.toLowerCase() + '|' + c[0].toFixed(3) + '|' + c[1].toFixed(3);
    if (seen.has(key)) continue; seen.add(key);
    const d = haversine(ref, c);
    const addr = [t['addr:street'], t['addr:city'] || t['addr:suburb']].filter(Boolean).join(', ').slice(0, 120);
    out.push({ name, addr, c, d, dist: fmtDist(d), brand: matchBrand(t, kind, brands), hours: t.opening_hours === '24/7' ? '24 jam' : '' });
  }
  return out.sort((a, b) => a.d - b.d);
}
