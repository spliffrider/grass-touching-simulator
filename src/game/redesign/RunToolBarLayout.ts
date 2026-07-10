export const RUN_TOOL_SLOT_SIZE = 58;
export const RUN_TOOL_SLOT_GAP = 7;
export const RUN_TOOL_BAR_PADDING = 12;
export const RUN_TOOL_BAR_MAX_ROWS = 7;
export const RUN_TOOL_BAR_COLUMNS = 1;
export const RUN_TOOL_BAR_NAV_HEIGHT = 24;

export interface RunToolSlotPosition {
  catalogIndex: number;
  column: number;
  row: number;
  x: number;
  y: number;
}

export interface RunToolBarLayout {
  columns: number;
  rows: number;
  page: number;
  pageCount: number;
  pageCapacity: number;
  width: number;
  height: number;
  navigationY: number;
  slotPositions: RunToolSlotPosition[];
}

export interface LeftRunToolRailPlacement {
  railCenterX: number;
  railRight: number;
  fieldCenterX: number;
  fieldLeft: number;
}

export function getRunToolBarLayout(toolCount: number, _viewportWidth: number, requestedPage = 0): RunToolBarLayout {
  const normalizedToolCount = Math.max(0, Math.floor(toolCount));
  const columns = RUN_TOOL_BAR_COLUMNS;
  const pageCapacity = columns * RUN_TOOL_BAR_MAX_ROWS;
  const pageCount = Math.max(1, Math.ceil(normalizedToolCount / pageCapacity));
  const page = Math.min(pageCount - 1, Math.max(0, Math.floor(requestedPage)));
  const firstIndex = page * pageCapacity;
  const visibleCount = Math.min(pageCapacity, Math.max(0, normalizedToolCount - firstIndex));
  const rows = Math.max(1, Math.ceil(visibleCount / columns));
  const hasNavigation = pageCount > 1;
  const contentWidth = columns * RUN_TOOL_SLOT_SIZE + Math.max(0, columns - 1) * RUN_TOOL_SLOT_GAP;
  const contentHeight = rows * RUN_TOOL_SLOT_SIZE + Math.max(0, rows - 1) * RUN_TOOL_SLOT_GAP;
  const width = contentWidth + RUN_TOOL_BAR_PADDING * 2;
  const height = contentHeight + RUN_TOOL_BAR_PADDING * 2 + (hasNavigation ? RUN_TOOL_BAR_NAV_HEIGHT : 0);
  const contentTop = -height / 2 + RUN_TOOL_BAR_PADDING;
  const contentLeft = -contentWidth / 2;
  const slotPositions: RunToolSlotPosition[] = [];

  for (let localIndex = 0; localIndex < visibleCount; localIndex += 1) {
    const column = localIndex % columns;
    const row = Math.floor(localIndex / columns);
    slotPositions.push({
      catalogIndex: firstIndex + localIndex,
      column,
      row,
      x: contentLeft + RUN_TOOL_SLOT_SIZE / 2 + column * (RUN_TOOL_SLOT_SIZE + RUN_TOOL_SLOT_GAP),
      y: contentTop + RUN_TOOL_SLOT_SIZE / 2 + row * (RUN_TOOL_SLOT_SIZE + RUN_TOOL_SLOT_GAP),
    });
  }

  return {
    columns,
    rows,
    page,
    pageCount,
    pageCapacity,
    width,
    height,
    navigationY: height / 2 - RUN_TOOL_BAR_NAV_HEIGHT / 2 - RUN_TOOL_BAR_PADDING / 2,
    slotPositions,
  };
}

export function getRunToolHotkeyIndex(key: string): number | undefined {
  if (!/^[1-7]$/.test(key)) {
    return undefined;
  }

  return Number(key) - 1;
}

export function getLeftRunToolRailPlacement(
  viewportWidth: number,
  fieldPanelWidth: number,
  railWidth: number,
  gap: number,
  margin = 12,
): LeftRunToolRailPlacement {
  const combinedWidth = railWidth + gap + fieldPanelWidth;
  const groupLeft = Math.max(margin, (viewportWidth - combinedWidth) / 2);
  const railCenterX = groupLeft + railWidth / 2;
  const railRight = groupLeft + railWidth;
  const fieldLeft = railRight + gap;

  return {
    railCenterX,
    railRight,
    fieldCenterX: fieldLeft + fieldPanelWidth / 2,
    fieldLeft,
  };
}
