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
  octaveDown: boolean; // shifts target note graph display down one octave; does NOT affect synthesis pitch
  isRecording: boolean;
  lastRecordingBlob: Blob | null;
  pitchData: PitchFrame[] | null;
  targetNotes: TargetNote[] | null;

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
