# Singing Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local singing practice tool — load MusicXML, play back synthesized parts, record yourself, and see a pitch accuracy graph powered by CREPE.

**Architecture:** Backend-first. FastAPI + CREPE pitch detection validated standalone before any frontend work. Frontend is React + Vite with a split panel: tabbed left (Score / Pitch Graph) and controls on the right. State flows through a single Zustand store.

**Tech Stack:** Python 3.10+, FastAPI, CREPE, TensorFlow, soundfile; React 18, TypeScript, Vite, Zustand, OpenSheetMusicDisplay, Tone.js, soundfont-player, Recharts, JSZip, Tailwind CSS.

---

## Task 1: Backend scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_main.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi
uvicorn[standard]
crepe
tensorflow
soundfile
numpy
python-multipart
httpx
pytest
pytest-asyncio
```

- [ ] **Step 2: Create backend/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 3: Create backend/tests/test_main.py**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Install dependencies and run test**

```bash
cd backend
pip install -r requirements.txt
pytest tests/test_main.py -v
```

Expected: `PASSED tests/test_main.py::test_health`

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add FastAPI backend scaffold with health endpoint"
```

---

## Task 2: Pitch analyzer module

**Files:**
- Create: `backend/pitch_analyzer.py`
- Create: `backend/tests/test_pitch_analyzer.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_pitch_analyzer.py
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
    # All frames should have required keys
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
```

- [ ] **Step 2: Run test to see it fail**

```bash
cd backend
pytest tests/test_pitch_analyzer.py -v
```

Expected: `ImportError` or `ModuleNotFoundError`

- [ ] **Step 3: Implement pitch_analyzer.py**

```python
# backend/pitch_analyzer.py
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
```

- [ ] **Step 4: Run tests**

```bash
cd backend
pytest tests/test_pitch_analyzer.py -v
```

Expected: All 3 tests PASS. Note: first run downloads the CREPE model (~10MB).

- [ ] **Step 5: Commit**

```bash
git add backend/pitch_analyzer.py backend/tests/test_pitch_analyzer.py
git commit -m "feat: add CREPE pitch analyzer module"
```

---

## Task 3: POST /analyze-pitch endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Add failing test for the endpoint**

Add to `backend/tests/test_main.py`:

```python
import io
import wave
import struct

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

import numpy as np  # add at top of file

@pytest.mark.asyncio
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend
pytest tests/test_main.py::test_analyze_pitch_returns_frames -v
```

Expected: FAIL — route not found (404)

- [ ] **Step 3: Add route to main.py**

```python
# Add these imports at the top of backend/main.py
from fastapi import UploadFile, File
from backend.pitch_analyzer import analyze_bytes

# Add this route
@app.post("/analyze-pitch")
async def analyze_pitch(audio: UploadFile = File(...)):
    data = await audio.read()
    result = analyze_bytes(data)
    return result
```

- [ ] **Step 4: Run all backend tests**

```bash
cd backend
pytest tests/ -v
```

Expected: All tests PASS (health + 3 analyzer + endpoint = 5 total)

- [ ] **Step 5: Manually verify the server starts**

```bash
cd backend
uvicorn main:app --reload --port 8000
# In another terminal:
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_main.py
git commit -m "feat: add POST /analyze-pitch endpoint"
```

---

## Task 4: Frontend scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Scaffold with Vite**

```bash
cd /path/to/singing-coach
npm create vite@latest frontend -- --template react-ts
cd frontend
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install zustand opensheetmusicdisplay tone @tonejs/midi jszip recharts
npm install -D tailwindcss postcss autoprefixer @types/node vitest @testing-library/react @testing-library/jest-dom jsdom
npx tailwindcss init -p
```

- [ ] **Step 3: Configure tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Replace src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f0f1a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 5: Configure vitest in vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 6: Create src/test-setup.ts**

```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 7: Replace index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Singing Coach</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Replace src/main.tsx**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: Create placeholder App.tsx**

```typescript
export default function App() {
  return <div className="p-4 text-white">Singing Coach</div>;
}
```

- [ ] **Step 10: Verify dev server starts**

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 — expect "Singing Coach" text on dark background.

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React + Vite + Tailwind frontend"
```

---

## Task 5: Types and Zustand store

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/store/useStore.ts`
- Create: `frontend/src/store/useStore.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// frontend/src/store/useStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { act, renderHook } from "@testing-library/react";

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({
      parsedScore: null,
      voicePartId: null,
      accompanimentPartId: null,
      passage: null,
      playVoice: true,
      playAccompaniment: true,
      isPlaying: false,
      octaveDown: false,
      isRecording: false,
      lastRecordingBlob: null,
      pitchData: null,
      targetNotes: null,
    });
  });

  it("sets voicePartId", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.setVoicePartId("part1"));
    expect(useStore.getState().voicePartId).toBe("part1");
  });

  it("sets passage", () => {
    const { result } = renderHook(() => useStore());
    const passage = { startMeasure: 1, startBeat: 1, endMeasure: 4, endBeat: 4 };
    act(() => result.current.setPassage(passage));
    expect(useStore.getState().passage).toEqual(passage);
  });

  it("toggles octaveDown", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.setOctaveDown(true));
    expect(useStore.getState().octaveDown).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend
npx vitest run src/store/useStore.test.ts
```

Expected: `Cannot find module './useStore'`

- [ ] **Step 3: Create src/types.ts**

```typescript
export interface Note {
  measureNumber: number;
  beatPosition: number;
  duration: number;
  pitch: { step: string; octave: number; alter: number } | null;
  isRest: boolean;
}

export interface Measure {
  number: number;
  beats: number;
  beatType: number;
  notes: Note[];
}

export interface Part {
  id: string;
  name: string;
  measures: Measure[];
}

export interface ParsedScore {
  parts: Part[];
  tempo: number;
}

export interface PitchFrame {
  time: number;
  frequency: number;
  confidence: number;
}

export interface TargetNote {
  startTime: number;
  endTime: number;
  frequency: number;
}

export interface Passage {
  startMeasure: number;
  startBeat: number;
  endMeasure: number;
  endBeat: number;
}
```

- [ ] **Step 4: Create src/store/useStore.ts**

```typescript
import { create } from "zustand";
import type { ParsedScore, PitchFrame, TargetNote, Passage } from "../types";

