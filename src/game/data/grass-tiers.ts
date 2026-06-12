import type { GameState, GrassTierId, RuntimeStats } from "../types/game-state";

export interface GrassTierDefinition {
  id: GrassTierId;
  name: string;
  label: string;
  touchValue: number;
  unlockAtLifetimeTouches: number;
  weight: number;
  colors: number[];
}

export const GRASS_TIERS: GrassTierDefinition[] = [
  {
    id: "normal",
    name: "Normal Grass",
    label: "",
    touchValue: 1,
    unlockAtLifetimeTouches: 0,
    weight: 100,
    colors: [0x2f8436, 0x3fa244, 0x58bd4f, 0x75d35d],
  },
  {
    id: "thick",
    name: "Thick Grass",
    label: "thick",
    touchValue: 3,
    unlockAtLifetimeTouches: 150,
    weight: 18,
    colors: [0x246d2e, 0x338e3d, 0x51b85a, 0x8ee071],
  },
  {
    id: "clover",
    name: "Clover Grass",
    label: "clover",
    touchValue: 7,
    unlockAtLifetimeTouches: 500,
    weight: 10,
    colors: [0x26704b, 0x3f9c65, 0x68c987, 0xb7eba5],
  },
  {
    id: "golden",
    name: "Golden Grass",
    label: "gold",
    touchValue: 15,
    unlockAtLifetimeTouches: 1200,
    weight: 5,
    colors: [0x887026, 0xb99a32, 0xe4c955, 0xffeb82],
  },
  {
    id: "wildflower",
    name: "Wildflower Grass",
    label: "flowers",
    touchValue: 24,
    unlockAtLifetimeTouches: 2600,
    weight: 7,
    colors: [0x2f8436, 0x58bd4f, 0xfff1a8, 0xffb7d5],
  },
  {
    id: "moss",
    name: "Moss Grass",
    label: "moss",
    touchValue: 38,
    unlockAtLifetimeTouches: 5000,
    weight: 6,
    colors: [0x173d2c, 0x246d3f, 0x3f9c65, 0x8ee071],
  },
  {
    id: "mushroom",
    name: "Mushroom Grass",
    label: "shroom",
    touchValue: 62,
    unlockAtLifetimeTouches: 9500,
    weight: 5,
    colors: [0x24491f, 0x3f7b33, 0xc7975d, 0xfff1a8],
  },
  {
    id: "crystal",
    name: "Crystal Grass",
    label: "crystal",
    touchValue: 100,
    unlockAtLifetimeTouches: 18000,
    weight: 4,
    colors: [0x1f6d74, 0x28a4ad, 0x75e8ff, 0xd7fff2],
  },
  {
    id: "frost",
    name: "Frost Grass",
    label: "frost",
    touchValue: 160,
    unlockAtLifetimeTouches: 32000,
    weight: 3,
    colors: [0x4b8e87, 0x83c9c7, 0xc8f7ff, 0xffffff],
  },
];

export function getGrassTier(id: GrassTierId | undefined): GrassTierDefinition {
  return GRASS_TIERS.find((tier) => tier.id === id) ?? GRASS_TIERS[0];
}

export function pickGrassTier(state: GameState, stats?: RuntimeStats): GrassTierDefinition {
  const unlocked = GRASS_TIERS.filter((tier) => state.lifetimeGrassTouches >= tier.unlockAtLifetimeTouches);
  const weighted = unlocked.flatMap((tier) => {
    const multiplier = tier.id === "normal" ? 1 : (stats?.rareTierMultiplier ?? 1);
    return Array.from({ length: Math.max(1, Math.round(tier.weight * multiplier)) }, () => tier);
  });

  return Phaser.Utils.Array.GetRandom(weighted);
}

export function getNextGrassTier(state: GameState): GrassTierDefinition | undefined {
  return GRASS_TIERS.find((tier) => state.lifetimeGrassTouches < tier.unlockAtLifetimeTouches);
}
