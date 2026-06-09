import type { GameState } from "../types/game-state";

export interface QuestReward {
  grassTouches?: number;
  seeds?: number;
  gold?: number;
}

export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  reward: QuestReward;
  isComplete(state: GameState): boolean;
  getProgress(state: GameState): string;
}

export const QUESTS: QuestDefinition[] = [
  {
    id: "touch_25",
    name: "Touch Grass, Actually",
    description: "Reach 25 lifetime Grass Touches.",
    reward: { seeds: 2 },
    isComplete: (state) => state.lifetimeGrassTouches >= 25,
    getProgress: (state) => `${Math.min(25, Math.floor(state.lifetimeGrassTouches))}/25 touches`,
  },
  {
    id: "touch_100",
    name: "Patch Familiarity",
    description: "Reach 100 lifetime Grass Touches.",
    reward: { seeds: 4, gold: 1 },
    isComplete: (state) => state.lifetimeGrassTouches >= 100,
    getProgress: (state) => `${Math.min(100, Math.floor(state.lifetimeGrassTouches))}/100 touches`,
  },
  {
    id: "field_9",
    name: "A Lawn, Technically",
    description: "Grow the field to 9 patches.",
    reward: { seeds: 3 },
    isComplete: (state) => Object.keys(state.field).length >= 9,
    getProgress: (state) => `${Math.min(9, Object.keys(state.field).length)}/9 patches`,
  },
  {
    id: "seed_10",
    name: "Seed Pocket",
    description: "Collect 10 lifetime seeds.",
    reward: { gold: 2 },
    isComplete: (state) => state.lifetimeSeeds >= 10,
    getProgress: (state) => `${Math.min(10, Math.floor(state.lifetimeSeeds))}/10 seeds`,
  },
  {
    id: "gold_5",
    name: "A Suspicious Shine",
    description: "Collect 5 lifetime gold.",
    reward: { seeds: 5 },
    isComplete: (state) => state.lifetimeGold >= 5,
    getProgress: (state) => `${Math.min(5, Math.floor(state.lifetimeGold))}/5 gold`,
  },
  {
    id: "sprinkler_owner",
    name: "Responsible Hydration",
    description: "Buy the Tiny Sprinkler.",
    reward: { gold: 3 },
    isComplete: (state) => state.seedShopPurchases.sprinkler === true,
    getProgress: (state) => (state.seedShopPurchases.sprinkler ? "Sprinkler bought" : "Not bought yet"),
  },
];

export function formatQuestReward(reward: QuestReward): string {
  return [
    reward.grassTouches ? `${reward.grassTouches} touches` : "",
    reward.seeds ? `${reward.seeds} seeds` : "",
    reward.gold ? `${reward.gold} gold` : "",
  ]
    .filter(Boolean)
    .join(" + ");
}
