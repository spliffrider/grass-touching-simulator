import { describe, expect, it } from "vitest";

import {
  createActiveFieldSnapshot,
  restoreActiveFieldSnapshot,
} from "../src/game/ecosystem/EcosystemSave";
import {
  advanceEcosystem,
  createEcosystemState,
  createPermanentEcosystemState,
  setPrototypeFieldSize,
  touchFieldTile,
  unlockAllPrototypeMemories,
} from "../src/game/ecosystem/EcosystemSystem";

describe("EcosystemSave", () => {
  it("round-trips exact active state without offline advancement", () => {
    const permanent = createPermanentEcosystemState();
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

  it("rejects tile payloads whose dimensions do not match", () => {
    const permanent = createPermanentEcosystemState();
    const state = createEcosystemState(permanent);
    const snapshot = createActiveFieldSnapshot(state);
    snapshot.field.width = 100;
    snapshot.field.height = 100;

    expect(restoreActiveFieldSnapshot(snapshot, permanent)).toBeNull();
  });
});
