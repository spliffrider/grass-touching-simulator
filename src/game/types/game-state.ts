import type { GrassTouchAmount } from "../systems/AmountSystem";

export type TileKey = `${number},${number}`;

export type GrassState = "grown" | "regrowing";

export type TileTrait = "normal" | "dewy" | "lush";

export type GrassTierId = "normal" | "thick" | "clover" | "golden" | "wildflower" | "moss" | "mushroom" | "crystal" | "frost";

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

export type CharacterClassId = "grass_toucher" | "femboy_slim" | "bard_de_wever";

export type AutomationDirectiveId = "balanced" | "growth" | "harvest" | "supplies" | "autopilot";

export type AutomationSystemId = "sprinkler" | "field_mouse" | "bee_hive" | "earthworm" | "chicken" | "sheep" | "meadow_rabbit";

export const CURRENT_SAVE_VERSION = 11;

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

export interface PlacedWorldObject {
  tileKey: TileKey;
}

export interface JournalState {
  discoveredGrassTiers: GrassTierId[];
  discoveredTileTraits: TileTrait[];
  seenWeatherIds: WeatherId[];
  bestComboCount: number;
}

export interface AutomationStatsState {
  automatedActions: number;
  automatedGrassTouches: GrassTouchAmount;
  automationSupplyDrops: number;
  bestAutomationComboCount: number;
  usedDirectiveIds: AutomationDirectiveId[];
}

export interface AutomationSystemState {
  owned: number;
}

export interface PrestigeState {
  resets: number;
  meadowMemory: number;
  bestRunGrassTouches: GrassTouchAmount;
  lastRunGrassTouches: GrassTouchAmount;
  totalPrestigeGrassTouches: GrassTouchAmount;
}

export interface GameState {
  saveVersion: number;
  characterClassId: CharacterClassId;
  grassTouches: GrassTouchAmount;
  seeds: number;
  lifetimeSeeds: number;
  gold: number;
  lifetimeGold: number;
  lifetimeGrassTouches: GrassTouchAmount;
  totalClickedPatches: number;
  wateredPatches: number;
  mutationEvents: number;
  field: Record<TileKey, FieldTile>;
  upgrades: Record<string, UpgradeState>;
  seedShopPurchases: Record<string, boolean>;
  inventory: Record<string, InventoryEntry>;
  placedWorldObjects: Record<string, PlacedWorldObject>;
  reachedMilestones: string[];
  claimedQuestIds: string[];
  journal: JournalState;
  activeWeatherId?: WeatherId;
  weatherEndsAt?: number;
  selectedTrackId?: string;
  automationDirectiveId: AutomationDirectiveId;
  automationStats: AutomationStatsState;
  automationSystems: Record<string, AutomationSystemState>;
  prestige: PrestigeState;
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
  comboWindowMultiplier: number;
  comboBonusMultiplier: number;
  grassTouchMultiplier: number;
  automationGlobalMultiplier: number;
  automationDiversityBonus: number;
  automationPairSynergyBonus: number;
  automationSystemMultipliers: Record<AutomationSystemId, number>;
}

export interface TouchResult {
  gained: number;
  isCrit: boolean;
  critMultiplier: number;
  doubled: boolean;
  instantRegrown: boolean;
}
