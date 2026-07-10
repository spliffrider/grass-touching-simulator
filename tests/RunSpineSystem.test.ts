import { describe, expect, it } from "vitest";

import {
  applyTinySprinklerPulse,
  advanceRun,
  buyTinySprinkler,
  createNextRunFromDormancy,
  createPermanentMemorySnapshot,
  createRunSpineState,
  EFFECTIVE_HEALING_PER_PERMANENT_TOUCH,
  getDormancyGrassTouches,
  getDormancySummary,
  getMissingPermanentUpgradePrerequisites,
  getPermanentUpgradeEffects,
  getWoundedRootCount,
  hasPermanentUpgrade,
  isRootWounded,
  openRootWound,
  purchasePermanentUpgrade,
  normalizePermanentMemorySnapshot,
  POCKET_SUNSHINE_RUN_TOUCH_COST,
  spendRunTouches,
  touchAncientGrass,
  touchAncientGrassRoot,
  useDewPulse,
  usePocketSunshine,
  useRootSalve,
} from "../src/game/redesign/RunSpineSystem";

describe("RunSpineSystem", () => {
  it("drains Ancient Grass HP through Scourge pressure and enters dormancy at zero", () => {
    const state = createRunSpineState({
      currentHp: 2,
      baseDrainPerSecond: 1,
      pressure: 1,
      pressureGrowthPerSecond: 0,
    });

    const result = advanceRun(state, 3_000);

    expect(result.drained).toBe(2);
    expect(result.lastStandTriggered).toBe(false);
    expect(result.becameDormant).toBe(true);
    expect(state.ancientGrass.currentHp).toBe(0);
    expect(state.phase).toBe("dormant");
  });

  it("supports a temporary drain multiplier without slowing run time", () => {
    const state = createRunSpineState({
      currentHp: 100,
      baseDrainPerSecond: 10,
      pressure: 1,
      pressureGrowthPerSecond: 0,
    });

    const result = advanceRun(state, 1_000, { drainMultiplier: 0.5 });

    expect(result.drained).toBe(5);
    expect(state.ancientGrass.currentHp).toBe(95);
    expect(state.elapsedMs).toBe(1_000);
  });

  it("reduces base Scourge drain with Ancient Resilience", () => {
    const state = createRunSpineState({
      currentHp: 100,
      baseDrainPerSecond: 10,
      pressure: 1,
      pressureGrowthPerSecond: 0,
      permanentUpgrades: ["ancientResilience"],
    });

    const result = advanceRun(state, 1_000);

    expect(result.drained).toBeCloseTo(8.8);
    expect(state.ancientGrass.currentHp).toBeCloseTo(91.2);
  });

  it("reduces the added pressure from open wounds with Distributed Roots", () => {
    const state = createRunSpineState({
      currentHp: 100,
      baseDrainPerSecond: 10,
      pressure: 1,
      pressureGrowthPerSecond: 0,
      permanentUpgrades: ["distributedRoots"],
    });
    openRootWound(state, 4, 2);

    const result = advanceRun(state, 1_000);

    expect(result.drained).toBeCloseTo(11.2);
    expect(state.ancientGrass.currentHp).toBeCloseTo(88.8);
  });

  it("uses Last Stand once before the run can enter dormancy", () => {
    const state = createRunSpineState({
      currentHp: 80,
      maxHp: 100,
      baseDrainPerSecond: 100,
      pressureGrowthPerSecond: 0,
      permanentUpgrades: ["lastStand"],
    });

    touchAncientGrass(state, 20);
    const revived = advanceRun(state, 1_000);
    const collapsed = advanceRun(state, 1_000);
    const nextRun = createNextRunFromDormancy(state, { currentHp: 70 });

    expect(revived.lastStandTriggered).toBe(true);
    expect(revived.becameDormant).toBe(false);
    expect(revived.drained).toBe(100);
    expect(state.revivals.lastStandUsed).toBe(true);
    expect(revived.currentHp).toBe(35);
    expect(collapsed.lastStandTriggered).toBe(false);
    expect(collapsed.becameDormant).toBe(true);
    expect(state.phase).toBe("dormant");
    expect(state.economy.permanentGrassTouches).toBe(4);
    expect(nextRun.revivals.lastStandUsed).toBe(false);
    expect(hasPermanentUpgrade(nextRun, "lastStand")).toBe(true);
  });

  it("improves the Last Stand revival with Emergency Photosynthesis", () => {
    const state = createRunSpineState({
      currentHp: 100,
      maxHp: 100,
      baseDrainPerSecond: 100,
      pressureGrowthPerSecond: 0,
      permanentUpgrades: ["lastStand", "emergencyPhotosynthesis"],
    });

    const result = advanceRun(state, 1_000);

    expect(result.lastStandTriggered).toBe(true);
    expect(result.currentHp).toBeCloseTo(55);
    expect(state.phase).toBe("active");
  });

  it("turns only effective healing into Run Touches", () => {
    const state = createRunSpineState({ currentHp: 94, maxHp: 100 });

    const result = touchAncientGrass(state, 10);

    expect(result.effectiveHealing).toBe(6);
    expect(result.overheal).toBe(4);
    expect(result.runTouchesGained).toBe(6);
    expect(state.economy.runTouches).toBe(6);
    expect(state.ancientGrass.effectiveHealingThisRun).toBe(6);
    expect(state.ancientGrass.overhealThisRun).toBe(4);
  });

  it("does not reward pure overheal", () => {
    const state = createRunSpineState({ currentHp: 100, maxHp: 100 });

    const result = touchAncientGrass(state, 5);

    expect(result.effectiveHealing).toBe(0);
    expect(result.overheal).toBe(5);
    expect(result.runTouchesGained).toBe(0);
    expect(state.economy.runTouches).toBe(0);
  });

  it("keeps permanent payout tied to healing, not unspent Run Touches", () => {
    const state = createRunSpineState({ currentHp: 80, maxHp: 100 });

    touchAncientGrass(state, 12);
    spendRunTouches(state, 8);

    expect(state.economy.runTouches).toBe(4);
    expect(getDormancyGrassTouches(state)).toBe(2);
  });

  it("uses the published dormancy conversion rate", () => {
    const state = createRunSpineState({ currentHp: 70, maxHp: 100 });

    touchAncientGrass(state, EFFECTIVE_HEALING_PER_PERMANENT_TOUCH * 3 + 0.9);

    expect(EFFECTIVE_HEALING_PER_PERMANENT_TOUCH).toBe(5);
    expect(getDormancyGrassTouches(state)).toBe(3);
  });

  it("summarizes dormancy and starts the next run with only permanent memory preserved", () => {
    const state = createRunSpineState({
      currentHp: 80,
      maxHp: 100,
      baseDrainPerSecond: 10,
      pressureGrowthPerSecond: 0,
      permanentGrassTouches: 5,
    });

    touchAncientGrass(state, 12);
    spendRunTouches(state, 3);
    advanceRun(state, 10_000);

    const summary = getDormancySummary(state);
    const nextRun = createNextRunFromDormancy(state, { currentHp: 70 });

    expect(state.phase).toBe("dormant");
    expect(summary.permanentGrassTouchesEarned).toBe(2);
    expect(summary.totalPermanentGrassTouches).toBe(7);
    expect(summary.unspentRunTouches).toBe(9);
    expect(nextRun.phase).toBe("active");
    expect(nextRun.ancientGrass.currentHp).toBe(70);
    expect(nextRun.ancientGrass.effectiveHealingThisRun).toBe(0);
    expect(nextRun.economy.runTouches).toBe(0);
    expect(nextRun.economy.permanentGrassTouches).toBe(7);
  });

  it("opens Scourge wounds on roots and clears them when the wounded root is touched", () => {
    const state = createRunSpineState({ currentHp: 80, maxHp: 100 });

    const opened = openRootWound(state, 25, 7);
    const touch = touchAncientGrassRoot(state, 5, 7);

    expect(opened.openedRootId).toBe(7);
    expect(isRootWounded(state, 7)).toBe(false);
    expect(touch.healedWound).toBe(true);
    expect(state.wounds.totalWoundsOpened).toBe(1);
    expect(state.wounds.totalWoundsHealed).toBe(1);
    expect(getWoundedRootCount(state)).toBe(0);
  });

  it("keeps wound accounting in the dormancy summary", () => {
    const state = createRunSpineState({ currentHp: 5, maxHp: 100, baseDrainPerSecond: 10, pressureGrowthPerSecond: 0 });

    openRootWound(state, 25, 3);
    openRootWound(state, 25, 9);
    touchAncientGrassRoot(state, 4, 3);
    advanceRun(state, 2_000);

    const summary = getDormancySummary(state);

    expect(state.phase).toBe("dormant");
    expect(summary.woundsOpened).toBe(2);
    expect(summary.woundsHealed).toBe(1);
    expect(getWoundedRootCount(state)).toBe(1);
  });

  it("requires wounds and enough Run Touches before Root Salve can be used", () => {
    const noWounds = createRunSpineState({ currentHp: 80, maxHp: 100 });
    noWounds.economy.runTouches = 20;

    const noWoundResult = useRootSalve(noWounds);

    expect(noWoundResult.used).toBe(false);
    expect(noWoundResult.reason).toBe("no-wounded-roots");
    expect(noWounds.economy.runTouches).toBe(20);

    const tooPoor = createRunSpineState({ currentHp: 80, maxHp: 100 });
    openRootWound(tooPoor, 25, 4);

    const poorResult = useRootSalve(tooPoor);

    expect(poorResult.used).toBe(false);
    expect(poorResult.reason).toBe("not-enough-run-touches");
    expect(isRootWounded(tooPoor, 4)).toBe(true);
  });

  it("spends Run Touches to clear a wound and heal Ancient Grass with Root Salve", () => {
    const state = createRunSpineState({ currentHp: 72, maxHp: 100 });
    state.economy.runTouches = 15;
    openRootWound(state, 25, 8);

    const result = useRootSalve(state);

    expect(result.used).toBe(true);
    expect(result.spent).toBe(12);
    expect(result.remainingRunTouches).toBe(3);
    expect(result.healedRootId).toBe(8);
    expect(result.effectiveHealing).toBe(10);
    expect(state.ancientGrass.currentHp).toBe(82);
    expect(state.ancientGrass.effectiveHealingThisRun).toBe(10);
    expect(isRootWounded(state, 8)).toBe(false);
    expect(state.wounds.totalWoundsHealed).toBe(1);
  });

  it("does not reduce existing permanent payout when Root Salve spends Run Touches", () => {
    const state = createRunSpineState({ currentHp: 80, maxHp: 100 });
    touchAncientGrass(state, 20);
    openRootWound(state, 25, 2);

    const result = useRootSalve(state);

    expect(result.used).toBe(true);
    expect(result.overheal).toBe(10);
    expect(state.economy.runTouches).toBe(8);
    expect(getDormancyGrassTouches(state)).toBe(4);
  });

  it("requires missing HP and enough Run Touches before Dew Pulse can be used", () => {
    const fullHp = createRunSpineState({ currentHp: 100, maxHp: 100 });
    fullHp.economy.runTouches = 20;

    const fullHpResult = useDewPulse(fullHp);

    expect(fullHpResult.used).toBe(false);
    expect(fullHpResult.reason).toBe("no-missing-hp");
    expect(fullHp.economy.runTouches).toBe(20);

    const tooPoor = createRunSpineState({ currentHp: 80, maxHp: 100 });

    const poorResult = useDewPulse(tooPoor);

    expect(poorResult.used).toBe(false);
    expect(poorResult.reason).toBe("not-enough-run-touches");
    expect(tooPoor.ancientGrass.currentHp).toBe(80);
  });

  it("spends Run Touches to heal Ancient Grass with Dew Pulse without refunding Run Touches", () => {
    const state = createRunSpineState({ currentHp: 88, maxHp: 100 });
    state.economy.runTouches = 24;

    const result = useDewPulse(state);

    expect(result.used).toBe(true);
    expect(result.spent).toBe(22);
    expect(result.remainingRunTouches).toBe(2);
    expect(result.effectiveHealing).toBe(10);
    expect(result.overheal).toBe(0);
    expect(state.ancientGrass.currentHp).toBe(98);
    expect(state.ancientGrass.effectiveHealingThisRun).toBe(10);
    expect(state.ancientGrass.overhealThisRun).toBe(0);
    expect(state.economy.runTouches).toBe(2);
    expect(state.economy.totalRunTouchesEarned).toBe(0);
  });

  it("does not reduce existing permanent payout when Dew Pulse spends Run Touches", () => {
    const state = createRunSpineState({ currentHp: 60, maxHp: 100 });
    touchAncientGrass(state, 30);

    const result = useDewPulse(state);

    expect(result.used).toBe(true);
    expect(state.economy.runTouches).toBe(8);
    expect(getDormancyGrassTouches(state)).toBe(8);
  });

  it("requires Field Satchel, enough RT, and meaningful pressure before using Pocket Sunshine", () => {
    const noSatchel = createRunSpineState({ pressure: 1.8 });
    noSatchel.economy.runTouches = POCKET_SUNSHINE_RUN_TOUCH_COST;
    expect(usePocketSunshine(noSatchel).reason).toBe("field-satchel-missing");

    const tooPoor = createRunSpineState({
      pressure: 1.8,
      permanentUpgrades: ["fieldSatchel"],
    });
    tooPoor.economy.runTouches = POCKET_SUNSHINE_RUN_TOUCH_COST - 1;
    expect(usePocketSunshine(tooPoor).reason).toBe("not-enough-run-touches");

    const calm = createRunSpineState({
      pressure: 1.19,
      permanentUpgrades: ["fieldSatchel"],
    });
    calm.economy.runTouches = POCKET_SUNSHINE_RUN_TOUCH_COST;
    expect(usePocketSunshine(calm).reason).toBe("pressure-low");
    expect(calm.economy.runTouches).toBe(POCKET_SUNSHINE_RUN_TOUCH_COST);
  });

  it("spends RT to push Scourge pressure back without healing or minting payout", () => {
    const state = createRunSpineState({
      currentHp: 70,
      maxHp: 100,
      pressure: 1.8,
      permanentUpgrades: ["fieldSatchel"],
    });
    state.economy.runTouches = 40;

    const result = usePocketSunshine(state);

    expect(result.used).toBe(true);
    expect(result.spent).toBe(28);
    expect(result.remainingRunTouches).toBe(12);
    expect(result.pressureReduced).toBeCloseTo(0.35);
    expect(result.currentPressure).toBeCloseTo(1.45);
    expect(state.scourge.pressure).toBeCloseTo(1.45);
    expect(state.ancientGrass.currentHp).toBe(70);
    expect(state.ancientGrass.effectiveHealingThisRun).toBe(0);
    expect(getDormancyGrassTouches(state)).toBe(0);
  });

  it("requires the Tiny Sprinkler license and Run Touches before buying automation", () => {
    const unlicensed = createRunSpineState({ currentHp: 80, maxHp: 100 });
    unlicensed.economy.runTouches = 40;

    const missingLicense = buyTinySprinkler(unlicensed);

    expect(missingLicense.bought).toBe(false);
    expect(missingLicense.reason).toBe("license-missing");
    expect(unlicensed.automation.tinySprinklers).toBe(0);

    const licensed = createRunSpineState({
      currentHp: 80,
      maxHp: 100,
      permanentUpgrades: ["tinySprinkler"],
    });
    licensed.economy.runTouches = 15;

    const tooPoor = buyTinySprinkler(licensed);

    expect(tooPoor.bought).toBe(false);
    expect(tooPoor.reason).toBe("not-enough-run-touches");
    expect(licensed.automation.tinySprinklers).toBe(0);
  });

  it("buys Tiny Sprinkler automation for the current run only", () => {
    const state = createRunSpineState({
      currentHp: 80,
      maxHp: 100,
      permanentUpgrades: ["tinySprinkler"],
    });
    state.economy.runTouches = 20;

    const bought = buyTinySprinkler(state);
    const nextRun = createNextRunFromDormancy(state, { currentHp: 80 });

    expect(bought.bought).toBe(true);
    expect(bought.spent).toBe(16);
    expect(bought.remainingRunTouches).toBe(4);
    expect(bought.tinySprinklers).toBe(1);
    expect(state.automation.tinySprinklers).toBe(1);
    expect(nextRun.automation.tinySprinklers).toBe(0);
    expect(hasPermanentUpgrade(nextRun, "tinySprinkler")).toBe(true);
  });

  it("lets Tiny Sprinkler pulses restore HP, earn Run Touches, and heal one wound", () => {
    const state = createRunSpineState({
      currentHp: 90,
      maxHp: 100,
      permanentUpgrades: ["tinySprinkler"],
    });
    state.economy.runTouches = 20;
    buyTinySprinkler(state);
    openRootWound(state, 25, 4);

    const result = applyTinySprinklerPulse(state, 4);

    expect(result.applied).toBe(true);
    expect(result.effectiveHealing).toBe(2);
    expect(result.runTouchesGained).toBe(2);
    expect(result.healedWound).toBe(true);
    expect(state.ancientGrass.currentHp).toBe(92);
    expect(state.ancientGrass.effectiveHealingThisRun).toBe(2);
    expect(state.economy.runTouches).toBe(6);
    expect(state.economy.totalRunTouchesEarned).toBe(2);
    expect(isRootWounded(state, 4)).toBe(false);
  });

  it("adds one HP to each Tiny Sprinkler pulse with Sprinkler Tuning", () => {
    const state = createRunSpineState({
      currentHp: 90,
      maxHp: 100,
      permanentUpgrades: ["tinySprinkler", "sprinklerTuning"],
    });
    state.economy.runTouches = 20;
    buyTinySprinkler(state);

    const result = applyTinySprinklerPulse(state);

    expect(result.applied).toBe(true);
    expect(result.healing).toBe(3);
    expect(result.effectiveHealing).toBe(3);
    expect(result.runTouchesGained).toBe(3);
    expect(state.ancientGrass.currentHp).toBe(93);
  });

  it("does not let Tiny Sprinkler mint rewards from full HP", () => {
    const state = createRunSpineState({
      currentHp: 100,
      maxHp: 100,
      permanentUpgrades: ["tinySprinkler"],
    });
    state.economy.runTouches = 20;
    buyTinySprinkler(state);

    const result = applyTinySprinklerPulse(state);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no-missing-hp");
    expect(state.economy.runTouches).toBe(4);
    expect(state.economy.totalRunTouchesEarned).toBe(0);
    expect(getDormancyGrassTouches(state)).toBe(0);
  });

  it("spends banked permanent Grass Touches on a permanent upgrade once", () => {
    const state = createRunSpineState({ currentHp: 0, permanentGrassTouches: 14 });

    const bought = purchasePermanentUpgrade(state, "softTouch");
    const duplicate = purchasePermanentUpgrade(state, "softTouch");

    expect(bought.purchased).toBe(true);
    expect(bought.remainingGrassTouches).toBe(2);
    expect(hasPermanentUpgrade(state, "softTouch")).toBe(true);
    expect(duplicate.purchased).toBe(false);
    expect(duplicate.reason).toBe("already-owned");
    expect(state.economy.permanentGrassTouches).toBe(2);
  });

  it("requires connected memories before buying deeper permanent upgrades", () => {
    const state = createRunSpineState({ currentHp: 0, permanentGrassTouches: 100 });

    const blockedDeeperRoots = purchasePermanentUpgrade(state, "deeperRoots");
    purchasePermanentUpgrade(state, "softTouch");
    const boughtDeeperRoots = purchasePermanentUpgrade(state, "deeperRoots");
    const blockedLastStand = purchasePermanentUpgrade(state, "lastStand");

    expect(blockedDeeperRoots.purchased).toBe(false);
    expect(blockedDeeperRoots.reason).toBe("prerequisites-missing");
    expect(blockedDeeperRoots.missingPrerequisiteIds).toEqual(["softTouch"]);
    expect(blockedDeeperRoots.remainingGrassTouches).toBe(100);
    expect(boughtDeeperRoots.purchased).toBe(true);
    expect(getMissingPermanentUpgradePrerequisites(state, "lastStand")).toEqual(["tinySprinkler", "scourgeSense"]);
    expect(blockedLastStand.reason).toBe("prerequisites-missing");
    expect(state.economy.permanentGrassTouches).toBe(70);
  });

  it("requires each second-tier memory to follow its first-tier branch", () => {
    const state = createRunSpineState({ currentHp: 0, permanentGrassTouches: 300 });

    expect(purchasePermanentUpgrade(state, "fastTouch").missingPrerequisiteIds).toEqual(["softTouch"]);
    expect(purchasePermanentUpgrade(state, "ancientResilience").missingPrerequisiteIds).toEqual(["deeperRoots"]);
    expect(purchasePermanentUpgrade(state, "sprinklerTuning").missingPrerequisiteIds).toEqual(["tinySprinkler"]);
    expect(purchasePermanentUpgrade(state, "fieldSatchel").missingPrerequisiteIds).toEqual(["tinySprinkler"]);
    expect(purchasePermanentUpgrade(state, "distributedRoots").missingPrerequisiteIds).toEqual(["scourgeSense"]);
    expect(purchasePermanentUpgrade(state, "emergencyPhotosynthesis").missingPrerequisiteIds).toEqual(["lastStand"]);
  });

  it("carries permanent upgrade effects into the next run", () => {
    const state = createRunSpineState({ currentHp: 0, permanentGrassTouches: 40 });

    purchasePermanentUpgrade(state, "softTouch");
    purchasePermanentUpgrade(state, "deeperRoots");
    const nextRun = createNextRunFromDormancy(state, { currentHp: 125 });

    expect(getPermanentUpgradeEffects(nextRun)).toEqual({
      manualHealingMultiplier: 1.25,
      manualRecoveryDurationMultiplier: 1,
      maxHpBonus: 25,
      baseScourgeDrainMultiplier: 1,
      woundPressureMultiplier: 1,
      tinySprinklerHealingBonus: 0,
      runToolSlotBonus: 0,
      scourgeSense: false,
      lastStand: false,
      lastStandReviveHpRatio: 0.35,
    });
    expect(nextRun.ancientGrass.maxHp).toBe(125);
    expect(nextRun.ancientGrass.currentHp).toBe(125);
    expect(nextRun.economy.permanentGrassTouches).toBe(10);
  });

  it("reports the full second-tier effect set without mutating run state", () => {
    expect(
      getPermanentUpgradeEffects([
        "fastTouch",
        "ancientResilience",
        "sprinklerTuning",
        "fieldSatchel",
        "distributedRoots",
        "emergencyPhotosynthesis",
      ]),
    ).toEqual({
      manualHealingMultiplier: 1,
      manualRecoveryDurationMultiplier: 0.8,
      maxHpBonus: 0,
      baseScourgeDrainMultiplier: 0.88,
      woundPressureMultiplier: 0.75,
      tinySprinklerHealingBonus: 1,
      runToolSlotBonus: 3,
      scourgeSense: false,
      lastStand: false,
      lastStandReviveHpRatio: 0.55,
    });
  });

  it("serializes only permanent memory into the redesign save snapshot", () => {
    const state = createRunSpineState({ currentHp: 80, permanentGrassTouches: 330 });
    state.economy.runTouches = 123;

    purchasePermanentUpgrade(state, "softTouch");
    purchasePermanentUpgrade(state, "fastTouch");
    purchasePermanentUpgrade(state, "deeperRoots");
    purchasePermanentUpgrade(state, "ancientResilience");
    purchasePermanentUpgrade(state, "tinySprinkler");
    purchasePermanentUpgrade(state, "sprinklerTuning");
    purchasePermanentUpgrade(state, "fieldSatchel");
    purchasePermanentUpgrade(state, "scourgeSense");
    purchasePermanentUpgrade(state, "distributedRoots");
    purchasePermanentUpgrade(state, "lastStand");
    purchasePermanentUpgrade(state, "emergencyPhotosynthesis");
    const snapshot = createPermanentMemorySnapshot(state, 42);

    expect(snapshot).toEqual({
      saveVersion: 1,
      permanentGrassTouches: 44,
      permanentUpgrades: [
        "ancientResilience",
        "deeperRoots",
        "distributedRoots",
        "emergencyPhotosynthesis",
        "fastTouch",
        "fieldSatchel",
        "lastStand",
        "scourgeSense",
        "softTouch",
        "sprinklerTuning",
        "tinySprinkler",
      ],
      savedAt: 42,
    });
  });

  it("normalizes redesign memory saves and rejects incompatible versions", () => {
    const normalized = normalizePermanentMemorySnapshot({
      saveVersion: 1,
      permanentGrassTouches: 12.8,
      permanentUpgrades: ["deeperRoots", "bogus", "softTouch", "scourgeSense", "lastStand", "softTouch"],
      savedAt: 99.9,
    });

    expect(normalized).toEqual({
      saveVersion: 1,
      permanentGrassTouches: 12,
      permanentUpgrades: ["deeperRoots", "lastStand", "scourgeSense", "softTouch"],
      savedAt: 99,
    });
    expect(normalizePermanentMemorySnapshot({ saveVersion: 0, permanentGrassTouches: 999 })).toBeUndefined();
    expect(normalizePermanentMemorySnapshot(null)).toBeUndefined();
  });
});
