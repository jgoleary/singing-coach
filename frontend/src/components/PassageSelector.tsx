import { useState } from "react";
import { useStore } from "../store/useStore";
import { beatsToSeconds } from "../utils/noteUtils";

function Stepper({ value, onChange, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
}) {
  const btnStyle: React.CSSProperties = {
    width: 26, flexShrink: 0, background: "transparent", border: "none",
    color: "var(--sidebar-ink-3)", cursor: "pointer", fontSize: 15, lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  };
  return (
    <div style={{
      display: "flex", width: "100%", minWidth: 0,
      background: "var(--sidebar-surface)", border: "1px solid var(--sidebar-line)",
      borderRadius: 7, overflow: "hidden",
    }}>
      <button type="button" style={{ ...btnStyle, borderRight: "1px solid var(--sidebar-line)" }}
        onClick={() => onChange(min !== undefined ? Math.max(min, value - step) : value - step)}
      >−</button>
      <input
        type="number" value={value} min={min} max={max} step={step}
        className="stepper-input"
        onChange={(e) => {
          const v = step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value);
          if (!isNaN(v)) onChange(v);
        }}
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
          textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12,
          color: "var(--ink-1)", padding: "4px 0", width: 0,
        }}
      />
      <button type="button" style={{ ...btnStyle, borderLeft: "1px solid var(--sidebar-line)" }}
        onClick={() => onChange(max !== undefined ? Math.min(max, value + step) : value + step)}
      >+</button>
    </div>
  );
}

const fieldLblStyle: React.CSSProperties = {
  fontSize: 10.5, color: "var(--sidebar-ink-3)", marginBottom: 4, display: "block",
};

export default function PassageSelector() {
  const { parsedScore, setPassage } = useStore();
  const [startMeasure, setStartMeasure] = useState(1);
  const [startBeat, setStartBeat] = useState(1);
  const [endMeasure, setEndMeasure] = useState(1);
  const [endBeat, setEndBeat] = useState(4);

  const lastMeasure = parsedScore?.parts[0]?.measures.at(-1)?.number ?? 1;
  const lastBeats = parsedScore?.parts[0]?.measures.at(-1)?.beats ?? 4;
  const lastBeatAfterMeasure = lastBeats + 1;

  function applyIfValid(sm: number, sb: number, em: number, eb: number) {
    if (!parsedScore) return;
    const firstMeasure = parsedScore.parts[0]?.measures[0];
    const lastMeasureData = parsedScore.parts[0]?.measures.at(-1);
    if (!firstMeasure || !lastMeasureData) return;
    const start = beatsToSeconds(sm, sb, parsedScore.tempo, firstMeasure);
    const end = beatsToSeconds(em, eb, parsedScore.tempo, lastMeasureData);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      setPassage({ startMeasure: sm, startBeat: sb, endMeasure: em, endBeat: eb });
    }
  }

  const isInvalid = (() => {
    if (!parsedScore) return false;
    const firstMeasure = parsedScore.parts[0]?.measures[0];
    const lastMeasureData = parsedScore.parts[0]?.measures.at(-1);
    if (!firstMeasure || !lastMeasureData) return false;
    const start = beatsToSeconds(startMeasure, startBeat, parsedScore.tempo, firstMeasure);
    const end = beatsToSeconds(endMeasure, endBeat, parsedScore.tempo, lastMeasureData);
    return !(Number.isFinite(start) && Number.isFinite(end) && end > start);
  })();

  function handleWholePiece() {
    setStartMeasure(1);
    setStartBeat(1);
    setEndMeasure(lastMeasure);
    setEndBeat(lastBeatAfterMeasure);
    setPassage({ startMeasure: 1, startBeat: 1, endMeasure: lastMeasure, endBeat: lastBeatAfterMeasure });
  }

  if (!parsedScore) return null;

  return (
    <div style={{
      padding: "16px 16px 14px",
      borderBottom: "1px solid var(--sidebar-line-soft)",
    }}>
      {/* Section title */}
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.12em", color: "var(--sidebar-ink-3)", marginBottom: 12,
      }}>Passage</div>

      {/* 2×2 stepper grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 10px", marginBottom: 12 }}>
        <div>
          <span style={fieldLblStyle}>Start measure</span>
          <Stepper value={startMeasure} min={1} max={lastMeasure} step={1}
            onChange={(v) => { setStartMeasure(v); applyIfValid(v, startBeat, endMeasure, endBeat); }} />
        </div>
        <div>
          <span style={fieldLblStyle}>Beat</span>
          <Stepper value={startBeat} min={1} step={0.25}
            onChange={(v) => { setStartBeat(v); applyIfValid(startMeasure, v, endMeasure, endBeat); }} />
        </div>
        <div>
          <span style={fieldLblStyle}>End measure</span>
          <Stepper value={endMeasure} min={1} max={lastMeasure} step={1}
            onChange={(v) => { setEndMeasure(v); applyIfValid(startMeasure, startBeat, v, endBeat); }} />
        </div>
        <div>
          <span style={fieldLblStyle}>Beat</span>
          <Stepper value={endBeat} min={1} step={0.25}
            onChange={(v) => { setEndBeat(v); applyIfValid(startMeasure, startBeat, endMeasure, v); }} />
        </div>
      </div>

      {/* Validation hint */}
      {isInvalid && (
        <div style={{ fontSize: 10.5, color: "var(--danger)", marginBottom: 8 }}>
          End must be after start.
        </div>
      )}

      {/* Whole piece shortcut */}
      <button
        type="button" onClick={handleWholePiece}
        style={{
          width: "100%", padding: "7px 10px", borderRadius: 7, fontSize: 12, fontWeight: 500,
          background: "transparent", border: "1px solid var(--sidebar-line)",
          color: "var(--sidebar-ink-3)", cursor: "pointer",
        }}
      >Whole piece</button>
    </div>
  );
}
