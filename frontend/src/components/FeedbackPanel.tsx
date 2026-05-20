import { useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import type { PitchFrame, TargetNote } from "../types";

function computeStats(pitchData: PitchFrame[], targetNotes: TargetNote[]) {
  const errors: number[] = [];
  let onPitchCount = 0;

  for (const frame of pitchData) {
    if (frame.confidence < 0.5) continue;
    const target = targetNotes.find(
      (n) => frame.time >= n.startTime && frame.time < n.endTime
    );
    if (!target) continue;
    const cents = Math.abs(1200 * Math.log2(frame.frequency / target.frequency));
    errors.push(cents);
    if (cents <= 50) onPitchCount++;
  }

  if (errors.length === 0) return null;

  const sorted = [...errors].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const pctOnPitch = Math.round((onPitchCount / errors.length) * 100);

  return { medianCents: Math.round(median), pctOnPitch };
}

export default function FeedbackPanel() {
  const lastRecordingBlob = useStore((s) => s.lastRecordingBlob);
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastRecordingBlob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(lastRecordingBlob);
    if (audioRef.current) audioRef.current.src = urlRef.current;
  }, [lastRecordingBlob]);

  if (!lastRecordingBlob) return null;

  const stats = pitchData && targetNotes ? computeStats(pitchData, targetNotes) : null;

  return (
    <div className="p-3">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Feedback</div>
      <audio ref={audioRef} controls className="w-full" style={{ height: 28 }} />
      <button
        onClick={() => audioRef.current?.play()}
        className="w-full mt-2 text-xs py-1.5 bg-[#1a3a2e] text-emerald-300 rounded hover:bg-[#1e4a38]"
      >
        ▶ Play My Recording
      </button>
      {stats && (
        <div className="mt-3 space-y-1 text-xs text-gray-400">
          <div>
            Median error:{" "}
            <span className="text-yellow-400 font-mono">{stats.medianCents} cents</span>
          </div>
          <div>
            On pitch:{" "}
            <span className={stats.pctOnPitch >= 70 ? "text-emerald-400" : "text-red-400"}>
              {stats.pctOnPitch}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
