import type { PermanentUpgradeId } from "./RunSpineSystem";

export interface MemoryUpgradePresentation {
  branch: "Touch" | "Vitality" | "Automation" | "Scourge" | "Resolve";
  color: number;
  iconKey: string;
  iconPath: string;
  x: number;
  y: number;
  labelOffsetX?: number;
  labelOffsetY?: number;
  impact: string;
  flavor: string;
  shortEffect: string;
}

export interface MemoryTreePoint {
  x: number;
  y: number;
}

export const MEMORY_TREE_WORLD_WIDTH = 1040;
export const MEMORY_TREE_WORLD_HEIGHT = 680;
export const MEMORY_TREE_NODE_SIZE = 64;

export const MEMORY_UPGRADE_IDS = [
  "softTouch",
  "fastTouch",
  "deeperRoots",
  "ancientResilience",
  "tinySprinkler",
  "sprinklerTuning",
  "fieldSatchel",
  "scourgeSense",
  "distributedRoots",
  "lastStand",
  "emergencyPhotosynthesis",
] as const satisfies readonly PermanentUpgradeId[];

export const MEMORY_UPGRADE_VIEW: Record<PermanentUpgradeId, MemoryUpgradePresentation> = {
  softTouch: {
    branch: "Touch",
    color: 0xa8df68,
    iconKey: "memory-icon-soft-touch",
    iconPath: "/assets/ui/skills/softer-grass.png",
    x: 0.5,
    y: 0.5,
    impact: "future runs build stronger manual root healing",
    flavor: "Your hands learn where the roots are tender. Each remembered rank makes future manual touches substantially stronger.",
    shortEffect: "Ranked manual healing",
  },
  fastTouch: {
    branch: "Touch",
    color: 0xa8df68,
    iconKey: "memory-icon-fast-touch",
    iconPath: "/assets/ui/skills/faster-regrowth.png",
    x: 0.22,
    y: 0.5,
    impact: "future manual touches recover 20% sooner",
    flavor: "The roots remember your rhythm. A tended tile becomes ready for your hand again sooner.",
    shortEffect: "Recovery -20%",
  },
  deeperRoots: {
    branch: "Vitality",
    color: 0x8fdfff,
    iconKey: "memory-icon-deeper-roots",
    iconPath: "/assets/ui/skills/root-network.png",
    x: 0.38,
    y: 0.3,
    impact: "future runs gain +25 max Ancient HP",
    flavor: "The Ancient Grass remembers how to hold on. Future runs start with a deeper HP pool.",
    shortEffect: "Max HP +25",
  },
  ancientResilience: {
    branch: "Vitality",
    color: 0x8fdfff,
    iconKey: "memory-icon-ancient-resilience",
    iconPath: "/assets/ui/skills/perennial-patches.png",
    x: 0.19,
    y: 0.14,
    impact: "future runs suffer 12% less base Scourge drain",
    flavor: "Old growth learns to bend without breaking. The Scourge must work harder for every point of HP.",
    shortEffect: "Base drain -12%",
  },
  tinySprinkler: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-tiny-sprinkler",
    iconPath: "/assets/ui/skills/sprinkler-calibration.png",
    x: 0.38,
    y: 0.7,
    impact: "future runs can buy sprinkler automation",
    flavor: "A little brass helper joins the kit. Future runs can spend RT on sprinkler automation.",
    shortEffect: "Run sprinkler",
  },
  sprinklerTuning: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-sprinkler-tuning",
    iconPath: "/assets/ui/skills/morning-mist.png",
    x: 0.19,
    y: 0.86,
    impact: "each future sprinkler heals 1 additional HP",
    flavor: "The nozzles remember a finer mist. Every purchased sprinkler restores one more HP per pulse.",
    shortEffect: "Sprinkler +1 HP",
  },
  fieldSatchel: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-field-satchel",
    iconPath: "/assets/ui/items/seed-satchel.png",
    x: 0.5,
    y: 0.88,
    impact: "future field equipment costs 10% less Run Touches",
    flavor: "A practical satchel remembers every spare part. Equipment bought during future runs costs 10% less RT.",
    shortEffect: "Equipment -10% RT",
  },
  scourgeSense: {
    branch: "Scourge",
    color: 0xffb3cf,
    iconKey: "memory-icon-scourge-sense",
    iconPath: "/assets/ui/skills/grass-identification.png",
    x: 0.62,
    y: 0.3,
    impact: "future runs forecast the next wound target",
    flavor: "The pink pressure gets easier to read. Future runs warn which root the Scourge wants next.",
    shortEffect: "Wound forecast",
  },
  distributedRoots: {
    branch: "Scourge",
    color: 0xffb3cf,
    iconKey: "memory-icon-distributed-roots",
    iconPath: "/assets/ui/skills/ecosystem-loop.png",
    x: 0.81,
    y: 0.14,
    impact: "open wounds add 25% less pressure in future runs",
    flavor: "No root carries the whole injury alone. The network spreads wound pressure before it reaches the Ancient heart.",
    shortEffect: "Wound pressure -25%",
  },
  lastStand: {
    branch: "Resolve",
    color: 0xffef78,
    iconKey: "memory-icon-last-stand",
    iconPath: "/assets/ui/skills/honest-work.png",
    x: 0.62,
    y: 0.7,
    impact: "future runs revive once at HP zero",
    flavor: "One stubborn breath remains in the field. Future runs revive once when HP hits zero.",
    shortEffect: "Revive once/run",
  },
  emergencyPhotosynthesis: {
    branch: "Resolve",
    color: 0xffef78,
    iconKey: "memory-icon-emergency-photosynthesis",
    iconPath: "/assets/ui/skills/warm-sunlight.png",
    x: 0.81,
    y: 0.86,
    impact: "Last Stand restores 55% HP in future runs",
    flavor: "The field hoards one impossible ray of sunlight. Its last breath returns with enough strength to matter.",
    shortEffect: "Revive at 55% HP",
  },
};

export function getMemoryTreeNodePoint(upgradeId: PermanentUpgradeId): MemoryTreePoint {
  const view = MEMORY_UPGRADE_VIEW[upgradeId];
  return {
    x: MEMORY_TREE_WORLD_WIDTH * (view.x - 0.5),
    y: MEMORY_TREE_WORLD_HEIGHT * (view.y - 0.5),
  };
}

export function getMemoryTreeConnectorPath(
  sourceId: PermanentUpgradeId,
  targetId: PermanentUpgradeId,
  nodeSize = MEMORY_TREE_NODE_SIZE,
): readonly [MemoryTreePoint, MemoryTreePoint] {
  const source = getMemoryTreeNodePoint(sourceId);
  const target = getMemoryTreeNodePoint(targetId);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const trim = nodeSize * 0.46;
  const unitX = dx / distance;
  const unitY = dy / distance;
  return [
    { x: source.x + unitX * trim, y: source.y + unitY * trim },
    { x: target.x - unitX * trim, y: target.y - unitY * trim },
  ];
}
