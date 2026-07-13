export const PRODUCTION_RESOURCE_IDS = [
  "dew",
  "moisture",
  "growth",
  "flowers",
  "pollinatedBlooms",
  "seeds",
  "clippings",
  "compost",
  "humus",
  "rootEnergy",
  "care",
] as const;

export type ProductionResourceId = (typeof PRODUCTION_RESOURCE_IDS)[number];

export interface ProductionResource {
  id: ProductionResourceId;
  label: string;
  shortLabel: string;
  color: number;
}

export interface ProductionBuffer {
  amount: number;
  capacity: number;
  producedTotal: number;
  consumedTotal: number;
}

export const PRODUCTION_RESOURCES: Record<ProductionResourceId, ProductionResource> = {
  dew: { id: "dew", label: "Dew", shortLabel: "Dew", color: 0x8de7ff },
  moisture: { id: "moisture", label: "Moisture", shortLabel: "Wet", color: 0x4fa8d8 },
  growth: { id: "growth", label: "Growth", shortLabel: "Grow", color: 0x8bd25a },
  flowers: { id: "flowers", label: "Flowers", shortLabel: "Flwr", color: 0xf1a6ce },
  pollinatedBlooms: { id: "pollinatedBlooms", label: "Pollinated Blooms", shortLabel: "Bloom", color: 0xf5cf5b },
  seeds: { id: "seeds", label: "Seeds", shortLabel: "Seed", color: 0xd8b66a },
  clippings: { id: "clippings", label: "Clippings", shortLabel: "Clip", color: 0x75b946 },
  compost: { id: "compost", label: "Compost", shortLabel: "Comp", color: 0x9d7148 },
  humus: { id: "humus", label: "Humus", shortLabel: "Hum", color: 0x694d38 },
  rootEnergy: { id: "rootEnergy", label: "Root Energy", shortLabel: "Root", color: 0xc5e35b },
  care: { id: "care", label: "Care", shortLabel: "Care", color: 0xffe889 },
};

export const HELPER_IDS = [
  "tinySprinkler",
  "fieldMouse",
  "beeHive",
  "chickenPatrol",
  "earthwormCrew",
  "ancientRoots",
  "sheepLoop",
  "meadowRabbit",
] as const;

export type HelperId = (typeof HELPER_IDS)[number];

export interface HelperMode {
  id: string;
  helperId: HelperId;
  label: string;
  description: string;
}

export interface RecipeAmount {
  resourceId: ProductionResourceId;
  amount: number;
}

export interface ProductionRecipe {
  id: string;
  helperId: HelperId | null;
  modeId: string | null;
  label: string;
  inputs: readonly RecipeAmount[];
  outputs: readonly RecipeAmount[];
  cyclesPerSecond: number;
  runTouchesPerCycle?: number;
  natural?: boolean;
}

export interface HelperDefinition {
  id: HelperId;
  label: string;
  assetPath: string;
  baseCost: number;
  costGrowth: number;
  unlockCost: number;
  unlockRequires: HelperId | null;
  modes: readonly HelperMode[];
}

function modes(helperId: HelperId, ...definitions: Array<[string, string, string]>): HelperMode[] {
  return definitions.map(([id, label, description]) => ({ id, helperId, label, description }));
}

