import type { FieldTile, GameState, TileKey } from "../types/game-state";

export const PLACEMENT_RADIUS = 1;
const PLACEMENT_SLOT_SEPARATOR = "#";

export interface PlacementEntry {
  objectId: string;
  placementKey: string;
  tileKey: TileKey;
}

export function getPlacementObjectId(placementKey: string): string {
  return placementKey.split(PLACEMENT_SLOT_SEPARATOR)[0] || placementKey;
}

export function getPlacementKey(objectId: string, slotIndex: number): string {
  return slotIndex <= 0 ? objectId : `${objectId}${PLACEMENT_SLOT_SEPARATOR}${slotIndex + 1}`;
}

export function getPlacementSlotIndex(objectId: string, placementKey: string): number {
  if (placementKey === objectId) {
    return 0;
  }

  const prefix = `${objectId}${PLACEMENT_SLOT_SEPARATOR}`;
  if (!placementKey.startsWith(prefix)) {
    return -1;
  }

  const slotNumber = Number(placementKey.slice(prefix.length));
  return Number.isInteger(slotNumber) && slotNumber >= 2 ? slotNumber - 1 : -1;
}

export function getPlacementEntriesForObject(state: GameState, objectId: string): PlacementEntry[] {
  return Object.entries(state.placedWorldObjects)
    .flatMap(([placementKey, placement]) =>
      getPlacementObjectId(placementKey) === objectId ? [{ objectId, placementKey, tileKey: placement.tileKey }] : [],
    )
    .sort((a, b) => getPlacementSlotIndex(objectId, a.placementKey) - getPlacementSlotIndex(objectId, b.placementKey));
}

export function getPlacementAt(state: GameState, key: TileKey): PlacementEntry | undefined {
  for (const [placementKey, placement] of Object.entries(state.placedWorldObjects)) {
    if (placement.tileKey === key) {
      return { objectId: getPlacementObjectId(placementKey), placementKey, tileKey: key };
    }
  }

  return undefined;
}

export function placeWorldObject(state: GameState, objectId: string, key: TileKey, placementKey = objectId): boolean {
  if (
    !state.field[key] ||
    getPlacementObjectId(placementKey) !== objectId ||
    isTileOccupiedByOtherPlacement(state, key, placementKey)
  ) {
    return false;
  }

  state.placedWorldObjects[placementKey] = { tileKey: key };
  return true;
}

export function removeWorldObjectPlacement(state: GameState, placementKey: string): void {
  delete state.placedWorldObjects[placementKey];
}

export function getNearbyPlacementEntries(state: GameState, tile: FieldTile, radius = PLACEMENT_RADIUS): PlacementEntry[] {
  const nearby: PlacementEntry[] = [];

  for (const [placementKey, placement] of Object.entries(state.placedWorldObjects)) {
    const placedTile = state.field[placement.tileKey];
    if (!placedTile) {
      continue;
    }

    const dx = Math.abs(placedTile.x - tile.x);
    const dy = Math.abs(placedTile.y - tile.y);
    if (dx <= radius && dy <= radius) {
      nearby.push({ objectId: getPlacementObjectId(placementKey), placementKey, tileKey: placement.tileKey });
    }
  }

  return nearby;
}

export function isTileOccupiedByOtherPlacement(state: GameState, key: TileKey, placementKey: string): boolean {
  return Object.entries(state.placedWorldObjects).some(
    ([placedPlacementKey, placement]) => placedPlacementKey !== placementKey && placement.tileKey === key,
  );
}
