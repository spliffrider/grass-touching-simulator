import { UPGRADES } from "../data/upgrades";
import { getCharacterClass } from "../data/character-classes";
import { getSeasonForDate } from "../data/seasons";
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
    goldDropBonus: 0,
    rareTierMultiplier: 1,
    rareTouchBonus: 0,
    doubleTouchChance: 0,
    instantRegrowChance: 0,
    comboWindowMultiplier: 1,
    comboBonusMultiplier: 1,
  };

  getCharacterClass(state.characterClassId).apply(stats);

  for (const upgrade of UPGRADES) {
    const level = state.upgrades[upgrade.id]?.level ?? 0;
    if (level > 0 && (upgrade.classId === undefined || upgrade.classId === state.characterClassId)) {
      upgrade.apply(stats, level);
    }
  }

  if (state.seedShopPurchases.field_journal) {
    stats.rareTierMultiplier += 0.1;
  }

  if (state.seedShopPurchases.compost_bin) {
    stats.seedDropBonus += 0.018;
    stats.rareTouchBonus += 0.5;
  }

  if (state.seedShopPurchases.bug_hotel) {
    stats.seedDropBonus += 0.012;
    stats.critChance += 0.012;
  }

  if (state.seedShopPurchases.rain_barrel) {
    stats.dewChance += 0.02;
    stats.regrowMultiplier *= 0.97;
  }

  if (state.seedShopPurchases.clover_press) {
    stats.rareTierMultiplier += 0.18;
    stats.critChance += 0.01;
  }

  if (state.seedShopPurchases.weather_jar) {
    getWeather(state.activeWeatherId).apply(stats);
  }

  if (state.inventory.field_mouse?.quantity > 0) {
    stats.goldDropBonus += 0.003;
  }

  if (state.inventory.meadow_rabbit?.quantity > 0) {
    stats.seedDropBonus += 0.006;
    stats.dewChance += 0.006;
  }

  getSeasonForDate(new Date()).apply(stats);

  stats.dewChance = Math.min(0.42, stats.dewChance);
  stats.critChance = Math.min(0.28, stats.critChance);
  stats.critMultiplier = Math.min(5.5, stats.critMultiplier);
  stats.seedDropBonus = Math.min(0.2, stats.seedDropBonus);
  stats.goldDropBonus = Math.min(0.08, stats.goldDropBonus);
  stats.rareTierMultiplier = Math.min(2.8, Math.max(1, stats.rareTierMultiplier));
  stats.rareTouchBonus = Math.min(10, stats.rareTouchBonus);
  stats.doubleTouchChance = Math.min(0.32, stats.doubleTouchChance);
  stats.instantRegrowChance = Math.min(0.2, stats.instantRegrowChance);
  stats.comboWindowMultiplier = Math.min(1.45, Math.max(0.75, stats.comboWindowMultiplier));
  stats.comboBonusMultiplier = Math.min(1.7, Math.max(0.5, stats.comboBonusMultiplier));
  stats.regrowMultiplier = Math.max(0.42, stats.regrowMultiplier);

  return stats;
}
