import { useState, useEffect } from "react";
import { useStore } from "./store/useStore";
import FileLoader, { loadScoreFromStorage } from "./components/FileLoader";
import ScoreViewer from "./components/ScoreViewer";
import PitchGraph from "./components/PitchGraph";
import PassageSelector from "./components/PassageSelector";
import TransportControls from "./components/TransportControls";
import RecordButton from "./components/RecordButton";
import FeedbackPanel from "./components/FeedbackPanel";
import { parseScore } from "./utils/musicxml";

type LeftTab = "score" | "pitch";

export default function App() {
  const [activeTab, setActiveTab] = useState<LeftTab>("score");
  const pitchData = useStore((s) => s.pitchData);
  const analysisStatus = useStore((s) => s.analysisStatus);

  // Restore last score on mount
  useEffect(() => {
    const saved = loadScoreFromStorage();
    if (!saved) return;
    try {
      const score = parseScore(saved.xml);
      window.__lastLoadedXml = saved.xml;
      useStore.getState().setParsedScore(score);
      useStore.getState().setVoicePartId(saved.voicePartId);
      useStore.getState().setAccompanimentPartId(saved.accompanimentPartId);
    } catch { /* malformed stored XML — ignore */ }
  }, []);

  useEffect(() => {
    if (!pitchData && analysisStatus !== "analyzing" && analysisStatus !== "error") return;
    queueMicrotask(() => setActiveTab("pitch"));
  }, [analysisStatus, pitchData]);

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a] text-gray-200 overflow-hidden">
      <div className="border-b border-[#2a2a4e] px-4 py-2 flex-shrink-0">
        <FileLoader />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-[#2a2a4e] overflow-hidden">
          <div className="flex border-b border-[#2a2a4e] flex-shrink-0">
            <button
              className={`px-5 py-2 text-sm ${
                activeTab === "score"
                  ? "text-blue-300 border-b-2 border-blue-400 bg-[#1a1a2e]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab("score")}
            >
              Score
            </button>
            <button
              className={`px-5 py-2 text-sm ${
                activeTab === "pitch"
                  ? "text-blue-300 border-b-2 border-blue-400 bg-[#1a1a2e]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              onClick={() => setActiveTab("pitch")}
            >
              Pitch Graph
            </button>
          </div>
          <div className="flex-1 overflow-auto">
            {activeTab === "score" ? <ScoreViewer /> : <PitchGraph />}
          </div>
        </div>
        <div className="w-56 flex flex-col overflow-y-auto bg-[#12121f]">
          <PassageSelector />
          <TransportControls />
          <RecordButton />
          <FeedbackPanel />
        </div>
      </div>
    </div>
  );
}
