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
import { getRandomFieldTile, getRandomGrownTile, getRegrowingTiles, sampleGrownTiles, tileKey, touchTile } from "./FieldSystem";
import { getInventoryQuantity } from "./InventorySystem";
import type { FieldTile, GameState, GrassTierId, RuntimeStats, TileTrait, TouchResult } from "../types/game-state";

export interface AnimalCompanionFeedback {
  refreshTile(tile: FieldTile): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  emitSeedBurst(tile: FieldTile): void;
  emitGoldBurst(tile: FieldTile, amount?: number): void;
  playCompanionAction(tile: FieldTile, action: "pollinate" | "scratch" | "forage" | "graze" | "burrow" | "scurry" | "hop"): void;
  playTouchFeedback(tile: FieldTile, touchedTrait: TileTrait, isCrit: boolean): void;
  recordAutomationCombo(tile: FieldTile, touch: TouchResult, source: "field_mouse" | "meadow_rabbit" | "sheep"): number;
  playSound(sound: "regrow" | "seed" | "gold"): void;
  playGrassTouch(tier: GrassTierId, trait: TileTrait, isCrit: boolean, comboCount?: number): void;
}

export class AnimalCompanionSystem {
  private fieldMouseElapsed = 0;
  private beeHiveElapsed = 0;
  private chickenElapsed = 0;
  private sheepElapsed = 0;
  private meadowRabbitElapsed = 0;
  private earthwormElapsed = 0;

  reset(): void {
    this.fieldMouseElapsed = 0;
    this.beeHiveElapsed = 0;
    this.chickenElapsed = 0;
    this.sheepElapsed = 0;
    this.meadowRabbitElapsed = 0;
    this.earthwormElapsed = 0;
  }

