import { getGrassTier, pickGrassTier } from "../data/grass-tiers";
import { CURRENT_SAVE_VERSION } from "../types/game-state";
import type { FieldTile, GameState, GrassTierId, RuntimeStats, TileKey, TileTrait, TouchResult } from "../types/game-state";

const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

interface ExpansionCandidate {
  x: number;
  y: number;
  adjacentCount: number;
  parent: FieldTile;
  direction: { x: number; y: number };
  distanceFromCenter: number;
}

export interface FieldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function tileKey(x: number, y: number): TileKey {
  return `${x},${y}`;
}

export function getFieldTiles(state: GameState): FieldTile[] {
  return Object.values(state.field);
}

export function getGrownTiles(state: GameState): FieldTile[] {
  return getFieldTiles(state).filter((tile) => tile.grassState === "grown");
}

export function getRegrowingTiles(state: GameState): FieldTile[] {
  return getFieldTiles(state).filter((tile) => tile.grassState === "regrowing");
}

export function getFieldBounds(state: GameState): FieldBounds | undefined {
  const tiles = getFieldTiles(state);
  if (tiles.length === 0) {
    return undefined;
  }

  let minX = tiles[0].x;
  let maxX = tiles[0].x;
  let minY = tiles[0].y;
  let maxY = tiles[0].y;

  for (let index = 1; index < tiles.length; index += 1) {
    const tile = tiles[index];
    minX = Math.min(minX, tile.x);
    maxX = Math.max(maxX, tile.x);
    minY = Math.min(minY, tile.y);
    maxY = Math.max(maxY, tile.y);
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

export function createInitialState(): GameState {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    grassTouches: 0,
    seeds: 0,
    lifetimeSeeds: 0,
    gold: 0,
    lifetimeGold: 0,
    lifetimeGrassTouches: 0,
    totalClickedPatches: 0,
    field: {
      [tileKey(0, 0)]: createTile(0, 0, "normal", "normal"),
    },
    upgrades: {},
    seedShopPurchases: {},
    inventory: {},
    reachedMilestones: [],
    activeWeatherId: "calm",
    weatherEndsAt: 0,
    lastSavedAt: Date.now(),
  };
}

export function createTile(x: number, y: number, trait: TileTrait, tier: GrassTierId): FieldTile {
  const tierDefinition = getGrassTier(tier);

  return {
    x,
    y,
    grassState: "grown",
    trait,
    tier,
    regrowEndsAt: 0,
    baseTouchValue: tierDefinition.touchValue,
    baseRegrowMs: 2600,
    fertility: Phaser.Math.FloatBetween(0.25, 0.9),
    moisture: Phaser.Math.FloatBetween(0.2, 0.85),
  };
}

export function touchTile(tile: FieldTile, state: GameState, stats: RuntimeStats, now: number): TouchResult {
  if (tile.grassState !== "grown") {
    return { gained: 0, isCrit: false, critMultiplier: 1, doubled: false, instantRegrown: false };
  }

  const traitBonus = tile.trait === "lush" ? 2 : tile.trait === "dewy" ? 1 : 0;
  const tier = getGrassTier(tile.tier);
  const rareBonus = tier.id === "normal" ? 0 : stats.rareTouchBonus;
  const doubled = Math.random() < stats.doubleTouchChance;
  const baseGained = Math.max(1, Math.floor((tier.touchValue + stats.touchMultiplier + traitBonus + rareBonus) * (doubled ? 2 : 1)));
  const critChance = stats.critChance + (tile.trait === "lush" ? 0.05 : tile.trait === "dewy" ? 0.025 : 0);
  const isCrit = Math.random() < critChance;
  const critMultiplier = isCrit ? stats.critMultiplier : 1;
  const gained = Math.max(1, Math.floor(baseGained * critMultiplier));
  const instantRegrown = Math.random() < stats.instantRegrowChance;

  tile.grassState = "regrowing";
  tile.regrowEndsAt = now + Math.floor(tile.baseRegrowMs * stats.regrowMultiplier);
  tile.trait = "normal";

  if (instantRegrown) {
    tile.grassState = "grown";
    tile.regrowEndsAt = 0;
    tile.trait = pickRegrownTrait(stats, tile);
    tile.tier = pickGrassTier(state, stats).id;
    tile.baseTouchValue = getGrassTier(tile.tier).touchValue;
  }

  state.grassTouches += gained;
  state.lifetimeGrassTouches += gained;
  state.totalClickedPatches += 1;

  return { gained, isCrit, critMultiplier, doubled, instantRegrown };
}

export function updateRegrowth(state: GameState, stats: RuntimeStats, now: number): FieldTile[] {
  const regrown: FieldTile[] = [];

  for (const tile of getFieldTiles(state)) {
    if (tile.grassState === "regrowing" && now >= tile.regrowEndsAt) {
      tile.grassState = "grown";
      tile.regrowEndsAt = 0;
      tile.trait = pickRegrownTrait(stats, tile);
      tile.tier = pickGrassTier(state, stats).id;
      tile.baseTouchValue = getGrassTier(tile.tier).touchValue;
      regrown.push(tile);
    }
  }

  return regrown;
}

export function expandField(state: GameState, tileCount: number, stats: RuntimeStats): FieldTile[] {
  const added: FieldTile[] = [];
  let growthDirection = pickGrowthDirection(state);
  let lastTile: FieldTile | undefined;
  let lastDirection = growthDirection;

  for (let i = 0; i < tileCount; i += 1) {
    const candidates = getExpansionCandidates(state);
    if (candidates.length === 0) {
      break;
    }

    const localCandidates = lastTile
      ? candidates.filter((candidate) => Math.abs(candidate.x - lastTile!.x) + Math.abs(candidate.y - lastTile!.y) === 1)
      : [];
    const shouldKeepGrowingRunner = localCandidates.length > 0 && Math.random() < 0.72;
    const pool = shouldKeepGrowingRunner ? localCandidates : candidates;
    const chosen = pickOrganicCandidate(pool, growthDirection, lastDirection, lastTile);
    const trait = Math.random() < stats.dewChance ? "dewy" : "normal";
    const tier = pickGrassTier(state, stats).id;
    const tile = createTile(chosen.x, chosen.y, trait, tier);
    state.field[tileKey(tile.x, tile.y)] = tile;
    added.push(tile);
    lastTile = tile;
    lastDirection = chosen.direction;

    if (Math.random() < 0.22) {
      growthDirection = bendDirection(growthDirection);
    }
  }

  return added;
}

function pickRegrownTrait(stats: RuntimeStats, tile: FieldTile): TileTrait {
  const lushChance = 0.04 + tile.fertility * 0.04;
  if (Math.random() < lushChance) {
    return "lush";
  }

  if (Math.random() < stats.dewChance + tile.moisture * 0.04) {
    return "dewy";
  }

  return "normal";
}

function getExpansionCandidates(state: GameState): ExpansionCandidate[] {
  const candidates = new Map<TileKey, ExpansionCandidate>();
  const center = getFieldCenter(state);

  for (const tile of getFieldTiles(state)) {
    for (const neighbor of NEIGHBORS) {
      const x = tile.x + neighbor.x;
      const y = tile.y + neighbor.y;
      const key = tileKey(x, y);

      if (state.field[key]) {
        continue;
      }

      const adjacentCount = countExistingNeighbors(state, x, y);
      const distanceFromCenter = Math.abs(x - center.x) + Math.abs(y - center.y);
      const existing = candidates.get(key);
      const candidate = {
        x,
        y,
        adjacentCount,
        parent: tile,
        direction: neighbor,
        distanceFromCenter,
      };

      if (!existing || scoreParentCandidate(candidate) > scoreParentCandidate(existing)) {
        candidates.set(key, candidate);
      }
    }
  }

  return [...candidates.values()];
}

function countExistingNeighbors(state: GameState, x: number, y: number): number {
  return NEIGHBORS.reduce((count, neighbor) => {
    return count + (state.field[tileKey(x + neighbor.x, y + neighbor.y)] ? 1 : 0);
  }, 0);
}

function pickOrganicCandidate(
  candidates: ExpansionCandidate[],
  growthDirection: { x: number; y: number },
  lastDirection: { x: number; y: number },
  lastTile?: FieldTile,
): ExpansionCandidate {
  const weighted = candidates.flatMap((candidate) => {
    const alignment = candidate.direction.x * growthDirection.x + candidate.direction.y * growthDirection.y;
    const momentum = candidate.direction.x * lastDirection.x + candidate.direction.y * lastDirection.y;
    const parentDistance = lastTile ? Math.abs(candidate.parent.x - lastTile.x) + Math.abs(candidate.parent.y - lastTile.y) : 0;
    const runnerBonus = lastTile && parentDistance <= 1 ? 5 : 0;
    const clumpBonus = candidate.adjacentCount === 2 ? 5 : candidate.adjacentCount === 1 ? 3 : 1;
    const edgeBonus = Math.min(5, candidate.distanceFromCenter);
    const weight = Math.max(
      1,
      3 + runnerBonus + clumpBonus + edgeBonus + (alignment > 0 ? 7 : alignment === 0 ? 2 : -2) + (momentum > 0 ? 4 : 0),
    );

    return Array.from({ length: weight }, () => candidate);
  });

  return Phaser.Utils.Array.GetRandom(weighted);
}

function pickGrowthDirection(state: GameState): { x: number; y: number } {
  const bounds = getFieldBounds(state);
  if (!bounds) {
    return Phaser.Utils.Array.GetRandom(NEIGHBORS);
  }

  if (bounds.width > bounds.height + 2 && Math.random() < 0.65) {
    return Phaser.Utils.Array.GetRandom([
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]);
  }

  if (bounds.height > bounds.width + 2 && Math.random() < 0.65) {
    return Phaser.Utils.Array.GetRandom([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ]);
  }

  return Phaser.Utils.Array.GetRandom(NEIGHBORS);
}

function bendDirection(direction: { x: number; y: number }): { x: number; y: number } {
  if (Math.random() < 0.62) {
    return direction;
  }

  if (direction.x !== 0) {
    return Phaser.Utils.Array.GetRandom([
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]);
  }

  return Phaser.Utils.Array.GetRandom([
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ]);
}

function getFieldCenter(state: GameState): { x: number; y: number } {
  const tiles = getFieldTiles(state);
  return {
    x: tiles.reduce((sum, tile) => sum + tile.x, 0) / tiles.length,
    y: tiles.reduce((sum, tile) => sum + tile.y, 0) / tiles.length,
  };
}

function scoreParentCandidate(candidate: ExpansionCandidate): number {
  return candidate.adjacentCount * 3 + candidate.parent.fertility + candidate.parent.moisture;
}
