import type { RunSpineState } from "./RunSpineSystem";

export type FirstRunObjectiveId =
  | "wakeAncientGrass"
  | "cultivateSoftLoam"
  | "openDewVeins"
  | "strengthenRootHeart"
  | "raiseAncientCrown"
  | "earnRunTouches"
  | "stabilizeWound"
  | "holdTheLine"
  | "completeDormancy"
  | "rememberUpgrade";

export interface FirstRunObjectiveDefinition {
  id: FirstRunObjectiveId;
  title: string;
  detail: string;
  completedFeed: string;
  target: number;
  getProgress(state: RunSpineState, objectiveState: FirstRunObjectiveState): number;
}

export interface FirstRunObjectiveProgress {
  definition: FirstRunObjectiveDefinition;
  current: number;
  target: number;
  completed: boolean;
}

export interface FirstRunObjectiveState {
  completedObjectiveIds: FirstRunObjectiveId[];
  cumulativeRunTouchesEarned: number;
  observedRunTouchesEarned: number;
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

export interface FirstRunOneTileMastery {
  rank: number;
  maxRank: number;
  name: string;
  shortEffect: string;
  manualHealingMultiplier: number;
  recoveryDurationMultiplier: number;
}

export const FIRST_RUN_ONE_TILE_UPGRADE_OBJECTIVE_IDS = [
  "cultivateSoftLoam",
  "openDewVeins",
  "strengthenRootHeart",
  "raiseAncientCrown",
] as const satisfies readonly FirstRunObjectiveId[];

export const FIRST_RUN_ONE_TILE_MASTERY_STAGES: readonly Omit<FirstRunOneTileMastery, "maxRank">[] = [
  {
    rank: 0,
    name: "Dormant Inheritance",
    shortEffect: "No care upgrades yet",
    manualHealingMultiplier: 1,
    recoveryDurationMultiplier: 1,
  },
  {
    rank: 1,
    name: "Soft Loam",
    shortEffect: "Heal +10%",
    manualHealingMultiplier: 1.1,
    recoveryDurationMultiplier: 1,
  },
  {
    rank: 2,
    name: "Dew Veins",
    shortEffect: "Heal +10% | recover +15%",
    manualHealingMultiplier: 1.1,
    recoveryDurationMultiplier: 0.85,
  },
  {
    rank: 3,
    name: "Root Heart",
    shortEffect: "Heal +25% | recover +15%",
    manualHealingMultiplier: 1.25,
    recoveryDurationMultiplier: 0.85,
  },
  {
    rank: 4,
    name: "Ancient Crown",
    shortEffect: "Heal +25% | recover +30%",
    manualHealingMultiplier: 1.25,
    recoveryDurationMultiplier: 0.7,
  },
];

export const FIRST_RUN_FIELD_EXPANSION_STAGES = {
  initial: { rootCount: 1, gridSize: 1 },
  crowned: { rootCount: 4, gridSize: 2 },
  networked: { rootCount: 9, gridSize: 3 },
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
    id: "cultivateSoftLoam",
    title: "Cultivate Soft Loam",
    detail: "Earn 6 care RT. Upgrade: manual healing +10%.",
    completedFeed: "Soft Loam: healing +10%",
    target: 6,
    getProgress: getCumulativeRunTouches,
  },
  {
    id: "openDewVeins",
    title: "Open the Dew Veins",
    detail: "Earn 14 care RT. Upgrade: root recovery 15% faster.",
    completedFeed: "Dew Veins: recovery 15% faster",
    target: 14,
    getProgress: getCumulativeRunTouches,
  },
  {
    id: "strengthenRootHeart",
    title: "Strengthen the Root Heart",
    detail: "Earn 24 care RT. Upgrade: manual healing +25% total.",
    completedFeed: "Root Heart: healing +25% total",
    target: 24,
    getProgress: getCumulativeRunTouches,
  },
  {
    id: "raiseAncientCrown",
    title: "Raise the Ancient Crown",
    detail: "Earn 36 care RT. Upgrade: recovery 30% faster; first expansion.",
    completedFeed: "Ancient Crown: first expansion ready",
    target: 36,
    getProgress: getCumulativeRunTouches,
  },
  {
    id: "earnRunTouches",
    title: "Map the Root Network",
    detail: "Earn 50 care RT to awaken a 3x3 root network.",
    completedFeed: "root network mapped",
    target: 50,
    getProgress: getCumulativeRunTouches,
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
    id: "holdTheLine",
    title: "Hold the Line",
    detail: "Heal 3 wounded roots before the field fully opens.",
    completedFeed: "pressure lesson survived",
    target: 3,
    getProgress: (state) => (state.phase === "dormant" ? 3 : state.wounds.totalWoundsHealed),
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
    cumulativeRunTouchesEarned: 0,
    observedRunTouchesEarned: 0,
  };
}

