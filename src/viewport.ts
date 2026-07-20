export interface ViewportSize {
  width: number;
  height: number;
}

interface ViewportStyleTarget {
  style: {
    width: string;
    height: string;
  };
}

export const MIN_USABLE_VIEWPORT_WIDTH = 240;
export const MIN_USABLE_VIEWPORT_HEIGHT = 180;

export function isUsableViewportSize(viewport: ViewportSize): boolean {
  return Number.isFinite(viewport.width)
    && Number.isFinite(viewport.height)
    && viewport.width >= MIN_USABLE_VIEWPORT_WIDTH
    && viewport.height >= MIN_USABLE_VIEWPORT_HEIGHT;
}

export function applyViewportResize(
  viewport: ViewportSize,
  gameElement: ViewportStyleTarget | null,
  canvas: ViewportStyleTarget | null,
  resizeScale: (width: number, height: number) => void,
): void {
  const width = `${viewport.width}px`;
  const height = `${viewport.height}px`;

  if (gameElement) {
    gameElement.style.width = width;
    gameElement.style.height = height;
  }
  if (canvas) {
    canvas.style.width = width;
    canvas.style.height = height;
  }

  // Phaser reads the canvas client bounds while refreshing its pointer transform.
  // The final CSS dimensions must be present before that refresh occurs.
  resizeScale(viewport.width, viewport.height);
}
