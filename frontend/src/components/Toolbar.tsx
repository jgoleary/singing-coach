import { useStore } from "../store/useStore";
import { loadScoreFromStorage, saveScoreToStorage } from "./FileLoader";

function openFilePicker() {
  (document.getElementById("file-input-trigger") as HTMLInputElement | null)?.click();
}

const ChevDown = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const FileIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export default function Toolbar() {
  const { parsedScore, voicePartId, accompanimentPartId, setVoicePartId, setAccompanimentPartId } = useStore();
  const stored = loadScoreFromStorage();
  const fileName = stored?.fileName ?? "";
  const pieceTitle = fileName.replace(/\.(mxl|xml|musicxml)$/i, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  const parts = parsedScore?.parts ?? [];

  function handleVoiceChange(id: string | null) {
    setVoicePartId(id);
    const xml = window.__lastLoadedXml;
    if (xml) saveScoreToStorage(xml, fileName, id, useStore.getState().accompanimentPartId);
  }

  function handleAccompChange(id: string | null) {
    setAccompanimentPartId(id);
    const xml = window.__lastLoadedXml;
    if (xml) saveScoreToStorage(xml, fileName, useStore.getState().voicePartId, id);
  }

  const voiceName = parts.find((p) => p.id === voicePartId)?.name ?? "None";
  const accompName = parts.find((p) => p.id === accompanimentPartId)?.name ?? "None";

  return (
    <div style={{
      height: 56, flexShrink: 0,
      display: "flex", alignItems: "center",
      paddingInline: 18, gap: 0,
      borderBottom: "1px solid var(--line)",
      background: "var(--bg)",
    }}>
      {/* ── Brand ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: "var(--accent)",
          boxShadow: "0 1px 0 oklch(1 0 0 / 0.25) inset, 0 2px 6px var(--accent-soft)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 17, fontWeight: 500, letterSpacing: "-0.02em",
        }}>V</div>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>Vox</span>

        <div style={{ width: 1, height: 16, background: "var(--line)", marginInline: 6 }} />

        {/* File pill */}
        <button
          onClick={openFilePicker}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 10px 5px 8px", borderRadius: 7,
            background: "var(--surface-2)", border: "1px solid var(--line)",
            fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)",
            cursor: "pointer", maxWidth: 220, transition: "border-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--line-bright)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
        >
          <span style={{ color: "var(--ink-3)", flexShrink: 0 }}><FileIcon /></span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName || "Load a score…"}
          </span>
          <span style={{ color: "var(--ink-4)", flexShrink: 0 }}><ChevDown /></span>
        </button>
      </div>

      {/* ── Center: piece title ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, padding: "0 20px" }}>
        {pieceTitle ? (
          <>
            <div style={{
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: 17, fontWeight: 500, color: "var(--ink-1)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            }}>{pieceTitle}</div>
            {parsedScore && (
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1, fontFamily: "var(--font-sans)" }}>
                ♩ = {parsedScore.tempo}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: "var(--ink-4)", fontStyle: "italic", fontFamily: "var(--font-display)" }}>
            No score loaded
          </div>
        )}
      </div>

      {/* ── Right: part-assignment chips ── */}
      {parts.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", marginRight: 2 }}>Parts</span>

          {/* Voice chip */}
          <div style={{ position: "relative" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 8px 4px 6px", borderRadius: 6,
              background: "var(--surface-2)", border: "1px solid var(--line)",
              fontSize: 12, cursor: "pointer",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
              <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>Voice</span>
              <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>· {voiceName}</span>
              <span style={{ color: "var(--ink-4)" }}><ChevDown /></span>
              <select
                value={voicePartId ?? ""}
                onChange={(e) => handleVoiceChange(e.target.value || null)}
                style={{
                  position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%",
                }}
              >
                <option value="">— none —</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Accompaniment chip */}
          <div style={{ position: "relative" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 8px 4px 6px", borderRadius: 6,
              background: "var(--surface-2)", border: "1px solid var(--line)",
              fontSize: 12, cursor: "pointer",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--target)", flexShrink: 0 }} />
              <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>Accomp</span>
              <span style={{ color: "var(--ink-1)", fontWeight: 500 }}>· {accompName}</span>
              <span style={{ color: "var(--ink-4)" }}><ChevDown /></span>
              <select
                value={accompanimentPartId ?? ""}
                onChange={(e) => handleAccompChange(e.target.value || null)}
                style={{
                  position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%",
                }}
              >
                <option value="">— none —</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
