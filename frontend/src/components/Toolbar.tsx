import { useState, useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { parseScore } from "../utils/musicxml";
import { getLibrary, loadFromLibrary, updateMeta, setActiveFilename, scoreTitle } from "../utils/scoreLibrary";
import { useIsMobile } from "../hooks/useMediaQuery";

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
  const { parsedScore, scoreId, voicePartId, accompanimentPartId, setVoicePartId, setAccompanimentPartId } = useStore();
  const isMobile = useIsMobile();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [library, setLibrary] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTitle = scoreId ? scoreTitle(scoreId) : "";
  const parts = parsedScore?.parts ?? [];

  // Refresh library list when dropdown opens
  useEffect(() => {
    if (dropdownOpen) setLibrary(getLibrary());
  }, [dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dropdownOpen]);

  function switchToScore(filename: string) {
    setDropdownOpen(false);
    const saved = loadFromLibrary(filename);
    if (!saved) return;
    try {
      const score = parseScore(saved.xml);
      window.__lastLoadedXml = saved.xml;
      setActiveFilename(filename);
      useStore.getState().setParsedScore(score);
      useStore.getState().setVoicePartId(saved.voicePartId);
      useStore.getState().setAccompanimentPartId(saved.accompanimentPartId);
      useStore.getState().loadScoreSettings(filename);
    } catch { /* malformed stored XML */ }
  }

  function handleVoiceChange(id: string | null) {
    setVoicePartId(id);
    if (scoreId) updateMeta(scoreId, id, useStore.getState().accompanimentPartId);
  }

  function handleAccompChange(id: string | null) {
    setAccompanimentPartId(id);
    if (scoreId) updateMeta(scoreId, useStore.getState().voicePartId, id);
  }

  const voiceName = parts.find((p) => p.id === voicePartId)?.name ?? "None";
  const accompName = parts.find((p) => p.id === accompanimentPartId)?.name ?? "None";

  return (
    <div style={{
      height: isMobile ? "auto" : 56,
      minHeight: 56,
      flexShrink: 0,
      display: "flex", alignItems: "center",
      flexWrap: isMobile ? "wrap" : "nowrap",
      rowGap: isMobile ? 8 : 0,
      paddingInline: 18,
      paddingBlock: isMobile ? 10 : 0,
      gap: 0,
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

        {/* File pill with library dropdown */}
        <div ref={dropdownRef} style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 10px 5px 8px", borderRadius: 7,
              background: dropdownOpen ? "var(--surface-3)" : "var(--surface-2)",
              border: `1px solid ${dropdownOpen ? "var(--line-bright)" : "var(--line)"}`,
              fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)",
              cursor: "pointer", maxWidth: 220,
            }}
          >
            <span style={{ color: "var(--ink-3)", flexShrink: 0 }}><FileIcon /></span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentTitle || "Load a score…"}
            </span>
            <span style={{ color: "var(--ink-4)", flexShrink: 0 }}><ChevDown /></span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
              minWidth: 200, maxWidth: 280,
              background: "var(--surface-3)", border: "1px solid var(--line)",
              borderRadius: 10, boxShadow: "0 4px 16px oklch(0.2 0 0 / 0.12)",
              overflow: "hidden",
            }}>
              {library.length > 0 && (
                <>
                  <div style={{
                    padding: "8px 12px 4px",
                    fontSize: 10, fontWeight: 500, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: "var(--ink-4)",
                  }}>Your scores</div>
                  {library.map((filename) => (
                    <button
                      key={filename}
                      type="button"
                      onClick={() => switchToScore(filename)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "7px 12px", border: "none", background: "transparent",
                        fontSize: 13, color: filename === scoreId ? "var(--accent)" : "var(--ink-1)",
                        fontWeight: filename === scoreId ? 500 : 400,
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {scoreTitle(filename)}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
                </>
              )}
              <button
                type="button"
                onClick={() => { setDropdownOpen(false); openFilePicker(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "7px 12px", border: "none", background: "transparent",
                  fontSize: 13, color: "var(--ink-2)", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Import new score…
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: piece title ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0, padding: "0 20px" }}>
        {currentTitle ? (
          <>
            <div style={{
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: 17, fontWeight: 500, color: "var(--ink-1)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            }}>{currentTitle}</div>
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
        <div style={{
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          flexBasis: isMobile ? "100%" : "auto",
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}>
          <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", marginRight: 2 }}>Parts</span>

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
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
              >
                <option value="">— none —</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

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
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
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
