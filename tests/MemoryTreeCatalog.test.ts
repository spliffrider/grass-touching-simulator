import { describe, expect, it } from "vitest";

import {
  MEMORY_TREE_NODE_SIZE,
  MEMORY_TREE_WORLD_HEIGHT,
  MEMORY_TREE_WORLD_WIDTH,
  MEMORY_UPGRADE_IDS,
  MEMORY_UPGRADE_VIEW,
} from "../src/game/redesign/MemoryTreeCatalog";
import {
  PERMANENT_UPGRADE_DEFINITIONS,
  type PermanentUpgradeId,
} from "../src/game/redesign/RunSpineSystem";

type Point = readonly [number, number];
type Segment = readonly [Point, Point];

function getNodePoint(upgradeId: PermanentUpgradeId): Point {
  const view = MEMORY_UPGRADE_VIEW[upgradeId];
  return [view.x * MEMORY_TREE_WORLD_WIDTH, view.y * MEMORY_TREE_WORLD_HEIGHT];
}

function getConnectorSegments(sourceId: PermanentUpgradeId, targetId: PermanentUpgradeId): Segment[] {
  const [startX, startY] = getNodePoint(sourceId);
  const [endX, endY] = getNodePoint(targetId);
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const trim = MEMORY_TREE_NODE_SIZE * 0.42;
  const fromX = startX + (dx / distance) * trim;
  const fromY = startY + (dy / distance) * trim;
  const toX = endX - (dx / distance) * trim;
  const toY = endY - (dy / distance) * trim;
  const midX = fromX + dx * 0.52;
  return [
    [[fromX, fromY], [midX, fromY]],
    [[midX, fromY], [midX, toY]],
    [[midX, toY], [toX, toY]],
  ];
}

function rangesOverlapInside(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.max(Math.min(a1, a2), Math.min(b1, b2)) < Math.min(Math.max(a1, a2), Math.max(b1, b2)) - 0.001;
}

function segmentsCrossInside(first: Segment, second: Segment): boolean {
  const [[firstStartX, firstStartY], [firstEndX, firstEndY]] = first;
  const [[secondStartX, secondStartY], [secondEndX, secondEndY]] = second;
  const firstHorizontal = Math.abs(firstStartY - firstEndY) < 0.001;
  const secondHorizontal = Math.abs(secondStartY - secondEndY) < 0.001;

  if (firstHorizontal && secondHorizontal) {
    return Math.abs(firstStartY - secondStartY) < 0.001 && rangesOverlapInside(firstStartX, firstEndX, secondStartX, secondEndX);
  }
  if (!firstHorizontal && !secondHorizontal) {
    return Math.abs(firstStartX - secondStartX) < 0.001 && rangesOverlapInside(firstStartY, firstEndY, secondStartY, secondEndY);
  }

  const horizontal = firstHorizontal ? first : second;
  const vertical = firstHorizontal ? second : first;
  const [[horizontalStartX, horizontalY], [horizontalEndX]] = horizontal;
  const [[verticalX, verticalStartY], [, verticalEndY]] = vertical;
  return (
    verticalX > Math.min(horizontalStartX, horizontalEndX) + 0.001 &&
    verticalX < Math.max(horizontalStartX, horizontalEndX) - 0.001 &&
    horizontalY > Math.min(verticalStartY, verticalEndY) + 0.001 &&
    horizontalY < Math.max(verticalStartY, verticalEndY) - 0.001
  );
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

        const crosses = getConnectorSegments(first.sourceId, first.targetId).some((firstSegment) =>
          getConnectorSegments(second.sourceId, second.targetId).some((secondSegment) =>
            segmentsCrossInside(firstSegment, secondSegment),
          ),
        );
        if (crosses) {
          crossings.push(`${first.sourceId}->${first.targetId} x ${second.sourceId}->${second.targetId}`);
        }
      }
    }

    expect(crossings).toEqual([]);
  });
});
