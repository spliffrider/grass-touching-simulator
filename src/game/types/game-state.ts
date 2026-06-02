export type TileKey = `${number},${number}`;

export type GrassState = "grown" | "regrowing";

export type TileTrait = "normal" | "dewy" | "lush";

export type GrassTierId = "normal" | "thick" | "clover" | "golden";

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

export interface GameState {
  grassTouches: number;
  seeds: number;
  lifetimeSeeds: number;
  lifetimeGrassTouches: number;
  totalClickedPatches: number;
  field: Record<TileKey, FieldTile>;
  upgrades: Record<string, UpgradeState>;
  seedShopPurchases: Record<string, boolean>;
  reachedMilestones: string[];
  lastSavedAt: number;
}

export interface RuntimeStats {
  touchMultiplier: number;
  regrowMultiplier: number;
  dewChance: number;
  critChance: number;
  critMultiplier: number;
}

export interface TouchResult {
  gained: number;
  isCrit: boolean;
  critMultiplier: number;
}
