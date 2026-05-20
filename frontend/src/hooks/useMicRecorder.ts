import { useRef, useCallback } from "react";
import { useStore } from "../store/useStore";

export function useMicRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async (durationMs: number, onStop: (blob: Blob) => void) => {
    const { setIsRecording, setLastRecordingBlob } = useStore.getState();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      setLastRecordingBlob(blob);
      onStop(blob);
      stream.getTracks().forEach((t) => t.stop());
      useStore.getState().setIsRecording(false);
    };

    recorder.start(100);
    setIsRecording(true);

    // Auto-stop after passage duration
    setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, durationMs);
  }, []);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    useStore.getState().setIsRecording(false);
  }, []);

  return { start, stop };
}
