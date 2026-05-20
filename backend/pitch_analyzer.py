import tempfile
import numpy as np
import soundfile as sf
import crepe


def analyze_audio(audio: np.ndarray, sr: int) -> dict:
    time, frequency, confidence, _ = crepe.predict(
        audio.astype(np.float32) / 32768.0,
        sr,
        viterbi=True,
        step_size=10,
        verbose=0,
    )
    frames = [
        {"time": float(t), "frequency": float(f), "confidence": float(c)}
        for t, f, c in zip(time, frequency, confidence)
        if f > 0
    ]
    duration = float(len(audio) / sr)
    return {"frames": frames, "duration": duration}


def analyze_bytes(audio_bytes: bytes) -> dict:
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        audio, sr = sf.read(tmp.name, dtype="int16")
    if audio.ndim > 1:
        audio = audio[:, 0]  # mono
    return analyze_audio(audio, sr)