export function updateFirstRunObjectives(
  objectiveState: FirstRunObjectiveState,
  runState: RunSpineState,
): FirstRunObjectiveUpdate {
  captureRunTouchProgress(objectiveState, runState);
  const objectives = getFirstRunObjectiveProgress(runState, objectiveState);
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
    objectives: getFirstRunObjectiveProgress(runState, objectiveState),
  };
}

export function getActiveFirstRunObjective(
  objectiveState: FirstRunObjectiveState,
  runState: RunSpineState,
): FirstRunObjectiveProgress | undefined {
  return getFirstRunObjectiveProgress(runState, objectiveState).find(
    (objective) => !objectiveState.completedObjectiveIds.includes(objective.definition.id),
  );
}

export function getFirstRunObjectiveProgress(
  runState: RunSpineState,
  objectiveState: FirstRunObjectiveState = createFirstRunObjectiveState(),
): FirstRunObjectiveProgress[] {
  const completed = new Set(normalizeObjectiveIds(objectiveState.completedObjectiveIds));
  return FIRST_RUN_OBJECTIVE_DEFINITIONS.map((definition) => {
    const current = Math.max(0, Math.floor(definition.getProgress(runState, objectiveState)));
    return {
      definition,
      current: Math.min(current, definition.target),
      target: definition.target,
      completed: completed.has(definition.id) || current >= definition.target,
    };
  });
}

export function getFirstRunFieldExpansion(objectiveState: FirstRunObjectiveState): FirstRunFieldExpansion {
  if (objectiveState.completedObjectiveIds.includes("holdTheLine")) {
    return FIRST_RUN_FIELD_EXPANSION_STAGES.opened;
  }

  if (objectiveState.completedObjectiveIds.includes("earnRunTouches")) {
    return FIRST_RUN_FIELD_EXPANSION_STAGES.networked;
  }

  if (objectiveState.completedObjectiveIds.includes("raiseAncientCrown")) {
    return FIRST_RUN_FIELD_EXPANSION_STAGES.crowned;
  }

  return FIRST_RUN_FIELD_EXPANSION_STAGES.initial;
}

export function getFirstRunOneTileMastery(objectiveState: FirstRunObjectiveState): FirstRunOneTileMastery {
  const rank = FIRST_RUN_ONE_TILE_UPGRADE_OBJECTIVE_IDS.reduce(
    (total, objectiveId) => total + Number(objectiveState.completedObjectiveIds.includes(objectiveId)),
    0,
  );
  const stage = FIRST_RUN_ONE_TILE_MASTERY_STAGES[Math.min(rank, FIRST_RUN_ONE_TILE_MASTERY_STAGES.length - 1)];
  return {
    ...stage,
    maxRank: FIRST_RUN_ONE_TILE_UPGRADE_OBJECTIVE_IDS.length,
  };
}

function captureRunTouchProgress(objectiveState: FirstRunObjectiveState, runState: RunSpineState): void {
  const currentRunTouches = normalizeRunTouches(runState.economy.totalRunTouchesEarned);
  if (currentRunTouches < objectiveState.observedRunTouchesEarned) {
    objectiveState.observedRunTouchesEarned = 0;
  }

  objectiveState.cumulativeRunTouchesEarned += Math.max(
    0,
    currentRunTouches - objectiveState.observedRunTouchesEarned,
  );
  objectiveState.observedRunTouchesEarned = currentRunTouches;
}

function getCumulativeRunTouches(state: RunSpineState, objectiveState: FirstRunObjectiveState): number {
  const currentRunTouches = normalizeRunTouches(state.economy.totalRunTouchesEarned);
  const observedThisRun = currentRunTouches < objectiveState.observedRunTouchesEarned
    ? 0
    : objectiveState.observedRunTouchesEarned;
  return objectiveState.cumulativeRunTouchesEarned + Math.max(0, currentRunTouches - observedThisRun);
}

function normalizeRunTouches(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeObjectiveIds(ids: FirstRunObjectiveId[]): FirstRunObjectiveId[] {
  const validIds = new Set(FIRST_RUN_OBJECTIVE_DEFINITIONS.map((definition) => definition.id));
  return ids.filter((id, index) => validIds.has(id) && ids.indexOf(id) === index);
}
