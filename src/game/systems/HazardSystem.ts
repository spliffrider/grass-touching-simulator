import { getFieldBounds, getFieldTiles, setTileRegrowing, tileKey } from "./FieldSystem";
import type { FieldTile, GameState, RuntimeStats, TileHazardState, TileKey } from "../types/game-state";

const CACTUS_UNLOCK_LIFETIME_TOUCHES = 180;
const CACTUS_MIN_FIELD_TILES = 8;
const CACTUS_CHECK_INTERVAL_MS = 9000;
const CACTUS_SPAWN_CHANCE = 0.26;
const CACTUS_MIN_DURATION_MS = 22000;
const CACTUS_MAX_DURATION_MS = 36000;
const CACTUS_SPAWN_ATTEMPTS = 18;
const PRICKED_DURATION_MS = 8500;
const GLOVED_PRICKED_DURATION_MS = 5200;

const WEED_UNLOCK_LIFETIME_TOUCHES = 360;
const WEED_MIN_FIELD_TILES = 16;
const WEED_CHECK_INTERVAL_MS = 12000;
const WEED_SPAWN_CHANCE = 0.22;
const WEED_SPREAD_CHANCE = 0.16;
const WEED_MIN_DURATION_MS = 42000;
const WEED_MAX_DURATION_MS = 70000;
const WEED_SPAWN_ATTEMPTS = 18;

const MOWER_UNLOCK_LIFETIME_TOUCHES = 720;
const MOWER_MIN_FIELD_TILES = 28;
const MOWER_MIN_INTERVAL_MS = 78000;
const MOWER_MAX_INTERVAL_MS = 122000;
const MOWER_BOUNDARY_INTERVAL_MULTIPLIER = 1.35;
const MOWER_MIN_ROUTE_TILES = 4;
const MOWER_MAX_ROUTE_TILES = 14;
const MOWER_BOUNDARY_MAX_ROUTE_TILES = 9;
const MOWER_ROUTE_ATTEMPTS = 18;

export interface MowerEvent {
  routeKeys: TileKey[];
}

export interface MowerTileResult {
  tile: FieldTile;
  mown: boolean;
  removedCactus: boolean;
  removedWeeds: boolean;
}

export interface HazardTouchResult {
  hazardId: TileHazardState["id"];
  cleared: boolean;
  popText: string;
  color: string;
  sound: "blocked" | "prick";
  seedReward: number;
  stopPersistent: boolean;
}

export interface HazardFeedback {
  refreshTile(tile: FieldTile): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  playMower(event: MowerEvent): void;
}

export class HazardSystem {
  private cactusElapsedMs = -Phaser.Math.Between(2500, 6500);
  private weedElapsedMs = -Phaser.Math.Between(6000, 11000);
  private mowerElapsedMs = -Phaser.Math.Between(54000, 90000);
  private nextMowerIntervalMs = Phaser.Math.Between(MOWER_MIN_INTERVAL_MS, MOWER_MAX_INTERVAL_MS);

  reset(): void {
    this.cactusElapsedMs = -Phaser.Math.Between(2500, 6500);
    this.weedElapsedMs = -Phaser.Math.Between(6000, 11000);
    this.mowerElapsedMs = -Phaser.Math.Between(54000, 90000);
    this.nextMowerIntervalMs = Phaser.Math.Between(MOWER_MIN_INTERVAL_MS, MOWER_MAX_INTERVAL_MS);
  }

  update(deltaMs: number, state: GameState, _stats: RuntimeStats, now: number, feedback: HazardFeedback): boolean {
    let changed = this.pruneExpiredState(state, now, feedback);

    this.cactusElapsedMs += deltaMs;
    if (this.cactusElapsedMs >= CACTUS_CHECK_INTERVAL_MS) {
      this.cactusElapsedMs %= CACTUS_CHECK_INTERVAL_MS;
      if (this.shouldTryCactusSpawn(state) && Math.random() < CACTUS_SPAWN_CHANCE && this.spawnCactus(state, now, feedback)) {
        changed = true;
      }
    }

    this.weedElapsedMs += deltaMs;
    if (this.weedElapsedMs >= WEED_CHECK_INTERVAL_MS) {
      this.weedElapsedMs %= WEED_CHECK_INTERVAL_MS;
      if (this.shouldTryWeedSpawn(state) && Math.random() < WEED_SPAWN_CHANCE && this.spawnWeeds(state, now, feedback)) {
        changed = true;
      } else if (this.shouldTryWeedSpawn(state) && Math.random() < WEED_SPREAD_CHANCE && this.spreadWeeds(state, now, feedback)) {
        changed = true;
      }
    }

    this.mowerElapsedMs += deltaMs;
    if (this.mowerElapsedMs >= this.getMowerIntervalMs(state)) {
      this.mowerElapsedMs = 0;
      this.nextMowerIntervalMs = Phaser.Math.Between(MOWER_MIN_INTERVAL_MS, MOWER_MAX_INTERVAL_MS);
      const event = this.createMowerEvent(state);
      if (event) {
        feedback.playMower(event);
      }
    }

    return changed;
  }

