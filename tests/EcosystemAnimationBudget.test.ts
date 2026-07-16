import { describe, expect, it } from "vitest";

import {
  DESKTOP_TILE_ANIMATION_BUDGET,
  PHONE_TILE_ANIMATION_BUDGET,
  getAnimatedTileCount,
  getAnimatedTileIndex,
} from "../src/game/ecosystem/EcosystemAnimationBudget";

describe("EcosystemAnimationBudget", () => {
  it("animates every tile while the visible field stays below budget", () => {
    expect(getAnimatedTileCount(24, false)).toBe(24);
    expect(getAnimatedTileCount(24, true)).toBe(24);
  });

  it("bounds per-frame tile transforms on desktop and phone", () => {
    expect(getAnimatedTileCount(360, false)).toBe(DESKTOP_TILE_ANIMATION_BUDGET);
    expect(getAnimatedTileCount(360, true)).toBe(PHONE_TILE_ANIMATION_BUDGET);
  });

  it("spreads the animated sample across the visible pool without duplicates", () => {
    const rendered = 360;
    const animated = getAnimatedTileCount(rendered, false);
    const indices = Array.from(
      { length: animated },
      (_, index) => getAnimatedTileIndex(index, rendered, animated),
    );

    expect(new Set(indices).size).toBe(animated);
    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBeGreaterThan(350);
  });
});
