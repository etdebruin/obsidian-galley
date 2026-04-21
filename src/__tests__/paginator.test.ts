import { describe, it, expect } from "vitest";
import {
  detectSwipe,
  SwipeResult,
  getTapZone,
  TapZone,
  clampPage,
  computePageCount,
} from "../paginator";

describe("detectSwipe", () => {
  it("detects swipe left (next page)", () => {
    const result = detectSwipe({ startX: 200, endX: 50, startY: 100, endY: 105 });
    expect(result).toBe(SwipeResult.Left);
  });

  it("detects swipe right (previous page)", () => {
    const result = detectSwipe({ startX: 50, endX: 200, startY: 100, endY: 105 });
    expect(result).toBe(SwipeResult.Right);
  });

  it("ignores short swipes below threshold", () => {
    const result = detectSwipe({ startX: 100, endX: 120, startY: 100, endY: 100 });
    expect(result).toBe(SwipeResult.None);
  });

  it("ignores vertical swipes", () => {
    const result = detectSwipe({ startX: 100, endX: 110, startY: 100, endY: 300 });
    expect(result).toBe(SwipeResult.None);
  });

  it("uses custom threshold", () => {
    const result = detectSwipe(
      { startX: 140, endX: 100, startY: 100, endY: 100 },
      30
    );
    expect(result).toBe(SwipeResult.Left);
  });

  it("rejects diagonal swipes where vertical > horizontal", () => {
    const result = detectSwipe({ startX: 100, endX: 200, startY: 100, endY: 250 });
    expect(result).toBe(SwipeResult.None);
  });
});

describe("getTapZone", () => {
  it("returns Left for tap in left third", () => {
    expect(getTapZone(50, 390)).toBe(TapZone.Left);
  });

  it("returns Right for tap in right third", () => {
    expect(getTapZone(300, 390)).toBe(TapZone.Right);
  });

  it("returns Center for tap in middle third", () => {
    expect(getTapZone(195, 390)).toBe(TapZone.Center);
  });

  it("handles edge case at exact boundaries", () => {
    // At exactly 1/3 width
    expect(getTapZone(130, 390)).toBe(TapZone.Center);
    // At exactly 2/3 width
    expect(getTapZone(260, 390)).toBe(TapZone.Right);
  });
});

describe("clampPage", () => {
  it("returns page within bounds", () => {
    expect(clampPage(3, 10)).toBe(3);
  });

  it("clamps to 0 when negative", () => {
    expect(clampPage(-1, 10)).toBe(0);
  });

  it("clamps to max when over", () => {
    expect(clampPage(15, 10)).toBe(9);
  });

  it("handles single page", () => {
    expect(clampPage(0, 1)).toBe(0);
  });
});

describe("computePageCount", () => {
  it("computes pages from scroll width and page width", () => {
    expect(computePageCount(3000, 375)).toBe(8);
  });

  it("returns 1 when content fits in one page", () => {
    expect(computePageCount(300, 375)).toBe(1);
  });

  it("returns 1 for zero scroll width", () => {
    expect(computePageCount(0, 375)).toBe(1);
  });

  it("handles exact multiples", () => {
    expect(computePageCount(750, 375)).toBe(2);
  });
});
