import type { CharacterClassId, RuntimeStats } from "../types/game-state";

export interface CharacterClassDefinition {
  id: CharacterClassId;
  name: string;
  archetype: string;
  passiveName: string;
  passiveDescription: string;
  flavor: string;
  statLines: string[];
  apply(stats: RuntimeStats): void;
}

export const DEFAULT_CHARACTER_CLASS_ID: CharacterClassId = "femboy_slim";

export const CHARACTER_CLASSES: CharacterClassDefinition[] = [
  {
    id: "femboy_slim",
    name: "Femboy Slim",
    archetype: "Fighter / Allrounder",
    passiveName: "Balanced Slay",
    passiveDescription: "A confident stance that makes every touch a little stronger and a little flashier.",
    flavor: "Reliable, stylish, and suspiciously good at turning one patch into a whole afternoon.",
    statLines: ["+1 touch value", "+2% crit chance", "+2.5% double-touch chance"],
    apply: (stats) => {
      stats.touchMultiplier += 1;
      stats.critChance += 0.02;
      stats.doubleTouchChance += 0.025;
    },
  },
  {
    id: "bard_de_wever",
    name: "Bard De Wever",
    archetype: "Bard / Combo Support",
    passiveName: "Four-on-the-Floor Encore",
    passiveDescription: "Keeps the rhythm going longer and turns combo streaks into better payoffs.",
    flavor: "Plays the field like an audience, then somehow convinces the grass to applaud.",
    statLines: ["+30% combo window", "+15% combo bonus touches", "+1.5% seed drop chance"],
    apply: (stats) => {
      stats.comboWindowMultiplier *= 1.3;
      stats.comboBonusMultiplier *= 1.15;
      stats.seedDropBonus += 0.015;
    },
  },
];

export function getCharacterClass(id: CharacterClassId | undefined): CharacterClassDefinition {
  return CHARACTER_CLASSES.find((characterClass) => characterClass.id === id) ?? CHARACTER_CLASSES[0];
}

export function isCharacterClassId(value: unknown): value is CharacterClassId {
  return value === "femboy_slim" || value === "bard_de_wever";
}
