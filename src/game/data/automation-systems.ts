import { MAX_GRASS_TOUCH_AMOUNT, normalizeGrassTouches } from "../systems/AmountSystem";
import { getAutomationDirectiveTuning } from "../systems/AutomationDirectiveSystem";
import { getAutomationSystemMilestoneMultiplier } from "../systems/AutomationMilestoneSystem";
import type { AutomationSystemId, GameState, RuntimeStats } from "../types/game-state";

export interface AutomationSystemDefinition {
  id: AutomationSystemId;
  name: string;
  description: string;
  baseTouchesPerMinute: number;
  baseCost: number;
  costGrowth: number;
  isUnlocked(state: GameState): boolean;
}

export interface AutomationOutputContext {
  diversityMultiplier: number;
  globalMultiplier: number;
  pairSynergyMultiplierBySystem: Partial<Record<AutomationSystemId, number>>;
  activePairSynergies: ActiveAutomationPairSynergy[];
}

const AUTOMATION_DERIVATIVE_SUPPORT_RATE = 0.35;

export interface AutomationPairSynergyDefinition {
  id: string;
  name: string;
  systemIds: readonly [AutomationSystemId, AutomationSystemId];
}

export interface ActiveAutomationPairSynergy {
  definition: AutomationPairSynergyDefinition;
  multiplier: number;
}

export const AUTOMATION_PAIR_SYNERGIES: AutomationPairSynergyDefinition[] = [
  {
    id: "bloom_cycle",
    name: "Bloom Cycle",
    systemIds: ["sprinkler", "bee_hive"],
  },
  {
    id: "forager_circuit",
    name: "Forager Circuit",
    systemIds: ["field_mouse", "meadow_rabbit"],
  },
  {
    id: "soil_scratch",
    name: "Soil Scratch",
    systemIds: ["earthworm", "chicken"],
  },
  {
    id: "pasture_turnover",
    name: "Pasture Turnover",
    systemIds: ["earthworm", "sheep"],
  },
  {
    id: "grazing_trail",
    name: "Grazing Trail",
    systemIds: ["sheep", "meadow_rabbit"],
  },
];

export const AUTOMATION_SYSTEMS: AutomationSystemDefinition[] = [
  {
    id: "sprinkler",
    name: "Tiny Sprinkler",
    description: "A simple water rhythm that starts the passive Grass Touch engine.",
    baseTouchesPerMinute: 22,
    baseCost: 42,
    costGrowth: 1.15,
    isUnlocked: (state) => hasTinySprinklerStoreUnlock(state),
  },
  {
    id: "field_mouse",
    name: "Field Mouse Route",
    description: "A tiny helper route that makes automation noticeably faster.",
    baseTouchesPerMinute: 46,
    baseCost: 135,
    costGrowth: 1.17,
    isUnlocked: (state) => state.lifetimeGrassTouches >= 120,
  },
  {
    id: "bee_hive",
    name: "Bee Hive Shift",
    description: "A pollination shift that turns passive touches into real income.",
    baseTouchesPerMinute: 82,
    baseCost: 275,
    costGrowth: 1.18,
    isUnlocked: (state) => state.seedShopPurchases.field_journal === true || state.lifetimeGrassTouches >= 240,
  },
  {
    id: "earthworm",
    name: "Earthworm Crew",
    description: "Quiet underground work that starts pushing manual touching aside.",
    baseTouchesPerMinute: 140,
    baseCost: 500,
    costGrowth: 1.19,
    isUnlocked: (state) => state.lifetimeGrassTouches >= 420,
  },
  {
    id: "chicken",
    name: "Chicken Patrol",
    description: "A busy patrol that pecks out a serious stream of automation.",
    baseTouchesPerMinute: 230,
    baseCost: 780,
    costGrowth: 1.2,
    isUnlocked: (state) => state.lifetimeGrassTouches >= 700,
  },
  {
    id: "sheep",
    name: "Sheep Grazing Loop",
    description: "Broad grazing that makes passive Grass Touches feel dominant.",
    baseTouchesPerMinute: 360,
    baseCost: 1250,
    costGrowth: 1.21,
    isUnlocked: (state) => state.lifetimeGrassTouches >= 1200,
  },
  {
    id: "meadow_rabbit",
    name: "Meadow Rabbit Circuit",
    description: "Fast late-early automation that turns the lawn into a running engine.",
    baseTouchesPerMinute: 560,
    baseCost: 1950,
    costGrowth: 1.22,
    isUnlocked: (state) => state.lifetimeGrassTouches >= 1900,
  },
];

export function hasTinySprinklerStoreUnlock(state: GameState): boolean {
  return state.seedShopPurchases.sprinkler === true || (state.upgrades.sprinkler_calibration?.level ?? 0) > 0;
}

export function getAutomationSystemDefinition(id: string): AutomationSystemDefinition | undefined {
  return AUTOMATION_SYSTEMS.find((system) => system.id === id);
}

export function getAutomationSystemOwned(state: GameState, systemId: string): number {
  return Math.max(0, Math.floor(state.automationSystems?.[systemId]?.owned ?? 0));
}

