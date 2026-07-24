import { describe, expect, it } from "vitest";

import {
  HELPER_IDS,
  HELPER_RECONFIGURE_MS,
  HELPERS,
  FIELD_SIZE_LADDER,
  PRODUCTION_RESOURCE_IDS,
  PRODUCTION_TICK_MS,
} from "../src/game/ecosystem/EcosystemCatalog";
import { getManualTouchCooldownMs } from "../src/game/ecosystem/EcosystemTouchCooldown";
import {
  ANCIENT_HEARTWOOD_HP_PER_RANK,
  ANCIENT_HEARTWOOD_MAX_RANK,
  BEE_HIVE_STARTER_FLOWERS,
  FIELD_MOUSE_STARTER_SEEDS,
  FIRST_RUN_MANUAL_CARE_PER_POWER,
  FIRST_RUN_TARGET_DURATION_MS,
  HAND_TENDING_GROWTH_PER_POWER,
  HELPER_EFFICIENCY_PER_RANK,
  HELPER_HEALING_PER_IMPACT_RANK,
  HELPER_HEALING_PER_TOUCH,
  HELPER_STARTING_STOCK_PER_RANK,
  HELPER_STORAGE_CAPACITY_PER_RANK,
  HELPER_TOUCH_YIELD_PER_IMPACT_RANK,
  HELPER_THROUGHPUT_PER_RANK,
  LINGERING_CARE_DURATION_MS,
  VERDANT_AEGIS_MAX_RANK,
  advanceEcosystem,
  buyFieldExpansion,
  buyHelper,
  canBeginNextEcosystemRun,
  consumeHelperPulses,
  createEcosystemState,
  createPermanentEcosystemState,
  forceGameOver,
  getAncientHeartwoodRankCost,
  getBroadPalmPower,
  getBroadPalmRadius,
  getBeeHiveStatus,
  getFirstAutomationStatus,
  getFieldExpansionRunTouchCost,
  getFieldTierUnlockCost,
  getFieldMouseStatus,
  getManyHandsPower,
  getHelperCycleIntervalMs,
  getHelperAutomatedHealingPerTouch,
  getHelperAutomatedTouchYield,
  getHelperAutomationRates,
  getModeUnlockCost,
  getPermanentRankCost,
  getHelperPurchaseCost,
  getHelperStackCycleIntervalMs,
  getHelperStorageResourceIds,
  getHelperUnlockCost,
  getLingeringCareMaxRate,
  getLingeringCareMaxStacks,
  getLingeringCareStackRate,
  getManualTouchPowerBonusPercent,
  getManualTouchPowerMultiplier,
  getPermanentMemoryInvestmentCount,
  getPermanentMaxHp,
  getTouchRankCost,
  getVerdantAegisCapacity,
  getVerdantAegisCapacityRatio,
  getVerdantAegisConversion,
  getVerdantAegisDurationMs,
  hasUnlockedFieldExpansion,
  isFirstCollapseAwaitingSprinkler,
  isFirstEcosystemCollapse,
  isFirstMemoryPending,
  isRunEquipmentAvailable,
  normalizePermanentEcosystemState,
  purchasePermanentRank,
  purchaseAncientHeartwoodRank,
  purchaseTouchRank,
  setPrototypeFieldSize,
  switchHelperMode,
  touchFieldTile,
  unlockAllPrototypeMemories,
  unlockHelper,
  unlockHelperMode,
  unlockNextFieldTier,
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
    while (state.active && wallElapsedMs < 30_000) {
      if (wallElapsedMs >= nextTouchAtMs) {
        touchFieldTile(state, permanent, 0);
        nextTouchAtMs += touchCooldownMs;
      }
      advanceEcosystem(state, permanent, 10);
      wallElapsedMs += 10;
    }
    return state.elapsedMs;
  }

  function expectReadableFirstCollapse(durationMs: number): void {
    expect(durationMs).toBeGreaterThanOrEqual(FIRST_RUN_TARGET_DURATION_MS - 2_000);
    expect(durationMs).toBeLessThanOrEqual(FIRST_RUN_TARGET_DURATION_MS + 2_000);
  }

  function simulateFirstAutomationRunAtFullTouchRate(): {
    durationMs: number;
    initialScourgeDemandPerSecond: number;
    sprinklerPurchasedAtMs: number | null;
    hpAtPurchase: number | null;
    grassTouchesAwarded: number;
  } {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.unlockedHelpers.tinySprinkler = true;
    const state = createEcosystemState(permanent, { seed: 9_009 });
    const initialScourgeDemandPerSecond = state.scourgeDemandPerSecond;
    const touchCooldownMs = getManualTouchCooldownMs(0);
    let wallElapsedMs = 0;
    let nextTouchAtMs = 0;
    let sprinklerPurchasedAtMs: number | null = null;
    let hpAtPurchase: number | null = null;

    while (state.active && wallElapsedMs < 300_000) {
      if (wallElapsedMs >= nextTouchAtMs) {
        touchFieldTile(state, permanent, 0);
        nextTouchAtMs += touchCooldownMs;
      }
      if (
        sprinklerPurchasedAtMs === null &&
        state.runTouches >= getHelperPurchaseCost(state, "tinySprinkler") &&
        buyHelper(state, permanent, "tinySprinkler")
      ) {
        sprinklerPurchasedAtMs = wallElapsedMs;
        hpAtPurchase = state.hp;
      }
      advanceEcosystem(state, permanent, 10);
      wallElapsedMs += 10;
    }

    return {
      durationMs: state.elapsedMs,
      initialScourgeDemandPerSecond,
      sprinklerPurchasedAtMs,
      hpAtPurchase,
      grassTouchesAwarded: state.endedSummary?.grassTouchesAwarded ?? 0,
    };
  }

  function simulateFirstFieldMouseChapterAtFullTouchRate(): {
    sprinklerPurchasedAtMs: number | null;
    mousePurchasedAtMs: number | null;
    firstMouseCycleAtMs: number | null;
    hpAtFirstMouseCycle: number | null;
  } {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    const state = createEcosystemState(permanent, { seed: 9_010 });
    const touchCooldownMs = getManualTouchCooldownMs(0);
    let wallElapsedMs = 0;
    let nextTouchAtMs = 0;
    let sprinklerPurchasedAtMs: number | null = null;
    let mousePurchasedAtMs: number | null = null;
    let firstMouseCycleAtMs: number | null = null;
    let hpAtFirstMouseCycle: number | null = null;

    while (state.active && wallElapsedMs < 60_000 && firstMouseCycleAtMs === null) {
      if (wallElapsedMs >= nextTouchAtMs) {
        touchFieldTile(state, permanent, 0);
        nextTouchAtMs += touchCooldownMs;
      }
      if (
        sprinklerPurchasedAtMs === null
        && state.runTouches >= getHelperPurchaseCost(state, "tinySprinkler")
        && buyHelper(state, permanent, "tinySprinkler")
      ) {
        sprinklerPurchasedAtMs = wallElapsedMs;
      }
      if (
        mousePurchasedAtMs === null
        && getFirstAutomationStatus(state, permanent).stage === "sustain"
        && state.runTouches >= getHelperPurchaseCost(state, "fieldMouse")
        && buyHelper(state, permanent, "fieldMouse")
      ) {
        mousePurchasedAtMs = wallElapsedMs;
      }
      advanceEcosystem(state, permanent, 10);
      wallElapsedMs += 10;
      if (state.helpers.fieldMouse.cyclesCompleted >= 1) {
        firstMouseCycleAtMs = wallElapsedMs;
        hpAtFirstMouseCycle = state.hp;
      }
    }

    return {
      sprinklerPurchasedAtMs,
      mousePurchasedAtMs,
      firstMouseCycleAtMs,
      hpAtFirstMouseCycle,
    };
  }

  function simulateEarlyAutomationTakeover(): {
    setupAtMs: number | null;
    hpAtSetup: number | null;
    hpAfterHandsOff: number;
    handsOffMs: number;
    careProduced: number;
    mouseCycles: number;
  } {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 4;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    permanent.throughputRanks.tinySprinkler = 1;
    permanent.throughputRanks.fieldMouse = 1;
    const state = createEcosystemState(permanent, { seed: 9_013 });
    const touchCooldownMs = getManualTouchCooldownMs(0);
    let wallElapsedMs = 0;
    let nextTouchAtMs = 0;
    let setupAtMs: number | null = null;
    let hpAtSetup: number | null = null;

    while (state.active && wallElapsedMs < 120_000) {
      if (setupAtMs === null && wallElapsedMs >= nextTouchAtMs) {
        touchFieldTile(state, permanent, 0);
        nextTouchAtMs += touchCooldownMs;
      }
      if (
        state.helpers.tinySprinkler.count < 1
        && state.runTouches >= getHelperPurchaseCost(state, "tinySprinkler")
      ) {
        buyHelper(state, permanent, "tinySprinkler");
      }
      if (
        state.helpers.tinySprinkler.count >= 1
        && state.helpers.fieldMouse.count < 1
        && state.runTouches >= getHelperPurchaseCost(state, "fieldMouse")
      ) {
        buyHelper(state, permanent, "fieldMouse");
      }
      if (
        state.helpers.fieldMouse.count >= 1
        && state.helpers.tinySprinkler.count < 2
        && state.runTouches >= getHelperPurchaseCost(state, "tinySprinkler")
      ) {
        buyHelper(state, permanent, "tinySprinkler");
      }
      if (
        setupAtMs === null
        && state.helpers.tinySprinkler.count === 2
        && state.helpers.fieldMouse.count === 1
      ) {
        setupAtMs = wallElapsedMs;
        hpAtSetup = state.hp;
      }
      advanceEcosystem(state, permanent, 10);
      wallElapsedMs += 10;
      if (setupAtMs !== null && wallElapsedMs - setupAtMs >= 60_000) break;
    }

    return {
      setupAtMs,
      hpAtSetup,
      hpAfterHandsOff: state.hp,
      handsOffMs: setupAtMs === null ? 0 : wallElapsedMs - setupAtMs,
      careProduced: state.resources.care.producedTotal,
      mouseCycles: state.helpers.fieldMouse.cyclesCompleted,
    };
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

  it("keeps sprinkler Care running when optional starter Growth storage is full", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.unlockedHelpers.tinySprinkler = true;
    const state = createEcosystemState(permanent, { seed: 5 });
    state.helpers.tinySprinkler.count = 1;
    state.resources.dew.amount = state.resources.dew.capacity;
    state.resources.growth.amount = state.resources.growth.capacity;
    state.resources.moisture.amount = 0;
    state.resources.care.amount = 0;

    for (let step = 0; step < 12; step += 1) advanceEcosystem(state, permanent, 250);

    expect(state.resources.growth.amount).toBe(state.resources.growth.capacity);
    expect(state.resources.care.producedTotal).toBeGreaterThan(0);
    expect(state.helpers.tinySprinkler.lastPauseReason).toBeNull();
  });

  it("keeps stacked sprinklers cycling when the Moisture byproduct tank is full", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.throughputRanks.tinySprinkler = 1;
    const state = createEcosystemState(permanent, { seed: 6 });
    state.helpers.tinySprinkler.count = 6;
    state.resources.dew.capacity = 10_000;
    state.resources.dew.amount = 10_000;
    state.resources.moisture.amount = state.resources.moisture.capacity;
    state.resources.care.capacity = 10_000;
    state.resources.care.amount = 0;

    const stackCycleIntervalMs = getHelperStackCycleIntervalMs(
      state,
      permanent,
      "tinySprinkler",
    );
    for (let step = 0; step < 40; step += 1) {
      advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
    }

    expect(stackCycleIntervalMs).toBeCloseTo(267.094, 2);
    expect(state.resources.moisture.amount).toBe(state.resources.moisture.capacity);
    expect(state.helpers.tinySprinkler.cyclesCompleted).toBeCloseTo(37.44, 8);
    expect(state.automatedTouchCount).toBeCloseTo(37.44, 8);
    expect(state.automatedHealingTotal).toBeGreaterThan(0);
    expect(state.helpers.tinySprinkler.lastPauseReason).toBeNull();
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
    expect(state.resources.growth.producedTotal).toBeGreaterThan(0);
    expect(state.resources.care.producedTotal).toBeGreaterThan(0);
    expect(consumeHelperPulses(state).tinySprinkler).toBe(1);
    expect(consumeHelperPulses(state).tinySprinkler).toBe(0);
  });

  it("turns every helper activation into tiered automated touches and healing", () => {
    const tierYields = HELPER_IDS.map((helperId) => HELPERS[helperId].touchesPerCycle);
    expect(tierYields).toEqual([1, 2, 3, 5, 8, 13, 21, 34]);

    for (const helperId of HELPER_IDS) {
      for (const mode of HELPERS[helperId].modes) {
        const permanent = createPermanentEcosystemState();
        permanent.completedRuns = 8;
        permanent.unlockedHelpers[helperId] = true;
        const state = createEcosystemState(permanent, { seed: 44_000 + HELPER_IDS.indexOf(helperId) });
        state.maxHp = 1_000_000;
        state.hp = 500_000;
        state.helpers[helperId].count = 1;
        state.helpers[helperId].modeId = mode.id;
        for (const resourceId of PRODUCTION_RESOURCE_IDS) {
          state.resources[resourceId].amount = state.resources[resourceId].capacity * 0.5;
        }

        for (let step = 0; step < 20; step += 1) {
          advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
        }

        expect(state.helpers[helperId].cyclesCompleted, `${helperId}:${mode.id}`).toBeGreaterThan(0);
        expect(state.automatedTouchCount, `${helperId}:${mode.id}`).toBeGreaterThan(0);
        expect(state.automatedHealingTotal, `${helperId}:${mode.id}`).toBeGreaterThan(0);
        expect(state.runTouches, `${helperId}:${mode.id}`).toBeCloseTo(state.automatedTouchCount, 8);
        expect(state.automationTouchRate, `${helperId}:${mode.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("scales automation continuously with copies, Speed, and Impact Memories", () => {
    const simulateSprinklers = (
      count: number,
      throughputRank: number,
      impactRank: number,
    ) => {
      const permanent = createPermanentEcosystemState();
      permanent.completedRuns = 2;
      permanent.unlockedHelpers.tinySprinkler = true;
      permanent.throughputRanks.tinySprinkler = throughputRank;
      permanent.efficiencyRanks.tinySprinkler = impactRank;
      const state = createEcosystemState(permanent, { seed: 45_000 });
      state.maxHp = 1_000_000;
      state.hp = 500_000;
      state.helpers.tinySprinkler.count = count;
      state.resources.dew.amount = state.resources.dew.capacity;
      state.resources.moisture.amount = 0;
      state.resources.care.amount = 0;
      for (let step = 0; step < 16; step += 1) {
        advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
      }
      return state;
    };

    const baseline = simulateSprinklers(1, 0, 0);
    const threeCopies = simulateSprinklers(3, 0, 0);
    const faster = simulateSprinklers(1, 1, 0);
    const harder = simulateSprinklers(1, 0, 1);

    expect(threeCopies.automatedTouchCount).toBeCloseTo(baseline.automatedTouchCount * 3, 8);
    expect(faster.automatedTouchCount).toBeCloseTo(
      baseline.automatedTouchCount * (1 + HELPER_THROUGHPUT_PER_RANK),
      8,
    );
    expect(harder.automatedTouchCount).toBeCloseTo(
      baseline.automatedTouchCount * (1 + HELPER_TOUCH_YIELD_PER_IMPACT_RANK),
      8,
    );
    expect(harder.automatedHealingTotal).toBeCloseTo(
      baseline.automatedHealingTotal
        * (1 + HELPER_TOUCH_YIELD_PER_IMPACT_RANK)
        * (1 + HELPER_HEALING_PER_IMPACT_RANK),
      8,
    );
    expect(getHelperAutomatedTouchYield("tinySprinkler", 0)).toBe(1);
    expect(getHelperAutomatedHealingPerTouch(0)).toBe(HELPER_HEALING_PER_TOUCH);
    expect(getHelperAutomationRates(harder, createPermanentEcosystemState(), "tinySprinkler").touchesPerCycle).toBe(1);
  });

  it("carries the first loss into a purchasable sprinkler Care and Growth chain", () => {
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
    expect(state.resources.growth.producedTotal).toBeGreaterThan(0);
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

  it("turns the first Field Mouse purchase into an immediate seed-to-Growth chapter", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    const state = createEcosystemState(permanent, { seed: 8_151 });
    state.runTouches = getHelperPurchaseCost(state, "fieldMouse");

    expect(getFieldMouseStatus(state, permanent).stage).toBe("ready");
    expect(buyHelper(state, permanent, "fieldMouse")).toBe(true);
    expect(state.resources.seeds.amount).toBe(FIELD_MOUSE_STARTER_SEEDS);
    expect(getFieldMouseStatus(state, permanent).stage).toBe("firstTrip");

    for (let step = 0; step < 20; step += 1) advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);

    expect(state.helpers.fieldMouse.cyclesCompleted).toBeGreaterThanOrEqual(1);
    expect(state.resources.seeds.consumedTotal).toBeGreaterThanOrEqual(1);
    expect(state.resources.growth.producedTotal).toBeGreaterThan(1);
    expect(state.runTouches).toBeGreaterThan(0);
    expect(getFieldMouseStatus(state, permanent).stage).toBe("working");
    expect(consumeHelperPulses(state).fieldMouse).toBeGreaterThanOrEqual(1);
  });

  it("links Tiny Sprinkler Moisture into bonus Growth and Care on Field Mouse trips", () => {
    const createMouseRun = (withSprinkler: boolean) => {
      const permanent = createPermanentEcosystemState();
      permanent.completedRuns = 2;
      permanent.unlockedHelpers.tinySprinkler = true;
      permanent.unlockedHelpers.fieldMouse = true;
      const state = createEcosystemState(permanent, { seed: 9_151 });
      state.maxHp = 1_000_000;
      state.hp = state.maxHp;
      state.helpers.fieldMouse.count = 1;
      state.helpers.tinySprinkler.count = withSprinkler ? 1 : 0;
      state.helpers.tinySprinkler.reconfigureRemainingMs = 60_000;
      state.resources.seeds.amount = 10;
      state.resources.moisture.amount = 10;
      state.resources.dew.amount = 0;
      return { permanent, state };
    };

    const solo = createMouseRun(false);
    const linked = createMouseRun(true);
    expect(getFieldMouseStatus(solo.state, solo.permanent).dampFurrowsLinked).toBe(false);
    expect(getFieldMouseStatus(linked.state, linked.permanent)).toMatchObject({
      dampFurrowsLinked: true,
      dampFurrowsFlowing: true,
    });

    for (let step = 0; step < 12; step += 1) {
      advanceEcosystem(solo.state, solo.permanent, PRODUCTION_TICK_MS);
      advanceEcosystem(linked.state, linked.permanent, PRODUCTION_TICK_MS);
    }

    expect(linked.state.resources.moisture.consumedTotal).toBeGreaterThan(solo.state.resources.moisture.consumedTotal + 0.1);
    expect(linked.state.resources.growth.producedTotal).toBeGreaterThan(solo.state.resources.growth.producedTotal + 0.2);
    expect(linked.state.resources.care.producedTotal).toBeGreaterThan(solo.state.resources.care.producedTotal + 0.1);
  });

  it("keeps ordinary Field Mouse trips running when Damp Furrows have no Moisture", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    const state = createEcosystemState(permanent, { seed: 9_152 });
    state.maxHp = 1_000_000;
    state.hp = state.maxHp;
    state.helpers.tinySprinkler.count = 1;
    state.helpers.tinySprinkler.reconfigureRemainingMs = 60_000;
    state.helpers.fieldMouse.count = 1;
    state.resources.dew.amount = 0;
    state.resources.moisture.amount = 0;
    state.resources.seeds.amount = 3;

    expect(getFieldMouseStatus(state, permanent)).toMatchObject({
      dampFurrowsLinked: true,
      dampFurrowsFlowing: false,
    });
    for (let step = 0; step < 16; step += 1) {
      advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
    }

    expect(state.helpers.fieldMouse.cyclesCompleted).toBeGreaterThanOrEqual(1);
    expect(state.resources.seeds.consumedTotal).toBeGreaterThanOrEqual(1);
    expect(state.resources.growth.producedTotal).toBeGreaterThan(1);
  });

  it("grants one starter cache per run and reports a seed-starved mouse", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    const state = createEcosystemState(permanent, { seed: 8_152 });
    state.runTouches = getHelperPurchaseCost(state, "fieldMouse");

    expect(buyHelper(state, permanent, "fieldMouse")).toBe(true);
    state.resources.seeds.amount = 0;
    expect(getFieldMouseStatus(state, permanent).stage).toBe("starved");

    state.runTouches = getHelperPurchaseCost(state, "fieldMouse");
    expect(buyHelper(state, permanent, "fieldMouse")).toBe(true);
    expect(state.resources.seeds.amount).toBe(0);
  });

  it("turns the first Bee Hive purchase into an immediate pollination chapter", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 3;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    permanent.unlockedHelpers.beeHive = true;
    const state = createEcosystemState(permanent, { seed: 8_153 });
    state.runTouches = getHelperPurchaseCost(state, "beeHive");

    expect(getBeeHiveStatus(state, permanent).stage).toBe("ready");
    expect(buyHelper(state, permanent, "beeHive")).toBe(true);
    expect(state.resources.flowers.amount).toBe(BEE_HIVE_STARTER_FLOWERS);
    expect(getBeeHiveStatus(state, permanent).stage).toBe("firstFlight");

    for (let step = 0; step < 24; step += 1) advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);

    expect(state.helpers.beeHive.cyclesCompleted).toBeGreaterThanOrEqual(1);
    expect(state.resources.flowers.consumedTotal).toBeGreaterThanOrEqual(1);
    expect(state.resources.pollinatedBlooms.producedTotal).toBeGreaterThan(1);
    expect(getBeeHiveStatus(state, permanent).stage).toBe("working");
    expect(consumeHelperPulses(state).beeHive).toBeGreaterThanOrEqual(1);
  });

  it("opens one Flower reserve per run and reports a flower-starved hive", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 3;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.unlockedHelpers.fieldMouse = true;
    permanent.unlockedHelpers.beeHive = true;
    const state = createEcosystemState(permanent, { seed: 8_154 });
    state.runTouches = getHelperPurchaseCost(state, "beeHive");

    expect(buyHelper(state, permanent, "beeHive")).toBe(true);
    state.resources.flowers.amount = 0;
    expect(getBeeHiveStatus(state, permanent).stage).toBe("starved");

    state.runTouches = getHelperPurchaseCost(state, "beeHive");
    expect(buyHelper(state, permanent, "beeHive")).toBe(true);
    expect(state.resources.flowers.amount).toBe(0);
  });

  it("keeps Run 1 bare-hands-only even when helper Memories and RT are injected", () => {
    const permanent = createPermanentEcosystemState();
    unlockAllPrototypeMemories(permanent);
    permanent.startingStockRanks.tinySprinkler = 5;
    permanent.startingStockRanks.fieldMouse = 5;
    const state = createEcosystemState(permanent, { seed: 7_171 });
    state.runTouches = 100_000;
    state.helpers.tinySprinkler.count = 4;
    state.helpers.fieldMouse.count = 3;
    state.resources.dew.amount = state.resources.dew.capacity;

    expect(isRunEquipmentAvailable(state)).toBe(false);
    expect(state.resources.moisture.amount).toBe(0);
    expect(state.resources.seeds.amount).toBe(0);
    expect(getFirstAutomationStatus(state, permanent).stage).toBe("locked");
    expect(buyHelper(state, permanent, "tinySprinkler")).toBe(false);
    expect(buyHelper(state, permanent, "fieldMouse")).toBe(false);
    expect(switchHelperMode(state, permanent, "tinySprinkler", "cultivator")).toBe(false);

    touchFieldTile(state, permanent, 0);
    advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);

    expect(state.helpers.tinySprinkler.count).toBe(0);
    expect(state.helpers.fieldMouse.count).toBe(0);
    expect(state.resources.care.producedTotal).toBeLessThan(0.001);
    expect(Object.values(consumeHelperPulses(state))).toEqual(HELPER_IDS.map(() => 0));
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
    expect(getBroadPalmPower(1)).toBeCloseTo(0.5);
    expect(getBroadPalmPower(10)).toBeCloseTo(1);
    expect(getManyHandsPower(1)).toBeCloseTo(0.45);
    expect(getManyHandsPower(10)).toBeCloseTo(0.9);
  });

  it("turns helper speed ranks into shorter, measurable action cooldowns", () => {
    const baseInterval = getHelperCycleIntervalMs("tinySprinkler", 0);
    const firstRankInterval = getHelperCycleIntervalMs("tinySprinkler", 1);
    const maxRankInterval = getHelperCycleIntervalMs("tinySprinkler", 10);

    expect(baseInterval).toBeCloseTo(2_083.333, 2);
    expect(firstRankInterval).toBeLessThan(baseInterval);
    expect(maxRankInterval).toBeLessThan(firstRankInterval);
    expect(firstRankInterval).toBeCloseTo(1_602.564, 2);
    expect(maxRankInterval).toBeCloseTo(520.833, 2);
    expect(HELPER_THROUGHPUT_PER_RANK).toBe(0.3);
  });

  it("makes post-onboarding Memories expensive enough to remain choices", () => {
    const permanent = createPermanentEcosystemState();
    permanent.unlockedHelpers.tinySprinkler = true;
    const earlyCosts = [
      getPermanentRankCost(permanent, "tinySprinkler", "throughput"),
      getPermanentRankCost(permanent, "tinySprinkler", "storage"),
      getPermanentRankCost(permanent, "tinySprinkler", "efficiency"),
      getPermanentRankCost(permanent, "tinySprinkler", "startingStock"),
      getModeUnlockCost("tinySprinkler"),
      getHelperUnlockCost("fieldMouse"),
      getTouchRankCost("fastTouch", 0),
      getTouchRankCost("broadPalm", 0),
      getAncientHeartwoodRankCost(0),
    ].sort((left, right) => left - right);

    expect(getHelperUnlockCost("tinySprinkler")).toBe(5);
    expect(getHelperUnlockCost("fieldMouse")).toBe(20);
    expect(earlyCosts.slice(0, 3).reduce((sum, cost) => sum + cost, 0)).toBeLessThanOrEqual(50);
    expect(earlyCosts.slice(0, 4).reduce((sum, cost) => sum + cost, 0)).toBeGreaterThan(50);
    expect(HELPER_STORAGE_CAPACITY_PER_RANK).toBe(0.25);
    expect(HELPER_EFFICIENCY_PER_RANK).toBe(0.06);
    expect(HELPER_STARTING_STOCK_PER_RANK).toBe(6);
  });

  it("makes every purchased Memory strengthen standard manual touches", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.grassTouches = 10_000;

    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    expect(purchasePermanentRank(permanent, "tinySprinkler", "throughput")).toBe(true);
    expect(unlockHelperMode(permanent, "tinySprinkler", "cultivator")).toBe(true);
    expect(unlockNextFieldTier(permanent)).toBe(true);
    expect(purchaseTouchRank(permanent, "broadPalm")).toBe(true);

    expect(getPermanentMemoryInvestmentCount(permanent)).toBe(5);
    expect(getManualTouchPowerBonusPercent(permanent)).toBe(15);
    expect(getManualTouchPowerMultiplier(permanent)).toBeCloseTo(1.15);

    const state = createEcosystemState(permanent, { seed: 3_141 });
    state.hp = 50;
    const result = touchFieldTile(state, permanent, 0);

    expect(result?.totalPower).toBeCloseTo(1.15);
    expect(result?.healedHp).toBeCloseTo(6.9);
    expect(result?.dewGained).toBeCloseTo(1.3225);
    expect(result?.growthGained).toBeCloseTo(1.15 * HAND_TENDING_GROWTH_PER_POWER);
    expect(result?.runTouchesGained).toBeCloseTo(1.058);
  });

  it("turns recovered Run 2 touches into immediate starter Growth", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    const state = createEcosystemState(permanent, { seed: 3_142 });

    let growthGained = 0;
    for (let touch = 0; touch < 20; touch += 1) {
      growthGained += touchFieldTile(state, permanent, 0)?.growthGained ?? 0;
    }

    expect(growthGained).toBeCloseTo(7);
    expect(state.resources.growth.amount).toBeCloseTo(7);
  });

  it("doubles the Run Touches price at every field expansion", () => {
    const costs = FIELD_SIZE_LADDER
      .slice(1)
      .map((_, index) => getFieldExpansionRunTouchCost(index + 1));

    expect(costs).toEqual([
      500,
      1_000,
      2_000,
      4_000,
      8_000,
      16_000,
      32_000,
      64_000,
      128_000,
      256_000,
    ]);
    expect(getFieldExpansionRunTouchCost(0)).toBe(0);
    expect(getFieldExpansionRunTouchCost(FIELD_SIZE_LADDER.length)).toBe(0);
  });

  it("lets the guaranteed opening reward reveal the first field threshold", () => {
    expect(getHelperUnlockCost("tinySprinkler") + getFieldTierUnlockCost(1)).toBe(7);
    expect(getFieldTierUnlockCost(2)).toBe(8);
  });

  it("gives every helper storage Memory at least one real buffer to expand", () => {
    const baselinePermanent = createPermanentEcosystemState();
    const baseline = createEcosystemState(baselinePermanent);

    for (const helperId of HELPER_IDS) {
      const permanent = createPermanentEcosystemState();
      permanent.storageRanks[helperId] = 1;
      const state = createEcosystemState(permanent);
      const resources = getHelperStorageResourceIds(helperId);

      expect(resources.length, helperId).toBeGreaterThan(0);
      for (const resourceId of resources) {
        expect(state.resources[resourceId].capacity, `${helperId}:${resourceId}`).toBeGreaterThan(
          baseline.resources[resourceId].capacity,
        );
      }
    }
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
    expect(firstRankCost).toBe(16);
    expect(purchaseTouchRank(legacy, "fastTouch")).toBe(true);
    expect(legacy.fastTouchRank).toBe(1);
    expect(legacy.grassTouches).toBe(0);
    expect(getManualTouchCooldownMs(legacy.fastTouchRank)).toBe(348);
  });

  it("turns Green Afterglow ranks into capped, refreshable healing stacks", () => {
    const permanent = normalizePermanentEcosystemState({ version: 1, completedRuns: 1 });
    permanent.grassTouches = 100;

    expect(permanent.lingeringCareRank).toBe(0);
    expect(purchaseTouchRank(permanent, "lingeringCare")).toBe(false);

    permanent.heartwoodRank = 1;
    const firstRankCost = getTouchRankCost("lingeringCare", 0);
    expect(firstRankCost).toBe(20);
    expect(purchaseTouchRank(permanent, "lingeringCare")).toBe(true);
    expect(permanent.lingeringCareRank).toBe(1);
    expect(getLingeringCareMaxStacks(1)).toBe(3);

    const state = createEcosystemState(permanent, { seed: 1_616 });
    state.hp = 50;
    const expectedStackRate = getLingeringCareStackRate(1) * getManualTouchPowerMultiplier(permanent);
    const firstTouch = touchFieldTile(state, permanent, 0);
    const secondTouch = touchFieldTile(state, permanent, 0);
    const thirdTouch = touchFieldTile(state, permanent, 0);

    expect(firstTouch?.lingeringCareAddedPerSecond).toBeCloseTo(expectedStackRate);
    expect(secondTouch?.lingeringCarePerSecond).toBeCloseTo(expectedStackRate * 2);
    expect(thirdTouch?.lingeringCarePerSecond).toBeCloseTo(expectedStackRate * 3);
    expect(state.lingeringCareRemainingMs).toBe(LINGERING_CARE_DURATION_MS);

    state.lingeringCareRemainingMs = 750;
    const cappedTouch = touchFieldTile(state, permanent, 0);
    expect(cappedTouch?.lingeringCareAddedPerSecond).toBe(0);
    expect(state.lingeringCareRemainingMs).toBe(LINGERING_CARE_DURATION_MS);

    state.resources.care.capacity = 10_000;
    state.resources.care.amount = 10_000;
    const manualCareBeforeAfterglow = state.manualCareTotal;
    advanceEcosystem(state, permanent, 1_000);
    expect(state.manualCareTotal - manualCareBeforeAfterglow).toBeCloseTo(expectedStackRate * 3, 5);
    for (let elapsed = 1_000; elapsed < LINGERING_CARE_DURATION_MS; elapsed += 1_000) {
      advanceEcosystem(state, permanent, 1_000);
    }
    expect(state.lingeringCarePerSecond).toBe(0);
    expect(state.lingeringCareRemainingMs).toBe(0);
  });

  it("scales Green Afterglow to six stronger stacks without creating per-touch state", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.heartwoodRank = 1;
    permanent.lingeringCareRank = 10;

    expect(getLingeringCareStackRate(10)).toBeCloseTo(1.6);
    expect(getLingeringCareMaxStacks(10)).toBe(7);

    const state = createEcosystemState(permanent, { seed: 1_617 });
    for (let touch = 0; touch < 20; touch += 1) touchFieldTile(state, permanent, 0);

    expect(state.lingeringCarePerSecond).toBeCloseTo(getLingeringCareMaxRate(permanent));
    expect(state.lingeringCareRemainingMs).toBe(LINGERING_CARE_DURATION_MS);
    expect(Object.keys(state).filter((key) => key.startsWith("lingeringCare"))).toEqual([
      "lingeringCarePerSecond",
      "lingeringCareRemainingMs",
    ]);
  });

  it("unlocks Verdant Aegis after Green Afterglow and uses the approved rank curves", () => {
    const permanent = normalizePermanentEcosystemState({ version: 1, completedRuns: 1 });
    permanent.grassTouches = 1_000;

    expect(permanent.verdantAegisRank).toBe(0);
    expect(purchaseTouchRank(permanent, "verdantAegis")).toBe(false);

    permanent.lingeringCareRank = 1;
    expect(getTouchRankCost("verdantAegis", 0)).toBe(32);
    expect(purchaseTouchRank(permanent, "verdantAegis")).toBe(true);
    expect(permanent.verdantAegisRank).toBe(1);
    expect(getVerdantAegisConversion(1)).toBeCloseTo(0.6);
    expect(getVerdantAegisCapacityRatio(1)).toBeCloseTo(0.12);
    expect(getVerdantAegisDurationMs(1)).toBe(5_000);
    expect(getVerdantAegisConversion(VERDANT_AEGIS_MAX_RANK)).toBeCloseTo(1);
    expect(getVerdantAegisCapacityRatio(VERDANT_AEGIS_MAX_RANK)).toBeCloseTo(0.5);
    expect(getVerdantAegisDurationMs(VERDANT_AEGIS_MAX_RANK)).toBe(7_700);

    const maxed = normalizePermanentEcosystemState({ version: 1, verdantAegisRank: 999 });
    expect(maxed.verdantAegisRank).toBe(VERDANT_AEGIS_MAX_RANK);
  });

  it("converts only healing beyond full HP into a temporary shield", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.heartwoodRank = 1;
    permanent.lingeringCareRank = 1;
    permanent.verdantAegisRank = 1;
    const state = createEcosystemState(permanent, { seed: 1_618 });
    state.hp = state.maxHp - 2;

    const result = touchFieldTile(state, permanent, 0)!;
    const rawHealing = result.totalPower * 6;

    expect(result.healedHp).toBeCloseTo(2);
    expect(result.shieldGained).toBeCloseTo((rawHealing - 2) * getVerdantAegisConversion(1));
    expect(result.shieldAmount).toBeCloseTo(result.shieldGained);
    expect(state.hp).toBe(state.maxHp);
    expect(state.maxOverhealShield).toBeCloseTo(getVerdantAegisCapacity(permanent, state.maxHp));
    expect(state.overhealShieldRemainingMs).toBe(getVerdantAegisDurationMs(1));
    expect(state.manualCareTotal).toBeCloseTo(2);
  });

  it("caps Verdant Aegis and refreshes its lifetime even when the shield is full", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.lingeringCareRank = 1;
    permanent.verdantAegisRank = 1;
    const state = createEcosystemState(permanent, { seed: 1_619 });

    for (let touch = 0; touch < 8; touch += 1) touchFieldTile(state, permanent, 0);
    expect(state.overhealShield).toBeCloseTo(state.maxOverhealShield);
    expect(state.manualCareTotal).toBe(0);

    state.overhealShieldRemainingMs = 250;
    const cappedTouch = touchFieldTile(state, permanent, 0)!;
    expect(cappedTouch.shieldGained).toBe(0);
    expect(state.overhealShield).toBeCloseTo(state.maxOverhealShield);
    expect(state.overhealShieldRemainingMs).toBe(getVerdantAegisDurationMs(1));
  });

  it("absorbs Scourge damage with Verdant Aegis before Ancient HP", () => {
    const shieldPermanent = createPermanentEcosystemState();
    shieldPermanent.completedRuns = 1;
    shieldPermanent.unlockedHelpers.tinySprinkler = true;
    shieldPermanent.lingeringCareRank = 1;
    shieldPermanent.verdantAegisRank = 1;
    const shielded = createEcosystemState(shieldPermanent, { seed: 1_620 });
    touchFieldTile(shielded, shieldPermanent, 0);
    shielded.lingeringCarePerSecond = 0;
    shielded.lingeringCareRemainingMs = 0;
    const shieldBeforeDamage = shielded.overhealShield;

    const baselinePermanent = createPermanentEcosystemState();
    baselinePermanent.completedRuns = 1;
    baselinePermanent.unlockedHelpers.tinySprinkler = true;
    baselinePermanent.lingeringCareRank = 1;
    const baseline = createEcosystemState(baselinePermanent, { seed: 1_620 });
    touchFieldTile(baseline, baselinePermanent, 0);
    baseline.lingeringCarePerSecond = 0;
    baseline.lingeringCareRemainingMs = 0;

    advanceEcosystem(shielded, shieldPermanent, PRODUCTION_TICK_MS);
    advanceEcosystem(baseline, baselinePermanent, PRODUCTION_TICK_MS);

    expect(baseline.hp).toBeLessThan(baseline.maxHp);
    const baselineDamage = baseline.maxHp - baseline.hp;
    expect(shielded.hp - baseline.hp).toBeCloseTo(Math.min(shieldBeforeDamage, baselineDamage), 5);
    expect(shielded.overhealShield).toBeCloseTo(Math.max(0, shieldBeforeDamage - baselineDamage), 5);
  });

  it("expires Verdant Aegis without per-heal timers or offline-style advancement", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.unlockedHelpers.tinySprinkler = true;
    permanent.heartwoodRank = 10;
    permanent.lingeringCareRank = 1;
    permanent.verdantAegisRank = 10;
    const state = createEcosystemState(permanent, { seed: 1_621 });
    state.overhealShield = state.maxOverhealShield;
    state.overhealShieldRemainingMs = getVerdantAegisDurationMs(10);

    for (
      let elapsed = 0;
      elapsed < getVerdantAegisDurationMs(10) - PRODUCTION_TICK_MS;
      elapsed += PRODUCTION_TICK_MS
    ) {
      advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
    }
    expect(state.overhealShield).toBeGreaterThan(0);
    expect(state.overhealShieldRemainingMs).toBeGreaterThan(0);
    expect(state.overhealShieldRemainingMs).toBeLessThanOrEqual(PRODUCTION_TICK_MS);

    advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
    expect(state.overhealShield).toBe(0);
    expect(state.overhealShieldRemainingMs).toBe(0);
    expect(Object.keys(state).filter((key) => key.toLowerCase().includes("shield"))).toEqual([
      "overhealShield",
      "maxOverhealShield",
      "overhealShieldRemainingMs",
    ]);
  });

  it("remembers Ancient Heartwood ranks and applies them to future field health", () => {
    const permanent = normalizePermanentEcosystemState({ version: 1, completedRuns: 1 });
    expect(permanent.heartwoodRank).toBe(0);
    expect(getPermanentMaxHp(permanent)).toBe(100);

    const firstRankCost = getAncientHeartwoodRankCost(permanent.heartwoodRank);
    permanent.grassTouches = firstRankCost;
    expect(firstRankCost).toBe(16);
    expect(purchaseAncientHeartwoodRank(permanent)).toBe(true);
    expect(permanent.heartwoodRank).toBe(1);
    expect(getPermanentMaxHp(permanent)).toBe(100 + ANCIENT_HEARTWOOD_HP_PER_RANK);

    const nextRun = createEcosystemState(permanent, { seed: 1_515 });
    expect(nextRun.hp).toBe(125);
    expect(nextRun.maxHp).toBe(125);

    const maxed = normalizePermanentEcosystemState({ version: 1, heartwoodRank: 999 });
    expect(maxed.heartwoodRank).toBe(ANCIENT_HEARTWOOD_MAX_RANK);
    expect(getPermanentMaxHp(maxed)).toBe(350);
  });

  it("safely normalizes the most recently purchased Memory node", () => {
    const legacy = normalizePermanentEcosystemState({
      version: 1,
      grassTouches: 12,
    });
    const remembered = normalizePermanentEcosystemState({
      version: 1,
      lastPurchasedMemoryNodeId: "helper:tinySprinkler:throughput",
    });
    const malformed = normalizePermanentEcosystemState({
      version: 1,
      lastPurchasedMemoryNodeId: "x".repeat(129),
    });

    expect(legacy.lastPurchasedMemoryNodeId).toBeNull();
    expect(remembered.lastPurchasedMemoryNodeId).toBe("helper:tinySprinkler:throughput");
    expect(malformed.lastPurchasedMemoryNodeId).toBeNull();
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

  it("spends 500 Run Touches on the first owned field expansion", () => {
    const permanent = createPermanentEcosystemState();
    permanent.maxFieldTier = 1;
    const state = createEcosystemState(permanent);
    state.runTouches = 500;
    state.resources.growth.amount = 17;

    expect(buyFieldExpansion(state, permanent)).toBe(true);
    expect(state.field.width).toBe(2);
    expect(state.runTouches).toBe(0);
    expect(state.resources.growth.amount).toBe(17);
    expect(state.field.cultivationRank).toBe(0);
  });

  it("gives the first onboarding failure time to be read", () => {
    expectReadableFirstCollapse(simulateManualRun(0, 0));
  });

  it("keeps field expansion unavailable until its Memory is owned and its Run Touches price is met", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent);
    state.runTouches = 500;

    expect(hasUnlockedFieldExpansion(state, permanent)).toBe(false);
    expect(buyFieldExpansion(state, permanent)).toBe(false);
    expect(state.field.width).toBe(1);
    expect(state.runTouches).toBe(500);

    permanent.grassTouches = getFieldTierUnlockCost(1);
    expect(unlockNextFieldTier(permanent)).toBe(true);
    expect(hasUnlockedFieldExpansion(state, permanent)).toBe(true);
    state.runTouches = 499;
    expect(buyFieldExpansion(state, permanent)).toBe(false);
    expect(state.field.width).toBe(1);
    expect(state.runTouches).toBe(499);

    state.runTouches = 500;
    expect(buyFieldExpansion(state, permanent)).toBe(true);
    expect(state.field.width).toBe(2);
    expect(state.runTouches).toBe(0);
  });

  it("charges the next exponential price after the field grows", () => {
    const permanent = createPermanentEcosystemState();
    permanent.maxFieldTier = 2;
    const state = createEcosystemState(permanent);
    state.runTouches = 1_500;

    expect(buyFieldExpansion(state, permanent)).toBe(true);
    expect(state.field.width).toBe(2);
    expect(state.runTouches).toBe(1_000);
    expect(buyFieldExpansion(state, permanent)).toBe(true);
    expect(state.field.width).toBe(3);
    expect(state.runTouches).toBe(0);
  });

  it("overpowers a first-run player touching at every legal cooldown", () => {
    const duration = simulateCooldownLimitedManualRun(0, getManualTouchCooldownMs(0));

    expectReadableFirstCollapse(duration);
  });

  it("answers first-run touches with faint Care while Scourge pressure rises", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent, { seed: 4_004 });
    state.hp = 50;

    const result = touchFieldTile(state, permanent, 0);

    expect(result?.healedHp).toBeCloseTo(FIRST_RUN_MANUAL_CARE_PER_POWER);
    expect(state.hp).toBeCloseTo(50 + FIRST_RUN_MANUAL_CARE_PER_POWER);
    expect(state.scourgeDemandPerSecond).toBeGreaterThan(3);
    expect(state.scourgeDemandPerSecond).toBeLessThan(4);
    expect(state.careDeficitPerSecond).toBe(state.scourgeDemandPerSecond);
    expect(result?.dewGained).toBeGreaterThan(0);
    expect(result?.growthGained).toBe(0);
    expect(result?.runTouchesGained).toBeGreaterThan(0);
  });

  it("keeps Run 1 brutal even when prototype Memories were pre-unlocked", () => {
    const permanent = createPermanentEcosystemState();
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 5_005 });
    const result = touchFieldTile(state, permanent, 0);

    expect(result?.lingeringCarePerSecond).toBe(0);
    expect(state.lingeringCareRemainingMs).toBe(0);
    expect(result?.shieldGained).toBe(0);
    expect(state.overhealShield).toBe(0);
    expect(state.maxOverhealShield).toBe(0);
    expect(state.overhealShieldRemainingMs).toBe(0);

    while (state.active && state.elapsedMs < 30_000) advanceEcosystem(state, permanent, 250);

    expect(state.runNumber).toBe(1);
    expectReadableFirstCollapse(state.elapsedMs);
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
    expect(state.scourgeDemandPerSecond).toBeGreaterThan(3);
    expect(state.scourgeDemandPerSecond).toBeLessThan(4.5);
    expect(state.hp).toBeGreaterThan(98);
    expect(state.active).toBe(true);

    while (state.active && state.elapsedMs < 30_000) advanceEcosystem(state, permanent, 250);

    expectReadableFirstCollapse(state.elapsedMs);
    expect(state.hp).toBe(0);
    expect(state.active).toBe(false);
  });

  it("does not let debug-unlocked Memories eliminate Scourge pressure from an early run", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 7_007 });
    state.helpers.tinySprinkler.count = 1;

    touchFieldTile(state, permanent, 0);
    advanceEcosystem(state, permanent, 250);

    expect(state.scourgeDemandPerSecond).toBeGreaterThan(4);
    expect(state.hp + state.overhealShield).toBeLessThan(state.maxHp + state.maxOverhealShield);
    expect(state.hp).toBeGreaterThan(100);
  });

  it("does not grant free Scourge relief for repeated losses", () => {
    expect(simulateManualRun(12, 0)).toBeGreaterThanOrEqual(500);
    expect(simulateManualRun(12, 0)).toBeLessThanOrEqual(1_000);
  });

  it("turns the first collapse into a required Tiny Sprinkler memory", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent, { seed: 19 });
    const firstMemoryCost = getHelperUnlockCost("tinySprinkler");

    forceGameOver(state, permanent);

    expect(state.endedSummary?.grassTouchesAwarded).toBeGreaterThanOrEqual(firstMemoryCost);
    expect(isFirstEcosystemCollapse(state, permanent)).toBe(true);
    expect(isFirstCollapseAwaitingSprinkler(state, permanent)).toBe(true);
    expect(canBeginNextEcosystemRun(state, permanent)).toBe(false);

    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    expect(isFirstCollapseAwaitingSprinkler(state, permanent)).toBe(false);
    expect(canBeginNextEcosystemRun(state, permanent)).toBe(true);
  });

  it("keeps an unremembered Tiny Sprinkler save focused on the required first Memory", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 4;
    const state = createEcosystemState(permanent, { seed: 4_404 });

    forceGameOver(state, permanent);

    expect(isFirstEcosystemCollapse(state, permanent)).toBe(false);
    expect(isFirstCollapseAwaitingSprinkler(state, permanent)).toBe(false);
    expect(isFirstMemoryPending(state, permanent)).toBe(true);
    expect(canBeginNextEcosystemRun(state, permanent)).toBe(false);

    permanent.grassTouches = getHelperUnlockCost("tinySprinkler");
    expect(unlockHelper(permanent, "tinySprinkler")).toBe(true);
    expect(isFirstMemoryPending(state, permanent)).toBe(false);
    expect(canBeginNextEcosystemRun(state, permanent)).toBe(true);
  });

  it("keeps the second run threatening without overwhelming its opening", () => {
    const result = simulateFirstAutomationRunAtFullTouchRate();

    expect(result.initialScourgeDemandPerSecond).toBeGreaterThan(4.8);
    expect(result.initialScourgeDemandPerSecond).toBeLessThan(5.1);
    expect(result.sprinklerPurchasedAtMs).toBeGreaterThanOrEqual(3_500);
    expect(result.sprinklerPurchasedAtMs).toBeLessThanOrEqual(4_200);
    expect(result.hpAtPurchase).not.toBeNull();
    expect(result.hpAtPurchase!).toBeGreaterThanOrEqual(99);
    expect(result.durationMs).toBeGreaterThanOrEqual(100_000);
    expect(result.durationMs).toBeLessThanOrEqual(115_000);
    expect(result.durationMs - result.sprinklerPurchasedAtMs!).toBeGreaterThanOrEqual(95_000);
    expect(result.grassTouchesAwarded).toBeGreaterThanOrEqual(getHelperUnlockCost("fieldMouse"));
  });

  it("lets Scourge pressure build decisively after its dangerous opening", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.unlockedHelpers.tinySprinkler = true;
    const state = createEcosystemState(permanent, { seed: 9_012 });
    const openingDemand = state.scourgeDemandPerSecond;
    state.maxHp = 10_000;
    state.hp = 10_000;

    for (let elapsed = 0; elapsed < 30_000; elapsed += PRODUCTION_TICK_MS) {
      advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
    }

    expect(state.scourgeDemandPerSecond).toBeGreaterThan(openingDemand * 1.75);
    expect(state.scourgeDemandPerSecond).toBeLessThan(openingDemand * 1.85);
  });

  it("reaches the first Field Mouse planting through clean early-run play", () => {
    const result = simulateFirstFieldMouseChapterAtFullTouchRate();

    expect(result.sprinklerPurchasedAtMs).not.toBeNull();
    expect(result.mousePurchasedAtMs).not.toBeNull();
    expect(result.mousePurchasedAtMs!).toBeGreaterThanOrEqual(14_000);
    expect(result.mousePurchasedAtMs!).toBeLessThanOrEqual(20_000);
    expect(result.firstMouseCycleAtMs).not.toBeNull();
    expect(result.firstMouseCycleAtMs!).toBeGreaterThanOrEqual(17_000);
    expect(result.firstMouseCycleAtMs!).toBeLessThanOrEqual(23_000);
    expect(result.hpAtFirstMouseCycle).not.toBeNull();
    expect(result.hpAtFirstMouseCycle!).toBeGreaterThan(0);
  });

  it("lets an early Sprinkler and Mouse setup carry a real hands-off window", () => {
    const result = simulateEarlyAutomationTakeover();

    expect(result.setupAtMs).not.toBeNull();
    expect(result.setupAtMs!).toBeLessThanOrEqual(30_000);
    expect(result.handsOffMs).toBe(60_000);
    expect(result.hpAtSetup).not.toBeNull();
    expect(result.hpAfterHandsOff).toBeGreaterThan(result.hpAtSetup! - 70);
    expect(result.hpAfterHandsOff).toBeLessThan(result.hpAtSetup! - 48);
    expect(result.careProduced).toBeGreaterThan(75);
    expect(result.mouseCycles).toBeGreaterThan(1);
  });

  it("lets a developed production web reach a sustained thriving state", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 20;
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, {
      seed: 20_026,
      fieldSizeIndex: FIELD_SIZE_LADDER.length - 1,
    });
    for (const helperId of HELPER_IDS) state.helpers[helperId].count = 2;
    state.helpers.beeHive.modeId = "honeyReserve";
    state.helpers.earthwormCrew.modeId = "triage";
    for (const resourceId of PRODUCTION_RESOURCE_IDS) {
      state.resources[resourceId].amount = state.resources[resourceId].capacity * 0.75;
    }
    state.hp = 75;
    let careSurplusTicks = 0;

    for (let step = 0; step < 2_400 && state.active; step += 1) {
      advanceEcosystem(state, permanent, PRODUCTION_TICK_MS);
      if (state.rates.care > state.scourgeDemandPerSecond) careSurplusTicks += 1;
    }
    expect(state.active).toBe(true);
    expect(state.hp).toBeGreaterThan(100);
    expect(state.hp).toBeLessThanOrEqual(state.maxHp);
    expect(careSurplusTicks).toBeGreaterThan(150);
    expect(state.resources.care.producedTotal).toBeGreaterThan(1_200);
    expect(state.resources.care.amount).toBeGreaterThan(1_000);
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
