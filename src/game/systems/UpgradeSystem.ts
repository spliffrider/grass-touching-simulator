import { UPGRADES } from "../data/upgrades";
import { getCharacterClass } from "../data/character-classes";
import { GRASS_TIERS } from "../data/grass-tiers";
import { getSeasonForDate } from "../data/seasons";
import { WEATHER_TYPES, getWeather } from "../data/weather";
import { getPrickedRemainingMs } from "./HazardSystem";
import { getPrestigeProductionMultiplier } from "./PrestigeSystem";
import type { GameState, RuntimeStats } from "../types/game-state";

const JOURNAL_TRAIT_COUNT = 3;

export interface JournalCollectionBonuses {
  grassTierCount: number;
  grassTierTotal: number;
  traitCount: number;
  traitTotal: number;
  weatherCount: number;
  weatherTotal: number;
  rareTierMultiplierBonus: number;
  rareTouchBonus: number;
  seedDropBonus: number;
  doubleTouchChanceBonus: number;
  automationGlobalMultiplierBonus: number;
}

export function getJournalCollectionBonuses(state: GameState): JournalCollectionBonuses {
  const active = state.seedShopPurchases.field_journal === true;
  const grassTierTotal = GRASS_TIERS.length;
  const weatherTotal = WEATHER_TYPES.length;
  const grassTierCount = active ? Math.min(state.journal.discoveredGrassTiers.length, grassTierTotal) : 0;
  const traitCount = active ? Math.min(state.journal.discoveredTileTraits.length, JOURNAL_TRAIT_COUNT) : 0;
  const weatherCount = active ? Math.min(state.journal.seenWeatherIds.length, weatherTotal) : 0;
  const allGrassTiers = grassTierCount >= grassTierTotal;
  const allTraits = traitCount >= JOURNAL_TRAIT_COUNT;
  const allWeather = weatherCount >= weatherTotal;
  const weatherAutomationBonus = Math.min(0.18, Math.max(0, weatherCount - 1) * 0.03) + (allWeather ? 0.12 : 0);

  return {
    grassTierCount,
    grassTierTotal,
    traitCount,
    traitTotal: JOURNAL_TRAIT_COUNT,
    weatherCount,
    weatherTotal,
    rareTierMultiplierBonus: grassTierCount * 0.025 + (allGrassTiers ? 0.15 : 0),
    rareTouchBonus: grassTierCount * 0.25 + (allGrassTiers ? 2 : 0),
    seedDropBonus: traitCount * 0.004 + (allTraits ? 0.01 : 0),
    doubleTouchChanceBonus: allTraits ? 0.02 : 0,
    automationGlobalMultiplierBonus: weatherAutomationBonus,
  };
}

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
    grassTouchMultiplier: 1,
    automationGlobalMultiplier: 1,
    automationDiversityBonus: 0,
    automationPairSynergyBonus: 0,
    automationSystemMultipliers: {
      sprinkler: 1,
      field_mouse: 1,
      bee_hive: 1,
      earthworm: 1,
      chicken: 1,
      sheep: 1,
      meadow_rabbit: 1,
    },
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

  const journalBonuses = getJournalCollectionBonuses(state);
  stats.rareTierMultiplier += journalBonuses.rareTierMultiplierBonus;
  stats.rareTouchBonus += journalBonuses.rareTouchBonus;
  stats.seedDropBonus += journalBonuses.seedDropBonus;
  stats.doubleTouchChance += journalBonuses.doubleTouchChanceBonus;
  stats.automationGlobalMultiplier *= 1 + journalBonuses.automationGlobalMultiplierBonus;

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

  if (getPrickedRemainingMs(state) > 0) {
    stats.grassTouchMultiplier *= 0.82;
    stats.comboWindowMultiplier *= 0.92;
  }

  if (state.inventory.field_mouse?.quantity > 0) {
    stats.goldDropBonus += 0.001;
  }

  if (state.inventory.meadow_rabbit?.quantity > 0) {
    stats.seedDropBonus += 0.006;
    stats.dewChance += 0.006;
  }

  getSeasonForDate(new Date()).apply(stats);

  const prestigeMultiplier = getPrestigeProductionMultiplier(state);
  stats.grassTouchMultiplier *= prestigeMultiplier;
  stats.automationGlobalMultiplier *= prestigeMultiplier;

  stats.dewChance = Math.min(0.42, stats.dewChance);
  stats.critChance = Math.min(0.28, stats.critChance);
  stats.critMultiplier = Math.min(5.5, stats.critMultiplier);
  stats.seedDropBonus = Math.min(0.2, stats.seedDropBonus);
  stats.goldDropBonus = Math.min(0.025, stats.goldDropBonus);
  stats.rareTierMultiplier = Math.min(2.8, Math.max(1, stats.rareTierMultiplier));
  stats.rareTouchBonus = Math.min(10, stats.rareTouchBonus);
  stats.doubleTouchChance = Math.min(0.32, stats.doubleTouchChance);
  stats.instantRegrowChance = Math.min(0.2, stats.instantRegrowChance);
  stats.comboWindowMultiplier = Math.min(1.45, Math.max(0.75, stats.comboWindowMultiplier));
  stats.comboBonusMultiplier = Math.min(1.7, Math.max(0.5, stats.comboBonusMultiplier));
  stats.grassTouchMultiplier = Math.min(120, Math.max(0.1, stats.grassTouchMultiplier));
  stats.automationGlobalMultiplier = Math.min(120, Math.max(0.1, stats.automationGlobalMultiplier));
  stats.automationDiversityBonus = Math.min(0.24, Math.max(0, stats.automationDiversityBonus));
  stats.automationPairSynergyBonus = Math.min(0.12, Math.max(0, stats.automationPairSynergyBonus));
  for (const systemId of Object.keys(stats.automationSystemMultipliers) as Array<keyof typeof stats.automationSystemMultipliers>) {
    stats.automationSystemMultipliers[systemId] = Math.min(12, Math.max(0.1, stats.automationSystemMultipliers[systemId]));
  }
  stats.regrowMultiplier = Math.max(0.42, stats.regrowMultiplier);

  return stats;
}
