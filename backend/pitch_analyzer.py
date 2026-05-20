import os
import subprocess
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
    fd, path = tempfile.mkstemp(suffix=".bin")
    try:
        try:
            os.write(fd, audio_bytes)
        finally:
            os.close(fd)
        try:
            audio, sr = sf.read(path, dtype="int16")
        except Exception:
            # Fallback: convert via ffmpeg (handles WebM/Opus from Chrome)
            fd2, wav_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd2)
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
                    check=True,
                    capture_output=True,
                )
                audio, sr = sf.read(wav_path, dtype="int16")
            finally:
                os.unlink(wav_path)
    finally:
        os.unlink(path)

    if audio.ndim > 1:
        audio = audio.mean(axis=1).astype(np.int16)
    return analyze_audio(audio, sr)
