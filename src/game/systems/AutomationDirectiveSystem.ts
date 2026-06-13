import type { AutomationDirectiveId, FieldTile, GameState } from "../types/game-state";

export interface AutomationDirective {
  id: AutomationDirectiveId;
  name: string;
  shortName: string;
  description: string;
}

export const AUTOMATION_DIRECTIVES: AutomationDirective[] = [
  {
    id: "balanced",
    name: "Balanced",
    shortName: "balanced",
    description: "Keeps automation using its usual mix of touches, growth help, seeds, and gold.",
  },
  {
    id: "growth",
    name: "Growth",
    shortName: "growth",
    description: "Biases automation toward regrowth, pollination, and keeping the field ready.",
  },
  {
    id: "harvest",
    name: "Harvest",
    shortName: "harvest",
    description: "Biases automation toward higher-value grown patches when helpers touch grass.",
  },
  {
    id: "supplies",
    name: "Supplies",
    shortName: "supplies",
    description: "Biases automation toward extra seeds and gold from helpers that can find them.",
  },
  {
    id: "autopilot",
    name: "Auto-Pilot",
    shortName: "auto",
    description: "Lets automation choose growth, harvest, supplies, or balanced based on the field.",
  },
];

export function isAutomationDirectiveId(value: unknown): value is AutomationDirectiveId {
  return typeof value === "string" && AUTOMATION_DIRECTIVES.some((directive) => directive.id === value);
}

export function getAutomationDirective(state: GameState): AutomationDirective {
  return AUTOMATION_DIRECTIVES.find((directive) => directive.id === state.automationDirectiveId) ?? AUTOMATION_DIRECTIVES[0];
}

export type ResolvedAutomationDirectiveId = Exclude<AutomationDirectiveId, "autopilot">;

export function getResolvedAutomationDirectiveId(state: GameState): ResolvedAutomationDirectiveId {
  if (state.automationDirectiveId !== "autopilot") {
    return state.automationDirectiveId;
  }

  const tiles = Object.values(state.field);
  if (tiles.length === 0) {
    return "balanced";
  }

  const grownTiles = tiles.filter((tile) => tile.grassState === "grown");
  const grownRatio = grownTiles.length / tiles.length;
  const richGrownCount = grownTiles.filter(isHighValueAutomationTarget).length;

  if (grownRatio < 0.36) {
    return "growth";
  }

  if (state.seeds < 12 || state.gold < 4) {
    return "supplies";
  }

  if (richGrownCount >= Math.max(3, Math.ceil(grownTiles.length * 0.28))) {
    return "harvest";
  }

  return "balanced";
}

function isHighValueAutomationTarget(tile: FieldTile): boolean {
  return tile.trait !== "normal" || tile.tier !== "normal" || tile.fertility >= 1.12 || tile.moisture >= 1.12;
}
