import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { useMicRecorder } from "../hooks/useMicRecorder";
import { usePitchAnalysis } from "../hooks/usePitchAnalysis";
import { beatsToSeconds } from "../utils/noteUtils";

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
    const endSec = beatsToSeconds(passage.endMeasure, passage.endBeat, score.tempo, allMeasures.at(-1)!);
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
    <div className="p-3 border-b border-[#2a2a4e]">
      <div className="text-[10px] text-gray-500 uppercase mb-2">Record</div>
      <button
        onClick={handleRecord}
        className={`w-full text-sm py-1.5 rounded ${
          isRecording
            ? "bg-red-900 text-red-300 animate-pulse"
            : "bg-[#7f1d1d] text-red-300 hover:bg-red-900"
        }`}
      >
        {isRecording ? "⏹ Stop Recording" : "🎤 Record"}
      </button>
      <div className="mt-1.5 text-[10px] text-red-400">⚠ Use headphones</div>
    </div>
  );
}
