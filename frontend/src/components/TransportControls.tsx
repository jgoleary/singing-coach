import { useState, useRef, useCallback, useEffect } from "react";
import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";

const VOICE_INSTRUMENTS = [
  { value: "choir_aahs", label: "Choir aahs" },
  { value: "voice_oohs", label: "Voice oohs" },
  { value: "synth_voice", label: "Synth voice" },
  { value: "flute", label: "Flute" },
  { value: "violin", label: "Violin" },
];

const ACCOMPANIMENT_INSTRUMENTS = [
  { value: "acoustic_grand_piano", label: "Grand piano" },
  { value: "bright_acoustic_piano", label: "Bright piano" },
  { value: "electric_grand_piano", label: "Electric piano" },
  { value: "harpsichord", label: "Harpsichord" },
  { value: "church_organ", label: "Church organ" },
  { value: "acoustic_guitar_nylon", label: "Classical guitar" },
  { value: "string_ensemble_1", label: "Strings" },
];

function IconPlay() {
  return (
    <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
      <path d="M0 0 L9 5 L0 10 Z" />
    </svg>
  );
}
function IconStop() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor">
      <rect width="9" height="9" rx="1" />
    </svg>
  );
}
function IconRepeat() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%", marginTop: 6,
  background: "var(--sidebar-surface)", border: "1px solid var(--sidebar-line)",
  borderRadius: 7, padding: "5px 8px",
  fontSize: 12, color: "var(--sidebar-ink-1)",
  fontFamily: "var(--font-sans)", cursor: "pointer", outline: "none",
};

function PartRow({ label, instrument, isOn, dotColor, onToggle, children }: {
  label: string; instrument: string; isOn: boolean;
  dotColor: string; onToggle: () => void; children?: React.ReactNode;
}) {
  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "14px 1fr auto",
          gap: 10, padding: "6px 0", alignItems: "center", cursor: "pointer",
        }}
      >
        {/* Part dot */}
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          border: `1.5px solid ${dotColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {isOn && <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />}
        </div>
        {/* Names */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--sidebar-ink-1)", lineHeight: 1.3 }}>{label}</div>
          <div style={{ fontSize: 10.5, color: "var(--sidebar-ink-3)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instrument}</div>
        </div>
        {/* On/Off */}
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--sidebar-ink-3)" }}>
          {isOn ? "ON" : "OFF"}
        </span>
      </div>
      {isOn && children}
    </div>
  );
}

export default function TransportControls() {
  const {
    isPlaying, playVoice, playAccompaniment, octaveDown,
    parsedScore, voicePartId, accompanimentPartId,
    voiceInstrument, accompanimentInstrument,
    setPlayVoice, setPlayAccompaniment, setOctaveDown,
    setVoiceInstrument, setAccompanimentInstrument,
  } = useStore();
  const { play, stop } = useAudioEngine();
  const [repeat, setRepeat] = useState(false);
  const repeatRef = useRef(repeat);
  const handlePlayRef = useRef<() => void>(() => {});

  const handleRepeatToggle = () => {
    const next = !repeat;
    setRepeat(next);
    repeatRef.current = next;
  };

  const handlePlay = useCallback(() => {
    play(repeatRef.current ? () => handlePlayRef.current() : undefined);
  }, [play]);

  useEffect(() => {
    handlePlayRef.current = handlePlay;
  }, [handlePlay]);

  if (!parsedScore) return null;

  const hasPlayablePart = (playVoice && voicePartId) || (playAccompaniment && accompanimentPartId);
  const voiceInstrumentLabel = VOICE_INSTRUMENTS.find((i) => i.value === voiceInstrument)?.label ?? voiceInstrument;
  const accompanimentInstrumentLabel = ACCOMPANIMENT_INSTRUMENTS.find((i) => i.value === accompanimentInstrument)?.label ?? accompanimentInstrument;

  return (
    <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--sidebar-line-soft)" }}>
      {/* Section title */}
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.12em", color: "var(--sidebar-ink-3)", marginBottom: 12,
      }}>Playback</div>

      {/* Transport row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button
          type="button"
          onClick={isPlaying ? stop : handlePlay}
          disabled={!isPlaying && !hasPlayablePart}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "7px 10px", borderRadius: 7, fontSize: 12.5, fontWeight: 500,
            background: isPlaying ? "var(--danger)" : "var(--accent)",
            border: "none", color: "white",
            cursor: hasPlayablePart || isPlaying ? "pointer" : "not-allowed",
            opacity: !isPlaying && !hasPlayablePart ? 0.4 : 1,
          }}
        >
          {isPlaying ? <IconStop /> : <IconPlay />}
          {isPlaying ? "Stop" : hasPlayablePart ? "Play passage" : "Select part"}
        </button>

        {/* Loop button */}
        <button
          type="button" onClick={handleRepeatToggle}
          style={{
            width: 32, height: 32, flexShrink: 0, borderRadius: 7,
            border: `1px solid ${repeat ? "var(--accent)" : "var(--sidebar-line)"}`,
            background: repeat ? "var(--accent-soft)" : "var(--sidebar-surface)",
            color: repeat ? "var(--accent)" : "var(--sidebar-ink-3)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <IconRepeat />
        </button>
      </div>

      {/* Voice part row */}
      <PartRow
        label="Voice" instrument={voiceInstrumentLabel}
        isOn={playVoice} dotColor="var(--accent)"
        onToggle={() => setPlayVoice(!playVoice)}
      >
        {voicePartId && (
          <select value={voiceInstrument} onChange={(e) => setVoiceInstrument(e.target.value)} style={selectStyle}>
            {VOICE_INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        )}
      </PartRow>

      {/* Accompaniment part row */}
      <PartRow
        label="Accompaniment" instrument={accompanimentInstrumentLabel}
        isOn={playAccompaniment} dotColor="var(--target)"
        onToggle={() => setPlayAccompaniment(!playAccompaniment)}
      >
        {accompanimentPartId && (
          <select value={accompanimentInstrument} onChange={(e) => setAccompanimentInstrument(e.target.value)} style={selectStyle}>
            {ACCOMPANIMENT_INSTRUMENTS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        )}
      </PartRow>

      {/* Octave-down toggle pill */}
      <div
        onClick={() => setOctaveDown(!octaveDown)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "7px 0", cursor: "pointer",
          fontSize: 12, color: octaveDown ? "var(--sidebar-ink-1)" : "var(--sidebar-ink-3)",
          marginTop: 2,
        }}
      >
        {/* Pill track */}
        <div style={{
          width: 28, height: 16, borderRadius: 8, flexShrink: 0,
          background: octaveDown ? "var(--accent-soft)" : "var(--sidebar-surface)",
          border: `1px solid ${octaveDown ? "var(--accent)" : "var(--sidebar-line)"}`,
          display: "flex", alignItems: "center", padding: "0 2px",
          position: "relative",
        }}>
          <div
            className="toggle-knob"
            style={{
              width: 11, height: 11, borderRadius: "50%",
              background: octaveDown ? "var(--accent)" : "var(--sidebar-ink-3)",
              transform: octaveDown ? "translateX(12px)" : "translateX(0)",
            }}
          />
        </div>
        Octave ↓ on graph
      </div>
    </div>
  );
}
