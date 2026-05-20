import { useEffect, useRef } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { useStore } from "../store/useStore";

export default function ScoreViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const parsedScore = useStore((s) => s.parsedScore);

  useEffect(() => {
    if (!containerRef.current) return;
    osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
      autoResize: true,
      drawingParameters: "default",
      drawCredits: false,
    });
    (window as any).__osmd = osmdRef.current;
  }, []);

  useEffect(() => {
    if (!osmdRef.current || !parsedScore) return;
    const xml = (window as any).__lastLoadedXml;
    if (!xml) return;
    osmdRef.current.load(xml).then(() => {
      osmdRef.current!.render();
      osmdRef.current!.cursor.show();
    });
  }, [parsedScore]);

  if (!parsedScore) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Load a file to get started
      </div>
    );
  }

  return <div ref={containerRef} className="p-4 bg-white rounded m-2" />;
}
