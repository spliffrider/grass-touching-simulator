export interface ComboResult {
  count: number;
  multiplier: number;
  bonusTouches: number;
  expiresAt: number;
  thresholdReached?: number;
  touchIntervalMs?: number;
}

export interface ComboRecordOptions {
  windowMs?: number;
  bonusMultiplier?: number;
}

const COMBO_WINDOW_MS = 1450;

const COMBO_TIERS = [
  { count: 50, multiplier: 1.7 },
  { count: 32, multiplier: 1.5 },
  { count: 20, multiplier: 1.35 },
  { count: 12, multiplier: 1.22 },
  { count: 6, multiplier: 1.12 },
] as const;

export class ComboSystem {
  private count = 0;
  private lastTouchAt = 0;
  private expiresAt = 0;
  private currentWindowMs = COMBO_WINDOW_MS;

  reset(): void {
    this.count = 0;
    this.lastTouchAt = 0;
    this.expiresAt = 0;
    this.currentWindowMs = COMBO_WINDOW_MS;
  }

  recordManualTouch(now: number, baseTouches: number, options: ComboRecordOptions = {}): ComboResult {
    const windowMs = Math.max(600, Math.floor(options.windowMs ?? COMBO_WINDOW_MS));
    const bonusMultiplier = Math.max(0, options.bonusMultiplier ?? 1);
    const previousCount = this.count;
    const previousTouchAt = this.lastTouchAt;
    const isContinuing = previousTouchAt > 0 && now - previousTouchAt <= windowMs;

    this.count = isContinuing ? this.count + 1 : 1;
    this.lastTouchAt = now;
    this.currentWindowMs = windowMs;
    this.expiresAt = now + windowMs;

    const multiplier = this.getMultiplier();
    const bonusTouches = multiplier > 1 ? Math.max(1, Math.floor(baseTouches * (multiplier - 1) * bonusMultiplier)) : 0;
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
    return this.currentWindowMs;
  }

  getBaseWindowMs(): number {
    return COMBO_WINDOW_MS;
  }
}
