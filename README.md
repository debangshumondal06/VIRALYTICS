# VIRALYTICS — personal content intelligence (MVP)

## Run
1. `pip install -r backend/requirements.txt`
2. From this folder: `uvicorn backend.main:app --port 8000`
3. Open http://localhost:8000

## Connect Gemini
Settings → paste your Gemini API key (aistudio.google.com) → **Connect**. The key is held only in the proxy's memory (or in `backend/.env` if you prefer). Without it, everything except AI features still works offline.

## No backend at all?
Open `index.html` via any static server (e.g. `python -m http.server`) for manual import + offline analysis. Set the proxy URL in Settings to use AI.

## Layout
`js/db.js` IndexedDB + backup · `js/analyzer.js` offline heuristics · `js/ai.js` proxy client · `js/app.js` pages · `backend/main.py` provider proxy (add providers in `PROVIDERS`).

## Notes
No scraping: paste captions/metrics manually. Scores compare a post with its creator's own median (3+ posts needed). Not a virality predictor.
