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
];

export function getSeedDropChance(state: GameState): number {
  let chance = 0.1;

  if (state.seedShopPurchases.seed_pouch) {
    chance += 0.08;
  }

  return chance;
}
