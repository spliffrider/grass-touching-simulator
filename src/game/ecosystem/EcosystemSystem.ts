import {
  CULTIVATION_RANKS_PER_SIZE,
  FIELD_CHUNK_SIZE,
  FIELD_SIZE_LADDER,
  HELPER_IDS,
  HELPER_RECONFIGURE_MS,
  HELPERS,
  MAX_REPRESENTATIVE_IMPACTS,
  PRODUCTION_RECIPES,
  PRODUCTION_RESOURCE_IDS,
  PRODUCTION_TICK_MS,
  TILE_STAGE_COUNT,
  TileStage,
  type HelperId,
  type ProductionBuffer,
  type ProductionRecipe,
  type ProductionResourceId,
  type TouchBatchImpact,
  type TouchBatchResult,
} from "./EcosystemCatalog";

export const ECOSYSTEM_PERMANENT_VERSION = 1;
export const ECOSYSTEM_ACTIVE_VERSION = 1;
export const FIELD_MOUSE_STARTER_SEEDS = 3;
export const BEE_HIVE_STARTER_FLOWERS = 4;
export const MANUAL_TOUCH_POWER_PER_MEMORY = 0.01;
export const HELPER_THROUGHPUT_PER_RANK = 0.12;
const FIRST_RUN_SCOURGE_BASE = 10_000_000;
const FIRST_RUN_OPENING_HP = 1;
const FIRST_RUN_SCOURGE_RAMP_SECONDS = 0.18;
const PRE_AUTOMATION_SCOURGE_RAMP_SECONDS = 0.2;
const FIRST_AUTOMATION_SCOURGE_RAMP_SECONDS = 40;
const EARLY_SCOURGE_BASE_BY_CAPABILITY = [12, 6, 2.4, 1.5, 1.05, 0.82] as const;

export type HelperRankRecord = Record<HelperId, number>;
export type HelperUnlockRecord = Record<HelperId, boolean>;
export type HelperModeUnlockRecord = Record<HelperId, string[]>;
export type ProductionBufferRecord = Record<ProductionResourceId, ProductionBuffer>;
export type ProductionRateRecord = Record<ProductionResourceId, number>;
export type PermanentTouchRankKind = "fastTouch" | "broadPalm" | "manyHands";

export interface PermanentEcosystemState {
  version: typeof ECOSYSTEM_PERMANENT_VERSION;
  grassTouches: number;
  completedRuns: number;
  unlockedHelpers: HelperUnlockRecord;
  unlockedModes: HelperModeUnlockRecord;
  throughputRanks: HelperRankRecord;
  storageRanks: HelperRankRecord;
  efficiencyRanks: HelperRankRecord;
  startingStockRanks: HelperRankRecord;
  maxFieldTier: number;
  fastTouchRank: number;
  broadPalmRank: number;
  manyHandsRank: number;
  fieldEmbrace: boolean;
  lastPurchasedMemoryNodeId: string | null;
}

export interface HelperRuntimeState {
  count: number;
  modeId: string;
  reconfigureRemainingMs: number;
  pulseProgress: number;
  cyclesCompleted: number;
  lastPauseReason: string | null;
}

export type HelperRuntimeRecord = Record<HelperId, HelperRuntimeState>;

export interface EcosystemFieldState {
  sizeIndex: number;
  width: number;
  height: number;
  cultivationRank: number;
  stages: Uint8Array;
  chunkColumns: number;
  chunkRows: number;
  chunkStageCounts: Uint16Array;
  dirtyChunks: Uint8Array;
  stageCursor: number;
  stageProgress: number;
  sparseWounds: Map<number, number>;
}

export interface EcosystemRunSummary {
  durationMs: number;
  fieldSize: number;
  cultivationRank: number;
  careProduced: number;
  manualCare: number;
  runTouchesEarned: number;
  helpersBought: number;
  touches: number;
  grassTouchesAwarded: number;
}

export interface EcosystemState {
  version: typeof ECOSYSTEM_ACTIVE_VERSION;
  active: boolean;
  runNumber: number;
  elapsedMs: number;
  tickAccumulatorMs: number;
  fixedTicks: number;
  rngState: number;
  hp: number;
  maxHp: number;
  scourgeDemandPerSecond: number;
  careDeficitPerSecond: number;
  runTouches: number;
  runTouchesEarned: number;
  manualTouchCount: number;
  manualCareTotal: number;
  helperPurchaseCount: number;
  resources: ProductionBufferRecord;
  rates: ProductionRateRecord;
  helpers: HelperRuntimeRecord;
  helperPulses: HelperRankRecord;
  field: EcosystemFieldState;
  bottleneck: string;
  endedSummary: EcosystemRunSummary | null;
}

export interface EcosystemTickResult {
  ticks: number;
  gameOver: boolean;
  changedChunks: number;
}

export interface EcosystemReadout {
  hp: number;
  maxHp: number;
  hpRatio: number;
  elapsedMs: number;
  fieldSize: number;
  tileCount: number;
  cultivationRank: number;
  scourgeDemandPerSecond: number;
  careProductionPerSecond: number;
  careDeficitPerSecond: number;
  runTouches: number;
  bottleneck: string;
  fixedTicks: number;
  logicalTiles: number;
  dirtyChunks: number;
}

export type FirstAutomationStage = "locked" | "gather" | "ready" | "firstCycle" | "sustain" | "dry" | "paused";

export interface FirstAutomationStatus {
  stage: FirstAutomationStage;
  purchaseCost: number;
  purchaseProgress: number;
  cycleProgress: number;
  dewAmount: number;
  careProduced: number;
  pauseReason: string | null;
}

export type FieldMouseStage = "locked" | "gather" | "ready" | "firstTrip" | "working" | "starved" | "blocked";

export interface FieldMouseStatus {
  stage: FieldMouseStage;
  purchaseCost: number;
  purchaseProgress: number;
  cycleProgress: number;
  cyclesCompleted: number;
  seedAmount: number;
  growthAmount: number;
  pauseReason: string | null;
}

export type BeeHiveStage = "locked" | "gather" | "ready" | "firstFlight" | "working" | "starved" | "blocked";

export interface BeeHiveStatus {
  stage: BeeHiveStage;
  purchaseCost: number;
  purchaseProgress: number;
  cycleProgress: number;
  cyclesCompleted: number;
  flowerAmount: number;
  pollinatedBloomAmount: number;
  pauseReason: string | null;
}

export type PermanentRankKind = "throughput" | "storage" | "efficiency" | "startingStock";

const BASE_RESOURCE_CAPACITY: Record<ProductionResourceId, number> = {
  dew: 80,
  moisture: 64,
  growth: 120,
  flowers: 56,
  pollinatedBlooms: 52,
  seeds: 58,
  clippings: 58,
  compost: 48,
  humus: 42,
  rootEnergy: 38,
  care: 36,
};

