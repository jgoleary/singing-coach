import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useMicRecorder } from "../hooks/useMicRecorder";
import { usePitchAnalysis } from "../hooks/usePitchAnalysis";
import { beatsToSeconds } from "../utils/noteUtils";

function IconHeadphones() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

export default function RecordButton() {
  const { parsedScore, passage, isRecording } = useStore();
  const { play, stop: stopPlayback } = useAudioEngine();
  const { start: startRecording, stop: stopRecording } = useMicRecorder();
  const { analyze } = usePitchAnalysis();

  function getPassageDurationMs(): number {
    const score = parsedScore;
    if (!score) return 0;
    if (!passage) {
      const last = score.parts[0]?.measures.at(-1);
      if (!last) return 0;
      const end = beatsToSeconds(last.number, last.beats + 1, score.tempo, last);
      return end * 1000;
    }
    const allMeasures = score.parts[0]?.measures ?? [];
    const startSec = beatsToSeconds(passage.startMeasure, passage.startBeat, score.tempo, allMeasures[0]);
    const endSec = beatsToSeconds(passage.endMeasure, passage.endBeat + 1, score.tempo, allMeasures.at(-1)!);
    return (endSec - startSec) * 1000;
  }

  async function handleRecord() {
    if (isRecording) {
      stopRecording();
      stopPlayback();
      return;
    }
    const durationMs = getPassageDurationMs();
    play();
    try {
      await startRecording(durationMs, async (blob) => {
        await analyze(blob);
      });
    } catch {
      stopPlayback();
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  }

  if (!parsedScore) return null;

  return (
    <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--sidebar-line-soft)" }}>
      {/* Section title */}
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.12em", color: "var(--sidebar-ink-3)", marginBottom: 12,
      }}>Record</div>

      {/* Record button */}
      <button
        type="button"
        onClick={handleRecord}
        style={{
          width: "100%", padding: 16, borderRadius: 11, cursor: "pointer",
          background: "var(--danger-soft)", border: "1px solid var(--danger)",
          color: "var(--danger)", fontSize: 12.5, fontWeight: 500,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}
      >
        {/* Dot indicator */}
        <div style={{
          width: 14, height: 14, borderRadius: "50%",
          background: "var(--danger)",
          boxShadow: "0 0 0 4px var(--danger-soft)",
        }}
          className={isRecording ? "animate-pulse-dot" : ""}
        />
        {isRecording ? "Recording… tap to stop" : "Record passage"}
      </button>

      {/* Headphones note */}
      <div style={{
        display: "flex", alignItems: "center", gap: 5,
        marginTop: 10, fontSize: 10.5, color: "var(--sidebar-ink-3)",
      }}>
        <span style={{ color: "var(--sidebar-ink-4)", display: "flex" }}>
          <IconHeadphones />
        </span>
        Headphones required — prevents mic bleed
      </div>
    </div>
  );
}
