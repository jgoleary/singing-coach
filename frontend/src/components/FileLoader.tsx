import { useRef } from "react";
import { useStore } from "../store/useStore";
import { loadFile, parseScore } from "../utils/musicxml";

export default function FileLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { parsedScore, voicePartId, accompanimentPartId, setParsedScore, setVoicePartId, setAccompanimentPartId } =
    useStore();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const xml = await loadFile(file);
    (window as any).__lastLoadedXml = xml;  // OSMD reads this in ScoreViewer
    const score = parseScore(xml);
    setParsedScore(score);
    setVoicePartId(null);
    setAccompanimentPartId(null);
  }

  const parts = parsedScore?.parts ?? [];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <button
        className="px-3 py-1 bg-[#1e3a5f] text-blue-300 rounded text-sm hover:bg-[#2a4a6f]"
        onClick={() => inputRef.current?.click()}
      >
        Load File
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,.musicxml,.mxl"
        className="hidden"
        onChange={handleFile}
      />

      {parts.length > 0 && (
        <>
          <label className="text-xs text-gray-400">
            Voice:
            <select
              className="ml-1 bg-[#1a1a2e] text-gray-200 rounded px-1 py-0.5 text-xs border border-[#2a2a4e]"
              value={voicePartId ?? ""}
              onChange={(e) => setVoicePartId(e.target.value || null)}
            >
              <option value="">— none —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-400">
            Accompaniment:
            <select
              className="ml-1 bg-[#1a1a2e] text-gray-200 rounded px-1 py-0.5 text-xs border border-[#2a2a4e]"
              value={accompanimentPartId ?? ""}
              onChange={(e) => setAccompanimentPartId(e.target.value || null)}
            >
              <option value="">— none —</option>
              {parts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