const HELPER_STORAGE_RESOURCES: Record<HelperId, readonly ProductionResourceId[]> = {
  tinySprinkler: ["dew", "moisture"],
  fieldMouse: ["seeds", "growth"],
  beeHive: ["flowers", "pollinatedBlooms"],
  chickenPatrol: ["growth", "clippings", "compost"],
  earthwormCrew: ["compost", "humus"],
  ancientRoots: ["humus", "rootEnergy", "dew", "care"],
  sheepLoop: ["growth", "clippings", "care"],
  meadowRabbit: ["seeds", "growth", "flowers"],
};

const STARTING_STOCK_RESOURCE: Record<HelperId, ProductionResourceId> = {
  tinySprinkler: "dew",
  fieldMouse: "seeds",
  beeHive: "flowers",
  chickenPatrol: "clippings",
  earthwormCrew: "compost",
  ancientRoots: "humus",
  sheepLoop: "growth",
  meadowRabbit: "seeds",
};

const FIELD_TIER_COSTS = [0, 8, 14, 22, 34, 52, 78, 116, 170, 250, 370] as const;
const TOUCH_RANK_BASE_COST: Record<PermanentTouchRankKind, number> = {
  fastTouch: 9,
  broadPalm: 7,
  manyHands: 12,
};
const FIRST_SPRINKLER_CARE_MILESTONE = 0.3;
const EPSILON = 0.000_001;

function createHelperNumberRecord(value = 0): HelperRankRecord {
  return Object.fromEntries(HELPER_IDS.map((id) => [id, value])) as HelperRankRecord;
}

function createHelperBooleanRecord(value = false): HelperUnlockRecord {
  return Object.fromEntries(HELPER_IDS.map((id) => [id, value])) as HelperUnlockRecord;
}

function createRateRecord(): ProductionRateRecord {
  return Object.fromEntries(PRODUCTION_RESOURCE_IDS.map((id) => [id, 0])) as ProductionRateRecord;
}

function clampRank(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.floor(Number.isFinite(value) ? value : 0)));
}

export function createPermanentEcosystemState(): PermanentEcosystemState {
  const unlockedModes = Object.fromEntries(
    HELPER_IDS.map((id) => [id, [HELPERS[id].modes[0].id]]),
  ) as HelperModeUnlockRecord;

  return {
    version: ECOSYSTEM_PERMANENT_VERSION,
    grassTouches: 0,
    completedRuns: 0,
    unlockedHelpers: createHelperBooleanRecord(),
    unlockedModes,
    throughputRanks: createHelperNumberRecord(),
    storageRanks: createHelperNumberRecord(),
    efficiencyRanks: createHelperNumberRecord(),
    startingStockRanks: createHelperNumberRecord(),
    maxFieldTier: 0,
    fastTouchRank: 0,
    broadPalmRank: 0,
    manyHandsRank: 0,
    fieldEmbrace: false,
    lastPurchasedMemoryNodeId: null,
  };
}

export function normalizePermanentEcosystemState(input: unknown): PermanentEcosystemState {
  const defaults = createPermanentEcosystemState();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  const source = input as Partial<PermanentEcosystemState>;
  const normalized = createPermanentEcosystemState();
  normalized.grassTouches = Math.max(0, Number(source.grassTouches) || 0);
  normalized.completedRuns = Math.max(0, Math.floor(Number(source.completedRuns) || 0));
  normalized.maxFieldTier = clampRank(Number(source.maxFieldTier), FIELD_SIZE_LADDER.length - 1);
  normalized.fastTouchRank = clampRank(Number(source.fastTouchRank), 10);
  normalized.broadPalmRank = clampRank(Number(source.broadPalmRank), 10);
  normalized.manyHandsRank = clampRank(Number(source.manyHandsRank), 10);
  normalized.fieldEmbrace = source.fieldEmbrace === true;
  normalized.lastPurchasedMemoryNodeId = typeof source.lastPurchasedMemoryNodeId === "string"
    && source.lastPurchasedMemoryNodeId.length <= 128
    ? source.lastPurchasedMemoryNodeId
    : null;

  for (const helperId of HELPER_IDS) {
    normalized.unlockedHelpers[helperId] = source.unlockedHelpers?.[helperId] === true;
    normalized.throughputRanks[helperId] = clampRank(source.throughputRanks?.[helperId] ?? 0, 10);
    normalized.storageRanks[helperId] = clampRank(source.storageRanks?.[helperId] ?? 0, 10);
    normalized.efficiencyRanks[helperId] = clampRank(source.efficiencyRanks?.[helperId] ?? 0, 10);
    normalized.startingStockRanks[helperId] = clampRank(source.startingStockRanks?.[helperId] ?? 0, 5);
    const allowedModes = new Set(HELPERS[helperId].modes.map((mode) => mode.id));
    const modes = source.unlockedModes?.[helperId]?.filter((modeId) => allowedModes.has(modeId)) ?? [];
    normalized.unlockedModes[helperId] = [...new Set([HELPERS[helperId].modes[0].id, ...modes])];
  }

  return normalized;
}

export function getPermanentMemoryInvestmentCount(permanent: PermanentEcosystemState): number {
  let count = permanent.maxFieldTier
    + permanent.fastTouchRank
    + permanent.broadPalmRank
    + permanent.manyHandsRank
    + (permanent.fieldEmbrace ? 1 : 0);
  for (const helperId of HELPER_IDS) {
    count += permanent.unlockedHelpers[helperId] ? 1 : 0;
    count += permanent.throughputRanks[helperId]
      + permanent.storageRanks[helperId]
      + permanent.efficiencyRanks[helperId]
      + permanent.startingStockRanks[helperId];
    const baseModeId = HELPERS[helperId].modes[0].id;
    const unlockedModes = permanent.unlockedModes[helperId];
    for (let modeIndex = 0; modeIndex < unlockedModes.length; modeIndex += 1) {
      const modeId = unlockedModes[modeIndex];
      if (modeId === baseModeId || unlockedModes.indexOf(modeId) !== modeIndex) continue;
      count += 1;
    }
  }
  return count;
}

export function getManualTouchPowerMultiplier(permanent: PermanentEcosystemState): number {
  return 1 + getPermanentMemoryInvestmentCount(permanent) * MANUAL_TOUCH_POWER_PER_MEMORY;
}

export function getManualTouchPowerBonusPercent(permanent: PermanentEcosystemState): number {
  return Math.round((getManualTouchPowerMultiplier(permanent) - 1) * 100);
}

export function getHelperStorageResourceIds(helperId: HelperId): readonly ProductionResourceId[] {
  return HELPER_STORAGE_RESOURCES[helperId];
}

function getCapacity(resourceId: ProductionResourceId, permanent: PermanentEcosystemState, field: EcosystemFieldState): number {
  let relevantStorageRanks = 0;
  for (const helperId of HELPER_IDS) {
    if (HELPER_STORAGE_RESOURCES[helperId].includes(resourceId)) {
      relevantStorageRanks += permanent.storageRanks[helperId];
    }
  }
  const memoryMultiplier = 1 + relevantStorageRanks * 0.15;
  const cultivationMultiplier = 1 + field.cultivationRank * 0.08;
  const fieldMultiplier = 1 + Math.sqrt(field.width * field.height) * 0.12;
  return BASE_RESOURCE_CAPACITY[resourceId] * memoryMultiplier * cultivationMultiplier * fieldMultiplier;
}

