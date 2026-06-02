import type { FieldTile, GameState, RuntimeStats, TileKey, TileTrait } from "../types/game-state";

const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function tileKey(x: number, y: number): TileKey {
  return `${x},${y}`;
}

export function createInitialState(): GameState {
  return {
    grassTouches: 0,
    lifetimeGrassTouches: 0,
    totalClickedPatches: 0,
    field: {
      [tileKey(0, 0)]: createTile(0, 0, "normal"),
    },
    upgrades: {},
    reachedMilestones: [],
    lastSavedAt: Date.now(),
  };
}

export function createTile(x: number, y: number, trait: TileTrait): FieldTile {
  return {
    x,
    y,
    grassState: "grown",
    trait,
    regrowEndsAt: 0,
    baseTouchValue: 1,
    baseRegrowMs: 2600,
    fertility: Phaser.Math.FloatBetween(0.25, 0.9),
    moisture: Phaser.Math.FloatBetween(0.2, 0.85),
  };
}

export function touchTile(tile: FieldTile, state: GameState, stats: RuntimeStats, now: number): number {
  if (tile.grassState !== "grown") {
    return 0;
  }

  const traitBonus = tile.trait === "lush" ? 2 : tile.trait === "dewy" ? 1 : 0;
  const gained = Math.max(1, Math.floor(tile.baseTouchValue + stats.touchMultiplier + traitBonus));

  tile.grassState = "regrowing";
  tile.regrowEndsAt = now + Math.floor(tile.baseRegrowMs * stats.regrowMultiplier);
  tile.trait = "normal";

  state.grassTouches += gained;
  state.lifetimeGrassTouches += gained;
  state.totalClickedPatches += 1;

  return gained;
}

export function updateRegrowth(state: GameState, stats: RuntimeStats, now: number): FieldTile[] {
  const regrown: FieldTile[] = [];

  for (const tile of Object.values(state.field)) {
    if (tile.grassState === "regrowing" && now >= tile.regrowEndsAt) {
      tile.grassState = "grown";
      tile.regrowEndsAt = 0;
      tile.trait = pickRegrownTrait(stats, tile);
      regrown.push(tile);
    }
  }

  return regrown;
}

export function expandField(state: GameState, tileCount: number, stats: RuntimeStats): FieldTile[] {
  const added: FieldTile[] = [];

  for (let i = 0; i < tileCount; i += 1) {
    const candidates = getExpansionCandidates(state);
    if (candidates.length === 0) {
      break;
    }

    const chosen = Phaser.Utils.Array.GetRandom(weightedCandidateBag(candidates));
    const trait = Math.random() < stats.dewChance ? "dewy" : "normal";
    const tile = createTile(chosen.x, chosen.y, trait);
    state.field[tileKey(tile.x, tile.y)] = tile;
    added.push(tile);
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

function getExpansionCandidates(state: GameState): Array<{ x: number; y: number; adjacentCount: number }> {
  const candidates = new Map<TileKey, { x: number; y: number; adjacentCount: number }>();

  for (const tile of Object.values(state.field)) {
    for (const neighbor of NEIGHBORS) {
      const x = tile.x + neighbor.x;
      const y = tile.y + neighbor.y;
      const key = tileKey(x, y);

      if (state.field[key]) {
        continue;
      }

      const adjacentCount = countExistingNeighbors(state, x, y);
      candidates.set(key, { x, y, adjacentCount });
    }
  }

  return [...candidates.values()];
}

function countExistingNeighbors(state: GameState, x: number, y: number): number {
  return NEIGHBORS.reduce((count, neighbor) => {
    return count + (state.field[tileKey(x + neighbor.x, y + neighbor.y)] ? 1 : 0);
  }, 0);
}

function weightedCandidateBag(candidates: Array<{ x: number; y: number; adjacentCount: number }>) {
  return candidates.flatMap((candidate) => {
    const weight = Math.max(1, candidate.adjacentCount * 2 + Phaser.Math.Between(0, 2));
    return Array.from({ length: weight }, () => candidate);
  });
}
