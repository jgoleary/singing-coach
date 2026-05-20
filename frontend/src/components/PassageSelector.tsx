import { useState } from "react";
import { useStore } from "../store/useStore";

export default function PassageSelector() {
  const { parsedScore, setPassage } = useStore();
  const [startMeasure, setStartMeasure] = useState(1);
  const [startBeat, setStartBeat] = useState(1);
  const [endMeasure, setEndMeasure] = useState(1);
  const [endBeat, setEndBeat] = useState(4);

  const lastMeasure = parsedScore?.parts[0]?.measures.at(-1)?.number ?? 1;
  const lastBeats = parsedScore?.parts[0]?.measures.at(-1)?.beats ?? 4;

  function handleWholePiece() {
    setStartMeasure(1);
    setStartBeat(1);
    setEndMeasure(lastMeasure);
    setEndBeat(lastBeats);
    setPassage({ startMeasure: 1, startBeat: 1, endMeasure: lastMeasure, endBeat: lastBeats });
  }

  function handleApply() {
    setPassage({ startMeasure, startBeat, endMeasure, endBeat });
  }

  if (!parsedScore) return null;

  return (
    <div className="p-3 border-b border-[#2a2a4e]">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Passage</div>
      <div className="grid grid-cols-2 gap-1 text-xs mb-2">
        <label className="text-gray-400">
          Start M
          <input
            type="number" min={1} max={lastMeasure} value={startMeasure}
            onChange={(e) => setStartMeasure(parseInt(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
        <label className="text-gray-400">
          Beat
          <input
            type="number" min={1} step={0.25} value={startBeat}
            onChange={(e) => setStartBeat(parseFloat(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
        <label className="text-gray-400">
          End M
          <input
            type="number" min={1} max={lastMeasure} value={endMeasure}
            onChange={(e) => setEndMeasure(parseInt(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
        <label className="text-gray-400">
          Beat
          <input
            type="number" min={1} step={0.25} value={endBeat}
            onChange={(e) => setEndBeat(parseFloat(e.target.value))}
            className="w-full mt-0.5 bg-[#1a1a2e] border border-[#2a2a4e] rounded px-1 py-0.5 text-gray-200"
          />
        </label>
      </div>
      <div className="flex gap-1">
        <button onClick={handleWholePiece} className="flex-1 text-[10px] bg-[#1a1a2e] text-gray-400 rounded py-0.5 hover:text-gray-200">
          Whole piece
        </button>
        <button onClick={handleApply} className="flex-1 text-[10px] bg-[#1e3a5f] text-blue-300 rounded py-0.5 hover:bg-[#2a4a6f]">
          Apply
        </button>
      </div>
    </div>
  );
}
