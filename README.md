# VIRALYTICS (Vercel edition)
Static site + 3 serverless functions in `api/`. No Python backend.
Vercel: Framework Preset = Other (no build command, no output directory). Node 18+.
Environment variables: GEMINI_API_KEY (your key), APP_PASSWORD (a long password you choose), optional GEMINI_MODEL (letters, digits, `.`, `-`, `_` only).
After deploying: open the site, Settings, enter APP_PASSWORD, press Connect.

## v1.1 changes (no existing feature removed or renamed)
**Analytics accuracy**
- Median is now a true median (even-sized groups used to return the upper-middle value, which inflated every "vs creator median" score).
- Posts with no creator are baselined per platform instead of LinkedIn and Instagram being pooled together.
- "My Performance" averages ignore records with no metrics (blank used to count as 0).
- Duplicate captions are rejected, not only duplicate URLs. Negative or invalid metrics are stored as blank.
- Keywords ignore URLs and @mentions and support non-English scripts; hashtags are case-insensitive, deduplicated and support non-English scripts. Curly apostrophes no longer break hook detection.
- Averages over fewer than 3 posts are marked "low sample".
- New **Analytics** page: data-quality checks, platform summary with engagement rate (when views are entered), weekday, media type, caption length, monthly trend, strongest/weakest posts, your own posts. Groups under 5 scored posts are marked "low n". New snapshot card under the Dashboard.

**Backend**
- Gemini calls: retry on rate limit / overload / network blips, 52 s timeout (inside the 60 s function limit), all text parts joined (thinking models), clear block reasons, proper 429 / 503 / 504 status codes.
- Wrong-password throttle (10 failures, 10 minutes; best effort per serverless instance, so keep APP_PASSWORD long).
- `connect` and `generate` accept POST only; API responses are `no-store`; request body parsed safely; unsafe GEMINI_MODEL values ignored; security headers in `vercel.json`.
- Browser database: backup import is one all-or-nothing transaction and tolerates malformed sections; aborted transactions no longer hang; storage persistence is requested so the browser is less likely to evict your data; AI JSON replies with extra text around them are still parsed.

Back up regularly (Settings, Export JSON): all data lives in your browser.
