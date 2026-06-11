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

  if (state.seedShopPurchases.rain_barrel) {
    stats.dewChance += 0.03;
    stats.regrowMultiplier *= 0.94;
  }

  if (state.seedShopPurchases.clover_press) {
    stats.rareTierMultiplier += 0.35;
    stats.critChance += 0.02;
  }

  if (state.seedShopPurchases.weather_jar) {
    getWeather(state.activeWeatherId).apply(stats);
  }

  if (state.inventory.field_mouse?.quantity > 0) {
    stats.goldDropBonus += 0.006;
  }

  if (state.inventory.meadow_rabbit?.quantity > 0) {
    stats.seedDropBonus += 0.012;
    stats.dewChance += 0.012;
  }

  getSeasonForDate(new Date()).apply(stats);

  stats.dewChance = Math.min(0.65, stats.dewChance);
  stats.critChance = Math.min(0.45, stats.critChance);
  stats.critMultiplier = Math.min(8, stats.critMultiplier);
  stats.seedDropBonus = Math.min(0.35, stats.seedDropBonus);
  stats.goldDropBonus = Math.min(0.14, stats.goldDropBonus);
  stats.rareTierMultiplier = Math.min(4, Math.max(1, stats.rareTierMultiplier));
  stats.rareTouchBonus = Math.min(20, stats.rareTouchBonus);
  stats.doubleTouchChance = Math.min(0.5, stats.doubleTouchChance);
  stats.instantRegrowChance = Math.min(0.35, stats.instantRegrowChance);
  stats.comboWindowMultiplier = Math.min(1.75, Math.max(0.75, stats.comboWindowMultiplier));
  stats.comboBonusMultiplier = Math.min(2.25, Math.max(0.5, stats.comboBonusMultiplier));
  stats.regrowMultiplier = Math.max(0.25, stats.regrowMultiplier);

  return stats;
}
