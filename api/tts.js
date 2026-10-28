// Vercel serverless function: POST /api/tts  { text, lang }  ->  audio/wav
// Env vars: GEMINI_API_KEY (required), GEMINI_TTS_MODEL, GEMINI_TTS_VOICE
const LANG = {
  'ms-MY': 'Bahasa Malaysia with a natural Malaysian accent',
  'en-GB': 'English with a warm, natural Malaysian accent',
  'zh-CN': 'Mandarin Chinese, as spoken in Malaysia',
  'ta-IN': 'Tamil, as spoken in Malaysia',
};
const STYLE = 'Warm, friendly local guide. Calm, clear and natural, with smooth pacing and short pauses between sentences.';

function wav(pcm, rate = 24000, bits = 16, ch = 1) {
  const h = Buffer.alloc(44), ba = ch * bits / 8;
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * ba, 28); h.writeUInt16LE(ba, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  const { text, lang } = req.body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > 600) return res.status(400).json({ error: 'text required (max 600 chars)' });

  const model = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';
  const voice = process.env.GEMINI_TTS_VOICE || 'Fola';
  const prompt = `${STYLE}\nSpeak in ${LANG[lang] || 'the language of the text'}.\n## Transcript:\n${text}`;

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: 'upstream', status: r.status, detail: (await r.text()).slice(0, 300) });
    const j = await r.json();
    const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
    if (!part) return res.status(502).json({ error: 'no audio returned' });
    const mime = part.inlineData.mimeType || '';
    const rate = +(/rate=(\d+)/.exec(mime)?.[1] || 24000);
    const bits = +(/L(\d+)/.exec(mime)?.[1] || 16);
    const pcm = Buffer.from(part.inlineData.data, 'base64');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(/wav/.test(mime) ? pcm : wav(pcm, rate, bits));
  } catch (e) {
    return res.status(500).json({ error: 'tts failed' });
  }
}
