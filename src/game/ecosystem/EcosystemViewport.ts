import { FIELD_CHUNK_SIZE } from "./EcosystemCatalog";

type FieldLod = "near" | "mid" | "far";

export interface FieldViewportState {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface FieldViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VisibleGridRange {
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  count: number;
}

export interface FieldProjection {
  viewport: FieldViewportBounds;
  fieldWidth: number;
  fieldHeight: number;
  cellSize: number;
  worldWidth: number;
  worldHeight: number;
  originX: number;
  originY: number;
  lod: FieldLod;
  visibleTiles: VisibleGridRange;
  visibleChunks: VisibleGridRange;
}

export const FIELD_MIN_ZOOM = 0.85;
export const FIELD_MAX_ZOOM = 18;
const MAX_FIXED_FIELD_DIMENSION = 5;
export const MAX_FIXED_FIELD_CELL_SIZE = 240;
export const MAX_NEAR_TILE_VIEWS_DESKTOP = 360;
export const MAX_NEAR_TILE_VIEWS_PHONE = 180;

export function isFieldViewportFixed(fieldWidth: number, fieldHeight: number): boolean {
  return fieldWidth <= MAX_FIXED_FIELD_DIMENSION && fieldHeight <= MAX_FIXED_FIELD_DIMENSION;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clampFieldViewport(state: FieldViewportState): FieldViewportState {
  return {
    centerX: clamp(state.centerX, 0, 1),
    centerY: clamp(state.centerY, 0, 1),
    zoom: clamp(state.zoom, FIELD_MIN_ZOOM, FIELD_MAX_ZOOM),
  };
}

function getFieldLod(cellSize: number): FieldLod {
  if (cellSize >= 26) return "near";
  if (cellSize >= 7) return "mid";
  return "far";
}

function getVisibleRange(
  originX: number,
  originY: number,
  cellSize: number,
  columns: number,
  rows: number,
  viewport: FieldViewportBounds,
  padding = 1,
): VisibleGridRange {
  const startX = clamp(Math.floor((viewport.x - originX) / cellSize) - padding, 0, Math.max(0, columns - 1));
  const endX = clamp(Math.ceil((viewport.x + viewport.width - originX) / cellSize) + padding, 0, Math.max(0, columns - 1));
  const startY = clamp(Math.floor((viewport.y - originY) / cellSize) - padding, 0, Math.max(0, rows - 1));
  const endY = clamp(Math.ceil((viewport.y + viewport.height - originY) / cellSize) + padding, 0, Math.max(0, rows - 1));
  return {
    startX,
    endX,
    startY,
    endY,
    count: Math.max(0, endX - startX + 1) * Math.max(0, endY - startY + 1),
  };
}

export function projectField(
  fieldWidth: number,
  fieldHeight: number,
  viewport: FieldViewportBounds,
  requestedState: FieldViewportState,
): FieldProjection {
  const safeWidth = Math.max(1, fieldWidth);
  const safeHeight = Math.max(1, fieldHeight);
  const state = isFieldViewportFixed(safeWidth, safeHeight)
    ? { centerX: 0.5, centerY: 0.5, zoom: 1 }
    : clampFieldViewport(requestedState);
  const uncappedFitCellSize = Math.min(viewport.width / safeWidth, viewport.height / safeHeight) * 0.9;
  const fitCellSize = safeWidth > 1 || safeHeight > 1
    ? Math.min(uncappedFitCellSize, MAX_FIXED_FIELD_CELL_SIZE)
    : uncappedFitCellSize;
  const cellSize = Math.max(1.25, fitCellSize * state.zoom);
  const worldWidth = cellSize * safeWidth;
  const worldHeight = cellSize * safeHeight;
  const centerWorldX = state.centerX * worldWidth;
  const centerWorldY = state.centerY * worldHeight;
  const originX = viewport.x + viewport.width / 2 - centerWorldX;
  const originY = viewport.y + viewport.height / 2 - centerWorldY;
  const visibleTiles = getVisibleRange(originX, originY, cellSize, safeWidth, safeHeight, viewport);
  const chunkColumns = Math.ceil(safeWidth / FIELD_CHUNK_SIZE);
  const chunkRows = Math.ceil(safeHeight / FIELD_CHUNK_SIZE);
  const visibleChunks = getVisibleRange(
    originX,
    originY,
    cellSize * FIELD_CHUNK_SIZE,
    chunkColumns,
    chunkRows,
    viewport,
    0,
  );
  return {
    viewport,
    fieldWidth: safeWidth,
    fieldHeight: safeHeight,
    cellSize,
    worldWidth,
    worldHeight,
    originX,
    originY,
    lod: getFieldLod(cellSize),
    visibleTiles,
    visibleChunks,
  };
}

export function hasFieldProjectionGeometryChanged(
  previous: FieldProjection | null | undefined,
  next: FieldProjection,
): boolean {
  if (!previous) return true;
  return previous.viewport.x !== next.viewport.x
    || previous.viewport.y !== next.viewport.y
    || previous.viewport.width !== next.viewport.width
    || previous.viewport.height !== next.viewport.height
    || previous.fieldWidth !== next.fieldWidth
    || previous.fieldHeight !== next.fieldHeight
    || previous.cellSize !== next.cellSize
    || previous.worldWidth !== next.worldWidth
    || previous.worldHeight !== next.worldHeight
    || previous.originX !== next.originX
    || previous.originY !== next.originY
    || previous.lod !== next.lod
    || previous.visibleTiles.startX !== next.visibleTiles.startX
    || previous.visibleTiles.endX !== next.visibleTiles.endX
    || previous.visibleTiles.startY !== next.visibleTiles.startY
    || previous.visibleTiles.endY !== next.visibleTiles.endY
    || previous.visibleChunks.startX !== next.visibleChunks.startX
    || previous.visibleChunks.endX !== next.visibleChunks.endX
    || previous.visibleChunks.startY !== next.visibleChunks.startY
    || previous.visibleChunks.endY !== next.visibleChunks.endY;
}

export function screenPointToTile(
  projection: FieldProjection,
  screenX: number,
  screenY: number,
): { x: number; y: number; index: number } | null {
  const x = Math.floor((screenX - projection.originX) / projection.cellSize);
  const y = Math.floor((screenY - projection.originY) / projection.cellSize);
  if (x < 0 || y < 0 || x >= projection.fieldWidth || y >= projection.fieldHeight) {
    return null;
  }
  return { x, y, index: y * projection.fieldWidth + x };
}

export function panFieldViewport(
  state: FieldViewportState,
  projection: FieldProjection,
  deltaScreenX: number,
  deltaScreenY: number,
): FieldViewportState {
  if (projection.worldWidth <= 0 || projection.worldHeight <= 0) return state;
  return clampFieldViewport({
    centerX: state.centerX - deltaScreenX / projection.worldWidth,
    centerY: state.centerY - deltaScreenY / projection.worldHeight,
    zoom: state.zoom,
  });
}

export function zoomFieldAtPoint(
  state: FieldViewportState,
  projection: FieldProjection,
  screenX: number,
  screenY: number,
  zoomFactor: number,
): FieldViewportState {
  const beforeWorldX = (screenX - projection.originX) / projection.worldWidth;
  const beforeWorldY = (screenY - projection.originY) / projection.worldHeight;
  const nextZoom = clamp(state.zoom * zoomFactor, FIELD_MIN_ZOOM, FIELD_MAX_ZOOM);
  if (nextZoom === state.zoom) return state;
  const ratio = state.zoom / nextZoom;
  return clampFieldViewport({
    centerX: beforeWorldX + (state.centerX - beforeWorldX) * ratio,
    centerY: beforeWorldY + (state.centerY - beforeWorldY) * ratio,
    zoom: nextZoom,
  });
}
