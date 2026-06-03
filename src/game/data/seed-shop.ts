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
    cost: 3,
    isUnlocked: () => true,
  },
  {
    id: "sprinkler",
    name: "Tiny Sprinkler",
    description: "Automatically touches one grown grass patch every few seconds.",
    cost: 8,
    isUnlocked: (state) => state.seedShopPurchases.seed_pouch === true,
  },
  {
    id: "wild_spread",
    name: "Wild Spread",
    description: "Seed drops sometimes sprout an extra nearby grass tile.",
    cost: 12,
    isUnlocked: (state) => state.seedShopPurchases.sprinkler === true,
  },
  {
    id: "field_journal",
    name: "Field Journal",
    description: "Studying grass makes rare tiers appear slightly more often.",
    cost: 10,
    isUnlocked: (state) => state.seedShopPurchases.seed_pouch === true,
  },
  {
    id: "weather_jar",
    name: "Weather Jar",
    description: "Unlocks rotating weather effects for the field.",
    cost: 14,
    isUnlocked: (state) => state.seedShopPurchases.field_journal === true,
  },
  {
    id: "compost_bin",
    name: "Compost Bin",
    description: "Improves seed drops and rare grass value.",
    cost: 18,
    isUnlocked: (state) => state.seedShopPurchases.weather_jar === true,
  },
  {
    id: "bug_hotel",
    name: "Bug Hotel",
    description: "Helpful bugs nudge crits and seeds upward.",
    cost: 24,
    isUnlocked: (state) => state.seedShopPurchases.compost_bin === true,
  },
];

export function getSeedDropChance(state: GameState, bonus = 0): number {
  let chance = 0.1;

  if (state.seedShopPurchases.seed_pouch) {
    chance += 0.08;
  }

  if (state.seedShopPurchases.compost_bin) {
    chance += 0.03;
  }

  if (state.seedShopPurchases.bug_hotel) {
    chance += 0.02;
  }

  return Math.min(0.55, chance + bonus);
}
