import { HELPER_IDS, HELPERS, type HelperId } from "./EcosystemCatalog";
import type { PermanentRankKind } from "./EcosystemSystem";

export const ECOSYSTEM_MEMORY_WORLD_WIDTH = 3600;
export const ECOSYSTEM_MEMORY_WORLD_HEIGHT = 1500;

export type EcosystemMemoryNodeKind =
  | "root"
  | "helperUnlock"
  | "helperRank"
  | "helperMode"
  | "fieldTier"
  | "touchRank"
  | "capstone";

export interface EcosystemMemoryNodeDefinition {
  id: string;
  kind: EcosystemMemoryNodeKind;
  label: string;
  branch: string;
  description: string;
  color: number;
  iconKey: string;
  iconPath?: string;
  x: number;
  y: number;
  prerequisites: readonly string[];
  helperId?: HelperId;
  rankKind?: PermanentRankKind;
  touchKind?: "broadPalm" | "manyHands";
}

export interface EcosystemMemoryEdge {
  from: string;
  to: string;
}

const ROOT_ID = "root:field-heir";
const HELPER_START_X = -1100;
const HELPER_STEP_X = 360;
const HELPER_COLORS: Record<HelperId, number> = {
  tinySprinkler: 0x78d9ef,
  fieldMouse: 0x9bd66f,
  beeHive: 0xf0cc62,
  chickenPatrol: 0xe69a5b,
  earthwormCrew: 0xc68c68,
  ancientRoots: 0x66c69d,
  sheepLoop: 0xd7d9c8,
  meadowRabbit: 0xd99fc4,
};

const RANK_META: Record<PermanentRankKind, { label: string; description: string; iconKey: string; iconPath: string }> = {
  throughput: {
    label: "Throughput",
    description: "Ten ranks accelerate this helper's production recipes.",
    iconKey: "memory-icon-throughput",
    iconPath: "/assets/ui/skills/steady-tempo.png",
  },
  storage: {
    label: "Storage",
    description: "Ten ranks expand the buffers used by this part of the ecosystem.",
    iconKey: "memory-icon-storage",
    iconPath: "/assets/ui/items/rain-barrel.png",
  },
  efficiency: {
    label: "Efficiency",
    description: "Ten ranks reduce the resources consumed by this helper's recipes.",
    iconKey: "memory-icon-efficiency",
    iconPath: "/assets/ui/skills/honest-work.png",
  },
  startingStock: {
    label: "Starting Stock",
    description: "Five ranks carry useful stock into every new field.",
    iconKey: "memory-icon-starting-stock",
    iconPath: "/assets/ui/items/seed-satchel.png",
  },
};

function helperUnlockId(helperId: HelperId): string {
  return `helper:${helperId}:unlock`;
}

function helperRankId(helperId: HelperId, kind: PermanentRankKind): string {
  return `helper:${helperId}:${kind}`;
}

function helperModeId(helperId: HelperId): string {
  return `helper:${helperId}:mode`;
}

