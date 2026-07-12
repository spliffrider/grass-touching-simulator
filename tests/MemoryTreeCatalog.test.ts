import { describe, expect, it } from "vitest";

import {
  MEMORY_TREE_NODE_SIZE,
  MEMORY_TREE_WORLD_HEIGHT,
  MEMORY_TREE_WORLD_WIDTH,
  MEMORY_UPGRADE_IDS,
  MEMORY_UPGRADE_VIEW,
  getMemoryTreeConnectorPath,
  getMemoryTreeNodePoint,
} from "../src/game/redesign/MemoryTreeCatalog";
import {
  PERMANENT_UPGRADE_DEFINITIONS,
} from "../src/game/redesign/RunSpineSystem";

type Point = { x: number; y: number };
type Segment = readonly [Point, Point];

function orientation(first: Point, second: Point, third: Point): number {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function pointTouchesSegment(point: Point, [start, end]: Segment): boolean {
  return (
    Math.abs(orientation(start, end, point)) < 0.001 &&
    point.x >= Math.min(start.x, end.x) - 0.001 &&
    point.x <= Math.max(start.x, end.x) + 0.001 &&
    point.y >= Math.min(start.y, end.y) - 0.001 &&
    point.y <= Math.max(start.y, end.y) + 0.001
  );
}

function segmentsCrossInside([firstStart, firstEnd]: Segment, [secondStart, secondEnd]: Segment): boolean {
  const firstSideA = orientation(firstStart, firstEnd, secondStart);
  const firstSideB = orientation(firstStart, firstEnd, secondEnd);
  const secondSideA = orientation(secondStart, secondEnd, firstStart);
  const secondSideB = orientation(secondStart, secondEnd, firstEnd);
  if (firstSideA * firstSideB < -0.001 && secondSideA * secondSideB < -0.001) {
    return true;
  }
  return (
    pointTouchesSegment(secondStart, [firstStart, firstEnd]) ||
    pointTouchesSegment(secondEnd, [firstStart, firstEnd]) ||
    pointTouchesSegment(firstStart, [secondStart, secondEnd]) ||
    pointTouchesSegment(firstEnd, [secondStart, secondEnd])
  );
}

function distanceToSegment(point: Point, [start, end]: Segment): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * projection), point.y - (start.y + dy * projection));
}

describe("MemoryTreeCatalog", () => {
  it("provides presentation data for every permanent memory", () => {
    expect([...MEMORY_UPGRADE_IDS].sort()).toEqual(Object.keys(PERMANENT_UPGRADE_DEFINITIONS).sort());
    for (const upgradeId of MEMORY_UPGRADE_IDS) {
      const view = MEMORY_UPGRADE_VIEW[upgradeId];
      expect(view.x).toBeGreaterThan(0);
      expect(view.x).toBeLessThan(1);
      expect(view.y).toBeGreaterThan(0);
      expect(view.y).toBeLessThan(1);
      expect(view.iconPath).toMatch(/^\/assets\/ui\/(skills|items)\/.+\.png$/);
    }
  });

  it("keeps unrelated connector paths from crossing", () => {
    const edges = MEMORY_UPGRADE_IDS.flatMap((targetId) =>
      PERMANENT_UPGRADE_DEFINITIONS[targetId].prerequisiteIds.map((sourceId) => ({ sourceId, targetId })),
    );
    const crossings: string[] = [];

    for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
      const first = edges[firstIndex];
      for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
        const second = edges[secondIndex];
        const sharesNode =
          first.sourceId === second.sourceId ||
          first.sourceId === second.targetId ||
          first.targetId === second.sourceId ||
          first.targetId === second.targetId;
        if (sharesNode) {
          continue;
        }

        const crosses = segmentsCrossInside(
          getMemoryTreeConnectorPath(first.sourceId, first.targetId),
          getMemoryTreeConnectorPath(second.sourceId, second.targetId),
        );
        if (crosses) {
          crossings.push(`${first.sourceId}->${first.targetId} x ${second.sourceId}->${second.targetId}`);
        }
      }
    }

    expect(crossings).toEqual([]);
  });

  it("keeps connectors out of unrelated skill nodes", () => {
    const collisions: string[] = [];
    for (const targetId of MEMORY_UPGRADE_IDS) {
      for (const sourceId of PERMANENT_UPGRADE_DEFINITIONS[targetId].prerequisiteIds) {
        const connector = getMemoryTreeConnectorPath(sourceId, targetId);
        for (const nodeId of MEMORY_UPGRADE_IDS) {
          if (nodeId === sourceId || nodeId === targetId) {
            continue;
          }
          if (distanceToSegment(getMemoryTreeNodePoint(nodeId), connector) < MEMORY_TREE_NODE_SIZE * 0.62) {
            collisions.push(`${sourceId}->${targetId} through ${nodeId}`);
          }
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it("keeps interactive memory cards from overlapping", () => {
    const overlaps: string[] = [];
    for (let firstIndex = 0; firstIndex < MEMORY_UPGRADE_IDS.length; firstIndex += 1) {
      const firstId = MEMORY_UPGRADE_IDS[firstIndex];
      const first = getMemoryTreeNodePoint(firstId);
      for (let secondIndex = firstIndex + 1; secondIndex < MEMORY_UPGRADE_IDS.length; secondIndex += 1) {
        const secondId = MEMORY_UPGRADE_IDS[secondIndex];
        const second = getMemoryTreeNodePoint(secondId);
        if (Math.abs(first.x - second.x) < 150 && Math.abs(first.y - second.y) < 150) {
          overlaps.push(`${firstId} x ${secondId}`);
        }
      }
    }

    expect(overlaps).toEqual([]);
  });

  it("starts from a central memory and leaves room for a larger web", () => {
    expect(MEMORY_UPGRADE_VIEW.softTouch).toMatchObject({ x: 0.5, y: 0.45 });
    expect(MEMORY_TREE_WORLD_WIDTH).toBeGreaterThanOrEqual(1000);
    expect(MEMORY_TREE_WORLD_HEIGHT).toBeGreaterThanOrEqual(650);
  });

  it("paces equipment licenses from early helpers to late helpers", () => {
    expect(PERMANENT_UPGRADE_DEFINITIONS.fieldMouse).toMatchObject({ cost: 28, prerequisiteIds: ["tinySprinkler"] });
    expect(PERMANENT_UPGRADE_DEFINITIONS.beeHive.prerequisiteIds).toEqual(["fieldMouse"]);
    expect(PERMANENT_UPGRADE_DEFINITIONS.earthworm.prerequisiteIds).toEqual(["beeHive"]);
    expect(PERMANENT_UPGRADE_DEFINITIONS.chicken.prerequisiteIds).toEqual(["earthworm"]);
    expect(PERMANENT_UPGRADE_DEFINITIONS.sheep.prerequisiteIds).toEqual(["chicken"]);
    expect(PERMANENT_UPGRADE_DEFINITIONS.meadowRabbit).toMatchObject({ cost: 165, prerequisiteIds: ["sheep"] });
  });
});
