import { useEffect } from "react";
import { useStore } from "./store/useStore";
import Toolbar from "./components/Toolbar";
import FileLoader, { loadScoreFromStorage } from "./components/FileLoader";
import ScoreViewer from "./components/ScoreViewer";
import PitchGraph from "./components/PitchGraph";
import PassageSelector from "./components/PassageSelector";
import TransportControls from "./components/TransportControls";
import RecordButton from "./components/RecordButton";
import FeedbackPanel from "./components/FeedbackPanel";
import { parseScore } from "./utils/musicxml";

export default function App() {
  const { pitchData, targetNotes, lastRecordingBlob, analysisStatus, analysisError } = useStore();

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

  const hasRecording = !!lastRecordingBlob;
  const hasFinishedAnalysis = analysisStatus === "done" && !!pitchData && !!targetNotes;
  const isAnalyzing = analysisStatus === "analyzing";
  const hasError = analysisStatus === "error";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      {/* Top toolbar */}
      <Toolbar />

      {/* Hidden FileLoader — keeps all file/part logic, no visual */}
      <div style={{ display: "none" }}><FileLoader /></div>

      {/* Main split */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left canvas column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto", minWidth: 0 }}>

          {/* Score region */}
          <ScoreViewer />

          {/* Pitch region — clearly separated from score */}
          <div style={{
            padding: "20px 24px 24px",
            borderTop: "1px solid var(--line)",
            background: "var(--bg)",
          }}>
            {/* Region header */}
            <div style={{ marginBottom: 12 }}>
              <span style={{
                fontFamily: "var(--font-display)", fontStyle: "italic",
                fontSize: 18, fontWeight: 500, color: "var(--ink-1)",
              }}>Pitch analysis</span>
            </div>

            {!hasRecording && !isAnalyzing && !hasError && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px",
                border: "1px dashed var(--line)", borderRadius: "var(--radius)",
                background: "var(--surface-2)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.6">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <div>
                    <div style={{ color: "var(--ink-1)", fontWeight: 500, fontSize: 13.5, marginBottom: 2 }}>Ready to record</div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Pitch analysis will appear here once you record a take.</div>
                  </div>
                </div>
              </div>
            )}

            {(isAnalyzing || hasError || hasFinishedAnalysis) && (
              <div style={{
                background: "var(--paper)", border: "1px solid var(--line)",
                borderRadius: "var(--radius)", boxShadow: "var(--shadow-1)",
                overflow: "hidden",
              }}>
                {/* Graph header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 18px 0",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{
                      fontFamily: "var(--font-display)", fontStyle: "italic",
                      fontSize: 16, fontWeight: 500, color: "var(--ink-1)",
                    }}>Pitch analysis</span>
                  </div>
                  {hasFinishedAnalysis && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--ink-3)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--target)", display: "inline-block" }} />
                        Target
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />
                        Your voice
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--ink-4)", opacity: 0.5, display: "inline-block" }} />
                        Low confidence
                      </span>
                    </div>
                  )}
                </div>

                {/* Graph body */}
                <div style={{ height: 280 }}>
                  <PitchGraph />
                </div>

                {/* Stats row */}
                {hasFinishedAnalysis && <StatsRow />}
              </div>
            )}
          </div>
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
          <TransportControls />
          <RecordButton />
          <FeedbackPanel />
        </div>
      </div>
    </div>
  );
}

function StatsRow() {
  const { pitchData, targetNotes } = useStore();
  if (!pitchData || !targetNotes) return null;

  const errors: number[] = [];
  let onPitchCount = 0;
  for (const frame of pitchData) {
    if (frame.confidence < 0.5) continue;
    const target = targetNotes.find((n) => frame.time >= n.startTime && frame.time < n.endTime);
    if (!target) continue;
    const cents = Math.abs(1200 * Math.log2(frame.frequency / target.frequency));
    errors.push(cents);
    if (cents <= 50) onPitchCount++;
  }
  if (errors.length === 0) return null;
  const sorted = [...errors].sort((a, b) => a - b);
  const medianCents = Math.round(sorted[Math.floor(sorted.length / 2)]);
  const pctOnPitch = Math.round((onPitchCount / errors.length) * 100);

  const cellStyle: React.CSSProperties = {
    padding: "10px 14px 4px",
    borderRight: "1px solid var(--line-soft)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 500, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: 4,
  };
  const valueStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)", fontStyle: "italic",
    fontSize: 22, fontWeight: 400, color: "var(--ink-1)", lineHeight: 1,
  };
  const unitStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 500, color: "var(--ink-3)",
    fontFamily: "var(--font-sans)", fontStyle: "normal", marginLeft: 1,
  };
  const trendStyle: React.CSSProperties = {
    fontSize: 10.5, color: "var(--ink-4)",
    fontFamily: "var(--font-mono)", marginTop: 4,
  };

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
      borderTop: "1px solid var(--line-soft)",
    }}>
      <div style={cellStyle}>
        <div style={labelStyle}>Median pitch error</div>
        <div style={valueStyle}>±{medianCents}<span style={unitStyle}>¢</span></div>
        <div style={trendStyle}>cents deviation</div>
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>On pitch</div>
        <div style={{ ...valueStyle, color: pctOnPitch >= 70 ? "var(--success)" : "var(--ink-1)" }}>
          {pctOnPitch}<span style={unitStyle}>%</span>
        </div>
        <div style={trendStyle}>within ±50 ¢</div>
      </div>
      <div style={{ ...cellStyle, borderRight: "none" }}>
        <div style={labelStyle}>Voiced frames</div>
        <div style={valueStyle}>{errors.length}<span style={unitStyle}></span></div>
        <div style={trendStyle}>above 50% confidence</div>
      </div>
    </div>
  );
}
