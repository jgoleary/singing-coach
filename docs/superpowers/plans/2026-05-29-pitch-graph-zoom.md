# Pitch Graph Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-zoom and drag-to-pan to `PitchGraph.tsx` so users can inspect long recordings in detail.

**Architecture:** Pure Recharts mouse-event approach — `onMouseDown/onMouseMove/onMouseUp/onMouseLeave/onDoubleClick` on `ComposedChart` drive a `zoomedDomain` state that replaces the XAxis domain. Drag in unzoomed state = zoom selection; drag in zoomed state = pan. A `useRef` for drag-start data avoids stale-closure bugs in the handlers. Pure pan/pixel utility functions extracted to `zoomUtils.ts` for testability.

**Tech Stack:** React 18, TypeScript, Recharts `ComposedChart` (already used), Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/utils/zoomUtils.ts` | Pure functions: `pixelsToTime`, `panDomain` |
| Create | `frontend/src/utils/zoomUtils.test.ts` | Unit tests for above |
| Modify | `frontend/src/components/PitchGraph.tsx` | All zoom/pan state + handlers + rendering |

---

## Task 1: Zoom utility functions

**Files:**
- Create: `frontend/src/utils/zoomUtils.ts`
- Create: `frontend/src/utils/zoomUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/zoomUtils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pixelsToTime, panDomain } from "./zoomUtils";

describe("pixelsToTime", () => {
  it("converts pixel delta to time using domain/width ratio", () => {
    // 100px on a 400px-wide chart spanning 40s = 10s
    expect(pixelsToTime(100, 40, 400)).toBeCloseTo(10, 5);
  });
  it("returns 0 when innerWidth is 0", () => {
    expect(pixelsToTime(100, 40, 0)).toBe(0);
  });
  it("handles negative delta", () => {
    expect(pixelsToTime(-50, 20, 200)).toBeCloseTo(-5, 5);
  });
});

