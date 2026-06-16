import { MAX_FIELD_TILES, createInitialState } from "./FieldSystem";
import { isAutomationDirectiveId } from "./AutomationDirectiveSystem";
import { createAutomationStatsState } from "./AutomationProgressSystem";
import { normalizeGrassTouches } from "./AmountSystem";
import { isCharacterClassId } from "../data/character-classes";
import { getGrassTier } from "../data/grass-tiers";
import { CURRENT_SAVE_VERSION } from "../types/game-state";
import type {
  CharacterClassId,
  AutomationStatsState,
  AutomationSystemState,
  FieldTile,
  GameState,
  GrassTierId,
  InventoryEntry,
  JournalState,
  PlacedWorldObject,
  TileKey,
  TileTrait,
  UpgradeState,
  WeatherId,
} from "../types/game-state";

const SAVE_KEY = "grass-touching-simulator.save.v1";
const VALID_GRASS_TIERS = ["normal", "thick", "clover", "golden", "wildflower", "moss", "mushroom", "crystal", "frost"] as const;

export function saveGame(state: GameState): void {
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
    mutationEvents: readNumber(saved.mutationEvents, initial.mutationEvents),
    field,
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
    selectedTrackId: typeof saved.selectedTrackId === "string" ? saved.selectedTrackId : initial.selectedTrackId,
    automationDirectiveId: isAutomationDirectiveId(saved.automationDirectiveId)
      ? saved.automationDirectiveId
      : initial.automationDirectiveId,
    automationStats: readAutomationStats(saved.automationStats, initial.automationStats),
    automationSystems: readAutomationSystems(saved.automationSystems, seedShopPurchases, inventory, savedVersion),
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

function readJournal(value: unknown, fallback: JournalState): JournalState {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    discoveredGrassTiers: readGrassTierArray(value.discoveredGrassTiers, fallback.discoveredGrassTiers),
    discoveredTileTraits: readTileTraitArray(value.discoveredTileTraits, fallback.discoveredTileTraits),
    seenWeatherIds: readWeatherIdArray(value.seenWeatherIds, fallback.seenWeatherIds),
    bestComboCount: readNumber(value.bestComboCount, fallback.bestComboCount),
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

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readGrassTier(value: unknown): FieldTile["tier"] {
  return isGrassTierId(value) ? value : "normal";
}

function isGrassTierId(value: unknown): value is GrassTierId {
  return typeof value === "string" && (VALID_GRASS_TIERS as readonly string[]).includes(value);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
