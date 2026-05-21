import { useEffect, useRef, useState, useCallback } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useStore } from "../store/useStore";

type OsmdCursor = {
  reset: () => void;
  show: () => void;
  next: () => void;
};

type OsmdWithCursor = OpenSheetMusicDisplay & {
  cursor: OsmdCursor;
};

declare global {
  interface Window {
    __lastLoadedXml?: string;
    __osmd?: {
      cursor: OsmdCursor;
    };
  }
}

type MeasureRect = { left: number; top: number; width: number; height: number };

const metaLabelStyle: React.CSSProperties = {
  fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "var(--ink-4)", fontFamily: "var(--font-sans)",
};
const metaValueStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-1)", marginLeft: 4,
};

export default function ScoreViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OsmdWithCursor | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [measureRects, setMeasureRects] = useState<MeasureRect[]>([]);
  const [anchorMeasure, setAnchorMeasure] = useState<number | null>(null);
  const [hoveredMeasure, setHoveredMeasure] = useState<number | null>(null);

  const parsedScore = useStore((s) => s.parsedScore);
  const passage = useStore((s) => s.passage);
  const setPassage = useStore((s) => s.setPassage);

  const computeMeasureRects = useCallback(() => {
    const osmd = osmdRef.current as any;
    if (!osmd?.GraphicSheet?.MeasureList || !containerRef.current || !paperRef.current) return;

    const measureList: any[][] = osmd.GraphicSheet.MeasureList;
    const zoom: number = osmd.Zoom ?? osmd.zoom ?? 1;
    const pxPerUnit = 10 * zoom;
    const containerOffsetLeft = containerRef.current.offsetLeft;
    const containerOffsetTop = containerRef.current.offsetTop;

    type RawData = { x: number; w: number; topY: number; bottomY: number };
    const rawData: (RawData | null)[] = measureList.map((staves) => {
      if (!staves?.length) return null;
      const first = staves[0];
      const last = staves[staves.length - 1];
      if (!first?.PositionAndShape) return null;
      const x: number = first.PositionAndShape.AbsolutePosition.x;
      const w: number = first.PositionAndShape.Size.width;
      const topY: number = first.PositionAndShape.AbsolutePosition.y;
      const bottomY: number = last?.PositionAndShape
        ? last.PositionAndShape.AbsolutePosition.y + last.PositionAndShape.Size.height
        : topY + first.PositionAndShape.Size.height;
      return { x, w, topY, bottomY };
    });

    // Unify bottomY per system so all measures on the same row have the same height
    const systemMaxBottom = new Map<number, number>();
    for (const d of rawData) {
      if (!d) continue;
      const key = Math.round(d.topY * 100);
      const prev = systemMaxBottom.get(key) ?? -Infinity;
      if (d.bottomY > prev) systemMaxBottom.set(key, d.bottomY);
    }

    const rects: MeasureRect[] = rawData
      .map((d) => {
        if (!d) return null;
        const key = Math.round(d.topY * 100);
        const unifiedBottom = systemMaxBottom.get(key) ?? d.bottomY;
        return {
          left: containerOffsetLeft + d.x * pxPerUnit,
          top: containerOffsetTop + d.topY * pxPerUnit,
          width: d.w * pxPerUnit,
          height: (unifiedBottom - d.topY) * pxPerUnit,
        };
      })
      .filter((r): r is MeasureRect => r !== null);

    setMeasureRects(rects);
  }, []);

  useEffect(() => {
    if (!parsedScore || !containerRef.current) return;
    const xml = window.__lastLoadedXml;
    if (!xml) return;

    let cancelled = false;
    setMeasureRects([]);
    setAnchorMeasure(null);
    setHoveredMeasure(null);

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

        await osmdRef.current!.load(xml!);
        if (cancelled) return;
        osmdRef.current!.render();
        osmdRef.current!.cursor.reset();
        osmdRef.current!.cursor.show();
        computeMeasureRects();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to render score";
        setError(message);
      }
    }

    renderScore();
    return () => { cancelled = true; };
  }, [parsedScore, computeMeasureRects]);

  // Recompute rects when OSMD auto-resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (osmdRef.current) computeMeasureRects();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [computeMeasureRects]);

  // Escape cancels anchor
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAnchorMeasure(null);
        setHoveredMeasure(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const getMeasureIndexAt = useCallback((clientX: number, clientY: number) => {
    if (!paperRef.current) return -1;
    const paperRect = paperRef.current.getBoundingClientRect();
    const clickLeft = clientX - paperRect.left + paperRef.current.scrollLeft;
    const clickTop = clientY - paperRect.top + paperRef.current.scrollTop;
    return measureRects.findIndex(
      (r) =>
        clickLeft >= r.left && clickLeft <= r.left + r.width &&
        clickTop >= r.top && clickTop <= r.top + r.height
    );
  }, [measureRects]);

  const handleScoreClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!parsedScore || measureRects.length === 0) return;
    const idx = getMeasureIndexAt(e.clientX, e.clientY);
    if (idx === -1) return;

    const measureNum = idx + 1;

    if (anchorMeasure === null) {
      setAnchorMeasure(measureNum);
    } else {
      const startM = Math.min(anchorMeasure, measureNum);
      const endM = Math.max(anchorMeasure, measureNum);
      const endMeasureData = parsedScore.parts[0].measures[endM - 1];
      setPassage({
        startMeasure: startM,
        startBeat: 1,
        endMeasure: endM,
        endBeat: endMeasureData?.beats ?? 4,
      });
      setAnchorMeasure(null);
      setHoveredMeasure(null);
    }
  }, [parsedScore, measureRects, anchorMeasure, getMeasureIndexAt, setPassage]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (anchorMeasure === null) return;
    const idx = getMeasureIndexAt(e.clientX, e.clientY);
    setHoveredMeasure(idx === -1 ? null : idx + 1);
  }, [anchorMeasure, getMeasureIndexAt]);

  const handleMouseLeave = useCallback(() => setHoveredMeasure(null), []);

  const regionHeader = (showMeta: boolean) => (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      marginBottom: 12,
    }}>
      <span style={{
        fontFamily: "var(--font-display)", fontStyle: "italic",
        fontSize: 18, fontWeight: 500, color: "var(--ink-1)",
      }}>Score</span>

      {showMeta && passage && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span>
            <span style={metaLabelStyle}>Passage</span>
            <span style={metaValueStyle}>
              m.{passage.startMeasure}.{passage.startBeat} → {passage.endMeasure}.{passage.endBeat}
            </span>
          </span>
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

  // Compute highlight state for each measure
  const lo = anchorMeasure !== null && hoveredMeasure !== null
    ? Math.min(anchorMeasure, hoveredMeasure)
    : anchorMeasure;
  const hi = anchorMeasure !== null && hoveredMeasure !== null
    ? Math.max(anchorMeasure, hoveredMeasure)
    : anchorMeasure;

  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      padding: "20px 24px 12px", boxSizing: "border-box",
    }}>
      <div style={{ flexShrink: 0 }}>{regionHeader(true)}</div>

      <div
        ref={paperRef}
        onClick={handleScoreClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          flex: 1, minHeight: 0, position: "relative",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--shadow-1)",
          padding: "22px 28px 18px",
          overflowY: "auto",
          cursor: measureRects.length > 0 ? "crosshair" : "default",
        }}
      >
        {/* Anchor hint banner */}
        {anchorMeasure !== null && (
          <div style={{
            position: "sticky", top: 0, zIndex: 10,
            marginBottom: 8, padding: "5px 10px",
            background: "oklch(0.50 0.16 32 / 0.10)",
            border: "1px solid oklch(0.50 0.16 32 / 0.30)",
            borderRadius: 6,
            fontSize: 11.5, color: "var(--ink-2)",
          }}>
            Click another measure to set the end — <span style={{ opacity: 0.7 }}>Esc to cancel</span>
          </div>
        )}

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

        {/* Measure highlight overlays */}
        {measureRects.map((rect, i) => {
          const m = i + 1;
          let kind: "anchor" | "range" | "passage" | null = null;

          if (anchorMeasure !== null) {
            if (m === anchorMeasure) kind = "anchor";
            else if (lo !== null && hi !== null && m >= lo && m <= hi) kind = "range";
          } else if (passage && m >= passage.startMeasure && m <= passage.endMeasure) {
            kind = "passage";
          }

          if (!kind) return null;

          const styles: React.CSSProperties = {
            position: "absolute",
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            borderRadius: 4,
            pointerEvents: "none",
            boxSizing: "border-box",
            ...(kind === "anchor" && {
              background: "oklch(0.50 0.16 32 / 0.13)",
              border: "2px solid oklch(0.50 0.16 32 / 0.55)",
            }),
            ...(kind === "range" && {
              background: "oklch(0.42 0.13 245 / 0.08)",
              border: "1.5px dashed oklch(0.42 0.13 245 / 0.40)",
            }),
            ...(kind === "passage" && {
              background: "oklch(0.42 0.13 245 / 0.10)",
              border: "1.5px solid oklch(0.42 0.13 245 / 0.45)",
            }),
          };

          return <div key={i} style={styles} />;
        })}
      </div>
    </div>
  );
}
