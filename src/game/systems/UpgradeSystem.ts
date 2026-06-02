import { UPGRADES } from "../data/upgrades";
import type { GameState, RuntimeStats } from "../types/game-state";

export function getRuntimeStats(state: GameState): RuntimeStats {
  const stats: RuntimeStats = {
    touchMultiplier: 0,
    regrowMultiplier: 1,
    dewChance: 0,
    critChance: 0.05,
    critMultiplier: 3,
  };

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id]?.level ?? 0;
    if (level > 0) {
      upgrade.apply(stats, level);
    }
  }

  stats.dewChance = Math.min(0.65, stats.dewChance);
  stats.critChance = Math.min(0.45, stats.critChance);
  stats.critMultiplier = Math.min(8, stats.critMultiplier);
  stats.regrowMultiplier = Math.max(0.25, stats.regrowMultiplier);

  return stats;
}
