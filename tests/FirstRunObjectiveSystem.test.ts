import { describe, expect, it } from "vitest";

import {
  createFirstRunObjectiveState,
  getActiveFirstRunObjective,
  getFirstRunFieldExpansion,
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

  it("advances through early touch and Run Touch objectives from effective healing", () => {
    const runState = createRunSpineState({ currentHp: 80, maxHp: 100 });
    const objectiveState = createFirstRunObjectiveState();

    touchAncientGrass(runState, 5);
    const firstUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(firstUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["wakeAncientGrass"]);
    expect(firstUpdate.activeObjective?.definition.id).toBe("earnRunTouches");

    touchAncientGrass(runState, 7);
    const secondUpdate = updateFirstRunObjectives(objectiveState, runState);

    expect(secondUpdate.newlyCompleted.map((objective) => objective.definition.id)).toEqual(["earnRunTouches"]);
    expect(secondUpdate.activeObjective?.definition.id).toBe("stabilizeWound");
  });

  it("expands the tutorial field as early objectives complete", () => {
    const objectiveState = createFirstRunObjectiveState();

    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 1, gridSize: 1 });

    objectiveState.completedObjectiveIds.push("wakeAncientGrass");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 4, gridSize: 2 });

    objectiveState.completedObjectiveIds.push("earnRunTouches");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 9, gridSize: 3 });

    objectiveState.completedObjectiveIds.push("stabilizeWound");
    expect(getFirstRunFieldExpansion(objectiveState)).toEqual({ rootCount: 25, gridSize: 5 });
  });

  it("keeps objective order even if later conditions are already true", () => {
    const runState = createRunSpineState({ currentHp: 80, maxHp: 100 });
    const objectiveState = createFirstRunObjectiveState();

    openRootWound(runState, 25, 3);
    touchAncientGrassRoot(runState, 16, 3);
    const update = updateFirstRunObjectives(objectiveState, runState);

    expect(update.newlyCompleted.map((objective) => objective.definition.id)).toEqual([
      "wakeAncientGrass",
      "earnRunTouches",
      "stabilizeWound",
    ]);
    expect(update.activeObjective?.definition.id).toBe("completeDormancy");
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
      "earnRunTouches",
      "stabilizeWound",
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
