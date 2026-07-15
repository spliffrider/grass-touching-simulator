import { describe, expect, it } from "vitest";

import {
  getHealthHeartbeatCycleMs,
  getHealthHeartbeatPulse,
  smoothHealthRatio,
} from "../src/game/ecosystem/EcosystemHealthVisual";

describe("EcosystemHealthVisual", () => {
  it("smoothly approaches HP targets without overshooting", () => {
    let displayed = 1;
    for (let frame = 0; frame < 12; frame += 1) {
      const next = smoothHealthRatio(displayed, 0.2, 16.667);
      expect(next).toBeLessThan(displayed);
      expect(next).toBeGreaterThanOrEqual(0.2);
      displayed = next;
    }
    expect(displayed).toBeLessThan(0.34);
  });

  it("keeps smoothing effectively frame-rate independent", () => {
    let sixtyFps = 1;
    for (let frame = 0; frame < 60; frame += 1) sixtyFps = smoothHealthRatio(sixtyFps, 0.25, 1_000 / 60);
    let tenFps = 1;
    for (let frame = 0; frame < 10; frame += 1) tenFps = smoothHealthRatio(tenFps, 0.25, 100);
    expect(sixtyFps).toBeCloseTo(tenFps, 6);
  });

  it("accelerates and preserves the double heartbeat as HP falls", () => {
    const healthyCycle = getHealthHeartbeatCycleMs(1);
    const dangerCycle = getHealthHeartbeatCycleMs(0.05);
    expect(dangerCycle).toBeLessThan(healthyCycle * 0.5);

    expect(getHealthHeartbeatPulse(healthyCycle * 0.08, 1)).toBeGreaterThan(0.95);
    expect(getHealthHeartbeatPulse(healthyCycle * 0.15, 1)).toBeLessThan(0.2);
    expect(getHealthHeartbeatPulse(healthyCycle * 0.22, 1)).toBeGreaterThan(0.5);
  });
});
