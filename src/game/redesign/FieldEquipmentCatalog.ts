export type FieldEquipmentId =
  | "tinySprinkler"
  | "fieldMouse"
  | "beeHive"
  | "earthworm"
  | "chicken"
  | "sheep"
  | "meadowRabbit";

export interface FieldEquipmentDefinition {
  id: FieldEquipmentId;
  name: string;
  shortName: string;
  description: string;
  iconKey: string;
  iconPath: string;
  iconCrop?: { x: number; y: number; width: number; height: number };
  baseCost: number;
  costGrowth: number;
  pulseIntervalMs: number;
  healingPerUnit: number;
  requiredMemoryCount: number;
  requiredMemoryId?: string;
  projectileTint: number;
}

export type FieldEquipmentCounts = Record<FieldEquipmentId, number>;

export const FIELD_EQUIPMENT_IDS = [
  "tinySprinkler",
  "fieldMouse",
  "beeHive",
  "earthworm",
  "chicken",
  "sheep",
  "meadowRabbit",
] as const satisfies readonly FieldEquipmentId[];

export const FIELD_EQUIPMENT: Record<FieldEquipmentId, FieldEquipmentDefinition> = {
  tinySprinkler: {
    id: "tinySprinkler",
    name: "Tiny Sprinkler",
    shortName: "Sprinkler",
    description: "A brass helper that mists the Ancient Grass at a steady rhythm.",
    iconKey: "equipment-tiny-sprinkler",
    iconPath: "/assets/world/tiny-sprinkler.png",
    iconCrop: { x: 15, y: 9, width: 34, height: 36 },
    baseCost: 16,
    costGrowth: 1.32,
    pulseIntervalMs: 2_400,
    healingPerUnit: 2,
    requiredMemoryCount: 1,
    requiredMemoryId: "tinySprinkler",
    projectileTint: 0x9eeaff,
  },
  fieldMouse: {
    id: "fieldMouse",
    name: "Field Mouse Route",
    shortName: "Field Mouse",
    description: "A quick courier carrying dew between the roots.",
    iconKey: "equipment-field-mouse",
    iconPath: "/assets/world/field-mouse.png",
    baseCost: 22,
    costGrowth: 1.34,
    pulseIntervalMs: 2_050,
    healingPerUnit: 1.25,
    requiredMemoryCount: 2,
    projectileTint: 0xc7f4ff,
  },
  beeHive: {
    id: "beeHive",
    name: "Bee Hive Shift",
    shortName: "Bee Hive",
    description: "A pollination shift that delivers a richer healing pulse.",
    iconKey: "equipment-bee-hive",
    iconPath: "/assets/world/bee-hive.png",
    baseCost: 30,
    costGrowth: 1.36,
    pulseIntervalMs: 3_100,
    healingPerUnit: 3,
    requiredMemoryCount: 3,
    projectileTint: 0xffe46b,
  },
  earthworm: {
    id: "earthworm",
    name: "Earthworm Crew",
    shortName: "Earthworm",
    description: "Quiet underground work sends a deep restorative surge upward.",
    iconKey: "equipment-earthworm",
    iconPath: "/assets/world/earthworm.png",
    baseCost: 40,
    costGrowth: 1.38,
    pulseIntervalMs: 3_800,
    healingPerUnit: 4.5,
    requiredMemoryCount: 4,
    projectileTint: 0xc7ff92,
  },
  chicken: {
    id: "chicken",
    name: "Chicken Patrol",
    shortName: "Chicken",
    description: "A busy patrol pecks loose dew into the root network.",
    iconKey: "equipment-chicken",
    iconPath: "/assets/world/chicken.png",
    baseCost: 52,
    costGrowth: 1.4,
    pulseIntervalMs: 3_350,
    healingPerUnit: 4,
    requiredMemoryCount: 5,
    projectileTint: 0xffc98c,
  },
  sheep: {
    id: "sheep",
    name: "Sheep Grazing Loop",
    shortName: "Sheep",
    description: "Broad grazing gathers a slow, heavy reserve of life.",
    iconKey: "equipment-sheep",
    iconPath: "/assets/world/sheep.png",
    baseCost: 66,
    costGrowth: 1.42,
    pulseIntervalMs: 4_800,
    healingPerUnit: 7,
    requiredMemoryCount: 7,
    projectileTint: 0xf1f7d0,
  },
  meadowRabbit: {
    id: "meadowRabbit",
    name: "Meadow Rabbit Circuit",
    shortName: "Rabbit",
    description: "A late-run circuit that keeps restorative motes in motion.",
    iconKey: "equipment-meadow-rabbit",
    iconPath: "/assets/world/meadow-rabbit.png",
    baseCost: 82,
    costGrowth: 1.44,
    pulseIntervalMs: 2_750,
    healingPerUnit: 4.5,
    requiredMemoryCount: 9,
    projectileTint: 0xffd6ec,
  },
};

export function createEmptyFieldEquipmentCounts(): FieldEquipmentCounts {
  return Object.fromEntries(FIELD_EQUIPMENT_IDS.map((id) => [id, 0])) as FieldEquipmentCounts;
}

export function getFieldEquipmentCost(id: FieldEquipmentId, owned: number, costMultiplier = 1): number {
  const equipment = FIELD_EQUIPMENT[id];
  return Math.max(1, Math.ceil(equipment.baseCost * equipment.costGrowth ** Math.max(0, Math.floor(owned)) * costMultiplier));
}

export function isFieldEquipmentUnlocked(id: FieldEquipmentId, permanentUpgrades: readonly string[]): boolean {
  const equipment = FIELD_EQUIPMENT[id];
  if (equipment.requiredMemoryId && !permanentUpgrades.includes(equipment.requiredMemoryId)) {
    return false;
  }
  return permanentUpgrades.length >= equipment.requiredMemoryCount;
}

export function getFieldEquipmentLockReason(id: FieldEquipmentId, permanentUpgrades: readonly string[]): string {
  const equipment = FIELD_EQUIPMENT[id];
  if (equipment.requiredMemoryId && !permanentUpgrades.includes(equipment.requiredMemoryId)) {
    return "Remember Tiny Sprinkler";
  }
  const missing = Math.max(0, equipment.requiredMemoryCount - permanentUpgrades.length);
  return missing > 0 ? `Need ${missing} more ${missing === 1 ? "memory" : "memories"}` : "Unlocked";
}

export function getFieldTextureIndex(rootId: number, gridSize: number, textureCount: number): number {
  if (textureCount <= 1) {
    return 0;
  }
  const safeGridSize = Math.max(1, Math.floor(gridSize));
  const row = Math.floor(Math.max(0, rootId) / safeGridSize);
  const column = Math.max(0, rootId) % safeGridSize;
  return (column * 2 + row * 3) % textureCount;
}
