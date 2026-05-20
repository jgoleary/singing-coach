import { useCallback } from "react";
import { useStore } from "../store/useStore";
import { noteToFrequency, beatsToSeconds } from "../utils/noteUtils";
import type { TargetNote, PitchFrame } from "../types";

export function usePitchAnalysis() {
  const computeTargetNotes = useCallback((): TargetNote[] => {
    const state = useStore.getState();
    const score = state.parsedScore;
    const voicePart = score?.parts.find((p) => p.id === state.voicePartId);
    if (!score || !voicePart) return [];

    const allMeasures = score.parts[0].measures;
    const p = state.passage;
    const passageStart = p
      ? beatsToSeconds(p.startMeasure, p.startBeat, score.tempo, allMeasures[0])
      : 0;
    const passageEnd = p
      ? beatsToSeconds(p.endMeasure, p.endBeat, score.tempo, allMeasures.at(-1)!)
      : Infinity;

    const targets: TargetNote[] = [];
    for (const measure of voicePart.measures) {
      for (const note of measure.notes) {
        if (!note.pitch || note.isRest) continue;
        const startSec = beatsToSeconds(measure.number, note.beatPosition, score.tempo, measure);
        if (startSec < passageStart || startSec >= passageEnd) continue;
        // duration in seconds: note.duration beats * secondsPerBeat
        const durationSec = note.duration * (60 / score.tempo);
        let freq = noteToFrequency(note.pitch.step, note.pitch.octave, note.pitch.alter);
        if (state.octaveDown) freq /= 2;
        targets.push({
          startTime: startSec - passageStart,
          endTime: startSec - passageStart + durationSec,
          frequency: freq,
        });
      }
    }
    return targets;
  }, []);

  const analyze = useCallback(async (blob: Blob) => {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");

    const res = await fetch("http://localhost:8000/analyze-pitch", {
      method: "POST",
      body: form,
    });

    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    const data: { frames: PitchFrame[]; duration: number } = await res.json();

    useStore.getState().setPitchData(data.frames);
    useStore.getState().setTargetNotes(computeTargetNotes());
  }, [computeTargetNotes]);

  return { analyze };
}
