import os
import tempfile
import numpy as np
import soundfile as sf
import av
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


def _decode_with_av(path: str) -> tuple[np.ndarray, int]:
    container = av.open(path)
    stream = next(s for s in container.streams if s.type == "audio")
    sr = stream.rate
    chunks: list[np.ndarray] = []
    for frame in container.decode(stream):
        arr = frame.to_ndarray()  # shape: (channels, samples) float32 in [-1, 1]
        chunks.append(arr)
    container.close()
    audio_f = np.concatenate(chunks, axis=-1)
    if audio_f.ndim > 1:
        audio_f = audio_f.mean(axis=0)
    return (audio_f * 32767).astype(np.int16), sr


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
            # Fallback: decode via PyAV (handles WebM/Opus from Chrome without system ffmpeg)
            audio, sr = _decode_with_av(path)
    finally:
        os.unlink(path)

    if audio.ndim > 1:
        audio = audio.mean(axis=1).astype(np.int16)
    return analyze_audio(audio, sr)
