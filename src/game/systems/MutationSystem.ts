import { sampleGrownTiles, tileKey } from "./FieldSystem";
import type { FieldTile, GameState, GrassTierId } from "../types/game-state";

const MUTATION_INTERVAL_MS = 8200;
const MAX_PAIR_SAMPLES = 72;
const MUTATION_CHANCE = 0.36;

const NEIGHBORS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
] as const;

export type MutationKind = "clover_weave" | "lucky_bloom" | "moss_spores" | "prismatic_frost";

export interface MutationEvent {
  kind: MutationKind;
  originTile: FieldTile;
  partnerTile: FieldTile;
  changedTiles: FieldTile[];
  seedReward: number;
  goldReward: number;
  label: string;
  color: string;
  burstTexture: string;
}

export class MutationSystem {
  private elapsed = 0;

  reset(): void {
    this.elapsed = 0;
  }

  update(delta: number, state: GameState): MutationEvent | undefined {
    this.elapsed += delta;
    if (this.elapsed < MUTATION_INTERVAL_MS) {
      return undefined;
    }

    this.elapsed = 0;
    return this.tryCreateMutation(state);
  }

  private tryCreateMutation(state: GameState): MutationEvent | undefined {
    const samples = sampleGrownTiles(state, MAX_PAIR_SAMPLES);

    for (const tile of samples) {
      const partners = Phaser.Utils.Array.Shuffle(
        NEIGHBORS.map((neighbor) => state.field[tileKey(tile.x + neighbor.x, tile.y + neighbor.y)]).filter(
          (neighborTile): neighborTile is FieldTile => neighborTile?.grassState === "grown",
        ),
      );

      for (const partner of partners) {
        const kind = this.getMutationKind(tile.tier, partner.tier);
        if (!kind || Math.random() >= MUTATION_CHANCE) {
          continue;
        }

        return this.applyMutation(kind, state, tile, partner);
      }
    }

    return undefined;
  }

  private getMutationKind(first: GrassTierId, second: GrassTierId): MutationKind | undefined {
    const pair = new Set<GrassTierId>([first, second]);
    if (pair.has("thick") && pair.has("clover")) {
      return "clover_weave";
    }
    if (pair.has("golden") && (pair.has("clover") || pair.has("wildflower"))) {
      return "lucky_bloom";
    }
    if (pair.has("moss") && pair.has("mushroom")) {
      return "moss_spores";
    }
    if (pair.has("crystal") && pair.has("frost")) {
      return "prismatic_frost";
    }

    return undefined;
  }

  private applyMutation(kind: MutationKind, state: GameState, originTile: FieldTile, partnerTile: FieldTile): MutationEvent {
    const changedTiles = uniqueTiles([originTile, partnerTile, ...this.getCardinalNeighbors(state, originTile), ...this.getCardinalNeighbors(state, partnerTile)]).filter(
      (tile) => tile.grassState === "grown",
    );

    switch (kind) {
      case "clover_weave":
        this.setTraits(changedTiles.slice(0, 3), "dewy", 0.32);
        state.seeds += 1;
        state.lifetimeSeeds += 1;
        return {
          kind,
          originTile,
          partnerTile,
          changedTiles: changedTiles.slice(0, 3),
          seedReward: 1,
          goldReward: 0,
          label: "clover weave",
          color: "#b7eba5",
          burstTexture: "effect-seed-kernel",
        };
      case "lucky_bloom":
        this.setTraits(changedTiles.slice(0, 3), "lush", 0.45);
        state.gold += 1;
        state.lifetimeGold += 1;
        return {
          kind,
          originTile,
          partnerTile,
          changedTiles: changedTiles.slice(0, 3),
          seedReward: 0,
          goldReward: 1,
          label: "lucky bloom",
          color: "#ffef78",
          burstTexture: "effect-gold-coin",
        };
      case "moss_spores":
        this.setTraits(changedTiles.slice(0, 4), "dewy", 0.55);
        return {
          kind,
          originTile,
          partnerTile,
          changedTiles: changedTiles.slice(0, 4),
          seedReward: 0,
          goldReward: 0,
          label: "moss spores",
          color: "#dfffc8",
          burstTexture: "effect-magic-spore",
        };
      case "prismatic_frost":
        this.setTraits(changedTiles.slice(0, 2), "lush", 0.72);
        state.seeds += 1;
        state.lifetimeSeeds += 1;
        state.gold += 1;
        state.lifetimeGold += 1;
        return {
          kind,
          originTile,
          partnerTile,
          changedTiles: changedTiles.slice(0, 2),
          seedReward: 1,
          goldReward: 1,
          label: "prismatic frost",
          color: "#75e8ff",
          burstTexture: "crit-fleck",
        };
    }
  }

  private getCardinalNeighbors(state: GameState, tile: FieldTile): FieldTile[] {
    return NEIGHBORS.map((neighbor) => state.field[tileKey(tile.x + neighbor.x, tile.y + neighbor.y)]).filter(
      (neighborTile): neighborTile is FieldTile => neighborTile !== undefined,
    );
  }

  private setTraits(tiles: FieldTile[], trait: "dewy" | "lush", lushChance: number): void {
    for (const tile of tiles) {
      tile.trait = trait === "lush" || Math.random() < lushChance ? "lush" : "dewy";
    }
  }
}

function uniqueTiles(tiles: FieldTile[]): FieldTile[] {
  const seen = new Set<string>();
  const unique: FieldTile[] = [];

  for (const tile of tiles) {
    const key = tileKey(tile.x, tile.y);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(tile);
  }

  return Phaser.Utils.Array.Shuffle(unique);
}
