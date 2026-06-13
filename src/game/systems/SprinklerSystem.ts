import { getGrassTier } from "../data/grass-tiers";
import { getRandomGrownTile, touchTile } from "./FieldSystem";
import type { FieldTile, GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

export interface SprinklerFeedback {
  refreshTile(tile: FieldTile): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  playSprinklerBurst(tile: FieldTile): void;
  playTouchFeedback(tile: FieldTile, touchedTrait: TileTrait, isCrit: boolean): void;
  tryDropSeed(tile: FieldTile, touchedTrait: TileTrait, stats: RuntimeStats, chanceScale: number): void;
  tryDropGold(
    tile: FieldTile,
    touchedTrait: TileTrait,
    touchedTier: GrassTierId,
    touch: TouchResult,
    stats: RuntimeStats,
    chanceScale: number,
  ): void;
  playGrassTouch(tier: GrassTierId, trait: TileTrait, isCrit: boolean): void;
}

export class SprinklerSystem {
  private elapsed = 0;

  reset(): void {
    this.elapsed = 0;
  }

  update(delta: number, state: GameState, stats: RuntimeStats, feedback: SprinklerFeedback): boolean {
    if (!state.seedShopPurchases.sprinkler) {
      return false;
    }

    this.elapsed += delta;
    const sprinklerInterval = state.seedShopPurchases.sprinkler_timer ? 7000 : 11000;
    if (this.elapsed < sprinklerInterval) {
      return false;
    }

    this.elapsed = 0;
    const touchesPerCycle = state.seedShopPurchases.sprinkler_network ? 2 : 1;
    let changed = false;

    for (let i = 0; i < touchesPerCycle; i += 1) {
      const tile = getRandomGrownTile(state);
      if (!tile) {
        break;
      }

      const touchedTrait = tile.trait;
      const touchedTier = getGrassTier(tile.tier);
      const touch = touchTile(tile, state, stats, Date.now());
      if (touch.gained === 0) {
        continue;
      }

      feedback.playSprinklerBurst(tile);
      feedback.playTouchFeedback(tile, touchedTrait, touch.isCrit);
      feedback.refreshTile(tile);
      feedback.popAtTile(
        tile,
        getTouchPopText(touch, touchedTier.id === "normal" ? "sprinkler" : touchedTier.label),
        touch.isCrit ? "#ffef78" : "#d7fff2",
      );

      if (touch.instantRegrown) {
        feedback.popAtTile(tile, "instant regrow", "#dfffc8");
      }

      if (state.seedShopPurchases.self_seeding_nozzle) {
        feedback.tryDropSeed(tile, touchedTrait, stats, 0.25);
      }

      feedback.tryDropGold(tile, touchedTrait, touchedTier.id, touch, stats, 0.2);
      feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
      changed = true;
    }

    return changed;
  }
}

function getTouchPopText(touch: TouchResult, label: string): string {
  const prefix = [label, touch.doubled ? "DOUBLE" : "", touch.isCrit ? `CRIT x${touch.critMultiplier.toFixed(1)}` : ""].filter(Boolean).join(" ");
  return `${prefix ? `${prefix} ` : ""}+${touch.gained}`;
}
