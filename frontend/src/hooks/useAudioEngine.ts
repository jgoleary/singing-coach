declare module "soundfont-player";

import { useCallback, useRef } from "react";
import * as Tone from "tone";
import Soundfont from "soundfont-player";
import { useStore } from "../store/useStore";
import { noteToFrequency, beatsToSeconds } from "../utils/noteUtils";
import type { Part } from "../types";

const AC = new AudioContext();

async function getInstrument(name: string) {
  return Soundfont.instrument(AC, name as any, { soundfont: "MusyngKite" });
}

export function useAudioEngine() {
  const instrumentsRef = useRef<Record<string, any>>({});

  const getPassageBounds = useCallback(() => {
    const state = useStore.getState();
    const score = state.parsedScore;
    if (!score) return null;
    const p = state.passage;
    const allMeasures = score.parts[0]?.measures ?? [];
    const lastMeasure = allMeasures.at(-1);
    if (!lastMeasure) return null;
    const start = p
      ? beatsToSeconds(p.startMeasure, p.startBeat, score.tempo, allMeasures[0])
      : 0;
    const end = p
      ? beatsToSeconds(p.endMeasure, p.endBeat, score.tempo, lastMeasure)
      : beatsToSeconds(lastMeasure.number, lastMeasure.beats + 1, score.tempo, lastMeasure);
    return { start, end, duration: end - start };
  }, []);

  const schedulePartNotes = useCallback(
    async (part: Part, instrument: any, passageStart: number, passageEnd: number, score: any) => {
      for (const measure of part.measures) {
        for (const note of measure.notes) {
          if (!note.pitch || note.isRest) continue;
          const noteStart = beatsToSeconds(measure.number, note.beatPosition, score.tempo, measure);
          if (noteStart < passageStart || noteStart >= passageEnd) continue;
          const offset = noteStart - passageStart;
          const durationSec = note.duration * (60 / score.tempo);
          const freq = noteToFrequency(note.pitch.step, note.pitch.octave, note.pitch.alter);
          Tone.getTransport().schedule((time) => {
            instrument.play(freq.toString(), AC.currentTime + time, { duration: durationSec });
          }, offset);
        }
      }
    },
    []
  );

  const play = useCallback(async (onEnd?: () => void) => {
    const state = useStore.getState();
    const score = state.parsedScore;
    if (!score) return;
    const bounds = getPassageBounds();
    if (!bounds) return;

    await Tone.start();
    Tone.getTransport().cancel();
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;

    const osmd: any = (window as any).__osmd;
    if (osmd) {
      osmd.cursor.reset();
      osmd.cursor.show();
    }

    // Load instruments (cached after first load)
    if (state.playVoice && state.voicePartId) {
      if (!instrumentsRef.current["voice"]) {
        instrumentsRef.current["voice"] = await getInstrument("choir-aahs");
      }
    }
    if (state.playAccompaniment && state.accompanimentPartId) {
      if (!instrumentsRef.current["piano"]) {
        instrumentsRef.current["piano"] = await getInstrument("acoustic-grand-piano");
      }
    }

    // Schedule notes for each part
    for (const part of score.parts) {
      if (part.id === state.voicePartId && state.playVoice) {
        await schedulePartNotes(part, instrumentsRef.current["voice"], bounds.start, bounds.end, score);
      }
      if (part.id === state.accompanimentPartId && state.playAccompaniment) {
        await schedulePartNotes(part, instrumentsRef.current["piano"], bounds.start, bounds.end, score);
      }
    }

    // Advance OSMD cursor on every 16th note tick
    Tone.getTransport().scheduleRepeat(() => {
      const osmdNow: any = (window as any).__osmd;
      if (osmdNow) osmdNow.cursor.next();
    }, "16n");

    // Auto-stop at end of passage
    Tone.getTransport().schedule(() => {
      Tone.getTransport().stop();
      useStore.getState().setIsPlaying(false);
      onEnd?.();
    }, bounds.duration);

    Tone.getTransport().start();
    useStore.getState().setIsPlaying(true);
  }, [getPassageBounds, schedulePartNotes]);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
    useStore.getState().setIsPlaying(false);
  }, []);

  return { play, stop };
}
