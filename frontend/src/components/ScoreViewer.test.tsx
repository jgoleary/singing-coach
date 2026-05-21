import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import ScoreViewer from "./ScoreViewer";
import { useStore } from "../store/useStore";
import type { ParsedScore } from "../types";

const osmdMocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  load: vi.fn(),
  render: vi.fn(),
  cursorReset: vi.fn(),
  cursorShow: vi.fn(),
}));

vi.mock("opensheetmusicdisplay", () => ({
  OpenSheetMusicDisplay: osmdMocks.constructor.mockImplementation(function () {
    return {
    load: osmdMocks.load.mockResolvedValue(undefined),
    render: osmdMocks.render,
    cursor: {
      reset: osmdMocks.cursorReset,
      show: osmdMocks.cursorShow,
      next: vi.fn(),
    },
    };
  }),
}));

const parsedScore: ParsedScore = {
  tempo: 120,
  parts: [
    {
      id: "P1",
      name: "Voice",
      measures: [{ number: 1, beats: 4, beatType: 4, notes: [] }],
    },
  ],
};

describe("ScoreViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__lastLoadedXml;
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
      analysisStatus: "idle",
      analysisError: null,
    });
  });

  it("initializes OSMD after a score is loaded", async () => {
    window.__lastLoadedXml = "<score-partwise />";
    render(<ScoreViewer />);

    expect(screen.getByText("Load a file to get started")).toBeInTheDocument();
    act(() => {
      useStore.getState().setParsedScore(parsedScore);
    });

    await waitFor(() => {
      expect(osmdMocks.constructor).toHaveBeenCalledTimes(1);
      expect(osmdMocks.load).toHaveBeenCalledWith("<score-partwise />");
      expect(osmdMocks.render).toHaveBeenCalled();
      expect(osmdMocks.cursorShow).toHaveBeenCalled();
    });
  });
});
