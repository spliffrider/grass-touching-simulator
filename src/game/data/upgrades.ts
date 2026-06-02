import type { GameState, RuntimeStats } from "../types/game-state";

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  prerequisiteIds?: string[];
  tree: {
    x: number;
    y: number;
    icon: string;
    color: number;
  };
  apply(stats: RuntimeStats, level: number): void;
  isUnlocked(state: GameState): boolean;
}

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "softer_grass",
    name: "Softer Grass",
    description: "+1 touch value per level.",
    baseCost: 8,
    costGrowth: 1.7,
    maxLevel: 20,
    tree: { x: 70, y: 210, icon: "1", color: 0x9be86b },
    apply: (stats, level) => {
      stats.touchMultiplier += level;
    },
    isUnlocked: () => true,
  },
  {
    id: "faster_regrowth",
    name: "Faster Regrowth",
    description: "Grass regrows 8% faster per level.",
    baseCost: 14,
    costGrowth: 1.8,
    maxLevel: 12,
    prerequisiteIds: ["softer_grass"],
    tree: { x: 215, y: 210, icon: ">>", color: 0x7fd8f0 },
    apply: (stats, level) => {
      stats.regrowMultiplier *= Math.max(0.25, 1 - level * 0.08);
    },
    isUnlocked: () => true,
  },
  {
    id: "dew_appreciation",
    name: "Dew Appreciation",
    description: "Adds a chance for new grass to become dewy.",
    baseCost: 35,
    costGrowth: 2.1,
    maxLevel: 8,
    prerequisiteIds: ["faster_regrowth"],
    tree: { x: 360, y: 120, icon: "dew", color: 0x8feaff },
    apply: (stats, level) => {
      stats.dewChance += level * 0.06;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 25,
  },
  {
    id: "barefoot_confidence",
    name: "Barefoot Confidence",
    description: "A big touch multiplier for the brave.",
    baseCost: 100,
    costGrowth: 2.4,
    maxLevel: 6,
    prerequisiteIds: ["faster_regrowth"],
    tree: { x: 360, y: 300, icon: "feet", color: 0xff7ea8 },
    apply: (stats, level) => {
      stats.touchMultiplier += level * 3;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 75,
  },
  {
    id: "palm_press",
    name: "Palm Press",
    description: "A broader, calmer touch. +2 touch value per level.",
    baseCost: 65,
    costGrowth: 2,
    maxLevel: 8,
    prerequisiteIds: ["softer_grass"],
    tree: { x: 215, y: 90, icon: "hand", color: 0xc9f27b },
    apply: (stats, level) => {
      stats.touchMultiplier += level * 2;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 45,
  },
  {
    id: "lucky_clover",
    name: "Lucky Clover",
    description: "Critical touches happen 3% more often per level.",
    baseCost: 55,
    costGrowth: 1.9,
    maxLevel: 8,
    prerequisiteIds: ["softer_grass"],
    tree: { x: 70, y: 90, icon: "crit", color: 0xffef78 },
    apply: (stats, level) => {
      stats.critChance += level * 0.03;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 25,
  },
  {
    id: "dramatic_touch",
    name: "Dramatic Touch",
    description: "Critical touches gain +0.5x power per level.",
    baseCost: 130,
    costGrowth: 2.15,
    maxLevel: 5,
    prerequisiteIds: ["lucky_clover"],
    tree: { x: 215, y: 330, icon: "x!", color: 0xffb347 },
    apply: (stats, level) => {
      stats.critMultiplier += level * 0.5;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 90,
  },
  {
    id: "fertile_soil",
    name: "Fertile Soil",
    description: "Grass settles into better dirt. Regrowth is 5% faster per level.",
    baseCost: 80,
    costGrowth: 1.95,
    maxLevel: 10,
    prerequisiteIds: ["faster_regrowth"],
    tree: { x: 505, y: 210, icon: "soil", color: 0xb88a55 },
    apply: (stats, level) => {
      stats.regrowMultiplier *= Math.max(0.35, 1 - level * 0.05);
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 100,
  },
  {
    id: "morning_mist",
    name: "Morning Mist",
    description: "Dewy grass becomes more common.",
    baseCost: 160,
    costGrowth: 2.25,
    maxLevel: 6,
    prerequisiteIds: ["dew_appreciation"],
    tree: { x: 505, y: 80, icon: "mist", color: 0xb5f4ff },
    apply: (stats, level) => {
      stats.dewChance += level * 0.08;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 160,
  },
  {
    id: "soft_meadow",
    name: "Soft Meadow",
    description: "A late early-game touch boost from being surrounded by acceptable grass.",
    baseCost: 220,
    costGrowth: 2.4,
    maxLevel: 5,
    prerequisiteIds: ["barefoot_confidence", "fertile_soil"],
    tree: { x: 650, y: 255, icon: "field", color: 0x9be86b },
    apply: (stats, level) => {
      stats.touchMultiplier += level * 5;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 220,
  },
];

export function getUpgradeCost(upgrade: UpgradeDefinition, level: number): number {
  return Math.floor(upgrade.baseCost * upgrade.costGrowth ** level);
}

export function canUnlockUpgrade(state: GameState, upgrade: UpgradeDefinition): boolean {
  const prerequisitesMet = (upgrade.prerequisiteIds ?? []).every((id) => (state.upgrades[id]?.level ?? 0) > 0);
  return prerequisitesMet && upgrade.isUnlocked(state);
}
