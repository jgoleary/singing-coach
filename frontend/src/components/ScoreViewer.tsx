import { useEffect, useRef, useState } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useStore } from "../store/useStore";

type OsmdWithCursor = OpenSheetMusicDisplay & {
  cursor: {
    reset: () => void;
    show: () => void;
    next: () => void;
  };
};

declare global {
  interface Window {
    __lastLoadedXml?: string;
    __osmd?: {
      cursor: {
        reset: () => void;
        show: () => void;
        next: () => void;
      };
    };
  }
}

const metaLabelStyle: React.CSSProperties = {
  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "var(--ink-4)", fontFamily: "var(--font-sans)",
};
const metaValueStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-1)", marginLeft: 4,
};

export default function ScoreViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OsmdWithCursor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsedScore = useStore((s) => s.parsedScore);
  const passage = useStore((s) => s.passage);

  useEffect(() => {
    if (!parsedScore || !containerRef.current) return;
    const xml = window.__lastLoadedXml;
    if (!xml) return;

    let cancelled = false;

    async function renderScore() {
      try {
        setError(null);
        if (!osmdRef.current && containerRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: true,
            drawingParameters: "default",
            drawCredits: false,
          }) as OsmdWithCursor;
          window.__osmd = osmdRef.current;
        }

        await osmdRef.current!.load(xml);
        if (cancelled) return;
        osmdRef.current!.render();
        osmdRef.current!.cursor.reset();
        osmdRef.current!.cursor.show();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to render score";
        setError(message);
      }
    }

    renderScore();

    return () => { cancelled = true; };
  }, [parsedScore]);

  const regionHeader = (showMeta: boolean) => (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      marginBottom: 12,
    }}>
      <span style={{
        fontFamily: "var(--font-display)", fontStyle: "italic",
        fontSize: 18, fontWeight: 500, color: "var(--ink-1)",
      }}>Score</span>

      {showMeta && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          {passage && (
            <span>
              <span style={metaLabelStyle}>Passage</span>
              <span style={metaValueStyle}>
                m.{passage.startMeasure}.{passage.startBeat} → {passage.endMeasure}.{passage.endBeat}
              </span>
            </span>
          )}
          {parsedScore && (
            <span>
              <span style={metaLabelStyle}>Tempo</span>
              <span style={metaValueStyle}>♩ = {parsedScore.tempo}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!parsedScore) {
    return (
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        padding: "20px 24px 12px", boxSizing: "border-box",
      }}>
        {regionHeader(false)}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px dashed var(--line)", borderRadius: "var(--radius)",
          background: "var(--surface-2)",
          color: "var(--ink-3)", fontSize: 13.5,
        }}>
          Load a file to get started
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      padding: "20px 24px 12px", boxSizing: "border-box",
    }}>
      <div style={{ flexShrink: 0 }}>{regionHeader(true)}</div>

      {/* Paper card — fills remaining height, OSMD scrolls inside */}
      <div style={{
        flex: 1, minHeight: 0,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-1)",
        padding: "22px 28px 18px",
        overflowY: "auto",
      }}>
        {error && (
          <div style={{
            marginBottom: 12, padding: "8px 10px",
            border: "1px solid var(--line)", borderRadius: 6,
            background: "var(--surface-2)", fontSize: 13, color: "var(--ink-2)",
          }}>
            Could not render score: {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: "100%" }} />
      </div>
    </div>
  );
}
