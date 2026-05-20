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