  touchHazard(state: GameState, key: TileKey, now: number): HazardTouchResult | undefined {
    const hazard = state.tileHazards[key];
    if (!hazard) {
      return undefined;
    }

    if (hazard.id === "cactus") {
      delete state.tileHazards[key];
      const current = state.debuffs.pricked;
      const duration = state.seedShopPurchases.garden_gloves ? GLOVED_PRICKED_DURATION_MS : PRICKED_DURATION_MS;
      state.debuffs.pricked = {
        id: "pricked",
        expiresAt: Math.max(current?.expiresAt ?? 0, now + duration),
      };
      return {
        hazardId: "cactus",
        cleared: true,
        popText: "ouch - pricked",
        color: "#ffb7d5",
        sound: "prick",
        seedReward: 0,
        stopPersistent: true,
      };
    }

    const nextStrength = Math.max(0, (hazard.strength ?? 2) - 1);
    if (nextStrength > 0) {
      state.tileHazards[key] = { ...hazard, strength: nextStrength };
      return {
        hazardId: "weeds",
        cleared: false,
        popText: "pull weeds",
        color: "#b7eba5",
        sound: "blocked",
        seedReward: 0,
        stopPersistent: true,
      };
    }

    delete state.tileHazards[key];
    return {
      hazardId: "weeds",
      cleared: true,
      popText: state.seedShopPurchases.compost_bin ? "weeds composted" : "weeds cleared",
      color: state.seedShopPurchases.compost_bin ? "#ffef78" : "#dfffc8",
      sound: "blocked",
      seedReward: state.seedShopPurchases.compost_bin && Math.random() < 0.38 ? 1 : 0,
      stopPersistent: true,
    };
  }

  mowTile(state: GameState, key: TileKey, stats: RuntimeStats, now: number): MowerTileResult | undefined {
    const tile = state.field[key];
    if (!tile) {
      return undefined;
    }

    const removedCactus = state.tileHazards[key]?.id === "cactus";
    const removedWeeds = state.tileHazards[key]?.id === "weeds";
    if (removedCactus || removedWeeds) {
      delete state.tileHazards[key];
    }

    const mown = tile.grassState === "grown";
    if (mown) {
      setTileRegrowing(tile, state, stats, now, state.seedShopPurchases.compost_bin ? 0.92 : 1.16);
    }

    return mown || removedCactus || removedWeeds ? { tile, mown, removedCactus, removedWeeds } : undefined;
  }

  private pruneExpiredState(state: GameState, now: number, feedback: HazardFeedback): boolean {
    let changed = false;

    for (const [key, hazard] of Object.entries(state.tileHazards)) {
      if (!hazard || !state.field[key as TileKey] || hazard.expiresAt <= now) {
        delete state.tileHazards[key as TileKey];
        const tile = state.field[key as TileKey];
        if (tile) {
          feedback.refreshTile(tile);
        }
        changed = true;
      }
    }

    for (const [key, debuff] of Object.entries(state.debuffs)) {
      if (!debuff || debuff.expiresAt <= now) {
        delete state.debuffs[key as keyof typeof state.debuffs];
        changed = true;
      }
    }

    return changed;
  }

  private shouldTryCactusSpawn(state: GameState): boolean {
    const tileCount = getFieldTiles(state).length;
    return (
      state.lifetimeGrassTouches >= CACTUS_UNLOCK_LIFETIME_TOUCHES &&
      tileCount >= CACTUS_MIN_FIELD_TILES &&
      getActiveCactusCount(state) < getCactusCap(tileCount)
    );
  }

  private shouldTryWeedSpawn(state: GameState): boolean {
    const tileCount = getFieldTiles(state).length;
    return (
      state.lifetimeGrassTouches >= WEED_UNLOCK_LIFETIME_TOUCHES &&
      tileCount >= WEED_MIN_FIELD_TILES &&
      getActiveHazardCount(state, "weeds") < getWeedCap(tileCount)
    );
  }

