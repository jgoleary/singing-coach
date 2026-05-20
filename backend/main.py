from fastapi import FastAPI, UploadFile, File
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


@app.post("/analyze-pitch")
async def analyze_pitch(audio: UploadFile = File(...)):
    data = await audio.read()
    result = analyze_bytes(data)
    return result
