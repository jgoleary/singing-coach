import { useStore } from "../store/useStore";

function passageLabel(p: { startMeasure: number; startBeat: number; endMeasure: number; endBeat: number }) {
  return `m.${p.startMeasure}.${p.startBeat} → ${p.endMeasure}.${p.endBeat}`;
}

export default function FlaggedPassages() {
  const { flaggedPassages, removeFlaggedPassage, setPassage } = useStore();

  if (flaggedPassages.length === 0) return null;

  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--sidebar-line-soft)" }}>
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.12em", color: "var(--sidebar-ink-3)", marginBottom: 8,
      }}>Saved passages</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {flaggedPassages.map((fp) => (
          <div
            key={fp.id}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--sidebar-surface)",
              border: "1px solid var(--sidebar-line)",
              borderRadius: 7, overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setPassage(fp.passage)}
              style={{
                flex: 1, padding: "6px 10px", background: "transparent", border: "none",
                textAlign: "left", cursor: "pointer",
                fontFamily: "var(--font-mono)", fontSize: 11.5,
                color: "var(--sidebar-ink-1)",
              }}
            >
              {passageLabel(fp.passage)}
            </button>
            <button
              type="button"
              onClick={() => removeFlaggedPassage(fp.id)}
              title="Remove"
              style={{
                width: 28, height: "100%", flexShrink: 0,
                background: "transparent",
                borderLeft: "1px solid var(--sidebar-line)",
                color: "var(--sidebar-ink-4)", cursor: "pointer",
                fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