  update(delta: number, state: GameState, stats: RuntimeStats, feedback: AnimalCompanionFeedback): boolean {
    let changed = false;
    const fieldMice = getInventoryQuantity(state, "field_mouse");
    const beeHives = getInventoryQuantity(state, "bee_hive");
    const chickens = getInventoryQuantity(state, "chicken");
    const sheep = getInventoryQuantity(state, "sheep");
    const meadowRabbits = getInventoryQuantity(state, "meadow_rabbit");
    const earthworms = getInventoryQuantity(state, "earthworm");
    const hasForagerTrails = state.seedShopPurchases.forager_trails === true;
    const automationIntervalMultiplier = getAutomationIntervalMultiplier(state);
    const directiveId = getResolvedAutomationDirectiveId(state);
    const directiveTuning = getAutomationDirectiveTuning(state);
    const directiveStats = getAutomationDirectiveTouchStats(state, stats);
    const foragerCircuitPower = getAutomationPairSynergyPower(state, "forager_circuit", stats);
    const soilScratchPower = getAutomationPairSynergyPower(state, "soil_scratch", stats);
    const pastureTurnoverPower = getAutomationPairSynergyPower(state, "pasture_turnover", stats);
    const grazingTrailPower = getAutomationPairSynergyPower(state, "grazing_trail", stats);

    if (fieldMice > 0) {
      this.fieldMouseElapsed += delta;
      const fieldMouseInterval = Math.max(6500, (hasForagerTrails ? 9500 : 14500) * automationIntervalMultiplier * directiveTuning.helperIntervalMultiplier);
      if (this.fieldMouseElapsed >= fieldMouseInterval) {
        this.fieldMouseElapsed = 0;
        const fieldMouseRadius = hasForagerTrails ? 2 : 1;
        const fieldMouseGoldChance = Math.min(
          0.82,
          Math.max(
            0.05,
            (hasForagerTrails ? 0.34 : 0.22) +
              (directiveId === "supplies" ? 0.1 : 0) +
              foragerCircuitPower * 0.22 +
              directiveTuning.supplyChanceBonus,
          ),
        );
        changed =
          this.runForagerTouch(
            state,
            directiveStats,
            feedback,
            "field_mouse",
            "scurry",
            fieldMouseRadius,
            "mouse",
            fieldMouseGoldChance,
            0,
            directiveId,
          ) || changed;
      }
    }

    if (beeHives > 0) {
      this.beeHiveElapsed += delta;
      const beeInterval = Math.max(
        6500,
        Math.max(9000, 18000 - beeHives * 1800) * automationIntervalMultiplier * directiveTuning.helperIntervalMultiplier,
      );
      if (this.beeHiveElapsed >= beeInterval) {
        this.beeHiveElapsed = 0;
        changed = this.pollinateFromBeeHive(state, beeHives, feedback, directiveId, directiveTuning.growthRegrowMultiplier) || changed;
      }
    }

    if (chickens > 0) {
      this.chickenElapsed += delta;
      const chickenInterval = Math.max(
        8000,
        Math.max(10000, 21000 - chickens * 2200) * automationIntervalMultiplier * directiveTuning.helperIntervalMultiplier,
      );
      if (this.chickenElapsed >= chickenInterval) {
        this.chickenElapsed = 0;
        changed = this.runChickenForage(state, chickens, feedback, directiveId, soilScratchPower, directiveTuning.supplyChanceBonus) || changed;
      }
    }

    if (sheep > 0) {
      this.sheepElapsed += delta;
      const sheepInterval = Math.max(
        10000,
        Math.max(13000, 26000 - sheep * 3000) * automationIntervalMultiplier * directiveTuning.helperIntervalMultiplier,
      );
      if (this.sheepElapsed >= sheepInterval) {
        this.sheepElapsed = 0;
        changed =
          this.runSheepGraze(
            state,
            directiveStats,
            sheep,
            feedback,
            directiveId,
            pastureTurnoverPower,
            grazingTrailPower,
            directiveTuning.supplyChanceBonus,
          ) || changed;
      }
    }

    if (meadowRabbits > 0) {
      this.meadowRabbitElapsed += delta;
      const meadowRabbitInterval = Math.max(
        6500,
        (hasForagerTrails ? 8500 : 12000) * automationIntervalMultiplier * directiveTuning.helperIntervalMultiplier,
      );
      if (this.meadowRabbitElapsed >= meadowRabbitInterval) {
        this.meadowRabbitElapsed = 0;
        const meadowRabbitSeedChance = Math.min(
          0.88,
          Math.max(
            0.05,
            (hasForagerTrails ? 0.46 : 0.32) +
              (directiveId === "supplies" ? 0.12 : 0) +
              foragerCircuitPower * 0.18 +
              grazingTrailPower * 0.14 +
              directiveTuning.supplyChanceBonus,
          ),
        );
        changed =
          this.runForagerTouch(
            state,
            directiveStats,
            feedback,
            "meadow_rabbit",
            "hop",
            2,
            "rabbit",
            0,
            meadowRabbitSeedChance,
            directiveId,
          ) || changed;
      }
    }

    if (earthworms > 0) {
      this.earthwormElapsed += delta;
      const earthwormInterval = Math.max(
        8000,
        Math.max(10000, 20000 - earthworms * 2200) * automationIntervalMultiplier * directiveTuning.helperIntervalMultiplier,
      );
      if (this.earthwormElapsed >= earthwormInterval) {
        this.earthwormElapsed = 0;
        changed =
          this.runEarthwormBurrow(
            state,
            earthworms,
            feedback,
            directiveId,
            soilScratchPower,
            pastureTurnoverPower,
            directiveTuning.growthRegrowMultiplier,
          ) || changed;
      }
    }

    return changed;
  }

  private runForagerTouch(
    state: GameState,
    stats: RuntimeStats,
    feedback: AnimalCompanionFeedback,
    objectId: "field_mouse" | "meadow_rabbit",
    action: "scurry" | "hop",
    radius: number,
    label: string,
    goldChance: number,
    seedChance: number,
    directiveId: ResolvedAutomationDirectiveId,
  ): boolean {
    const tile = getPlacedLocalGrownTile(state, objectId, radius, directiveId);
    if (!tile) {
      return false;
    }

    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    const touch = touchTile(tile, state, stats, Date.now());
    if (touch.gained === 0) {
      return false;
    }

    feedback.playCompanionAction(tile, action);
    feedback.playTouchFeedback(tile, touchedTrait, touch.isCrit);
    feedback.refreshTile(tile);
    feedback.popAtTile(tile, `+${touch.gained}`, touch.isCrit ? "#ffef78" : "#dfffc8");
    recordAutomationTouch(state, touch.gained, directiveId);
    const comboCount = feedback.recordAutomationCombo(tile, touch, objectId);
    feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, comboCount);

