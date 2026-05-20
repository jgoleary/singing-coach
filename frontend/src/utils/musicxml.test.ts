import { describe, it, expect } from "vitest";
import { parseScore } from "./musicxml";

const SIMPLE_MXL_XML = `<?xml version="1.0"?>
<score-partwise>
  <part-list>
    <score-part id="P1"><part-name>Soprano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction><sound tempo="120"/></direction>
      <note>
        <pitch><step>A</step><octave>4</octave></pitch>
        <duration>4</duration>
        <type>quarter</type>
      </note>
      <note><rest/><duration>12</duration></note>
    </measure>
  </part>
</score-partwise>`;

describe("parseScore", () => {
  it("extracts parts", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0].id).toBe("P1");
    expect(score.parts[0].name).toBe("Soprano");
  });

  it("extracts tempo from sound element", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    expect(score.tempo).toBe(120);
  });

  it("extracts notes with pitch", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    const notes = score.parts[0].measures[0].notes;
    const pitched = notes.filter((n) => !n.isRest);
    expect(pitched).toHaveLength(1);
    expect(pitched[0].pitch?.step).toBe("A");
    expect(pitched[0].pitch?.octave).toBe(4);
  });

  it("extracts rest notes", () => {
    const score = parseScore(SIMPLE_MXL_XML);
    const notes = score.parts[0].measures[0].notes;
    const rests = notes.filter((n) => n.isRest);
    expect(rests).toHaveLength(1);
  });
});
