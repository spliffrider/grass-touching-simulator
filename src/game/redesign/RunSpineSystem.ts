export type RunPhase = "active" | "dormant";
export type PermanentUpgradeId = "softTouch" | "deeperRoots" | "tinySprinkler" | "scourgeSense" | "lastStand";

export interface PermanentUpgradeDefinition {
  id: PermanentUpgradeId;
  name: string;
  cost: number;
  description: string;
}

export interface AncientGrassVitals {
  currentHp: number;
  maxHp: number;
  effectiveHealingThisRun: number;
  overhealThisRun: number;
}

export interface ScourgeState {
  pressure: number;
  baseDrainPerSecond: number;
  pressureGrowthPerSecond: number;
}

export interface RunEconomyState {
  runTouches: number;
  totalRunTouchesEarned: number;
  permanentGrassTouches: number;
}

export interface RootWoundState {
  woundedRootIds: number[];
  totalWoundsOpened: number;
  totalWoundsHealed: number;
}

export interface AutomationState {
  tinySprinklers: number;
}

export interface RevivalState {
  lastStandUsed: boolean;
}

export interface RunSpineState {
  phase: RunPhase;
  elapsedMs: number;
  ancientGrass: AncientGrassVitals;
  scourge: ScourgeState;
  economy: RunEconomyState;
  wounds: RootWoundState;
  automation: AutomationState;
  revivals: RevivalState;
  permanentUpgrades: PermanentUpgradeId[];
}

export interface RunSpineOptions {
  maxHp?: number;
  currentHp?: number;
  baseDrainPerSecond?: number;
  pressure?: number;
  pressureGrowthPerSecond?: number;
  permanentGrassTouches?: number;
  permanentUpgrades?: PermanentUpgradeId[];
}

export interface RunTickResult {
  previousHp: number;
  currentHp: number;
  drained: number;
  previousPressure: number;
  currentPressure: number;
  lastStandTriggered: boolean;
  becameDormant: boolean;
}

export interface TouchAncientGrassResult {
  previousHp: number;
  currentHp: number;
  healing: number;
  effectiveHealing: number;
  overheal: number;
  runTouchesGained: number;
  healedWound: boolean;
}

export interface SpendRunTouchesResult {
  requested: number;
  spent: number;
  remaining: number;
}

export interface UseRootSalveResult {
  used: boolean;
  reason?: "dormant" | "no-wounded-roots" | "not-enough-run-touches";
  cost: number;
  spent: number;
  remainingRunTouches: number;
  healedRootId?: number;
  previousHp: number;
  currentHp: number;
  healing: number;
  effectiveHealing: number;
  overheal: number;
}

export interface UseDewPulseResult {
  used: boolean;
  reason?: "dormant" | "not-enough-run-touches" | "no-missing-hp";
  cost: number;
  spent: number;
  remainingRunTouches: number;
  previousHp: number;
  currentHp: number;
  healing: number;
  effectiveHealing: number;
  overheal: number;
}

export interface BuyTinySprinklerResult {
  bought: boolean;
  reason?: "dormant" | "license-missing" | "not-enough-run-touches";
  cost: number;
  spent: number;
  remainingRunTouches: number;
  tinySprinklers: number;
}

export interface ApplyTinySprinklerPulseResult {
  applied: boolean;
  reason?: "dormant" | "no-sprinklers" | "no-missing-hp";
  previousHp: number;
  currentHp: number;
  healing: number;
  effectiveHealing: number;
  overheal: number;
  runTouchesGained: number;
  healedWound: boolean;
}

export interface PurchasePermanentUpgradeResult {
  upgrade: PermanentUpgradeDefinition;
  purchased: boolean;
  reason?: "already-owned" | "not-enough-grass-touches";
  remainingGrassTouches: number;
}

export interface PermanentUpgradeEffects {
  manualHealingMultiplier: number;
  maxHpBonus: number;
  scourgeSense: boolean;
  lastStand: boolean;
}

