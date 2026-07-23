import { describe, expect, it } from "vitest";
import {
  TITLE_ATMOSPHERE_CYCLE_MS,
  TITLE_SCOURGE_BASELINE,
  getTitleAtmosphereBudget,
  getTitleScourgeStrength,
} from "../src/game/ecosystem/EcosystemTitleAtmosphere";

describe("EcosystemTitleAtmosphere", () => {
  it("brews from a mostly clear sky into full Scourge cover", () => {
    expect(getTitleScourgeStrength(0)).toBe(TITLE_SCOURGE_BASELINE);
    expect(getTitleScourgeStrength(8_000)).toBeGreaterThan(TITLE_SCOURGE_BASELINE);
    expect(getTitleScourgeStrength(18_500)).toBe(1);
    expect(getTitleScourgeStrength(24_000)).toBe(1);
  });

  it("releases the sky before beginning another cycle", () => {
    expect(getTitleScourgeStrength(32_000)).toBeLessThan(0.7);
    expect(getTitleScourgeStrength(39_000)).toBe(TITLE_SCOURGE_BASELINE);
    expect(getTitleScourgeStrength(TITLE_ATMOSPHERE_CYCLE_MS)).toBe(TITLE_SCOURGE_BASELINE);
  });

  it("keeps title-screen actors bounded by viewport class", () => {
    expect(getTitleAtmosphereBudget(390, 844)).toEqual({ clouds: 3, birds: 3, bees: 2 });
    expect(getTitleAtmosphereBudget(820, 1180)).toEqual({ clouds: 4, birds: 4, bees: 3 });
    expect(getTitleAtmosphereBudget(1280, 720)).toEqual({ clouds: 5, birds: 5, bees: 4 });
  });
});
