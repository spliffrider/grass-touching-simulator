import { getGrassTier } from "../data/grass-tiers";
import { getFieldTiles, getGrownTiles, tileKey, touchTile } from "./FieldSystem";
import { getInventoryQuantity } from "./InventorySystem";
import type { FieldTile, GameState, GrassTierId, RuntimeStats, TileTrait } from "../types/game-state";

export interface AnimalCompanionFeedback {
  refreshTile(tile: FieldTile): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  emitGoldBurst(tile: FieldTile, amount?: number): void;
  playCompanionAction(tile: FieldTile, action: "pollinate" | "scratch" | "forage" | "graze"): void;
  playTouchFeedback(tile: FieldTile, touchedTrait: TileTrait, isCrit: boolean): void;
  playSound(sound: "regrow" | "seed" | "gold"): void;
  playGrassTouch(tier: GrassTierId, trait: TileTrait, isCrit: boolean): void;
}

export class AnimalCompanionSystem {
  private beeHiveElapsed = 0;
  private chickenElapsed = 0;
  private sheepElapsed = 0;

  reset(): void {
    this.beeHiveElapsed = 0;
    this.chickenElapsed = 0;
    this.sheepElapsed = 0;
  }

  update(delta: number, state: GameState, stats: RuntimeStats, feedback: AnimalCompanionFeedback): boolean {
    let changed = false;
    const beeHives = getInventoryQuantity(state, "bee_hive");
    const chickens = getInventoryQuantity(state, "chicken");
    const sheep = getInventoryQuantity(state, "sheep");

    if (beeHives > 0) {
      this.beeHiveElapsed += delta;
      const beeInterval = Math.max(4200, 9500 - beeHives * 1500);
      if (this.beeHiveElapsed >= beeInterval) {
        this.beeHiveElapsed = 0;
        changed = this.pollinateFromBeeHive(state, beeHives, feedback) || changed;
      }
    }

    if (chickens > 0) {
      this.chickenElapsed += delta;
      const chickenInterval = Math.max(5200, 10500 - chickens * 1700);
      if (this.chickenElapsed >= chickenInterval) {
        this.chickenElapsed = 0;
        changed = this.runChickenForage(state, chickens, feedback) || changed;
      }
    }

    if (sheep > 0) {
      this.sheepElapsed += delta;
      const sheepInterval = Math.max(6200, 13200 - sheep * 2100);
      if (this.sheepElapsed >= sheepInterval) {
        this.sheepElapsed = 0;
        changed = this.runSheepGraze(state, stats, sheep, feedback) || changed;
      }
    }

    return changed;
  }

  private pollinateFromBeeHive(state: GameState, beeHives: number, feedback: AnimalCompanionFeedback): boolean {
    const tiles = getFieldTiles(state);
    const anchor = Phaser.Utils.Array.GetRandom(tiles);
    if (!anchor) {
      return false;
    }

    const cluster = [
      anchor,
      state.field[tileKey(anchor.x + 1, anchor.y)],
      state.field[tileKey(anchor.x - 1, anchor.y)],
      state.field[tileKey(anchor.x, anchor.y + 1)],
      state.field[tileKey(anchor.x, anchor.y - 1)],
    ].filter((tile): tile is FieldTile => tile !== undefined);
    const improvedTiles = Phaser.Utils.Array.Shuffle(cluster).slice(0, Math.min(cluster.length, 2 + beeHives));

    for (const tile of improvedTiles) {
      if (tile.grassState === "regrowing") {
        const remainingMs = Math.max(0, tile.regrowEndsAt - Date.now());
        tile.regrowEndsAt = Date.now() + Math.floor(remainingMs * 0.58);
      } else {
        tile.trait = Math.random() < 0.36 ? "lush" : "dewy";
      }

      feedback.refreshTile(tile);
      feedback.playCompanionAction(tile, "pollinate");
      feedback.popAtTile(tile, "pollinated", "#fff1a8");
    }

    if (improvedTiles.length > 0) {
      feedback.playSound("regrow");
    }

    return improvedTiles.length > 0;
  }

  private runChickenForage(state: GameState, chickens: number, feedback: AnimalCompanionFeedback): boolean {
    const tiles = getFieldTiles(state);
    const tile = Phaser.Utils.Array.GetRandom(tiles);
    if (!tile) {
      return false;
    }

    if (Math.random() < 0.42 + chickens * 0.1) {
      tile.trait = tile.trait === "lush" ? "lush" : Math.random() < 0.42 ? "lush" : "dewy";
      if (tile.grassState === "regrowing") {
        tile.regrowEndsAt = Math.min(tile.regrowEndsAt, Date.now() + 900);
      }
      feedback.refreshTile(tile);
      feedback.playCompanionAction(tile, "scratch");
      feedback.popAtTile(tile, "scratch", "#fff1a8");
      feedback.playSound("seed");
      return true;
    }

    state.gold += 1;
    state.lifetimeGold += 1;
    feedback.playCompanionAction(tile, "forage");
    feedback.popAtTile(tile, "+1 gold", "#ffef78");
    feedback.emitGoldBurst(tile);
    feedback.playSound("gold");
    return true;
  }

  private runSheepGraze(state: GameState, stats: RuntimeStats, sheep: number, feedback: AnimalCompanionFeedback): boolean {
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

    const goldGained = Math.max(1, Math.min(3, sheep));
    state.gold += goldGained;
    state.lifetimeGold += goldGained;
    feedback.playCompanionAction(tile, "graze");
    feedback.playTouchFeedback(tile, touchedTrait, touch.isCrit);
    feedback.refreshTile(tile);
    feedback.popAtTile(tile, `sheep +${touch.gained}`, "#dfffc8");
    feedback.popAtTile(tile, `+${goldGained} gold`, "#ffef78");
    feedback.emitGoldBurst(tile, goldGained);
    feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    feedback.playSound("gold");
    return true;
  }
}