export interface PermanentMemorySnapshot {
  saveVersion: number;
  permanentGrassTouches: number;
  permanentUpgrades: PermanentUpgradeId[];
  savedAt: number;
}

export interface DormancySummary {
  survivedMs: number;
  effectiveHealing: number;
  overheal: number;
  runTouchesEarned: number;
  unspentRunTouches: number;
  woundsOpened: number;
  woundsHealed: number;
  permanentGrassTouchesEarned: number;
  totalPermanentGrassTouches: number;
}

export interface OpenRootWoundResult {
  openedRootId?: number;
  woundedRootIds: number[];
}

export const DEFAULT_ANCIENT_GRASS_MAX_HP = 100;
export const DEFAULT_SCOURGE_DRAIN_PER_SECOND = 0.45;
export const DEFAULT_SCOURGE_PRESSURE_GROWTH_PER_SECOND = 0.012;
export const EFFECTIVE_HEALING_PER_PERMANENT_TOUCH = 5;
export const PERMANENT_TOUCHES_PER_EFFECTIVE_HEALING = 1 / EFFECTIVE_HEALING_PER_PERMANENT_TOUCH;
export const SCOURGE_PRESSURE_PER_OPEN_WOUND = 0.16;
export const ROOT_SALVE_RUN_TOUCH_COST = 12;
export const ROOT_SALVE_HEALING = 10;
export const DEW_PULSE_RUN_TOUCH_COST = 22;
export const DEW_PULSE_HEALING = 10;
export const TINY_SPRINKLER_RUN_TOUCH_COST = 16;
export const TINY_SPRINKLER_HEALING = 2;
export const LAST_STAND_REVIVE_HP_RATIO = 0.35;
export const PERMANENT_MEMORY_SAVE_VERSION = 1;
export const PERMANENT_UPGRADE_DEFINITIONS: Record<PermanentUpgradeId, PermanentUpgradeDefinition> = {
  softTouch: {
    id: "softTouch",
    name: "Soft Touch",
    cost: 12,
    description: "Manual root healing +25%",
  },
  deeperRoots: {
    id: "deeperRoots",
    name: "Deeper Roots",
    cost: 18,
    description: "+25 max Ancient HP",
  },
  tinySprinkler: {
    id: "tinySprinkler",
    name: "Tiny Sprinkler",
    cost: 24,
    description: "Unlocks run-bought sprinkler automation",
  },
  scourgeSense: {
    id: "scourgeSense",
    name: "Scourge Sense",
    cost: 20,
    description: "Forecasts the next wound pressure target",
  },
  lastStand: {
    id: "lastStand",
    name: "Last Stand",
    cost: 32,
    description: "One automatic revive per run",
  },
};

export function createRunSpineState(options: RunSpineOptions = {}): RunSpineState {
  const permanentUpgrades = normalizePermanentUpgrades(options.permanentUpgrades ?? []);
  const upgradeEffects = getPermanentUpgradeEffects(permanentUpgrades);
  const maxHp = normalizePositiveNumber(options.maxHp, DEFAULT_ANCIENT_GRASS_MAX_HP) + upgradeEffects.maxHpBonus;
  const currentHp = clamp(normalizeNonNegativeNumber(options.currentHp, maxHp), 0, maxHp);
  return {
    phase: currentHp > 0 ? "active" : "dormant",
    elapsedMs: 0,
    ancientGrass: {
      currentHp,
      maxHp,
      effectiveHealingThisRun: 0,
      overhealThisRun: 0,
    },
    scourge: {
      pressure: normalizePositiveNumber(options.pressure, 1),
      baseDrainPerSecond: normalizeNonNegativeNumber(options.baseDrainPerSecond, DEFAULT_SCOURGE_DRAIN_PER_SECOND),
      pressureGrowthPerSecond: normalizeNonNegativeNumber(
        options.pressureGrowthPerSecond,
        DEFAULT_SCOURGE_PRESSURE_GROWTH_PER_SECOND,
      ),
    },
    economy: {
      runTouches: 0,
      totalRunTouchesEarned: 0,
      permanentGrassTouches: normalizeNonNegativeInteger(options.permanentGrassTouches, 0),
    },
    wounds: {
      woundedRootIds: [],
      totalWoundsOpened: 0,
      totalWoundsHealed: 0,
    },
    automation: {
      tinySprinklers: 0,
    },
    revivals: {
      lastStandUsed: false,
    },
    permanentUpgrades,
  };
}

