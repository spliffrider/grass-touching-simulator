import { describe, expect, it } from "vitest";
import {
  ECOSYSTEM_MEMORY_EDGES,
  ECOSYSTEM_MEMORY_NODES,
  ECOSYSTEM_MEMORY_NODE_BY_ID,
  ECOSYSTEM_MEMORY_ROOT_ID,
  ECOSYSTEM_MEMORY_WORLD_HEIGHT,
  ECOSYSTEM_MEMORY_WORLD_WIDTH,
  FIRST_ECOSYSTEM_MEMORY_NODE_ID,
  getEcosystemMemoryEntryNodeId,
  getEcosystemMemoryNodeVisualRadius,
  getHelperModeMemoryId,
  getHelperRankMemoryId,
  getHelperUnlockMemoryId,
  getRevealedEcosystemMemoryNodeIds,
} from "../src/game/ecosystem/EcosystemMemoryTree";
import {
  createPermanentEcosystemState,
  getHelperUnlockCost,
  getTouchRankCost,
  unlockHelper,
} from "../src/game/ecosystem/EcosystemSystem";

interface Point {
  x: number;
  y: number;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function edgesCross(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

function angleBetweenVectors(left: Point, right: Point): number {
  const leftLength = Math.hypot(left.x, left.y);
  const rightLength = Math.hypot(right.x, right.y);
  const cosine = (left.x * right.x + left.y * right.y) / (leftLength * rightLength);
  return Math.acos(Math.max(-1, Math.min(1, cosine)));
}

describe("Ecosystem Memory Tree", () => {
  it("defines a stable, expandable 54-node web", () => {
    expect(ECOSYSTEM_MEMORY_NODES).toHaveLength(54);
    expect(new Set(ECOSYSTEM_MEMORY_NODES.map((node) => node.id)).size).toBe(ECOSYSTEM_MEMORY_NODES.length);
    expect(ECOSYSTEM_MEMORY_NODE_BY_ID.get("touch:fastTouch")).toMatchObject({
      kind: "touchRank",
      prerequisites: ["root:field-heir"],
      touchKind: "fastTouch",
    });
    expect(getTouchRankCost("fastTouch", 0)).toBe(9);
  });

  it("keeps every node and prerequisite inside the declared graph", () => {
    const halfWidth = ECOSYSTEM_MEMORY_WORLD_WIDTH / 2;
    const halfHeight = ECOSYSTEM_MEMORY_WORLD_HEIGHT / 2;
    for (const node of ECOSYSTEM_MEMORY_NODES) {
      expect(Math.abs(node.x)).toBeLessThan(halfWidth);
      expect(Math.abs(node.y)).toBeLessThan(halfHeight);
      for (const prerequisite of node.prerequisites) {
        expect(ECOSYSTEM_MEMORY_NODE_BY_ID.has(prerequisite)).toBe(true);
      }
    }
  });

  it("lays out branch connectors without geometric crossings", () => {
    for (let leftIndex = 0; leftIndex < ECOSYSTEM_MEMORY_EDGES.length; leftIndex += 1) {
      const left = ECOSYSTEM_MEMORY_EDGES[leftIndex];
      const leftFrom = ECOSYSTEM_MEMORY_NODE_BY_ID.get(left.from)!;
      const leftTo = ECOSYSTEM_MEMORY_NODE_BY_ID.get(left.to)!;
      for (let rightIndex = leftIndex + 1; rightIndex < ECOSYSTEM_MEMORY_EDGES.length; rightIndex += 1) {
        const right = ECOSYSTEM_MEMORY_EDGES[rightIndex];
        if (left.from === right.from || left.from === right.to || left.to === right.from || left.to === right.to) continue;
        const rightFrom = ECOSYSTEM_MEMORY_NODE_BY_ID.get(right.from)!;
        const rightTo = ECOSYSTEM_MEMORY_NODE_BY_ID.get(right.to)!;
        expect(
          edgesCross(leftFrom, leftTo, rightFrom, rightTo),
          `${left.from} -> ${left.to} crosses ${right.from} -> ${right.to}`,
        ).toBe(false);
      }
    }
  });

  it("uses distinct organic helper-cluster silhouettes with clear visual spacing", () => {
    const helperUnlocks = ECOSYSTEM_MEMORY_NODES.filter((node) => node.kind === "helperUnlock");
    expect(new Set(helperUnlocks.map((node) => node.y)).size).toBeGreaterThanOrEqual(6);

    const silhouettes = helperUnlocks.map((unlock) => ECOSYSTEM_MEMORY_NODES
      .filter((node) => node.helperId === unlock.helperId && node.id !== unlock.id)
      .map((node) => `${node.kind}:${node.rankKind ?? "mode"}:${node.x - unlock.x},${node.y - unlock.y}`)
      .sort()
      .join("|"));
    expect(new Set(silhouettes).size).toBe(helperUnlocks.length);

    const crowdedPairs: string[] = [];
    for (let leftIndex = 0; leftIndex < ECOSYSTEM_MEMORY_NODES.length; leftIndex += 1) {
      const left = ECOSYSTEM_MEMORY_NODES[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < ECOSYSTEM_MEMORY_NODES.length; rightIndex += 1) {
        const right = ECOSYSTEM_MEMORY_NODES[rightIndex];
        const requiredDistance = getEcosystemMemoryNodeVisualRadius(left) +
          getEcosystemMemoryNodeVisualRadius(right) + 20;
        if (Math.hypot(right.x - left.x, right.y - left.y) < requiredDistance) {
          crowdedPairs.push(`${left.id} / ${right.id}`);
        }
      }
    }
    expect(crowdedPairs).toEqual([]);
  });

  it("keeps every branch clear of unrelated skill points", () => {
    const blockedBranches: string[] = [];
    for (const edge of ECOSYSTEM_MEMORY_EDGES) {
      const from = ECOSYSTEM_MEMORY_NODE_BY_ID.get(edge.from)!;
      const to = ECOSYSTEM_MEMORY_NODE_BY_ID.get(edge.to)!;
      for (const node of ECOSYSTEM_MEMORY_NODES) {
        if (node.id === edge.from || node.id === edge.to) continue;
        const requiredClearance = getEcosystemMemoryNodeVisualRadius(node) + 18;
        if (pointToSegmentDistance(node, from, to) < requiredClearance) {
          blockedBranches.push(`${edge.from} -> ${edge.to} passes ${node.id}`);
        }
      }
    }
    expect(blockedBranches).toEqual([]);
  });

  it("fans branches apart when they share a skill point", () => {
    const narrowBranchPairs: string[] = [];
    for (const node of ECOSYSTEM_MEMORY_NODES) {
      const neighbors = ECOSYSTEM_MEMORY_EDGES.flatMap((edge) => {
        if (edge.from === node.id) return [ECOSYSTEM_MEMORY_NODE_BY_ID.get(edge.to)!];
        if (edge.to === node.id) return [ECOSYSTEM_MEMORY_NODE_BY_ID.get(edge.from)!];
        return [];
      });
      for (let leftIndex = 0; leftIndex < neighbors.length; leftIndex += 1) {
        const left = neighbors[leftIndex];
        const leftVector = { x: left.x - node.x, y: left.y - node.y };
        for (let rightIndex = leftIndex + 1; rightIndex < neighbors.length; rightIndex += 1) {
          const right = neighbors[rightIndex];
          const rightVector = { x: right.x - node.x, y: right.y - node.y };
          const angleDegrees = angleBetweenVectors(leftVector, rightVector) * 180 / Math.PI;
          if (angleDegrees < 14) narrowBranchPairs.push(`${node.id}: ${left.id} / ${right.id}`);
        }
      }
    }
    expect(narrowBranchPairs).toEqual([]);
  });

  it("makes unlocks visually dominant over their numeric rank nodes", () => {
    for (const unlock of ECOSYSTEM_MEMORY_NODES.filter((node) => node.kind === "helperUnlock")) {
      const ranks = ECOSYSTEM_MEMORY_NODES.filter((node) => node.helperId === unlock.helperId && node.kind === "helperRank");
      for (const rank of ranks) expect(unlock.visualScale ?? 1).toBeGreaterThan(rank.visualScale ?? 1);
    }
  });

  it("reveals the first Memory alone, then grows only the next reachable branches", () => {
    const permanent = createPermanentEcosystemState();
    const firstFocus = getRevealedEcosystemMemoryNodeIds(permanent, true);

    expect([...firstFocus]).toEqual([FIRST_ECOSYSTEM_MEMORY_NODE_ID]);
    expect(firstFocus.has(ECOSYSTEM_MEMORY_ROOT_ID)).toBe(false);
    expect(firstFocus.has(getHelperUnlockMemoryId("fieldMouse"))).toBe(false);

    permanent.grassTouches = getHelperUnlockCost("tinySprinkler");
    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    const firstBranches = getRevealedEcosystemMemoryNodeIds(permanent);

    expect(firstBranches.size).toBe(11);
    expect(firstBranches.has(ECOSYSTEM_MEMORY_ROOT_ID)).toBe(true);
    expect(firstBranches.has(FIRST_ECOSYSTEM_MEMORY_NODE_ID)).toBe(true);
    expect(firstBranches.has(getHelperUnlockMemoryId("fieldMouse"))).toBe(true);
    expect(firstBranches.has(getHelperUnlockMemoryId("beeHive"))).toBe(false);
    expect(firstBranches.has(getHelperRankMemoryId("tinySprinkler", "throughput"))).toBe(true);
    expect(firstBranches.has(getHelperModeMemoryId("tinySprinkler"))).toBe(true);
    expect(firstBranches.has(getHelperRankMemoryId("fieldMouse", "throughput"))).toBe(false);
    expect(firstBranches.has("touch:fastTouch")).toBe(true);
    expect(firstBranches.has("touch:broadPalm")).toBe(true);
    expect(firstBranches.has("touch:manyHands")).toBe(false);
    expect(firstBranches.has("field:tier")).toBe(true);

    permanent.grassTouches = getHelperUnlockCost("fieldMouse");
    expect(unlockHelper(permanent, "fieldMouse")).toBe(true);
    const mouseBranches = getRevealedEcosystemMemoryNodeIds(permanent);

    expect(mouseBranches.has(getHelperUnlockMemoryId("beeHive"))).toBe(true);
    expect(mouseBranches.has(getHelperRankMemoryId("fieldMouse", "throughput"))).toBe(true);
    expect(mouseBranches.has(getHelperUnlockMemoryId("chickenPatrol"))).toBe(false);
  });

  it("returns to the most recently purchased visible Memory on every entry", () => {
    const permanent = createPermanentEcosystemState();
    permanent.lastPurchasedMemoryNodeId = getHelperRankMemoryId("tinySprinkler", "throughput");

    expect(getEcosystemMemoryEntryNodeId(permanent, true)).toBe(FIRST_ECOSYSTEM_MEMORY_NODE_ID);

    permanent.unlockedHelpers.tinySprinkler = true;
    expect(getEcosystemMemoryEntryNodeId(permanent)).toBe(
      getHelperRankMemoryId("tinySprinkler", "throughput"),
    );

    permanent.lastPurchasedMemoryNodeId = "missing:memory";
    expect(getEcosystemMemoryEntryNodeId(permanent)).toBe(ECOSYSTEM_MEMORY_ROOT_ID);
  });
});
