export type TileKey = `${number},${number}`;

export type GrassState = "grown" | "regrowing";

export type TileTrait = "normal" | "dewy" | "lush";

export interface FieldTile {
  x: number;
  y: number;
  grassState: GrassState;
  trait: TileTrait;
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
  lifetimeGrassTouches: number;
  totalClickedPatches: number;
  field: Record<TileKey, FieldTile>;
  upgrades: Record<string, UpgradeState>;
  reachedMilestones: string[];
  lastSavedAt: number;
}

export interface RuntimeStats {
  touchMultiplier: number;
  regrowMultiplier: number;
  dewChance: number;
}
