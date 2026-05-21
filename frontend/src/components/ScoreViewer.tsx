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

export default function ScoreViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OsmdWithCursor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsedScore = useStore((s) => s.parsedScore);

  useEffect(() => {
    if (!parsedScore || !containerRef.current) return;
    const xml = window.__lastLoadedXml;
    if (!xml) return;
    const xmlSource = xml;

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

        await osmdRef.current!.load(xmlSource);
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

    return () => {
      cancelled = true;
    };
  }, [parsedScore]);

  if (!parsedScore) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Load a file to get started
      </div>
    );
  }

  return (
    <div className="m-2 min-h-full rounded bg-white p-4 text-black">
      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          Could not render score: {error}
        </div>
      )}
      <div ref={containerRef} className="min-h-[720px] w-full" />
    </div>
  );
}
