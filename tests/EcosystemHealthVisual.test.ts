import { describe, expect, it } from "vitest";

import {
  getHealthHeartbeatCycleMs,
  getHealthHeartbeatPulse,
  predictHealthRatio,
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

  it("predicts continuous damage between deterministic production ticks", () => {
    const beforeTick = predictHealthRatio(100, 100, -20, 249, 250);
    const afterTick = predictHealthRatio(95, 100, -20, 0, 250);

    expect(beforeTick).toBeCloseTo(0.9502, 4);
    expect(afterTick).toBe(0.95);
    expect(Math.abs(beforeTick - afterTick)).toBeLessThan(0.001);
  });

  it("bounds health prediction to one fixed-tick window", () => {
    expect(predictHealthRatio(50, 100, -100, 2_000, 250)).toBe(0.25);
    expect(predictHealthRatio(99, 100, 20, 250, 250)).toBe(1);
  });
});