    if (goldChance > 0 && Math.random() < goldChance) {
      state.gold += 1;
      state.lifetimeGold += 1;
      recordAutomationSupplyDrop(state, 1, directiveId);
      feedback.popAtTile(tile, "+1 gold", "#ffef78");
      feedback.emitGoldBurst(tile);
      feedback.playSound("gold");
    } else if (seedChance > 0 && Math.random() < seedChance) {
      state.seeds += 1;
      state.lifetimeSeeds += 1;
      recordAutomationSupplyDrop(state, 1, directiveId);
      feedback.popAtTile(tile, "+1 seed", "#fff1a8");
      feedback.emitSeedBurst(tile);
      feedback.playSound("seed");
    }

    return true;
  }

  private pollinateFromBeeHive(
    state: GameState,
    beeHives: number,
    feedback: AnimalCompanionFeedback,
    directiveId: ResolvedAutomationDirectiveId,
    growthRegrowMultiplier: number,
  ): boolean {
    const anchor = getPlacedLocalFieldTile(state, "bee_hive", 2) ?? getRandomFieldTile(state);
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
    const improvedTiles = Phaser.Utils.Array.Shuffle(cluster).slice(
      0,
      Math.min(cluster.length, 1 + Math.min(beeHives + (directiveId === "growth" ? 1 : 0), 3)),
    );

    for (const tile of improvedTiles) {
      if (tile.grassState === "regrowing") {
        const remainingMs = Math.max(0, tile.regrowEndsAt - Date.now());
        tile.regrowEndsAt = Date.now() + Math.floor(remainingMs * (directiveId === "growth" ? 0.66 : 0.75) * growthRegrowMultiplier);
      } else {
        tile.trait = Math.random() < (directiveId === "growth" ? 0.32 : 0.22) ? "lush" : "dewy";
      }

      feedback.refreshTile(tile);
      feedback.playCompanionAction(tile, "pollinate");
      recordAutomationAction(state, directiveId);
    }

    if (improvedTiles.length > 0) {
      feedback.playSound("regrow");
    }

    return improvedTiles.length > 0;
  }

  private runChickenForage(
    state: GameState,
    chickens: number,
    feedback: AnimalCompanionFeedback,
    directiveId: ResolvedAutomationDirectiveId,
    soilScratchPower: number,
    supplyChanceBonus: number,
  ): boolean {
    const tile = getRandomFieldTile(state);
    if (!tile) {
      return false;
    }

    const supportChance = Math.min(
      0.95,
      Math.max(
        0.15,
        0.62 +
          chickens * 0.05 +
          (directiveId === "growth" ? 0.12 : directiveId === "supplies" ? -0.1 : 0) +
          soilScratchPower * 0.18 -
          Math.max(0, supplyChanceBonus) * 0.5,
      ),
    );
    if (Math.random() < supportChance) {
      tile.trait = tile.trait === "lush" ? "lush" : Math.random() < 0.25 ? "lush" : "dewy";
      if (tile.grassState === "regrowing") {
        tile.regrowEndsAt = Math.min(tile.regrowEndsAt, Date.now() + 1600);
      }
      feedback.refreshTile(tile);
      feedback.playCompanionAction(tile, "scratch");
      feedback.playSound("seed");
      recordAutomationAction(state, directiveId);
      return true;
    }

    state.gold += 1;
    state.lifetimeGold += 1;
    recordAutomationAction(state, directiveId);
    recordAutomationSupplyDrop(state, 1, directiveId);
    feedback.playCompanionAction(tile, "forage");
    feedback.popAtTile(tile, "+1 gold", "#ffef78");
    feedback.emitGoldBurst(tile);
    feedback.playSound("gold");
    return true;
  }

  private runSheepGraze(
    state: GameState,
    stats: RuntimeStats,
    sheep: number,
    feedback: AnimalCompanionFeedback,
    directiveId: ResolvedAutomationDirectiveId,
    pastureTurnoverPower: number,
    grazingTrailPower: number,
    supplyChanceBonus: number,
  ): boolean {
    const tile = directiveId === "harvest" ? pickBestGrownTile(state, 10) : getRandomGrownTile(state);
    if (!tile) {
      return false;
    }

    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    const touch = touchTile(tile, state, stats, Date.now());
    if (touch.gained === 0) {
      return false;
    }

    const goldChance = Math.min(
      0.88,
      Math.max(
        0.05,
        0.28 +
          sheep * 0.08 +
          (directiveId === "supplies" ? 0.12 : 0) +
          pastureTurnoverPower * 0.2 +
          grazingTrailPower * 0.1 +
          supplyChanceBonus,
      ),
    );
    const goldGained = Math.random() < goldChance ? 1 : 0;
    state.gold += goldGained;
    state.lifetimeGold += goldGained;
    feedback.playCompanionAction(tile, "graze");
    feedback.playTouchFeedback(tile, touchedTrait, touch.isCrit);
    feedback.refreshTile(tile);
    feedback.popAtTile(tile, `+${touch.gained}`, "#dfffc8");
    recordAutomationTouch(state, touch.gained, directiveId);
    const comboCount = feedback.recordAutomationCombo(tile, touch, "sheep");
    if (goldGained > 0) {
      recordAutomationSupplyDrop(state, goldGained, directiveId);
      feedback.popAtTile(tile, `+${goldGained} gold`, "#ffef78");
      feedback.emitGoldBurst(tile, goldGained);
    }
    feedback.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, comboCount);
    feedback.playSound("gold");
    return true;
  }

  private runEarthwormBurrow(
    state: GameState,
    earthworms: number,
    feedback: AnimalCompanionFeedback,
    directiveId: ResolvedAutomationDirectiveId,
    soilScratchPower: number,
    pastureTurnoverPower: number,
    growthRegrowMultiplier: number,
  ): boolean {
    const regrowingTiles = Phaser.Utils.Array.Shuffle(getRegrowingTiles(state)).slice(
      0,
      Math.min(1 + earthworms + (directiveId === "growth" ? 1 : 0) + (pastureTurnoverPower > 0 ? 1 : 0), 4),
    );
    if (regrowingTiles.length === 0) {
      return false;
    }

    const now = Date.now();
    const baseRegrowFactor =
      state.activeWeatherId === "warm_sunlight" ? 0.58 : state.activeWeatherId === "soft_rain" ? 0.62 : 0.68;
    const synergyRegrowBonus = Math.min(0.1, soilScratchPower * 0.22);
    const baseDirectiveRegrowFactor =
      directiveId === "growth" ? Math.max(0.46, baseRegrowFactor - 0.08 - synergyRegrowBonus) : Math.max(0.5, baseRegrowFactor - synergyRegrowBonus);
    const regrowFactor = Math.max(0.38, baseDirectiveRegrowFactor * growthRegrowMultiplier);
    for (const tile of regrowingTiles) {
      const remainingMs = Math.max(0, tile.regrowEndsAt - now);
      tile.regrowEndsAt = now + Math.max(300, Math.floor(remainingMs * regrowFactor));
      feedback.refreshTile(tile);
      feedback.playCompanionAction(tile, "burrow");
      recordAutomationAction(state, directiveId);
    }

    feedback.playSound("regrow");
    return true;
  }
}

