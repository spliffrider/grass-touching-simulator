import { getGoldDropChance } from "../data/economy";
import { getSeedDropChance } from "../data/seed-shop";
import { expandField } from "./FieldSystem";
import type { FieldTile, GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

export interface DropFeedback {
  createTileView(tile: FieldTile): void;
  layoutTiles(): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  emitSeedBurst(tile: FieldTile): void;
  emitGoldBurst(tile: FieldTile): void;
  playSound(sound: "seed" | "regrow" | "gold"): void;
}

export class DropSystem {
  tryDropSeed(
    state: GameState,
    tile: FieldTile,
    touchedTrait: TileTrait,
    stats: RuntimeStats,
    feedback: DropFeedback,
    chanceScale = 1,
  ): boolean {
    let chance = getSeedDropChance(state, stats.seedDropBonus);
    chance += touchedTrait === "lush" ? 0.08 : touchedTrait === "dewy" ? 0.04 : 0;
    chance *= chanceScale;

    if (Math.random() >= chance) {
      return false;
    }

    state.seeds += 1;
    state.lifetimeSeeds += 1;
    feedback.popAtTile(tile, "+1 seed", "#fff1a8");
    feedback.emitSeedBurst(tile);
    feedback.playSound("seed");

    const wildSpreadChance = state.seedShopPurchases.seed_catalog ? 0.55 : 0.35;
    const wildSpreadTileCount = state.seedShopPurchases.seed_catalog ? 2 : 1;
    if (state.seedShopPurchases.wild_spread && Math.random() < wildSpreadChance) {
      const addedTiles = expandField(state, wildSpreadTileCount, stats);

      for (const addedTile of addedTiles) {
        feedback.createTileView(addedTile);
      }

      if (addedTiles.length > 0) {
        feedback.layoutTiles();
        for (const addedTile of addedTiles) {
          feedback.popAtTile(addedTile, "sprout", "#dfffc8");
        }
        feedback.playSound("regrow");
      }
    }

    return true;
  }

  tryDropGold(
    state: GameState,
    tile: FieldTile,
    touchedTrait: TileTrait,
    touchedTier: GrassTierId,
    touch: TouchResult,
    stats: RuntimeStats,
    feedback: DropFeedback,
    chanceScale = 1,
  ): boolean {
    const guaranteedGold = (touchedTier === "golden" ? 5 : 0) + (touch.isCrit ? 1 : 0);
    const chance = getGoldDropChance(state, stats, touchedTrait, touchedTier, touch, chanceScale);
    const randomGold = guaranteedGold > 0 ? 0 : Math.random() < chance ? 1 : 0;
    const totalGold = guaranteedGold + randomGold;

    if (totalGold <= 0) {
      return false;
    }

    state.gold += totalGold;
    state.lifetimeGold += totalGold;
    feedback.popAtTile(tile, `+${totalGold} gold`, "#ffef78");
    feedback.emitGoldBurst(tile);
    feedback.playSound("gold");
    return true;
  }
}
