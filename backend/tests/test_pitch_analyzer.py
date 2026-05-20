import numpy as np
import pytest
from backend.pitch_analyzer import analyze_audio

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
