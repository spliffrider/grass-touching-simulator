export type HapticCue = "touch" | "crit" | "perfect" | "blocked" | "upgrade" | "milestone" | "firstTouch";

const HAPTIC_PATTERNS: Record<HapticCue, number | number[]> = {
  touch: 8,
  crit: [10, 14, 16],
  perfect: [14, 18, 24],
  blocked: [16, 24, 16],
  upgrade: [10, 16, 14],
  milestone: [16, 24, 18, 26, 24],
  firstTouch: [14, 18, 10],
};

const HAPTIC_COOLDOWNS_MS: Record<HapticCue, number> = {
  touch: 46,
  crit: 64,
  perfect: 120,
  blocked: 140,
  upgrade: 160,
  milestone: 420,
  firstTouch: 160,
};

export class HapticsSystem {
  private enabled = true;
  private lastPulseAt = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancel();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isSupported(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  pulse(cue: HapticCue, now = performance.now()): boolean {
    if (!this.enabled || !this.isSupported() || document.visibilityState === "hidden") {
      return false;
    }

    const cooldown = HAPTIC_COOLDOWNS_MS[cue];
    if (now - this.lastPulseAt < cooldown) {
      return false;
    }

    this.lastPulseAt = now;
    return navigator.vibrate(HAPTIC_PATTERNS[cue]);
  }

  cancel(): void {
    if (this.isSupported()) {
      navigator.vibrate(0);
    }
  }
}
