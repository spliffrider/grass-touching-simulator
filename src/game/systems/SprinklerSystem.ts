import { getGrassTier } from "../data/grass-tiers";
import { getAutomationPairSynergyPower } from "../data/automation-systems";
import {
  getAutomationDirectiveTouchStats,
  getAutomationDirectiveTuning,
  getResolvedAutomationDirectiveId,
  type ResolvedAutomationDirectiveId,
} from "./AutomationDirectiveSystem";
import { getAutomationIntervalMultiplier } from "./AutomationMilestoneSystem";
import { recordAutomationAction, recordAutomationSupplyDrop, recordAutomationTouch } from "./AutomationProgressSystem";
import { getFieldTiles, getRandomRegrowingTile, sampleGrownTiles, tileKey, touchTile } from "./FieldSystem";
import { getTileHazard } from "./HazardSystem";
import type { FieldTile, GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

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
  recordAutomationCombo(tile: FieldTile, touch: TouchResult, source: "sprinkler"): number;
  recordAutomationComboAction(tile: FieldTile, source: "sprinkler"): number;
  playGrassTouch(tier: GrassTierId, trait: TileTrait, isCrit: boolean, comboCount?: number): void;
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
    const directiveTuning = getAutomationDirectiveTuning(state);
    const sprinklerInterval = Math.max(
      5000,
      (state.seedShopPurchases.sprinkler_timer ? 7000 : 11000) * getAutomationIntervalMultiplier(state) * directiveTuning.helperIntervalMultiplier,
    );
    if (this.elapsed < sprinklerInterval) {
      return false;
    }

    this.elapsed = 0;
    const bloomCyclePower = getAutomationPairSynergyPower(state, "bloom_cycle", stats);
    const touchesPerCycle = (state.seedShopPurchases.sprinkler_network ? 2 : 1) + (bloomCyclePower >= 0.25 ? 1 : 0);
    const sprinklerRadius = state.seedShopPurchases.sprinkler_network ? 2 : 1;
    const directiveId = getResolvedAutomationDirectiveId(state);
    const directiveStats = getAutomationDirectiveTouchStats(state, stats);
    let changed = false;

    for (let i = 0; i < touchesPerCycle; i += 1) {
      const tile = getSprinklerTargetTile(state, sprinklerRadius, directiveId);
      if (!tile) {
        break;
      }

      if (hasActiveCactusHazard(state, tile)) {
        continue;
      }

      if (tile.grassState === "regrowing") {
        const remainingMs = Math.max(0, tile.regrowEndsAt - Date.now());
        tile.regrowEndsAt = Date.now() + Math.max(300, Math.floor(remainingMs * 0.58 * directiveTuning.growthRegrowMultiplier));
        feedback.playSprinklerBurst(tile);
        feedback.refreshTile(tile);
        recordAutomationAction(state, directiveId);
        feedback.recordAutomationComboAction(tile, "sprinkler");
        changed = true;
        continue;
      }

      const touchedTrait = tile.trait;
      const touchedTier = getGrassTier(tile.tier);
      const touch = touchTile(tile, state, directiveStats, Date.now());
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
      const comboCount = feedback.recordAutomationCombo(tile, touch, "sprinkler");

      if (state.seedShopPurchases.self_seeding_nozzle) {
        if (
          feedback.tryDropSeed(
            tile,
            touchedTrait,
            stats,
            Math.max(0.05, (directiveId === "supplies" ? 0.38 : 0.25) + bloomCyclePower * 0.16 + directiveTuning.supplyChanceBonus),
          )
        ) {
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
          Math.max(0.05, (directiveId === "supplies" ? 0.32 : 0.2) + bloomCyclePower * 0.12 + directiveTuning.supplyChanceBonus),
        )
      ) {
        recordAutomationSupplyDrop(state, 1, directiveId);
      }
      feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, comboCount);
      changed = true;
    }

    return changed;
  }
}

