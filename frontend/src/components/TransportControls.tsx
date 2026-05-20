import { useState } from "react";
import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";

export default function TransportControls() {
  const { isPlaying, playVoice, playAccompaniment, octaveDown, parsedScore,
    setPlayVoice, setPlayAccompaniment, setOctaveDown } = useStore();
  const { play, stop } = useAudioEngine();
  const [repeat, setRepeat] = useState(false);

  function handlePlay() {
    play(repeat ? () => play() : undefined);
  }

  if (!parsedScore) return null;

  return (
    <div className="p-3 border-b border-[#2a2a4e]">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Playback</div>
      <div className="flex gap-1 mb-2">
        <button
          onClick={isPlaying ? stop : handlePlay}
          className={`flex-1 text-xs py-1 rounded ${
            isPlaying ? "bg-[#3a2a4e] text-purple-300" : "bg-[#1e3a5f] text-blue-300"
          }`}
        >
          {isPlaying ? "⏹ Stop" : "▶ Play"}
        </button>
        <button
          onClick={() => setRepeat(!repeat)}
          className={`px-2 text-xs rounded ${repeat ? "bg-[#2a3a2e] text-green-300" : "bg-[#1a1a2e] text-gray-500"}`}
        >
          ⟳
        </button>
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={playVoice} onChange={(e) => setPlayVoice(e.target.checked)} className="accent-blue-400" />
          Voice
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={playAccompaniment} onChange={(e) => setPlayAccompaniment(e.target.checked)} className="accent-blue-400" />
          Accompaniment
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
          <input type="checkbox" checked={octaveDown} onChange={(e) => setOctaveDown(e.target.checked)} className="accent-blue-400" />
          Octave ↓ (graph only)
        </label>
      </div>
    </div>
  );
}
