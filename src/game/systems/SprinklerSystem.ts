import { getGrassTier } from "../data/grass-tiers";
import { getGrownTiles, touchTile } from "./FieldSystem";
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
    const sprinklerInterval = state.seedShopPurchases.sprinkler_timer ? 3200 : 4800;
    if (this.elapsed < sprinklerInterval) {
      return false;
    }

    this.elapsed = 0;
    const grownTiles = getGrownTiles(state);
    const tile = Phaser.Utils.Array.GetRandom(grownTiles);
    if (!tile) {
      return false;
    }

    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    const touch = touchTile(tile, state, stats, Date.now());
    if (touch.gained === 0) {
      return false;
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
      feedback.tryDropSeed(tile, touchedTrait, stats, 0.45);
    }

    feedback.tryDropGold(tile, touchedTrait, touchedTier.id, touch, stats, 0.35);
    feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    return true;
  }
}

function getTouchPopText(touch: TouchResult, label: string): string {
  const prefix = [label, touch.doubled ? "DOUBLE" : "", touch.isCrit ? `CRIT x${touch.critMultiplier.toFixed(1)}` : ""].filter(Boolean).join(" ");
  return `${prefix ? `${prefix} ` : ""}+${touch.gained}`;
}
