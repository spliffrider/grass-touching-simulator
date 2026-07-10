import { describe, expect, it } from "vitest";

import {
  getLeftRunToolRailPlacement,
  getRunToolBarLayout,
  getRunToolHotkeyIndex,
} from "../src/game/redesign/RunToolBarLayout";

describe("RunToolBarLayout", () => {
  it("uses a single vertical rail for the base three-slot kit", () => {
    const layout = getRunToolBarLayout(3, 1280);

    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(3);
    expect(layout.pageCount).toBe(1);
    expect(layout.slotPositions.map(({ catalogIndex, column, row }) => ({ catalogIndex, column, row }))).toEqual([
      { catalogIndex: 0, column: 0, row: 0 },
      { catalogIndex: 1, column: 0, row: 1 },
      { catalogIndex: 2, column: 0, row: 2 },
    ]);
  });

  it("keeps the Satchel-expanded four-slot kit in one vertical line", () => {
    const layout = getRunToolBarLayout(4, 390);

    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(4);
    expect(layout.pageCapacity).toBe(7);
    expect(layout.pageCount).toBe(1);
  });

  it("paginates a larger future catalog and clamps the requested page", () => {
    const firstPage = getRunToolBarLayout(10, 1280);
    const lastPage = getRunToolBarLayout(10, 1280, 99);

    expect(firstPage.pageCapacity).toBe(7);
    expect(firstPage.pageCount).toBe(2);
    expect(firstPage.slotPositions).toHaveLength(7);
    expect(lastPage.page).toBe(1);
    expect(lastPage.slotPositions.map((slot) => slot.catalogIndex)).toEqual([7, 8, 9]);
  });

  it("maps the visible number row to seven stable rail slots", () => {
    expect(getRunToolHotkeyIndex("1")).toBe(0);
    expect(getRunToolHotkeyIndex("4")).toBe(3);
    expect(getRunToolHotkeyIndex("7")).toBe(6);
    expect(getRunToolHotkeyIndex("8")).toBeUndefined();
    expect(getRunToolHotkeyIndex("ArrowDown")).toBeUndefined();
  });

  it("reserves a non-overlapping gap left of the field on desktop and phone widths", () => {
    const desktop = getLeftRunToolRailPlacement(1280, 378, 82, 16);
    const phone = getLeftRunToolRailPlacement(390, 268, 82, 16);

    expect(desktop.fieldLeft - desktop.railRight).toBe(16);
    expect(desktop.railCenterX).toBeGreaterThan(12);
    expect(desktop.fieldCenterX + 378 / 2).toBeLessThanOrEqual(1280 - 12);
    expect(phone.fieldLeft - phone.railRight).toBe(16);
    expect(phone.railRight).toBe(94);
    expect(phone.fieldCenterX + 268 / 2).toBe(378);
  });
});
