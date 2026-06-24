import Phaser from "phaser";
import { DEFAULT_MUSIC_VOLUME, readStoredMusicVolume, writeStoredMusicVolume } from "../data/audio-settings";
import {
  AUTOMATION_SYSTEMS,
  getActiveAutomationPairSynergies,
  getAutomationOutputContext,
  getAutomationSystemDerivativeSupport,
  getAutomationSystemCost,
  getAutomationSystemOwned,
  getAutomationSystemPairSynergyLabel,
  getAutomationSystemTouchesPerMinute,
  getTotalAutomationTouchesPerMinute,
  type AutomationSystemDefinition,
} from "../data/automation-systems";
import { DEFAULT_CHARACTER_CLASS_ID, getCharacterClass } from "../data/character-classes";
import { GRASS_TIERS, getGrassTier, getNextGrassTier } from "../data/grass-tiers";
import { BUILD_LABEL } from "../data/build-info";
import { GOLD_STORE_ITEMS } from "../data/gold-store";
import { JOURNAL_COMPANION_NOTES, JOURNAL_GRASS_NOTES, JOURNAL_HAZARD_NOTES, JOURNAL_TRAIT_NOTES, JOURNAL_WEATHER_NOTES } from "../data/journal";
import { MILESTONES } from "../data/milestones";
import { QUESTS, formatQuestProgress, formatQuestReward, isQuestAvailable, isQuestClaimable, type QuestDefinition } from "../data/quests";
import { SEED_SHOP_ITEMS, getSeedDropChance } from "../data/seed-shop";
import { getSeasonForDate } from "../data/seasons";
import { UPGRADES, canUnlockUpgrade, getUpgradeCost } from "../data/upgrades";
import { WEATHER_TYPES, getWeather, pickWeather } from "../data/weather";
import {
  createInitialState,
  createTile,
  expandField,
  getFieldBounds,
  getFieldTiles,
  getRegrowingTiles,
  tileKey,
  touchTile,
  updateRegrowth,
  type FieldBounds,
} from "../systems/FieldSystem";
import { addInventoryItem, consumeInventoryItem, getInventoryQuantity } from "../systems/InventorySystem";
import { PLACEMENT_RADIUS, getNearbyPlacedObjectIds, getPlacedObjectAt, placeWorldObject, removeWorldObjectPlacement } from "../systems/PlacementSystem";
import { AnimalCompanionSystem } from "../systems/AnimalCompanionSystem";
import {
  addGrassTouches,
  canAffordGrassTouches,
  formatGrassTouches,
  formatGrassTouchesPerMinute,
  getMissingGrassTouches,
  spendGrassTouches,
} from "../systems/AmountSystem";
import {
  AUTOMATION_DIRECTIVES,
  getAutomationDirective,
  getAutomationDirectiveTuning,
  getResolvedAutomationDirectiveId,
} from "../systems/AutomationDirectiveSystem";
import { AutomationIncomeSystem } from "../systems/AutomationIncomeSystem";
import {
  formatAutomationMultiplier,
  getAutomationMilestoneBoostLabel,
  getAutomationSystemMilestoneMultiplier,
  getAutomationSystemMilestoneLabel,
  getAutomationUnitCount,
  getNextAutomationSystemMilestone,
} from "../systems/AutomationMilestoneSystem";
import { recordAutomationAction, recordAutomationDirectiveUsed } from "../systems/AutomationProgressSystem";
import { AutomationScheduler } from "../systems/AutomationScheduler";
import { AudioSystem } from "../systems/AudioSystem";
import { ChiptuneMusicSystem, TRACK_IDS } from "../systems/ChiptuneMusicSystem";
import { ComboSystem, type ComboResult } from "../systems/ComboSystem";
import { DropSystem, type DropFeedback } from "../systems/DropSystem";
import { HazardSystem, getHazardStatusText, getPrickedRemainingMs, getTileHazard, type MowerEvent } from "../systems/HazardSystem";
import { MutationSystem, type MutationEvent } from "../systems/MutationSystem";
import { loadGame, resetSave, saveGame } from "../systems/SaveSystem";
import { SprinklerSystem } from "../systems/SprinklerSystem";
import { formatPrestigeMultiplier, formatPrestigeProgress, getNextPrestigeState, getPrestigePreview } from "../systems/PrestigeSystem";
import { getJournalCollectionBonuses, getRuntimeStats } from "../systems/UpgradeSystem";
import type {
  AutomationDirectiveId,
  CharacterClassId,
  FieldTile,
  GameState,
  GrassTierId,
  HazardStatsState,
  JournalHazardId,
  RuntimeStats,
  TileKey,
  TileTrait,
  TouchResult,
  WeatherId,
} from "../types/game-state";
import { createTextButton, setTextButtonAttention, setTextButtonEnabled, setTextButtonText } from "../ui/buttons";

const TILE_SIZE = 58;
const TILE_GAP = 8;
const BOARD_Y_OFFSET = 24;
const MIN_BOARD_ZOOM = 0.45;
const MAX_BOARD_ZOOM = 3.2;
const COMPACT_LARGE_FIELD_MIN_BOARD_SCALE = 1.35;
const COMPACT_LARGE_FIELD_MAX_WIDTH = 560;
const TABLET_LARGE_FIELD_MIN_BOARD_SCALE = 1.12;
const TABLET_LARGE_FIELD_MAX_WIDTH = 900;
const BOARD_PAN_THRESHOLD_PX = 18;
const TOUCH_SHAKE_COOLDOWN_MS = 140;
const COMBO_SHAKE_BASE_DURATION_MS = 118;
const COMBO_SHAKE_DURATION_PER_COUNT_MS = 3.2;
const COMBO_SHAKE_BASE_INTENSITY = 0.00175;
const COMBO_SHAKE_INTENSITY_PER_COUNT = 0.00005;
const COMBO_SHAKE_MAX_INTENSITY = 0.00425;
const FULL_UI_REFRESH_INTERVAL_MS = 420;
const READY_STATE_REFRESH_INTERVAL_MS = 520;
const RUNTIME_STATS_CACHE_MS = 250;
const JOURNAL_DISCOVERY_REFRESH_INTERVAL_MS = 1200;
const PERF_PANEL_REFRESH_INTERVAL_MS = 500;
const REGROW_FEEDBACK_INTERVAL_MS = 240;
const MAX_REGROW_FEEDBACK_PER_BATCH = 6;
const PERFORMANCE_SAMPLE_INTERVAL_MS = 600;
const PERF_LOW_FPS = 48;
const PERF_CRITICAL_FPS = 32;
const PERF_RECOVERY_FPS = 57;
const MIN_EFFECT_QUALITY = 0.22;
const EFFECT_QUALITY_STEP = 0.16;
const DISPLAY_OBJECT_PRESSURE_LIMIT = 850;
const DISPLAY_OBJECT_CRITICAL_LIMIT = 1150;
const FRAME_SPIKE_MS = 34;
const PERF_SPIKE_RESET_MS = 2500;
const MAX_BURST_EMITTERS = 14;
const MAX_UI_BURST_EMITTERS = 6;
const COMPACT_TILE_EFFECT_SCALE = 0.56;
const COMBO_BADGE_BUMP_INTERVAL_MS = 120;
const AMBIENT_FEEDBACK_WINDOW_MS = 1000;
const AMBIENT_BURST_PARTICLE_BUDGET = 120;
const AMBIENT_TRANSIENT_OBJECT_BUDGET = 18;
const AMBIENT_POP_TEXT_BUDGET = 7;
const AMBIENT_REWARD_ARC_SPRITE_BUDGET = 6;
const AMBIENT_WORLD_ACTION_ARC_SPRITE_BUDGET = 10;
const AUTO_TOUCH_VISUAL_CREDIT_LIMIT = 7;
const AUTO_TOUCH_VISUAL_SAMPLE_LIMIT = 36;
const AUTO_TOUCH_VISUAL_MIN_INTERVAL_MS = 110;
const AUTO_TOUCH_VISUAL_MAX_INTERVAL_MS = 420;
const AUTO_TOUCH_POP_INTERVAL_MS = 1300;
const AUTO_TOUCH_ACTIVE_OBJECT_LIMIT = 18;
const FIELD_LIFE_VISUAL_INTERVAL_MS = 980;
const FIELD_LIFE_SWEEP_INTERVAL_MS = 5200;
const FIELD_LIFE_VISUAL_MIN_VISIBLE_TILES = 16;
const FIELD_LIFE_VISUAL_SAMPLE_LIMIT = 38;
const FIELD_LIFE_VISUAL_MAX_SPARKS = 3;
const FIELD_LIFE_ACTIVE_OBJECT_LIMIT = 12;
const FIELD_LIFE_SWEEP_MIN_PATCHES = 220;
const FIELD_LIFE_MIN_BOARD_SCALE = 0.14;
const QUEUED_SAVE_INTERVAL_MS = 6500;
const AUTO_SAVE_INTERVAL_MS = 20000;
const IDLE_SAVE_TIMEOUT_MS = 2400;
const FALLBACK_SAVE_DELAY_MS = 160;
const BUSY_SAVE_RETRY_MS = 700;
const QUEST_CLIPBOARD_INTERVAL_MS = 9000;
const QUEST_CLIPBOARD_MAX_CLAIMS = 2;
const TILE_CULL_MARGIN_PX = 96;
const COMPACT_LARGE_FIELD_CULL_MARGIN_PX = 8;
const TABLET_LARGE_FIELD_CULL_MARGIN_PX = 24;
const TILE_VIEW_POOL_LIMIT = 36;
const DIRTY_TILE_VIEW_LIMIT = 96;
const LARGE_FIELD_DIRTY_TILE_VIEW_LIMIT = 48;
const COMPACT_LARGE_FIELD_DIRTY_TILE_VIEW_LIMIT = 32;
const PRESSURE_DIRTY_TILE_VIEW_LIMIT = 24;
const COMPACT_PRESSURE_DIRTY_TILE_VIEW_LIMIT = 16;
const COMMON_REDRAW_MOBILE_TILE_LIMIT = 160;
const COMMON_REDRAW_FRAME_BUDGET_MS = 1.6;
const COMMON_REDRAW_TILE_BUDGET = 8;
const PRESSURE_COMMON_REDRAW_FRAME_BUDGET_MS = 0.9;
const PRESSURE_COMMON_REDRAW_TILE_BUDGET = 4;
const PANEL_UI_REFRESH_INTERVAL_MS = 1000;
const WORLD_OBJECT_UI_REFRESH_INTERVAL_MS = 900;
const HUD_GRASS_TOUCH_GROUPS_PER_LINE = 9;
const MAX_ACTIVE_POP_TEXTS = 18;
const PERF_HARNESS_IDLE_DELAY_MS = 900;
const PERF_HARNESS_PHASE_DELAY_MS = 800;
const PERF_HARNESS_TAP_COUNT = 14;
const HUD_CHIP_HEIGHT = 48;
const HUD_CHIP_COMPACT_HEIGHT = 42;
const HUD_CHIP_GAP = 8;
const TRIGGER_FEED_MAX_EVENTS = 6;
const TRIGGER_FEED_EVENT_TTL_MS = 90000;
const TRIGGER_FEED_REPEAT_WINDOW_MS = 12000;
const TRIGGER_FEED_WIDTH = 246;
const TRIGGER_FEED_ROW_HEIGHT = 54;
const MOBILE_COMMAND_DOCK_PADDING = 10;
const UI_ACTION_ICONS = {
  skills: "SK",
  quests: "Q",
  seeds: "SE",
  store: "ST",
  automation: "AI",
  journal: "J",
  options: "OP",
} as const;

function formatAutomationSupportUnits(support: number): string {
  return support >= 10 ? support.toFixed(0) : support.toFixed(1);
}

function formatAutomationSupportText(support: number): string {
  return support > 0 ? `Support +${formatAutomationSupportUnits(support)}` : "";
}

function getAutomationPreviewState(state: GameState, systemId: string, owned: number): GameState {
  return {
    ...state,
    automationSystems: {
      ...state.automationSystems,
      [systemId]: { owned },
    },
  };
}

function formatAutomationOutputDelta(currentOutput: number, previewOutput: number): string {
  const delta = previewOutput - currentOutput;
  return delta > 0 ? `+${formatGrassTouchesPerMinute(delta)}` : "+0/min";
}

function formatHudGrassTouches(value: number): string {
  const formatted = formatGrassTouches(value);
  const groups = formatted.split(",");
  if (groups.length <= HUD_GRASS_TOUCH_GROUPS_PER_LINE) {
    return formatted;
  }

  const lines: string[] = [];
  for (let index = 0; index < groups.length; index += HUD_GRASS_TOUCH_GROUPS_PER_LINE) {
    lines.push(groups.slice(index, index + HUD_GRASS_TOUCH_GROUPS_PER_LINE).join(","));
  }

  return lines.join("\n");
}

function formatHudChipNumber(value: number): string {
  const whole = Math.floor(value);
  const abs = Math.abs(whole);
  if (abs >= 1_000_000_000_000_000) {
    return whole.toExponential(2).replace("+", "");
  }

  const units = [
    { value: 1_000_000_000_000, suffix: "T" },
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
  ];

  for (const unit of units) {
    if (abs >= unit.value) {
      const scaled = whole / unit.value;
      const decimals = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${scaled.toFixed(decimals)}${unit.suffix}`;
    }
  }

  return formatGrassTouches(whole);
}

function formatHudChipRate(value: number): string {
  return `${formatHudChipNumber(value)}/min`;
}

function getDirectiveAdjustedAutomationOutput(state: GameState, output: number): number {
  return output * getAutomationDirectiveTuning(state).touchOutputMultiplier;
}
const LIVE_TILE_VIEW_FIELD_LIMIT = 180;
const POP_TEXT_POOL_LIMIT = 36;
const TOUCH_FLOURISH_INTERVAL_MS = 72;
const TOUCH_FLOURISH_BUSY_INTERVAL_MS = 128;
const PERFECT_TOUCH_CUE_LIMIT = 6;
const PERFECT_TOUCH_CUE_MIN_SCALE = 0.52;
const COMBO_BADGE_REFRESH_INTERVAL_MS = 48;
const HOVER_REFRESH_INTERVAL_MS = 70;
const HOVER_MOVE_THRESHOLD_SQ = 64;
const PERSISTENT_TOUCH_BASE_INTERVAL_MS = 230;
const PERSISTENT_TOUCH_INTERVAL_STEP_MS = 28;
const PERSISTENT_TOUCH_MIN_INTERVAL_MS = 135;
const PERSISTENT_TOUCH_DRAG_GRACE_MS = 48;
const PERSISTENT_TOUCH_MISS_INTERVAL_MS = 90;
const PERSISTENT_TOUCH_BLOCKED_INTERVAL_MS = 320;
const TREE_WIDTH = 880;
const TREE_HEIGHT = 560;
const COMBO_AOE_MIN_COUNT = 18;
const COMBO_AOE_HIGH_COUNT = 36;
const COMBO_AOE_CHANCE = 0.12;
const COMBO_AOE_HIGH_CHANCE = 0.25;
const AUTOMATION_COMBO_WINDOW_MS = 12000;
const AUTOMATION_COMBO_BONUS_SCALE = 0.35;
const PERFECT_TOUCH_WINDOW_MS = 650;
const PERFECT_TOUCH_BONUS_MULTIPLIER = 0.25;
const GOLDEN_HOUR_PERFECT_GOLD_CHANCE = 0.04;
const PERFECT_POSE_WINDOW_BONUS_MS = 50;
const PERFECT_POSE_MULTIPLIER_BONUS = 0.04;
const ENCORE_CIRCLE_AOE_CHANCE_BONUS = 0.02;
const WILDFLOWER_POLLINATE_CHANCE = 0.22;
const MUSHROOM_SPORE_CHANCE = 0.18;
const CRYSTAL_GOLD_CHANCE = 0.16;
const WATERING_CAN_REGROW_FACTOR = 0.7;
const WATERING_CAN_SPLASH_REGROW_FACTOR = 0.78;
const WATERING_CAN_MIN_REMAINING_MS = 320;
const COMBO_AOE_NEIGHBORS = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
] as const;
const SKILL_NODE_SIZE = 78;
const SKILL_MAP_X_SCALE = 0.72;
const SKILL_MAP_Y_SCALE = 0.86;
const SKILL_MAP_FOCUS_SCALE = 1.14;
const SKILL_NODE_VISUAL_SIZE = 64;
const SKILL_DETAIL_WIDTH = 360;
const SKILL_DETAIL_HEIGHT = 400;
const SHOP_ICON_SIZE = 48;
const PANEL_SLICE = 18;
const SKILL_NODE_FRAME_KEYS = {
  locked: "skill-node-locked",
  available: "skill-node-available",
  owned: "skill-node-owned",
  selected: "skill-node-selected",
} as const;

const SKILL_BRANCH_LABELS = [
  { text: "Growth", x: 440, y: 22, color: "#7be7ff", revealedBy: ["faster_regrowth"] },
  { text: "Touch", x: 842, y: 250, color: "#dfff74", revealedBy: ["two_handed_technique"] },
  { text: "Crits", x: 440, y: 542, color: "#ffef4a", revealedBy: ["lucky_clover"] },
  { text: "Nature", x: 92, y: 270, color: "#82ffd0", revealedBy: ["palm_press"] },
  { text: "Automation", x: 675, y: 418, color: "#bff4ff", revealedBy: ["sprinkler_calibration", "helper_routes"] },
];

const getSkillIconKey = (upgradeId: string): string => `skill-${upgradeId.replace(/_/g, "-")}`;

const SEED_SHOP_ICON_KEYS: Record<string, string> = {
  seed_pouch: "item-seed-pouch",
  sprinkler: "world-tiny-sprinkler",
  watering_can: "item-watering-can",
  wild_spread: "item-wild-spread",
  field_journal: "item-field-journal",
  quest_clipboard: "item-quest-clipboard",
  weather_jar: "item-weather-jar",
  compost_bin: "item-compost-bin",
  garden_gloves: "item-seed-pouch",
  bug_hotel: "item-bug-hotel",
  rain_barrel: "item-rain-barrel",
  mower_boundary: "item-sprinkler-network",
  forager_trails: "item-forager-trails",
  sprinkler_timer: "item-sprinkler-timer",
  self_seeding_nozzle: "item-self-seeding-nozzle",
  sprinkler_network: "item-sprinkler-network",
  clover_press: "item-clover-press",
  seed_catalog: "item-seed-catalog",
};

const GOLD_STORE_ICON_KEYS: Record<string, string> = {
  pocket_sunshine: "item-pocket-sunshine",
  seed_satchel: "item-seed-satchel",
  field_mouse: "world-field-mouse",
  bee_hive: "world-bee-hive",
  chicken: "world-chicken",
  sheep: "world-sheep",
  meadow_rabbit: "world-meadow-rabbit",
  earthworm: "world-earthworm",
};

const ITEM_ICON_ASSET_PATHS: Partial<Record<string, string>> = {
  "item-watering-can": "/assets/ui/items/watering-can.svg",
};

const WORLD_OBJECTS: Array<{ id: string; textureKey: string; label: string; kind: "automation" | "inventory" }> = [
  { id: "sprinkler", textureKey: "world-tiny-sprinkler", label: "Tiny Sprinkler", kind: "automation" },
  { id: "field_mouse", textureKey: "world-field-mouse", label: "Field Mouse", kind: "inventory" },
  { id: "bee_hive", textureKey: "world-bee-hive", label: "Bee Hive", kind: "inventory" },
  { id: "earthworm", textureKey: "world-earthworm", label: "Earthworm", kind: "inventory" },
  { id: "chicken", textureKey: "world-chicken", label: "Chicken", kind: "inventory" },
  { id: "sheep", textureKey: "world-sheep", label: "Sheep", kind: "inventory" },
  { id: "meadow_rabbit", textureKey: "world-meadow-rabbit", label: "Meadow Rabbit", kind: "inventory" },
];

interface TileView {
  base: Phaser.GameObjects.Image;
  grass: Phaser.GameObjects.Image;
  hazard: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  outline: Phaser.GameObjects.Rectangle;
  glint: Phaser.GameObjects.Star;
  key?: TileKey;
}

interface SkillNodeView {
  upgradeId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  readyGlow: Phaser.GameObjects.Ellipse;
  glow: Phaser.GameObjects.Ellipse;
  plate: Phaser.GameObjects.Arc;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  lockedIcon: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
  renderKey?: string;
  hoverTrembleTween?: Phaser.Tweens.Tween;
  hoverGlowTween?: Phaser.Tweens.Tween;
}

interface SkillRoutePoint {
  x: number;
  y: number;
}

interface SeedShopItemView {
  itemId: string;
  container: Phaser.GameObjects.Container;
  attentionGlow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  iconBg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  readyBadge: Phaser.GameObjects.Text;
}

interface GoldStoreItemView {
  itemId: string;
  container: Phaser.GameObjects.Container;
  attentionGlow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  iconBg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  readyBadge: Phaser.GameObjects.Text;
}

type StoreMode = "automation" | "goods";
type AutomationBuyMode = "single" | "boost";
type ComboTouchSource = "manual" | "sprinkler" | "field_mouse" | "meadow_rabbit" | "sheep";
type HudChipId = "touches" | "seeds" | "gold" | "auto" | "quest";

interface HudChipView {
  id: HudChipId;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  iconBg: Phaser.GameObjects.Ellipse;
  iconImage?: Phaser.GameObjects.Image;
  iconText?: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  width: number;
}

interface TriggerFeedItem {
  id: number;
  label: string;
  detail: string;
  icon: string;
  color: number;
  createdAt: number;
  count: number;
}

interface TriggerFeedRowView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  accent: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  age: Phaser.GameObjects.Text;
}

interface GoalNudgeData {
  icon: string;
  text: string;
  color: number;
}

interface AutomationPurchasePlan {
  quantity: number;
  targetOwned: number;
  totalCost: number;
  milestone?: { owned: number; multiplier: number };
}

interface QuestItemView {
  questId: string;
  container: Phaser.GameObjects.Container;
  attentionGlow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  progress: Phaser.GameObjects.Text;
  reward: Phaser.GameObjects.Text;
  claimButton: Phaser.GameObjects.Container;
  readyBadge: Phaser.GameObjects.Text;
}

type QuestFilterId = "all" | "ready" | "active" | "automation" | "class" | "journal" | "claimed";

interface QuestFilterView {
  filterId: QuestFilterId;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

interface AutomationDirectiveView {
  directiveId: AutomationDirectiveId;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
}

const QUEST_FILTERS: Array<{ id: QuestFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "active", label: "Active" },
  { id: "automation", label: "Auto" },
  { id: "class", label: "Class" },
  { id: "journal", label: "Journal" },
  { id: "claimed", label: "Claimed" },
];

interface WorldObjectView {
  id: string;
  quantity: number;
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
  shadow: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  ambience: Phaser.GameObjects.GameObject[];
}

interface PlacedWorldObjectView {
  objectId: string;
  coverage: Phaser.GameObjects.Graphics;
  coverageLayoutKey?: string;
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Ellipse;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface SkillBranchLabelView {
  text: Phaser.GameObjects.Text;
  treeX: number;
  treeY: number;
  revealedBy: string[];
}

interface StressStats {
  visibleTiles: number;
  totalTiles: number;
}

type BoardLayoutReason = "initial" | "resize" | "pan" | "zoom" | "dirty" | "field" | "ui" | "direct";

interface CommonRedrawEntry {
  key: TileKey;
  x: number;
  y: number;
}

interface FieldLifeVisualCandidate {
  tile: FieldTile;
  position: { x: number; y: number };
  score: number;
}

interface PerfStatsSnapshot {
  fps: number;
  maxFrameDeltaMs: number;
  frameSpikes: number;
  totalTiles: number;
  visibleTiles: number;
  tileViews: number;
  dirtyTiles: number;
  staleTiles: number;
  redrawQueued: number;
  commonStamps: number;
  displayObjects: number;
  emitters: number;
  activeTweens: number;
  autoFxObjects: number;
  fieldFxObjects: number;
  layoutPasses: number;
  redraws: number;
  tileMode: "live" | "viewport" | "batch";
  quality: number;
  weatherQuality: number;
  queuedSave: boolean;
  hotspots: string;
}

type PerfHarnessPhase = "idle" | "tapBurst" | "skillOpen" | "skillSelect" | "storeOpen" | "pan" | "zoom" | "saveStringify" | "complete";

interface PerfHarnessSample {
  phase: PerfHarnessPhase;
  elapsedMs: number;
  stats?: PerfStatsSnapshot;
}

interface PerfHarnessResult {
  status: "running" | "complete";
  startedAt: number;
  completedAt?: number;
  samples: PerfHarnessSample[];
}

type HazardHarnessPhase = "initial" | "afterCactus" | "afterWeedPull" | "afterWeedClear" | "afterMower" | "complete";

interface HazardHarnessStep {
  phase: HazardHarnessPhase;
  cactusCount: number;
  weedCount: number;
  prickedRemainingMs: number;
  statusText: string;
  weedStrength?: number;
  grassTouchMultiplier?: number;
  comboWindowMultiplier?: number;
  grassMultiplierRatio?: number;
  comboWindowRatio?: number;
  seedDelta?: number;
  tileStates?: Record<string, FieldTile["grassState"]>;
  hazardStats?: HazardStatsState;
  seenHazards?: JournalHazardId[];
}

interface HazardHarnessResult {
  status: "running" | "complete";
  startedAt: number;
  completedAt?: number;
  passed: boolean;
  checks: Record<string, boolean>;
  errors: string[];
  steps: HazardHarnessStep[];
}

interface PerfScopeSample {
  max: number;
  total: number;
  count: number;
}

function formatPerfDuration(durationMs: number): string {
  return durationMs >= 10 ? durationMs.toFixed(0) : durationMs.toFixed(1);
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private tileViews = new Map<TileKey, TileView>();
  private tileViewPool: TileView[] = [];
  private tileKeyCache = new WeakMap<FieldTile, TileKey>();
  private dirtyTileViewKeys = new Set<TileKey>();
  private staleCommonTileKeys = new Set<TileKey>();
  private redrawTileViewKeys = new Set<TileKey>();
  private commonStampOpsSinceLastPerf = 0;
  private recentlyRegrownAt = new Map<TileKey, number>();
  private perfectTouchCues = new Map<TileKey, Phaser.GameObjects.GameObject[]>();
  private boardTransientEffects = new Set<Phaser.GameObjects.GameObject>();
  private worldObjectViews = new Map<string, WorldObjectView>();
  private placedWorldObjectViews = new Map<string, PlacedWorldObjectView>();
  private selectedPlacementObjectId?: string;
  private emeraldBackground!: Phaser.GameObjects.Image;
  private boardBackdropGraphics?: Phaser.GameObjects.Graphics;
  private ambientSpores?: Phaser.GameObjects.Particles.ParticleEmitter;
  private titleText!: Phaser.GameObjects.Text;
  private buildLabelText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private hudChipRoot!: Phaser.GameObjects.Container;
  private hudChips: HudChipView[] = [];
  private hudChipBottomY = 0;
  private hudChipRightX = 0;
  private comboBadge!: Phaser.GameObjects.Container;
  private comboBadgeBg!: Phaser.GameObjects.Rectangle;
  private comboBadgeText!: Phaser.GameObjects.Text;
  private comboBadgeMeter!: Phaser.GameObjects.Rectangle;
  private goalNudgeRoot!: Phaser.GameObjects.Container;
  private goalNudgeBg!: Phaser.GameObjects.Rectangle;
  private goalNudgeIcon!: Phaser.GameObjects.Text;
  private goalNudgeText!: Phaser.GameObjects.Text;
  private milestoneText!: Phaser.GameObjects.Text;
  private triggerFeedRoot!: Phaser.GameObjects.Container;
  private triggerFeedBg!: Phaser.GameObjects.Rectangle;
  private triggerFeedTitle!: Phaser.GameObjects.Text;
  private triggerFeedToggle!: Phaser.GameObjects.Text;
  private triggerFeedRows: TriggerFeedRowView[] = [];
  private triggerFeedEvents: TriggerFeedItem[] = [];
  private triggerFeedCollapsed = false;
  private nextTriggerFeedId = 1;
  private triggerFeedRenderKey = "";
  private menuDockBg!: Phaser.GameObjects.Rectangle;
  private mobileCommandDockTop = Number.POSITIVE_INFINITY;
  private mobileCommandDockHeight = 0;
  private seasonTint!: Phaser.GameObjects.Rectangle;
  private weatherTint!: Phaser.GameObjects.Rectangle;
  private weatherBadge!: Phaser.GameObjects.Container;
  private weatherBadgeBg!: Phaser.GameObjects.Rectangle;
  private weatherBadgeTitle!: Phaser.GameObjects.Text;
  private weatherBadgeBody!: Phaser.GameObjects.Text;
  private weatherParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private activeWeatherVisualId?: WeatherId | "none";
  private skillButton!: Phaser.GameObjects.Container;
  private questButton!: Phaser.GameObjects.Container;
  private seedButton!: Phaser.GameObjects.Container;
  private storeButton!: Phaser.GameObjects.Container;
  private autoButton!: Phaser.GameObjects.Container;
  private journalButton!: Phaser.GameObjects.Container;
  private optionsButton!: Phaser.GameObjects.Container;
  private skillRoot!: Phaser.GameObjects.Container;
  private skillBackdrop!: Phaser.GameObjects.Rectangle;
  private skillBackdropPattern!: Phaser.GameObjects.Image;
  private skillMapBackdropGraphics!: Phaser.GameObjects.Graphics;
  private skillTitleText!: Phaser.GameObjects.Text;
  private skillResourceText!: Phaser.GameObjects.Text;
  private skillStatusText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Container;
  private skillLineGraphics!: Phaser.GameObjects.Graphics;
  private skillNodeViews = new Map<string, SkillNodeView>();
  private skillDetailPanel!: Phaser.GameObjects.Container;
  private skillDetailBg!: Phaser.GameObjects.NineSlice;
  private skillDetailTitle!: Phaser.GameObjects.Text;
  private skillDetailCategory!: Phaser.GameObjects.Text;
  private skillDetailBody!: Phaser.GameObjects.Text;
  private skillDetailCost!: Phaser.GameObjects.Text;
  private skillBuyButton!: Phaser.GameObjects.Container;
  private skillBranchLabels: SkillBranchLabelView[] = [];
  private tileInfoPanel!: Phaser.GameObjects.Container;
  private tileInfoBg!: Phaser.GameObjects.Rectangle;
  private tileInfoTitle!: Phaser.GameObjects.Text;
  private tileInfoBody!: Phaser.GameObjects.Text;
  private hoveredTileKey?: TileKey;
  private hoveredWorldObjectId?: string;
  private resetButton!: Phaser.GameObjects.Container;
  private prestigeButton!: Phaser.GameObjects.Container;
  private seedRoot!: Phaser.GameObjects.Container;
  private seedBackdrop!: Phaser.GameObjects.Rectangle;
  private seedTitleText!: Phaser.GameObjects.Text;
  private seedResourceText!: Phaser.GameObjects.Text;
  private seedStatusText!: Phaser.GameObjects.Text;
  private seedBackButton!: Phaser.GameObjects.Container;
  private seedItemViews = new Map<string, SeedShopItemView>();
  private storeRoot!: Phaser.GameObjects.Container;
  private storeBackdrop!: Phaser.GameObjects.Rectangle;
  private storeTitleText!: Phaser.GameObjects.Text;
  private storeResourceText!: Phaser.GameObjects.Text;
  private storeStatusText!: Phaser.GameObjects.Text;
  private storeAutomationButton!: Phaser.GameObjects.Container;
  private storeGoodsButton!: Phaser.GameObjects.Container;
  private storeAutomationBuyModeButton!: Phaser.GameObjects.Container;
  private storeBackButton!: Phaser.GameObjects.Container;
  private storeAutomationViews = new Map<string, GoldStoreItemView>();
  private storeGoldItemViews = new Map<string, GoldStoreItemView>();
  private questRoot!: Phaser.GameObjects.Container;
  private questBackdrop!: Phaser.GameObjects.Rectangle;
  private questTitleText!: Phaser.GameObjects.Text;
  private questResourceText!: Phaser.GameObjects.Text;
  private questStatusText!: Phaser.GameObjects.Text;
  private questBackButton!: Phaser.GameObjects.Container;
  private questClaimReadyButton!: Phaser.GameObjects.Container;
  private questItemViews = new Map<string, QuestItemView>();
  private questFilterViews = new Map<QuestFilterId, QuestFilterView>();
  private journalRoot!: Phaser.GameObjects.Container;
  private journalBackdrop!: Phaser.GameObjects.Rectangle;
  private journalTitleText!: Phaser.GameObjects.Text;
  private journalResourceText!: Phaser.GameObjects.Text;
  private journalStatusText!: Phaser.GameObjects.Text;
  private journalBodyText!: Phaser.GameObjects.Text;
  private journalBackButton!: Phaser.GameObjects.Container;
  private automationRoot!: Phaser.GameObjects.Container;
  private automationBackdrop!: Phaser.GameObjects.Rectangle;
  private automationPanel!: Phaser.GameObjects.Rectangle;
  private automationTitleText!: Phaser.GameObjects.Text;
  private automationStatusText!: Phaser.GameObjects.Text;
  private automationBackButton!: Phaser.GameObjects.Container;
  private automationDirectiveViews = new Map<AutomationDirectiveId, AutomationDirectiveView>();
  private optionsRoot!: Phaser.GameObjects.Container;
  private optionsBackdrop!: Phaser.GameObjects.Rectangle;
  private optionsPanel!: Phaser.GameObjects.Rectangle;
  private optionsTitleText!: Phaser.GameObjects.Text;
  private optionsVolumeLabel!: Phaser.GameObjects.Text;
  private optionsVolumeTrack!: Phaser.GameObjects.Rectangle;
  private optionsVolumeFill!: Phaser.GameObjects.Rectangle;
  private optionsVolumeHit!: Phaser.GameObjects.Rectangle;
  private optionsVolumeKnob!: Phaser.GameObjects.Arc;
  private optionsTrackLabel!: Phaser.GameObjects.Text;
  private optionsTrackLeftBtn!: Phaser.GameObjects.Container;
  private optionsTrackRightBtn!: Phaser.GameObjects.Container;
  private optionsBackButton!: Phaser.GameObjects.Container;
  private questScroll = 0;
  private journalScroll = 0;
  private seedShopScroll = 0;
  private storeScroll = 0;
  private resetArmed = false;
  private prestigeArmed = false;
  private lastAutoSaveAt = 0;
  private sprinkler = new SprinklerSystem();
  private animalCompanions = new AnimalCompanionSystem();
  private automationIncome = new AutomationIncomeSystem();
  private automationScheduler = this.createAutomationScheduler();
  private combo = new ComboSystem();
  private drops = new DropSystem();
  private hazards = new HazardSystem();
  private mutations = new MutationSystem();
  private audio = new AudioSystem();
  private music = new ChiptuneMusicSystem();
  private skillTreeOpen = false;
  private questLogOpen = false;
  private journalOpen = false;
  private seedShopOpen = false;
  private storeOpen = false;
  private storeMode: StoreMode = "automation";
  private automationBuyMode: AutomationBuyMode = "single";
  private automationOpen = false;
  private optionsOpen = false;
  private selectedQuestFilter: QuestFilterId = "all";
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private draggingMusicVolume = false;
  private musicVolumeSliderX = 0;
  private musicVolumeSliderWidth = 1;
  private readyUnlockKeys = new Set<string>();
  private readyQuestKeys = new Set<string>();
  private selectedSkillId = UPGRADES[0].id;
  private boardScale = 1;
  private boardZoom = 1;
  private boardPanX = 0;
  private boardPanY = 0;
  private boardBaseCenterX = 0;
  private boardBaseCenterY = 0;
  private boardTopY = 0;
  private boardAvailableWidth = 0;
  private boardAvailableHeight = 0;
  private boardScaledWidth = 0;
  private boardScaledHeight = 0;
  private isBoardPanArmed = false;
  private isPanningBoard = false;
  private boardPanStartX = 0;
  private boardPanStartY = 0;
  private pointerPanStartX = 0;
  private pointerPanStartY = 0;
  private lastTouchShakeAt = 0;
  private nextRegrowFeedbackAt = 0;
  private uiRefreshElapsed = 0;
  private readyStateRefreshElapsed = READY_STATE_REFRESH_INTERVAL_MS;
  private journalDiscoveryRefreshElapsed = JOURNAL_DISCOVERY_REFRESH_INTERVAL_MS;
  private perfPanelElapsed = 0;
  private runtimeStatsCache?: RuntimeStats;
  private runtimeStatsCacheAt = 0;
  private performanceSampleElapsed = 0;
  private perfSpikeWindowElapsed = 0;
  private maxFrameDeltaMs = 0;
  private frameSpikeCount = 0;
  private layoutPassCount = 0;
  private commonLayerRedrawCount = 0;
  private commonRedrawQueuedTiles = 0;
  private lastPerfLayoutPassCount = 0;
  private lastPerfCommonLayerRedrawCount = 0;
  private perfScopeSamples = new Map<string, PerfScopeSample>();
  private lastPerfHotspotSummary = "";
  private pendingBoardLayout = false;
  private pendingBoardLayoutReason: BoardLayoutReason = "direct";
  private commonRedrawQueue: CommonRedrawEntry[] = [];
  private commonRedrawQueueIndex = 0;
  private lastVisibleTileKeys = new Set<TileKey>();
  private panelUiRefreshElapsed = PANEL_UI_REFRESH_INTERVAL_MS;
  private worldObjectUiRefreshElapsed = WORLD_OBJECT_UI_REFRESH_INTERVAL_MS;
  private lastComboBadgeBumpAt = 0;
  private effectQuality = 1;
  private lowFpsSamples = 0;
  private highFpsSamples = 0;
  private weatherParticleQuality = 1;
  private queuedSaveElapsed = QUEUED_SAVE_INTERVAL_MS;
  private saveQueued = false;
  private saveDelayHandle?: number;
  private idleSaveHandle?: number;
  private ambientFeedbackDepth = 0;
  private ambientFeedbackWindowAt = 0;
  private ambientBurstParticlesUsed = 0;
  private ambientTransientObjectsUsed = 0;
  private ambientPopTextsUsed = 0;
  private ambientRewardArcSpritesUsed = 0;
  private ambientWorldActionArcSpritesUsed = 0;
  private popTextPool: Phaser.GameObjects.Text[] = [];
  private activePopTexts = new Set<Phaser.GameObjects.Text>();
  private lastTouchFlourishAt = 0;
  private autoTouchVisualCredit = 0;
  private lastAutoTouchVisualAt = 0;
  private lastAutoTouchPopAt = 0;
  private lastAutomationIncomeFeedAt = 0;
  private activeAutoTouchVisualObjects = 0;
  private fieldLifeVisualElapsed = 0;
  private lastFieldLifeSweepAt = 0;
  private activeFieldLifeVisualObjects = 0;
  private comboBadgeRefreshElapsed = COMBO_BADGE_REFRESH_INTERVAL_MS;
  private lastMusicComboLevel = 0;
  private activeComboSource: ComboTouchSource = "manual";
  private nextHoverRefreshAt = 0;
  private lastHoverPointerX = Number.NaN;
  private lastHoverPointerY = Number.NaN;
  private stressMode = false;
  private perfOverlayEnabled = false;
  private perfHarnessEnabled = false;
  private hazardHarnessEnabled = false;
  private perfHarnessRunning = false;
  private perfHarnessStartedAt = 0;
  private perfHarnessSamples: PerfHarnessSample[] = [];
  private latestPerfStats?: PerfStatsSnapshot;
  private perfText?: Phaser.GameObjects.Text;
  private lastStressStats: StressStats = { visibleTiles: 0, totalTiles: 0 };
  private fieldTileCount = 0;
  private knownFieldKeys = new Set<TileKey>();
  private cachedFieldBounds?: FieldBounds;
  private commonTileLayer?: Phaser.GameObjects.RenderTexture;
  private commonTileLayerWidth = 0;
  private commonTileLayerHeight = 0;
  private commonTileLayerDirty = false;
  private boardHitZone?: Phaser.GameObjects.Zone;
  private pendingBoardTileKey?: TileKey;
  private persistentTouchPointer?: Phaser.Input.Pointer;
  private persistentTouchActive = false;
  private persistentTouchNextAt = 0;
  private persistentTouchLastTileKey?: TileKey;
  private mowerSprite?: Phaser.GameObjects.Image;
  private mowerTileEvents: Phaser.Time.TimerEvent[] = [];
  private hoverMarker?: Phaser.GameObjects.Rectangle;
  private burstEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private uiBurstEmitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private readonly handlePageHide = (): void => this.flushQueuedSave(true);
  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.flushQueuedSave(true);
    }
  };

  constructor() {
    super("GameScene");
  }

  preload(): void {
    this.load.image("tile-dirt", "/assets/tiles/tile-dirt.png");
    this.load.image("tile-stubble", "/assets/tiles/tile-stubble.png");
    this.load.image("grass-fleck", "/assets/tiles/grass-fleck.png");
    this.load.image("dew-fleck", "/assets/tiles/dew-fleck.png");

    for (const tier of GRASS_TIERS) {
      this.load.image(`grass-${tier.id}`, `/assets/tiles/grass-${tier.id}.png`);
      this.load.image(`grass-${tier.id}-dewy`, `/assets/tiles/grass-${tier.id}-dewy.png`);
      this.load.image(`grass-${tier.id}-lush`, `/assets/tiles/grass-${tier.id}-lush.png`);
    }

    this.load.image("world-tiny-sprinkler", "/assets/world/tiny-sprinkler.png");
    this.load.image("world-bee-hive", "/assets/world/bee-hive.png");
    this.load.image("world-chicken", "/assets/world/chicken.png");
    this.load.image("world-field-mouse", "/assets/world/field-mouse.png");
    this.load.image("world-meadow-rabbit", "/assets/world/meadow-rabbit.png");
    this.load.image("world-sheep", "/assets/world/sheep.png");
    this.load.image("world-earthworm", "/assets/world/earthworm.png");
    this.load.image("meadow-clearing-bg", "/assets/backgrounds/meadow-clearing-concept.webp");
    this.load.image("emerald-bg", "/assets/ui/emerald-bg.png");
    this.load.image("panel-emerald", "/assets/ui/panel-emerald.png");
    this.load.image("button-emerald-normal", "/assets/ui/button-emerald-normal.png");
    this.load.image("button-emerald-hover", "/assets/ui/button-emerald-hover.png");
    this.load.image("button-emerald-active", "/assets/ui/button-emerald-active.png");
    this.load.image(SKILL_NODE_FRAME_KEYS.locked, "/assets/ui/skill-node-locked.png");
    this.load.image(SKILL_NODE_FRAME_KEYS.available, "/assets/ui/skill-node-available.png");
    this.load.image(SKILL_NODE_FRAME_KEYS.owned, "/assets/ui/skill-node-owned.png");
    this.load.image(SKILL_NODE_FRAME_KEYS.selected, "/assets/ui/skill-node-selected.png");
    this.load.image("selector-gold", "/assets/ui/selector-gold.png");

    for (const itemKey of new Set([...Object.values(SEED_SHOP_ICON_KEYS), ...Object.values(GOLD_STORE_ICON_KEYS)])) {
      if (itemKey.startsWith("world-")) {
        continue;
      }

      this.load.image(itemKey, ITEM_ICON_ASSET_PATHS[itemKey] ?? `/assets/ui/items/${itemKey.replace("item-", "")}.png`);
    }

    for (const upgrade of UPGRADES) {
      const fileName = (upgrade.iconAsset ?? upgrade.id).replace(/_/g, "-");
      this.load.image(getSkillIconKey(upgrade.id), `/assets/ui/skills/${fileName}.png`);
    }

    this.load.image("effect-water-drop", "/assets/effects/water-drop.png");
    this.load.image("effect-pollen-fleck", "/assets/effects/pollen-fleck.png");
    this.load.image("effect-bee-pixel", "/assets/effects/bee-pixel.png");
    this.load.image("effect-gold-coin", "/assets/effects/gold-coin.png");
    this.load.image("effect-seed-kernel", "/assets/effects/seed-kernel.png");
    this.load.image("effect-magic-spore", "/assets/effects/magic-spore.png");
  }

  create(data?: { newGame?: boolean; characterClassId?: CharacterClassId; stressMode?: boolean }): void {
    this.hazardHarnessEnabled = this.isHazardHarnessRequested();
    this.perfHarnessEnabled = this.isPerfHarnessRequested();
    this.stressMode = data?.stressMode === true || this.isStressModeRequested();
    this.perfOverlayEnabled = this.stressMode || this.isPerfOverlayRequested() || this.perfHarnessEnabled;
    this.state = this.stressMode ? this.createStressState(data?.characterClassId) : data?.newGame ? resetSave(data.characterClassId) : loadGame();
    this.applyPixelTextureFilters();
    this.rebuildFieldMetrics();
    this.automationScheduler.reset();
    this.sprinkler.reset();
    this.animalCompanions.reset();
    this.automationIncome.reset();
    this.hazards.reset();
    this.mutations.reset();
    this.musicVolume = readStoredMusicVolume();
    this.music.setVolume(this.musicVolume);
    this.music.setTrack(this.state.selectedTrackId || "cozy_meadow");
    this.updateJournalDiscoveries();
    this.saveState();

    this.cameras.main.setBackgroundColor("#06190f");
    this.createEmeraldBackdrop();
    this.createTileTextures();
    this.createHeader();
    this.createBoardLayers();
    this.createPerfPanel();
    this.createSeasonVisuals();
    this.createWeatherVisuals();
    this.createTileInfoPanel();
    this.createSkillTree();
    this.createQuestLog();
    this.createJournal();
    this.createSeedShop();
    this.createGoldStore();
    this.createAutomationPanel();
    this.createOptionsPanel();
    this.updateWeather(Date.now(), false);
    this.renderAllTiles();
    this.layoutHeader();
    this.layoutSkillTree();
    this.layoutSeedShop();
    this.readyUnlockKeys = this.getReadyUnlockKeys();
    this.readyQuestKeys = this.getReadyQuestKeys();
    this.refreshUi();
    this.layoutTiles();
    this.startPerfHarness();
    this.startHazardHarness();
    this.addTriggerFeedEvent("Field online", this.stressMode ? `${this.fieldTileCount} patches in stress mode` : "watching automation", "OK", 0xb7eba5);
    this.showMessage(
      this.stressMode ? "Stress mode: big field, busy systems, no save writes." : "Touch the grass. Let it regrow. Become reasonable.",
      3600,
    );

    this.scale.on("resize", () => {
      this.layoutHeader();
      this.layoutEmeraldBackdrop();
      this.layoutSeasonVisuals();
      this.layoutWeatherVisuals();
      this.layoutTiles("resize");
      this.layoutSkillTree();
      this.layoutQuestLog();
      this.layoutJournal();
      this.layoutSeedShop();
      this.layoutGoldStore();
      this.layoutAutomationPanel();
      this.layoutOptionsPanel();
    });

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      if (this.optionsOpen || this.questLogOpen || this.journalOpen) {
        if (this.questLogOpen) {
          this.questScroll = Math.max(0, this.questScroll + deltaY * 0.75);
          this.layoutQuestLog();
        }
        if (this.journalOpen) {
          this.journalScroll = Math.max(0, this.journalScroll + deltaY * 0.75);
          this.layoutJournal();
        }
        return;
      }

      if (this.seedShopOpen) {
        this.seedShopScroll = Math.max(0, this.seedShopScroll + deltaY * 0.75);
        this.layoutSeedShop();
        return;
      }

      if (this.storeOpen) {
        this.storeScroll = Math.max(0, this.storeScroll + deltaY * 0.75);
        this.layoutGoldStore();
        return;
      }

      if (this.automationOpen) {
        return;
      }

      this.zoomBoard(deltaY, pointer.x, pointer.y);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      this.audio.unlock();
      this.music.start(this.musicVolume);

      if (this.hasBlockingOverlayOpen()) {
        return;
      }

      const boardOnly = gameObjects.length > 0 && gameObjects.every((gameObject) => gameObject === this.boardHitZone);
      if (gameObjects.length > 0 && !boardOnly) {
        return;
      }

      this.pendingBoardTileKey = this.getBoardTileKeyAtPointer(pointer);
      this.isBoardPanArmed = true;
      this.isPanningBoard = false;
      this.boardPanStartX = this.boardPanX;
      this.boardPanStartY = this.boardPanY;
      this.pointerPanStartX = pointer.x;
      this.pointerPanStartY = pointer.y;

      if (this.shouldTouchBoardOnPointerDown(pointer) && this.pendingBoardTileKey) {
        const touchedTileKey = this.pendingBoardTileKey;
        const tile = this.state.field[touchedTileKey];
        this.pendingBoardTileKey = undefined;
        this.isBoardPanArmed = false;
        if (tile) {
          this.handleTileClicked(tile);
          this.startPersistentTouch(pointer, touchedTileKey);
        }
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isBoardPanArmed && !this.isPanningBoard) {
        return;
      }

      if (this.isBoardPanArmed && !this.isPanningBoard) {
        const dx = pointer.x - this.pointerPanStartX;
        const dy = pointer.y - this.pointerPanStartY;
        if (dx * dx + dy * dy < BOARD_PAN_THRESHOLD_PX * BOARD_PAN_THRESHOLD_PX) {
          return;
        }

        this.isBoardPanArmed = false;
        this.isPanningBoard = true;
        this.pendingBoardTileKey = undefined;
        this.stopPersistentTouch();
        this.boardPanStartX = this.boardPanX;
        this.boardPanStartY = this.boardPanY;
        this.pointerPanStartX = pointer.x;
        this.pointerPanStartY = pointer.y;
        this.tileInfoPanel.setVisible(false);
        this.hideHoverMarker();
        return;
      }

      if (!this.isPanningBoard) {
        return;
      }

      this.boardPanX = this.boardPanStartX + pointer.x - this.pointerPanStartX;
      this.boardPanY = this.boardPanStartY + pointer.y - this.pointerPanStartY;
      this.requestBoardLayout("pan");
    });

    this.input.on("pointerup", () => {
      if (this.isBoardPanArmed && !this.isPanningBoard && this.pendingBoardTileKey && !this.hasBlockingOverlayOpen()) {
        const tile = this.state.field[this.pendingBoardTileKey];
        if (tile) {
          this.handleTileClicked(tile);
        }
      }

      this.pendingBoardTileKey = undefined;
      this.isBoardPanArmed = false;
      this.isPanningBoard = false;
      this.stopPersistentTouch();
      this.draggingMusicVolume = false;
    });

    this.input.on("pointerupoutside", () => {
      this.pendingBoardTileKey = undefined;
      this.isBoardPanArmed = false;
      this.isPanningBoard = false;
      this.stopPersistentTouch();
      this.draggingMusicVolume = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handlePersistentTouchPointerMove(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handleMusicVolumeDrag(pointer));
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handleBoardHover(pointer));
    window.addEventListener("pagehide", this.handlePageHide);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleShutdown());
  }

  update(_time: number, delta: number): void {
    const updatePerfStart = this.shouldProfile() ? performance.now() : undefined;
    const now = Date.now();
    this.maxFrameDeltaMs = Math.max(this.maxFrameDeltaMs, delta);
    if (delta >= FRAME_SPIKE_MS) {
      this.frameSpikeCount += 1;
    }
    this.perfSpikeWindowElapsed += delta;
    if (this.perfSpikeWindowElapsed >= PERF_SPIKE_RESET_MS) {
      this.perfSpikeWindowElapsed = 0;
      this.maxFrameDeltaMs = delta;
      this.frameSpikeCount = delta >= FRAME_SPIKE_MS ? 1 : 0;
    }

    this.profileScope("weather", () => this.updateWeather(now, true));
    const stats = this.profileScope("stats", () => this.getCachedRuntimeStats(now));
    this.profileScope("regrow", () => {
      const regrown = updateRegrowth(this.state, stats, now);
      const showRegrowFeedback = regrown.length > 0 && now >= this.nextRegrowFeedbackAt;
      let regrowFeedbackCount = 0;
      if (showRegrowFeedback) {
        this.nextRegrowFeedbackAt = now + REGROW_FEEDBACK_INTERVAL_MS;
      }

      for (const tile of regrown) {
        this.markRecentlyRegrown(tile, now);
        this.refreshTile(tile);
        if (this.recordTileDiscovery(tile)) {
          this.queueSave();
        }
        if (showRegrowFeedback && regrowFeedbackCount < this.getScaledBudget(MAX_REGROW_FEEDBACK_PER_BATCH) && this.getTileVisualPosition(tile)) {
          this.playRegrowFeedback(tile);
          regrowFeedbackCount += 1;
        }
      }

      if (regrown.length > 0) {
        this.audio.play("regrow");
      }
    });

    this.profileScope("mile", () => this.checkMilestones(stats));
    this.profileScope("combo", () => {
      const comboExpired = this.combo.update(now);
      const comboCount = this.combo.getCount();
      if (comboCount !== this.lastMusicComboLevel) {
        this.lastMusicComboLevel = comboCount;
        this.music.setComboLevel(comboCount);
      }
      this.comboBadgeRefreshElapsed += delta;
      if (comboExpired || this.comboBadgeRefreshElapsed >= COMBO_BADGE_REFRESH_INTERVAL_MS) {
        this.comboBadgeRefreshElapsed = 0;
        this.refreshComboBadge();
      }
      this.pruneRecentlyRegrown(now);
    });
    if (this.persistentTouchActive) {
      this.profileScope("touch:persistent", () => this.updatePersistentTouch(now));
    }
    this.profileScope("systems", () => {
      this.automationScheduler.update(delta, stats);
    });
    this.profileScope("layout:pending", () => {
      if (this.commonTileLayerDirty && !this.shouldDeferCommonRedrawWork()) {
        if (!this.tryQueueDirtyCommonRedraw()) {
          this.requestBoardLayout("dirty");
        }
      }
      this.flushPendingBoardLayout();
    });
    if (this.shouldDeferCommonRedrawWork()) {
      this.commonRedrawQueuedTiles = Math.max(0, this.commonRedrawQueue.length - this.commonRedrawQueueIndex);
    } else {
      this.profileScope("render:queuedCommon", () => this.processCommonRedrawQueue());
    }

    this.profileScope("field:life", () => this.updateFieldLifeVisuals(delta, now));

    this.journalDiscoveryRefreshElapsed += delta;
    if (this.journalDiscoveryRefreshElapsed >= JOURNAL_DISCOVERY_REFRESH_INTERVAL_MS) {
      this.journalDiscoveryRefreshElapsed = 0;
      const journalChanged = this.profileScope("journal", () => this.updateJournalDiscoveries());
      if (journalChanged) {
        this.queueSave();
      }
    }

    this.readyStateRefreshElapsed += delta;
    if (this.readyStateRefreshElapsed >= READY_STATE_REFRESH_INTERVAL_MS) {
      this.readyStateRefreshElapsed = 0;
      this.profileScope("ready", () => {
        this.checkReadyUnlocks();
        this.checkReadyQuests();
      });
    }

    this.uiRefreshElapsed += delta;
    this.panelUiRefreshElapsed += delta;
    this.worldObjectUiRefreshElapsed += delta;
    if (this.uiRefreshElapsed >= FULL_UI_REFRESH_INTERVAL_MS) {
      this.uiRefreshElapsed = 0;
      this.profileScope("ui", () => {
        this.refreshUi(false);
      });
    }

    this.perfPanelElapsed += delta;
    this.performanceSampleElapsed += delta;
    if (this.performanceSampleElapsed >= PERFORMANCE_SAMPLE_INTERVAL_MS) {
      this.performanceSampleElapsed = 0;
      this.updateEffectQuality();
    }

    if (this.perfOverlayEnabled && this.perfPanelElapsed >= PERF_PANEL_REFRESH_INTERVAL_MS) {
      this.perfPanelElapsed = 0;
      this.refreshPerfPanel();
    }

    this.queuedSaveElapsed += delta;
    this.lastAutoSaveAt += delta;
    if (this.lastAutoSaveAt >= AUTO_SAVE_INTERVAL_MS) {
      this.lastAutoSaveAt = 0;
      this.scheduleIdleSaveFlush();
    }

    if (updatePerfStart !== undefined) {
      this.recordPerfScope("frame:update", performance.now() - updatePerfStart);
    }
  }

  private handleShutdown(): void {
    window.removeEventListener("pagehide", this.handlePageHide);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.flushQueuedSave(true);
    this.music.stop();
    for (const emitter of this.burstEmitters.values()) {
      emitter.destroy();
    }
    for (const emitter of this.uiBurstEmitters.values()) {
      emitter.destroy();
    }
    this.burstEmitters.clear();
    this.uiBurstEmitters.clear();
    this.clearBoardTransientEffects();
    this.clearMowerVisuals();
    this.destroyPopTextPool();
    this.destroyAllTileViews();
  }

  private saveState(): void {
    if (!this.stressMode) {
      this.profileScope("save", () => saveGame(this.state, (name, callback) => this.profileScope(name, callback)));
    }
  }

  private queueSave(): void {
    if (!this.stressMode) {
      this.saveQueued = true;
      this.scheduleQueuedSave();
    }
  }

  private flushQueuedSave(force = false): void {
    if (!this.saveQueued) {
      return;
    }

    if (!force && this.shouldDeferSaveFlush()) {
      this.scheduleBusySaveRetry();
      return;
    }

    this.cancelQueuedSaveTimers();
    this.saveQueued = false;
    this.queuedSaveElapsed = 0;
    this.saveState();
  }

  private scheduleQueuedSave(): void {
    if (this.saveDelayHandle !== undefined || this.idleSaveHandle !== undefined) {
      return;
    }

    this.saveDelayHandle = window.setTimeout(() => {
      this.saveDelayHandle = undefined;
      this.scheduleIdleSaveFlush();
    }, QUEUED_SAVE_INTERVAL_MS);
  }

  private scheduleIdleSaveFlush(): void {
    if (!this.saveQueued || this.idleSaveHandle !== undefined || this.saveDelayHandle !== undefined) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      this.idleSaveHandle = window.requestIdleCallback(
        () => {
          this.idleSaveHandle = undefined;
          this.flushQueuedSave();
        },
        { timeout: IDLE_SAVE_TIMEOUT_MS },
      );
      return;
    }

    this.saveDelayHandle = window.setTimeout(() => {
      this.saveDelayHandle = undefined;
      this.flushQueuedSave();
    }, FALLBACK_SAVE_DELAY_MS);
  }

  private shouldDeferSaveFlush(): boolean {
    return this.isBoardLayoutBusy();
  }

  private isBoardLayoutBusy(): boolean {
    return this.isPanningBoard || this.pendingBoardLayout || this.commonRedrawQueue.length > 0;
  }

  private scheduleBusySaveRetry(): void {
    if (this.saveDelayHandle !== undefined || this.idleSaveHandle !== undefined) {
      return;
    }

    this.saveDelayHandle = window.setTimeout(() => {
      this.saveDelayHandle = undefined;
      this.scheduleIdleSaveFlush();
    }, BUSY_SAVE_RETRY_MS);
  }

  private cancelQueuedSaveTimers(): void {
    if (this.saveDelayHandle !== undefined) {
      window.clearTimeout(this.saveDelayHandle);
      this.saveDelayHandle = undefined;
    }

    if (this.idleSaveHandle !== undefined && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(this.idleSaveHandle);
      this.idleSaveHandle = undefined;
    } else {
      this.idleSaveHandle = undefined;
    }
  }

  private invalidateRuntimeStats(): void {
    this.runtimeStatsCache = undefined;
    this.runtimeStatsCacheAt = 0;
  }

  private getCachedRuntimeStats(now = Date.now()): RuntimeStats {
    if (this.runtimeStatsCache && now - this.runtimeStatsCacheAt < RUNTIME_STATS_CACHE_MS) {
      return this.runtimeStatsCache;
    }

    this.runtimeStatsCache = getRuntimeStats(this.state);
    this.runtimeStatsCacheAt = now;
    return this.runtimeStatsCache;
  }

  private playMixedGrassTouch(tier: GrassTierId, trait: TileTrait, isCrit: boolean, comboCount = 0): void {
    const played = this.audio.playGrassTouch(tier, trait, isCrit, comboCount);
    if (played) {
      this.music.duckForSfx(isCrit ? 0.78 : comboCount >= 5 ? 0.82 : 0.86, isCrit ? 0.22 : 0.16);
    }
  }

  private createAutomationScheduler(): AutomationScheduler<RuntimeStats> {
    const scheduler = new AutomationScheduler<RuntimeStats>(250, 6);
    scheduler.add({
      id: "automation_income",
      intervalMs: 250,
      run: (deltaMs, stats) => this.profileScope("sys:income", () => this.updateAutomationIncome(deltaMs, stats)),
    });
    scheduler.add({
      id: "sprinkler",
      intervalMs: 250,
      initialDelayMs: 90,
      run: (deltaMs, stats) => this.profileScope("sys:sprinkler", () => this.updateSprinkler(deltaMs, stats)),
    });
    scheduler.add({
      id: "animal_companions",
      intervalMs: 250,
      initialDelayMs: 130,
      run: (deltaMs, stats) => this.profileScope("sys:companions", () => this.updateAnimalCompanions(deltaMs, stats)),
    });
    scheduler.add({
      id: "mutations",
      intervalMs: 250,
      initialDelayMs: 170,
      run: (deltaMs) => this.profileScope("sys:mutations", () => this.updateMutations(deltaMs)),
    });
    scheduler.add({
      id: "hazards",
      intervalMs: 500,
      initialDelayMs: 210,
      run: (deltaMs, stats) => this.profileScope("sys:hazards", () => this.updateHazards(deltaMs, stats)),
    });
    scheduler.add({
      id: "quest_clipboard",
      intervalMs: QUEST_CLIPBOARD_INTERVAL_MS,
      initialDelayMs: 2600,
      run: () => this.profileScope("sys:questClipboard", () => this.updateQuestClipboard()),
    });
    return scheduler;
  }

  private runWithAmbientFeedback<T>(callback: () => T): T {
    this.ambientFeedbackDepth += 1;
    try {
      return callback();
    } finally {
      this.ambientFeedbackDepth -= 1;
    }
  }

  private isAmbientFeedbackActive(): boolean {
    return this.ambientFeedbackDepth > 0;
  }

  private updateEffectQuality(): void {
    const fps = this.game.loop.actualFps;
    const displayObjects = this.children.list.length;
    const underObjectPressure = displayObjects >= DISPLAY_OBJECT_PRESSURE_LIMIT;
    const criticallyObjectBound = displayObjects >= DISPLAY_OBJECT_CRITICAL_LIMIT;

    if (fps <= PERF_CRITICAL_FPS || criticallyObjectBound) {
      this.lowFpsSamples += 2;
      this.highFpsSamples = 0;
    } else if (fps < PERF_LOW_FPS || underObjectPressure) {
      this.lowFpsSamples += 1;
      this.highFpsSamples = 0;
    } else if (fps >= PERF_RECOVERY_FPS) {
      this.highFpsSamples += 1;
      this.lowFpsSamples = 0;
    } else {
      this.lowFpsSamples = 0;
      this.highFpsSamples = 0;
    }

    if (this.lowFpsSamples >= 2) {
      this.lowFpsSamples = 0;
      this.highFpsSamples = 0;
      this.setEffectQuality(Math.max(MIN_EFFECT_QUALITY, this.effectQuality - EFFECT_QUALITY_STEP));
      return;
    }

    if (this.highFpsSamples >= 6 && this.effectQuality < 1) {
      this.highFpsSamples = 0;
      this.setEffectQuality(Math.min(1, this.effectQuality + EFFECT_QUALITY_STEP * 0.5));
    }
  }

  private setEffectQuality(quality: number): void {
    const nextQuality = Phaser.Math.Clamp(quality, MIN_EFFECT_QUALITY, 1);
    if (Math.abs(nextQuality - this.effectQuality) < 0.01) {
      return;
    }

    this.effectQuality = nextQuality;
    const nextWeatherQuality = this.getWeatherParticleQuality();
    if (Math.abs(nextWeatherQuality - this.weatherParticleQuality) >= 0.05) {
      this.weatherParticleQuality = nextWeatherQuality;
      if (this.state?.seedShopPurchases.weather_jar && this.state.activeWeatherId) {
        this.createWeatherParticleEffect(this.state.activeWeatherId);
      }
    }
  }

  private getWeatherParticleQuality(): number {
    if (this.effectQuality <= 0.34) {
      return 0.12;
    }

    if (this.effectQuality <= 0.58) {
      return 0.24;
    }

    if (this.effectQuality <= 0.82) {
      return 0.42;
    }

    return 0.68;
  }

  private getScaledBudget(baseBudget: number): number {
    return Math.max(1, Math.floor(baseBudget * this.effectQuality));
  }

  private reserveTouchFlourish(isCrit = false): boolean {
    const now = Date.now();
    const objectPressure = this.children.list.length >= DISPLAY_OBJECT_PRESSURE_LIMIT;
    const interval =
      objectPressure || this.effectQuality < 0.58 || this.boardScale < COMPACT_TILE_EFFECT_SCALE
        ? TOUCH_FLOURISH_BUSY_INTERVAL_MS
        : TOUCH_FLOURISH_INTERVAL_MS;
    const critScale = isCrit ? 0.52 : 1;
    if (now - this.lastTouchFlourishAt < interval * critScale) {
      return false;
    }

    this.lastTouchFlourishAt = now;
    return true;
  }

  private resetAmbientFeedbackBudget(now = Date.now()): void {
    if (now - this.ambientFeedbackWindowAt < AMBIENT_FEEDBACK_WINDOW_MS) {
      return;
    }

    this.ambientFeedbackWindowAt = now;
    this.ambientBurstParticlesUsed = 0;
    this.ambientTransientObjectsUsed = 0;
    this.ambientPopTextsUsed = 0;
    this.ambientRewardArcSpritesUsed = 0;
    this.ambientWorldActionArcSpritesUsed = 0;
  }

  private reserveAmbientTransientObject(cost = 1): boolean {
    if (!this.isAmbientFeedbackActive()) {
      return true;
    }

    this.resetAmbientFeedbackBudget();
    if (this.ambientTransientObjectsUsed + cost > this.getScaledBudget(AMBIENT_TRANSIENT_OBJECT_BUDGET)) {
      return false;
    }

    this.ambientTransientObjectsUsed += cost;
    return true;
  }

  private reserveAmbientPopText(): boolean {
    if (this.activePopTexts.size >= this.getScaledBudget(MAX_ACTIVE_POP_TEXTS)) {
      return false;
    }

    if (!this.isAmbientFeedbackActive()) {
      return true;
    }

    this.resetAmbientFeedbackBudget();
    if (this.ambientPopTextsUsed >= this.getScaledBudget(AMBIENT_POP_TEXT_BUDGET)) {
      return false;
    }

    this.ambientPopTextsUsed += 1;
    return true;
  }

  private getBudgetedBurstQuantity(quantity: number): number {
    const scaledQuantity = Math.max(1, Math.ceil(quantity * this.effectQuality));
    if (!this.isAmbientFeedbackActive()) {
      return scaledQuantity;
    }

    this.resetAmbientFeedbackBudget();
    const remaining = this.getScaledBudget(AMBIENT_BURST_PARTICLE_BUDGET) - this.ambientBurstParticlesUsed;
    const budgetedQuantity = Math.min(scaledQuantity, Math.max(0, remaining));
    this.ambientBurstParticlesUsed += budgetedQuantity;
    return budgetedQuantity;
  }

  private getBudgetedRewardArcSpriteCount(count: number): number {
    const scaledCount = Math.max(1, Math.ceil(count * this.effectQuality));
    if (!this.isAmbientFeedbackActive()) {
      return scaledCount;
    }

    this.resetAmbientFeedbackBudget();
    const remaining = this.getScaledBudget(AMBIENT_REWARD_ARC_SPRITE_BUDGET) - this.ambientRewardArcSpritesUsed;
    const budgetedCount = Math.min(scaledCount, Math.max(0, remaining));
    this.ambientRewardArcSpritesUsed += budgetedCount;
    return budgetedCount;
  }

  private getBudgetedWorldActionArcSpriteCount(count: number): number {
    const scaledCount = Math.max(1, Math.ceil(count * this.effectQuality));
    if (!this.isAmbientFeedbackActive()) {
      return scaledCount;
    }

    this.resetAmbientFeedbackBudget();
    const remaining = this.getScaledBudget(AMBIENT_WORLD_ACTION_ARC_SPRITE_BUDGET) - this.ambientWorldActionArcSpritesUsed;
    const budgetedCount = Math.min(scaledCount, Math.max(0, remaining));
    this.ambientWorldActionArcSpritesUsed += budgetedCount;
    return budgetedCount;
  }

  private setTextIfChanged(text: Phaser.GameObjects.Text | undefined, value: string): void {
    if (!text || text.text === value) {
      return;
    }

    this.profileScope("text:set", () => text.setText(value));
  }

  private setVisibleIfChanged(object: { visible: boolean; setVisible(value: boolean): unknown } | undefined, visible: boolean): void {
    if (object && object.visible !== visible) {
      object.setVisible(visible);
    }
  }

  private rebuildFieldMetrics(): void {
    this.knownFieldKeys = new Set(Object.keys(this.state.field) as TileKey[]);
    this.fieldTileCount = this.knownFieldKeys.size;
    this.cachedFieldBounds = getFieldBounds(this.state);
    for (const key of this.knownFieldKeys) {
      const tile = this.state.field[key];
      if (tile) {
        this.tileKeyCache.set(tile, key);
      }
    }
  }

  private registerFieldTile(tile: FieldTile): void {
    const key = this.getTileKey(tile);
    if (this.knownFieldKeys.has(key)) {
      return;
    }

    this.knownFieldKeys.add(key);
    this.fieldTileCount = this.knownFieldKeys.size;
    if (!this.cachedFieldBounds) {
      this.cachedFieldBounds = getFieldBounds(this.state);
      return;
    }

    const minX = Math.min(this.cachedFieldBounds.minX, tile.x);
    const maxX = Math.max(this.cachedFieldBounds.maxX, tile.x);
    const minY = Math.min(this.cachedFieldBounds.minY, tile.y);
    const maxY = Math.max(this.cachedFieldBounds.maxY, tile.y);
    this.cachedFieldBounds = {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  private getTileKey(tile: FieldTile): TileKey {
    const cached = this.tileKeyCache.get(tile);
    if (cached) {
      return cached;
    }

    const key = tileKey(tile.x, tile.y);
    this.tileKeyCache.set(tile, key);
    return key;
  }

  private isStressModeRequested(): boolean {
    const params = new URLSearchParams(window.location.search);
    return params.has("stress") || params.has("perfHarness") || params.has("hazardHarness");
  }

  private isPerfOverlayRequested(): boolean {
    return new URLSearchParams(window.location.search).has("perf");
  }

  private isPerfHarnessRequested(): boolean {
    return new URLSearchParams(window.location.search).has("perfHarness");
  }

  private isHazardHarnessRequested(): boolean {
    return new URLSearchParams(window.location.search).has("hazardHarness");
  }

  private getStressTileCount(): number {
    const rawTiles = Number(new URLSearchParams(window.location.search).get("tiles") ?? "1200");
    return Phaser.Math.Clamp(Number.isFinite(rawTiles) ? Math.floor(rawTiles) : 1200, 64, 2500);
  }

  private startPerfHarness(): void {
    if (!this.perfHarnessEnabled || this.perfHarnessRunning) {
      return;
    }

    this.perfHarnessRunning = true;
    this.perfHarnessStartedAt = performance.now();
    this.perfHarnessSamples = [];
    this.publishPerfHarnessResult("running");

    this.time.delayedCall(PERF_HARNESS_IDLE_DELAY_MS, () => {
      this.capturePerfHarnessSample("idle");
      this.runPerfHarnessTapBurst();

      this.time.delayedCall(PERF_HARNESS_PHASE_DELAY_MS, () => {
        this.capturePerfHarnessSample("tapBurst");
        this.openSkillTree();

        this.time.delayedCall(PERF_HARNESS_PHASE_DELAY_MS, () => {
          this.capturePerfHarnessSample("skillOpen");
          this.runPerfHarnessSkillSelect();

          this.time.delayedCall(PERF_HARNESS_PHASE_DELAY_MS, () => {
            this.capturePerfHarnessSample("skillSelect");
            this.closeSkillTree();
            this.openGoldStore();

            this.time.delayedCall(PERF_HARNESS_PHASE_DELAY_MS, () => {
              this.capturePerfHarnessSample("storeOpen");
              this.closeGoldStore();
              this.runPerfHarnessPan();

              this.time.delayedCall(PERF_HARNESS_PHASE_DELAY_MS, () => {
                this.capturePerfHarnessSample("pan");
                this.runPerfHarnessZoom();

                this.time.delayedCall(PERF_HARNESS_PHASE_DELAY_MS, () => {
                  this.capturePerfHarnessSample("zoom");
                  this.runPerfHarnessSaveStringify();

                  this.time.delayedCall(120, () => {
                    this.capturePerfHarnessSample("saveStringify");
                    this.resetBoardView();
                    this.requestBoardLayout("pan");
                    this.capturePerfHarnessSample("complete");
                    this.perfHarnessRunning = false;
                    this.publishPerfHarnessResult("complete");
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  private runPerfHarnessTapBurst(): void {
    for (const tile of this.getPerfHarnessTouchTiles(PERF_HARNESS_TAP_COUNT)) {
      this.handleTileClicked(tile);
    }
  }

  private runPerfHarnessSkillSelect(): void {
    const nextSkill = UPGRADES.find((upgrade) => upgrade.id !== this.selectedSkillId && this.isSkillVisible(upgrade.id));
    if (nextSkill) {
      this.previewSkill(nextSkill.id);
    }
  }

  private getPerfHarnessTouchTiles(count: number): FieldTile[] {
    const visibleTiles = [...this.lastVisibleTileKeys]
      .map((key) => this.state.field[key])
      .filter((tile): tile is FieldTile => tile?.grassState === "grown");
    const candidates = visibleTiles.length > 0 ? visibleTiles : getFieldTiles(this.state).filter((tile) => tile.grassState === "grown");
    if (candidates.length <= count) {
      return candidates;
    }

    const stride = Math.max(1, Math.floor(candidates.length / count));
    const tiles: FieldTile[] = [];
    for (let index = 0; index < candidates.length && tiles.length < count; index += stride) {
      tiles.push(candidates[index]);
    }

    return tiles;
  }

  private runPerfHarnessPan(): void {
    this.boardPanX += this.scale.width * 0.18;
    this.boardPanY -= this.scale.height * 0.08;
    this.requestBoardLayout("pan");
  }

  private runPerfHarnessZoom(): void {
    this.zoomBoard(-420, this.scale.width / 2, this.scale.height * 0.58);
  }

  private runPerfHarnessSaveStringify(): void {
    const byteCount = this.profileScope("harness:saveStringify", () => JSON.stringify(this.state).length);
    (window as unknown as { __grassPerfHarnessSaveBytes?: number }).__grassPerfHarnessSaveBytes = byteCount;
  }

  private capturePerfHarnessSample(phase: PerfHarnessPhase): void {
    this.refreshPerfPanel();
    const stats = this.latestPerfStats ? { ...this.latestPerfStats } : undefined;
    this.perfHarnessSamples.push({
      phase,
      elapsedMs: Math.round(performance.now() - this.perfHarnessStartedAt),
      stats,
    });
    this.publishPerfHarnessResult(phase === "complete" ? "complete" : "running");
  }

  private publishPerfHarnessResult(status: PerfHarnessResult["status"]): void {
    const result: PerfHarnessResult = {
      status,
      startedAt: Math.round(this.perfHarnessStartedAt),
      completedAt: status === "complete" ? Math.round(performance.now()) : undefined,
      samples: this.perfHarnessSamples,
    };
    (window as unknown as { __grassPerfHarness?: PerfHarnessResult }).__grassPerfHarness = result;
    document.documentElement.dataset.grassPerfHarness = JSON.stringify(result);
  }

  private startHazardHarness(): void {
    if (!this.hazardHarnessEnabled) {
      return;
    }

    const startedAt = performance.now();
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];
    const steps: HazardHarnessStep[] = [];
    const publish = (status: HazardHarnessResult["status"]) => {
      const passed = status === "complete" && errors.length === 0 && Object.values(checks).every(Boolean);
      const result: HazardHarnessResult = {
        status,
        startedAt: Math.round(startedAt),
        completedAt: status === "complete" ? Math.round(performance.now()) : undefined,
        passed,
        checks,
        errors,
        steps,
      };
      (window as unknown as { __grassHazardHarness?: HazardHarnessResult }).__grassHazardHarness = result;
      document.documentElement.dataset.grassHazardHarness = JSON.stringify(result);
    };
    const countHazards = (hazardId: "cactus" | "weeds", now = Date.now()) =>
      Object.values(this.state.tileHazards).filter((hazard) => hazard?.id === hazardId && hazard.expiresAt > now).length;
    const capture = (phase: HazardHarnessPhase, extra: Partial<HazardHarnessStep> = {}) => {
      const now = Date.now();
      steps.push({
        phase,
        cactusCount: countHazards("cactus", now),
        weedCount: countHazards("weeds", now),
        prickedRemainingMs: getPrickedRemainingMs(this.state, now),
        statusText: getHazardStatusText(this.state, now),
        ...extra,
      });
      publish("running");
    };

    publish("running");

    try {
      const grownTiles = getFieldTiles(this.state)
        .filter((tile) => tile.grassState === "grown")
        .sort((a, b) => Math.abs(a.x) + Math.abs(a.y) - (Math.abs(b.x) + Math.abs(b.y)) || a.y - b.y || a.x - b.x);
      const [cactusTile, weedTile, mowerCactusTile, mowerWeedTile] = grownTiles;
      if (!cactusTile || !weedTile || !mowerCactusTile || !mowerWeedTile) {
        throw new Error("Hazard harness needs at least four grown tiles.");
      }

      this.state.tileHazards = {};
      this.state.debuffs = {};
      this.state.hazardStats = {
        cactusCleared: 0,
        weedsPulled: 0,
        weedsCleared: 0,
        prickedCount: 0,
        mowerPasses: 0,
        mowerTilesMown: 0,
        hazardsClearedByMower: 0,
      };
      this.state.journal.seenHazardIds = [];
      this.invalidateRuntimeStats();

      const now = Date.now();
      const expiresAt = now + 60000;
      const cactusKey = this.getTileKey(cactusTile);
      const weedKey = this.getTileKey(weedTile);
      this.state.tileHazards[cactusKey] = { id: "cactus", createdAt: now, expiresAt };
      this.state.tileHazards[weedKey] = { id: "weeds", createdAt: now, expiresAt, strength: 2 };
      this.refreshTile(cactusTile);
      this.refreshTile(weedTile);
      this.updateJournalDiscoveries();
      this.refreshUi(false);
      checks.journalRecordsActiveHazards =
        this.state.journal.seenHazardIds.includes("cactus") && this.state.journal.seenHazardIds.includes("weeds");

      const prePrickStats = this.getCachedRuntimeStats(now);
      capture("initial", {
        weedStrength: this.state.tileHazards[weedKey]?.strength,
        grassTouchMultiplier: prePrickStats.grassTouchMultiplier,
        comboWindowMultiplier: prePrickStats.comboWindowMultiplier,
        hazardStats: { ...this.state.hazardStats },
        seenHazards: [...this.state.journal.seenHazardIds],
      });

      checks.cactusTouchHandled = this.handleHazardTileClicked(cactusTile);
      const postPrickStats = this.getCachedRuntimeStats(Date.now());
      const prickedRemainingMs = getPrickedRemainingMs(this.state);
      checks.cactusCleared = this.state.tileHazards[cactusKey] === undefined;
      checks.prickedApplied = prickedRemainingMs > 0;
      checks.prickedUsesGloveDuration = this.state.seedShopPurchases.garden_gloves ? prickedRemainingMs <= 5200 : prickedRemainingMs <= 8500;
      checks.prickedGrassMultiplierReduced = postPrickStats.grassTouchMultiplier < prePrickStats.grassTouchMultiplier;
      checks.prickedComboWindowReduced = postPrickStats.comboWindowMultiplier < prePrickStats.comboWindowMultiplier;
      checks.cactusStatsRecorded = this.state.hazardStats.cactusCleared === 1 && this.state.hazardStats.prickedCount === 1;
      checks.journalRecordsPricked = this.state.journal.seenHazardIds.includes("pricked");
      capture("afterCactus", {
        grassTouchMultiplier: postPrickStats.grassTouchMultiplier,
        comboWindowMultiplier: postPrickStats.comboWindowMultiplier,
        grassMultiplierRatio: Number((postPrickStats.grassTouchMultiplier / prePrickStats.grassTouchMultiplier).toFixed(3)),
        comboWindowRatio: Number((postPrickStats.comboWindowMultiplier / prePrickStats.comboWindowMultiplier).toFixed(3)),
        hazardStats: { ...this.state.hazardStats },
        seenHazards: [...this.state.journal.seenHazardIds],
      });

      checks.weedFirstPullHandled = this.handleHazardTileClicked(weedTile);
      const pulledWeed = this.state.tileHazards[weedKey];
      checks.weedStrengthReduced = pulledWeed?.id === "weeds" && pulledWeed.strength === 1;
      capture("afterWeedPull", {
        weedStrength: pulledWeed?.strength,
        hazardStats: { ...this.state.hazardStats },
        seenHazards: [...this.state.journal.seenHazardIds],
      });

      const seedsBeforeWeedClear = this.state.seeds;
      checks.weedSecondPullHandled = this.handleHazardTileClicked(weedTile);
      checks.weedCleared = this.state.tileHazards[weedKey] === undefined;
      checks.weedStatsRecorded = this.state.hazardStats.weedsPulled === 2 && this.state.hazardStats.weedsCleared === 1;
      capture("afterWeedClear", {
        seedDelta: this.state.seeds - seedsBeforeWeedClear,
        hazardStats: { ...this.state.hazardStats },
        seenHazards: [...this.state.journal.seenHazardIds],
      });

      const mowerNow = Date.now();
      const mowerExpiresAt = mowerNow + 60000;
      const mowerCactusKey = this.getTileKey(mowerCactusTile);
      const mowerWeedKey = this.getTileKey(mowerWeedTile);
      this.state.tileHazards[mowerCactusKey] = { id: "cactus", createdAt: mowerNow, expiresAt: mowerExpiresAt };
      this.state.tileHazards[mowerWeedKey] = { id: "weeds", createdAt: mowerNow, expiresAt: mowerExpiresAt, strength: 1 };
      this.refreshTile(mowerCactusTile);
      this.refreshTile(mowerWeedTile);
      this.applyMowerToTile(mowerCactusKey);
      this.applyMowerToTile(mowerWeedKey);
      checks.mowerClearsCactus = this.state.tileHazards[mowerCactusKey] === undefined;
      checks.mowerClearsWeeds = this.state.tileHazards[mowerWeedKey] === undefined;
      checks.mowerSetsTilesRegrowing = mowerCactusTile.grassState === "regrowing" && mowerWeedTile.grassState === "regrowing";
      checks.mowerStatsRecorded = this.state.hazardStats.mowerTilesMown === 2 && this.state.hazardStats.hazardsClearedByMower === 2;
      checks.journalRecordsMower = this.state.journal.seenHazardIds.includes("mower");
      capture("afterMower", {
        tileStates: {
          [mowerCactusKey]: mowerCactusTile.grassState,
          [mowerWeedKey]: mowerWeedTile.grassState,
        },
        hazardStats: { ...this.state.hazardStats },
        seenHazards: [...this.state.journal.seenHazardIds],
      });

      capture("complete");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    publish("complete");
  }

  private createStressState(characterClassId?: CharacterClassId): GameState {
    const state = createInitialState(characterClassId ?? DEFAULT_CHARACTER_CLASS_ID);
    const tileCount = this.getStressTileCount();
    const columns = Math.ceil(Math.sqrt(tileCount * 1.35));
    const rows = Math.ceil(tileCount / columns);
    const startX = -Math.floor(columns / 2);
    const startY = -Math.floor(rows / 2);
    const now = Date.now();

    state.field = {};
    for (let index = 0; index < tileCount; index += 1) {
      const x = startX + (index % columns);
      const y = startY + Math.floor(index / columns);
      const tier = GRASS_TIERS[index % GRASS_TIERS.length].id;
      const trait = index % 11 === 0 ? "lush" : index % 5 === 0 ? "dewy" : "normal";
      const tile = createTile(x, y, trait, tier);

      if (index % 3 === 0) {
        tile.grassState = "regrowing";
        tile.regrowEndsAt = now + Phaser.Math.Between(300, 2800);
      }

      state.field[tileKey(x, y)] = tile;
    }

    state.grassTouches = 1e24;
    state.lifetimeGrassTouches = 1e24;
    state.seeds = 2500;
    state.lifetimeSeeds = 2500;
    state.gold = 2500;
    state.lifetimeGold = 2500;
    state.hazardStats = {
      cactusCleared: 8,
      weedsPulled: 16,
      weedsCleared: 9,
      prickedCount: 7,
      mowerPasses: 2,
      mowerTilesMown: 18,
      hazardsClearedByMower: 3,
    };
    state.seedShopPurchases = Object.fromEntries(SEED_SHOP_ITEMS.map((item) => [item.id, true]));
    state.inventory = Object.fromEntries(
      GOLD_STORE_ITEMS.map((item) => [item.id, { quantity: item.maxQuantity ?? 4, kind: item.kind }]),
    );
    state.automationSystems = Object.fromEntries(AUTOMATION_SYSTEMS.map((system, index) => [system.id, { owned: 12 - index }]));
    state.placedWorldObjects = {};
    state.upgrades = Object.fromEntries(UPGRADES.map((upgrade) => [upgrade.id, { level: upgrade.maxLevel }]));
    state.reachedMilestones = MILESTONES.map((milestone) => milestone.id);
    state.activeWeatherId = "soft_rain";
    state.weatherEndsAt = now + 120000;
    state.journal = {
      discoveredGrassTiers: GRASS_TIERS.map((tier) => tier.id),
      discoveredTileTraits: ["normal", "dewy", "lush"],
      seenWeatherIds: WEATHER_TYPES.map((weather) => weather.id),
      seenHazardIds: ["cactus", "weeds", "pricked", "mower"],
      bestComboCount: 48,
    };

    return state;
  }

  private createHeader(): void {
    this.titleText = this.add
      .text(24, 18, "Grass Touching Simulator", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "30px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 6,
      })
      .setDepth(20)
      .setShadow(0, 3, "#06190f", 3, false, true);

    this.buildLabelText = this.add
      .text(26, 50, BUILD_LABEL, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setDepth(20)
      .setAlpha(0.86)
      .setShadow(0, 2, "#06190f", 2, false, true);

    this.resourceText = this.add
      .text(26, 62, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#173b20",
        backgroundColor: "#f4ffdc",
        padding: { x: 12, y: 8 },
      })
      .setDepth(20)
      .setShadow(0, 1, "#ffffff", 1, false, true);
    this.resourceText.setVisible(false);

    this.hudChipRoot = this.add.container(0, 0).setDepth(24);
    this.hudChips = [
      this.createHudChip("touches", "Touches", "grass-normal", "GT", 150),
      this.createHudChip("seeds", "Seeds", "effect-seed-kernel", "S", 98),
      this.createHudChip("gold", "Gold", "effect-gold-coin", "G", 98),
      this.createHudChip("auto", "Auto", "world-tiny-sprinkler", "A", 136),
      this.createHudChip("quest", "Quest", "item-quest-clipboard", "Q", 112),
    ];
    this.hudChipRoot.add(this.hudChips.map((chip) => chip.container));

    this.comboBadge = this.add.container(0, 0).setDepth(22).setVisible(false);
    this.comboBadgeBg = this.add
      .rectangle(0, 0, 178, 40, 0x12341c, 0.94)
      .setOrigin(0, 0.5)
      .setStrokeStyle(3, 0xf4df6a, 0.82);
    this.comboBadgeText = this.add
      .text(12, -10, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#06190f",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setShadow(0, 2, "#06190f", 2, false, true);
    this.comboBadgeMeter = this.add.rectangle(12, 12, 0, 4, 0xf4df6a, 0.92).setOrigin(0, 0.5);
    this.comboBadge.add([this.comboBadgeBg, this.comboBadgeText, this.comboBadgeMeter]);

    this.goalNudgeRoot = this.add.container(0, 0).setDepth(23).setVisible(false);
    this.goalNudgeBg = this.add
      .rectangle(0, 0, 360, 34, 0x0a2a17, 0.88)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xb7eba5, 0.7);
    this.goalNudgeIcon = this.add
      .text(16, 17, "GO", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "11px",
        color: "#fff3a8",
        stroke: "#06190f",
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.goalNudgeText = this.add
      .text(34, 9, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#f7ffe8",
        stroke: "#06190f",
        strokeThickness: 3,
      })
      .setOrigin(0, 0);
    this.goalNudgeRoot.add([this.goalNudgeBg, this.goalNudgeIcon, this.goalNudgeText]);

    this.milestoneText = this.add
      .text(26, 108, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#fff7c7",
        stroke: "#215228",
        strokeThickness: 4,
        wordWrap: { width: 420 },
      })
      .setDepth(20)
      .setShadow(0, 2, "#06190f", 2, false, true);

    this.createTriggerFeed();
    this.menuDockBg = this.add
      .rectangle(10, this.scale.height - 96, this.scale.width - 20, 88, 0x06190f, 0.72)
      .setOrigin(0, 0)
      .setDepth(19)
      .setStrokeStyle(2, 0xffef78, 0.45)
      .setVisible(false);

    this.skillButton = createTextButton(this, "Skills", () => this.openSkillTree(), 118, 44, 20);
    this.questButton = createTextButton(this, "Quests", () => this.openQuestLog(), 118, 44, 20);
    this.seedButton = createTextButton(this, "Seeds", () => this.openSeedShop(), 118, 44, 20);
    this.storeButton = createTextButton(this, "Store", () => this.openGoldStore(), 118, 44, 20);
    this.autoButton = createTextButton(this, "Auto", () => this.openAutomationPanel(), 118, 44, 20);
    this.journalButton = createTextButton(this, "Journal", () => this.openJournal(), 118, 44, 20);
    this.optionsButton = createTextButton(this, "Options", () => this.openOptions(), 118, 44, 20);
  }

  private createHudChip(
    id: HudChipId,
    titleText: string,
    textureKey: string | undefined,
    fallbackIcon: string,
    width: number,
  ): HudChipView {
    const container = this.add.container(0, 0);
    const glow = this.add
      .rectangle(0, 0, width + 6, HUD_CHIP_HEIGHT + 6, 0xffef78, 0.12)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffef78, 0.7)
      .setVisible(false);
    const bg = this.add
      .rectangle(0, 0, width, HUD_CHIP_HEIGHT, 0x0d331b, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffef78, 0.76);
    const iconBg = this.add.ellipse(24, HUD_CHIP_HEIGHT / 2, 30, 30, 0xf4ffdc, 0.96).setStrokeStyle(2, 0x75d894, 0.9);
    const iconImage = textureKey && this.textures.exists(textureKey) ? this.add.image(24, HUD_CHIP_HEIGHT / 2, textureKey).setDisplaySize(22, 22) : undefined;
    const iconText = iconImage
      ? undefined
      : this.add
          .text(24, HUD_CHIP_HEIGHT / 2, fallbackIcon, {
            fontFamily: "Trebuchet MS, Arial",
            fontSize: "13px",
            color: "#173b20",
            stroke: "#ffffff",
            strokeThickness: 2,
          })
          .setOrigin(0.5);
    const title = this.add.text(44, 7, titleText, {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "11px",
      color: "#b7eba5",
      stroke: "#06190f",
      strokeThickness: 2,
    });
    const value = this.add.text(44, 23, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "16px",
      color: "#f7ffe8",
      stroke: "#06190f",
      strokeThickness: 3,
    });

    container.add([glow, bg, iconBg, ...(iconImage ? [iconImage] : []), ...(iconText ? [iconText] : []), title, value]);
    return { id, container, bg, glow, iconBg, iconImage, iconText, title, value, width };
  }

  private createTriggerFeed(): void {
    this.triggerFeedRoot = this.add.container(0, 0).setDepth(28).setVisible(false);
    this.triggerFeedBg = this.add
      .rectangle(0, 0, TRIGGER_FEED_WIDTH, 96, 0x082211, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xb7eba5, 0.82)
      .setInteractive({ useHandCursor: true });
    this.triggerFeedBg.on("pointerdown", () => {
      this.triggerFeedCollapsed = !this.triggerFeedCollapsed;
      this.renderTriggerFeed(true);
      this.layoutTriggerFeed();
    });
    this.triggerFeedTitle = this.add.text(14, 12, "Trigger Feed", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "15px",
      color: "#fff3a8",
      stroke: "#06190f",
      strokeThickness: 3,
    });
    this.triggerFeedToggle = this.add
      .text(TRIGGER_FEED_WIDTH - 24, 12, "^", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#dfffc8",
        stroke: "#06190f",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);

    this.triggerFeedRoot.add([this.triggerFeedBg, this.triggerFeedTitle, this.triggerFeedToggle]);
    for (let index = 0; index < TRIGGER_FEED_MAX_EVENTS; index += 1) {
      const row = this.createTriggerFeedRow(index);
      this.triggerFeedRows.push(row);
      this.triggerFeedRoot.add(row.container);
    }
  }

  private createTriggerFeedRow(index: number): TriggerFeedRowView {
    const container = this.add.container(10, 42 + index * TRIGGER_FEED_ROW_HEIGHT).setVisible(false);
    const bg = this.add
      .rectangle(0, 0, TRIGGER_FEED_WIDTH - 20, TRIGGER_FEED_ROW_HEIGHT - 6, 0x12341c, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x75d894, 0.62);
    const accent = this.add.rectangle(0, 0, 4, TRIGGER_FEED_ROW_HEIGHT - 6, 0x75d894, 0.88).setOrigin(0, 0);
    const icon = this.add
      .text(14, 15, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "15px",
        color: "#bff4ff",
        stroke: "#06190f",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0);
    const label = this.add.text(32, 8, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "12px",
      color: "#f7ffe8",
      stroke: "#06190f",
      strokeThickness: 2,
      wordWrap: { width: TRIGGER_FEED_WIDTH - 100 },
    });
    const detail = this.add.text(32, 26, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "11px",
      color: "#dfffc8",
      stroke: "#06190f",
      strokeThickness: 2,
      wordWrap: { width: TRIGGER_FEED_WIDTH - 100 },
    });
    const count = this.add
      .text(TRIGGER_FEED_WIDTH - 34, 8, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "10px",
        color: "#fff3a8",
        stroke: "#06190f",
        strokeThickness: 2,
      })
      .setOrigin(1, 0);
    const age = this.add
      .text(TRIGGER_FEED_WIDTH - 34, 27, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "10px",
        color: "#fff3a8",
        stroke: "#06190f",
        strokeThickness: 2,
      })
      .setOrigin(1, 0);

    container.add([bg, accent, icon, label, detail, count, age]);
    return { container, bg, accent, icon, label, detail, count, age };
  }

  private createBoardLayers(): void {
    this.boardBackdropGraphics = this.add.graphics().setDepth(-3);
    this.commonTileLayer = this.add
      .renderTexture(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0, 0)
      .setDepth(-2);
    this.commonTileLayerWidth = this.scale.width;
    this.commonTileLayerHeight = this.scale.height;
    this.boardHitZone = this.add
      .zone(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0, 0)
      .setDepth(-1)
      .setInteractive();
    this.hoverMarker = this.add
      .rectangle(0, 0, TILE_SIZE + 8, TILE_SIZE + 8, 0xffffff, 0)
      .setOrigin(0.5)
      .setStrokeStyle(4, 0xf4ff8a, 0.82)
      .setDepth(32)
      .setVisible(false);
  }

  private createPerfPanel(): void {
    if (!this.perfOverlayEnabled) {
      return;
    }

    this.perfText = this.add
      .text(26, 0, "", {
        fontFamily: "Consolas, monospace",
        fontSize: "13px",
        color: "#dfffc8",
        backgroundColor: "rgba(6, 25, 15, 0.72)",
        padding: { x: 8, y: 6 },
      })
      .setDepth(140)
      .setScrollFactor(0);
    this.refreshPerfPanel();
  }

  private refreshPerfPanel(): void {
    if (!this.perfText) {
      return;
    }

    const fps = Math.round(this.game.loop.actualFps);
    const layoutPasses = this.layoutPassCount - this.lastPerfLayoutPassCount;
    const redraws = this.commonLayerRedrawCount - this.lastPerfCommonLayerRedrawCount;
    const commonStamps = this.commonStampOpsSinceLastPerf;
    this.lastPerfLayoutPassCount = this.layoutPassCount;
    this.lastPerfCommonLayerRedrawCount = this.commonLayerRedrawCount;
    this.commonStampOpsSinceLastPerf = 0;
    const hotspots = this.consumePerfHotspotSummary();
    const stats: PerfStatsSnapshot = {
      fps,
      maxFrameDeltaMs: Math.round(this.maxFrameDeltaMs),
      frameSpikes: this.frameSpikeCount,
      totalTiles: this.lastStressStats.totalTiles,
      visibleTiles: this.lastStressStats.visibleTiles,
      tileViews: this.tileViews.size,
      dirtyTiles: this.dirtyTileViewKeys.size,
      staleTiles: this.staleCommonTileKeys.size,
      redrawQueued: this.commonRedrawQueuedTiles,
      commonStamps,
      displayObjects: this.children.list.length,
      emitters: this.burstEmitters.size + this.uiBurstEmitters.size,
      activeTweens: this.getActiveTweenCount(),
      autoFxObjects: this.activeAutoTouchVisualObjects,
      fieldFxObjects: this.activeFieldLifeVisualObjects,
      layoutPasses,
      redraws,
      tileMode: this.getTileMode(),
      quality: Number(this.effectQuality.toFixed(2)),
      weatherQuality: Number(this.weatherParticleQuality.toFixed(2)),
      queuedSave: this.saveQueued,
      hotspots,
    };
    this.latestPerfStats = stats;
    (window as unknown as { __grassStressStats?: typeof stats }).__grassStressStats = stats;
    document.documentElement.dataset.grassPerf = JSON.stringify(stats);
    this.perfText.setText(
      [
        this.stressMode ? "STRESS" : "PERF",
        `fps ${stats.fps}`,
        `tiles ${stats.visibleTiles}/${stats.totalTiles}`,
        `mode ${stats.tileMode}`,
        `views ${stats.tileViews}`,
        stats.dirtyTiles > 0 ? `dirty ${stats.dirtyTiles}` : "",
        stats.staleTiles > 0 ? `stale ${stats.staleTiles}` : "",
        stats.redrawQueued > 0 ? `queue ${stats.redrawQueued}` : "",
        stats.commonStamps > 0 ? `stamps ${stats.commonStamps}` : "",
        `objects ${stats.displayObjects}`,
        `emitters ${stats.emitters}`,
        stats.autoFxObjects > 0 ? `autoFx ${stats.autoFxObjects}` : "",
        stats.fieldFxObjects > 0 ? `fieldFx ${stats.fieldFxObjects}` : "",
        `tw ${stats.activeTweens}`,
        `dt ${stats.maxFrameDeltaMs}`,
        `spikes ${stats.frameSpikes}`,
        `layout ${stats.layoutPasses}/${stats.redraws}`,
        `fx ${stats.quality}`,
        stats.queuedSave ? "save queued" : "",
        `\n${stats.hotspots}`,
      ].join("  "),
    );
    this.layoutPerfPanel();
  }

  private layoutPerfPanel(): void {
    if (!this.perfText) {
      return;
    }

    const mobilePortrait = this.isMobilePortrait();
    const feedBottom = this.triggerFeedRoot?.visible ? this.triggerFeedRoot.y + this.triggerFeedBg.height + 8 : 0;
    const nudgeBottom = this.goalNudgeRoot?.visible ? this.goalNudgeRoot.y + this.goalNudgeBg.height + 8 : 0;
    const milestoneBottom = (this.milestoneText?.y ?? 108) + (this.milestoneText?.height ?? 0) + 8;
    const hudBottom = (this.hudChipBottomY || 108) + 8;
    let y = Math.max(122, hudBottom, nudgeBottom, milestoneBottom, feedBottom);

    if (mobilePortrait) {
      const dockTop = Number.isFinite(this.mobileCommandDockTop) ? this.mobileCommandDockTop : this.scale.height - 112;
      const maxY = Math.max(hudBottom, dockTop - this.perfText.height - 10);
      y = Math.min(y, maxY);
    }

    this.perfText.setPosition(mobilePortrait ? 12 : 26, y);
  }

  private getActiveTweenCount(): number {
    const tweenManager = this.tweens as unknown as { getTweens?: () => unknown[]; getAllTweens?: () => unknown[] };
    return tweenManager.getTweens?.().length ?? tweenManager.getAllTweens?.().length ?? 0;
  }

  private shouldProfile(): boolean {
    return this.perfOverlayEnabled;
  }

  private profileScope<T>(name: string, callback: () => T): T {
    if (!this.shouldProfile()) {
      return callback();
    }

    const start = performance.now();
    try {
      return callback();
    } finally {
      this.recordPerfScope(name, performance.now() - start);
    }
  }

  private recordPerfScope(name: string, durationMs: number): void {
    if (!this.shouldProfile() || !Number.isFinite(durationMs) || durationMs < 0.05) {
      return;
    }

    const sample = this.perfScopeSamples.get(name) ?? { max: 0, total: 0, count: 0 };
    sample.max = Math.max(sample.max, durationMs);
    sample.total += durationMs;
    sample.count += 1;
    this.perfScopeSamples.set(name, sample);
  }

  private consumePerfHotspotSummary(): string {
    const entries = [...this.perfScopeSamples.entries()]
      .sort(([, left], [, right]) => right.max - left.max)
      .slice(0, 6);
    this.perfScopeSamples.clear();

    if (entries.length === 0) {
      this.lastPerfHotspotSummary = "hot none";
      return this.lastPerfHotspotSummary;
    }

    this.lastPerfHotspotSummary = `hot ${entries
      .map(([name, sample]) => `${name} ${formatPerfDuration(sample.max)}/${formatPerfDuration(sample.total / sample.count)}x${sample.count}`)
      .join("  ")}`;
    return this.lastPerfHotspotSummary;
  }

  private createWeatherVisuals(): void {
    this.weatherTint = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(18)
      .setVisible(false);

    this.weatherBadge = this.add.container(0, 0).setDepth(21).setVisible(false);
    this.weatherBadgeBg = this.add
      .rectangle(0, 0, 280, 58, 0xf4ffdc, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x2d6f36);
    this.weatherBadgeTitle = this.add.text(14, 8, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "17px",
      color: "#183d20",
    });
    this.weatherBadgeBody = this.add.text(14, 31, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "12px",
      color: "#416247",
      wordWrap: { width: 250 },
    });

    this.weatherBadge.add([this.weatherBadgeBg, this.weatherBadgeTitle, this.weatherBadgeBody]);
    this.layoutWeatherVisuals();
  }

  private createSeasonVisuals(): void {
    this.seasonTint = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0)
      .setOrigin(0, 0)
      .setDepth(17)
      .setVisible(true);
    this.layoutSeasonVisuals();
  }

  private createEmeraldBackdrop(): void {
    this.emeraldBackground = this.add
      .image(this.scale.width / 2, this.scale.height / 2, "meadow-clearing-bg")
      .setOrigin(0.5)
      .setDepth(-20)
      .setAlpha(1);
    this.layoutEmeraldBackdrop();
    this.createAmbientSpores();
  }

  private layoutEmeraldBackdrop(): void {
    if (!this.emeraldBackground) {
      return;
    }

    this.emeraldBackground.setPosition(this.scale.width / 2, this.scale.height / 2);
    const coverScale = Math.max(this.scale.width / this.emeraldBackground.width, this.scale.height / this.emeraldBackground.height);
    this.emeraldBackground.setScale(coverScale);
    this.createAmbientSpores();
  }

  private createAmbientSpores(): void {
    this.ambientSpores?.destroy();
    this.ambientSpores = this.add
      .particles(0, 0, "effect-magic-spore", {
        x: { min: 12, max: Math.max(12, this.scale.width - 12) },
        y: { min: 118, max: Math.max(118, this.scale.height - 20) },
        lifespan: { min: 2400, max: 4600 },
        speedX: { min: -10, max: 18 },
        speedY: { min: -18, max: -5 },
        rotate: { min: -30, max: 30 },
        scale: { start: 0.85, end: 0.12 },
        alpha: { start: 0.22, end: 0 },
        frequency: 720,
        quantity: 1,
        maxParticles: 18,
      })
      .setDepth(16);
  }

  private layoutHeader(): void {
    const compact = this.scale.width < 760;
    const mobilePortrait = this.isMobilePortrait();
    const headerWidth = mobilePortrait ? Math.max(174, this.scale.width - 122) : Math.max(220, Math.min(620, this.scale.width - 180));

    this.titleText.setFontSize(mobilePortrait ? 20 : compact ? 22 : 30);
    this.titleText.setWordWrapWidth(headerWidth);
    this.buildLabelText.setFontSize(mobilePortrait ? 10 : compact ? 12 : 13);
    this.buildLabelText.setWordWrapWidth(headerWidth);
    this.resourceText.setVisible(false);
    this.comboBadgeText.setFontSize(mobilePortrait ? 12 : compact ? 14 : 16);
    this.goalNudgeText.setFontSize(mobilePortrait ? 11 : compact ? 12 : 13);
    this.goalNudgeIcon.setFontSize(mobilePortrait ? 10 : 11);
    this.milestoneText.setFontSize(mobilePortrait ? 12 : compact ? 13 : 16);
    this.milestoneText.setWordWrapWidth(mobilePortrait ? Math.max(240, this.scale.width - 36) : headerWidth);

    this.titleText.setPosition(mobilePortrait ? 18 : 24, mobilePortrait ? 16 : 18);
    this.buildLabelText.setPosition(mobilePortrait ? 20 : 26, this.titleText.y + this.titleText.height);
    this.layoutHudChips();
    this.milestoneText.setPosition(mobilePortrait ? 20 : 26, this.layoutGoalNudge(this.layoutComboBadge()));
    this.layoutMenuButtons();
    this.layoutTriggerFeed();
    this.layoutSeasonVisuals();
    this.layoutWeatherVisuals();
  }

  private isMobilePortrait(): boolean {
    return this.scale.width < 520 && this.scale.height >= this.scale.width * 1.12;
  }

  private getMobileMenuBottom(): number {
    return 0;
  }

  private layoutHudChips(): void {
    const mobilePortrait = this.isMobilePortrait();
    const compact = this.scale.width < 760;
    const chipHeight = mobilePortrait || compact ? HUD_CHIP_COMPACT_HEIGHT : HUD_CHIP_HEIGHT;
    const gap = mobilePortrait ? 6 : HUD_CHIP_GAP;
    const startX = mobilePortrait ? 14 : 26;
    const startY = this.buildLabelText.y + this.buildLabelText.height + (mobilePortrait ? 8 : 10);
    const rightLimit = mobilePortrait ? this.scale.width - 14 : Math.max(startX + 260, this.scale.width - (compact ? 18 : 170));
    const mobileWidth = Math.max(86, Math.floor((rightLimit - startX - gap * 2) / 3));
    const widths: Record<HudChipId, number> = mobilePortrait
      ? { touches: mobileWidth, seeds: mobileWidth, gold: mobileWidth, auto: mobileWidth, quest: mobileWidth }
      : compact
        ? { touches: 150, seeds: 88, gold: 88, auto: 122, quest: 96 }
        : { touches: 178, seeds: 98, gold: 98, auto: 136, quest: 112 };

    let x = startX;
    let y = startY;
    let rowBottom = y + chipHeight;
    let rowRight = x;
    for (const chip of this.hudChips) {
      const width = widths[chip.id];
      if (x > startX && x + width > rightLimit) {
        x = startX;
        y = rowBottom + gap;
        rowBottom = y + chipHeight;
      }

      this.resizeHudChip(chip, width, chipHeight, compact || mobilePortrait);
      chip.container.setPosition(x, y);
      x += width + gap;
      rowRight = Math.max(rowRight, x - gap);
      rowBottom = Math.max(rowBottom, y + chipHeight);
    }

    this.hudChipBottomY = rowBottom;
    this.hudChipRightX = rowRight;
  }

  private resizeHudChip(chip: HudChipView, width: number, height: number, compact: boolean): void {
    chip.width = width;
    chip.glow.setSize(width + 6, height + 6);
    chip.glow.setPosition(-3, -3);
    chip.bg.setSize(width, height);
    chip.iconBg.setPosition(22, height / 2).setDisplaySize(compact ? 26 : 30, compact ? 26 : 30);
    chip.iconImage?.setPosition(22, height / 2).setDisplaySize(compact ? 19 : 22, compact ? 19 : 22);
    chip.iconText?.setPosition(22, height / 2).setFontSize(compact ? 11 : 13);
    chip.title.setPosition(40, compact ? 5 : 7).setFontSize(compact ? 10 : 11).setWordWrapWidth(Math.max(40, width - 46));
    chip.value.setPosition(40, compact ? 20 : 23).setFontSize(compact || width < 100 ? 12 : 16).setWordWrapWidth(Math.max(40, width - 46));
  }

  private layoutMenuButtons(): void {
    const mobilePortrait = this.isMobilePortrait();
    const buttonScale = mobilePortrait ? 0.74 : 1;
    const visibleButtons = [
      this.skillButton,
      this.questButton,
      this.seedButton,
      this.storeButton,
      getAutomationUnitCount(this.state) > 0 ? this.autoButton : undefined,
      this.state.seedShopPurchases.field_journal === true ? this.journalButton : undefined,
      this.optionsButton,
    ].filter((button): button is Phaser.GameObjects.Container => button !== undefined);

    this.autoButton.setVisible(getAutomationUnitCount(this.state) > 0);
    this.journalButton.setVisible(this.state.seedShopPurchases.field_journal === true);

    if (mobilePortrait) {
      const columns = Math.min(4, visibleButtons.length);
      const rows = Math.ceil(visibleButtons.length / columns);
      const scaledButtonWidth = 118 * buttonScale;
      const scaledButtonHeight = 44 * buttonScale;
      const gap = 7;
      const dockHeight = rows * scaledButtonHeight + Math.max(0, rows - 1) * gap + MOBILE_COMMAND_DOCK_PADDING * 2;
      const dockTop = Math.max(12, this.scale.height - dockHeight - 8);
      this.mobileCommandDockTop = dockTop;
      this.mobileCommandDockHeight = dockHeight;
      this.menuDockBg
        .setPosition(10, dockTop)
        .setSize(this.scale.width - 20, dockHeight)
        .setFillStyle(0x06190f, 0.84)
        .setStrokeStyle(2, 0xb7eba5, 0.58)
        .setVisible(!this.hasBlockingOverlayOpen());

      visibleButtons.forEach((button, index) => {
        const row = Math.floor(index / columns);
        const column = index % columns;
        const rowCount = row === rows - 1 ? visibleButtons.length - row * columns : columns;
        const rowWidth = rowCount * scaledButtonWidth + Math.max(0, rowCount - 1) * gap;
        const x = (this.scale.width - rowWidth) / 2 + column * (scaledButtonWidth + gap);
        const y = dockTop + MOBILE_COMMAND_DOCK_PADDING + row * (scaledButtonHeight + gap);
        button.setScale(buttonScale);
        button.setPosition(x, y);
      });
      return;
    }

    this.mobileCommandDockTop = Number.POSITIVE_INFINITY;
    this.mobileCommandDockHeight = 0;
    this.menuDockBg.setVisible(false);
    const buttonX = this.scale.width - 142;
    let buttonY = 24;
    const buttonStep = 52;
    for (const button of visibleButtons) {
      button.setScale(buttonScale);
      button.setPosition(buttonX, buttonY);
      buttonY += buttonStep;
    }
  }

  private layoutComboBadge(): number {
    const compact = this.scale.width < 760;
    const mobilePortrait = this.isMobilePortrait();
    const badgeWidth = mobilePortrait ? 136 : compact ? 166 : 194;
    const badgeHeight = mobilePortrait ? 28 : compact ? 36 : 40;
    const resourceBottom = this.hudChipBottomY || this.buildLabelText.y + this.buildLabelText.height + 12;
    const rightUiLeft = this.scale.width - 156;
    const fitsRight = !compact && this.hudChipRightX + badgeWidth + 22 < rightUiLeft;

    this.comboBadgeBg.setSize(badgeWidth, badgeHeight);
    this.comboBadgeMeter.setPosition(12, mobilePortrait ? 7 : compact ? 10 : 12);

    if (mobilePortrait && !this.comboBadge.visible) {
      return resourceBottom + 10;
    }

    if (fitsRight) {
      this.comboBadge.setPosition(this.hudChipRightX + 12, resourceBottom - (mobilePortrait ? HUD_CHIP_COMPACT_HEIGHT : HUD_CHIP_HEIGHT) / 2);
      return resourceBottom + 12;
    }

    this.comboBadge.setPosition(26, resourceBottom + 24);
    return resourceBottom + badgeHeight + (mobilePortrait ? 14 : 20);
  }

  private layoutGoalNudge(startY: number): number {
    if (!this.goalNudgeRoot) {
      return startY;
    }

    const mobilePortrait = this.isMobilePortrait();
    const compact = this.scale.width < 760;
    const x = mobilePortrait ? 18 : 26;
    const rightLimit = mobilePortrait ? this.scale.width - 18 : Math.max(x + 260, this.scale.width - (compact ? 18 : 170));
    const maxWidth = mobilePortrait ? Math.max(180, this.scale.width - 36) : 420;
    const minWidth = Math.min(maxWidth, mobilePortrait ? 260 : 300);
    const width = Phaser.Math.Clamp(rightLimit - x, minWidth, maxWidth);
    const height = mobilePortrait ? 30 : 34;
    const visible = this.goalNudgeRoot.visible;

    this.goalNudgeBg.setSize(width, height);
    this.goalNudgeIcon.setPosition(mobilePortrait ? 15 : 16, height / 2);
    this.goalNudgeText
      .setPosition(mobilePortrait ? 30 : 34, mobilePortrait ? 8 : 9)
      .setWordWrapWidth(Math.max(120, width - (mobilePortrait ? 42 : 48)));
    this.goalNudgeRoot.setPosition(x, startY);
    return visible ? startY + height + (mobilePortrait ? 8 : 10) : startY;
  }

  private layoutSeasonVisuals(): void {
    if (!this.seasonTint) {
      return;
    }

    const season = getSeasonForDate(new Date());
    this.seasonTint.setSize(this.scale.width, this.scale.height);
    this.seasonTint.setFillStyle(season.color, season.alpha);
    this.setVisibleIfChanged(this.seasonTint, !this.hasBlockingOverlayOpen());
  }

  private layoutWeatherVisuals(): void {
    if (!this.weatherTint || !this.weatherBadge) {
      return;
    }

    this.weatherTint.setSize(this.scale.width, this.scale.height);
    const compact = this.scale.width < 720;
    const badgeWidth = compact ? Math.max(220, this.scale.width - 180) : 280;
    const rightMenuLeft = this.scale.width - 156;
    const desktopBadgeX = Math.max(26, rightMenuLeft - badgeWidth - 18);
    this.weatherBadgeBg.setSize(badgeWidth, compact ? 66 : 58);
    this.weatherBadgeBody.setWordWrapWidth(badgeWidth - 30);
    this.weatherBadge.setPosition(compact ? 26 : desktopBadgeX, compact ? this.optionsButton.y + 58 : 232);

    if (this.state?.seedShopPurchases.weather_jar && this.state.activeWeatherId && this.activeWeatherVisualId === this.state.activeWeatherId) {
      this.createWeatherParticleEffect(this.state.activeWeatherId);
    }
  }

  private addTriggerFeedEvent(label: string, detail: string, icon: string, color: number, now = Date.now()): void {
    const repeated = this.triggerFeedEvents.find(
      (event) =>
        event.label === label &&
        event.detail === detail &&
        event.icon === icon &&
        event.color === color &&
        now - event.createdAt < TRIGGER_FEED_REPEAT_WINDOW_MS,
    );
    if (repeated) {
      repeated.createdAt = now;
      repeated.count += 1;
      this.triggerFeedEvents = [repeated, ...this.triggerFeedEvents.filter((event) => event !== repeated)];
      this.renderTriggerFeed(true);
      return;
    }

    this.triggerFeedEvents.unshift({
      id: this.nextTriggerFeedId,
      label,
      detail,
      icon,
      color,
      createdAt: now,
      count: 1,
    });
    this.nextTriggerFeedId += 1;
    this.triggerFeedEvents = this.triggerFeedEvents.slice(0, TRIGGER_FEED_MAX_EVENTS);
    this.renderTriggerFeed(true);
  }

  private addHazardTriggerFeedEvent(text: string): void {
    if (text === "cactus") {
      this.addTriggerFeedEvent("Cactus appeared", "watch your fingers", "HZ", 0xffb347);
      return;
    }

    if (text === "weeds") {
      this.addTriggerFeedEvent("Weeds appeared", "clear the patch", "HZ", 0xb7eba5);
      return;
    }

    if (text === "spread weeds") {
      this.addTriggerFeedEvent("Weeds spread", "nearby patch blocked", "HZ", 0xb7eba5);
    }
  }

  private layoutTriggerFeed(): void {
    if (!this.triggerFeedRoot) {
      return;
    }

    const mobilePortrait = this.isMobilePortrait();
    const visible =
      !this.hasBlockingOverlayOpen() &&
      this.triggerFeedEvents.length > 0 &&
      ((!mobilePortrait && this.scale.width >= 720 && this.scale.height >= 540) ||
        (mobilePortrait && this.scale.width >= 340 && this.scale.height >= 680));
    this.triggerFeedRoot.setVisible(visible);
    if (!visible) {
      this.layoutPerfPanel();
      return;
    }

    const feedWidth = this.getTriggerFeedWidth();
    const rowHeight = this.getTriggerFeedRowHeight();
    const rowLimit = this.getTriggerFeedVisibleLimit();
    const rowCount = this.triggerFeedCollapsed ? 0 : Math.min(this.triggerFeedEvents.length, rowLimit);
    const height = this.triggerFeedCollapsed ? 42 : 44 + rowCount * rowHeight;
    const x = mobilePortrait ? 8 : 18;
    const desktopY = Math.max(166, this.boardTopY + 14, this.milestoneText.y + this.milestoneText.height + 12);
    const mobileY = Math.min(
      Math.max(this.hudChipBottomY + 8, this.milestoneText.y + this.milestoneText.height + 8),
      Math.max(this.hudChipBottomY + 8, this.mobileCommandDockTop - height - 18),
    );
    const y = mobilePortrait ? mobileY : desktopY;
    this.triggerFeedRoot.setPosition(x, y);
    this.triggerFeedBg.setSize(feedWidth, Math.max(42, height));
    this.triggerFeedTitle.setPosition(mobilePortrait ? 12 : 14, mobilePortrait ? 10 : 12).setFontSize(mobilePortrait ? 13 : 15);
    this.triggerFeedToggle.setPosition(feedWidth - 24, mobilePortrait ? 10 : 12);
    this.triggerFeedRows.forEach((row, index) => {
      if (index >= rowLimit) {
        row.container.setVisible(false);
      }
      row.container.setPosition(mobilePortrait ? 8 : 10, 38 + index * rowHeight);
      row.bg.setSize(feedWidth - (mobilePortrait ? 16 : 20), rowHeight - 6);
      row.accent.setSize(mobilePortrait ? 3 : 4, rowHeight - 6);
      row.icon.setPosition(mobilePortrait ? 13 : 14, mobilePortrait ? 14 : 15).setFontSize(mobilePortrait ? 12 : 15);
      row.label
        .setPosition(mobilePortrait ? 30 : 32, mobilePortrait ? 7 : 8)
        .setFontSize(mobilePortrait ? 11 : 12)
        .setWordWrapWidth(Math.max(78, feedWidth - (mobilePortrait ? 104 : 112)));
      row.detail
        .setPosition(mobilePortrait ? 30 : 32, mobilePortrait ? 24 : 26)
        .setFontSize(mobilePortrait ? 10 : 11)
        .setWordWrapWidth(Math.max(78, feedWidth - (mobilePortrait ? 104 : 112)));
      row.count.setPosition(feedWidth - (mobilePortrait ? 28 : 34), mobilePortrait ? 7 : 8);
      row.age.setPosition(feedWidth - (mobilePortrait ? 28 : 34), mobilePortrait ? 24 : 27);
    });
    this.layoutPerfPanel();
  }

  private getTriggerFeedWidth(): number {
    return this.isMobilePortrait() ? Math.min(222, this.scale.width - 18) : TRIGGER_FEED_WIDTH;
  }

  private getTriggerFeedRowHeight(): number {
    return this.isMobilePortrait() ? 48 : TRIGGER_FEED_ROW_HEIGHT;
  }

  private getTriggerFeedVisibleLimit(): number {
    return this.isMobilePortrait() ? 3 : TRIGGER_FEED_MAX_EVENTS;
  }

  private renderTriggerFeed(force = false): void {
    if (!this.triggerFeedRoot) {
      return;
    }

    const now = Date.now();
    this.triggerFeedEvents = this.triggerFeedEvents.filter((event) => now - event.createdAt <= TRIGGER_FEED_EVENT_TTL_MS);
    const visibleEvents = this.triggerFeedCollapsed ? [] : this.triggerFeedEvents.slice(0, this.getTriggerFeedVisibleLimit());
    const ageBucket = visibleEvents.map((event) => Math.floor((now - event.createdAt) / 1000)).join(",");
    const renderKey = [
      this.triggerFeedCollapsed ? "closed" : "open",
      this.triggerFeedEvents.length,
      visibleEvents.map((event) => `${event.id}:${event.count}`).join(","),
      ageBucket,
    ].join("|");
    if (!force && renderKey === this.triggerFeedRenderKey) {
      return;
    }

    this.triggerFeedRenderKey = renderKey;
    this.setTextIfChanged(
      this.triggerFeedTitle,
      this.triggerFeedEvents.length > this.getTriggerFeedVisibleLimit() && !this.triggerFeedCollapsed
        ? `Trigger Feed +${this.triggerFeedEvents.length - this.getTriggerFeedVisibleLimit()}`
        : "Trigger Feed",
    );
    this.triggerFeedToggle.setText(this.triggerFeedCollapsed ? "v" : "^");
    visibleEvents.forEach((event, index) => {
      const row = this.triggerFeedRows[index];
      const ageMs = now - event.createdAt;
      row.container.setVisible(true);
      row.bg.setFillStyle(0x12341c, event.count > 1 ? 0.96 : 0.9);
      row.bg.setStrokeStyle(1, event.color, 0.68);
      row.accent.setFillStyle(event.color, event.count > 1 ? 1 : 0.82);
      row.icon.setText(event.icon).setColor(this.colorToHex(event.color));
      this.setTextIfChanged(row.label, event.label);
      this.setTextIfChanged(row.detail, event.detail);
      this.setTextIfChanged(row.count, event.count > 1 ? this.formatFeedCount(event.count) : "");
      row.count.setVisible(event.count > 1);
      this.setTextIfChanged(row.age, this.formatFeedAge(ageMs));
    });

    for (let index = visibleEvents.length; index < this.triggerFeedRows.length; index += 1) {
      this.triggerFeedRows[index].container.setVisible(false);
    }

    this.layoutTriggerFeed();
  }

  private colorToHex(color: number): string {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  private formatFeedAge(ageMs: number): string {
    const seconds = Math.max(0, Math.floor(ageMs / 1000));
    if (seconds < 60) {
      return `${seconds}s`;
    }

    return `${Math.floor(seconds / 60)}m`;
  }

  private formatFeedCount(count: number): string {
    return count > 99 ? "x99+" : `x${count}`;
  }

  private createTileInfoPanel(): void {
    this.tileInfoPanel = this.add.container(0, 0).setDepth(60).setVisible(false);
    this.tileInfoBg = this.add
      .rectangle(0, 0, 260, 128, 0xf4ffdc, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x2d6f36);
    this.tileInfoTitle = this.add.text(12, 10, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#183d20",
    });
    this.tileInfoBody = this.add.text(12, 38, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "14px",
      color: "#416247",
      lineSpacing: 2,
      wordWrap: { width: 236 },
    });

    this.tileInfoPanel.add([this.tileInfoBg, this.tileInfoTitle, this.tileInfoBody]);
  }

  private createSkillTree(): void {
    this.skillRoot?.destroy();
    this.skillNodeViews.clear();

    this.skillRoot = this.add.container(0, 0).setDepth(100).setVisible(false);
    this.skillBranchLabels = [];
    this.skillBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x04130b, 0.97)
      .setOrigin(0, 0)
      .setInteractive();
    this.skillBackdropPattern = this.add
      .image(this.scale.width / 2, this.scale.height / 2, "meadow-clearing-bg")
      .setOrigin(0.5)
      .setAlpha(0.22);
    this.skillMapBackdropGraphics = this.add.graphics();

    this.skillTitleText = this.add.text(0, 0, "Grass Skill Tree", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f4df6a",
      stroke: "#06190f",
      strokeThickness: 6,
    });

    this.skillResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#d6e6d0",
      stroke: "#06190f",
      strokeThickness: 4,
    });

    this.skillStatusText = this.add
      .text(0, 0, "Hover a skill to inspect it. Click a skill or Upgrade to buy.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#06190f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 2, "#06190f", 2, false, true);

    this.backButton = createTextButton(this, "Back", () => this.closeSkillTree(), 118, 44, 101);
    this.skillLineGraphics = this.add.graphics();
    this.skillRoot.add([
      this.skillBackdrop,
      this.skillBackdropPattern,
      this.skillMapBackdropGraphics,
      this.skillLineGraphics,
      this.skillTitleText,
      this.skillResourceText,
      this.skillStatusText,
      this.backButton,
    ]);

    for (const branch of SKILL_BRANCH_LABELS) {
      const text = this.add
        .text(0, 0, branch.text, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "18px",
          color: branch.color,
          stroke: "#102318",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setShadow(0, 2, "#06190f", 2, false, true);

      this.skillBranchLabels.push({ text, treeX: branch.x, treeY: branch.y, revealedBy: branch.revealedBy });
      this.skillRoot.add(text);
    }

    for (const upgrade of UPGRADES) {
      const container = this.add.container(0, 0);
      const bg = this.add
        .rectangle(0, 0, SKILL_NODE_SIZE, SKILL_NODE_SIZE, 0xffffff, 0.001)
        .setOrigin(0.5)
        .setStrokeStyle(1, upgrade.tree.color, 0)
        .setInteractive({ useHandCursor: true });
      const readyGlow = this.add
        .ellipse(0, -4, 90, 76, 0xffef78, 0.16)
        .setStrokeStyle(4, 0xffef78, 0.82)
        .setVisible(false);
      const glow = this.add.ellipse(0, -4, 74, 58, upgrade.tree.color, 0.22).setStrokeStyle(3, upgrade.tree.color, 0.44);
      const plate = this.add.circle(0, -4, 26, 0x06190f, 0.94).setStrokeStyle(4, upgrade.tree.color, 0.78);
      const frame = this.add
        .image(0, 0, SKILL_NODE_FRAME_KEYS.locked)
        .setDisplaySize(SKILL_NODE_VISUAL_SIZE, SKILL_NODE_VISUAL_SIZE)
        .setAlpha(0.88);
      const icon = this.add.image(0, -4, getSkillIconKey(upgrade.id)).setDisplaySize(38, 38);
      const lockedIcon = this.add
        .text(0, -7, "?", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "24px",
          color: "#f7ffe8",
          align: "center",
          stroke: "#102318",
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setShadow(0, 2, "#06190f", 2, false, true);
      const level = this.add
        .text(0, 31, "", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "11px",
          color: "#dfffc8",
          stroke: "#06190f",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setShadow(0, 2, "#06190f", 2, false, true);

      container.add([bg, readyGlow, glow, plate, frame, icon, lockedIcon, level]);
      bg.on("pointerover", () => {
        this.previewSkill(upgrade.id);
        this.startSkillHoverTremble(upgrade.id);
      });
      bg.on("pointerout", () => this.stopSkillHoverTremble(upgrade.id));
      bg.on("pointerdown", () => this.upgradeSkill(upgrade.id));
      this.skillNodeViews.set(upgrade.id, { upgradeId: upgrade.id, container, bg, readyGlow, glow, plate, frame, icon, lockedIcon, level });
      this.skillRoot.add(container);
    }

    this.skillDetailPanel = this.add.container(0, 0);
    this.skillDetailBg = this.add
      .nineslice(0, 0, "panel-emerald", undefined, SKILL_DETAIL_WIDTH, SKILL_DETAIL_HEIGHT, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE, PANEL_SLICE)
      .setOrigin(0, 0)
      .setAlpha(0.98);
    this.skillDetailTitle = this.add.text(24, 26, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "24px",
      color: "#f4df6a",
      stroke: "#071b11",
      strokeThickness: 4,
    }).setShadow(0, 2, "#06190f", 2, false, true);
    this.skillDetailCategory = this.add.text(24, 60, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "14px",
      color: "#8cae89",
    });
    this.skillDetailBody = this.add.text(24, 94, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "15px",
      color: "#d6e6d0",
      lineSpacing: 3,
      wordWrap: { width: SKILL_DETAIL_WIDTH - 52 },
    });
    this.skillDetailCost = this.add.text(24, 262, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#f4df6a",
      stroke: "#071b11",
      strokeThickness: 3,
      lineSpacing: 2,
      wordWrap: { width: SKILL_DETAIL_WIDTH - 52 },
    });
    this.skillBuyButton = createTextButton(this, "Upgrade", () => this.upgradeSelectedSkill(), 260, 44, 101);
    this.skillBuyButton.setPosition(50, 340);
    this.skillDetailPanel.add([
      this.skillDetailBg,
      this.skillDetailTitle,
      this.skillDetailCategory,
      this.skillDetailBody,
      this.skillDetailCost,
      this.skillBuyButton,
    ]);
    this.skillRoot.add(this.skillDetailPanel);

    this.prestigeButton = createTextButton(this, "Prestige", () => this.handlePrestigePressed(), 126, 34, 101);
    this.resetButton = createTextButton(this, "Reset", () => this.handleResetPressed(), 92, 34, 101);
    this.skillRoot.add([this.prestigeButton, this.resetButton]);

    this.layoutSkillTree();
  }

  private layoutSkillTree(): void {
    const shortLandscape = this.scale.width > this.scale.height && this.scale.height < 520;
    const narrowPortrait = this.scale.width < 500 && this.scale.height >= this.scale.width;
    const narrowDesktop = this.scale.width < 760 && !shortLandscape && !narrowPortrait;
    const sidePanel = !shortLandscape && !narrowPortrait && !narrowDesktop;
    const detailPanelHeight = narrowPortrait ? Math.round(Math.max(236, Math.min(330, this.scale.height * 0.34))) : SKILL_DETAIL_HEIGHT;
    const detailPanelScale = shortLandscape ? 0.72 : narrowPortrait ? Math.min(0.96, (this.scale.width - 40) / SKILL_DETAIL_WIDTH) : 1;
    const detailPanelRenderedHeight = detailPanelHeight * detailPanelScale;
    const portraitPanelBottomGap = this.scale.height < 700 ? 50 : 68;
    const portraitPanelY = narrowPortrait ? Math.max(196, this.scale.height - detailPanelRenderedHeight - portraitPanelBottomGap) : 0;
    const portraitTreeY = narrowPortrait ? (this.scale.height < 700 ? 146 : 166) : 0;
    const portraitMapMaxHeight = narrowPortrait ? Math.max(150, portraitPanelY - portraitTreeY - 18) : 0;
    const reservedSideWidth = sidePanel ? 430 : 48;
    const reservedBottomHeight = narrowPortrait ? Math.round(detailPanelHeight * detailPanelScale + 132) : narrowDesktop ? 420 : 140;
    const mapWidth = TREE_WIDTH * SKILL_MAP_X_SCALE;
    const mapHeight = TREE_HEIGHT * SKILL_MAP_Y_SCALE;
    const treeScale = shortLandscape
      ? Math.max(0.38, Math.min(0.7, (this.scale.width - 310) / mapWidth, (this.scale.height - 126) / mapHeight))
      : narrowPortrait
        ? Math.min(SKILL_MAP_FOCUS_SCALE, (this.scale.width - reservedSideWidth) / mapWidth, portraitMapMaxHeight / (mapHeight + 56))
        : Math.min(SKILL_MAP_FOCUS_SCALE, (this.scale.width - reservedSideWidth) / mapWidth, (this.scale.height - reservedBottomHeight) / mapHeight);
    const treeWidth = mapWidth * treeScale;
    const treeHeight = mapHeight * treeScale;
    const treeX = Math.round(shortLandscape ? 34 : sidePanel ? Math.max(64, (this.scale.width - reservedSideWidth - treeWidth) / 2) : (this.scale.width - treeWidth) / 2);
    const treeY = Math.round(shortLandscape ? 118 : narrowPortrait ? portraitTreeY : narrowDesktop ? 136 : 148);

    this.skillBackdrop.setSize(this.scale.width, this.scale.height);
    this.skillBackdropPattern?.setPosition(this.scale.width / 2, this.scale.height / 2);
    const patternCoverScale = Math.max(this.scale.width / this.skillBackdropPattern.width, this.scale.height / this.skillBackdropPattern.height);
    this.skillBackdropPattern?.setScale(patternCoverScale);
    this.layoutSkillMapBackdrop(treeX, treeY, treeWidth, treeHeight, treeScale, shortLandscape);
    this.skillTitleText.setText(narrowPortrait ? "Skills" : "Grass Skill Tree");
    this.skillTitleText.setFontSize(shortLandscape ? 25 : narrowPortrait ? 30 : 34);
    this.skillResourceText.setFontSize(shortLandscape || narrowPortrait ? 14 : 18);
    this.skillResourceText.setWordWrapWidth(Math.max(220, this.scale.width - 44));
    this.skillStatusText.setFontSize(shortLandscape || narrowPortrait ? 13 : 16);
    this.skillStatusText.setWordWrapWidth(Math.max(220, this.scale.width - 48));
    this.skillTitleText.setPosition(shortLandscape ? 22 : 52, shortLandscape ? 22 : 42);
    this.skillResourceText.setPosition(shortLandscape ? 24 : 54, shortLandscape ? 58 : narrowPortrait ? 78 : 82);
    this.skillStatusText.setText(
      this.hasTouchScreen() ? "Tap a skill to upgrade it. The info box shows details." : "Hover a skill to inspect it. Click a skill or Upgrade to buy.",
    );
    this.skillStatusText.setPosition(
      shortLandscape ? this.scale.width / 2 + 20 : sidePanel ? treeX + treeWidth / 2 : this.scale.width / 2,
      shortLandscape ? 72 : narrowPortrait ? 132 : 118,
    );
    this.backButton.setScale(narrowPortrait ? 0.9 : 1);
    this.backButton.setPosition(this.scale.width - (shortLandscape ? 130 : 166), shortLandscape ? 20 : 42);
    this.resetButton.setScale(shortLandscape ? 0.78 : narrowPortrait ? 0.78 : 0.88);
    this.resetButton.setPosition(
      narrowPortrait ? this.scale.width / 2 + 76 : this.scale.width - 108,
      this.scale.height - (shortLandscape ? 42 : narrowPortrait ? 32 : 48),
    );
    this.prestigeButton.setScale(shortLandscape ? 0.78 : narrowPortrait ? 0.78 : 0.88);
    this.prestigeButton.setPosition(
      narrowPortrait ? this.scale.width / 2 - 58 : this.scale.width - (shortLandscape ? 226 : 236),
      this.scale.height - (shortLandscape ? 42 : narrowPortrait ? 32 : 48),
    );
    this.skillDetailPanel.setScale(detailPanelScale);
    this.skillDetailPanel.setPosition(
      shortLandscape
        ? this.scale.width - 252
        : narrowPortrait || narrowDesktop
          ? (this.scale.width - SKILL_DETAIL_WIDTH * detailPanelScale) / 2
          : Math.max(24, this.scale.width - 410),
      shortLandscape
        ? 112
        : narrowPortrait
          ? portraitPanelY
          : sidePanel
            ? 150
            : this.scale.height - 420,
    );
    this.skillDetailBg.setSize(SKILL_DETAIL_WIDTH, detailPanelHeight);
    const compactPortraitDetail = narrowPortrait && detailPanelHeight < 300;
    const densePortraitDetail = narrowPortrait && detailPanelHeight < 260;
    this.skillDetailTitle.setFontSize(densePortraitDetail ? 21 : compactPortraitDetail ? 23 : narrowPortrait ? 25 : 28);
    this.skillDetailTitle.setPosition(24, densePortraitDetail ? 16 : compactPortraitDetail ? 18 : narrowPortrait ? 22 : 26);
    this.skillDetailCategory.setFontSize(densePortraitDetail ? 13 : narrowPortrait ? 15 : 16);
    this.skillDetailCategory.setPosition(24, densePortraitDetail ? 44 : compactPortraitDetail ? 50 : narrowPortrait ? 54 : 60);
    this.skillDetailBody.setFontSize(densePortraitDetail ? 13 : compactPortraitDetail ? 14 : narrowPortrait ? 16 : 18);
    this.skillDetailBody.setPosition(24, densePortraitDetail ? 66 : compactPortraitDetail ? 76 : narrowPortrait ? 82 : 94);
    this.skillDetailBody.setWordWrapWidth(SKILL_DETAIL_WIDTH - 52);
    this.skillDetailCost.setFontSize(densePortraitDetail ? 13 : compactPortraitDetail ? 14 : narrowPortrait ? 16 : 18);
    this.skillDetailCost.setPosition(24, densePortraitDetail ? 126 : compactPortraitDetail ? 152 : narrowPortrait ? 198 : 262);
    this.skillDetailCost.setWordWrapWidth(SKILL_DETAIL_WIDTH - 52);
    const buyButtonScale = densePortraitDetail ? 0.74 : compactPortraitDetail ? 0.82 : narrowPortrait ? 0.92 : 1;
    this.skillBuyButton.setScale(buyButtonScale);
    this.skillBuyButton.setPosition(
      narrowPortrait ? (SKILL_DETAIL_WIDTH - 260 * buyButtonScale) / 2 : 50,
      densePortraitDetail ? detailPanelHeight - 46 : compactPortraitDetail ? detailPanelHeight - 52 : narrowPortrait ? 274 : 340,
    );

    for (const label of this.skillBranchLabels) {
      const visible = label.revealedBy.some((upgradeId) => this.isSkillVisible(upgradeId));
      label.text.setVisible(visible);
      label.text.setPosition(...this.getSkillTreeCoordinates(label.treeX, label.treeY, treeScale, treeX, treeY));
      label.text.setScale(Math.max(0.82, treeScale));
    }

    for (const upgrade of UPGRADES) {
      const view = this.skillNodeViews.get(upgrade.id);
      if (!view) {
        continue;
      }

      const visible = this.isSkillVisible(upgrade.id);
      const point = this.getSkillTreePoint(upgrade, treeScale, treeX, treeY);
      view.container.setPosition(point.x, point.y);
      view.container.setScale(treeScale);
      view.container.setVisible(visible);
      view.icon.setDisplaySize(treeScale < 0.62 ? 36 : 40, treeScale < 0.62 ? 36 : 40);
      view.level.setY(treeScale < 0.62 ? 29 : 31);
    }

    this.drawSkillLines(treeScale, treeX, treeY);
  }

  private createQuestLog(): void {
    this.questRoot?.destroy();
    this.questItemViews.clear();
    this.questFilterViews.clear();

    this.questRoot = this.add.container(0, 0).setDepth(104).setVisible(false);
    this.questBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x071b11, 0.98)
      .setOrigin(0, 0)
      .setInteractive();
    this.questTitleText = this.add.text(0, 0, "Quest Log", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f4df6a",
      stroke: "#06190f",
      strokeThickness: 6,
    }).setShadow(0, 3, "#06190f", 3, false, true);
    this.questResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#f7ffe8",
      backgroundColor: "#0f3d22",
      padding: { x: 12, y: 8 },
    });
    this.questStatusText = this.add
      .text(0, 0, "Complete small goals and claim the rewards.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#dfffc8",
        stroke: "#06190f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.questBackButton = createTextButton(this, "Back", () => this.closeQuestLog(), 118, 44, 105);
    this.questClaimReadyButton = createTextButton(this, "Claim Ready", () => this.claimReadyQuestRewards(), 150, 38, 105);
    this.questRoot.add([
      this.questBackdrop,
      this.questTitleText,
      this.questResourceText,
      this.questStatusText,
      this.questBackButton,
      this.questClaimReadyButton,
    ]);

    for (const filter of QUEST_FILTERS) {
      const container = this.add.container(0, 0);
      const bg = this.add
        .rectangle(0, 0, 86, 30, 0x173d23, 0.94)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xb7eba5, 0.68)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(43, 15, filter.label, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "13px",
          color: "#dfffc8",
          stroke: "#06190f",
          strokeThickness: 3,
        })
        .setOrigin(0.5);

      bg.on("pointerdown", () => this.selectQuestFilter(filter.id));
      container.add([bg, label]);
      this.questFilterViews.set(filter.id, { filterId: filter.id, container, bg, label });
      this.questRoot.add(container);
    }

    for (const quest of QUESTS) {
      const container = this.add.container(0, 0);
      const attentionGlow = this.createReadyRowGlow(470, 116, 0.16, 0.85);
      const bg = this.add
        .rectangle(0, 0, 460, 106, 0x12341c, 0.95)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0xb7eba5, 0.72);
      const name = this.add.text(14, 10, `${quest.category}: ${quest.name}`, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#f7ffe8",
      });
      const description = this.add.text(14, 38, quest.description, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#d6e6d0",
        wordWrap: { width: 278 },
      });
      const progress = this.add.text(14, 74, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#b7eba5",
      });
      const reward = this.add.text(300, 20, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#f4df6a",
        align: "center",
        wordWrap: { width: 140 },
      });
      const claimButton = createTextButton(this, "Claim", () => this.claimQuestReward(quest.id), 120, 36, 105);
      claimButton.setPosition(312, 60);
      const readyBadge = this.createReadyBadge();

      container.add([attentionGlow, bg, name, description, progress, reward, claimButton, readyBadge]);
      this.questItemViews.set(quest.id, {
        questId: quest.id,
        container,
        attentionGlow,
        bg,
        name,
        description,
        progress,
        reward,
        claimButton,
        readyBadge,
      });
      this.questRoot.add(container);
    }

    this.layoutQuestLog();
  }

  private layoutQuestLog(): void {
    if (!this.questRoot) {
      return;
    }

    const compact = this.scale.width < 620;
    const panelWidth = Math.min(520, this.scale.width - 32);
    const itemHeight = compact ? 138 : 106;
    const itemGap = itemHeight + 10;
    const filterRows = compact ? 2 : 1;
    const filterY = compact ? 182 : 136;
    const startY = filterY + filterRows * 36 + (compact ? 14 : 16);
    const availableHeight = Math.max(120, this.scale.height - startY - 22);
    const visibleQuests = this.getFilteredQuests();
    const totalHeight = visibleQuests.length * itemGap;
    const maxScroll = Math.max(0, totalHeight - availableHeight);
    const x = (this.scale.width - panelWidth) / 2;
    this.questScroll = Math.min(this.questScroll, maxScroll);
    let y = startY - this.questScroll;

    this.resizeInteractiveBackdrop(this.questBackdrop);
    this.questTitleText.setFontSize(compact ? 30 : 34);
    this.questResourceText.setFontSize(compact ? 14 : 18);
    this.questStatusText.setFontSize(compact ? 13 : 16);
    this.questStatusText.setWordWrapWidth(Math.max(240, this.scale.width - 48));
    this.questTitleText.setPosition(24, 24);
    this.questResourceText.setPosition(26, compact ? 72 : 78);
    this.questStatusText.setPosition(this.scale.width / 2, compact ? 108 : 112);
    this.questBackButton.setScale(compact ? 0.9 : 1);
    this.questBackButton.setPosition(this.scale.width - 142, 24);
    this.questClaimReadyButton.setScale(compact ? 0.86 : 1);
    this.questClaimReadyButton.setPosition(compact ? 24 : this.scale.width - 314, compact ? 132 : 72);
    this.layoutQuestFilterButtons(x, panelWidth, filterY, compact);

    for (const view of this.questItemViews.values()) {
      const quest = QUESTS.find((candidate) => candidate.id === view.questId);
      if (!quest || !visibleQuests.includes(quest)) {
        view.container.setVisible(false);
        continue;
      }

      const claimX = panelWidth - 136;
      const textWidth = Math.max(170, panelWidth - (compact ? 34 : 178));

      view.bg.setSize(panelWidth, itemHeight);
      view.attentionGlow.setPosition(panelWidth / 2, itemHeight / 2);
      view.attentionGlow.setSize(panelWidth + 10, itemHeight + 10);
      view.name.setPosition(14, 10);
      view.name.setFontSize(compact ? 18 : 20);
      view.name.setWordWrapWidth(textWidth);
      view.description.setPosition(14, compact ? 36 : 38);
      view.description.setWordWrapWidth(textWidth);
      view.progress.setPosition(14, compact ? 70 : 74);
      view.progress.setWordWrapWidth(compact ? Math.max(150, panelWidth - 34) : textWidth);
      view.reward.setPosition(compact ? 14 : claimX - 6, compact ? 96 : 18);
      view.reward.setWordWrapWidth(compact ? Math.max(130, panelWidth - 170) : 140);
      view.reward.setAlign(compact ? "left" : "center");
      view.claimButton.setScale(compact ? 0.88 : 1);
      view.claimButton.setPosition(compact ? panelWidth - 122 : claimX, compact ? 88 : 60);
      view.readyBadge.setPosition(panelWidth - 12, 10);
      view.readyBadge.setFontSize(compact ? 12 : 13);
      view.container.setPosition(x, y);
      view.container.setVisible(y > 118 - itemGap && y < this.scale.height + itemGap);
      y += itemGap;
    }
  }

  private layoutQuestFilterButtons(x: number, panelWidth: number, y: number, compact: boolean): void {
    const gap = compact ? 6 : 8;
    const buttonWidth = compact ? Math.floor((panelWidth - gap * 2) / 3) : Math.floor((panelWidth - gap * 5) / 6);
    const buttonHeight = 30;

    QUEST_FILTERS.forEach((filter, index) => {
      const view = this.questFilterViews.get(filter.id);
      if (!view) {
        return;
      }

      const column = compact ? index % 3 : index;
      const row = compact ? Math.floor(index / 3) : 0;
      const selected = filter.id === this.selectedQuestFilter;
      view.container.setPosition(x + column * (buttonWidth + gap), y + row * (buttonHeight + 6));
      view.bg.setSize(buttonWidth, buttonHeight);
      view.bg.setFillStyle(selected ? 0x2f6a34 : 0x173d23, selected ? 1 : 0.94);
      view.bg.setStrokeStyle(2, selected ? 0xf4df6a : 0xb7eba5, selected ? 0.95 : 0.68);
      view.label.setPosition(buttonWidth / 2, buttonHeight / 2);
      view.label.setFontSize(compact ? 12 : 13);
      view.label.setColor(selected ? "#f7ffe8" : "#dfffc8");
    });
  }

  private selectQuestFilter(filterId: QuestFilterId): void {
    if (this.selectedQuestFilter === filterId) {
      return;
    }

    this.selectedQuestFilter = filterId;
    this.questScroll = 0;
    this.refreshQuestLog();
    this.layoutQuestLog();
    this.audio.play("upgrade");
  }

  private getFilteredQuests(): QuestDefinition[] {
    return QUESTS.filter((quest) => this.questMatchesFilter(quest, this.selectedQuestFilter));
  }

  private questMatchesFilter(quest: QuestDefinition, filterId: QuestFilterId): boolean {
    if (quest.classId !== undefined && quest.classId !== this.state.characterClassId) {
      return false;
    }

    const claimed = this.state.claimedQuestIds.includes(quest.id);
    const available = isQuestAvailable(this.state, quest);
    const ready = isQuestClaimable(this.state, quest);

    switch (filterId) {
      case "ready":
        return ready;
      case "active":
        return available && !claimed;
      case "automation":
        return quest.category === "Automation";
      case "class":
        return quest.category === "Class";
      case "journal":
        return quest.category === "Field Journal" || quest.category === "Hazards";
      case "claimed":
        return claimed;
      case "all":
      default:
        return true;
    }
  }

  private getQuestFilterCounts(): Record<QuestFilterId, number> {
    return {
      all: QUESTS.filter((quest) => this.questMatchesFilter(quest, "all")).length,
      ready: QUESTS.filter((quest) => this.questMatchesFilter(quest, "ready")).length,
      active: QUESTS.filter((quest) => this.questMatchesFilter(quest, "active")).length,
      automation: QUESTS.filter((quest) => this.questMatchesFilter(quest, "automation")).length,
      class: QUESTS.filter((quest) => this.questMatchesFilter(quest, "class")).length,
      journal: QUESTS.filter((quest) => this.questMatchesFilter(quest, "journal")).length,
      claimed: QUESTS.filter((quest) => this.questMatchesFilter(quest, "claimed")).length,
    };
  }

  private getQuestFilterStatusText(count: number): string {
    if (count === 0) {
      switch (this.selectedQuestFilter) {
        case "ready":
          return "No quest rewards are ready yet.";
        case "active":
          return "No active quests in this filter yet.";
        case "automation":
          return "No automation quests available in this list.";
        case "class":
          return "No class quests available in this list.";
        case "journal":
          return "No Field Journal or hazard quests available in this list.";
        case "claimed":
          return "No claimed quests yet.";
        case "all":
        default:
          return "No quests found.";
      }
    }

    switch (this.selectedQuestFilter) {
      case "ready":
        return "Quest rewards ready to claim.";
      case "active":
        return "Available quests still in progress.";
      case "automation":
        return "Automation goals and helper milestones.";
      case "class":
        return "Class mastery quests.";
      case "journal":
        return "Field Journal specimen and hazard quests.";
      case "claimed":
        return "Completed and claimed quests.";
      case "all":
      default:
        return "Complete small goals and claim the rewards.";
    }
  }

  private createJournal(): void {
    this.journalRoot?.destroy();

    this.journalRoot = this.add.container(0, 0).setDepth(106).setVisible(false);
    this.journalBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x18321e, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.journalTitleText = this.add.text(0, 0, "Field Journal", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f7ffe8",
      stroke: "#17491f",
      strokeThickness: 6,
    }).setShadow(0, 3, "#06190f", 3, false, true);
    this.journalResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#173b20",
      backgroundColor: "#e9ffd0",
      padding: { x: 12, y: 8 },
    });
    this.journalStatusText = this.add
      .text(0, 0, "A living record of grass, weather, hazards, companions, and suspiciously productive habits.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.journalBodyText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "16px",
      color: "#f7ffe8",
      stroke: "#06190f",
      strokeThickness: 3,
      lineSpacing: 5,
      wordWrap: { width: 620 },
    });
    this.journalBackButton = createTextButton(this, "Back", () => this.closeJournal(), 118, 44, 107);

    this.journalRoot.add([
      this.journalBackdrop,
      this.journalTitleText,
      this.journalResourceText,
      this.journalStatusText,
      this.journalBodyText,
      this.journalBackButton,
    ]);

    this.layoutJournal();
  }

  private layoutJournal(): void {
    if (!this.journalRoot) {
      return;
    }

    const compact = this.scale.width < 620;
    const panelWidth = Math.min(680, this.scale.width - 40);
    const compactResourceLines = compact && this.journalResourceText.text.includes("\n");
    const startY = compactResourceLines ? 184 : compact ? 154 : 162;
    const availableHeight = Math.max(120, this.scale.height - startY - 26);
    const maxScroll = Math.max(0, this.journalBodyText.height - availableHeight);
    this.journalScroll = Math.min(this.journalScroll, maxScroll);

    this.resizeInteractiveBackdrop(this.journalBackdrop);
    this.journalTitleText.setFontSize(compact ? 30 : 34);
    this.journalResourceText.setFontSize(compact ? 14 : 18);
    this.journalStatusText.setFontSize(compact ? 13 : 16);
    this.journalStatusText.setWordWrapWidth(Math.max(240, this.scale.width - 48));
    this.journalBodyText.setFontSize(compact ? 14 : 16);
    this.journalBodyText.setWordWrapWidth(panelWidth);
    this.journalTitleText.setPosition(24, 24);
    this.journalResourceText.setPosition(26, compact ? 72 : 78);
    this.journalStatusText.setPosition(this.scale.width / 2, compactResourceLines ? 134 : compact ? 108 : 112);
    this.journalBodyText.setPosition((this.scale.width - panelWidth) / 2, startY - this.journalScroll);
    this.journalBackButton.setScale(compact ? 0.9 : 1);
    this.journalBackButton.setPosition(this.scale.width - 142, 24);
  }

  private createSeedShop(): void {
    this.seedRoot?.destroy();
    this.seedItemViews.clear();

    this.seedRoot = this.add.container(0, 0).setDepth(105).setVisible(false);
    this.seedBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x20351f, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.seedTitleText = this.add.text(0, 0, "Seed Shop", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f7ffe8",
      stroke: "#17491f",
      strokeThickness: 6,
    }).setShadow(0, 3, "#06190f", 3, false, true);
    this.seedResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#173b20",
      backgroundColor: "#e9ffd0",
      padding: { x: 12, y: 8 },
    });
    this.seedStatusText = this.add
      .text(0, 0, "Seeds unlock new ways to touch grass.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.seedBackButton = createTextButton(this, "Back", () => this.closeSeedShop(), 118, 44, 106);

    this.seedRoot.add([this.seedBackdrop, this.seedTitleText, this.seedResourceText, this.seedStatusText, this.seedBackButton]);

    for (const item of SEED_SHOP_ITEMS) {
      const container = this.add.container(0, 0);
      const attentionGlow = this.createReadyRowGlow(430, 102);
      const bg = this.add
        .rectangle(0, 0, 420, 92, 0xf4ffdc, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x2d6f36)
        .setInteractive({ useHandCursor: true });
      const iconBg = this.add
        .rectangle(14, 14, SHOP_ICON_SIZE + 10, SHOP_ICON_SIZE + 10, 0xdfffc8, 0.74)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0x85d35e, 0.62);
      const icon = this.add.image(43, 43, SEED_SHOP_ICON_KEYS[item.id] ?? "item-seed-pouch").setDisplaySize(SHOP_ICON_SIZE, SHOP_ICON_SIZE);
      const name = this.add.text(78, 10, item.name, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#183d20",
      });
      const description = this.add.text(78, 38, item.description, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#416247",
        wordWrap: { width: 326 },
      });
      const status = this.add.text(78, 68, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "15px",
        color: "#6d4c19",
      });
      const readyBadge = this.createReadyBadge();

      bg.on("pointerdown", () => this.buySeedShopItem(item.id));
      container.add([attentionGlow, bg, iconBg, icon, name, description, status, readyBadge]);
      this.seedItemViews.set(item.id, { itemId: item.id, container, attentionGlow, bg, iconBg, icon, name, description, status, readyBadge });
      this.seedRoot.add(container);
    }

    this.layoutSeedShop();
  }

  private layoutSeedShop(): void {
    const compact = this.scale.width < 560;
    const panelWidth = Math.min(420, this.scale.width - 32);
    const x = (this.scale.width - panelWidth) / 2;
    const itemGap = compact ? 92 : 100;
    const startY = compact ? 146 : 154;
    const availableHeight = Math.max(120, this.scale.height - startY - 22);
    const totalHeight = SEED_SHOP_ITEMS.length * itemGap;
    const maxScroll = Math.max(0, totalHeight - availableHeight);
    this.seedShopScroll = Math.min(this.seedShopScroll, maxScroll);
    let y = startY - this.seedShopScroll;

    this.resizeInteractiveBackdrop(this.seedBackdrop);
    this.seedTitleText.setFontSize(compact ? 30 : 34);
    this.seedResourceText.setFontSize(compact ? 14 : 18);
    this.seedStatusText.setFontSize(compact ? 13 : 16);
    this.seedStatusText.setWordWrapWidth(Math.max(240, this.scale.width - 48));
    this.seedTitleText.setPosition(24, 24);
    this.seedResourceText.setPosition(26, compact ? 72 : 78);
    this.seedStatusText.setPosition(this.scale.width / 2, compact ? 108 : 112);
    this.seedBackButton.setScale(compact ? 0.9 : 1);
    this.seedBackButton.setPosition(this.scale.width - 142, 24);

    for (const view of this.seedItemViews.values()) {
      const itemHeight = compact ? 86 : 92;
      const textX = compact ? 70 : 78;
      const iconSize = compact ? 42 : SHOP_ICON_SIZE;
      const iconFrame = iconSize + 10;

      view.bg.setSize(panelWidth, itemHeight);
      view.attentionGlow.setPosition(panelWidth / 2, itemHeight / 2);
      view.attentionGlow.setSize(panelWidth + 10, itemHeight + 10);
      view.iconBg.setPosition(12, compact ? 14 : 14);
      view.iconBg.setSize(iconFrame, iconFrame);
      view.icon.setPosition(12 + iconFrame / 2, (compact ? 14 : 14) + iconFrame / 2);
      view.icon.setDisplaySize(iconSize, iconSize);
      view.name.setPosition(textX, compact ? 8 : 10);
      view.name.setFontSize(compact ? 18 : 20);
      view.name.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.description.setPosition(textX, compact ? 34 : 38);
      view.description.setFontSize(compact ? 13 : 14);
      view.description.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.status.setPosition(textX, itemHeight - 24);
      view.status.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.readyBadge.setPosition(panelWidth - 12, compact ? 8 : 10);
      view.readyBadge.setFontSize(compact ? 12 : 13);
      view.container.setPosition(x, y);
      view.container.setVisible(y >= startY - 4 && y < this.scale.height + itemGap);
      y += itemGap;
    }
  }

  private createGoldStore(): void {
    this.storeRoot?.destroy();
    this.storeAutomationViews.clear();
    this.storeGoldItemViews.clear();

    this.storeRoot = this.add.container(0, 0).setDepth(108).setVisible(false);
    this.storeBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x102315, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.storeTitleText = this.add.text(0, 0, "Store", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f7ffe8",
      stroke: "#17491f",
      strokeThickness: 6,
    }).setShadow(0, 3, "#06190f", 3, false, true);
    this.storeResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#f7ffe8",
      backgroundColor: "#0f3d22",
      padding: { x: 12, y: 8 },
    });
    this.storeStatusText = this.add
      .text(0, 0, this.getDefaultStoreStatus(), {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#dfffc8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.storeAutomationButton = createTextButton(this, "Automation", () => this.setStoreMode("automation"), 134, 36, 109);
    this.storeGoodsButton = createTextButton(this, "Goods", () => this.setStoreMode("goods"), 104, 36, 109);
    this.storeAutomationBuyModeButton = createTextButton(this, "Buy 1", () => this.toggleAutomationBuyMode(), 126, 36, 109);
    this.storeBackButton = createTextButton(this, "Back", () => this.closeGoldStore(), 118, 44, 109);

    this.storeRoot.add([
      this.storeBackdrop,
      this.storeTitleText,
      this.storeResourceText,
      this.storeStatusText,
      this.storeAutomationButton,
      this.storeGoodsButton,
      this.storeAutomationBuyModeButton,
      this.storeBackButton,
    ]);

    for (const system of AUTOMATION_SYSTEMS) {
      const container = this.add.container(0, 0);
      const attentionGlow = this.createReadyRowGlow(440, 108);
      const bg = this.add
        .rectangle(0, 0, 430, 98, 0x12341c, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0xb7eba5)
        .setInteractive({ useHandCursor: true });
      const iconBg = this.add
        .rectangle(14, 15, SHOP_ICON_SIZE + 10, SHOP_ICON_SIZE + 10, 0x0d2f1c, 0.82)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xb7eba5, 0.58);
      const icon = this.add.image(43, 44, GOLD_STORE_ICON_KEYS[system.id] ?? "world-tiny-sprinkler").setDisplaySize(SHOP_ICON_SIZE, SHOP_ICON_SIZE);
      const name = this.add.text(78, 10, system.name, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#f7ffe8",
      });
      const description = this.add.text(78, 38, system.description, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#d6e6d0",
        wordWrap: { width: 334 },
      });
      const status = this.add.text(78, 74, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "15px",
        color: "#b7eba5",
      });
      const readyBadge = this.createReadyBadge();

      bg.on("pointerover", () => this.showAutomationSystemDetails(system.id));
      bg.on("pointerdown", () => this.buyAutomationSystem(system.id));
      container.add([attentionGlow, bg, iconBg, icon, name, description, status, readyBadge]);
      this.storeAutomationViews.set(system.id, { itemId: system.id, container, attentionGlow, bg, iconBg, icon, name, description, status, readyBadge });
      this.storeRoot.add(container);
    }

    for (const item of GOLD_STORE_ITEMS) {
      const container = this.add.container(0, 0);
      const attentionGlow = this.createReadyRowGlow(440, 108);
      const bg = this.add
        .rectangle(0, 0, 430, 98, 0x12341c, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0xb7eba5)
        .setInteractive({ useHandCursor: true });
      const iconBg = this.add
        .rectangle(14, 15, SHOP_ICON_SIZE + 10, SHOP_ICON_SIZE + 10, 0x0d2f1c, 0.82)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xb7eba5, 0.58);
      const icon = this.add.image(43, 44, GOLD_STORE_ICON_KEYS[item.id] ?? "item-seed-satchel").setDisplaySize(SHOP_ICON_SIZE, SHOP_ICON_SIZE);
      const name = this.add.text(78, 10, item.name, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#f7ffe8",
      });
      const description = this.add.text(78, 38, item.description, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#d6e6d0",
        wordWrap: { width: 334 },
      });
      const status = this.add.text(78, 74, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "15px",
        color: "#b7eba5",
      });
      const readyBadge = this.createReadyBadge();

      bg.on("pointerover", () => this.showGoldStoreItemDetails(item.id));
      bg.on("pointerdown", () => this.handleGoldStoreItemPressed(item.id));
      container.add([attentionGlow, bg, iconBg, icon, name, description, status, readyBadge]);
      this.storeGoldItemViews.set(item.id, { itemId: item.id, container, attentionGlow, bg, iconBg, icon, name, description, status, readyBadge });
      this.storeRoot.add(container);
    }

    this.layoutGoldStore();
  }

  private layoutGoldStore(): void {
    const compact = this.scale.width < 560;
    const panelWidth = Math.min(430, this.scale.width - 32);
    const x = (this.scale.width - panelWidth) / 2;
    const itemHeight = compact ? 126 : 116;
    const itemGap = itemHeight + 10;
    const startY = compact ? 208 : 196;
    const availableHeight = Math.max(120, this.scale.height - startY - 22);
    const activeViews = this.getActiveStoreItemViews();
    const inactiveViews = this.storeMode === "automation" ? this.storeGoldItemViews : this.storeAutomationViews;
    const totalHeight = activeViews.size * itemGap;
    const maxScroll = Math.max(0, totalHeight - availableHeight);
    this.storeScroll = Math.min(this.storeScroll, maxScroll);
    let y = startY - this.storeScroll;

    this.resizeInteractiveBackdrop(this.storeBackdrop);
    this.storeTitleText.setFontSize(compact ? 26 : 34);
    this.storeResourceText.setFontSize(compact ? 14 : 18);
    this.storeResourceText.setWordWrapWidth(Math.max(260, this.scale.width - 52));
    this.storeStatusText.setFontSize(compact ? 13 : 16);
    this.storeStatusText.setWordWrapWidth(Math.max(240, this.scale.width - 48));
    this.storeTitleText.setPosition(24, 24);
    this.storeResourceText.setPosition(26, compact ? 72 : 78);
    this.storeStatusText.setPosition(this.scale.width / 2, compact ? 154 : 150);
    this.storeAutomationButton.setScale(compact ? 0.82 : 0.92);
    this.storeGoodsButton.setScale(compact ? 0.82 : 0.92);
    this.storeAutomationBuyModeButton.setScale(compact ? 0.82 : 0.92);
    this.storeAutomationButton.setPosition(x, compact ? 114 : 116);
    this.storeGoodsButton.setPosition(x + (compact ? 122 : 134), compact ? 114 : 116);
    this.storeAutomationBuyModeButton.setPosition(x + (compact ? 224 : 250), compact ? 114 : 116);
    this.storeAutomationBuyModeButton.setVisible(this.storeMode === "automation");
    this.storeBackButton.setScale(compact ? 0.9 : 1);
    this.storeBackButton.setPosition(this.scale.width - 142, 24);

    for (const view of inactiveViews.values()) {
      view.container.setVisible(false);
    }

    for (const view of activeViews.values()) {
      const textX = compact ? 70 : 78;
      const iconSize = compact ? 42 : SHOP_ICON_SIZE;
      const iconFrame = iconSize + 10;

      view.bg.setSize(panelWidth, itemHeight);
      view.attentionGlow.setPosition(panelWidth / 2, itemHeight / 2);
      view.attentionGlow.setSize(panelWidth + 10, itemHeight + 10);
      view.iconBg.setPosition(12, compact ? 16 : 15);
      view.iconBg.setSize(iconFrame, iconFrame);
      view.icon.setPosition(12 + iconFrame / 2, (compact ? 16 : 15) + iconFrame / 2);
      view.icon.setDisplaySize(iconSize, iconSize);
      view.name.setPosition(textX, compact ? 8 : 10);
      view.name.setFontSize(compact ? 18 : 20);
      view.name.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.description.setPosition(textX, compact ? 34 : 38);
      view.description.setFontSize(compact ? 13 : 14);
      view.description.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.status.setPosition(textX, itemHeight - 36);
      view.status.setFontSize(compact ? 12 : 13);
      view.status.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.readyBadge.setPosition(panelWidth - 12, compact ? 8 : 10);
      view.readyBadge.setFontSize(compact ? 12 : 13);
      view.container.setPosition(x, y);
      view.container.setVisible(y >= startY - 4 && y < this.scale.height + itemGap);
      y += itemGap;
    }
  }

  private createOptionsPanel(): void {
    this.optionsRoot = this.add.container(0, 0).setDepth(110).setVisible(false);
    this.optionsBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x102315, 0.62)
      .setOrigin(0, 0)
      .setInteractive();
    this.optionsPanel = this.add
      .rectangle(0, 0, 460, 280, 0xf4ffdc, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(5, 0x2d6f36);
    this.optionsTitleText = this.add
      .text(0, 0, "Options", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "34px",
        color: "#183d20",
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#ffffff", 2, false, true);
    this.optionsVolumeLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#416247",
      })
      .setOrigin(0.5);
    this.optionsVolumeTrack = this.add.rectangle(0, 0, 320, 12, 0x9bbf7e, 1).setOrigin(0, 0.5);
    this.optionsVolumeFill = this.add.rectangle(0, 0, 220, 12, 0x2d6f36, 1).setOrigin(0, 0.5);
    this.optionsVolumeHit = this.add
      .rectangle(0, 0, 350, 44, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.optionsVolumeKnob = this.add.circle(0, 0, 14, 0xf7ffe8, 1).setStrokeStyle(4, 0x17491f).setInteractive({ useHandCursor: true });
    
    // Track selector
    this.optionsTrackLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);
    this.optionsTrackLeftBtn = createTextButton(this, "<", () => this.cycleTrack(-1), 44, 38, 111);
    this.optionsTrackRightBtn = createTextButton(this, ">", () => this.cycleTrack(1), 44, 38, 111);

    this.optionsBackButton = createTextButton(this, "Back", () => this.closeOptions(), 118, 44, 111);

    this.optionsVolumeHit.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.startMusicVolumeDrag(pointer));
    this.optionsVolumeKnob.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.startMusicVolumeDrag(pointer));
    this.optionsRoot.add([
      this.optionsBackdrop,
      this.optionsPanel,
      this.optionsTitleText,
      this.optionsVolumeLabel,
      this.optionsVolumeTrack,
      this.optionsVolumeFill,
      this.optionsVolumeHit,
      this.optionsVolumeKnob,
      this.optionsTrackLabel,
      this.optionsTrackLeftBtn,
      this.optionsTrackRightBtn,
      this.optionsBackButton,
    ]);
    this.refreshOptionsPanel();
  }

  private layoutOptionsPanel(): void {
    const panelWidth = Math.min(500, this.scale.width - 36);
    const panelHeight = Math.min(280, this.scale.height - 48);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const trackWidth = Math.max(190, panelWidth - 120);
    const trackX = centerX - trackWidth / 2;
    const trackY = centerY - 12;
    const trackLabelY = centerY + 32;

    this.resizeInteractiveBackdrop(this.optionsBackdrop);
    this.optionsPanel?.setPosition(centerX, centerY);
    this.optionsPanel?.setSize(panelWidth, panelHeight);
    this.optionsTitleText?.setPosition(centerX, centerY - panelHeight / 2 + 38);
    this.optionsVolumeLabel?.setPosition(centerX, centerY - 45);
    this.optionsVolumeTrack?.setPosition(trackX, trackY);
    this.optionsVolumeTrack?.setSize(trackWidth, 12);
    this.optionsVolumeFill?.setPosition(trackX, trackY);
    this.optionsVolumeFill?.setSize(trackWidth * this.musicVolume, 12);
    this.optionsVolumeHit?.setPosition(centerX, trackY);
    this.optionsVolumeHit?.setSize(trackWidth + 36, 44);
    this.optionsVolumeKnob?.setPosition(trackX + trackWidth * this.musicVolume, trackY);
    
    // Position track selector
    this.optionsTrackLabel?.setPosition(centerX, trackLabelY);
    this.optionsTrackLeftBtn?.setPosition(centerX - 155, trackLabelY - 19);
    this.optionsTrackRightBtn?.setPosition(centerX + 111, trackLabelY - 19);

    this.optionsBackButton?.setPosition(centerX - 59, centerY + panelHeight / 2 - 58);
    this.musicVolumeSliderX = trackX;
    this.musicVolumeSliderWidth = trackWidth;
  }

  private resizeInteractiveBackdrop(backdrop: Phaser.GameObjects.Rectangle | undefined): void {
    if (!backdrop) {
      return;
    }

    backdrop.setPosition(0, 0);
    backdrop.setScale(this.scale.width / Math.max(1, backdrop.width), this.scale.height / Math.max(1, backdrop.height));
    if (backdrop.input) {
      backdrop.input.hitArea = new Phaser.Geom.Rectangle(0, 0, this.scale.width, this.scale.height);
      backdrop.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
    }
  }

  private createReadyRowGlow(width: number, height: number, fillAlpha = 0.14, strokeAlpha = 0.82): Phaser.GameObjects.Rectangle {
    return this.add
      .rectangle(width / 2, height / 2, width, height, 0xffef78, fillAlpha)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0xffef78, strokeAlpha)
      .setVisible(false);
  }

  private createReadyBadge(): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, "Ready", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#173b20",
        backgroundColor: "#ffef78",
        padding: { x: 7, y: 3 },
      })
      .setOrigin(1, 0)
      .setVisible(false);
  }

  private refreshOptionsPanel(): void {
    this.optionsVolumeLabel?.setText(`Music volume: ${Math.round(this.musicVolume * 100)}%`);
    this.optionsTrackLabel?.setText(`Track: ${this.music.getCurrentTrackName()}`);
    this.layoutOptionsPanel();
  }

  private cycleTrack(direction: number): void {
    const currentIndex = Math.max(0, TRACK_IDS.indexOf(this.music.getCurrentTrackId()));
    let nextIndex = (currentIndex + direction) % TRACK_IDS.length;
    if (nextIndex < 0) {
      nextIndex += TRACK_IDS.length;
    }
    const nextTrackId = TRACK_IDS[nextIndex];
    this.music.setTrack(nextTrackId);
    this.state.selectedTrackId = nextTrackId;
    this.saveState();
    this.refreshOptionsPanel();
  }

  private hasTouchScreen(): boolean {
    return navigator.maxTouchPoints > 0;
  }

  private createAutomationPanel(): void {
    this.automationRoot = this.add.container(0, 0).setDepth(108).setVisible(false);
    this.automationBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x102315, 0.62)
      .setOrigin(0, 0)
      .setInteractive();
    this.automationPanel = this.add
      .rectangle(0, 0, 560, 540, 0xf4ffdc, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(5, 0x2d6f36);
    this.automationTitleText = this.add
      .text(0, 0, "Automation", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "34px",
        color: "#183d20",
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#ffffff", 2, false, true);
    this.automationStatusText = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#416247",
        align: "center",
      })
      .setOrigin(0.5);
    this.automationBackButton = createTextButton(this, "Back", () => this.closeAutomationPanel(), 118, 44, 109);

    this.automationRoot.add([
      this.automationBackdrop,
      this.automationPanel,
      this.automationTitleText,
      this.automationStatusText,
      this.automationBackButton,
    ]);

    for (const directive of AUTOMATION_DIRECTIVES) {
      const container = this.add.container(0, 0).setSize(460, 68).setInteractive({ useHandCursor: true });
      const bg = this.add.rectangle(0, 0, 460, 68, 0xe9ffd0, 0.96).setOrigin(0, 0).setStrokeStyle(2, 0x8fcf78, 0.8);
      const name = this.add
        .text(16, 10, directive.name, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "20px",
          color: "#183d20",
        })
        .setOrigin(0, 0);
      const description = this.add
        .text(16, 36, directive.description, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "13px",
          color: "#416247",
          wordWrap: { width: 420 },
        })
        .setOrigin(0, 0);

      container.add([bg, name, description]);
      container.on("pointerdown", () => this.setAutomationDirective(directive.id));
      this.automationDirectiveViews.set(directive.id, { directiveId: directive.id, container, bg, name, description });
      this.automationRoot.add(container);
    }

    this.layoutAutomationPanel();
  }

  private layoutAutomationPanel(): void {
    if (!this.automationRoot) {
      return;
    }

    const panelWidth = Math.min(580, this.scale.width - 36);
    const panelHeight = Math.min(540, this.scale.height - 48);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const rowWidth = Math.max(260, panelWidth - 72);
    const compact = this.scale.width < 560 || this.scale.height < 640;
    const rowHeight = compact ? 64 : 68;
    const startY = centerY - panelHeight / 2 + 112;

    this.resizeInteractiveBackdrop(this.automationBackdrop);
    this.automationPanel.setPosition(centerX, centerY);
    this.automationPanel.setSize(panelWidth, panelHeight);
    this.automationTitleText.setPosition(centerX, centerY - panelHeight / 2 + 38);
    this.automationStatusText.setPosition(centerX, centerY - panelHeight / 2 + 76);
    this.automationStatusText.setWordWrapWidth(Math.max(260, panelWidth - 52));
    this.automationBackButton.setPosition(centerX - 59, centerY + panelHeight / 2 - 58);

    for (const [index, directive] of AUTOMATION_DIRECTIVES.entries()) {
      const view = this.automationDirectiveViews.get(directive.id);
      if (!view) {
        continue;
      }

      const rowX = centerX - rowWidth / 2;
      const rowY = startY + index * (rowHeight + 10);
      view.container.setPosition(rowX, rowY).setSize(rowWidth, rowHeight);
      view.bg.setSize(rowWidth, rowHeight);
      view.name.setPosition(16, 9);
      view.description.setPosition(16, compact ? 31 : 36);
      view.description.setWordWrapWidth(Math.max(210, rowWidth - 32));
      view.description.setFontSize(compact ? 12 : 13);
    }
  }

  private refreshAutomationPanel(): void {
    if (!this.automationRoot) {
      return;
    }

    const currentDirective = getAutomationDirective(this.state);
    const resolvedDirective = getResolvedAutomationDirectiveId(this.state);
    const resolvedDirectiveName = AUTOMATION_DIRECTIVES.find((directive) => directive.id === resolvedDirective)?.name ?? "Balanced";
    const stats = this.getCachedRuntimeStats();
    const directiveTuning = getAutomationDirectiveTuning(this.state);
    const activeSynergyCount = getActiveAutomationPairSynergies(this.state, stats).length;
    const helperTempoText =
      directiveTuning.helperIntervalMultiplier < 1
        ? `${Math.round((1 / directiveTuning.helperIntervalMultiplier - 1) * 100)}% faster helpers`
        : directiveTuning.helperIntervalMultiplier > 1
          ? `${Math.round((directiveTuning.helperIntervalMultiplier - 1) * 100)}% slower helpers`
          : "normal helper tempo";
    this.automationStatusText.setText(
      [
        `${getAutomationUnitCount(this.state)} active units`,
        formatGrassTouchesPerMinute(getTotalAutomationTouchesPerMinute(this.state, stats)),
        activeSynergyCount > 0 ? `${activeSynergyCount} ecosystem synergies` : "",
        `Directive: ${currentDirective.name}${currentDirective.id === "autopilot" ? ` -> ${resolvedDirectiveName}` : ""}, x${directiveTuning.touchOutputMultiplier.toFixed(
          2,
        )} output, ${helperTempoText}`,
        `${formatGrassTouches(this.state.automationStats.automatedGrassTouches)} auto touches`,
        `${this.state.automationStats.automationSupplyDrops} supplies`,
        `Best auto streak ${this.state.automationStats.bestAutomationComboCount}`,
        this.state.seedShopPurchases.quest_clipboard ? "Clipboard: claiming quests" : "",
      ]
        .filter(Boolean)
        .join(" | "),
    );

    for (const view of this.automationDirectiveViews.values()) {
      const selected = view.directiveId === currentDirective.id;
      view.bg.setFillStyle(selected ? 0xdfffc8 : 0xe9ffd0, selected ? 1 : 0.96);
      view.bg.setStrokeStyle(selected ? 4 : 2, selected ? 0xf4df6a : 0x8fcf78, selected ? 0.96 : 0.8);
      view.name.setColor(selected ? "#0d3018" : "#183d20");
    }

    this.layoutAutomationPanel();
  }

  private getUpgradeLevel(upgradeId: string): number {
    return this.state.upgrades[upgradeId]?.level ?? 0;
  }

  private isSkillVisible(upgradeId: string): boolean {
    const upgrade = UPGRADES.find((candidate) => candidate.id === upgradeId);
    if (!upgrade) {
      return false;
    }

    const level = this.getUpgradeLevel(upgrade.id);
    if (level > 0 || (upgrade.prerequisiteIds ?? []).length === 0) {
      return true;
    }

    return (upgrade.prerequisiteIds ?? []).some((prerequisiteId) => this.getUpgradeLevel(prerequisiteId) > 0);
  }

  private getVisibleSkillIds(): Set<string> {
    return new Set(UPGRADES.filter((upgrade) => this.isSkillVisible(upgrade.id)).map((upgrade) => upgrade.id));
  }

  private willRevealHiddenSkillBranch(upgradeId: string): boolean {
    if (!this.isSkillVisible(upgradeId) || this.getUpgradeLevel(upgradeId) > 0) {
      return false;
    }

    return UPGRADES.some((upgrade) => (upgrade.prerequisiteIds ?? []).includes(upgradeId) && !this.isSkillVisible(upgrade.id));
  }

  private playSkillRevealFeedback(previousVisibleSkillIds: Set<string>, sourceUpgradeId: string): void {
    let revealedCount = 0;

    for (const upgrade of UPGRADES) {
      if (previousVisibleSkillIds.has(upgrade.id) || !this.isSkillVisible(upgrade.id)) {
        continue;
      }

      const view = this.skillNodeViews.get(upgrade.id);
      if (!view) {
        continue;
      }

      revealedCount += 1;
      this.playSkillBranchRevealTrail(sourceUpgradeId, upgrade.id, upgrade.tree.color);
      const targetAlpha = view.container.alpha;
      const targetScaleX = view.container.scaleX;
      const targetScaleY = view.container.scaleY;
      this.tweens.killTweensOf(view.container);
      view.container.setVisible(true);
      view.container.setAlpha(0);
      view.container.setScale(targetScaleX * 0.62, targetScaleY * 0.62);
      view.container.setRotation(-0.08);

      this.tweens.add({
        targets: view.container,
        alpha: targetAlpha,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        angle: 0,
        duration: 360,
        ease: "Back.easeOut",
      });
      this.tweens.add({
        targets: view.glow,
        alpha: 0.46,
        duration: 180,
        yoyo: true,
        ease: "Sine.easeOut",
      });
    }

    if (revealedCount > 0) {
      this.audio.play("unlock");
      this.flashScreen(0xf4df6a, 0.1, 240);
      this.showMessage(revealedCount === 1 ? "A new skill sprouted." : `${revealedCount} new skills sprouted.`, 2200);
    }
  }

  private playSkillBranchRevealTrail(sourceUpgradeId: string, revealedUpgradeId: string, color: number): void {
    const sourceView = this.skillNodeViews.get(sourceUpgradeId);
    const revealedView = this.skillNodeViews.get(revealedUpgradeId);
    if (!sourceView || !revealedView) {
      return;
    }

    const start = { x: sourceView.container.x, y: sourceView.container.y };
    const end = { x: revealedView.container.x, y: revealedView.container.y };
    const trail = this.add.graphics();
    const spark = this.add.circle(start.x, start.y, 6, 0xf7ffe8, 1).setStrokeStyle(2, color, 0.92);
    this.skillRoot.add([trail, spark]);

    const progress = { value: 0 };
    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 430,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        const currentX = Phaser.Math.Linear(start.x, end.x, progress.value);
        const currentY = Phaser.Math.Linear(start.y, end.y, progress.value);
        trail.clear();
        trail.lineStyle(15, color, 0.2);
        trail.beginPath();
        trail.moveTo(start.x, start.y);
        trail.lineTo(currentX, currentY);
        trail.strokePath();
        trail.lineStyle(4, 0xf7ffe8, 0.9);
        trail.beginPath();
        trail.moveTo(start.x, start.y);
        trail.lineTo(currentX, currentY);
        trail.strokePath();
        spark.setPosition(currentX, currentY);
        spark.setAlpha(1 - progress.value * 0.18);
      },
      onComplete: () => {
        this.tweens.add({
          targets: spark,
          scaleX: 2.6,
          scaleY: 2.6,
          alpha: 0,
          duration: 220,
          ease: "Sine.easeOut",
          onComplete: () => spark.destroy(),
        });
        this.tweens.add({
          targets: trail,
          alpha: 0,
          duration: 260,
          ease: "Sine.easeOut",
          onComplete: () => trail.destroy(),
        });
      },
    });
  }

  private hasBlockingOverlayOpen(): boolean {
    return (
      this.skillTreeOpen ||
      this.questLogOpen ||
      this.journalOpen ||
      this.seedShopOpen ||
      this.storeOpen ||
      this.automationOpen ||
      this.optionsOpen
    );
  }

  private applyPixelTextureFilters(): void {
    const pixelTextureKeys = [
      "tile-dirt",
      "tile-stubble",
      "grass-fleck",
      "dew-fleck",
      "world-tiny-sprinkler",
      "world-bee-hive",
      "world-chicken",
      "world-field-mouse",
      "world-meadow-rabbit",
      "world-sheep",
      "world-earthworm",
      "panel-emerald",
      "button-emerald-normal",
      "button-emerald-hover",
      "button-emerald-active",
      SKILL_NODE_FRAME_KEYS.locked,
      SKILL_NODE_FRAME_KEYS.available,
      SKILL_NODE_FRAME_KEYS.owned,
      SKILL_NODE_FRAME_KEYS.selected,
      "selector-gold",
      "effect-water-drop",
      "effect-pollen-fleck",
      "effect-bee-pixel",
      "effect-gold-coin",
      "effect-seed-kernel",
      "effect-magic-spore",
      ...GRASS_TIERS.flatMap((tier) => [`grass-${tier.id}`, `grass-${tier.id}-dewy`, `grass-${tier.id}-lush`]),
      ...Object.values(SEED_SHOP_ICON_KEYS),
      ...Object.values(GOLD_STORE_ICON_KEYS),
      ...UPGRADES.map((upgrade) => getSkillIconKey(upgrade.id)),
    ];

    for (const key of new Set(pixelTextureKeys)) {
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  private getSkillTreeCoordinates(x: number, y: number, treeScale: number, treeX: number, treeY: number): [number, number] {
    return [Math.round(treeX + x * SKILL_MAP_X_SCALE * treeScale), Math.round(treeY + y * SKILL_MAP_Y_SCALE * treeScale)];
  }

  private getSkillTreePoint(
    upgrade: (typeof UPGRADES)[number],
    treeScale: number,
    treeX: number,
    treeY: number,
  ): { x: number; y: number } {
    const [x, y] = this.getSkillTreeCoordinates(upgrade.tree.x, upgrade.tree.y, treeScale, treeX, treeY);
    return { x, y };
  }

  private layoutSkillMapBackdrop(
    treeX: number,
    treeY: number,
    treeWidth: number,
    treeHeight: number,
    treeScale: number,
    compact: boolean,
  ): void {
    const marginX = Math.max(28, 44 * treeScale);
    const marginTop = Math.max(24, 34 * treeScale);
    const marginBottom = Math.max(28, 44 * treeScale);
    const x = Math.round(treeX - marginX);
    const y = Math.round(treeY - marginTop);
    const width = Math.round(treeWidth + marginX * 2);
    const height = Math.round(treeHeight + marginTop + marginBottom);
    const radius = compact ? 14 : 18;

    this.skillMapBackdropGraphics.clear();
    this.skillMapBackdropGraphics.fillStyle(0x071b11, 0.72);
    this.skillMapBackdropGraphics.fillRoundedRect(x + 8, y + 10, width, height, radius);
    this.skillMapBackdropGraphics.fillStyle(0x12341c, 0.92);
    this.skillMapBackdropGraphics.fillRoundedRect(x, y, width, height, radius);
    this.skillMapBackdropGraphics.lineStyle(Math.max(2, 3 * treeScale), 0xb7eba5, 0.46);
    this.skillMapBackdropGraphics.strokeRoundedRect(x, y, width, height, radius);
    this.skillMapBackdropGraphics.lineStyle(Math.max(1, 2 * treeScale), 0xffef78, 0.22);
    this.skillMapBackdropGraphics.strokeRoundedRect(x + 8, y + 8, width - 16, height - 16, Math.max(8, radius - 5));
    this.skillMapBackdropGraphics.fillStyle(0xb7eba5, 0.08);
    this.skillMapBackdropGraphics.fillEllipse(x + width * 0.52, y + height * 0.5, width * 0.88, height * 0.68);
  }

  private drawSkillLines(treeScale: number, treeX: number, treeY: number): void {
    this.skillLineGraphics.clear();
    this.skillLineGraphics.fillStyle(0x000000, 0.18);
    this.skillLineGraphics.fillCircle(...this.getSkillTreeCoordinates(215, 160, treeScale, treeX, treeY), 95 * treeScale);
    this.skillLineGraphics.fillCircle(...this.getSkillTreeCoordinates(365, 290, treeScale, treeX, treeY), 132 * treeScale);
    this.skillLineGraphics.fillCircle(...this.getSkillTreeCoordinates(585, 244, treeScale, treeX, treeY), 74 * treeScale);

    const starPoints = [
      [84, 60],
      [205, 42],
      [335, 96],
      [520, 54],
      [610, 128],
      [112, 376],
      [292, 420],
      [482, 374],
      [625, 456],
    ];

    this.skillLineGraphics.fillStyle(0xffef78, 0.58);
    for (const [x, y] of starPoints) {
      this.skillLineGraphics.fillCircle(...this.getSkillTreeCoordinates(x, y, treeScale, treeX, treeY), Math.max(1.2, 2 * treeScale));
    }

    this.drawDormantSkillHints(treeScale, treeX, treeY);

    let routeIndex = 0;
    for (const upgrade of UPGRADES) {
      if (!this.isSkillVisible(upgrade.id)) {
        continue;
      }

      const prerequisiteIds = upgrade.prerequisiteIds ?? [];

      for (const prerequisiteId of prerequisiteIds) {
        const prerequisite = UPGRADES.find((candidate) => candidate.id === prerequisiteId);
        if (!prerequisite) {
          continue;
        }
        if (!this.isSkillVisible(prerequisite.id)) {
          continue;
        }

        const primaryBranch = prerequisiteId === prerequisiteIds[0];
        if (!primaryBranch) {
          continue;
        }

        const prerequisiteLevel = this.state.upgrades[prerequisite.id]?.level ?? 0;
        const upgradeLevel = this.state.upgrades[upgrade.id]?.level ?? 0;
        const active = prerequisiteLevel > 0 && upgradeLevel > 0;
        const available = prerequisiteLevel > 0 && canUnlockUpgrade(this.state, upgrade);
        const selectedConnection = upgrade.id === this.selectedSkillId;

        const highlighted = available || selectedConnection;
        const color = selectedConnection ? 0xf4df6a : available ? 0xdfff74 : active ? 0x78b278 : 0x6f9473;
        const alpha = highlighted ? 0.92 : active ? 0.26 : 0.12;
        const width = highlighted ? Math.max(2.2, 2.9 * treeScale) : active ? Math.max(1.1, 1.5 * treeScale) : Math.max(1, 1.2 * treeScale);
        const start = this.getSkillTreePoint(prerequisite, treeScale, treeX, treeY);
        const end = this.getSkillTreePoint(upgrade, treeScale, treeX, treeY);

        this.drawSkillConnector(start, end, treeScale, color, alpha, width, routeIndex, highlighted);
        routeIndex += 1;
      }
    }
  }

  private getSkillConnectorPoints(start: SkillRoutePoint, end: SkillRoutePoint, treeScale: number, routeIndex: number): SkillRoutePoint[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const straightThreshold = Math.max(22, 42 * treeScale);

    if (absDx < straightThreshold || absDy < straightThreshold) {
      return [start, end];
    }

    const laneOffset = ((routeIndex % 5) - 2) * Math.max(3, 5 * treeScale);
    if (absDx >= absDy) {
      const midX = start.x + dx * 0.55 + laneOffset;
      return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
    }

    const midY = start.y + dy * 0.55 + laneOffset;
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
  }

  private trimSkillConnectorPoints(points: SkillRoutePoint[], treeScale: number): SkillRoutePoint[] {
    if (points.length < 2) {
      return points;
    }

    const trimmed = points.map((point) => ({ ...point }));
    const trimDistance = Math.max(16, 28 * treeScale);
    const trimStart = (fromIndex: number, towardIndex: number): void => {
      const from = trimmed[fromIndex];
      const toward = trimmed[towardIndex];
      const dx = toward.x - from.x;
      const dy = toward.y - from.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const trim = Math.min(trimDistance, distance * 0.42);
      from.x += (dx / distance) * trim;
      from.y += (dy / distance) * trim;
    };

    trimStart(0, 1);
    trimStart(trimmed.length - 1, trimmed.length - 2);
    return trimmed;
  }

  private strokeSkillConnector(points: SkillRoutePoint[], width: number, color: number, alpha: number): void {
    if (points.length < 2 || alpha <= 0) {
      return;
    }

    this.skillLineGraphics.lineStyle(width, color, alpha);
    this.skillLineGraphics.beginPath();
    this.skillLineGraphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      this.skillLineGraphics.lineTo(points[index].x, points[index].y);
    }
    this.skillLineGraphics.strokePath();
  }

  private drawSkillConnector(
    start: SkillRoutePoint,
    end: SkillRoutePoint,
    treeScale: number,
    color: number,
    alpha: number,
    width: number,
    routeIndex: number,
    highlighted: boolean,
  ): void {
    const points = this.trimSkillConnectorPoints(this.getSkillConnectorPoints(start, end, treeScale, routeIndex), treeScale);
    if (highlighted) {
      this.strokeSkillConnector(points, width + Math.max(4, 5.5 * treeScale), color, alpha * 0.16);
    }
    this.strokeSkillConnector(points, width + Math.max(1.3, 2 * treeScale), 0x06190f, highlighted ? 0.48 : 0.24);
    this.strokeSkillConnector(points, width, color, alpha);
  }

  private drawDormantSkillHints(treeScale: number, treeX: number, treeY: number): void {
    let routeIndex = 0;
    for (const upgrade of UPGRADES) {
      if (this.isSkillVisible(upgrade.id)) {
        continue;
      }

      const primaryPrerequisiteId = (upgrade.prerequisiteIds ?? [])[0];
      const primaryPrerequisite = UPGRADES.find((candidate) => candidate.id === primaryPrerequisiteId);

      if (!primaryPrerequisite || !this.isSkillVisible(primaryPrerequisite.id)) {
        continue;
      }

      const prerequisiteLevel = this.state.upgrades[primaryPrerequisite.id]?.level ?? 0;
      const selectedConnection = this.selectedSkillId === primaryPrerequisite.id;
      const end = this.getSkillTreePoint(upgrade, treeScale, treeX, treeY);
      const start = this.getSkillTreePoint(primaryPrerequisite, treeScale, treeX, treeY);
      if (prerequisiteLevel > 0 || selectedConnection) {
        this.drawSkillConnector(
          start,
          end,
          treeScale,
          0xdfff74,
          selectedConnection ? 0.3 : 0.18,
          Math.max(1.1, 1.6 * treeScale),
          routeIndex,
          selectedConnection,
        );
      }

      this.skillLineGraphics.fillStyle(0x183d20, 0.74);
      this.skillLineGraphics.fillCircle(end.x, end.y, Math.max(9, 15 * treeScale));
      this.skillLineGraphics.lineStyle(Math.max(1.4, 2.6 * treeScale), 0xdfff74, 0.48);
      this.skillLineGraphics.strokeCircle(end.x, end.y, Math.max(9, 15 * treeScale));
      this.skillLineGraphics.fillStyle(0xf4df6a, 0.42);
      this.skillLineGraphics.fillCircle(end.x, end.y, Math.max(2.4, 4 * treeScale));
      routeIndex += 1;
    }
  }

  private previewSkill(upgradeId: string): void {
    if (!this.isSkillVisible(upgradeId)) {
      return;
    }

    if (this.selectedSkillId === upgradeId) {
      return;
    }

    this.selectedSkillId = upgradeId;
    if (this.skillTreeOpen) {
      this.profileScope("ui:skillTree", () => this.refreshSkillTree());
    } else {
      this.refreshUi();
    }
  }

  private startSkillHoverTremble(upgradeId: string): void {
    const view = this.skillNodeViews.get(upgradeId);
    if (!view || view.hoverTrembleTween || !this.willRevealHiddenSkillBranch(upgradeId)) {
      return;
    }

    view.container.setAngle(-1.8);
    view.hoverTrembleTween = this.tweens.add({
      targets: view.container,
      angle: 1.8,
      duration: 58,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    view.hoverGlowTween = this.tweens.add({
      targets: view.glow,
      alpha: 0.56,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 170,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopSkillHoverTremble(upgradeId: string): void {
    const view = this.skillNodeViews.get(upgradeId);
    if (!view) {
      return;
    }

    view.hoverTrembleTween?.stop();
    view.hoverGlowTween?.stop();
    view.hoverTrembleTween = undefined;
    view.hoverGlowTween = undefined;
    view.container.setAngle(0);
    view.glow.setAlpha(1);
    view.glow.setScale(1);
  }

  private upgradeSkill(upgradeId: string): void {
    if (!this.isSkillVisible(upgradeId)) {
      this.setSkillStatus("That path has not sprouted yet.");
      return;
    }

    const visibleBefore = this.getVisibleSkillIds();
    this.selectedSkillId = upgradeId;
    this.stopSkillHoverTremble(upgradeId);
    const upgraded = this.buyUpgrade(upgradeId);
    this.bumpSkillNode(upgradeId, upgraded);
    if (upgraded) {
      this.playSkillRevealFeedback(visibleBefore, upgradeId);
    }
    this.refreshUi();
  }

  private upgradeSelectedSkill(): void {
    const visibleBefore = this.getVisibleSkillIds();
    this.stopSkillHoverTremble(this.selectedSkillId);
    const upgraded = this.buyUpgrade(this.selectedSkillId);
    this.bumpSkillNode(this.selectedSkillId, upgraded);
    if (upgraded) {
      this.playSkillRevealFeedback(visibleBefore, this.selectedSkillId);
    }
    this.refreshUi();
  }

  private openSkillTree(): void {
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeAutomationPanel();
    this.closeOptions();
    if (!this.isSkillVisible(this.selectedSkillId)) {
      this.selectedSkillId = UPGRADES[0].id;
    }
    const readyUpgrade = UPGRADES.find((upgrade) => this.isUpgradeReady(upgrade));
    if (readyUpgrade) {
      this.selectedSkillId = readyUpgrade.id;
    }
    this.skillTreeOpen = true;
    this.skillRoot.setVisible(true);
    this.disarmReset();
    this.disarmPrestige();
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeSkillTree(): void {
    this.skillTreeOpen = false;
    this.skillRoot.setVisible(false);
    this.disarmReset();
    this.disarmPrestige();
    this.refreshUi();
  }

  private openQuestLog(): void {
    this.closeSkillTree();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeAutomationPanel();
    this.closeOptions();
    this.questLogOpen = true;
    this.questScroll = 0;
    this.questRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeQuestLog(): void {
    this.questLogOpen = false;
    this.questRoot?.setVisible(false);
    this.refreshUi();
  }

  private openJournal(): void {
    if (!this.state.seedShopPurchases.field_journal) {
      this.showMessage("Buy the Field Journal in the Seed Shop first.", 2200);
      this.audio.play("blocked");
      return;
    }

    this.closeSkillTree();
    this.closeQuestLog();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeAutomationPanel();
    this.closeOptions();
    this.journalOpen = true;
    this.journalScroll = 0;
    this.journalRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeJournal(): void {
    this.journalOpen = false;
    this.journalRoot?.setVisible(false);
    this.refreshUi();
  }

  private openSeedShop(): void {
    this.closeSkillTree();
    this.closeQuestLog();
    this.closeJournal();
    this.closeGoldStore();
    this.closeAutomationPanel();
    this.closeOptions();
    this.seedShopOpen = true;
    this.seedShopScroll = 0;
    this.seedRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeSeedShop(): void {
    this.seedShopOpen = false;
    this.seedRoot?.setVisible(false);
    this.refreshUi();
  }

  private openGoldStore(): void {
    this.closeSkillTree();
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeAutomationPanel();
    this.closeOptions();
    this.storeOpen = true;
    this.storeScroll = 0;
    this.storeStatusText.setText(this.getDefaultStoreStatus());
    this.storeRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeGoldStore(): void {
    this.storeOpen = false;
    this.storeRoot?.setVisible(false);
    this.refreshUi();
  }

  private setStoreMode(mode: StoreMode): void {
    if (this.storeMode === mode) {
      return;
    }

    this.storeMode = mode;
    this.storeScroll = 0;
    this.storeStatusText.setText(this.getDefaultStoreStatus());
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private toggleAutomationBuyMode(): void {
    this.automationBuyMode = this.automationBuyMode === "single" ? "boost" : "single";
    this.setStoreStatus(
      this.automationBuyMode === "boost"
        ? "Automation purchases now target the next ownership boost."
        : "Automation purchases now buy one helper at a time.",
    );
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private getDefaultStoreStatus(): string {
    return this.storeMode === "automation"
      ? "Automation is the lawn engine: stack helpers until passive touches take over."
      : "Spend gold on supplies and placeable companions.";
  }

  private getAutomationPurchasePlan(
    system: AutomationSystemDefinition,
    owned = getAutomationSystemOwned(this.state, system.id),
  ): AutomationPurchasePlan {
    const milestone = this.automationBuyMode === "boost" ? getNextAutomationSystemMilestone(this.state, system.id) : undefined;
    const targetOwned = milestone ? Math.max(owned + 1, milestone.owned) : owned + 1;
    const quantity = Math.max(1, targetOwned - owned);
    let totalCost = 0;

    for (let offset = 0; offset < quantity; offset += 1) {
      totalCost = addGrassTouches(totalCost, getAutomationSystemCost(system, owned + offset));
    }

    return {
      quantity,
      targetOwned,
      totalCost,
      milestone,
    };
  }

  private getActiveStoreItemViews(): Map<string, GoldStoreItemView> {
    return this.storeMode === "automation" ? this.storeAutomationViews : this.storeGoldItemViews;
  }

  private openAutomationPanel(): void {
    if (getAutomationUnitCount(this.state) === 0) {
      this.showMessage("Unlock an automation helper first.", 1800);
      this.audio.play("blocked");
      return;
    }

    this.closeSkillTree();
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeOptions();
    this.automationOpen = true;
    this.automationRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshAutomationPanel();
    this.refreshUi();
  }

  private closeAutomationPanel(): void {
    this.automationOpen = false;
    this.automationRoot?.setVisible(false);
    this.refreshUi();
  }

  private setAutomationDirective(directiveId: AutomationDirectiveId): void {
    if (this.state.automationDirectiveId === directiveId) {
      this.audio.play("blocked");
      return;
    }

    this.state.automationDirectiveId = directiveId;
    recordAutomationDirectiveUsed(this.state, directiveId);
    this.audio.play("upgrade");
    this.saveState();
    this.refreshAutomationPanel();
    this.refreshUi();
  }

  private openOptions(): void {
    this.closeSkillTree();
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeAutomationPanel();
    this.optionsOpen = true;
    this.optionsRoot.setVisible(true);
    this.music.start(this.musicVolume);
    this.audio.play("upgrade");
    this.refreshOptionsPanel();
    this.refreshUi();
  }

  private closeOptions(): void {
    this.optionsOpen = false;
    this.draggingMusicVolume = false;
    this.optionsRoot?.setVisible(false);
    this.refreshUi();
  }

  private startMusicVolumeDrag(pointer: Phaser.Input.Pointer): void {
    this.draggingMusicVolume = true;
    this.setMusicVolumeFromPointer(pointer);
    this.music.start(this.musicVolume);
  }

  private handleMusicVolumeDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingMusicVolume || !this.optionsOpen) {
      return;
    }

    this.setMusicVolumeFromPointer(pointer);
  }

  private setMusicVolumeFromPointer(pointer: Phaser.Input.Pointer): void {
    const nextVolume = Phaser.Math.Clamp((pointer.x - this.musicVolumeSliderX) / this.musicVolumeSliderWidth, 0, 1);
    this.musicVolume = writeStoredMusicVolume(nextVolume);
    this.music.setVolume(this.musicVolume);
    if (this.musicVolume > 0) {
      this.music.start(this.musicVolume);
    }
    this.refreshOptionsPanel();
  }

  private handleGoldStoreItemPressed(itemId: string): void {
    const item = GOLD_STORE_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    const quantity = getInventoryQuantity(this.state, item.id);
    if (item.kind === "consumable" && quantity > 0) {
      this.useGoldStoreItem(item.id);
      return;
    }

    this.buyGoldStoreItem(item.id);
  }

  private buyAutomationSystem(systemId: string): void {
    const system = AUTOMATION_SYSTEMS.find((candidate) => candidate.id === systemId);

    if (!system || !system.isUnlocked(this.state)) {
      this.setStoreStatus("That automation system has not unlocked yet.");
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    const owned = getAutomationSystemOwned(this.state, system.id);
    const plan = this.getAutomationPurchasePlan(system, owned);
    if (!canAffordGrassTouches(this.state.grassTouches, plan.totalCost)) {
      const purchaseLabel =
        this.automationBuyMode === "boost" && plan.quantity > 1
          ? `${plan.quantity} ${system.name} units to reach the next boost`
          : system.name;
      this.setStoreStatus(
        `${purchaseLabel} costs ${formatGrassTouches(plan.totalCost)} Grass Touches. You have ${formatGrassTouches(this.state.grassTouches)}.`,
      );
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    const previousOutput = getDirectiveAdjustedAutomationOutput(
      this.state,
      getAutomationSystemTouchesPerMinute(this.state, system, this.getCachedRuntimeStats()),
    );
    this.state.grassTouches = spendGrassTouches(this.state.grassTouches, plan.totalCost);
    this.state.automationSystems ??= {};
    this.state.automationSystems[system.id] = { owned: plan.targetOwned };
    this.invalidateRuntimeStats();
    const nextOutput = getDirectiveAdjustedAutomationOutput(
      this.state,
      getAutomationSystemTouchesPerMinute(this.state, system, this.getCachedRuntimeStats()),
    );
    const milestoneLabel = getAutomationSystemMilestoneLabel(this.state, system.id);
    const derivativeSupport = getAutomationSystemDerivativeSupport(this.state, system.id);
    const supportText = formatAutomationSupportText(derivativeSupport);
    const bonusParts = [milestoneLabel, supportText].filter(Boolean);
    const statusMessage =
      system.id === "sprinkler" && owned === 0
        ? `${system.name} running x${plan.targetOwned}. Back on the field, click the sprinkler icon to place its coverage.`
        : `${system.name} ${plan.quantity > 1 ? `+${plan.quantity} to x${plan.targetOwned}` : `running x${plan.targetOwned}`}. Output: ${formatGrassTouchesPerMinute(nextOutput)} (${formatAutomationOutputDelta(
            previousOutput,
            nextOutput,
          )})${bonusParts.length > 0 ? ` (${bonusParts.join(", ")})` : ""}.`;
    this.setStoreStatus(statusMessage, system.id === "sprinkler" && owned === 0 ? 4600 : undefined);
    this.audio.play(plan.quantity > 1 || milestoneLabel ? "milestone" : owned === 0 ? "milestone" : "upgrade");
    this.saveState();
    this.refreshUi();
    this.playGoldStoreItemSuccess(system.id);
    this.playHudChipCelebration("auto", "crit-fleck", 0xbff4ff, 12);
  }

  private showAutomationSystemDetails(systemId: string): void {
    const system = AUTOMATION_SYSTEMS.find((candidate) => candidate.id === systemId);
    if (!system) {
      return;
    }

    const owned = getAutomationSystemOwned(this.state, system.id);
    const plan = this.getAutomationPurchasePlan(system, owned);
    const stats = this.getCachedRuntimeStats();
    const currentTotalOutput = getTotalAutomationTouchesPerMinute(this.state, stats);
    const output = getDirectiveAdjustedAutomationOutput(this.state, getAutomationSystemTouchesPerMinute(this.state, system, stats));
    const previewState = getAutomationPreviewState(this.state, system.id, plan.targetOwned);
    const previewOutputContext = getAutomationOutputContext(previewState, stats);
    const previewOutput = getDirectiveAdjustedAutomationOutput(
      previewState,
      getAutomationSystemTouchesPerMinute(previewState, system, stats, previewOutputContext),
    );
    const previewTotalOutput = getTotalAutomationTouchesPerMinute(previewState, stats, previewOutputContext);
    const derivativeSupport = getAutomationSystemDerivativeSupport(this.state, system.id);
    const ownedText =
      derivativeSupport > 0 ? `${owned} owned + ${formatAutomationSupportUnits(derivativeSupport)} support` : `${owned} running`;
    const milestoneMultiplier = getAutomationSystemMilestoneMultiplier(this.state, system.id);
    const pairSynergyLabel = getAutomationSystemPairSynergyLabel(this.state, system.id, stats);
    const nextMilestone = getNextAutomationSystemMilestone(this.state, system.id);
    const nextMilestoneText = nextMilestone
      ? `next boost x${formatAutomationMultiplier(nextMilestone.multiplier)} at ${nextMilestone.owned}`
      : "max boost";
    const buyLabel =
      plan.quantity > 1
        ? `buy +${plan.quantity} to ${plan.targetOwned} (${formatAutomationOutputDelta(output, previewOutput)})`
        : `buy ${formatAutomationOutputDelta(output, previewOutput)}`;
    this.setStoreStatus(
      `${system.name}: ${ownedText} | ${formatGrassTouchesPerMinute(output)} total | ${formatGrassTouchesPerMinute(
        getDirectiveAdjustedAutomationOutput(this.state, system.baseTouchesPerMinute),
      )} base each | ${buyLabel} (all ${formatGrassTouchesPerMinute(
        previewTotalOutput,
      )}, ${formatAutomationOutputDelta(currentTotalOutput, previewTotalOutput)}) | boost x${formatAutomationMultiplier(milestoneMultiplier)}${
        pairSynergyLabel ? ` | ${pairSynergyLabel}` : ""
      } | ${nextMilestoneText} | Cost: ${formatGrassTouches(plan.totalCost)} Grass Touches`,
    );
  }

  private showGoldStoreItemDetails(itemId: string): void {
    const item = GOLD_STORE_ITEMS.find((candidate) => candidate.id === itemId);
    if (!item) {
      return;
    }

    const quantity = getInventoryQuantity(this.state, item.id);
    const maxQuantityText = item.maxQuantity === undefined ? "" : `/${item.maxQuantity}`;
    const unlocked = item.isUnlocked(this.state);
    const purchaseLine =
      item.kind === "consumable" && quantity > 0
        ? "click to use"
        : item.id === "seed_satchel" && unlocked
          ? `cost ${item.cost} gold, opens +5 seeds`
        : unlocked
          ? `cost ${item.cost} gold`
          : "locked";
    const placementLine = item.kind === "animal" ? "place from the field dock after buying" : "consumable";

    this.setStoreStatus(`${item.name}: ${item.kind} | owned ${quantity}${maxQuantityText} | ${purchaseLine} | ${placementLine}`);
  }

  private buyGoldStoreItem(itemId: string): void {
    const item = GOLD_STORE_ITEMS.find((candidate) => candidate.id === itemId);

    if (!item || !item.isUnlocked(this.state)) {
      this.setStoreStatus("That store shelf has not unlocked yet.");
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    const quantity = getInventoryQuantity(this.state, item.id);
    if (item.maxQuantity !== undefined && quantity >= item.maxQuantity) {
      this.setStoreStatus(`${item.name} is already with you.`);
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    if (this.state.gold < item.cost) {
      this.setStoreStatus(`${item.name} costs ${item.cost} gold. You have ${Math.floor(this.state.gold)}.`);
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    if (item.id === "seed_satchel") {
      this.state.gold -= item.cost;
      this.state.seeds += 5;
      this.state.lifetimeSeeds += 5;
      this.invalidateRuntimeStats();
      this.setStoreStatus("Seed Satchel opened into 5 seeds.");
      this.audio.play("seed");
      this.saveState();
      this.refreshUi();
      this.playGoldStoreItemSuccess(item.id);
      this.playHudChipCelebration("seeds", "effect-seed-kernel", 0xb7eba5, 12);
      this.addTriggerFeedEvent("Store item used", "+5 seeds", "ST", 0xfff1a8);
      return;
    }

    this.state.gold -= item.cost;
    addInventoryItem(this.state, item.id, item.kind);
    this.invalidateRuntimeStats();
    this.setStoreStatus(`${item.name} added to inventory.`);
    this.audio.play(item.kind === "animal" ? "milestone" : "upgrade");
    this.saveState();
    this.refreshUi();
    this.layoutTiles();
    this.playGoldStoreItemSuccess(item.id);
    this.playHudChipCelebration("gold", "effect-gold-coin", 0xffef78, 10);
    this.addTriggerFeedEvent("Store purchase", item.name, "ST", item.kind === "animal" ? 0xffef78 : 0xdfffc8);
  }

  private useGoldStoreItem(itemId: string): void {
    switch (itemId) {
      case "pocket_sunshine":
        this.usePocketSunshine();
        break;
      case "seed_satchel":
        if (!consumeInventoryItem(this.state, itemId)) {
          this.setStoreStatus("You do not have that item yet.");
          this.audio.play("blocked");
          return;
        }
        this.state.seeds += 5;
        this.state.lifetimeSeeds += 5;
        this.invalidateRuntimeStats();
        this.setStoreStatus("Seed Satchel opened into 5 seeds.");
        this.audio.play("seed");
        this.saveState();
        this.refreshUi();
        this.playGoldStoreItemSuccess(itemId);
        this.playHudChipCelebration("seeds", "effect-seed-kernel", 0xb7eba5, 12);
        this.addTriggerFeedEvent("Store item used", "+5 seeds", "ST", 0xfff1a8);
        break;
    }
  }

  private usePocketSunshine(): void {
    const restingTiles = getRegrowingTiles(this.state);
    if (restingTiles.length === 0) {
      this.setStoreStatus("No resting patches need sunshine right now.");
      this.audio.play("blocked");
      return;
    }

    if (!consumeInventoryItem(this.state, "pocket_sunshine")) {
      this.setStoreStatus("You do not have Pocket Sunshine yet.");
      this.audio.play("blocked");
      return;
    }

    this.invalidateRuntimeStats();

    for (const tile of restingTiles) {
      tile.grassState = "grown";
      tile.regrowEndsAt = 0;
      tile.trait = "dewy";
      this.refreshTile(tile);
      this.popAtTile(tile, "sunny", "#ffef78");
    }

    this.setStoreStatus(`Pocket Sunshine regrew ${restingTiles.length} patch${restingTiles.length === 1 ? "" : "es"}.`);
    this.audio.play("regrow");
    this.saveState();
    this.refreshUi();
    this.playGoldStoreItemSuccess("pocket_sunshine");
    this.addTriggerFeedEvent("Pocket Sunshine", `${restingTiles.length} patches regrown`, "ST", 0xffef78);
  }

  private buySeedShopItem(itemId: string): void {
    const item = SEED_SHOP_ITEMS.find((candidate) => candidate.id === itemId);

    if (!item || !item.isUnlocked(this.state)) {
      this.setSeedStatus("That idea has not sprouted yet.");
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    if (this.state.seedShopPurchases[item.id]) {
      this.setSeedStatus(`${item.name} is already growing.`);
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    if (this.state.seeds < item.cost) {
      this.setSeedStatus(`${item.name} needs ${item.cost} seeds. You have ${Math.floor(this.state.seeds)}.`);
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    this.state.seeds -= item.cost;
    this.state.seedShopPurchases[item.id] = true;
    this.invalidateRuntimeStats();
    if (item.id === "weather_jar") {
      this.state.weatherEndsAt = 0;
      this.updateWeather(Date.now(), false);
    }
    this.setSeedStatus(`${item.name} unlocked.`);
    this.audio.play("upgrade");
    this.saveState();
    this.refreshUi();
    this.layoutTiles();
    this.playSeedShopItemSuccess(item.id);
    this.playHudChipCelebration("seeds", "effect-seed-kernel", 0xb7eba5, 10);
    this.addTriggerFeedEvent("Seed upgrade", item.name, "SE", 0xb7eba5);
  }

  private getSkillResourceText(): string {
    const preview = getPrestigePreview(this.state);
    const separator = this.scale.width < 620 ? "\n" : " | ";
    return [
      `Available Grass Touches: ${formatGrassTouches(this.state.grassTouches)}`,
      `Meadow Memory: ${this.state.prestige.meadowMemory} (x${formatPrestigeMultiplier(preview.currentMultiplier)})`,
      preview.canPrestige ? `Prestige: +${preview.memoryGain}` : `Prestige: ${formatGrassTouches(preview.missingTouches)} to go`,
    ].join(separator);
  }

  private refreshPrestigeButton(): void {
    const preview = getPrestigePreview(this.state);
    setTextButtonText(this.prestigeButton, this.prestigeArmed ? "Confirm" : preview.canPrestige ? `Prestige +${preview.memoryGain}` : "Prestige");
    setTextButtonAttention(this.prestigeButton, preview.canPrestige);
  }

  private handlePrestigePressed(): void {
    const preview = this.profileScope("prestige:preview", () => getPrestigePreview(this.state));
    if (!preview.canPrestige) {
      this.setSkillStatus(`${formatPrestigeProgress(preview)}. First prestige grants at least 5 Meadow Memory for a strong restart.`, 4200);
      this.audio.play("blocked");
      this.refreshUi();
      return;
    }

    if (!this.prestigeArmed) {
      this.prestigeArmed = true;
      this.disarmReset();
      this.refreshPrestigeButton();
      this.setSkillStatus(
        `Prestige for +${preview.memoryGain} Meadow Memory. Legacy x${formatPrestigeMultiplier(
          preview.currentMultiplier,
        )} -> x${formatPrestigeMultiplier(preview.nextMultiplier)}. Resets the run, keeps journal discoveries.`,
        5200,
      );
      this.audio.play("milestone");
      this.time.delayedCall(5200, () => this.disarmPrestige());
      return;
    }

    this.performPrestigeReset(preview.memoryGain);
  }

  private disarmPrestige(): void {
    this.prestigeArmed = false;
    if (this.prestigeButton) {
      this.refreshPrestigeButton();
    }
  }

  private performPrestigeReset(memoryGain: number): void {
    const previousState = this.state;
    const previousMultiplier = getPrestigePreview(previousState).currentMultiplier;
    const nextState = this.profileScope("prestige:state", () => {
      const freshState = createInitialState(previousState.characterClassId);
      freshState.prestige = getNextPrestigeState(previousState, memoryGain);
      freshState.journal = {
        discoveredGrassTiers: [...previousState.journal.discoveredGrassTiers],
        discoveredTileTraits: [...previousState.journal.discoveredTileTraits],
        seenWeatherIds: [...previousState.journal.seenWeatherIds],
        seenHazardIds: [...previousState.journal.seenHazardIds],
        bestComboCount: previousState.journal.bestComboCount,
      };
      freshState.selectedTrackId = previousState.selectedTrackId;
      return freshState;
    });
    const nextMultiplier = getPrestigePreview(nextState).currentMultiplier;

    this.profileScope("prestige:sceneReset", () =>
      this.restartRunFromState(
        nextState,
        `Prestige complete: +${memoryGain} Meadow Memory. Legacy x${formatPrestigeMultiplier(previousMultiplier)} -> x${formatPrestigeMultiplier(
          nextMultiplier,
        )}.`,
      ),
    );
    this.profileScope("prestige:save", () => this.saveState());
    this.audio.play("milestone");
  }

  private handleResetPressed(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.disarmPrestige();
      setTextButtonText(this.resetButton, "Confirm?");
      this.setSkillStatus("Tap Confirm? to reset your save.");
      this.audio.play("blocked");
      this.time.delayedCall(2600, () => this.disarmReset());
      return;
    }

    this.resetPrototypeSave();
  }

  private disarmReset(): void {
    this.resetArmed = false;
    setTextButtonText(this.resetButton, "Reset");
  }

  private resetPrototypeSave(): void {
    const characterClassId = this.state.characterClassId;
    this.restartRunFromState(resetSave(characterClassId), "Fresh start. One patch. Infinite responsibility.");
  }

  private restartRunFromState(nextState: GameState, message: string): void {
    this.disarmReset();
    this.disarmPrestige();
    this.state = nextState;
    this.invalidateRuntimeStats();
    this.rebuildFieldMetrics();
    this.automationScheduler.reset();
    this.sprinkler.reset();
    this.animalCompanions.reset();
    this.automationIncome.reset();
    this.hazards.reset();
    this.mutations.reset();
    this.combo.reset();
    this.activeComboSource = "manual";
    this.lastMusicComboLevel = 0;
    this.lastAutomationIncomeFeedAt = 0;
    this.triggerFeedEvents = [];
    this.triggerFeedRenderKey = "";
    this.music.setComboLevel(0);
    this.recentlyRegrownAt.clear();
    this.destroyAllPerfectTouchCues();
    this.clearMowerVisuals();
    this.resetBoardView();
    this.destroyAllTileViews();
    this.worldObjectViews.forEach((view) => view.container.destroy());
    this.worldObjectViews.clear();
    this.placedWorldObjectViews.forEach((view) => {
      view.coverage.destroy();
      view.container.destroy();
    });
    this.placedWorldObjectViews.clear();
    this.selectedPlacementObjectId = undefined;
    this.selectedSkillId = UPGRADES[0].id;
    this.closeSkillTree();
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeAutomationPanel();
    this.closeOptions();
    this.renderAllTiles();
    this.refreshUi();
    this.showMessage(message, 3200);
  }

  private resetBoardView(): void {
    this.boardZoom = 1;
    this.boardPanX = 0;
    this.boardPanY = 0;
    this.isBoardPanArmed = false;
    this.isPanningBoard = false;
  }

  private renderAllTiles(): void {
    this.layoutTiles("initial");
  }

  private requestBoardLayout(reason: BoardLayoutReason): void {
    this.pendingBoardLayout = true;
    this.pendingBoardLayoutReason = this.getPreferredBoardLayoutReason(this.pendingBoardLayoutReason, reason);
  }

  private getPreferredBoardLayoutReason(current: BoardLayoutReason, next: BoardLayoutReason): BoardLayoutReason {
    const priority: Record<BoardLayoutReason, number> = {
      direct: 0,
      ui: 1,
      dirty: 2,
      pan: 3,
      zoom: 4,
      field: 5,
      resize: 6,
      initial: 7,
    };
    return priority[next] >= priority[current] ? next : current;
  }

  private flushPendingBoardLayout(): void {
    if (!this.pendingBoardLayout) {
      return;
    }

    const reason = this.pendingBoardLayoutReason;
    this.pendingBoardLayout = false;
    this.pendingBoardLayoutReason = "direct";
    this.layoutTiles(reason);
  }

  private cancelCommonRedrawQueue(): void {
    const redrawKeys = [...this.redrawTileViewKeys];
    this.commonRedrawQueue = [];
    this.commonRedrawQueueIndex = 0;
    this.commonRedrawQueuedTiles = 0;
    this.redrawTileViewKeys.clear();
    for (const key of redrawKeys) {
      this.releaseBatchTileViewIfIdle(key);
    }
  }

  private scheduleCommonRedraw(entries: CommonRedrawEntry[]): void {
    this.commonRedrawQueue = entries;
    this.commonRedrawQueueIndex = 0;
    this.commonRedrawQueuedTiles = entries.length;
  }

  private tryQueueDirtyCommonRedraw(): boolean {
    if (this.usesLiveTileViews() || !this.commonTileLayer) {
      return false;
    }

    if (this.commonRedrawQueue.length > 0) {
      return true;
    }

    const entries: CommonRedrawEntry[] = [];
    for (const key of this.staleCommonTileKeys) {
      const tile = this.state.field[key];
      if (!tile) {
        this.staleCommonTileKeys.delete(key);
        this.dirtyTileViewKeys.delete(key);
        this.redrawTileViewKeys.delete(key);
        continue;
      }

      const position = this.getTileScreenPosition(tile);
      if (!position || !this.isScreenPositionNearViewport(position)) {
        this.staleCommonTileKeys.delete(key);
        this.dirtyTileViewKeys.delete(key);
        this.redrawTileViewKeys.delete(key);
        this.releaseBatchTileViewIfIdle(key);
        continue;
      }

      this.redrawTileViewKeys.add(key);
      entries.push({ key, x: position.x, y: position.y });
    }

    this.commonTileLayerDirty = false;
    if (entries.length === 0) {
      return true;
    }

    this.scheduleCommonRedraw(entries);
    return true;
  }

  private shouldDeferCommonRedrawWork(): boolean {
    return this.hasBlockingOverlayOpen();
  }

  private processCommonRedrawQueue(): void {
    if (
      !this.commonTileLayer ||
      this.commonRedrawQueue.length === 0 ||
      this.commonRedrawQueueIndex >= this.commonRedrawQueue.length
    ) {
      this.commonRedrawQueue = [];
      this.commonRedrawQueueIndex = 0;
      this.commonRedrawQueuedTiles = 0;
      return;
    }

    const startedAt = performance.now();
    const tileBudget = this.getCommonRedrawTileBudget();
    const frameBudgetMs = this.getCommonRedrawFrameBudgetMs();
    let drawn = 0;
    while (this.commonRedrawQueueIndex < this.commonRedrawQueue.length && drawn < tileBudget) {
      const entry = this.commonRedrawQueue[this.commonRedrawQueueIndex];
      this.commonRedrawQueueIndex += 1;
      if (!entry) {
        break;
      }

      const tile = this.state.field[entry.key];
      if (tile) {
        this.drawCommonTile(tile, entry.x, entry.y);
        this.staleCommonTileKeys.delete(entry.key);
        this.dirtyTileViewKeys.delete(entry.key);
        this.redrawTileViewKeys.delete(entry.key);
        this.releaseBatchTileViewIfIdle(entry.key);
      } else {
        this.staleCommonTileKeys.delete(entry.key);
        this.dirtyTileViewKeys.delete(entry.key);
        this.redrawTileViewKeys.delete(entry.key);
      }

      drawn += 1;
      if (performance.now() - startedAt >= frameBudgetMs) {
        break;
      }
    }

    this.commonRedrawQueuedTiles = Math.max(0, this.commonRedrawQueue.length - this.commonRedrawQueueIndex);
    if (this.commonRedrawQueueIndex >= this.commonRedrawQueue.length) {
      this.commonRedrawQueue = [];
      this.commonRedrawQueueIndex = 0;
      this.commonRedrawQueuedTiles = 0;
      this.redrawTileViewKeys.clear();
      for (const key of [...this.lastVisibleTileKeys]) {
        this.releaseBatchTileViewIfIdle(key);
      }
      this.commonTileLayerDirty = this.staleCommonTileKeys.size > 0;
    }
  }

  private zoomBoard(deltaY: number, pointerX: number, pointerY: number): void {
    if (this.skillTreeOpen) {
      return;
    }

    const previousZoom = this.boardZoom;
    const previousScale = this.boardScale;
    const previousPanX = this.boardPanX;
    const previousPanY = this.boardPanY;
    const zoomFactor = Math.exp(-deltaY * 0.0015);
    this.boardZoom = Phaser.Math.Clamp(this.boardZoom * zoomFactor, MIN_BOARD_ZOOM, MAX_BOARD_ZOOM);

    if (this.boardZoom === previousZoom || previousScale <= 0) {
      return;
    }

    const focusWorldX = (pointerX - this.boardBaseCenterX - previousPanX) / previousScale;
    const focusWorldY = (pointerY - this.boardBaseCenterY - previousPanY) / previousScale;
    const nextScale = previousScale * (this.boardZoom / previousZoom);
    this.boardPanX = pointerX - this.boardBaseCenterX - focusWorldX * nextScale;
    this.boardPanY = pointerY - this.boardBaseCenterY - focusWorldY * nextScale;
    this.requestBoardLayout("zoom");
  }

  private createTileView(tile: FieldTile): void {
    const key = this.getTileKey(tile);
    this.registerFieldTile(tile);
    const existing = this.tileViews.get(key);
    if (existing) {
      this.refreshTile(tile);
      this.positionTileView(tile, existing);
      return;
    }

    const view = this.tileViewPool.pop() ?? this.createPooledTileView();
    view.key = key;
    view.base.setVisible(true).setInteractive({ useHandCursor: true });
    view.grass.setVisible(true).setInteractive({ useHandCursor: true });
    view.hazard.setVisible(false).setInteractive({ useHandCursor: true });
    view.outline.setVisible(false);
    view.glint.setVisible(false);
    view.label.setVisible(false);
    this.tileViews.set(key, view);
    this.refreshTile(tile);
    this.positionTileView(tile, view);
  }

  private createPooledTileView(): TileView {
    const base = this.add
      .image(0, 0, "tile-dirt")
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const outline = this.add
      .rectangle(0, 0, TILE_SIZE + 8, TILE_SIZE + 8, 0xffffff, 0)
      .setOrigin(0.5)
      .setStrokeStyle(4, 0xf4ff8a, 0)
      .setVisible(false);

    const grass = this.add
      .image(0, 0, "grass-normal")
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const hazard = this.add
      .image(0, 0, "hazard-cactus")
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);

    const glint = this.add
      .star(0, 0, 5, 3, 8, 0xfff08a, 0.9)
      .setStrokeStyle(1, 0xffffff, 0.9)
      .setVisible(false);

    const label = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const view: TileView = { base, grass, hazard, label, outline, glint };
    base.on("pointerdown", () => this.handleTileViewClicked(view));
    grass.on("pointerdown", () => this.handleTileViewClicked(view));
    hazard.on("pointerdown", () => this.handleTileViewClicked(view));
    base.on("pointerover", () => this.showTileViewInfo(view));
    grass.on("pointerover", () => this.showTileViewInfo(view));
    hazard.on("pointerover", () => this.showTileViewInfo(view));
    base.on("pointerout", () => this.hideTileViewInfo(view));
    grass.on("pointerout", () => this.hideTileViewInfo(view));
    hazard.on("pointerout", () => this.hideTileViewInfo(view));
    return view;
  }

  private destroyTileView(key: TileKey, view: TileView): void {
    this.tweens.killTweensOf([view.base, view.grass, view.hazard, view.label, view.outline, view.glint]);
    this.dirtyTileViewKeys.delete(key);
    this.redrawTileViewKeys.delete(key);
    view.key = undefined;
    view.base.disableInteractive().setVisible(false).setAlpha(1).clearTint();
    view.grass.disableInteractive().setVisible(false).setAlpha(1).clearTint();
    view.hazard.disableInteractive().setVisible(false).setAlpha(1).clearTint();
    view.outline.setVisible(false).setAlpha(1);
    view.glint.setVisible(false).setAlpha(1);
    view.label.setVisible(false).setAlpha(1).setText("");
    this.tileViews.delete(key);
    if (this.tileViewPool.length >= TILE_VIEW_POOL_LIMIT) {
      this.destroyTileViewObjects(view);
      return;
    }

    this.tileViewPool.push(view);
  }

  private destroyAllTileViews(): void {
    for (const [key, view] of this.tileViews) {
      this.destroyTileView(key, view);
    }

    for (const view of this.tileViewPool) {
      this.destroyTileViewObjects(view);
    }

    this.tileViews.clear();
    this.tileViewPool = [];
    this.dirtyTileViewKeys.clear();
    this.staleCommonTileKeys.clear();
    this.redrawTileViewKeys.clear();
  }

  private destroyTileViewObjects(view: TileView): void {
    this.tweens.killTweensOf([view.base, view.grass, view.hazard, view.label, view.outline, view.glint]);
    view.base.destroy();
    view.grass.destroy();
    view.hazard.destroy();
    view.outline.destroy();
    view.glint.destroy();
    view.label.destroy();
  }

  private handleTileViewClicked(view: TileView): void {
    const tile = view.key ? this.state.field[view.key] : undefined;
    if (tile) {
      this.handleTileClicked(tile);
    }
  }

  private showTileViewInfo(view: TileView): void {
    const tile = view.key ? this.state.field[view.key] : undefined;
    if (tile) {
      this.showTileInfo(tile);
    }
  }

  private hideTileViewInfo(view: TileView): void {
    const tile = view.key ? this.state.field[view.key] : undefined;
    if (tile) {
      this.hideTileInfo(tile);
    }
  }

  private layoutTiles(reason: BoardLayoutReason = "direct"): void {
    const perfStart = this.shouldProfile() ? performance.now() : undefined;
    try {
    const bounds = this.cachedFieldBounds;
    if (this.fieldTileCount === 0 || !bounds) {
      return;
    }

    this.cancelCommonRedrawQueue();
    if (reason === "pan" || reason === "zoom" || reason === "resize" || reason === "field") {
      this.clearBoardTransientEffects();
    }
    this.layoutPassCount += 1;
    const boardWidth = bounds.width * (TILE_SIZE + TILE_GAP);
    const boardHeight = bounds.height * (TILE_SIZE + TILE_GAP);
    const mobilePortrait = this.isMobilePortrait();
    const commandDockReserve = Number.isFinite(this.mobileCommandDockTop) ? this.scale.height - this.mobileCommandDockTop + 12 : 112;
    const mobileDockSafeBottom = mobilePortrait
      ? Math.max(this.getActiveWorldObjects().length > 0 ? 148 : 112, commandDockReserve + (this.getActiveWorldObjects().length > 0 ? 44 : 0))
      : 28;
    this.boardTopY = mobilePortrait
      ? Math.max(176, this.getMobileMenuBottom() + 8, this.milestoneText.y + this.milestoneText.height + 12)
      : Math.max(142, this.milestoneText.y + this.milestoneText.height + 24);
    this.boardAvailableWidth = Math.max(120, this.scale.width - (mobilePortrait ? 14 : 24));
    this.boardAvailableHeight = Math.max(120, this.scale.height - this.boardTopY - mobileDockSafeBottom);
    const fitScale = Math.min(1, this.boardAvailableWidth / boardWidth, this.boardAvailableHeight / boardHeight);
    const mobileBoardZoom = mobilePortrait ? 1.22 : 1;
    this.boardScale = Math.max(this.getMinimumBoardScale(), fitScale * this.boardZoom * mobileBoardZoom);
    this.boardScaledWidth = boardWidth * this.boardScale;
    this.boardScaledHeight = boardHeight * this.boardScale;
    this.boardBaseCenterX = this.scale.width / 2;
    this.boardBaseCenterY = this.boardTopY + this.boardAvailableHeight / 2 + BOARD_Y_OFFSET * this.boardScale;
    this.clampBoardPan();
    const centerX = this.boardBaseCenterX + this.boardPanX;
    const centerY = this.boardBaseCenterY + this.boardPanY;
    const scaledStep = (TILE_SIZE + TILE_GAP) * this.boardScale;
    const startX = centerX - this.boardScaledWidth / 2 + (TILE_SIZE * this.boardScale) / 2;
    const startY = centerY - this.boardScaledHeight / 2 + (TILE_SIZE * this.boardScale) / 2;
    const visibleKeys = new Set<TileKey>();
    this.lastVisibleTileKeys.clear();
    let visibleTiles = 0;
    const radius = (TILE_SIZE * this.boardScale) / 2 + this.getTileCullMargin();
    const cullBounds = this.getBoardViewportBounds(radius);
    const minVisibleX = Phaser.Math.Clamp(Math.floor((cullBounds.left - startX) / scaledStep) + bounds.minX, bounds.minX, bounds.maxX);
    const maxVisibleX = Phaser.Math.Clamp(Math.ceil((cullBounds.right - startX) / scaledStep) + bounds.minX, bounds.minX, bounds.maxX);
    const minVisibleY = Phaser.Math.Clamp(Math.floor((cullBounds.top - startY) / scaledStep) + bounds.minY, bounds.minY, bounds.maxY);
    const maxVisibleY = Phaser.Math.Clamp(Math.ceil((cullBounds.bottom - startY) / scaledStep) + bounds.minY, bounds.minY, bounds.maxY);
    const visibleCandidateCount = Math.max(0, maxVisibleX - minVisibleX + 1) * Math.max(0, maxVisibleY - minVisibleY + 1);
    const budgetCommonRedraw = this.shouldBudgetCommonRedraw(reason, visibleCandidateCount);
    const queuedCommonRedrawEntries: CommonRedrawEntry[] = [];
    this.profileScope("layout:backdrop", () => {
      this.clearBoardBackdrop();
      this.drawBoardBackdrop(centerX, centerY, scaledStep, bounds);
      this.layoutBoardLayers();
    });

    this.profileScope("layout:tiles", () => {
      for (let gridY = minVisibleY; gridY <= maxVisibleY; gridY += 1) {
        for (let gridX = minVisibleX; gridX <= maxVisibleX; gridX += 1) {
          const key = tileKey(gridX, gridY);
          const tile = this.state.field[key];
          if (!tile) {
            continue;
          }

          let view = this.tileViews.get(key);
          const x = startX + (tile.x - bounds.minX) * scaledStep;
          const y = startY + (tile.y - bounds.minY) * scaledStep;
          const commitDirtyTile = this.dirtyTileViewKeys.has(key) && !this.usesFullLiveTileViews() && !budgetCommonRedraw;

          visibleTiles += 1;
          this.lastVisibleTileKeys.add(key);
          if (budgetCommonRedraw) {
            this.redrawTileViewKeys.add(key);
            queuedCommonRedrawEntries.push({ key, x, y });
          }

          if (commitDirtyTile) {
            this.drawCommonTile(tile, x, y);
            this.dirtyTileViewKeys.delete(key);
          }

          if (!this.needsTileView(tile, key)) {
            if (!commitDirtyTile) {
              this.drawCommonTile(tile, x, y);
            }
            if (view) {
              this.destroyTileView(key, view);
            }
            continue;
          }

          visibleKeys.add(key);
          if (!view) {
            this.createTileView(tile);
            view = this.tileViews.get(key);
            if (!view) {
              continue;
            }
          }

          this.positionTileView(tile, view, x, y);
          view.label.setVisible(key === this.hoveredTileKey);
        }
      }

      for (const [key, view] of this.tileViews) {
        if (!visibleKeys.has(key)) {
          this.destroyTileView(key, view);
        }
      }
    });

    this.lastStressStats = { visibleTiles, totalTiles: this.fieldTileCount };
    this.commonTileLayerDirty = false;
    this.staleCommonTileKeys.clear();
    this.dirtyTileViewKeys.clear();
    if (budgetCommonRedraw) {
      this.scheduleCommonRedraw(queuedCommonRedrawEntries);
    }

    this.profileScope("layout:objects", () => {
      this.layoutPlacedWorldObjects();
      this.layoutWorldObjects();
    });

    this.layoutTriggerFeed();
    this.profileScope("layout:hover", () => this.refreshHoverMarker());
    } finally {
      if (perfStart !== undefined) {
        const duration = performance.now() - perfStart;
        this.recordPerfScope("layout", duration);
        this.recordPerfScope(`layout:${reason}`, duration);
      }
    }
  }

  private layoutBoardLayers(): void {
    if (this.commonTileLayer) {
      this.profileScope("render:commonLayer", () => {
        this.commonLayerRedrawCount += 1;
        this.commonTileLayer?.setPosition(0, 0);
        if (this.commonTileLayerWidth !== this.scale.width || this.commonTileLayerHeight !== this.scale.height) {
          this.commonTileLayer?.resize(this.scale.width, this.scale.height);
          this.commonTileLayerWidth = this.scale.width;
          this.commonTileLayerHeight = this.scale.height;
        }
        this.commonTileLayer?.clear();
      });
    }

    if (this.boardHitZone) {
      this.boardHitZone.setPosition(0, 0);
      this.boardHitZone.setSize(this.scale.width, this.scale.height);
      if (this.boardHitZone.input) {
        this.boardHitZone.input.hitArea = new Phaser.Geom.Rectangle(0, 0, this.scale.width, this.scale.height);
        this.boardHitZone.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
      }
    }
  }

  private clearBoardBackdrop(): void {
    if (!this.boardBackdropGraphics) {
      return;
    }

    this.boardBackdropGraphics.clear();
  }

  private drawBoardBackdrop(centerX: number, centerY: number, scaledStep: number, bounds: FieldBounds): void {
    if (!this.boardBackdropGraphics) {
      return;
    }

    const graphics = this.boardBackdropGraphics;
    const pad = Math.max(16, 24 * this.boardScale);
    const x = centerX - this.boardScaledWidth / 2 - pad;
    const y = centerY - this.boardScaledHeight / 2 - pad;
    const width = this.boardScaledWidth + pad * 2;
    const height = this.boardScaledHeight + pad * 2;
    const radius = Phaser.Math.Clamp(20 * this.boardScale, 10, 28);
    const shadowOffset = Math.max(8, 14 * this.boardScale);

    graphics.fillStyle(0x031008, 0.34);
    graphics.fillRoundedRect(x + shadowOffset, y + shadowOffset, width, height, radius);
    graphics.fillStyle(0x0a2a18, 0.5);
    graphics.fillRoundedRect(x, y, width, height, radius);
    graphics.fillStyle(0x184326, 0.32);
    graphics.fillRoundedRect(x + pad * 0.35, y + pad * 0.35, width - pad * 0.7, height - pad * 0.7, Math.max(6, radius - 5));
    graphics.lineStyle(Math.max(2, 4 * this.boardScale), 0xb7eba5, 0.32);
    graphics.strokeRoundedRect(x, y, width, height, radius);
    graphics.lineStyle(Math.max(1, 2 * this.boardScale), 0xffef78, 0.18);
    graphics.strokeRoundedRect(x + pad * 0.5, y + pad * 0.5, width - pad, height - pad, Math.max(5, radius - 8));

    this.drawBoardGridHint(graphics, centerX, centerY, scaledStep, bounds);
    this.drawBoardEdgeDetails(graphics, x, y, width, height, pad);
  }

  private drawBoardGridHint(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    scaledStep: number,
    bounds: FieldBounds,
  ): void {
    if (this.boardScale < 0.58 || bounds.width > 24 || bounds.height > 24) {
      return;
    }

    const left = centerX - this.boardScaledWidth / 2 - (TILE_GAP * this.boardScale) / 2;
    const top = centerY - this.boardScaledHeight / 2 - (TILE_GAP * this.boardScale) / 2;
    const right = left + this.boardScaledWidth;
    const bottom = top + this.boardScaledHeight;

    graphics.lineStyle(1, 0xf7ffe8, 0.08);
    for (let column = 1; column < bounds.width; column += 1) {
      const lineX = left + column * scaledStep - (TILE_GAP * this.boardScale) / 2;
      graphics.beginPath();
      graphics.moveTo(lineX, top);
      graphics.lineTo(lineX, bottom);
      graphics.strokePath();
    }

    for (let row = 1; row < bounds.height; row += 1) {
      const lineY = top + row * scaledStep - (TILE_GAP * this.boardScale) / 2;
      graphics.beginPath();
      graphics.moveTo(left, lineY);
      graphics.lineTo(right, lineY);
      graphics.strokePath();
    }
  }

  private drawBoardEdgeDetails(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, pad: number): void {
    const detailScale = Phaser.Math.Clamp(this.boardScale, 0.5, 1.25);
    const accents = [
      { color: 0xffef78, side: "top" },
      { color: 0xffb7d5, side: "bottom" },
      { color: 0x75e8ff, side: "left" },
      { color: 0xb7eba5, side: "right" },
      { color: 0xffd09a, side: "bottom" },
      { color: 0xd7fff2, side: "top" },
    ] as const;

    accents.forEach((accent, index) => {
      const t = (index + 1) / (accents.length + 1);
      const wobble = Math.sin(index * 1.9) * pad * 0.22;
      const px =
        accent.side === "left"
          ? x + pad * 0.32
          : accent.side === "right"
            ? x + width - pad * 0.32
            : x + width * t;
      const py =
        accent.side === "top"
          ? y + pad * 0.32
          : accent.side === "bottom"
            ? y + height - pad * 0.32
            : y + height * t;

      this.drawTinyFlower(graphics, px + wobble, py - wobble * 0.4, accent.color, detailScale);
    });
  }

  private drawTinyFlower(graphics: Phaser.GameObjects.Graphics, x: number, y: number, color: number, scale: number): void {
    const petalRadius = 2.8 * scale;
    const centerRadius = 1.8 * scale;

    graphics.lineStyle(Math.max(1, 1.3 * scale), 0x17491f, 0.55);
    graphics.beginPath();
    graphics.moveTo(x, y + centerRadius);
    graphics.lineTo(x, y + 12 * scale);
    graphics.strokePath();
    graphics.fillStyle(0x76c85f, 0.72);
    graphics.fillEllipse(x - 3.6 * scale, y + 8 * scale, 5.5 * scale, 2.8 * scale);
    graphics.fillEllipse(x + 3.6 * scale, y + 7 * scale, 5.5 * scale, 2.8 * scale);
    graphics.fillStyle(color, 0.82);
    graphics.fillCircle(x - petalRadius, y, petalRadius);
    graphics.fillCircle(x + petalRadius, y, petalRadius);
    graphics.fillCircle(x, y - petalRadius, petalRadius);
    graphics.fillCircle(x, y + petalRadius, petalRadius);
    graphics.fillStyle(0xf7ffe8, 0.9);
    graphics.fillCircle(x, y, centerRadius);
  }

  private needsTileView(tile: FieldTile, key: TileKey): boolean {
    return (
      this.usesLiveTileViews() ||
      this.dirtyTileViewKeys.has(key) ||
      this.redrawTileViewKeys.has(key) ||
      this.perfectTouchCues.has(key) ||
      key === this.hoveredTileKey
    );
  }

  private releaseBatchTileViewIfIdle(key: TileKey): void {
    if (
      this.usesLiveTileViews() ||
      this.dirtyTileViewKeys.has(key) ||
      this.redrawTileViewKeys.has(key) ||
      this.perfectTouchCues.has(key) ||
      key === this.hoveredTileKey
    ) {
      return;
    }

    const view = this.tileViews.get(key);
    if (view) {
      this.destroyTileView(key, view);
    }
  }

  private usesFullLiveTileViews(): boolean {
    return this.fieldTileCount <= LIVE_TILE_VIEW_FIELD_LIMIT;
  }

  private usesViewportLiveTileViews(): boolean {
    return !this.usesFullLiveTileViews() && this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH;
  }

  private usesLiveTileViews(): boolean {
    return this.usesFullLiveTileViews() || this.usesViewportLiveTileViews();
  }

  private getTileMode(): PerfStatsSnapshot["tileMode"] {
    return this.usesFullLiveTileViews() ? "live" : this.usesViewportLiveTileViews() ? "viewport" : "batch";
  }

  private shouldBudgetCommonRedraw(reason: BoardLayoutReason, visibleCandidateCount: number): boolean {
    if (this.usesLiveTileViews() || !this.commonTileLayer) {
      return false;
    }

    if (visibleCandidateCount <= 0 || visibleCandidateCount > COMMON_REDRAW_MOBILE_TILE_LIMIT) {
      return false;
    }

    return this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH || reason === "pan" || reason === "zoom";
  }

  private getDirtyTileViewLimit(): number {
    if (this.usesLiveTileViews()) {
      return DIRTY_TILE_VIEW_LIMIT;
    }

    if (this.shouldThrottleBatchRedraw()) {
      return this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH ? COMPACT_PRESSURE_DIRTY_TILE_VIEW_LIMIT : PRESSURE_DIRTY_TILE_VIEW_LIMIT;
    }

    if (this.fieldTileCount >= 600) {
      return DIRTY_TILE_VIEW_LIMIT;
    }

    if (this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH) {
      return COMPACT_LARGE_FIELD_DIRTY_TILE_VIEW_LIMIT;
    }

    return LARGE_FIELD_DIRTY_TILE_VIEW_LIMIT;
  }

  private shouldThrottleBatchRedraw(): boolean {
    return (
      !this.usesLiveTileViews() &&
      (this.effectQuality <= 0.58 ||
        this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH ||
        this.children.list.length >= DISPLAY_OBJECT_PRESSURE_LIMIT ||
        this.frameSpikeCount > 0)
    );
  }

  private getCommonRedrawTileBudget(): number {
    return this.shouldThrottleBatchRedraw() ? PRESSURE_COMMON_REDRAW_TILE_BUDGET : COMMON_REDRAW_TILE_BUDGET;
  }

  private getCommonRedrawFrameBudgetMs(): number {
    return this.shouldThrottleBatchRedraw() ? PRESSURE_COMMON_REDRAW_FRAME_BUDGET_MS : COMMON_REDRAW_FRAME_BUDGET_MS;
  }

  private getMinimumBoardScale(): number {
    if (this.fieldTileCount <= LIVE_TILE_VIEW_FIELD_LIMIT) {
      return 0;
    }

    if (this.scale.width < COMPACT_LARGE_FIELD_MAX_WIDTH) {
      return COMPACT_LARGE_FIELD_MIN_BOARD_SCALE;
    }

    if (this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH) {
      return TABLET_LARGE_FIELD_MIN_BOARD_SCALE;
    }

    return 0;
  }

  private getTileCullMargin(): number {
    if (this.fieldTileCount <= LIVE_TILE_VIEW_FIELD_LIMIT) {
      return TILE_CULL_MARGIN_PX;
    }

    if (this.scale.width < COMPACT_LARGE_FIELD_MAX_WIDTH) {
      return COMPACT_LARGE_FIELD_CULL_MARGIN_PX;
    }

    if (this.scale.width < TABLET_LARGE_FIELD_MAX_WIDTH) {
      return TABLET_LARGE_FIELD_CULL_MARGIN_PX;
    }

    return TILE_CULL_MARGIN_PX;
  }

  private drawCommonTile(tile: FieldTile, x: number, y: number): void {
    if (!this.commonTileLayer) {
      return;
    }

    const baseTexture = tile.grassState === "grown" ? "tile-dirt" : "tile-stubble";
    const stampConfig = { scale: this.boardScale, originX: 0.5, originY: 0.5 };
    this.commonTileLayer.stamp(baseTexture, undefined, x, y, stampConfig);
    this.commonStampOpsSinceLastPerf += 1;

    if (tile.grassState === "grown") {
      this.commonTileLayer.stamp(this.getGrassTextureKey(tile), undefined, x, y, {
        scale: this.boardScale * this.getGrassScale(tile),
        originX: 0.5,
        originY: 0.5,
      });
      this.commonStampOpsSinceLastPerf += 1;
      const hazard = getTileHazard(this.state, this.getTileKey(tile));
      if (hazard) {
        this.commonTileLayer.stamp(this.getHazardTextureKey(hazard.id), undefined, x, y - 2 * this.boardScale, {
          scale: this.boardScale * 0.96,
          originX: 0.5,
          originY: 0.5,
        });
        this.commonStampOpsSinceLastPerf += 1;
      }
    }
  }

  private positionTileView(tile: FieldTile, view: TileView, x?: number, y?: number): void {
    const position = x === undefined || y === undefined ? this.getTileScreenPosition(tile) : { x, y };
    if (!position) {
      return;
    }

    view.base.setPosition(position.x, position.y);
    view.outline.setPosition(position.x, position.y);
    view.grass.setPosition(position.x, position.y);
    view.hazard.setPosition(position.x, position.y - 2 * this.boardScale);
    view.glint.setPosition(position.x + 19 * this.boardScale, position.y - 20 * this.boardScale);
    view.label.setPosition(position.x, position.y);
    view.base.setScale(this.boardScale);
    view.outline.setScale(this.boardScale);
    view.grass.setScale(this.boardScale * this.getGrassScale(tile));
    view.hazard.setScale(this.boardScale * 0.96);
    view.glint.setScale(this.boardScale);
    view.label.setScale(this.boardScale);
  }

  private getTileVisualPosition(tile: FieldTile): { x: number; y: number } | undefined {
    const view = this.tileViews.get(this.getTileKey(tile));
    if (view) {
      return { x: view.label.x, y: view.label.y };
    }

    const position = this.getTileScreenPosition(tile);
    return position && this.isScreenPositionNearViewport(position) ? position : undefined;
  }

  private getTileScreenPosition(tile: FieldTile): { x: number; y: number } | undefined {
    const bounds = this.cachedFieldBounds;
    if (!bounds || this.boardScale <= 0) {
      return undefined;
    }

    const centerX = this.boardBaseCenterX + this.boardPanX;
    const centerY = this.boardBaseCenterY + this.boardPanY;
    const scaledStep = (TILE_SIZE + TILE_GAP) * this.boardScale;
    const startX = centerX - this.boardScaledWidth / 2 + (TILE_SIZE * this.boardScale) / 2;
    const startY = centerY - this.boardScaledHeight / 2 + (TILE_SIZE * this.boardScale) / 2;

    return {
      x: startX + (tile.x - bounds.minX) * scaledStep,
      y: startY + (tile.y - bounds.minY) * scaledStep,
    };
  }

  private isScreenPositionNearViewport(position: { x: number; y: number }, margin = this.getTileCullMargin()): boolean {
    const bounds = this.getBoardViewportBounds(margin);
    return position.x >= bounds.left && position.x <= bounds.right && position.y >= bounds.top && position.y <= bounds.bottom;
  }

  private getBoardViewportBounds(margin = 0): { left: number; right: number; top: number; bottom: number } {
    if (this.boardScaledWidth <= 0 || this.boardScaledHeight <= 0) {
      return {
        left: -margin,
        right: this.scale.width + margin,
        top: -margin,
        bottom: this.scale.height + margin,
      };
    }

    const centerX = this.boardBaseCenterX + this.boardPanX;
    const centerY = this.boardBaseCenterY + this.boardPanY;
    return {
      left: Math.max(-margin, centerX - this.boardScaledWidth / 2 - margin),
      right: Math.min(this.scale.width + margin, centerX + this.boardScaledWidth / 2 + margin),
      top: Math.max(-margin, centerY - this.boardScaledHeight / 2 - margin),
      bottom: Math.min(this.scale.height + margin, centerY + this.boardScaledHeight / 2 + margin),
    };
  }

  private syncWorldObjects(): void {
    const activeObjects = this.getActiveWorldObjects();
    const activeIds = new Set(activeObjects.map((object) => object.id));

    for (const [id, view] of this.worldObjectViews) {
      if (!activeIds.has(id)) {
        if (this.hoveredWorldObjectId === id) {
          this.clearTileInfo();
        }
        view.container.destroy();
        this.worldObjectViews.delete(id);
      }
    }

    for (const object of activeObjects) {
      const existing = this.worldObjectViews.get(object.id);
      if (existing) {
        existing.quantity = object.quantity;
        existing.label.setText(this.getWorldObjectDockLabel(object.id, object.quantity));
        if (this.hoveredWorldObjectId === object.id) {
          this.refreshWorldObjectInfo(object.id);
        }
        continue;
      }

      const container = this.add.container(0, 0).setDepth(36);
      const hit = this.add
        .rectangle(0, -20, 78, 90, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const shadow = this.add.ellipse(0, 4, 42, 14, 0x214c26, 0.22);
      const sprite = this.add.image(0, 0, object.textureKey).setOrigin(0.5, 1);
      const label = this.add
        .text(0, 15, this.getWorldObjectDockLabel(object.id, object.quantity), {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "12px",
          color: "#f7ffe8",
          stroke: "#17491f",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);
      const ambience = this.createWorldObjectAmbience(object.id);

      hit.on("pointerover", () => this.showWorldObjectInfo(object.id));
      hit.on("pointerout", () => this.hideWorldObjectInfo(object.id));
      hit.on("pointerdown", () => {
        this.showWorldObjectInfo(object.id);
        this.beginWorldObjectPlacement(object.id);
      });

      container.add([hit, shadow, ...ambience, sprite, label]);
      this.worldObjectViews.set(object.id, { id: object.id, quantity: object.quantity, container, hit, shadow, sprite, label, ambience });

      this.tweens.add({
        targets: sprite,
        y: -4,
        duration: 1500 + Phaser.Math.Between(0, 420),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private getActiveWorldObjects(): Array<{ id: string; textureKey: string; label: string; quantity: number }> {
    return WORLD_OBJECTS.flatMap((object) => {
      const quantity = this.getWorldObjectQuantity(object.id);

      if (quantity <= 0) {
        return [];
      }

      return [{ id: object.id, textureKey: object.textureKey, label: object.label, quantity }];
    });
  }

  private getWorldObjectDockLabel(id: string, quantity: number): string {
    if (this.selectedPlacementObjectId === id) {
      return "place";
    }

    return quantity > 1 ? `x${quantity}` : "";
  }

  private isWorldObjectOwned(id: string): boolean {
    return this.getWorldObjectQuantity(id) > 0;
  }

  private getWorldObjectQuantity(id: string): number {
    const object = WORLD_OBJECTS.find((candidate) => candidate.id === id);
    if (!object) {
      return 0;
    }

    return object.kind === "automation" ? getAutomationSystemOwned(this.state, id) : getInventoryQuantity(this.state, id);
  }

  private beginWorldObjectPlacement(id: string): void {
    if (!this.isWorldObjectOwned(id)) {
      this.audio.play("blocked");
      return;
    }

    if (this.selectedPlacementObjectId === id) {
      this.selectedPlacementObjectId = undefined;
      this.showMessage(`${this.getWorldObjectLabel(id)} placement canceled.`, 1600);
      this.layoutPlacedWorldObjects();
      this.refreshUi();
      return;
    }

    this.selectedPlacementObjectId = id;
    this.pulseWorldObject(id, 0xffef78);
    this.showMessage(`Select a grass tile to place ${this.getWorldObjectLabel(id)}.`, 2200);
    this.refreshWorldObjectInfo(id);
    this.layoutPlacedWorldObjects();
    this.refreshUi();
  }

  private createWorldObjectAmbience(id: string): Phaser.GameObjects.GameObject[] {
    if (id === "sprinkler") {
      const drop = this.add.image(16, -38, "effect-water-drop").setScale(0.72).setAlpha(0.72);
      const shine = this.add.star(-17, -42, 4, 2, 8, 0xd7fff2, 0.72).setStrokeStyle(1, 0xffffff, 0.8);

      return [drop, shine];
    }

    if (id === "bee_hive") {
      return Array.from({ length: 3 }, () =>
        this.add
          .image(Phaser.Math.Between(-23, 23), Phaser.Math.Between(-43, -20), "effect-bee-pixel")
          .setScale(0.55)
          .setAlpha(0.72),
      );
    }

    if (id === "chicken") {
      const dust = this.add.image(-18, -5, "dust-fleck").setScale(1.35).setAlpha(0.5);

      return [dust];
    }

    if (id === "sheep") {
      const fleck = this.add.image(20, -18, "grass-fleck").setScale(1.25).setAlpha(0.58);

      return [fleck];
    }

    if (id === "field_mouse" || id === "meadow_rabbit") {
      const seed = this.add.image(18, -16, "effect-seed-kernel").setScale(0.68).setAlpha(0.58);

      return [seed];
    }

    if (id === "earthworm") {
      const dirt = this.add.image(18, -5, "dust-fleck").setScale(1.1).setAlpha(0.46);

      return [dirt];
    }

    return [];
  }

  private layoutWorldObjects(): void {
    if (this.worldObjectViews.size === 0) {
      for (const view of this.worldObjectViews.values()) {
        view.container.setVisible(false);
      }
      return;
    }

    const activeObjects = this.getActiveWorldObjects();
    const mobilePortrait = this.isMobilePortrait();
    const dockScale = mobilePortrait ? 0.46 : this.scale.width < 620 ? 0.68 : 0.76;
    const horizontal = mobilePortrait || this.scale.height < 560 || this.scale.width < 620 || activeObjects.length >= 5;
    const spacing = horizontal ? 78 * dockScale : 98 * dockScale;
    const dockX = Phaser.Math.Clamp(48, 34, Math.max(34, this.scale.width - 44));
    const dockTop = Math.max(this.boardTopY + 44, this.milestoneText.y + this.milestoneText.height + 34);
    const maxDockY = this.scale.height - 50 * dockScale;
    const neededHeight = Math.max(0, (activeObjects.length - 1) * spacing);
    const verticalStartY = Phaser.Math.Clamp(dockTop, this.boardTopY + 34, Math.max(this.boardTopY + 34, maxDockY - neededHeight));
    const mobileDockY = Number.isFinite(this.mobileCommandDockTop) ? this.mobileCommandDockTop - 30 : this.scale.height - 112;
    const horizontalY = mobilePortrait
      ? Phaser.Math.Clamp(mobileDockY, this.boardTopY + 42, this.scale.height - 38)
      : Phaser.Math.Clamp(this.scale.height - 54 * dockScale, this.boardTopY + 42, this.scale.height - 38);
    const horizontalStartX = Math.max(42 * dockScale, (this.scale.width - (activeObjects.length - 1) * spacing) / 2);

    activeObjects.forEach((object, index) => {
      const view = this.worldObjectViews.get(object.id);
      if (!view) {
        return;
      }

      const x = horizontal ? horizontalStartX + index * spacing : dockX;
      const y = horizontal ? horizontalY : verticalStartY + index * spacing;
      view.container.setVisible(!this.hasBlockingOverlayOpen());
      view.container.setPosition(x, y);
      view.container.setScale(dockScale);
      view.shadow.setScale(1 + Math.sin(Date.now() * 0.002 + index) * 0.03, 1);
      view.sprite.setDisplaySize(56, 56);
      view.label.setText(
        this.hoveredWorldObjectId === object.id ? this.getWorldObjectLabel(object.id) : this.getWorldObjectDockLabel(object.id, object.quantity),
      );
      view.label.setVisible(view.label.text.length > 0 && (!mobilePortrait || this.selectedPlacementObjectId === object.id));
      view.label.setFontSize(dockScale < 0.7 ? 11 : 12);
    });

    if (this.hoveredWorldObjectId) {
      const view = this.worldObjectViews.get(this.hoveredWorldObjectId);
      if (view?.container.visible) {
        this.positionWorldObjectInfo(this.hoveredWorldObjectId);
      } else {
        this.clearTileInfo();
      }
    }
  }

  private syncPlacedWorldObjects(): void {
    const activeIds = new Set<string>();

    for (const [objectId, placement] of Object.entries(this.state.placedWorldObjects)) {
      const object = WORLD_OBJECTS.find((candidate) => candidate.id === objectId);
      const tile = this.state.field[placement.tileKey];
      if (!object || !tile || !this.isWorldObjectOwned(objectId)) {
        removeWorldObjectPlacement(this.state, objectId);
        continue;
      }

      activeIds.add(objectId);
      if (this.placedWorldObjectViews.has(objectId)) {
        continue;
      }

      const coverage = this.add.graphics().setDepth(35).setVisible(false);
      const container = this.add.container(0, 0).setDepth(36);
      const hit = this.add
        .rectangle(0, -16, 52, 58, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      const aura = this.add.ellipse(0, 8, 46, 24, 0xffef78, 0.16).setStrokeStyle(2, 0xffef78, 0.48);
      const sprite = this.add.image(0, 0, object.textureKey).setOrigin(0.5, 1);
      const label = this.add
        .text(0, 9, object.label, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "11px",
          color: "#f7ffe8",
          stroke: "#06190f",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0);

      hit.on("pointerover", () => this.showWorldObjectInfo(objectId));
      hit.on("pointerout", () => this.hideWorldObjectInfo(objectId));
      hit.on("pointerdown", () => this.beginWorldObjectPlacement(objectId));

      container.add([hit, aura, sprite, label]);
      this.placedWorldObjectViews.set(objectId, { objectId, coverage, container, hit, aura, sprite, label });
    }

    for (const [objectId, view] of this.placedWorldObjectViews) {
      if (!activeIds.has(objectId)) {
        view.coverage.destroy();
        view.container.destroy();
        this.placedWorldObjectViews.delete(objectId);
      }
    }
  }

  private layoutPlacedWorldObjects(): void {
    this.syncPlacedWorldObjects();

    for (const [objectId, view] of this.placedWorldObjectViews) {
      const placement = this.state.placedWorldObjects[objectId];
      const tile = placement ? this.state.field[placement.tileKey] : undefined;
      const position = tile ? this.getTileScreenPosition(tile) : undefined;
      if (!position || this.hasBlockingOverlayOpen()) {
        view.coverage.setVisible(false);
        view.container.setVisible(false);
        continue;
      }

      const margin = 56 * this.boardScale;
      const visible =
        position.x >= -margin &&
        position.x <= this.scale.width + margin &&
        position.y >= -margin &&
        position.y <= this.scale.height + margin;
      view.container.setVisible(visible);
      this.layoutPlacementCoveragePreview(objectId, view, position, visible);
      if (!visible) {
        continue;
      }

      const scale = Phaser.Math.Clamp(this.boardScale * 0.82, 0.34, 1.05);
      view.container.setPosition(position.x, position.y - 5 * this.boardScale);
      view.container.setScale(scale);
      view.sprite.setDisplaySize(38, 38);
      view.label.setVisible(objectId === this.hoveredWorldObjectId || objectId === this.selectedPlacementObjectId);
      view.aura.setScale(1 + Math.sin(Date.now() * 0.003) * 0.04, 1);
    }
  }

  private layoutPlacementCoveragePreview(
    objectId: string,
    view: PlacedWorldObjectView,
    position: { x: number; y: number },
    objectVisible: boolean,
  ): void {
    if (objectId !== "sprinkler" || !objectVisible || !this.shouldShowSprinklerCoveragePreview()) {
      view.coverage.setVisible(false);
      return;
    }

    const radius = this.state.seedShopPurchases.sprinkler_network ? 2 : 1;
    const tileSize = TILE_SIZE * this.boardScale;
    const tileStep = (TILE_SIZE + TILE_GAP) * this.boardScale;
    const coverageSize = tileSize + radius * 2 * tileStep + 12 * this.boardScale;
    const boundsX = position.x - coverageSize / 2;
    const boundsY = position.y - coverageSize / 2;
    const layoutKey = `${radius}:${this.boardScale.toFixed(4)}:${position.x.toFixed(2)}:${position.y.toFixed(2)}`;

    if (view.coverageLayoutKey === layoutKey) {
      view.coverage.setVisible(true);
      return;
    }

    view.coverageLayoutKey = layoutKey;

    view.coverage.clear();
    view.coverage.fillStyle(0x061b24, 0.28);
    view.coverage.fillRect(boundsX, boundsY, coverageSize, coverageSize);
    view.coverage.lineStyle(Math.max(2, 4 * this.boardScale), 0x8ff8ff, 0.96);
    view.coverage.strokeRect(boundsX, boundsY, coverageSize, coverageSize);
    view.coverage.lineStyle(Math.max(1, 2 * this.boardScale), 0xe6ffb8, 0.58);

    for (let tileY = -radius; tileY <= radius; tileY += 1) {
      for (let tileX = -radius; tileX <= radius; tileX += 1) {
        view.coverage.strokeRect(
          position.x + tileX * tileStep - tileSize / 2,
          position.y + tileY * tileStep - tileSize / 2,
          tileSize,
          tileSize,
        );
      }
    }

    view.coverage.setVisible(true);
  }

  private shouldShowSprinklerCoveragePreview(): boolean {
    return this.selectedPlacementObjectId === "sprinkler" || this.hoveredWorldObjectId === "sprinkler";
  }

  private playPlacementFeedback(tile: FieldTile, objectId: string): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const color = objectId === "bee_hive" ? 0xffef78 : objectId === "sprinkler" ? 0xbff4ff : 0xdfffc8;
    const ring = this.add
      .ellipse(position.x, position.y, 74 * this.boardScale, 48 * this.boardScale, color, 0.18)
      .setStrokeStyle(Math.max(2, 3 * this.boardScale), color, 0.82)
      .setDepth(38);

    this.tweens.add({
      targets: ring,
      scaleX: 1.55,
      scaleY: 1.32,
      alpha: 0,
      duration: 480,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private getWorldObjectOrigin(id: string): { x: number; y: number } | undefined {
    const view = this.worldObjectViews.get(id);
    if (!view || !view.container.visible) {
      return undefined;
    }

    return {
      x: view.container.x,
      y: view.container.y - 28 * view.container.scaleY,
    };
  }

  private pulseWorldObject(id: string, color: number): void {
    if (!this.reserveAmbientTransientObject(2)) {
      return;
    }

    const view = this.worldObjectViews.get(id);
    if (!view || !view.container.visible) {
      return;
    }

    const origin = this.getWorldObjectOrigin(id);
    if (!origin) {
      return;
    }

    const pulse = this.add
      .ellipse(origin.x, origin.y + 12 * view.container.scaleY, 58 * view.container.scaleX, 34 * view.container.scaleY, color, 0.16)
      .setStrokeStyle(3, color, 0.72)
      .setDepth(37);
    const flash = this.add
      .star(origin.x, origin.y - 2 * view.container.scaleY, 5, 4 * view.container.scaleX, 18 * view.container.scaleY, color, 0.68)
      .setStrokeStyle(2, 0xffffff, 0.82)
      .setDepth(38);

    view.sprite.setAlpha(0.78);
    this.time.delayedCall(130, () => view.sprite.setAlpha(1));

    this.tweens.add({
      targets: pulse,
      scaleX: 1.55,
      scaleY: 1.35,
      alpha: 0,
      duration: 360,
      ease: "Sine.easeOut",
      onComplete: () => pulse.destroy(),
    });

    this.tweens.add({
      targets: flash,
      angle: 36,
      scaleX: 1.32,
      scaleY: 1.32,
      alpha: 0,
      duration: 320,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private spawnWorldActionArc(
    texture: string,
    sourceId: string,
    targetX: number,
    targetY: number,
    count: number,
    color: number,
  ): void {
    const spriteCount = this.getBudgetedWorldActionArcSpriteCount(count);
    if (spriteCount <= 0) {
      return;
    }

    const origin = this.getWorldObjectOrigin(sourceId);
    if (!origin) {
      return;
    }

    this.pulseWorldObject(sourceId, color);

    for (let index = 0; index < spriteCount; index += 1) {
      this.time.delayedCall(index * 55, () => {
        this.spawnActionArcSprite(texture, origin.x, origin.y, targetX, targetY, index);
      });
    }
  }

  private spawnActionArcSprite(texture: string, startX: number, startY: number, targetX: number, targetY: number, index: number): void {
    const start = new Phaser.Math.Vector2(startX + Phaser.Math.Between(-5, 5), startY + Phaser.Math.Between(-4, 4));
    const end = new Phaser.Math.Vector2(targetX + Phaser.Math.Between(-10, 10), targetY + Phaser.Math.Between(-8, 8));
    const control = new Phaser.Math.Vector2(
      (start.x + end.x) / 2 + Phaser.Math.Between(-42, 42),
      Math.min(start.y, end.y) - Phaser.Math.Between(34, 78),
    );
    const curve = new Phaser.Curves.QuadraticBezier(start, control, end);
    const progress = { value: 0 };
    const sprite = this.add
      .image(start.x, start.y, texture)
      .setDepth(83)
      .setScale(Math.max(1.25, this.boardScale * 1.85))
      .setAlpha(0.92);
    const baseScale = sprite.scaleX;

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 520 + index * 32,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const point = curve.getPoint(progress.value);
        sprite.setPosition(point.x, point.y);
        sprite.setAngle(220 * progress.value * (index % 2 === 0 ? 1 : -1));
        sprite.setScale(baseScale * (1 - progress.value * 0.22));
        sprite.setAlpha(Phaser.Math.Linear(0.92, 0.55, progress.value));
      },
      onComplete: () => sprite.destroy(),
    });
  }

  private clampBoardPan(): void {
    const maxPanX = Math.max(72, (this.boardScaledWidth - this.boardAvailableWidth) / 2 + 72);
    const maxPanY = Math.max(72, (this.boardScaledHeight - this.boardAvailableHeight) / 2 + 72);
    const headerSafety = Math.max(0, this.boardTopY - this.boardBaseCenterY + 42);
    this.boardPanX = Phaser.Math.Clamp(this.boardPanX, -maxPanX, maxPanX);
    this.boardPanY = Phaser.Math.Clamp(this.boardPanY, headerSafety - maxPanY, maxPanY);
  }

  private handleBoardHover(pointer: Phaser.Input.Pointer): void {
    if (this.hasTouchScreen() || this.hasBlockingOverlayOpen() || this.isPanningBoard) {
      this.hideHoverMarker();
      return;
    }

    if (!pointer.noButtonDown()) {
      return;
    }

    const now = Date.now();
    const dx = pointer.x - this.lastHoverPointerX;
    const dy = pointer.y - this.lastHoverPointerY;
    if (now < this.nextHoverRefreshAt && dx * dx + dy * dy < HOVER_MOVE_THRESHOLD_SQ) {
      return;
    }

    this.lastHoverPointerX = pointer.x;
    this.lastHoverPointerY = pointer.y;
    this.nextHoverRefreshAt = now + HOVER_REFRESH_INTERVAL_MS;

    const key = this.getBoardTileKeyAtPointer(pointer);
    if (!key) {
      if (this.hoveredTileKey) {
        this.clearTileInfo();
      }
      return;
    }

    if (key === this.hoveredTileKey) {
      return;
    }

    const tile = this.state.field[key];
    if (!tile) {
      return;
    }

    this.showTileInfo(tile);
    this.refreshHoverMarker();
  }

  private refreshHoverMarker(): void {
    if (!this.hoverMarker) {
      return;
    }

    const tile = this.hoveredTileKey ? this.state.field[this.hoveredTileKey] : undefined;
    if (!tile || this.hasBlockingOverlayOpen()) {
      this.hideHoverMarker();
      return;
    }

    const position = this.getTileScreenPosition(tile);
    if (!position || !this.isScreenPositionNearViewport(position, 8)) {
      this.hideHoverMarker();
      return;
    }

    const size = Math.max(8, (TILE_SIZE + 8) * this.boardScale);
    this.hoverMarker
      .setPosition(position.x, position.y)
      .setSize(size, size)
      .setStrokeStyle(Math.max(2, 4 * this.boardScale), 0xf4ff8a, 0.82)
      .setVisible(true);

  }

  private hideHoverMarker(): void {
    this.hoverMarker?.setVisible(false);
  }

  private startPersistentTouch(pointer: Phaser.Input.Pointer, tileKey: TileKey): void {
    if (!this.canUsePersistentTouch(pointer)) {
      return;
    }

    this.persistentTouchPointer = pointer;
    this.persistentTouchActive = true;
    this.persistentTouchLastTileKey = tileKey;
    this.persistentTouchNextAt = Date.now() + this.getPersistentTouchIntervalMs();
  }

  private stopPersistentTouch(): void {
    if (!this.persistentTouchActive) {
      return;
    }

    this.persistentTouchPointer = undefined;
    this.persistentTouchActive = false;
    this.persistentTouchNextAt = 0;
    this.persistentTouchLastTileKey = undefined;
  }

  private handlePersistentTouchPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.persistentTouchActive || pointer !== this.persistentTouchPointer || !this.canUsePersistentTouch(pointer)) {
      return;
    }

    const now = Date.now();
    if (now + PERSISTENT_TOUCH_DRAG_GRACE_MS >= this.persistentTouchNextAt) {
      return;
    }

    const key = this.getBoardTileKeyAtPointer(pointer);
    if (!key || key === this.persistentTouchLastTileKey) {
      return;
    }

    this.persistentTouchNextAt = now + PERSISTENT_TOUCH_DRAG_GRACE_MS;
  }

  private updatePersistentTouch(now: number): void {
    if (!this.persistentTouchActive) {
      return;
    }

    const pointer = this.persistentTouchPointer;
    if (
      !pointer ||
      !this.canUsePersistentTouch(pointer) ||
      this.hasBlockingOverlayOpen() ||
      this.selectedPlacementObjectId ||
      this.isPanningBoard
    ) {
      this.stopPersistentTouch();
      return;
    }

    if (now < this.persistentTouchNextAt) {
      return;
    }

    if (this.isBoardLayoutBusy() || this.children.list.length >= DISPLAY_OBJECT_CRITICAL_LIMIT) {
      this.persistentTouchNextAt = now + PERSISTENT_TOUCH_MISS_INTERVAL_MS;
      return;
    }

    const key = this.getBoardTileKeyAtPointer(pointer);
    if (!key) {
      this.persistentTouchLastTileKey = undefined;
      this.persistentTouchNextAt = now + PERSISTENT_TOUCH_MISS_INTERVAL_MS;
      return;
    }

    const tile = this.state.field[key];
    if (!tile) {
      this.persistentTouchLastTileKey = undefined;
      this.persistentTouchNextAt = now + PERSISTENT_TOUCH_MISS_INTERVAL_MS;
      return;
    }

    this.persistentTouchLastTileKey = key;
    if (tile.grassState !== "grown") {
      this.persistentTouchNextAt = now + PERSISTENT_TOUCH_BLOCKED_INTERVAL_MS;
      return;
    }

    this.handleTileClicked(tile);
    if (this.persistentTouchActive) {
      this.persistentTouchNextAt = now + this.getPersistentTouchIntervalMs();
    }
  }

  private canUsePersistentTouch(pointer: Phaser.Input.Pointer): boolean {
    return this.getUpgradeLevel("persistent_touch") > 0 && this.shouldTouchBoardOnPointerDown(pointer);
  }

  private getPersistentTouchIntervalMs(): number {
    const level = Math.max(1, this.getUpgradeLevel("persistent_touch"));
    const prickPenalty = getPrickedRemainingMs(this.state) > 0 ? 55 : 0;
    return Math.max(PERSISTENT_TOUCH_MIN_INTERVAL_MS, PERSISTENT_TOUCH_BASE_INTERVAL_MS - (level - 1) * PERSISTENT_TOUCH_INTERVAL_STEP_MS) + prickPenalty;
  }

  private shouldTouchBoardOnPointerDown(pointer: Phaser.Input.Pointer): boolean {
    const event = pointer.event as PointerEvent | MouseEvent | undefined;
    const pointerType = event && "pointerType" in event ? event.pointerType : "";
    const isMouse = pointerType === "mouse" || (pointerType === "" && !this.hasTouchScreen());
    return isMouse && pointer.leftButtonDown();
  }

  private getBoardTileKeyAtPointer(pointer: Phaser.Input.Pointer): TileKey | undefined {
    const bounds = this.cachedFieldBounds;
    if (!bounds || this.boardScale <= 0) {
      return undefined;
    }

    const centerX = this.boardBaseCenterX + this.boardPanX;
    const centerY = this.boardBaseCenterY + this.boardPanY;
    const scaledStep = (TILE_SIZE + TILE_GAP) * this.boardScale;
    const startX = centerX - this.boardScaledWidth / 2 + (TILE_SIZE * this.boardScale) / 2;
    const startY = centerY - this.boardScaledHeight / 2 + (TILE_SIZE * this.boardScale) / 2;
    const gridX = Math.round((pointer.x - startX) / scaledStep + bounds.minX);
    const gridY = Math.round((pointer.y - startY) / scaledStep + bounds.minY);

    if (gridX < bounds.minX || gridX > bounds.maxX || gridY < bounds.minY || gridY > bounds.maxY) {
      return undefined;
    }

    const tileCenterX = startX + (gridX - bounds.minX) * scaledStep;
    const tileCenterY = startY + (gridY - bounds.minY) * scaledStep;
    const halfStep = scaledStep / 2;
    if (Math.abs(pointer.x - tileCenterX) > halfStep || Math.abs(pointer.y - tileCenterY) > halfStep) {
      return undefined;
    }

    const key = tileKey(gridX, gridY);
    return this.state.field[key] ? key : undefined;
  }

  private showTileInfo(tile: FieldTile): void {
    if (this.hasTouchScreen()) {
      this.clearTileInfo();
      return;
    }

    this.hoveredTileKey = this.getTileKey(tile);
    this.hoveredWorldObjectId = undefined;
    this.tileInfoPanel.setVisible(false);
  }

  private hideTileInfo(tile: FieldTile): void {
    const key = this.getTileKey(tile);
    if (this.hoveredTileKey === key) {
      this.hoveredTileKey = undefined;
      this.tileInfoPanel.setVisible(false);
      this.hideHoverMarker();
      this.releaseBatchTileViewIfIdle(key);
    }
  }

  private clearTileInfo(): void {
    const previousHoveredTileKey = this.hoveredTileKey;
    this.hoveredTileKey = undefined;
    this.hoveredWorldObjectId = undefined;
    this.tileInfoPanel.setVisible(false);
    this.hideHoverMarker();
    if (previousHoveredTileKey) {
      this.releaseBatchTileViewIfIdle(previousHoveredTileKey);
    }
  }

  private showWorldObjectInfo(id: string): void {
    const previousHoveredTileKey = this.hoveredTileKey;
    this.hoveredTileKey = undefined;
    this.hoveredWorldObjectId = id;
    this.hideHoverMarker();
    if (previousHoveredTileKey) {
      this.releaseBatchTileViewIfIdle(previousHoveredTileKey);
    }
    this.refreshWorldObjectInfo(id);
    this.positionWorldObjectInfo(id);
    this.tileInfoPanel.setVisible(true);
    this.layoutPlacedWorldObjects();
    this.layoutWorldObjects();
  }

  private hideWorldObjectInfo(id: string): void {
    if (this.hoveredWorldObjectId === id && !this.hasTouchScreen()) {
      this.hoveredWorldObjectId = undefined;
      this.tileInfoPanel.setVisible(false);
      this.layoutPlacedWorldObjects();
      this.layoutWorldObjects();
    }
  }

  private refreshTileInfo(tile: FieldTile): void {
    const tier = getGrassTier(tile.tier);
    const isGrown = tile.grassState === "grown";
    const traitValue = tile.trait === "lush" ? 2 : tile.trait === "dewy" ? 1 : 0;
    const traitLine = tile.trait === "normal" ? "Trait: normal" : `Trait: ${tile.trait} (+${traitValue})`;
    const tierLine = `Value: ${tier.touchValue}${traitValue > 0 ? ` + ${traitValue}` : ""} before upgrades`;
    const critLine = tile.trait === "lush" ? "Better crit and seed odds" : tile.trait === "dewy" ? "Slightly better crit and seed odds" : "";
    const placementLine = this.getTilePlacementInfo(tile);
    const hazard = getTileHazard(this.state, this.getTileKey(tile));
    const hazardLine = hazard ? this.getHazardInfoLine(hazard) : "";

    this.setTextIfChanged(this.tileInfoTitle, isGrown ? tier.name : "Regrowing Patch");
    this.setTextIfChanged(
      this.tileInfoBody,
      isGrown
        ? [hazardLine, tierLine, traitLine, critLine, placementLine].filter(Boolean).join("\n")
        : ["This patch is growing back.", placementLine].filter(Boolean).join("\n"),
    );
  }

  private refreshWorldObjectInfo(id: string): void {
    const quantity = this.getWorldObjectQuantity(id);
    const storeItem = GOLD_STORE_ITEMS.find((item) => item.id === id);
    const seedItem = SEED_SHOP_ITEMS.find((item) => item.id === id);
    const title = this.getWorldObjectLabel(id) ?? storeItem?.name ?? seedItem?.name ?? id;
    const summary = this.getWorldObjectSummary(id);
    const countLine = quantity > 1 ? `Owned: ${quantity}` : quantity === 1 ? "Owned: 1" : "";
    const placement = this.state.placedWorldObjects[id];
    const placementLine = placement ? `Placed at ${placement.tileKey}. Click to move.` : "Click to place on the field.";

    this.setTextIfChanged(this.tileInfoTitle, title);
    this.setTextIfChanged(this.tileInfoBody, [summary, countLine, placementLine].filter(Boolean).join("\n"));
  }

  private getTilePlacementInfo(tile: FieldTile): string {
    const key = this.getTileKey(tile);
    const placedObjectId = getPlacedObjectAt(this.state, key);
    const nearbyLabels = this.getNearbyActivePlacedObjectIds(tile)
      .filter((objectId) => objectId !== placedObjectId)
      .map((objectId) => this.getWorldObjectLabel(objectId));

    if (!placedObjectId && nearbyLabels.length === 0) {
      return "";
    }

    const here = placedObjectId ? `Placed: ${this.getWorldObjectLabel(placedObjectId)}` : "";
    const nearby = nearbyLabels.length > 0 ? `Nearby: ${nearbyLabels.join(", ")}` : "";
    return [here, nearby].filter(Boolean).join("\n");
  }

  private getWorldObjectSummary(id: string): string {
    switch (id) {
      case "sprinkler":
        return "Waters grown grass near its placed tile so the field keeps moving.";
      case "bee_hive":
        return "Pollinates nearby clusters into better grass from its placed tile.";
      case "chicken":
        return "Scratches up gold or improves a random patch.";
      case "sheep":
        return "Grazes grown grass and turns touches into gold.";
      case "field_mouse":
        return "Scurries through nearby grown grass and sometimes finds gold.";
      case "meadow_rabbit":
        return "Hops through nearby grown grass and sometimes finds seeds.";
      case "earthworm":
        return "Burrows through resting patches to speed regrowth.";
      default:
        return GOLD_STORE_ITEMS.find((item) => item.id === id)?.description ?? "A helpful field friend.";
    }
  }

  private getWorldObjectLabel(id: string): string {
    return WORLD_OBJECTS.find((object) => object.id === id)?.label ?? id;
  }

  private positionTileInfo(tile: FieldTile): void {
    const view = this.tileViews.get(this.getTileKey(tile));
    const position = view ? { x: view.base.x, y: view.base.y } : this.getTileScreenPosition(tile);
    if (!position) {
      return;
    }

    const panelWidth = 260;
    const panelHeight = 128;
    const x = Phaser.Math.Clamp(position.x + 28 * this.boardScale, 12, this.scale.width - panelWidth - 12);
    const y = Phaser.Math.Clamp(position.y - panelHeight - 20 * this.boardScale, 12, this.scale.height - panelHeight - 12);

    this.tileInfoPanel.setPosition(x, y);
  }

  private positionWorldObjectInfo(id: string): void {
    const placedView = this.placedWorldObjectViews.get(id);
    const dockView = this.worldObjectViews.get(id);
    const target = placedView?.container.visible ? placedView.container : dockView?.container;
    if (!target) {
      return;
    }

    const panelWidth = 260;
    const panelHeight = 128;
    const x = Phaser.Math.Clamp(target.x + 36 * target.scaleX, 12, this.scale.width - panelWidth - 12);
    const y = Phaser.Math.Clamp(target.y - panelHeight - 62 * target.scaleY, 12, this.scale.height - panelHeight - 12);

    this.tileInfoPanel.setPosition(x, y);
  }

  private handleTileClicked(tile: FieldTile): void {
    const perfStart = this.shouldProfile() ? performance.now() : undefined;
    try {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    if (this.selectedPlacementObjectId) {
      this.placeSelectedWorldObject(tile);
      return;
    }

    this.profileScope("touch:createView", () => this.createTileView(tile));

    if (this.hasTouchScreen()) {
      this.clearTileInfo();
    }

    if (this.handleHazardTileClicked(tile)) {
      return;
    }

    const now = Date.now();
    const stats = this.profileScope("touch:stats", () => this.getCachedRuntimeStats(now));
    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    this.addJournalValue(this.state.journal.discoveredGrassTiers, touchedTier.id);
    this.addJournalValue(this.state.journal.discoveredTileTraits, touchedTrait);
    const touch = this.profileScope("touch:tile", () => touchTile(tile, this.state, stats, now));

    if (touch.gained === 0) {
      this.popAtTile(tile, "regrowing", "#fff2b2");
      this.playBlockedTileFeedback(tile);
      this.audio.play("blocked");
      return;
    }

    const combo = this.profileScope("touch:combo", () => this.recordComboTouch(tile, touch, stats, now, "manual"));
    const perfectTouchBonus = this.consumePerfectTouchBonus(tile, touch.gained, now);
    if (perfectTouchBonus > 0) {
      this.state.grassTouches = addGrassTouches(this.state.grassTouches, perfectTouchBonus);
      this.state.lifetimeGrassTouches = addGrassTouches(this.state.lifetimeGrassTouches, perfectTouchBonus);
    }
    const perfectGoldBonus = perfectTouchBonus > 0 ? this.rollPerfectTouchGoldBonus(touch.gained) : 0;
    if (perfectGoldBonus > 0) {
      this.state.gold += perfectGoldBonus;
      this.state.lifetimeGold += perfectGoldBonus;
    }
    const placementSynergy = this.profileScope("touch:placementCalc", () => this.getPlacementSynergy(tile));
    if (placementSynergy.bonusTouches > 0) {
      this.state.grassTouches = addGrassTouches(this.state.grassTouches, placementSynergy.bonusTouches);
      this.state.lifetimeGrassTouches = addGrassTouches(this.state.lifetimeGrassTouches, placementSynergy.bonusTouches);
    }

    this.profileScope("touch:visuals", () => {
      this.playTouchFeedback(tile, touchedTrait, touch.isCrit);
      this.refreshTile(tile);
      this.popAtTile(tile, this.getTouchPopText(touch), touch.isCrit ? "#ffef78" : touchedTier.id === "normal" ? "#f9ffe5" : "#dfffc8");
      this.applyPlacementSynergyFeedback(tile, placementSynergy, now);
      this.applyWateringCanSplash(tile, now, combo.count);
      if (perfectTouchBonus > 0) {
        this.playPerfectTouchFeedback(tile, perfectTouchBonus);
        if (perfectGoldBonus > 0) {
          this.popAtTile(tile, `golden +${perfectGoldBonus}`, "#ffef78");
          this.emitGoldBurst(tile, perfectGoldBonus);
          this.audio.play("gold");
        }
      }
      this.playComboFeedback(tile, combo);
      this.playClassTouchFeedback(tile, touch, combo);
      if (touch.instantRegrown) {
        this.popAtTile(tile, "instant regrow", "#dfffc8");
      }
    });
    this.profileScope("touch:drops", () => {
      this.drops.tryDropSeed(this.state, tile, touchedTrait, stats, this.getDropFeedback(), placementSynergy.seedChanceScale);
      this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier.id, touch, stats, this.getDropFeedback(), placementSynergy.goldChanceScale);
      this.applyGrassTierIdentityBonus(tile, touchedTier.id, touch, stats, now);
    });
    this.profileScope("touch:audioShake", () => {
      this.shakeForGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
      this.playMixedGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, combo.count);
    });
    this.profileScope("touch:aoe", () => this.tryComboAoeTouch(tile, stats, combo.count, now));
    this.queueSave();
    } finally {
      if (perfStart !== undefined) {
        this.recordPerfScope("touch", performance.now() - perfStart);
      }
    }
  }

  private handleHazardTileClicked(tile: FieldTile): boolean {
    const key = this.getTileKey(tile);
    if (!getTileHazard(this.state, key)) {
      return false;
    }

    const now = Date.now();
    const result = this.hazards.touchHazard(this.state, key, now);
    if (!result) {
      return false;
    }

    if (result.stopPersistent) {
      this.stopPersistentTouch();
    }
    this.invalidateRuntimeStats();
    this.refreshTile(tile);
    if (result.hazardId === "cactus") {
      this.state.hazardStats.cactusCleared += 1;
      this.state.hazardStats.prickedCount += 1;
      this.addJournalValue(this.state.journal.seenHazardIds, "cactus");
      this.addJournalValue(this.state.journal.seenHazardIds, "pricked");
      this.playCactusPrickFeedback(tile);
    } else {
      this.state.hazardStats.weedsPulled += 1;
      this.addJournalValue(this.state.journal.seenHazardIds, "weeds");
      if (result.cleared) {
        this.state.hazardStats.weedsCleared += 1;
      }
      this.playWeedPullFeedback(tile, result.cleared);
    }
    this.popAtTile(tile, result.popText, result.color);
    if (result.seedReward > 0) {
      this.state.seeds += result.seedReward;
      this.state.lifetimeSeeds += result.seedReward;
      this.popAtTile(tile, `+${result.seedReward} seed`, "#fff1a8");
      this.emitSeedBurst(tile);
    }
    this.audio.play(result.sound);
    this.refreshUi(false);
    this.queueSave();
    return true;
  }

  private recordComboTouch(tile: FieldTile, touch: TouchResult, stats: RuntimeStats, now: number, source: ComboTouchSource): ComboResult {
    const automated = source !== "manual";
    const combo = this.combo.recordTouch(now, touch.gained, {
      windowMs: automated ? AUTOMATION_COMBO_WINDOW_MS * stats.comboWindowMultiplier : this.combo.getBaseWindowMs() * stats.comboWindowMultiplier,
      bonusMultiplier: stats.comboBonusMultiplier * (automated ? AUTOMATION_COMBO_BONUS_SCALE : 1),
    });

    this.activeComboSource = source;
    this.lastMusicComboLevel = combo.count;
    this.music.setComboLevel(combo.count);
    if (combo.count > this.state.journal.bestComboCount) {
      this.state.journal.bestComboCount = combo.count;
    }
    if (automated && combo.count > this.state.automationStats.bestAutomationComboCount) {
      this.state.automationStats.bestAutomationComboCount = combo.count;
    }
    if (combo.bonusTouches > 0) {
      this.state.grassTouches = addGrassTouches(this.state.grassTouches, combo.bonusTouches);
      this.state.lifetimeGrassTouches = addGrassTouches(this.state.lifetimeGrassTouches, combo.bonusTouches);
    }
    if (automated) {
      this.playAutomationComboFlair(tile, combo, source);
    }

    return combo;
  }

  private recordAutomationComboTouch(tile: FieldTile, touch: TouchResult, stats: RuntimeStats, source: Exclude<ComboTouchSource, "manual">): number {
    const combo = this.recordComboTouch(tile, touch, stats, Date.now(), source);
    this.playComboFeedback(tile, combo, source);
    return combo.count;
  }

  private recordAutomationComboAction(tile: FieldTile, stats: RuntimeStats, source: Exclude<ComboTouchSource, "manual">): number {
    const combo = this.recordComboTouch(
      tile,
      { gained: 0, isCrit: false, critMultiplier: 1, doubled: false, instantRegrown: false },
      stats,
      Date.now(),
      source,
    );
    this.playComboFeedback(tile, combo, source);
    return combo.count;
  }

  private placeSelectedWorldObject(tile: FieldTile): void {
    const objectId = this.selectedPlacementObjectId;
    if (!objectId) {
      return;
    }

    const key = this.getTileKey(tile);
    const occupiedBy = getPlacedObjectAt(this.state, key);
    if (occupiedBy && occupiedBy !== objectId) {
      this.popAtTile(tile, `${this.getWorldObjectLabel(occupiedBy)} already here`, "#fff2b2");
      this.audio.play("blocked");
      return;
    }

    if (!placeWorldObject(this.state, objectId, key)) {
      this.popAtTile(tile, "cannot place here", "#fff2b2");
      this.audio.play("blocked");
      return;
    }

    this.selectedPlacementObjectId = undefined;
    this.syncPlacedWorldObjects();
    this.layoutPlacedWorldObjects();
    this.syncWorldObjects();
    this.layoutWorldObjects();
    this.refreshTileInfo(tile);
    this.popAtTile(tile, `${this.getWorldObjectLabel(objectId)} placed`, "#ffef78");
    if (objectId === "sprinkler") {
      this.showMessage("Tiny Sprinkler placed. Its water reaches nearby patches.", 3400);
    }
    this.playPlacementFeedback(tile, objectId);
    this.audio.play("upgrade");
    this.saveState();
    this.refreshUi();
  }

  private getNearbyActivePlacedObjectIds(tile: FieldTile): string[] {
    return getNearbyPlacedObjectIds(this.state, tile, PLACEMENT_RADIUS).filter((objectId) => this.isWorldObjectOwned(objectId));
  }

  private getPlacementSynergy(tile: FieldTile): {
    objectIds: string[];
    seedChanceScale: number;
    goldChanceScale: number;
    regrowFactor: number;
    bonusTouches: number;
  } {
    const objectIds = this.getNearbyActivePlacedObjectIds(tile);
    let seedChanceScale = 1;
    let goldChanceScale = 1;
    let regrowFactor = 1;
    let bonusTouches = 0;

    for (const objectId of objectIds) {
      switch (objectId) {
        case "sprinkler":
          regrowFactor = Math.min(regrowFactor, 0.86);
          break;
        case "bee_hive":
          seedChanceScale += 0.15;
          break;
        case "field_mouse":
          goldChanceScale += 0.12;
          break;
        case "chicken":
          goldChanceScale += 0.08;
          seedChanceScale += 0.05;
          break;
        case "sheep":
          if (Math.random() < 0.35) {
            bonusTouches += 1;
          }
          goldChanceScale += 0.06;
          break;
        case "meadow_rabbit":
          seedChanceScale += 0.1;
          break;
        case "earthworm":
          regrowFactor = Math.min(regrowFactor, 0.88);
          break;
      }
    }

    return {
      objectIds,
      seedChanceScale,
      goldChanceScale,
      regrowFactor,
      bonusTouches,
    };
  }

  private applyPlacementSynergyFeedback(
    tile: FieldTile,
    synergy: { objectIds: string[]; seedChanceScale: number; goldChanceScale: number; regrowFactor: number; bonusTouches: number },
    now: number,
  ): void {
    if (synergy.objectIds.length === 0) {
      return;
    }

    if (synergy.regrowFactor < 1 && tile.grassState === "regrowing") {
      const remainingMs = Math.max(0, tile.regrowEndsAt - now);
      tile.regrowEndsAt = now + Math.max(250, Math.floor(remainingMs * synergy.regrowFactor));
      this.popAtTile(tile, synergy.objectIds.includes("sprinkler") ? "watered" : "loosened soil", "#bff4ff");
    }

    if (synergy.bonusTouches > 0) {
      this.popAtTile(tile, `pasture +${synergy.bonusTouches}`, "#dfffc8");
    }

    if (synergy.seedChanceScale > 1 && Math.random() < 0.12) {
      this.pollinateNeighborFromPlacement(tile);
    }

    for (const objectId of synergy.objectIds) {
      const placement = this.state.placedWorldObjects[objectId];
      const placedTile = placement ? this.state.field[placement.tileKey] : undefined;
      if (placedTile) {
        this.playPlacementPulse(placedTile, objectId);
      }
    }
  }

  private applyWateringCanSplash(originTile: FieldTile, now: number, comboCount: number): void {
    if (!this.state.seedShopPurchases.watering_can) {
      return;
    }

    const nearbyRestingTiles = Phaser.Utils.Array.Shuffle(this.getNeighborTiles(originTile).filter((tile) => tile.grassState === "regrowing"));
    const maxSplashTiles = 1 + (comboCount >= 6 ? 1 : 0) + (comboCount >= 12 ? 1 : 0);
    const candidates = [originTile, ...nearbyRestingTiles].filter((tile) => tile.grassState === "regrowing");
    const wateredTiles: FieldTile[] = [];

    for (const tile of candidates) {
      if (wateredTiles.length >= maxSplashTiles) {
        break;
      }

      const remainingMs = Math.max(0, tile.regrowEndsAt - now);
      if (remainingMs <= WATERING_CAN_MIN_REMAINING_MS) {
        continue;
      }

      const regrowFactor = tile === originTile ? WATERING_CAN_REGROW_FACTOR : WATERING_CAN_SPLASH_REGROW_FACTOR;
      tile.regrowEndsAt = now + Math.max(WATERING_CAN_MIN_REMAINING_MS, Math.floor(remainingMs * regrowFactor));
      this.refreshTile(tile);
      this.playWateringCanSplash(tile, tile === originTile);
      wateredTiles.push(tile);
    }

    if (wateredTiles.length === 0) {
      return;
    }

    this.state.wateredPatches += wateredTiles.length;
    this.popAtTile(originTile, wateredTiles.length > 1 ? `watered x${wateredTiles.length}` : "watered", "#bff4ff");
  }

  private pollinateNeighborFromPlacement(originTile: FieldTile): void {
    const candidates = this.getNeighborTiles(originTile).filter((tile) => tile.grassState === "grown");
    const tile = Phaser.Utils.Array.GetRandom(candidates);
    if (!tile) {
      return;
    }

    tile.trait = tile.trait === "lush" ? "lush" : Math.random() < 0.2 ? "lush" : "dewy";
    this.refreshTile(tile);
    this.popAtTile(tile, "nearby care", "#fff1a8");
  }

  private playPlacementPulse(tile: FieldTile, objectId: string): void {
    const view = this.placedWorldObjectViews.get(objectId);
    if (view?.container.visible) {
      this.tweens.killTweensOf(view.aura);
      view.aura.setAlpha(0.34);
      this.tweens.add({
        targets: view.aura,
        alpha: 0.12,
        duration: 260,
        ease: "Sine.easeOut",
      });
      return;
    }

    const position = this.getTileVisualPosition(tile);
    if (position) {
      this.emitBurst("grass-fleck", position.x, position.y - 8 * this.boardScale, 8, 0.72, 0.08);
    }
  }

  private applyGrassTierIdentityBonus(originTile: FieldTile, tier: GrassTierId, touch: TouchResult, stats: RuntimeStats, now: number): void {
    if (tier === "wildflower") {
      this.tryWildflowerPollinate(originTile);
      return;
    }

    if (tier === "mushroom") {
      this.tryMushroomSpores(originTile, stats, now);
      return;
    }

    if (tier === "crystal") {
      this.tryCrystalGold(originTile, touch);
      return;
    }

    if (tier === "frost" && !touch.instantRegrown) {
      originTile.regrowEndsAt += 700;
      this.popAtTile(originTile, "frost focus", "#d7fff2");
    }
  }

  private tryWildflowerPollinate(originTile: FieldTile): void {
    if (Math.random() >= WILDFLOWER_POLLINATE_CHANCE) {
      return;
    }

    const candidates = Phaser.Utils.Array.Shuffle(this.getNeighborTiles(originTile)).slice(0, 2);
    let changed = 0;
    for (const tile of candidates) {
      if (tile.grassState !== "grown") {
        continue;
      }

      tile.trait = Math.random() < 0.42 ? "lush" : "dewy";
      this.refreshTile(tile);
      this.popAtTile(tile, "pollinated", "#ffb7d5");
      this.emitTierIdentityBurst(tile, "effect-pollen-fleck", 12, 0.58);
      changed += 1;
    }

    if (changed > 0) {
      this.popAtTile(originTile, `flowers +${changed}`, "#ffb7d5");
      this.audio.play("seed");
    }
  }

  private tryMushroomSpores(originTile: FieldTile, stats: RuntimeStats, now: number): void {
    if (Math.random() >= MUSHROOM_SPORE_CHANCE) {
      return;
    }

    let changed = 0;
    for (const tile of Phaser.Utils.Array.Shuffle(this.getNeighborTiles(originTile)).slice(0, 4)) {
      if (tile.grassState === "regrowing") {
        const remainingMs = Math.max(0, tile.regrowEndsAt - now);
        tile.regrowEndsAt = now + Math.max(350, Math.floor(remainingMs * 0.62));
      } else {
        tile.trait = Math.random() < stats.dewChance + 0.22 ? "dewy" : "lush";
      }

      this.refreshTile(tile);
      this.popAtTile(tile, "spores", "#dfffc8");
      changed += 1;
    }

    if (changed > 0) {
      this.emitTierIdentityBurst(originTile, "effect-magic-spore", 24, 0.82);
      this.audio.play("regrow");
    }
  }

  private tryCrystalGold(originTile: FieldTile, touch: TouchResult): void {
    if (!touch.isCrit && Math.random() >= CRYSTAL_GOLD_CHANCE) {
      return;
    }

    const gold = Math.max(1, Math.floor(touch.gained * (touch.isCrit ? 0.025 : 0.012)));
    this.state.gold += gold;
    this.state.lifetimeGold += gold;
    this.popAtTile(originTile, `crystal +${gold} gold`, "#75e8ff");
    this.emitGoldBurst(originTile, gold);
    this.emitTierIdentityBurst(originTile, "crit-fleck", 20, 0.74);
    this.audio.play("gold");
  }

  private getNeighborTiles(originTile: FieldTile): FieldTile[] {
    return COMBO_AOE_NEIGHBORS.map((neighbor) => this.state.field[tileKey(originTile.x + neighbor.x, originTile.y + neighbor.y)]).filter(
      (tile): tile is FieldTile => tile !== undefined,
    );
  }

  private emitTierIdentityBurst(tile: FieldTile, texture: string, count: number, scale: number): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    this.emitBurst(texture, position.x, position.y - 8, count, scale, 0.28);
  }

  private markRecentlyRegrown(tile: FieldTile, now: number): void {
    const key = this.getTileKey(tile);
    this.recentlyRegrownAt.set(key, now);
    this.showPerfectTouchCue(tile, key);
  }

  private pruneRecentlyRegrown(now: number): void {
    for (const [key, regrownAt] of this.recentlyRegrownAt) {
      const perfectTouchWindowMs = this.getPerfectTouchWindowMs(this.state.field[key]);
      if (now - regrownAt > perfectTouchWindowMs) {
        this.recentlyRegrownAt.delete(key);
        this.destroyPerfectTouchCue(key);
      }
    }
  }

  private consumePerfectTouchBonus(tile: FieldTile, baseTouches: number, now: number): number {
    const key = this.getTileKey(tile);
    const regrownAt = this.recentlyRegrownAt.get(key);
    this.recentlyRegrownAt.delete(key);
    this.destroyPerfectTouchCue(key);

    if (regrownAt === undefined || now - regrownAt > this.getPerfectTouchWindowMs(tile)) {
      return 0;
    }

    return Math.max(1, Math.floor(baseTouches * this.getPerfectTouchBonusMultiplier(tile)));
  }

  private rollPerfectTouchGoldBonus(baseTouches: number): number {
    if (!this.isWeatherActive("golden_hour") || Math.random() >= GOLDEN_HOUR_PERFECT_GOLD_CHANCE) {
      return 0;
    }

    return Math.max(1, Math.floor(baseTouches * 0.25));
  }

  private getPerfectTouchWindowMs(tile?: FieldTile): number {
    let windowMs = PERFECT_TOUCH_WINDOW_MS;
    if (this.isWeatherActive("soft_rain")) {
      windowMs = 1150;
    } else if (this.isWeatherActive("dewy_morning")) {
      windowMs = 980;
    } else if (this.isWeatherActive("restless_roots")) {
      windowMs = 620;
    }

    if (tile?.tier === "moss") {
      windowMs += 420;
    }

    if (tile?.tier === "frost") {
      windowMs += 520;
    }

    if (this.state.characterClassId === "femboy_slim") {
      windowMs += this.getUpgradeLevel("perfect_pose") * PERFECT_POSE_WINDOW_BONUS_MS;
    }

    return windowMs;
  }

  private getPerfectTouchBonusMultiplier(tile: FieldTile): number {
    let multiplier = PERFECT_TOUCH_BONUS_MULTIPLIER;

    if (tile.tier === "frost") {
      multiplier = 0.75;
    } else if (tile.tier === "moss") {
      multiplier = 0.6;
    }

    if (this.state.characterClassId === "femboy_slim") {
      multiplier += this.getUpgradeLevel("perfect_pose") * PERFECT_POSE_MULTIPLIER_BONUS;
    }

    return multiplier;
  }

  private showPerfectTouchCue(tile: FieldTile, key: TileKey): void {
    const view = this.tileViews.get(key);
    if (!view || !this.shouldShowPerfectTouchCue()) {
      return;
    }

    this.destroyPerfectTouchCue(key);
    const x = view.label.x;
    const y = view.label.y;
    const ring = this.add
      .ellipse(x, y, TILE_SIZE * 0.94 * this.boardScale, TILE_SIZE * 0.62 * this.boardScale, 0xffef78, 0.2)
      .setStrokeStyle(Math.max(2, 3 * this.boardScale), 0xffef78, 0.96)
      .setDepth(35);
    const cues: Phaser.GameObjects.GameObject[] = [ring];
    if (this.effectQuality >= 0.72 && this.perfectTouchCues.size < Math.ceil(PERFECT_TOUCH_CUE_LIMIT * 0.5)) {
      cues.push(
        this.add
          .star(x, y - 16 * this.boardScale, 5, TILE_SIZE * 0.065 * this.boardScale, TILE_SIZE * 0.28 * this.boardScale, 0xdfffc8, 0.84)
          .setStrokeStyle(2, 0xffffff, 0.9)
          .setDepth(38),
      );
    }

    this.perfectTouchCues.set(key, cues);
    const duration = this.getPerfectTouchWindowMs(tile);

    this.tweens.add({
      targets: ring,
      scaleX: 1.28,
      scaleY: 1.18,
      alpha: 0,
      duration,
      ease: "Sine.easeOut",
      onComplete: () => this.destroyPerfectTouchCue(key),
    });
    const sparkle = cues[1] as Phaser.GameObjects.Star | undefined;
    if (sparkle) {
      this.tweens.add({
        targets: sparkle,
        angle: 45,
        scaleX: 1.25,
        scaleY: 1.25,
        y: sparkle.y - 7 * this.boardScale,
        alpha: 0,
        duration,
        ease: "Sine.easeOut",
      });
    }
  }

  private shouldShowPerfectTouchCue(): boolean {
    if (this.boardScale < PERFECT_TOUCH_CUE_MIN_SCALE || this.children.list.length >= DISPLAY_OBJECT_PRESSURE_LIMIT) {
      return false;
    }

    return this.perfectTouchCues.size < this.getScaledBudget(PERFECT_TOUCH_CUE_LIMIT);
  }

  private destroyPerfectTouchCue(key: TileKey): void {
    const cues = this.perfectTouchCues.get(key);
    if (!cues) {
      return;
    }

    for (const cue of cues) {
      this.tweens.killTweensOf(cue);
      cue.destroy();
    }
    this.perfectTouchCues.delete(key);
    this.releaseBatchTileViewIfIdle(key);
  }

  private destroyAllPerfectTouchCues(): void {
    for (const key of this.perfectTouchCues.keys()) {
      this.destroyPerfectTouchCue(key);
    }
  }

  private tryComboAoeTouch(originTile: FieldTile, stats: RuntimeStats, comboCount: number, now: number): void {
    const chance = this.getComboAoeChance(comboCount);
    if (chance <= 0 || Math.random() >= chance) {
      return;
    }

    let touchedTiles = 0;
    let gainedTouches = 0;
    for (const neighbor of COMBO_AOE_NEIGHBORS) {
      const tile = this.state.field[tileKey(originTile.x + neighbor.x, originTile.y + neighbor.y)];
      if (!tile || tile.grassState !== "grown") {
        continue;
      }

      const touchedTrait = tile.trait;
      const touchedTier = getGrassTier(tile.tier);
      this.addJournalValue(this.state.journal.discoveredGrassTiers, touchedTier.id);
      this.addJournalValue(this.state.journal.discoveredTileTraits, touchedTrait);
      const touch = touchTile(tile, this.state, stats, now);
      if (touch.gained === 0) {
        continue;
      }
      const key = this.getTileKey(tile);
      this.recentlyRegrownAt.delete(key);
      this.destroyPerfectTouchCue(key);

      touchedTiles += 1;
      gainedTouches += touch.gained;
      this.playTouchFeedback(tile, touchedTrait, touch.isCrit);
      this.refreshTile(tile);
      this.popAtTile(tile, this.getTouchPopText(touch), touch.isCrit ? "#ffef78" : "#d7fff2");
      if (touch.instantRegrown) {
        this.popAtTile(tile, "instant regrow", "#dfffc8");
      }
      this.drops.tryDropSeed(this.state, tile, touchedTrait, stats, this.getDropFeedback(), 0.35);
      this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier.id, touch, stats, this.getDropFeedback(), 0.35);
      this.playMixedGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, comboCount);
    }

    if (touchedTiles === 0) {
      return;
    }

    this.popAtTile(originTile, `AOE ${touchedTiles} tiles +${gainedTouches}`, "#bff4ff");
    const view = this.tileViews.get(this.getTileKey(originTile));
    if (view) {
      this.emitBurst("dew-fleck", view.label.x, view.label.y - 6, 36, 1.25, 0.28);
    }
  }

  private getComboAoeChance(comboCount: number): number {
    let chance = 0;
    if (comboCount > COMBO_AOE_HIGH_COUNT) {
      chance = COMBO_AOE_HIGH_CHANCE;
    } else if (comboCount >= COMBO_AOE_MIN_COUNT) {
      chance = COMBO_AOE_CHANCE;
    }

    if (chance > 0 && this.isWeatherActive("lucky_breeze")) {
      chance += 0.08;
    }

    if (chance > 0 && this.state.characterClassId === "bard_de_wever") {
      chance += this.getUpgradeLevel("encore_circle") * ENCORE_CIRCLE_AOE_CHANCE_BONUS;
    }

    return Math.min(0.45, chance);
  }

  private isWeatherActive(weatherId: WeatherId): boolean {
    return Boolean(this.state.seedShopPurchases.weather_jar && this.state.activeWeatherId === weatherId);
  }

  private getDropFeedback(): DropFeedback {
    return {
      createTileView: (tile) => {
        if (this.recordTileDiscovery(tile)) {
          this.queueSave();
        }

        if (this.isAmbientFeedbackActive()) {
          this.refreshTile(tile);
          return;
        }

        this.createTileView(tile);
      },
      layoutTiles: () => {
        if (this.isAmbientFeedbackActive()) {
          this.commonTileLayerDirty = true;
          return;
        }

        this.layoutTiles();
      },
      popAtTile: (tile, text, color) => this.popAtTile(tile, text, color),
      playWildSpread: (originTile, addedTiles) => {
        this.playWildSpreadFeedback(originTile, addedTiles);
        if (addedTiles.length > 0) {
          this.addTriggerFeedEvent("Seeds spread", `+${addedTiles.length} patch${addedTiles.length === 1 ? "" : "es"}`, "SE", 0xb7eba5);
        }
      },
      emitSeedBurst: (tile) => this.emitSeedBurst(tile),
      emitGoldBurst: (tile, amount) => this.emitGoldBurst(tile, amount),
      playSound: (sound) => this.audio.play(sound),
    };
  }

  private emitSeedBurst(tile: FieldTile): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    this.emitBurst("seed-fleck", position.x, position.y - 8, 18, 0.82, 0.32);
    this.spawnRewardArc("effect-seed-kernel", position.x, position.y - 8, "seed");
  }

  private emitGoldBurst(tile: FieldTile, amount = 1): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    this.emitBurst("gold-fleck", position.x, position.y - 10, 14, 0.7, 0.24);
    this.spawnRewardArc("effect-gold-coin", position.x, position.y - 10, "gold", amount);
  }

  private playWildSpreadFeedback(originTile: FieldTile, addedTiles: FieldTile[]): void {
    if (addedTiles.length === 0) {
      return;
    }

    const originPosition = this.getTileVisualPosition(originTile);
    if (originPosition && !this.isAmbientFeedbackActive()) {
      this.emitBurst("seed-fleck", originPosition.x, originPosition.y - 12, 18, 0.82, 0.24);
    }

    addedTiles.forEach((addedTile, index) => {
      this.playTileDropIn(addedTile, index * 90);
      this.time.delayedCall(index * 90 + 90, () => this.playWildSpreadSprout(originTile, addedTile));
    });

    const patchText = addedTiles.length === 1 ? "+1 patch" : `+${addedTiles.length} patches`;
    this.showMessage(`Wild Spread: ${patchText}`, 1800);
  }

  private playWildSpreadSprout(originTile: FieldTile, addedTile: FieldTile): void {
    const originPosition = this.getTileVisualPosition(originTile);
    const targetPosition = this.getTileVisualPosition(addedTile);
    if (!targetPosition) {
      return;
    }

    if (originPosition && this.getBudgetedRewardArcSpriteCount(1) > 0) {
      this.spawnWildSpreadSeedArc(originPosition, targetPosition);
    }

    if (this.reserveAmbientTransientObject(2)) {
      const ring = this.add
        .ellipse(
          targetPosition.x,
          targetPosition.y + 3 * this.boardScale,
          TILE_SIZE * 0.34 * this.boardScale,
          TILE_SIZE * 0.2 * this.boardScale,
          0xdfffc8,
          0.24,
        )
        .setStrokeStyle(Math.max(2, 3 * this.boardScale), 0xfff1a8, 0.85)
        .setDepth(39);
      const sprout = this.add
        .star(
          targetPosition.x,
          targetPosition.y - 15 * this.boardScale,
          5,
          TILE_SIZE * 0.07 * this.boardScale,
          TILE_SIZE * 0.32 * this.boardScale,
          0xdfffc8,
          0.82,
        )
        .setStrokeStyle(2, 0xffffff, 0.86)
        .setDepth(40);

      this.tweens.add({
        targets: ring,
        scaleX: 2,
        scaleY: 1.55,
        alpha: 0,
        duration: 520,
        ease: "Sine.easeOut",
        onComplete: () => ring.destroy(),
      });

      this.tweens.add({
        targets: sprout,
        angle: 35,
        scaleX: 1.45,
        scaleY: 1.45,
        y: sprout.y - 10 * this.boardScale,
        alpha: 0,
        duration: 480,
        ease: "Sine.easeOut",
        onComplete: () => sprout.destroy(),
      });
    }

    this.emitBurst("grass-fleck", targetPosition.x, targetPosition.y - 6, 22, 0.95, 0.24);
    this.emitBurst("seed-fleck", targetPosition.x, targetPosition.y - 14, 10, 0.72, 0.18);
  }

  private spawnWildSpreadSeedArc(start: { x: number; y: number }, end: { x: number; y: number }): void {
    const arcStart = new Phaser.Math.Vector2(start.x, start.y - 12 * this.boardScale);
    const arcEnd = new Phaser.Math.Vector2(end.x, end.y - 12 * this.boardScale);
    const control = new Phaser.Math.Vector2((arcStart.x + arcEnd.x) / 2, Math.min(arcStart.y, arcEnd.y) - 54 * this.boardScale);
    const curve = new Phaser.Curves.QuadraticBezier(arcStart, control, arcEnd);
    const progress = { value: 0 };
    const seed = this.add
      .image(arcStart.x, arcStart.y, "effect-seed-kernel")
      .setDepth(42)
      .setScale(Math.max(1.35, this.boardScale * 1.9))
      .setAlpha(0.95);
    const baseScale = seed.scaleX;

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 520,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const point = curve.getPoint(progress.value);
        seed.setPosition(point.x, point.y);
        seed.setAngle(260 * progress.value);
        seed.setScale(baseScale * (1 - progress.value * 0.28));
      },
      onComplete: () => seed.destroy(),
    });
  }

  private updateAutomationIncome(delta: number, stats: RuntimeStats): void {
    const result = this.profileScope("auto:incomeCalc", () => this.automationIncome.update(delta, this.state, stats));
    if (!result.changed) {
      return;
    }

    this.runWithAmbientFeedback(() =>
      this.profileScope("auto:incomeVisuals", () => this.queueAutomationTouchVisuals(result.gained, result.touchesPerMinute)),
    );
    const now = Date.now();
    if (now - this.lastAutomationIncomeFeedAt >= 8000) {
      this.lastAutomationIncomeFeedAt = now;
      this.addTriggerFeedEvent("Auto income", `+${formatGrassTouches(result.gained)} touches`, "AI", 0xbff4ff, now);
    }
    this.queueSave();
  }

  private queueAutomationTouchVisuals(gained: number, touchesPerMinute: number): void {
    if (gained <= 0 || touchesPerMinute <= 0 || this.hasBlockingOverlayOpen()) {
      return;
    }

    if (
      this.isBoardRenderBusy() ||
      this.children.list.length >= DISPLAY_OBJECT_CRITICAL_LIMIT ||
      this.effectQuality <= MIN_EFFECT_QUALITY ||
      this.activeAutoTouchVisualObjects >= this.getScaledBudget(AUTO_TOUCH_ACTIVE_OBJECT_LIMIT)
    ) {
      this.autoTouchVisualCredit = 0;
      return;
    }

    const now = Date.now();
    const visualWeight = Phaser.Math.Clamp(Math.log2(gained + 1), 1, 4);
    const rateWeight = Phaser.Math.Clamp(touchesPerMinute / 180, 0.35, 3);
    this.autoTouchVisualCredit = Math.min(
      this.getScaledBudget(AUTO_TOUCH_VISUAL_CREDIT_LIMIT),
      this.autoTouchVisualCredit + visualWeight * 0.68 + rateWeight * 0.32,
    );

    if (this.autoTouchVisualCredit < 1) {
      return;
    }

    const objectPressure = this.children.list.length >= DISPLAY_OBJECT_PRESSURE_LIMIT;
    const cadence = Phaser.Math.Clamp(
      60000 / Math.max(1, touchesPerMinute * (objectPressure || this.effectQuality < 0.58 ? 0.48 : 1.35)),
      AUTO_TOUCH_VISUAL_MIN_INTERVAL_MS,
      AUTO_TOUCH_VISUAL_MAX_INTERVAL_MS,
    );
    if (now - this.lastAutoTouchVisualAt < cadence) {
      return;
    }

    const tile = this.profileScope("auto:visualPick", () => this.pickAutomationTouchVisualTile());
    if (!tile) {
      return;
    }

    this.autoTouchVisualCredit = Math.max(0, this.autoTouchVisualCredit - 1);
    this.lastAutoTouchVisualAt = now;
    this.profileScope("auto:visualPlay", () => this.playAutomationTouchVisual(tile, now));
  }

  private isBoardRenderBusy(): boolean {
    if (this.isBoardLayoutBusy()) {
      return true;
    }

    if (this.usesFullLiveTileViews()) {
      return false;
    }

    const dirtyPressure = Math.floor(this.getDirtyTileViewLimit() * 0.75);
    return this.commonTileLayerDirty || this.dirtyTileViewKeys.size >= Math.max(8, dirtyPressure);
  }

  private pickAutomationTouchVisualTile(): FieldTile | undefined {
    const candidates: FieldTile[] = [];
    const visibleKeys = [...this.lastVisibleTileKeys];
    const attempts = Math.min(visibleKeys.length, AUTO_TOUCH_VISUAL_SAMPLE_LIMIT);

    for (let index = 0; index < attempts; index += 1) {
      const key = visibleKeys[Phaser.Math.Between(0, visibleKeys.length - 1)];
      const tile = this.state.field[key];
      if (!tile) {
        continue;
      }

      if (tile.grassState !== "grown") {
        continue;
      }

      const position = this.getTileVisualPosition(tile);
      if (!position || !this.isScreenPositionNearViewport(position, TILE_CULL_MARGIN_PX)) {
        continue;
      }

      candidates.push(tile);
    }

    return Phaser.Utils.Array.GetRandom(candidates);
  }

  private playAutomationTouchVisual(tile: FieldTile, now: number): void {
    const position = this.getTileVisualPosition(tile);
    if (
      !position ||
      !this.reserveAmbientTransientObject(2) ||
      this.activeAutoTouchVisualObjects + 2 > this.getScaledBudget(AUTO_TOUCH_ACTIVE_OBJECT_LIMIT)
    ) {
      return;
    }

    const x = position.x;
    const y = position.y;
    const color = this.getTierHighlightColor(tile.tier);
    const stroke = tile.tier === "normal" ? 0xbff4ff : color;
    this.activeAutoTouchVisualObjects += 2;
    const grassGhost = this.add
      .image(x, y, this.getGrassTextureKey(tile))
      .setScale(this.boardScale * this.getGrassScale(tile))
      .setTint(stroke)
      .setAlpha(0.38)
      .setDepth(34);
    const ring = this.add
      .ellipse(x, y + 2 * this.boardScale, TILE_SIZE * 0.5 * this.boardScale, TILE_SIZE * 0.3 * this.boardScale, 0xbff4ff, 0.13)
      .setStrokeStyle(Math.max(1, 2 * this.boardScale), stroke, 0.74)
      .setDepth(35);

    this.tweens.add({
      targets: grassGhost,
      scaleX: grassGhost.scaleX * 1.14,
      scaleY: grassGhost.scaleY * 0.72,
      y: y + 5 * this.boardScale,
      alpha: 0,
      duration: 250,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.activeAutoTouchVisualObjects = Math.max(0, this.activeAutoTouchVisualObjects - 1);
        grassGhost.destroy();
      },
    });

    this.tweens.add({
      targets: ring,
      scaleX: 1.85,
      scaleY: 1.45,
      alpha: 0,
      duration: 330,
      ease: "Sine.easeOut",
      onComplete: () => {
        this.activeAutoTouchVisualObjects = Math.max(0, this.activeAutoTouchVisualObjects - 1);
        ring.destroy();
      },
    });

    this.emitBurst(tile.trait === "dewy" ? "dew-fleck" : "grass-fleck", x, y - 6 * this.boardScale, 6, 0.45, 0.1);

    if (this.effectQuality >= 0.58 && this.boardScale >= COMPACT_TILE_EFFECT_SCALE && now - this.lastAutoTouchPopAt >= AUTO_TOUCH_POP_INTERVAL_MS) {
      this.lastAutoTouchPopAt = now;
      this.popAtTile(tile, "auto", "#bff4ff");
    }
  }

  private updateFieldLifeVisuals(delta: number, now: number): void {
    this.fieldLifeVisualElapsed += delta;
    if (this.fieldLifeVisualElapsed < FIELD_LIFE_VISUAL_INTERVAL_MS) {
      return;
    }
    this.fieldLifeVisualElapsed = 0;

    if (
      this.hasBlockingOverlayOpen() ||
      this.isBoardRenderBusy() ||
      this.lastVisibleTileKeys.size < FIELD_LIFE_VISUAL_MIN_VISIBLE_TILES ||
      this.boardScale < FIELD_LIFE_MIN_BOARD_SCALE ||
      this.effectQuality <= MIN_EFFECT_QUALITY ||
      this.children.list.length >= DISPLAY_OBJECT_PRESSURE_LIMIT
    ) {
      return;
    }

    const objectLimit = this.getScaledBudget(FIELD_LIFE_ACTIVE_OBJECT_LIMIT);
    if (this.activeFieldLifeVisualObjects >= objectLimit) {
      return;
    }

    this.runWithAmbientFeedback(() => {
      const candidates = this.pickFieldLifeVisualTiles();
      if (candidates.length === 0) {
        return;
      }

      const sparkBudget = this.getScaledBudget(this.effectQuality < 0.58 ? 1 : FIELD_LIFE_VISUAL_MAX_SPARKS);
      const sparkCount = Math.min(candidates.length, sparkBudget, objectLimit - this.activeFieldLifeVisualObjects);
      for (let index = 0; index < sparkCount; index += 1) {
        const candidate = candidates[index];
        if (candidate) {
          this.playFieldLifeSpark(candidate, index);
        }
      }

      if (now - this.lastFieldLifeSweepAt >= FIELD_LIFE_SWEEP_INTERVAL_MS) {
        this.playFieldLifeSweep(candidates, now);
      }
    });
  }

  private pickFieldLifeVisualTiles(): FieldLifeVisualCandidate[] {
    const visibleKeys = [...this.lastVisibleTileKeys];
    if (visibleKeys.length === 0) {
      return [];
    }

    const attempts = Math.min(visibleKeys.length, FIELD_LIFE_VISUAL_SAMPLE_LIMIT);
    const seenKeys = new Set<TileKey>();
    const candidates: FieldLifeVisualCandidate[] = [];

    for (let index = 0; index < attempts; index += 1) {
      const key = visibleKeys[Phaser.Math.Between(0, visibleKeys.length - 1)];
      if (!key || seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);

      const tile = this.state.field[key];
      if (!tile || tile.grassState !== "grown" || getTileHazard(this.state, key)) {
        continue;
      }

      const position = this.getTileVisualPosition(tile);
      if (!position || !this.isScreenPositionNearViewport(position, TILE_CULL_MARGIN_PX)) {
        continue;
      }

      const score = this.getFieldLifeVisualScore(tile);
      if (score <= 0) {
        continue;
      }

      candidates.push({ tile, position, score: score + Math.random() * 0.9 });
    }

    return candidates
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.max(FIELD_LIFE_VISUAL_MAX_SPARKS + 2, 5));
  }

  private getFieldLifeVisualScore(tile: FieldTile): number {
    let score = 1;
    if (tile.tier !== "normal") {
      score += 4;
    }
    if (tile.tier === "golden" || tile.tier === "crystal" || tile.tier === "frost") {
      score += 2;
    }
    if (tile.trait === "dewy" || tile.trait === "lush") {
      score += 2;
    }

    const fertility = Number.isFinite(tile.fertility) ? tile.fertility : 1;
    const moisture = Number.isFinite(tile.moisture) ? tile.moisture : 1;
    return score + Phaser.Math.Clamp(fertility - 1, 0, 1.2) + Phaser.Math.Clamp(moisture - 1, 0, 1.2);
  }

  private playFieldLifeSpark(candidate: FieldLifeVisualCandidate, index: number): void {
    const { tile, position } = candidate;
    const texture = this.getFieldLifeBurstTexture(tile);
    const color = this.getFieldLifeVisualColor(tile);
    const rareTier = tile.tier !== "normal";
    const quantity = rareTier ? 6 : tile.trait === "normal" ? 3 : 4;
    const x = position.x + Phaser.Math.Between(-9, 9) * this.boardScale;
    const y = position.y - Phaser.Math.Between(8, 18) * this.boardScale;

    this.emitBurst(texture, x, y, quantity, 0.5, 0.12);

    const objectLimit = this.getScaledBudget(FIELD_LIFE_ACTIVE_OBJECT_LIMIT);
    if (this.activeFieldLifeVisualObjects >= objectLimit || !this.reserveAmbientTransientObject()) {
      return;
    }

    const outerRadius = Phaser.Math.Clamp(TILE_SIZE * this.boardScale * (rareTier ? 0.24 : 0.16), 5, rareTier ? 18 : 12);
    const innerRadius = Math.max(2, outerRadius * 0.34);
    const spark = this.trackFieldLifeVisualObject(
      this.add
        .star(x, y, rareTier ? 6 : 5, innerRadius, outerRadius, color, rareTier ? 0.82 : 0.58)
        .setStrokeStyle(Math.max(1, 2 * this.boardScale), 0xf7ffe8, rareTier ? 0.82 : 0.54)
        .setDepth(36),
    );

    this.tweens.add({
      targets: spark,
      angle: index % 2 === 0 ? 58 : -58,
      scaleX: rareTier ? 1.48 : 1.32,
      scaleY: rareTier ? 1.48 : 1.32,
      y: y - (10 + index * 2) * this.boardScale,
      alpha: 0,
      duration: rareTier ? 720 : 560,
      ease: "Sine.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  private playFieldLifeSweep(candidates: FieldLifeVisualCandidate[], now: number): void {
    if (
      this.fieldTileCount < FIELD_LIFE_SWEEP_MIN_PATCHES ||
      this.effectQuality < 0.72 ||
      this.boardScale < 0.18 ||
      this.children.list.length >= DISPLAY_OBJECT_PRESSURE_LIMIT ||
      this.activeFieldLifeVisualObjects >= this.getScaledBudget(FIELD_LIFE_ACTIVE_OBJECT_LIMIT) ||
      !this.reserveAmbientTransientObject()
    ) {
      return;
    }

    const points = candidates.slice(0, 3).map((candidate) => candidate.position);
    if (points.length === 0) {
      return;
    }

    this.lastFieldLifeSweepAt = now;
    const lead = candidates[0];
    const color = lead ? this.getFieldLifeVisualColor(lead.tile) : 0xdfffc8;
    const current = this.trackFieldLifeVisualObject(this.add.graphics().setDepth(33));
    const lineWidth = Math.max(1, 2.5 * this.boardScale);
    current.lineStyle(lineWidth, color, 0.42);

    if (points.length >= 2) {
      for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const next = points[index];
        current.lineBetween(previous.x, previous.y - 2 * this.boardScale, next.x, next.y - 2 * this.boardScale);
      }
    } else {
      const point = points[0];
      current.strokeCircle(point.x, point.y, TILE_SIZE * 0.42 * this.boardScale);
    }

    current.fillStyle(color, 0.12);
    for (const point of points) {
      current.fillCircle(point.x, point.y, Math.max(4, TILE_SIZE * 0.18 * this.boardScale));
    }

    if (lead) {
      this.emitBurst(this.getFieldLifeBurstTexture(lead.tile), lead.position.x, lead.position.y - 12 * this.boardScale, 10, 0.62, 0.08);
    }

    this.tweens.add({
      targets: current,
      alpha: 0,
      duration: 820,
      ease: "Sine.easeOut",
      onComplete: () => current.destroy(),
    });
  }

  private getFieldLifeVisualColor(tile: FieldTile): number {
    if (tile.trait === "dewy") {
      return 0xbff4ff;
    }
    if (tile.trait === "lush") {
      return 0xdfffc8;
    }
    return this.getTierHighlightColor(tile.tier);
  }

  private getFieldLifeBurstTexture(tile: FieldTile): string {
    if (tile.tier === "golden") {
      return "gold-fleck";
    }
    if (tile.tier === "wildflower") {
      return "effect-pollen-fleck";
    }
    if (tile.tier === "mushroom") {
      return "effect-magic-spore";
    }
    if (tile.tier === "crystal" || tile.tier === "frost" || tile.trait === "dewy") {
      return "dew-fleck";
    }
    return "grass-fleck";
  }

  private trackFieldLifeVisualObject<T extends Phaser.GameObjects.GameObject>(effect: T): T {
    this.activeFieldLifeVisualObjects += 1;
    let released = false;
    effect.once("destroy", () => {
      if (released) {
        return;
      }
      released = true;
      this.activeFieldLifeVisualObjects = Math.max(0, this.activeFieldLifeVisualObjects - 1);
    });
    return this.trackBoardTransient(effect);
  }

  private updateSprinkler(delta: number, stats: RuntimeStats): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    const changed = this.runWithAmbientFeedback(() => {
      return this.profileScope("sprinkler:update", () => this.sprinkler.update(delta, this.state, stats, {
        refreshTile: (tile) => this.refreshTile(tile),
        popAtTile: (tile, text, color) => this.popAtTile(tile, text, color),
        playSprinklerBurst: (tile) => this.playSprinklerBurst(tile),
        playTouchFeedback: (tile, touchedTrait, isCrit) => this.playTouchFeedback(tile, touchedTrait, isCrit),
        tryDropSeed: (tile, touchedTrait, runtimeStats, chanceScale) =>
          this.drops.tryDropSeed(this.state, tile, touchedTrait, runtimeStats, this.getDropFeedback(), chanceScale),
        tryDropGold: (tile, touchedTrait, touchedTier, touch, runtimeStats, chanceScale) =>
          this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier, touch, runtimeStats, this.getDropFeedback(), chanceScale),
        recordAutomationCombo: (tile, touch, source) => this.recordAutomationComboTouch(tile, touch, stats, source),
        recordAutomationComboAction: (tile, source) => this.recordAutomationComboAction(tile, stats, source),
        playGrassTouch: (tier, trait, isCrit, comboCount) => this.playMixedGrassTouch(tier, trait, isCrit, comboCount),
      }));
    });

    if (changed) {
      this.addTriggerFeedEvent("Sprinkler fired", "watered nearby patches", "SP", 0xbff4ff);
      this.queueSave();
    }
  }

  private updateAnimalCompanions(delta: number, stats: RuntimeStats): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    const changed = this.runWithAmbientFeedback(() => {
      return this.profileScope("companions:update", () => this.animalCompanions.update(delta, this.state, stats, {
        refreshTile: (tile) => this.refreshTile(tile),
        popAtTile: (tile, text, color) => this.popAtTile(tile, text, color),
        emitSeedBurst: (tile) => this.emitSeedBurst(tile),
        emitGoldBurst: (tile, amount) => this.emitGoldBurst(tile, amount),
        playCompanionAction: (tile, action) => this.playCompanionAction(tile, action),
        playTouchFeedback: (tile, touchedTrait, isCrit) => this.playTouchFeedback(tile, touchedTrait, isCrit),
        recordAutomationCombo: (tile, touch, source) => this.recordAutomationComboTouch(tile, touch, stats, source),
        playSound: (sound) => this.audio.play(sound),
        playGrassTouch: (tier, trait, isCrit, comboCount) => this.playMixedGrassTouch(tier, trait, isCrit, comboCount),
      }));
    });

    if (changed) {
      this.addTriggerFeedEvent("Companions helped", "field friends took action", "FR", 0xffef78);
      this.queueSave();
    }
  }

  private updateMutations(delta: number): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    const event = this.profileScope("mutations:update", () => this.mutations.update(delta, this.state));
    if (!event) {
      return;
    }

    this.state.mutationEvents += 1;
    this.runWithAmbientFeedback(() => this.playMutationEvent(event));
    this.addTriggerFeedEvent("Mutation event", event.label, "MU", 0xdfffc8);
    this.updateJournalDiscoveries();
    this.queueSave();
  }

  private updateHazards(delta: number, stats: RuntimeStats): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    const changed = this.runWithAmbientFeedback(() =>
      this.hazards.update(delta, this.state, stats, Date.now(), {
        refreshTile: (tile) => this.refreshTile(tile),
        popAtTile: (tile, text, color) => {
          this.popAtTile(tile, text, color);
          this.addHazardTriggerFeedEvent(text);
        },
        playMower: (event) => this.playMowerEvent(event),
      }),
    );

    if (changed) {
      this.invalidateRuntimeStats();
      this.queueSave();
      this.refreshUi(false);
    }
  }

  private playMowerEvent(event: MowerEvent): void {
    const routeTiles = event.routeKeys
      .map((key) => this.state.field[key])
      .filter((tile): tile is FieldTile => tile !== undefined);
    const routePositions = routeTiles
      .map((tile) => ({ tile, position: this.getTileScreenPosition(tile) }))
      .filter((entry): entry is { tile: FieldTile; position: { x: number; y: number } } => entry.position !== undefined);

    if (routePositions.length === 0) {
      return;
    }

    this.clearMowerVisuals();
    const first = routePositions[0].position;
    const last = routePositions[routePositions.length - 1].position;
    const duration = Phaser.Math.Clamp(routePositions.length * 220, 900, 3200);
    const mower = this.add
      .image(first.x, first.y - 4 * this.boardScale, "hazard-mower")
      .setScale(Math.max(0.62, this.boardScale * 0.92))
      .setDepth(37)
      .setAlpha(0.95);
    const routeDx = last.x - first.x;
    const routeDy = last.y - first.y;
    mower.setAngle(Math.abs(routeDx) >= Math.abs(routeDy) ? (routeDx >= 0 ? 0 : 180) : routeDy >= 0 ? 90 : -90);
    this.mowerSprite = mower;
    this.audio.play("mower");
    this.showMessage("Robotic lawnmower is making a pass.", 1800);
    this.addTriggerFeedEvent("Mower pass", `${routePositions.length} tile route`, "MW", 0xfff2b2);
    this.state.hazardStats.mowerPasses += 1;
    this.addJournalValue(this.state.journal.seenHazardIds, "mower");
    this.refreshUi(false);
    this.queueSave();

    routePositions.forEach((entry, index) => {
      const delay = Math.floor((duration * index) / Math.max(1, routePositions.length - 1));
      const timer = this.time.delayedCall(delay, () => this.applyMowerToTile(this.getTileKey(entry.tile)));
      this.mowerTileEvents.push(timer);
    });

    this.tweens.add({
      targets: mower,
      x: last.x,
      y: last.y - 4 * this.boardScale,
      scaleX: mower.scaleX * 1.02,
      scaleY: mower.scaleY * 0.98,
      duration,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.tweens.add({
          targets: mower,
          alpha: 0,
          duration: 220,
          ease: "Sine.easeOut",
          onComplete: () => {
            if (this.mowerSprite === mower) {
              this.mowerSprite = undefined;
            }
            mower.destroy();
          },
        });
      },
    });
  }

  private applyMowerToTile(key: TileKey): void {
    const result = this.hazards.mowTile(this.state, key, this.getCachedRuntimeStats(), Date.now());
    if (!result) {
      return;
    }

    this.invalidateRuntimeStats();
    this.refreshTile(result.tile);
    this.addJournalValue(this.state.journal.seenHazardIds, "mower");
    if (result.mown) {
      this.state.hazardStats.mowerTilesMown += 1;
      this.popAtTile(result.tile, "mown", "#fff2b2");
      const position = this.getTileVisualPosition(result.tile);
      if (position) {
        this.emitBurst("dust-fleck", position.x, position.y + 7 * this.boardScale, 10, 0.5, 0.22);
      }
    }
    if (result.removedCactus) {
      this.state.hazardStats.hazardsClearedByMower += 1;
      this.addJournalValue(this.state.journal.seenHazardIds, "cactus");
      this.popAtTile(result.tile, "cactus cleared", "#ffb347");
    }
    if (result.removedWeeds) {
      this.state.hazardStats.hazardsClearedByMower += 1;
      this.addJournalValue(this.state.journal.seenHazardIds, "weeds");
      this.popAtTile(result.tile, "weeds shredded", "#b7eba5");
    }
    this.queueSave();
  }

  private clearMowerVisuals(): void {
    for (const event of this.mowerTileEvents) {
      event.remove(false);
    }
    this.mowerTileEvents = [];

    if (this.mowerSprite) {
      this.tweens.killTweensOf(this.mowerSprite);
      this.mowerSprite.destroy();
      this.mowerSprite = undefined;
    }
  }

  private playMutationEvent(event: MutationEvent): void {
    for (const tile of event.changedTiles) {
      this.refreshTile(tile);
    }

    if (this.recordTileDiscoveries([event.originTile, event.partnerTile, ...event.changedTiles])) {
      this.queueSave();
    }

    this.refreshTile(event.originTile);
    this.popAtTile(event.originTile, event.label, event.color);
    this.emitTierIdentityBurst(event.originTile, event.burstTexture, event.kind === "prismatic_frost" ? 28 : 18, 0.78);

    if (event.seedReward > 0) {
      this.popAtTile(event.originTile, `+${event.seedReward} seed`, "#fff1a8");
      this.emitSeedBurst(event.originTile);
    }

    if (event.goldReward > 0) {
      this.popAtTile(event.partnerTile, `+${event.goldReward} gold`, "#ffef78");
      this.emitGoldBurst(event.partnerTile, event.goldReward);
    }

    this.audio.play(event.goldReward > 0 ? "gold" : event.seedReward > 0 ? "seed" : "regrow");
  }

  private shakeForGrassTouch(tier: GrassTierId, trait: TileTrait, isCrit: boolean): void {
    const now = Date.now();
    const isRareTier = !["normal", "thick", "clover"].includes(tier);

    if (!isCrit && !isRareTier && trait !== "lush") {
      return;
    }

    if (now - this.lastTouchShakeAt < TOUCH_SHAKE_COOLDOWN_MS) {
      return;
    }

    this.lastTouchShakeAt = now;

    const tierShake = {
      normal: { duration: 42, intensity: 0.0008 },
      thick: { duration: 54, intensity: 0.001 },
      clover: { duration: 48, intensity: 0.0009 },
      golden: { duration: 82, intensity: 0.00135 },
      wildflower: { duration: 58, intensity: 0.00095 },
      moss: { duration: 72, intensity: 0.0011 },
      mushroom: { duration: 78, intensity: 0.00118 },
      crystal: { duration: 84, intensity: 0.00128 },
      frost: { duration: 84, intensity: 0.0012 },
    } satisfies Record<GrassTierId, { duration: number; intensity: number }>;
    const traitShake = {
      normal: { duration: 0, intensity: 1 },
      dewy: { duration: 18, intensity: 0.86 },
      lush: { duration: 12, intensity: 1.18 },
    } satisfies Record<TileTrait, { duration: number; intensity: number }>;
    const base = tierShake[tier];
    const traitBoost = traitShake[trait];
    const critDuration = isCrit ? 1.55 : 1;
    const critIntensity = isCrit ? 2.1 : 1;
    const duration = Math.round((base.duration + traitBoost.duration) * critDuration);
    const intensity = Math.min(0.0035, base.intensity * traitBoost.intensity * critIntensity);

    this.cameras.main.shake(duration, intensity);
  }

  private shakeForCombo(combo: ComboResult, automated: boolean): void {
    if (automated || !combo.thresholdReached) {
      return;
    }

    const threshold = combo.thresholdReached;
    const duration = Math.round(COMBO_SHAKE_BASE_DURATION_MS + Math.min(170, threshold * COMBO_SHAKE_DURATION_PER_COUNT_MS));
    const intensity = Math.min(COMBO_SHAKE_MAX_INTENSITY, COMBO_SHAKE_BASE_INTENSITY + threshold * COMBO_SHAKE_INTENSITY_PER_COUNT);
    this.cameras.main.shake(duration, intensity);
  }

  private getTouchPopText(touch: TouchResult): string {
    const effects = [touch.doubled ? "2x" : "", touch.isCrit ? `CRIT x${touch.critMultiplier.toFixed(1)}` : ""].filter(Boolean);
    return [`+${touch.gained}`, ...effects].join(" ");
  }

  private playComboFeedback(tile: FieldTile, combo: ComboResult, source: ComboTouchSource = "manual"): void {
    if (combo.count < 2) {
      return;
    }

    const automated = source !== "manual";
    const busyField = this.fieldTileCount >= 220;
    const comboPopInterval = busyField ? 10 : 5;
    if (combo.bonusTouches > 0) {
      if (!busyField || combo.thresholdReached || combo.count <= 3 || combo.count % comboPopInterval === 0) {
        this.popAtTile(tile, `${automated ? "auto " : "combo "}+${combo.bonusTouches}`, automated ? "#bff4ff" : "#f4df6a");
      }
    } else if (combo.thresholdReached || combo.count <= 3 || combo.count % comboPopInterval === 0) {
      this.popAtTile(tile, automated ? `auto combo ${combo.count}` : `${combo.count} combo`, automated ? "#bff4ff" : "#b7eba5");
    }

    this.refreshComboBadge();
    this.bumpComboBadge();

    if (!combo.thresholdReached) {
      return;
    }

    const multiplier = combo.multiplier.toFixed(combo.multiplier >= 2 ? 0 : 2);
    this.showMessage(
      automated ? `Automation streak ${combo.thresholdReached}! Combo x${multiplier}.` : `${combo.thresholdReached} combo! Touch streak x${multiplier}.`,
      1600,
    );
    this.audio.play(combo.thresholdReached >= 15 ? "unlock" : "crit");
    this.shakeForCombo(combo, automated);
    this.playComboLandingPulse(tile, combo.thresholdReached, automated);

    const view = this.tileViews.get(this.getTileKey(tile));
    if (view) {
      this.emitBurst("crit-fleck", view.label.x, view.label.y - 12, 26, 1.1 + Math.min(1, combo.thresholdReached / 40), 0.16);
    }
  }

  private playComboLandingPulse(tile: FieldTile, threshold: number, automated: boolean): void {
    if (this.children.list.length >= DISPLAY_OBJECT_CRITICAL_LIMIT || this.effectQuality <= MIN_EFFECT_QUALITY) {
      return;
    }

    const position = this.getTileVisualPosition(tile);
    if (!position || !this.reserveAmbientTransientObject(2)) {
      return;
    }

    const color = automated ? 0xbff4ff : 0xffef78;
    const stroke = automated ? 0xf7ffe8 : 0xffffff;
    const scale = Phaser.Math.Clamp(threshold / 18, 0.8, 1.8);
    const ring = this.trackBoardTransient(
      this.add
        .ellipse(position.x, position.y + 3 * this.boardScale, TILE_SIZE * 0.72 * this.boardScale, TILE_SIZE * 0.42 * this.boardScale, color, 0.16)
        .setStrokeStyle(Math.max(2, 4 * this.boardScale), stroke, 0.82)
        .setDepth(38),
    );
    const flare = this.trackBoardTransient(
      this.add
        .star(
          position.x,
          position.y - 15 * this.boardScale,
          7,
          TILE_SIZE * 0.09 * this.boardScale,
          TILE_SIZE * 0.42 * this.boardScale,
          color,
          0.66,
        )
        .setStrokeStyle(Math.max(1, 2 * this.boardScale), stroke, 0.74)
        .setDepth(39),
    );

    this.emitBurst(automated ? "dew-fleck" : "crit-fleck", position.x, position.y - 14 * this.boardScale, 14 + Math.min(16, threshold), 0.82, 0.1);

    this.tweens.add({
      targets: ring,
      scaleX: 2.4 + scale * 0.62,
      scaleY: 1.7 + scale * 0.36,
      alpha: 0,
      duration: 640,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: flare,
      angle: automated ? -72 : 72,
      scaleX: 1.62 + scale * 0.2,
      scaleY: 1.62 + scale * 0.2,
      y: flare.y - 14 * this.boardScale,
      alpha: 0,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => flare.destroy(),
    });
  }

  private playAutomationComboFlair(tile: FieldTile, combo: ComboResult, source: Exclude<ComboTouchSource, "manual">): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const palette = {
      sprinkler: { color: 0xa8e8ff, stroke: 0xd7fff2, texture: "effect-water-drop" },
      field_mouse: { color: 0xffef78, stroke: 0xffffff, texture: "effect-gold-coin" },
      meadow_rabbit: { color: 0xfff1a8, stroke: 0xffffff, texture: "effect-seed-kernel" },
      sheep: { color: 0xdfffc8, stroke: 0xf7ffe8, texture: "grass-fleck" },
    } satisfies Record<Exclude<ComboTouchSource, "manual">, { color: number; stroke: number; texture: string }>;
    const style = palette[source];
    const thresholdPulse = combo.thresholdReached !== undefined;
    const comboScale = Phaser.Math.Clamp(combo.count / 32, 0.35, 1.25);

    this.emitBurst(style.texture, position.x, position.y - 12 * this.boardScale, thresholdPulse ? 22 : 8, 0.58 + comboScale * 0.36, 0.2);

    if (!thresholdPulse && combo.count > 3 && combo.count % 6 !== 0) {
      return;
    }

    if (!this.reserveAmbientTransientObject(2)) {
      return;
    }

    const ring = this.add
      .ellipse(position.x, position.y + 2 * this.boardScale, TILE_SIZE * 0.42 * this.boardScale, TILE_SIZE * 0.22 * this.boardScale, style.color, 0.18)
      .setStrokeStyle(Math.max(2, 3 * this.boardScale), style.stroke, 0.86)
      .setDepth(39);
    const spark = this.add
      .star(
        position.x,
        position.y - 16 * this.boardScale,
        6,
        TILE_SIZE * 0.06 * this.boardScale,
        TILE_SIZE * (thresholdPulse ? 0.42 : 0.28) * this.boardScale,
        style.color,
        thresholdPulse ? 0.86 : 0.62,
      )
      .setStrokeStyle(2, style.stroke, 0.85)
      .setDepth(40);

    this.tweens.add({
      targets: ring,
      scaleX: thresholdPulse ? 2.4 : 1.7,
      scaleY: thresholdPulse ? 1.75 : 1.35,
      alpha: 0,
      duration: thresholdPulse ? 560 : 380,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: spark,
      angle: 48,
      scaleX: thresholdPulse ? 1.7 : 1.32,
      scaleY: thresholdPulse ? 1.7 : 1.32,
      y: spark.y - (thresholdPulse ? 14 : 8) * this.boardScale,
      alpha: 0,
      duration: thresholdPulse ? 620 : 420,
      ease: "Sine.easeOut",
      onComplete: () => spark.destroy(),
    });
  }

  private playClassTouchFeedback(tile: FieldTile, touch: TouchResult, combo: ComboResult): void {
    const view = this.tileViews.get(this.getTileKey(tile));
    if (!view) {
      return;
    }

    const x = view.label.x;
    const y = view.label.y;

    if (this.state.characterClassId === "femboy_slim" && (touch.isCrit || touch.doubled)) {
      this.emitBurst("class-slash-fleck", x, y - 12, touch.isCrit ? 22 : 12, touch.isCrit ? 1.2 : 0.9, 0.08);
      this.addClassSlashMark(x, y);
      if (touch.isCrit && touch.doubled) {
        this.popAtTile(tile, "slay!", "#ffef78");
      }
      return;
    }

    if (this.state.characterClassId === "bard_de_wever" && combo.thresholdReached) {
      this.emitBurst("class-music-note", x, y - 18, 8 + Math.min(10, combo.thresholdReached), 0.82, 0.02);
      if (this.effectQuality >= 0.58 && this.boardScale >= COMPACT_TILE_EFFECT_SCALE) {
        this.floatMusicNote(x, y);
      }
      if (combo.thresholdReached >= 10) {
        this.popAtTile(tile, "encore!", "#ffef78");
      }
    }
  }

  private bumpComboBadge(): void {
    if (!this.comboBadge.visible) {
      return;
    }

    const now = Date.now();
    if (now - this.lastComboBadgeBumpAt < COMBO_BADGE_BUMP_INTERVAL_MS) {
      return;
    }
    this.lastComboBadgeBumpAt = now;

    this.tweens.killTweensOf(this.comboBadge);
    this.comboBadge.setScale(1);
    this.tweens.add({
      targets: this.comboBadge,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 70,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => this.comboBadge.setScale(1),
    });
  }

  private updateWeather(now: number, announce: boolean): void {
    if (!this.state.seedShopPurchases.weather_jar) {
      if (this.activeWeatherVisualId !== "none") {
        this.refreshWeatherVisuals();
      }
      return;
    }

    if (this.state.activeWeatherId && this.state.weatherEndsAt && now < this.state.weatherEndsAt) {
      return;
    }

    const weather = pickWeather(this.state.activeWeatherId);
    this.state.activeWeatherId = weather.id;
    this.state.weatherEndsAt = now + (this.state.seedShopPurchases.rain_barrel ? 150000 : 120000);
    this.invalidateRuntimeStats();
    this.addJournalValue(this.state.journal.seenWeatherIds, weather.id);

    if (announce) {
      this.showMessage(`${weather.name}: ${weather.description}`, 2600);
      this.addTriggerFeedEvent("Weather changed", weather.name, "WX", 0xbff4ff, now);
    }

    this.refreshWeatherVisuals();
    this.saveState();
  }

  private refreshWeatherVisuals(): void {
    if (!this.weatherTint || !this.weatherBadge || !this.weatherBadgeTitle || !this.weatherBadgeBody) {
      return;
    }

    if (!this.state.seedShopPurchases.weather_jar) {
      this.setVisibleIfChanged(this.weatherTint, false);
      this.setVisibleIfChanged(this.weatherBadge, false);
      this.weatherParticles?.destroy();
      this.weatherParticles = undefined;
      this.activeWeatherVisualId = "none";
      return;
    }

    const weather = getWeather(this.state.activeWeatherId);
    const secondsLeft = Math.max(0, Math.ceil(((this.state.weatherEndsAt ?? 0) - Date.now()) / 1000));
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    const timeText = `${minutes}:${seconds.toString().padStart(2, "0")}`;

    const visible = !this.hasBlockingOverlayOpen();
    const compact = this.scale.width < 620;
    this.setVisibleIfChanged(this.weatherBadge, visible && !compact);
    this.setTextIfChanged(this.weatherBadgeTitle, `Weather Jar: ${weather.name}`);
    this.weatherBadgeTitle.setColor(weather.color);
    this.setTextIfChanged(this.weatherBadgeBody, `${weather.description} (${timeText})`);
    this.setVisibleIfChanged(this.weatherTint, visible);
    this.applyWeatherTint(weather.id);

    if (this.activeWeatherVisualId !== weather.id) {
      this.activeWeatherVisualId = weather.id;
      this.createWeatherParticleEffect(weather.id);
    }
  }

  private applyWeatherTint(weatherId: WeatherId): void {
    const tint = {
      calm: { color: 0xf7ffe8, alpha: 0.035 },
      dewy_morning: { color: 0xbff4ff, alpha: 0.15 },
      warm_sunlight: { color: 0xffef78, alpha: 0.15 },
      lucky_breeze: { color: 0xdfffc8, alpha: 0.12 },
      seed_wind: { color: 0xfff1a8, alpha: 0.14 },
      soft_rain: { color: 0x6fc8ff, alpha: 0.18 },
      pollinator_swarm: { color: 0xffe08a, alpha: 0.13 },
      golden_hour: { color: 0xffb347, alpha: 0.18 },
      restless_roots: { color: 0xb7eba5, alpha: 0.14 },
    } satisfies Record<WeatherId, { color: number; alpha: number }>;
    const style = tint[weatherId];

    this.weatherTint.setFillStyle(style.color, style.alpha);
  }

  private createWeatherParticleEffect(weatherId: WeatherId): void {
    this.weatherParticles?.destroy();
    this.weatherParticles = undefined;

    if (weatherId === "calm") {
      return;
    }

    const configs = {
      dewy_morning: {
        texture: "dew-fleck",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: -12,
          lifespan: { min: 1900, max: 3600 },
          speedX: { min: -10, max: 24 },
          speedY: { min: 24, max: 54 },
          scale: { start: 1.25, end: 0.32 },
          alpha: { start: 0.82, end: 0 },
          frequency: 115,
          quantity: 2,
          maxParticles: 46,
        },
      },
      warm_sunlight: {
        texture: "weather-sun-mote",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 132, max: Math.max(132, this.scale.height - 24) },
          lifespan: { min: 1800, max: 3400 },
          speedX: { min: -10, max: 10 },
          speedY: { min: -16, max: 2 },
          scale: { start: 1.45, end: 0 },
          alpha: { start: 0.72, end: 0 },
          frequency: 145,
          quantity: 1,
          maxParticles: 30,
        },
      },
      lucky_breeze: {
        texture: "weather-breeze-leaf",
        config: {
          x: -18,
          y: { min: 138, max: Math.max(138, this.scale.height - 20) },
          lifespan: { min: 1400, max: 2400 },
          speedX: { min: 145, max: 245 },
          speedY: { min: -38, max: 28 },
          rotate: { min: -80, max: 80 },
          scale: { start: 1.25, end: 0.25 },
          alpha: { start: 0.76, end: 0 },
          frequency: 105,
          quantity: 2,
          maxParticles: 34,
        },
      },
      seed_wind: {
        texture: "seed-fleck",
        config: {
          x: -16,
          y: { min: 138, max: Math.max(138, this.scale.height - 20) },
          lifespan: { min: 1500, max: 2700 },
          speedX: { min: 125, max: 215 },
          speedY: { min: -48, max: 14 },
          gravityY: 34,
          rotate: { min: -180, max: 180 },
          scale: { start: 1.35, end: 0.18 },
          alpha: { start: 0.86, end: 0 },
          frequency: 95,
          quantity: 2,
          maxParticles: 34,
        },
      },
      soft_rain: {
        texture: "weather-rain-streak",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: -24,
          lifespan: { min: 900, max: 1550 },
          speedX: { min: -92, max: -34 },
          speedY: { min: 220, max: 330 },
          gravityY: 80,
          rotate: { min: -10, max: 4 },
          scale: { start: 1.35, end: 0.95 },
          alpha: { start: 0.78, end: 0 },
          frequency: 46,
          quantity: 1,
          maxParticles: 48,
        },
      },
      pollinator_swarm: {
        texture: "weather-pollen-mote",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 136, max: Math.max(136, this.scale.height - 28) },
          lifespan: { min: 1000, max: 1900 },
          speedX: { min: -64, max: 64 },
          speedY: { min: -46, max: 34 },
          rotate: { min: -120, max: 120 },
          scale: { start: 1.15, end: 0.2 },
          alpha: { start: 0.78, end: 0 },
          frequency: 76,
          quantity: 2,
          maxParticles: 36,
        },
      },
      golden_hour: {
        texture: "weather-sun-mote",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 132, max: Math.max(132, this.scale.height - 24) },
          lifespan: { min: 1800, max: 3600 },
          speedX: { min: -8, max: 16 },
          speedY: { min: -14, max: 4 },
          scale: { start: 1.9, end: 0 },
          alpha: { start: 0.86, end: 0 },
          frequency: 105,
          quantity: 2,
          maxParticles: 36,
        },
      },
      restless_roots: {
        texture: "weather-root-mote",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: Math.max(180, this.scale.height + 12),
          lifespan: { min: 850, max: 1500 },
          speedX: { min: -32, max: 32 },
          speedY: { min: -150, max: -68 },
          gravityY: 70,
          rotate: { min: -160, max: 160 },
          scale: { start: 1.25, end: 0.18 },
          alpha: { start: 0.82, end: 0 },
          frequency: 90,
          quantity: 2,
          maxParticles: 34,
        },
      },
    } satisfies Record<Exclude<WeatherId, "calm">, { texture: string; config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig }>;
    const effect = configs[weatherId];

    this.weatherParticles = this.add.particles(0, 0, effect.texture, this.getScaledWeatherParticleConfig(effect.config)).setDepth(19);
  }

  private getScaledWeatherParticleConfig(
    config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig,
  ): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
    const quality = this.weatherParticleQuality;
    const scaledConfig = { ...config };

    if (typeof scaledConfig.frequency === "number") {
      scaledConfig.frequency = Math.ceil(scaledConfig.frequency / Math.max(0.16, quality));
    }

    if (typeof scaledConfig.quantity === "number") {
      scaledConfig.quantity = Math.max(1, Math.floor(scaledConfig.quantity * quality));
    }

    if (typeof scaledConfig.maxParticles === "number") {
      scaledConfig.maxParticles = Math.max(8, Math.floor(scaledConfig.maxParticles * Math.max(0.25, quality)));
    }

    return scaledConfig;
  }

  private refreshTile(tile: FieldTile): void {
    const key = this.getTileKey(tile);
    const view = this.tileViews.get(key);
    if (!view) {
      this.markBatchTileDirty(tile);
      return;
    }

    const isGrown = tile.grassState === "grown";
    const tier = getGrassTier(tile.tier);
    const grassTexture = this.getGrassTextureKey(tile);
    const rareTier = tier.id !== "normal";
    const highlightColor = this.getTierHighlightColor(tier.id);
    const hazard = getTileHazard(this.state, key);

    this.setVisibleIfChanged(view.grass, isGrown);
    view.grass.setTexture(grassTexture);
    view.grass.setScale(this.boardScale * this.getGrassScale(tile));
    view.grass.setAlpha(1);
    this.setVisibleIfChanged(view.hazard, isGrown && hazard !== undefined);
    if (hazard) {
      view.hazard.setTexture(this.getHazardTextureKey(hazard.id));
    }
    view.hazard.setScale(this.boardScale * 0.96);
    view.hazard.setAlpha(1);
    this.setVisibleIfChanged(view.outline, isGrown && rareTier);
    view.outline.setStrokeStyle(tier.id === "golden" || tier.id === "crystal" || tier.id === "frost" ? 5 : 4, highlightColor, tier.id === "normal" ? 0 : 0.82);
    this.setVisibleIfChanged(view.glint, isGrown && rareTier);
    view.glint.setFillStyle(highlightColor, tier.id === "normal" ? 0 : 0.88);
    this.setTextIfChanged(view.label, isGrown ? this.getTileLabel(tile, tier.label, hazard?.id) : "...");
    view.base.setTexture(isGrown ? "tile-dirt" : "tile-stubble");

    if (!this.needsTileView(tile, key)) {
      this.markBatchTileDirty(tile);
    }
  }

  private markBatchTileDirty(tile: FieldTile): void {
    if (this.usesFullLiveTileViews()) {
      return;
    }

    const key = this.getTileKey(tile);
    const position = this.getTileScreenPosition(tile);
    if (!position || !this.isScreenPositionNearViewport(position)) {
      return;
    }

    if (this.usesViewportLiveTileViews()) {
      if (!this.tileViews.has(key)) {
        this.createTileView(tile);
      }
      return;
    }

    this.staleCommonTileKeys.add(key);
    if (this.dirtyTileViewKeys.has(key)) {
      return;
    }

    if (this.dirtyTileViewKeys.size >= this.getDirtyTileViewLimit()) {
      this.commonTileLayerDirty = true;
      return;
    }

    this.dirtyTileViewKeys.add(key);
    if (!this.tileViews.has(key)) {
      this.createTileView(tile);
    }
  }

  private getGrassScale(tile: FieldTile): number {
    const tierScale =
      tile.tier === "frost"
        ? 1.12
        : tile.tier === "crystal"
          ? 1.1
          : tile.tier === "golden" || tile.tier === "wildflower" || tile.tier === "mushroom"
            ? 1.09
            : tile.tier === "clover" || tile.tier === "moss"
              ? 1.06
              : tile.tier === "thick"
                ? 1.03
                : 1;
    return (tile.trait === "lush" ? 1.06 : 1) * tierScale;
  }

  private getTierHighlightColor(tier: GrassTierId): number {
    const colors = {
      normal: 0x9be86b,
      thick: 0x85d35e,
      clover: 0xb7eba5,
      golden: 0xffef78,
      wildflower: 0xffb7d5,
      moss: 0x75d894,
      mushroom: 0xffd09a,
      crystal: 0x75e8ff,
      frost: 0xd7fff2,
    } satisfies Record<GrassTierId, number>;

    return colors[tier];
  }

  private getGrassTextureKey(tile: FieldTile): string {
    const tier = getGrassTier(tile.tier).id;
    const trait = tile.trait === "normal" ? "" : `-${tile.trait}`;
    return `grass-${tier}${trait}`;
  }

  private getTileLabel(tile: FieldTile, tierLabel: string, hazardId?: "cactus" | "weeds"): string {
    const parts = [hazardId === "cactus" ? "cactus" : hazardId === "weeds" ? "weeds" : "", tierLabel, tile.trait === "normal" ? "" : tile.trait].filter(Boolean);
    return parts.join(" ");
  }

  private getHazardTextureKey(hazardId: "cactus" | "weeds"): string {
    return hazardId === "cactus" ? "hazard-cactus" : "hazard-weeds";
  }

  private getHazardInfoLine(hazard: { id: "cactus" | "weeds"; strength?: number }): string {
    if (hazard.id === "cactus") {
      return "Hazard: cactus prick applies Pricked.";
    }

    const pulls = Math.max(1, hazard.strength ?? 1);
    return `Hazard: weeds block the patch until pulled${pulls > 1 ? ` (${pulls} pulls)` : ""}.`;
  }

  private playTouchFeedback(tile: FieldTile, touchedTrait = tile.trait, isCrit = false): void {
    const view = this.tileViews.get(this.getTileKey(tile));
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const x = position.x;
    const y = position.y;
    const baseScale = this.boardScale;
    const fleckTexture = touchedTrait === "dewy" ? "dew-fleck" : "grass-fleck";
    const compactEffects = this.boardScale < COMPACT_TILE_EFFECT_SCALE && !isCrit;
    const showFlourish = !compactEffects && !this.isBoardLayoutBusy() && this.reserveTouchFlourish(isCrit);

    if (view && showFlourish) {
      this.resetBaseTilePose(view);
      const grassGhost = this.trackBoardTransient(
        this.add
          .image(x, y, view.grass.texture.key)
          .setScale(view.grass.scaleX, view.grass.scaleY)
          .setAlpha(0.95)
          .setDepth(33),
      );

      this.tweens.add({
        targets: grassGhost,
        scaleX: grassGhost.scaleX * 1.28,
        scaleY: grassGhost.scaleY * 0.62,
        alpha: 0,
        y: y + 5,
        duration: 170,
        ease: "Back.easeIn",
        onComplete: () => grassGhost.destroy(),
      });

      this.addTileImpactPulse(x, y, baseScale, isCrit);
    }

    this.emitBurst(fleckTexture, x, y - 4, isCrit ? 38 : compactEffects ? 8 : 20, isCrit ? 1.42 : 1.05, isCrit ? 0.3 : 0.42);
    if (showFlourish) {
      this.emitBurst("dust-fleck", x, y + 12, 8, 0.8, 0.28);
    }
    if (isCrit) {
      this.emitBurst("crit-fleck", x, y - 10, 24, 1.35, 0.18);
      if (showFlourish) {
        this.addCritFlash(x, y);
      }
    }
    if (showFlourish) {
      this.addTouchRing(x, y);
      this.addTouchFlash(x, y);
    }
  }

  private addTileImpactPulse(x: number, y: number, baseScale: number, isCrit: boolean): void {
    const pulse = this.trackBoardTransient(
      this.add
        .ellipse(
          x,
          y + 3 * baseScale,
          TILE_SIZE * 0.72 * baseScale,
          TILE_SIZE * 0.42 * baseScale,
          isCrit ? 0xffef78 : 0xf7ffe8,
          isCrit ? 0.26 : 0.16,
        )
        .setStrokeStyle(Math.max(1, 2 * baseScale), isCrit ? 0xffef78 : 0xb7eba5, isCrit ? 0.82 : 0.48)
        .setDepth(31),
    );

    this.tweens.add({
      targets: pulse,
      scaleX: 1.2,
      scaleY: 0.72,
      alpha: 0,
      duration: 140,
      ease: "Sine.easeOut",
      onComplete: () => pulse.destroy(),
    });
  }

  private playPerfectTouchFeedback(tile: FieldTile, bonusTouches: number): void {
    this.createTileView(tile);
    const view = this.tileViews.get(this.getTileKey(tile));
    if (!view) {
      return;
    }

    const x = view.label.x;
    const y = view.label.y;
    this.popAtTile(tile, `PERFECT +${bonusTouches}`, "#ffef78");
    this.emitBurst("crit-fleck", x, y - 10, 34, 1.28, 0.18);
    this.emitBurst("dew-fleck", x, y - 3, 22, 0.95, 0.25);
    this.audio.play("perfect");

    const sparkle = this.add
      .star(x, y - 18 * this.boardScale, 6, TILE_SIZE * 0.08 * this.boardScale, TILE_SIZE * 0.34 * this.boardScale, 0xffef78, 0.82)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(41);

    this.tweens.add({
      targets: sparkle,
      angle: 40,
      scaleX: 1.45,
      scaleY: 1.45,
      y: sparkle.y - 9 * this.boardScale,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeOut",
      onComplete: () => sparkle.destroy(),
    });
  }

  private playRegrowFeedback(tile: FieldTile): void {
    const view = this.tileViews.get(this.getTileKey(tile));
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    if (view) {
      this.resetBaseTilePose(view);
      const finalScale = this.boardScale * this.getGrassScale(tile);
      view.grass.setScale(this.boardScale * 0.18, this.boardScale * 0.08);
      view.grass.setAlpha(0);
      view.grass.setPosition(position.x, position.y + 12);

      this.tweens.add({
        targets: view.grass,
        scaleX: finalScale * 1.18,
        scaleY: finalScale * 1.18,
        alpha: 1,
        y: position.y,
        duration: 180,
        ease: "Back.easeOut",
        onComplete: () => {
          this.tweens.add({
            targets: view.grass,
            scaleX: finalScale,
            scaleY: finalScale,
            duration: 120,
            ease: "Sine.easeOut",
          });
        },
      });
    }

    this.emitBurst(tile.trait === "dewy" ? "dew-fleck" : "grass-fleck", position.x, position.y, 10, 0.55, 0.22);
  }

  private playSprinklerBurst(tile: FieldTile): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const x = position.x;
    const y = position.y;
    this.spawnWorldActionArc("effect-water-drop", "sprinkler", x, y - 12 * this.boardScale, 4, 0xa8e8ff);
    const showTransient = this.reserveAmbientTransientObject(2);

    this.emitBurst("effect-water-drop", x, y - 14 * this.boardScale, 30, 1.28, 0.5);

    if (showTransient) {
      const ring = this.add
        .ellipse(x, y, TILE_SIZE * 0.42 * this.boardScale, TILE_SIZE * 0.24 * this.boardScale, 0xa8e8ff, 0.22)
        .setStrokeStyle(3, 0xd7fff2, 0.9)
        .setDepth(38);
      const sparkle = this.add
        .star(x, y - 17 * this.boardScale, 6, TILE_SIZE * 0.08 * this.boardScale, TILE_SIZE * 0.33 * this.boardScale, 0xd7fff2, 0.78)
        .setStrokeStyle(2, 0xffffff, 0.85)
        .setDepth(39);

      this.tweens.add({
        targets: ring,
        scaleX: 1.85,
        scaleY: 1.45,
        alpha: 0,
        duration: 420,
        ease: "Sine.easeOut",
        onComplete: () => ring.destroy(),
      });

      this.tweens.add({
        targets: sparkle,
        angle: 35,
        scaleX: 1.32,
        scaleY: 1.32,
        y: sparkle.y - 7 * this.boardScale,
        alpha: 0,
        duration: 360,
        ease: "Sine.easeOut",
        onComplete: () => sparkle.destroy(),
      });
    }
  }

  private playWateringCanSplash(tile: FieldTile, primary: boolean): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const x = position.x;
    const y = position.y;
    this.emitBurst("effect-water-drop", x, y - 14 * this.boardScale, primary ? 16 : 9, primary ? 0.88 : 0.62, 0.32);

    if (!primary || !this.reserveAmbientTransientObject(2)) {
      return;
    }

    const ring = this.add
      .ellipse(x, y + 1 * this.boardScale, TILE_SIZE * 0.34 * this.boardScale, TILE_SIZE * 0.19 * this.boardScale, 0xbff4ff, 0.18)
      .setStrokeStyle(2, 0xd7fff2, 0.78)
      .setDepth(38);
    const droplet = this.add
      .image(x + 5 * this.boardScale, y - 18 * this.boardScale, "effect-water-drop")
      .setScale(2.2 * this.boardScale)
      .setDepth(39)
      .setAlpha(0.9);

    this.tweens.add({
      targets: ring,
      scaleX: 1.7,
      scaleY: 1.38,
      alpha: 0,
      duration: 360,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: droplet,
      x: droplet.x + 5 * this.boardScale,
      y: droplet.y + 16 * this.boardScale,
      angle: 12,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeIn",
      onComplete: () => droplet.destroy(),
    });
  }

  private playCompanionAction(tile: FieldTile, action: "pollinate" | "scratch" | "forage" | "graze" | "burrow" | "scurry" | "hop"): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const x = position.x;
    const y = position.y;

    if (action === "pollinate") {
      this.spawnWorldActionArc("effect-pollen-fleck", "bee_hive", x, y - 12 * this.boardScale, 5, 0xffef78);
      this.emitBurst("effect-pollen-fleck", x, y - 12 * this.boardScale, 14, 0.62, 0.1);
      this.emitBurst("effect-bee-pixel", x - 5 * this.boardScale, y - 18 * this.boardScale, 6, 0.38, 0.02);
      this.addCompanionPing(x, y - 18 * this.boardScale, 0xffef78, 0xffffff);
      return;
    }

    if (action === "scratch") {
      this.spawnWorldActionArc("dust-fleck", "chicken", x, y + 8 * this.boardScale, 3, 0xfff1a8);
      this.emitBurst("dust-fleck", x, y + 13 * this.boardScale, 16, 0.72, 0.25);
      this.addScratchMarks(x, y);
      return;
    }

    if (action === "forage") {
      this.spawnWorldActionArc("effect-gold-coin", "chicken", x, y - 7 * this.boardScale, 2, 0xffef78);
      this.emitBurst("dust-fleck", x, y + 11 * this.boardScale, 12, 0.58, 0.22);
      this.addCompanionPing(x, y - 12 * this.boardScale, 0xffef78, 0xffffff);
      return;
    }

    if (action === "scurry") {
      this.spawnWorldActionArc("effect-gold-coin", "field_mouse", x, y - 5 * this.boardScale, 2, 0xffef78);
      this.emitBurst("dust-fleck", x, y + 9 * this.boardScale, 10, 0.52, 0.24);
      this.addCompanionPing(x, y - 11 * this.boardScale, 0xffef78, 0xffffff);
      return;
    }

    if (action === "hop") {
      this.spawnWorldActionArc("effect-seed-kernel", "meadow_rabbit", x, y - 9 * this.boardScale, 2, 0xfff1a8);
      this.emitBurst("grass-fleck", x, y - 2 * this.boardScale, 12, 0.62, 0.28);
      this.addCompanionPing(x, y - 14 * this.boardScale, 0xdfffc8, 0xf7ffe8);
      return;
    }

    if (action === "burrow") {
      this.spawnWorldActionArc("dust-fleck", "earthworm", x, y + 6 * this.boardScale, 5, 0xd7a36f);
      this.emitBurst("dust-fleck", x, y + 13 * this.boardScale, 20, 0.82, 0.3);
      this.addCompanionPing(x, y - 10 * this.boardScale, 0xdfffc8, 0xf7ffe8);
      return;
    }

    this.spawnWorldActionArc("grass-fleck", "sheep", x, y - 2 * this.boardScale, 4, 0xdfffc8);
    this.emitBurst("grass-fleck", x, y - 3 * this.boardScale, 18, 0.86, 0.34);
    this.addCompanionPing(x, y - 13 * this.boardScale, 0xdfffc8, 0xf7ffe8);
  }

  private addCompanionPing(x: number, y: number, color: number, strokeColor: number): void {
    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const ping = this.add
      .star(x, y, 5, TILE_SIZE * 0.07 * this.boardScale, TILE_SIZE * 0.28 * this.boardScale, color, 0.78)
      .setStrokeStyle(2, strokeColor, 0.9)
      .setDepth(38);

    this.tweens.add({
      targets: ping,
      angle: 40,
      scaleX: 1.45,
      scaleY: 1.45,
      y: y - 12 * this.boardScale,
      alpha: 0,
      duration: 430,
      ease: "Sine.easeOut",
      onComplete: () => ping.destroy(),
    });
  }

  private addScratchMarks(x: number, y: number): void {
    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const marks = this.add.graphics().setDepth(38);
    const size = TILE_SIZE * this.boardScale;
    marks.lineStyle(Math.max(2, 3 * this.boardScale), 0xfff1a8, 0.9);

    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * size * 0.13;
      marks.lineBetween(x - size * 0.2 + offset, y - size * 0.12, x + size * 0.08 + offset, y + size * 0.17);
    }

    this.tweens.add({
      targets: marks,
      alpha: 0,
      y: marks.y + 5 * this.boardScale,
      duration: 420,
      ease: "Sine.easeOut",
      onComplete: () => marks.destroy(),
    });
  }

  private playCactusPrickFeedback(tile: FieldTile): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const x = position.x;
    const y = position.y - 6 * this.boardScale;
    this.emitBurst("crit-fleck", x, y, 12, 0.7, 0.08);

    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const flash = this.add
      .star(x, y, 8, TILE_SIZE * 0.06 * this.boardScale, TILE_SIZE * 0.32 * this.boardScale, 0xffb7d5, 0.78)
      .setStrokeStyle(Math.max(1, 2 * this.boardScale), 0xf7ffe8, 0.9)
      .setDepth(39);

    this.tweens.add({
      targets: flash,
      angle: 35,
      alpha: 0,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private playWeedPullFeedback(tile: FieldTile, cleared: boolean): void {
    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const x = position.x;
    const y = position.y + 5 * this.boardScale;
    this.emitBurst("grass-fleck", x, y, cleared ? 14 : 8, 0.55, 0.2);

    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const tug = this.add.graphics().setDepth(38);
    const size = TILE_SIZE * this.boardScale;
    tug.lineStyle(Math.max(2, 4 * this.boardScale), cleared ? 0xdfffc8 : 0xb7eba5, 0.9);
    tug.lineBetween(x - size * 0.22, y + size * 0.08, x, y - size * 0.22);
    tug.lineBetween(x + size * 0.22, y + size * 0.08, x, y - size * 0.22);
    tug.lineStyle(Math.max(1, 2 * this.boardScale), 0xf7ffe8, 0.8);
    tug.lineBetween(x - size * 0.12, y + size * 0.02, x + size * 0.12, y + size * 0.02);

    this.tweens.add({
      targets: tug,
      y: tug.y - 9 * this.boardScale,
      alpha: 0,
      duration: 360,
      ease: "Sine.easeOut",
      onComplete: () => tug.destroy(),
    });
  }

  private playBlockedTileFeedback(tile: FieldTile): void {
    this.createTileView(tile);
    const view = this.tileViews.get(this.getTileKey(tile));
    if (!view) {
      return;
    }

    this.tweens.killTweensOf(view.base);
    this.resetBaseTilePose(view);
    const x = view.label.x;
    const y = view.label.y;
    this.tweens.add({
      targets: view.base,
      x: x + 4 * this.boardScale,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: "Sine.easeInOut",
      onComplete: () => {
        view.base.setPosition(x, y);
        view.base.setScale(this.boardScale);
      },
    });
  }

  private resetBaseTilePose(view: TileView): void {
    view.base.setPosition(view.label.x, view.label.y);
    view.base.setScale(this.boardScale);
  }

  private emitBurst(texture: string, x: number, y: number, quantity: number, _speedScale: number, _gravityScale: number): void {
    if (!this.isScreenPositionNearViewport({ x, y }, TILE_CULL_MARGIN_PX * 1.5)) {
      return;
    }

    const budgetedQuantity = this.getBudgetedBurstQuantity(quantity);
    if (budgetedQuantity <= 0) {
      return;
    }

    const particles = this.getBurstEmitter(texture);
    particles.explode(budgetedQuantity, x, y);
  }

  private emitUiBurst(texture: string, x: number, y: number, quantity: number, color = 0xffef78): void {
    if (this.children.list.length >= DISPLAY_OBJECT_CRITICAL_LIMIT || this.effectQuality <= MIN_EFFECT_QUALITY) {
      return;
    }

    const budgetedQuantity = Math.max(1, Math.ceil(quantity * Math.max(0.45, this.effectQuality)));
    const particles = this.getUiBurstEmitter(texture, color);
    particles.explode(budgetedQuantity, x, y);
  }

  private getBurstEmitter(texture: string): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = texture;
    const existing = this.burstEmitters.get(key);
    if (existing) {
      this.burstEmitters.delete(key);
      this.burstEmitters.set(key, existing);
      return existing;
    }

    const emitter = this.add
      .particles(0, 0, texture, this.getBurstEmitterConfig(texture))
      .setDepth(35);
    this.burstEmitters.set(key, emitter);
    this.pruneEmitterCache(this.burstEmitters, MAX_BURST_EMITTERS);
    return emitter;
  }

  private getUiBurstEmitter(texture: string, color: number): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = `${texture}:${color.toString(16)}`;
    const existing = this.uiBurstEmitters.get(key);
    if (existing) {
      this.uiBurstEmitters.delete(key);
      this.uiBurstEmitters.set(key, existing);
      return existing;
    }

    const emitter = this.add
      .particles(0, 0, texture, {
        lifespan: { min: 520, max: 880 },
        speed: { min: 34, max: 120 },
        angle: { min: 190, max: 350 },
        gravityY: 40,
        rotate: { min: -160, max: 160 },
        scale: { start: 1.35, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: [color, 0xffffff],
        emitting: false,
      })
      .setDepth(125);
    this.uiBurstEmitters.set(key, emitter);
    this.pruneEmitterCache(this.uiBurstEmitters, MAX_UI_BURST_EMITTERS);
    return emitter;
  }

  private getBurstEmitterConfig(texture: string): Phaser.Types.GameObjects.Particles.ParticleEmitterConfig {
    const config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      lifespan: { min: 360, max: 680 },
      speed: { min: 34, max: 92 },
      angle: { min: 205, max: 335 },
      gravityY: 58,
      rotate: { min: -120, max: 120 },
      scale: { start: 1.38, end: 0 },
      alpha: { start: 0.95, end: 0 },
      emitting: false,
    };

    if (texture.includes("water")) {
      config.speed = { min: 48, max: 118 };
      config.gravityY = 120;
    } else if (texture.includes("dust")) {
      config.speed = { min: 28, max: 72 };
      config.gravityY = 88;
      config.alpha = { start: 0.72, end: 0 };
    } else if (texture.includes("music")) {
      config.speed = { min: 24, max: 62 };
      config.angle = { min: 230, max: 310 };
      config.gravityY = -8;
      config.scale = { start: 1.12, end: 0 };
    } else if (texture.includes("gold") || texture.includes("crit")) {
      config.speed = { min: 42, max: 104 };
      config.gravityY = 34;
      config.alpha = { start: 1, end: 0 };
    }

    return config;
  }

  private pruneEmitterCache(cache: Map<string, Phaser.GameObjects.Particles.ParticleEmitter>, maxSize: number): void {
    while (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }

      cache.get(oldestKey)?.destroy();
      cache.delete(oldestKey);
    }
  }

  private playMilestoneCelebration(): void {
    this.flashScreen(0xffef78, 0.18, 460);
    this.emitUiBurst("crit-fleck", this.scale.width / 2, Math.max(150, this.boardTopY - 24), 46, 0xffef78);
    this.emitUiBurst("grass-fleck", this.scale.width / 2, Math.max(170, this.boardTopY), 34, 0xdfffc8);
    this.pulseText(this.milestoneText, 1.045);
  }

  private playJournalCelebration(): void {
    if (!this.journalButton || !this.resourceText) {
      return;
    }

    if (this.journalButton.visible) {
      this.playButtonCelebration(this.journalButton, 0xdfffc8, "dew-fleck");
      return;
    }

    this.emitUiBurst("dew-fleck", this.resourceText.x + this.resourceText.width * 0.5, this.resourceText.y + this.resourceText.height, 18, 0xdfffc8);
  }

  private playButtonCelebration(button: Phaser.GameObjects.Container, color: number, texture: string): void {
    if (!button.visible) {
      return;
    }

    this.pulseContainer(button, 1.08);
    this.emitUiBurst(texture, button.x, button.y, 22, color);
  }

  private playHudChipCelebration(id: HudChipId, texture: string, color: number, quantity = 14): void {
    const chip = this.hudChips.find((candidate) => candidate.id === id);
    if (!chip || !chip.container.visible) {
      return;
    }

    const x = chip.container.x + chip.width / 2;
    const y = chip.container.y + chip.bg.height / 2;
    this.pulseContainer(chip.container, 1.045);
    this.emitUiBurst(texture, x, y, quantity, color);
  }

  private playQuestRewardHudCelebration(reward: QuestDefinition["reward"]): void {
    if ((reward.gold ?? 0) > 0) {
      this.playHudChipCelebration("gold", "effect-gold-coin", 0xffef78, 12);
    }
    if ((reward.seeds ?? 0) > 0) {
      this.playHudChipCelebration("seeds", "effect-seed-kernel", 0xb7eba5, 12);
    }
    if ((reward.grassTouches ?? 0) > 0) {
      this.playHudChipCelebration("touches", "grass-fleck", 0xdfffc8, 12);
    }
    this.playHudChipCelebration("quest", "seed-fleck", 0xffef78, 8);
  }

  private flashScreen(color: number, alpha: number, duration: number): void {
    const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, color, alpha).setOrigin(0).setDepth(120);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private pulseContainer(container: Phaser.GameObjects.Container, scale = 1.06): void {
    this.tweens.killTweensOf(container);
    container.setScale(1);
    this.tweens.add({
      targets: container,
      scaleX: scale,
      scaleY: scale,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => container.setScale(1),
    });
  }

  private pulseText(text: Phaser.GameObjects.Text, scale = 1.04): void {
    this.tweens.killTweensOf(text);
    text.setScale(1);
    this.tweens.add({
      targets: text,
      scaleX: scale,
      scaleY: scale,
      duration: 100,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => text.setScale(1),
    });
  }

  private addTouchRing(x: number, y: number): void {
    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const ring = this.trackBoardTransient(
      this.add
        .ellipse(x, y, TILE_SIZE * 0.82 * this.boardScale, TILE_SIZE * 0.48 * this.boardScale, 0xf7ffe8, 0.18)
        .setStrokeStyle(4, 0xf7ffe8, 0.95)
        .setDepth(34),
    );

    this.tweens.add({
      targets: ring,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: 430,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  private addTouchFlash(x: number, y: number): void {
    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const flash = this.trackBoardTransient(
      this.add
        .rectangle(x, y, TILE_SIZE * 0.78 * this.boardScale, TILE_SIZE * 0.78 * this.boardScale, 0xf7ffe8, 0.36)
        .setDepth(36)
        .setAngle(45),
    );

    this.tweens.add({
      targets: flash,
      scaleX: 1.18,
      scaleY: 1.18,
      alpha: 0,
      duration: 180,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private addCritFlash(x: number, y: number): void {
    if (!this.reserveAmbientTransientObject()) {
      return;
    }

    const burst = this.trackBoardTransient(
      this.add
        .star(x, y, 7, TILE_SIZE * 0.18 * this.boardScale, TILE_SIZE * 0.72 * this.boardScale, 0xfff08a, 0.8)
        .setStrokeStyle(3, 0xffffff, 0.95)
        .setDepth(37),
    );

    this.tweens.add({
      targets: burst,
      angle: 45,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0,
      duration: 360,
      ease: "Sine.easeOut",
      onComplete: () => burst.destroy(),
    });
  }

  private trackBoardTransient<T extends Phaser.GameObjects.GameObject>(effect: T): T {
    this.boardTransientEffects.add(effect);
    effect.once("destroy", () => this.boardTransientEffects.delete(effect));
    return effect;
  }

  private clearBoardTransientEffects(): void {
    if (this.boardTransientEffects.size === 0) {
      return;
    }

    const effects = [...this.boardTransientEffects];
    this.boardTransientEffects.clear();
    for (const effect of effects) {
      this.tweens.killTweensOf(effect);
      effect.destroy();
    }
  }

  private addClassSlashMark(x: number, y: number): void {
    const slash = this.add.graphics().setDepth(39);
    const size = TILE_SIZE * this.boardScale;

    slash.lineStyle(Math.max(2, 5 * this.boardScale), 0xffffff, 0.9);
    slash.lineBetween(x - size * 0.42, y + size * 0.14, x + size * 0.42, y - size * 0.22);
    slash.lineStyle(Math.max(1, 2 * this.boardScale), 0xffef78, 0.95);
    slash.lineBetween(x - size * 0.34, y + size * 0.1, x + size * 0.34, y - size * 0.18);

    this.tweens.add({
      targets: slash,
      alpha: 0,
      x: slash.x + 5 * this.boardScale,
      y: slash.y - 4 * this.boardScale,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => slash.destroy(),
    });
  }

  private floatMusicNote(x: number, y: number): void {
    const note = this.add
      .image(x + 16 * this.boardScale, y - 30 * this.boardScale, "class-music-note")
      .setScale(2.2 * this.boardScale)
      .setTint(0xffef78)
      .setDepth(40);

    this.tweens.add({
      targets: note,
      x: note.x + 12 * this.boardScale,
      y: note.y - 30 * this.boardScale,
      angle: 16,
      alpha: 0,
      scaleX: note.scaleX * 1.24,
      scaleY: note.scaleY * 1.24,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => note.destroy(),
    });
  }

  private createTileTextures(): void {
    this.createDirtTexture("tile-dirt", 0x8a6139, 0x6b4529);
    this.createDirtTexture("tile-stubble", 0x6f4c2f, 0x4c301f, true);
    for (const tier of GRASS_TIERS) {
      this.createGrassTexture(`grass-${tier.id}`, tier.colors, false, false);
      this.createGrassTexture(`grass-${tier.id}-dewy`, brightenColors(tier.colors, 0x264c55), true, false);
      this.createGrassTexture(`grass-${tier.id}-lush`, brightenColors(tier.colors, 0x173d1f), false, true);
    }
    this.createParticleTexture("grass-fleck", [0xb4f47a, 0x6edb58, 0x2f8436]);
    this.createParticleTexture("dew-fleck", [0xd7fff2, 0xa9f2bc, 0x75d894]);
    this.createParticleTexture("dust-fleck", [0xc7975d, 0x8a6139, 0x6f4c2f]);
    this.createParticleTexture("seed-fleck", [0xffe08a, 0xc69232, 0x6d4c19]);
    this.createParticleTexture("gold-fleck", [0xffffff, 0xffef78, 0xc69232]);
    this.createParticleTexture("crit-fleck", [0xffffff, 0xffef78, 0xff9f43]);
    this.createParticleTexture("sun-fleck", [0xffffff, 0xffef78, 0xffb347]);
    this.createParticleTexture("breeze-fleck", [0xf7ffe8, 0xb7eba5, 0x5cae62]);
    this.createSlashFleckTexture();
    this.createMusicNoteTexture();
    this.createCactusTexture();
    this.createWeedTexture();
    this.createMowerTexture();
    this.createWeatherTextures();
  }

  private createDirtTexture(key: string, baseColor: number, shadowColor: number, stubble = false): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();

    graphics.fillStyle(0x4f3420, 1);
    graphics.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    graphics.fillStyle(baseColor, 1);
    graphics.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
    graphics.fillStyle(0xa87a4a, 0.45);
    graphics.fillRect(7, 7, TILE_SIZE - 14, 2);
    graphics.fillRect(7, 9, 2, TILE_SIZE - 16);
    graphics.fillStyle(shadowColor, 0.45);
    graphics.fillRect(7, TILE_SIZE - 9, TILE_SIZE - 14, 2);
    graphics.fillRect(TILE_SIZE - 9, 9, 2, TILE_SIZE - 16);

    for (let i = 0; i < 42; i += 1) {
      const x = Phaser.Math.Between(8, TILE_SIZE - 10);
      const y = Phaser.Math.Between(8, TILE_SIZE - 10);
      const color = Phaser.Utils.Array.GetRandom([0x744b2d, 0x9c6c3e, 0x5f3b25]);
      graphics.fillStyle(color, 0.6);
      graphics.fillRect(x, y, Phaser.Math.Between(1, 3), Phaser.Math.Between(1, 2));
    }

    if (stubble) {
      for (let i = 0; i < 24; i += 1) {
        const x = Phaser.Math.Between(10, TILE_SIZE - 12);
        const y = Phaser.Math.Between(10, TILE_SIZE - 12);
        graphics.fillStyle(Phaser.Utils.Array.GetRandom([0x315f2c, 0x3f7b33, 0x24491f]), 0.9);
        graphics.fillRect(x, y, 2, Phaser.Math.Between(2, 5));
      }
    }

    graphics.generateTexture(key, TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private createGrassTexture(key: string, colors: number[], dewy: boolean, lush: boolean): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    const inset = lush ? 5 : 7;
    const patchSize = TILE_SIZE - inset * 2;

    graphics.fillStyle(0x214c26, 0.95);
    graphics.fillRect(inset - 2, inset - 2, patchSize + 4, patchSize + 4);
    graphics.fillStyle(colors[1], 1);
    graphics.fillRect(inset, inset, patchSize, patchSize);

    for (let i = 0; i < 130; i += 1) {
      const x = Phaser.Math.Between(inset + 1, TILE_SIZE - inset - 3);
      const y = Phaser.Math.Between(inset + 1, TILE_SIZE - inset - 4);
      const bladeHeight = Phaser.Math.Between(3, lush ? 10 : 7);
      const bladeColor = Phaser.Utils.Array.GetRandom(colors);
      graphics.fillStyle(bladeColor, 1);
      graphics.fillRect(x, y, 2, bladeHeight);

      if (Math.random() > 0.58) {
        graphics.fillRect(x - 1, y + 1, 1, Math.max(2, bladeHeight - 2));
      }
    }

    for (let i = 0; i < 22; i += 1) {
      const x = Phaser.Math.Between(inset, TILE_SIZE - inset - 4);
      const y = Phaser.Math.Between(inset, TILE_SIZE - inset - 4);
      graphics.fillStyle(Phaser.Utils.Array.GetRandom([colors[0], colors[2]]), 0.9);
      graphics.fillRect(x, y, Phaser.Math.Between(3, 6), 2);
    }

    if (dewy) {
      for (let i = 0; i < 10; i += 1) {
        const x = Phaser.Math.Between(inset + 3, TILE_SIZE - inset - 5);
        const y = Phaser.Math.Between(inset + 3, TILE_SIZE - inset - 5);
        graphics.fillStyle(0xd7fff2, 0.92);
        graphics.fillRect(x, y, 2, 2);
      }
    }

    if (lush) {
      for (let i = 0; i < 6; i += 1) {
        const x = Phaser.Math.Between(inset + 4, TILE_SIZE - inset - 8);
        const y = Phaser.Math.Between(inset + 4, TILE_SIZE - inset - 8);
        graphics.fillStyle(Phaser.Utils.Array.GetRandom([0xffd565, 0xff92bd, 0xf8ffe3]), 1);
        graphics.fillRect(x, y, 3, 3);
        graphics.fillStyle(0x265f2a, 1);
        graphics.fillRect(x + 1, y + 3, 1, 3);
      }
    }

    graphics.generateTexture(key, TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private createParticleTexture(key: string, colors: number[]): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();

    graphics.fillStyle(colors[0], 1);
    graphics.fillRect(1, 0, 3, 5);
    graphics.fillStyle(colors[1], 1);
    graphics.fillRect(0, 1, 5, 3);
    graphics.fillStyle(colors[2], 1);
    graphics.fillRect(2, 1, 2, 3);
    graphics.generateTexture(key, 5, 5);
    graphics.destroy();
  }

  private createCactusTexture(): void {
    const key = "hazard-cactus";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.24);
    graphics.fillEllipse(30, 47, 26, 8);
    graphics.fillStyle(0x245c36, 1);
    graphics.fillRoundedRect(24, 13, 13, 34, 6);
    graphics.fillRoundedRect(13, 25, 11, 18, 5);
    graphics.fillRoundedRect(36, 21, 11, 21, 5);
    graphics.fillStyle(0x39a04e, 1);
    graphics.fillRoundedRect(27, 10, 10, 36, 5);
    graphics.fillRoundedRect(15, 22, 10, 18, 5);
    graphics.fillRoundedRect(36, 18, 10, 22, 5);
    graphics.fillStyle(0x9be86b, 0.9);
    graphics.fillRect(31, 13, 2, 29);
    graphics.fillRect(18, 26, 2, 11);
    graphics.fillRect(40, 22, 2, 14);
    graphics.fillStyle(0xf7ffe8, 0.95);
    for (const point of [
      [26, 18],
      [37, 18],
      [27, 29],
      [38, 30],
      [23, 26],
      [45, 24],
      [21, 36],
      [42, 37],
    ]) {
      graphics.fillRect(point[0], point[1], 2, 1);
    }
    graphics.fillStyle(0xffb7d5, 0.95);
    graphics.fillRect(28, 7, 8, 4);
    graphics.fillRect(30, 5, 4, 8);
    graphics.generateTexture(key, TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private createMowerTexture(): void {
    const key = "hazard-mower";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.22);
    graphics.fillEllipse(40, 48, 56, 14);
    graphics.fillStyle(0x153524, 1);
    graphics.fillRoundedRect(13, 20, 54, 26, 7);
    graphics.fillStyle(0xff445c, 1);
    graphics.fillRoundedRect(17, 15, 42, 25, 6);
    graphics.fillStyle(0xffef78, 1);
    graphics.fillRect(52, 20, 10, 9);
    graphics.fillStyle(0xd7fff2, 1);
    graphics.fillRect(22, 19, 18, 6);
    graphics.fillStyle(0x06190f, 1);
    graphics.fillCircle(23, 45, 8);
    graphics.fillCircle(57, 45, 8);
    graphics.fillStyle(0x8a6139, 1);
    graphics.fillCircle(23, 45, 4);
    graphics.fillCircle(57, 45, 4);
    graphics.lineStyle(4, 0xb7eba5, 0.9);
    graphics.lineBetween(63, 23, 76, 11);
    graphics.lineStyle(2, 0xf7ffe8, 0.85);
    graphics.lineBetween(62, 28, 74, 28);
    graphics.generateTexture(key, 82, 62);
    graphics.destroy();
  }

  private createWeedTexture(): void {
    const key = "hazard-weeds";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0x000000, 0.18);
    graphics.fillEllipse(29, 47, 36, 9);
    for (const clump of [
      { x: 16, h: 27, c: 0x286b31 },
      { x: 24, h: 34, c: 0x3d9143 },
      { x: 32, h: 30, c: 0x2e7f38 },
      { x: 40, h: 25, c: 0x58ad4e },
    ]) {
      graphics.fillStyle(clump.c, 1);
      graphics.fillTriangle(clump.x, 47, clump.x + 5, 47 - clump.h, clump.x + 10, 47);
      graphics.fillStyle(0xb7eba5, 0.75);
      graphics.fillRect(clump.x + 5, 47 - clump.h + 6, 2, clump.h - 8);
    }
    graphics.fillStyle(0xffd565, 0.95);
    graphics.fillRect(26, 19, 4, 4);
    graphics.fillRect(38, 26, 3, 3);
    graphics.fillStyle(0xff92bd, 0.9);
    graphics.fillRect(19, 28, 3, 3);
    graphics.generateTexture(key, TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }

  private createSlashFleckTexture(): void {
    const key = "class-slash-fleck";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xffffff, 1);
    graphics.lineBetween(0, 5, 10, 1);
    graphics.lineStyle(1, 0xffef78, 0.92);
    graphics.lineBetween(1, 4, 9, 1);
    graphics.generateTexture(key, 11, 7);
    graphics.destroy();
  }

  private createMusicNoteTexture(): void {
    const key = "class-music-note";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0xffef78, 1);
    graphics.fillRect(5, 1, 2, 8);
    graphics.fillRect(7, 1, 5, 2);
    graphics.fillRect(10, 3, 2, 5);
    graphics.fillCircle(4, 9, 3);
    graphics.fillCircle(9, 11, 3);
    graphics.fillStyle(0xffffff, 0.88);
    graphics.fillRect(6, 1, 1, 6);
    graphics.generateTexture(key, 14, 14);
    graphics.destroy();
  }

  private createWeatherTextures(): void {
    this.createRainStreakTexture();
    this.createWeatherMoteTexture("weather-sun-mote", [0xffffff, 0xffef78, 0xffb347]);
    this.createWeatherMoteTexture("weather-pollen-mote", [0xffffff, 0xffe08a, 0xc69232]);
    this.createWeatherMoteTexture("weather-root-mote", [0xdfffc8, 0x75d894, 0x3f7b33]);
    this.createBreezeLeafTexture();
  }

  private createRainStreakTexture(): void {
    const key = "weather-rain-streak";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xd7fff2, 0.95);
    graphics.lineBetween(4, 0, 0, 18);
    graphics.lineStyle(1, 0xa8e8ff, 0.7);
    graphics.lineBetween(7, 1, 3, 18);
    graphics.generateTexture(key, 8, 20);
    graphics.destroy();
  }

  private createWeatherMoteTexture(key: string, colors: number[]): void {
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(colors[0], 0.95);
    graphics.fillRect(3, 0, 2, 8);
    graphics.fillRect(0, 3, 8, 2);
    graphics.fillStyle(colors[1], 0.9);
    graphics.fillRect(2, 2, 4, 4);
    graphics.fillStyle(colors[2], 0.75);
    graphics.fillRect(3, 3, 2, 2);
    graphics.generateTexture(key, 8, 8);
    graphics.destroy();
  }

  private createBreezeLeafTexture(): void {
    const key = "weather-breeze-leaf";
    if (this.textures.exists(key)) {
      return;
    }

    const graphics = this.add.graphics();
    graphics.fillStyle(0xdfffc8, 0.95);
    graphics.fillEllipse(8, 5, 14, 7);
    graphics.fillStyle(0x75d894, 0.95);
    graphics.fillEllipse(7, 5, 9, 5);
    graphics.lineStyle(1, 0x2f8436, 0.8);
    graphics.lineBetween(2, 5, 14, 5);
    graphics.generateTexture(key, 16, 10);
    graphics.destroy();
  }

  private getNextAutomationBreakthroughLine(): string {
    let nextBoost:
      | {
          systemName: string;
          targetOwned: number;
          multiplier: number;
          missing: number;
        }
      | undefined;

    for (const system of AUTOMATION_SYSTEMS) {
      const owned = getAutomationSystemOwned(this.state, system.id);
      if (owned <= 0) {
        continue;
      }

      const milestone = getNextAutomationSystemMilestone(this.state, system.id);
      if (!milestone) {
        continue;
      }

      const missing = Math.max(0, milestone.owned - owned);
      if (!nextBoost || missing < nextBoost.missing) {
        nextBoost = {
          systemName: system.name,
          targetOwned: milestone.owned,
          multiplier: milestone.multiplier,
          missing,
        };
      }
    }

    if (nextBoost) {
      return `Next auto boost: ${nextBoost.systemName} x${formatAutomationMultiplier(nextBoost.multiplier)} at ${nextBoost.targetOwned} (${nextBoost.missing} more)`;
    }

    const startableSystem = AUTOMATION_SYSTEMS.filter((system) => system.isUnlocked(this.state))
      .map((system) => ({
        system,
        cost: getAutomationSystemCost(system, getAutomationSystemOwned(this.state, system.id)),
      }))
      .sort((left, right) => left.cost - right.cost)[0];

    if (startableSystem) {
      return `Start automation: ${startableSystem.system.name} costs ${formatGrassTouches(startableSystem.cost)}`;
    }

    return "Next automation helper unlocks as the lawn grows.";
  }

  private refreshHudChips(automationTouchesPerMinute: number, automationUnitCount: number, readyQuestCount: number): void {
    this.setHudChipValue("touches", "Touches", formatHudChipNumber(this.state.grassTouches), false);
    this.setHudChipValue("seeds", "Seeds", formatHudChipNumber(this.state.seeds), false);
    this.setHudChipValue("gold", "Gold", formatHudChipNumber(this.state.gold), false);
    this.setHudChipValue(
      "auto",
      "Auto",
      automationTouchesPerMinute > 0
        ? formatHudChipRate(automationTouchesPerMinute)
        : automationUnitCount > 0
          ? `${automationUnitCount} systems`
          : "idle",
      automationTouchesPerMinute > 0,
    );
    this.setHudChipValue("quest", "Quest", readyQuestCount > 0 ? `${readyQuestCount} ready` : "active", readyQuestCount > 0);
  }

  private setHudChipValue(id: HudChipId, title: string, value: string, attention: boolean): void {
    const chip = this.hudChips.find((candidate) => candidate.id === id);
    if (!chip) {
      return;
    }

    this.setTextIfChanged(chip.title, title);
    this.setTextIfChanged(chip.value, value);
    const primary = id === "touches";
    const valueSize = value.length > 11 || chip.width < 100 ? 12 : chip.width < 130 ? 14 : primary ? 17 : 16;
    chip.title.setColor(attention ? "#fff3a8" : primary ? "#dfffc8" : "#a9d8a1");
    chip.value.setColor(primary ? "#ffffff" : attention ? "#fff7c7" : "#f7ffe8");
    chip.value.setFontSize(valueSize);
    chip.glow.setVisible(attention);
    chip.bg.setFillStyle(primary ? 0x0f3b20 : 0x0d331b, primary ? 0.96 : 0.92);
    chip.bg.setStrokeStyle(primary || attention ? 3 : 2, attention ? 0xffef78 : primary ? 0xb7eba5 : 0xffef78, attention ? 0.98 : primary ? 0.86 : 0.64);
    chip.iconBg.setStrokeStyle(2, attention ? 0xffef78 : 0x75d894, attention ? 0.98 : 0.9);
  }

  private getReadyUnlockCounts(keys: Set<string>): { skill: number; seed: number; store: number } {
    const counts = { skill: 0, seed: 0, store: 0 };
    for (const key of keys) {
      if (key.startsWith("upgrade:") || key.startsWith("prestige:")) {
        counts.skill += 1;
      } else if (key.startsWith("seed:")) {
        counts.seed += 1;
      } else if (key.startsWith("automation:") || key.startsWith("gold:")) {
        counts.store += 1;
      }
    }

    return counts;
  }

  private formatReadyMenuLabel(baseLabel: string, readyCount: number): string {
    if (readyCount <= 0) {
      return baseLabel;
    }

    return `${baseLabel} ${readyCount > 9 ? "9+" : readyCount}`;
  }

  private formatActionMenuLabel(icon: string, baseLabel: string, readyCount = 0): string {
    return this.formatReadyMenuLabel(`${icon} ${baseLabel}`, readyCount);
  }

  private formatAffordabilityPreview(current: number, cost: number, formatValue: (value: number) => string, unitLabel = ""): string {
    if (current >= cost) {
      return "Ready now";
    }

    const missing = Math.max(0, cost - current);
    const progress = cost > 0 ? Phaser.Math.Clamp(Math.floor((current / cost) * 100), 0, 99) : 0;
    const unitSuffix = unitLabel ? ` ${unitLabel}` : "";
    return `Need ${formatValue(missing)} more${unitSuffix} (${progress}%)`;
  }

  private getGoalNudgeData(
    readyQuestCount: number,
    nextQuest: QuestDefinition | undefined,
    nextMilestone: (typeof MILESTONES)[number] | undefined,
    nextTier: ReturnType<typeof getNextGrassTier>,
    readyUnlockKeys: Set<string>,
    nextAutomationBreakthroughLine: string,
  ): GoalNudgeData {
    if (readyQuestCount > 0) {
      return {
        icon: "Q",
        text: `Next: claim ${readyQuestCount} quest reward${readyQuestCount === 1 ? "" : "s"}`,
        color: 0xffef78,
      };
    }

    const prestigeReady = [...readyUnlockKeys].some((key) => key.startsWith("prestige:"));
    if (prestigeReady) {
      return { icon: "SK", text: "Next: prestige is ready", color: 0xffef78 };
    }

    const readyUpgrade = UPGRADES.find((upgrade) => [...readyUnlockKeys].some((key) => key.startsWith(`upgrade:${upgrade.id}:`)));
    if (readyUpgrade) {
      return { icon: "SK", text: `Next: upgrade ${readyUpgrade.name}`, color: 0xffef78 };
    }

    const readySeedItem = SEED_SHOP_ITEMS.find((item) => readyUnlockKeys.has(`seed:${item.id}`));
    if (readySeedItem) {
      return { icon: "SE", text: `Next: buy ${readySeedItem.name}`, color: 0xb7eba5 };
    }

    const readyAutomation = AUTOMATION_SYSTEMS.find((system) => [...readyUnlockKeys].some((key) => key.startsWith(`automation:${system.id}:`)));
    if (readyAutomation) {
      return { icon: "AI", text: `Next: hire ${readyAutomation.name}`, color: 0xbff4ff };
    }

    const readyGoldItem = GOLD_STORE_ITEMS.find((item) => [...readyUnlockKeys].some((key) => key.startsWith(`gold:${item.id}:`)));
    if (readyGoldItem) {
      return { icon: "ST", text: `Next: buy ${readyGoldItem.name}`, color: 0xffef78 };
    }

    if (nextQuest) {
      return { icon: "Q", text: `Next: ${nextQuest.name} - ${formatQuestProgress(nextQuest, this.state)}`, color: 0xffef78 };
    }

    const nextSeedItem = SEED_SHOP_ITEMS.find((item) => !this.state.seedShopPurchases[item.id] && item.isUnlocked(this.state));
    if (nextSeedItem && this.state.seeds < nextSeedItem.cost) {
      return {
        icon: "SE",
        text: `Next: ${nextSeedItem.name} needs ${nextSeedItem.cost - Math.floor(this.state.seeds)} seeds`,
        color: 0xb7eba5,
      };
    }

    if (nextMilestone) {
      return {
        icon: "GT",
        text: `Next: ${nextMilestone.name} at ${formatGrassTouches(nextMilestone.requiredLifetimeTouches)} lifetime touches`,
        color: 0xb7eba5,
      };
    }

    if (nextTier) {
      return {
        icon: "GT",
        text: `Next: ${nextTier.name} at ${formatGrassTouches(nextTier.unlockAtLifetimeTouches)} touches`,
        color: 0xb7eba5,
      };
    }

    return { icon: "AI", text: nextAutomationBreakthroughLine, color: 0xbff4ff };
  }

  private refreshGoalNudge(data: GoalNudgeData): void {
    const visible = !this.hasBlockingOverlayOpen() && data.text.length > 0;
    this.setVisibleIfChanged(this.goalNudgeRoot, visible);
    if (!visible) {
      return;
    }

    this.goalNudgeBg.setStrokeStyle(2, data.color, 0.78);
    this.goalNudgeIcon.setText(data.icon).setColor(this.colorToHex(data.color));
    this.setTextIfChanged(this.goalNudgeText, this.compactGoalNudgeText(data.text));
  }

  private compactGoalNudgeText(text: string): string {
    const limit = this.isMobilePortrait() ? 38 : this.scale.width < 760 ? 54 : 68;
    if (text.length <= limit) {
      return text;
    }

    return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
  }

  private refreshUi(forcePanels = true): void {
    const nextMilestone = this.profileScope("ui:nextMilestone", () =>
      MILESTONES.find((milestone) => !this.state.reachedMilestones.includes(milestone.id)),
    );
    const nextQuest = this.profileScope("ui:nextQuest", () =>
      QUESTS.find((quest) => !this.state.claimedQuestIds.includes(quest.id) && isQuestAvailable(this.state, quest)),
    );
    const currentReadyQuestKeys = this.profileScope("ui:readyQuests", () => this.getReadyQuestKeys());
    const readyQuestCount = currentReadyQuestKeys.size;
    const readyUnlockKeys = this.profileScope("ui:readyUnlocks", () => this.getReadyUnlockKeys());
    const readyUnlockCounts = this.getReadyUnlockCounts(readyUnlockKeys);
    const nextTier = getNextGrassTier(this.state);
    const nextAutomationBreakthroughLine = this.profileScope("ui:autoGoal", () => this.getNextAutomationBreakthroughLine());
    const mobilePortrait = this.isMobilePortrait();
    const stats = this.profileScope("ui:stats", () => this.getCachedRuntimeStats());
    const automationTouchesPerMinute = this.profileScope("calc:autoTotal", () => getTotalAutomationTouchesPerMinute(this.state, stats));
    const automationUnitCount = this.profileScope("calc:autoUnits", () => getAutomationUnitCount(this.state));
    const refreshPanels = forcePanels || this.panelUiRefreshElapsed >= PANEL_UI_REFRESH_INTERVAL_MS;
    const refreshWorldObjects = forcePanels || this.worldObjectUiRefreshElapsed >= WORLD_OBJECT_UI_REFRESH_INTERVAL_MS;
    if (refreshPanels) {
      this.panelUiRefreshElapsed = 0;
    }
    if (refreshWorldObjects) {
      this.worldObjectUiRefreshElapsed = 0;
    }

    const overlayOpen = this.hasBlockingOverlayOpen();
    this.setTextIfChanged(this.titleText, "Grass Touching Simulator");
    this.setVisibleIfChanged(this.ambientSpores, !overlayOpen);
    this.profileScope("ui:weatherVisuals", () => {
      this.layoutSeasonVisuals();
      this.refreshWeatherVisuals();
    });
    this.profileScope("ui:hudChips", () => this.refreshHudChips(automationTouchesPerMinute, automationUnitCount, readyQuestCount));
    this.profileScope("ui:triggerFeed", () => this.renderTriggerFeed());
    this.profileScope("ui:combo", () => this.refreshComboBadge());
    setTextButtonText(this.skillButton, this.formatActionMenuLabel(UI_ACTION_ICONS.skills, mobilePortrait ? "Skill" : "Skills", readyUnlockCounts.skill));
    setTextButtonText(this.questButton, this.formatActionMenuLabel(UI_ACTION_ICONS.quests, mobilePortrait ? "Quest" : "Quests", readyQuestCount));
    setTextButtonText(this.seedButton, this.formatActionMenuLabel(UI_ACTION_ICONS.seeds, mobilePortrait ? "Seed" : "Seeds", readyUnlockCounts.seed));
    setTextButtonText(this.storeButton, this.formatActionMenuLabel(UI_ACTION_ICONS.store, mobilePortrait ? "Shop" : "Store", readyUnlockCounts.store));
    setTextButtonText(this.autoButton, this.formatActionMenuLabel(UI_ACTION_ICONS.automation, "Auto"));
    setTextButtonText(this.journalButton, this.formatActionMenuLabel(UI_ACTION_ICONS.journal, mobilePortrait ? "Log" : "Journal"));
    setTextButtonText(this.optionsButton, this.formatActionMenuLabel(UI_ACTION_ICONS.options, mobilePortrait ? "Opts" : "Options"));
    this.profileScope("ui:buttons", () => this.refreshMenuButtonAttention(currentReadyQuestKeys, readyUnlockKeys));
    this.profileScope("ui:goalNudge", () =>
      this.refreshGoalNudge(
        this.getGoalNudgeData(readyQuestCount, nextQuest, nextMilestone, nextTier, readyUnlockKeys, nextAutomationBreakthroughLine),
      ),
    );
    this.refreshJournalAccess();
    if (this.skillTreeOpen) {
      this.setTextIfChanged(this.skillResourceText, this.getSkillResourceText());
      this.refreshPrestigeButton();
    }
    if (this.questLogOpen && refreshPanels) {
      this.profileScope("ui:questLog", () => this.refreshQuestLog());
    }
    if (this.journalOpen && refreshPanels) {
      this.profileScope("ui:journal", () => this.refreshJournal());
    }
    if (this.seedShopOpen && refreshPanels) {
      this.profileScope("ui:seedShop", () => this.refreshSeedShop());
    }
    if (this.storeOpen && refreshPanels) {
      this.profileScope("ui:store", () => this.refreshGoldStore());
    }
    if (this.automationOpen && refreshPanels) {
      this.profileScope("ui:autoPanel", () => this.refreshAutomationPanel());
    }
    if (refreshWorldObjects) {
      this.profileScope("ui:worldObjects", () => {
        this.syncWorldObjects();
        this.layoutWorldObjects();
      });
    }
    this.profileScope("ui:milestoneText", () => {
      if (mobilePortrait) {
        const mobileObjective =
          readyQuestCount > 0
            ? `Quest ready: ${readyQuestCount}`
            : nextMilestone
              ? `Next spread: ${nextMilestone.name} at ${formatGrassTouches(nextMilestone.requiredLifetimeTouches)}`
              : nextTier
                ? `Next tier: ${nextTier.name} at ${formatGrassTouches(nextTier.unlockAtLifetimeTouches)}`
                : nextAutomationBreakthroughLine;
        this.setTextIfChanged(this.milestoneText, mobileObjective);
        return;
      }

      this.setTextIfChanged(
        this.milestoneText,
        [
          nextMilestone
            ? `Next spread: ${nextMilestone.name} at ${formatGrassTouches(nextMilestone.requiredLifetimeTouches)} lifetime touches`
            : "All surface spreads discovered.",
          readyQuestCount > 0
            ? `Quest ready: ${readyQuestCount}`
            : nextQuest
              ? `Quest: ${nextQuest.name} - ${formatQuestProgress(nextQuest, this.state)}`
              : "All current quests claimed.",
          nextTier ? `Next tier: ${nextTier.name} at ${formatGrassTouches(nextTier.unlockAtLifetimeTouches)}` : "",
          nextAutomationBreakthroughLine,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    });
    this.milestoneText.setPosition(mobilePortrait ? 20 : 26, this.layoutGoalNudge(this.layoutComboBadge()));
    this.layoutTriggerFeed();

    if (this.skillTreeOpen && refreshPanels) {
      this.profileScope("ui:skillTree", () => this.refreshSkillTree());
    }
  }

  private refreshSkillTree(): void {
    for (const upgrade of UPGRADES) {
      const view = this.skillNodeViews.get(upgrade.id);
      if (!view) {
        continue;
      }

      const level = this.state.upgrades[upgrade.id]?.level ?? 0;
      const unlocked = canUnlockUpgrade(this.state, upgrade);
      const maxed = level >= upgrade.maxLevel;
      const cost = getUpgradeCost(upgrade, level);
      const available = unlocked && !maxed && canAffordGrassTouches(this.state.grassTouches, cost);
      const visible = this.isSkillVisible(upgrade.id);
      const selected = upgrade.id === this.selectedSkillId;
      const renderKey = [visible, selected, level, unlocked, available, maxed].join("|");

      if (view.renderKey === renderKey) {
        continue;
      }

      view.renderKey = renderKey;
      this.setVisibleIfChanged(view.container, visible);
      if (!visible) {
        this.stopSkillHoverTremble(upgrade.id);
        this.setReadyPulse(view.readyGlow, false);
        view.bg.disableInteractive();
        continue;
      }

      view.bg.setInteractive({ useHandCursor: true });

      const stroke = selected ? 0xfff08a : available ? 0xf4df6a : level > 0 ? upgrade.tree.color : 0x506056;
      const nodeAlpha = unlocked || level > 0 ? 1 : 0.48;
      const frameKey = selected
        ? SKILL_NODE_FRAME_KEYS.selected
        : level > 0
          ? SKILL_NODE_FRAME_KEYS.owned
          : unlocked
            ? SKILL_NODE_FRAME_KEYS.available
            : SKILL_NODE_FRAME_KEYS.locked;
      const frameSize = selected ? 74 : available ? 68 : level > 0 ? 66 : SKILL_NODE_VISUAL_SIZE;

      view.container.setAlpha(nodeAlpha);
      view.bg.setFillStyle(0xffffff, 0.001);
      view.bg.setStrokeStyle(1, stroke, 0);
      view.glow.setFillStyle(stroke, selected ? 0.28 : available ? 0.22 : level > 0 ? 0.14 : 0.05);
      view.glow.setStrokeStyle(selected ? 3 : 2, stroke, selected ? 0.72 : available ? 0.48 : level > 0 ? 0.32 : 0.12);
      this.setReadyPulse(view.readyGlow, available, 1.12, 1.16);
      view.plate.setFillStyle(level > 0 ? 0x102f1a : unlocked ? 0x0d2617 : 0x07150e, unlocked || level > 0 ? 0.9 : 0.76);
      view.plate.setStrokeStyle(selected ? 4 : available ? 3 : 2, stroke, selected ? 0.95 : available ? 0.82 : level > 0 ? 0.58 : 0.28);
      view.frame.setTexture(frameKey);
      view.frame.clearTint();
      view.frame.setAlpha(selected ? 1 : available ? 1 : level > 0 ? 0.94 : 0.72);
      view.frame.setDisplaySize(frameSize, frameSize);
      view.icon.setTexture(getSkillIconKey(upgrade.id));
      this.setVisibleIfChanged(view.icon, unlocked || level > 0);
      view.icon.setAlpha(available || selected ? 1 : level > 0 ? 0.95 : 0.72);
      view.icon.setTint(level > 0 || unlocked ? 0xffffff : 0x8fa08f);
      this.setVisibleIfChanged(view.lockedIcon, !unlocked && level === 0);
      view.lockedIcon.setColor(selected ? "#fff08a" : "#dfffc8");
      this.setTextIfChanged(view.level, `Lv ${level}/${upgrade.maxLevel}`);
      view.level.setColor(available || selected ? "#f4df6a" : level > 0 ? "#dfffc8" : "#7c8b82");
    }

    this.refreshSkillDetail();
  }

  private refreshMenuButtonAttention(currentReadyQuestKeys = this.getReadyQuestKeys(), readyUnlockKeys = this.getReadyUnlockKeys()): void {
    const readyUnlockList = [...readyUnlockKeys];
    setTextButtonAttention(this.skillButton, readyUnlockList.some((key) => key.startsWith("upgrade:") || key.startsWith("prestige:")));
    setTextButtonAttention(this.seedButton, readyUnlockList.some((key) => key.startsWith("seed:")));
    setTextButtonAttention(
      this.storeButton,
      readyUnlockList.some((key) => key.startsWith("automation:") || key.startsWith("gold:")),
    );
    setTextButtonAttention(this.questButton, currentReadyQuestKeys.size > 0);
  }

  private setReadyItemAttention(
    view: { attentionGlow: Phaser.GameObjects.Rectangle; readyBadge: Phaser.GameObjects.Text },
    active: boolean,
  ): void {
    view.readyBadge.setVisible(active);
    this.setReadyPulse(view.attentionGlow, active, 1.02, 1.06);
  }

  private setReadyPulse(
    glow: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse,
    active: boolean,
    scaleX = 1.06,
    scaleY = 1.1,
  ): void {
    if (glow.getData("readyPulseActive") === active) {
      return;
    }

    glow.setData("readyPulseActive", active);
    this.tweens.killTweensOf(glow);
    glow.setVisible(active);

    if (!active) {
      glow.setAlpha(1);
      glow.setScale(1);
      return;
    }

    glow.setAlpha(0.78);
    glow.setScale(1);
    this.tweens.add({
      targets: glow,
      alpha: 0.22,
      scaleX,
      scaleY,
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private refreshComboBadge(): void {
    const count = this.combo.getCount();
    const show = count >= 2 && !this.hasBlockingOverlayOpen();
    this.setVisibleIfChanged(this.comboBadge, show);

    if (!show) {
      this.activeComboSource = "manual";
      return;
    }

    const multiplier = this.combo.getMultiplier();
    const remaining = Phaser.Math.Clamp((this.combo.getExpiresAt() - Date.now()) / this.combo.getWindowMs(), 0, 1);
    const badgeWidth = this.comboBadgeBg.width;
    const meterWidth = Math.max(8, (badgeWidth - 24) * remaining);
    const multiplierText = multiplier > 1 ? ` x${multiplier.toFixed(multiplier >= 2 ? 0 : 2)}` : "";
    const automated = this.activeComboSource !== "manual";

    this.comboBadgeText.setColor(automated ? "#bff4ff" : "#f7ffe8");
    this.comboBadgeBg.setStrokeStyle(3, automated ? 0xa8e8ff : 0xf4df6a, automated ? 0.9 : 0.82);
    this.setTextIfChanged(this.comboBadgeText, `${automated ? "Auto Streak" : "Combo"} ${count}${multiplierText}`);
    this.comboBadgeMeter.setSize(meterWidth, 4);
    this.comboBadgeMeter.setFillStyle(automated ? 0xa8e8ff : multiplier > 1 ? 0xf4df6a : 0xb7eba5, 0.92);
  }

  private refreshQuestLog(): void {
    const readyCount = QUESTS.filter((quest) => isQuestClaimable(this.state, quest)).length;
    const claimedCount = this.state.claimedQuestIds.length;
    const filteredQuests = this.getFilteredQuests();
    const filterCounts = this.getQuestFilterCounts();
    const relevantQuestCount = this.getRelevantQuestCount();

    setTextButtonText(this.questButton, this.formatActionMenuLabel(UI_ACTION_ICONS.quests, "Quests", readyCount));
    setTextButtonText(this.questClaimReadyButton, readyCount > 0 ? `Claim Ready (${readyCount})` : "Claim Ready");
    setTextButtonEnabled(this.questClaimReadyButton, readyCount > 0);
    this.questResourceText?.setText(
      `Showing: ${filteredQuests.length}/${relevantQuestCount} | Claimed: ${claimedCount}/${relevantQuestCount} | Ready: ${readyCount}`,
    );
    this.questStatusText?.setText(this.getQuestFilterStatusText(filteredQuests.length));

    for (const filter of QUEST_FILTERS) {
      const view = this.questFilterViews.get(filter.id);
      if (!view) {
        continue;
      }

      view.label.setText(`${filter.label} ${filterCounts[filter.id]}`);
    }

    for (const quest of QUESTS) {
      const view = this.questItemViews.get(quest.id);
      if (!view) {
        continue;
      }

      const available = isQuestAvailable(this.state, quest);
      const complete = available && quest.isComplete(this.state);
      const claimed = this.state.claimedQuestIds.includes(quest.id);
      const ready = complete && !claimed;

      view.bg.setFillStyle(claimed ? 0x20351f : complete ? 0x1c4728 : available ? 0x12341c : 0x14231a, claimed ? 0.74 : 0.95);
      view.bg.setStrokeStyle(3, claimed ? 0x51615a : ready ? 0xffef78 : available ? 0xb7eba5 : 0x496455, ready ? 0.98 : 0.62);
      view.container.setAlpha(claimed ? 0.72 : available ? 1 : 0.78);
      view.progress.setText(claimed ? "Claimed" : formatQuestProgress(quest, this.state));
      view.progress.setColor(ready ? "#f4df6a" : available ? "#b7eba5" : "#8ea594");
      view.reward.setText(`Reward:\n${formatQuestReward(quest.reward)}`);
      setTextButtonText(view.claimButton, claimed ? "Claimed" : ready ? "Claim" : "Locked");
      setTextButtonEnabled(view.claimButton, ready);
      this.setReadyItemAttention(view, ready);
    }

    if (this.questLogOpen) {
      this.layoutQuestLog();
    }
  }

  private refreshJournalAccess(): void {
    if (!this.journalRoot) {
      return;
    }

    this.layoutMenuButtons();
  }

  private refreshJournal(): void {
    if (!this.journalRoot) {
      return;
    }

    this.refreshJournalAccess();

    const ownedCompanions = GOLD_STORE_ITEMS.filter((item) => item.kind === "animal" && getInventoryQuantity(this.state, item.id) > 0);
    const journalResourceParts = [
      `Grass: ${this.state.journal.discoveredGrassTiers.length}/${GRASS_TIERS.length}`,
      `Weather: ${this.state.journal.seenWeatherIds.length}/${WEATHER_TYPES.length}`,
      `Hazards: ${this.state.journal.seenHazardIds.length}/4`,
      `Companions: ${ownedCompanions.length}/${GOLD_STORE_ITEMS.filter((item) => item.kind === "animal").length}`,
    ];
    this.journalResourceText.setText(
      this.scale.width < 720
        ? [`${journalResourceParts[0]} | ${journalResourceParts[1]}`, `${journalResourceParts[2]} | ${journalResourceParts[3]}`].join("\n")
        : journalResourceParts.join(" | "),
    );

    this.journalBodyText.setText(
      [
        this.formatJournalGrassSection(),
        this.formatJournalTraitSection(),
        this.formatJournalWeatherSection(),
        this.formatJournalHazardSection(),
        this.formatJournalCompanionSection(),
        this.formatJournalProgressSection(),
      ].join("\n\n"),
    );
    this.layoutJournal();
  }

  private updateJournalDiscoveries(): boolean {
    let changed = false;

    if (this.state.activeWeatherId) {
      changed = this.addJournalValue(this.state.journal.seenWeatherIds, this.state.activeWeatherId) || changed;
    }

    for (const [key, hazard] of Object.entries(this.state.tileHazards)) {
      if (hazard && getTileHazard(this.state, key as TileKey) === hazard) {
        changed = this.addJournalValue(this.state.journal.seenHazardIds, hazard.id) || changed;
      }
    }
    if (getPrickedRemainingMs(this.state) > 0) {
      changed = this.addJournalValue(this.state.journal.seenHazardIds, "pricked") || changed;
    }
    if (this.state.hazardStats.mowerPasses > 0) {
      changed = this.addJournalValue(this.state.journal.seenHazardIds, "mower") || changed;
    }

    if (this.combo.getCount() > this.state.journal.bestComboCount) {
      this.state.journal.bestComboCount = this.combo.getCount();
      changed = true;
    }

    return changed;
  }

  private recordTileDiscovery(tile: FieldTile): boolean {
    const tierChanged = this.addJournalValue(this.state.journal.discoveredGrassTiers, tile.tier);
    const traitChanged = this.addJournalValue(this.state.journal.discoveredTileTraits, tile.trait);
    return tierChanged || traitChanged;
  }

  private recordTileDiscoveries(tiles: FieldTile[]): boolean {
    let changed = false;
    for (const tile of tiles) {
      changed = this.recordTileDiscovery(tile) || changed;
    }

    return changed;
  }

  private addJournalValue<T extends string>(values: T[], value: T): boolean {
    if (values.includes(value)) {
      return false;
    }

    values.push(value);
    this.showJournalDiscoveryToast(value);
    return true;
  }

  private showJournalDiscoveryToast(value: string): void {
    if (value === "normal" || value === "calm") {
      return;
    }

    const grassTier = GRASS_TIERS.find((tier) => tier.id === value);
    if (grassTier) {
      this.showMessage(`Field Journal: ${grassTier.name} recorded.`, 2600);
      this.playJournalCelebration();
      this.audio.play("unlock");
      return;
    }

    if (value === "dewy" || value === "lush") {
      this.showMessage(`Field Journal: ${value} grass trait recorded.`, 2400);
      this.playJournalCelebration();
      this.audio.play("seed");
      return;
    }

    const weather = WEATHER_TYPES.find((candidate) => candidate.id === value);
    if (weather && weather.id !== "calm") {
      this.showMessage(`Field Journal: ${weather.name} weather recorded.`, 2600);
      this.playJournalCelebration();
      this.audio.play("unlock");
      return;
    }

    if (value === "cactus" || value === "weeds" || value === "pricked" || value === "mower") {
      const label = value === "cactus" ? "Cactus" : value === "weeds" ? "Weeds" : value === "pricked" ? "Pricked" : "Robotic mower";
      this.showMessage(`Field Journal: ${label} recorded.`, 2600);
      this.playJournalCelebration();
      this.audio.play("unlock");
    }
  }

  private formatJournalGrassSection(): string {
    return [
      "Grass Specimens",
      ...GRASS_TIERS.map((tier) =>
        this.state.journal.discoveredGrassTiers.includes(tier.id)
          ? `- ${tier.name}: ${JOURNAL_GRASS_NOTES[tier.id]}`
          : `- Undiscovered grass at ${tier.unlockAtLifetimeTouches} lifetime touches.`,
      ),
    ].join("\n");
  }

  private formatJournalTraitSection(): string {
    const traits: TileTrait[] = ["normal", "dewy", "lush"];

    return [
      "Tile Traits",
      ...traits.map((trait) =>
        this.state.journal.discoveredTileTraits.includes(trait)
          ? `- ${this.formatTraitName(trait)}: ${JOURNAL_TRAIT_NOTES[trait]}`
          : `- Unknown trait: Keep touching and regrowing patches.`,
      ),
    ].join("\n");
  }

  private formatJournalWeatherSection(): string {
    return [
      "Weather Observed",
      ...WEATHER_TYPES.map((weather) =>
        this.state.journal.seenWeatherIds.includes(weather.id)
          ? `- ${weather.name}: ${JOURNAL_WEATHER_NOTES[weather.id]}`
          : `- Unseen weather: ${this.state.seedShopPurchases.weather_jar ? "Wait for the Weather Jar to shift." : "Unlock the Weather Jar."}`,
      ),
    ].join("\n");
  }

  private formatJournalHazardSection(): string {
    const stats = this.state.hazardStats;
    const activeStatus = getHazardStatusText(this.state) || "quiet";
    const counterplay = [
      this.state.seedShopPurchases.garden_gloves ? "Garden Gloves" : "",
      this.state.seedShopPurchases.compost_bin ? "Compost Bin" : "",
      this.state.seedShopPurchases.mower_boundary ? "Mower Boundary" : "",
    ].filter(Boolean);
    const entries: Array<{ id: JournalHazardId; label: string; stats: string; hidden: string }> = [
      {
        id: "cactus",
        label: "Cactus",
        stats: `${stats.cactusCleared} cleared, ${this.countActiveHazards("cactus")} active`,
        hidden: "Reach 180 lifetime touches and keep expanding the field.",
      },
      {
        id: "weeds",
        label: "Weeds",
        stats: `${stats.weedsPulled} pulls, ${stats.weedsCleared} cleared, ${this.countActiveHazards("weeds")} active`,
        hidden: "Reach 360 lifetime touches and keep some grown patches around.",
      },
      {
        id: "pricked",
        label: "Pricked",
        stats: `${stats.prickedCount} cactus pricks recorded`,
        hidden: "A cactus will explain this eventually.",
      },
      {
        id: "mower",
        label: "Robotic mower",
        stats: `${stats.mowerPasses} passes, ${stats.mowerTilesMown} patches mown, ${stats.hazardsClearedByMower} hazards cleared`,
        hidden: "Reach 720 lifetime touches and a bigger field.",
      },
    ];

    return [
      "Hazards & Counterplay",
      `- Current pressure: ${activeStatus}`,
      ...entries.map((entry) =>
        this.state.journal.seenHazardIds.includes(entry.id)
          ? `- ${entry.label}: ${JOURNAL_HAZARD_NOTES[entry.id]} (${entry.stats})`
          : `- Unrecorded hazard: ${entry.hidden}`,
      ),
      `- Counterplay owned: ${counterplay.length > 0 ? counterplay.join(", ") : "none yet"}`,
    ].join("\n");
  }

  private countActiveHazards(hazardId: "cactus" | "weeds"): number {
    let count = 0;
    const now = Date.now();
    for (const [key, hazard] of Object.entries(this.state.tileHazards)) {
      if (hazard?.id === hazardId && getTileHazard(this.state, key as TileKey, now)) {
        count += 1;
      }
    }
    return count;
  }

  private formatJournalCompanionSection(): string {
    const animals = GOLD_STORE_ITEMS.filter((item) => item.kind === "animal");

    return [
      "Companions",
      ...animals.map((item) => {
        const quantity = getInventoryQuantity(this.state, item.id);
        return quantity > 0
          ? `- ${item.name} x${quantity}: ${JOURNAL_COMPANION_NOTES[item.id] ?? item.description}`
          : `- Undiscovered companion: ${item.isUnlocked(this.state) ? "Available as future automation." : "Keep expanding the lawn systems."}`;
      }),
    ].join("\n");
  }

  private formatJournalProgressSection(): string {
    const bonuses = getJournalCollectionBonuses(this.state);
    const collectionBonusLines =
      this.state.seedShopPurchases.field_journal === true
        ? [
            `- Specimen power: +${Math.round(bonuses.rareTierMultiplierBonus * 100)}% rare odds, +${bonuses.rareTouchBonus.toFixed(1)} rare value`,
            `- Trait power: +${Math.round(bonuses.seedDropBonus * 1000) / 10}% seed drops${
              bonuses.doubleTouchChanceBonus > 0 ? `, +${Math.round(bonuses.doubleTouchChanceBonus * 100)}% double touches` : ""
            }`,
            `- Weather power: +${Math.round(bonuses.automationGlobalMultiplierBonus * 100)}% automation`,
          ]
        : ["- Collection bonuses: Buy the Field Journal to turn discoveries into power."];

    return [
      "Progress Notes",
      `- Milestones reached: ${this.state.reachedMilestones.length}/${MILESTONES.length}`,
      `- Quests claimed: ${this.state.claimedQuestIds.length}/${this.getRelevantQuestCount()}`,
      ...collectionBonusLines,
      `- Hybrid mutations: ${this.state.mutationEvents}`,
      `- Watered patches: ${this.state.wateredPatches}`,
      `- Hazards handled: ${this.state.hazardStats.cactusCleared + this.state.hazardStats.weedsCleared + this.state.hazardStats.hazardsClearedByMower}`,
      `- Mower passes survived: ${this.state.hazardStats.mowerPasses}`,
      `- Best combo: ${this.state.journal.bestComboCount}`,
      `- Best automation streak: ${this.state.automationStats.bestAutomationComboCount}`,
    ].join("\n");
  }

  private getRelevantQuestCount(): number {
    return QUESTS.filter((quest) => quest.classId === undefined || quest.classId === this.state.characterClassId).length;
  }

  private formatTraitName(trait: TileTrait): string {
    return trait === "dewy" ? "Dewy" : trait === "lush" ? "Lush" : "Normal";
  }

  private claimQuestReward(questId: string): void {
    const quest = QUESTS.find((candidate) => candidate.id === questId);

    if (!quest || this.state.claimedQuestIds.includes(questId)) {
      this.audio.play("blocked");
      return;
    }

    if (!isQuestAvailable(this.state, quest)) {
      this.questStatusText.setText(formatQuestProgress(quest, this.state));
      this.audio.play("blocked");
      return;
    }

    if (!isQuestClaimable(this.state, quest)) {
      this.questStatusText.setText("That quest is not ready yet.");
      this.audio.play("blocked");
      return;
    }

    this.applyQuestReward(quest);
    const claimMessage = `${quest.name} claimed: ${formatQuestReward(quest.reward)}.`;
    this.audio.play("milestone");
    this.saveState();
    this.readyQuestKeys = this.getReadyQuestKeys();
    this.playQuestClaimFeedback(questId);
    this.refreshUi();
    this.playQuestRewardHudCelebration(quest.reward);
    this.addTriggerFeedEvent("Quest claimed", quest.name, "Q", 0xffef78);
    this.questStatusText.setText(claimMessage);
  }

  private claimReadyQuestRewards(): void {
    const claimedQuests: QuestDefinition[] = [];

    for (let guard = 0; guard < QUESTS.length; guard += 1) {
      const readyQuest = QUESTS.find((quest) => isQuestClaimable(this.state, quest));
      if (!readyQuest) {
        break;
      }

      this.applyQuestReward(readyQuest);
      claimedQuests.push(readyQuest);
    }

    if (claimedQuests.length === 0) {
      this.questStatusText.setText("No quest rewards are ready yet.");
      this.audio.play("blocked");
      return;
    }

    this.audio.play(claimedQuests.length > 1 ? "milestone" : "seed");
    this.saveState();
    this.readyQuestKeys = this.getReadyQuestKeys();
    this.refreshUi();
    this.bumpResourceHud();
    this.playQuestRewardHudCelebration(this.combineQuestRewards(claimedQuests));
    this.playButtonCelebration(this.questClaimReadyButton, 0xffef78, "seed-fleck");
    this.addTriggerFeedEvent(
      "Quest rewards claimed",
      claimedQuests.length === 1 ? claimedQuests[0].name : `${claimedQuests.length} rewards`,
      "Q",
      0xffef78,
    );

    const firstQuest = claimedQuests[0];
    const extraCount = claimedQuests.length - 1;
    this.questStatusText.setText(
      extraCount > 0
        ? `Claimed ${claimedQuests.length} rewards, starting with ${firstQuest.name}.`
        : `${firstQuest.name} claimed: ${formatQuestReward(firstQuest.reward)}.`,
    );
  }

  private applyQuestReward(quest: QuestDefinition): void {
    this.state.claimedQuestIds.push(quest.id);
    this.state.grassTouches = addGrassTouches(this.state.grassTouches, quest.reward.grassTouches ?? 0);
    this.state.seeds += quest.reward.seeds ?? 0;
    this.state.lifetimeSeeds += quest.reward.seeds ?? 0;
    this.state.gold += quest.reward.gold ?? 0;
    this.state.lifetimeGold += quest.reward.gold ?? 0;
  }

  private combineQuestRewards(quests: QuestDefinition[]): QuestDefinition["reward"] {
    return quests.reduce<QuestDefinition["reward"]>(
      (total, quest) => ({
        grassTouches: (total.grassTouches ?? 0) + (quest.reward.grassTouches ?? 0),
        seeds: (total.seeds ?? 0) + (quest.reward.seeds ?? 0),
        gold: (total.gold ?? 0) + (quest.reward.gold ?? 0),
      }),
      {},
    );
  }

  private updateQuestClipboard(): void {
    if (!this.state.seedShopPurchases.quest_clipboard) {
      return;
    }

    const readyQuests = QUESTS.filter((quest) => isQuestClaimable(this.state, quest)).slice(0, QUEST_CLIPBOARD_MAX_CLAIMS);

    if (readyQuests.length === 0) {
      return;
    }

    for (const quest of readyQuests) {
      this.applyQuestReward(quest);
    }

    recordAutomationAction(this.state);
    this.readyQuestKeys = this.getReadyQuestKeys();
    this.audio.play(readyQuests.length > 1 ? "milestone" : "seed");
    this.saveState();
    this.refreshUi();
    this.bumpResourceHud();
    this.playQuestRewardHudCelebration(this.combineQuestRewards(readyQuests));
    this.playButtonCelebration(this.questButton, 0xffef78, "seed-fleck");
    this.addTriggerFeedEvent(
      "Clipboard claimed",
      `${readyQuests.length} quest reward${readyQuests.length === 1 ? "" : "s"}`,
      "Q",
      0xffef78,
    );

    if (this.questLogOpen) {
      this.questStatusText.setText(
        `Quest Clipboard claimed ${readyQuests.length} reward${readyQuests.length === 1 ? "" : "s"}.`,
      );
    }
  }

  private playQuestClaimFeedback(questId: string): void {
    const view = this.questItemViews.get(questId);
    if (!view || !this.questLogOpen || !view.container.visible) {
      this.bumpResourceHud();
      return;
    }

    const quest = QUESTS.find((candidate) => candidate.id === questId);
    const classClaim = quest?.category === "Class";
    const burstColor = classClaim
      ? this.state.characterClassId === "femboy_slim"
        ? 0xff7ea8
        : this.state.characterClassId === "grass_toucher"
          ? 0x9be86b
          : this.state.characterClassId === "goth_girl_baddie"
            ? 0xb78cff
            : 0xbff4ff
      : 0xf4df6a;
    const popText = classClaim ? "mastered" : "claimed";
    const x = view.container.x + view.bg.width / 2;
    const y = view.container.y + view.bg.height / 2;
    const burst = this.add
      .star(x, y, classClaim ? 8 : 7, 12, classClaim ? 48 : 42, burstColor, 0.62)
      .setStrokeStyle(2, 0xf7ffe8, 0.72)
      .setDepth(118);
    const pop = this.add
      .text(x, y - 8, popText, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: classClaim ? "20px" : "18px",
        color: classClaim ? "#ffef78" : "#f7ffe8",
        stroke: "#06190f",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(119);

    this.tweens.killTweensOf(view.container);
    view.container.setScale(1);
    this.tweens.add({
      targets: view.container,
      scaleX: 1.018,
      scaleY: 1.018,
      duration: 75,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => view.container.setScale(1),
    });
    this.tweens.add({
      targets: burst,
      angle: 45,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeOut",
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: pop,
      y: y - 40,
      alpha: 0,
      duration: 620,
      ease: "Sine.easeOut",
      onComplete: () => pop.destroy(),
    });
    this.bumpResourceHud();
  }

  private refreshSeedShop(): void {
    const stats = this.getCachedRuntimeStats();
    this.seedResourceText.setText(
      `Seeds: ${Math.floor(this.state.seeds)} | Lifetime Seeds: ${Math.floor(this.state.lifetimeSeeds)} | Drop Chance: ${Math.round(
        getSeedDropChance(this.state, stats.seedDropBonus) * 100,
      )}%`,
    );

    for (const item of SEED_SHOP_ITEMS) {
      const view = this.seedItemViews.get(item.id);
      if (!view) {
        continue;
      }

      const purchased = this.state.seedShopPurchases[item.id] === true;
      const unlocked = item.isUnlocked(this.state);
      const affordable = this.state.seeds >= item.cost;
      const ready = !purchased && unlocked && affordable;

      view.container.setAlpha(unlocked || purchased ? 1 : 0.76);
      view.bg.setFillStyle(purchased ? 0xdfffc8 : 0xf4ffdc, unlocked || purchased ? 0.96 : 0.7);
      view.bg.setStrokeStyle(3, purchased ? 0x85d35e : ready ? 0xffef78 : 0x2d6f36, ready ? 0.98 : 1);
      this.setReadyItemAttention(view, ready);

      if (purchased) {
        view.status.setText("Unlocked");
        view.status.setColor("#26652e");
      } else if (!unlocked) {
        view.status.setText("Locked");
        view.status.setColor("#c8d1cc");
      } else if (!affordable) {
        view.status.setText(`Cost: ${item.cost} seeds | ${this.formatAffordabilityPreview(this.state.seeds, item.cost, (value) => `${Math.ceil(value)}`, "seeds")}`);
        view.status.setColor("#6d4c19");
      } else {
        view.status.setText(`Cost: ${item.cost} seeds | Ready now`);
        view.status.setColor("#26652e");
      }
    }
  }

  private refreshGoldStore(): void {
    this.profileScope("store:modeButtons", () => this.refreshStoreModeButtons());
    if (this.storeMode === "goods") {
      this.profileScope("store:goods", () => this.refreshGoldItemStore());
      this.profileScope("store:layout", () => this.layoutGoldStore());
      return;
    }

    this.profileScope("store:automation", () => this.refreshAutomationStore());
    this.profileScope("store:layout", () => this.layoutGoldStore());
  }

  private refreshStoreModeButtons(): void {
    const readyAutomationCount = AUTOMATION_SYSTEMS.filter((system) => {
      const owned = getAutomationSystemOwned(this.state, system.id);
      const plan = this.getAutomationPurchasePlan(system, owned);
      return system.isUnlocked(this.state) && canAffordGrassTouches(this.state.grassTouches, plan.totalCost);
    }).length;
    const readyGoodsCount = GOLD_STORE_ITEMS.filter((item) => {
      const quantity = getInventoryQuantity(this.state, item.id);
      const maxed = item.maxQuantity !== undefined && quantity >= item.maxQuantity;
      return !maxed && item.isUnlocked(this.state) && this.state.gold >= item.cost && (item.kind !== "consumable" || quantity === 0);
    }).length;

    this.storeAutomationButton.setAlpha(this.storeMode === "automation" ? 1 : 0.72);
    this.storeGoodsButton.setAlpha(this.storeMode === "goods" ? 1 : 0.72);
    setTextButtonText(this.storeAutomationButton, this.formatActionMenuLabel(UI_ACTION_ICONS.automation, "Auto", readyAutomationCount));
    setTextButtonText(this.storeGoodsButton, this.formatActionMenuLabel(UI_ACTION_ICONS.store, "Goods", readyGoodsCount));
    setTextButtonText(this.storeAutomationBuyModeButton, this.automationBuyMode === "boost" ? "To Boost" : "Buy 1");
    setTextButtonAttention(this.storeAutomationButton, readyAutomationCount > 0);
    setTextButtonAttention(this.storeGoodsButton, readyGoodsCount > 0);
  }

  private refreshAutomationStore(): void {
    const stats = this.getCachedRuntimeStats();
    const automationOutputContext = getAutomationOutputContext(this.state, stats);
    const activeSynergyCount = automationOutputContext.activePairSynergies.length;
    const automationTotalText = formatGrassTouchesPerMinute(getTotalAutomationTouchesPerMinute(this.state, stats, automationOutputContext));
    const synergyText = activeSynergyCount > 0 ? ` | Synergies: ${activeSynergyCount}` : "";
    const compact = this.scale.width < 560;
    this.storeResourceText.setText(
      compact
        ? `Grass: ${formatGrassTouches(this.state.grassTouches)}\nAuto: ${automationTotalText}${
            activeSynergyCount > 0 ? ` | Syn: ${activeSynergyCount}` : ""
          }`
        : `Grass Touches: ${formatGrassTouches(this.state.grassTouches)} | Automation: ${automationTotalText}${synergyText}`,
    );

    for (const system of AUTOMATION_SYSTEMS) {
      const view = this.storeAutomationViews.get(system.id);
      if (!view) {
        continue;
      }

      const owned = getAutomationSystemOwned(this.state, system.id);
      const unlocked = system.isUnlocked(this.state);
      const plan = this.getAutomationPurchasePlan(system, owned);
      const affordable = canAffordGrassTouches(this.state.grassTouches, plan.totalCost);
      const ready = unlocked && affordable;
      const output = getDirectiveAdjustedAutomationOutput(
        this.state,
        getAutomationSystemTouchesPerMinute(this.state, system, stats, automationOutputContext),
      );
      const previewState = getAutomationPreviewState(this.state, system.id, plan.targetOwned);
      const previewOutputContext = getAutomationOutputContext(previewState, stats);
      const previewOutput = getDirectiveAdjustedAutomationOutput(
        previewState,
        getAutomationSystemTouchesPerMinute(previewState, system, stats, previewOutputContext),
      );
      const outputDelta = formatAutomationOutputDelta(output, previewOutput);
      const derivativeSupport = getAutomationSystemDerivativeSupport(this.state, system.id);
      const supportText = formatAutomationSupportText(derivativeSupport);
      const supportSuffix = supportText ? ` | ${supportText}` : "";
      const milestoneMultiplier = getAutomationSystemMilestoneMultiplier(this.state, system.id);
      const nextMilestone = getNextAutomationSystemMilestone(previewState, system.id);
      const milestoneStatus =
        getAutomationSystemMilestoneMultiplier(previewState, system.id) > milestoneMultiplier
          ? `boost on buy`
          : milestoneMultiplier > 1
          ? `x${formatAutomationMultiplier(milestoneMultiplier)}`
          : nextMilestone
            ? `at ${nextMilestone.owned}`
            : "max boost";

      view.container.setAlpha(unlocked || owned > 0 ? 1 : 0.68);
      view.bg.setFillStyle(owned > 0 ? 0x1c4728 : 0x12341c, unlocked || owned > 0 ? 0.96 : 0.62);
      view.bg.setStrokeStyle(3, ready ? 0xffef78 : owned > 0 ? 0x85d35e : 0xb7eba5, ready ? 0.98 : unlocked || owned > 0 ? 0.86 : 0.44);
      this.setReadyItemAttention(view, ready);

      if (!unlocked && owned <= 0) {
        view.status.setText("Locked");
        view.status.setColor("#8ea594");
      } else if (!affordable) {
        view.status.setText(
          `Owned ${owned}${supportSuffix} | ${formatGrassTouchesPerMinute(output)} (${outputDelta}) | ${
            plan.quantity > 1 ? `+${plan.quantity} to boost` : milestoneStatus
          } | ${this.formatAffordabilityPreview(this.state.grassTouches, plan.totalCost, formatGrassTouches)}`,
        );
        view.status.setColor("#d6e6d0");
      } else {
        view.status.setText(
          `Owned ${owned}${supportSuffix} | ${formatGrassTouchesPerMinute(output)} (${outputDelta}) | ${
            plan.quantity > 1 ? `Buy +${plan.quantity}` : milestoneStatus
          } | Cost ${formatGrassTouches(plan.totalCost)}`,
        );
        view.status.setColor("#f4df6a");
      }
    }
  }

  private refreshGoldItemStore(): void {
    const compact = this.scale.width < 560;
    const ownedCompanions = GOLD_STORE_ITEMS.filter((item) => item.kind === "animal" && getInventoryQuantity(this.state, item.id) > 0).length;
    const totalCompanions = GOLD_STORE_ITEMS.filter((item) => item.kind === "animal").length;
    this.storeResourceText.setText(
      compact
        ? `Gold: ${Math.floor(this.state.gold)}\nCompanions: ${ownedCompanions}/${totalCompanions}`
        : `Gold: ${Math.floor(this.state.gold)} | Seeds: ${Math.floor(this.state.seeds)} | Companions: ${ownedCompanions}/${totalCompanions}`,
    );

    for (const item of GOLD_STORE_ITEMS) {
      const view = this.storeGoldItemViews.get(item.id);
      if (!view) {
        continue;
      }

      const quantity = getInventoryQuantity(this.state, item.id);
      const unlocked = item.isUnlocked(this.state);
      const maxed = item.maxQuantity !== undefined && quantity >= item.maxQuantity;
      const affordable = this.state.gold >= item.cost;
      const maxText = item.maxQuantity === undefined ? "" : `/${item.maxQuantity}`;
      const ready = !maxed && unlocked && affordable && (item.kind !== "consumable" || quantity === 0);

      view.container.setAlpha(unlocked || quantity > 0 ? 1 : 0.68);
      view.bg.setFillStyle(quantity > 0 ? 0x1c4728 : 0x12341c, unlocked || quantity > 0 ? 0.96 : 0.62);
      view.bg.setStrokeStyle(3, ready ? 0xffef78 : quantity > 0 ? 0x85d35e : 0xb7eba5, ready ? 0.98 : unlocked || quantity > 0 ? 0.86 : 0.44);
      this.setReadyItemAttention(view, ready);

      if (!unlocked && quantity <= 0) {
        view.status.setText("Locked");
        view.status.setColor("#8ea594");
      } else if (item.kind === "consumable" && quantity > 0) {
        view.status.setText(`Owned ${quantity} | Click to use`);
        view.status.setColor("#f4df6a");
      } else if (item.id === "seed_satchel" && affordable) {
        view.status.setText(`Owned ${quantity} | Ready now | Opens +5 seeds`);
        view.status.setColor("#f4df6a");
      } else if (maxed) {
        view.status.setText(`Owned ${quantity}${maxText} | Ready to place`);
        view.status.setColor("#b7eba5");
      } else if (!affordable) {
        view.status.setText(
          `Owned ${quantity}${maxText} | Cost ${item.cost} gold | ${this.formatAffordabilityPreview(
            this.state.gold,
            item.cost,
            (value) => `${Math.ceil(value)}`,
            "gold",
          )}`,
        );
        view.status.setColor("#d6e6d0");
      } else {
        view.status.setText(`Owned ${quantity}${maxText} | Cost ${item.cost} gold | Ready now`);
        view.status.setColor("#f4df6a");
      }
    }
  }

  private refreshSkillDetail(): void {
    const upgrade = UPGRADES.find((candidate) => candidate.id === this.selectedSkillId) ?? UPGRADES[0];
    if (!this.isSkillVisible(upgrade.id)) {
      this.selectedSkillId = UPGRADES[0].id;
      this.refreshSkillDetail();
      return;
    }

    const level = this.state.upgrades[upgrade.id]?.level ?? 0;
    const cost = getUpgradeCost(upgrade, level);
    const maxed = level >= upgrade.maxLevel;
    const unlocked = canUnlockUpgrade(this.state, upgrade);
    const missingPrerequisites = (upgrade.prerequisiteIds ?? [])
      .filter((id) => (this.state.upgrades[id]?.level ?? 0) === 0)
      .map((id) => UPGRADES.find((candidate) => candidate.id === id)?.name ?? id);

    this.setTextIfChanged(this.skillDetailTitle, upgrade.name);
    this.setTextIfChanged(this.skillDetailCategory, `${this.getUpgradeBranch(upgrade.id)} branch`);
    this.setTextIfChanged(this.skillDetailBody, `${upgrade.description}\n\nLevel ${level}/${upgrade.maxLevel}`);

    if (maxed) {
      this.setTextIfChanged(this.skillDetailCost, "Fully unlocked.");
      setTextButtonText(this.skillBuyButton, "Maxed");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (missingPrerequisites.length > 0) {
      this.setTextIfChanged(this.skillDetailCost, `Requires: ${missingPrerequisites.join(", ")}`);
      setTextButtonText(this.skillBuyButton, "Locked");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (upgrade.classId !== undefined && upgrade.classId !== this.state.characterClassId) {
      this.setTextIfChanged(this.skillDetailCost, `Only ${getCharacterClass(upgrade.classId).name} can unlock this.`);
      setTextButtonText(this.skillBuyButton, "Locked");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (!upgrade.isUnlocked(this.state)) {
      this.setTextIfChanged(this.skillDetailCost, "Keep touching grass to reveal this.");
      setTextButtonText(this.skillBuyButton, "Locked");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (!canAffordGrassTouches(this.state.grassTouches, cost)) {
      const missing = getMissingGrassTouches(this.state.grassTouches, cost);
      this.setTextIfChanged(
        this.skillDetailCost,
        `Cost to Upgrade: ${formatGrassTouches(cost)} Grass Touches\nYou have: ${formatGrassTouches(
          this.state.grassTouches,
        )}\nNeed: ${formatGrassTouches(missing)} more`,
      );
      setTextButtonText(this.skillBuyButton, `Need ${formatGrassTouches(missing)}`);
      setTextButtonEnabled(this.skillBuyButton, false);
    } else {
      this.setTextIfChanged(
        this.skillDetailCost,
        `Cost to Upgrade: ${formatGrassTouches(cost)} Grass Touches\nYou have: ${formatGrassTouches(
          this.state.grassTouches,
        )}\nReady to upgrade`,
      );
      setTextButtonText(this.skillBuyButton, "Upgrade");
      setTextButtonEnabled(this.skillBuyButton, true);
    }
  }

  private setSkillStatus(message: string, durationMs = 1800): void {
    this.skillStatusText.setText(message);
    this.time.delayedCall(durationMs, () => {
      if (this.skillTreeOpen) {
        this.skillStatusText.setText(
          this.hasTouchScreen()
            ? "Tap a skill to upgrade it. The info box shows details."
            : "Hover a skill to inspect it. Click a skill or Upgrade to buy.",
        );
      }
    });
  }

  private getUpgradeBranch(upgradeId: string): string {
    if (upgradeId === "softer_grass") {
      return "Root";
    }

    if (
      [
        "honest_work",
        "patient_observation",
        "slay_footwork",
        "perfect_pose",
        "black_nail_polish",
        "graveyard_shift",
        "steady_tempo",
        "encore_circle",
      ].includes(upgradeId)
    ) {
      return "Class";
    }

    if (["two_handed_technique", "persistent_touch", "mindful_contact", "barefoot_confidence", "soft_meadow"].includes(upgradeId)) {
      return "Touch";
    }

    if (["faster_regrowth", "warm_sunlight", "fertile_soil", "root_network", "perennial_patches"].includes(upgradeId)) {
      return "Growth";
    }

    if (["sprinkler_calibration", "helper_routes", "grazing_logistics", "ecosystem_loop"].includes(upgradeId)) {
      return "Automation";
    }

    if (["lucky_clover", "dramatic_touch", "satisfying_crunch", "overreaction"].includes(upgradeId)) {
      return "Crits";
    }

    if (["palm_press", "dew_appreciation", "morning_mist", "dew_respecter", "weather_watching", "grass_identification", "better_eyes"].includes(upgradeId)) {
      return "Nature";
    }

    return "Meadow";
  }

  private setSeedStatus(message: string): void {
    this.seedStatusText.setText(message);
    this.time.delayedCall(1800, () => {
      if (this.seedShopOpen) {
        this.seedStatusText.setText("Seeds unlock new ways to touch grass.");
      }
    });
  }

  private playSeedShopItemSuccess(itemId: string): void {
    const view = this.seedItemViews.get(itemId);
    if (!view || !this.seedShopOpen || !view.container.visible) {
      return;
    }

    this.playShopItemSuccess(view.container, view.bg, view.iconBg, view.icon, 0x85d35e);
  }

  private setStoreStatus(message: string, duration = 1900): void {
    this.storeStatusText.setText(message);
    this.time.delayedCall(duration, () => {
      if (this.storeOpen) {
        this.storeStatusText.setText(this.getDefaultStoreStatus());
      }
    });
  }

  private playGoldStoreItemSuccess(itemId: string): void {
    const view = this.getActiveStoreItemViews().get(itemId);
    if (!view || !this.storeOpen || !view.container.visible) {
      return;
    }

    this.playShopItemSuccess(view.container, view.bg, view.iconBg, view.icon, 0xffef78);
  }

  private playShopItemSuccess(
    container: Phaser.GameObjects.Container,
    bg: Phaser.GameObjects.Rectangle,
    iconBg: Phaser.GameObjects.Rectangle,
    icon: Phaser.GameObjects.Image,
    color: number,
  ): void {
    const iconX = container.x + icon.x * container.scaleX;
    const iconY = container.y + icon.y * container.scaleY;
    const iconScaleX = icon.scaleX;
    const iconScaleY = icon.scaleY;
    const pop = this.add
      .image(iconX, iconY, icon.texture.key)
      .setDisplaySize(icon.displayWidth, icon.displayHeight)
      .setDepth(125)
      .setAlpha(0.96);
    const burst = this.add
      .star(iconX, iconY, 6, 7, 27, color, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.75)
      .setDepth(124);

    this.tweens.killTweensOf([container, icon, bg, iconBg]);
    container.setScale(1);
    icon.setScale(iconScaleX, iconScaleY);
    bg.setAlpha(1);
    iconBg.setAlpha(1);

    this.tweens.add({
      targets: container,
      scaleX: 1.018,
      scaleY: 1.018,
      duration: 75,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => container.setScale(1),
    });

    this.tweens.add({
      targets: icon,
      scaleX: iconScaleX * 1.18,
      scaleY: iconScaleY * 1.18,
      duration: 90,
      yoyo: true,
      ease: "Back.easeOut",
      onComplete: () => icon.setScale(iconScaleX, iconScaleY),
    });

    this.tweens.add({
      targets: [bg, iconBg],
      alpha: 0.82,
      duration: 90,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => {
        bg.setAlpha(1);
        iconBg.setAlpha(1);
      },
    });

    this.tweens.add({
      targets: pop,
      y: iconY - 34,
      scaleX: 1.28,
      scaleY: 1.28,
      alpha: 0,
      duration: 520,
      ease: "Sine.easeOut",
      onComplete: () => pop.destroy(),
    });

    this.tweens.add({
      targets: burst,
      angle: 45,
      scaleX: 1.42,
      scaleY: 1.42,
      alpha: 0,
      duration: 380,
      ease: "Sine.easeOut",
      onComplete: () => burst.destroy(),
    });
  }

  private getReadyUnlockKeys(): Set<string> {
    const keys = new Set<string>();

    for (const upgrade of UPGRADES) {
      if (this.isUpgradeReady(upgrade)) {
        const level = this.state.upgrades[upgrade.id]?.level ?? 0;
        keys.add(`upgrade:${upgrade.id}:${level + 1}`);
      }
    }

    const prestigePreview = getPrestigePreview(this.state);
    if (prestigePreview.canPrestige) {
      keys.add(`prestige:${this.state.prestige.resets + 1}:${prestigePreview.memoryGain}`);
    }

    for (const item of SEED_SHOP_ITEMS) {
      if (!this.state.seedShopPurchases[item.id] && item.isUnlocked(this.state) && this.state.seeds >= item.cost) {
        keys.add(`seed:${item.id}`);
      }
    }

    for (const system of AUTOMATION_SYSTEMS) {
      const owned = getAutomationSystemOwned(this.state, system.id);
      const cost = getAutomationSystemCost(system, owned);
      if (system.isUnlocked(this.state) && canAffordGrassTouches(this.state.grassTouches, cost)) {
        keys.add(`automation:${system.id}:${owned + 1}`);
      }
    }

    for (const item of GOLD_STORE_ITEMS) {
      const quantity = getInventoryQuantity(this.state, item.id);
      const maxed = item.maxQuantity !== undefined && quantity >= item.maxQuantity;
      if (!maxed && item.isUnlocked(this.state) && this.state.gold >= item.cost && (item.kind !== "consumable" || quantity === 0)) {
        keys.add(`gold:${item.id}:${quantity + 1}`);
      }
    }

    return keys;
  }

  private isUpgradeReady(upgrade: (typeof UPGRADES)[number]): boolean {
    const level = this.state.upgrades[upgrade.id]?.level ?? 0;
    const maxed = level >= upgrade.maxLevel;
    const cost = getUpgradeCost(upgrade, level);
    return !maxed && canUnlockUpgrade(this.state, upgrade) && canAffordGrassTouches(this.state.grassTouches, cost);
  }

  private checkReadyUnlocks(): void {
    const currentKeys = this.getReadyUnlockKeys();
    const newlyReady = [...currentKeys].some((key) => !this.readyUnlockKeys.has(key));
    this.readyUnlockKeys = currentKeys;

    if (newlyReady) {
      this.audio.play("unlock");
    }
  }

  private getReadyQuestKeys(): Set<string> {
    return new Set(QUESTS.filter((quest) => isQuestClaimable(this.state, quest)).map((quest) => quest.id));
  }

  private checkReadyQuests(): void {
    const currentKeys = this.getReadyQuestKeys();
    const newlyReadyId = [...currentKeys].find((key) => !this.readyQuestKeys.has(key));
    this.readyQuestKeys = currentKeys;

    if (!newlyReadyId) {
      return;
    }

    const quest = QUESTS.find((candidate) => candidate.id === newlyReadyId);
    this.audio.play("unlock");
    this.playButtonCelebration(this.questButton, 0xffef78, "crit-fleck");
    this.addTriggerFeedEvent("Quest ready", quest?.name ?? "claim reward", "Q", 0xffef78);
    this.showMessage(quest ? `Quest complete: ${quest.name}. Claim it in the Quest Log.` : "Quest complete. Claim it in the Quest Log.", 3200);
  }

  private bumpSkillNode(upgradeId: string, success: boolean): void {
    const view = this.skillNodeViews.get(upgradeId);
    if (!view) {
      return;
    }

    this.tweens.killTweensOf(view.container);
    view.container.setRotation(0);
    this.tweens.add({
      targets: view.container,
      scaleX: success ? view.container.scaleX * 1.16 : view.container.scaleX * 0.94,
      scaleY: success ? view.container.scaleY * 1.16 : view.container.scaleY * 0.94,
      duration: 80,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    this.tweens.add({
      targets: view.container,
      angle: success ? 2.4 : -3.2,
      duration: success ? 42 : 38,
      yoyo: true,
      repeat: success ? 2 : 3,
      ease: "Sine.easeInOut",
      onComplete: () => view.container.setRotation(0),
    });

    this.tweens.add({
      targets: view.container,
      x: view.container.x + (success ? 2 : 5),
      duration: success ? 36 : 45,
      yoyo: true,
      repeat: success ? 1 : 3,
      ease: "Sine.easeInOut",
    });
  }

  private buyUpgrade(upgradeId: string): boolean {
    const upgrade = UPGRADES.find((candidate) => candidate.id === upgradeId);
    if (!upgrade || !this.isSkillVisible(upgradeId) || !canUnlockUpgrade(this.state, upgrade)) {
      this.setSkillStatus("That skill has not sprouted yet.");
      this.audio.play("blocked");
      this.refreshUi();
      return false;
    }

    const level = this.state.upgrades[upgrade.id]?.level ?? 0;
    if (level >= upgrade.maxLevel) {
      this.setSkillStatus("That skill is fully grown.");
      this.audio.play("blocked");
      this.refreshUi();
      return false;
    }

    const cost = getUpgradeCost(upgrade, level);
    if (!canAffordGrassTouches(this.state.grassTouches, cost)) {
      const missing = getMissingGrassTouches(this.state.grassTouches, cost);
      this.setSkillStatus(
        `${upgrade.name} costs ${formatGrassTouches(cost)}. You have ${formatGrassTouches(this.state.grassTouches)}. Need ${formatGrassTouches(
          missing,
        )} more.`,
      );
      this.audio.play("blocked");
      this.refreshUi();
      return false;
    }

    this.state.grassTouches = spendGrassTouches(this.state.grassTouches, cost);
    this.state.upgrades[upgrade.id] = { level: level + 1 };
    this.invalidateRuntimeStats();
    this.setSkillStatus(`${upgrade.name} upgraded to ${level + 1}/${upgrade.maxLevel}.`);
    this.audio.play("upgrade");
    this.saveState();
    this.layoutSkillTree();
    this.refreshUi();
    return true;
  }

  private checkMilestones(stats: RuntimeStats): void {
    for (const milestone of MILESTONES) {
      if (
        this.state.lifetimeGrassTouches >= milestone.requiredLifetimeTouches &&
        !this.state.reachedMilestones.includes(milestone.id)
      ) {
        this.state.reachedMilestones.push(milestone.id);
        const addedTiles = expandField(this.state, milestone.tilesToAdd, stats);
        if (this.recordTileDiscoveries(addedTiles)) {
          this.queueSave();
        }

        for (const tile of addedTiles) {
          this.createTileView(tile);
        }

        this.layoutTiles();
        this.playTileDropCascade(addedTiles);
        this.showMessage(milestone.message, 3200);
        this.playMilestoneCelebration();
        this.audio.play("milestone");
        this.queueSave();
      }
    }
  }

  private popAtTile(tile: FieldTile, text: string, color: string): void {
    if (!this.reserveAmbientPopText()) {
      return;
    }

    const position = this.getTileVisualPosition(tile);
    if (!position) {
      return;
    }

    const pop = this.getPooledPopText();
    this.activePopTexts.add(pop);
    this.tweens.killTweensOf(pop);
    pop
      .setText(text)
      .setColor(color)
      .setPosition(position.x, position.y - 18)
      .setDepth(40)
      .setAlpha(1)
      .setScale(0.75)
      .setVisible(true)
      .setActive(true);

    this.tweens.add({
      targets: pop,
      y: pop.y - 28,
      alpha: 0,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 560,
      ease: "Sine.easeOut",
      onComplete: () => this.releasePopText(pop),
    });
  }

  private getPooledPopText(): Phaser.GameObjects.Text {
    const pooled = this.popTextPool.pop();
    if (pooled) {
      return pooled;
    }

    return this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#f9ffe5",
        stroke: "#17491f",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setActive(false);
  }

  private releasePopText(pop: Phaser.GameObjects.Text): void {
    this.activePopTexts.delete(pop);
    this.tweens.killTweensOf(pop);
    pop.setVisible(false).setActive(false).setAlpha(1).setScale(1).setText("");

    if (this.popTextPool.length >= POP_TEXT_POOL_LIMIT) {
      pop.destroy();
      return;
    }

    this.popTextPool.push(pop);
  }

  private destroyPopTextPool(): void {
    const texts = new Set([...this.activePopTexts, ...this.popTextPool]);
    for (const text of texts) {
      this.tweens.killTweensOf(text);
      text.destroy();
    }

    this.activePopTexts.clear();
    this.popTextPool = [];
  }

  private playTileDropCascade(tiles: FieldTile[]): void {
    if (tiles.length === 0) {
      return;
    }

    this.cameras.main.shake(420, 0.0045);

    tiles.forEach((tile, index) => {
      this.playTileDropIn(tile, index * 85);
    });
  }

  private playTileDropIn(tile: FieldTile, delay: number): void {
    const view = this.tileViews.get(this.getTileKey(tile));
    if (!view) {
      return;
    }

    const dropDistance = Math.max(86, 210 * this.boardScale);
    const parts = [view.base, view.outline, view.grass, view.label];

    this.tweens.killTweensOf(parts);

    for (const part of parts) {
      const finalX = part.x;
      const finalY = part.y;
      const finalScaleX = part.scaleX;
      const finalScaleY = part.scaleY;
      const finalAlpha = part.alpha;

      part.setPosition(finalX, finalY - dropDistance);
      part.setScale(finalScaleX * 0.82, finalScaleY * 0.82);
      part.setAlpha(0);

      this.tweens.add({
        targets: part,
        x: finalX,
        y: finalY,
        scaleX: finalScaleX,
        scaleY: finalScaleY,
        alpha: finalAlpha,
        delay,
        duration: 560,
        ease: "Bounce.easeOut",
        onComplete: () => {
          part.setPosition(finalX, finalY);
          part.setScale(finalScaleX, finalScaleY);
          part.setAlpha(finalAlpha);
        },
      });
    }

    this.time.delayedCall(delay + 430, () => {
      const thud = this.add
        .ellipse(view.base.x, view.base.y + 11 * this.boardScale, TILE_SIZE * 0.72 * this.boardScale, TILE_SIZE * 0.22 * this.boardScale, 0x214c26, 0.22)
        .setDepth(28);

      this.tweens.add({
        targets: thud,
        scaleX: 1.45,
        alpha: 0,
        duration: 280,
        ease: "Sine.easeOut",
        onComplete: () => thud.destroy(),
      });
    });
  }

  private spawnRewardArc(texture: string, startX: number, startY: number, kind: "seed" | "gold", amount = 1): void {
    const spriteCount = this.getBudgetedRewardArcSpriteCount(Phaser.Math.Clamp(Math.ceil(amount), 1, 4));
    if (spriteCount <= 0) {
      return;
    }

    for (let index = 0; index < spriteCount; index += 1) {
      this.time.delayedCall(index * 42, () => this.spawnRewardArcSprite(texture, startX, startY, kind, index));
    }
  }

  private spawnRewardArcSprite(texture: string, startX: number, startY: number, kind: "seed" | "gold", index: number): void {
    const target = this.getRewardArcTarget(kind);
    const start = new Phaser.Math.Vector2(startX + Phaser.Math.Between(-8, 8), startY + Phaser.Math.Between(-5, 5));
    const end = new Phaser.Math.Vector2(target.x + Phaser.Math.Between(-7, 7), target.y + Phaser.Math.Between(-5, 5));
    const control = new Phaser.Math.Vector2(
      (start.x + end.x) / 2 + Phaser.Math.Between(-34, 34),
      Math.min(start.y, end.y) - Phaser.Math.Between(72, 136),
    );
    const curve = new Phaser.Curves.QuadraticBezier(start, control, end);
    const progress = { value: 0 };
    const sprite = this.add
      .image(start.x, start.y, texture)
      .setDepth(18)
      .setScale(Math.max(1.8, this.boardScale * 2.35))
      .setAlpha(0.95);
    const baseScale = sprite.scaleX;

    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 620 + index * 26,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const point = curve.getPoint(progress.value);
        sprite.setPosition(point.x, point.y);
        sprite.setAngle((kind === "gold" ? 420 : 260) * progress.value);
        sprite.setScale(baseScale * (1 - progress.value * 0.34));
        sprite.setAlpha(Phaser.Math.Linear(0.95, 0.68, progress.value));
      },
      onComplete: () => {
        sprite.destroy();
        this.bumpResourceHud();
      },
    });
  }

  private getRewardArcTarget(kind: "seed" | "gold"): { x: number; y: number } {
    const bounds = this.resourceText.getBounds();

    if (this.isMobilePortrait()) {
      return {
        x: bounds.x + bounds.width * (kind === "seed" ? 0.58 : 0.82),
        y: bounds.y + Math.max(14, bounds.height * 0.23),
      };
    }

    if (this.scale.width < 620) {
      const lineHeight = Math.max(18, bounds.height / (this.getAutomationStatusLine() ? 6 : 5));
      const lineIndex = kind === "seed" ? 1 : 2;
      return {
        x: bounds.x + Math.min(bounds.width - 18, 92),
        y: bounds.y + lineHeight * (lineIndex + 0.5),
      };
    }

    return {
      x: bounds.x + bounds.width * (kind === "seed" ? 0.36 : 0.52),
      y: bounds.y + bounds.height * 0.5,
    };
  }

  private bumpResourceHud(): void {
    this.tweens.killTweensOf(this.resourceText);
    this.resourceText.setScale(1);

    this.tweens.add({
      targets: this.resourceText,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 70,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => this.resourceText.setScale(1),
    });
  }

  private showMessage(message: string, duration: number): void {
    this.setTextIfChanged(this.milestoneText, message);
    this.time.delayedCall(duration, () => this.refreshUi());
  }

  private getAutomationStatusLine(compact = false): string {
    const companionCount =
      getInventoryQuantity(this.state, "field_mouse") +
      getInventoryQuantity(this.state, "bee_hive") +
      getInventoryQuantity(this.state, "chicken") +
      getInventoryQuantity(this.state, "sheep") +
      getInventoryQuantity(this.state, "meadow_rabbit") +
      getInventoryQuantity(this.state, "earthworm");
    const sprinklerCount = getAutomationSystemOwned(this.state, "sprinkler");
    const parts = [
      sprinklerCount > 0 ? "sprinkler" : "",
      companionCount > 0 ? `${companionCount} companion${companionCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean);

    if (parts.length === 0) {
      return "";
    }

    const directive = getAutomationDirective(this.state);
    const resolvedDirective = getResolvedAutomationDirectiveId(this.state);
    const resolvedDirectiveName = AUTOMATION_DIRECTIVES.find((candidate) => candidate.id === resolvedDirective)?.shortName ?? "balanced";
    const boosts = [
      this.state.seedShopPurchases.forager_trails ? "trails" : "",
      this.state.seedShopPurchases.quest_clipboard ? "clipboard" : "",
      this.state.seedShopPurchases.sprinkler_timer ? "timer" : "",
      this.state.seedShopPurchases.sprinkler_network ? "network" : "",
      getAutomationMilestoneBoostLabel(this.state),
    ].filter(Boolean);

    if (compact) {
      const activeCount = (sprinklerCount > 0 ? 1 : 0) + companionCount;
      const directiveText = directive.id === "autopilot" ? `${directive.shortName}->${resolvedDirectiveName}` : directive.shortName;
      return `Auto: ${activeCount} active, ${directiveText}${boosts.length > 0 ? `, ${boosts.length} boosts` : ""}`;
    }

    const directiveText = directive.id === "autopilot" ? `${directive.shortName} -> ${resolvedDirectiveName}` : directive.shortName;
    return `Auto: ${directiveText} - ${parts.join(", ")}${boosts.length > 0 ? ` (${boosts.join(", ")})` : ""}`;
  }
}

function brightenColors(colors: number[], tint: number): number[] {
  return colors.map((color) => blendColor(color, tint, 0.32));
}

function blendColor(color: number, tint: number, amount: number): number {
  const red = Math.round(((color >> 16) & 0xff) * (1 - amount) + ((tint >> 16) & 0xff) * amount);
  const green = Math.round(((color >> 8) & 0xff) * (1 - amount) + ((tint >> 8) & 0xff) * amount);
  const blue = Math.round((color & 0xff) * (1 - amount) + (tint & 0xff) * amount);

  return (red << 16) + (green << 8) + blue;
}
