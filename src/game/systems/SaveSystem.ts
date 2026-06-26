import { MAX_FIELD_TILES, createInitialState } from "./FieldSystem";
import { isAutomationDirectiveId } from "./AutomationDirectiveSystem";
import { DEFAULT_GAME_TRACK_ID, TRACK_IDS } from "./ChiptuneMusicSystem";
import { createAutomationStatsState } from "./AutomationProgressSystem";
import { createPrestigeState } from "./PrestigeSystem";
import { normalizeGrassTouches } from "./AmountSystem";
import { isCharacterClassId } from "../data/character-classes";
import { getGrassTier } from "../data/grass-tiers";
import { CURRENT_SAVE_VERSION } from "../types/game-state";
import type {
  CharacterClassId,
  AutomationStatsState,
  AutomationSystemState,
  DebuffState,
  FieldTile,
  GameState,
  GrassTierId,
  HazardStatsState,
  InventoryEntry,
  JournalHazardId,
  JournalState,
  PlacedWorldObject,
  PrestigeState,
  TileHazardState,
  TileKey,
  TileTrait,
  UpgradeState,
  WeatherId,
} from "../types/game-state";

const SAVE_KEY = "grass-touching-simulator.save.v1";
const VALID_GRASS_TIERS = ["normal", "thick", "clover", "golden", "wildflower", "moss", "mushroom", "crystal", "frost"] as const;
const LEGACY_DEFAULT_GAME_TRACK_ID = "cozy_meadow";
const GRASSLANDS_GROOVE_DEFAULT_SAVE_VERSION = 14;

type SaveProfiler = <T>(name: string, callback: () => T) => T;

const runUnprofiled: SaveProfiler = (_name, callback) => callback();

export function saveGame(state: GameState, profile: SaveProfiler = runUnprofiled): void {
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.lastSavedAt = Date.now();
  const serialized = profile("save:stringify", () => JSON.stringify(state));
  profile("save:localStorage", () => localStorage.setItem(SAVE_KEY, serialized));
}

