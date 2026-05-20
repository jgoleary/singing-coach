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
