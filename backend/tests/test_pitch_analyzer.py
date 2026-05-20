import io
import os
import struct
import subprocess
import tempfile
import wave

import numpy as np
import pytest
from backend.pitch_analyzer import analyze_audio, analyze_bytes

def make_sine_wave(freq_hz: float, duration_s: float, sr: int = 16000) -> np.ndarray:
    t = np.linspace(0, duration_s, int(sr * duration_s), endpoint=False)
    return (np.sin(2 * np.pi * freq_hz * t) * 32767).astype(np.int16)

def test_analyze_returns_frames_for_sine_wave():
    sr = 16000
    audio = make_sine_wave(440.0, 2.0, sr)
    result = analyze_audio(audio, sr)
    assert "frames" in result
    assert "duration" in result
    assert len(result["frames"]) > 0
    frame = result["frames"][0]
    assert "time" in frame
    assert "frequency" in frame
    assert "confidence" in frame

def test_frames_near_440hz():
    sr = 16000
    audio = make_sine_wave(440.0, 2.0, sr)
    result = analyze_audio(audio, sr)
    high_conf = [f for f in result["frames"] if f["confidence"] > 0.8]
    assert len(high_conf) > 0
    avg_freq = sum(f["frequency"] for f in high_conf) / len(high_conf)
    assert abs(avg_freq - 440.0) < 20.0  # within 20 Hz

def test_zero_frequency_frames_excluded():
    sr = 16000
    audio = make_sine_wave(440.0, 2.0, sr)
    result = analyze_audio(audio, sr)
    assert all(f["frequency"] > 0 for f in result["frames"])


def make_wav_bytes_for_test(freq_hz: float = 440.0, duration_s: float = 1.0, sr: int = 16000) -> bytes:
    num_samples = int(sr * duration_s)
    t = [i / sr for i in range(num_samples)]
    samples = [int(32767 * np.sin(2 * np.pi * freq_hz * ti)) for ti in t]
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(struct.pack(f"<{num_samples}h", *samples))
    return buf.getvalue()


def test_analyze_bytes_with_wav():
    wav_bytes = make_wav_bytes_for_test(440.0, 1.0)
    result = analyze_bytes(wav_bytes)
    assert "frames" in result
    assert len(result["frames"]) > 0
    assert result["duration"] > 0


def has_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


@pytest.mark.skipif(not has_ffmpeg(), reason="ffmpeg not installed")
def test_analyze_bytes_with_webm():
    # Create a WAV then convert to WebM with ffmpeg to simulate Chrome MediaRecorder output
    wav_bytes = make_wav_bytes_for_test(440.0, 1.0)
    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    fd2, webm_path = tempfile.mkstemp(suffix=".webm")
    try:
        os.write(fd, wav_bytes)
        os.close(fd)
        os.close(fd2)
        subprocess.run(
            ["ffmpeg", "-y", "-i", wav_path, "-c:a", "libopus", webm_path],
            check=True, capture_output=True
        )
        with open(webm_path, "rb") as f:
            webm_bytes = f.read()
        result = analyze_bytes(webm_bytes)
        assert "frames" in result
        assert len(result["frames"]) > 0
    finally:
        os.unlink(wav_path)
        os.unlink(webm_path)
