import type { GameState, InventoryItemKind } from "../types/game-state";

export interface GoldStoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: InventoryItemKind;
  maxQuantity?: number;
  isUnlocked(state: GameState): boolean;
}

export const GOLD_STORE_ITEMS: GoldStoreItem[] = [
  {
    id: "pocket_sunshine",
    name: "Pocket Sunshine",
    description: "Consumable. Instantly regrows every resting patch.",
    cost: 6,
    kind: "consumable",
    isUnlocked: () => true,
  },
  {
    id: "seed_satchel",
    name: "Seed Satchel",
    description: "Consumable. Opens into a quick bundle of 5 seeds.",
    cost: 8,
    kind: "consumable",
    isUnlocked: () => true,
  },
  {
    id: "field_mouse",
    name: "Field Mouse",
    description: "Animal. Scurries through the field and sometimes finds gold.",
    cost: 16,
    kind: "animal",
    isUnlocked: (state) => state.lifetimeGold >= 1,
  },
  {
    id: "bee_hive",
    name: "Bee Hive",
    description: "Animal. Pollinates field clusters into better grass.",
    cost: 24,
    kind: "animal",
    isUnlocked: (state) => state.lifetimeGold >= 2,
  },
  {
    id: "chicken",
    name: "Chicken",
    description: "Animal. Sometimes improves a patch, sometimes scratches up gold.",
    cost: 36,
    kind: "animal",
    isUnlocked: (state) => state.inventory.bee_hive?.quantity > 0 || state.inventory.field_mouse?.quantity > 0,
  },
  {
    id: "sheep",
    name: "Sheep",
    description: "Animal. Periodically touches grass and turns grazing into gold.",
    cost: 58,
    kind: "animal",
    isUnlocked: (state) => state.inventory.chicken?.quantity > 0,
  },
  {
    id: "meadow_rabbit",
    name: "Meadow Rabbit",
    description: "Animal. Hops through grown grass and sometimes finds seeds.",
    cost: 28,
    kind: "animal",
    isUnlocked: (state) => state.inventory.field_mouse?.quantity > 0,
  },
  {
    id: "earthworm",
    name: "Earthworm",
    description: "Animal. Burrows through resting patches, helping grass regrow sooner.",
    cost: 32,
    kind: "animal",
    isUnlocked: (state) => state.inventory.field_mouse?.quantity > 0 || state.inventory.bee_hive?.quantity > 0,
  },
];