export const HELPERS: Record<HelperId, HelperDefinition> = {
  tinySprinkler: {
    id: "tinySprinkler",
    label: "Tiny Sprinkler",
    assetPath: "/assets/world/tiny-sprinkler.png",
    baseCost: 14,
    costGrowth: 1.55,
    unlockCost: 5,
    unlockRequires: null,
    modes: modes(
      "tinySprinkler",
      ["caretaker", "Caretaker", "Makes Moisture and a steady trickle of Care."],
      ["cultivator", "Cultivator", "Favors Moisture and direct Growth over Care."],
    ),
  },
  fieldMouse: {
    id: "fieldMouse",
    label: "Field Mouse",
    assetPath: "/assets/world/field-mouse.png",
    baseCost: 48,
    costGrowth: 1.58,
    unlockCost: 12,
    unlockRequires: "tinySprinkler",
    modes: modes(
      "fieldMouse",
      ["spread", "Spread", "Turns Seeds into Growth and finds a little RT."],
      ["cache", "Cache", "Works more slowly while spending fewer Seeds."],
    ),
  },
  beeHive: {
    id: "beeHive",
    label: "Bee Hive",
    assetPath: "/assets/world/bee-hive.png",
    baseCost: 125,
    costGrowth: 1.61,
    unlockCost: 18,
    unlockRequires: "fieldMouse",
    modes: modes(
      "beeHive",
      ["pollinate", "Pollinate", "Turns Flowers into Pollinated Blooms."],
      ["honeyReserve", "Honey Reserve", "Pollinates more slowly and stores Care."],
    ),
  },
  chickenPatrol: {
    id: "chickenPatrol",
    label: "Chicken Patrol",
    assetPath: "/assets/world/chicken.png",
    baseCost: 320,
    costGrowth: 1.64,
    unlockCost: 24,
    unlockRequires: "beeHive",
    modes: modes(
      "chickenPatrol",
      ["scratch", "Scratch", "Turns Clippings into Compost and uncovers RT."],
      ["forage", "Forage", "Cuts Growth into Clippings before composting."],
    ),
  },
  earthwormCrew: {
    id: "earthwormCrew",
    label: "Earthworm Crew",
    assetPath: "/assets/world/earthworm.png",
    baseCost: 850,
    costGrowth: 1.67,
    unlockCost: 32,
    unlockRequires: "chickenPatrol",
    modes: modes(
      "earthwormCrew",
      ["aerate", "Aerate", "Turns Compost into rich Humus."],
      ["triage", "Triage", "Aerates more slowly while restoring Care."],
    ),
  },
  ancientRoots: {
    id: "ancientRoots",
    label: "Ancient Roots",
    assetPath: "/assets/ui/skills/root-network.png",
    baseCost: 2200,
    costGrowth: 1.7,
    unlockCost: 42,
    unlockRequires: "earthwormCrew",
    modes: modes(
      "ancientRoots",
      ["anchor", "Anchor", "Turns Humus into Root Energy and Care."],
      ["wellspring", "Wellspring", "Spends Root Energy to make Dew and Care."],
    ),
  },
  sheepLoop: {
    id: "sheepLoop",
    label: "Sheep Loop",
    assetPath: "/assets/world/sheep.png",
    baseCost: 6200,
    costGrowth: 1.74,
    unlockCost: 56,
    unlockRequires: "ancientRoots",
    modes: modes(
      "sheepLoop",
      ["graze", "Graze", "Turns Growth into Clippings and Care."],
      ["closeCrop", "Close Crop", "Produces more Clippings but less Care."],
    ),
  },
  meadowRabbit: {
    id: "meadowRabbit",
    label: "Meadow Rabbit",
    assetPath: "/assets/world/meadow-rabbit.png",
    baseCost: 18000,
    costGrowth: 1.78,
    unlockCost: 72,
    unlockRequires: "sheepLoop",
    modes: modes(
      "meadowRabbit",
      ["seedRun", "Seed Run", "Rapidly turns Seeds into Growth."],
      ["bloomRun", "Bloom Run", "Carries Seeds directly into Flowers."],
    ),
  },
};

