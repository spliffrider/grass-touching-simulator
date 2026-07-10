import { describe, expect, it } from "vitest";

import { RUN_TOOL_IDS, RUN_TOOL_VIEW } from "../src/game/redesign/RunToolCatalog";

describe("RunToolCatalog", () => {
  it("provides a distinct icon and player-facing description for every run tool", () => {
    expect(new Set(RUN_TOOL_IDS).size).toBe(RUN_TOOL_IDS.length);
    expect(new Set(RUN_TOOL_IDS.map((toolId) => RUN_TOOL_VIEW[toolId].iconKey)).size).toBe(RUN_TOOL_IDS.length);

    for (const toolId of RUN_TOOL_IDS) {
      const tool = RUN_TOOL_VIEW[toolId];
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.iconPath).toMatch(/^\/assets\/.+\.png$/);
    }
  });
});
