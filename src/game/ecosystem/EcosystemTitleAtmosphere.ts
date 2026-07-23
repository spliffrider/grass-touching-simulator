export const TITLE_ATMOSPHERE_CYCLE_MS = 42_000;
export const TITLE_SCOURGE_BASELINE = 0.08;

export interface TitleAtmosphereBudget {
  clouds: number;
  birds: number;
  bees: number;
}

function smoothstep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

export function getTitleScourgeStrength(elapsedMs: number): number {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const phase = (safeElapsed % TITLE_ATMOSPHERE_CYCLE_MS) / TITLE_ATMOSPHERE_CYCLE_MS;
  const range = 1 - TITLE_SCOURGE_BASELINE;

  if (phase < 0.43) {
    return TITLE_SCOURGE_BASELINE + range * smoothstep(phase / 0.43);
  }
  if (phase < 0.6) {
    return 1;
  }
  if (phase < 0.9) {
    return TITLE_SCOURGE_BASELINE + range * (1 - smoothstep((phase - 0.6) / 0.3));
  }
  return TITLE_SCOURGE_BASELINE;
}

export function getTitleAtmosphereBudget(width: number, height: number): TitleAtmosphereBudget {
  const shortestEdge = Math.min(Math.max(1, width), Math.max(1, height));
  if (shortestEdge < 500) {
    return { clouds: 3, birds: 3, bees: 2 };
  }
  if (width < 900 || height < 650) {
    return { clouds: 4, birds: 4, bees: 3 };
  }
  return { clouds: 5, birds: 5, bees: 4 };
}
