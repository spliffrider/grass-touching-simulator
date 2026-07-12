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
  requiredMemoryId: string;
  requiredMemoryName: string;
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
    requiredMemoryId: "tinySprinkler",
    requiredMemoryName: "Tiny Sprinkler",
    projectileTint: 0x9eeaff,
  },
  fieldMouse: {
    id: "fieldMouse",
    name: "Field Mouse Route",
    shortName: "Field Mouse",
    description: "A quick courier carrying dew between the roots.",
    iconKey: "equipment-field-mouse",
    iconPath: "/assets/world/field-mouse.png",
    baseCost: 28,
    costGrowth: 1.35,
    pulseIntervalMs: 2_200,
    healingPerUnit: 3.5,
    requiredMemoryId: "fieldMouse",
    requiredMemoryName: "Field Mouse Routes",
    projectileTint: 0xc7f4ff,
  },
  beeHive: {
    id: "beeHive",
    name: "Bee Hive Shift",
    shortName: "Bee Hive",
    description: "A pollination shift that delivers a richer healing pulse.",
    iconKey: "equipment-bee-hive",
    iconPath: "/assets/world/bee-hive.png",
    baseCost: 48,
    costGrowth: 1.38,
    pulseIntervalMs: 3_000,
    healingPerUnit: 6,
    requiredMemoryId: "beeHive",
    requiredMemoryName: "Bee Support",
    projectileTint: 0xffe46b,
  },
  earthworm: {
    id: "earthworm",
    name: "Earthworm Crew",
    shortName: "Earthworm",
    description: "Quiet underground work sends a deep restorative surge upward.",
    iconKey: "equipment-earthworm",
    iconPath: "/assets/world/earthworm.png",
    baseCost: 80,
    costGrowth: 1.41,
    pulseIntervalMs: 3_800,
    healingPerUnit: 10,
    requiredMemoryId: "earthworm",
    requiredMemoryName: "Earthworm Recovery",
    projectileTint: 0xc7ff92,
  },
  chicken: {
    id: "chicken",
    name: "Chicken Patrol",
    shortName: "Chicken",
    description: "A busy patrol pecks loose dew into the root network.",
    iconKey: "equipment-chicken",
    iconPath: "/assets/world/chicken.png",
    baseCost: 130,
    costGrowth: 1.44,
    pulseIntervalMs: 3_200,
    healingPerUnit: 16,
    requiredMemoryId: "chicken",
    requiredMemoryName: "Chicken Patrol",
    projectileTint: 0xffc98c,
  },
  sheep: {
    id: "sheep",
    name: "Sheep Grazing Loop",
    shortName: "Sheep",
    description: "Broad grazing gathers a slow, heavy reserve of life.",
    iconKey: "equipment-sheep",
    iconPath: "/assets/world/sheep.png",
    baseCost: 220,
    costGrowth: 1.47,
    pulseIntervalMs: 4_800,
    healingPerUnit: 26,
    requiredMemoryId: "sheep",
    requiredMemoryName: "Sheep Grazing Loop",
    projectileTint: 0xf1f7d0,
  },
  meadowRabbit: {
    id: "meadowRabbit",
    name: "Meadow Rabbit Circuit",
    shortName: "Rabbit",
    description: "A late-run circuit that keeps restorative motes in motion.",
    iconKey: "equipment-meadow-rabbit",
    iconPath: "/assets/world/meadow-rabbit.png",
    baseCost: 360,
    costGrowth: 1.5,
    pulseIntervalMs: 2_900,
    healingPerUnit: 40,
    requiredMemoryId: "meadowRabbit",
    requiredMemoryName: "Meadow Rabbit Circuit",
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
  return permanentUpgrades.includes(equipment.requiredMemoryId);
}

export function getFieldEquipmentLockReason(id: FieldEquipmentId, permanentUpgrades: readonly string[]): string {
  const equipment = FIELD_EQUIPMENT[id];
  return permanentUpgrades.includes(equipment.requiredMemoryId)
    ? "Unlocked"
    : `Remember ${equipment.requiredMemoryName}`;
}

export function isFieldEquipmentPanelUnlocked(permanentUpgrades: readonly string[]): boolean {
  return isFieldEquipmentUnlocked("tinySprinkler", permanentUpgrades);
}

export function getUnlockedFieldEquipmentIds(permanentUpgrades: readonly string[]): FieldEquipmentId[] {
  return FIELD_EQUIPMENT_IDS.filter((id) => isFieldEquipmentUnlocked(id, permanentUpgrades));
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
