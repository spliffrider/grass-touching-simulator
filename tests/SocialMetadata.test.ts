import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve("index.html"), "utf8");
const socialImagePath = resolve("public/og-ancient-grass-alpha.png");

describe("public alpha social metadata", () => {
  it("describes the Ancient Grass survival loop instead of the legacy clicker", () => {
    expect(indexHtml).toContain("Grass Touching Simulator: Ancient Grass Alpha");
    expect(indexHtml).toContain("Hold back the Scourge");
    expect(indexHtml).toContain("The public alpha is live");
    expect(indexHtml).not.toContain("collecting seeds, befriending companions");
  });

  it("uses the versioned Scourge announcement art for Open Graph and Twitter", () => {
    expect(indexHtml).toContain("https://grasstouchingsimulator.com/og-ancient-grass-alpha.png?v=20260711");
    expect(indexHtml).toContain('<meta property="og:image:width" content="1254" />');
    expect(indexHtml).toContain('<meta property="og:image:height" content="1254" />');
    expect(existsSync(socialImagePath)).toBe(true);
    expect(statSync(socialImagePath).size).toBeGreaterThan(2_000_000);
  });
});
