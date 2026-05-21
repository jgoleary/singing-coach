import { create } from "zustand";
import type { ParsedScore, PitchFrame, TargetNote, Passage } from "../types";

export type FlaggedPassage = { id: string; passage: Passage };

interface AppState {
  parsedScore: ParsedScore | null;
  voicePartId: string | null;
  accompanimentPartId: string | null;
  passage: Passage | null;
  playVoice: boolean;
  playAccompaniment: boolean;
  isPlaying: boolean;
  octaveDown: boolean; // shifts target note graph display down one octave; does NOT affect synthesis pitch
  isRecording: boolean;
  lastRecordingBlob: Blob | null;
  takeNumber: number;
  lastRecordingAt: number | null;
  pitchData: PitchFrame[] | null;
  targetNotes: TargetNote[] | null;
  analysisStatus: "idle" | "analyzing" | "done" | "error";
  analysisError: string | null;
  voiceInstrument: string;
  accompanimentInstrument: string;
  tempoScale: number; // percentage of score tempo, 50–150
  flaggedPassages: FlaggedPassage[];

  setParsedScore: (score: ParsedScore | null) => void;
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
  voiceInstrument: "choir_aahs",
  accompanimentInstrument: "acoustic_grand_piano",
  tempoScale: Number(localStorage.getItem("tempoScale") ?? 100),
  flaggedPassages: JSON.parse(localStorage.getItem("flaggedPassages") ?? "[]"),

  setParsedScore: (score) => set({ parsedScore: score }),
  setVoicePartId: (id) => set({ voicePartId: id }),
  setAccompanimentPartId: (id) => set({ accompanimentPartId: id }),
  setPassage: (passage) => set({ passage }),
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
  setVoiceInstrument: (name) => set({ voiceInstrument: name }),
  setAccompanimentInstrument: (name) => set({ accompanimentInstrument: name }),
  setTempoScale: (v) => { localStorage.setItem("tempoScale", String(v)); set({ tempoScale: v }); },
  addFlaggedPassage: (passage) => set((s) => {
    const next = [...s.flaggedPassages, { id: `${Date.now()}`, passage }];
    localStorage.setItem("flaggedPassages", JSON.stringify(next));
    return { flaggedPassages: next };
  }),
  removeFlaggedPassage: (id) => set((s) => {
    const next = s.flaggedPassages.filter((f) => f.id !== id);
    localStorage.setItem("flaggedPassages", JSON.stringify(next));
    return { flaggedPassages: next };
  }),
  clearRecording: () => set({
    lastRecordingBlob: null, pitchData: null, targetNotes: null,
    analysisStatus: "idle", analysisError: null,
  }),
}));