export const PRODUCTION_RECIPES: readonly ProductionRecipe[] = [
  { id: "natural-dew", helperId: null, modeId: null, label: "Dew settling", inputs: [], outputs: [{ resourceId: "dew", amount: 1 }], cyclesPerSecond: 0.04, natural: true },
  { id: "natural-moisture", helperId: null, modeId: null, label: "Ground soaking", inputs: [{ resourceId: "dew", amount: 1 }], outputs: [{ resourceId: "moisture", amount: 0.72 }], cyclesPerSecond: 0.035, natural: true },
  { id: "natural-growth", helperId: null, modeId: null, label: "Slow sprouting", inputs: [{ resourceId: "moisture", amount: 1 }], outputs: [{ resourceId: "growth", amount: 0.65 }], cyclesPerSecond: 0.026, natural: true },
  { id: "natural-flowers", helperId: null, modeId: null, label: "Wild flowering", inputs: [{ resourceId: "growth", amount: 1 }], outputs: [{ resourceId: "flowers", amount: 0.55 }], cyclesPerSecond: 0.018, natural: true },
  { id: "natural-pollination", helperId: null, modeId: null, label: "Wild pollination", inputs: [{ resourceId: "flowers", amount: 1 }], outputs: [{ resourceId: "pollinatedBlooms", amount: 0.5 }], cyclesPerSecond: 0.012, natural: true },
  { id: "natural-seeding", helperId: null, modeId: null, label: "Seed fall", inputs: [{ resourceId: "pollinatedBlooms", amount: 1 }], outputs: [{ resourceId: "seeds", amount: 0.45 }, { resourceId: "clippings", amount: 0.35 }], cyclesPerSecond: 0.01, natural: true },
  { id: "natural-compost", helperId: null, modeId: null, label: "Slow compost", inputs: [{ resourceId: "clippings", amount: 1 }], outputs: [{ resourceId: "compost", amount: 0.55 }], cyclesPerSecond: 0.008, natural: true },
  { id: "natural-humus", helperId: null, modeId: null, label: "Soil settling", inputs: [{ resourceId: "compost", amount: 1 }], outputs: [{ resourceId: "humus", amount: 0.52 }], cyclesPerSecond: 0.006, natural: true },
  { id: "natural-roots", helperId: null, modeId: null, label: "Root feeding", inputs: [{ resourceId: "humus", amount: 1 }], outputs: [{ resourceId: "rootEnergy", amount: 0.5 }], cyclesPerSecond: 0.004, natural: true },
  { id: "natural-care", helperId: null, modeId: null, label: "Ancient resilience", inputs: [{ resourceId: "rootEnergy", amount: 1 }], outputs: [{ resourceId: "care", amount: 0.7 }], cyclesPerSecond: 0.008, natural: true },
  { id: "sprinkler-care", helperId: "tinySprinkler", modeId: "caretaker", label: "Caretaker spray", inputs: [{ resourceId: "dew", amount: 1 }], outputs: [{ resourceId: "moisture", amount: 0.9 }, { resourceId: "care", amount: 0.32 }], cyclesPerSecond: 0.34 },
  { id: "sprinkler-grow", helperId: "tinySprinkler", modeId: "cultivator", label: "Cultivating spray", inputs: [{ resourceId: "dew", amount: 1 }], outputs: [{ resourceId: "moisture", amount: 1.18 }, { resourceId: "growth", amount: 0.2 }], cyclesPerSecond: 0.4 },
  { id: "mouse-spread", helperId: "fieldMouse", modeId: "spread", label: "Seed spreading", inputs: [{ resourceId: "seeds", amount: 1 }], outputs: [{ resourceId: "growth", amount: 1.35 }], cyclesPerSecond: 0.28, runTouchesPerCycle: 0.28 },
  { id: "mouse-cache", helperId: "fieldMouse", modeId: "cache", label: "Careful cache", inputs: [{ resourceId: "seeds", amount: 0.68 }], outputs: [{ resourceId: "growth", amount: 1.05 }], cyclesPerSecond: 0.22, runTouchesPerCycle: 0.18 },
  { id: "bee-pollinate", helperId: "beeHive", modeId: "pollinate", label: "Hive pollination", inputs: [{ resourceId: "flowers", amount: 1 }], outputs: [{ resourceId: "pollinatedBlooms", amount: 1.4 }], cyclesPerSecond: 0.36 },
  { id: "bee-honey", helperId: "beeHive", modeId: "honeyReserve", label: "Honey reserve", inputs: [{ resourceId: "flowers", amount: 1 }], outputs: [{ resourceId: "pollinatedBlooms", amount: 1.05 }, { resourceId: "care", amount: 0.38 }], cyclesPerSecond: 0.28 },
  { id: "chicken-scratch", helperId: "chickenPatrol", modeId: "scratch", label: "Compost scratching", inputs: [{ resourceId: "clippings", amount: 1 }], outputs: [{ resourceId: "compost", amount: 1.45 }], cyclesPerSecond: 0.34, runTouchesPerCycle: 0.42 },
  { id: "chicken-forage", helperId: "chickenPatrol", modeId: "forage", label: "Field forage", inputs: [{ resourceId: "growth", amount: 1 }], outputs: [{ resourceId: "clippings", amount: 1.22 }, { resourceId: "compost", amount: 0.22 }], cyclesPerSecond: 0.3, runTouchesPerCycle: 0.2 },
  { id: "worm-aerate", helperId: "earthwormCrew", modeId: "aerate", label: "Deep aeration", inputs: [{ resourceId: "compost", amount: 1 }], outputs: [{ resourceId: "humus", amount: 1.5 }], cyclesPerSecond: 0.38 },
  { id: "worm-triage", helperId: "earthwormCrew", modeId: "triage", label: "Root triage", inputs: [{ resourceId: "compost", amount: 1 }], outputs: [{ resourceId: "humus", amount: 1.08 }, { resourceId: "care", amount: 0.5 }], cyclesPerSecond: 0.3 },
  { id: "roots-anchor", helperId: "ancientRoots", modeId: "anchor", label: "Ancient anchoring", inputs: [{ resourceId: "humus", amount: 1 }], outputs: [{ resourceId: "rootEnergy", amount: 1.4 }, { resourceId: "care", amount: 0.42 }], cyclesPerSecond: 0.34 },
  { id: "roots-wellspring", helperId: "ancientRoots", modeId: "wellspring", label: "Root wellspring", inputs: [{ resourceId: "rootEnergy", amount: 1 }], outputs: [{ resourceId: "dew", amount: 1.8 }, { resourceId: "care", amount: 0.72 }], cyclesPerSecond: 0.32 },
  { id: "sheep-graze", helperId: "sheepLoop", modeId: "graze", label: "Gentle grazing", inputs: [{ resourceId: "growth", amount: 1 }], outputs: [{ resourceId: "clippings", amount: 1.18 }, { resourceId: "care", amount: 0.42 }], cyclesPerSecond: 0.48 },
  { id: "sheep-crop", helperId: "sheepLoop", modeId: "closeCrop", label: "Close crop", inputs: [{ resourceId: "growth", amount: 1 }], outputs: [{ resourceId: "clippings", amount: 1.65 }, { resourceId: "care", amount: 0.15 }], cyclesPerSecond: 0.56 },
  { id: "rabbit-growth", helperId: "meadowRabbit", modeId: "seedRun", label: "Seed run", inputs: [{ resourceId: "seeds", amount: 1 }], outputs: [{ resourceId: "growth", amount: 1.65 }], cyclesPerSecond: 0.72 },
  { id: "rabbit-bloom", helperId: "meadowRabbit", modeId: "bloomRun", label: "Bloom run", inputs: [{ resourceId: "seeds", amount: 1 }], outputs: [{ resourceId: "flowers", amount: 1.28 }], cyclesPerSecond: 0.62 },
];

export const FIELD_SIZE_LADDER = [1, 2, 3, 5, 8, 12, 20, 32, 50, 75, 100] as const;
export const FIELD_CHUNK_SIZE = 10;
export const CULTIVATION_RANKS_PER_SIZE = 10;

export enum TileStage {
  Dormant = 0,
  Dewy = 1,
  Moist = 2,
  Sprouting = 3,
  Verdant = 4,
  Flowering = 5,
  Pollinated = 6,
  Rooted = 7,
}

export const TILE_STAGE_COUNT = 8;

export interface FieldChunk {
  id: number;
  column: number;
  row: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export interface TouchBatchImpact {
  tileIndex: number;
  power: number;
  kind: "primary" | "area" | "chain" | "embrace";
}

export interface TouchBatchResult {
  primaryTileIndex: number;
  affectedTileCount: number;
  totalPower: number;
  healedHp: number;
  dewGained: number;
  runTouchesGained: number;
  fieldEmbraceTriggered: boolean;
  representativeImpacts: readonly TouchBatchImpact[];
}

export const HELPER_RECONFIGURE_MS = 5_000;
export const PRODUCTION_TICK_MS = 250;
export const MAX_REPRESENTATIVE_IMPACTS = 24;