function createField(sizeIndex: number, seed: number): EcosystemFieldState {
  const safeIndex = clampRank(sizeIndex, FIELD_SIZE_LADDER.length - 1);
  const size = FIELD_SIZE_LADDER[safeIndex];
  const chunkColumns = Math.ceil(size / FIELD_CHUNK_SIZE);
  const chunkRows = Math.ceil(size / FIELD_CHUNK_SIZE);
  const stages = new Uint8Array(size * size);
  let rngState = seed >>> 0 || 1;
  for (let index = 0; index < stages.length; index += 1) {
    rngState = nextRandomState(rngState);
    stages[index] = stages.length === 1 ? TileStage.Verdant : 1 + (rngState % 4);
  }

  const field: EcosystemFieldState = {
    sizeIndex: safeIndex,
    width: size,
    height: size,
    cultivationRank: 0,
    stages,
    chunkColumns,
    chunkRows,
    chunkStageCounts: new Uint16Array(chunkColumns * chunkRows * TILE_STAGE_COUNT),
    dirtyChunks: new Uint8Array(chunkColumns * chunkRows),
    stageCursor: 0,
    stageProgress: 0,
    sparseWounds: new Map(),
  };
  rebuildChunkStageCounts(field);
  field.dirtyChunks.fill(1);
  return field;
}

function createResourceBuffers(
  permanent: PermanentEcosystemState,
  field: EcosystemFieldState,
  helpersEnabled: boolean,
): ProductionBufferRecord {
  const buffers = {} as ProductionBufferRecord;
  for (const resourceId of PRODUCTION_RESOURCE_IDS) {
    buffers[resourceId] = {
      amount: resourceId === "dew" ? 5 : 0,
      capacity: getCapacity(resourceId, permanent, field),
      producedTotal: 0,
      consumedTotal: 0,
    };
  }

  for (const helperId of HELPER_IDS) {
    if (!helpersEnabled || !permanent.unlockedHelpers[helperId]) {
      continue;
    }
    const resourceId = STARTING_STOCK_RESOURCE[helperId];
    const bonus = permanent.startingStockRanks[helperId] * 3;
    buffers[resourceId].amount = Math.min(buffers[resourceId].capacity, buffers[resourceId].amount + bonus);
  }
  return buffers;
}

function createHelperRuntime(): HelperRuntimeRecord {
  return Object.fromEntries(
    HELPER_IDS.map((helperId) => [
      helperId,
      {
        count: 0,
        modeId: HELPERS[helperId].modes[0].id,
        reconfigureRemainingMs: 0,
        pulseProgress: 0,
        cyclesCompleted: 0,
        lastPauseReason: null,
      },
    ]),
  ) as HelperRuntimeRecord;
}

export function createEcosystemState(
  permanent: PermanentEcosystemState,
  options: { seed?: number; fieldSizeIndex?: number } = {},
): EcosystemState {
  const seed = (options.seed ?? 0x5eed_2026) >>> 0 || 1;
  const fieldSizeIndex = Math.min(permanent.maxFieldTier, options.fieldSizeIndex ?? 0);
  const field = createField(fieldSizeIndex, seed);
  const runNumber = permanent.completedRuns + 1;
  const state: EcosystemState = {
    version: ECOSYSTEM_ACTIVE_VERSION,
    active: true,
    runNumber,
    elapsedMs: 0,
    tickAccumulatorMs: 0,
    fixedTicks: 0,
    rngState: seed,
    hp: 100,
    maxHp: 100,
    scourgeDemandPerSecond: 0,
    careDeficitPerSecond: 0,
    runTouches: 0,
    runTouchesEarned: 0,
    manualTouchCount: 0,
    manualCareTotal: 0,
    helperPurchaseCount: 0,
    resources: createResourceBuffers(permanent, field, runNumber > 1),
    rates: createRateRecord(),
    helpers: createHelperRuntime(),
    helperPulses: createHelperNumberRecord(),
    field,
    bottleneck: runNumber === 1 ? "Touch the field to wake the Scourge" : "Manual Care",
    endedSummary: null,
  };
  if (runNumber > 1) {
    state.scourgeDemandPerSecond = getScourgeDemand(state, permanent);
    state.careDeficitPerSecond = state.scourgeDemandPerSecond;
  }
  return state;
}

export function getHelperPurchaseCost(state: EcosystemState, helperId: HelperId): number {
  const definition = HELPERS[helperId];
  return Math.ceil(definition.baseCost * Math.pow(definition.costGrowth, state.helpers[helperId].count));
}

export function isRunEquipmentAvailable(state: Pick<EcosystemState, "active" | "runNumber">): boolean {
  return state.active && state.runNumber > 1;
}

export function enforceRunOneBareHands(state: EcosystemState): void {
  if (state.runNumber > 1) {
    return;
  }
  state.helperPurchaseCount = 0;
  for (const helperId of HELPER_IDS) {
    const helper = state.helpers[helperId];
    helper.count = 0;
    helper.modeId = HELPERS[helperId].modes[0].id;
    helper.reconfigureRemainingMs = 0;
    helper.pulseProgress = 0;
    helper.cyclesCompleted = 0;
    helper.lastPauseReason = null;
    state.helperPulses[helperId] = 0;
  }
}

export function getFirstAutomationStatus(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
): FirstAutomationStatus {
  const sprinkler = state.helpers.tinySprinkler;
  const purchaseCost = getHelperPurchaseCost(state, "tinySprinkler");
  const common = {
    purchaseCost,
    purchaseProgress: Math.min(1, Math.max(0, state.runTouches / purchaseCost)),
    cycleProgress: Math.min(1, Math.max(0, sprinkler.pulseProgress)),
    dewAmount: state.resources.dew.amount,
    careProduced: state.resources.care.producedTotal,
    pauseReason: sprinkler.lastPauseReason,
  };

  if (!isRunEquipmentAvailable(state) || !permanent.unlockedHelpers.tinySprinkler) {
    return { stage: "locked", ...common };
  }
  if (sprinkler.count <= 0) {
    return { stage: state.runTouches >= purchaseCost ? "ready" : "gather", ...common };
  }
  if (state.resources.dew.amount < 1) return { stage: "dry", ...common };
  if (sprinkler.lastPauseReason) return { stage: "paused", ...common };
  if (state.resources.care.producedTotal < FIRST_SPRINKLER_CARE_MILESTONE) {
    return { stage: "firstCycle", ...common };
  }
  return { stage: "sustain", ...common };
}

export function getHelperThroughputMultiplier(rank: number): number {
  const safeRank = clampRank(rank, 10);
  return 1 + safeRank * HELPER_THROUGHPUT_PER_RANK;
}

export function getHelperCycleIntervalMs(
  helperId: HelperId,
  throughputRank: number,
  modeId = HELPERS[helperId].modes[0].id,
): number {
  const recipe = PRODUCTION_RECIPES.find(
    (candidate) => candidate.helperId === helperId && candidate.modeId === modeId,
  );
  if (!recipe || recipe.cyclesPerSecond <= 0) return Number.POSITIVE_INFINITY;
  return 1_000 / (recipe.cyclesPerSecond * getHelperThroughputMultiplier(throughputRank));
}

