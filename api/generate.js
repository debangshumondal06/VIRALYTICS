const { authed, gemini, limited, noteFail, body, headers } = require('./_lib');
module.exports = async (req, res) => {
  headers(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (limited(req)) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 10 minutes.' });
  if (!authed(req)) { noteFail(req); return res.status(401).json({ error: 'Locked. Enter your app password in Settings and press Connect.' }); }
  const { prompt, json } = body(req);
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000) return res.status(400).json({ error: 'Invalid prompt' });
  try { res.status(200).json({ text: await gemini(prompt, !!json) }); }
  catch (e) { res.status(e.code || 500).json({ error: e.message }); }
};
