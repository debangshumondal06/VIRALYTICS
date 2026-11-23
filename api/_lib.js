const crypto = require('crypto');
exports.model = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
exports.authed = req => {
  const p = process.env.APP_PASSWORD || '', h = String(req.headers['x-app-password'] || '');
  const a = Buffer.from(p), b = Buffer.from(h);
  return p.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};
exports.gemini = async (prompt, json) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY is not set in Vercel'), { code: 500 });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${exports.model()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error?.message || 'Gemini request failed'), { code: 400 });
  const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!t) throw Object.assign(new Error('Empty response from Gemini (possibly blocked)'), { code: 502 });
  return t;
};