export function loadGame(): GameState {
  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(rawSave) as unknown;
    return isRecord(parsed) ? migrateGameState(parsed) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function resetSave(characterClassId?: CharacterClassId): GameState {
  localStorage.removeItem(SAVE_KEY);
  return createInitialState(characterClassId);
}

function migrateGameState(saved: Record<string, unknown>): GameState {
  const initial = createInitialState();
  const field = normalizeField(saved.field, initial.field);
  const savedVersion = readNumber(saved.saveVersion, 0);

  const seedShopPurchases = readBooleanRecord(saved.seedShopPurchases);
  const inventory = readRecord<InventoryEntry>(saved.inventory);

  return {
    ...initial,
    saveVersion: CURRENT_SAVE_VERSION,
    characterClassId: isCharacterClassId(saved.characterClassId) ? saved.characterClassId : initial.characterClassId,
    grassTouches: normalizeGrassTouches(saved.grassTouches, initial.grassTouches),
    seeds: readNumber(saved.seeds, initial.seeds),
    lifetimeSeeds: readNumber(saved.lifetimeSeeds, initial.lifetimeSeeds),
    gold: readNumber(saved.gold, initial.gold),
    lifetimeGold: readNumber(saved.lifetimeGold, initial.lifetimeGold),
    lifetimeGrassTouches: normalizeGrassTouches(saved.lifetimeGrassTouches, initial.lifetimeGrassTouches),
    totalClickedPatches: readNumber(saved.totalClickedPatches, initial.totalClickedPatches),
    wateredPatches: readNumber(saved.wateredPatches, initial.wateredPatches),
    mutationEvents: readNumber(saved.mutationEvents, initial.mutationEvents),
    hazardStats: readHazardStats(saved.hazardStats, initial.hazardStats),
    field,
    tileHazards: readTileHazards(saved.tileHazards, field),
    debuffs: readDebuffs(saved.debuffs),
    upgrades: readRecord<UpgradeState>(saved.upgrades),
    seedShopPurchases,
    inventory,
    placedWorldObjects: readPlacedWorldObjects(saved.placedWorldObjects, field),
    reachedMilestones: Array.isArray(saved.reachedMilestones)
      ? saved.reachedMilestones.filter((milestone): milestone is string => typeof milestone === "string")
      : initial.reachedMilestones,
    claimedQuestIds: Array.isArray(saved.claimedQuestIds)
      ? saved.claimedQuestIds.filter((questId): questId is string => typeof questId === "string")
      : initial.claimedQuestIds,
    journal: readJournal(saved.journal, initial.journal),
    activeWeatherId: readWeatherId(saved.activeWeatherId, initial.activeWeatherId),
    weatherEndsAt: readNumber(saved.weatherEndsAt, initial.weatherEndsAt ?? 0),
    selectedTrackId: readSelectedTrackId(saved.selectedTrackId, initial.selectedTrackId, savedVersion),
    automationDirectiveId: isAutomationDirectiveId(saved.automationDirectiveId)
      ? saved.automationDirectiveId
      : initial.automationDirectiveId,
    automationStats: readAutomationStats(saved.automationStats, initial.automationStats),
    automationSystems: readAutomationSystems(saved.automationSystems, seedShopPurchases, inventory, savedVersion),
    prestige: readPrestigeState(saved.prestige, initial.prestige),
    lastSavedAt: readNumber(saved.lastSavedAt, initial.lastSavedAt),
  };
}

function normalizeField(value: unknown, fallback: Record<TileKey, FieldTile>): Record<TileKey, FieldTile> {
  if (!isRecord(value)) {
    return fallback;
  }

  const field: Record<TileKey, FieldTile> = {};
  let tileCount = 0;

  for (const [key, tileValue] of Object.entries(value)) {
    if (tileCount >= MAX_FIELD_TILES) {
      break;
    }

    if (!isRecord(tileValue)) {
      continue;
    }

    const tier = readGrassTier(tileValue.tier);
    field[key as TileKey] = {
      x: readNumber(tileValue.x, 0),
      y: readNumber(tileValue.y, 0),
      grassState: tileValue.grassState === "regrowing" ? "regrowing" : "grown",
      trait: readTileTrait(tileValue.trait),
      tier,
      regrowEndsAt: readNumber(tileValue.regrowEndsAt, 0),
      baseTouchValue: getGrassTier(tier).touchValue,
      baseRegrowMs: readNumber(tileValue.baseRegrowMs, 2600),
      fertility: readNumber(tileValue.fertility, 0.5),
      moisture: readNumber(tileValue.moisture, 0.5),
    };
    tileCount += 1;
  }

  return Object.keys(field).length > 0 ? field : fallback;
}

function readRecord<T>(value: unknown): Record<string, T> {
  return isRecord(value) ? (value as Record<string, T>) : {};
}

function readBooleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
}

function readPlacedWorldObjects(value: unknown, field: Record<TileKey, FieldTile>): Record<string, PlacedWorldObject> {
  if (!isRecord(value)) {
    return {};
  }

  const placements: Record<string, PlacedWorldObject> = {};

  for (const [objectId, placement] of Object.entries(value)) {
    if (!isRecord(placement) || typeof placement.tileKey !== "string" || !field[placement.tileKey as TileKey]) {
      continue;
    }

    placements[objectId] = { tileKey: placement.tileKey as TileKey };
  }

  return placements;
}

function readTileHazards(value: unknown, field: Record<TileKey, FieldTile>): Partial<Record<TileKey, TileHazardState>> {
  if (!isRecord(value)) {
    return {};
  }

  const hazards: Partial<Record<TileKey, TileHazardState>> = {};
  const now = Date.now();

  for (const [key, hazard] of Object.entries(value)) {
    if (!field[key as TileKey] || !isRecord(hazard) || (hazard.id !== "cactus" && hazard.id !== "weeds")) {
      continue;
    }

    const expiresAt = readNumber(hazard.expiresAt, 0);
    if (expiresAt <= now) {
      continue;
    }

    hazards[key as TileKey] = {
      id: hazard.id,
      createdAt: readNumber(hazard.createdAt, now),
      expiresAt,
      strength: hazard.id === "weeds" ? Math.max(1, Math.min(3, Math.floor(readNumber(hazard.strength, 1)))) : undefined,
    };
  }

  return hazards;
}

