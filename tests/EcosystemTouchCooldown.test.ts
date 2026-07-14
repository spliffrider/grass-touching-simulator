import { describe, expect, it } from "vitest";

import {
  MANUAL_TOUCH_COOLDOWN_MS,
  MAX_TRACKED_TOUCH_COOLDOWNS,
  getManualTouchCooldownMs,
  getTouchCooldownProgress,
  pruneTouchCooldowns,
  tryStartTouchCooldown,
} from "../src/game/ecosystem/EcosystemTouchCooldown";

describe("EcosystemTouchCooldown", () => {
  it("has a rank-ready recovery curve without making taps instantaneous", () => {
    expect(getManualTouchCooldownMs()).toBe(380);
    expect(getManualTouchCooldownMs(5)).toBe(260);
    expect(getManualTouchCooldownMs(10)).toBe(140);
  });

  it("blocks the same tile until its short recovery expires", () => {
    const cooldowns = new Map<number, number>();
    const first = tryStartTouchCooldown(cooldowns, 4, 1_000);
    const blocked = tryStartTouchCooldown(cooldowns, 4, 1_100);
    const recovered = tryStartTouchCooldown(cooldowns, 4, 1_000 + MANUAL_TOUCH_COOLDOWN_MS);

    expect(first.accepted).toBe(true);
    expect(blocked).toEqual({
      accepted: false,
      readyAtMs: 1_000 + MANUAL_TOUCH_COOLDOWN_MS,
      remainingMs: MANUAL_TOUCH_COOLDOWN_MS - 100,
    });
    expect(recovered.accepted).toBe(true);
  });

  it("lets the player move immediately to another tile", () => {
    const cooldowns = new Map<number, number>();
    expect(tryStartTouchCooldown(cooldowns, 1, 500).accepted).toBe(true);
    expect(tryStartTouchCooldown(cooldowns, 2, 510).accepted).toBe(true);
  });

  it("reports clamped progress for the pooled visual", () => {
    expect(getTouchCooldownProgress(100, 500, 0)).toBe(0);
    expect(getTouchCooldownProgress(100, 500, 300)).toBe(0.5);
    expect(getTouchCooldownProgress(100, 500, 700)).toBe(1);
  });

  it("prunes expired entries and keeps tracking bounded", () => {
    const cooldowns = new Map<number, number>();
    for (let index = 0; index < MAX_TRACKED_TOUCH_COOLDOWNS + 20; index += 1) {
      tryStartTouchCooldown(cooldowns, index, index, 10_000);
    }
    expect(cooldowns.size).toBeLessThanOrEqual(MAX_TRACKED_TOUCH_COOLDOWNS);

    pruneTouchCooldowns(cooldowns, 20_000);
    expect(cooldowns.size).toBe(0);
  });
});
