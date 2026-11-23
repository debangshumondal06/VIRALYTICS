const { authed, gemini, limited, noteFail, noteOk, headers } = require('./_lib');
module.exports = async (req, res) => {
  headers(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.APP_PASSWORD) return res.status(500).json({ error: 'APP_PASSWORD is not set in Vercel' });
  if (limited(req)) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 10 minutes.' });
  if (!authed(req)) { noteFail(req); return res.status(401).json({ error: 'Wrong password' }); }
  noteOk(req);
  try { await gemini('Reply with the word OK', false); res.status(200).json({ ok: true }); }
  catch (e) { res.status(e.code || 500).json({ error: e.message }); }
};
