export type TileKey = `${number},${number}`;

export type GrassState = "grown" | "regrowing";

export type TileTrait = "normal" | "dewy" | "lush";

export type GrassTierId = "normal" | "thick" | "clover" | "golden";

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

export type WeatherId =
  | "calm"
  | "dewy_morning"
  | "warm_sunlight"
  | "lucky_breeze"
  | "seed_wind"
  | "soft_rain"
  | "pollinator_swarm"
  | "golden_hour"
  | "restless_roots";

export const CURRENT_SAVE_VERSION = 2;

export interface FieldTile {
  x: number;
  y: number;
  grassState: GrassState;
  trait: TileTrait;
  tier: GrassTierId;
  regrowEndsAt: number;
  baseTouchValue: number;
  baseRegrowMs: number;
  fertility: number;
  moisture: number;
}

export interface UpgradeState {
  level: number;
}

export type InventoryItemKind = "consumable" | "animal";

export interface InventoryEntry {
  quantity: number;
  kind: InventoryItemKind;
}

export interface GameState {
  saveVersion: number;
  grassTouches: number;
  seeds: number;
  lifetimeSeeds: number;
  gold: number;
  lifetimeGold: number;
  lifetimeGrassTouches: number;
  totalClickedPatches: number;
  field: Record<TileKey, FieldTile>;
  upgrades: Record<string, UpgradeState>;
  seedShopPurchases: Record<string, boolean>;
  inventory: Record<string, InventoryEntry>;
  reachedMilestones: string[];
  activeWeatherId?: WeatherId;
  weatherEndsAt?: number;
  lastSavedAt: number;
}

export interface RuntimeStats {
  touchMultiplier: number;
  regrowMultiplier: number;
  dewChance: number;
  critChance: number;
  critMultiplier: number;
  seedDropBonus: number;
  goldDropBonus: number;
  rareTierMultiplier: number;
  rareTouchBonus: number;
  doubleTouchChance: number;
  instantRegrowChance: number;
}

export interface TouchResult {
  gained: number;
  isCrit: boolean;
  critMultiplier: number;
  doubled: boolean;
  instantRegrown: boolean;
}
