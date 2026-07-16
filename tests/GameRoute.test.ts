import { describe, expect, it } from "vitest";

import { resolveGameRoute } from "../src/game/routing/GameRoute";

describe("resolveGameRoute", () => {
  it("launches the ecosystem title screen from the bare production URL", () => {
    expect(resolveGameRoute("")).toEqual({
      useEcosystemTitle: true,
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it("keeps alpha as an explicit ecosystem title alias", () => {
    expect(resolveGameRoute("?alpha")).toEqual({
      useEcosystemTitle: true,
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it.each(["?redesign", "?newRun", "?redesign&playtest"])(
    "keeps %s as an internal redesign route",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemTitle: false,
        useEcosystemPrototype: false,
        useRedesignPrototype: true,
        publicAlphaRoute: false,
      });
    },
  );

  it("preserves the old game behind an explicit legacy route", () => {
    expect(resolveGameRoute("?legacy")).toEqual({
      useEcosystemTitle: false,
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });

  it.each(["?perf", "?perfHarness&tiles=1200", "?stress&perf&tiles=1200", "?hazardHarness", "?fieldShape"])(
    "keeps the existing legacy harness route %s working",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemTitle: false,
        useEcosystemPrototype: false,
        useRedesignPrototype: false,
        publicAlphaRoute: false,
      });
    },
  );

  it("lets an explicit alpha route override legacy harness parameters", () => {
    expect(resolveGameRoute("?alpha&perf")).toEqual({
      useEcosystemTitle: true,
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: true,
    });
  });

  it("gives the explicit legacy fallback highest priority", () => {
    expect(resolveGameRoute("?legacy&alpha&redesign")).toEqual({
      useEcosystemTitle: false,
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });

  it("isolates the ecosystem factory prototype from both existing game surfaces", () => {
    expect(resolveGameRoute("?redesign&ecosystemPrototype&playtest")).toEqual({
      useEcosystemTitle: false,
      useEcosystemPrototype: true,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });

  it("still gives the explicit legacy route priority over the ecosystem prototype", () => {
    expect(resolveGameRoute("?legacy&ecosystemPrototype")).toEqual({
      useEcosystemTitle: false,
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });
});
