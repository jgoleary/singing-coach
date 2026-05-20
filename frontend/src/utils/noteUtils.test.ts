import { describe, it, expect } from "vitest";
import { noteToFrequency, frequencyToNoteName, beatsToSeconds } from "./noteUtils";

describe("noteToFrequency", () => {
  it("returns 440 for A4", () => {
    expect(noteToFrequency("A", 4, 0)).toBeCloseTo(440.0, 1);
  });
  it("returns 261.63 for C4", () => {
    expect(noteToFrequency("C", 4, 0)).toBeCloseTo(261.63, 1);
  });
  it("applies alter (sharp)", () => {
    // C#4 = 277.18
    expect(noteToFrequency("C", 4, 1)).toBeCloseTo(277.18, 1);
  });
  it("applies alter (flat)", () => {
    // Bb4 = 466.16
    expect(noteToFrequency("B", 4, -1)).toBeCloseTo(466.16, 1);
  });
});

describe("frequencyToNoteName", () => {
  it("identifies A4", () => {
    expect(frequencyToNoteName(440)).toBe("A4");
  });
  it("identifies C4", () => {
    expect(frequencyToNoteName(261.63)).toBe("C4");
  });
});

describe("beatsToSeconds", () => {
  it("converts beat 1 of measure 1 to 0 seconds at 120bpm 4/4", () => {
    expect(beatsToSeconds(1, 1, 120, { beats: 4, beatType: 4 })).toBeCloseTo(0, 5);
  });
  it("converts beat 3 of measure 1 to 1 second at 120bpm 4/4", () => {
    // At 120 BPM, each beat = 0.5s. Beat 3 = 1.0s
    expect(beatsToSeconds(1, 3, 120, { beats: 4, beatType: 4 })).toBeCloseTo(1.0, 5);
  });
  it("converts beat 1 of measure 2 to 2 seconds at 120bpm 4/4", () => {
    // Measure 2 starts at beat 4 offset = 2.0s
    expect(beatsToSeconds(2, 1, 120, { beats: 4, beatType: 4 })).toBeCloseTo(2.0, 5);
  });
});
