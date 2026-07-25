import { HELPER_IDS, HELPERS, type HelperId } from "./EcosystemCatalog";
import type {
  PermanentEcosystemState,
  PermanentRankKind,
  PermanentTouchRankKind,
} from "./EcosystemSystem";

const MEMORY_LAYOUT_SCALE = 1.3;

export const ECOSYSTEM_MEMORY_WORLD_WIDTH = 3700 * MEMORY_LAYOUT_SCALE;
export const ECOSYSTEM_MEMORY_WORLD_HEIGHT = 1800 * MEMORY_LAYOUT_SCALE;
const ECOSYSTEM_MEMORY_NODE_GLOW_RADIUS = 56;
export const ECOSYSTEM_MEMORY_CONNECTOR_GAP = 10;
export const ECOSYSTEM_MEMORY_MIN_TITLE_SCREEN_PX = 13;
export const ECOSYSTEM_MEMORY_MIN_STATUS_SCREEN_PX = 11;

type EcosystemMemoryNodeKind =
  | "root"
  | "helperUnlock"
  | "helperRank"
  | "helperMode"
  | "fieldHealth"
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
  discoveryPrerequisites?: readonly string[];
  helperId?: HelperId;
  rankKind?: PermanentRankKind;
  touchKind?: PermanentTouchRankKind;
}

export interface EcosystemMemoryEdge {
  from: string;
  to: string;
}

export const ECOSYSTEM_MEMORY_ROOT_ID = "root:field-heir";
export const FIRST_ECOSYSTEM_MEMORY_NODE_ID = "helper:tinySprinkler:unlock";
export type HelperMemoryCategory = PermanentRankKind | "unlock" | "mode";

export interface HelperMemoryCategoryStyle {
  id: HelperMemoryCategory;
  label: string;
  detailLabel: string;
  color: number;
}

export const HELPER_MEMORY_CATEGORY_ORDER: readonly HelperMemoryCategory[] = [
  "unlock",
  "throughput",
  "efficiency",
  "storage",
  "startingStock",
  "mode",
] as const;

export const HELPER_MEMORY_CATEGORY_STYLES: Record<HelperMemoryCategory, HelperMemoryCategoryStyle> = {
  unlock: { id: "unlock", label: "UNLOCK", detailLabel: "New helper", color: 0x72e69a },
  throughput: { id: "throughput", label: "SPEED", detailLabel: "Automation speed", color: 0x78d9ef },
  efficiency: { id: "efficiency", label: "CARE", detailLabel: "Healing per touch", color: 0x83d765 },
  storage: { id: "storage", label: "REACH", detailLabel: "Touches per activation", color: 0x78c9f2 },
  startingStock: { id: "startingStock", label: "MOMENTUM", detailLabel: "Opening charge", color: 0xf0cc62 },
  mode: { id: "mode", label: "MODE", detailLabel: "Helper mode", color: 0xd99fc4 },
};