export function advanceRun(state: RunSpineState, deltaMs: number): RunTickResult {
  const previousHp = state.ancientGrass.currentHp;
  const previousPressure = state.scourge.pressure;

  if (state.phase !== "active") {
    return {
      previousHp,
      currentHp: previousHp,
      drained: 0,
      previousPressure,
      currentPressure: previousPressure,
      lastStandTriggered: false,
      becameDormant: false,
    };
  }

  const seconds = Math.max(0, deltaMs) / 1000;
  const nextPressure = previousPressure + state.scourge.pressureGrowthPerSecond * seconds;
  const woundPressure = state.wounds.woundedRootIds.length * SCOURGE_PRESSURE_PER_OPEN_WOUND;
  const averagePressure = (previousPressure + nextPressure) / 2 + woundPressure;
  const drained = state.scourge.baseDrainPerSecond * averagePressure * seconds;

  state.elapsedMs += Math.max(0, deltaMs);
  state.scourge.pressure = nextPressure;
  state.ancientGrass.currentHp = clamp(previousHp - drained, 0, state.ancientGrass.maxHp);
  const effectiveDrained = previousHp - state.ancientGrass.currentHp;

  const wouldCollapse = previousHp > 0 && state.ancientGrass.currentHp <= 0;
  const lastStandTriggered = wouldCollapse && shouldTriggerLastStand(state);
  if (lastStandTriggered) {
    state.revivals.lastStandUsed = true;
    state.ancientGrass.currentHp = getLastStandReviveHp(state);
  }

  const becameDormant = wouldCollapse && !lastStandTriggered;
  if (becameDormant) {
    state.phase = "dormant";
    state.economy.permanentGrassTouches += getDormancyGrassTouches(state);
  }

  return {
    previousHp,
    currentHp: state.ancientGrass.currentHp,
    drained: effectiveDrained,
    previousPressure,
    currentPressure: state.scourge.pressure,
    lastStandTriggered,
    becameDormant,
  };
}

export function touchAncientGrass(state: RunSpineState, healing: number): TouchAncientGrassResult {
  return touchAncientGrassRoot(state, healing);
}

export function touchAncientGrassRoot(state: RunSpineState, healing: number, rootId?: number): TouchAncientGrassResult {
  const previousHp = state.ancientGrass.currentHp;
  const normalizedHealing = normalizeNonNegativeNumber(healing, 0);

  if (state.phase !== "active" || normalizedHealing <= 0) {
    return {
      previousHp,
      currentHp: previousHp,
      healing: normalizedHealing,
      effectiveHealing: 0,
      overheal: normalizedHealing,
      runTouchesGained: 0,
      healedWound: false,
    };
  }

  const healedWound = rootId !== undefined && clearRootWound(state, rootId);
  const missingHp = Math.max(0, state.ancientGrass.maxHp - previousHp);
  const effectiveHealing = Math.min(missingHp, normalizedHealing);
  const overheal = Math.max(0, normalizedHealing - effectiveHealing);
  const runTouchesGained = getRunTouchesForEffectiveHealing(effectiveHealing);

  state.ancientGrass.currentHp = clamp(previousHp + normalizedHealing, 0, state.ancientGrass.maxHp);
  state.ancientGrass.effectiveHealingThisRun += effectiveHealing;
  state.ancientGrass.overhealThisRun += overheal;
  state.economy.runTouches += runTouchesGained;
  state.economy.totalRunTouchesEarned += runTouchesGained;

  return {
    previousHp,
    currentHp: state.ancientGrass.currentHp,
    healing: normalizedHealing,
    effectiveHealing,
    overheal,
    runTouchesGained,
    healedWound,
  };
}

