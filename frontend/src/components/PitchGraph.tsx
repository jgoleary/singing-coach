import { useRef, useState } from "react";
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
import * as Tone from "tone";
import Soundfont from "soundfont-player";
import { useStore } from "../store/useStore";
import { frequencyToNoteName, beatsToSeconds } from "../utils/noteUtils";
import { pixelsToTime, panDomain } from "../utils/zoomUtils";
import type { PitchFrame, TargetNote } from "../types";

type SoundfontInstrumentPlayer = {
  play: (note: number, when?: number, options?: { duration?: number }) => unknown;
};
type SoundfontPlayerLib = {
  instrument: (
    ctx: AudioContext,
    name: string,
    opts: { soundfont: string }
  ) => Promise<SoundfontInstrumentPlayer>;
};

let _pianoPromise: Promise<SoundfontInstrumentPlayer | null> | null = null;

function getPiano(): Promise<SoundfontInstrumentPlayer | null> {
  if (!_pianoPromise) {
    const ctx = Tone.getContext().rawContext as AudioContext;
    _pianoPromise = (Soundfont as unknown as SoundfontPlayerLib)
      .instrument(ctx, "acoustic_grand_piano", { soundfont: "MusyngKite" })
      .catch(() => { _pianoPromise = null; return null; });
  }
  return _pianoPromise;
}

function freqToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

function playPreviewNote(frequency: number) {
  Tone.start();
  getPiano().then((piano) => {
    if (piano) {
      piano.play(freqToMidi(frequency), Tone.getContext().currentTime, { duration: 0.75 });
    } else {
      const synth = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.15, release: 0.6 },
      }).toDestination();
      synth.triggerAttackRelease(frequency, 0.75);
      setTimeout(() => synth.dispose(), 4000);
    }
  });
}

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
        voice: frame && frame.confidence >= 0.65 ? frame.frequency : null,
        voiceFaint: frame && frame.confidence < 0.65 ? frame.frequency : null,
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

