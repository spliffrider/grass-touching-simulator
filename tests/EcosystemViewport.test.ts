import { describe, expect, it } from "vitest";

import {
  hasFieldProjectionGeometryChanged,
  panFieldViewport,
  projectField,
  screenPointToTile,
  zoomFieldAtPoint,
} from "../src/game/ecosystem/EcosystemViewport";

const bounds = { x: 100, y: 80, width: 800, height: 600 };

describe("EcosystemViewport", () => {
  it("summarizes a 100x100 far field as at most 100 chunks", () => {
    const projection = projectField(100, 100, bounds, { centerX: 0.5, centerY: 0.5, zoom: 1 });
    expect(projection.lod).toBe("far");
    expect(projection.visibleChunks.count).toBeLessThanOrEqual(100);
  });

  it("maps the field center to a logical tile with one input surface", () => {
    const projection = projectField(5, 5, bounds, { centerX: 0.5, centerY: 0.5, zoom: 1 });
    expect(screenPointToTile(projection, 500, 380)).toEqual({ x: 2, y: 2, index: 12 });
  });

  it("keeps the pointed world location stable while zooming", () => {
    const state = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    const projection = projectField(50, 50, bounds, state);
    const point = { x: 620, y: 300 };
    const before = screenPointToTile(projection, point.x, point.y);
    const zoomed = zoomFieldAtPoint(state, projection, point.x, point.y, 2);
    const afterProjection = projectField(50, 50, bounds, zoomed);
    const after = screenPointToTile(afterProjection, point.x, point.y);
    expect(after).toEqual(before);
  });

  it("clamps panning to normalized field bounds", () => {
    const state = { centerX: 0.5, centerY: 0.5, zoom: 5 };
    const projection = projectField(20, 20, bounds, state);
    const panned = panFieldViewport(state, projection, 100_000, -100_000);
    expect(panned.centerX).toBe(0);
    expect(panned.centerY).toBe(1);
  });

  it("detects when cached field geometry can be reused", () => {
    const projection = projectField(100, 100, bounds, { centerX: 0.5, centerY: 0.5, zoom: 1 });
    const sameProjection = projectField(100, 100, bounds, { centerX: 0.5, centerY: 0.5, zoom: 1 });
    const zoomedProjection = projectField(100, 100, bounds, { centerX: 0.5, centerY: 0.5, zoom: 2 });

    expect(hasFieldProjectionGeometryChanged(null, projection)).toBe(true);
    expect(hasFieldProjectionGeometryChanged(projection, sameProjection)).toBe(false);
    expect(hasFieldProjectionGeometryChanged(projection, zoomedProjection)).toBe(true);
  });
});
