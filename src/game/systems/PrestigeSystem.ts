import { addGrassTouches, formatGrassTouches, normalizeGrassTouches, type GrassTouchAmount } from "./AmountSystem";
import type { GameState, PrestigeState } from "../types/game-state";

export const PRESTIGE_UNLOCK_TOUCHES = 25_000;
export const FIRST_PRESTIGE_MEMORY = 5;

export interface PrestigePreview {
  runTouches: GrassTouchAmount;
  memoryGain: number;
  canPrestige: boolean;
  missingTouches: GrassTouchAmount;
  currentMultiplier: number;
  nextMultiplier: number;
}

export function createPrestigeState(): PrestigeState {
  return {
    resets: 0,
    meadowMemory: 0,
    bestRunGrassTouches: 0,
    lastRunGrassTouches: 0,
    totalPrestigeGrassTouches: 0,
  };
}

export function getPrestigeMemoryGain(runTouches: GrassTouchAmount): number {
  const touches = normalizeGrassTouches(runTouches);
  if (touches < PRESTIGE_UNLOCK_TOUCHES) {
    return 0;
  }

  const ratio = Math.max(1, touches / PRESTIGE_UNLOCK_TOUCHES);
  return Math.min(5000, Math.max(FIRST_PRESTIGE_MEMORY, Math.floor(FIRST_PRESTIGE_MEMORY * ratio ** 0.42)));
}

export function getPrestigeProductionMultiplier(state: GameState, extraMemory = 0, extraResets = 0): number {
  const prestige = state.prestige ?? createPrestigeState();
  const meadowMemory = Math.max(0, prestige.meadowMemory + extraMemory);
  const resets = Math.max(0, prestige.resets + extraResets);
  return 1 + meadowMemory * 0.18 + Math.sqrt(meadowMemory) * 0.08 + resets * 0.12;
}

export function getPrestigePreview(state: GameState): PrestigePreview {
  const runTouches = normalizeGrassTouches(state.lifetimeGrassTouches);
  const memoryGain = getPrestigeMemoryGain(runTouches);
  const currentMultiplier = getPrestigeProductionMultiplier(state);
  return {
    runTouches,
    memoryGain,
    canPrestige: memoryGain > 0,
    missingTouches: normalizeGrassTouches(PRESTIGE_UNLOCK_TOUCHES - runTouches),
    currentMultiplier,
    nextMultiplier: getPrestigeProductionMultiplier(state, memoryGain, memoryGain > 0 ? 1 : 0),
  };
}

export function getNextPrestigeState(state: GameState, memoryGain = getPrestigeMemoryGain(state.lifetimeGrassTouches)): PrestigeState {
  const current = state.prestige ?? createPrestigeState();
  const runTouches = normalizeGrassTouches(state.lifetimeGrassTouches);
  return {
    resets: current.resets + 1,
    meadowMemory: current.meadowMemory + memoryGain,
    bestRunGrassTouches: Math.max(current.bestRunGrassTouches, runTouches),
    lastRunGrassTouches: runTouches,
    totalPrestigeGrassTouches: addGrassTouches(current.totalPrestigeGrassTouches, runTouches),
  };
}

export function formatPrestigeMultiplier(multiplier: number): string {
  return multiplier >= 10 ? multiplier.toFixed(1) : multiplier.toFixed(2);
}

export function formatPrestigeProgress(preview: PrestigePreview): string {
  return preview.canPrestige
    ? `Prestige ready: +${preview.memoryGain} Meadow Memory, x${formatPrestigeMultiplier(preview.currentMultiplier)} -> x${formatPrestigeMultiplier(
        preview.nextMultiplier,
      )}`
    : `Prestige unlocks at ${formatGrassTouches(PRESTIGE_UNLOCK_TOUCHES)} run touches (${formatGrassTouches(preview.missingTouches)} to go)`;
}
