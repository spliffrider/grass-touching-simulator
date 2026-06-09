export interface ComboResult {
  count: number;
  multiplier: number;
  bonusTouches: number;
  expiresAt: number;
  thresholdReached?: number;
  touchIntervalMs?: number;
}

const COMBO_WINDOW_MS = 1800;

const COMBO_TIERS = [
  { count: 40, multiplier: 2 },
  { count: 25, multiplier: 1.75 },
  { count: 15, multiplier: 1.5 },
  { count: 10, multiplier: 1.35 },
  { count: 5, multiplier: 1.2 },
] as const;

export class ComboSystem {
  private count = 0;
  private lastTouchAt = 0;
  private expiresAt = 0;

  reset(): void {
    this.count = 0;
    this.lastTouchAt = 0;
    this.expiresAt = 0;
  }

  recordManualTouch(now: number, baseTouches: number): ComboResult {
    const previousCount = this.count;
    const previousTouchAt = this.lastTouchAt;
    const isContinuing = previousTouchAt > 0 && now - previousTouchAt <= COMBO_WINDOW_MS;

    this.count = isContinuing ? this.count + 1 : 1;
    this.lastTouchAt = now;
    this.expiresAt = now + COMBO_WINDOW_MS;

    const multiplier = this.getMultiplier();
    const bonusTouches = multiplier > 1 ? Math.max(1, Math.floor(baseTouches * (multiplier - 1))) : 0;
    const thresholdReached = COMBO_TIERS.find((tier) => previousCount < tier.count && this.count >= tier.count)?.count;

    return {
      count: this.count,
      multiplier,
      bonusTouches,
      expiresAt: this.expiresAt,
      thresholdReached,
      touchIntervalMs: isContinuing ? now - previousTouchAt : undefined,
    };
  }

  update(now: number): boolean {
    if (this.count === 0 || now <= this.expiresAt) {
      return false;
    }

    this.reset();
    return true;
  }

  getCount(): number {
    return this.count;
  }

  getMultiplier(): number {
    return COMBO_TIERS.find((tier) => this.count >= tier.count)?.multiplier ?? 1;
  }

  getExpiresAt(): number {
    return this.expiresAt;
  }

  getWindowMs(): number {
    return COMBO_WINDOW_MS;
  }
}