export function getFieldMouseStatus(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
): FieldMouseStatus {
  const mouse = state.helpers.fieldMouse;
  const purchaseCost = getHelperPurchaseCost(state, "fieldMouse");
  const common = {
    purchaseCost,
    purchaseProgress: Math.min(1, Math.max(0, state.runTouches / purchaseCost)),
    cycleProgress: Math.min(1, Math.max(0, mouse.pulseProgress)),
    cyclesCompleted: mouse.cyclesCompleted,
    seedAmount: state.resources.seeds.amount,
    growthAmount: state.resources.growth.amount,
    pauseReason: mouse.lastPauseReason,
  };

  if (!isRunEquipmentAvailable(state) || !permanent.unlockedHelpers.fieldMouse) {
    return { stage: "locked", ...common };
  }
  if (mouse.count <= 0) {
    return { stage: state.runTouches >= purchaseCost ? "ready" : "gather", ...common };
  }
  if (mouse.lastPauseReason?.startsWith("Needs seeds") || state.resources.seeds.amount < EPSILON) {
    return { stage: "starved", ...common };
  }
  if (mouse.lastPauseReason) {
    return { stage: "blocked", ...common };
  }
  if (mouse.cyclesCompleted < 1) {
    return { stage: "firstTrip", ...common };
  }
  return { stage: "working", ...common };
}

export function getBeeHiveStatus(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
): BeeHiveStatus {
  const hive = state.helpers.beeHive;
  const purchaseCost = getHelperPurchaseCost(state, "beeHive");
  const common = {
    purchaseCost,
    purchaseProgress: Math.min(1, Math.max(0, state.runTouches / purchaseCost)),
    cycleProgress: Math.min(1, Math.max(0, hive.pulseProgress)),
    cyclesCompleted: hive.cyclesCompleted,
    flowerAmount: state.resources.flowers.amount,
    pollinatedBloomAmount: state.resources.pollinatedBlooms.amount,
    pauseReason: hive.lastPauseReason,
  };

  if (!isRunEquipmentAvailable(state) || !permanent.unlockedHelpers.beeHive) {
    return { stage: "locked", ...common };
  }
  if (hive.count <= 0) {
    return { stage: state.runTouches >= purchaseCost ? "ready" : "gather", ...common };
  }
  if (hive.lastPauseReason?.startsWith("Needs flowers") || state.resources.flowers.amount < EPSILON) {
    return { stage: "starved", ...common };
  }
  if (hive.lastPauseReason) {
    return { stage: "blocked", ...common };
  }
  if (hive.cyclesCompleted < 1) {
    return { stage: "firstFlight", ...common };
  }
  return { stage: "working", ...common };
}

export function buyHelper(state: EcosystemState, permanent: PermanentEcosystemState, helperId: HelperId): boolean {
  if (!isRunEquipmentAvailable(state) || !permanent.unlockedHelpers[helperId]) {
    return false;
  }
  const cost = getHelperPurchaseCost(state, helperId);
  if (state.runTouches + EPSILON < cost) {
    return false;
  }
  state.runTouches -= cost;
  const firstFieldMouse = helperId === "fieldMouse" && state.helpers.fieldMouse.count === 0;
  const firstBeeHive = helperId === "beeHive" && state.helpers.beeHive.count === 0;
  state.helpers[helperId].count += 1;
  if (firstFieldMouse) {
    addResource(state, "seeds", FIELD_MOUSE_STARTER_SEEDS);
  }
  if (firstBeeHive) {
    addResource(state, "flowers", BEE_HIVE_STARTER_FLOWERS);
  }
  state.helperPurchaseCount += 1;
  return true;
}

export function switchHelperMode(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
  helperId: HelperId,
  modeId: string,
): boolean {
  const helper = state.helpers[helperId];
  if (
    !isRunEquipmentAvailable(state) ||
    helper.count <= 0 ||
    helper.modeId === modeId ||
    helper.reconfigureRemainingMs > 0 ||
    !permanent.unlockedModes[helperId].includes(modeId)
  ) {
    return false;
  }
  helper.modeId = modeId;
  helper.reconfigureRemainingMs = HELPER_RECONFIGURE_MS;
  helper.lastPauseReason = "Reconfiguring";
  return true;
}

export function getCultivationCost(state: EcosystemState): number {
  const rank = Math.min(CULTIVATION_RANKS_PER_SIZE - 1, state.field.cultivationRank);
  return Math.ceil(7 * Math.pow(rank + 1, 1.34) * (1 + state.field.sizeIndex * 0.72));
}

export function buyCultivationRank(state: EcosystemState, permanent: PermanentEcosystemState): boolean {
  if (!state.active || state.field.cultivationRank >= CULTIVATION_RANKS_PER_SIZE) {
    return false;
  }
  const cost = getCultivationCost(state);
  if (state.resources.growth.amount + EPSILON < cost) {
    return false;
  }
  consumeResource(state, "growth", cost);
  state.field.cultivationRank += 1;
  refreshResourceCapacities(state, permanent);
  if (
    state.field.cultivationRank >= CULTIVATION_RANKS_PER_SIZE &&
    state.field.sizeIndex < permanent.maxFieldTier &&
    state.field.sizeIndex < FIELD_SIZE_LADDER.length - 1
  ) {
    expandField(state, permanent);
  }
  return true;
}

export function getHelperUnlockCost(helperId: HelperId): number {
  return HELPERS[helperId].unlockCost;
}

export function isFirstEcosystemCollapse(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
): boolean {
  return !state.active &&
    state.runNumber === 1 &&
    state.endedSummary !== null &&
    permanent.completedRuns >= 1;
}

export function isFirstCollapseAwaitingSprinkler(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
): boolean {
  return isFirstEcosystemCollapse(state, permanent) &&
    !permanent.unlockedHelpers.tinySprinkler;
}

export function isFirstMemoryPending(
  state: Pick<EcosystemState, "active">,
  permanent: PermanentEcosystemState,
): boolean {
  return !state.active && !permanent.unlockedHelpers.tinySprinkler;
}

export function canBeginNextEcosystemRun(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
): boolean {
  return !state.active && !isFirstMemoryPending(state, permanent);
}

export function unlockHelper(permanent: PermanentEcosystemState, helperId: HelperId): boolean {
  if (permanent.unlockedHelpers[helperId]) {
    return false;
  }
  const prerequisite = HELPERS[helperId].unlockRequires;
  const cost = getHelperUnlockCost(helperId);
  if ((prerequisite && !permanent.unlockedHelpers[prerequisite]) || permanent.grassTouches + EPSILON < cost) {
    return false;
  }
  permanent.grassTouches -= cost;
  permanent.unlockedHelpers[helperId] = true;
  return true;
}

export function getModeUnlockCost(helperId: HelperId): number {
  return Math.ceil(HELPERS[helperId].unlockCost * 1.35);
}

