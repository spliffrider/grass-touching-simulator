export const MEMORY_TREE_MIN_ZOOM = 0.6;
export const MEMORY_TREE_MAX_ZOOM = 1.8;
export const MEMORY_TREE_ZOOM_STEP = 0.2;

export interface MemoryTreePan {
  x: number;
  y: number;
}

export interface MemoryTreeViewport {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export function clampMemoryTreeZoom(value: number): number {
  const normalized = Number.isFinite(value) ? value : 1;
  return Math.min(MEMORY_TREE_MAX_ZOOM, Math.max(MEMORY_TREE_MIN_ZOOM, normalized));
}

export function clampMemoryTreePan(
  pan: MemoryTreePan,
  viewport: Pick<MemoryTreeViewport, "width" | "height">,
  zoom: number,
): MemoryTreePan {
  const clampedZoom = clampMemoryTreeZoom(zoom);
  const overflowScale = Math.max(0, clampedZoom - 1) / 2;
  const maxX = Math.max(0, viewport.width) * overflowScale;
  const maxY = Math.max(0, viewport.height) * overflowScale;
  const requestedX = Number.isFinite(pan.x) ? pan.x : 0;
  const requestedY = Number.isFinite(pan.y) ? pan.y : 0;
  return {
    x: maxX === 0 ? 0 : Math.min(maxX, Math.max(-maxX, requestedX)),
    y: maxY === 0 ? 0 : Math.min(maxY, Math.max(-maxY, requestedY)),
  };
}

export function zoomMemoryTreeAtPoint(
  currentZoom: number,
  requestedZoom: number,
  pan: MemoryTreePan,
  anchor: MemoryTreePan,
  viewport: MemoryTreeViewport,
): { zoom: number; pan: MemoryTreePan } {
  const fromZoom = clampMemoryTreeZoom(currentZoom);
  const zoom = clampMemoryTreeZoom(requestedZoom);
  const localX = (anchor.x - viewport.centerX - pan.x) / fromZoom;
  const localY = (anchor.y - viewport.centerY - pan.y) / fromZoom;
  const nextPan = {
    x: anchor.x - viewport.centerX - localX * zoom,
    y: anchor.y - viewport.centerY - localY * zoom,
  };
  return {
    zoom,
    pan: clampMemoryTreePan(nextPan, viewport, zoom),
  };
}
