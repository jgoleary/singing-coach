import type { PitchFrame, TargetNote } from "../types";

export function computeStats(pitchData: PitchFrame[], targetNotes: TargetNote[], toleranceCents = 50) {
  const errors: number[] = [];
  let onPitchCount = 0;
  for (const frame of pitchData) {
    if (frame.confidence < 0.5) continue;
    const target = targetNotes.find((n) => frame.time >= n.startTime && frame.time < n.endTime);
    if (!target) continue;
    const cents = Math.abs(1200 * Math.log2(frame.frequency / target.frequency));
    errors.push(cents);
    if (cents <= toleranceCents) onPitchCount++;
  }
  if (errors.length === 0) return null;
  const sorted = [...errors].sort((a, b) => a - b);
  return {
    medianCents: Math.round(sorted[Math.floor(sorted.length / 2)]),
    pctOnPitch: Math.round((onPitchCount / errors.length) * 100),
  };
}
