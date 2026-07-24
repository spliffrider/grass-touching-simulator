import { describe, expect, it } from "vitest";
import { SoundVariationBank } from "../src/game/systems/SoundVariation";

describe("SoundVariationBank", () => {
  it("keeps stable sounds neutral", () => {
    const bank = new SoundVariationBank(() => 0.9);

    expect(bank.next("none")).toEqual({
      pitchRatio: 1,
      gainRatio: 1,
      variantIndex: 0,
    });
  });

  it("avoids immediately repeating a variation from the same palette", () => {
    const bank = new SoundVariationBank(() => 0.01);

    expect(bank.next("water").variantIndex).toBe(0);
    expect(bank.next("water").variantIndex).toBe(1);
    expect(bank.next("water").variantIndex).toBe(0);
  });

  it("keeps repeated effects inside a subtle pitch and gain range", () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.999];
    let sampleIndex = 0;
    const bank = new SoundVariationBank(() => samples[sampleIndex++ % samples.length]);

    for (const profile of ["water", "organic", "impact"] as const) {
      const variations = samples.map(() => bank.next(profile));
      variations.forEach((variation) => {
        expect(variation.pitchRatio).toBeGreaterThanOrEqual(0.94);
        expect(variation.pitchRatio).toBeLessThanOrEqual(1.07);
        expect(variation.gainRatio).toBeGreaterThanOrEqual(0.94);
        expect(variation.gainRatio).toBeLessThanOrEqual(1.03);
      });
    }
  });

  it("tracks each sound family independently", () => {
    const bank = new SoundVariationBank(() => 0);

    expect(bank.next("water").variantIndex).toBe(0);
    expect(bank.next("organic").variantIndex).toBe(0);
    expect(bank.next("impact").variantIndex).toBe(0);
    expect(bank.next("water").variantIndex).toBe(1);
  });
});
