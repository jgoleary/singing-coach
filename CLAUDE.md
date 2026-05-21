# Singing Coach — CLAUDE.md

## Project Overview

A personal singing practice tool. The user loads a MusicXML file, selects a passage, plays back synthesized parts, records themselves singing, and then sees a pitch accuracy graph and can replay their recording. The core value proposition is high-accuracy vocal pitch detection compared against the written voice part.

## Architecture

### Frontend
- **React 18 + TypeScript + Vite 8**
- **Tailwind CSS v4** — styling (uses `@import "tailwindcss"` + `@tailwindcss/vite` plugin, no `tailwind.config.js`)
- **OpenSheetMusicDisplay (OSMD)** — MusicXML rendering; instance exposed as `window.__osmd` for cursor control
- **Tone.js + soundfont-player** — audio synthesis; soundfont loads via MusyngKite CDN with Tone.js PolySynth fallback
- **Zustand** — global state (`frontend/src/store/useStore.ts`)
- **Recharts** — pitch feedback graph (ComposedChart, log-scale Y axis)
- **JSZip** — decompress `.mxl` files client-side

### Backend
- **FastAPI (Python 3.12)** — single endpoint for pitch detection
- **CREPE** — deep learning pitch detection model (runs locally, not deployed)
- **PyAV** — WebM/Opus decoding (no system ffmpeg required)
- **soundfile** — WAV/FLAC decoding
- Runs on `localhost:8080`
- Python 3.12 venv at `backend/venv312/`
- Started separately: `backend/venv312/bin/uvicorn backend.main:app --reload --port 8080`

### Communication
- Frontend records mic audio as WebM/Opus blob (Chrome MediaRecorder) via Web Audio API
- POST to `/analyze-pitch` (multipart form)
- Backend decodes audio (soundfile first, PyAV fallback for WebM), runs CREPE, returns JSON
- Frontend stores `PitchFrame[]` and computes `TargetNote[]` client-side from voice part

## Repository Structure

```
singing-coach/
├── CLAUDE.md
├── pytest.ini                    # asyncio_mode = auto
├── die-lotosblume.mxl            # sample MusicXML file
├── frontend/
│   ├── package.json
│   ├── vite.config.ts            # also configures vitest
│   ├── tsconfig.app.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx               # split panel layout, tab switching
│       ├── types.ts              # shared TypeScript interfaces
│       ├── store/
│       │   └── useStore.ts
│       ├── components/
│       │   ├── FileLoader.tsx
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
    ├── pitch_analyzer.py
    └── tests/
        ├── test_main.py
        └── test_pitch_analyzer.py
```

## Data Model

### types.ts
```typescript
interface Note {
  measureNumber: number;
  beatPosition: number;  // 1-indexed float (beat 1 = 1.0, beat 1.5 = 1.5)
  duration: number;      // in beats (divisions-normalized)
  pitch: { step: string; octave: number; alter: number } | null;
  isRest: boolean;
}
interface Measure { number: number; beats: number; beatType: number; notes: Note[]; }
interface Part { id: string; name: string; measures: Measure[]; }
interface ParsedScore { parts: Part[]; tempo: number; }

interface PitchFrame { time: number; frequency: number; confidence: number; }
interface TargetNote { startTime: number; endTime: number; frequency: number; }
interface Passage { startMeasure: number; startBeat: number; endMeasure: number; endBeat: number; }
```

### Global State (Zustand — useStore.ts)
```typescript
interface AppState {
  parsedScore: ParsedScore | null;
  voicePartId: string | null;
  accompanimentPartId: string | null;
  passage: Passage | null;           // endBeat is inclusive
  playVoice: boolean;
  playAccompaniment: boolean;
  isPlaying: boolean;
  octaveDown: boolean;               // graph display only — does NOT affect synthesis pitch
  isRecording: boolean;
  lastRecordingBlob: Blob | null;
  pitchData: PitchFrame[] | null;    // from backend
  targetNotes: TargetNote[] | null;  // computed client-side from voice part, NOT octave-shifted
  analysisStatus: "idle" | "analyzing" | "done" | "error";
  analysisError: string | null;
}
```

## Key Implementation Notes

