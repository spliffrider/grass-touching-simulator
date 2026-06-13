import type { AutomationDirectiveId, GameState } from "../types/game-state";

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
];

export function isAutomationDirectiveId(value: unknown): value is AutomationDirectiveId {
  return typeof value === "string" && AUTOMATION_DIRECTIVES.some((directive) => directive.id === value);
}

export function getAutomationDirective(state: GameState): AutomationDirective {
  return AUTOMATION_DIRECTIVES.find((directive) => directive.id === state.automationDirectiveId) ?? AUTOMATION_DIRECTIVES[0];
}
