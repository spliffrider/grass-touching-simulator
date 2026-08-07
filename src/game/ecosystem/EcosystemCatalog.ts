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

export const RUN_TOUCHES_LABEL = "Run Touches";
export const MEMORY_GROWTH_LABEL = "Growth";

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
  growth: { id: "growth", label: "Field Growth", shortLabel: "Field", color: 0x8bd25a },
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

interface HelperMode {
  id: string;
  helperId: HelperId;
  label: string;
  description: string;
}

interface RecipeAmount {
  resourceId: ProductionResourceId;
  amount: number;
  allowOverflow?: boolean;
}

export interface ProductionRecipe {
  id: string;
  helperId: HelperId | null;
  modeId: string | null;
  label: string;
  inputs: readonly RecipeAmount[];
  outputs: readonly RecipeAmount[];
  cyclesPerSecond: number;
  natural?: boolean;
}

export interface HelperDefinition {
  id: HelperId;
  label: string;
  assetPath: string;
  baseCost: number;
  costGrowth: number;
  touchesPerCycle: number;
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
    baseCost: 6,
    costGrowth: 1.34,
    touchesPerCycle: 1.5,
    unlockCost: 4,
    unlockRequires: null,
    modes: modes(
      "tinySprinkler",
      ["caretaker", "Caretaker", "Sprinkles forever, adding automatic touches and steady Care."],
      ["cultivator", "Cultivator", "Sprinkles forever while favoring automatic Field Growth over Care."],
    ),
  },
  fieldMouse: {
    id: "fieldMouse",
    label: "Field Mouse",
    assetPath: "/assets/world/field-mouse.png",
    baseCost: 32,
    costGrowth: 1.46,
    touchesPerCycle: 2,
    unlockCost: 20,
    unlockRequires: "tinySprinkler",
    modes: modes(
      "fieldMouse",
      ["spread", "Spread", `Scampers across the field, adding Field Growth and ${RUN_TOUCHES_LABEL}. A Tiny Sprinkler opens Damp Furrows for bonus Field Growth and Care.`],
      ["cache", "Cache", "Scampers more slowly but leaves steady Care behind. Damp Furrows still boost every trip."],
    ),
  },
  beeHive: {
    id: "beeHive",
    label: "Bee Hive",
    assetPath: "/assets/world/bee-hive.png",
    baseCost: 82,
    costGrowth: 1.5,
    touchesPerCycle: 3,
    unlockCost: 34,
    unlockRequires: "fieldMouse",
    modes: modes(
      "beeHive",
      ["pollinate", "Pollinate", "Flies continuously, creating Pollinated Blooms and automatic touches."],
      ["honeyReserve", "Honey Reserve", "Flies more slowly while producing steady Care."],
    ),
  },
  chickenPatrol: {
    id: "chickenPatrol",
    label: "Chicken Patrol",
    assetPath: "/assets/world/chicken.png",
    baseCost: 320,
    costGrowth: 1.64,
    touchesPerCycle: 5,
    unlockCost: 52,
    unlockRequires: "beeHive",
    modes: modes(
      "chickenPatrol",
      ["scratch", "Scratch", `Scratches continuously, producing Compost and ${RUN_TOUCHES_LABEL}.`],
      ["forage", "Forage", "Patrols more carefully, producing Clippings and Compost."],
    ),
  },
  earthwormCrew: {
    id: "earthwormCrew",
    label: "Earthworm Crew",
    assetPath: "/assets/world/earthworm.png",
    baseCost: 850,
    costGrowth: 1.67,
    touchesPerCycle: 8,
    unlockCost: 74,
    unlockRequires: "chickenPatrol",
    modes: modes(
      "earthwormCrew",
      ["aerate", "Aerate", "Burrows continuously, producing rich Humus and automatic touches."],
      ["triage", "Triage", "Burrows more slowly while restoring steady Care."],
    ),
  },
  ancientRoots: {
    id: "ancientRoots",
    label: "Ancient Roots",
    assetPath: "/assets/ui/skills/root-network.png",
    baseCost: 2200,
    costGrowth: 1.7,
    touchesPerCycle: 13,
    unlockCost: 104,
    unlockRequires: "earthwormCrew",
    modes: modes(
      "ancientRoots",
      ["anchor", "Anchor", "Pulses continuously, producing Root Energy, Care, and automatic touches."],
      ["wellspring", "Wellspring", "Draws up Dew and Care without consuming resources."],
    ),
  },
  sheepLoop: {
    id: "sheepLoop",
    label: "Sheep Loop",
    assetPath: "/assets/world/sheep.png",
    baseCost: 6200,
    costGrowth: 1.74,
    touchesPerCycle: 21,
    unlockCost: 142,
    unlockRequires: "ancientRoots",
    modes: modes(
      "sheepLoop",
      ["graze", "Graze", "Grazes continuously, producing Clippings, Care, and automatic touches."],
      ["closeCrop", "Close Crop", "Runs a faster loop that produces more Clippings but less Care."],
    ),
  },
  meadowRabbit: {
    id: "meadowRabbit",
    label: "Meadow Rabbit",
    assetPath: "/assets/world/meadow-rabbit.png",
    baseCost: 18000,
    costGrowth: 1.78,
    touchesPerCycle: 34,
    unlockCost: 190,
    unlockRequires: "sheepLoop",
    modes: modes(
      "meadowRabbit",
      ["seedRun", "Seed Run", "Runs continuously, rapidly producing Field Growth and automatic touches."],
      ["bloomRun", "Bloom Run", "Takes a wider route that produces Flowers and automatic touches."],
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
  { id: "sprinkler-care", helperId: "tinySprinkler", modeId: "caretaker", label: "Caretaker spray", inputs: [], outputs: [{ resourceId: "moisture", amount: 1.25, allowOverflow: true }, { resourceId: "care", amount: 1.8, allowOverflow: true }], cyclesPerSecond: 0.65 },
  { id: "sprinkler-grow", helperId: "tinySprinkler", modeId: "cultivator", label: "Cultivating spray", inputs: [], outputs: [{ resourceId: "moisture", amount: 1.5, allowOverflow: true }, { resourceId: "growth", amount: 0.42, allowOverflow: true }], cyclesPerSecond: 0.65 },
  { id: "mouse-spread", helperId: "fieldMouse", modeId: "spread", label: "Field scamper", inputs: [], outputs: [{ resourceId: "growth", amount: 1.5, allowOverflow: true }], cyclesPerSecond: 0.34 },
  { id: "mouse-cache", helperId: "fieldMouse", modeId: "cache", label: "Careful cache", inputs: [], outputs: [{ resourceId: "growth", amount: 1.12, allowOverflow: true }, { resourceId: "care", amount: 0.72, allowOverflow: true }], cyclesPerSecond: 0.27 },
  { id: "bee-pollinate", helperId: "beeHive", modeId: "pollinate", label: "Hive pollination", inputs: [], outputs: [{ resourceId: "pollinatedBlooms", amount: 1.5, allowOverflow: true }], cyclesPerSecond: 0.42 },
  { id: "bee-honey", helperId: "beeHive", modeId: "honeyReserve", label: "Honey reserve", inputs: [], outputs: [{ resourceId: "pollinatedBlooms", amount: 1.12, allowOverflow: true }, { resourceId: "care", amount: 0.9, allowOverflow: true }], cyclesPerSecond: 0.34 },
  { id: "chicken-scratch", helperId: "chickenPatrol", modeId: "scratch", label: "Compost scratching", inputs: [], outputs: [{ resourceId: "compost", amount: 1.45, allowOverflow: true }], cyclesPerSecond: 0.34 },
  { id: "chicken-forage", helperId: "chickenPatrol", modeId: "forage", label: "Field forage", inputs: [], outputs: [{ resourceId: "clippings", amount: 1.22, allowOverflow: true }, { resourceId: "compost", amount: 0.22, allowOverflow: true }], cyclesPerSecond: 0.3 },
  { id: "worm-aerate", helperId: "earthwormCrew", modeId: "aerate", label: "Deep aeration", inputs: [], outputs: [{ resourceId: "humus", amount: 1.5, allowOverflow: true }], cyclesPerSecond: 0.38 },
  { id: "worm-triage", helperId: "earthwormCrew", modeId: "triage", label: "Root triage", inputs: [], outputs: [{ resourceId: "humus", amount: 1.08, allowOverflow: true }, { resourceId: "care", amount: 0.5, allowOverflow: true }], cyclesPerSecond: 0.3 },
  { id: "roots-anchor", helperId: "ancientRoots", modeId: "anchor", label: "Ancient anchoring", inputs: [], outputs: [{ resourceId: "rootEnergy", amount: 1.4, allowOverflow: true }, { resourceId: "care", amount: 0.42, allowOverflow: true }], cyclesPerSecond: 0.34 },
  { id: "roots-wellspring", helperId: "ancientRoots", modeId: "wellspring", label: "Root wellspring", inputs: [], outputs: [{ resourceId: "dew", amount: 1.8, allowOverflow: true }, { resourceId: "care", amount: 0.72, allowOverflow: true }], cyclesPerSecond: 0.32 },
  { id: "sheep-graze", helperId: "sheepLoop", modeId: "graze", label: "Gentle grazing", inputs: [], outputs: [{ resourceId: "clippings", amount: 1.18, allowOverflow: true }, { resourceId: "care", amount: 0.42, allowOverflow: true }], cyclesPerSecond: 0.48 },
  { id: "sheep-crop", helperId: "sheepLoop", modeId: "closeCrop", label: "Close crop", inputs: [], outputs: [{ resourceId: "clippings", amount: 1.65, allowOverflow: true }, { resourceId: "care", amount: 0.15, allowOverflow: true }], cyclesPerSecond: 0.56 },
  { id: "rabbit-growth", helperId: "meadowRabbit", modeId: "seedRun", label: "Seed run", inputs: [], outputs: [{ resourceId: "growth", amount: 1.65, allowOverflow: true }], cyclesPerSecond: 0.72 },
  { id: "rabbit-bloom", helperId: "meadowRabbit", modeId: "bloomRun", label: "Bloom run", inputs: [], outputs: [{ resourceId: "flowers", amount: 1.28, allowOverflow: true }], cyclesPerSecond: 0.62 },
];

export const FIELD_SIZE_LADDER = [1, 2, 3, 5, 8, 12, 20, 32, 50, 75, 100] as const;
export const FIELD_CHUNK_SIZE = 10;

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
  shieldGained: number;
  shieldAmount: number;
  lingeringCareAddedPerSecond: number;
  lingeringCarePerSecond: number;
  dewGained: number;
  growthGained: number;
  runTouchesGained: number;
  fieldEmbraceTriggered: boolean;
  representativeImpacts: readonly TouchBatchImpact[];
}

export const HELPER_RECONFIGURE_MS = 5_000;
export const PRODUCTION_TICK_MS = 250;
export const MAX_REPRESENTATIVE_IMPACTS = 24;
