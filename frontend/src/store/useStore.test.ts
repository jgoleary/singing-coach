import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import { act, renderHook } from "@testing-library/react";

describe("useStore", () => {
  beforeEach(() => {
    useStore.setState({
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
    });
  });

  it("sets voicePartId", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.setVoicePartId("part1"));
    expect(useStore.getState().voicePartId).toBe("part1");
  });

  it("sets passage", () => {
    const { result } = renderHook(() => useStore());
    const passage = { startMeasure: 1, startBeat: 1, endMeasure: 4, endBeat: 4 };
    act(() => result.current.setPassage(passage));
    expect(useStore.getState().passage).toEqual(passage);
  });

  it("toggles octaveDown", () => {
    const { result } = renderHook(() => useStore());
    act(() => result.current.setOctaveDown(true));
    expect(useStore.getState().octaveDown).toBe(true);
  });
});
