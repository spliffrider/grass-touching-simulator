import { getTotalAutomationTouchesPerMinute } from "../data/automation-systems";
import { addGrassTouches, normalizeGrassTouches } from "./AmountSystem";
import { getResolvedAutomationDirectiveId } from "./AutomationDirectiveSystem";
import { recordAutomationTouch } from "./AutomationProgressSystem";
import type { GameState, RuntimeStats } from "../types/game-state";

export interface AutomationIncomeResult {
  changed: boolean;
  gained: number;
  touchesPerMinute: number;
}

export class AutomationIncomeSystem {
  private fractionalTouches = 0;

  reset(): void {
    this.fractionalTouches = 0;
  }

  update(delta: number, state: GameState, stats?: RuntimeStats): AutomationIncomeResult {
    const touchesPerMinute = getTotalAutomationTouchesPerMinute(state, stats);
    if (touchesPerMinute <= 0) {
      return { changed: false, gained: 0, touchesPerMinute };
    }

    this.fractionalTouches += (touchesPerMinute / 60000) * delta;
    const gained = normalizeGrassTouches(this.fractionalTouches);
    if (gained <= 0) {
      return { changed: false, gained: 0, touchesPerMinute };
    }

    this.fractionalTouches = Number.isFinite(this.fractionalTouches) ? Math.max(0, this.fractionalTouches - gained) : 0;
    state.grassTouches = addGrassTouches(state.grassTouches, gained);
    state.lifetimeGrassTouches = addGrassTouches(state.lifetimeGrassTouches, gained);

    const directiveId = getResolvedAutomationDirectiveId(state);
    recordAutomationTouch(state, gained, directiveId);

    return { changed: true, gained, touchesPerMinute };
  }
}
