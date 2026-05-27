declare module "soundfont-player";

import { useCallback, useRef } from "react";
import * as Tone from "tone";
import Soundfont from "soundfont-player";
import { useStore } from "../store/useStore";
import { noteToFrequency, beatsToSeconds, expandTiedNotes } from "../utils/noteUtils";
import type { Part } from "../types";

type SoundfontInstrument = {
  play: (note: string | number, when?: number, options?: { duration?: number }) => unknown;
};

type ScheduledPitch = {
  frequency: number;
  midi: number;
};

type PlayableInstrument = {
  play: (pitch: ScheduledPitch, time: number, duration: number) => unknown;
};

type SoundfontPlayer = {
  instrument: (
    audioContext: AudioContext,
    name: string,
    options: { soundfont: string }
  ) => Promise<SoundfontInstrument>;
};

type OsmdCursor = {
  reset: () => void;
  show: () => void;
  next: () => void;
};

declare global {
  interface Window {
    __osmd?: {
      cursor: OsmdCursor;
    };
  }
}

async function getInstrument(name: string) {
  const audioContext = Tone.getContext().rawContext as AudioContext;
  const instrument = await (Soundfont as SoundfontPlayer).instrument(audioContext, name, {
    soundfont: "MusyngKite",
  });
  return {
    play: (pitch: ScheduledPitch, time: number, duration: number) =>
      instrument.play(pitch.midi, time, { duration }),
  };
}

function getFallbackInstrument(): PlayableInstrument {
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.08, sustain: 0.45, release: 0.2 },
  }).toDestination();

  return {
    play: (pitch, time, duration) => synth.triggerAttackRelease(pitch.frequency, duration, time),
  };
}

async function getPlayableInstrument(name: string): Promise<PlayableInstrument> {
  try {
    return await getInstrument(name);
  } catch (err) {
    console.warn(`Falling back to local synth for ${name}`, err);
    return getFallbackInstrument();
  }
}

function pitchToMidi(step: string, octave: number, alter: number): number {
  const semitonesFromC: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  return (octave + 1) * 12 + semitonesFromC[step] + alter;
}

export function useAudioEngine() {
  const instrumentsRef = useRef<Record<string, PlayableInstrument>>({});
  const instrumentNamesRef = useRef<Record<string, string>>({});

  const getPassageBounds = useCallback(() => {
    const state = useStore.getState();
    const score = state.parsedScore;
    if (!score) return null;
    const tempo = score.tempo * (state.tempoScale / 100);
    const p = state.passage;
    const allMeasures = score.parts[0]?.measures ?? [];
    const lastMeasure = allMeasures.at(-1);
    if (!lastMeasure) return null;
    const start = p
      ? beatsToSeconds(p.startMeasure, p.startBeat, tempo, allMeasures[0])
      : 0;
    const end = p
      ? beatsToSeconds(p.endMeasure, p.endBeat + 1, tempo, lastMeasure)
      : beatsToSeconds(lastMeasure.number, lastMeasure.beats + 1, tempo, lastMeasure);
    return { start, end, duration: end - start };
  }, []);

  const schedulePartNotes = useCallback(
    async (
      part: Part,
      instrument: PlayableInstrument,
      passageStart: number,
      passageEnd: number,
      tempo: number
    ) => {
      for (const { measure, note, durationBeats } of expandTiedNotes(part)) {
        if (!note.pitch || note.isRest) continue;
        const noteStart = beatsToSeconds(measure.number, note.beatPosition, tempo, measure);
        if (noteStart < passageStart || noteStart >= passageEnd) continue;
        const offset = noteStart - passageStart;
        const durationSec = durationBeats * (60 / tempo);
        const freq = noteToFrequency(note.pitch.step, note.pitch.octave, note.pitch.alter);
        const midi = pitchToMidi(note.pitch.step, note.pitch.octave, note.pitch.alter);
        Tone.getTransport().schedule((time) => {
          instrument.play({ frequency: freq, midi }, time, durationSec);
        }, offset);
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

    const osmd = window.__osmd;
    if (osmd) {
      osmd.cursor.reset();
      osmd.cursor.show();
    }

    // Load instruments (cached by name; reload if instrument changed)
    if (state.playVoice && state.voicePartId) {
      if (instrumentNamesRef.current["voice"] !== state.voiceInstrument) {
        instrumentsRef.current["voice"] = await getPlayableInstrument(state.voiceInstrument);
        instrumentNamesRef.current["voice"] = state.voiceInstrument;
      }
    }
    if (state.playAccompaniment && state.accompanimentPartId) {
      if (instrumentNamesRef.current["piano"] !== state.accompanimentInstrument) {
        instrumentsRef.current["piano"] = await getPlayableInstrument(state.accompanimentInstrument);
        instrumentNamesRef.current["piano"] = state.accompanimentInstrument;
      }
    }

    const tempo = score.tempo * (state.tempoScale / 100);

    // Schedule notes for each part
    for (const part of score.parts) {
      if (part.id === state.voicePartId && state.playVoice) {
        await schedulePartNotes(part, instrumentsRef.current["voice"], bounds.start, bounds.end, tempo);
      }
      if (part.id === state.accompanimentPartId && state.playAccompaniment) {
        await schedulePartNotes(part, instrumentsRef.current["piano"], bounds.start, bounds.end, tempo);
      }
    }

    // Advance OSMD cursor on every 16th note tick
    Tone.getTransport().scheduleRepeat(() => {
      const osmdNow = window.__osmd;
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

  // Plays only the accompaniment — used during recording playback so the user
  // hears their voice recording alongside the synth accompaniment in sync.
  const playAccompanimentOnly = useCallback(async (onEnd?: () => void) => {
    const state = useStore.getState();
    const score = state.parsedScore;
    if (!score || !state.accompanimentPartId || !state.playAccompaniment) {
      onEnd?.();
      return;
    }
    const bounds = getPassageBounds();
    if (!bounds) { onEnd?.(); return; }

    await Tone.start();
    Tone.getTransport().cancel();
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;

    if (instrumentNamesRef.current["piano"] !== state.accompanimentInstrument) {
      instrumentsRef.current["piano"] = await getPlayableInstrument(state.accompanimentInstrument);
      instrumentNamesRef.current["piano"] = state.accompanimentInstrument;
    }

    const tempo = score.tempo * (state.tempoScale / 100);
    const accompPart = score.parts.find((p) => p.id === state.accompanimentPartId);
    if (accompPart) {
      await schedulePartNotes(accompPart, instrumentsRef.current["piano"], bounds.start, bounds.end, tempo);
    }

    Tone.getTransport().schedule(() => {
      Tone.getTransport().stop();
      onEnd?.();
    }, bounds.duration);

    Tone.getTransport().start();
  }, [getPassageBounds, schedulePartNotes]);

  return { play, stop, playAccompanimentOnly };
}
