import { describe, expect, it } from "vitest";

import {
  createFirstRunObjectiveState,
  getActiveFirstRunObjective,
  getFirstRunFieldExpansion,
  getFirstRunOneTileMastery,
  updateFirstRunObjectives,
} from "../src/game/redesign/FirstRunObjectiveSystem";
import {
  advanceRun,
  createRunSpineState,
  openRootWound,
  purchasePermanentUpgrade,
  touchAncientGrass,
  touchAncientGrassRoot,
} from "../src/game/redesign/RunSpineSystem";

describe("FirstRunObjectiveSystem", () => {
  it("starts by asking the player to wake the Ancient Grass", () => {
    const runState = createRunSpineState({ currentHp: 80 });
    const objectiveState = createFirstRunObjectiveState();

    const activeObjective = getActiveFirstRunObjective(objectiveState, runState);

    expect(activeObjective?.definition.id).toBe("wakeAncientGrass");
    expect(activeObjective?.completed).toBe(false);
  });

  it("earns four care upgrades before mapping the larger root network", () => {
    const runState = createRunSpineState({ currentHp: 1, maxHp: 100 });
    const objectiveState = createFirstRunObjectiveState();

    touchAncientGrass(runState, 3);
    const firstUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(firstUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["wakeAncientGrass"]);
    expect(firstUpdate.activeObjective?.definition.id).toBe("cultivateSoftLoam");

    touchAncientGrass(runState, 3);
    expect(updateFirstRunObjectives(objectiveState, runState).newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "cultivateSoftLoam",
    ]);

    touchAncientGrass(runState, 8);
    expect(updateFirstRunObjectives(objectiveState, runState).newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "openDewVeins",
    ]);

    touchAncientGrass(runState, 10);
    expect(updateFirstRunObjectives(objectiveState, runState).newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "strengthenRootHeart",
    ]);

    touchAncientGrass(runState, 12);
    const crownUpdate = updateFirstRunObjectives(objectiveState, runState);
    expect(crownUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["raiseAncientCrown"]);
    expect(crownUpdate.activeObjective?.definition.id).toBe("earnRunTouches");

    touchAncientGrass(runState, 14);
    const networkUpdate = updateFirstRunObjectives(objectiveState, runState);
    expect(networkUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["earnRunTouches"]);
    expect(networkUpdate.activeObjective?.definition.id).toBe("stabilizeWound");
  });

  it("keeps one tile through four upgrades before expanding", () => {
    const objectiveState = createFirstRunObjectiveState();

    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 1, gridSize: 1 });

    objectiveState.completedObjectiveIds.push("wakeAncientGrass");
    objectiveState.completedObjectiveIds.push("cultivateSoftLoam");
    objectiveState.completedObjectiveIds.push("openDewVeins");
    objectiveState.completedObjectiveIds.push("strengthenRootHeart");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 1, gridSize: 1 });

    objectiveState.completedObjectiveIds.push("raiseAncientCrown");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 4, gridSize: 2 });

    objectiveState.completedObjectiveIds.push("earnRunTouches");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 9, gridSize: 3 });

    objectiveState.completedObjectiveIds.push("stabilizeWound");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 9, gridSize: 3 });

    objectiveState.completedObjectiveIds.push("holdTheLine");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 25, gridSize: 5 });
  });

  it("applies cumulative healing and recovery benefits to one-tile mastery", () => {
    const objectiveState = createFirstRunObjectiveState();

    expect(getFirstRunOneTileMastery(objectiveState)).toMatchObject({
      rank: 0,
      name: "Dormant Inheritance",
      manualHealingMultiplier: 1,
      recoveryDurationMultiplier: 1,
    });

    objectiveState.completedObjectiveIds.push("cultivateSoftLoam", "openDewVeins", "strengthenRootHeart");
    expect(getFirstRunOneTileMastery(objectiveState)).toMatchObject({
      rank: 3,
      name: "Root Heart",
      manualHealingMultiplier: 1.25,
      recoveryDurationMultiplier: 0.85,
    });

    objectiveState.completedObjectiveIds.push("raiseAncientCrown");
    expect(getFirstRunOneTileMastery(objectiveState)).toMatchObject({
      rank: 4,
      maxRank: 4,
      name: "Ancient Crown",
      manualHealingMultiplier: 1.25,
      recoveryDurationMultiplier: 0.7,
    });
  });

  it("starts a new run with fresh one-tile care mastery", () => {
    const completedRun = createFirstRunObjectiveState([
      "wakeAncientGrass",
      "cultivateSoftLoam",
      "openDewVeins",
      "strengthenRootHeart",
      "raiseAncientCrown",
      "earnRunTouches",
      "stabilizeWound",
      "holdTheLine",
    ]);
    const nextRun = createFirstRunObjectiveState();

    expect(getFirstRunFieldExpansion(completedRun)).toEqual({ rootCount: 25, gridSize: 5 });
    expect(getFirstRunFieldExpansion(nextRun)).toEqual({ rootCount: 1, gridSize: 1 });
    expect(getFirstRunOneTileMastery(nextRun)).toMatchObject({ rank: 0, name: "Dormant Inheritance" });
    expect(nextRun.cumulativeRunTouchesEarned).toBe(0);
  });

  it("keeps objective order even if later conditions are already true", () => {
    const runState = createRunSpineState({ currentHp: 1, maxHp: 100 });
    const objectiveState = createFirstRunObjectiveState();

    openRootWound(runState, 25, 3);
    touchAncientGrassRoot(runState, 100, 3);
    const update = updateFirstRunObjectives(objectiveState, runState);

    expect(update.newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "wakeAncientGrass",
      "cultivateSoftLoam",
      "openDewVeins",
      "strengthenRootHeart",
      "raiseAncientCrown",
      "earnRunTouches",
      "stabilizeWound",
    ]);
    expect(update.activeObjective?.definition.id).toBe("holdTheLine");
  });

  it("holds the field at 3x3 until the pressure lesson is survived", () => {
    const runState = createRunSpineState({ currentHp: 40, maxHp: 100 });
    openRootWound(runState, 9, 0);
    touchAncientGrassRoot(runState, 5, 0);
    const objectiveState = createFirstRunObjectiveState([
      "wakeAncientGrass",
      "cultivateSoftLoam",
      "openDewVeins",
      "strengthenRootHeart",
      "raiseAncientCrown",
      "earnRunTouches",
      "stabilizeWound",
    ]);

    openRootWound(runState, 9, 1);
    touchAncientGrassRoot(runState, 5, 1);
    const firstHoldUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(firstHoldUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual([]);
    expect(firstHoldUpdate.activeObjective?.definition.id).toBe("holdTheLine");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 9, gridSize: 3 });

    openRootWound(runState, 9, 2);
    touchAncientGrassRoot(runState, 5, 2);
    const completedHoldUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(completedHoldUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["holdTheLine"]);
    expect(completedHoldUpdate.activeObjective?.definition.id).toBe("completeDormancy");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 25, gridSize: 5 });
  });

  it("lets dormancy advance past the pressure lesson if the player collapses early", () => {
    const runState = createRunSpineState({
      currentHp: 4,
      baseDrainPerSecond: 8,
      pressureGrowthPerSecond: 0,
    });
    const objectiveState = createFirstRunObjectiveState([
      "wakeAncientGrass",
      "cultivateSoftLoam",
      "openDewVeins",
      "strengthenRootHeart",
      "raiseAncientCrown",
      "earnRunTouches",
      "stabilizeWound",
    ]);

    advanceRun(runState, 1_000);
    const update = updateFirstRunObjectives(objectiveState, runState);

    expect(update.newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "holdTheLine",
      "completeDormancy",
    ]);
    expect(update.activeObjective?.definition.id).toBe("rememberUpgrade");
  });

  it("finishes dormancy and memory purchase objectives", () => {
    const runState = createRunSpineState({
      currentHp: 4,
      permanentGrassTouches: 20,
      baseDrainPerSecond: 8,
      pressureGrowthPerSecond: 0,
    });
    const objectiveState = createFirstRunObjectiveState([
      "wakeAncientGrass",
      "cultivateSoftLoam",
      "openDewVeins",
      "strengthenRootHeart",
      "raiseAncientCrown",
      "earnRunTouches",
      "stabilizeWound",
      "holdTheLine",
    ]);

    advanceRun(runState, 1_000);
    const dormancyUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(dormancyUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "completeDormancy",
    ]);
    expect(dormancyUpdate.activeObjective?.definition.id).toBe("rememberUpgrade");

    purchasePermanentUpgrade(runState, "softTouch");
    const memoryUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(memoryUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["rememberUpgrade"]);
    expect(memoryUpdate.activeObjective).toBeUndefined();
  });
});
