# Singing Coach — AGENTS.md

## Project Overview

A personal singing practice tool. The user loads a MusicXML file, selects a passage, plays back synthesized parts, records themselves singing, and then sees a pitch accuracy graph and can replay their recording. The core value proposition is high-accuracy vocal pitch detection compared against the written voice part.

## Architecture

### Frontend
- **React + TypeScript + Vite**
- **OpenSheetMusicDisplay (OSMD)** — MusicXML rendering
- **Tone.js + soundfont-player** — audio synthesis for voice and accompaniment parts
- **Zustand** — global state
- **Tailwind CSS** — styling
- **Recharts** — pitch feedback graph

### Backend
- **FastAPI (Python)** — single endpoint for pitch detection
- **CREPE** — deep learning pitch detection model (runs locally, not deployed)
- Runs on `localhost:8000`
- Started separately: `uvicorn main:app --reload`

### Communication
- Frontend records mic audio as a WAV blob via Web Audio API
- POST to `/analyze-pitch` with the audio file
- Backend returns JSON: array of `{ time: float, frequency: float, confidence: float }`

## Repository Structure

```
singing-coach/
├── AGENTS.md
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── store/
│       │   └── useStore.ts
│       ├── components/
│       │   ├── FileLoader.tsx
│       │   ├── PartAssignment.tsx
│       │   ├── ScoreViewer.tsx
│       │   ├── PassageSelector.tsx
│       │   ├── TransportControls.tsx
│       │   ├── RecordButton.tsx
│       │   ├── FeedbackPanel.tsx
│       │   └── PitchGraph.tsx
│       ├── hooks/
│       │   ├── useAudioEngine.ts
│       │   ├── useMicRecorder.ts
│       │   └── usePitchAnalysis.ts
│       └── utils/
│           ├── musicxml.ts
│           └── noteUtils.ts
└── backend/
    ├── requirements.txt
    ├── main.py
    └── pitch_analyzer.py
```

## Data Model

### MusicXML Parsing (utils/musicxml.ts)
Parse with the browser's DOMParser. Extract:
- List of `Part`: `{ id, name, measures[] }`
- Each `Measure`: `{ number, beats: number, beatType: number, notes[] }`
- Each `Note`: `{ measureNumber, beatPosition: float, duration: float, pitch: { step, octave, alter } | null, isRest: boolean }`
- `beatPosition` is a float: beat 1 = 1.0, beat 2 = 2.0, beat 1.5 = 1.5, etc.

### Global State (Zustand)
```typescript
interface AppState {
  // Score
  parsedScore: ParsedScore | null;
  voicePartId: string | null;
  accompanimentPartId: string | null;

  // Passage
  passage: { startMeasure: number; startBeat: number; endMeasure: number; endBeat: number } | null;

  // Playback
  playVoice: boolean;
  playAccompaniment: boolean;
  isPlaying: boolean;
  octaveDown: boolean;

  // Recording
  isRecording: boolean;
  lastRecordingBlob: Blob | null;

  // Feedback
  pitchData: PitchFrame[] | null;  // from backend
  targetNotes: TargetNote[] | null; // extracted from voice part for current passage
}

interface PitchFrame {
  time: number;       // seconds from passage start
  frequency: number;  // Hz, 0 if unvoiced
  confidence: number; // 0–1
}

interface TargetNote {
  startTime: number;  // seconds from passage start
  endTime: number;
  frequency: number;  // Hz (440 = A4), adjusted for octaveDown if set
}
```

## Feature Specifications

### 1. File Loading & Part Assignment

- Accept `.mxl` (compressed) and `.xml`/`.musicxml` (uncompressed) via file input
- For `.mxl`: decompress using JSZip to extract the XML
- Parse with DOMParser, extract all `<Part>` elements and their `<part-name>` children
- Show a simple UI listing all parts with two dropdowns: "Voice part" and "Accompaniment part" (both optional — user can assign neither, one, or both)
- After assignment, render the score via OSMD

### 2. Score Display (OSMD)

- Render the full score in the score viewer
- Display a playback cursor that moves during playback
- Passage selection is done via the PassageSelector UI (not by clicking the score directly — OSMD interaction is complex)
- OSMD config: set `drawingParameters` to show all parts

### 3. Passage Selection

UI: four numeric inputs — Start Measure, Start Beat, End Measure, End Beat.
- Beats are 1-indexed floats (1.0, 1.5, 2.0, 2.5, etc.)
- Beat increments: 0.25 minimum (sixteenth note grid)
- Validate that end > start
- Show a "Select whole piece" button that auto-fills the fields
- Store passage in Zustand

### 4. Playback

- Synthesize using Tone.js + soundfont samples (use a General MIDI piano soundfont for accompaniment, a choir/voice soundfont or sine wave for the voice reference)
- Per-part toggle buttons: "Voice" and "Accompaniment" (toggle on/off independently)
- Play button: plays from passage start to end (or full piece if no passage set)
- Stop button
- One-click Repeat: a "⟳ Repeat" toggle — when on, loops the passage automatically
- Tempo: read from MusicXML `<sound tempo=...>` or `<metronome>` markings; default 120 BPM if absent
- Playback cursor: update OSMD cursor position in sync with Tone.js Transport