function buildNodes(): EcosystemMemoryNodeDefinition[] {
  const nodes: EcosystemMemoryNodeDefinition[] = [
    {
      id: ROOT_ID,
      kind: "root",
      label: "Field Heir",
      branch: "Origin",
      description: "The first remembered touch. Every permanent branch grows from here.",
      color: 0xffe889,
      iconKey: "eco-player",
      x: -1580,
      y: 0,
      prerequisites: [],
    },
    {
      id: "touch:broadPalm",
      kind: "touchRank",
      label: "Broad Palm",
      branch: "Touch",
      description: "Ten ranks widen manual touches and raise their area effectiveness.",
      color: 0x8de7ff,
      iconKey: "memory-icon-broad-palm",
      iconPath: "/assets/ui/skills/palm-press.png",
      x: -1480,
      y: -250,
      prerequisites: [ROOT_ID],
      touchKind: "broadPalm",
    },
    {
      id: "touch:manyHands",
      kind: "touchRank",
      label: "Many Hands",
      branch: "Touch",
      description: "Ten ranks send every touch toward additional distant tiles.",
      color: 0x8de7ff,
      iconKey: "memory-icon-many-hands",
      iconPath: "/assets/ui/skills/two-handed-technique.png",
      x: -1480,
      y: -470,
      prerequisites: ["touch:broadPalm"],
      touchKind: "manyHands",
    },
    {
      id: "touch:fieldEmbrace",
      kind: "capstone",
      label: "Field Embrace",
      branch: "Touch capstone",
      description: "Every tenth manual touch reaches one tile in every 10x10 field chunk.",
      color: 0xf1a6ce,
      iconKey: "memory-icon-field-embrace",
      iconPath: "/assets/ui/skills/ecosystem-loop.png",
      x: -1480,
      y: -680,
      prerequisites: ["touch:manyHands"],
    },
    {
      id: "field:tier",
      kind: "fieldTier",
      label: "Expanding Field",
      branch: "Cultivation",
      description: "Ten remembered thresholds let Cultivation expand the field toward 100x100.",
      color: 0x9bd66f,
      iconKey: "memory-icon-field-tier",
      iconPath: "/assets/ui/skills/root-network.png",
      x: -1480,
      y: 420,
      prerequisites: [ROOT_ID],
    },
  ];

  for (let index = 0; index < HELPER_IDS.length; index += 1) {
    const helperId = HELPER_IDS[index];
    const helper = HELPERS[helperId];
    const x = HELPER_START_X + index * HELPER_STEP_X;
    const prerequisite = index === 0 ? ROOT_ID : helperUnlockId(HELPER_IDS[index - 1]);
    nodes.push({
      id: helperUnlockId(helperId),
      kind: "helperUnlock",
      label: helper.label,
      branch: "Production chain",
      description: `Awakens ${helper.label}, reveals it in the Living Ledger, and adds its recipes to Ecosystem Works.`,
      color: HELPER_COLORS[helperId],
      iconKey: `eco-helper-${helperId}`,
      x,
      y: 0,
      prerequisites: [prerequisite],
      helperId,
    });

    const rankPositions: Record<PermanentRankKind, { x: number; y: number }> = {
      throughput: { x: x - 112, y: -185 },
      efficiency: { x: x + 112, y: -185 },
      storage: { x: x - 112, y: 190 },
      startingStock: { x: x + 112, y: 190 },
    };
    for (const kind of ["throughput", "efficiency", "storage", "startingStock"] as const) {
      const meta = RANK_META[kind];
      nodes.push({
        id: helperRankId(helperId, kind),
        kind: "helperRank",
        label: meta.label,
        branch: helper.label,
        description: meta.description,
        color: HELPER_COLORS[helperId],
        iconKey: meta.iconKey,
        iconPath: meta.iconPath,
        x: rankPositions[kind].x,
        y: rankPositions[kind].y,
        prerequisites: [helperUnlockId(helperId)],
        helperId,
        rankKind: kind,
      });
    }

    const alternateMode = helper.modes[1];
    nodes.push({
      id: helperModeId(helperId),
      kind: "helperMode",
      label: alternateMode.label,
      branch: `${helper.label} mode`,
      description: alternateMode.description,
      color: HELPER_COLORS[helperId],
      iconKey: "memory-icon-helper-mode",
      iconPath: "/assets/ui/skills/helper-routes.png",
      x,
      y: -360,
      prerequisites: [helperUnlockId(helperId)],
      helperId,
    });
  }
  return nodes;
}

export const ECOSYSTEM_MEMORY_NODES = buildNodes();
export const ECOSYSTEM_MEMORY_EDGES: readonly EcosystemMemoryEdge[] = ECOSYSTEM_MEMORY_NODES.flatMap((node) =>
  node.prerequisites.map((from) => ({ from, to: node.id })),
);
export const ECOSYSTEM_MEMORY_NODE_BY_ID = new Map(ECOSYSTEM_MEMORY_NODES.map((node) => [node.id, node]));

export const ECOSYSTEM_MEMORY_ICON_ASSETS = [...new Map(
  ECOSYSTEM_MEMORY_NODES
    .filter((node) => node.iconPath)
    .map((node) => [node.iconKey, node.iconPath!]),
).entries()].map(([key, path]) => ({ key, path }));

export function getHelperUnlockMemoryId(helperId: HelperId): string {
  return helperUnlockId(helperId);
}

export function getHelperRankMemoryId(helperId: HelperId, kind: PermanentRankKind): string {
  return helperRankId(helperId, kind);
}

export function getHelperModeMemoryId(helperId: HelperId): string {
  return helperModeId(helperId);
}
