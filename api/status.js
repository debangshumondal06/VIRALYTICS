const { authed, model, headers } = require('./_lib');
module.exports = (req, res) => { headers(res); res.status(200).json({ keySet: !!process.env.GEMINI_API_KEY, pwSet: !!process.env.APP_PASSWORD, authed: authed(req), model: model() }); };