function getSprinklerTargetTile(state: GameState, radius: number, directiveId: ResolvedAutomationDirectiveId): FieldTile | undefined {
  if (directiveId === "growth" && Math.random() < 0.72) {
    return getSprinklerRegrowingTargetTile(state, radius) ?? getSprinklerGrownTargetTile(state, radius, directiveId);
  }

  return getSprinklerGrownTargetTile(state, radius, directiveId);
}

function getSprinklerGrownTargetTile(state: GameState, radius: number, directiveId: ResolvedAutomationDirectiveId): FieldTile | undefined {
  const placement = state.placedWorldObjects.sprinkler;
  const placedTile = placement ? state.field[placement.tileKey] : undefined;
  if (!placedTile) {
    return directiveId === "harvest" ? pickBestTile(sampleSafeGrownTiles(state, 10), scoreHarvestTile) : getRandomSafeGrownTile(state);
  }

  const localTiles: FieldTile[] = [];

  for (let y = placedTile.y - radius; y <= placedTile.y + radius; y += 1) {
    for (let x = placedTile.x - radius; x <= placedTile.x + radius; x += 1) {
      const tile = state.field[tileKey(x, y)];
      if (tile?.grassState === "grown" && !hasActiveCactusHazard(state, tile)) {
        localTiles.push(tile);
      }
    }
  }

  if (directiveId === "harvest") {
    return pickBestTile(localTiles, scoreHarvestTile) ?? pickBestTile(sampleSafeGrownTiles(state, 10), scoreHarvestTile);
  }

  return Phaser.Utils.Array.GetRandom(localTiles) ?? getRandomSafeGrownTile(state);
}

function getSprinklerRegrowingTargetTile(state: GameState, radius: number): FieldTile | undefined {
  const placement = state.placedWorldObjects.sprinkler;
  const placedTile = placement ? state.field[placement.tileKey] : undefined;

  if (!placedTile) {
    return getRandomRegrowingTile(state, (tile) => !hasActiveCactusHazard(state, tile));
  }

  const localTiles: FieldTile[] = [];
  for (let y = placedTile.y - radius; y <= placedTile.y + radius; y += 1) {
    for (let x = placedTile.x - radius; x <= placedTile.x + radius; x += 1) {
      const tile = state.field[tileKey(x, y)];
      if (tile?.grassState === "regrowing" && !hasActiveCactusHazard(state, tile)) {
        localTiles.push(tile);
      }
    }
  }

  return Phaser.Utils.Array.GetRandom(localTiles) ?? getRandomRegrowingTile(state, (tile) => !hasActiveCactusHazard(state, tile));
}

function hasActiveCactusHazard(state: GameState, tile: FieldTile): boolean {
  return getTileHazard(state, tileKey(tile.x, tile.y))?.id === "cactus";
}

function getRandomSafeGrownTile(state: GameState): FieldTile | undefined {
  const tiles = getFieldTiles(state);
  const randomAttempts = Math.min(32, tiles.length);
  for (let attempt = 0; attempt < randomAttempts; attempt += 1) {
    const tile = Phaser.Utils.Array.GetRandom(tiles);
    if (tile?.grassState === "grown" && !hasActiveCactusHazard(state, tile)) {
      return tile;
    }
  }

  return tiles.find((tile) => tile.grassState === "grown" && !hasActiveCactusHazard(state, tile));
}

function sampleSafeGrownTiles(state: GameState, maxSamples: number): FieldTile[] {
  const sampled = sampleGrownTiles(state, Math.max(maxSamples, maxSamples * 2)).filter((tile) => !hasActiveCactusHazard(state, tile));
  if (sampled.length >= maxSamples) {
    return sampled.slice(0, maxSamples);
  }

  const seen = new Set(sampled.map((tile) => tileKey(tile.x, tile.y)));
  for (const tile of getFieldTiles(state)) {
    if (sampled.length >= maxSamples) {
      break;
    }
    const key = tileKey(tile.x, tile.y);
    if (tile.grassState === "grown" && !seen.has(key) && !hasActiveCactusHazard(state, tile)) {
      sampled.push(tile);
      seen.add(key);
    }
  }

  return sampled;
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