interface AppState {
  parsedScore: ParsedScore | null;
  voicePartId: string | null;
  accompanimentPartId: string | null;
  passage: Passage | null;
  playVoice: boolean;
  playAccompaniment: boolean;
  isPlaying: boolean;
  octaveDown: boolean;
  isRecording: boolean;
  lastRecordingBlob: Blob | null;
  pitchData: PitchFrame[] | null;
  targetNotes: TargetNote[] | null;

  setParsedScore: (score: ParsedScore) => void;
  setVoicePartId: (id: string | null) => void;
  setAccompanimentPartId: (id: string | null) => void;
  setPassage: (passage: Passage | null) => void;
  setPlayVoice: (v: boolean) => void;
  setPlayAccompaniment: (v: boolean) => void;
  setIsPlaying: (v: boolean) => void;
  setOctaveDown: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setLastRecordingBlob: (blob: Blob | null) => void;
  setPitchData: (frames: PitchFrame[] | null) => void;
  setTargetNotes: (notes: TargetNote[] | null) => void;
}

export const useStore = create<AppState>((set) => ({
  parsedScore: null,
  voicePartId: null,
  accompanimentPartId: null,
  passage: null,
  playVoice: true,
  playAccompaniment: true,
  isPlaying: false,
  octaveDown: false,
  isRecording: false,
  lastRecordingBlob: null,
  pitchData: null,
  targetNotes: null,

  setParsedScore: (score) => set({ parsedScore: score }),
  setVoicePartId: (id) => set({ voicePartId: id }),
  setAccompanimentPartId: (id) => set({ accompanimentPartId: id }),
  setPassage: (passage) => set({ passage }),
  setPlayVoice: (v) => set({ playVoice: v }),
  setPlayAccompaniment: (v) => set({ playAccompaniment: v }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setOctaveDown: (v) => set({ octaveDown: v }),
  setIsRecording: (v) => set({ isRecording: v }),
  setLastRecordingBlob: (blob) => set({ lastRecordingBlob: blob }),
  setPitchData: (frames) => set({ pitchData: frames }),
  setTargetNotes: (notes) => set({ targetNotes: notes }),
}));
```

- [ ] **Step 5: Run tests**

```bash
cd frontend
npx vitest run src/store/useStore.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types.ts frontend/src/store/
git commit -m "feat: add shared types and Zustand store"
```

---

## Task 6: noteUtils and musicxml utilities

**Files:**
- Create: `frontend/src/utils/noteUtils.ts`
- Create: `frontend/src/utils/musicxml.ts`
- Create: `frontend/src/utils/noteUtils.test.ts`
- Create: `frontend/src/utils/musicxml.test.ts`

- [ ] **Step 1: Write failing tests for noteUtils**

```typescript
// frontend/src/utils/noteUtils.test.ts
import { describe, it, expect } from "vitest";
import { noteToFrequency, frequencyToNoteName, beatsToSeconds } from "./noteUtils";

describe("noteToFrequency", () => {
  it("returns 440 for A4", () => {
    expect(noteToFrequency("A", 4, 0)).toBeCloseTo(440.0, 1);
  });
  it("returns 261.63 for C4", () => {
    expect(noteToFrequency("C", 4, 0)).toBeCloseTo(261.63, 1);
  });
  it("applies alter (sharp)", () => {
    // C#4 = 277.18
    expect(noteToFrequency("C", 4, 1)).toBeCloseTo(277.18, 1);
  });
  it("applies alter (flat)", () => {
    // Bb4 = 466.16
    expect(noteToFrequency("B", 4, -1)).toBeCloseTo(466.16, 1);
  });
});

describe("frequencyToNoteName", () => {
  it("identifies A4", () => {
    expect(frequencyToNoteName(440)).toBe("A4");
  });
  it("identifies C4", () => {
    expect(frequencyToNoteName(261.63)).toBe("C4");
  });
});

describe("beatsToSeconds", () => {
  it("converts beat 1 of measure 1 to 0 seconds at 120bpm 4/4", () => {
    expect(beatsToSeconds(1, 1, 120, { beats: 4, beatType: 4 })).toBeCloseTo(0, 5);
  });
  it("converts beat 3 of measure 1 to 1 second at 120bpm 4/4", () => {
    // At 120 BPM, each beat = 0.5s. Beat 3 = 1.0s
    expect(beatsToSeconds(1, 3, 120, { beats: 4, beatType: 4 })).toBeCloseTo(1.0, 5);
  });
  it("converts beat 1 of measure 2 to 2 seconds at 120bpm 4/4", () => {
    // Measure 2 starts at beat 4 offset = 2.0s
    expect(beatsToSeconds(2, 1, 120, { beats: 4, beatType: 4 })).toBeCloseTo(2.0, 5);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd frontend
npx vitest run src/utils/noteUtils.test.ts
```

Expected: `Cannot find module './noteUtils'`

- [ ] **Step 3: Implement noteUtils.ts**

```typescript
// frontend/src/utils/noteUtils.ts

const NOTE_STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMITONES_FROM_C = [0, 2, 4, 5, 7, 9, 11];

export function noteToFrequency(step: string, octave: number, alter: number): number {
  const semitoneFromC = SEMITONES_FROM_C[NOTE_STEPS.indexOf(step)] + alter;
  // MIDI note number: C4 = 60
  const midi = (octave + 1) * 12 + semitoneFromC;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToNoteName(hz: number): string {
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${noteNames[noteIndex]}${octave}`;
}

export interface TimeSignature {
  beats: number;
  beatType: number;
}

export function beatsToSeconds(
  measure: number,
  beat: number,
  tempo: number,
  timeSignature: TimeSignature
): number {
  const secondsPerBeat = 60 / tempo;
  const beatsPerMeasure = timeSignature.beats;
  const absoluteBeat = (measure - 1) * beatsPerMeasure + (beat - 1);
  return absoluteBeat * secondsPerBeat;
}
```

- [ ] **Step 4: Run noteUtils tests**

```bash
cd frontend
npx vitest run src/utils/noteUtils.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Write failing test for musicxml**

```typescript
// frontend/src/utils/musicxml.test.ts
import { describe, it, expect } from "vitest";
import { parseScore } from "./musicxml";

const SIMPLE_MXL_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note><rest/><duration>12</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe("parseScore", () => {
  it("extracts parts", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0].id).toBe("P1");
    expect(score.parts[0].name).toBe("Soprano");
  });

  it("extracts tempo from sound element", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    expect(score.tempo).toBe(120);
  });

  it("extracts notes with pitch", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    const notes = score.parts[0].measures[0].notes;
    const pitched = notes.filter((n) => !n.isRest);
    expect(pitched).toHaveLength(1);
    expect(pitched[0].pitch?.step).toBe("A");
    expect(pitched[0].pitch?.octave).toBe(4);
  });

  it("extracts rest notes", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    const notes = score.parts[0].measures[0].notes;
    const rests = notes.filter((n) => n.isRest);
    expect(rests).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

```bash
cd frontend
npx vitest run src/utils/musicxml.test.ts
```

Expected: `Cannot find module './musicxml'`

- [ ] **Step 7: Implement musicxml.ts**

```typescript
// frontend/src/utils/musicxml.ts
import JSZip from "jszip";
import type { ParsedScore, Part, Measure, Note } from "../types";

export async function loadFile(file: File): Promise<string> {
  if (file.name.endsWith(".mxl")) {
    const zip = await JSZip.loadAsync(file);
    const xmlEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.endsWith(".xml") && !f.name.startsWith("META-INF")
    );
    if (!xmlEntry) throw new Error("No XML found in .mxl archive");
    return xmlEntry.async("string");
  }
  return file.text();
}

export function parseScore(xmlString: string): ParsedScore {
  const doc = new DOMParser().parseFromString(xmlString, "application/xml");

  // Extract tempo (default 120)
  let tempo = 120;
  const soundEl = doc.querySelector("sound[tempo]");
  if (soundEl) tempo = parseFloat(soundEl.getAttribute("tempo")!);

  // Extract parts
  const partListEls = doc.querySelectorAll("part-list > score-part");
  const partNames: Record<string, string> = {};
  partListEls.forEach((el) => {
    const id = el.getAttribute("id")!;
    partNames[id] = el.querySelector("part-name")?.textContent?.trim() ?? id;
  });

  const partEls = doc.querySelectorAll("score-partwise > part");
  const parts: Part[] = Array.from(partEls).map((partEl) => {
    const id = partEl.getAttribute("id")!;
    let divisions = 1;
    let beats = 4;
    let beatType = 4;

    const measures: Measure[] = Array.from(partEl.querySelectorAll("measure")).map(
      (measureEl) => {
        const number = parseInt(measureEl.getAttribute("number") ?? "1");

        const divEl = measureEl.querySelector("attributes > divisions");
        if (divEl) divisions = parseInt(divEl.textContent!);

        const beatsEl = measureEl.querySelector("attributes > time > beats");
        if (beatsEl) beats = parseInt(beatsEl.textContent!);

        const beatTypeEl = measureEl.querySelector("attributes > time > beat-type");
        if (beatTypeEl) beatType = parseInt(beatTypeEl.textContent!);

        let currentDurationInDivisions = 0;
        const notes: Note[] = Array.from(measureEl.querySelectorAll("note")).map((noteEl) => {
          const isRest = !!noteEl.querySelector("rest");
          const duration = parseInt(noteEl.querySelector("duration")?.textContent ?? "1");
          const beatPosition = 1 + currentDurationInDivisions / divisions;
          currentDurationInDivisions += duration;

          const pitchEl = noteEl.querySelector("pitch");
          const pitch = pitchEl
            ? {
                step: pitchEl.querySelector("step")!.textContent!,
                octave: parseInt(pitchEl.querySelector("octave")!.textContent!),
                alter: parseFloat(pitchEl.querySelector("alter")?.textContent ?? "0"),
              }
            : null;

          return {
            measureNumber: number,
            beatPosition,
            duration: duration / divisions,
            pitch,
            isRest,
          };
        });

        return { number, beats, beatType, notes };
      }
    );

    return { id, name: partNames[id] ?? id, measures };
  });

  return { parts, tempo };
}
```

- [ ] **Step 8: Run musicxml tests**

```bash
cd frontend
npx vitest run src/utils/musicxml.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 9: Run all frontend tests**

```bash
cd frontend
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/utils/ frontend/src/types.ts
git commit -m "feat: add noteUtils, musicxml parser, and unit tests"
```

---

## Task 7: App shell and split panel layout

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace App.tsx with split panel shell**

```typescript
// frontend/src/App.tsx
import { useState } from "react";
import { useStore } from "./store/useStore";
import FileLoader from "./components/FileLoader";
import ScoreViewer from "./components/ScoreViewer";
import PitchGraph from "./components/PitchGraph";
import PassageSelector from "./components/PassageSelector";
import TransportControls from "./components/TransportControls";
import RecordButton from "./components/RecordButton";
import FeedbackPanel from "./components/FeedbackPanel";

type LeftTab = "score" | "pitch";

export default function App() {
  const [activeTab, setActiveTab] = useState<LeftTab>("score");
  const pitchData = useStore((s) => s.pitchData);

  // Auto-switch to pitch graph after analysis
  const prevPitchData = useStore((s) => s.pitchData);
  if (pitchData && prevPitchData !== pitchData) {
    setActiveTab("pitch");
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-gray-200 overflow-hidden">
      {/* Top bar */}
      <div className="border-b border-[#2a2a4e] px-4 py-2 flex-shrink-0">
        <FileLoader />
      </div>

      {/* Main split panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="flex-1 flex flex-col border-r border-[#2a2a4e] overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-[#2a2a4e] flex-shrink-0">
            <button
              className={`px-5 py-2 text-sm ${
                activeTab === "score"
                  ? "text-blue-300 border-b-2 border-blue-400 bg-[#1a1a2e]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab("score")}
            >
              Score
            </button>
            <button
              className={`px-5 py-2 text-sm ${
                activeTab === "pitch"
                  ? "text-blue-300 border-b-2 border-blue-400 bg-[#1a1a2e]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab("pitch")}
            >
              Pitch Graph
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {activeTab === "score" ? <ScoreViewer /> : <PitchGraph />}
          </div>
        </div>

        {/* Right panel */}
        <div className="w-56 flex flex-col overflow-y-auto bg-[#12121f]">
          <PassageSelector />
          <TransportControls />
          <RecordButton />
          <FeedbackPanel />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create stub components so App compiles**

Create each of these as a minimal stub (real implementation in later tasks):

```typescript
// frontend/src/components/FileLoader.tsx
export default function FileLoader() {
  return <div className="text-sm text-gray-400">File Loader</div>;
}
```

```typescript
// frontend/src/components/ScoreViewer.tsx
export default function ScoreViewer() {
  return <div className="p-4 text-gray-500">Load a file to get started</div>;
}
```

```typescript
// frontend/src/components/PitchGraph.tsx
export default function PitchGraph() {
  return <div className="p-4 text-gray-500">Record to see pitch graph</div>;
}
```

```typescript
// frontend/src/components/PassageSelector.tsx
export default function PassageSelector() {
  return <div className="p-3 border-b border-[#2a2a4e] text-xs text-gray-500">Passage</div>;
}
```

```typescript
// frontend/src/components/TransportControls.tsx
export default function TransportControls() {
  return <div className="p-3 border-b border-[#2a2a4e] text-xs text-gray-500">Transport</div>;
}
```

```typescript
// frontend/src/components/RecordButton.tsx
export default function RecordButton() {
  return <div className="p-3 border-b border-[#2a2a4e] text-xs text-gray-500">Record</div>;
}
```

```typescript
// frontend/src/components/FeedbackPanel.tsx
export default function FeedbackPanel() {
  return <div className="p-3 text-xs text-gray-500">Feedback</div>;
}
```

- [ ] **Step 3: Fix the auto-tab-switch logic in App.tsx**

The auto-switch logic in Step 1 is incorrect (hooks can't be called conditionally). Replace App.tsx with this corrected version:

```typescript
// frontend/src/App.tsx
import { useState, useEffect } from "react";
import { useStore } from "./store/useStore";
import FileLoader from "./components/FileLoader";
import ScoreViewer from "./components/ScoreViewer";
import PitchGraph from "./components/PitchGraph";
import PassageSelector from "./components/PassageSelector";
import TransportControls from "./components/TransportControls";
import RecordButton from "./components/RecordButton";
import FeedbackPanel from "./components/FeedbackPanel";

type LeftTab = "score" | "pitch";

export default function App() {
  const [activeTab, setActiveTab] = useState<LeftTab>("score");
  const pitchData = useStore((s) => s.pitchData);

  useEffect(() => {
    if (pitchData) setActiveTab("pitch");
  }, [pitchData]);

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-gray-200 overflow-hidden">
      <div className="border-b border-[#2a2a4e] px-4 py-2 flex-shrink-0">
        <FileLoader />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-[#2a2a4e] overflow-hidden">
          <div className="flex border-b border-[#2a2a4e] flex-shrink-0">
            <button
              className={`px-5 py-2 text-sm ${
                activeTab === "score"
                  ? "text-blue-300 border-b-2 border-blue-400 bg-[#1a1a2e]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab("score")}
            >
              Score
            </button>
            <button
              className={`px-5 py-2 text-sm ${
                activeTab === "pitch"
                  ? "text-blue-300 border-b-2 border-blue-400 bg-[#1a1a2e]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab("pitch")}
            >
              Pitch Graph
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {activeTab === "score" ? <ScoreViewer /> : <PitchGraph />}
          </div>
        </div>
        <div className="w-56 flex flex-col overflow-y-auto bg-[#12121f]">
          <PassageSelector />
          <TransportControls />
          <RecordButton />
          <FeedbackPanel />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify in browser**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — expect dark split panel with Score/Pitch Graph tabs and right panel with stub labels.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/
git commit -m "feat: add app shell with split panel layout and stub components"
```

---

## Task 8: FileLoader component

**Files:**
- Modify: `frontend/src/components/FileLoader.tsx`

- [ ] **Step 1: Implement FileLoader**

```typescript
// frontend/src/components/FileLoader.tsx
import { useRef } from "react";
import { useStore } from "../store/useStore";
import { loadFile, parseScore } from "../utils/musicxml";

export default function FileLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { parsedScore, voicePartId, accompanimentPartId, setParsedScore, setVoicePartId, setAccompanimentPartId } =
    useStore();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const xml = await loadFile(file);
    const score = parseScore(xml);
    setParsedScore(score);
    setVoicePartId(null);
    setAccompanimentPartId(null);
  }

  const parts = parsedScore?.parts ?? [];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <button
        className="px-3 py-1 bg-[#1e3a5f] text-blue-300 rounded text-sm hover:bg-[#2a4a6f]"
        onClick={() => inputRef.current?.click()}
      >
        Load File
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.musicxml,.mxl"
        className="hidden"
        onChange={handleFile}
      />

      {parts.length > 0 && (
        <>
          <label className="text-xs text-gray-400">
            Voice:
            <select
              className="ml-1 bg-[#1a1a2e] text-gray-200 rounded px-1 py-0.5 text-xs border border-[#2a2a4e]"
              value={voicePartId ?? ""}
              onChange={(e) => setVoicePartId(e.target.value || null)}
            >
              <option value="">— none —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-400">
            Accompaniment:
            <select
              className="ml-1 bg-[#1a1a2e] text-gray-200 rounded px-1 py-0.5 text-xs border border-[#2a2a4e]"
              value={accompanimentPartId ?? ""}
              onChange={(e) => setAccompanimentPartId(e.target.value || null)}
            >
              <option value="">— none —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually test**

Start the dev server, load `die-lotosblume.mxl` — expect the part dropdowns to appear with part names from the file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FileLoader.tsx
git commit -m "feat: implement FileLoader with MusicXML parsing and part assignment"
```

---

## Task 9: ScoreViewer (OSMD)

**Files:**
- Modify: `frontend/src/components/ScoreViewer.tsx`

Note: OSMD manipulates the DOM directly and cannot be unit tested with jsdom. This task is verified manually.

- [ ] **Step 1: Implement ScoreViewer**

```typescript
// frontend/src/components/ScoreViewer.tsx
import { useEffect, useRef } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useStore } from "../store/useStore";

export default function ScoreViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const parsedScore = useStore((s) => s.parsedScore);
  const rawXmlRef = useRef<string | null>(null);

  // Store raw XML alongside parsedScore by piggy-backing on the file loader
  // We re-expose OSMD instance on window for useAudioEngine cursor control
  useEffect(() => {
    if (!containerRef.current) return;
    osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawingParameters: "default",
      drawCredits: false,
    });
    (window as any).__osmd = osmdRef.current;
  }, []);

  useEffect(() => {
    if (!osmdRef.current || !parsedScore) return;
    // Re-read from the store's raw XML (set by FileLoader via useRawXml store key)
    const xml = (window as any).__lastLoadedXml;
    if (!xml) return;
    osmdRef.current.load(xml).then(() => {
      osmdRef.current!.render();
      osmdRef.current!.cursor.show();
    });
  }, [parsedScore]);

  if (!parsedScore) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Load a file to get started
      </div>
    );
  }

  return <div ref={containerRef} className="p-4 bg-white rounded m-2" />;
}
```

- [ ] **Step 2: Store raw XML in FileLoader for OSMD**

Modify `frontend/src/components/FileLoader.tsx` — add one line after `loadFile(file)`:

```typescript
async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  const xml = await loadFile(file);
  (window as any).__lastLoadedXml = xml;  // add this line
  const score = parseScore(xml);
  setParsedScore(score);
  setVoicePartId(null);
  setAccompanimentPartId(null);
}
```

- [ ] **Step 3: Manually test**

Load `die-lotosblume.mxl` — score should render in the left panel. Check that the cursor is visible (arrow at start of score).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ScoreViewer.tsx frontend/src/components/FileLoader.tsx
git commit -m "feat: integrate OSMD score viewer"
```

---

## Task 10: PassageSelector

**Files:**
- Modify: `frontend/src/components/PassageSelector.tsx`

- [ ] **Step 1: Implement PassageSelector**

```typescript
// frontend/src/components/PassageSelector.tsx
import { useState } from "react";
import { useStore } from "../store/useStore";

export default function PassageSelector() {
  const { parsedScore, setPassage } = useStore();
  const [startMeasure, setStartMeasure] = useState(1);
  const [startBeat, setStartBeat] = useState(1);
  const [endMeasure, setEndMeasure] = useState(1);
  const [endBeat, setEndBeat] = useState(4);

  const lastMeasure = parsedScore?.parts[0]?.measures.at(-1)?.number ?? 1;
  const lastBeats = parsedScore?.parts[0]?.measures.at(-1)?.beats ?? 4;

  function handleWholePiece() {
    setStartMeasure(1);
    setStartBeat(1);
    setEndMeasure(lastMeasure);
    setEndBeat(lastBeats);
    setPassage({ startMeasure: 1, startBeat: 1, endMeasure: lastMeasure, endBeat: lastBeats });
  }

  function handleApply() {
    setPassage({ startMeasure, startBeat, endMeasure, endBeat });
  }

  if (!parsedScore) return null;

  return (
    <div className="p-3 border-b border-[#2a2a4e]">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Passage</div>
      <div className="grid grid-cols-2 gap-1 text-xs mb-2">
        <label className="text-gray-400">
          Start M
          <input
            type="number" min={1} max={lastMeasure} value={startMeasure}
            onChange={(e) => setStartMeasure(parseInt(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
        <label className="text-gray-400">
          Beat
          <input
            type="number" min={1} step={0.25} value={startBeat}
            onChange={(e) => setStartBeat(parseFloat(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
        <label className="text-gray-400">
          End M
          <input
            type="number" min={1} max={lastMeasure} value={endMeasure}
            onChange={(e) => setEndMeasure(parseInt(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
        <label className="text-gray-400">
          Beat
          <input
            type="number" min={1} step={0.25} value={endBeat}
            onChange={(e) => setEndBeat(parseFloat(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
      </div>
      <div className="flex gap-1">
        <button onClick={handleWholePiece} className="flex-1 text-[10px] bg-[#1a1a2e] text-gray-400 rounded py-0.5 hover:text-gray-200">
          Whole piece
        </button>
        <button onClick={handleApply} className="flex-1 text-[10px] bg-[#1e3a5f] text-blue-300 rounded py-0.5 hover:bg-[#2a4a6f]">
          Apply
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually test**

Load a file, set passage values, click Apply. Open React DevTools and verify the `passage` slice in the store updates correctly.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PassageSelector.tsx
git commit -m "feat: implement passage selector"
```

---

## Task 11: useAudioEngine hook and TransportControls

**Files:**
- Create: `frontend/src/hooks/useAudioEngine.ts`
- Modify: `frontend/src/components/TransportControls.tsx`

- [ ] **Step 1: Install soundfont-player type stubs if needed**

```bash
cd frontend
npm install soundfont-player
```

- [ ] **Step 2: Implement useAudioEngine.ts**

```typescript
// frontend/src/hooks/useAudioEngine.ts
import { useCallback, useRef } from "react";
import * as Tone from "tone";
import Soundfont from "soundfont-player";
import { useStore } from "../store/useStore";
import { noteToFrequency, beatsToSeconds } from "../utils/noteUtils";
import type { Part } from "../types";

const AC = new AudioContext();

async function getInstrument(name: string) {
  return Soundfont.instrument(AC, name as any, { soundfont: "MusyngKite" });
}

export function useAudioEngine() {
  const instrumentsRef = useRef<Record<string, any>>({});
  const { parsedScore, voicePartId, accompanimentPartId, passage, playVoice, playAccompaniment, setIsPlaying } =
    useStore.getState();

  const getPassageBounds = useCallback(() => {
    const state = useStore.getState();
    const score = state.parsedScore;
    if (!score) return null;
    const p = state.passage;
    const allMeasures = score.parts[0]?.measures ?? [];
    const lastMeasure = allMeasures.at(-1);
    if (!lastMeasure) return null;
    const start = p
      ? beatsToSeconds(p.startMeasure, p.startBeat, score.tempo, allMeasures[0])
      : 0;
    const end = p
      ? beatsToSeconds(p.endMeasure, p.endBeat, score.tempo, lastMeasure)
      : beatsToSeconds(lastMeasure.number, lastMeasure.beats + 1, score.tempo, lastMeasure);
    return { start, end, duration: end - start };
  }, []);

  const schedulePartNotes = useCallback(
    async (part: Part, instrument: any, passageStart: number, passageEnd: number, score: any) => {
      for (const measure of part.measures) {
        for (const note of measure.notes) {
          if (!note.pitch || note.isRest) continue;
          const noteStart = beatsToSeconds(measure.number, note.beatPosition, score.tempo, measure);
          if (noteStart < passageStart || noteStart >= passageEnd) continue;
          const offset = noteStart - passageStart;
          const durationSec = (note.duration / measure.beats) * (60 / score.tempo) * measure.beats;
          const freq = noteToFrequency(note.pitch.step, note.pitch.octave, note.pitch.alter);
          Tone.getTransport().schedule((time) => {
            instrument.play(freq.toString(), AC.currentTime + time, { duration: durationSec });
          }, offset);
        }
      }
    },
    []
  );

  const play = useCallback(async (onEnd?: () => void) => {
    const state = useStore.getState();
    const score = state.parsedScore;
    if (!score) return;
    const bounds = getPassageBounds();
    if (!bounds) return;

    await Tone.start();
    Tone.getTransport().cancel();
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;

    const osmd: any = (window as any).__osmd;
    if (osmd) {
      osmd.cursor.reset();
      osmd.cursor.show();
    }

    // Load instruments
    if (state.playVoice && state.voicePartId) {
      if (!instrumentsRef.current["voice"]) {
        instrumentsRef.current["voice"] = await getInstrument("choir-aahs");
      }
    }
    if (state.playAccompaniment && state.accompanimentPartId) {
      if (!instrumentsRef.current["piano"]) {
        instrumentsRef.current["piano"] = await getInstrument("acoustic-grand-piano");
      }
    }

    // Schedule notes
    for (const part of score.parts) {
      if (part.id === state.voicePartId && state.playVoice) {
        await schedulePartNotes(part, instrumentsRef.current["voice"], bounds.start, bounds.end, score);
      }
      if (part.id === state.accompanimentPartId && state.playAccompaniment) {
        await schedulePartNotes(part, instrumentsRef.current["piano"], bounds.start, bounds.end, score);
      }
    }

    // Cursor advance
    let cursorBeat = 0;
    const beatDuration = 60 / score.tempo;
    Tone.getTransport().scheduleRepeat((time) => {
      cursorBeat += 0.25;
      const osmdNow: any = (window as any).__osmd;
      if (osmdNow) osmdNow.cursor.next();
    }, "16n");

    // Auto-stop
    Tone.getTransport().schedule(() => {
      Tone.getTransport().stop();
      useStore.getState().setIsPlaying(false);
      onEnd?.();
    }, bounds.duration);

    Tone.getTransport().start();
    useStore.getState().setIsPlaying(true);
  }, [getPassageBounds, schedulePartNotes]);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    useStore.getState().setIsPlaying(false);
  }, []);

  return { play, stop };
}
```

- [ ] **Step 3: Implement TransportControls**

```typescript
// frontend/src/components/TransportControls.tsx
import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useState } from "react";

export default function TransportControls() {
  const { isPlaying, playVoice, playAccompaniment, octaveDown, parsedScore,
    setPlayVoice, setPlayAccompaniment, setOctaveDown } = useStore();
  const { play, stop } = useAudioEngine();
  const [repeat, setRepeat] = useState(false);

  function handlePlay() {
    play(repeat ? () => play() : undefined);
  }

  if (!parsedScore) return null;

  return (
    <div className="p-3 border-b border-[#2a2a4e]">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Playback</div>
      <div className="flex gap-1 mb-2">
        <button
          onClick={isPlaying ? stop : handlePlay}
          className={`flex-1 text-xs py-1 rounded ${
            isPlaying ? "bg-[#3a2a4e] text-purple-300" : "bg-[#1e3a5f] text-blue-300"
          }`}
        >
          {isPlaying ? "⏹ Stop" : "▶ Play"}
        </button>
        <button
          onClick={() => setRepeat(!repeat)}
          className={`px-2 text-xs rounded ${repeat ? "bg-[#2a3a2e] text-green-300" : "bg-[#1a1a2e] text-gray-500"}`}
        >
          ⟳
        </button>
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={playVoice} onChange={(e) => setPlayVoice(e.target.checked)} className="accent-blue-400" />
          Voice
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={playAccompaniment} onChange={(e) => setPlayAccompaniment(e.target.checked)} className="accent-blue-400" />
          Accompaniment
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={octaveDown} onChange={(e) => setOctaveDown(e.target.checked)} className="accent-blue-400" />
          Octave ↓ (graph only)
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manually test**

Load `die-lotosblume.mxl`, assign parts, click Play — expect audio to play and OSMD cursor to advance. Stop button works. ⟳ loops.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useAudioEngine.ts frontend/src/components/TransportControls.tsx
git commit -m "feat: add audio engine and transport controls"
```

---

## Task 12: useMicRecorder hook and RecordButton

**Files:**
- Create: `frontend/src/hooks/useMicRecorder.ts`
- Modify: `frontend/src/components/RecordButton.tsx`

- [ ] **Step 1: Implement useMicRecorder**

```typescript
// frontend/src/hooks/useMicRecorder.ts
import { useRef, useCallback } from "react";
import { useStore } from "../store/useStore";

export function useMicRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { setIsRecording, setLastRecordingBlob } = useStore.getState();

  const start = useCallback(async (durationMs: number, onStop: (blob: Blob) => void) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setLastRecordingBlob(blob);
      onStop(blob);
      stream.getTracks().forEach((t) => t.stop());
    };

    recorder.start(100); // collect chunks every 100ms
    setIsRecording(true);

    // Auto-stop after passage duration
    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, durationMs);
  }, [setIsRecording, setLastRecordingBlob]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    useStore.getState().setIsRecording(false);
  }, []);

  return { start, stop };
}
```

- [ ] **Step 2: Implement RecordButton**

```typescript
// frontend/src/components/RecordButton.tsx
import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useMicRecorder } from "../hooks/useMicRecorder";
import { usePitchAnalysis } from "../hooks/usePitchAnalysis";
import { beatsToSeconds } from "../utils/noteUtils";

export default function RecordButton() {
  const { parsedScore, passage, isRecording, setIsRecording } = useStore();
  const { play, stop: stopPlayback } = useAudioEngine();
  const { start: startRecording, stop: stopRecording } = useMicRecorder();
  const { analyze } = usePitchAnalysis();

  function getPassageDurationMs(): number {
    const score = parsedScore;
    if (!score) return 0;
    if (!passage) {
      const last = score.parts[0]?.measures.at(-1);
      if (!last) return 0;
      const end = beatsToSeconds(last.number, last.beats + 1, score.tempo, last);
      return end * 1000;
    }
    const allMeasures = score.parts[0]?.measures ?? [];
    const startSec = beatsToSeconds(passage.startMeasure, passage.startBeat, score.tempo, allMeasures[0]);
    const endSec = beatsToSeconds(passage.endMeasure, passage.endBeat, score.tempo, allMeasures.at(-1)!);
    return (endSec - startSec) * 1000;
  }

  async function handleRecord() {
    if (isRecording) {
      stopRecording();
      stopPlayback();
      return;
    }
    const durationMs = getPassageDurationMs();
    play();
    await startRecording(durationMs, async (blob) => {
      setIsRecording(false);
      await analyze(blob);
    });
  }

  if (!parsedScore) return null;

  return (
    <div className="p-3 border-b border-[#2a2a4e]">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Record</div>
      <button
        onClick={handleRecord}
        className={`w-full text-sm py-1.5 rounded ${
          isRecording
            ? "bg-red-900 text-red-300 animate-pulse"
            : "bg-[#7f1d1d] text-red-300 hover:bg-red-900"
        }`}
      >
        {isRecording ? "⏹ Stop Recording" : "🎤 Record"}
      </button>
      <div className="mt-1.5 text-[10px] text-red-400">⚠ Use headphones</div>
    </div>
  );
}
```

- [ ] **Step 3: Create stub usePitchAnalysis so RecordButton compiles**

```typescript
// frontend/src/hooks/usePitchAnalysis.ts
export function usePitchAnalysis() {
  return {
    analyze: async (_blob: Blob) => {},
  };
}
```

- [ ] **Step 4: Manually test**

Load file, put on headphones, click Record — expect browser mic permission prompt, then recording starts and plays back audio simultaneously. Auto-stops after passage duration.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMicRecorder.ts frontend/src/components/RecordButton.tsx frontend/src/hooks/usePitchAnalysis.ts
git commit -m "feat: add mic recorder and record button"
```

---

## Task 13: usePitchAnalysis hook

**Files:**
- Modify: `frontend/src/hooks/usePitchAnalysis.ts`

- [ ] **Step 1: Implement usePitchAnalysis**

```typescript
// frontend/src/hooks/usePitchAnalysis.ts
import { useCallback } from "react";
import { useStore } from "../store/useStore";
import { noteToFrequency, beatsToSeconds } from "../utils/noteUtils";
import type { TargetNote, PitchFrame } from "../types";

export function usePitchAnalysis() {
  const { setPitchData, setTargetNotes } = useStore.getState();

  const computeTargetNotes = useCallback((): TargetNote[] => {
    const state = useStore.getState();
    const score = state.parsedScore;
    const voicePart = score?.parts.find((p) => p.id === state.voicePartId);
    if (!score || !voicePart) return [];

    const allMeasures = score.parts[0].measures;
    const p = state.passage;
    const passageStart = p
      ? beatsToSeconds(p.startMeasure, p.startBeat, score.tempo, allMeasures[0])
      : 0;
    const passageEnd = p
      ? beatsToSeconds(p.endMeasure, p.endBeat, score.tempo, allMeasures.at(-1)!)
      : Infinity;

    const targets: TargetNote[] = [];
    for (const measure of voicePart.measures) {
      for (const note of measure.notes) {
        if (!note.pitch || note.isRest) continue;
        const startSec = beatsToSeconds(measure.number, note.beatPosition, score.tempo, measure);
        if (startSec < passageStart || startSec >= passageEnd) continue;
        const durationSec = (note.duration / measure.beats) * (60 / score.tempo) * measure.beats;
        let freq = noteToFrequency(note.pitch.step, note.pitch.octave, note.pitch.alter);
        if (state.octaveDown) freq /= 2;
        targets.push({
          startTime: startSec - passageStart,
          endTime: startSec - passageStart + durationSec,
          frequency: freq,
        });
      }
    }
    return targets;
  }, []);

  const analyze = useCallback(async (blob: Blob) => {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");

    const res = await fetch("http://localhost:8000/analyze-pitch", {
      method: "POST",
      body: form,
    });

    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data: { frames: PitchFrame[]; duration: number } = await res.json();

    setPitchData(data.frames);
    setTargetNotes(computeTargetNotes());
  }, [computeTargetNotes, setPitchData, setTargetNotes]);

  return { analyze };
}
```

- [ ] **Step 2: Manually test (backend must be running)**

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

Record a passage — after recording stops, check React DevTools: `pitchData` and `targetNotes` should be populated in the Zustand store.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/usePitchAnalysis.ts
git commit -m "feat: implement pitch analysis hook with CREPE backend integration"
```

---

## Task 14: PitchGraph component

**Files:**
- Modify: `frontend/src/components/PitchGraph.tsx`

- [ ] **Step 1: Implement PitchGraph**

```typescript
// frontend/src/components/PitchGraph.tsx
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useStore } from "../store/useStore";
import { frequencyToNoteName } from "../utils/noteUtils";
import type { PitchFrame, TargetNote } from "../types";

// Convert TargetNote[] into a stepped-line dataset for Recharts
function buildTargetData(targetNotes: TargetNote[], duration: number) {
  const points: { time: number; target: number | null }[] = [];
  if (targetNotes.length === 0) return points;

  const step = 0.01;
  for (let t = 0; t <= duration; t = Math.round((t + step) * 1000) / 1000) {
    const note = targetNotes.find((n) => t >= n.startTime && t < n.endTime);
    points.push({ time: t, target: note ? note.frequency : null });
  }
  return points;
}

// Merge target data and pitch frames into a single dataset
function buildChartData(
  pitchData: PitchFrame[],
  targetNotes: TargetNote[],
  duration: number
) {
  const targetMap = new Map<number, number | null>();
  buildTargetData(targetNotes, duration).forEach((p) => targetMap.set(p.time, p.target));

  const allTimes = new Set([
    ...pitchData.map((f) => Math.round(f.time * 100) / 100),
    ...Array.from(targetMap.keys()),
  ]);

  return Array.from(allTimes)
    .sort((a, b) => a - b)
    .map((t) => {
      const frame = pitchData.find((f) => Math.abs(f.time - t) < 0.01);
      return {
        time: t,
        target: targetMap.get(t) ?? null,
        voice: frame && frame.confidence >= 0.5 ? frame.frequency : null,
        voiceFaint: frame && frame.confidence < 0.5 ? frame.frequency : null,
      };
    });
}

const NOTE_TICKS = [
  { freq: 130.81, label: "C3" }, { freq: 164.81, label: "E3" },
  { freq: 196.00, label: "G3" }, { freq: 261.63, label: "C4" },
  { freq: 329.63, label: "E4" }, { freq: 392.00, label: "G4" },
  { freq: 523.25, label: "C5" }, { freq: 659.25, label: "E5" },
  { freq: 783.99, label: "G5" }, { freq: 1046.50, label: "C6" },
];

export default function PitchGraph() {
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);

  if (!pitchData || !targetNotes) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Record to see pitch graph
      </div>
    );
  }

  const duration = pitchData.at(-1)?.time ?? 0;
  const data = buildChartData(pitchData, targetNotes, duration);

  const allFreqs = [
    ...pitchData.map((f) => f.frequency),
    ...targetNotes.map((n) => n.frequency),
  ].filter(Boolean);
  const minFreq = Math.max(80, Math.min(...allFreqs) * 0.7);
  const maxFreq = Math.min(2000, Math.max(...allFreqs) * 1.3);

  const visibleTicks = NOTE_TICKS.filter((t) => t.freq >= minFreq && t.freq <= maxFreq);

  return (
    <div className="h-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, duration]}
            tickFormatter={(v: number) => `${v.toFixed(1)}s`}
            stroke="#4a5568"
            tick={{ fill: "#718096", fontSize: 10 }}
          />
          <YAxis
            scale="log"
            domain={[minFreq, maxFreq]}
            ticks={visibleTicks.map((t) => t.freq)}
            tickFormatter={(v: number) => {
              const match = visibleTicks.find((t) => Math.abs(t.freq - v) < 1);
              return match ? match.label : "";
            }}
            stroke="#4a5568"
            tick={{ fill: "#718096", fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)} Hz (${frequencyToNoteName(value)})`,
              name === "target" ? "Target" : "Voice",
            ]}
            labelFormatter={(t: number) => `${t.toFixed(2)}s`}
            contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4e", fontSize: 11 }}
          />
          {/* Target: stepped blue line */}
          <Line
            dataKey="target"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="target"
          />
          {/* Voice: solid amber line (high confidence) */}
          <Line
            dataKey="voice"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="voice"
          />
          {/* Voice: faint amber line (low confidence) */}
          <Line
            dataKey="voiceFaint"
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeOpacity={0.2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="voiceFaint"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Manually test**

Record a passage. After analysis completes, the app auto-switches to the Pitch Graph tab. Verify:
- Blue stepped line shows at correct pitches for each note
- Amber line tracks your voice
- Y-axis shows note names (C3, E4, etc.)
- X-axis shows time in seconds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/PitchGraph.tsx
git commit -m "feat: implement pitch graph with stepped target line and voice overlay"
```

---

## Task 15: FeedbackPanel

**Files:**
- Modify: `frontend/src/components/FeedbackPanel.tsx`

- [ ] **Step 1: Implement FeedbackPanel**

```typescript
// frontend/src/components/FeedbackPanel.tsx
import { useRef, useEffect } from "react";
import { useStore } from "../store/useStore";

function computeStats(pitchData: import("../types").PitchFrame[], targetNotes: import("../types").TargetNote[]) {
  const errors: number[] = [];
  let voicedCount = 0;
  let onPitchCount = 0;

  for (const frame of pitchData) {
    if (frame.confidence < 0.5) continue;
    voicedCount++;
    const target = targetNotes.find(
      (n) => frame.time >= n.startTime && frame.time < n.endTime
    );
    if (!target) continue;
    // Convert to cents: 1200 * log2(f / target)
    const cents = Math.abs(1200 * Math.log2(frame.frequency / target.frequency));
    errors.push(cents);
    if (cents <= 50) onPitchCount++;
  }

  if (errors.length === 0) return null;

  const sorted = [...errors].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const pctOnPitch = Math.round((onPitchCount / errors.length) * 100);

  return { medianCents: Math.round(median), pctOnPitch };
}

export default function FeedbackPanel() {
  const lastRecordingBlob = useStore((s) => s.lastRecordingBlob);
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastRecordingBlob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(lastRecordingBlob);
    if (audioRef.current) audioRef.current.src = urlRef.current;
  }, [lastRecordingBlob]);

  if (!lastRecordingBlob) return null;

  const stats = pitchData && targetNotes ? computeStats(pitchData, targetNotes) : null;

  return (
    <div className="p-3">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Feedback</div>
      <audio ref={audioRef} controls className="w-full" style={{ height: 28 }} />
      <button
        onClick={() => audioRef.current?.play()}
        className="w-full mt-2 text-xs py-1.5 bg-[#1a3a2e] text-emerald-300 rounded hover:bg-[#1e4a38]"
      >
        ▶ Play My Recording
      </button>
      {stats && (
        <div className="mt-3 space-y-1 text-xs text-gray-400">
          <div>
            Median error:{" "}
            <span className="text-yellow-400 font-mono">{stats.medianCents} cents</span>
          </div>
          <div>
            On pitch:{" "}
            <span className={stats.pctOnPitch >= 70 ? "text-emerald-400" : "text-red-400"}>
              {stats.pctOnPitch}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually test**

After recording and analysis, verify:
- "▶ Play My Recording" button appears and plays the raw recording
- Median cents error and on-pitch % show in the right panel
- Stats are green when ≥ 70% on pitch, red otherwise

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FeedbackPanel.tsx
git commit -m "feat: implement feedback panel with playback and pitch stats"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Backend FastAPI + CREPE | Tasks 1–3 |
| POST /analyze-pitch | Task 3 |
| CORS for localhost:5173 | Task 1 |
| React + Vite + Tailwind scaffold | Task 4 |
| Zustand store with all fields | Task 5 |
| PitchFrame / TargetNote types | Task 5 |
| noteToFrequency / frequencyToNoteName / beatsToSeconds | Task 6 |
| musicxml.ts + JSZip .mxl support | Task 6 |
| Split panel layout | Task 7 |
| Score / Pitch Graph tabs | Task 7 |
| Auto-switch to Pitch Graph after analysis | Task 7 |
| FileLoader + part dropdowns | Task 8 |
| ScoreViewer (OSMD) | Task 9 |
| PassageSelector (4 inputs + whole piece) | Task 10 |
| Playback with Tone.js + soundfonts | Task 11 |
| Voice / accomp toggles | Task 11 |
| Octave-down toggle (graph only, not playback) | Task 11 |
| Repeat mode | Task 11 |
| OSMD cursor sync | Task 11 |
| useMicRecorder (getUserMedia + MediaRecorder) | Task 12 |
| Auto-stop recording at passage end | Task 12 |
| ⚠ Use headphones warning | Task 12 |
| usePitchAnalysis (POST blob + computeTargetNotes) | Task 13 |
| Octave-down applied to targetNotes | Task 13 |
| PitchGraph (log Y, stepped blue, amber voice) | Task 14 |
| Low-confidence frames at opacity 0.2 | Task 14 |
| FeedbackPanel + recording playback | Task 15 |
| Median cents error + % on pitch stats | Task 15 |

All spec requirements covered. No gaps found.
