import JSZip from "jszip";
import type { ParsedScore, Part, Measure, Note } from "../types";

export async function loadFile(file: File): Promise<string> {
  if (file.name.endsWith(".mxl")) {
    const zip = await JSZip.loadAsync(file);
    const xmlEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.endsWith(".xml") && !f.name.startsWith("META-INF")
    );
    if (!xmlEntry) throw new Error("No XML found in .mxl archive");
    return xmlEntry.async("string");
  }
  return file.text();
}

export function parseScore(xmlString: string): ParsedScore {
  const doc = new DOMParser().parseFromString(xmlString, "application/xml");

  // Extract tempo (default 120)
  let tempo = 120;
  const soundEl = doc.querySelector("sound[tempo]");
  if (soundEl) tempo = parseFloat(soundEl.getAttribute("tempo")!);

  // Extract parts
  const partListEls = doc.querySelectorAll("part-list > score-part");
  const partNames: Record<string, string> = {};
  partListEls.forEach((el) => {
    const id = el.getAttribute("id")!;
    partNames[id] = el.querySelector("part-name")?.textContent?.trim() ?? id;
  });

  const partEls = doc.querySelectorAll("score-partwise > part");
  const parts: Part[] = Array.from(partEls).map((partEl) => {
    const id = partEl.getAttribute("id")!;
    let divisions = 1;
    let beats = 4;
    let beatType = 4;

    const measures: Measure[] = Array.from(partEl.querySelectorAll("measure")).map(
      (measureEl) => {
        const number = parseInt(measureEl.getAttribute("number") ?? "1");

        const divEl = measureEl.querySelector("attributes > divisions");
        if (divEl) divisions = parseInt(divEl.textContent!);

        const beatsEl = measureEl.querySelector("attributes > time > beats");
        if (beatsEl) beats = parseInt(beatsEl.textContent!);

        const beatTypeEl = measureEl.querySelector("attributes > time > beat-type");
        if (beatTypeEl) beatType = parseInt(beatTypeEl.textContent!);

        let currentDurationInDivisions = 0;
        let lastNonChordDivisions = 0;
        const notes: Note[] = [];

        // Walk direct children so <backup> and <forward> elements reset the
        // time cursor correctly (needed for multi-staff parts like piano).
        for (const child of Array.from(measureEl.children)) {
          if (child.tagName === "backup") {
            const d = parseInt(child.querySelector("duration")?.textContent ?? "0");
            currentDurationInDivisions = Math.max(0, currentDurationInDivisions - d);
          } else if (child.tagName === "forward") {
            const d = parseInt(child.querySelector("duration")?.textContent ?? "0");
            currentDurationInDivisions += d;
          } else if (child.tagName === "note") {
            const noteEl = child;
            const isRest = !!noteEl.querySelector("rest");
            const isChord = !!noteEl.querySelector("chord");
            const duration = parseInt(noteEl.querySelector("duration")?.textContent ?? "1");
            const beatPosition = isChord
              ? 1 + lastNonChordDivisions / divisions
              : 1 + currentDurationInDivisions / divisions;
            if (!isChord) {
              lastNonChordDivisions = currentDurationInDivisions;
              currentDurationInDivisions += duration;
            }

            const pitchEl = noteEl.querySelector("pitch");
            const pitch = pitchEl
              ? {
                  step: pitchEl.querySelector("step")!.textContent!,
                  octave: parseInt(pitchEl.querySelector("octave")!.textContent!),
                  alter: parseFloat(pitchEl.querySelector("alter")?.textContent ?? "0"),
                }
              : null;

            // Lyric: prefer lyric number="1" (primary language) over others
            let lyric: string | undefined;
            const lyricEl = noteEl.querySelector('lyric[number="1"]') ?? noteEl.querySelector("lyric");
            if (lyricEl) {
              const text = lyricEl.querySelector("text")?.textContent?.trim();
              if (text) {
                const syllabic = lyricEl.querySelector("syllabic")?.textContent?.trim();
                lyric = (syllabic === "begin" || syllabic === "middle") ? text + "-" : text;
              }
            }

            // Tie (playback): a note can carry <tie type="start"/>, <tie type="stop"/>, or both.
            // Tied continuations (stop/both) should not be re-attacked.
            const tieEls = noteEl.querySelectorAll(":scope > tie");
            let hasTieStart = false;
            let hasTieStop = false;
            tieEls.forEach((t) => {
              const type = t.getAttribute("type");
              if (type === "start") hasTieStart = true;
              else if (type === "stop") hasTieStop = true;
            });
            const tieType: "start" | "stop" | "both" | undefined =
              hasTieStart && hasTieStop ? "both"
              : hasTieStart ? "start"
              : hasTieStop ? "stop"
              : undefined;

            notes.push({
              measureNumber: number,
              beatPosition,
              duration: duration / divisions,
              pitch,
              isRest,
              lyric,
              tieType,
            });
          }
        }

        return { number, beats, beatType, notes };
      }
    );

    return { id, name: partNames[id] ?? id, measures };
  });

  return { parts, tempo };
}
