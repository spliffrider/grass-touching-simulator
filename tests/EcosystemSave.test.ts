import { describe, expect, it } from "vitest";

import {
  ECOSYSTEM_ACTIVE_SAVE_KEY,
  ECOSYSTEM_PERMANENT_SAVE_KEY,
  clearEcosystemProgress,
  createActiveFieldSnapshot,
  getEcosystemSaveSummary,
  loadPermanentEcosystemState,
  restoreActiveFieldSnapshot,
  saveActiveField,
  savePermanentEcosystemState,
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

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("EcosystemSave", () => {
  it("persists Ancient Heartwood, Green Afterglow, and Verdant Aegis ranks for future fields", () => {
    const storage = new MemoryStorage();
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.heartwoodRank = 3;
    permanent.lingeringCareRank = 4;
    permanent.verdantAegisRank = 5;

    savePermanentEcosystemState(permanent, storage);
    const loaded = loadPermanentEcosystemState(storage);
    const nextField = createEcosystemState(loaded);

    expect(loaded.heartwoodRank).toBe(3);
    expect(loaded.lingeringCareRank).toBe(4);
    expect(loaded.verdantAegisRank).toBe(5);
    expect(nextField.maxHp).toBe(175);
    expect(nextField.maxOverhealShield).toBeGreaterThan(0);
  });

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
    expect(loaded?.state.automatedTouchCount).toBe(state.automatedTouchCount);
    expect(loaded?.state.automatedHealingTotal).toBe(state.automatedHealingTotal);
    expect(loaded?.state.automationTouchRate).toBe(state.automationTouchRate);
    expect(loaded?.state.automationHealingRate).toBe(state.automationHealingRate);
    expect(loaded?.state.lingeringCarePerSecond).toBe(state.lingeringCarePerSecond);
    expect(loaded?.state.lingeringCareRemainingMs).toBe(state.lingeringCareRemainingMs);
    expect(loaded?.state.sprinklerAfterglowPerSecond).toBe(state.sprinklerAfterglowPerSecond);
    expect(loaded?.state.sprinklerAfterglowRemainingMs).toBe(state.sprinklerAfterglowRemainingMs);
    expect(loaded?.state.sprinklerFineMistProcCount).toBe(state.sprinklerFineMistProcCount);
    expect(loaded?.state.overhealShield).toBe(state.overhealShield);
    expect(loaded?.state.maxOverhealShield).toBe(state.maxOverhealShield);
    expect(loaded?.state.overhealShieldRemainingMs).toBe(state.overhealShieldRemainingMs);
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
    state.overhealShield = 30;
    state.maxOverhealShield = 50;
    state.overhealShieldRemainingMs = 4_000;

    const loaded = restoreActiveFieldSnapshot(createActiveFieldSnapshot(state), permanent);

    expect(loaded?.state.runNumber).toBe(1);
    expect(loaded?.state.helpers.tinySprinkler.count).toBe(0);
    expect(loaded?.state.helpers.fieldMouse.count).toBe(0);
    expect(loaded?.state.helpers.tinySprinkler.pulseProgress).toBe(0);
    expect(loaded?.state.helperPulses.tinySprinkler).toBe(0);
    expect(loaded?.state.overhealShield).toBe(0);
    expect(loaded?.state.maxOverhealShield).toBe(0);
    expect(loaded?.state.overhealShieldRemainingMs).toBe(0);
  });

  it("drops legacy Cultivation progress after conversion to one Run Touches purchase", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.maxFieldTier = 1;
    const state = createEcosystemState(permanent, { seed: 809 });
    state.field.cultivationRank = 9;

    const loaded = restoreActiveFieldSnapshot(createActiveFieldSnapshot(state), permanent);

    expect(loaded?.state.field.width).toBe(1);
    expect(loaded?.state.field.cultivationRank).toBe(0);
  });

  it("loads active saves created before helper cycle totals were recorded", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    permanent.unlockedHelpers.fieldMouse = true;
    const state = createEcosystemState(permanent, { seed: 8_153 });
    const snapshot = createActiveFieldSnapshot(state);
    delete (snapshot.helpers.fieldMouse as { cyclesCompleted?: number }).cyclesCompleted;

    const loaded = restoreActiveFieldSnapshot(snapshot, permanent);

    expect(loaded?.state.helpers.fieldMouse.cyclesCompleted).toBe(0);
  });

  it("defaults active saves from before automated-touch accounting to zero", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 2;
    const state = createEcosystemState(permanent, { seed: 8_154 });
    const snapshot = createActiveFieldSnapshot(state);
    delete (snapshot as Partial<typeof snapshot>).automatedTouchCount;
    delete (snapshot as Partial<typeof snapshot>).automatedHealingTotal;
    delete (snapshot as Partial<typeof snapshot>).automationTouchRate;
    delete (snapshot as Partial<typeof snapshot>).automationHealingRate;

    const loaded = restoreActiveFieldSnapshot(snapshot, permanent);

    expect(loaded?.state.automatedTouchCount).toBe(0);
    expect(loaded?.state.automatedHealingTotal).toBe(0);
    expect(loaded?.state.automationTouchRate).toBe(0);
    expect(loaded?.state.automationHealingRate).toBe(0);
  });

  it("defaults active saves created before Green Afterglow to no active healing", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    const state = createEcosystemState(permanent, { seed: 8_154 });
    const snapshot = createActiveFieldSnapshot(state);
    delete (snapshot as { lingeringCarePerSecond?: number }).lingeringCarePerSecond;
    delete (snapshot as { lingeringCareRemainingMs?: number }).lingeringCareRemainingMs;

    const loaded = restoreActiveFieldSnapshot(snapshot, permanent);

    expect(loaded?.state.lingeringCarePerSecond).toBe(0);
    expect(loaded?.state.lingeringCareRemainingMs).toBe(0);
  });

  it("defaults active saves created before sprinkler Memories to no pending effects", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    const state = createEcosystemState(permanent, { seed: 8_155 });
    const snapshot = createActiveFieldSnapshot(state);
    delete (snapshot as { sprinklerAfterglowPerSecond?: number }).sprinklerAfterglowPerSecond;
    delete (snapshot as { sprinklerAfterglowRemainingMs?: number }).sprinklerAfterglowRemainingMs;
    delete (snapshot as { sprinklerFineMistProcCount?: number }).sprinklerFineMistProcCount;

    const loaded = restoreActiveFieldSnapshot(snapshot, permanent);

    expect(loaded?.state.sprinklerAfterglowPerSecond).toBe(0);
    expect(loaded?.state.sprinklerAfterglowRemainingMs).toBe(0);
    expect(loaded?.state.sprinklerFineMistProcCount).toBe(0);
  });

  it("defaults active saves created before Verdant Aegis to no temporary shield", () => {
    const permanent = createPermanentEcosystemState();
    permanent.completedRuns = 1;
    permanent.lingeringCareRank = 1;
    permanent.verdantAegisRank = 1;
    const state = createEcosystemState(permanent, { seed: 8_155 });
    const snapshot = createActiveFieldSnapshot(state);
    delete (snapshot as { overhealShield?: number }).overhealShield;
    delete (snapshot as { maxOverhealShield?: number }).maxOverhealShield;
    delete (snapshot as { overhealShieldRemainingMs?: number }).overhealShieldRemainingMs;

    const loaded = restoreActiveFieldSnapshot(snapshot, permanent);

    expect(loaded?.state.overhealShield).toBe(0);
    expect(loaded?.state.maxOverhealShield).toBeGreaterThan(0);
    expect(loaded?.state.overhealShieldRemainingMs).toBe(0);
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
    expect(loaded?.state.endedSummary?.grassTouchesAwarded).toBe(6);
  });

  it("summarizes active fields and ended Memory Grove saves for the title screen", () => {
    const storage = new MemoryStorage();
    const permanent = createPermanentEcosystemState();
    permanent.grassTouches = 14;
    permanent.completedRuns = 2;
    const state = createEcosystemState(permanent, { seed: 77 });
    state.runNumber = 3;
    state.hp = 42;
    state.elapsedMs = 12_345;
    state.manualTouchCount = 9;
    savePermanentEcosystemState(permanent, storage);
    saveActiveField(state, { centerX: 0.5, centerY: 0.5, zoom: 1 }, storage);

    expect(getEcosystemSaveSummary(storage)).toEqual({
      hasSave: true,
      hasActiveField: true,
      active: true,
      runNumber: 3,
      fieldSize: 1,
      hp: 42,
      maxHp: 100,
      elapsedMs: 12_345,
      manualTouchCount: 9,
      permanentGrassTouches: 14,
      completedRuns: 2,
    });

    forceGameOver(state, permanent);
    savePermanentEcosystemState(permanent, storage);
    saveActiveField(state, { centerX: 0.5, centerY: 0.5, zoom: 1 }, storage);
    const ended = getEcosystemSaveSummary(storage);
    expect(ended.active).toBe(false);
    expect(ended.runNumber).toBe(3);
    expect(ended.permanentGrassTouches).toBeGreaterThanOrEqual(14);
  });

  it("clears both ecosystem save surfaces for a confirmed new field", () => {
    const storage = new MemoryStorage();
    storage.setItem(ECOSYSTEM_PERMANENT_SAVE_KEY, "{}");
    storage.setItem(ECOSYSTEM_ACTIVE_SAVE_KEY, "{}");

    clearEcosystemProgress(storage);

    expect(storage.length).toBe(0);
    expect(getEcosystemSaveSummary(storage).hasSave).toBe(false);
  });
});
