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

export const MEMORY_TREE_WORLD_WIDTH = 720;
export const MEMORY_TREE_WORLD_HEIGHT = 450;
export const MEMORY_TREE_NODE_SIZE = 76;

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
    x: 0.1,
    y: 0.45,
    impact: "future runs heal roots 25% harder",
    flavor: "Your hands learn where the roots are tender. Future manual touches restore 25% more missing HP.",
    shortEffect: "Manual +25%",
  },
  fastTouch: {
    branch: "Touch",
    color: 0xa8df68,
    iconKey: "memory-icon-fast-touch",
    iconPath: "/assets/ui/skills/faster-regrowth.png",
    x: 0.1,
    y: 0.76,
    impact: "future manual touches recover 20% sooner",
    flavor: "The roots remember your rhythm. A tended tile becomes ready for your hand again sooner.",
    shortEffect: "Recovery -20%",
  },
  deeperRoots: {
    branch: "Vitality",
    color: 0x8fdfff,
    iconKey: "memory-icon-deeper-roots",
    iconPath: "/assets/ui/skills/root-network.png",
    x: 0.31,
    y: 0.22,
    impact: "future runs gain +25 max Ancient HP",
    flavor: "The Ancient Grass remembers how to hold on. Future runs start with a deeper HP pool.",
    shortEffect: "Max HP +25",
  },
  ancientResilience: {
    branch: "Vitality",
    color: 0x8fdfff,
    iconKey: "memory-icon-ancient-resilience",
    iconPath: "/assets/ui/skills/perennial-patches.png",
    x: 0.55,
    y: 0.1,
    impact: "future runs suffer 12% less base Scourge drain",
    flavor: "Old growth learns to bend without breaking. The Scourge must work harder for every point of HP.",
    shortEffect: "Base drain -12%",
  },
  tinySprinkler: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-tiny-sprinkler",
    iconPath: "/assets/ui/skills/sprinkler-calibration.png",
    x: 0.34,
    y: 0.62,
    impact: "future runs can buy sprinkler automation",
    flavor: "A little brass helper joins the kit. Future runs can spend RT on sprinkler automation.",
    shortEffect: "Run sprinkler",
  },
  sprinklerTuning: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-sprinkler-tuning",
    iconPath: "/assets/ui/skills/morning-mist.png",
    x: 0.59,
    y: 0.79,
    impact: "each future sprinkler heals 1 additional HP",
    flavor: "The nozzles remember a finer mist. Every purchased sprinkler restores one more HP per pulse.",
    shortEffect: "Sprinkler +1 HP",
  },
  fieldSatchel: {
    branch: "Automation",
    color: 0xbff4ff,
    iconKey: "memory-icon-field-satchel",
    iconPath: "/assets/ui/items/seed-satchel.png",
    x: 0.36,
    y: 0.91,
    labelOffsetX: -72,
    labelOffsetY: 0,
    impact: "future field equipment costs 10% less Run Touches",
    flavor: "A practical satchel remembers every spare part. Equipment bought during future runs costs 10% less RT.",
    shortEffect: "Equipment -10% RT",
  },
  scourgeSense: {
    branch: "Scourge",
    color: 0xffb3cf,
    iconKey: "memory-icon-scourge-sense",
    iconPath: "/assets/ui/skills/grass-identification.png",
    x: 0.58,
    y: 0.34,
    impact: "future runs forecast the next wound target",
    flavor: "The pink pressure gets easier to read. Future runs warn which root the Scourge wants next.",
    shortEffect: "Wound forecast",
  },
  distributedRoots: {
    branch: "Scourge",
    color: 0xffb3cf,
    iconKey: "memory-icon-distributed-roots",
    iconPath: "/assets/ui/skills/ecosystem-loop.png",
    x: 0.86,
    y: 0.18,
    impact: "open wounds add 25% less pressure in future runs",
    flavor: "No root carries the whole injury alone. The network spreads wound pressure before it reaches the Ancient heart.",
    shortEffect: "Wound pressure -25%",
  },
  lastStand: {
    branch: "Resolve",
    color: 0xffef78,
    iconKey: "memory-icon-last-stand",
    iconPath: "/assets/ui/skills/honest-work.png",
    x: 0.74,
    y: 0.56,
    impact: "future runs revive once at HP zero",
    flavor: "One stubborn breath remains in the field. Future runs revive once when HP hits zero.",
    shortEffect: "Revive once/run",
  },
  emergencyPhotosynthesis: {
    branch: "Resolve",
    color: 0xffef78,
    iconKey: "memory-icon-emergency-photosynthesis",
    iconPath: "/assets/ui/skills/warm-sunlight.png",
    x: 0.89,
    y: 0.78,
    impact: "Last Stand restores 55% HP in future runs",
    flavor: "The field hoards one impossible ray of sunlight. Its last breath returns with enough strength to matter.",
    shortEffect: "Revive at 55% HP",
  },
};
