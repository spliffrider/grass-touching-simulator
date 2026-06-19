import type { AutomationDirectiveId, FieldTile, GameState, RuntimeStats } from "../types/game-state";

export interface AutomationDirective {
  id: AutomationDirectiveId;
  name: string;
  shortName: string;
  description: string;
}

export interface AutomationDirectiveTuning {
  resolvedId: ResolvedAutomationDirectiveId;
  touchOutputMultiplier: number;
  helperIntervalMultiplier: number;
  helperTouchMultiplier: number;
  helperTouchBonus: number;
  growthRegrowMultiplier: number;
  supplyChanceBonus: number;
}

export const AUTOMATION_DIRECTIVES: AutomationDirective[] = [
  {
    id: "balanced",
    name: "Balanced",
    shortName: "balanced",
    description: "Keeps automation steady with its usual mix of touches, growth help, seeds, and gold.",
  },
  {
    id: "growth",
    name: "Growth",
    shortName: "growth",
    description: "Keeps automation productive while speeding helpers, regrowth, and pollination.",
  },
  {
    id: "harvest",
    name: "Harvest",
    shortName: "harvest",
    description: "Pushes stronger automation output and richer helper touches.",
  },
  {
    id: "supplies",
    name: "Supplies",
    shortName: "supplies",
    description: "Keeps automation moving while improving seed and gold finds from helpers.",
  },
  {
    id: "autopilot",
    name: "Auto-Pilot",
    shortName: "auto",
    description: "Adapts between directives and gives the chosen plan a small tempo nudge.",
  },
];

export function isAutomationDirectiveId(value: unknown): value is AutomationDirectiveId {
  return typeof value === "string" && AUTOMATION_DIRECTIVES.some((directive) => directive.id === value);
}

export function getAutomationDirective(state: GameState): AutomationDirective {
  return AUTOMATION_DIRECTIVES.find((directive) => directive.id === state.automationDirectiveId) ?? AUTOMATION_DIRECTIVES[0];
}

export type ResolvedAutomationDirectiveId = Exclude<AutomationDirectiveId, "autopilot">;

const DIRECTIVE_TUNING: Record<ResolvedAutomationDirectiveId, AutomationDirectiveTuning> = {
  balanced: {
    resolvedId: "balanced",
    touchOutputMultiplier: 1,
    helperIntervalMultiplier: 1,
    helperTouchMultiplier: 1,
    helperTouchBonus: 0,
    growthRegrowMultiplier: 1,
    supplyChanceBonus: 0,
  },
  growth: {
    resolvedId: "growth",
    touchOutputMultiplier: 1.05,
    helperIntervalMultiplier: 0.86,
    helperTouchMultiplier: 1,
    helperTouchBonus: 0,
    growthRegrowMultiplier: 0.78,
    supplyChanceBonus: -0.01,
  },
  harvest: {
    resolvedId: "harvest",
    touchOutputMultiplier: 1.35,
    helperIntervalMultiplier: 1.02,
    helperTouchMultiplier: 1.16,
    helperTouchBonus: 2,
    growthRegrowMultiplier: 1.02,
    supplyChanceBonus: 0,
  },
  supplies: {
    resolvedId: "supplies",
    touchOutputMultiplier: 1.02,
    helperIntervalMultiplier: 1,
    helperTouchMultiplier: 1,
    helperTouchBonus: 0,
    growthRegrowMultiplier: 1,
    supplyChanceBonus: 0.12,
  },
};

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

export function getAutomationDirectiveTuning(state: GameState): AutomationDirectiveTuning {
  const resolvedId = getResolvedAutomationDirectiveId(state);
  const base = DIRECTIVE_TUNING[resolvedId];
  if (state.automationDirectiveId !== "autopilot") {
    return base;
  }

  return {
    ...base,
    touchOutputMultiplier: base.touchOutputMultiplier * 1.1,
    helperIntervalMultiplier: base.helperIntervalMultiplier * 0.94,
  };
}

export function getAutomationDirectiveTouchStats(state: GameState, stats: RuntimeStats): RuntimeStats {
  const tuning = getAutomationDirectiveTuning(state);
  if (tuning.helperTouchMultiplier === 1 && tuning.helperTouchBonus === 0) {
    return stats;
  }

  return {
    ...stats,
    touchMultiplier: stats.touchMultiplier * tuning.helperTouchMultiplier + tuning.helperTouchBonus,
  };
}

function isHighValueAutomationTarget(tile: FieldTile): boolean {
  return tile.trait !== "normal" || tile.tier !== "normal" || tile.fertility >= 1.12 || tile.moisture >= 1.12;
}
