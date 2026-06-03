import { UPGRADES } from "../data/upgrades";
import { getWeather } from "../data/weather";
import type { GameState, RuntimeStats } from "../types/game-state";

export function getRuntimeStats(state: GameState): RuntimeStats {
  const stats: RuntimeStats = {
    touchMultiplier: 0,
    regrowMultiplier: 1,
    dewChance: 0,
    critChance: 0.05,
    critMultiplier: 3,
    seedDropBonus: 0,
    rareTierMultiplier: 1,
    rareTouchBonus: 0,
    doubleTouchChance: 0,
    instantRegrowChance: 0,
  };

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id]?.level ?? 0;
    if (level > 0) {
      upgrade.apply(stats, level);
    }
  }

  if (state.seedShopPurchases.field_journal) {
    stats.rareTierMultiplier += 0.18;
  }

  if (state.seedShopPurchases.compost_bin) {
    stats.seedDropBonus += 0.03;
    stats.rareTouchBonus += 1;
  }

  if (state.seedShopPurchases.bug_hotel) {
    stats.seedDropBonus += 0.02;
    stats.critChance += 0.025;
  }

  if (state.seedShopPurchases.weather_jar) {
    getWeather(state.activeWeatherId).apply(stats);
  }

  stats.dewChance = Math.min(0.65, stats.dewChance);
  stats.critChance = Math.min(0.45, stats.critChance);
  stats.critMultiplier = Math.min(8, stats.critMultiplier);
  stats.seedDropBonus = Math.min(0.35, stats.seedDropBonus);
  stats.rareTierMultiplier = Math.min(4, Math.max(1, stats.rareTierMultiplier));
  stats.rareTouchBonus = Math.min(20, stats.rareTouchBonus);
  stats.doubleTouchChance = Math.min(0.5, stats.doubleTouchChance);
  stats.instantRegrowChance = Math.min(0.35, stats.instantRegrowChance);
  stats.regrowMultiplier = Math.max(0.25, stats.regrowMultiplier);

  return stats;
}
