import type { GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

const BASE_GOLD_DROP_CHANCE = 0.014;

export function getGoldDropChance(
  state: GameState,
  stats: RuntimeStats,
  touchedTrait: TileTrait,
  touchedTier: GrassTierId,
  touch: TouchResult,
  chanceScale = 1,
): number {
  let chance = BASE_GOLD_DROP_CHANCE + stats.goldDropBonus;

  chance += touchedTrait === "lush" ? 0.009 : touchedTrait === "dewy" ? 0.004 : 0;
  chance += getTierGoldBonus(touchedTier);
  chance += touch.isCrit ? 0.006 : 0;
  chance += state.lifetimeGrassTouches >= 900 ? 0.003 : 0;

  return Math.min(0.12, chance * chanceScale);
}

function getTierGoldBonus(tier: GrassTierId): number {
  const bonuses = {
    normal: 0,
    thick: 0,
    clover: 0.006,
    golden: 0.022,
    wildflower: 0.008,
    moss: 0.004,
    mushroom: 0.011,
    crystal: 0.019,
    frost: 0.014,
  } satisfies Record<GrassTierId, number>;

  return bonuses[tier];
}
