import type { GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

const BASE_GOLD_DROP_CHANCE = 0.003;

export function getGoldDropChance(
  state: GameState,
  stats: RuntimeStats,
  touchedTrait: TileTrait,
  touchedTier: GrassTierId,
  touch: TouchResult,
  chanceScale = 1,
): number {
  let chance = BASE_GOLD_DROP_CHANCE + stats.goldDropBonus;

  chance += touchedTrait === "lush" ? 0.002 : touchedTrait === "dewy" ? 0.001 : 0;
  chance += getTierGoldBonus(touchedTier);
  chance += touch.isCrit ? 0.002 : 0;
  chance += state.lifetimeGrassTouches >= 900 ? 0.001 : 0;

  return Math.min(0.035, chance * chanceScale);
}

function getTierGoldBonus(tier: GrassTierId): number {
  const bonuses = {
    normal: 0,
    thick: 0,
    clover: 0.0015,
    golden: 0.008,
    wildflower: 0.002,
    moss: 0.001,
    mushroom: 0.003,
    crystal: 0.006,
    frost: 0.004,
  } satisfies Record<GrassTierId, number>;

  return bonuses[tier];
}
