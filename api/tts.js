// Vercel serverless function: POST /api/tts  { text, lang }  ->  audio/wav
// Env: GEMINI_API_KEY (required) · GEMINI_TTS_MODEL, GEMINI_TTS_VOICE (optional)
//      TTS_STYLE (optional, short tone hint such as "Say calmly"; empty by default so only the text is read)
//      ALLOWED_ORIGINS (optional, comma list of extra origins, e.g. a custom domain)
//      TTS_RATE_PER_MIN (default 30) · UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (optional shared limiter)
// api-tts v0.2.1
// Changes in 0.2.0: origin check, per-IP rate limit, audio cache, request timeout, no upstream detail in errors.
import {
  parseBody, originAllowed, clientIp, makeMemoryLimiter, makeUpstashLimiter,
  makeAudioCache, cacheKey, wav,
} from '../lib/tts-core.mjs';

// Gemini TTS speaks whatever it is given, so by default we send ONLY the sentence to read.
// Earlier versions prefixed a style/language instruction, and the model sometimes read that aloud.
// The voice persona comes from the voice name, and the language from the text itself (the app already
// writes each instruction in the chosen language). An optional TTS_STYLE adds a short "<style>: " prefix.
const STYLE = (process.env.TTS_STYLE || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 80);
const MAX = Math.max(1, parseInt(process.env.TTS_RATE_PER_MIN || '30', 10) || 30);

const memory = makeMemoryLimiter({ windowMs: 60_000, max: MAX });
const limiter = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? makeUpstashLimiter({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, max: MAX, fallback: memory })
  : memory;
const cache = makeAudioCache();

// Structured, privacy-safe log: never records the spoken text, only its length.
const log = (o) => console.log(JSON.stringify({ evt: 'tts', ...o }));

function fail(res, status, error, extra = {}) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json({ error, ...extra });
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'POST only'); }

  // Origin check blocks casual cross-site use from other web pages. It is not authentication
  // (non-browser clients can forge Origin), so the rate limit below is the real cost control.
  if (!originAllowed(req.headers, process.env)) { log({ ok: false, why: 'origin' }); return fail(res, 403, 'forbidden'); }

  const key = process.env.GEMINI_API_KEY;
  if (!key) { log({ ok: false, why: 'no-key' }); return fail(res, 500, 'voice unavailable'); }

  const ip = clientIp(req.headers);
  const rl = await limiter.check(ip);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    log({ ok: false, why: 'rate' });
    return fail(res, 429, 'too many requests');
  }

  const p = parseBody(req.body);
  if (!p.ok) return fail(res, 400, p.error);

  const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  const voice = process.env.GEMINI_TTS_VOICE || 'Fola';
  const ck = cacheKey([model, voice, STYLE, p.lang, p.text]);

  const hit = cache.get(ck);
  if (hit) {
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // same phrase, same audio: let the device reuse it
    res.setHeader('X-Cache', 'HIT');
    log({ ok: true, hit: true, len: p.text.length, lang: p.lang });
    return res.status(200).send(hit);
  }

  const prompt = STYLE ? `${STYLE}: ${p.text}` : p.text; // nothing but the information is sent by default
  const t0 = Date.now();
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
      signal: AbortSignal.timeout(15_000), // never hold a function open on a stalled upstream
    });
    if (!r.ok) { log({ ok: false, why: 'upstream', status: r.status, ms: Date.now() - t0 }); return fail(res, 502, 'voice unavailable'); }
    const j = await r.json();
    const part = j.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data);
    if (!part) { log({ ok: false, why: 'no-audio', ms: Date.now() - t0 }); return fail(res, 502, 'voice unavailable'); }
    const mime = part.inlineData.mimeType || '';
    const rate = +(/rate=(\d+)/.exec(mime)?.[1] || 24000);
    const bits = +(/L(\d+)/.exec(mime)?.[1] || 16);
    const pcm = Buffer.from(part.inlineData.data, 'base64');
    const out = /wav/.test(mime) ? pcm : wav(pcm, rate, bits);
    cache.set(ck, out);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Cache', 'MISS');
    log({ ok: true, hit: false, len: p.text.length, lang: p.lang, ms: Date.now() - t0 });
    return res.status(200).send(out);
  } catch (e) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    log({ ok: false, why: timeout ? 'timeout' : 'error', ms: Date.now() - t0 });
    return fail(res, timeout ? 504 : 500, 'voice unavailable');
  }
}