export function unlockHelperMode(permanent: PermanentEcosystemState, helperId: HelperId, modeId: string): boolean {
  const modeExists = HELPERS[helperId].modes.some((mode) => mode.id === modeId);
  if (!permanent.unlockedHelpers[helperId] || !modeExists || permanent.unlockedModes[helperId].includes(modeId)) {
    return false;
  }
  const cost = getModeUnlockCost(helperId);
  if (permanent.grassTouches + EPSILON < cost) {
    return false;
  }
  permanent.grassTouches -= cost;
  permanent.unlockedModes[helperId].push(modeId);
  return true;
}

function getRankRecord(permanent: PermanentEcosystemState, kind: PermanentRankKind): HelperRankRecord {
  if (kind === "throughput") return permanent.throughputRanks;
  if (kind === "storage") return permanent.storageRanks;
  if (kind === "efficiency") return permanent.efficiencyRanks;
  return permanent.startingStockRanks;
}

export function getPermanentRankCost(
  permanent: PermanentEcosystemState,
  helperId: HelperId,
  kind: PermanentRankKind,
): number {
  const rank = getRankRecord(permanent, kind)[helperId];
  const kindMultiplier = kind === "startingStock" ? 0.8 : kind === "efficiency" ? 1.25 : 1;
  return Math.ceil((4 + HELPERS[helperId].unlockCost * 0.35) * kindMultiplier * Math.pow(rank + 1, 1.32));
}

export function purchasePermanentRank(
  permanent: PermanentEcosystemState,
  helperId: HelperId,
  kind: PermanentRankKind,
): boolean {
  if (!permanent.unlockedHelpers[helperId]) {
    return false;
  }
  const ranks = getRankRecord(permanent, kind);
  const maxRank = kind === "startingStock" ? 5 : 10;
  if (ranks[helperId] >= maxRank) {
    return false;
  }
  const cost = getPermanentRankCost(permanent, helperId, kind);
  if (permanent.grassTouches + EPSILON < cost) {
    return false;
  }
  permanent.grassTouches -= cost;
  ranks[helperId] += 1;
  return true;
}

export function getFieldTierUnlockCost(tier: number): number {
  return FIELD_TIER_COSTS[clampRank(tier, FIELD_TIER_COSTS.length - 1)];
}

export function unlockNextFieldTier(permanent: PermanentEcosystemState): boolean {
  if (permanent.maxFieldTier >= FIELD_SIZE_LADDER.length - 1) {
    return false;
  }
  const nextTier = permanent.maxFieldTier + 1;
  const cost = getFieldTierUnlockCost(nextTier);
  if (permanent.grassTouches + EPSILON < cost) {
    return false;
  }
  permanent.grassTouches -= cost;
  permanent.maxFieldTier = nextTier;
  return true;
}

export function getTouchRankCost(kind: PermanentTouchRankKind, rank: number): number {
  return Math.ceil(TOUCH_RANK_BASE_COST[kind] * Math.pow(rank + 1, 1.42));
}

export function purchaseTouchRank(permanent: PermanentEcosystemState, kind: PermanentTouchRankKind): boolean {
  const currentRank = kind === "fastTouch"
    ? permanent.fastTouchRank
    : kind === "broadPalm"
      ? permanent.broadPalmRank
      : permanent.manyHandsRank;
  if (currentRank >= 10) {
    return false;
  }
  if (kind === "manyHands" && permanent.broadPalmRank < 2) {
    return false;
  }
  const cost = getTouchRankCost(kind, currentRank);
  if (permanent.grassTouches + EPSILON < cost) {
    return false;
  }
  permanent.grassTouches -= cost;
  if (kind === "fastTouch") {
    permanent.fastTouchRank += 1;
  } else if (kind === "broadPalm") {
    permanent.broadPalmRank += 1;
  } else {
    permanent.manyHandsRank += 1;
  }
  return true;
}

export function purchaseFieldEmbrace(permanent: PermanentEcosystemState): boolean {
  const cost = 180;
  if (
    permanent.fieldEmbrace ||
    permanent.broadPalmRank < 10 ||
    permanent.manyHandsRank < 10 ||
    permanent.grassTouches + EPSILON < cost
  ) {
    return false;
  }
  permanent.grassTouches -= cost;
  permanent.fieldEmbrace = true;
  return true;
}

