import type { AutomationDirectiveId, AutomationStatsState, GameState } from "../types/game-state";

export function createAutomationStatsState(): AutomationStatsState {
  return {
    automatedActions: 0,
    automatedGrassTouches: 0,
    automationSupplyDrops: 0,
    usedDirectiveIds: ["balanced"],
  };
}

export function recordAutomationAction(state: GameState, directiveId: AutomationDirectiveId = state.automationDirectiveId): void {
  state.automationStats.automatedActions += 1;
  recordAutomationDirectiveUsed(state, directiveId);
}

export function recordAutomationTouch(
  state: GameState,
  gainedTouches: number,
  directiveId: AutomationDirectiveId = state.automationDirectiveId,
): void {
  state.automationStats.automatedGrassTouches += Math.max(0, gainedTouches);
  recordAutomationAction(state, directiveId);
}

export function recordAutomationSupplyDrop(
  state: GameState,
  amount = 1,
  directiveId: AutomationDirectiveId = state.automationDirectiveId,
): void {
  state.automationStats.automationSupplyDrops += Math.max(0, amount);
  recordAutomationDirectiveUsed(state, directiveId);
}

export function recordAutomationDirectiveUsed(state: GameState, directiveId: AutomationDirectiveId): void {
  if (!state.automationStats.usedDirectiveIds.includes(directiveId)) {
    state.automationStats.usedDirectiveIds.push(directiveId);
  }
}
