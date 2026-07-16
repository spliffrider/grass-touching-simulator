import { describe, expect, it } from "vitest";

import {
  createActiveFieldSnapshot,
  restoreActiveFieldSnapshot,
} from "../src/game/ecosystem/EcosystemSave";
import {
  advanceEcosystem,
  createEcosystemState,
  createPermanentEcosystemState,
  forceGameOver,
  setPrototypeFieldSize,
  touchFieldTile,
  unlockAllPrototypeMemories,
} from "../src/game/ecosystem/EcosystemSystem";

describe("EcosystemSave", () => {
  it("round-trips exact active state without offline advancement", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 321 });
    setPrototypeFieldSize(state, permanent, 32);
    state.helpers.tinySprinkler.count = 4;
    state.helpers.fieldMouse.count = 2;
    for (let step = 0; step < 40; step += 1) {
      if (step % 4 === 0) touchFieldTile(state, permanent, step * 13);
      advanceEcosystem(state, permanent, 250);
    }
    const snapshot = createActiveFieldSnapshot(state, { centerX: 0.62, centerY: 0.41, zoom: 3.2 });
    snapshot.savedAt -= 86_400_000;

    const loaded = restoreActiveFieldSnapshot(JSON.parse(JSON.stringify(snapshot)) as unknown, permanent);

    expect(loaded).not.toBeNull();
    expect(loaded?.state.elapsedMs).toBe(state.elapsedMs);
    expect(loaded?.state.fixedTicks).toBe(state.fixedTicks);
    expect(loaded?.state.resources).toEqual(state.resources);
    expect(loaded?.state.helpers).toEqual(state.helpers);
    expect([...loaded!.state.field.stages]).toEqual([...state.field.stages]);
    expect(loaded?.view).toEqual({ centerX: 0.62, centerY: 0.41, zoom: 3.2 });
  });

  it("strips equipment from contradictory old Run 1 saves", () => {
    const permanent = createPermanentEcosystemState();
    unlockAllPrototypeMemories(permanent);
    const state = createEcosystemState(permanent, { seed: 808 });
    state.helpers.tinySprinkler.count = 5;
    state.helpers.fieldMouse.count = 3;
    state.helpers.tinySprinkler.pulseProgress = 0.75;
    state.helperPulses.tinySprinkler = 2;

    const loaded = restoreActiveFieldSnapshot(createActiveFieldSnapshot(state), permanent);

    expect(loaded?.state.runNumber).toBe(1);
    expect(loaded?.state.helpers.tinySprinkler.count).toBe(0);
    expect(loaded?.state.helpers.fieldMouse.count).toBe(0);
    expect(loaded?.state.helpers.tinySprinkler.pulseProgress).toBe(0);
    expect(loaded?.state.helperPulses.tinySprinkler).toBe(0);
  });

  it("rejects tile payloads whose dimensions do not match", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent);
    const snapshot = createActiveFieldSnapshot(state);
    snapshot.field.width = 100;
    snapshot.field.height = 100;

    expect(restoreActiveFieldSnapshot(snapshot, permanent)).toBeNull();
  });

  it("round-trips an ended field so Memory Grove survives a reload", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent, { seed: 2026 });
    touchFieldTile(state, permanent, 0);
    forceGameOver(state, permanent);

    const loaded = restoreActiveFieldSnapshot(createActiveFieldSnapshot(state), permanent);

    expect(loaded?.state.active).toBe(false);
    expect(loaded?.state.runNumber).toBe(1);
    expect(loaded?.state.endedSummary).toEqual(state.endedSummary);
    expect(loaded?.state.endedSummary?.grassTouchesAwarded).toBe(7);
  });
});