function nextRandomState(state: number): number {
  let value = state >>> 0 || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function randomUnit(state: EcosystemState): number {
  state.rngState = nextRandomState(state.rngState);
  return state.rngState / 0x1_0000_0000;
}

function getChunkIndex(field: EcosystemFieldState, tileX: number, tileY: number): number {
  return Math.floor(tileY / FIELD_CHUNK_SIZE) * field.chunkColumns + Math.floor(tileX / FIELD_CHUNK_SIZE);
}

function getTileChunkIndex(field: EcosystemFieldState, tileIndex: number): number {
  const x = tileIndex % field.width;
  const y = Math.floor(tileIndex / field.width);
  return getChunkIndex(field, x, y);
}

export function rebuildChunkStageCounts(field: EcosystemFieldState): void {
  field.chunkStageCounts.fill(0);
  for (let index = 0; index < field.stages.length; index += 1) {
    const chunkIndex = getTileChunkIndex(field, index);
    const stage = field.stages[index];
    field.chunkStageCounts[chunkIndex * TILE_STAGE_COUNT + stage] += 1;
  }
}

export function setTileStage(field: EcosystemFieldState, tileIndex: number, nextStage: TileStage): boolean {
  if (tileIndex < 0 || tileIndex >= field.stages.length) {
    return false;
  }
  const previous = field.stages[tileIndex] as TileStage;
  if (previous === nextStage) {
    return false;
  }
  const chunkIndex = getTileChunkIndex(field, tileIndex);
  field.stages[tileIndex] = nextStage;
  field.chunkStageCounts[chunkIndex * TILE_STAGE_COUNT + previous] -= 1;
  field.chunkStageCounts[chunkIndex * TILE_STAGE_COUNT + nextStage] += 1;
  field.dirtyChunks[chunkIndex] = 1;
  return true;
}

function advanceTileStage(field: EcosystemFieldState, tileIndex: number): void {
  const current = field.stages[tileIndex] as TileStage;
  const next = current >= TileStage.Rooted ? TileStage.Dewy : ((current + 1) as TileStage);
  setTileStage(field, tileIndex, next);
}

function refreshResourceCapacities(state: EcosystemState, permanent: PermanentEcosystemState): void {
  for (const resourceId of PRODUCTION_RESOURCE_IDS) {
    const buffer = state.resources[resourceId];
    buffer.capacity = getCapacity(resourceId, permanent, state.field);
    buffer.amount = Math.min(buffer.amount, buffer.capacity);
  }
}

function expandField(state: EcosystemState, permanent: PermanentEcosystemState): void {
  const oldField = state.field;
  const nextIndex = Math.min(oldField.sizeIndex + 1, permanent.maxFieldTier, FIELD_SIZE_LADDER.length - 1);
  if (nextIndex <= oldField.sizeIndex) {
    return;
  }
  const nextField = createField(nextIndex, state.rngState);
  const offsetX = Math.floor((nextField.width - oldField.width) / 2);
  const offsetY = Math.floor((nextField.height - oldField.height) / 2);
  for (let y = 0; y < oldField.height; y += 1) {
    for (let x = 0; x < oldField.width; x += 1) {
      const oldIndex = y * oldField.width + x;
      const nextIndexValue = (y + offsetY) * nextField.width + x + offsetX;
      nextField.stages[nextIndexValue] = oldField.stages[oldIndex];
    }
  }
  nextField.cultivationRank = 0;
  rebuildChunkStageCounts(nextField);
  nextField.dirtyChunks.fill(1);
  state.field = nextField;
  refreshResourceCapacities(state, permanent);
}

function addResource(state: EcosystemState, resourceId: ProductionResourceId, amount: number): number {
  if (amount <= 0) {
    return 0;
  }
  const buffer = state.resources[resourceId];
  const accepted = Math.max(0, Math.min(amount, buffer.capacity - buffer.amount));
  buffer.amount += accepted;
  buffer.producedTotal += accepted;
  return accepted;
}

function consumeResource(state: EcosystemState, resourceId: ProductionResourceId, amount: number): number {
  if (amount <= 0) {
    return 0;
  }
  const buffer = state.resources[resourceId];
  const consumed = Math.max(0, Math.min(amount, buffer.amount));
  buffer.amount -= consumed;
  buffer.consumedTotal += consumed;
  return consumed;
}

function getRecipeInputMultiplier(permanent: PermanentEcosystemState, recipe: ProductionRecipe): number {
  if (!recipe.helperId) {
    return 1;
  }
  return 1 - permanent.efficiencyRanks[recipe.helperId] * 0.035;
}

function performRecipe(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
  recipe: ProductionRecipe,
  requestedCycles: number,
  producedThisTick: ProductionRateRecord,
): number {
  if (requestedCycles <= EPSILON) {
    return 0;
  }
  const inputMultiplier = getRecipeInputMultiplier(permanent, recipe);
  let cycles = requestedCycles;
  let pauseReason: string | null = null;

  for (const input of recipe.inputs) {
    const needPerCycle = input.amount * inputMultiplier;
    if (needPerCycle <= 0) continue;
    const availableCycles = state.resources[input.resourceId].amount / needPerCycle;
    if (availableCycles < cycles) {
      cycles = availableCycles;
      pauseReason = `Needs ${input.resourceId}`;
    }
  }
  for (const output of recipe.outputs) {
    if (output.amount <= 0) continue;
    const buffer = state.resources[output.resourceId];
    const roomCycles = (buffer.capacity - buffer.amount) / output.amount;
    if (roomCycles < cycles) {
      cycles = roomCycles;
      pauseReason = `${output.resourceId} storage full`;
    }
  }
  cycles = Math.max(0, cycles);

  if (recipe.helperId) {
    state.helpers[recipe.helperId].lastPauseReason = cycles <= EPSILON ? pauseReason ?? "Paused" : null;
  }
  if (cycles <= EPSILON) {
    return 0;
  }

  for (const input of recipe.inputs) {
    consumeResource(state, input.resourceId, input.amount * inputMultiplier * cycles);
  }
  for (const output of recipe.outputs) {
    const added = addResource(state, output.resourceId, output.amount * cycles);
    producedThisTick[output.resourceId] += added;
  }
  if (recipe.runTouchesPerCycle) {
    const gained = recipe.runTouchesPerCycle * cycles;
    state.runTouches += gained;
    state.runTouchesEarned += gained;
  }
  if (recipe.helperId) {
    const helper = state.helpers[recipe.helperId];
    helper.cyclesCompleted += cycles;
    helper.pulseProgress += cycles;
    const pulses = Math.floor(helper.pulseProgress);
    if (pulses > 0) {
      helper.pulseProgress -= pulses;
      state.helperPulses[recipe.helperId] += pulses;
    }
  }
  state.field.stageProgress += cycles * (recipe.natural ? 0.18 : 0.62);
  return cycles;
}

function getScourgeDemand(state: EcosystemState, permanent: PermanentEcosystemState): number {
  const ageSeconds = state.elapsedMs / 1_000;
  if (state.runNumber === 1) {
    return FIRST_RUN_SCOURGE_BASE * Math.pow(1 + ageSeconds / FIRST_RUN_SCOURGE_RAMP_SECONDS, 2.12);
  }
  const unlockedHelperCount = HELPER_IDS.reduce(
    (count, helperId) => count + (permanent.unlockedHelpers[helperId] ? 1 : 0),
    0,
  );
  const activeHelperKinds = HELPER_IDS.reduce(
    (count, helperId) => count + (state.helpers[helperId].count > 0 ? 1 : 0),
    0,
  );
  const capabilityTier = Math.min(
    unlockedHelperCount,
    Math.max(1, activeHelperKinds),
  );
  const rampSeconds = capabilityTier === 0
    ? PRE_AUTOMATION_SCOURGE_RAMP_SECONDS
    : capabilityTier === 1
      ? FIRST_AUTOMATION_SCOURGE_RAMP_SECONDS
    : capabilityTier <= 5
      ? 30 * Math.pow(1.9, capabilityTier)
      : 1_520 * Math.pow(1.34, capabilityTier - 5);
  const ageRatio = ageSeconds / rampSeconds;
  const tileScale = 1 + Math.log2(state.field.stages.length + 1) * 0.11;
  const baseDemand = capabilityTier <= 5
    ? EARLY_SCOURGE_BASE_BY_CAPABILITY[capabilityTier]
    : 0.72;
  return baseDemand * tileScale * Math.pow(1 + ageRatio, 2.12);
}

function advanceRepresentativeTiles(state: EcosystemState): void {
  let advances = Math.min(12, Math.floor(state.field.stageProgress));
  if (advances <= 0 || state.field.stages.length === 0) {
    return;
  }
  state.field.stageProgress -= advances;
  while (advances > 0) {
    const index = state.field.stageCursor % state.field.stages.length;
    advanceTileStage(state.field, index);
    state.field.stageCursor = (index + 1 + (state.rngState % 3)) % state.field.stages.length;
    state.rngState = nextRandomState(state.rngState);
    advances -= 1;
  }
}

function updateBottleneck(state: EcosystemState): void {
  const paused = HELPER_IDS.find((helperId) => state.helpers[helperId].count > 0 && state.helpers[helperId].lastPauseReason);
  if (state.careDeficitPerSecond > 0.01) {
    state.bottleneck = `Care short ${state.careDeficitPerSecond.toFixed(1)}/s`;
  } else if (paused) {
    state.bottleneck = `${HELPERS[paused].label}: ${state.helpers[paused].lastPauseReason}`;
  } else {
    let lowest: ProductionResourceId = "dew";
    let lowestRatio = Number.POSITIVE_INFINITY;
    for (const resourceId of PRODUCTION_RESOURCE_IDS) {
      if (resourceId === "care") continue;
      const buffer = state.resources[resourceId];
      const ratio = buffer.amount / Math.max(1, buffer.capacity);
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        lowest = resourceId;
      }
    }
    state.bottleneck = `${lowest} stock low`;
  }
}