export function spendRunTouches(state: RunSpineState, requestedAmount: number): SpendRunTouchesResult {
  const requested = normalizeNonNegativeInteger(requestedAmount, 0);
  const spent = Math.min(state.economy.runTouches, requested);
  state.economy.runTouches -= spent;
  return {
    requested,
    spent,
    remaining: state.economy.runTouches,
  };
}

export function useRootSalve(state: RunSpineState): UseRootSalveResult {
  const previousHp = state.ancientGrass.currentHp;
  const baseResult = {
    cost: ROOT_SALVE_RUN_TOUCH_COST,
    spent: 0,
    remainingRunTouches: state.economy.runTouches,
    previousHp,
    currentHp: previousHp,
    healing: 0,
    effectiveHealing: 0,
    overheal: 0,
  };

  if (state.phase !== "active") {
    return {
      ...baseResult,
      used: false,
      reason: "dormant",
    };
  }

  const healedRootId = state.wounds.woundedRootIds[0];
  if (healedRootId === undefined) {
    return {
      ...baseResult,
      used: false,
      reason: "no-wounded-roots",
    };
  }

  if (state.economy.runTouches < ROOT_SALVE_RUN_TOUCH_COST) {
    return {
      ...baseResult,
      used: false,
      reason: "not-enough-run-touches",
    };
  }

  state.economy.runTouches -= ROOT_SALVE_RUN_TOUCH_COST;
  clearRootWound(state, healedRootId);

  const missingHp = Math.max(0, state.ancientGrass.maxHp - previousHp);
  const effectiveHealing = Math.min(missingHp, ROOT_SALVE_HEALING);
  const overheal = Math.max(0, ROOT_SALVE_HEALING - effectiveHealing);
  state.ancientGrass.currentHp = clamp(previousHp + ROOT_SALVE_HEALING, 0, state.ancientGrass.maxHp);
  state.ancientGrass.effectiveHealingThisRun += effectiveHealing;
  state.ancientGrass.overhealThisRun += overheal;

  return {
    cost: ROOT_SALVE_RUN_TOUCH_COST,
    used: true,
    spent: ROOT_SALVE_RUN_TOUCH_COST,
    remainingRunTouches: state.economy.runTouches,
    healedRootId,
    previousHp,
    currentHp: state.ancientGrass.currentHp,
    healing: ROOT_SALVE_HEALING,
    effectiveHealing,
    overheal,
  };
}

export function useDewPulse(state: RunSpineState): UseDewPulseResult {
  const previousHp = state.ancientGrass.currentHp;
  const baseResult = {
    cost: DEW_PULSE_RUN_TOUCH_COST,
    spent: 0,
    remainingRunTouches: state.economy.runTouches,
    previousHp,
    currentHp: previousHp,
    healing: 0,
    effectiveHealing: 0,
    overheal: 0,
  };

  if (state.phase !== "active") {
    return {
      ...baseResult,
      used: false,
      reason: "dormant",
    };
  }

  const missingHp = Math.max(0, state.ancientGrass.maxHp - previousHp);
  if (missingHp <= 0) {
    return {
      ...baseResult,
      used: false,
      reason: "no-missing-hp",
    };
  }

  if (state.economy.runTouches < DEW_PULSE_RUN_TOUCH_COST) {
    return {
      ...baseResult,
      used: false,
      reason: "not-enough-run-touches",
    };
  }

  state.economy.runTouches -= DEW_PULSE_RUN_TOUCH_COST;
  const effectiveHealing = Math.min(missingHp, DEW_PULSE_HEALING);
  const overheal = Math.max(0, DEW_PULSE_HEALING - effectiveHealing);
  state.ancientGrass.currentHp = clamp(previousHp + DEW_PULSE_HEALING, 0, state.ancientGrass.maxHp);
  state.ancientGrass.effectiveHealingThisRun += effectiveHealing;
  state.ancientGrass.overhealThisRun += overheal;

  return {
    cost: DEW_PULSE_RUN_TOUCH_COST,
    used: true,
    spent: DEW_PULSE_RUN_TOUCH_COST,
    remainingRunTouches: state.economy.runTouches,
    previousHp,
    currentHp: state.ancientGrass.currentHp,
    healing: DEW_PULSE_HEALING,
    effectiveHealing,
    overheal,
  };
}

