const { authed, gemini } = require('./_lib');
module.exports = async (req, res) => {
  if (!process.env.APP_PASSWORD) return res.status(500).json({ error: 'APP_PASSWORD is not set in Vercel' });
  if (!authed(req)) return res.status(401).json({ error: 'Wrong password' });
  try { await gemini('Reply with the word OK', false); res.status(200).json({ ok: true }); }
  catch (e) { res.status(e.code || 500).json({ error: e.message }); }
};