function finishRun(state: EcosystemState, permanent: PermanentEcosystemState): void {
  if (!state.active) {
    return;
  }
  state.active = false;
  state.hp = 0;
  const careProduced = state.resources.care.producedTotal;
  const minimumAward = permanent.completedRuns === 0
    ? Math.max(
      getHelperUnlockCost("tinySprinkler"),
      getTouchRankCost("broadPalm", 0),
    )
    : 5;
  const award = Math.max(
    minimumAward,
    Math.floor((careProduced + state.manualCareTotal) / 7.5) + Math.floor(state.field.sizeIndex * 2.5),
  );
  permanent.grassTouches += award;
  permanent.completedRuns += 1;
  state.endedSummary = {
    durationMs: state.elapsedMs,
    fieldSize: state.field.width,
    cultivationRank: state.field.cultivationRank,
    careProduced,
    manualCare: state.manualCareTotal,
    runTouchesEarned: state.runTouchesEarned,
    helpersBought: state.helperPurchaseCount,
    touches: state.manualTouchCount,
    grassTouchesAwarded: award,
  };
}

function runFixedTick(state: EcosystemState, permanent: PermanentEcosystemState): void {
  if (state.runNumber === 1) {
    enforceRunOneBareHands(state);
  }
  if (state.runNumber === 1 && state.manualTouchCount === 0) {
    state.scourgeDemandPerSecond = 0;
    state.careDeficitPerSecond = 0;
    state.bottleneck = "Touch the field to wake the Scourge";
    return;
  }
  const tickSeconds = PRODUCTION_TICK_MS / 1_000;
  state.elapsedMs += PRODUCTION_TICK_MS;
  state.fixedTicks += 1;
  const producedThisTick = createRateRecord();
  const equipmentAvailable = isRunEquipmentAvailable(state);

  for (const helperId of HELPER_IDS) {
    const helper = state.helpers[helperId];
    if (!equipmentAvailable) {
      helper.reconfigureRemainingMs = 0;
      helper.pulseProgress = 0;
      helper.cyclesCompleted = 0;
      helper.lastPauseReason = null;
      state.helperPulses[helperId] = 0;
      continue;
    }
    helper.reconfigureRemainingMs = Math.max(0, helper.reconfigureRemainingMs - PRODUCTION_TICK_MS);
    helper.lastPauseReason = helper.reconfigureRemainingMs > 0 ? "Reconfiguring" : null;
  }

  const fieldScale = Math.max(1, Math.sqrt(state.field.stages.length));
  for (const recipe of PRODUCTION_RECIPES) {
    if (recipe.helperId) {
      if (!equipmentAvailable) {
        continue;
      }
      const helper = state.helpers[recipe.helperId];
      if (helper.count <= 0 || helper.modeId !== recipe.modeId || helper.reconfigureRemainingMs > 0) {
        continue;
      }
      const throughput = getHelperThroughputMultiplier(permanent.throughputRanks[recipe.helperId]);
      const requested = recipe.cyclesPerSecond * helper.count * throughput * tickSeconds;
      performRecipe(state, permanent, recipe, requested, producedThisTick);
      continue;
    }
    const naturalScale = recipe.id === "natural-dew"
      ? fieldScale * (1 + state.field.cultivationRank * 0.12)
      : Math.max(1, fieldScale * 0.18);
    performRecipe(state, permanent, recipe, recipe.cyclesPerSecond * naturalScale * tickSeconds, producedThisTick);
  }

  state.scourgeDemandPerSecond = getScourgeDemand(state, permanent);
  const demandedCare = state.scourgeDemandPerSecond * tickSeconds;
  const consumedCare = consumeResource(state, "care", demandedCare);
  const deficit = Math.max(0, demandedCare - consumedCare);
  state.careDeficitPerSecond = deficit / tickSeconds;
  if (deficit > 0) {
    state.hp = Math.max(0, state.hp - deficit);
  } else if (state.resources.care.amount > state.resources.care.capacity * 0.45) {
    state.hp = Math.min(state.maxHp, state.hp + 0.08 * tickSeconds);
  }

  for (const resourceId of PRODUCTION_RESOURCE_IDS) {
    state.rates[resourceId] = producedThisTick[resourceId] / tickSeconds;
  }
  advanceRepresentativeTiles(state);
  updateBottleneck(state);
  if (state.hp <= 0) {
    finishRun(state, permanent);
  }
}

export function advanceEcosystem(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
  deltaMs: number,
  speed = 1,
): EcosystemTickResult {
  if (!state.active || speed <= 0 || deltaMs <= 0) {
    return { ticks: 0, gameOver: !state.active, changedChunks: 0 };
  }
  state.tickAccumulatorMs += Math.min(deltaMs, 2_000) * speed;
  let ticks = 0;
  while (state.tickAccumulatorMs + EPSILON >= PRODUCTION_TICK_MS && ticks < 32 && state.active) {
    state.tickAccumulatorMs -= PRODUCTION_TICK_MS;
    runFixedTick(state, permanent);
    ticks += 1;
  }
  return {
    ticks,
    gameOver: !state.active,
    changedChunks: ticks > 0 ? countDirtyChunks(state.field) : 0,
  };
}

export function getBroadPalmRadius(rank: number): number {
  return rank <= 0 ? 0 : 1 + Math.floor((Math.min(10, rank) - 1) / 2);
}

export function getBroadPalmPower(rank: number): number {
  return rank <= 0 ? 0 : 0.4 + (Math.min(10, rank) - 1) * (0.6 / 9);
}

export function getManyHandsPower(rank: number): number {
  return rank <= 0 ? 0 : 0.35 + (Math.min(10, rank) - 1) * (0.45 / 9);
}

