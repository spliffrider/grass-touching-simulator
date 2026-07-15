import { describe, expect, it } from "vitest";

import { HELPER_RECONFIGURE_MS, PRODUCTION_TICK_MS } from "../src/game/ecosystem/EcosystemCatalog";
import { getManualTouchCooldownMs } from "../src/game/ecosystem/EcosystemTouchCooldown";
import {
  advanceEcosystem,
  buyCultivationRank,
  buyHelper,
  consumeHelperPulses,
  createEcosystemState,
  createPermanentEcosystemState,
  forceGameOver,
  getBroadPalmPower,
  getBroadPalmRadius,
  getFirstAutomationStatus,
  getManyHandsPower,
  getHelperPurchaseCost,
  getHelperUnlockCost,
  getTouchRankCost,
  normalizePermanentEcosystemState,
  purchaseTouchRank,
  setPrototypeFieldSize,
  switchHelperMode,
  touchFieldTile,
  unlockAllPrototypeMemories,
  unlockHelper,
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

  function simulateCooldownLimitedManualRun(completedRuns: number, touchCooldownMs: number): number {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = completedRuns;
    const state = createEcosystemState(permanent, { seed: 8_008 + completedRuns });
    let wallElapsedMs = 0;
    let nextTouchAtMs = 0;
    while (state.active && wallElapsedMs < 10_000) {
      if (wallElapsedMs >= nextTouchAtMs) {
        touchFieldTile(state, permanent, 0);
        nextTouchAtMs += touchCooldownMs;
      }
      advanceEcosystem(state, permanent, 10);
      wallElapsedMs += 10;
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
    permanent.completedRuns = 1;
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
    permanent.completedRuns = 1;
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

  it("carries the first loss into a purchasable Dew-to-Care sprinkler chain", () => {
    const permanent = createPermanentEcosystemState();
    permanent.grassTouches = getHelperUnlockCost("tinySprinkler");
    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    permanent.completedRuns = 1;

    const state = createEcosystemState(permanent, { seed: 47 });
    const purchaseCost = getHelperPurchaseCost(state, "tinySprinkler");
    state.runTouches = purchaseCost;
    state.resources.dew.amount = 8;

    expect(buyHelper(state, permanent, "tinySprinkler")).toBe(true);
    expect(state.helpers.tinySprinkler.count).toBe(1);
    expect(state.runTouches).toBe(0);

    for (let step = 0; step < 12; step += 1) advanceEcosystem(state, permanent, 250);

    expect(state.resources.dew.consumedTotal).toBeGreaterThan(0);
    expect(state.resources.moisture.producedTotal).toBeGreaterThan(0);
    expect(state.resources.care.producedTotal).toBeGreaterThan(0);
    expect(consumeHelperPulses(state).tinySprinkler).toBeGreaterThanOrEqual(1);
  });

  it("reports each first-automation teaching stage from unlock through Dew upkeep", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    const state = createEcosystemState(permanent, { seed: 71 });
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("locked");

    permanent.grassTouches = getHelperUnlockCost("tinySprinkler");
    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("gather");

    state.runTouches = getHelperPurchaseCost(state, "tinySprinkler");
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("ready");
    expect(buyHelper(state, permanent, "tinySprinkler")).toBe(true);
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("firstCycle");

    for (let step = 0; step < 12; step += 1) advanceEcosystem(state, permanent, 250);
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("sustain");

    state.resources.dew.amount = 0;
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("dry");
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
    permanent.completedRuns = 1;
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

  it("purchases Fast Touch ranks and safely defaults old saves to rank zero", () => {
    const legacy = normalizePermanentEcosystemState({
      version: 1,
      grassTouches: 12,
      completedRuns: 1,
    });
    expect(legacy.fastTouchRank).toBe(0);
    expect(getManualTouchCooldownMs(legacy.fastTouchRank)).toBe(380);

    const firstRankCost = getTouchRankCost("fastTouch", 0);
    legacy.grassTouches = firstRankCost;
    expect(firstRankCost).toBe(9);
    expect(purchaseTouchRank(legacy, "fastTouch")).toBe(true);
    expect(legacy.fastTouchRank).toBe(1);
    expect(legacy.grassTouches).toBe(0);
    expect(getManualTouchCooldownMs(legacy.fastTouchRank)).toBe(356);
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

  it("does not inspect chunk dirtiness on frames without a production tick", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent);
    setPrototypeFieldSize(state, permanent, 100);

    const result = advanceEcosystem(state, permanent, 16);

    expect(result.ticks).toBe(0);
    expect(result.changedChunks).toBe(0);
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
    expect(simulateManualRun(0, 0)).toBe(PRODUCTION_TICK_MS);
  });

  it("overpowers a first-run player touching at every legal cooldown", () => {
    const duration = simulateCooldownLimitedManualRun(0, getManualTouchCooldownMs(0));

    expect(duration).toBe(PRODUCTION_TICK_MS);
  });

  it("keeps Run 1 brutal even when prototype Memories were pre-unlocked", () => {
    const permanent = createPermanentEcosystemState();
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 5_005 });
    touchFieldTile(state, permanent, 0);

    while (state.active && state.elapsedMs < 5_000) advanceEcosystem(state, permanent, 250);

    expect(state.runNumber).toBe(1);
    expect(state.elapsedMs).toBe(PRODUCTION_TICK_MS);
  });

  it("waits for the player's first touch before unleashing Run 1", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent, { seed: 6_006 });

    for (let elapsed = 0; elapsed < 5_000; elapsed += 250) advanceEcosystem(state, permanent, 250);

    expect(state.active).toBe(true);
    expect(state.elapsedMs).toBe(0);
    expect(state.hp).toBe(100);
    expect(state.scourgeDemandPerSecond).toBe(0);

    touchFieldTile(state, permanent, 0);
    advanceEcosystem(state, permanent, 250);

    expect(state.elapsedMs).toBe(250);
    expect(state.scourgeDemandPerSecond).toBeGreaterThan(5_000);
    expect(state.hp).toBe(0);
    expect(state.active).toBe(false);
  });

  it("does not grant free Scourge relief for repeated losses", () => {
    expect(simulateManualRun(12, 0)).toBeGreaterThanOrEqual(1_500);
    expect(simulateManualRun(12, 0)).toBeLessThanOrEqual(2_500);
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
    permanent.completedRuns = 1;
    const state = createEcosystemState(permanent);
    advanceEcosystem(state, permanent, 1_000, 0.25);
    expect(state.elapsedMs).toBe(250);
    advanceEcosystem(state, permanent, 1_000, 0);
    expect(state.elapsedMs).toBe(250);
  });
});
