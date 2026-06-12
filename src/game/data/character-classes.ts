import type { CharacterClassId, RuntimeStats } from "../types/game-state";

export interface CharacterClassDefinition {
  id: CharacterClassId;
  name: string;
  archetype: string;
  iconKey?: string;
  iconPath?: string;
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
    iconKey: "class-femboy-slim",
    iconPath: "/assets/ui/classes/femboy-slim.png",
    passiveName: "Balanced Slay",
    passiveDescription: "A confident stance that makes every touch a little stronger and a little flashier.",
    flavor: "Reliable, stylish, and suspiciously good at turning one patch into a whole afternoon.",
    statLines: ["+1 touch value", "+1% crit chance", "+1% double-touch chance"],
    apply: (stats) => {
      stats.touchMultiplier += 1;
      stats.critChance += 0.01;
      stats.doubleTouchChance += 0.01;
    },
  },
  {
    id: "bard_de_wever",
    name: "Bard De Wever",
    archetype: "Bard / Combo Support",
    iconKey: "class-bard-de-wever",
    iconPath: "/assets/ui/classes/bard-de-wever.png",
    passiveName: "Four-on-the-Floor Encore",
    passiveDescription: "Keeps the rhythm going longer and turns combo streaks into better payoffs.",
    flavor: "Plays the field like an audience, then somehow convinces the grass to applaud.",
    statLines: ["+18% combo window", "+8% combo bonus touches", "+0.8% seed drop chance"],
    apply: (stats) => {
      stats.comboWindowMultiplier *= 1.18;
      stats.comboBonusMultiplier *= 1.08;
      stats.seedDropBonus += 0.008;
    },
  },
];

export function getCharacterClass(id: CharacterClassId | undefined): CharacterClassDefinition {
  return CHARACTER_CLASSES.find((characterClass) => characterClass.id === id) ?? CHARACTER_CLASSES[0];
}

export function isCharacterClassId(value: unknown): value is CharacterClassId {
  return value === "femboy_slim" || value === "bard_de_wever";
}
