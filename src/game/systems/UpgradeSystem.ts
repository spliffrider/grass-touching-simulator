import { UPGRADES } from "../data/upgrades";
import type { GameState, RuntimeStats } from "../types/game-state";

export function getRuntimeStats(state: GameState): RuntimeStats {
  const stats: RuntimeStats = {
    touchMultiplier: 0,
    regrowMultiplier: 1,
    dewChance: 0,
  };

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id]?.level ?? 0;
    if (level > 0) {
      upgrade.apply(stats, level);
    }
  }

  stats.dewChance = Math.min(0.65, stats.dewChance);
  stats.regrowMultiplier = Math.max(0.25, stats.regrowMultiplier);

  return stats;
}
