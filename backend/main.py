from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.pitch_analyzer import analyze_bytes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

MAX_AUDIO_BYTES = 50 * 1024 * 1024  # 50 MB

@app.post("/analyze-pitch")
async def analyze_pitch(audio: UploadFile = File(...)):
    data = await audio.read()
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large (max 50 MB)")
    try:
        result = analyze_bytes(data)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Audio processing failed: {exc}") from exc
    return result
