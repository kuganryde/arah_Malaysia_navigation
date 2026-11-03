// Pure helpers for api/tts.js. Kept free of I/O so they can be unit-tested.
// api-tts v0.2.0
// Why: the endpoint spends a paid Gemini key, so validation, origin checks,
// rate limiting and caching must be reliable and easy to review.
import { createHash } from 'node:crypto';

export const MAX_TEXT = 600;
export const LANG = {
  'ms-MY': 'Bahasa Malaysia with a natural Malaysian accent',
  'en-GB': 'English with a warm, natural Malaysian accent',
  'zh-CN': 'Mandarin Chinese, as spoken in Malaysia',
  'ta-IN': 'Tamil, as spoken in Malaysia',
};

/** Validate the request body. Returns { ok, text, lang } or { ok:false, error }. */
export function parseBody(body) {
  let b = body;
  if (typeof b === 'string') {
    // Vercel normally parses JSON; tolerate a raw string but cap its size first.
    if (b.length > 4096) return { ok: false, error: 'body too large' };
    try { b = JSON.parse(b); } catch { return { ok: false, error: 'invalid json' }; }
  }
  if (!b || typeof b !== 'object') return { ok: false, error: 'json body required' };
  const { text, lang } = b;
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'text required' };
  if (text.length > MAX_TEXT) return { ok: false, error: `text too long (max ${MAX_TEXT} chars)` };
  // Allow-list the language: anything else is rejected rather than interpolated into the prompt,
  // which closes a prompt-injection path through the `lang` field.
  if (lang !== undefined && !Object.hasOwn(LANG, lang)) return { ok: false, error: 'unsupported lang' };
  return { ok: true, text: text.trim(), lang: lang || 'en-GB' };
}

/** Browsers always send Origin on a cross-origin or same-origin POST. Non-browser callers are refused. */
export function originAllowed(headers, env = {}) {
  const origin = headers.origin;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  const allowed = new Set();
  if (headers.host) allowed.add(headers.host);
  for (const v of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) if (v) allowed.add(v);
  for (const v of (env.ALLOWED_ORIGINS || '').split(',')) {
    const t = v.trim();
    if (t) { try { allowed.add(new URL(t).host); } catch { allowed.add(t); } }
  }
  return allowed.has(host);
}

/** Client IP as set by the platform proxy (first x-forwarded-for hop). */
export function clientIp(headers) {
  const xf = headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : xf || '').split(',')[0].trim();
  return first || headers['x-real-ip'] || 'unknown';
}

/**
 * Fixed-window limiter held in memory. Best effort only: each serverless instance keeps its own
 * counts, so the effective limit is per instance. makeUpstashLimiter adds a shared store.
 */
export function makeMemoryLimiter({ windowMs = 60_000, max = 20, maxKeys = 5000, now = Date.now } = {}) {
  const hits = new Map();
  return {
    check(key) {
      const t = now();
      let e = hits.get(key);
      if (!e || t - e.start >= windowMs) {
        if (hits.size >= maxKeys) { // bound memory: drop expired, then the oldest
          for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k);
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value);
        }
        e = { start: t, n: 0 }; hits.set(key, e);
      }
      e.n += 1;
      return { allowed: e.n <= max, remaining: Math.max(0, max - e.n), retryAfter: Math.ceil((e.start + windowMs - t) / 1000) };
    },
  };
}

/** Shared limiter on Upstash Redis REST (INCR + EXPIRE). Falls back to `fallback` if the store errors. */
export function makeUpstashLimiter({ url, token, windowSec = 60, max = 20, fallback, fetchImpl = fetch }) {
  return {
    async check(key) {
      try {
        const k = `arah:tts:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
        const r = await fetchImpl(`${url}/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([['INCR', k], ['EXPIRE', k, windowSec * 2]]),
          signal: AbortSignal.timeout(1500),
        });
        if (!r.ok) throw new Error('store ' + r.status);
        const n = (await r.json())?.[0]?.result;
        if (typeof n !== 'number') throw new Error('bad store reply');
        return { allowed: n <= max, remaining: Math.max(0, max - n), retryAfter: windowSec };
      } catch {
        return fallback.check(key); // never fail open without any limit
      }
    },
  };
}

/** Small LRU for generated audio, bounded by entries and bytes. */
export function makeAudioCache({ maxEntries = 64, maxBytes = 24 * 1024 * 1024 } = {}) {
  const m = new Map();
  let bytes = 0;
  return {
    get(k) { const v = m.get(k); if (v) { m.delete(k); m.set(k, v); } return v; },
    set(k, v) {
      if (v.length > maxBytes) return;
      if (m.has(k)) { bytes -= m.get(k).length; m.delete(k); }
      m.set(k, v); bytes += v.length;
      while (m.size > maxEntries || bytes > maxBytes) { const o = m.keys().next().value; bytes -= m.get(o).length; m.delete(o); }
    },
    get size() { return m.size; },
  };
}

export const cacheKey = (parts) => createHash('sha256').update(parts.join('\u0000')).digest('hex');

/** Wrap raw 16-bit PCM in a WAV container. */
export function wav(pcm, rate = 24000, bits = 16, ch = 1) {
  const h = Buffer.alloc(44), ba = ch * bits / 8;
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * ba, 28); h.writeUInt16LE(ba, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
