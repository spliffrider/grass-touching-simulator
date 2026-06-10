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
  chance += getTierGoldBonus(touchedTier);
  chance += touch.isCrit ? 0.01 : 0;
  chance += state.lifetimeGrassTouches >= 250 ? 0.006 : 0;

  return Math.min(0.22, chance * chanceScale);
}

function getTierGoldBonus(tier: GrassTierId): number {
  const bonuses = {
    normal: 0,
    thick: 0,
    clover: 0.012,
    golden: 0.035,
    wildflower: 0.014,
    moss: 0.006,
    mushroom: 0.018,
    crystal: 0.03,
    frost: 0.022,
  } satisfies Record<GrassTierId, number>;

  return bonuses[tier];
}
