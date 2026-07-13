export interface GameRouteMode {
  publicAlphaRoute: boolean;
  useRedesignPrototype: boolean;
  useEcosystemPrototype: boolean;
}

const REDESIGN_DEVELOPER_PARAMS = ["redesign", "newRun"] as const;
const LEGACY_HARNESS_PARAMS = ["perf", "perfHarness", "stress", "hazardHarness", "fieldShape", "mobileTest"] as const;

function hasAnyParam(params: URLSearchParams, names: readonly string[]): boolean {
  return names.some((name) => params.has(name));
}

export function resolveGameRoute(search: string): GameRouteMode {
  const params = new URLSearchParams(search);
  const forceLegacy = params.has("legacy");
  const useEcosystemPrototype = !forceLegacy && params.has("ecosystemPrototype");
  const explicitPublicAlpha = params.has("alpha");
  const developerRedesignRoute = hasAnyParam(params, REDESIGN_DEVELOPER_PARAMS);
  const legacyHarnessRoute = hasAnyParam(params, LEGACY_HARNESS_PARAMS);
  const useRedesignPrototype = !useEcosystemPrototype && !forceLegacy && (explicitPublicAlpha || developerRedesignRoute || !legacyHarnessRoute);

  return {
    useEcosystemPrototype,
    useRedesignPrototype,
    publicAlphaRoute: useRedesignPrototype && !developerRedesignRoute,
  };
}
