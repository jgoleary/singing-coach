# Pitch Graph Zoom — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

## Summary

Add drag-to-zoom and pan to the pitch analysis graph so users can examine long recordings in detail. Time axis only; Y-axis auto-fits to visible frequencies.

## Interaction Model

### Zoom (unzoomed state)
- **Mouse down** on chart: record `dragStart = { time, chartX }`
- **Mouse move**: update `dragCurrent`; render a translucent `ReferenceArea` from `dragStart.time` to `dragCurrent` with timestamp labels at each edge
- **Mouse up**: if span > 0.5 s → set `zoomedDomain = [dragStart.time, dragCurrent]`; if span ≤ 0.5 s → treat as click (existing note-preview behavior)
- Cursor: `crosshair` (unchanged from current)

### Pan (zoomed state)
- **Mouse down**: record `panStart = { chartX, domain: zoomedDomain }`
- **Mouse move**: compute `deltaTime = deltaX * (domainWidth / chartInnerWidth)`; shift `zoomedDomain` by `-deltaTime`, clamped to `[0, totalDuration]`
- **Mouse up**: clear pan state
- Cursor: `grab` at rest, `grabbing` while dragging

### Reset
- **Double-click** anywhere on chart: set `zoomedDomain = null`
- Hint text in top-right corner of chart when zoomed: "drag to pan · double-click to reset"

## State

All state is local to `PitchGraph.tsx` (`useState`). No Zustand changes needed.

```typescript
type DragState = { time: number; chartX: number } | null;

const [dragStart, setDragStart] = useState<DragState>(null);
const [dragCurrent, setDragCurrent] = useState<number | null>(null);
const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
```

`dragCurrent` is only used during zoom drags (not pan); it drives the `ReferenceArea` rendering.

## X-Axis Domain

```typescript
const [domainMin, domainMax] = zoomedDomain ?? [xMin, xMax];
```

Passed to `<XAxis domain={[domainMin, domainMax]} />`. Recharts clips all rendered lines to this domain automatically.

## Y-Axis Auto-Fit

When zoomed, derive `minFreq`/`maxFreq` from only frames and target notes whose time range overlaps `[domainMin, domainMax]`:

```typescript
const visibleFrames = pitchData.filter(f => f.time >= domainMin && f.time <= domainMax);
const visibleTargets = displayTargetNotes.filter(n => n.endTime >= domainMin && n.startTime <= domainMax);
```

Same `* 0.85` / `* 1.15` padding and 80–2000 Hz clamp as today.

## Chart Inner Width (for pan)

A `containerRef` on the outer `<div>` provides the element width. Subtract the left margin (48 px) and right margin (16 px) — the constants already in the component — to get `chartInnerWidth`.

## Files Changed

- `frontend/src/components/PitchGraph.tsx` — only file modified

## Out of Scope

- Scroll-wheel zoom
- Y-axis zoom
- Mobile / touch events
- Persisting zoom state across re-renders or recordings
