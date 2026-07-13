import { describe, expect, it } from "vitest";
import { TILE_STAGE_COUNT, TileStage } from "../src/game/ecosystem/EcosystemCatalog";
import {
  ECOSYSTEM_HERO_TILE_SIZE,
  ECOSYSTEM_HERO_TILE_SPECS,
  ECOSYSTEM_HERO_TILE_TEXTURE_KEYS,
} from "../src/game/ecosystem/EcosystemHeroTextures";

const TILE_STAGES = Array.from({ length: TILE_STAGE_COUNT }, (_, stage) => stage as TileStage);

describe("ecosystem hero tile textures", () => {
  it("provides one unique high-resolution texture for every tile stage", () => {
    const keys = TILE_STAGES.map((stage) => ECOSYSTEM_HERO_TILE_TEXTURE_KEYS[stage]);

    expect(ECOSYSTEM_HERO_TILE_SIZE).toBe(256);
    expect(keys).toHaveLength(TILE_STAGE_COUNT);
    expect(new Set(keys).size).toBe(TILE_STAGE_COUNT);
  });

  it("uses deterministic, stage-specific generation plans", () => {
    const seeds = TILE_STAGES.map((stage) => ECOSYSTEM_HERO_TILE_SPECS[stage].seed);

    for (const stage of TILE_STAGES) {
      const spec = ECOSYSTEM_HERO_TILE_SPECS[stage];
      expect(spec.grassDensity).toBeGreaterThan(0);
      expect(spec.palette.ground).toMatch(/^#[0-9a-f]{6}$/i);
      expect(spec.palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(new Set(seeds).size).toBe(TILE_STAGE_COUNT);
  });
});