export function buyTinySprinkler(state: RunSpineState): BuyTinySprinklerResult {
  const baseResult = {
    cost: TINY_SPRINKLER_RUN_TOUCH_COST,
    spent: 0,
    remainingRunTouches: state.economy.runTouches,
    tinySprinklers: state.automation.tinySprinklers,
  };

  if (state.phase !== "active") {
    return {
      ...baseResult,
      bought: false,
      reason: "dormant",
    };
  }

  if (!hasPermanentUpgrade(state, "tinySprinkler")) {
    return {
      ...baseResult,
      bought: false,
      reason: "license-missing",
    };
  }

  if (state.economy.runTouches < TINY_SPRINKLER_RUN_TOUCH_COST) {
    return {
      ...baseResult,
      bought: false,
      reason: "not-enough-run-touches",
    };
  }

  state.economy.runTouches -= TINY_SPRINKLER_RUN_TOUCH_COST;
  state.automation.tinySprinklers += 1;
  return {
    cost: TINY_SPRINKLER_RUN_TOUCH_COST,
    bought: true,
    spent: TINY_SPRINKLER_RUN_TOUCH_COST,
    remainingRunTouches: state.economy.runTouches,
    tinySprinklers: state.automation.tinySprinklers,
  };
}

export function applyTinySprinklerPulse(state: RunSpineState, rootId?: number): ApplyTinySprinklerPulseResult {
  const previousHp = state.ancientGrass.currentHp;
  const baseResult = {
    previousHp,
    currentHp: previousHp,
    healing: 0,
    effectiveHealing: 0,
    overheal: 0,
    runTouchesGained: 0,
    healedWound: false,
  };

  if (state.phase !== "active") {
    return {
      ...baseResult,
      applied: false,
      reason: "dormant",
    };
  }

  if (state.automation.tinySprinklers <= 0) {
    return {
      ...baseResult,
      applied: false,
      reason: "no-sprinklers",
    };
  }

  const missingHp = Math.max(0, state.ancientGrass.maxHp - previousHp);
  if (missingHp <= 0) {
    return {
      ...baseResult,
      applied: false,
      reason: "no-missing-hp",
    };
  }

  const healing = TINY_SPRINKLER_HEALING * state.automation.tinySprinklers;
  const healedWound = rootId !== undefined && clearRootWound(state, rootId);
  const effectiveHealing = Math.min(missingHp, healing);
  const overheal = Math.max(0, healing - effectiveHealing);
  const runTouchesGained = getRunTouchesForEffectiveHealing(effectiveHealing);

  state.ancientGrass.currentHp = clamp(previousHp + healing, 0, state.ancientGrass.maxHp);
  state.ancientGrass.effectiveHealingThisRun += effectiveHealing;
  state.ancientGrass.overhealThisRun += overheal;
  state.economy.runTouches += runTouchesGained;
  state.economy.totalRunTouchesEarned += runTouchesGained;

  return {
    applied: true,
    previousHp,
    currentHp: state.ancientGrass.currentHp,
    healing,
    effectiveHealing,
    overheal,
    runTouchesGained,
    healedWound,
  };
}

