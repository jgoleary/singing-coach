import type { Measure, Note, Part } from "../types";

const NOTE_STEPS = ["C", "D", "E", "F", "G", "A", "B"];
const SEMITONES_FROM_C = [0, 2, 4, 5, 7, 9, 11];

export type PlaybackNote = {
  measure: Measure;
  note: Note;
  durationBeats: number; // possibly extended past note.duration when tied
};

// Walks a part in source order, drops tied continuations (stop/both),
// and extends tie-start durations through their tied chain.
export function expandTiedNotes(part: Part): PlaybackNote[] {
  const flat: { measure: Measure; note: Note }[] = [];
  for (const m of part.measures) {
    for (const n of m.notes) flat.push({ measure: m, note: n });
  }
  const samePitch = (a: NonNullable<Note["pitch"]>, b: NonNullable<Note["pitch"]>) =>
    a.step === b.step && a.octave === b.octave && a.alter === b.alter;

  const result: PlaybackNote[] = [];
  for (let i = 0; i < flat.length; i++) {
    const { measure, note } = flat[i];
    if (note.tieType === "stop" || note.tieType === "both") continue;

    let durationBeats = note.duration;
    if (note.tieType === "start" && note.pitch) {
      for (let j = i + 1; j < flat.length; j++) {
        const next = flat[j].note;
        if (!next.pitch) continue;
        if (!samePitch(next.pitch, note.pitch)) continue;
        if (next.tieType === "stop" || next.tieType === "both") {
          durationBeats += next.duration;
          if (next.tieType === "stop") break;
        } else {
          break;
        }
      }
    }
    result.push({ measure, note, durationBeats });
  }
  return result;
}

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
  const secondsPerBeat = (60 / tempo) * (4 / timeSignature.beatType);
  const beatsPerMeasure = timeSignature.beats;
  const absoluteBeat = (measure - 1) * beatsPerMeasure + (beat - 1);
  return absoluteBeat * secondsPerBeat;
}
