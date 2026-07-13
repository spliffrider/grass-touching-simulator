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

export type HelperRankRecord = Record<HelperId, number>;
export type HelperUnlockRecord = Record<HelperId, boolean>;
export type HelperModeUnlockRecord = Record<HelperId, string[]>;
export type ProductionBufferRecord = Record<ProductionResourceId, ProductionBuffer>;
export type ProductionRateRecord = Record<ProductionResourceId, number>;

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
  broadPalmRank: number;
  manyHandsRank: number;
  fieldEmbrace: boolean;
}

export interface HelperRuntimeState {
  count: number;
  modeId: string;
  reconfigureRemainingMs: number;
  pulseProgress: number;
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

const RESOURCE_STORAGE_HELPER: Record<ProductionResourceId, HelperId> = {
  dew: "tinySprinkler",
  moisture: "tinySprinkler",
  growth: "fieldMouse",
  flowers: "beeHive",
  pollinatedBlooms: "beeHive",
  seeds: "fieldMouse",
  clippings: "chickenPatrol",
  compost: "earthwormCrew",
  humus: "ancientRoots",
  rootEnergy: "ancientRoots",
  care: "sheepLoop",
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
    broadPalmRank: 0,
    manyHandsRank: 0,
    fieldEmbrace: false,
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
  normalized.broadPalmRank = clampRank(Number(source.broadPalmRank), 10);
  normalized.manyHandsRank = clampRank(Number(source.manyHandsRank), 10);
  normalized.fieldEmbrace = source.fieldEmbrace === true;

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

function getCapacity(resourceId: ProductionResourceId, permanent: PermanentEcosystemState, field: EcosystemFieldState): number {
  const helperId = RESOURCE_STORAGE_HELPER[resourceId];
  const memoryMultiplier = 1 + permanent.storageRanks[helperId] * 0.15;
  const cultivationMultiplier = 1 + field.cultivationRank * 0.08;
  const fieldMultiplier = 1 + Math.sqrt(field.width * field.height) * 0.08;
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

function createResourceBuffers(permanent: PermanentEcosystemState, field: EcosystemFieldState): ProductionBufferRecord {
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
    if (!permanent.unlockedHelpers[helperId]) {
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
  return {
    version: ECOSYSTEM_ACTIVE_VERSION,
    active: true,
    runNumber: permanent.completedRuns + 1,
    elapsedMs: 0,
    tickAccumulatorMs: 0,
    fixedTicks: 0,
    rngState: seed,
    hp: 100,
    maxHp: 100,
    scourgeDemandPerSecond: 0.7,
    careDeficitPerSecond: 0,
    runTouches: 0,
    runTouchesEarned: 0,
    manualTouchCount: 0,
    manualCareTotal: 0,
    helperPurchaseCount: 0,
    resources: createResourceBuffers(permanent, field),
    rates: createRateRecord(),
    helpers: createHelperRuntime(),
    helperPulses: createHelperNumberRecord(),
    field,
    bottleneck: "Manual Care",
    endedSummary: null,
  };
}

export function getHelperPurchaseCost(state: EcosystemState, helperId: HelperId): number {
  const definition = HELPERS[helperId];
  return Math.ceil(definition.baseCost * Math.pow(definition.costGrowth, state.helpers[helperId].count));
}

export function buyHelper(state: EcosystemState, permanent: PermanentEcosystemState, helperId: HelperId): boolean {
  if (!state.active || !permanent.unlockedHelpers[helperId]) {
    return false;
  }
  const cost = getHelperPurchaseCost(state, helperId);
  if (state.runTouches + EPSILON < cost) {
    return false;
  }
  state.runTouches -= cost;
  state.helpers[helperId].count += 1;
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
    !state.active ||
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

export function getTouchRankCost(kind: "broadPalm" | "manyHands", rank: number): number {
  const base = kind === "broadPalm" ? 7 : 12;
  return Math.ceil(base * Math.pow(rank + 1, 1.42));
}

export function purchaseTouchRank(permanent: PermanentEcosystemState, kind: "broadPalm" | "manyHands"): boolean {
  const currentRank = kind === "broadPalm" ? permanent.broadPalmRank : permanent.manyHandsRank;
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
  if (kind === "broadPalm") {
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
  const completed = permanent.completedRuns;
  const rampSeconds = completed <= 5 ? 44 * Math.pow(2.03, completed) : 1_520 * Math.pow(1.34, completed - 5);
  const ageRatio = state.elapsedMs / 1_000 / rampSeconds;
  const tileScale = 1 + Math.log2(state.field.stages.length + 1) * 0.11;
  return 0.72 * tileScale * Math.pow(1 + ageRatio, 2.12);
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
  const award = Math.max(
    5,
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
  const tickSeconds = PRODUCTION_TICK_MS / 1_000;
  state.elapsedMs += PRODUCTION_TICK_MS;
  state.fixedTicks += 1;
  const producedThisTick = createRateRecord();

  for (const helperId of HELPER_IDS) {
    const helper = state.helpers[helperId];
    helper.reconfigureRemainingMs = Math.max(0, helper.reconfigureRemainingMs - PRODUCTION_TICK_MS);
    helper.lastPauseReason = helper.reconfigureRemainingMs > 0 ? "Reconfiguring" : null;
  }

  const fieldScale = Math.max(1, Math.sqrt(state.field.stages.length));
  for (const recipe of PRODUCTION_RECIPES) {
    if (recipe.helperId) {
      const helper = state.helpers[recipe.helperId];
      if (helper.count <= 0 || helper.modeId !== recipe.modeId || helper.reconfigureRemainingMs > 0) {
        continue;
      }
      const throughput = 1 + permanent.throughputRanks[recipe.helperId] * 0.12;
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
    return { ticks: 0, gameOver: !state.active, changedChunks: countDirtyChunks(state.field) };
  }
  state.tickAccumulatorMs += Math.min(deltaMs, 2_000) * speed;
  let ticks = 0;
  while (state.tickAccumulatorMs + EPSILON >= PRODUCTION_TICK_MS && ticks < 32 && state.active) {
    state.tickAccumulatorMs -= PRODUCTION_TICK_MS;
    runFixedTick(state, permanent);
    ticks += 1;
  }
  return { ticks, gameOver: !state.active, changedChunks: countDirtyChunks(state.field) };
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

  let totalPower = 0;
  for (const impact of impacts.values()) {
    totalPower += impact.power;
    advanceTileStage(state.field, impact.tileIndex);
  }
  const healedHp = Math.min(state.maxHp - state.hp, totalPower * 5.2);
  state.hp += healedHp;
  state.manualCareTotal += healedHp;
  const dewGained = addResource(state, "dew", totalPower * 1.15);
  const runTouchesGained = totalPower * 0.92;
  state.runTouches += runTouchesGained;
  state.runTouchesEarned += runTouchesGained;

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
  const pulses = { ...state.helperPulses };
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
