// Multi-score library persisted in localStorage.
// Each score is keyed by its filename.

const LIBRARY_KEY = "singing-coach:library";
const ACTIVE_KEY  = "singing-coach:active";

export function getLibrary(): string[] {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "[]"); }
  catch { return []; }
}

export function saveToLibrary(
  filename: string,
  xml: string,
  voicePartId: string | null,
  accompanimentPartId: string | null,
) {
  try {
    localStorage.setItem(`singing-coach:xml:${filename}`, xml);
    localStorage.setItem(`singing-coach:meta:${filename}`, JSON.stringify({ voicePartId, accompanimentPartId }));
    const lib = getLibrary().filter((f) => f !== filename);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify([filename, ...lib]));
    localStorage.setItem(ACTIVE_KEY, filename);
  } catch { /* storage quota exceeded */ }
}

export function updateMeta(
  filename: string,
  voicePartId: string | null,
  accompanimentPartId: string | null,
) {
  try {
    localStorage.setItem(`singing-coach:meta:${filename}`, JSON.stringify({ voicePartId, accompanimentPartId }));
  } catch { /* storage quota exceeded */ }
}

export function loadFromLibrary(filename: string): {
  xml: string;
  voicePartId: string | null;
  accompanimentPartId: string | null;
} | null {
  try {
    const xml = localStorage.getItem(`singing-coach:xml:${filename}`);
    if (!xml) return null;
    const meta = JSON.parse(localStorage.getItem(`singing-coach:meta:${filename}`) ?? "{}");
    return { xml, voicePartId: meta.voicePartId ?? null, accompanimentPartId: meta.accompanimentPartId ?? null };
  } catch { return null; }
}

export function getActiveFilename(): string | null {
  const active = localStorage.getItem(ACTIVE_KEY);
  if (active) return active;
  // Fallback: read from old single-score storage format
  try {
    const old = JSON.parse(localStorage.getItem("singing-coach:score") ?? "null");
    return old?.fileName ?? null;
  } catch { return null; }
}

export function setActiveFilename(filename: string) {
  localStorage.setItem(ACTIVE_KEY, filename);
}

export function scoreTitle(filename: string): string {
  return filename
    .replace(/\.(mxl|xml|musicxml)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