  private spawnCactus(state: GameState, now: number, feedback: HazardFeedback): boolean {
    const tiles = getFieldTiles(state);
    for (let attempt = 0; attempt < CACTUS_SPAWN_ATTEMPTS; attempt += 1) {
      const tile = Phaser.Utils.Array.GetRandom(tiles);
      if (!tile || tile.grassState !== "grown") {
        continue;
      }

      const key = tileKey(tile.x, tile.y);
      if (state.tileHazards[key]) {
        continue;
      }

      state.tileHazards[key] = {
        id: "cactus",
        createdAt: now,
        expiresAt: now + Phaser.Math.Between(CACTUS_MIN_DURATION_MS, CACTUS_MAX_DURATION_MS),
      };
      feedback.refreshTile(tile);
      feedback.popAtTile(tile, "cactus", "#ffb347");
      return true;
    }

    return false;
  }

  private spawnWeeds(state: GameState, now: number, feedback: HazardFeedback): boolean {
    const tiles = getFieldTiles(state);
    for (let attempt = 0; attempt < WEED_SPAWN_ATTEMPTS; attempt += 1) {
      const tile = Phaser.Utils.Array.GetRandom(tiles);
      if (!tile || tile.grassState !== "grown") {
        continue;
      }

      const key = tileKey(tile.x, tile.y);
      if (state.tileHazards[key]) {
        continue;
      }

      state.tileHazards[key] = this.createWeedState(state, now);
      feedback.refreshTile(tile);
      feedback.popAtTile(tile, "weeds", "#b7eba5");
      return true;
    }

    return false;
  }

  private spreadWeeds(state: GameState, now: number, feedback: HazardFeedback): boolean {
    const weedKeys = Object.entries(state.tileHazards)
      .filter(([, hazard]) => hazard?.id === "weeds")
      .map(([key]) => key as TileKey);
    const originKey = Phaser.Utils.Array.GetRandom(weedKeys);
    const origin = originKey ? state.field[originKey] : undefined;
    if (!origin) {
      return false;
    }

    const candidates = [
      state.field[tileKey(origin.x + 1, origin.y)],
      state.field[tileKey(origin.x - 1, origin.y)],
      state.field[tileKey(origin.x, origin.y + 1)],
      state.field[tileKey(origin.x, origin.y - 1)],
    ].filter((tile): tile is FieldTile => tile !== undefined && tile.grassState === "grown" && !state.tileHazards[tileKey(tile.x, tile.y)]);
    const target = Phaser.Utils.Array.GetRandom(candidates);
    if (!target) {
      return false;
    }

    state.tileHazards[tileKey(target.x, target.y)] = this.createWeedState(state, now, 1);
    feedback.refreshTile(target);
    feedback.popAtTile(target, "spread weeds", "#b7eba5");
    return true;
  }

  private createWeedState(state: GameState, now: number, strength?: number): TileHazardState {
    return {
      id: "weeds",
      createdAt: now,
      expiresAt: now + Phaser.Math.Between(WEED_MIN_DURATION_MS, WEED_MAX_DURATION_MS),
      strength: strength ?? (state.seedShopPurchases.garden_gloves || Math.random() < 0.35 ? 1 : 2),
    };
  }

  private createMowerEvent(state: GameState): MowerEvent | undefined {
    const tiles = getFieldTiles(state);
    if (state.lifetimeGrassTouches < MOWER_UNLOCK_LIFETIME_TOUCHES || tiles.length < MOWER_MIN_FIELD_TILES) {
      return undefined;
    }

    const bounds = getFieldBounds(state);
    if (!bounds) {
      return undefined;
    }

    const horizontal = Math.random() < 0.5;
    for (let attempt = 0; attempt < MOWER_ROUTE_ATTEMPTS; attempt += 1) {
      const routeKeys = this.createStraightRoute(state, bounds, horizontal);
      if (routeKeys.length >= MOWER_MIN_ROUTE_TILES) {
        return { routeKeys };
      }
    }

    const routeKeys = this.createFallbackRoute(state, tiles);
    return routeKeys.length >= MOWER_MIN_ROUTE_TILES ? { routeKeys } : undefined;
  }

