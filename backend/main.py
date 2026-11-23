"""Viralytics local proxy. Holds the API key in memory only. Run: uvicorn backend.main:app --port 8000"""
import os
from pathlib import Path
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="Viralytics proxy")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
STATE = {"provider": "gemini", "key": os.getenv("GEMINI_API_KEY", ""), "model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash")}


async def call_gemini(prompt: str, as_json: bool) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{STATE['model']}:generateContent"
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    if as_json:
        body["generationConfig"] = {"responseMimeType": "application/json"}
    async with httpx.AsyncClient(timeout=90) as c:
        r = await c.post(url, json=body, headers={"x-goog-api-key": STATE["key"]})
    if r.status_code != 200:
        try:
            msg = r.json()["error"]["message"]
        except Exception:
            msg = "Gemini request failed"
        raise HTTPException(r.status_code, msg)
    try:
        return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        raise HTTPException(502, "Empty response from Gemini (possibly blocked)")


PROVIDERS = {"gemini": call_gemini}  # add other providers here: name -> async fn(prompt, as_json)


class Connect(BaseModel):
    provider: str = "gemini"
    key: str
    model: str = ""


class Gen(BaseModel):
    prompt: str
    json: bool = False


@app.get("/api/status")
def status():
    return {"connected": bool(STATE["key"]), "provider": STATE["provider"], "model": STATE["model"]}


@app.post("/api/connect")
async def connect(c: Connect):
    if c.provider not in PROVIDERS:
        raise HTTPException(400, "Unknown provider")
    old = dict(STATE)
    STATE.update(provider=c.provider, key=c.key.strip(), model=c.model.strip() or STATE["model"])
    try:
        await PROVIDERS[c.provider]("Reply with the word OK", False)
    except HTTPException as e:
        STATE.update(old)
        raise HTTPException(400, f"Connection failed: {e.detail}")
    return status()


@app.post("/api/disconnect")
def disconnect():
    STATE["key"] = ""
    return status()


@app.post("/api/generate")
async def generate(g: Gen):
    if not STATE["key"]:
        raise HTTPException(400, "Not connected. Add your API key in Settings.")
    return {"text": await PROVIDERS[STATE["provider"]](g.prompt, g.json)}


@app.get("/")
def index():
    return FileResponse(ROOT / "index.html")


app.mount("/css", StaticFiles(directory=ROOT / "css"), name="css")
app.mount("/js", StaticFiles(directory=ROOT / "js"), name="js")
