import os
import tempfile
import numpy as np
import soundfile as sf
import av
import crepe


_FREQ_MIN = 80.0    # Hz — below human singing range
_FREQ_MAX = 1050.0  # Hz — above typical singing range
_MIN_VOICED_FRAMES = 10   # 100 ms at 10 ms step_size
_MAX_JUMP_SEMITONES = 12.0
_PHRASE_BREAK_SEC = 0.20  # gaps longer than this reset the smoothness check


def _post_process(
    time: np.ndarray,
    frequency: np.ndarray,
    confidence: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    if len(time) == 0:
        return time, frequency, confidence

    # 1. Frequency gate: drop anything outside singable range
    in_range = (frequency >= _FREQ_MIN) & (frequency <= _FREQ_MAX)
    time, frequency, confidence = time[in_range], frequency[in_range], confidence[in_range]

    if len(time) == 0:
        return time, frequency, confidence

    # 2. Minimum voiced-segment duration: drop runs of voiced frames < 100 ms.
    #    Eliminates scattered background-noise detections and onset spikes.
    voiced = confidence >= 0.5
    keep = np.ones(len(time), dtype=bool)
    i = 0
    while i < len(time):
        if not voiced[i]:
            i += 1
            continue
        j = i
        while j + 1 < len(time) and voiced[j + 1] and (time[j + 1] - time[j]) < 0.025:
            j += 1
        if (j - i + 1) < _MIN_VOICED_FRAMES:
            keep[i : j + 1] = False
        i = j + 1
    time, frequency, confidence = time[keep], frequency[keep], confidence[keep]
    voiced = confidence >= 0.5

    if len(time) == 0:
        return time, frequency, confidence

    # 3. Smoothness constraint: reject voiced frames that jump > 12 semitones
    #    from the previous accepted voiced frame within a phrase (gap < 200 ms).
    keep = np.ones(len(time), dtype=bool)
    last_semitone: float | None = None
    last_time: float = -np.inf
    for i in range(len(time)):
        if not voiced[i]:
            continue
        st = 12.0 * np.log2(frequency[i] / 440.0)
        if last_semitone is not None and (time[i] - last_time) < _PHRASE_BREAK_SEC:
            if abs(st - last_semitone) > _MAX_JUMP_SEMITONES:
                keep[i] = False
                continue
        last_semitone = st
        last_time = time[i]
    time, frequency, confidence = time[keep], frequency[keep], confidence[keep]

    return time, frequency, confidence


def analyze_audio(audio: np.ndarray, sr: int) -> dict:
    time, frequency, confidence, _ = crepe.predict(
        audio.astype(np.float32) / 32768.0,
        sr,
        model_capacity="small",
        viterbi=True,
        step_size=10,
        verbose=0,
    )
    time, frequency, confidence = _post_process(time, frequency, confidence)
    frames = [
        {"time": float(t), "frequency": float(f), "confidence": float(c)}
        for t, f, c in zip(time, frequency, confidence)
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
