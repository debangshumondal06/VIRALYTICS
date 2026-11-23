const crypto = require('crypto');

// GEMINI_MODEL is dropped into a URL path, so accept only safe characters (falls back to the default).
exports.model = () => {
  const m = process.env.GEMINI_MODEL || '';
  return /^[\w.\-]+$/.test(m) ? m : 'gemini-2.5-flash';
};

exports.authed = req => {
  const p = process.env.APP_PASSWORD || '', h = String(req.headers['x-app-password'] || '');
  const a = Buffer.from(p), b = Buffer.from(h);
  return p.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Best-effort brute-force guard for password guessing. State lives in one warm serverless instance
// only, so it slows guessing down; it is not a substitute for a long APP_PASSWORD.
const fails = new Map();
const ip = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
exports.limited = req => { const f = fails.get(ip(req)); return !!f && f.n >= 10 && Date.now() - f.t < 600000; };
exports.noteFail = req => {
  const k = ip(req), f = fails.get(k);
  fails.set(k, f && Date.now() - f.t < 600000 ? { n: f.n + 1, t: Date.now() } : { n: 1, t: Date.now() });
  if (fails.size > 500) fails.clear();
};
exports.noteOk = req => fails.delete(ip(req));

// Private API: never cache, never sniff.
exports.headers = res => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); };

// Request body as an object, whether the platform parsed it or handed over a string.
exports.body = req => {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  try { return JSON.parse(b || '{}'); } catch { return {}; }
};

const wait = ms => new Promise(r => setTimeout(r, ms));

exports.gemini = async (prompt, json) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('GEMINI_API_KEY is not set in Vercel'), { code: 500 });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${exports.model()}:generateContent`;
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}) });
  let last;
  // Up to 3 attempts; only quick transient failures (rate limit / overload / network) are retried. A timeout is not,
  // because three slow attempts would exceed the 60 s function limit set in vercel.json.
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body, signal: AbortSignal.timeout(52000) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const parts = d.candidates?.[0]?.content?.parts || [];
        // join every text part (skip "thought" parts) instead of trusting parts[0]
        const t = parts.filter(x => typeof x.text === 'string' && !x.thought).map(x => x.text).join('');
        if (!t) {
          const why = d.promptFeedback?.blockReason || d.candidates?.[0]?.finishReason;
          throw Object.assign(new Error('Empty response from Gemini' + (why ? ' (' + why + ')' : ' (possibly blocked)')), { code: 502 });
        }
        return t;
      }
      const retry = [429, 500, 502, 503, 504].includes(r.status);
      last = Object.assign(new Error(r.status === 429 ? 'Gemini rate limit reached, wait a moment and try again' : d.error?.message || 'Gemini request failed'), { code: r.status === 429 ? 429 : r.status >= 500 ? 503 : 400, retry });
      if (!retry) throw last;
    } catch (e) {
      if (e.code && !e.retry) throw e;
      if (e.name === 'TimeoutError') throw Object.assign(new Error('Gemini took too long to answer, try again or shorten the request'), { code: 504 });
      if (!e.retry) last = Object.assign(new Error('Could not reach Gemini'), { code: 504, retry: true });
    }
    if (i < 2) await wait(800 * (i + 1));
  }
  throw last;
};
