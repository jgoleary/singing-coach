import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useStore } from "../store/useStore";
import { frequencyToNoteName, beatsToSeconds } from "../utils/noteUtils";
import type { PitchFrame, TargetNote } from "../types";

// ±25¢ band around each target note
const BAND_RATIO = Math.pow(2, 25 / 1200);

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
  { freq: 196.0,  label: "G3" },
  { freq: 261.63, label: "C4" },
  { freq: 329.63, label: "E4" },
  { freq: 392.0,  label: "G4" },
  { freq: 523.25, label: "C5" },
  { freq: 659.25, label: "E5" },
  { freq: 783.99, label: "G5" },
  { freq: 1046.5, label: "C6" },
];

const centeredStyle: React.CSSProperties = {
  display: "flex", height: "100%",
  alignItems: "center", justifyContent: "center",
  padding: 24, textAlign: "center",
  fontSize: 13, color: "var(--ink-3)",
};

export default function PitchGraph() {
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);
  const octaveDown = useStore((s) => s.octaveDown);
  const analysisStatus = useStore((s) => s.analysisStatus);
  const analysisError = useStore((s) => s.analysisError);
  const parsedScore = useStore((s) => s.parsedScore);
  const passage = useStore((s) => s.passage);

  if (analysisStatus === "analyzing") {
    return <div style={centeredStyle}>Analyzing recording…</div>;
  }
  if (analysisStatus === "error") {
    return (
      <div style={{ ...centeredStyle, color: "var(--danger)" }}>
        Pitch analysis failed. {analysisError ?? "Check that the backend is running on localhost:8080."}
      </div>
    );
  }
  if (!pitchData || !targetNotes) {
    return <div style={centeredStyle}>Record to see pitch graph</div>;
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
      <div style={centeredStyle}>
        No pitch frames detected. Try recording a louder sustained note.
      </div>
    );
  }

  const minFreq = Math.max(80, Math.min(...allFreqs) * 0.7);
  const maxFreq = Math.min(2000, Math.max(...allFreqs) * 1.3);
  const visibleTicks = NOTE_TICKS.filter((t) => t.freq >= minFreq && t.freq <= maxFreq);

  // Measure boundary times relative to passage start
  const measureBoundaries: number[] = (() => {
    if (!parsedScore || !passage) return [];
    const measures = parsedScore.parts[0]?.measures ?? [];
    const startM = measures.find((m) => m.number === passage.startMeasure);
    if (!startM) return [];
    const t0 = beatsToSeconds(passage.startMeasure, passage.startBeat, parsedScore.tempo, startM);
    return measures
      .filter((m) => m.number >= passage.startMeasure && m.number <= passage.endMeasure + 1)
      .map((m) => Math.max(0, beatsToSeconds(m.number, 1, parsedScore.tempo, m) - t0))
      .filter((t) => t >= 0);
  })();

  return (
    <div style={{ height: "100%", padding: "12px 4px 8px 0" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 20, left: 48 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--line-soft)" strokeWidth={0.5}
          />

          <XAxis
            dataKey="time"
            type="number"
            domain={[0, duration]}
            tickFormatter={(v: number) => `${v.toFixed(1)}s`}
            stroke="var(--line)"
            tick={{ fill: "var(--ink-4)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={{ stroke: "var(--line)" }}
          />

          <YAxis
            scale="log"
            domain={[minFreq, maxFreq]}
            ticks={visibleTicks.map((t) => t.freq)}
            tickFormatter={(v: number) => {
              const match = visibleTicks.find((t) => Math.abs(t.freq - v) < 1);
              return match ? match.label : "";
            }}
            stroke="var(--line)"
            tick={{ fill: "var(--ink-3)", fontSize: 9, fontFamily: "var(--font-mono)" }}
            tickLine={{ stroke: "var(--line)" }}
          />

          <Tooltip
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value);
              if (!Number.isFinite(v)) return ["", String(name)];
              return [
                `${v.toFixed(1)} Hz (${frequencyToNoteName(v)})`,
                name === "target" ? "Target" : "Voice",
              ];
            }}
            labelFormatter={(label) =>
              typeof label === "number" ? `${label.toFixed(2)}s` : String(label)
            }
            contentStyle={{
              background: "var(--paper)", border: "1px solid var(--line)",
              borderRadius: 6, fontSize: 11, fontFamily: "var(--font-sans)", color: "var(--ink-1)",
            }}
          />

          {/* Measure boundary lines */}
          {measureBoundaries.map((t, i) => (
            <ReferenceLine
              key={t}
              x={t}
              stroke="var(--line)"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : "2 4"}
            />
          ))}

          {/* Target pitch bands — ±25¢ around each note */}
          {displayTargetNotes.map((note, i) => (
            <ReferenceArea
              key={i}
              x1={note.startTime}
              x2={note.endTime}
              y1={note.frequency / BAND_RATIO}
              y2={note.frequency * BAND_RATIO}
              fill="var(--target)"
              fillOpacity={0.22}
              stroke="none"
              label={{
                value: frequencyToNoteName(note.frequency),
                position: "insideTopLeft",
                fontSize: 8.5,
                fill: "var(--target)",
                fontFamily: "var(--font-mono)",
              }}
            />
          ))}

          {/* Target center line (1.6px, full opacity) */}
          <Line
            dataKey="target"
            stroke="var(--target)"
            strokeWidth={1.6}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="target"
          />

          {/* Voice — confident frames */}
          <Line
            dataKey="voice"
            stroke="var(--accent)"
            strokeWidth={2.0}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="voice"
          />

          {/* Voice — low-confidence frames */}
          <Line
            dataKey="voiceFaint"
            stroke="var(--accent)"
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
