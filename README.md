# Singing Coach

A personal singing practice tool. Load a MusicXML file, select a passage, record yourself singing, and get pitch accuracy feedback.

## Starting the App

Both the backend and frontend must be running.

### Backend

```bash
backend/venv312/bin/uvicorn backend.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in Chrome.

## First-time Setup

### Backend (Python 3.12 required)

```bash
backend/venv312/bin/pip install -r backend/requirements.txt
```

CREPE (~10MB TensorFlow model) downloads automatically on first pitch analysis.

### Frontend

```bash
cd frontend
npm install
```

## Running Tests

```bash
# Backend
backend/venv312/bin/pytest backend/tests/ -v

# Frontend (must run from frontend/ directory)
cd frontend
npx vitest run
```

## Notes

- **Chrome only** — MediaRecorder produces WebM/Opus required by the backend
- **Headphones required** during recording to avoid microphone feedback
- Soundfonts load from jsDelivr CDN; falls back to PolySynth if offline
