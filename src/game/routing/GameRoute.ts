export interface GameRouteMode {
  publicAlphaRoute: boolean;
  useEcosystemPrototype: boolean;
}

export function resolveGameRoute(search: string): GameRouteMode {
  const params = new URLSearchParams(search);
  const useEcosystemPrototype = params.has("ecosystemPrototype") || params.has("playtest");

  return {
    useEcosystemPrototype,
    publicAlphaRoute: !useEcosystemPrototype,
  };
}
