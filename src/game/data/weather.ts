import type { RuntimeStats, WeatherId } from "../types/game-state";

export interface WeatherDefinition {
  id: WeatherId;
  name: string;
  description: string;
  color: string;
  apply(stats: RuntimeStats): void;
}

export const WEATHER_TYPES: WeatherDefinition[] = [
  {
    id: "calm",
    name: "Calm Skies",
    description: "No special modifier. Just grass being grass.",
    color: "#f7ffe8",
    apply: () => {},
  },
  {
    id: "dewy_morning",
    name: "Dewy Morning",
    description: "More dewy grass and slightly more seeds.",
    color: "#bff4ff",
    apply: (stats) => {
      stats.dewChance += 0.14;
      stats.seedDropBonus += 0.03;
    },
  },
  {
    id: "warm_sunlight",
    name: "Warm Sunlight",
    description: "Grass regrows faster.",
    color: "#ffef78",
    apply: (stats) => {
      stats.regrowMultiplier *= 0.85;
    },
  },
  {
    id: "lucky_breeze",
    name: "Lucky Breeze",
    description: "Crits and rare grass are more common.",
    color: "#dfffc8",
    apply: (stats) => {
      stats.critChance += 0.08;
      stats.rareTierMultiplier += 0.25;
    },
  },
  {
    id: "seed_wind",
    name: "Seed Wind",
    description: "Seed drops are much more common.",
    color: "#fff1a8",
    apply: (stats) => {
      stats.seedDropBonus += 0.08;
    },
  },
  {
    id: "soft_rain",
    name: "Soft Rain",
    description: "Grass regrows faster and dewy patches appear more often.",
    color: "#a8e8ff",
    apply: (stats) => {
      stats.regrowMultiplier *= 0.82;
      stats.dewChance += 0.1;
    },
  },
  {
    id: "pollinator_swarm",
    name: "Pollinator Swarm",
    description: "Seeds and crits both get a friendly nudge.",
    color: "#ffe08a",
    apply: (stats) => {
      stats.seedDropBonus += 0.045;
      stats.critChance += 0.055;
    },
  },
  {
    id: "golden_hour",
    name: "Golden Hour",
    description: "Rare grass shows up more often and gold feels a little closer.",
    color: "#ffd565",
    apply: (stats) => {
      stats.rareTierMultiplier += 0.38;
      stats.rareTouchBonus += 2;
      stats.goldDropBonus += 0.006;
    },
  },
  {
    id: "restless_roots",
    name: "Restless Roots",
    description: "Touched patches sometimes spring back immediately.",
    color: "#b7eba5",
    apply: (stats) => {
      stats.instantRegrowChance += 0.08;
      stats.regrowMultiplier *= 0.92;
    },
  },
];

export function getWeather(id: WeatherId | undefined): WeatherDefinition {
  return WEATHER_TYPES.find((weather) => weather.id === id) ?? WEATHER_TYPES[0];
}

export function pickWeather(previousId?: WeatherId): WeatherDefinition {
  const candidates = WEATHER_TYPES.filter((weather) => weather.id !== previousId);
  return Phaser.Utils.Array.GetRandom(candidates);
}
