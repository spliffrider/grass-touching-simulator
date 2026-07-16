export const DESKTOP_TILE_ANIMATION_BUDGET = 144;
export const PHONE_TILE_ANIMATION_BUDGET = 72;

export function getAnimatedTileCount(renderedTileCount: number, mobile: boolean): number {
  const rendered = Math.max(0, Math.floor(renderedTileCount));
  const budget = mobile ? PHONE_TILE_ANIMATION_BUDGET : DESKTOP_TILE_ANIMATION_BUDGET;
  return Math.min(rendered, budget);
}

export function getAnimatedTileIndex(
  sampleIndex: number,
  renderedTileCount: number,
  animatedTileCount: number,
): number {
  if (renderedTileCount <= 0 || animatedTileCount <= 0) return 0;
  const sample = Math.max(0, Math.min(animatedTileCount - 1, Math.floor(sampleIndex)));
  return Math.min(
    renderedTileCount - 1,
    Math.floor((sample * renderedTileCount) / animatedTileCount),
  );
}
