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
    // domain [40,60], shift +10 → [50,70] but bound is 60 → clamp to [40,60]
    expect(panDomain([40, 60], 10, [0, 60])).toEqual([40, 60]);
  });
  it("preserves domain width when clamping", () => {
    const result = panDomain([5, 25], -10, [0, 60]);
    expect(result[1] - result[0]).toBeCloseTo(20, 5);
    expect(result[0]).toBe(0);
  });
});
