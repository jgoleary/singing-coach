import { useRef, useEffect, useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import { useAudioEngine } from "../hooks/useAudioEngine";
import { computeStats } from "../utils/stats";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function WaveformMini({ progress }: { progress: number }) {
  const bars = useMemo(() =>
    Array.from({ length: 38 }, (_, i) => {
      const env = Math.sin((i / 38) * Math.PI);
      const noise = (Math.sin(i * 1.7) + Math.cos(i * 0.9) + Math.sin(i * 0.31)) / 3;
      return Math.max(0.12, env * (0.6 + 0.4 * noise));
    }), []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 22, marginTop: 8 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${Math.round(h * 18 + 3)}px`,
          borderRadius: 1,
          background: i / bars.length < progress ? "var(--accent)" : "var(--sidebar-ink-4)",
        }} />
      ))}
    </div>
  );
}

export default function FeedbackPanel() {
  const lastRecordingBlob = useStore((s) => s.lastRecordingBlob);
  const pitchData = useStore((s) => s.pitchData);
  const targetNotes = useStore((s) => s.targetNotes);
  const octaveDown = useStore((s) => s.octaveDown);
  const analysisStatus = useStore((s) => s.analysisStatus);
  const analysisError = useStore((s) => s.analysisError);
  const pitchToleranceCents = useStore((s) => s.pitchToleranceCents);
  const setPitchToleranceCents = useStore((s) => s.setPitchToleranceCents);

  const { playAccompanimentOnly, stop: stopAccompaniment } = useAudioEngine();
  const playAccompaniment = useStore((s) => s.playAccompaniment);

  const audioRef = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string | null>(null);
  const takeRef = useRef(0);
  const prevBlobRef = useRef<Blob | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    if (!lastRecordingBlob) return;
    if (lastRecordingBlob !== prevBlobRef.current) {
      takeRef.current += 1;
      prevBlobRef.current = lastRecordingBlob;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(lastRecordingBlob);
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = urlRef.current;
    setCurrentTime(0);
    setDuration(0);
    setIsPlayingAudio(false);
  }, [lastRecordingBlob]);

  if (!lastRecordingBlob) return null;

  const displayTargetNotes = octaveDown && targetNotes
    ? targetNotes.map((note) => ({ ...note, frequency: note.frequency / 2 }))
    : targetNotes;
  const stats = pitchData && displayTargetNotes ? computeStats(pitchData, displayTargetNotes, pitchToleranceCents) : null;
  const progress = duration > 0 ? currentTime / duration : 0;

  function handlePlayToggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlayingAudio) {
      audio.pause();
      stopAccompaniment();
    } else {
      audio.currentTime = 0;
      audio.play();
      if (playAccompaniment) playAccompanimentOnly();
    }
  }

  return (
    <div style={{ padding: "16px 16px 14px" }}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setIsPlayingAudio(true)}
        onPause={() => setIsPlayingAudio(false)}
        onEnded={() => { setIsPlayingAudio(false); setCurrentTime(0); stopAccompaniment(); }}
      />

      {/* Section title + take pill */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 500, textTransform: "uppercase",
          letterSpacing: "0.12em", color: "var(--sidebar-ink-3)",
        }}>Last take</div>
        <span style={{
          fontSize: 10.5, padding: "1px 6px", borderRadius: 10,
          background: "var(--accent-soft)", color: "var(--accent)",
          fontFamily: "var(--font-mono)", fontWeight: 500,
        }}>#{takeRef.current}</span>
      </div>

      {/* Take card */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px",
        background: "var(--sidebar-surface)", border: "1px solid var(--sidebar-line)",
        borderRadius: 8,
      }}>
        <button
          type="button" onClick={handlePlayToggle}
          style={{
            width: 26, height: 26, flexShrink: 0, borderRadius: "50%",
            background: "var(--accent)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", color: "white",
          }}
        >
          {isPlayingAudio ? (
            <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
              <rect x="0" y="0" width="3" height="9" rx="0.5" />
              <rect x="5" y="0" width="3" height="9" rx="0.5" />
            </svg>
          ) : (
            <svg width="8" height="9" viewBox="0 0 8 9" fill="currentColor">
              <path d="M1 0.5 L7.5 4.5 L1 8.5 Z" />
            </svg>
          )}
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--sidebar-ink-1)", lineHeight: 1.3 }}>
            Play my recording
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--sidebar-ink-3)", lineHeight: 1.3 }}>
            {formatTime(currentTime)} / {duration > 0 && isFinite(duration) ? formatTime(duration) : "--:--"}
          </div>
        </div>
      </div>

      {/* Mini waveform */}
      <WaveformMini progress={progress} />

      {/* Analysis status */}
      {analysisStatus === "analyzing" && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--sidebar-ink-3)" }}>
          Analyzing pitch…
        </div>
      )}
      {analysisStatus === "error" && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--danger)" }}>
          {analysisError ?? "Analysis failed. Is the backend running?"}
        </div>
      )}

      {/* Tolerance selector */}
      {stats && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 10, padding: "6px 0", borderTop: "1px solid var(--sidebar-line-soft)",
        }}>
          <span style={{ fontSize: 11.5, color: "var(--sidebar-ink-3)" }}>Tolerance</span>
          <div style={{ display: "flex", gap: 3 }}>
            {[25, 50, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPitchToleranceCents(v)}
                style={{
                  padding: "2px 7px", borderRadius: 5, fontSize: 10.5,
                  fontFamily: "var(--font-mono)", cursor: "pointer",
                  border: `1px solid ${pitchToleranceCents === v ? "var(--accent)" : "var(--sidebar-line)"}`,
                  background: pitchToleranceCents === v ? "var(--accent-soft)" : "transparent",
                  color: pitchToleranceCents === v ? "var(--accent)" : "var(--sidebar-ink-3)",
                }}
              >
                ±{v}¢
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Compact stat rows */}
      {stats && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 0", borderTop: "1px solid var(--sidebar-line-soft)",
          }}>
            <span style={{ fontSize: 11.5, color: "var(--sidebar-ink-3)" }}>Median pitch error</span>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--sidebar-ink-1)" }}>
              ±{stats.medianCents}¢
            </span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "7px 0", borderTop: "1px solid var(--sidebar-line-soft)",
          }}>
            <span style={{ fontSize: 11.5, color: "var(--sidebar-ink-3)" }}>On pitch</span>
            <span style={{
              fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 500,
              color: stats.pctOnPitch >= 70 ? "var(--success)" : "var(--sidebar-ink-1)",
            }}>
              {stats.pctOnPitch}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
