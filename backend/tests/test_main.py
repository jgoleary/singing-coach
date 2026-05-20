import io
import wave
import struct
import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def make_wav_bytes(freq_hz: float = 440.0, duration_s: float = 1.0, sr: int = 16000) -> bytes:
    num_samples = int(sr * duration_s)
    t = [i / sr for i in range(num_samples)]
    samples = [int(32767 * np.sin(2 * 3.14159 * freq_hz * ti)) for ti in t]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(struct.pack(f"<{num_samples}h", *samples))
    return buf.getvalue()

async def test_analyze_pitch_returns_frames():
    wav_bytes = make_wav_bytes(440.0, 1.0)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/analyze-pitch",
            files={"audio": ("test.wav", wav_bytes, "audio/wav")},
        )
    assert response.status_code == 200
    body = response.json()
    assert "frames" in body
    assert "duration" in body
    assert len(body["frames"]) > 0
