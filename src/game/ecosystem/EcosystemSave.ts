import {
  HELPER_IDS,
  HELPERS,
  PRODUCTION_RESOURCE_IDS,
  type HelperId,
  type ProductionResourceId,
} from "./EcosystemCatalog";
import {
  ECOSYSTEM_ACTIVE_VERSION,
  ECOSYSTEM_PERMANENT_VERSION,
  createEcosystemState,
  createPermanentEcosystemState,
  normalizePermanentEcosystemState,
  rebuildChunkStageCounts,
  type EcosystemRunSummary,
  type EcosystemState,
  type PermanentEcosystemState,
} from "./EcosystemSystem";

export const ECOSYSTEM_PERMANENT_SAVE_KEY = "grass-touching-simulator.ecosystem-memory.v1";
export const ECOSYSTEM_ACTIVE_SAVE_KEY = "grass-touching-simulator.ecosystem-active.v1";

export interface ActiveFieldViewSnapshot {
  centerX: number;
  centerY: number;
  zoom: number;
}

interface ResourceBufferSnapshot {
  amount: number;
  capacity: number;
  producedTotal: number;
  consumedTotal: number;
}

interface HelperRuntimeSnapshot {
  count: number;
  modeId: string;
  reconfigureRemainingMs: number;
  pulseProgress: number;
  lastPauseReason: string | null;
}

export interface ActiveFieldSnapshot {
  version: typeof ECOSYSTEM_ACTIVE_VERSION;
  savedAt: number;
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
  resources: Record<ProductionResourceId, ResourceBufferSnapshot>;
  rates: Record<ProductionResourceId, number>;
  helpers: Record<HelperId, HelperRuntimeSnapshot>;
  field: {
    sizeIndex: number;
    width: number;
    height: number;
    cultivationRank: number;
    stagesBase64: string;
    stageCursor: number;
    stageProgress: number;
    sparseWounds: Array<[number, number]>;
  };
  bottleneck: string;
  endedSummary: EcosystemRunSummary | null;
  view: ActiveFieldViewSnapshot;
}

export interface LoadedActiveField {
  state: EcosystemState;
  view: ActiveFieldViewSnapshot;
}

function finiteNumber(value: unknown, fallback = 0, minimum = Number.NEGATIVE_INFINITY): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(minimum, numeric) : fallback;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function cloneSummary(summary: EcosystemRunSummary | null): EcosystemRunSummary | null {
  return summary ? { ...summary } : null;
}

export function createActiveFieldSnapshot(
  state: EcosystemState,
  view: ActiveFieldViewSnapshot = { centerX: 0.5, centerY: 0.5, zoom: 1 },
): ActiveFieldSnapshot {
  const resources = Object.fromEntries(
    PRODUCTION_RESOURCE_IDS.map((resourceId) => [resourceId, { ...state.resources[resourceId] }]),
  ) as ActiveFieldSnapshot["resources"];
  const rates = Object.fromEntries(
    PRODUCTION_RESOURCE_IDS.map((resourceId) => [resourceId, state.rates[resourceId]]),
  ) as ActiveFieldSnapshot["rates"];
  const helpers = Object.fromEntries(
    HELPER_IDS.map((helperId) => [helperId, { ...state.helpers[helperId] }]),
  ) as ActiveFieldSnapshot["helpers"];

  return {
    version: ECOSYSTEM_ACTIVE_VERSION,
    savedAt: Date.now(),
    active: state.active,
    runNumber: state.runNumber,
    elapsedMs: state.elapsedMs,
    tickAccumulatorMs: state.tickAccumulatorMs,
    fixedTicks: state.fixedTicks,
    rngState: state.rngState,
    hp: state.hp,
    maxHp: state.maxHp,
    scourgeDemandPerSecond: state.scourgeDemandPerSecond,
    careDeficitPerSecond: state.careDeficitPerSecond,
    runTouches: state.runTouches,
    runTouchesEarned: state.runTouchesEarned,
    manualTouchCount: state.manualTouchCount,
    manualCareTotal: state.manualCareTotal,
    helperPurchaseCount: state.helperPurchaseCount,
    resources,
    rates,
    helpers,
    field: {
      sizeIndex: state.field.sizeIndex,
      width: state.field.width,
      height: state.field.height,
      cultivationRank: state.field.cultivationRank,
      stagesBase64: bytesToBase64(state.field.stages),
      stageCursor: state.field.stageCursor,
      stageProgress: state.field.stageProgress,
      sparseWounds: [...state.field.sparseWounds.entries()],
    },
    bottleneck: state.bottleneck,
    endedSummary: cloneSummary(state.endedSummary),
    view: {
      centerX: finiteNumber(view.centerX, 0.5),
      centerY: finiteNumber(view.centerY, 0.5),
      zoom: finiteNumber(view.zoom, 1, 0.1),
    },
  };
}

