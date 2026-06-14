import type { GameState } from "../types/game-state";

const AUTOMATION_MILESTONE_THRESHOLDS = [2, 4, 7, 11] as const;
const AUTOMATION_INTERVAL_MULTIPLIERS = [1, 0.96, 0.91, 0.86, 0.82] as const;

export function getAutomationUnitCount(state: GameState): number {
  return Object.values(state.automationSystems ?? {}).reduce((total, system) => total + Math.max(0, Math.floor(system.owned)), 0);
}

export function getAutomationMilestoneTier(state: GameState): number {
  const automationUnits = getAutomationUnitCount(state);
  let tier = 0;

  for (const threshold of AUTOMATION_MILESTONE_THRESHOLDS) {
    if (automationUnits < threshold) {
      break;
    }
    tier += 1;
  }

  return tier;
}

export function getAutomationIntervalMultiplier(state: GameState): number {
  return AUTOMATION_INTERVAL_MULTIPLIERS[getAutomationMilestoneTier(state)];
}

export function getAutomationMilestoneBoostLabel(state: GameState): string {
  const tier = getAutomationMilestoneTier(state);
  return tier > 0 ? `tempo ${toRomanNumeral(tier)}` : "";
}

function toRomanNumeral(value: number): string {
  return ["", "I", "II", "III", "IV"][value] ?? `${value}`;
}
