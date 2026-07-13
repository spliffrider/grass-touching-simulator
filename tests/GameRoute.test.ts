import { describe, expect, it } from "vitest";

import { resolveGameRoute } from "../src/game/routing/GameRoute";

describe("resolveGameRoute", () => {
  it("launches the public redesign alpha from the bare production URL", () => {
    expect(resolveGameRoute("")).toEqual({
      useEcosystemPrototype: false,
      useRedesignPrototype: true,
      publicAlphaRoute: true,
    });
  });

  it("keeps alpha as an explicit public redesign alias", () => {
    expect(resolveGameRoute("?alpha")).toEqual({
      useEcosystemPrototype: false,
      useRedesignPrototype: true,
      publicAlphaRoute: true,
    });
  });

  it.each(["?redesign", "?newRun", "?redesign&playtest"])(
    "keeps %s as an internal redesign route",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemPrototype: false,
        useRedesignPrototype: true,
        publicAlphaRoute: false,
      });
    },
  );

  it("preserves the old game behind an explicit legacy route", () => {
    expect(resolveGameRoute("?legacy")).toEqual({
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });

  it.each(["?perf", "?perfHarness&tiles=1200", "?stress&perf&tiles=1200", "?hazardHarness", "?fieldShape"])(
    "keeps the existing legacy harness route %s working",
    (search) => {
      expect(resolveGameRoute(search)).toEqual({
        useEcosystemPrototype: false,
        useRedesignPrototype: false,
        publicAlphaRoute: false,
      });
    },
  );

  it("lets an explicit alpha route override legacy harness parameters", () => {
    expect(resolveGameRoute("?alpha&perf")).toEqual({
      useEcosystemPrototype: false,
      useRedesignPrototype: true,
      publicAlphaRoute: true,
    });
  });

  it("gives the explicit legacy fallback highest priority", () => {
    expect(resolveGameRoute("?legacy&alpha&redesign")).toEqual({
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });

  it("isolates the ecosystem factory prototype from both existing game surfaces", () => {
    expect(resolveGameRoute("?redesign&ecosystemPrototype&playtest")).toEqual({
      useEcosystemPrototype: true,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });

  it("still gives the explicit legacy route priority over the ecosystem prototype", () => {
    expect(resolveGameRoute("?legacy&ecosystemPrototype")).toEqual({
      useEcosystemPrototype: false,
      useRedesignPrototype: false,
      publicAlphaRoute: false,
    });
  });
});
