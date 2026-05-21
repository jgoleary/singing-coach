import { useEffect, useState } from "react";
import { useStore } from "./store/useStore";
import Toolbar from "./components/Toolbar";
import FileLoader, { loadScoreFromStorage } from "./components/FileLoader";
import ScoreViewer from "./components/ScoreViewer";
import PitchGraph from "./components/PitchGraph";
import PassageSelector from "./components/PassageSelector";
import FlaggedPassages from "./components/FlaggedPassages";
import TransportControls from "./components/TransportControls";
import RecordButton from "./components/RecordButton";
import FeedbackPanel from "./components/FeedbackPanel";
import StatsFooter from "./components/StatsFooter";
import { parseScore } from "./utils/musicxml";

type Tab = "score" | "pitch";

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "4px 12px", borderRadius: 3, border: "none",
        fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
        background: active ? "var(--surface-3)" : "transparent",
        color: active ? "var(--ink-1)" : "var(--ink-3)",
        cursor: "pointer",
        boxShadow: active
          ? "0 1px 2px oklch(0.4 0.02 60 / 0.08) inset"
          : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function LegendSwatch({ color, opacity = 1, label }: { color: string; opacity?: number; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color, opacity, display: "inline-block" }} />
      {label}
    </span>
  );
}

function PitchRegion({ hasFinishedAnalysis }: { hasFinishedAnalysis: boolean }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      padding: "20px 24px 16px", boxSizing: "border-box",
    }}>
      {/* Region header + legend */}
      <div style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontSize: 18, fontWeight: 500, color: "var(--ink-1)",
        }}>Pitch analysis</span>
        {hasFinishedAnalysis && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--ink-3)" }}>
            <LegendSwatch color="var(--target)" label="Target" />
            <LegendSwatch color="var(--accent)" label="Your voice" />
            <LegendSwatch color="var(--ink-4)" opacity={0.5} label="Low confidence" />
          </div>
        )}
      </div>

      {/* Graph card — fills remaining height */}
      <div style={{
        flex: 1, minHeight: 0,
        background: "var(--paper)", border: "1px solid var(--line)",
        borderRadius: "var(--radius)", boxShadow: "var(--shadow-1)",
        overflow: "hidden",
      }}>
        <PitchGraph />
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("score");

  const { lastRecordingBlob, pitchData, targetNotes, analysisStatus } = useStore();
  const takeNumber = useStore((s) => s.takeNumber);

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
    } catch { /* malformed stored XML */ }
  }, []);

  // Auto-switch to pitch when analysis completes
  useEffect(() => {
    if (analysisStatus === "done") setActiveTab("pitch");
  }, [analysisStatus]);

  const hasRecording = !!lastRecordingBlob;
  const hasFinishedAnalysis = analysisStatus === "done" && !!pitchData && !!targetNotes;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      <Toolbar />
      <div style={{ display: "none" }}><FileLoader /></div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left canvas column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Tab strip */}
          <div style={{
            height: 36, flexShrink: 0,
            display: "flex", alignItems: "center",
            padding: "0 20px",
            borderBottom: "1px solid var(--line)",
            background: "var(--bg)",
          }}>
            <div style={{
              display: "flex",
              background: "var(--surface-2)", border: "1px solid var(--line)",
              borderRadius: 4, padding: 2, gap: 2,
            }}>
              <TabBtn active={activeTab === "score"} onClick={() => setActiveTab("score")}>
                Score
              </TabBtn>
              {hasRecording && (
                <TabBtn active={activeTab === "pitch"} onClick={() => setActiveTab("pitch")}>
                  Pitch analysis{takeNumber > 0 ? ` · #${takeNumber}` : ""}
                  <span
                    role="button"
                    aria-label="Close pitch analysis"
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().clearRecording();
                      setActiveTab("score");
                    }}
                    style={{
                      marginLeft: 6, fontSize: 11, lineHeight: 1,
                      color: "var(--ink-4)", cursor: "pointer",
                      display: "inline-flex", alignItems: "center",
                      verticalAlign: "middle",
                    }}
                  >×</span>
                </TabBtn>
              )}
            </div>
          </div>

          {/* Active tab content — both stay mounted to preserve scroll/OSMD state */}
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, display: activeTab === "score" ? "flex" : "none", flexDirection: "column" }}>
              <ScoreViewer />
            </div>
            {hasRecording && (
              <div style={{ position: "absolute", inset: 0, display: activeTab === "pitch" ? "flex" : "none", flexDirection: "column" }}>
                <PitchRegion hasFinishedAnalysis={hasFinishedAnalysis} />
              </div>
            )}
          </div>

          {/* Persistent stats footer */}
          <StatsFooter
            isPitchActive={activeTab === "pitch"}
            onSwitchToPitch={() => setActiveTab("pitch")}
          />
        </div>

        {/* Right sidebar */}
        <div style={{
          width: 248, flexShrink: 0,
          background: "var(--sidebar-bg)",
          borderLeft: "1px solid var(--line)",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}>
          <PassageSelector />
          <FlaggedPassages />
          <TransportControls />
          <RecordButton />
          <FeedbackPanel />
        </div>
      </div>
    </div>
  );
}
