import { describe, expect, it } from "vitest";

import {
  createEmptyFieldEquipmentCounts,
  FIELD_EQUIPMENT,
  FIELD_EQUIPMENT_IDS,
  getFieldEquipmentCost,
  getFieldEquipmentLockReason,
  getFieldTextureIndex,
  getUnlockedFieldEquipmentIds,
  isFieldEquipmentPanelUnlocked,
  isFieldEquipmentUnlocked,
} from "../src/game/redesign/FieldEquipmentCatalog";

describe("FieldEquipmentCatalog", () => {
  it("contains the complete inherited equipment roster", () => {
    expect(FIELD_EQUIPMENT_IDS).toEqual([
      "tinySprinkler",
      "fieldMouse",
      "beeHive",
      "earthworm",
      "chicken",
      "sheep",
      "meadowRabbit",
    ]);
    expect(createEmptyFieldEquipmentCounts()).toEqual({
      tinySprinkler: 0,
      fieldMouse: 0,
      beeHive: 0,
      earthworm: 0,
      chicken: 0,
      sheep: 0,
      meadowRabbit: 0,
    });
  });

  it("increases repeat-purchase prices and applies the Field Satchel discount", () => {
    expect(getFieldEquipmentCost("tinySprinkler", 0)).toBe(16);
    expect(getFieldEquipmentCost("tinySprinkler", 1)).toBeGreaterThan(16);
    expect(getFieldEquipmentCost("tinySprinkler", 0, 0.9)).toBe(15);
  });

  it("reveals the equipment panel and each helper only through its own memory", () => {
    expect(isFieldEquipmentPanelUnlocked([])).toBe(false);
    expect(getUnlockedFieldEquipmentIds([])).toEqual([]);
    expect(isFieldEquipmentUnlocked("tinySprinkler", [])).toBe(false);
    expect(getFieldEquipmentLockReason("tinySprinkler", [])).toBe("Remember Tiny Sprinkler");
    expect(isFieldEquipmentUnlocked("tinySprinkler", ["tinySprinkler"])).toBe(true);
    expect(isFieldEquipmentPanelUnlocked(["tinySprinkler"])).toBe(true);
    expect(getUnlockedFieldEquipmentIds(["tinySprinkler"])).toEqual(["tinySprinkler"]);
    expect(isFieldEquipmentUnlocked("beeHive", ["softTouch", "deeperRoots", "tinySprinkler"])).toBe(false);
    expect(getFieldEquipmentLockReason("beeHive", ["softTouch", "deeperRoots", "tinySprinkler"])).toBe("Remember Bee Support");
    expect(isFieldEquipmentUnlocked("beeHive", ["tinySprinkler", "beeHive"])).toBe(true);
    expect(getUnlockedFieldEquipmentIds(["tinySprinkler", "fieldMouse", "beeHive"])).toEqual([
      "tinySprinkler",
      "fieldMouse",
      "beeHive",
    ]);
  });

  it("widens equipment cost and healing throughput across tiers", () => {
    const first = FIELD_EQUIPMENT_IDS[0];
    const last = FIELD_EQUIPMENT_IDS[FIELD_EQUIPMENT_IDS.length - 1];
    const firstThroughput = FIELD_EQUIPMENT[first].healingPerUnit / FIELD_EQUIPMENT[first].pulseIntervalMs;
    const lastThroughput = FIELD_EQUIPMENT[last].healingPerUnit / FIELD_EQUIPMENT[last].pulseIntervalMs;

    expect(getFieldEquipmentCost(last, 0)).toBeGreaterThanOrEqual(getFieldEquipmentCost(first, 0) * 20);
    expect(lastThroughput).toBeGreaterThanOrEqual(firstThroughput * 15);
  });

  it("varies textures across both rows and columns without layout-time randomness", () => {
    const gridSize = 5;
    const textureCount = 5;
    const indexes = Array.from({ length: gridSize * gridSize }, (_, rootId) =>
      getFieldTextureIndex(rootId, gridSize, textureCount),
    );

    for (let row = 0; row < gridSize; row += 1) {
      expect(new Set(indexes.slice(row * gridSize, row * gridSize + gridSize)).size).toBe(textureCount);
    }
    for (let column = 0; column < gridSize; column += 1) {
      expect(new Set(indexes.filter((_, index) => index % gridSize === column)).size).toBe(textureCount);
    }
    expect(indexes).toEqual(Array.from({ length: 25 }, (_, rootId) => getFieldTextureIndex(rootId, 5, 5)));
  });
});
