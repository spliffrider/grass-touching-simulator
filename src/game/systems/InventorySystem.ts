import type { GameState, InventoryItemKind } from "../types/game-state";

export function addInventoryItem(state: GameState, itemId: string, kind: InventoryItemKind, quantity = 1): void {
  const current = state.inventory[itemId];
  state.inventory[itemId] = {
    kind,
    quantity: (current?.quantity ?? 0) + quantity,
  };
}

export function consumeInventoryItem(state: GameState, itemId: string, quantity = 1): boolean {
  const current = state.inventory[itemId];
  if (!current || current.quantity < quantity) {
    return false;
  }

  current.quantity -= quantity;
  if (current.quantity <= 0) {
    delete state.inventory[itemId];
  }

  return true;
}

export function getInventoryQuantity(state: GameState, itemId: string): number {
  return state.inventory[itemId]?.quantity ?? 0;
}
