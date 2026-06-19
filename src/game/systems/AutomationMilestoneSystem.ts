import type { AutomationSystemId, GameState } from "../types/game-state";

const AUTOMATION_MILESTONE_THRESHOLDS = [2, 4, 7, 11] as const;
const AUTOMATION_INTERVAL_MULTIPLIERS = [1, 0.92, 0.84, 0.76, 0.68] as const;
const AUTOMATION_SYSTEM_MILESTONES = [
  { owned: 5, multiplier: 1.6 },
  { owned: 10, multiplier: 2.8 },
  { owned: 25, multiplier: 6 },
  { owned: 50, multiplier: 11 },
  { owned: 100, multiplier: 20 },
] as const;

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

export function getAutomationSystemMilestoneTier(state: GameState, systemId: AutomationSystemId): number {
  const owned = Math.max(0, Math.floor(state.automationSystems?.[systemId]?.owned ?? 0));
  let tier = 0;

  for (const milestone of AUTOMATION_SYSTEM_MILESTONES) {
    if (owned < milestone.owned) {
      break;
    }
    tier += 1;
  }

  return tier;
}

export function getAutomationSystemMilestoneMultiplier(state: GameState, systemId: AutomationSystemId): number {
  const tier = getAutomationSystemMilestoneTier(state, systemId);
  return tier > 0 ? AUTOMATION_SYSTEM_MILESTONES[tier - 1].multiplier : 1;
}

export function getNextAutomationSystemMilestone(
  state: GameState,
  systemId: AutomationSystemId,
): { owned: number; multiplier: number } | undefined {
  const tier = getAutomationSystemMilestoneTier(state, systemId);
  return AUTOMATION_SYSTEM_MILESTONES[tier];
}

export function getAutomationSystemMilestoneLabel(state: GameState, systemId: AutomationSystemId): string {
  const multiplier = getAutomationSystemMilestoneMultiplier(state, systemId);
  return multiplier > 1 ? `milestone x${formatAutomationMultiplier(multiplier)}` : "";
}

export function formatAutomationMultiplier(multiplier: number): string {
  return Number.isInteger(multiplier) ? multiplier.toFixed(0) : multiplier.toFixed(1);
}

function toRomanNumeral(value: number): string {
  return ["", "I", "II", "III", "IV"][value] ?? `${value}`;
}
