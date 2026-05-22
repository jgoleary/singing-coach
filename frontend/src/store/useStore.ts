import { create } from "zustand";
import type { ParsedScore, PitchFrame, TargetNote, Passage } from "../types";

export type FlaggedPassage = { id: string; passage: Passage };

// Score-scoped localStorage helpers
const sk = (scoreId: string, key: string) => `singing-coach:${key}:${scoreId}`;

function loadScored<T>(scoreId: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(sk(scoreId, key));
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveScored(scoreId: string | null, key: string, value: unknown) {
  if (!scoreId) return;
  try { localStorage.setItem(sk(scoreId, key), JSON.stringify(value)); } catch { /* storage full */ }
}

interface AppState {
  parsedScore: ParsedScore | null;
  scoreId: string | null;           // filename of the loaded score; keys all score-scoped state
  voicePartId: string | null;
  accompanimentPartId: string | null;
  passage: Passage | null;
  playVoice: boolean;
  playAccompaniment: boolean;
  isPlaying: boolean;
  octaveDown: boolean;
  isRecording: boolean;
  lastRecordingBlob: Blob | null;
  takeNumber: number;
  lastRecordingAt: number | null;
  pitchData: PitchFrame[] | null;
  targetNotes: TargetNote[] | null;
  analysisStatus: "idle" | "analyzing" | "done" | "error";
  analysisError: string | null;
  voiceInstrument: string;           // global preference — not score-scoped
  accompanimentInstrument: string;   // global preference — not score-scoped
  tempoScale: number;                // score-scoped; % of written tempo, 50–150
  flaggedPassages: FlaggedPassage[]; // score-scoped

  setParsedScore: (score: ParsedScore | null) => void;
  // Call after loading a new score to restore all score-scoped settings atomically
  loadScoreSettings: (scoreId: string) => void;
  setVoicePartId: (id: string | null) => void;
  setAccompanimentPartId: (id: string | null) => void;
  setPassage: (passage: Passage | null) => void;
  setPlayVoice: (v: boolean) => void;
  setPlayAccompaniment: (v: boolean) => void;
  setIsPlaying: (v: boolean) => void;
  setOctaveDown: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setLastRecordingBlob: (blob: Blob | null) => void;
  incrementTakeNumber: () => void;
  setLastRecordingAt: (ts: number | null) => void;
  setPitchData: (frames: PitchFrame[] | null) => void;
  setTargetNotes: (notes: TargetNote[] | null) => void;
  setAnalysisStatus: (status: AppState["analysisStatus"]) => void;
  setAnalysisError: (error: string | null) => void;
  setVoiceInstrument: (name: string) => void;
  setAccompanimentInstrument: (name: string) => void;
  setTempoScale: (v: number) => void;
  addFlaggedPassage: (passage: Passage) => void;
  removeFlaggedPassage: (id: string) => void;
  clearRecording: () => void;
}

export const useStore = create<AppState>((set) => ({
  parsedScore: null,
  scoreId: null,
  voicePartId: null,
  accompanimentPartId: null,
  passage: null,
  playVoice: true,
  playAccompaniment: true,
  isPlaying: false,
  octaveDown: localStorage.getItem("octaveDown") === "true",
  isRecording: false,
  lastRecordingBlob: null,
  takeNumber: 0,
  lastRecordingAt: null,
  pitchData: null,
  targetNotes: null,
  analysisStatus: "idle",
  analysisError: null,
  voiceInstrument: localStorage.getItem("voiceInstrument") ?? "choir_aahs",
  accompanimentInstrument: localStorage.getItem("accompanimentInstrument") ?? "acoustic_grand_piano",
  tempoScale: 100,
  flaggedPassages: [],

  setParsedScore: (score) => set({ parsedScore: score }),

  loadScoreSettings: (scoreId) => set({
    scoreId,
    passage: loadScored<Passage | null>(scoreId, "passage", null),
    tempoScale: loadScored<number>(scoreId, "tempoScale", 100),
    flaggedPassages: loadScored<FlaggedPassage[]>(scoreId, "flaggedPassages", []),
  }),

  setVoicePartId: (id) => set({ voicePartId: id }),
  setAccompanimentPartId: (id) => set({ accompanimentPartId: id }),

  setPassage: (passage) => set((s) => {
    saveScored(s.scoreId, "passage", passage);
    return { passage };
  }),

  setPlayVoice: (v) => set({ playVoice: v }),
  setPlayAccompaniment: (v) => set({ playAccompaniment: v }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setOctaveDown: (v) => { localStorage.setItem("octaveDown", String(v)); set({ octaveDown: v }); },
  setIsRecording: (v) => set({ isRecording: v }),
  setLastRecordingBlob: (blob) => set({ lastRecordingBlob: blob }),
  incrementTakeNumber: () => set((s) => ({ takeNumber: s.takeNumber + 1 })),
  setLastRecordingAt: (ts) => set({ lastRecordingAt: ts }),
  setPitchData: (frames) => set({ pitchData: frames }),
  setTargetNotes: (notes) => set({ targetNotes: notes }),
  setAnalysisStatus: (status) => set({ analysisStatus: status }),
  setAnalysisError: (error) => set({ analysisError: error }),

  setVoiceInstrument: (name) => { localStorage.setItem("voiceInstrument", name); set({ voiceInstrument: name }); },
  setAccompanimentInstrument: (name) => { localStorage.setItem("accompanimentInstrument", name); set({ accompanimentInstrument: name }); },

  setTempoScale: (v) => set((s) => {
    saveScored(s.scoreId, "tempoScale", v);
    return { tempoScale: v };
  }),

  addFlaggedPassage: (passage) => set((s) => {
    const next = [...s.flaggedPassages, { id: `${Date.now()}`, passage }];
    saveScored(s.scoreId, "flaggedPassages", next);
    return { flaggedPassages: next };
  }),

  removeFlaggedPassage: (id) => set((s) => {
    const next = s.flaggedPassages.filter((f) => f.id !== id);
    saveScored(s.scoreId, "flaggedPassages", next);
    return { flaggedPassages: next };
  }),

  clearRecording: () => set({
    lastRecordingBlob: null, pitchData: null, targetNotes: null,
    analysisStatus: "idle", analysisError: null,
  }),
}));
