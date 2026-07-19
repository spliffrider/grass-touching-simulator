import { describe, expect, it } from "vitest";

import {
  HELPER_IDS,
  HELPER_RECONFIGURE_MS,
  FIELD_SIZE_LADDER,
  PRODUCTION_RESOURCE_IDS,
  PRODUCTION_TICK_MS,
} from "../src/game/ecosystem/EcosystemCatalog";
import { getManualTouchCooldownMs } from "../src/game/ecosystem/EcosystemTouchCooldown";
import {
  BEE_HIVE_STARTER_FLOWERS,
  FIELD_MOUSE_STARTER_SEEDS,
  advanceEcosystem,
  buyCultivationRank,
  buyHelper,
  canBeginNextEcosystemRun,
  consumeHelperPulses,
  createEcosystemState,
  createPermanentEcosystemState,
  forceGameOver,
  getBroadPalmPower,
  getBroadPalmRadius,
  getBeeHiveStatus,
  getFirstAutomationStatus,
  getFieldMouseStatus,
  getManyHandsPower,
  getHelperCycleIntervalMs,
  getHelperPurchaseCost,
  getHelperStorageResourceIds,
  getHelperUnlockCost,
  getManualTouchPowerBonusPercent,
  getManualTouchPowerMultiplier,
  getPermanentMemoryInvestmentCount,
  getTouchRankCost,
  isFirstCollapseAwaitingSprinkler,
  isFirstEcosystemCollapse,
  isFirstMemoryPending,
  isRunEquipmentAvailable,
  normalizePermanentEcosystemState,
  purchasePermanentRank,
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

    while (state.active && wallElapsedMs < 120_000) {
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
    expect(getBroadPalmPower(1)).toBeCloseTo(0.4);
    expect(getBroadPalmPower(10)).toBeCloseTo(1);
    expect(getManyHandsPower(1)).toBeCloseTo(0.35);
    expect(getManyHandsPower(10)).toBeCloseTo(0.8);
  });

  it("turns helper speed ranks into shorter, measurable action cooldowns", () => {
    const baseInterval = getHelperCycleIntervalMs("tinySprinkler", 0);
    const firstRankInterval = getHelperCycleIntervalMs("tinySprinkler", 1);
    const maxRankInterval = getHelperCycleIntervalMs("tinySprinkler", 10);

    expect(baseInterval).toBeCloseTo(2_941.176, 2);
    expect(firstRankInterval).toBeLessThan(baseInterval);
    expect(maxRankInterval).toBeLessThan(firstRankInterval);
    expect(maxRankInterval).toBeCloseTo(1_336.898, 2);
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
    expect(getManualTouchPowerBonusPercent(permanent)).toBe(5);
    expect(getManualTouchPowerMultiplier(permanent)).toBeCloseTo(1.05);

    const state = createEcosystemState(permanent, { seed: 3_141 });
    state.hp = 50;
    const result = touchFieldTile(state, permanent, 0);

    expect(result?.totalPower).toBeCloseTo(1.05);
    expect(result?.healedHp).toBeCloseTo(5.46);
    expect(result?.dewGained).toBeCloseTo(1.2075);
    expect(result?.runTouchesGained).toBeCloseTo(0.966);
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
    expect(firstRankCost).toBe(9);
    expect(purchaseTouchRank(legacy, "fastTouch")).toBe(true);
    expect(legacy.fastTouchRank).toBe(1);
    expect(legacy.grassTouches).toBe(0);
    expect(getManualTouchCooldownMs(legacy.fastTouchRank)).toBe(356);
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

  it("answers the first touch with a near-fatal Scourge strike instead of healing", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent, { seed: 4_004 });
    state.hp = 50;

    const result = touchFieldTile(state, permanent, 0);

    expect(result?.healedHp).toBe(0);
    expect(state.hp).toBe(1);
    expect(state.scourgeDemandPerSecond).toBe(10_000_000);
    expect(state.careDeficitPerSecond).toBe(10_000_000);
    expect(result?.dewGained).toBeGreaterThan(0);
    expect(result?.runTouchesGained).toBeGreaterThan(0);
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
    expect(state.scourgeDemandPerSecond).toBeGreaterThan(50_000_000);
    expect(state.hp).toBe(0);
    expect(state.active).toBe(false);
  });

  it("does not let debug-unlocked Memories soften an unequipped early run", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 7_007 });
    state.helpers.tinySprinkler.count = 1;

    touchFieldTile(state, permanent, 0);
    advanceEcosystem(state, permanent, 250);

    expect(state.scourgeDemandPerSecond).toBeGreaterThan(4);
    expect(state.hp).toBeLessThan(100);
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

    expect(result.initialScourgeDemandPerSecond).toBeGreaterThan(6.5);
    expect(result.initialScourgeDemandPerSecond).toBeLessThan(7);
    expect(result.sprinklerPurchasedAtMs).toBeGreaterThanOrEqual(5_500);
    expect(result.sprinklerPurchasedAtMs).toBeLessThanOrEqual(6_000);
    expect(result.hpAtPurchase).not.toBeNull();
    expect(result.hpAtPurchase!).toBeGreaterThanOrEqual(95);
    expect(result.durationMs).toBeGreaterThanOrEqual(30_000);
    expect(result.durationMs).toBeLessThanOrEqual(45_000);
    expect(result.durationMs - result.sprinklerPurchasedAtMs!).toBeGreaterThanOrEqual(25_000);
    expect(result.grassTouchesAwarded).toBeGreaterThanOrEqual(getHelperUnlockCost("fieldMouse"));
  });

  it("reaches the first Field Mouse planting through clean early-run play", () => {
    const result = simulateFirstFieldMouseChapterAtFullTouchRate();

    expect(result.sprinklerPurchasedAtMs).not.toBeNull();
    expect(result.mousePurchasedAtMs).not.toBeNull();
    expect(result.mousePurchasedAtMs!).toBeGreaterThanOrEqual(20_000);
    expect(result.mousePurchasedAtMs!).toBeLessThanOrEqual(30_000);
    expect(result.firstMouseCycleAtMs).not.toBeNull();
    expect(result.firstMouseCycleAtMs!).toBeGreaterThanOrEqual(25_000);
    expect(result.firstMouseCycleAtMs!).toBeLessThanOrEqual(35_000);
    expect(result.hpAtFirstMouseCycle).not.toBeNull();
    expect(result.hpAtFirstMouseCycle!).toBeGreaterThan(0);
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
    expect(state.hp).toBe(100);
    expect(careSurplusTicks).toBeGreaterThan(1_000);
    expect(state.resources.care.producedTotal).toBeGreaterThan(800);
    expect(state.resources.care.amount).toBeGreaterThan(200);
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
