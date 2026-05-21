import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useStore } from "../store/useStore";
import { frequencyToNoteName } from "../utils/noteUtils";
import type { PitchFrame, TargetNote } from "../types";

function buildTargetData(targetNotes: TargetNote[], duration: number) {
  const points: { time: number; target: number | null }[] = [];
  if (targetNotes.length === 0) return points;
  const step = 0.01;
  for (let t = 0; t <= duration; t = Math.round((t + step) * 1000) / 1000) {
    const note = targetNotes.find((n) => t >= n.startTime && t < n.endTime);
    points.push({ time: t, target: note ? note.frequency : null });
  }
  return points;
}

function buildChartData(pitchData: PitchFrame[], targetNotes: TargetNote[], duration: number) {
  const targetMap = new Map<number, number | null>();
  buildTargetData(targetNotes, duration).forEach((p) => targetMap.set(p.time, p.target));

  const allTimes = new Set([
    ...pitchData.map((f) => Math.round(f.time * 100) / 100),
    ...Array.from(targetMap.keys()),
  ]);

  return Array.from(allTimes)
    .sort((a, b) => a - b)
    .map((t) => {
      const frame = pitchData.find((f) => Math.abs(f.time - t) < 0.01);
      return {
        time: t,
        target: targetMap.get(t) ?? null,
        voice: frame && frame.confidence >= 0.5 ? frame.frequency : null,
        voiceFaint: frame && frame.confidence < 0.5 ? frame.frequency : null,
      };
    });
}

const NOTE_TICKS = [
  { freq: 130.81, label: "C3" },
  { freq: 164.81, label: "E3" },
  { freq: 196.0, label: "G3" },
  { freq: 261.63, label: "C4" },
  { freq: 329.63, label: "E4" },
  { freq: 392.0, label: "G4" },
  { freq: 523.25, label: "C5" },
  { freq: 659.25, label: "E5" },
  { freq: 783.99, label: "G5" },
  { freq: 1046.5, label: "C6" },
];

export default function PitchGraph() {
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);
  const octaveDown = useStore((s) => s.octaveDown);
  const analysisStatus = useStore((s) => s.analysisStatus);
  const analysisError = useStore((s) => s.analysisError);

  if (analysisStatus === "analyzing") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Analyzing recording...
      </div>
    );
  }

  if (analysisStatus === "error") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-400">
        Pitch analysis failed. {analysisError ?? "Check that the backend is running on localhost:8000."}
      </div>
    );
  }

  if (!pitchData || !targetNotes) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Record to see pitch graph
      </div>
    );
  }

  const displayTargetNotes = octaveDown
    ? targetNotes.map((note) => ({ ...note, frequency: note.frequency / 2 }))
    : targetNotes;
  const pitchDuration = pitchData.at(-1)?.time ?? 0;
  const targetDuration = Math.max(0, ...displayTargetNotes.map((note) => note.endTime));
  const duration = Math.max(pitchDuration, targetDuration);
  const data = buildChartData(pitchData, displayTargetNotes, duration);

  const allFreqs = [
    ...pitchData.map((f) => f.frequency),
    ...displayTargetNotes.map((n) => n.frequency),
  ].filter(Boolean);

  if (duration <= 0 || allFreqs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500">
        No pitch frames were detected. Try recording a louder sustained note and make sure the backend finished analysis.
      </div>
    );
  }
  const minFreq = Math.max(80, Math.min(...allFreqs) * 0.7);
  const maxFreq = Math.min(2000, Math.max(...allFreqs) * 1.3);

  const visibleTicks = NOTE_TICKS.filter((t) => t.freq >= minFreq && t.freq <= maxFreq);

  return (
    <div className="h-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3e" />
          <XAxis
            dataKey="time"
            type="number"
            domain={[0, duration]}
            tickFormatter={(v: number) => `${v.toFixed(1)}s`}
            stroke="#4a5568"
            tick={{ fill: "#718096", fontSize: 10 }}
          />
          <YAxis
            scale="log"
            domain={[minFreq, maxFreq]}
            ticks={visibleTicks.map((t) => t.freq)}
            tickFormatter={(v: number) => {
              const match = visibleTicks.find((t) => Math.abs(t.freq - v) < 1);
              return match ? match.label : "";
            }}
            stroke="#4a5568"
            tick={{ fill: "#718096", fontSize: 10 }}
          />
          <Tooltip
            formatter={(value, name) => {
              const numericValue = typeof value === "number" ? value : Number(value);
              if (!Number.isFinite(numericValue)) return ["", String(name)];
              return [
                `${numericValue.toFixed(1)} Hz (${frequencyToNoteName(numericValue)})`,
                name === "target" ? "Target" : "Voice",
              ];
            }}
            labelFormatter={(label) =>
              typeof label === "number" ? `${label.toFixed(2)}s` : String(label)
            }
            contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4e", fontSize: 11 }}
          />
          <Line
            dataKey="target"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="target"
          />
          <Line
            dataKey="voice"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="voice"
          />
          <Line
            dataKey="voiceFaint"
            stroke="#fbbf24"
            strokeWidth={1.5}
            strokeOpacity={0.2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="voiceFaint"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
