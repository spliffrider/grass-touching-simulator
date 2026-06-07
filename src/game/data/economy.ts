import type { GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

const BASE_GOLD_DROP_CHANCE = 0.025;

export function getGoldDropChance(
  state: GameState,
  stats: RuntimeStats,
  touchedTrait: TileTrait,
  touchedTier: GrassTierId,
  touch: TouchResult,
  chanceScale = 1,
): number {
  let chance = BASE_GOLD_DROP_CHANCE + stats.goldDropBonus;

  chance += touchedTrait === "lush" ? 0.018 : touchedTrait === "dewy" ? 0.008 : 0;
  chance += touchedTier === "golden" ? 0.035 : touchedTier === "clover" ? 0.012 : 0;
  chance += touch.isCrit ? 0.01 : 0;
  chance += state.lifetimeGrassTouches >= 250 ? 0.006 : 0;

  return Math.min(0.22, chance * chanceScale);
}