function readDebuffs(value: unknown): Partial<Record<DebuffState["id"], DebuffState>> {
  if (!isRecord(value)) {
    return {};
  }

  const debuffs: Partial<Record<DebuffState["id"], DebuffState>> = {};
  const pricked = value.pricked;
  const now = Date.now();
  if (isRecord(pricked) && pricked.id === "pricked") {
    const expiresAt = readNumber(pricked.expiresAt, 0);
    if (expiresAt > now) {
      debuffs.pricked = { id: "pricked", expiresAt };
    }
  }

  return debuffs;
}

function readJournal(value: unknown, fallback: JournalState): JournalState {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    discoveredGrassTiers: readGrassTierArray(value.discoveredGrassTiers, fallback.discoveredGrassTiers),
    discoveredTileTraits: readTileTraitArray(value.discoveredTileTraits, fallback.discoveredTileTraits),
    seenWeatherIds: readWeatherIdArray(value.seenWeatherIds, fallback.seenWeatherIds),
    seenHazardIds: readJournalHazardIdArray(value.seenHazardIds, fallback.seenHazardIds),
    bestComboCount: readNumber(value.bestComboCount, fallback.bestComboCount),
  };
}

function readHazardStats(value: unknown, fallback: HazardStatsState): HazardStatsState {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    cactusCleared: readCount(value.cactusCleared, fallback.cactusCleared),
    weedsPulled: readCount(value.weedsPulled, fallback.weedsPulled),
    weedsCleared: readCount(value.weedsCleared, fallback.weedsCleared),
    prickedCount: readCount(value.prickedCount, fallback.prickedCount),
    mowerPasses: readCount(value.mowerPasses, fallback.mowerPasses),
    mowerTilesMown: readCount(value.mowerTilesMown, fallback.mowerTilesMown),
    hazardsClearedByMower: readCount(value.hazardsClearedByMower, fallback.hazardsClearedByMower),
  };
}

function readAutomationStats(value: unknown, fallback: AutomationStatsState): AutomationStatsState {
  const base = createAutomationStatsState();
  if (!isRecord(value)) {
    return fallback;
  }

  const usedDirectiveIds = Array.isArray(value.usedDirectiveIds)
    ? value.usedDirectiveIds.filter((directiveId): directiveId is AutomationStatsState["usedDirectiveIds"][number] =>
        isAutomationDirectiveId(directiveId),
      )
    : base.usedDirectiveIds;

  return {
    automatedActions: readNumber(value.automatedActions, base.automatedActions),
    automatedGrassTouches: normalizeGrassTouches(value.automatedGrassTouches, base.automatedGrassTouches),
    automationSupplyDrops: readNumber(value.automationSupplyDrops, base.automationSupplyDrops),
    bestAutomationComboCount: readNumber(value.bestAutomationComboCount, base.bestAutomationComboCount),
    usedDirectiveIds: unique(usedDirectiveIds.length > 0 ? usedDirectiveIds : base.usedDirectiveIds),
  };
}

function readAutomationSystems(
  value: unknown,
  seedShopPurchases: Record<string, boolean>,
  inventory: Record<string, InventoryEntry>,
  savedVersion: number,
): Record<string, AutomationSystemState> {
  const systems: Record<string, AutomationSystemState> = {};

  if (isRecord(value)) {
    for (const [systemId, systemValue] of Object.entries(value)) {
      if (!isRecord(systemValue)) {
        continue;
      }

      const owned = Math.max(0, Math.floor(readNumber(systemValue.owned, 0)));
      if (owned > 0) {
        systems[systemId] = { owned };
      }
    }
  }

  const legacyAutomationIds = ["field_mouse", "bee_hive", "chicken", "sheep", "meadow_rabbit", "earthworm"];
  if (savedVersion < 9 && seedShopPurchases.sprinkler && (systems.sprinkler?.owned ?? 0) < 1) {
    systems.sprinkler = { owned: 1 };
  }

  for (const itemId of legacyAutomationIds) {
    const quantity = Math.max(0, Math.floor(inventory[itemId]?.quantity ?? 0));
    if (quantity > 0 && (systems[itemId]?.owned ?? 0) < quantity) {
      systems[itemId] = { owned: quantity };
    }
  }

  return systems;
}