const TINY_SPRINKLER_MEMORY_CATEGORY_STYLES: Partial<Record<PermanentRankKind, HelperMemoryCategoryStyle>> = {
  storage: { id: "storage", label: "AFTERGLOW", detailLabel: "Sprinkler healing", color: 0x8de7c5 },
  efficiency: { id: "efficiency", label: "SPLASH", detailLabel: "Area touches", color: 0x8de7ff },
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

export function getEcosystemMemoryTextScale(
  worldScale: number,
  baseFontSize: number,
  minimumScreenSize: number,
): number {
  if (worldScale <= 0 || baseFontSize <= 0 || minimumScreenSize <= 0) return 1;
  return Math.max(1, minimumScreenSize / (worldScale * baseFontSize));
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

const RANK_VISUAL_META: Record<PermanentRankKind, { iconKey: string; iconPath: string }> = {
  throughput: {
    iconKey: "memory-icon-throughput",
    iconPath: "/assets/ui/skills/steady-tempo.png",
  },
  storage: {
    iconKey: "memory-icon-storage",
    iconPath: "/assets/ui/skills/helper-routes.png",
  },
  efficiency: {
    iconKey: "memory-icon-efficiency",
    iconPath: "/assets/ui/skills/honest-work.png",
  },
  startingStock: {
    iconKey: "memory-icon-starting-stock",
    iconPath: "/assets/ui/skills/warm-sunlight.png",
  },
};

interface HelperRankCopy {
  label: string;
  description: string;
}

const HELPER_RANK_COPY: Record<HelperId, Record<PermanentRankKind, HelperRankCopy>> = {
  tinySprinkler: {
    throughput: {
      label: "Clockwork Nozzle",
      description: "Shortens the pause between Tiny Sprinkler sprays, producing automated touches more often.",
    },
    storage: {
      label: "Dew Cistern",
      description: "Each Tiny Sprinkler hit builds a short healing afterglow. Higher ranks strengthen and stack the effect.",
    },
    efficiency: {
      label: "Fine Mist",
      description: "Gives each Tiny Sprinkler hit a chance to touch every tile surrounding its target.",
    },
    startingStock: {
      label: "Primed Spring",
      description: "The first Tiny Sprinkler bought each run begins its opening spray 20% charged per rank.",
    },
  },
  fieldMouse: {
    throughput: {
      label: "Quick Paws",
      description: "Shortens the pause between Field Mouse scampering trips.",
    },
    storage: {
      label: "Scamper Routes",
      description: "Adds more exits to the route, increasing automatic touches per trip by 15% per rank.",
    },
    efficiency: {
      label: "Careful Nibbles",
      description: "Makes every Field Mouse touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "First Scamper",
      description: "The first Field Mouse bought each run begins its opening trip 20% charged per rank.",
    },
  },
  beeHive: {
    throughput: {
      label: "Wingbeat Rhythm",
      description: "Shortens the pause between Bee Hive pollination flights.",
    },
    storage: {
      label: "Wider Swarm",
      description: "Supports a broader swarm, increasing automatic touches per flight by 15% per rank.",
    },
    efficiency: {
      label: "Pollen Savvy",
      description: "Makes every Bee Hive touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "Ready Wings",
      description: "The first Bee Hive bought each run begins its opening flight 20% charged per rank.",
    },
  },
  chickenPatrol: {
    throughput: {
      label: "Busy Beaks",
      description: "Shortens the pause between Chicken Patrol scratches and forage runs.",
    },
    storage: {
      label: "Scratch Pattern",
      description: "Gives the patrol more ground to scratch, increasing automatic touches per cycle by 15% per rank.",
    },
    efficiency: {
      label: "Clean Scratch",
      description: "Makes every Chicken Patrol touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "Dawn Patrol",
      description: "The first Chicken Patrol bought each run begins its opening patrol 20% charged per rank.",
    },
  },
  earthwormCrew: {
    throughput: {
      label: "Restless Soil",
      description: "Shortens the pause between Earthworm Crew aeration cycles.",
    },
    storage: {
      label: "Branching Burrows",
      description: "Branches through more soil, increasing automatic touches per aeration by 15% per rank.",
    },
    efficiency: {
      label: "Rich Castings",
      description: "Makes every Earthworm Crew touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "Warm Soil",
      description: "The first Earthworm Crew bought each run begins its opening burrow 20% charged per rank.",
    },
  },
  ancientRoots: {
    throughput: {
      label: "Rootbeat",
      description: "Shortens the pause between Ancient Root pulses.",
    },
    storage: {
      label: "Root Network",
      description: "Extends the old network, increasing automatic touches per root pulse by 15% per rank.",
    },
    efficiency: {
      label: "Patient Absorption",
      description: "Makes every Ancient Roots touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "First Pulse",
      description: "The first Ancient Roots bought each run begins its opening pulse 20% charged per rank.",
    },
  },
  sheepLoop: {
    throughput: {
      label: "Grazing Rhythm",
      description: "Shortens the pause between Sheep Loop grazing cycles.",
    },
    storage: {
      label: "Wider Circuit",
      description: "Widens the grazing loop, increasing automatic touches per circuit by 15% per rank.",
    },
    efficiency: {
      label: "Gentle Bite",
      description: "Makes every Sheep Loop touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "Early Graze",
      description: "The first Sheep Loop bought each run begins its opening circuit 20% charged per rank.",
    },
  },
  meadowRabbit: {
    throughput: {
      label: "Fleetfoot Circuit",
      description: "Shortens the pause between Meadow Rabbit sprints.",
    },
    storage: {
      label: "Burrow Network",
      description: "Adds shortcuts to the circuit, increasing automatic touches per run by 15% per rank.",
    },
    efficiency: {
      label: "Light Landing",
      description: "Makes every Meadow Rabbit touch restore 12% more Ancient HP per rank.",
    },
    startingStock: {
      label: "Spring Step",
      description: "The first Meadow Rabbit bought each run begins its opening sprint 20% charged per rank.",
    },
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
      id: ECOSYSTEM_MEMORY_ROOT_ID,
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
      description: "Shortens each tile's visible recovery without removing its deliberate rhythm. Upgrade through ten ranks.",
      color: 0xf0cc62,
      iconKey: "memory-icon-fast-touch",
      iconPath: "/assets/ui/skills/mindful-contact.png",
      x: scalePosition(-1670),
      y: scalePosition(-170),
      visualScale: 0.92,
      prerequisites: [ECOSYSTEM_MEMORY_ROOT_ID],
      touchKind: "fastTouch",
    },
    {
      id: "field:heartwood",
      kind: "fieldHealth",
      label: "Ancient Heartwood",
      branch: "Field vitality",
      description: "Raises the Ancient Grass's maximum health by 25 with every remembered rank. Upgrade through ten ranks.",
      color: 0xe69a5b,
      iconKey: "memory-icon-heartwood",
      iconPath: "/assets/ui/skills/perennial-patches.png",
      x: scalePosition(-1660),
      y: scalePosition(110),
      visualScale: 0.98,
      prerequisites: [ECOSYSTEM_MEMORY_ROOT_ID],
    },
    {
      id: "touch:lingeringCare",
      kind: "touchRank",
      label: "Green Afterglow",
      branch: "Touch restoration",
      description: "Manual touches leave a healing afterglow that restores Ancient HP for four seconds. Upgrade through ten ranks.",
      color: 0xb9ff9c,
      iconKey: "memory-icon-lingering-care",
      iconPath: "/assets/ui/skills/warm-sunlight.png",
      x: scalePosition(-1750),
      y: scalePosition(350),
      visualScale: 0.94,
      prerequisites: ["field:heartwood"],
      touchKind: "lingeringCare",
    },
    {
      id: "touch:verdantAegis",
      kind: "touchRank",
      label: "Verdant Aegis",
      branch: "Touch protection",
      description: "Converts healing beyond full Ancient HP into a brief shield against the Scourge. Upgrade through ten ranks.",
      color: 0x79f4d5,
      iconKey: "memory-icon-verdant-aegis",
      iconPath: "/assets/ui/skills/dew-respecter.png",
      x: scalePosition(-1780),
      y: scalePosition(650),
      visualScale: 0.98,
      prerequisites: ["touch:lingeringCare"],
      touchKind: "verdantAegis",
    },
    {
      id: "touch:broadPalm",
      kind: "touchRank",
      label: "Broad Palm",
      branch: "Touch",
      description: "Widens manual touches and raises their area effectiveness. Upgrade through ten ranks.",
      color: 0x8de7ff,
      iconKey: "memory-icon-broad-palm",
      iconPath: "/assets/ui/skills/palm-press.png",
      x: scalePosition(-1450),
      y: scalePosition(-260),
      visualScale: 0.96,
      prerequisites: [ECOSYSTEM_MEMORY_ROOT_ID],
      touchKind: "broadPalm",
    },
    {
      id: "touch:manyHands",
      kind: "touchRank",
      label: "Many Hands",
      branch: "Touch",
      description: "Sends every touch toward additional distant tiles. Upgrade through ten ranks.",
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
      branch: "Field expansion",
      description: "Permits the next field size. Buy the actual expansion during a run with Run Touches.",
      color: 0x9bd66f,
      iconKey: "memory-icon-field-tier",
      iconPath: "/assets/ui/skills/root-network.png",
      x: scalePosition(-1600),
      y: scalePosition(420),
      visualScale: 1.04,
      prerequisites: [ECOSYSTEM_MEMORY_ROOT_ID],
    },
  ];

  for (let index = 0; index < HELPER_IDS.length; index += 1) {
    const helperId = HELPER_IDS[index];
    const helper = HELPERS[helperId];
    const layout = HELPER_LAYOUTS[helperId];
    const x = scalePosition(layout.x);
    const y = scalePosition(layout.y);
    const prerequisite = index === 0 ? ECOSYSTEM_MEMORY_ROOT_ID : helperUnlockId(HELPER_IDS[index - 1]);
    nodes.push({
      id: helperUnlockId(helperId),
      kind: "helperUnlock",
      label: helper.label,
      branch: "Automation chain",
      description: helperId === "fieldMouse"
        ? "Awakens Field Mouse and its automatic scampering. A Tiny Sprinkler links every trip to Damp Furrows for bonus Growth and Care."
        : `Awakens ${helper.label}, reveals it in the Living Ledger, and adds its automatic touches to the field.`,
      color: HELPER_MEMORY_CATEGORY_STYLES.unlock.color,
      iconKey: `eco-helper-${helperId}`,
      x,
      y,
      visualScale: layout.scale,
      prerequisites: [prerequisite],
      helperId,
    });

    for (const kind of ["throughput", "efficiency", "storage", "startingStock"] as const) {
      const visualMeta = RANK_VISUAL_META[kind];
      const copy = HELPER_RANK_COPY[helperId][kind];
      const offset = layout.ranks[kind];
      const discoveryPrerequisite = kind === "throughput"
        ? helperUnlockId(helperId)
        : kind === "startingStock"
          ? helperRankId(helperId, "storage")
          : helperRankId(helperId, "throughput");
      nodes.push({
        id: helperRankId(helperId, kind),
        kind: "helperRank",
        label: copy.label,
        branch: helper.label,
        description: copy.description,
        color: HELPER_MEMORY_CATEGORY_STYLES[kind].color,
        iconKey: visualMeta.iconKey,
        iconPath: visualMeta.iconPath,
        x: x + scalePosition(offset.x),
        y: y + scalePosition(offset.y),
        visualScale: RANK_VISUAL_SCALES[kind],
        prerequisites: [helperUnlockId(helperId)],
        discoveryPrerequisites: [discoveryPrerequisite],
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
      color: HELPER_MEMORY_CATEGORY_STYLES.mode.color,
      iconKey: "memory-icon-helper-mode",
      iconPath: "/assets/ui/skills/helper-routes.png",
      x: x + scalePosition(layout.mode.x),
      y: y + scalePosition(layout.mode.y),
      visualScale: 0.86,
      prerequisites: [helperUnlockId(helperId)],
      discoveryPrerequisites: [helperRankId(helperId, "efficiency")],
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

export function getHelperRankMemoryLabel(helperId: HelperId, kind: PermanentRankKind): string {
  return HELPER_RANK_COPY[helperId][kind].label;
}

export function getHelperModeMemoryId(helperId: HelperId): string {
  return helperModeId(helperId);
}

export function getEcosystemMemoryCategory(
  node: EcosystemMemoryNodeDefinition,
): HelperMemoryCategoryStyle | null {
  if (node.kind === "helperUnlock") return HELPER_MEMORY_CATEGORY_STYLES.unlock;
  if (node.kind === "helperMode") return HELPER_MEMORY_CATEGORY_STYLES.mode;
  if (node.kind === "helperRank" && node.rankKind) {
    if (node.helperId === "tinySprinkler") {
      const specialized = TINY_SPRINKLER_MEMORY_CATEGORY_STYLES[node.rankKind];
      if (specialized) return specialized;
    }
    return HELPER_MEMORY_CATEGORY_STYLES[node.rankKind];
  }
  return null;
}

export function getRecommendedAutomationMemoryNodeId(
  permanent: PermanentEcosystemState,
): string | null {
  for (const helperId of HELPER_IDS) {
    if (
      permanent.unlockedHelpers[helperId]
      && permanent.throughputRanks[helperId] === 0
    ) {
      return helperRankId(helperId, "throughput");
    }
  }

  for (const helperId of HELPER_IDS) {
    if (permanent.unlockedHelpers[helperId]) continue;
    const prerequisite = HELPERS[helperId].unlockRequires;
    if (!prerequisite || permanent.unlockedHelpers[prerequisite]) {
      return helperUnlockId(helperId);
    }
  }

  for (const helperId of HELPER_IDS) {
    if (
      permanent.unlockedHelpers[helperId]
      && permanent.throughputRanks[helperId] < 3
    ) {
      return helperRankId(helperId, "throughput");
    }
  }

  for (const helperId of HELPER_IDS) {
    if (
      permanent.unlockedHelpers[helperId]
      && permanent.efficiencyRanks[helperId] < 2
    ) {
      return helperRankId(helperId, "efficiency");
    }
  }

  return null;
}

function isMemoryNodeOwned(
  node: EcosystemMemoryNodeDefinition,
  permanent: PermanentEcosystemState,
): boolean {
  if (node.kind === "root") return true;
  if (node.kind === "helperUnlock") return permanent.unlockedHelpers[node.helperId!];
  if (node.kind === "helperMode") {
    const alternateMode = HELPERS[node.helperId!].modes[1];
    return permanent.unlockedModes[node.helperId!].includes(alternateMode.id);
  }
  if (node.kind === "helperRank") {
    const helperId = node.helperId!;
    if (node.rankKind === "throughput") return permanent.throughputRanks[helperId] > 0;
    if (node.rankKind === "storage") return permanent.storageRanks[helperId] > 0;
    if (node.rankKind === "efficiency") return permanent.efficiencyRanks[helperId] > 0;
    return permanent.startingStockRanks[helperId] > 0;
  }
  if (node.kind === "fieldTier") return permanent.maxFieldTier > 0;
  if (node.kind === "fieldHealth") return permanent.heartwoodRank > 0;
  if (node.kind === "touchRank") {
    if (node.touchKind === "fastTouch") return permanent.fastTouchRank > 0;
    if (node.touchKind === "broadPalm") return permanent.broadPalmRank > 0;
    if (node.touchKind === "manyHands") return permanent.manyHandsRank > 0;
    if (node.touchKind === "lingeringCare") return permanent.lingeringCareRank > 0;
    return permanent.verdantAegisRank > 0;
  }
  return permanent.fieldEmbrace;
}

function isEcosystemMemoryNodeRevealed(
  node: EcosystemMemoryNodeDefinition,
  permanent: PermanentEcosystemState,
  firstMemoryFocus = false,
): boolean {
  if (firstMemoryFocus && !permanent.unlockedHelpers.tinySprinkler) {
    return node.id === FIRST_ECOSYSTEM_MEMORY_NODE_ID;
  }
  if (isMemoryNodeOwned(node, permanent)) return true;
  if (node.kind === "capstone") {
    return permanent.broadPalmRank >= 10 && permanent.manyHandsRank >= 10;
  }
  const discoveryPrerequisites = node.discoveryPrerequisites ?? node.prerequisites;
  return discoveryPrerequisites.some((prerequisiteId) => {
    const prerequisite = ECOSYSTEM_MEMORY_NODE_BY_ID.get(prerequisiteId);
    return prerequisite ? isMemoryNodeOwned(prerequisite, permanent) : false;
  });
}

export function getRevealedEcosystemMemoryNodeIds(
  permanent: PermanentEcosystemState,
  firstMemoryFocus = false,
): Set<string> {
  return new Set(
    ECOSYSTEM_MEMORY_NODES
      .filter((node) => isEcosystemMemoryNodeRevealed(node, permanent, firstMemoryFocus))
      .map((node) => node.id),
  );
}

export function getEcosystemMemoryEntryNodeId(
  permanent: PermanentEcosystemState,
  firstMemoryFocus = false,
): string {
  if (firstMemoryFocus && !permanent.unlockedHelpers.tinySprinkler) {
    return FIRST_ECOSYSTEM_MEMORY_NODE_ID;
  }
  const lastPurchasedNodeId = permanent.lastPurchasedMemoryNodeId;
  if (
    lastPurchasedNodeId
    && ECOSYSTEM_MEMORY_NODE_BY_ID.has(lastPurchasedNodeId)
    && isEcosystemMemoryNodeRevealed(
      ECOSYSTEM_MEMORY_NODE_BY_ID.get(lastPurchasedNodeId)!,
      permanent,
      false,
    )
  ) {
    return lastPurchasedNodeId;
  }
  return ECOSYSTEM_MEMORY_ROOT_ID;
}