function ToolbarButton({
  active, onClick, title, children,
}: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        width: 24, height: 24, padding: 0, borderRadius: 4, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${active ? "var(--accent)" : "var(--line)"}`,
        background: active ? "var(--accent-soft)" : "var(--paper)",
        color: active ? "var(--accent)" : "var(--ink-3)",
      }}
    >
      {children}
    </button>
  );
}

function ChartToolbar({
  mode, onModeChange, canReset, onReset,
}: {
  mode: "note" | "zoom";
  onModeChange: (m: "note" | "zoom") => void;
  canReset: boolean;
  onReset: () => void;
}) {
  return (
    <div style={{
      position: "absolute", top: 6, right: 12, zIndex: 10,
      display: "flex", gap: 3,
      background: "var(--paper)", padding: 2, borderRadius: 5,
      border: "1px solid var(--line-soft)",
    }}>
      <ToolbarButton
        active={mode === "note"}
        onClick={() => onModeChange("note")}
        title="Play notes (click target notes)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={mode === "zoom"}
        onClick={() => onModeChange("zoom")}
        title="Zoom (drag to zoom in; drag to pan when zoomed)"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <line x1="21" y1="21" x2="15.5" y2="15.5" />
          <line x1="7" y1="10.5" x2="14" y2="10.5" />
          <line x1="10.5" y1="7" x2="10.5" y2="14" />
        </svg>
      </ToolbarButton>
      {canReset && (
        <ToolbarButton onClick={onReset} title="Reset zoom">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </ToolbarButton>
      )}
    </div>
  );
}

export default function PitchGraph() {
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);
  const octaveDown = useStore((s) => s.octaveDown);
  const analysisStatus = useStore((s) => s.analysisStatus);
  const analysisError = useStore((s) => s.analysisError);
  const parsedScore = useStore((s) => s.parsedScore);
  const passage = useStore((s) => s.passage);
  const pitchToleranceCents = useStore((s) => s.pitchToleranceCents);
  const bandRatio = Math.pow(2, pitchToleranceCents / 1200);

  // Zoom/pan state
  type DragStart = { time: number; chartX: number; domain: [number, number] | null } | null;
  const dragStartRef = useRef<DragStart>(null);
  const dragCurrentRef = useRef<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
  const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [chartMode, setChartMode] = useState<"note" | "zoom">("note");
  const containerRef = useRef<HTMLDivElement>(null);

  function resetZoom() {
    setZoomedDomain(null);
    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragCurrent(null);
    setIsPanning(false);
  }

  function getChartInnerWidth(): number {
    if (!containerRef.current) return 700;
    return containerRef.current.getBoundingClientRect().width - 48 - 16; // left + right margins
  }

  type ChartState = { activeLabel?: string | number; chartX?: number };
  type ChartMouseEvent = { clientX: number };

  function timeFromLabel(label: string | number | undefined): number | null {
    if (label == null) return null;
    const t = typeof label === "number" ? label : parseFloat(label);
    return Number.isFinite(t) ? t : null;
  }

  if (analysisStatus === "analyzing") {
    return <div style={centeredStyle}>Analyzing recording…</div>;
  }
  if (analysisStatus === "error") {
    return (
      <div style={{ ...centeredStyle, color: "var(--danger)" }}>
        Pitch analysis failed. {analysisError ?? "Check that the backend is running or VITE_BACKEND_URL is set."}
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

  // X domain: clip to where target notes actually exist, plus a small margin
  const targetStart = Math.min(...displayTargetNotes.map((n) => n.startTime));
  const targetEnd = Math.max(...displayTargetNotes.map((n) => n.endTime));
  const xMin = Math.max(0, targetStart - 0.5);
  const xMax = Math.min(duration, targetEnd + 0.5);
  const [domainMin, domainMax] = zoomedDomain ?? [xMin, xMax];

  // Y domain: only frames/notes visible within the current X window
  const visibleFrames = pitchData.filter(
    (f) => f.time >= domainMin && f.time <= domainMax
  );
  const visibleTargets = displayTargetNotes.filter(
    (n) => n.endTime >= domainMin && n.startTime <= domainMax
  );
  const confidentFreqs = visibleFrames
    .filter((f) => f.confidence >= 0.65)
    .map((f) => f.frequency);
  const allFreqs = [
    ...confidentFreqs,
    ...visibleTargets.map((n) => n.frequency),
  ].filter(Boolean);

  if (duration <= 0 || allFreqs.length === 0) {
    if (zoomedDomain !== null) {
      return (
        <div
          ref={containerRef}
          style={{ height: "100%", padding: "12px 4px 8px 0", position: "relative", cursor: "zoom-out" }}
          onDoubleClick={resetZoom}
        >
          <div style={centeredStyle}>
            No pitch data in this range. Double-click to reset zoom.
          </div>
        </div>
      );
    }
    return (
      <div style={centeredStyle}>
        No pitch frames detected. Try recording a louder sustained note.
      </div>
    );
  }

  const minFreq = Math.max(80, Math.min(...allFreqs) * 0.85);
  const maxFreq = Math.min(2000, Math.max(...allFreqs) * 1.15);

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

  function handleChartClick(state: { activeLabel?: string | number }) {
    if (chartMode !== "note") return;
    const raw = state.activeLabel;
    if (raw == null) return;
    const time = typeof raw === "number" ? raw : parseFloat(raw);
    if (!Number.isFinite(time)) return;
    const note = displayTargetNotes.find(
      (n) => time >= n.startTime && time < n.endTime
    );
    if (!note) return;
    playPreviewNote(note.frequency);
  }

  function handleMouseDown(state: ChartState, event: ChartMouseEvent) {
    if (chartMode !== "zoom") return;
    const time = timeFromLabel(state.activeLabel);
    const chartX = state.chartX ?? event?.clientX;
    if (time == null || chartX == null) return;
    dragStartRef.current = { time, chartX, domain: zoomedDomain };
    if (zoomedDomain !== null) setIsPanning(true);
  }

  function handleMouseMove(state: ChartState, event: ChartMouseEvent) {
    if (chartMode !== "zoom" || !dragStartRef.current) return;
    const chartX = state.chartX ?? event?.clientX;
    const time = timeFromLabel(state.activeLabel);
    if (time == null || chartX == null) return;

    if (dragStartRef.current.domain === null) {
      // zoom mode: update selection endpoint
      dragCurrentRef.current = time;
      setDragCurrent(time);
    } else {
      // pan mode: shift domain based on total displacement from drag start
      const deltaPixels = dragStartRef.current.chartX - chartX;
      const domainWidth = dragStartRef.current.domain[1] - dragStartRef.current.domain[0];
      const deltaTime = pixelsToTime(deltaPixels, domainWidth, getChartInnerWidth());
      setZoomedDomain(panDomain(dragStartRef.current.domain, deltaTime, [0, duration]));
    }
  }

  function handleMouseUp() {
    const ds = dragStartRef.current;
    if (!ds) return;

    const finalDragCurrent = dragCurrentRef.current;
    if (ds.domain === null && finalDragCurrent !== null) {
      const t0 = Math.min(ds.time, finalDragCurrent);
      const t1 = Math.max(ds.time, finalDragCurrent);
      if (t1 - t0 >= 0.5) setZoomedDomain([t0, t1]);
    }

    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragCurrent(null);
    setIsPanning(false);
  }

  function handleMouseLeave() {
    const ds = dragStartRef.current;
    if (!ds) return;

    // commit zoom if span is large enough; discard pan (domain already updated live)
    const finalDragCurrent = dragCurrentRef.current;
    if (ds.domain === null && finalDragCurrent !== null) {
      const t0 = Math.min(ds.time, finalDragCurrent);
      const t1 = Math.max(ds.time, finalDragCurrent);
      if (t1 - t0 >= 0.5) setZoomedDomain([t0, t1]);
    }

    dragStartRef.current = null;
    dragCurrentRef.current = null;
    setDragCurrent(null);
    setIsPanning(false);
  }

  return (
    <div ref={containerRef} style={{ height: "100%", padding: "12px 4px 8px 0", position: "relative" }}>
      <ChartToolbar
        mode={chartMode}
        onModeChange={setChartMode}
        canReset={zoomedDomain !== null}
        onReset={resetZoom}
      />
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 20, left: 48 }}
          onClick={handleChartClick}
          onMouseDown={handleMouseDown as (s: unknown) => void}
          onMouseMove={handleMouseMove as (s: unknown) => void}
          onMouseUp={handleMouseUp as (s: unknown) => void}
          onMouseLeave={handleMouseLeave}
          style={{
            cursor:
              chartMode === "note"
                ? "pointer"
                : zoomedDomain === null
                ? "crosshair"
                : isPanning
                ? "grabbing"
                : "grab",
          }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--line-soft)" strokeWidth={0.5}
          />

          <XAxis
            dataKey="time"
            type="number"
            domain={[domainMin, domainMax]}
            allowDataOverflow
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
              y1={note.frequency / bandRatio}
              y2={note.frequency * bandRatio}
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

          {/* Lyric syllables — full-height invisible ReferenceArea so the label
              has the full chart y-range as its viewBox and insideBottomLeft works */}
          {displayTargetNotes.filter((n) => n.lyric).map((note, i) => (
            <ReferenceArea
              key={`lyric-${i}`}
              x1={note.startTime}
              x2={note.endTime}
              y1={minFreq}
              y2={maxFreq}
              fill="none"
              stroke="none"
              label={{
                value: note.lyric,
                position: "insideBottomLeft",
                fontSize: 10,
                fill: "oklch(0.34 0.013 60)",
                fontStyle: "italic",
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

          {/* Zoom drag selection rectangle */}
          {dragCurrent !== null && dragStartRef.current?.domain === null && (
            <ReferenceArea
              x1={Math.min(dragStartRef.current!.time, dragCurrent)}
              x2={Math.max(dragStartRef.current!.time, dragCurrent)}
              fill="rgba(99, 102, 241, 0.08)"
              stroke="rgba(99, 102, 241, 0.5)"
              strokeWidth={1.5}
              ifOverflow="visible"
            />
          )}

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
