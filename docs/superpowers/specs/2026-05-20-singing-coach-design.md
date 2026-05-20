# Singing Coach — Design Spec

Date: 2026-05-20

## Overview

A local personal singing practice tool. The user loads a MusicXML file, assigns parts, selects a passage, plays back synthesized audio, records themselves singing, then reviews a pitch accuracy graph and replays their recording.

## Build Order

**Backend first.** The CREPE pitch detection integration is the highest-risk unknown. We validate the backend end-to-end before building the frontend, so no frontend work depends on an untested pitch pipeline.

1. Backend (FastAPI + CREPE)
2. Frontend scaffold + state
3. File loading + score display
4. Playback
5. Recording
6. Pitch feedback

## Layout

Split panel:

- **Left panel (tabbed):** "Score" tab shows OSMD score with playback cursor. "Pitch Graph" tab shows the pitch feedback graph. The app auto-switches to the Pitch Graph tab after a recording is analyzed.
- **Right panel:** All controls — part assignment, passage selector, transport, record button, feedback summary. Before a file is loaded, the right panel shows a "Load a file to get started" placeholder.

## Backend

**Stack:** FastAPI + uvicorn, CREPE, TensorFlow, soundfile, python-multipart.

**Endpoint:** `POST /analyze-pitch`
- Request: multipart form with `audio` file (WAV or WebM)
- Response: `{ frames: [{ time: float, frequency: float, confidence: float }], duration: float }`
- Implementation: write audio to temp file → load with soundfile → `crepe.predict(audio, sr, viterbi=True, step_size=10)` → filter out frames where `frequency == 0` → return
- CORS: allow `http://localhost:5173`

**Run:** `uvicorn main:app --reload --port 8000`

## Frontend Architecture

**Stack:** React + TypeScript + Vite, Zustand, OSMD, Tone.js + soundfont-player, Recharts, JSZip, Tailwind CSS.

### Zustand Store

```typescript
interface PitchFrame {
  time: number;        // seconds from passage start
  frequency: number;   // Hz
  confidence: number;  // 0–1
}

interface TargetNote {
  startTime: number;   // seconds from passage start
  endTime: number;
  frequency: number;   // Hz; halved when octaveDown is true
}

interface AppState {
  parsedScore: ParsedScore | null;
  voicePartId: string | null;
  accompanimentPartId: string | null;
  passage: { startMeasure: number; startBeat: number; endMeasure: number; endBeat: number } | null;
  playVoice: boolean;
  playAccompaniment: boolean;
  isPlaying: boolean;
  octaveDown: boolean;  // shifts target note graph display down one octave; does NOT affect synthesis pitch
  isRecording: boolean;
  lastRecordingBlob: Blob | null;
  pitchData: PitchFrame[] | null;
  targetNotes: TargetNote[] | null;
}
```

### Component Tree

```
App
├── FileLoader           — top bar: file input + voice/accomp part dropdowns
└── MainLayout           — split panel wrapper
    ├── LeftPanel        — tabbed container (Score | Pitch Graph)
    │   ├── ScoreViewer  — OSMD render + cursor sync
    │   └── PitchGraph   — Recharts ComposedChart
    └── RightPanel
        ├── PassageSelector   — 4 numeric inputs + "whole piece" button
        ├── TransportControls — play/stop/repeat + voice/accomp toggles + octave-down checkbox
        ├── RecordButton      — starts mic + playback; headphones warning
        └── FeedbackPanel     — play recording button + stats (median cents error, % of voiced frames within 50 cents of target)
```

### Hooks

- `useAudioEngine` — Tone.js synthesis, schedules note events from parsedScore, drives OSMD cursor via `Transport.scheduleRepeat`
- `useMicRecorder` — `getUserMedia` → `MediaRecorder` → collects chunks → assembles `Blob` on stop
- `usePitchAnalysis` — POSTs blob to `/analyze-pitch`, stores `PitchFrame[]` in Zustand, computes `TargetNote[]` from voice part

### Utilities

- `musicxml.ts` — JSZip decompression for `.mxl`, DOMParser extraction of parts/measures/notes
- `noteUtils.ts` — `noteToFrequency(step, octave, alter)`, `frequencyToNoteName(hz)`, `beatsToSeconds(measure, beat, tempo, timeSig)`

## Pitch Graph

Rendered with Recharts `ComposedChart`. Log-scale Y-axis in Hz, labeled with note names. X-axis in seconds (passage duration).

**Target notes (blue, `#60a5fa`):** Stepped line — horizontal segments at each note's frequency for its duration, vertical steps between notes. Source: voice part notes for the passage, converted via `noteToFrequency()`. Shifted one octave down (÷2) when "Octave Down" is enabled.

**Recorded voice (amber, `#fbbf24`):** Continuous line from CREPE pitch frames. Frames with confidence < 0.5 are rendered as a separate low-opacity series (opacity 0.2) rather than interrupting the main line.

The graph only renders after pitch analysis completes. The app auto-switches to the Pitch Graph tab at that point.

## Data Flow

1. **Load:** File input → JSZip (if `.mxl`) → DOMParser → `ParsedScore` → Zustand → OSMD renders
2. **Assign parts:** Part dropdowns → `voicePartId` / `accompanimentPartId` → Zustand
3. **Select passage:** Numeric inputs → `passage` → Zustand
4. **Play:** `useAudioEngine` reads notes from `parsedScore` for passage → schedules Tone.js events → OSMD cursor moves via `scheduleRepeat`
5. **Record:** `RecordButton` → `getUserMedia` + `MediaRecorder` starts → playback starts simultaneously → auto-stops at passage end → `Blob` → Zustand
6. **Analyze:** `usePitchAnalysis` POSTs blob → `/analyze-pitch` → `PitchFrame[]` + `TargetNote[]` → Zustand → FeedbackPanel + PitchGraph render → tab auto-switches to Pitch Graph

## Key Constraints

- Headphones required during recording. Persistent `⚠ Use headphones` warning in the right panel; no AEC attempted.
- MediaRecorder produces WebM/Opus on Chrome. Backend handles via soundfile; Chrome is the supported browser.
- CREPE downloads ~10MB model on first run (TensorFlow cache).
- OSMD cursor sync is approximate (poll-based via `scheduleRepeat`).
- Confidence < 0.5 = unvoiced; excluded from stats calculations.

## Out of Scope (v1)

- Rhythm evaluation
- Real-time pitch display during recording
- Multiple recordings per passage
- Deployment / hosting
- Mobile support
- Export or session saving
- Automated scoring / letter grades
