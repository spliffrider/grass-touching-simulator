import type { CharacterClassId, GameState, GrassTierId } from "../types/game-state";

export interface QuestReward {
  grassTouches?: number;
  seeds?: number;
  gold?: number;
}

export interface QuestDefinition {
  id: string;
  category: string;
  name: string;
  description: string;
  reward: QuestReward;
  classId?: CharacterClassId;
  prerequisiteQuestIds?: string[];
  isComplete(state: GameState): boolean;
  getProgress(state: GameState): string;
}

const countFieldTiles = (state: GameState): number => Object.keys(state.field).length;
const countSeedShopPurchases = (state: GameState): number => Object.values(state.seedShopPurchases).filter(Boolean).length;
const getUpgradeLevel = (state: GameState, upgradeId: string): number => state.upgrades[upgradeId]?.level ?? 0;
const countUpgradeLevels = (state: GameState): number =>
  Object.values(state.upgrades).reduce((total, upgrade) => total + upgrade.level, 0);
const getInventoryQuantity = (state: GameState, itemId: string): number => state.inventory[itemId]?.quantity ?? 0;
const countAnimals = (state: GameState): number =>
  Object.values(state.inventory).reduce((total, entry) => total + (entry.kind === "animal" ? entry.quantity : 0), 0);
const hasDiscoveredGrassTier = (state: GameState, tier: GrassTierId): boolean => state.journal.discoveredGrassTiers.includes(tier);
const countDiscoveredGrassTiers = (state: GameState): number => state.journal.discoveredGrassTiers.length;
const getClassName = (classId: CharacterClassId): string => (classId === "femboy_slim" ? "Femboy Slim" : "Bard De Wever");

