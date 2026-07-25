import { describe, expect, it } from "vitest";
import {
  ECOSYSTEM_MEMORY_EDGES,
  ECOSYSTEM_MEMORY_NODES,
  ECOSYSTEM_MEMORY_NODE_BY_ID,
  ECOSYSTEM_MEMORY_ROOT_ID,
  ECOSYSTEM_MEMORY_WORLD_HEIGHT,
  ECOSYSTEM_MEMORY_WORLD_WIDTH,
  ECOSYSTEM_MEMORY_MIN_STATUS_SCREEN_PX,
  ECOSYSTEM_MEMORY_MIN_TITLE_SCREEN_PX,
  FIRST_ECOSYSTEM_MEMORY_NODE_ID,
  HELPER_MEMORY_CATEGORY_STYLES,
  getEcosystemMemoryCategory,
  getEcosystemMemoryEntryNodeId,
  getEcosystemMemoryNodeVisualRadius,
  getEcosystemMemoryTextScale,
  getHelperModeMemoryId,
  getHelperRankMemoryId,
  getHelperRankMemoryLabel,
  getHelperUnlockMemoryId,
  getRecommendedAutomationMemoryNodeId,
  getRevealedEcosystemMemoryNodeIds,
} from "../src/game/ecosystem/EcosystemMemoryTree";
import {
  createPermanentEcosystemState,
  getHelperUnlockCost,
  getTouchRankCost,
  purchasePermanentRank,
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
  it("defines a stable, expandable 57-node web", () => {
    expect(ECOSYSTEM_MEMORY_NODES).toHaveLength(57);
    expect(new Set(ECOSYSTEM_MEMORY_NODES.map((node) => node.id)).size).toBe(ECOSYSTEM_MEMORY_NODES.length);
    expect(ECOSYSTEM_MEMORY_NODE_BY_ID.get("touch:fastTouch")).toMatchObject({
      kind: "touchRank",
      prerequisites: ["root:field-heir"],
      touchKind: "fastTouch",
    });
    expect(getTouchRankCost("fastTouch", 0)).toBe(16);
    expect(ECOSYSTEM_MEMORY_NODE_BY_ID.get("field:heartwood")).toMatchObject({
      kind: "fieldHealth",
      label: "Ancient Heartwood",
      prerequisites: [ECOSYSTEM_MEMORY_ROOT_ID],
    });
    expect(ECOSYSTEM_MEMORY_NODE_BY_ID.get("touch:lingeringCare")).toMatchObject({
      kind: "touchRank",
      label: "Green Afterglow",
      prerequisites: ["field:heartwood"],
      touchKind: "lingeringCare",
    });
    expect(ECOSYSTEM_MEMORY_NODE_BY_ID.get("touch:verdantAegis")).toMatchObject({
      kind: "touchRank",
      label: "Verdant Aegis",
      prerequisites: ["touch:lingeringCare"],
      touchKind: "verdantAegis",
    });
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

  it("keeps web labels readable when the large Memory world is visually scaled down", () => {
    const worldScale = 0.42;
    const titleScale = getEcosystemMemoryTextScale(worldScale, 15, ECOSYSTEM_MEMORY_MIN_TITLE_SCREEN_PX);
    const statusScale = getEcosystemMemoryTextScale(worldScale, 12, ECOSYSTEM_MEMORY_MIN_STATUS_SCREEN_PX);

    expect(15 * worldScale * titleScale).toBeCloseTo(ECOSYSTEM_MEMORY_MIN_TITLE_SCREEN_PX);
    expect(12 * worldScale * statusScale).toBeCloseTo(ECOSYSTEM_MEMORY_MIN_STATUS_SCREEN_PX);
    expect(getEcosystemMemoryTextScale(1.2, 15, ECOSYSTEM_MEMORY_MIN_TITLE_SCREEN_PX)).toBe(1);
  });

  it("gives every helper rank a distinct, helper-specific identity", () => {
    const helperRanks = ECOSYSTEM_MEMORY_NODES.filter((node) => node.kind === "helperRank");

    expect(helperRanks).toHaveLength(32);
    expect(new Set(helperRanks.map((node) => node.label)).size).toBe(helperRanks.length);
    expect(getHelperRankMemoryLabel("tinySprinkler", "throughput")).toBe("Clockwork Nozzle");
    expect(getHelperRankMemoryLabel("fieldMouse", "throughput")).toBe("Quick Paws");
    expect(getHelperRankMemoryLabel("meadowRabbit", "storage")).toBe("Burrow Network");
  });

  it("presents fuel-free helper ranks as Speed, Reach, Care, and Momentum", () => {
    expect(HELPER_MEMORY_CATEGORY_STYLES.throughput.label).toBe("SPEED");
    expect(HELPER_MEMORY_CATEGORY_STYLES.storage.label).toBe("REACH");
    expect(HELPER_MEMORY_CATEGORY_STYLES.efficiency.label).toBe("CARE");
    expect(HELPER_MEMORY_CATEGORY_STYLES.startingStock.label).toBe("MOMENTUM");

    const helperRanks = ECOSYSTEM_MEMORY_NODES.filter(
      (node) => node.kind === "helperRank" && node.helperId !== "tinySprinkler",
    );
    for (const node of helperRanks) {
      expect(node.description).not.toMatch(/consume|input cost|fuel cost|starting stock|starter cache/i);
      if (node.rankKind === "storage") expect(node.description).toContain("automatic touches");
      if (node.rankKind === "efficiency") expect(node.description).toContain("restore 12% more");
      if (node.rankKind === "startingStock") expect(node.description).toContain("20% charged");
    }
  });

  it("uses one consistent color language for helper upgrade purposes", () => {
    const sprinklerUnlock = ECOSYSTEM_MEMORY_NODE_BY_ID.get(getHelperUnlockMemoryId("tinySprinkler"))!;
    const sprinklerSpeed = ECOSYSTEM_MEMORY_NODE_BY_ID.get(getHelperRankMemoryId("tinySprinkler", "throughput"))!;
    const mouseSpeed = ECOSYSTEM_MEMORY_NODE_BY_ID.get(getHelperRankMemoryId("fieldMouse", "throughput"))!;
    const sprinklerStorage = ECOSYSTEM_MEMORY_NODE_BY_ID.get(getHelperRankMemoryId("tinySprinkler", "storage"))!;
    const sprinklerMode = ECOSYSTEM_MEMORY_NODE_BY_ID.get(getHelperModeMemoryId("tinySprinkler"))!;

    expect(getEcosystemMemoryCategory(sprinklerUnlock)).toEqual(HELPER_MEMORY_CATEGORY_STYLES.unlock);
    expect(getEcosystemMemoryCategory(sprinklerSpeed)).toEqual(HELPER_MEMORY_CATEGORY_STYLES.throughput);
    expect(sprinklerSpeed.color).toBe(mouseSpeed.color);
    expect(sprinklerSpeed.color).not.toBe(sprinklerStorage.color);
    expect(sprinklerMode.color).toBe(HELPER_MEMORY_CATEGORY_STYLES.mode.color);
    expect(getEcosystemMemoryCategory(ECOSYSTEM_MEMORY_NODE_BY_ID.get("touch:broadPalm")!)).toBeNull();
  });

  it("guides early players through unlock and automation-speed milestones", () => {
    const permanent = createPermanentEcosystemState();

    expect(getRecommendedAutomationMemoryNodeId(permanent)).toBe(
      getHelperUnlockMemoryId("tinySprinkler"),
    );

    permanent.grassTouches = 100;
    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    expect(getRecommendedAutomationMemoryNodeId(permanent)).toBe(
      getHelperRankMemoryId("tinySprinkler", "throughput"),
    );

    expect(purchasePermanentRank(permanent, "tinySprinkler", "throughput")).toBe(true);
    expect(getRecommendedAutomationMemoryNodeId(permanent)).toBe(
      getHelperUnlockMemoryId("fieldMouse"),
    );

    expect(unlockHelper(permanent, "fieldMouse")).toBe(true);
    expect(getRecommendedAutomationMemoryNodeId(permanent)).toBe(
      getHelperRankMemoryId("fieldMouse", "throughput"),
    );
  });

  it("leads progression descriptions with their gameplay effect", () => {
    const progressionNodes = ECOSYSTEM_MEMORY_NODES.filter((node) =>
      node.kind === "helperRank"
        || node.kind === "touchRank"
        || node.kind === "fieldHealth"
        || node.kind === "fieldTier",
    );

    for (const node of progressionNodes) {
      expect(node.description, node.id).not.toMatch(/^(?:Ten|Five)\b/);
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

    expect(firstBranches.size).toBe(8);
    expect(firstBranches.has(ECOSYSTEM_MEMORY_ROOT_ID)).toBe(true);
    expect(firstBranches.has(FIRST_ECOSYSTEM_MEMORY_NODE_ID)).toBe(true);
    expect(firstBranches.has(getHelperUnlockMemoryId("fieldMouse"))).toBe(true);
    expect(firstBranches.has(getHelperUnlockMemoryId("beeHive"))).toBe(false);
    expect(firstBranches.has(getHelperRankMemoryId("tinySprinkler", "throughput"))).toBe(true);
    expect(firstBranches.has(getHelperRankMemoryId("tinySprinkler", "efficiency"))).toBe(false);
    expect(firstBranches.has(getHelperRankMemoryId("tinySprinkler", "storage"))).toBe(false);
    expect(firstBranches.has(getHelperRankMemoryId("tinySprinkler", "startingStock"))).toBe(false);
    expect(firstBranches.has(getHelperModeMemoryId("tinySprinkler"))).toBe(false);
    expect(firstBranches.has(getHelperRankMemoryId("fieldMouse", "throughput"))).toBe(false);
    expect(firstBranches.has("touch:fastTouch")).toBe(true);
    expect(firstBranches.has("touch:broadPalm")).toBe(true);
    expect(firstBranches.has("touch:manyHands")).toBe(false);
    expect(firstBranches.has("field:tier")).toBe(true);
    expect(firstBranches.has("field:heartwood")).toBe(true);
    expect(firstBranches.has("touch:lingeringCare")).toBe(false);

    permanent.grassTouches = 500;
    expect(purchasePermanentRank(permanent, "tinySprinkler", "throughput")).toBe(true);
    const sprinklerSpeedBranches = getRevealedEcosystemMemoryNodeIds(permanent);
    expect(sprinklerSpeedBranches.has(getHelperRankMemoryId("tinySprinkler", "efficiency"))).toBe(true);
    expect(sprinklerSpeedBranches.has(getHelperRankMemoryId("tinySprinkler", "storage"))).toBe(true);
    expect(sprinklerSpeedBranches.has(getHelperRankMemoryId("tinySprinkler", "startingStock"))).toBe(false);
    expect(sprinklerSpeedBranches.has(getHelperModeMemoryId("tinySprinkler"))).toBe(false);

    expect(purchasePermanentRank(permanent, "tinySprinkler", "efficiency")).toBe(true);
    const sprinklerEfficiencyBranches = getRevealedEcosystemMemoryNodeIds(permanent);
    expect(sprinklerEfficiencyBranches.has(getHelperModeMemoryId("tinySprinkler"))).toBe(true);

    expect(purchasePermanentRank(permanent, "tinySprinkler", "storage")).toBe(true);
    const sprinklerStorageBranches = getRevealedEcosystemMemoryNodeIds(permanent);
    expect(sprinklerStorageBranches.has(getHelperRankMemoryId("tinySprinkler", "startingStock"))).toBe(true);

    permanent.heartwoodRank = 1;
    const heartwoodBranches = getRevealedEcosystemMemoryNodeIds(permanent);
    expect(heartwoodBranches.has("touch:lingeringCare")).toBe(true);
    expect(heartwoodBranches.has("touch:verdantAegis")).toBe(false);

    permanent.lingeringCareRank = 1;
    const afterglowBranches = getRevealedEcosystemMemoryNodeIds(permanent);
    expect(afterglowBranches.has("touch:verdantAegis")).toBe(true);

    permanent.grassTouches = getHelperUnlockCost("fieldMouse");
    expect(unlockHelper(permanent, "fieldMouse")).toBe(true);
    const mouseBranches = getRevealedEcosystemMemoryNodeIds(permanent);

    expect(mouseBranches.has(getHelperUnlockMemoryId("beeHive"))).toBe(true);
    expect(mouseBranches.has(getHelperRankMemoryId("fieldMouse", "throughput"))).toBe(true);
    expect(mouseBranches.has(getHelperRankMemoryId("fieldMouse", "efficiency"))).toBe(false);
    expect(mouseBranches.has(getHelperModeMemoryId("fieldMouse"))).toBe(false);
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
