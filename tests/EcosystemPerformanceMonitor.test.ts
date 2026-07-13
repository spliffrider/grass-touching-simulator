import { describe, expect, it } from "vitest";
import { EcosystemPerformanceMonitor } from "../src/game/ecosystem/EcosystemPerformanceMonitor";

describe("EcosystemPerformanceMonitor", () => {
  it("reports a bounded frame window without allocating per-frame samples", () => {
    const monitor = new EcosystemPerformanceMonitor(100);
    for (let frame = 0; frame < 6; frame += 1) {
      monitor.recordFrame(16.67, 2, 0.25, 0.5, frame % 2 === 0 ? 1.5 : -1);
    }

    const snapshot = monitor.getSnapshot();
    expect(snapshot.frames).toBe(6);
    expect(snapshot.fps).toBeCloseTo(60, 0);
    expect(snapshot.averageFrameWorkMs).toBe(2);
    expect(snapshot.averageSimulationMs).toBe(0.25);
    expect(snapshot.averageAnimationMs).toBe(0.5);
    expect(snapshot.uiRefreshes).toBe(3);
    expect(snapshot.averageUiRefreshMs).toBe(1.5);
  });

  it("tracks p95 frame pacing and infrequent phase spikes", () => {
    const monitor = new EcosystemPerformanceMonitor(100);
    for (let frame = 0; frame < 5; frame += 1) {
      const delta = frame === 4 ? 40 : 16;
      monitor.recordFrame(delta, frame === 4 ? 12 : 1, 0.2, 0.3, -1, frame === 4 ? 9 : -1);
    }

    const snapshot = monitor.getSnapshot();
    expect(snapshot.p95FrameDeltaMs).toBe(40);
    expect(snapshot.maxFrameDeltaMs).toBe(40);
    expect(snapshot.maxFrameWorkMs).toBe(12);
    expect(snapshot.fieldRenders).toBe(1);
    expect(snapshot.maxFieldRenderMs).toBe(9);
  });

  it("captures input work that occurs outside the scene update callback", () => {
    const monitor = new EcosystemPerformanceMonitor(32);
    monitor.recordTouchAction(3, 0.2, 0.4, 0.6, 0.8, 1);
    monitor.recordTouchAction(5, 0.4, 0.6, 0.8, 1, 1.2);
    monitor.recordFrame(16, 1, 0.1, 0.2);
    monitor.recordFrame(16, 1, 0.1, 0.2);

    const snapshot = monitor.getSnapshot();
    expect(snapshot.touchActions).toBe(2);
    expect(snapshot.averageTouchActionMs).toBe(4);
    expect(snapshot.maxTouchActionMs).toBe(5);
    expect(snapshot.averageTouchModelMs).toBeCloseTo(0.3);
    expect(snapshot.averageTouchAudioMs).toBeCloseTo(0.5);
    expect(snapshot.averageTouchEffectsMs).toBeCloseTo(0.7);
    expect(snapshot.averageTouchRenderMs).toBeCloseTo(0.9);
    expect(snapshot.averageTouchUiMs).toBeCloseTo(1.1);
  });
});