export function getAutomationSystemDerivativeSupport(state: GameState, systemId: AutomationSystemId): number {
  const systemIndex = AUTOMATION_SYSTEMS.findIndex((system) => system.id === systemId);
  const supportingSystem = systemIndex >= 0 ? AUTOMATION_SYSTEMS[systemIndex + 1] : undefined;
  const owned = getAutomationSystemOwned(state, systemId);
  if (!supportingSystem || owned <= 0) {
    return 0;
  }

  return getAutomationSystemOwned(state, supportingSystem.id) * AUTOMATION_DERIVATIVE_SUPPORT_RATE;
}

export function getAutomationSystemEffectiveOwned(state: GameState, systemId: AutomationSystemId): number {
  return getAutomationSystemOwned(state, systemId) + getAutomationSystemDerivativeSupport(state, systemId);
}

export function getAutomationSystemCost(system: AutomationSystemDefinition, owned: number): number {
  return normalizeGrassTouches(Math.ceil(system.baseCost * system.costGrowth ** owned), MAX_GRASS_TOUCH_AMOUNT);
}

export function getAutomationOutputContext(state: GameState, stats?: RuntimeStats): AutomationOutputContext {
  const diversityBonus = stats?.automationDiversityBonus ?? 0;
  const activeSystemTypes =
    diversityBonus > 0 ? AUTOMATION_SYSTEMS.reduce((total, system) => total + (getAutomationSystemOwned(state, system.id) > 0 ? 1 : 0), 0) : 0;
  const diversityMultiplier = diversityBonus > 0 ? 1 + Math.max(0, activeSystemTypes - 1) * diversityBonus : 1;
  const activePairSynergies = getActiveAutomationPairSynergies(state, stats);
  const pairSynergyMultiplierBySystem: Partial<Record<AutomationSystemId, number>> = {};

  for (const synergy of activePairSynergies) {
    for (const systemId of synergy.definition.systemIds) {
      pairSynergyMultiplierBySystem[systemId] = (pairSynergyMultiplierBySystem[systemId] ?? 1) * synergy.multiplier;
    }
  }

  return {
    diversityMultiplier,
    globalMultiplier: stats?.automationGlobalMultiplier ?? 1,
    pairSynergyMultiplierBySystem,
    activePairSynergies,
  };
}

export function getActiveAutomationPairSynergies(state: GameState, stats?: RuntimeStats): ActiveAutomationPairSynergy[] {
  const pairBonus = stats?.automationPairSynergyBonus ?? 0;
  if (pairBonus <= 0) {
    return [];
  }

  return AUTOMATION_PAIR_SYNERGIES.flatMap((definition) => {
    const pairedUnits = Math.min(...definition.systemIds.map((systemId) => getAutomationSystemOwned(state, systemId)));
    if (pairedUnits <= 0) {
      return [];
    }

    return [
      {
        definition,
        multiplier: 1 + Math.min(0.6, pairedUnits * pairBonus),
      },
    ];
  });
}

export function getAutomationSystemPairSynergyLabel(
  state: GameState,
  systemId: AutomationSystemId,
  stats?: RuntimeStats,
): string {
  const activeSynergies = getActiveAutomationPairSynergies(state, stats).filter((synergy) => synergy.definition.systemIds.includes(systemId));
  if (activeSynergies.length === 0) {
    return "";
  }

  return activeSynergies.map((synergy) => `${synergy.definition.name} x${synergy.multiplier.toFixed(2)}`).join(", ");
}

export function getAutomationPairSynergyPower(state: GameState, synergyId: string, stats?: RuntimeStats): number {
  const synergy = getActiveAutomationPairSynergies(state, stats).find((candidate) => candidate.definition.id === synergyId);
  return synergy ? synergy.multiplier - 1 : 0;
}

export function getAutomationSystemTouchesPerMinute(
  state: GameState,
  system: AutomationSystemDefinition,
  stats?: RuntimeStats,
  context = getAutomationOutputContext(state, stats),
): number {
  const effectiveOwned = getAutomationSystemEffectiveOwned(state, system.id);
  if (effectiveOwned <= 0) {
    return 0;
  }

  const systemMultiplier = stats?.automationSystemMultipliers[system.id] ?? 1;
  const milestoneMultiplier = getAutomationSystemMilestoneMultiplier(state, system.id);
  const pairMultiplier = context.pairSynergyMultiplierBySystem[system.id] ?? 1;
  return effectiveOwned * system.baseTouchesPerMinute * milestoneMultiplier * systemMultiplier * context.diversityMultiplier * pairMultiplier;
}

export function getTotalAutomationTouchesPerMinute(state: GameState, stats?: RuntimeStats, context = getAutomationOutputContext(state, stats)): number {
  const baseOutput = AUTOMATION_SYSTEMS.reduce((total, system) => {
    return total + getAutomationSystemTouchesPerMinute(state, system, stats, context);
  }, 0);
  return baseOutput * context.globalMultiplier * getAutomationDirectiveTuning(state).touchOutputMultiplier;
}