function readPrestigeState(value: unknown, fallback: PrestigeState): PrestigeState {
  const base = createPrestigeState();
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    resets: Math.max(0, Math.floor(readNumber(value.resets, base.resets))),
    meadowMemory: Math.max(0, Math.floor(readNumber(value.meadowMemory, base.meadowMemory))),
    bestRunGrassTouches: normalizeGrassTouches(value.bestRunGrassTouches, base.bestRunGrassTouches),
    lastRunGrassTouches: normalizeGrassTouches(value.lastRunGrassTouches, base.lastRunGrassTouches),
    totalPrestigeGrassTouches: normalizeGrassTouches(value.totalPrestigeGrassTouches, base.totalPrestigeGrassTouches),
  };
}

function readGrassTierArray(value: unknown, fallback: GrassTierId[]): GrassTierId[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const tiers = value.filter((tier): tier is GrassTierId => isGrassTierId(tier));
  return unique(tiers.length > 0 ? tiers : fallback);
}

function readTileTraitArray(value: unknown, fallback: TileTrait[]): TileTrait[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const traits = value.filter((trait): trait is TileTrait => trait === "normal" || trait === "dewy" || trait === "lush");
  return unique(traits.length > 0 ? traits : fallback);
}

function readWeatherIdArray(value: unknown, fallback: WeatherId[]): WeatherId[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const weatherIds = value
    .map((weatherId) => readWeatherId(weatherId, undefined))
    .filter((weatherId): weatherId is WeatherId => weatherId !== undefined);
  return unique(weatherIds.length > 0 ? weatherIds : fallback);
}

function readJournalHazardIdArray(value: unknown, fallback: JournalHazardId[]): JournalHazardId[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const hazardIds = value.filter((hazardId): hazardId is JournalHazardId => isJournalHazardId(hazardId));
  return unique(hazardIds.length > 0 ? hazardIds : fallback);
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readCount(value: unknown, fallback: number): number {
  return Math.max(0, Math.floor(readNumber(value, fallback)));
}

function readGrassTier(value: unknown): FieldTile["tier"] {
  return isGrassTierId(value) ? value : "normal";
}

function isGrassTierId(value: unknown): value is GrassTierId {
  return typeof value === "string" && (VALID_GRASS_TIERS as readonly string[]).includes(value);
}

function isJournalHazardId(value: unknown): value is JournalHazardId {
  return value === "cactus" || value === "weeds" || value === "pricked" || value === "mower";
}

function readTileTrait(value: unknown): FieldTile["trait"] {
  return value === "dewy" || value === "lush" ? value : "normal";
}

function readWeatherId(value: unknown, fallback: WeatherId | undefined): WeatherId | undefined {
  return value === "calm" ||
    value === "dewy_morning" ||
    value === "warm_sunlight" ||
    value === "lucky_breeze" ||
    value === "seed_wind" ||
    value === "soft_rain" ||
    value === "pollinator_swarm" ||
    value === "golden_hour" ||
    value === "restless_roots"
    ? value
    : fallback;
}

function readSelectedTrackId(value: unknown, fallback: string | undefined, savedVersion: number): string | undefined {
  const trackId = typeof value === "string" && TRACK_IDS.includes(value) ? value : fallback;
  if (savedVersion < GRASSLANDS_GROOVE_DEFAULT_SAVE_VERSION && trackId === LEGACY_DEFAULT_GAME_TRACK_ID) {
    return DEFAULT_GAME_TRACK_ID;
  }

  return trackId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
