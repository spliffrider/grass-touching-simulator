import { describe, expect, it } from "vitest";

import { HELPER_RECONFIGURE_MS } from "../src/game/ecosystem/EcosystemCatalog";
import {
  advanceEcosystem,
  buyCultivationRank,
  consumeHelperPulses,
  createEcosystemState,
  createPermanentEcosystemState,
  forceGameOver,
  getBroadPalmPower,
  getBroadPalmRadius,
  getManyHandsPower,
  getTouchRankCost,
  purchaseTouchRank,
  setPrototypeFieldSize,
  switchHelperMode,
  touchFieldTile,
  unlockAllPrototypeMemories,
} from "../src/game/ecosystem/EcosystemSystem";

describe("EcosystemSystem", () => {
  function simulateManualRun(completedRuns: number, sprinklerCount: number): number {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = completedRuns;
    permanent.unlockedHelpers.tinySprinkler = sprinklerCount > 0;
    const state = createEcosystemState(permanent, { seed: 2026 + completedRuns });
    state.helpers.tinySprinkler.count = sprinklerCount;
    while (state.active && state.elapsedMs < 600_000) {
      if (state.elapsedMs % 750 === 0) touchFieldTile(state, permanent, 0);
      advanceEcosystem(state, permanent, 250);
    }
    return state.elapsedMs;
  }

  it("advances identical seeds deterministically", () => {
    const permanentA = createPermanentEcosystemState();
    const permanentB = createPermanentEcosystemState();
    const stateA = createEcosystemState(permanentA, { seed: 12345 });
    const stateB = createEcosystemState(permanentB, { seed: 12345 });

    for (let step = 0; step < 80; step += 1) {
      if (step % 3 === 0) {
        touchFieldTile(stateA, permanentA, 0);
        touchFieldTile(stateB, permanentB, 0);
      }
      advanceEcosystem(stateA, permanentA, 250);
      advanceEcosystem(stateB, permanentB, 250);
    }

    expect(stateA.hp).toBeCloseTo(stateB.hp, 10);
    expect(stateA.resources).toEqual(stateB.resources);
    expect([...stateA.field.stages]).toEqual([...stateB.field.stages]);
    expect(stateA.rngState).toBe(stateB.rngState);
  });

  it("pauses a helper without consuming input when output storage is full", () => {
    const permanent = createPermanentEcosystemState();
    permanent.unlockedHelpers.tinySprinkler = true;
    const state = createEcosystemState(permanent, { seed: 4 });
    state.helpers.tinySprinkler.count = 1;
    state.resources.dew.amount = state.resources.dew.capacity;
    state.resources.moisture.amount = state.resources.moisture.capacity;
    state.resources.care.amount = state.resources.care.capacity;
    const dewBefore = state.resources.dew.amount;

    advanceEcosystem(state, permanent, 250);

    expect(state.resources.dew.amount).toBeCloseTo(dewBefore, 10);
    expect(state.helpers.tinySprinkler.lastPauseReason).toMatch(/full/i);
  });

  it("emits one consumable Tiny Sprinkler pulse after a completed production cycle", () => {
    const permanent = createPermanentEcosystemState();
    permanent.unlockedHelpers.tinySprinkler = true;
    const state = createEcosystemState(permanent, { seed: 41 });
    state.helpers.tinySprinkler.count = 1;
    state.resources.dew.amount = state.resources.dew.capacity;
    state.resources.moisture.amount = 0;
    state.resources.care.amount = 0;

    for (let step = 0; step < 12; step += 1) advanceEcosystem(state, permanent, 250);

    expect(state.resources.moisture.amount).toBeGreaterThan(0);
    expect(state.resources.care.producedTotal).toBeGreaterThan(0);
    expect(consumeHelperPulses(state).tinySprinkler).toBe(1);
    expect(consumeHelperPulses(state).tinySprinkler).toBe(0);
  });

  it("never overfills a buffer or creates negative stock", () => {
    const permanent = createPermanentEcosystemState();
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 99 });
    for (const helper of Object.values(state.helpers)) helper.count = 12;
    for (let step = 0; step < 2_000 && state.active; step += 1) {
      if (step % 4 === 0) touchFieldTile(state, permanent, step % state.field.stages.length);
      advanceEcosystem(state, permanent, 250);
    }

    for (const buffer of Object.values(state.resources)) {
      expect(buffer.amount).toBeGreaterThanOrEqual(0);
      expect(buffer.amount).toBeLessThanOrEqual(buffer.capacity + 0.000_001);
      expect(buffer.producedTotal).toBeGreaterThanOrEqual(0);
      expect(buffer.consumedTotal).toBeGreaterThanOrEqual(0);
    }
  });

  it("enforces the five-second helper reconfiguration pause", () => {
    const permanent = createPermanentEcosystemState();
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedModes.tinySprinkler.push("cultivator");
    const state = createEcosystemState(permanent);
    state.helpers.tinySprinkler.count = 1;

    expect(switchHelperMode(state, permanent, "tinySprinkler", "cultivator")).toBe(true);
    expect(state.helpers.tinySprinkler.reconfigureRemainingMs).toBe(HELPER_RECONFIGURE_MS);
    expect(switchHelperMode(state, permanent, "tinySprinkler", "caretaker")).toBe(false);

    for (let elapsed = 0; elapsed < HELPER_RECONFIGURE_MS - 250; elapsed += 250) {
      advanceEcosystem(state, permanent, 250);
    }
    expect(state.helpers.tinySprinkler.reconfigureRemainingMs).toBeGreaterThan(0);
    advanceEcosystem(state, permanent, 250);
    expect(state.helpers.tinySprinkler.reconfigureRemainingMs).toBe(0);
    expect(switchHelperMode(state, permanent, "tinySprinkler", "caretaker")).toBe(true);
  });

  it("deduplicates Broad Palm, Many Hands, and Field Embrace targets", () => {
    const permanent = createPermanentEcosystemState();
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 77 });
    setPrototypeFieldSize(state, permanent, 3);
    state.manualTouchCount = 9;

    const result = touchFieldTile(state, permanent, 4);

    expect(result).not.toBeNull();
    const indexes = result?.representativeImpacts.map((impact) => impact.tileIndex) ?? [];
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(result?.affectedTileCount).toBe(9);
    expect(result?.fieldEmbraceTriggered).toBe(true);
    expect(indexes.length).toBeLessThanOrEqual(24);
  });

  it("uses the approved touch rank curves", () => {
    expect(getBroadPalmRadius(1)).toBe(1);
    expect(getBroadPalmRadius(10)).toBe(5);
    expect(getBroadPalmPower(1)).toBeCloseTo(0.4);
    expect(getBroadPalmPower(10)).toBeCloseTo(1);
    expect(getManyHandsPower(1)).toBeCloseTo(0.35);
    expect(getManyHandsPower(10)).toBeCloseTo(0.8);
  });

  it("holds ten thousand real tile states at 100x100", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent);
    setPrototypeFieldSize(state, permanent, 100);

    expect(state.field.width).toBe(100);
    expect(state.field.height).toBe(100);
    expect(state.field.stages).toBeInstanceOf(Uint8Array);
    expect(state.field.stages).toHaveLength(10_000);
    expect(state.field.chunkStageCounts).toHaveLength(100 * 8);
    expect(state.field.dirtyChunks).toHaveLength(100);
  });

  it("expands only after cultivation rank ten and an owned field memory", () => {
    const permanent = createPermanentEcosystemState();
    permanent.maxFieldTier = 1;
    const state = createEcosystemState(permanent);
    for (let rank = 0; rank < 9; rank += 1) {
      state.resources.growth.amount = state.resources.growth.capacity;
      expect(buyCultivationRank(state, permanent)).toBe(true);
      expect(state.field.width).toBe(1);
    }
    state.resources.growth.amount = state.resources.growth.capacity;
    expect(buyCultivationRank(state, permanent)).toBe(true);
    expect(state.field.width).toBe(2);
    expect(state.field.cultivationRank).toBe(0);
  });

  it("ends the first manual run as a brief onboarding failure", () => {
    expect(simulateManualRun(0, 0)).toBeGreaterThanOrEqual(5_000);
    expect(simulateManualRun(0, 0)).toBeLessThanOrEqual(10_000);
  });

  it("guarantees enough first-run GT to remember the first Broad Palm rank", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent, { seed: 19 });
    const firstSkillCost = getTouchRankCost("broadPalm", 0);

    forceGameOver(state, permanent);

    expect(state.endedSummary?.grassTouchesAwarded).toBeGreaterThanOrEqual(firstSkillCost);
    expect(permanent.grassTouches).toBeGreaterThanOrEqual(firstSkillCost);
    expect(purchaseTouchRank(permanent, "broadPalm")).toBe(true);
  });

  it("moves the second run into the first multi-minute band", () => {
    const duration = simulateManualRun(1, 1);
    expect(duration).toBeGreaterThanOrEqual(150_000);
    expect(duration).toBeLessThanOrEqual(330_000);
  });

  it("runs at quarter speed in Ecosystem Works and stops completely in Options", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent);
    advanceEcosystem(state, permanent, 1_000, 0.25);
    expect(state.elapsedMs).toBe(250);
    advanceEcosystem(state, permanent, 1_000, 0);
    expect(state.elapsedMs).toBe(250);
  });
});
