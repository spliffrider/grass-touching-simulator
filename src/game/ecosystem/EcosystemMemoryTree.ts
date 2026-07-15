import { HELPER_IDS, HELPERS, type HelperId } from "./EcosystemCatalog";
import type { PermanentRankKind, PermanentTouchRankKind } from "./EcosystemSystem";

const MEMORY_LAYOUT_SCALE = 1.3;

export const ECOSYSTEM_MEMORY_WORLD_WIDTH = 3700 * MEMORY_LAYOUT_SCALE;
export const ECOSYSTEM_MEMORY_WORLD_HEIGHT = 1800 * MEMORY_LAYOUT_SCALE;
export const ECOSYSTEM_MEMORY_NODE_GLOW_RADIUS = 56;
export const ECOSYSTEM_MEMORY_CONNECTOR_GAP = 10;

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
  visualScale?: number;
  prerequisites: readonly string[];
  helperId?: HelperId;
  rankKind?: PermanentRankKind;
  touchKind?: PermanentTouchRankKind;
}

export interface EcosystemMemoryEdge {
  from: string;
  to: string;
}

const ROOT_ID = "root:field-heir";
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

interface HelperMemoryLayout {
  x: number;
  y: number;
  scale: number;
  mode: { x: number; y: number };
  ranks: Record<PermanentRankKind, { x: number; y: number }>;
}

function scalePosition(value: number): number {
  return value * MEMORY_LAYOUT_SCALE;
}

export function getEcosystemMemoryNodeVisualRadius(node: EcosystemMemoryNodeDefinition): number {
  return ECOSYSTEM_MEMORY_NODE_GLOW_RADIUS * (node.visualScale ?? 1);
}

const HELPER_LAYOUTS: Record<HelperId, HelperMemoryLayout> = {
  tinySprinkler: {
    x: -1120,
    y: 0,
    scale: 1.12,
    mode: { x: 10, y: -390 },
    ranks: {
      throughput: { x: -90, y: -160 },
      efficiency: { x: 120, y: -220 },
      storage: { x: -120, y: 160 },
      startingStock: { x: 60, y: 220 },
    },
  },
  fieldMouse: {
    x: -770,
    y: -170,
    scale: 0.98,
    mode: { x: 210, y: 190 },
    ranks: {
      throughput: { x: -140, y: -150 },
      efficiency: { x: 100, y: -210 },
      storage: { x: -120, y: 190 },
      startingStock: { x: 10, y: 240 },
    },
  },
  beeHive: {
    x: -390,
    y: -320,
    scale: 1.04,
    mode: { x: 290, y: -160 },
    ranks: {
      throughput: { x: -140, y: -180 },
      efficiency: { x: 130, y: -230 },
      storage: { x: 40, y: 200 },
      startingStock: { x: -80, y: 300 },
    },
  },
  chickenPatrol: {
    x: 30,
    y: -140,
    scale: 0.96,
    mode: { x: 250, y: -120 },
    ranks: {
      throughput: { x: -150, y: -160 },
      efficiency: { x: 140, y: -220 },
      storage: { x: -220, y: 150 },
      startingStock: { x: 50, y: 260 },
    },
  },
  earthwormCrew: {
    x: 430,
    y: 100,
    scale: 1.04,
    mode: { x: 250, y: -120 },
    ranks: {
      throughput: { x: 40, y: -240 },
      efficiency: { x: 140, y: -210 },
      storage: { x: -220, y: 130 },
      startingStock: { x: -20, y: 260 },
    },
  },
  ancientRoots: {
    x: 800,
    y: 300,
    scale: 1.16,
    mode: { x: 250, y: 60 },
    ranks: {
      throughput: { x: -150, y: -180 },
      efficiency: { x: 130, y: -220 },
      storage: { x: -210, y: 90 },
      startingStock: { x: -40, y: 260 },
    },
  },
  sheepLoop: {
    x: 1150,
    y: 130,
    scale: 1,
    mode: { x: 360, y: 260 },
    ranks: {
      throughput: { x: -150, y: -160 },
      efficiency: { x: 120, y: -230 },
      storage: { x: -20, y: 360 },
      startingStock: { x: 170, y: 240 },
    },
  },
  meadowRabbit: {
    x: 1480,
    y: -100,
    scale: 0.98,
    mode: { x: 260, y: 30 },
    ranks: {
      throughput: { x: -140, y: -170 },
      efficiency: { x: 130, y: -240 },
      storage: { x: 180, y: 180 },
      startingStock: { x: -10, y: 270 },
    },
  },
};

const RANK_VISUAL_SCALES: Record<PermanentRankKind, number> = {
  throughput: 0.76,
  efficiency: 0.72,
  storage: 0.8,
  startingStock: 0.7,
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
      x: scalePosition(-1470),
      y: scalePosition(40),
      visualScale: 1.2,
      prerequisites: [],
    },
    {
      id: "touch:fastTouch",
      kind: "touchRank",
      label: "Fast Touch",
      branch: "Touch",
      description: "Ten ranks shorten each tile's visible recovery without removing its deliberate rhythm.",
      color: 0xf0cc62,
      iconKey: "memory-icon-fast-touch",
      iconPath: "/assets/ui/skills/mindful-contact.png",
      x: scalePosition(-1670),
      y: scalePosition(-170),
      visualScale: 0.92,
      prerequisites: [ROOT_ID],
      touchKind: "fastTouch",
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
      x: scalePosition(-1450),
      y: scalePosition(-260),
      visualScale: 0.96,
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
      x: scalePosition(-1340),
      y: scalePosition(-470),
      visualScale: 0.94,
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
      x: scalePosition(-1430),
      y: scalePosition(-700),
      visualScale: 1.1,
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
      x: scalePosition(-1600),
      y: scalePosition(420),
      visualScale: 1.04,
      prerequisites: [ROOT_ID],
    },
  ];

  for (let index = 0; index < HELPER_IDS.length; index += 1) {
    const helperId = HELPER_IDS[index];
    const helper = HELPERS[helperId];
    const layout = HELPER_LAYOUTS[helperId];
    const x = scalePosition(layout.x);
    const y = scalePosition(layout.y);
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
      y,
      visualScale: layout.scale,
      prerequisites: [prerequisite],
      helperId,
    });

    for (const kind of ["throughput", "efficiency", "storage", "startingStock"] as const) {
      const meta = RANK_META[kind];
      const offset = layout.ranks[kind];
      nodes.push({
        id: helperRankId(helperId, kind),
        kind: "helperRank",
        label: meta.label,
        branch: helper.label,
        description: meta.description,
        color: HELPER_COLORS[helperId],
        iconKey: meta.iconKey,
        iconPath: meta.iconPath,
        x: x + scalePosition(offset.x),
        y: y + scalePosition(offset.y),
        visualScale: RANK_VISUAL_SCALES[kind],
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
      x: x + scalePosition(layout.mode.x),
      y: y + scalePosition(layout.mode.y),
      visualScale: 0.86,
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
