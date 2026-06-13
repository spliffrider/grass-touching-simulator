import { getGrassTier } from "../data/grass-tiers";
import { getAutomationDirective } from "./AutomationDirectiveSystem";
import { getAutomationIntervalMultiplier } from "./AutomationMilestoneSystem";
import { recordAutomationAction, recordAutomationSupplyDrop, recordAutomationTouch } from "./AutomationProgressSystem";
import { getRandomGrownTile, getRegrowingTiles, sampleGrownTiles, tileKey, touchTile } from "./FieldSystem";
import type { AutomationDirectiveId, FieldTile, GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

export interface SprinklerFeedback {
  refreshTile(tile: FieldTile): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  playSprinklerBurst(tile: FieldTile): void;
  playTouchFeedback(tile: FieldTile, touchedTrait: TileTrait, isCrit: boolean): void;
  tryDropSeed(tile: FieldTile, touchedTrait: TileTrait, stats: RuntimeStats, chanceScale: number): boolean;
  tryDropGold(
    tile: FieldTile,
    touchedTrait: TileTrait,
    touchedTier: GrassTierId,
    touch: TouchResult,
    stats: RuntimeStats,
    chanceScale: number,
  ): boolean;
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
    const sprinklerInterval = Math.max(
      5000,
      (state.seedShopPurchases.sprinkler_timer ? 7000 : 11000) * getAutomationIntervalMultiplier(state),
    );
    if (this.elapsed < sprinklerInterval) {
      return false;
    }

    this.elapsed = 0;
    const touchesPerCycle = state.seedShopPurchases.sprinkler_network ? 2 : 1;
    const sprinklerRadius = state.seedShopPurchases.sprinkler_network ? 2 : 1;
    const directiveId = getAutomationDirective(state).id;
    let changed = false;

    for (let i = 0; i < touchesPerCycle; i += 1) {
      const tile = getSprinklerTargetTile(state, sprinklerRadius, directiveId);
      if (!tile) {
        break;
      }

      if (tile.grassState === "regrowing") {
        const remainingMs = Math.max(0, tile.regrowEndsAt - Date.now());
        tile.regrowEndsAt = Date.now() + Math.max(300, Math.floor(remainingMs * 0.58));
        feedback.playSprinklerBurst(tile);
        feedback.refreshTile(tile);
        recordAutomationAction(state, directiveId);
        changed = true;
        continue;
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
      feedback.popAtTile(tile, getTouchPopText(touch), touch.isCrit ? "#ffef78" : "#d7fff2");

      if (touch.instantRegrown) {
        feedback.playSprinklerBurst(tile);
      }

      recordAutomationTouch(state, touch.gained, directiveId);

      if (state.seedShopPurchases.self_seeding_nozzle) {
        if (feedback.tryDropSeed(tile, touchedTrait, stats, directiveId === "supplies" ? 0.38 : 0.25)) {
          recordAutomationSupplyDrop(state, 1, directiveId);
        }
      }

      if (
        feedback.tryDropGold(
          tile,
          touchedTrait,
          touchedTier.id,
          touch,
          stats,
          directiveId === "supplies" ? 0.32 : 0.2,
        )
      ) {
        recordAutomationSupplyDrop(state, 1, directiveId);
      }
      feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
      changed = true;
    }

    return changed;
  }
}

function getSprinklerTargetTile(state: GameState, radius: number, directiveId: AutomationDirectiveId): FieldTile | undefined {
  if (directiveId === "growth" && Math.random() < 0.72) {
    return getSprinklerRegrowingTargetTile(state, radius) ?? getSprinklerGrownTargetTile(state, radius, directiveId);
  }

  return getSprinklerGrownTargetTile(state, radius, directiveId);
}

function getSprinklerGrownTargetTile(state: GameState, radius: number, directiveId: AutomationDirectiveId): FieldTile | undefined {
  const placement = state.placedWorldObjects.sprinkler;
  const placedTile = placement ? state.field[placement.tileKey] : undefined;
  if (!placedTile) {
    return directiveId === "harvest" ? pickBestTile(sampleGrownTiles(state, 10), scoreHarvestTile) : getRandomGrownTile(state);
  }

  const localTiles: FieldTile[] = [];

  for (let y = placedTile.y - radius; y <= placedTile.y + radius; y += 1) {
    for (let x = placedTile.x - radius; x <= placedTile.x + radius; x += 1) {
      const tile = state.field[tileKey(x, y)];
      if (tile?.grassState === "grown") {
        localTiles.push(tile);
      }
    }
  }

  if (directiveId === "harvest") {
    return pickBestTile(localTiles, scoreHarvestTile) ?? pickBestTile(sampleGrownTiles(state, 10), scoreHarvestTile);
  }

  return Phaser.Utils.Array.GetRandom(localTiles) ?? getRandomGrownTile(state);
}

function getSprinklerRegrowingTargetTile(state: GameState, radius: number): FieldTile | undefined {
  const placement = state.placedWorldObjects.sprinkler;
  const placedTile = placement ? state.field[placement.tileKey] : undefined;

  if (!placedTile) {
    return Phaser.Utils.Array.GetRandom(getRegrowingTiles(state));
  }

  const localTiles: FieldTile[] = [];
  for (let y = placedTile.y - radius; y <= placedTile.y + radius; y += 1) {
    for (let x = placedTile.x - radius; x <= placedTile.x + radius; x += 1) {
      const tile = state.field[tileKey(x, y)];
      if (tile?.grassState === "regrowing") {
        localTiles.push(tile);
      }
    }
  }

  return Phaser.Utils.Array.GetRandom(localTiles) ?? Phaser.Utils.Array.GetRandom(getRegrowingTiles(state));
}

function getTouchPopText(touch: TouchResult): string {
  const effects = [touch.doubled ? "2x" : "", touch.isCrit ? `CRIT x${touch.critMultiplier.toFixed(1)}` : ""].filter(Boolean);
  return [`+${touch.gained}`, ...effects].join(" ");
}

function pickBestTile(tiles: FieldTile[], scoreTile: (tile: FieldTile) => number): FieldTile | undefined {
  let bestTile: FieldTile | undefined;
  let bestScore = -Infinity;

  for (const tile of tiles) {
    const score = scoreTile(tile);
    if (!bestTile || score > bestScore) {
      bestTile = tile;
      bestScore = score;
    }
  }

  return bestTile;
}

function scoreHarvestTile(tile: FieldTile): number {
  const tierScore = getGrassTier(tile.tier).touchValue;
  const traitScore = tile.trait === "lush" ? 3 : tile.trait === "dewy" ? 1 : 0;
  return tierScore + traitScore + tile.moisture;
}