export function purchasePermanentUpgrade(state: RunSpineState, upgradeId: PermanentUpgradeId): PurchasePermanentUpgradeResult {
  const upgrade = PERMANENT_UPGRADE_DEFINITIONS[upgradeId];
  if (state.permanentUpgrades.includes(upgradeId)) {
    return {
      upgrade,
      purchased: false,
      reason: "already-owned",
      remainingGrassTouches: state.economy.permanentGrassTouches,
    };
  }

  if (state.economy.permanentGrassTouches < upgrade.cost) {
    return {
      upgrade,
      purchased: false,
      reason: "not-enough-grass-touches",
      remainingGrassTouches: state.economy.permanentGrassTouches,
    };
  }

  state.economy.permanentGrassTouches -= upgrade.cost;
  state.permanentUpgrades = [...state.permanentUpgrades, upgradeId].sort();
  return {
    upgrade,
    purchased: true,
    remainingGrassTouches: state.economy.permanentGrassTouches,
  };
}

export function getPermanentUpgradeEffects(upgradesOrState: PermanentUpgradeId[] | RunSpineState): PermanentUpgradeEffects {
  const upgradeIds = Array.isArray(upgradesOrState) ? upgradesOrState : upgradesOrState.permanentUpgrades;
  return {
    manualHealingMultiplier: upgradeIds.includes("softTouch") ? 1.25 : 1,
    maxHpBonus: upgradeIds.includes("deeperRoots") ? 25 : 0,
    scourgeSense: upgradeIds.includes("scourgeSense"),
    lastStand: upgradeIds.includes("lastStand"),
  };
}

export function hasPermanentUpgrade(state: RunSpineState, upgradeId: PermanentUpgradeId): boolean {
  return state.permanentUpgrades.includes(upgradeId);
}

export function createPermanentMemorySnapshot(state: RunSpineState, savedAt: number): PermanentMemorySnapshot {
  return {
    saveVersion: PERMANENT_MEMORY_SAVE_VERSION,
    permanentGrassTouches: normalizeNonNegativeInteger(state.economy.permanentGrassTouches, 0),
    permanentUpgrades: normalizePermanentUpgrades(state.permanentUpgrades),
    savedAt: normalizeNonNegativeInteger(savedAt, 0),
  };
}

export function normalizePermanentMemorySnapshot(value: unknown): PermanentMemorySnapshot | undefined {
  if (!isRecord(value) || value.saveVersion !== PERMANENT_MEMORY_SAVE_VERSION) {
    return undefined;
  }

  const rawUpgrades = Array.isArray(value.permanentUpgrades) ? value.permanentUpgrades.filter(isPermanentUpgradeId) : [];
  return {
    saveVersion: PERMANENT_MEMORY_SAVE_VERSION,
    permanentGrassTouches: normalizeNonNegativeInteger(value.permanentGrassTouches, 0),
    permanentUpgrades: normalizePermanentUpgrades(rawUpgrades),
    savedAt: normalizeNonNegativeInteger(value.savedAt, 0),
  };
}

export function getDormancyGrassTouches(state: RunSpineState): number {
  return Math.floor(state.ancientGrass.effectiveHealingThisRun * PERMANENT_TOUCHES_PER_EFFECTIVE_HEALING);
}

export function getDormancySummary(state: RunSpineState): DormancySummary {
  return {
    survivedMs: state.elapsedMs,
    effectiveHealing: state.ancientGrass.effectiveHealingThisRun,
    overheal: state.ancientGrass.overhealThisRun,
    runTouchesEarned: state.economy.totalRunTouchesEarned,
    unspentRunTouches: state.economy.runTouches,
    woundsOpened: state.wounds.totalWoundsOpened,
    woundsHealed: state.wounds.totalWoundsHealed,
    permanentGrassTouchesEarned: getDormancyGrassTouches(state),
    totalPermanentGrassTouches: state.economy.permanentGrassTouches,
  };
}

export function createNextRunFromDormancy(state: RunSpineState, options: RunSpineOptions = {}): RunSpineState {
  return createRunSpineState({
    ...options,
    permanentGrassTouches: state.economy.permanentGrassTouches,
    permanentUpgrades: options.permanentUpgrades ?? state.permanentUpgrades,
  });
}

