import { describe, expect, it } from "vitest";

import { getRunToolBarLayout } from "../src/game/redesign/RunToolBarLayout";

describe("RunToolBarLayout", () => {
  it("uses a compact two-column grid for the current desktop catalog", () => {
    const layout = getRunToolBarLayout(3, 1280);

    expect(layout.columns).toBe(2);
    expect(layout.rows).toBe(2);
    expect(layout.pageCount).toBe(1);
    expect(layout.slotPositions.map(({ catalogIndex, column, row }) => ({ catalogIndex, column, row }))).toEqual([
      { catalogIndex: 0, column: 0, row: 0 },
      { catalogIndex: 1, column: 1, row: 0 },
      { catalogIndex: 2, column: 0, row: 1 },
    ]);
  });

  it("uses one column on narrow screens", () => {
    const layout = getRunToolBarLayout(3, 390);

    expect(layout.columns).toBe(1);
    expect(layout.rows).toBe(3);
    expect(layout.pageCapacity).toBe(4);
    expect(layout.pageCount).toBe(1);
  });

  it("paginates a larger future catalog and clamps the requested page", () => {
    const firstPage = getRunToolBarLayout(10, 1280);
    const lastPage = getRunToolBarLayout(10, 1280, 99);

    expect(firstPage.pageCapacity).toBe(8);
    expect(firstPage.pageCount).toBe(2);
    expect(firstPage.slotPositions).toHaveLength(8);
    expect(lastPage.page).toBe(1);
    expect(lastPage.slotPositions.map((slot) => slot.catalogIndex)).toEqual([8, 9]);
  });
});
