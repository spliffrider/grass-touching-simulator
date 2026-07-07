import type { RunSpineState } from "./RunSpineSystem";

export type FirstRunObjectiveId =
  | "wakeAncientGrass"
  | "earnRunTouches"
  | "stabilizeWound"
  | "completeDormancy"
  | "rememberUpgrade";

export interface FirstRunObjectiveDefinition {
  id: FirstRunObjectiveId;
  title: string;
  detail: string;
  completedFeed: string;
  target: number;
  getProgress(state: RunSpineState): number;
}

export interface FirstRunObjectiveProgress {
  definition: FirstRunObjectiveDefinition;
  current: number;
  target: number;
  completed: boolean;
}

export interface FirstRunObjectiveState {
  completedObjectiveIds: FirstRunObjectiveId[];
}

export interface FirstRunObjectiveUpdate {
  newlyCompleted: FirstRunObjectiveProgress[];
  activeObjective?: FirstRunObjectiveProgress;
  objectives: FirstRunObjectiveProgress[];
}

export interface FirstRunFieldExpansion {
  rootCount: number;
  gridSize: number;
}

export const FIRST_RUN_FIELD_EXPANSION_STAGES = {
  initial: { rootCount: 1, gridSize: 1 },
  awakened: { rootCount: 4, gridSize: 2 },
  practiced: { rootCount: 9, gridSize: 3 },
  opened: { rootCount: 25, gridSize: 5 },
} as const satisfies Record<string, FirstRunFieldExpansion>;

export const FIRST_RUN_OBJECTIVE_DEFINITIONS: FirstRunObjectiveDefinition[] = [
  {
    id: "wakeAncientGrass",
    title: "Wake the Ancient Grass",
    detail: "Restore missing HP with a real touch.",
    completedFeed: "first healing registered",
    target: 1,
    getProgress: (state) => (state.ancientGrass.effectiveHealingThisRun > 0 ? 1 : 0),
  },
  {
    id: "earnRunTouches",
    title: "Gather Run Touches",
    detail: "Earn 10 RT from effective healing.",
    completedFeed: "10 Run Touches earned",
    target: 10,
    getProgress: (state) => state.economy.totalRunTouchesEarned,
  },
  {
    id: "stabilizeWound",
    title: "Stabilize a Wound",
    detail: "Heal one pink wounded root.",
    completedFeed: "wound triage learned",
    target: 1,
    getProgress: (state) => state.wounds.totalWoundsHealed,
  },
  {
    id: "completeDormancy",
    title: "Reach Dormancy",
    detail: "Let the run end and keep the memory.",
    completedFeed: "dormancy converted to memory",
    target: 1,
    getProgress: (state) => (state.phase === "dormant" ? 1 : 0),
  },
  {
    id: "rememberUpgrade",
    title: "Buy a Memory",
    detail: "Spend permanent GT on an upgrade.",
    completedFeed: "first memory upgrade owned",
    target: 1,
    getProgress: (state) => state.permanentUpgrades.length,
  },
];

export function createFirstRunObjectiveState(
  completedObjectiveIds: FirstRunObjectiveId[] = [],
): FirstRunObjectiveState {
  return {
    completedObjectiveIds: normalizeObjectiveIds(completedObjectiveIds),
  };
}

export function updateFirstRunObjectives(
  objectiveState: FirstRunObjectiveState,
  runState: RunSpineState,
): FirstRunObjectiveUpdate {
  const objectives = getFirstRunObjectiveProgress(runState, objectiveState.completedObjectiveIds);
  const newlyCompleted: FirstRunObjectiveProgress[] = [];

  for (const objective of objectives) {
    if (objectiveState.completedObjectiveIds.includes(objective.definition.id)) {
      continue;
    }

    if (!objective.completed) {
      break;
    }

    objectiveState.completedObjectiveIds.push(objective.definition.id);
    newlyCompleted.push(objective);
  }

  return {
    newlyCompleted,
    activeObjective: getActiveFirstRunObjective(objectiveState, runState),
    objectives: getFirstRunObjectiveProgress(runState, objectiveState.completedObjectiveIds),
  };
}

export function getActiveFirstRunObjective(
  objectiveState: FirstRunObjectiveState,
  runState: RunSpineState,
): FirstRunObjectiveProgress | undefined {
  return getFirstRunObjectiveProgress(runState, objectiveState.completedObjectiveIds).find(
    (objective) => !objectiveState.completedObjectiveIds.includes(objective.definition.id),
  );
}

export function getFirstRunObjectiveProgress(
  runState: RunSpineState,
  completedObjectiveIds: FirstRunObjectiveId[] = [],
): FirstRunObjectiveProgress[] {
  const completed = new Set(normalizeObjectiveIds(completedObjectiveIds));
  return FIRST_RUN_OBJECTIVE_DEFINITIONS.map((definition) => {
    const current = Math.max(0, Math.floor(definition.getProgress(runState)));
    return {
      definition,
      current: Math.min(current, definition.target),
      target: definition.target,
      completed: completed.has(definition.id) || current >= definition.target,
    };
  });
}

export function getFirstRunFieldExpansion(objectiveState: FirstRunObjectiveState): FirstRunFieldExpansion {
  if (objectiveState.completedObjectiveIds.includes("stabilizeWound")) {
    return FIRST_RUN_FIELD_EXPANSION_STAGES.opened;
  }

  if (objectiveState.completedObjectiveIds.includes("earnRunTouches")) {
    return FIRST_RUN_FIELD_EXPANSION_STAGES.practiced;
  }

  if (objectiveState.completedObjectiveIds.includes("wakeAncientGrass")) {
    return FIRST_RUN_FIELD_EXPANSION_STAGES.awakened;
  }

  return FIRST_RUN_FIELD_EXPANSION_STAGES.initial;
}

function normalizeObjectiveIds(ids: FirstRunObjectiveId[]): FirstRunObjectiveId[] {
  const validIds = new Set(FIRST_RUN_OBJECTIVE_DEFINITIONS.map((definition) => definition.id));
  return ids.filter((id, index) => validIds.has(id) && ids.indexOf(id) === index);
}
