import { describe, expect, it } from "vitest";

import {
  createEmptyFieldEquipmentCounts,
  FIELD_EQUIPMENT_IDS,
  getFieldEquipmentCost,
  getFieldEquipmentLockReason,
  getFieldTextureIndex,
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

  it("unlocks the sprinkler by memory and later helpers by total memory depth", () => {
    expect(isFieldEquipmentUnlocked("tinySprinkler", [])).toBe(false);
    expect(getFieldEquipmentLockReason("tinySprinkler", [])).toBe("Remember Tiny Sprinkler");
    expect(isFieldEquipmentUnlocked("tinySprinkler", ["tinySprinkler"])).toBe(true);
    expect(isFieldEquipmentUnlocked("beeHive", ["softTouch", "deeperRoots"])).toBe(false);
    expect(getFieldEquipmentLockReason("beeHive", ["softTouch", "deeperRoots"])).toBe("Need 1 more memory");
    expect(isFieldEquipmentUnlocked("beeHive", ["softTouch", "deeperRoots", "tinySprinkler"])).toBe(true);
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
