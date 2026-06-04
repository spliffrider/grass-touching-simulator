import type { RuntimeStats, SeasonId } from "../types/game-state";

export interface SeasonDefinition {
  id: SeasonId;
  name: string;
  description: string;
  color: number;
  alpha: number;
  apply(stats: RuntimeStats): void;
}

export const SEASONS: Record<SeasonId, SeasonDefinition> = {
  spring: {
    id: "spring",
    name: "Spring",
    description: "Fresh sprouts bring more dew and seed luck.",
    color: 0xc9f27b,
    alpha: 0.055,
    apply: (stats) => {
      stats.dewChance += 0.045;
      stats.seedDropBonus += 0.015;
    },
  },
  summer: {
    id: "summer",
    name: "Summer",
    description: "Warm days help grass regrow and rare patches show off.",
    color: 0xffef78,
    alpha: 0.05,
    apply: (stats) => {
      stats.regrowMultiplier *= 0.95;
      stats.rareTierMultiplier += 0.12;
    },
  },
  autumn: {
    id: "autumn",
    name: "Autumn",
    description: "Seeds travel easily and crits feel pleasantly crunchy.",
    color: 0xffb347,
    alpha: 0.065,
    apply: (stats) => {
      stats.seedDropBonus += 0.025;
      stats.critChance += 0.012;
    },
  },
  winter: {
    id: "winter",
    name: "Winter",
    description: "Grass grows slowly, but every touch feels more deliberate.",
    color: 0xd7fff2,
    alpha: 0.07,
    apply: (stats) => {
      stats.regrowMultiplier *= 1.08;
      stats.touchMultiplier += 1;
    },
  },
};

export function getSeasonForDate(date: Date): SeasonDefinition {
  const month = date.getMonth();

  if (month >= 2 && month <= 4) {
    return SEASONS.spring;
  }

  if (month >= 5 && month <= 7) {
    return SEASONS.summer;
  }

  if (month >= 8 && month <= 10) {
    return SEASONS.autumn;
  }

  return SEASONS.winter;
}