describe("panDomain", () => {
  it("shifts domain by deltaTime", () => {
    expect(panDomain([10, 30], 5, [0, 60])).toEqual([15, 35]);
  });
  it("clamps at left bound", () => {
    // shifting left by 15 would put start at -5, clamp to 0
    expect(panDomain([10, 30], -15, [0, 60])).toEqual([0, 20]);
  });
  it("clamps at right bound", () => {
    // shifting right by 15 would put end at 45+15=45, no that's fine. Try bigger:
    // domain [40,60], shift +10 → [50,70] but bound is 60 → clamp to [40,60]
    expect(panDomain([40, 60], 10, [0, 60])).toEqual([40, 60]);
  });
  it("preserves domain width when clamping", () => {
    const result = panDomain([5, 25], -10, [0, 60]);
    expect(result[1] - result[0]).toBeCloseTo(20, 5);
    expect(result[0]).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/utils/zoomUtils.test.ts
```

Expected: error about missing module `./zoomUtils`

- [ ] **Step 3: Implement the utility functions**

Create `frontend/src/utils/zoomUtils.ts`:

```typescript
export function pixelsToTime(
  deltaPixels: number,
  domainWidth: number,
  innerWidth: number
): number {
  if (innerWidth === 0) return 0;
  return (deltaPixels / innerWidth) * domainWidth;
}

export function panDomain(
  current: [number, number],
  deltaTime: number,
  bounds: [number, number]
): [number, number] {
  const width = current[1] - current[0];
  let newMin = current[0] + deltaTime;
  let newMax = current[1] + deltaTime;
  if (newMin < bounds[0]) { newMin = bounds[0]; newMax = bounds[0] + width; }
  if (newMax > bounds[1]) { newMax = bounds[1]; newMin = bounds[1] - width; }
  return [newMin, newMax];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/utils/zoomUtils.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/zoomUtils.ts frontend/src/utils/zoomUtils.test.ts
git commit -m "feat: add zoom utility functions (pixelsToTime, panDomain)"
```

---

## Task 2: State scaffolding, X-axis domain wiring, Y-axis auto-fit

**Files:**
- Modify: `frontend/src/components/PitchGraph.tsx`

At the end of this task the chart renders identically to today (no interaction added yet), but the domain/frequency logic is refactored to support zoom.

- [ ] **Step 1: Add imports and state**

At the top of `PitchGraph.tsx`, add the import:

```typescript
import { useRef, useState } from "react";
import { pixelsToTime, panDomain } from "../utils/zoomUtils";
```

Inside `PitchGraph()`, directly after the existing store selectors, add:

```typescript
// Zoom/pan state
type DragStart = { time: number; chartX: number; domain: [number, number] | null } | null;
const dragStartRef = useRef<DragStart>(null);
const [dragCurrent, setDragCurrent] = useState<number | null>(null);
const [zoomedDomain, setZoomedDomain] = useState<[number, number] | null>(null);
const [isPanning, setIsPanning] = useState(false);
const containerRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Reorder and update X/Y domain computations**

In `PitchGraph.tsx` the current order after the `duration`/`buildChartData` lines is:
1. Y-domain (confidentFreqs, allFreqs) at ~line 125
2. early-return guard at ~line 134
3. minFreq/maxFreq at ~line 141
4. X-domain (targetStart, xMin, xMax) at ~line 145

After this step the order will be: xMin/xMax → domainMin/domainMax → visibleFrames/allFreqs → guard → minFreq/maxFreq.

**a) Find and remove** the old Y-domain block (~lines 125–132):

```typescript
  // Y domain: use only high-confidence frames so wrong-octave noise doesn't inflate the axis
  const confidentFreqs = pitchData
    .filter((f) => f.confidence >= 0.65)
    .map((f) => f.frequency);
  const allFreqs = [
    ...confidentFreqs,
    ...displayTargetNotes.map((n) => n.frequency),
  ].filter(Boolean);
```

**b) Find** the X-domain block (~lines 145–149):

```typescript
  // X domain: clip to where target notes actually exist, plus a small margin
  const targetStart = Math.min(...displayTargetNotes.map((n) => n.startTime));
  const targetEnd = Math.max(...displayTargetNotes.map((n) => n.endTime));
  const xMin = Math.max(0, targetStart - 0.5);
  const xMax = Math.min(duration, targetEnd + 0.5);
  const visibleTicks = NOTE_TICKS.filter((t) => t.freq >= minFreq && t.freq <= maxFreq);
```

**Replace** the X-domain block (lines 145–149, stopping before `visibleTicks`) with:

```typescript
  // X domain: clip to where target notes actually exist, plus a small margin
  const targetStart = Math.min(...displayTargetNotes.map((n) => n.startTime));
  const targetEnd = Math.max(...displayTargetNotes.map((n) => n.endTime));
  const xMin = Math.max(0, targetStart - 0.5);
  const xMax = Math.min(duration, targetEnd + 0.5);
  const [domainMin, domainMax] = zoomedDomain ?? [xMin, xMax];

  // Y domain: only frames/notes visible within the current X window
  const visibleFrames = pitchData.filter(
    (f) => f.time >= domainMin && f.time <= domainMax
  );
  const visibleTargets = displayTargetNotes.filter(
    (n) => n.endTime >= domainMin && n.startTime <= domainMax
  );
  const confidentFreqs = visibleFrames
    .filter((f) => f.confidence >= 0.65)
    .map((f) => f.frequency);
  const allFreqs = [
    ...confidentFreqs,
    ...visibleTargets.map((n) => n.frequency),
  ].filter(Boolean);
```

Leave the guard (`if (duration <= 0 ...)`), `minFreq`/`maxFreq`, and `visibleTicks` lines exactly where they are — they don't need to move.

- [ ] **Step 4: Pass `domainMin`/`domainMax` to `XAxis`**

Find the `<XAxis` element in the JSX. Change its `domain` prop from:

```tsx
domain={[xMin, xMax]}
```

to:

```tsx
domain={[domainMin, domainMax]}
```

- [ ] **Step 5: Add `containerRef` to outer div**

Find the outer return div:

```tsx
<div style={{ height: "100%", padding: "12px 4px 8px 0" }}>
```

Change to:

```tsx
<div ref={containerRef} style={{ height: "100%", padding: "12px 4px 8px 0", position: "relative" }}>
```

- [ ] **Step 6: Run all frontend tests to confirm nothing broke**

```bash
cd frontend && npx vitest run
```

Expected: all tests PASS (chart behavior unchanged)

- [ ] **Step 7: Verify in browser**

Start the frontend (`npm run dev` from `frontend/`). Load a score, record, confirm the pitch graph still renders correctly. No new interaction should exist yet.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/PitchGraph.tsx
git commit -m "feat: wire zoom domain state and Y-axis auto-fit into PitchGraph"
```

---

## Task 3: Zoom drag interaction

**Files:**
- Modify: `frontend/src/components/PitchGraph.tsx`

At the end of this task, drag on the chart zooms in; the chart shows a selection rectangle while dragging.

- [ ] **Step 1: Add helper to read chart inner width**

Inside `PitchGraph()`, after the ref/state declarations, add:

```typescript
function getChartInnerWidth(): number {
  if (!containerRef.current) return 700;
  return containerRef.current.getBoundingClientRect().width - 48 - 16; // left + right margins
}
```

- [ ] **Step 2: Add mouse handler type alias**

At the top of the function body (or just above the handlers), add:

```typescript
type ChartState = { activeLabel?: string | number; chartX?: number };

function timeFromLabel(label: string | number | undefined): number | null {
  if (label == null) return null;
  const t = typeof label === "number" ? label : parseFloat(label);
  return Number.isFinite(t) ? t : null;
}
```

- [ ] **Step 3: Add mouse down handler**

```typescript
function handleMouseDown(state: ChartState) {
  const time = timeFromLabel(state.activeLabel);
  if (time == null || state.chartX == null) return;
  dragStartRef.current = { time, chartX: state.chartX, domain: zoomedDomain };
  if (zoomedDomain !== null) setIsPanning(true);
}
```

- [ ] **Step 4: Add mouse move handler**

```typescript
function handleMouseMove(state: ChartState) {
  if (!dragStartRef.current) return;
  const time = timeFromLabel(state.activeLabel);
  if (time == null || state.chartX == null) return;

  if (dragStartRef.current.domain === null) {
    // zoom mode: update selection endpoint
    setDragCurrent(time);
  } else {
    // pan mode: shift domain based on total displacement from drag start
    const deltaPixels = dragStartRef.current.chartX - state.chartX;
    const domainWidth = dragStartRef.current.domain[1] - dragStartRef.current.domain[0];
    const deltaTime = pixelsToTime(deltaPixels, domainWidth, getChartInnerWidth());
    setZoomedDomain(panDomain(dragStartRef.current.domain, deltaTime, [0, duration]));
  }
}
```

- [ ] **Step 5: Add mouse up handler**

```typescript
function handleMouseUp(state: ChartState) {
  const ds = dragStartRef.current;
  if (!ds) return;

  if (ds.domain === null && dragCurrent !== null) {
    const t0 = Math.min(ds.time, dragCurrent);
    const t1 = Math.max(ds.time, dragCurrent);
    if (t1 - t0 >= 0.5) setZoomedDomain([t0, t1]);
  }

  dragStartRef.current = null;
  setDragCurrent(null);
  setIsPanning(false);
}
```

- [ ] **Step 6: Add mouse leave handler**

```typescript
function handleMouseLeave() {
  const ds = dragStartRef.current;
  if (!ds) return;

  // commit zoom if span is large enough; discard pan (domain already updated live)
  if (ds.domain === null && dragCurrent !== null) {
    const t0 = Math.min(ds.time, dragCurrent);
    const t1 = Math.max(ds.time, dragCurrent);
    if (t1 - t0 >= 0.5) setZoomedDomain([t0, t1]);
  }

  dragStartRef.current = null;
  setDragCurrent(null);
  setIsPanning(false);
}
```

- [ ] **Step 7: Wire handlers onto ComposedChart**

Find the `<ComposedChart` opening tag. It currently has `onClick={handleChartClick}` and `style={{ cursor: "crosshair" }}`. Replace the entire prop block with:

```tsx
<ComposedChart
  data={data}
  margin={{ top: 8, right: 16, bottom: 20, left: 48 }}
  onClick={handleChartClick}
  onMouseDown={handleMouseDown as (s: unknown) => void}
  onMouseMove={handleMouseMove as (s: unknown) => void}
  onMouseUp={handleMouseUp as (s: unknown) => void}
  onMouseLeave={handleMouseLeave}
  style={{ cursor: zoomedDomain === null ? "crosshair" : isPanning ? "grabbing" : "grab" }}
>
```

- [ ] **Step 8: Add the drag-selection ReferenceArea**

Inside `<ComposedChart>`, directly before the closing `</ComposedChart>` tag, add:

```tsx
{/* Zoom drag selection rectangle */}
{dragCurrent !== null && dragStartRef.current?.domain === null && (
  <ReferenceArea
    x1={Math.min(dragStartRef.current!.time, dragCurrent)}
    x2={Math.max(dragStartRef.current!.time, dragCurrent)}
    fill="rgba(99, 102, 241, 0.08)"
    stroke="rgba(99, 102, 241, 0.5)"
    strokeWidth={1.5}
    ifOverflow="visible"
  />
)}
```

- [ ] **Step 9: Verify in browser**

Load a score, record, then drag across 5+ seconds of the pitch graph. Confirm:
- Purple selection rectangle appears while dragging
- Releasing zooms in; the chart shows only the selected time window
- Y-axis re-labels to the frequencies in view
- Short single-click still plays the note preview

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/PitchGraph.tsx
git commit -m "feat: add drag-to-zoom interaction on pitch graph"
```

---

## Task 4: Pan, double-click reset, cursor, and hint text

**Files:**
- Modify: `frontend/src/components/PitchGraph.tsx`

Pan is already wired in the handlers from Task 3. This task adds double-click reset and the hint overlay.

- [ ] **Step 1: Add double-click reset handler**

Inside `PitchGraph()`, add:

```typescript
function handleDoubleClick() {
  setZoomedDomain(null);
  dragStartRef.current = null;
  setDragCurrent(null);
  setIsPanning(false);
}
```

- [ ] **Step 2: Wire `onDoubleClick` onto ComposedChart**

In the `<ComposedChart` tag, add the prop:

```tsx
onDoubleClick={handleDoubleClick}
```

- [ ] **Step 3: Add the hint overlay**

Inside the outer `<div ref={containerRef} ...>`, directly before `<ResponsiveContainer`, add:

```tsx
{zoomedDomain !== null && (
  <div style={{
    position: "absolute",
    top: 14,
    right: 20,
    fontSize: 9,
    color: "var(--ink-4)",
    fontFamily: "var(--font-mono)",
    pointerEvents: "none",
    zIndex: 10,
    userSelect: "none",
  }}>
    drag to pan · double-click to reset
  </div>
)}
```

- [ ] **Step 4: Verify in browser — full flow**

Load a score with a long passage (90 s works well), record, then confirm:

1. Drag across a ~10 s range → zooms in; Y-axis adjusts; cursor is `grab`
2. Drag while zoomed → pans the window; cursor is `grabbing` while dragging
3. Hint "drag to pan · double-click to reset" appears when zoomed
4. Double-click → returns to full view; hint disappears
5. Short single-click still plays the note preview (in both zoomed and unzoomed state)
6. Dragging right then left while panning doesn't drift (using total displacement, not incremental)

- [ ] **Step 5: Run all frontend tests**

```bash
cd frontend && npx vitest run
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/PitchGraph.tsx
git commit -m "feat: add pan, double-click reset, and zoom hint to pitch graph"
```
