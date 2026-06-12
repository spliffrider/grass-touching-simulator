import type { FieldTile, GameState, TileKey } from "../types/game-state";

export const PLACEMENT_RADIUS = 1;

export function placeWorldObject(state: GameState, objectId: string, key: TileKey): boolean {
  if (!state.field[key] || isTileOccupiedByOtherPlacement(state, key, objectId)) {
    return false;
  }

  state.placedWorldObjects[objectId] = { tileKey: key };
  return true;
}

export function removeWorldObjectPlacement(state: GameState, objectId: string): void {
  delete state.placedWorldObjects[objectId];
}

export function getPlacedObjectAt(state: GameState, key: TileKey): string | undefined {
  return Object.entries(state.placedWorldObjects).find(([, placement]) => placement.tileKey === key)?.[0];
}

export function getNearbyPlacedObjectIds(state: GameState, tile: FieldTile, radius = PLACEMENT_RADIUS): string[] {
  const nearby: string[] = [];

  for (const [objectId, placement] of Object.entries(state.placedWorldObjects)) {
    const placedTile = state.field[placement.tileKey];
    if (!placedTile) {
      continue;
    }

    const dx = Math.abs(placedTile.x - tile.x);
    const dy = Math.abs(placedTile.y - tile.y);
    if (dx <= radius && dy <= radius) {
      nearby.push(objectId);
    }
  }

  return nearby;
}

export function isTileOccupiedByOtherPlacement(state: GameState, key: TileKey, objectId: string): boolean {
  return Object.entries(state.placedWorldObjects).some(([placedObjectId, placement]) => placedObjectId !== objectId && placement.tileKey === key);
}
