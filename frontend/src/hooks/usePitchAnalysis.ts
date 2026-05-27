import { useCallback } from "react";
import { useStore } from "../store/useStore";
import { noteToFrequency, beatsToSeconds, expandTiedNotes } from "../utils/noteUtils";
import type { TargetNote, PitchFrame } from "../types";

export function usePitchAnalysis() {
  const computeTargetNotes = useCallback((): TargetNote[] => {
    const state = useStore.getState();
    const score = state.parsedScore;
    const voicePart = score?.parts.find((p) => p.id === state.voicePartId);
    if (!score || !voicePart) return [];

    const tempo = score.tempo * (state.tempoScale / 100);
    const allMeasures = score.parts[0].measures;
    const p = state.passage;
    const passageStart = p
      ? beatsToSeconds(p.startMeasure, p.startBeat, tempo, allMeasures[0])
      : 0;
    const passageEnd = p
      ? beatsToSeconds(p.endMeasure, p.endBeat + 1, tempo, allMeasures.at(-1)!)
      : Infinity;

    const targets: TargetNote[] = [];
    for (const { measure, note, durationBeats } of expandTiedNotes(voicePart)) {
      if (!note.pitch || note.isRest) continue;
      const startSec = beatsToSeconds(measure.number, note.beatPosition, tempo, measure);
      if (startSec < passageStart || startSec >= passageEnd) continue;
      const durationSec = durationBeats * (60 / tempo);
      const freq = noteToFrequency(note.pitch.step, note.pitch.octave, note.pitch.alter);
      targets.push({
        startTime: startSec - passageStart,
        endTime: startSec - passageStart + durationSec,
        frequency: freq,
        lyric: note.lyric,
      });
    }
    return targets;
  }, []);

  const analyze = useCallback(async (blob: Blob) => {
    const store = useStore.getState();
    store.setAnalysisStatus("analyzing");
    store.setAnalysisError(null);
    store.setPitchData(null);
    store.setTargetNotes(computeTargetNotes());

    const form = new FormData();
    form.append("audio", blob, "recording.webm");

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";
      const res = await fetch(`${backendUrl}/analyze-pitch`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || `Backend error: ${res.status}`);
      }
      const data: { frames: PitchFrame[]; duration: number } = await res.json();

      const nextStore = useStore.getState();
      nextStore.setPitchData(data.frames);
      nextStore.setTargetNotes(computeTargetNotes());
      nextStore.setAnalysisStatus("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Pitch analysis failed";
      const nextStore = useStore.getState();
      nextStore.setAnalysisError(message);
      nextStore.setAnalysisStatus("error");
      throw err;
    }
  }, [computeTargetNotes]);

  return { analyze };
}
