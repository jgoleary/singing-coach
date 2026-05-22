import { useRef } from "react";
import { useStore } from "../store/useStore";
import { loadFile, parseScore } from "../utils/musicxml";
import { saveToLibrary } from "../utils/scoreLibrary";
import type { Part } from "../types";

declare global {
  interface Window { __lastLoadedXml?: string; }
}

/** Renders only the hidden file input. Toolbar triggers it via #file-input-trigger. */
export default function FileLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setParsedScore, setVoicePartId, setAccompanimentPartId } = useStore();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const xml = await loadFile(file);
    window.__lastLoadedXml = xml;
    const score = parseScore(xml);
    const defaultVoice = findDefaultVoicePart(score.parts);
    const defaultAccomp = findDefaultAccompanimentPart(score.parts, defaultVoice?.id);
    const voiceId = defaultVoice?.id ?? null;
    const accompId = defaultAccomp?.id ?? null;
    setParsedScore(score);
    setVoicePartId(voiceId);
    setAccompanimentPartId(accompId);
    saveToLibrary(file.name, xml, voiceId, accompId);
    useStore.getState().loadScoreSettings(file.name);
    e.target.value = "";
  }

  return (
    <input
      id="file-input-trigger"
      ref={inputRef}
      type="file"
      accept=".xml,.musicxml,.mxl"
      style={{ display: "none" }}
      onChange={handleFile}
    />
  );
}

function findDefaultVoicePart(parts: Part[]) {
  return parts.find((p) => /voice|vocal|soprano|alto|tenor|bass/i.test(p.name)) ?? parts[0];
}

function findDefaultAccompanimentPart(parts: Part[], voicePartId?: string) {
  return (
    parts.find((p) => p.id !== voicePartId && /piano|accomp|keyboard|organ|guitar/i.test(p.name)) ??
    parts.find((p) => p.id !== voicePartId)
  );
}
