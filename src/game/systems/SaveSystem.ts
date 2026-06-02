import { createInitialState } from "./FieldSystem";
import type { GameState } from "../types/game-state";

const SAVE_KEY = "grass-touching-simulator.save.v1";

export function saveGame(state: GameState): void {
  state.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState {
  const rawSave = localStorage.getItem(SAVE_KEY);

  if (!rawSave) {
    return createInitialState();
  }

  try {
    const parsed = JSON.parse(rawSave) as GameState;
    return {
      ...createInitialState(),
      ...parsed,
      field: parsed.field ?? createInitialState().field,
      upgrades: parsed.upgrades ?? {},
      reachedMilestones: parsed.reachedMilestones ?? [],
    };
  } catch {
    return createInitialState();
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function resetSave(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return createInitialState();
}
