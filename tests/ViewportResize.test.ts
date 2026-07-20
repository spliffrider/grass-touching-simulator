import { describe, expect, it } from "vitest";

import {
  applyViewportResize,
  isUsableViewportSize,
} from "../src/viewport";

describe("viewport resize", () => {
  it("sets the final canvas CSS size before Phaser refreshes pointer bounds", () => {
    const gameElement = { style: { width: "320px", height: "200px" } };
    const canvas = { style: { width: "320px", height: "200px" } };
    let observedDuringScaleRefresh: Record<string, unknown> | null = null;

    applyViewportResize(
      { width: 1920, height: 1080 },
      gameElement,
      canvas,
      (width, height) => {
        observedDuringScaleRefresh = {
          width,
          height,
          canvasWidth: canvas.style.width,
          canvasHeight: canvas.style.height,
        };
      },
    );

    expect(observedDuringScaleRefresh).toEqual({
      width: 1920,
      height: 1080,
      canvasWidth: "1920px",
      canvasHeight: "1080px",
    });
    expect(gameElement.style).toEqual({ width: "1920px", height: "1080px" });
  });

  it("rejects transient minimized dimensions without rejecting a compact phone", () => {
    expect(isUsableViewportSize({ width: 1, height: 1 })).toBe(false);
    expect(isUsableViewportSize({ width: 1920, height: 0 })).toBe(false);
    expect(isUsableViewportSize({ width: 320, height: 120 })).toBe(false);
    expect(isUsableViewportSize({ width: 320, height: 568 })).toBe(true);
  });
});
