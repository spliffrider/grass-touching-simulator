export type GrassTouchAmount = number;

export const MAX_GRASS_TOUCH_AMOUNT = 1e300;

const SCIENTIFIC_THRESHOLD = 1_000_000_000_000;

export function normalizeGrassTouches(value: unknown, fallback: GrassTouchAmount = 0): GrassTouchAmount {
  const numericValue = typeof value === "number" ? value : Number(value);
  const fallbackValue = typeof fallback === "number" && Number.isFinite(fallback) ? fallback : 0;

  if (numericValue === Infinity) {
    return MAX_GRASS_TOUCH_AMOUNT;
  }

  if (!Number.isFinite(numericValue)) {
    return clampGrassTouches(fallbackValue);
  }

  return clampGrassTouches(Math.floor(numericValue));
}

export function addGrassTouches(current: GrassTouchAmount, delta: number): GrassTouchAmount {
  return normalizeGrassTouches(normalizeGrassTouches(current) + normalizeGrassTouches(delta));
}

export function spendGrassTouches(current: GrassTouchAmount, cost: number): GrassTouchAmount {
  return normalizeGrassTouches(normalizeGrassTouches(current) - normalizeGrassTouches(cost));
}

export function canAffordGrassTouches(current: GrassTouchAmount, cost: number): boolean {
  return normalizeGrassTouches(current) >= normalizeGrassTouches(cost);
}

export function getMissingGrassTouches(current: GrassTouchAmount, cost: number): GrassTouchAmount {
  return normalizeGrassTouches(normalizeGrassTouches(cost) - normalizeGrassTouches(current));
}

export function formatGrassTouches(value: GrassTouchAmount): string {
  const amount = normalizeGrassTouches(value);

  if (amount < SCIENTIFIC_THRESHOLD) {
    return amount.toLocaleString("en-US");
  }

  return formatScientific(amount);
}

export function formatGrassTouchesPerMinute(value: number): string {
  const amount = normalizeGrassTouches(value);
  return `${formatGrassTouches(amount)}/min`;
}

function clampGrassTouches(value: number): GrassTouchAmount {
  return Math.min(MAX_GRASS_TOUCH_AMOUNT, Math.max(0, Math.floor(value)));
}

function formatScientific(value: number): string {
  const [coefficient = "0", exponent = "0"] = value.toExponential(2).split("e+");
  return `${coefficient}e${exponent}`;
}