function getPlacedLocalGrownTile(
  state: GameState,
  objectId: "field_mouse" | "meadow_rabbit",
  radius: number,
  directiveId: ResolvedAutomationDirectiveId,
): FieldTile | undefined {
  return getPlacedLocalTile(
    state,
    objectId,
    radius,
    (tile) => tile.grassState === "grown",
    directiveId === "harvest" ? scoreHarvestTile : undefined,
  );
}

function getPlacedLocalFieldTile(state: GameState, objectId: "bee_hive", radius: number): FieldTile | undefined {
  return getPlacedLocalTile(state, objectId, radius, () => true);
}

function getPlacedLocalTile(
  state: GameState,
  objectId: "bee_hive" | "field_mouse" | "meadow_rabbit",
  radius: number,
  isCandidate: (tile: FieldTile) => boolean,
  scoreCandidate?: (tile: FieldTile) => number,
): FieldTile | undefined {
  const placement = state.placedWorldObjects[objectId];
  const placedTile = placement ? state.field[placement.tileKey] : undefined;
  if (!placedTile) {
    return undefined;
  }

  const localTiles: FieldTile[] = [];
  for (let y = placedTile.y - radius; y <= placedTile.y + radius; y += 1) {
    for (let x = placedTile.x - radius; x <= placedTile.x + radius; x += 1) {
      const tile = state.field[tileKey(x, y)];
      if (tile && isCandidate(tile)) {
        localTiles.push(tile);
      }
    }
  }

  if (scoreCandidate) {
    return pickBestTile(localTiles, scoreCandidate);
  }

  return Phaser.Utils.Array.GetRandom(localTiles);
}

function pickBestGrownTile(state: GameState, maxSamples: number): FieldTile | undefined {
  return pickBestTile(sampleGrownTiles(state, maxSamples), scoreHarvestTile);
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
  return tierScore + traitScore + tile.fertility;
}