### 5. Recording

- Record button: starts Tone.js playback (respecting part toggles) AND opens mic via `getUserMedia`
- Capture mic via Web Audio API → MediaRecorder → collect chunks → assemble Blob on stop
- Record only the passage duration (auto-stop when passage ends), or manual stop
- **Headphones required notice**: show a persistent reminder banner: "⚠️ Use headphones to prevent mic bleed"
- After recording stops: send audio Blob to backend, receive PitchFrame array, store in state, show FeedbackPanel
- One-click Repeat for recording: re-record the passage immediately (discards previous recording)

### 6. Feedback Panel

Shown after a recording is completed. Contains:

**a) Pitch Graph (PitchGraph.tsx)**
- X-axis: time in seconds (passage duration)
- Y-axis: pitch in Hz, log scale (so semitones are evenly spaced), labeled with note names (C3, D3, etc.)
- Target notes: rendered as horizontal colored bars (blue, semi-transparent) at the correct frequency for each note's duration
- Detected pitch: rendered as a continuous line (yellow/amber), with opacity driven by confidence score (low confidence = faded)
- Notes with confidence < 0.5 should be visually de-emphasized (dashed or very faint)
- Octave-down toggle: when enabled, target note bars shift down one octave on the graph

**b) Recording Playback**
- A prominent "▶ Play My Recording" button
- Plays back the raw mic recording blob (use an `<audio>` element with an object URL)
- This is the primary feedback mechanism — the graph is secondary

**c) Stats (simple)**
- Median pitch error in cents (for frames with confidence > 0.5 and a matching target note)
- % of voiced frames within 50 cents of target

### 7. Octave Down

- A checkbox/toggle: "I'm singing an octave lower than written"
- When enabled: shift all target note frequencies down by one octave (÷2) before comparison and graph display
- Does not affect synthesis playback pitch

## Backend

### POST /analyze-pitch

**Request:** multipart form with `audio` file (WAV or WebM)

**Response:**
```json
{
  "frames": [
    { "time": 0.0, "frequency": 220.5, "confidence": 0.91 },
    { "time": 0.01, "frequency": 220.3, "confidence": 0.93 },
    ...
  ],
  "duration": 4.32
}
```

**Implementation (pitch_analyzer.py):**
```python
import crepe
import numpy as np
import soundfile as sf
import tempfile

def analyze(audio_bytes: bytes, content_type: str) -> dict:
    # Write to temp file, load with soundfile
    # Run crepe.predict(audio, sr, viterbi=True, step_size=10)
    # viterbi=True smooths pitch track — important for voice
    # step_size=10ms is sufficient resolution
    # Return frames filtering out frequency=0
    ...
```

**requirements.txt:**
```
fastapi
uvicorn
crepe
tensorflow  # crepe dependency
soundfile
numpy
python-multipart
```

**CORS:** allow `http://localhost:5173` (Vite dev server).

## Utility Functions

### noteUtils.ts
```typescript
// Convert MusicXML pitch to frequency
function noteToFrequency(step: string, octave: number, alter: number): number
// e.g. A4 → 440, C4 → 261.63

// Convert frequency to nearest note name
function frequencyToNoteName(hz: number): string
// e.g. 440 → "A4", 261.63 → "C4"

// Convert beats within a measure to absolute time (seconds)
function beatsToSeconds(measure: number, beat: number, tempo: number, timeSignature: TimeSignature): number
```

## Known Constraints & Notes

- **Headphones are required** during recording. The UI should make this obvious. Do not attempt acoustic echo cancellation — just enforce headphones via UI reminder.
- **CREPE model size**: ~10MB download on first run (TensorFlow will cache it). This is acceptable for a local tool.
- **`.mxl` files** are ZIP archives — use JSZip to decompress before passing to DOMParser.
- **OSMD and playback cursor sync**: use `Tone.Transport.scheduleRepeat` to poll position and call `osmd.cursor.next()` accordingly. This is approximate but sufficient.
- **Audio format**: MediaRecorder produces WebM/Opus on Chrome. The backend should handle this via soundfile + ffmpeg fallback, or instruct the user to use Chrome.
- **Confidence threshold**: treat frames with confidence < 0.5 as unvoiced (silence/noise). Do not include them in pitch error calculations.
- **Passage timing**: the backend receives raw audio starting from when Record was pressed. Frontend should trim/align based on the known passage duration when interpreting pitch frames.

## Development Startup

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Out of Scope (v1)

- Rhythm evaluation
- Deployment / hosting
- Mobile support
- Multiple recordings per passage
- Export or saving of sessions
- Automated scoring or letter grades
- Real-time pitch display during recording