export function getAncientGrassHpRatio(state: RunSpineState): number {
  if (state.ancientGrass.maxHp <= 0) {
    return 0;
  }

  return clamp(state.ancientGrass.currentHp / state.ancientGrass.maxHp, 0, 1);
}

export function formatAncientGrassHp(state: RunSpineState): string {
  return `${formatHp(state.ancientGrass.currentHp)} / ${formatHp(state.ancientGrass.maxHp)}`;
}

export function openRootWound(state: RunSpineState, rootCount: number, preferredRootId?: number): OpenRootWoundResult {
  if (state.phase !== "active") {
    return { woundedRootIds: [...state.wounds.woundedRootIds] };
  }

  const normalizedRootCount = normalizeNonNegativeInteger(rootCount, 0);
  if (normalizedRootCount <= 0 || state.wounds.woundedRootIds.length >= normalizedRootCount) {
    return { woundedRootIds: [...state.wounds.woundedRootIds] };
  }

  const rootId = pickWoundRootId(state.wounds.woundedRootIds, normalizedRootCount, preferredRootId);
  if (rootId === undefined) {
    return { woundedRootIds: [...state.wounds.woundedRootIds] };
  }

  state.wounds.woundedRootIds = [...state.wounds.woundedRootIds, rootId].sort((a, b) => a - b);
  state.wounds.totalWoundsOpened += 1;
  return { openedRootId: rootId, woundedRootIds: [...state.wounds.woundedRootIds] };
}

export function isRootWounded(state: RunSpineState, rootId: number): boolean {
  return state.wounds.woundedRootIds.includes(rootId);
}

export function getWoundedRootCount(state: RunSpineState): number {
  return state.wounds.woundedRootIds.length;
}

function shouldTriggerLastStand(state: RunSpineState): boolean {
  return hasPermanentUpgrade(state, "lastStand") && !state.revivals.lastStandUsed;
}

function getLastStandReviveHp(state: RunSpineState): number {
  return Math.max(1, state.ancientGrass.maxHp * LAST_STAND_REVIVE_HP_RATIO);
}

function clearRootWound(state: RunSpineState, rootId: number): boolean {
  const index = state.wounds.woundedRootIds.indexOf(rootId);
  if (index < 0) {
    return false;
  }

  state.wounds.woundedRootIds = state.wounds.woundedRootIds.filter((id) => id !== rootId);
  state.wounds.totalWoundsHealed += 1;
  return true;
}

function pickWoundRootId(woundedRootIds: number[], rootCount: number, preferredRootId?: number): number | undefined {
  const preferred = preferredRootId === undefined ? undefined : normalizeNonNegativeInteger(preferredRootId, -1);
  if (preferred !== undefined && preferred >= 0 && preferred < rootCount && !woundedRootIds.includes(preferred)) {
    return preferred;
  }

  const openRootIds: number[] = [];
  for (let rootId = 0; rootId < rootCount; rootId += 1) {
    if (!woundedRootIds.includes(rootId)) {
      openRootIds.push(rootId);
    }
  }

  if (openRootIds.length <= 0) {
    return undefined;
  }

  return openRootIds[Math.floor(Math.random() * openRootIds.length)];
}

function getRunTouchesForEffectiveHealing(effectiveHealing: number): number {
  if (effectiveHealing <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(effectiveHealing));
}

function formatHp(value: number): string {
  return value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return numericValue;
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return numericValue;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  return Math.floor(normalizeNonNegativeNumber(value, fallback));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePermanentUpgrades(upgrades: PermanentUpgradeId[]): PermanentUpgradeId[] {
  return Array.from(new Set(upgrades.filter((upgradeId) => upgradeId in PERMANENT_UPGRADE_DEFINITIONS))).sort();
}

function isPermanentUpgradeId(value: unknown): value is PermanentUpgradeId {
  return typeof value === "string" && value in PERMANENT_UPGRADE_DEFINITIONS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
