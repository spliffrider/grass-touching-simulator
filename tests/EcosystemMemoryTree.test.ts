import { describe, expect, it } from "vitest";
import {
  ECOSYSTEM_MEMORY_EDGES,
  ECOSYSTEM_MEMORY_NODES,
  ECOSYSTEM_MEMORY_NODE_BY_ID,
  ECOSYSTEM_MEMORY_WORLD_HEIGHT,
  ECOSYSTEM_MEMORY_WORLD_WIDTH,
} from "../src/game/ecosystem/EcosystemMemoryTree";
import { getTouchRankCost } from "../src/game/ecosystem/EcosystemSystem";

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

  it("uses distinct organic helper-cluster silhouettes with clear node spacing", () => {
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
        if (Math.hypot(right.x - left.x, right.y - left.y) < 105) crowdedPairs.push(`${left.id} / ${right.id}`);
      }
    }
    expect(crowdedPairs).toEqual([]);
  });

  it("makes unlocks visually dominant over their numeric rank nodes", () => {
    for (const unlock of ECOSYSTEM_MEMORY_NODES.filter((node) => node.kind === "helperUnlock")) {
      const ranks = ECOSYSTEM_MEMORY_NODES.filter((node) => node.helperId === unlock.helperId && node.kind === "helperRank");
      for (const rank of ranks) expect(unlock.visualScale ?? 1).toBeGreaterThan(rank.visualScale ?? 1);
    }
  });
});
