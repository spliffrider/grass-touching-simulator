import { describe, expect, it } from "vitest";

import {
  clampMemoryTreePan,
  clampMemoryTreeZoom,
  MEMORY_TREE_MAX_ZOOM,
  MEMORY_TREE_MIN_ZOOM,
  zoomMemoryTreeAtPoint,
} from "../src/game/redesign/MemoryTreeViewport";

describe("MemoryTreeViewport", () => {
  it("clamps zoom to the supported overview and detail range", () => {
    expect(clampMemoryTreeZoom(0.1)).toBe(MEMORY_TREE_MIN_ZOOM);
    expect(clampMemoryTreeZoom(1.4)).toBe(1.4);
    expect(clampMemoryTreeZoom(9)).toBe(MEMORY_TREE_MAX_ZOOM);
  });

  it("allows bounded panning only when the tree is zoomed in", () => {
    expect(clampMemoryTreePan({ x: 90, y: -70 }, { width: 600, height: 400 }, 0.8)).toEqual({ x: 0, y: 0 });
    expect(clampMemoryTreePan({ x: 999, y: -999 }, { width: 600, height: 400 }, 1.5)).toEqual({ x: 150, y: -100 });
  });

  it("keeps the requested screen point stable while zooming", () => {
    const result = zoomMemoryTreeAtPoint(
      1,
      1.4,
      { x: 0, y: 0 },
      { x: 400, y: 250 },
      { centerX: 300, centerY: 200, width: 600, height: 400 },
    );

    expect(result.zoom).toBe(1.4);
    expect(result.pan.x).toBeCloseTo(-40);
    expect(result.pan.y).toBeCloseTo(-20);
  });

  it("accounts for a letterboxed fitted tree when clamping pan", () => {
    expect(
      clampMemoryTreePan(
        { x: 999, y: 999 },
        { width: 600, height: 400 },
        1.5,
        { width: 600, height: 300 },
      ),
    ).toEqual({ x: 150, y: 25 });
  });
});