export function touchFieldTile(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
  primaryTileIndex: number,
): TouchBatchResult | null {
  if (!state.active || primaryTileIndex < 0 || primaryTileIndex >= state.field.stages.length) {
    return null;
  }
  const impacts = new Map<number, TouchBatchImpact>();
  const addImpact = (tileIndex: number, power: number, kind: TouchBatchImpact["kind"]): void => {
    if (tileIndex < 0 || tileIndex >= state.field.stages.length || impacts.has(tileIndex)) {
      return;
    }
    impacts.set(tileIndex, { tileIndex, power, kind });
  };

  addImpact(primaryTileIndex, 1, "primary");
  const primaryX = primaryTileIndex % state.field.width;
  const primaryY = Math.floor(primaryTileIndex / state.field.width);
  const radius = getBroadPalmRadius(permanent.broadPalmRank);
  const areaPower = getBroadPalmPower(permanent.broadPalmRank);
  if (radius > 0) {
    for (let y = Math.max(0, primaryY - radius); y <= Math.min(state.field.height - 1, primaryY + radius); y += 1) {
      for (let x = Math.max(0, primaryX - radius); x <= Math.min(state.field.width - 1, primaryX + radius); x += 1) {
        if (x === primaryX && y === primaryY) continue;
        const distance = Math.hypot(x - primaryX, y - primaryY);
        if (distance <= radius + 0.25) {
          addImpact(y * state.field.width + x, areaPower, "area");
        }
      }
    }
  }

  const chainCount = permanent.manyHandsRank * 2;
  const chainPower = getManyHandsPower(permanent.manyHandsRank);
  let attempts = 0;
  let addedChains = 0;
  while (addedChains < chainCount && impacts.size < state.field.stages.length && attempts < chainCount * 20 + 20) {
    const tileIndex = Math.floor(randomUnit(state) * state.field.stages.length);
    const before = impacts.size;
    addImpact(tileIndex, chainPower, "chain");
    if (impacts.size > before) addedChains += 1;
    attempts += 1;
  }

  const wakesFirstRunScourge = state.runNumber === 1 && state.manualTouchCount === 0;
  state.manualTouchCount += 1;
  const embraceTriggered = permanent.fieldEmbrace && state.manualTouchCount % 10 === 0;
  if (embraceTriggered) {
    for (let chunkY = 0; chunkY < state.field.chunkRows; chunkY += 1) {
      for (let chunkX = 0; chunkX < state.field.chunkColumns; chunkX += 1) {
        const startX = chunkX * FIELD_CHUNK_SIZE;
        const startY = chunkY * FIELD_CHUNK_SIZE;
        const chunkWidth = Math.min(FIELD_CHUNK_SIZE, state.field.width - startX);
        const chunkHeight = Math.min(FIELD_CHUNK_SIZE, state.field.height - startY);
        let tileIndex = -1;
        for (let retry = 0; retry < 6 && tileIndex < 0; retry += 1) {
          const x = startX + Math.floor(randomUnit(state) * chunkWidth);
          const y = startY + Math.floor(randomUnit(state) * chunkHeight);
          const candidate = y * state.field.width + x;
          if (!impacts.has(candidate)) tileIndex = candidate;
        }
        if (tileIndex >= 0) addImpact(tileIndex, 0.5, "embrace");
      }
    }
  }

  let baseTotalPower = 0;
  for (const impact of impacts.values()) {
    baseTotalPower += impact.power;
    advanceTileStage(state.field, impact.tileIndex);
  }
  const totalPower = baseTotalPower * getManualTouchPowerMultiplier(permanent);
  const healedHp = state.runNumber === 1
    ? 0
    : Math.min(state.maxHp - state.hp, totalPower * 5.2);
  state.hp += healedHp;
  state.manualCareTotal += healedHp;
  const dewGained = addResource(state, "dew", totalPower * 1.15);
  const runTouchesGained = totalPower * 0.92;
  state.runTouches += runTouchesGained;
  state.runTouchesEarned += runTouchesGained;
  if (wakesFirstRunScourge) {
    state.hp = Math.min(state.hp, FIRST_RUN_OPENING_HP);
    state.scourgeDemandPerSecond = FIRST_RUN_SCOURGE_BASE;
    state.careDeficitPerSecond = FIRST_RUN_SCOURGE_BASE;
    state.bottleneck = "The Scourge has broken through";
  }

  const representativeImpacts = [...impacts.values()].slice(0, MAX_REPRESENTATIVE_IMPACTS);
  return {
    primaryTileIndex,
    affectedTileCount: impacts.size,
    totalPower,
    healedHp,
    dewGained,
    runTouchesGained,
    fieldEmbraceTriggered: embraceTriggered,
    representativeImpacts,
  };
}

export function consumeHelperPulses(state: EcosystemState): HelperRankRecord {
  const pulses = isRunEquipmentAvailable(state)
    ? { ...state.helperPulses }
    : createHelperNumberRecord();
  for (const helperId of HELPER_IDS) {
    state.helperPulses[helperId] = 0;
  }
  return pulses;
}

export function countDirtyChunks(field: EcosystemFieldState): number {
  let count = 0;
  for (let index = 0; index < field.dirtyChunks.length; index += 1) {
    count += field.dirtyChunks[index] === 1 ? 1 : 0;
  }
  return count;
}

export function clearDirtyChunks(field: EcosystemFieldState): void {
  field.dirtyChunks.fill(0);
}

export function getDominantChunkStage(field: EcosystemFieldState, chunkIndex: number): TileStage {
  const start = chunkIndex * TILE_STAGE_COUNT;
  let bestStage = TileStage.Dormant;
  let bestCount = -1;
  for (let stage = 0; stage < TILE_STAGE_COUNT; stage += 1) {
    const count = field.chunkStageCounts[start + stage];
    if (count > bestCount) {
      bestCount = count;
      bestStage = stage as TileStage;
    }
  }
  return bestStage;
}

export function getEcosystemReadout(state: EcosystemState): EcosystemReadout {
  return {
    hp: state.hp,
    maxHp: state.maxHp,
    hpRatio: state.maxHp > 0 ? state.hp / state.maxHp : 0,
    elapsedMs: state.elapsedMs,
    fieldSize: state.field.width,
    tileCount: state.field.stages.length,
    cultivationRank: state.field.cultivationRank,
    scourgeDemandPerSecond: state.scourgeDemandPerSecond,
    careProductionPerSecond: state.rates.care,
    careDeficitPerSecond: state.careDeficitPerSecond,
    runTouches: state.runTouches,
    bottleneck: state.bottleneck,
    fixedTicks: state.fixedTicks,
    logicalTiles: state.field.stages.length,
    dirtyChunks: countDirtyChunks(state.field),
  };
}

export function forceGameOver(state: EcosystemState, permanent: PermanentEcosystemState): void {
  if (!state.active) return;
  state.hp = 0;
  finishRun(state, permanent);
}

export function createNextEcosystemRun(permanent: PermanentEcosystemState, seed?: number): EcosystemState {
  return createEcosystemState(permanent, { seed: seed ?? (0x5eed_2026 + permanent.completedRuns * 7919) });
}

export function setPrototypeFieldSize(
  state: EcosystemState,
  permanent: PermanentEcosystemState,
  requestedSize: number,
): void {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  FIELD_SIZE_LADDER.forEach((size, index) => {
    const distance = Math.abs(size - requestedSize);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  permanent.maxFieldTier = Math.max(permanent.maxFieldTier, closestIndex);
  state.field = createField(closestIndex, state.rngState);
  refreshResourceCapacities(state, permanent);
}

export function unlockAllPrototypeMemories(permanent: PermanentEcosystemState): void {
  permanent.maxFieldTier = FIELD_SIZE_LADDER.length - 1;
  permanent.fastTouchRank = 10;
  permanent.broadPalmRank = 10;
  permanent.manyHandsRank = 10;
  permanent.fieldEmbrace = true;
  for (const helperId of HELPER_IDS) {
    permanent.unlockedHelpers[helperId] = true;
    permanent.unlockedModes[helperId] = HELPERS[helperId].modes.map((mode) => mode.id);
    permanent.throughputRanks[helperId] = 6;
    permanent.storageRanks[helperId] = 6;
    permanent.efficiencyRanks[helperId] = 6;
    permanent.startingStockRanks[helperId] = 3;
  }
}
