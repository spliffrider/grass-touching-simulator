import { describe, expect, it } from "vitest";
import {
  CREDITS_ACCESSIBLE_COPY,
  GRASS_TOUCHER_CREDITS,
  PLAYTESTER_CREDITS,
} from "../src/game/data/credits";

describe("credits roster", () => {
  it("preserves the named playtesters from the original title screen", () => {
    expect(PLAYTESTER_CREDITS).toEqual([
      "Cosmodeus",
      "Remy",
      "Robin C.",
      "TuloWodash",
      "VNDYN",
      "tussukarva🇫🇮🇸🇪",
      "🔪⋆🎀  𝒦𝒾𝓉𝓉𝓎 𝒩💔𝒾𝓇 🎀⋆🔪",
    ]);
  });

  it("keeps the Grass Touchers in the same shared roster", () => {
    expect(GRASS_TOUCHER_CREDITS).toEqual([
      "Sad choupbese",
      "KaviaarSocialist",
      "Echarnus",
      "Overtilted",
      "entry 3 test",
    ]);
    expect(CREDITS_ACCESSIBLE_COPY).toContain("Playtesters: Cosmodeus");
    expect(CREDITS_ACCESSIBLE_COPY).toContain("Grass Touchers: Sad choupbese");
  });
});
