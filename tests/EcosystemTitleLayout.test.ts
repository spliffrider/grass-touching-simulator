import { describe, expect, it } from "vitest";

import { getEcosystemTitleLayout } from "../src/game/ecosystem/EcosystemTitleLayout";

describe("getEcosystemTitleLayout", () => {
  it.each([
    { width: 1047, height: 727, label: "reported medium desktop" },
    { width: 1280, height: 720, label: "standard desktop" },
    { width: 390, height: 844, label: "phone portrait" },
  ])("keeps title and menu separated on $label", ({ width, height }) => {
    const layout = getEcosystemTitleLayout(width, height, 4);
    const lastButtonY = layout.buttonFirstY + layout.buttonStep * 3;

    expect(layout.panelTop).toBeGreaterThanOrEqual(layout.titleBlockBottom + 18);
    expect(layout.panelX - layout.panelWidth / 2).toBeGreaterThanOrEqual(12);
    expect(layout.panelX + layout.panelWidth / 2).toBeLessThanOrEqual(width - 12);
    expect(layout.panelY + layout.panelHeight / 2).toBeLessThanOrEqual(height - 16);
    expect(layout.buttonFirstY - layout.buttonHeight / 2).toBeGreaterThan(layout.panelTop);
    expect(lastButtonY + layout.buttonHeight / 2).toBeLessThan(
      layout.panelTop + layout.panelHeight,
    );
  });

  it("uses the centered compact composition for the reported screenshot viewport", () => {
    const layout = getEcosystemTitleLayout(1047, 727, 4);

    expect(layout.centered).toBe(true);
    expect(layout.titleX).toBeCloseTo(523.5);
    expect(layout.titleTopFontSize).toBeLessThan(60);
    expect(layout.panelTop).toBeGreaterThan(200);
  });
});
