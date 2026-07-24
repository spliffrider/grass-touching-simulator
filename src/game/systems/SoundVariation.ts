export type SoundVariationProfile = "none" | "water" | "organic" | "impact";

export interface SoundVariation {
  pitchRatio: number;
  gainRatio: number;
  variantIndex: number;
}

const NEUTRAL_VARIATION: SoundVariation = {
  pitchRatio: 1,
  gainRatio: 1,
  variantIndex: 0,
};

const VARIATION_PALETTES = {
  none: [NEUTRAL_VARIATION],
  water: [
    { pitchRatio: 0.945, gainRatio: 0.94, variantIndex: 0 },
    { pitchRatio: 0.975, gainRatio: 1, variantIndex: 1 },
    { pitchRatio: 1, gainRatio: 1.02, variantIndex: 2 },
    { pitchRatio: 1.028, gainRatio: 0.98, variantIndex: 3 },
    { pitchRatio: 1.058, gainRatio: 0.95, variantIndex: 4 },
  ],
  organic: [
    { pitchRatio: 0.952, gainRatio: 0.95, variantIndex: 0 },
    { pitchRatio: 0.981, gainRatio: 1.01, variantIndex: 1 },
    { pitchRatio: 1.006, gainRatio: 0.98, variantIndex: 2 },
    { pitchRatio: 1.034, gainRatio: 1.02, variantIndex: 3 },
    { pitchRatio: 1.062, gainRatio: 0.96, variantIndex: 4 },
  ],
  impact: [
    { pitchRatio: 0.958, gainRatio: 0.96, variantIndex: 0 },
    { pitchRatio: 0.982, gainRatio: 1.01, variantIndex: 1 },
    { pitchRatio: 1, gainRatio: 0.98, variantIndex: 2 },
    { pitchRatio: 1.024, gainRatio: 1.02, variantIndex: 3 },
    { pitchRatio: 1.048, gainRatio: 0.97, variantIndex: 4 },
  ],
} as const satisfies Record<SoundVariationProfile, readonly SoundVariation[]>;

type RandomSource = () => number;

export class SoundVariationBank {
  private readonly lastVariantByProfile: Partial<Record<SoundVariationProfile, number>> = {};

  constructor(private readonly random: RandomSource = Math.random) {}

  next(profile: SoundVariationProfile): SoundVariation {
    const palette = VARIATION_PALETTES[profile];
    if (palette.length === 1) return palette[0];

    const randomValue = Math.max(0, Math.min(0.999999, this.random()));
    let index = Math.floor(randomValue * palette.length);
    const previousIndex = this.lastVariantByProfile[profile];
    if (index === previousIndex) {
      index = (index + 1) % palette.length;
    }

    this.lastVariantByProfile[profile] = index;
    return palette[index];
  }
}