  private createStraightRoute(state: GameState, bounds: NonNullable<ReturnType<typeof getFieldBounds>>, horizontal: boolean): TileKey[] {
    const routeKeys: TileKey[] = [];
    const routeMax = state.seedShopPurchases.mower_boundary ? MOWER_BOUNDARY_MAX_ROUTE_TILES : MOWER_MAX_ROUTE_TILES;
    const maxLength = Phaser.Math.Clamp(Math.floor(Math.sqrt(getFieldTiles(state).length) * 0.9), MOWER_MIN_ROUTE_TILES, routeMax);
    const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;

    if (horizontal) {
      const y = Phaser.Math.Between(bounds.minY, bounds.maxY);
      const startX = Phaser.Math.Between(bounds.minX, bounds.maxX);
      for (let offset = 0; offset < maxLength; offset += 1) {
        const x = startX + offset * direction;
        if (x < bounds.minX || x > bounds.maxX) {
          break;
        }
        const key = tileKey(x, y);
        if (state.field[key]) {
          routeKeys.push(key);
        }
      }
      return routeKeys;
    }

    const x = Phaser.Math.Between(bounds.minX, bounds.maxX);
    const startY = Phaser.Math.Between(bounds.minY, bounds.maxY);
    for (let offset = 0; offset < maxLength; offset += 1) {
      const y = startY + offset * direction;
      if (y < bounds.minY || y > bounds.maxY) {
        break;
      }
      const key = tileKey(x, y);
      if (state.field[key]) {
        routeKeys.push(key);
      }
    }
    return routeKeys;
  }

  private createFallbackRoute(state: GameState, tiles: FieldTile[]): TileKey[] {
    const start = Phaser.Utils.Array.GetRandom(tiles);
    if (!start) {
      return [];
    }

    const routeKeys: TileKey[] = [tileKey(start.x, start.y)];
    const visited = new Set<TileKey>(routeKeys);
    let current = start;
    for (let step = 1; step < MOWER_MAX_ROUTE_TILES; step += 1) {
      const neighbors = [
        state.field[tileKey(current.x + 1, current.y)],
        state.field[tileKey(current.x - 1, current.y)],
        state.field[tileKey(current.x, current.y + 1)],
        state.field[tileKey(current.x, current.y - 1)],
      ].filter((tile): tile is FieldTile => tile !== undefined && !visited.has(tileKey(tile.x, tile.y)));
      const next = Phaser.Utils.Array.GetRandom(neighbors);
      if (!next) {
        break;
      }

      const key = tileKey(next.x, next.y);
      routeKeys.push(key);
      visited.add(key);
      current = next;
    }

    return routeKeys;
  }

  private getMowerIntervalMs(state: GameState): number {
    return Math.floor(this.nextMowerIntervalMs * (state.seedShopPurchases.mower_boundary ? MOWER_BOUNDARY_INTERVAL_MULTIPLIER : 1));
  }
}

export function getTileHazard(state: GameState, key: TileKey, now = Date.now()): TileHazardState | undefined {
  const hazard = state.tileHazards[key];
  return hazard && hazard.expiresAt > now ? hazard : undefined;
}

export function getActiveCactusCount(state: GameState, now = Date.now()): number {
  return getActiveHazardCount(state, "cactus", now);
}

export function getCactusCap(tileCount: number): number {
  if (tileCount >= 900) {
    return 4;
  }
  if (tileCount >= 320) {
    return 3;
  }
  if (tileCount >= 70) {
    return 2;
  }
  return 1;
}

export function getActiveHazardCount(state: GameState, hazardId: TileHazardState["id"], now = Date.now()): number {
  let count = 0;
  for (const hazard of Object.values(state.tileHazards)) {
    if (hazard?.id === hazardId && hazard.expiresAt > now) {
      count += 1;
    }
  }
  return count;
}

export function getWeedCap(tileCount: number): number {
  if (tileCount >= 900) {
    return 5;
  }
  if (tileCount >= 320) {
    return 4;
  }
  if (tileCount >= 90) {
    return 3;
  }
  return 2;
}

export function getPrickedRemainingMs(state: GameState, now = Date.now()): number {
  return Math.max(0, (state.debuffs.pricked?.expiresAt ?? 0) - now);
}

export function getHazardStatusText(state: GameState, now = Date.now()): string {
  const parts: string[] = [];
  const prickedMs = getPrickedRemainingMs(state, now);
  if (prickedMs > 0) {
    parts.push(`Pricked ${Math.ceil(prickedMs / 1000)}s`);
  }

  const cactusCount = getActiveCactusCount(state, now);
  if (cactusCount > 0) {
    parts.push(`${cactusCount} cactus${cactusCount === 1 ? "" : "es"}`);
  }

  const weedCount = getActiveHazardCount(state, "weeds", now);
  if (weedCount > 0) {
    parts.push(`${weedCount} weed${weedCount === 1 ? "" : "s"}`);
  }

  return parts.join(" | ");
}