function isActiveFieldSnapshot(value: unknown): value is ActiveFieldSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ActiveFieldSnapshot>;
  return snapshot.version === ECOSYSTEM_ACTIVE_VERSION &&
    typeof snapshot.field?.stagesBase64 === "string" &&
    Number.isFinite(snapshot.field?.width) &&
    Number.isFinite(snapshot.field?.height);
}

export function restoreActiveFieldSnapshot(
  input: unknown,
  permanent: PermanentEcosystemState,
): LoadedActiveField | null {
  if (!isActiveFieldSnapshot(input)) {
    return null;
  }
  let stages: Uint8Array;
  try {
    stages = base64ToBytes(input.field.stagesBase64);
  } catch {
    return null;
  }
  const width = Math.max(1, Math.floor(finiteNumber(input.field.width, 1, 1)));
  const height = Math.max(1, Math.floor(finiteNumber(input.field.height, width, 1)));
  if (width !== height || stages.length !== width * height || stages.length > 10_000) {
    return null;
  }

  const state = createEcosystemState(permanent, {
    seed: Math.floor(finiteNumber(input.rngState, 1, 1)),
    fieldSizeIndex: Math.max(0, Math.floor(finiteNumber(input.field.sizeIndex, 0))),
  });
  if (state.field.width !== width || state.field.height !== height) {
    return null;
  }
  state.active = input.active === true;
  state.runNumber = Math.max(1, Math.floor(finiteNumber(input.runNumber, permanent.completedRuns + 1, 1)));
  state.elapsedMs = finiteNumber(input.elapsedMs, 0, 0);
  state.tickAccumulatorMs = Math.min(249.999, finiteNumber(input.tickAccumulatorMs, 0, 0));
  state.fixedTicks = Math.floor(finiteNumber(input.fixedTicks, 0, 0));
  state.rngState = Math.floor(finiteNumber(input.rngState, 1, 1)) >>> 0;
  state.hp = finiteNumber(input.hp, 100, 0);
  state.maxHp = finiteNumber(input.maxHp, 100, 1);
  state.hp = Math.min(state.maxHp, state.hp);
  state.scourgeDemandPerSecond = finiteNumber(input.scourgeDemandPerSecond, 0.7, 0);
  state.careDeficitPerSecond = finiteNumber(input.careDeficitPerSecond, 0, 0);
  state.runTouches = finiteNumber(input.runTouches, 0, 0);
  state.runTouchesEarned = finiteNumber(input.runTouchesEarned, 0, 0);
  state.manualTouchCount = Math.floor(finiteNumber(input.manualTouchCount, 0, 0));
  state.manualCareTotal = finiteNumber(input.manualCareTotal, 0, 0);
  state.helperPurchaseCount = Math.floor(finiteNumber(input.helperPurchaseCount, 0, 0));
  state.bottleneck = typeof input.bottleneck === "string" ? input.bottleneck : "Resuming field";
  state.endedSummary = cloneSummary(input.endedSummary);

  for (const resourceId of PRODUCTION_RESOURCE_IDS) {
    const source = input.resources?.[resourceId];
    const target = state.resources[resourceId];
    if (!source) continue;
    target.capacity = finiteNumber(source.capacity, target.capacity, 1);
    target.amount = Math.min(target.capacity, finiteNumber(source.amount, target.amount, 0));
    target.producedTotal = finiteNumber(source.producedTotal, 0, 0);
    target.consumedTotal = finiteNumber(source.consumedTotal, 0, 0);
    state.rates[resourceId] = finiteNumber(input.rates?.[resourceId], 0, 0);
  }

  for (const helperId of HELPER_IDS) {
    const source = input.helpers?.[helperId];
    if (!source) continue;
    const allowedModes = HELPERS[helperId].modes.map((mode) => mode.id);
    state.helpers[helperId].count = Math.floor(finiteNumber(source.count, 0, 0));
    state.helpers[helperId].modeId = allowedModes.includes(source.modeId) ? source.modeId : allowedModes[0];
    state.helpers[helperId].reconfigureRemainingMs = finiteNumber(source.reconfigureRemainingMs, 0, 0);
    state.helpers[helperId].pulseProgress = finiteNumber(source.pulseProgress, 0, 0);
    state.helpers[helperId].lastPauseReason = typeof source.lastPauseReason === "string" ? source.lastPauseReason : null;
  }

  state.field.stages.set(stages);
  state.field.cultivationRank = Math.max(0, Math.min(10, Math.floor(finiteNumber(input.field.cultivationRank, 0, 0))));
  state.field.stageCursor = Math.floor(finiteNumber(input.field.stageCursor, 0, 0)) % state.field.stages.length;
  state.field.stageProgress = finiteNumber(input.field.stageProgress, 0, 0);
  state.field.sparseWounds.clear();
  for (const entry of input.field.sparseWounds ?? []) {
    const tileIndex = Math.floor(finiteNumber(entry[0], -1));
    const timer = finiteNumber(entry[1], 0, 0);
    if (tileIndex >= 0 && tileIndex < state.field.stages.length && timer > 0) {
      state.field.sparseWounds.set(tileIndex, timer);
    }
  }
  rebuildChunkStageCounts(state.field);
  state.field.dirtyChunks.fill(1);

  return {
    state,
    view: {
      centerX: finiteNumber(input.view?.centerX, 0.5),
      centerY: finiteNumber(input.view?.centerY, 0.5),
      zoom: finiteNumber(input.view?.zoom, 1, 0.1),
    },
  };
}

