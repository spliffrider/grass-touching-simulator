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

export const MEMORY_TREE_WORLD_WIDTH = 1600;
export const MEMORY_TREE_WORLD_HEIGHT = 1100;
export const MEMORY_TREE_NODE_SIZE = 64;

export const MEMORY_UPGRADE_IDS = [
  "softTouch",
  "fastTouch",
  "deeperRoots",
  "ancientResilience",
  "tinySprinkler",
  "fieldMouse",
  "beeHive",
  "earthworm",
  "chicken",
  "sheep",
  "meadowRabbit",
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
    y: 0.45,
    impact: "future runs build stronger manual root healing",
    flavor: "Your hands learn where the roots are tender. Each remembered rank makes future manual touches substantially stronger.",
    shortEffect: "Ranked manual healing",
  },
  fastTouch: {
    branch: "Touch",
    color: 0xa8df68,
    iconKey: "memory-icon-fast-touch",
    iconPath: "/assets/ui/skills/faster-regrowth.png",
    x: 0.25,
    y: 0.45,
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
    y: 0.24,
    impact: "future runs gain +25 max Ancient HP",
    flavor: "The Ancient Grass remembers how to hold on. Future runs start with a deeper HP pool.",
    shortEffect: "Max HP +25",
  },
  ancientResilience: {
    branch: "Vitality",
    color: 0x8fdfff,
    iconKey: "memory-icon-ancient-resilience",
    iconPath: "/assets/ui/skills/perennial-patches.png",
    x: 0.18,
    y: 0.08,
    impact: "future runs suffer 12% less base Scourge drain",
    flavor: "Old growth learns to bend without breaking. The Scourge must work harder for every point of HP.",
    shortEffect: "Base drain -12%",
  },
  tinySprinkler: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-tiny-sprinkler",
    iconPath: "/assets/ui/skills/sprinkler-calibration.png",
    x: 0.45,
    y: 0.65,
    impact: "future runs can buy sprinkler automation",
    flavor: "A little brass helper joins the kit. Future runs can spend RT on sprinkler automation.",
    shortEffect: "Run sprinkler",
  },
  fieldMouse: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-field-mouse",
    iconPath: "/assets/ui/skills/helper-routes.png",
    x: 0.4,
    y: 0.79,
    impact: "future runs can buy Field Mouse helpers",
    flavor: "The smallest paths become permanent knowledge. Future runs can hire quick Field Mice to carry dew between roots.",
    shortEffect: "Unlock Field Mouse",
  },
  beeHive: {
    branch: "Automation",
    color: 0xffdf78,
    iconKey: "memory-icon-bee-hive",
    iconPath: "/assets/ui/skills/clover-magnet.png",
    x: 0.18,
    y: 0.95,
    impact: "future runs can buy Bee Hive shifts",
    flavor: "The field remembers the hum of useful wings. Future runs can enlist Bee Hives for stronger restorative pulses.",
    shortEffect: "Unlock Bee Hive",
  },
  earthworm: {
    branch: "Automation",
    color: 0xb7e987,
    iconKey: "memory-icon-earthworm",
    iconPath: "/assets/ui/skills/fertile-soil.png",
    x: 0.34,
    y: 0.95,
    impact: "future runs can buy Earthworm crews",
    flavor: "Deep soil keeps its own memory. Future runs can wake Earthworm crews for heavy underground recovery.",
    shortEffect: "Unlock Earthworm",
  },
  chicken: {
    branch: "Automation",
    color: 0xffc98c,
    iconKey: "memory-icon-chicken",
    iconPath: "/assets/ui/skills/satisfying-crunch.png",
    x: 0.5,
    y: 0.95,
    impact: "future runs can buy Chicken patrols",
    flavor: "A useful patrol route settles into instinct. Future runs can recruit Chickens to keep loose dew moving.",
    shortEffect: "Unlock Chicken",
  },
  sheep: {
    branch: "Automation",
    color: 0xf1f7d0,
    iconKey: "memory-icon-sheep",
    iconPath: "/assets/ui/skills/grazing-logistics.png",
    x: 0.66,
    y: 0.95,
    impact: "future runs can buy Sheep grazing loops",
    flavor: "The broadest grazing paths become second nature. Future runs can gather slow, powerful reserves with Sheep.",
    shortEffect: "Unlock Sheep",
  },
  meadowRabbit: {
    branch: "Automation",
    color: 0xffd6ec,
    iconKey: "memory-icon-meadow-rabbit",
    iconPath: "/assets/ui/skills/premium-pasture.png",
    x: 0.82,
    y: 0.95,
    impact: "future runs can buy Meadow Rabbit circuits",
    flavor: "The final meadow circuit is remembered in full. Future runs can call on Rabbits for rapid late-tier restoration.",
    shortEffect: "Unlock Rabbit",
  },
  sprinklerTuning: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-sprinkler-tuning",
    iconPath: "/assets/ui/skills/morning-mist.png",
    x: 0.25,
    y: 0.68,
    impact: "each future sprinkler heals 1 additional HP",
    flavor: "The nozzles remember a finer mist. Every purchased sprinkler restores one more HP per pulse.",
    shortEffect: "Sprinkler +1 HP",
  },
  fieldSatchel: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-field-satchel",
    iconPath: "/assets/ui/items/seed-satchel.png",
    x: 0.65,
    y: 0.68,
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
    y: 0.24,
    impact: "future runs forecast the next wound target",
    flavor: "The pink pressure gets easier to read. Future runs warn which root the Scourge wants next.",
    shortEffect: "Wound forecast",
  },
  distributedRoots: {
    branch: "Scourge",
    color: 0xffb3cf,
    iconKey: "memory-icon-distributed-roots",
    iconPath: "/assets/ui/skills/ecosystem-loop.png",
    x: 0.82,
    y: 0.08,
    impact: "open wounds add 25% less pressure in future runs",
    flavor: "No root carries the whole injury alone. The network spreads wound pressure before it reaches the Ancient heart.",
    shortEffect: "Wound pressure -25%",
  },
  lastStand: {
    branch: "Resolve",
    color: 0xffef78,
    iconKey: "memory-icon-last-stand",
    iconPath: "/assets/ui/skills/honest-work.png",
    x: 0.72,
    y: 0.48,
    impact: "future runs revive once at HP zero",
    flavor: "One stubborn breath remains in the field. Future runs revive once when HP hits zero.",
    shortEffect: "Revive once/run",
  },
  emergencyPhotosynthesis: {
    branch: "Resolve",
    color: 0xffef78,
    iconKey: "memory-icon-emergency-photosynthesis",
    iconPath: "/assets/ui/skills/warm-sunlight.png",
    x: 0.88,
    y: 0.62,
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
