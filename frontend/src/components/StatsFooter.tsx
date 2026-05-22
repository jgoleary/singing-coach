import { useStore } from "../store/useStore";
import { computeStats } from "../utils/stats";

function formatAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${m}:${s.toString().padStart(2, "0")} ago`;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 500, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: 1,
};
const valueStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontStyle: "italic",
  fontSize: 16, fontWeight: 400, color: "var(--ink-1)", lineHeight: 1,
};
const unitStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: "var(--ink-3)",
  fontFamily: "var(--font-sans)", fontStyle: "normal", marginLeft: 1,
};
const divider: React.CSSProperties = {
  width: 1, height: 20, background: "var(--line-soft)", flexShrink: 0,
};

function Chip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{children}</div>
    </div>
  );
}

export default function StatsFooter({
  isPitchActive,
  onSwitchToPitch,
}: {
  isPitchActive: boolean;
  onSwitchToPitch: () => void;
}) {
  const { lastRecordingBlob, pitchData, targetNotes, octaveDown, takeNumber, lastRecordingAt, pitchToleranceCents } =
    useStore();

  if (!lastRecordingBlob) return null;

  const displayTargetNotes =
    octaveDown && targetNotes
      ? targetNotes.map((n) => ({ ...n, frequency: n.frequency / 2 }))
      : targetNotes;
  const stats =
    pitchData && displayTargetNotes ? computeStats(pitchData, displayTargetNotes, pitchToleranceCents) : null;

  return (
    <div
      style={{
        height: 56, flexShrink: 0,
        background: "var(--surface-2)", borderTop: "1px solid var(--line)",
        padding: "0 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: isPitchActive ? "default" : "pointer",
      }}
      onClick={isPitchActive ? undefined : onSwitchToPitch}
    >
      {/* Left chip cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {stats && (
          <>
            <Chip label="Median error">
              ±{stats.medianCents}<span style={unitStyle}>¢</span>
            </Chip>
            <div style={divider} />
            <Chip label="On pitch">
              <span style={{ color: stats.pctOnPitch >= 70 ? "var(--success)" : "var(--ink-1)" }}>
                {stats.pctOnPitch}
              </span>
              <span style={unitStyle}>%</span>
            </Chip>
            <div style={divider} />
          </>
        )}
        <Chip label={`Take #${takeNumber}`}>
          {lastRecordingAt ? (
            <span style={{
              fontSize: 13, fontFamily: "var(--font-mono)", fontStyle: "normal",
              color: "var(--ink-3)",
            }}>
              {formatAgo(lastRecordingAt)}
            </span>
          ) : "—"}
        </Chip>
      </div>

      {/* Right: switch-to-pitch action */}
      {!isPitchActive && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSwitchToPitch(); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)",
            fontFamily: "var(--font-sans)", padding: 0,
          }}
        >
          Open pitch analysis →
        </button>
      )}
    </div>
  );
}
