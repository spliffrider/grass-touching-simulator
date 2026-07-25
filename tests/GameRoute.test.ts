import { describe, expect, it } from "vitest";

import { resolveGameRoute } from "../src/game/routing/GameRoute";

describe("resolveGameRoute", () => {
  it("launches the ecosystem title screen from the bare production URL", () => {
    expect(resolveGameRoute("")).toEqual({
      useEcosystemPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it("keeps alpha as an explicit ecosystem title alias", () => {
    expect(resolveGameRoute("?alpha")).toEqual({
      useEcosystemPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it.each(["?redesign", "?newRun"])(
    "routes retired prototype alias %s to the current ecosystem title",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemPrototype: false,
        publicAlphaRoute: true,
      });
    },
  );

  it.each(["?playtest", "?redesign&playtest", "?ecosystemPrototype"])(
    "routes %s directly to the current ecosystem playtest",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemPrototype: true,
        publicAlphaRoute: false,
      });
    },
  );

  it.each(["?legacy", "?perf", "?perfHarness&tiles=1200", "?stress&perf&tiles=1200", "?hazardHarness", "?fieldShape"])(
    "routes retired legacy alias %s to the ecosystem title",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemPrototype: false,
        publicAlphaRoute: true,
      });
    },
  );

  it("lets an explicit alpha route override legacy harness parameters", () => {
    expect(resolveGameRoute("?alpha&perf")).toEqual({
      useEcosystemPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it("routes a retired-alias combination to the current title", () => {
    expect(resolveGameRoute("?legacy&alpha&redesign")).toEqual({
      useEcosystemPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it("isolates the ecosystem factory prototype from both existing game surfaces", () => {
    expect(resolveGameRoute("?redesign&ecosystemPrototype&playtest")).toEqual({
      useEcosystemPrototype: true,
      publicAlphaRoute: false,
    });
  });

  it("ignores the retired legacy alias when the ecosystem prototype is explicit", () => {
    expect(resolveGameRoute("?legacy&ecosystemPrototype")).toEqual({
      useEcosystemPrototype: true,
      publicAlphaRoute: false,
    });
  });
});
