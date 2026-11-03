import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = 'test-key';
process.env.TTS_RATE_PER_MIN = '3';
const { default: handler } = await import('../api/tts.js');

const mkRes = () => {
  const r = { headers: {}, code: 200, body: undefined };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  r.send = (b) => { r.body = b; return r; };
  return r;
};
const req = (over = {}) => ({
  method: 'POST',
  headers: { origin: 'https://arah.test', host: 'arah.test', 'x-forwarded-for': '9.9.9.9' },
  body: { text: 'Belok kiri', lang: 'ms-MY' },
  ...over,
});
const realFetch = globalThis.fetch;
const geminiOk = () => async () => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: Buffer.alloc(64).toString('base64') } }] } }] }),
});

test('rejects non-POST, foreign origin and bad bodies without calling the model', async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('should not be called'); };
  let r = mkRes(); await handler(req({ method: 'GET' }), r); assert.equal(r.code, 405); assert.equal(r.headers.Allow, 'POST');
  r = mkRes(); await handler(req({ headers: { origin: 'https://evil.example', host: 'arah.test', 'x-forwarded-for': '1.1.1.1' } }), r); assert.equal(r.code, 403);
  r = mkRes(); await handler(req({ headers: { host: 'arah.test', 'x-forwarded-for': '1.1.1.2' } }), r); assert.equal(r.code, 403);
  r = mkRes(); await handler(req({ body: { text: '' }, headers: { origin: 'https://arah.test', host: 'arah.test', 'x-forwarded-for': '1.1.1.3' } }), r); assert.equal(r.code, 400);
  assert.equal(calls, 0);
});

test('returns WAV on success, then serves the same phrase from cache without a second call', async () => {
  let calls = 0; const ok = geminiOk(); globalThis.fetch = async (...a) => { calls++; return ok(...a); };
  const h = { origin: 'https://arah.test', host: 'arah.test', 'x-forwarded-for': '2.2.2.2' };
  let r = mkRes(); await handler(req({ headers: h }), r);
  assert.equal(r.code, 200); assert.equal(r.headers['Content-Type'], 'audio/wav'); assert.equal(r.headers['X-Cache'], 'MISS');
  assert.equal(r.body.toString('ascii', 0, 4), 'RIFF');
  r = mkRes(); await handler(req({ headers: h }), r);
  assert.equal(r.code, 200); assert.equal(r.headers['X-Cache'], 'HIT'); assert.equal(calls, 1);
});

test('rate limits per IP with Retry-After', async () => {
  globalThis.fetch = geminiOk();
  const h = { origin: 'https://arah.test', host: 'arah.test', 'x-forwarded-for': '3.3.3.3' };
  const codes = [];
  for (let i = 0; i < 5; i++) { const r = mkRes(); await handler(req({ headers: h, body: { text: 'ayat ' + i } }), r); codes.push(r.code); if (r.code === 429) assert.ok(Number(r.headers['Retry-After']) >= 1); }
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test('upstream failure returns a generic error with no upstream detail', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'secret upstream detail' });
  const r = mkRes(); await handler(req({ headers: { origin: 'https://arah.test', host: 'arah.test', 'x-forwarded-for': '4.4.4.4' }, body: { text: 'gagal' } }), r);
  assert.equal(r.code, 502); assert.deepEqual(r.body, { error: 'voice unavailable' }); assert.equal(r.headers['Cache-Control'], 'no-store');
});

test('timeout maps to 504', async () => {
  globalThis.fetch = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; };
  const r = mkRes(); await handler(req({ headers: { origin: 'https://arah.test', host: 'arah.test', 'x-forwarded-for': '5.5.5.5' }, body: { text: 'lambat' } }), r);
  assert.equal(r.code, 504);
});
test.after(() => { globalThis.fetch = realFetch; });