export const QUESTS: QuestDefinition[] = [
  {
    id: "touch_25",
    category: "Touching",
    name: "Touch Grass, Actually",
    description: "Reach 25 lifetime Grass Touches.",
    reward: { seeds: 1 },
    isComplete: (state) => state.lifetimeGrassTouches >= 25,
    getProgress: (state) => `${Math.min(25, Math.floor(state.lifetimeGrassTouches))}/25 touches`,
  },
  {
    id: "touch_100",
    category: "Touching",
    name: "Patch Familiarity",
    description: "Reach 100 lifetime Grass Touches.",
    reward: { seeds: 2, gold: 1 },
    prerequisiteQuestIds: ["touch_25"],
    isComplete: (state) => state.lifetimeGrassTouches >= 100,
    getProgress: (state) => `${Math.min(100, Math.floor(state.lifetimeGrassTouches))}/100 touches`,
  },
  {
    id: "touch_250",
    category: "Touching",
    name: "A Reasonable Afternoon",
    description: "Reach 250 lifetime Grass Touches.",
    reward: { seeds: 4, gold: 1 },
    prerequisiteQuestIds: ["touch_100"],
    isComplete: (state) => state.lifetimeGrassTouches >= 250,
    getProgress: (state) => `${Math.min(250, Math.floor(state.lifetimeGrassTouches))}/250 touches`,
  },
  {
    id: "touch_700",
    category: "Touching",
    name: "Palm Memory",
    description: "Reach 700 lifetime Grass Touches.",
    reward: { seeds: 6, gold: 2 },
    prerequisiteQuestIds: ["touch_250"],
    isComplete: (state) => state.lifetimeGrassTouches >= 700,
    getProgress: (state) => `${Math.min(700, Math.floor(state.lifetimeGrassTouches))}/700 touches`,
  },
  {
    id: "touch_1500",
    category: "Touching",
    name: "Lawn Conversationalist",
    description: "Reach 1,500 lifetime Grass Touches.",
    reward: { seeds: 8, gold: 3 },
    prerequisiteQuestIds: ["touch_700"],
    isComplete: (state) => state.lifetimeGrassTouches >= 1500,
    getProgress: (state) => `${Math.min(1500, Math.floor(state.lifetimeGrassTouches))}/1,500 touches`,
  },
  {
    id: "touch_4200",
    category: "Touching",
    name: "Horizon Handshake",
    description: "Reach 4,200 lifetime Grass Touches.",
    reward: { seeds: 12, gold: 5 },
    prerequisiteQuestIds: ["touch_1500"],
    isComplete: (state) => state.lifetimeGrassTouches >= 4200,
    getProgress: (state) => `${Math.min(4200, Math.floor(state.lifetimeGrassTouches))}/4,200 touches`,
  },
  {
    id: "field_9",
    category: "Field",
    name: "A Lawn, Technically",
    description: "Grow the field to 9 patches.",
    reward: { seeds: 2 },
    prerequisiteQuestIds: ["touch_25"],
    isComplete: (state) => countFieldTiles(state) >= 9,
    getProgress: (state) => `${Math.min(9, countFieldTiles(state))}/9 patches`,
  },
  {
    id: "field_25",
    category: "Field",
    name: "Patchwork Begins",
    description: "Grow the field to 25 patches.",
    reward: { seeds: 3, gold: 1 },
    prerequisiteQuestIds: ["field_9"],
    isComplete: (state) => countFieldTiles(state) >= 25,
    getProgress: (state) => `${Math.min(25, countFieldTiles(state))}/25 patches`,
  },
  {
    id: "field_60",
    category: "Field",
    name: "Backyard Credentials",
    description: "Grow the field to 60 patches.",
    reward: { seeds: 5, gold: 2 },
    prerequisiteQuestIds: ["field_25"],
    isComplete: (state) => countFieldTiles(state) >= 60,
    getProgress: (state) => `${Math.min(60, countFieldTiles(state))}/60 patches`,
  },
  {
    id: "field_140",
    category: "Field",
    name: "Meadow Paperwork",
    description: "Grow the field to 140 patches.",
    reward: { seeds: 9, gold: 3 },
    prerequisiteQuestIds: ["field_60"],
    isComplete: (state) => countFieldTiles(state) >= 140,
    getProgress: (state) => `${Math.min(140, countFieldTiles(state))}/140 patches`,
  },
  {
    id: "milestone_3",
    category: "Milestones",
    name: "Three Little Spreads",
    description: "Reach 3 field expansion milestones.",
    reward: { seeds: 4 },
    prerequisiteQuestIds: ["field_25"],
    isComplete: (state) => state.reachedMilestones.length >= 3,
    getProgress: (state) => `${Math.min(3, state.reachedMilestones.length)}/3 milestones`,
  },
  {
    id: "milestone_6",
    category: "Milestones",
    name: "The Lawn Has Momentum",
    description: "Reach 6 field expansion milestones.",
    reward: { seeds: 7, gold: 2 },
    prerequisiteQuestIds: ["milestone_3"],
    isComplete: (state) => state.reachedMilestones.length >= 6,
    getProgress: (state) => `${Math.min(6, state.reachedMilestones.length)}/6 milestones`,
  },
  {
    id: "milestone_10",
    category: "Milestones",
    name: "A Regional Situation",
    description: "Reach 10 field expansion milestones.",
    reward: { seeds: 12, gold: 5 },
    prerequisiteQuestIds: ["milestone_6"],
    isComplete: (state) => state.reachedMilestones.length >= 10,
    getProgress: (state) => `${Math.min(10, state.reachedMilestones.length)}/10 milestones`,
  },
  {
    id: "seed_10",
    category: "Economy",
    name: "Seed Pocket",
    description: "Collect 10 lifetime seeds.",
    reward: { gold: 1 },
    prerequisiteQuestIds: ["touch_25"],
    isComplete: (state) => state.lifetimeSeeds >= 10,
    getProgress: (state) => `${Math.min(10, Math.floor(state.lifetimeSeeds))}/10 seeds`,
  },
  {
    id: "seed_50",
    category: "Economy",
    name: "Seed Drawer",
    description: "Collect 50 lifetime seeds.",
    reward: { gold: 3 },
    prerequisiteQuestIds: ["seed_10"],
    isComplete: (state) => state.lifetimeSeeds >= 50,
    getProgress: (state) => `${Math.min(50, Math.floor(state.lifetimeSeeds))}/50 seeds`,
  },
  {
    id: "seed_150",
    category: "Economy",
    name: "Seed Logistics",
    description: "Collect 150 lifetime seeds.",
    reward: { gold: 5 },
    prerequisiteQuestIds: ["seed_50"],
    isComplete: (state) => state.lifetimeSeeds >= 150,
    getProgress: (state) => `${Math.min(150, Math.floor(state.lifetimeSeeds))}/150 seeds`,
  },
  {
    id: "gold_5",
    category: "Economy",
    name: "A Suspicious Shine",
    description: "Collect 5 lifetime gold.",
    reward: { seeds: 3 },
    prerequisiteQuestIds: ["seed_10"],
    isComplete: (state) => state.lifetimeGold >= 5,
    getProgress: (state) => `${Math.min(5, Math.floor(state.lifetimeGold))}/5 gold`,
  },
  {
    id: "gold_25",
    category: "Economy",
    name: "Pocket Glitter",
    description: "Collect 25 lifetime gold.",
    reward: { seeds: 5 },
    prerequisiteQuestIds: ["gold_5"],
    isComplete: (state) => state.lifetimeGold >= 25,
    getProgress: (state) => `${Math.min(25, Math.floor(state.lifetimeGold))}/25 gold`,
  },
  {
    id: "gold_75",
    category: "Economy",
    name: "Tiny Treasury",
    description: "Collect 75 lifetime gold.",
    reward: { seeds: 9 },
    prerequisiteQuestIds: ["gold_25"],
    isComplete: (state) => state.lifetimeGold >= 75,
    getProgress: (state) => `${Math.min(75, Math.floor(state.lifetimeGold))}/75 gold`,
  },
  {
    id: "seed_pouch_owner",
    category: "Seed Shop",
    name: "Prepared Pockets",
    description: "Buy the Seed Pouch.",
    reward: { seeds: 1 },
    prerequisiteQuestIds: ["seed_10"],
    isComplete: (state) => state.seedShopPurchases.seed_pouch === true,
    getProgress: (state) => (state.seedShopPurchases.seed_pouch ? "Seed Pouch bought" : "Not bought yet"),
  },
  {
    id: "sprinkler_owner",
    category: "Seed Shop",
    name: "Responsible Hydration",
    description: "Buy the Tiny Sprinkler.",
    reward: { gold: 2 },
    prerequisiteQuestIds: ["seed_pouch_owner"],
    isComplete: (state) => state.seedShopPurchases.sprinkler === true,
    getProgress: (state) => (state.seedShopPurchases.sprinkler ? "Sprinkler bought" : "Not bought yet"),
  },
  {
    id: "field_journal_owner",
    category: "Seed Shop",
    name: "Field Notes",
    description: "Buy the Field Journal.",
    reward: { seeds: 3, gold: 1 },
    prerequisiteQuestIds: ["seed_pouch_owner"],
    isComplete: (state) => state.seedShopPurchases.field_journal === true,
    getProgress: (state) => (state.seedShopPurchases.field_journal ? "Field Journal bought" : "Not bought yet"),
  },
  {
    id: "grass_specimens_4",
    category: "Field Journal",
    name: "Specimen Sampler",
    description: "Discover 4 grass tiers in the Field Journal.",
    reward: { seeds: 5, gold: 2 },
    prerequisiteQuestIds: ["field_journal_owner"],
    isComplete: (state) => countDiscoveredGrassTiers(state) >= 4,
    getProgress: (state) => `${Math.min(4, countDiscoveredGrassTiers(state))}/4 grass tiers`,
  },
  {
    id: "wildflower_specimen",
    category: "Field Journal",
    name: "Tiny Meadow Moment",
    description: "Discover Wildflower Grass.",
    reward: { seeds: 7, gold: 3 },
    prerequisiteQuestIds: ["grass_specimens_4", "touch_700"],
    isComplete: (state) => hasDiscoveredGrassTier(state, "wildflower"),
    getProgress: (state) => (hasDiscoveredGrassTier(state, "wildflower") ? "Wildflower Grass recorded" : "Not recorded yet"),
  },
  {
    id: "moss_specimen",
    category: "Field Journal",
    name: "Soft Evidence",
    description: "Discover Moss Grass.",
    reward: { seeds: 8, gold: 3 },
    prerequisiteQuestIds: ["wildflower_specimen", "touch_1500"],
    isComplete: (state) => hasDiscoveredGrassTier(state, "moss"),
    getProgress: (state) => (hasDiscoveredGrassTier(state, "moss") ? "Moss Grass recorded" : "Not recorded yet"),
  },
  {
    id: "mushroom_specimen",
    category: "Field Journal",
    name: "Spore Documentation",
    description: "Discover Mushroom Grass.",
    reward: { seeds: 10, gold: 4 },
    prerequisiteQuestIds: ["moss_specimen", "touch_4200"],
    isComplete: (state) => hasDiscoveredGrassTier(state, "mushroom"),
    getProgress: (state) => (hasDiscoveredGrassTier(state, "mushroom") ? "Mushroom Grass recorded" : "Not recorded yet"),
  },
  {
    id: "crystal_specimen",
    category: "Field Journal",
    name: "Crunchy Sparkle Notes",
    description: "Discover Crystal Grass.",
    reward: { seeds: 12, gold: 5 },
    prerequisiteQuestIds: ["mushroom_specimen"],
    isComplete: (state) => hasDiscoveredGrassTier(state, "crystal"),
    getProgress: (state) => (hasDiscoveredGrassTier(state, "crystal") ? "Crystal Grass recorded" : "Not recorded yet"),
  },
  {
    id: "frost_specimen",
    category: "Field Journal",
    name: "Cold Lawn Theory",
    description: "Discover Frost Grass.",
    reward: { seeds: 15, gold: 7 },
    prerequisiteQuestIds: ["crystal_specimen"],
    isComplete: (state) => hasDiscoveredGrassTier(state, "frost"),
    getProgress: (state) => (hasDiscoveredGrassTier(state, "frost") ? "Frost Grass recorded" : "Not recorded yet"),
  },
  {
    id: "grass_specimens_9",
    category: "Field Journal",
    name: "Lawn Completionist",
    description: "Discover all 9 grass tiers.",
    reward: { seeds: 18, gold: 8 },
    prerequisiteQuestIds: ["frost_specimen"],
    isComplete: (state) => countDiscoveredGrassTiers(state) >= 9,
    getProgress: (state) => `${Math.min(9, countDiscoveredGrassTiers(state))}/9 grass tiers`,
  },
  {
    id: "first_hybrid",
    category: "Field Journal",
    name: "Accidental Botany",
    description: "Let adjacent grass tiers create 1 hybrid mutation event.",
    reward: { seeds: 5, gold: 2 },
    prerequisiteQuestIds: ["grass_specimens_4", "touch_700"],
    isComplete: (state) => state.mutationEvents >= 1,
    getProgress: (state) => `${Math.min(1, state.mutationEvents)}/1 hybrid events`,
  },
  {
    id: "hybrid_8",
    category: "Field Journal",
    name: "Cross-Breeding Notes",
    description: "Let adjacent grass tiers create 8 hybrid mutation events.",
    reward: { seeds: 10, gold: 4 },
    prerequisiteQuestIds: ["first_hybrid"],
    isComplete: (state) => state.mutationEvents >= 8,
    getProgress: (state) => `${Math.min(8, state.mutationEvents)}/8 hybrid events`,
  },
  {
    id: "wild_spread_owner",
    category: "Seed Shop",
    name: "Let It Wander",
    description: "Buy Wild Spread.",
    reward: { seeds: 4, gold: 1 },
    prerequisiteQuestIds: ["sprinkler_owner"],
    isComplete: (state) => state.seedShopPurchases.wild_spread === true,
    getProgress: (state) => (state.seedShopPurchases.wild_spread ? "Wild Spread bought" : "Not bought yet"),
  },
  {
    id: "weather_jar_owner",
    category: "Seed Shop",
    name: "Sky In A Jar",
    description: "Buy the Weather Jar.",
    reward: { seeds: 5, gold: 2 },
    prerequisiteQuestIds: ["field_journal_owner"],
    isComplete: (state) => state.seedShopPurchases.weather_jar === true,
    getProgress: (state) => (state.seedShopPurchases.weather_jar ? "Weather Jar bought" : "Not bought yet"),
  },
  {
    id: "shop_collector_5",
    category: "Seed Shop",
    name: "Shelf Confidence",
    description: "Buy 5 different seed shop upgrades.",
    reward: { seeds: 6, gold: 3 },
    prerequisiteQuestIds: ["wild_spread_owner", "weather_jar_owner"],
    isComplete: (state) => countSeedShopPurchases(state) >= 5,
    getProgress: (state) => `${Math.min(5, countSeedShopPurchases(state))}/5 seed shop upgrades`,
  },
  {
    id: "sprinkler_timer_owner",
    category: "Seed Shop",
    name: "Prompt Hydration",
    description: "Buy the Sprinkler Timer.",
    reward: { seeds: 7, gold: 3 },
    prerequisiteQuestIds: ["shop_collector_5"],
    isComplete: (state) => state.seedShopPurchases.sprinkler_timer === true,
    getProgress: (state) => (state.seedShopPurchases.sprinkler_timer ? "Sprinkler Timer bought" : "Not bought yet"),
  },
  {
    id: "clover_press_owner",
    category: "Seed Shop",
    name: "Pressed Luck",
    description: "Buy the Clover Press.",
    reward: { seeds: 8, gold: 3 },
    prerequisiteQuestIds: ["shop_collector_5"],
    isComplete: (state) => state.seedShopPurchases.clover_press === true,
    getProgress: (state) => (state.seedShopPurchases.clover_press ? "Clover Press bought" : "Not bought yet"),
  },
  {
    id: "seed_catalog_owner",
    category: "Seed Shop",
    name: "Catalog Brain",
    description: "Buy the Seed Catalog.",
    reward: { seeds: 11, gold: 5 },
    prerequisiteQuestIds: ["wild_spread_owner", "clover_press_owner"],
    isComplete: (state) => state.seedShopPurchases.seed_catalog === true,
    getProgress: (state) => (state.seedShopPurchases.seed_catalog ? "Seed Catalog bought" : "Not bought yet"),
  },
  {
    id: "upgrade_3",
    category: "Skill Tree",
    name: "First Technique",
    description: "Buy 3 total skill levels.",
    reward: { seeds: 1 },
    prerequisiteQuestIds: ["touch_25"],
    isComplete: (state) => countUpgradeLevels(state) >= 3,
    getProgress: (state) => `${Math.min(3, countUpgradeLevels(state))}/3 skill levels`,
  },
  {
    id: "softer_grass_5",
    category: "Skill Tree",
    name: "Gentle Specialist",
    description: "Raise Softer Grass to level 5.",
    reward: { seeds: 2 },
    prerequisiteQuestIds: ["upgrade_3"],
    isComplete: (state) => getUpgradeLevel(state, "softer_grass") >= 5,
    getProgress: (state) => `${Math.min(5, getUpgradeLevel(state, "softer_grass"))}/5 Softer Grass`,
  },
  {
    id: "regrowth_3",
    category: "Skill Tree",
    name: "Patience Upgrade",
    description: "Raise Faster Regrowth to level 3.",
    reward: { seeds: 2 },
    prerequisiteQuestIds: ["softer_grass_5"],
    isComplete: (state) => getUpgradeLevel(state, "faster_regrowth") >= 3,
    getProgress: (state) => `${Math.min(3, getUpgradeLevel(state, "faster_regrowth"))}/3 Faster Regrowth`,
  },
  {
    id: "crit_path_started",
    category: "Skill Tree",
    name: "Dramatic Potential",
    description: "Buy at least 1 level of Lucky Clover.",
    reward: { gold: 1 },
    prerequisiteQuestIds: ["upgrade_3"],
    isComplete: (state) => getUpgradeLevel(state, "lucky_clover") >= 1,
    getProgress: (state) => `${Math.min(1, getUpgradeLevel(state, "lucky_clover"))}/1 Lucky Clover`,
  },
  {
    id: "upgrade_20",
    category: "Skill Tree",
    name: "Constellation Student",
    description: "Buy 20 total skill levels.",
    reward: { seeds: 4, gold: 2 },
    prerequisiteQuestIds: ["regrowth_3", "crit_path_started"],
    isComplete: (state) => countUpgradeLevels(state) >= 20,
    getProgress: (state) => `${Math.min(20, countUpgradeLevels(state))}/20 skill levels`,
  },
  {
    id: "femboy_slay_footwork_1",
    category: "Class",
    name: "Runway On The Lawn",
    description: "As Femboy Slim, buy 1 level of Slay Footwork.",
    reward: { seeds: 5, gold: 2 },
    classId: "femboy_slim",
    prerequisiteQuestIds: ["upgrade_20", "crit_path_started"],
    isComplete: (state) => getUpgradeLevel(state, "slay_footwork") >= 1,
    getProgress: (state) => `${Math.min(1, getUpgradeLevel(state, "slay_footwork"))}/1 Slay Footwork`,
  },
  {
    id: "femboy_perfect_pose_3",
    category: "Class",
    name: "Hold The Pose",
    description: "As Femboy Slim, max out Perfect Pose.",
    reward: { seeds: 8, gold: 4 },
    classId: "femboy_slim",
    prerequisiteQuestIds: ["femboy_slay_footwork_1", "touch_1500"],
    isComplete: (state) => getUpgradeLevel(state, "perfect_pose") >= 3,
    getProgress: (state) => `${Math.min(3, getUpgradeLevel(state, "perfect_pose"))}/3 Perfect Pose`,
  },
  {
    id: "bard_steady_tempo_1",
    category: "Class",
    name: "Find The Groove",
    description: "As Bard De Wever, buy 1 level of Steady Tempo.",
    reward: { seeds: 5, gold: 2 },
    classId: "bard_de_wever",
    prerequisiteQuestIds: ["upgrade_20", "regrowth_3"],
    isComplete: (state) => getUpgradeLevel(state, "steady_tempo") >= 1,
    getProgress: (state) => `${Math.min(1, getUpgradeLevel(state, "steady_tempo"))}/1 Steady Tempo`,
  },
  {
    id: "bard_encore_circle_3",
    category: "Class",
    name: "Encore In The Round",
    description: "As Bard De Wever, max out Encore Circle.",
    reward: { seeds: 8, gold: 4 },
    classId: "bard_de_wever",
    prerequisiteQuestIds: ["bard_steady_tempo_1", "touch_1500"],
    isComplete: (state) => getUpgradeLevel(state, "encore_circle") >= 3,
    getProgress: (state) => `${Math.min(3, getUpgradeLevel(state, "encore_circle"))}/3 Encore Circle`,
  },
  {
    id: "first_animal",
    category: "Companions",
    name: "Small Company",
    description: "Own any animal companion.",
    reward: { seeds: 3, gold: 1 },
    prerequisiteQuestIds: ["gold_5"],
    isComplete: (state) => countAnimals(state) >= 1,
    getProgress: (state) => `${Math.min(1, countAnimals(state))}/1 animals`,
  },
  {
    id: "bee_hive_owner",
    category: "Companions",
    name: "Polite Pollination",
    description: "Own a Bee Hive.",
    reward: { seeds: 5, gold: 1 },
    prerequisiteQuestIds: ["first_animal"],
    isComplete: (state) => getInventoryQuantity(state, "bee_hive") >= 1,
    getProgress: (state) => `${Math.min(1, getInventoryQuantity(state, "bee_hive"))}/1 Bee Hive`,
  },
  {
    id: "animal_3",
    category: "Companions",
    name: "Meadow Staff Meeting",
    description: "Own 3 animal companions.",
    reward: { seeds: 8, gold: 3 },
    prerequisiteQuestIds: ["bee_hive_owner"],
    isComplete: (state) => countAnimals(state) >= 3,
    getProgress: (state) => `${Math.min(3, countAnimals(state))}/3 animals`,
  },
  {
    id: "weather_watching_1",
    category: "Weather",
    name: "Look Up Briefly",
    description: "Buy 1 level of Weather Watching.",
    reward: { seeds: 6, gold: 2 },
    prerequisiteQuestIds: ["weather_jar_owner"],
    isComplete: (state) => getUpgradeLevel(state, "weather_watching") >= 1,
    getProgress: (state) => `${Math.min(1, getUpgradeLevel(state, "weather_watching"))}/1 Weather Watching`,
  },
  {
    id: "rain_barrel_owner",
    category: "Weather",
    name: "Saved Rain",
    description: "Buy the Rain Barrel.",
    reward: { seeds: 7, gold: 3 },
    prerequisiteQuestIds: ["weather_jar_owner"],
    isComplete: (state) => state.seedShopPurchases.rain_barrel === true,
    getProgress: (state) => (state.seedShopPurchases.rain_barrel ? "Rain Barrel bought" : "Not bought yet"),
  },
];

