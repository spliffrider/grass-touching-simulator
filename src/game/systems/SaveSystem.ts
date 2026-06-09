import { createInitialState } from "./FieldSystem";
import { getGrassTier } from "../data/grass-tiers";
import { CURRENT_SAVE_VERSION } from "../types/game-state";
import type { FieldTile, GameState, InventoryEntry, TileKey, UpgradeState, WeatherId } from "../types/game-state";

const SAVE_KEY = "grass-touching-simulator.save.v1";

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

export function resetSave(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return createInitialState();
}

function migrateGameState(saved: Record<string, unknown>): GameState {
  const initial = createInitialState();
  const field = normalizeField(saved.field, initial.field);

  return {
    ...initial,
    saveVersion: CURRENT_SAVE_VERSION,
    grassTouches: readNumber(saved.grassTouches, initial.grassTouches),
    seeds: readNumber(saved.seeds, initial.seeds),
    lifetimeSeeds: readNumber(saved.lifetimeSeeds, initial.lifetimeSeeds),
    gold: readNumber(saved.gold, initial.gold),
    lifetimeGold: readNumber(saved.lifetimeGold, initial.lifetimeGold),
    lifetimeGrassTouches: readNumber(saved.lifetimeGrassTouches, initial.lifetimeGrassTouches),
    totalClickedPatches: readNumber(saved.totalClickedPatches, initial.totalClickedPatches),
    field,
    upgrades: readRecord<UpgradeState>(saved.upgrades),
    seedShopPurchases: readBooleanRecord(saved.seedShopPurchases),
    inventory: readRecord<InventoryEntry>(saved.inventory),
    reachedMilestones: Array.isArray(saved.reachedMilestones)
      ? saved.reachedMilestones.filter((milestone): milestone is string => typeof milestone === "string")
      : initial.reachedMilestones,
    claimedQuestIds: Array.isArray(saved.claimedQuestIds)
      ? saved.claimedQuestIds.filter((questId): questId is string => typeof questId === "string")
      : initial.claimedQuestIds,
    activeWeatherId: readWeatherId(saved.activeWeatherId, initial.activeWeatherId),
    weatherEndsAt: readNumber(saved.weatherEndsAt, initial.weatherEndsAt ?? 0),
    lastSavedAt: readNumber(saved.lastSavedAt, initial.lastSavedAt),
  };
}

function normalizeField(value: unknown, fallback: Record<TileKey, FieldTile>): Record<TileKey, FieldTile> {
  if (!isRecord(value)) {
    return fallback;
  }

  const field: Record<TileKey, FieldTile> = {};

  for (const [key, tileValue] of Object.entries(value)) {
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

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readGrassTier(value: unknown): FieldTile["tier"] {
  return value === "thick" || value === "clover" || value === "golden" ? value : "normal";
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
