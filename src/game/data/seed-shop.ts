import type { GameState } from "../types/game-state";

export interface SeedShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  isUnlocked(state: GameState): boolean;
}

export const SEED_SHOP_ITEMS: SeedShopItem[] = [
  {
    id: "seed_pouch",
    name: "Seed Pouch",
    description: "Improves manual seed drop chance.",
    cost: 8,
    isUnlocked: () => true,
  },
  {
    id: "sprinkler",
    name: "Tiny Sprinkler",
    description: "Automatically touches grown grass. Place it to focus watering nearby.",
    cost: 22,
    isUnlocked: (state) => state.seedShopPurchases.seed_pouch === true,
  },
  {
    id: "wild_spread",
    name: "Wild Spread",
    description: "Seed drops sometimes sprout an extra nearby grass tile.",
    cost: 35,
    isUnlocked: (state) => state.seedShopPurchases.sprinkler === true,
  },
  {
    id: "field_journal",
    name: "Field Journal",
    description: "Studying grass makes rare tiers appear slightly more often.",
    cost: 28,
    isUnlocked: (state) => state.seedShopPurchases.seed_pouch === true,
  },
  {
    id: "weather_jar",
    name: "Weather Jar",
    description: "Unlocks rotating weather effects for the field.",
    cost: 42,
    isUnlocked: (state) => state.seedShopPurchases.field_journal === true,
  },
  {
    id: "compost_bin",
    name: "Compost Bin",
    description: "Improves seed drops and rare grass value.",
    cost: 58,
    isUnlocked: (state) => state.seedShopPurchases.weather_jar === true,
  },
  {
    id: "bug_hotel",
    name: "Bug Hotel",
    description: "Helpful bugs nudge crits and seeds upward.",
    cost: 80,
    isUnlocked: (state) => state.seedShopPurchases.compost_bin === true,
  },
  {
    id: "rain_barrel",
    name: "Rain Barrel",
    description: "Weather lasts longer and gently improves regrowth.",
    cost: 70,
    isUnlocked: (state) => state.seedShopPurchases.weather_jar === true,
  },
  {
    id: "sprinkler_timer",
    name: "Sprinkler Timer",
    description: "Tiny Sprinkler touches grass more often.",
    cost: 95,
    isUnlocked: (state) => state.seedShopPurchases.bug_hotel === true,
  },
  {
    id: "self_seeding_nozzle",
    name: "Self-Seeding Nozzle",
    description: "Tiny Sprinkler can find the occasional seed.",
    cost: 115,
    isUnlocked: (state) => state.seedShopPurchases.sprinkler_timer === true,
  },
  {
    id: "sprinkler_network",
    name: "Sprinkler Network",
    description: "Tiny Sprinkler waters a second patch and reaches farther when placed.",
    cost: 170,
    isUnlocked: (state) => state.seedShopPurchases.self_seeding_nozzle === true,
  },
  {
    id: "clover_press",
    name: "Clover Press",
    description: "Rare grass and crits become slightly more common.",
    cost: 120,
    isUnlocked: (state) => state.seedShopPurchases.bug_hotel === true,
  },
  {
    id: "seed_catalog",
    name: "Seed Catalog",
    description: "Wild Spread sprouts more often and can add extra patches.",
    cost: 150,
    isUnlocked: (state) => state.seedShopPurchases.wild_spread === true && state.seedShopPurchases.clover_press === true,
  },
];

export function getSeedDropChance(state: GameState, bonus = 0): number {
  let chance = 0.055;

  if (state.seedShopPurchases.seed_pouch) {
    chance += 0.045;
  }

  if (state.seedShopPurchases.compost_bin) {
    chance += 0.018;
  }

  if (state.seedShopPurchases.bug_hotel) {
    chance += 0.012;
  }

  if (state.seedShopPurchases.self_seeding_nozzle) {
    chance += 0.01;
  }

  return Math.min(0.32, chance + bonus);
}