export function loadPermanentEcosystemState(storage: Storage = localStorage): PermanentEcosystemState {
  try {
    const raw = storage.getItem(ECOSYSTEM_PERMANENT_SAVE_KEY);
    if (!raw) return createPermanentEcosystemState();
    const parsed = JSON.parse(raw) as unknown;
    const version = (parsed as Partial<PermanentEcosystemState> | null)?.version;
    return version === ECOSYSTEM_PERMANENT_VERSION
      ? normalizePermanentEcosystemState(parsed)
      : createPermanentEcosystemState();
  } catch {
    return createPermanentEcosystemState();
  }
}

export function savePermanentEcosystemState(
  permanent: PermanentEcosystemState,
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(ECOSYSTEM_PERMANENT_SAVE_KEY, JSON.stringify(permanent));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveField(
  permanent: PermanentEcosystemState,
  storage: Storage = localStorage,
): LoadedActiveField | null {
  try {
    const raw = storage.getItem(ECOSYSTEM_ACTIVE_SAVE_KEY);
    return raw ? restoreActiveFieldSnapshot(JSON.parse(raw) as unknown, permanent) : null;
  } catch {
    return null;
  }
}

export function saveActiveField(
  state: EcosystemState,
  view: ActiveFieldViewSnapshot,
  storage: Storage = localStorage,
): boolean {
  try {
    storage.setItem(ECOSYSTEM_ACTIVE_SAVE_KEY, JSON.stringify(createActiveFieldSnapshot(state, view)));
    return true;
  } catch {
    return false;
  }
}

export function clearActiveField(storage: Storage = localStorage): void {
  try {
    storage.removeItem(ECOSYSTEM_ACTIVE_SAVE_KEY);
  } catch {
    // Storage can be unavailable in privacy modes; the active in-memory run remains valid.
  }
}