### Passage Timing
- `beatsToSeconds(measure, beat, tempo, timeSig)` converts 1-indexed beat positions to absolute seconds
- **beatType is respected**: `secondsPerBeat = (60 / tempo) * (4 / timeSig.beatType)` — correct for 6/8, 3/4, 2/2 etc.
- **Passage end is inclusive**: internally `endBeat + 1` is used so notes starting on the end beat are included
- **Chord handling**: `<chord/>` notes do not advance the beat position counter

### Audio Engine (useAudioEngine.ts)
- Instruments loaded via `soundfont-player` using `Tone.getContext().rawContext` as the AudioContext
- Falls back to `Tone.PolySynth` when soundfont CDN load fails
- OSMD cursor advances by 16th-note ticks (approximate — visual drift is acceptable)
- Repeat loop uses refs to avoid stale closure issues

### Pitch Analysis (usePitchAnalysis.ts)
- `computeTargetNotes()` extracts notes from voice part for the current passage, converts to Hz
- `octaveDown` is applied at render time in `PitchGraph.tsx` (not stored in `targetNotes`)
- POSTs blob to `http://localhost:8080/analyze-pitch`
- Sets `analysisStatus` to "analyzing" immediately (PitchGraph shows spinner)

### Pitch Graph (PitchGraph.tsx)
- **Blue stepped line** (`#60a5fa`): target notes, built at 10ms resolution; octaveDown halves frequencies at render time
- **Amber solid line** (`#fbbf24`): voiced frames (confidence ≥ 0.5)
- **Amber faint line** (opacity 0.2): low-confidence frames
- Shows "Analyzing..." and error states via `analysisStatus`

### MusicXML / OSMD Bridge
- Raw XML stored in `window.__lastLoadedXml` by `FileLoader` so `ScoreViewer` can pass it to OSMD
- OSMD instance exposed as `window.__osmd` for cursor control in `useAudioEngine`

## Backend

### POST /analyze-pitch

**Request:** multipart form with `audio` file (WAV or WebM)

**Response:**
```json
{
  "frames": [{ "time": 0.0, "frequency": 220.5, "confidence": 0.91 }, ...],
  "duration": 4.32
}
```

**CORS:** allows all `http://localhost:*` origins via regex (`allow_origin_regex`).

**Audio decoding in pitch_analyzer.py:**
1. Try `soundfile.read()` (WAV, FLAC, AIFF)
2. On failure, fall back to PyAV (`av.open()`) — handles WebM/Opus from Chrome
3. Downmix stereo to mono by averaging channels
4. Run `crepe.predict(audio, sr, viterbi=True, step_size=10, verbose=0)`
5. Filter out frames where `frequency == 0`
6. 50 MB file size limit enforced at the API layer

## Development Startup

```bash
# Backend (Python 3.12 required)
cd singing-coach
backend/venv312/bin/pip install -r backend/requirements.txt
backend/venv312/bin/uvicorn backend.main:app --reload --port 8080

# Frontend
cd frontend
npm install
npm run dev
# → http://localhost:5173 (or next available port)
```

## Running Tests

```bash
# Backend (from repo root)
backend/venv312/bin/pytest backend/tests/ -v
# CREPE model downloads ~10MB on first run

# Frontend (MUST run from frontend/ directory)
cd frontend
npx vitest run
```

## Known Constraints

- **Headphones required** during recording — no AEC attempted, just UI warning
- **Chrome only** — MediaRecorder produces WebM/Opus; PyAV decodes it without system ffmpeg
- **CREPE model**: ~10MB TensorFlow model downloaded on first run, cached thereafter
- **Soundfont CDN**: `choir_aahs` and `acoustic_grand_piano` loaded from jsDelivr; PolySynth fallback if offline
- **OSMD cursor sync**: approximate (16th-note poll), visual drift is expected
- **Tests run from `frontend/`**: vitest picks up `vite.config.ts` relative to CWD — running from repo root uses wrong environment

## Out of Scope (v1)

- Rhythm evaluation
- Deployment / hosting
- Mobile support
- Multiple recordings per passage
- Export or saving of sessions
- Automated scoring or letter grades
- Real-time pitch display during recording
