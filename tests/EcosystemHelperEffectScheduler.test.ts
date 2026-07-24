import { describe, expect, it } from "vitest";
import { HELPER_IDS, type HelperId } from "../src/game/ecosystem/EcosystemCatalog";
import {
  DESKTOP_HELPER_EFFECT_GAP_MS,
  DESKTOP_HELPER_REPEAT_GAP_MS,
  EcosystemHelperEffectScheduler,
  PHONE_HELPER_EFFECT_GAP_MS,
  PHONE_HELPER_REPEAT_GAP_MS,
} from "../src/game/ecosystem/EcosystemHelperEffectScheduler";

function pulses(overrides: Partial<Record<HelperId, number>> = {}): Record<HelperId, number> {
  return Object.fromEntries(HELPER_IDS.map((helperId) => [helperId, overrides[helperId] ?? 0])) as Record<HelperId, number>;
}

describe("EcosystemHelperEffectScheduler", () => {
  it("batches repeated mechanical pulses into one representative presentation", () => {
    const scheduler = new EcosystemHelperEffectScheduler();
    scheduler.enqueue(pulses({ tinySprinkler: 3 }));
    scheduler.enqueue(pulses({ tinySprinkler: 4 }));

    expect(scheduler.takeNext(1_000, false)).toEqual({ helperId: "tinySprinkler", pulseCount: 7 });
    expect(scheduler.getPendingPulseCount()).toBe(0);
  });

  it("meters global presentation starts without discarding queued pulses", () => {
    const scheduler = new EcosystemHelperEffectScheduler();
    scheduler.enqueue(pulses({ tinySprinkler: 2, fieldMouse: 3 }));

    expect(scheduler.takeNext(1_000, false)?.helperId).toBe("tinySprinkler");
    expect(scheduler.takeNext(1_000 + DESKTOP_HELPER_EFFECT_GAP_MS - 1, false)).toBeNull();
    expect(scheduler.getPendingPulseCount()).toBe(3);
    expect(scheduler.takeNext(1_000 + DESKTOP_HELPER_EFFECT_GAP_MS, false)).toEqual({
      helperId: "fieldMouse",
      pulseCount: 3,
    });
  });

  it("uses round-robin selection so dense helpers all remain visible", () => {
    const scheduler = new EcosystemHelperEffectScheduler();
    scheduler.enqueue(pulses(Object.fromEntries(HELPER_IDS.map((helperId) => [helperId, 1]))));

    const selected: HelperId[] = [];
    for (let index = 0; index < HELPER_IDS.length; index += 1) {
      const batch = scheduler.takeNext(1_000 + index * DESKTOP_HELPER_EFFECT_GAP_MS, false);
      if (batch) selected.push(batch.helperId);
    }

    expect(selected).toEqual(HELPER_IDS);
  });

  it("prevents one fast helper from restarting its presentation too often", () => {
    const scheduler = new EcosystemHelperEffectScheduler();
    scheduler.enqueue(pulses({ tinySprinkler: 1 }));
    expect(scheduler.takeNext(1_000, false)?.helperId).toBe("tinySprinkler");

    scheduler.enqueue(pulses({ tinySprinkler: 5 }));
    expect(scheduler.takeNext(1_000 + DESKTOP_HELPER_REPEAT_GAP_MS - 1, false)).toBeNull();
    expect(scheduler.takeNext(1_000 + DESKTOP_HELPER_REPEAT_GAP_MS, false)).toEqual({
      helperId: "tinySprinkler",
      pulseCount: 5,
    });
  });

  it("uses a calmer cadence on phone-sized views", () => {
    expect(PHONE_HELPER_EFFECT_GAP_MS).toBeGreaterThan(DESKTOP_HELPER_EFFECT_GAP_MS);
    expect(PHONE_HELPER_REPEAT_GAP_MS).toBeGreaterThan(DESKTOP_HELPER_REPEAT_GAP_MS);
  });

  it("requeues a batch when the fixed visual pool is temporarily occupied", () => {
    const scheduler = new EcosystemHelperEffectScheduler();
    scheduler.enqueue(pulses({ beeHive: 6 }));
    const batch = scheduler.takeNext(1_000, false);
    expect(batch).toEqual({ helperId: "beeHive", pulseCount: 6 });

    scheduler.requeue(batch!);
    expect(scheduler.getPendingPulseCount()).toBe(6);
    scheduler.clear(2_000);
    expect(scheduler.getPendingPulseCount()).toBe(0);
  });
});
