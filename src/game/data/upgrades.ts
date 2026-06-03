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
    tree: { x: 70, y: 250, icon: "1", color: 0x9be86b },
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
    tree: { x: 210, y: 250, icon: ">>", color: 0x7fd8f0 },
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
    tree: { x: 350, y: 130, icon: "dew", color: 0x8feaff },
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
    tree: { x: 350, y: 350, icon: "feet", color: 0xff7ea8 },
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
    tree: { x: 210, y: 110, icon: "hand", color: 0xc9f27b },
    apply: (stats, level) => {
      stats.touchMultiplier += level * 2;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 45,
  },
  {
    id: "two_handed_technique",
    name: "Two-Handed Technique",
    description: "Adds a chance for touches to count twice.",
    baseCost: 90,
    costGrowth: 2,
    maxLevel: 8,
    prerequisiteIds: ["softer_grass"],
    tree: { x: 210, y: 330, icon: "2x", color: 0xdfffc8 },
    apply: (stats, level) => {
      stats.doubleTouchChance += level * 0.035;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 60,
  },
  {
    id: "mindful_contact",
    name: "Mindful Contact",
    description: "Occasionally a touched patch instantly regrows.",
    baseCost: 170,
    costGrowth: 2.05,
    maxLevel: 6,
    prerequisiteIds: ["two_handed_technique", "faster_regrowth"],
    tree: { x: 350, y: 260, icon: "zen", color: 0xc9f27b },
    apply: (stats, level) => {
      stats.instantRegrowChance += level * 0.035;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 120,
  },
  {
    id: "lucky_clover",
    name: "Lucky Clover",
    description: "Critical touches happen 3% more often per level.",
    baseCost: 55,
    costGrowth: 1.9,
    maxLevel: 8,
    prerequisiteIds: ["softer_grass"],
    tree: { x: 70, y: 110, icon: "crit", color: 0xffef78 },
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
    tree: { x: 210, y: 410, icon: "x!", color: 0xffb347 },
    apply: (stats, level) => {
      stats.critMultiplier += level * 0.5;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 90,
  },
  {
    id: "satisfying_crunch",
    name: "Satisfying Crunch",
    description: "Crits get slightly more common, and seeds drop more often.",
    baseCost: 180,
    costGrowth: 2.1,
    maxLevel: 6,
    prerequisiteIds: ["dramatic_touch"],
    tree: { x: 350, y: 445, icon: "crunch", color: 0xffd565 },
    apply: (stats, level) => {
      stats.critChance += level * 0.01;
      stats.seedDropBonus += level * 0.025;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 150,
  },
  {
    id: "overreaction",
    name: "Overreaction",
    description: "Critical touches hit harder. It is justified.",
    baseCost: 260,
    costGrowth: 2.25,
    maxLevel: 5,
    prerequisiteIds: ["satisfying_crunch"],
    tree: { x: 490, y: 445, icon: "!!!", color: 0xff9f43 },
    apply: (stats, level) => {
      stats.critMultiplier += level * 0.45;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 260,
  },
  {
    id: "fertile_soil",
    name: "Fertile Soil",
    description: "Grass settles into better dirt. Regrowth is 5% faster per level.",
    baseCost: 80,
    costGrowth: 1.95,
    maxLevel: 10,
    prerequisiteIds: ["faster_regrowth"],
    tree: { x: 490, y: 250, icon: "soil", color: 0xb88a55 },
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
    tree: { x: 490, y: 95, icon: "mist", color: 0xb5f4ff },
    apply: (stats, level) => {
      stats.dewChance += level * 0.08;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 160,
  },
  {
    id: "warm_sunlight",
    name: "Warm Sunlight",
    description: "Grass regrows 4% faster per level.",
    baseCost: 115,
    costGrowth: 1.9,
    maxLevel: 8,
    prerequisiteIds: ["faster_regrowth"],
    tree: { x: 350, y: 200, icon: "sun", color: 0xffef78 },
    apply: (stats, level) => {
      stats.regrowMultiplier *= Math.max(0.35, 1 - level * 0.04);
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 85,
  },
  {
    id: "root_network",
    name: "Root Network",
    description: "Better roots improve regrowth and instant regrow odds.",
    baseCost: 210,
    costGrowth: 2.05,
    maxLevel: 6,
    prerequisiteIds: ["fertile_soil", "warm_sunlight"],
    tree: { x: 600, y: 230, icon: "roots", color: 0xb88a55 },
    apply: (stats, level) => {
      stats.regrowMultiplier *= Math.max(0.35, 1 - level * 0.03);
      stats.instantRegrowChance += level * 0.02;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 180,
  },
  {
    id: "perennial_patches",
    name: "Perennial Patches",
    description: "Touched grass has a much better chance to instantly return.",
    baseCost: 360,
    costGrowth: 2.3,
    maxLevel: 5,
    prerequisiteIds: ["root_network"],
    tree: { x: 665, y: 170, icon: "loop", color: 0x9be86b },
    apply: (stats, level) => {
      stats.instantRegrowChance += level * 0.045;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 360,
  },
  {
    id: "dew_respecter",
    name: "Dew Respecter",
    description: "Dewy grass appears more often and helps seed drops.",
    baseCost: 220,
    costGrowth: 2.05,
    maxLevel: 5,
    prerequisiteIds: ["morning_mist"],
    tree: { x: 600, y: 95, icon: "dew+", color: 0xb5f4ff },
    apply: (stats, level) => {
      stats.dewChance += level * 0.05;
      stats.seedDropBonus += level * 0.015;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 220,
  },
  {
    id: "weather_watching",
    name: "Weather Watching",
    description: "Weather effects become slightly more rewarding.",
    baseCost: 300,
    costGrowth: 2.1,
    maxLevel: 4,
    prerequisiteIds: ["dew_respecter"],
    tree: { x: 680, y: 70, icon: "sky", color: 0xd7fff2 },
    apply: (stats, level) => {
      stats.seedDropBonus += level * 0.015;
      stats.rareTierMultiplier += level * 0.08;
    },
    isUnlocked: (state) => state.seedShopPurchases.weather_jar === true && state.lifetimeGrassTouches >= 260,
  },
  {
    id: "soft_meadow",
    name: "Soft Meadow",
    description: "A late early-game touch boost from being surrounded by acceptable grass.",
    baseCost: 220,
    costGrowth: 2.4,
    maxLevel: 5,
    prerequisiteIds: ["barefoot_confidence", "fertile_soil"],
    tree: { x: 650, y: 320, icon: "field", color: 0x9be86b },
    apply: (stats, level) => {
      stats.touchMultiplier += level * 5;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 220,
  },
  {
    id: "grass_identification",
    name: "Grass Identification",
    description: "Rare grass tiers appear more often.",
    baseCost: 150,
    costGrowth: 2,
    maxLevel: 8,
    prerequisiteIds: ["fertile_soil"],
    tree: { x: 490, y: 335, icon: "ID", color: 0xb7eba5 },
    apply: (stats, level) => {
      stats.rareTierMultiplier += level * 0.18;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 140,
  },
  {
    id: "better_eyes",
    name: "Better Eyes",
    description: "Rare grass is worth extra Grass Touches.",
    baseCost: 260,
    costGrowth: 2.15,
    maxLevel: 6,
    prerequisiteIds: ["grass_identification"],
    tree: { x: 600, y: 365, icon: "eyes", color: 0xdfffc8 },
    apply: (stats, level) => {
      stats.rareTouchBonus += level;
      stats.rareTierMultiplier += level * 0.08;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 240,
  },
  {
    id: "clover_magnet",
    name: "Clover Magnet",
    description: "Rare grass and crits both become more common.",
    baseCost: 340,
    costGrowth: 2.25,
    maxLevel: 5,
    prerequisiteIds: ["better_eyes", "lucky_clover"],
    tree: { x: 680, y: 365, icon: "luck", color: 0xb7eba5 },
    apply: (stats, level) => {
      stats.rareTierMultiplier += level * 0.2;
      stats.critChance += level * 0.015;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 320,
  },
  {
    id: "premium_pasture",
    name: "Premium Pasture",
    description: "Rare grass gives a larger bonus and appears more often.",
    baseCost: 520,
    costGrowth: 2.35,
    maxLevel: 5,
    prerequisiteIds: ["clover_magnet", "soft_meadow"],
    tree: { x: 650, y: 440, icon: "rare", color: 0xffef78 },
    apply: (stats, level) => {
      stats.rareTouchBonus += level * 2;
      stats.rareTierMultiplier += level * 0.25;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 520,
  },
  {
    id: "grassmaxxing",
    name: "Grassmaxxing",
    description: "An unreasonable all-around boost from becoming too good at this.",
    baseCost: 900,
    costGrowth: 2.6,
    maxLevel: 3,
    prerequisiteIds: ["premium_pasture", "overreaction", "perennial_patches"],
    tree: { x: 360, y: 500, icon: "MAX", color: 0xf7ffe8 },
    apply: (stats, level) => {
      stats.touchMultiplier += level * 15;
      stats.critChance += level * 0.03;
      stats.seedDropBonus += level * 0.03;
      stats.rareTierMultiplier += level * 0.3;
    },
    isUnlocked: (state) => state.lifetimeGrassTouches >= 900,
  },
];

export function getUpgradeCost(upgrade: UpgradeDefinition, level: number): number {
  return Math.floor(upgrade.baseCost * upgrade.costGrowth ** level);
}

export function canUnlockUpgrade(state: GameState, upgrade: UpgradeDefinition): boolean {
  const prerequisitesMet = (upgrade.prerequisiteIds ?? []).every((id) => (state.upgrades[id]?.level ?? 0) > 0);
  return prerequisitesMet && upgrade.isUnlocked(state);
}