export function formatQuestReward(reward: QuestReward): string {
  return [
    reward.grassTouches ? `${reward.grassTouches} touches` : "",
    reward.seeds ? `${reward.seeds} seeds` : "",
    reward.gold ? `${reward.gold} gold` : "",
  ]
    .filter(Boolean)
    .join(" + ");
}

export function isQuestAvailable(state: GameState, quest: QuestDefinition): boolean {
  return (
    (quest.classId === undefined || quest.classId === state.characterClassId) &&
    (quest.prerequisiteQuestIds ?? []).every((questId) => state.claimedQuestIds.includes(questId))
  );
}

export function isQuestClaimable(state: GameState, quest: QuestDefinition): boolean {
  return isQuestAvailable(state, quest) && quest.isComplete(state) && !state.claimedQuestIds.includes(quest.id);
}

export function formatQuestProgress(quest: QuestDefinition, state: GameState): string {
  if (quest.classId !== undefined && quest.classId !== state.characterClassId) {
    return `Only ${getClassName(quest.classId)} can do this.`;
  }

  if (isQuestAvailable(state, quest)) {
    return quest.getProgress(state);
  }

  const missing = (quest.prerequisiteQuestIds ?? []).filter((questId) => !state.claimedQuestIds.includes(questId));
  const labels = missing
    .map((questId) => QUESTS.find((candidate) => candidate.id === questId)?.name ?? questId)
    .join(", ");
  return `Requires: ${labels}`;
}
