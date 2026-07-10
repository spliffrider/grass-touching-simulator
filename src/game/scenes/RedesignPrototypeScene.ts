import Phaser from "phaser";
import {
  DEFAULT_MUSIC_VOLUME,
  readStoredMusicVolume,
  readStoredSfxVolume,
  writeStoredMusicVolume,
  writeStoredSfxVolume,
} from "../data/audio-settings";
import {
  createFirstRunObjectiveState,
  getActiveFirstRunObjective,
  getFirstRunFieldExpansion,
  getFirstRunOneTileMastery,
  updateFirstRunObjectives,
  type FirstRunObjectiveProgress,
  type FirstRunObjectiveState,
} from "../redesign/FirstRunObjectiveSystem";
import {
  MEMORY_TREE_NODE_SIZE,
  MEMORY_TREE_WORLD_HEIGHT,
  MEMORY_TREE_WORLD_WIDTH,
  MEMORY_UPGRADE_IDS,
  MEMORY_UPGRADE_VIEW,
} from "../redesign/MemoryTreeCatalog";
import {
  clampMemoryTreePan,
  MEMORY_TREE_MAX_ZOOM,
  MEMORY_TREE_MIN_ZOOM,
  MEMORY_TREE_ZOOM_STEP,
  zoomMemoryTreeAtPoint,
  type MemoryTreeViewport,
} from "../redesign/MemoryTreeViewport";
import {
  RUN_TOOL_IDS,
  RUN_TOOL_VIEW,
  type RunToolId,
} from "../redesign/RunToolCatalog";
import {
  getRunToolBarLayout,
  RUN_TOOL_SLOT_SIZE,
  type RunToolBarLayout,
} from "../redesign/RunToolBarLayout";
import { RedesignDomBridge } from "../redesign/RedesignDomBridge";
import { AudioSystem } from "../systems/AudioSystem";
import type { GrassTierId, TileTrait } from "../types/game-state";
import {
  applyTinySprinklerPulse,
  advanceRun,
  BASE_RUN_TOOL_SLOT_CAPACITY,
  buyTinySprinkler,
  createNextRunFromDormancy,
  createPermanentMemorySnapshot,
  createRunSpineState,
  DEW_PULSE_RUN_TOUCH_COST,
  DEFAULT_ANCIENT_GRASS_MAX_HP,
  EFFECTIVE_HEALING_PER_PERMANENT_TOUCH,
  formatAncientGrassHp,
  getAncientGrassHpRatio,
  getDormancySummary,
  getDormancyGrassTouches,
  getMissingPermanentUpgradePrerequisites,
  getPermanentUpgradeEffects,
  getWoundedRootCount,
  hasPermanentUpgrade,
  isRootWounded,
  normalizePermanentMemorySnapshot,
  openRootWound,
  PERMANENT_UPGRADE_DEFINITIONS,
  purchasePermanentUpgrade,
  ROOT_SALVE_RUN_TOUCH_COST,
  TINY_SPRINKLER_RUN_TOUCH_COST,
  touchAncientGrassRoot,
  useDewPulse,
  useRootSalve,
  type DormancySummary,
  type PermanentMemorySnapshot,
  type PermanentUpgradeId,
  type RunSpineState,
} from "../redesign/RunSpineSystem";

interface RootNodeView {
  base: Phaser.GameObjects.Image;
  grass: Phaser.GameObjects.Image;
  spark: Phaser.GameObjects.Image;
  pulse: Phaser.GameObjects.Arc;
  recoveryHalo: Phaser.GameObjects.Arc;
  senseHalo: Phaser.GameObjects.Arc;
  woundHalo: Phaser.GameObjects.Arc;
  woundShard: Phaser.GameObjects.Rectangle;
  homeX: number;
  homeY: number;
  visualSize: number;
  phase: number;
  rootId: number;
  recoveringUntil: number;
  lastTouchAt: number;
  touchImpactAt: number;
  touchImpactStrength: number;
  touchImpactDirection: number;
}

interface BrowserDebugRootNode {
  rootId: number;
  x: number;
  y: number;
  visualSize: number;
  wounded: boolean;
  recovering: boolean;
  recoveryRatio: number;
  recoveryMarkerVisible: boolean;
  scourgeSenseTarget: boolean;
  scourgeSenseMarkerVisible: boolean;
  woundMarkerVisible: boolean;
}

interface BrowserDebugMemoryButton {
  upgradeId: PermanentUpgradeId;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  unlocked: boolean;
  affordable: boolean;
  owned: boolean;
}

interface BrowserDebugMetaNode {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

interface BrowserDebugNextRunButton {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

interface BrowserDebugRunToolButton {
  toolId: RunToolId;
  x: number;
  y: number;
  width: number;
  height: number;
  cost: number;
  count: number;
  visible: boolean;
  usable: boolean;
  affordable: boolean;
}

interface BrowserDebugRunToolBarView {
  slotCapacity: number;
  equippedCount: number;
  page: number;
  pageCount: number;
  pageCapacity: number;
  columns: number;
  rows: number;
  previousButton: BrowserDebugButtonBounds;
  nextButton: BrowserDebugButtonBounds;
}

interface BrowserDebugButtonBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  enabled: boolean;
}

interface BrowserDebugMemoryTreeView {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  panX: number;
  panY: number;
  dragging: boolean;
  viewportX: number;
  viewportY: number;
  viewportWidth: number;
  viewportHeight: number;
  worldWidth: number;
  worldHeight: number;
  fitScale: number;
  zoomOutButton: BrowserDebugButtonBounds;
  resetButton: BrowserDebugButtonBounds;
  zoomInButton: BrowserDebugButtonBounds;
}

interface BrowserDebugSliderBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  value: number;
}

interface BrowserDebugOptionsState {
  visible: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  openButton: BrowserDebugButtonBounds;
  closeButton: BrowserDebugButtonBounds;
  musicOnButton: BrowserDebugButtonBounds;
  musicOffButton: BrowserDebugButtonBounds;
  musicVolumeSlider: BrowserDebugSliderBounds;
  sfxVolumeSlider: BrowserDebugSliderBounds;
  sfxTestButton: BrowserDebugButtonBounds;
}

interface PrototypeFeedEntry {
  label: string;
  detail: string;
  icon: string;
  color: string;
}

type SensiMood = "idle" | "alert" | "approval" | "dormant";

interface SensiMessage {
  text: string;
  mood: SensiMood;
}

interface SensiBark extends SensiMessage {
  expiresAt: number;
}

interface MemoryUpgradeButtonView {
  upgradeId: PermanentUpgradeId;
  background: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Arc;
  hoverRing: Phaser.GameObjects.Arc;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  branch: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  nodeSize: number;
}

interface LockedMetaNodeView {
  background: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
}

interface RunToolSlotView {
  toolId: RunToolId;
  button: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  costBadge: Phaser.GameObjects.Rectangle;
  costText: Phaser.GameObjects.Text;
  countBadge: Phaser.GameObjects.Arc;
  countText: Phaser.GameObjects.Text;
  available: boolean;
  usable: boolean;
  count: number;
}

type PrototypeMusicMode = "field" | "grove";
type PrototypeMusicTrack = Phaser.Sound.BaseSound & {
  readonly volume: number;
  setVolume(value: number): PrototypeMusicTrack;
};

const TOUCH_HEALING = 3;
const WOUNDED_TOUCH_HEALING = 10;
const ROOT_RECOVERY_MS = 900;
const WOUNDED_ROOT_RECOVERY_MS = 420;
const OVERHEAL_RECOVERY_MS = 360;
const ROOT_COUNT = 25;
const BASE_WOUND_INTERVAL_MS = 3300;
const PLAYTEST_WOUND_INTERVAL_MS = 1800;
const FAST_WOUND_INTERVAL_MS = 650;
const NORMAL_STARTING_HP = 70;
const PLAYTEST_STARTING_HP = 54;
const FAST_STARTING_HP = 34;
const NORMAL_SCOURGE_DRAIN_PER_SECOND = 1.85;
const NORMAL_SCOURGE_PRESSURE_GROWTH_PER_SECOND = 0.045;
const PLAYTEST_SCOURGE_DRAIN_PER_SECOND = 2.8;
const PLAYTEST_SCOURGE_PRESSURE_GROWTH_PER_SECOND = 0.07;
const FAST_SCOURGE_DRAIN_PER_SECOND = 4.4;
const FAST_SCOURGE_PRESSURE_GROWTH_PER_SECOND = 0.09;
const ONE_TILE_SCOURGE_DRAIN_MULTIPLIER = 0.58;
const PLAYTEST_MEMORY_GRANT = 20;
const DEFAULT_WOUND_WARNING_RATIO = 0.72;
const SCOURGE_SENSE_WARNING_RATIO = 0.42;
const MAX_OPEN_WOUNDS = 7;
const HUD_PANEL_BASE_WIDTH = 640;
const HUD_PANEL_BASE_HEIGHT = 196;
const FIELD_PANEL_BASE_WIDTH = 520;
const FIELD_PANEL_BASE_HEIGHT = 520;
const SUMMARY_PANEL_BASE_WIDTH = 760;
const SUMMARY_PANEL_BASE_HEIGHT = 500;
const INTRO_PANEL_BASE_WIDTH = 520;
const INTRO_PANEL_BASE_HEIGHT = 92;
const RUN_TOOL_ICON_SIZE = 34;
const RUN_TOOL_TOOLTIP_WIDTH = 244;
const RUN_TOOL_TOOLTIP_HEIGHT = 88;
const TINY_SPRINKLER_PULSE_INTERVAL_MS = 2400;
const FAST_TINY_SPRINKLER_PULSE_INTERVAL_MS = 900;
const OPTIONS_BUTTON_WIDTH = 78;
const OPTIONS_BUTTON_HEIGHT = 26;
const OPTIONS_PANEL_BASE_WIDTH = 420;
const OPTIONS_PANEL_BASE_HEIGHT = 314;
const OPTIONS_TRACK_BASE_WIDTH = 250;
const OPTIONS_TRACK_BASE_HEIGHT = 12;
const OPTIONS_HIT_BASE_WIDTH = 288;
const OPTIONS_HIT_BASE_HEIGHT = 42;
const REDESIGN_MEMORY_SAVE_KEY = "grass-touching-simulator.redesign-memory.v1";
const SIDE_PANEL_BASE_WIDTH = 260;
const SIDE_PANEL_BASE_HEIGHT = 172;
const PLAYER_PANEL_HEIGHT = 148;
const ADVISOR_PANEL_BASE_HEIGHT = 108;
const PLAYER_PORTRAIT_SIZE = 66;
const COMPACT_PLAYER_PANEL_HEIGHT = 92;
const COMPACT_ADVISOR_PANEL_HEIGHT = 92;
const COMPACT_PANEL_GAP = 12;
const COMPACT_PANEL_MIN_WIDTH = 360;
const COMPACT_PANEL_MIN_HEIGHT = 620;
const COMPACT_STACK_MAX_WIDTH = 430;
const COMPACT_STACK_MIN_HEIGHT = 760;
const FEED_VISIBLE_ROWS = 4;
const UI_TEXT_RESOLUTION = 2;
const FIELD_MUSIC_GAIN = 0.84;
const GROVE_MUSIC_GAIN = 0.92;
const MUSIC_CROSSFADE_MS = 1200;
const ROOT_TOUCH_IMPACT_MS = 360;
const GRASS_TEXTURES = ["grass-normal", "grass-thick", "grass-clover", "grass-wildflower", "grass-moss"] as const;
type RedesignGrassTextureKey = (typeof GRASS_TEXTURES)[number];
const ONE_TILE_MASTERY_TEXTURES: readonly RedesignGrassTextureKey[] = [
  "grass-moss",
  "grass-normal",
  "grass-thick",
  "grass-clover",
  "grass-wildflower",
];
const GRASS_TEXTURE_AUDIO: Record<RedesignGrassTextureKey, { tier: GrassTierId; trait: TileTrait }> = {
  "grass-normal": { tier: "normal", trait: "normal" },
  "grass-thick": { tier: "thick", trait: "lush" },
  "grass-clover": { tier: "clover", trait: "dewy" },
  "grass-wildflower": { tier: "wildflower", trait: "lush" },
  "grass-moss": { tier: "moss", trait: "normal" },
};
const LOCKED_META_NODES: readonly { title: string; detail: string }[] = [];
const SENSI_MOOD_TITLE_COLORS: Record<SensiMood, string> = {
  idle: "#ffefb0",
  alert: "#ffabc4",
  approval: "#eaff9b",
  dormant: "#d8ccff",
};

export class RedesignPrototypeScene extends Phaser.Scene {
  private readonly routeParams = new URLSearchParams(window.location.search);
  private readonly playtestMode = this.routeParams.has("playtest");
  private readonly fastDormancy = this.routeParams.has("fastDormancy");
  private readonly loadedMemory = this.loadPermanentMemory();
  private readonly woundIntervalMs = this.fastDormancy ? FAST_WOUND_INTERVAL_MS : this.playtestMode ? PLAYTEST_WOUND_INTERVAL_MS : BASE_WOUND_INTERVAL_MS;
  private state: RunSpineState = this.createPrototypeRunState();
  private introActive = !this.loadedMemory && !this.routeParams.has("skipIntro");

  private background!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private scourgeVeil!: Phaser.GameObjects.Rectangle;
  private hudPanel!: Phaser.GameObjects.NineSlice;
  private fieldPanel!: Phaser.GameObjects.NineSlice;
  private rootAura!: Phaser.GameObjects.Arc;
  private touchHintRing!: Phaser.GameObjects.Arc;
  private touchHintText!: Phaser.GameObjects.Text;
  private oneTileMasteryText!: Phaser.GameObjects.Text;
  private summaryBackdrop!: Phaser.GameObjects.Rectangle;
  private summaryPanel!: Phaser.GameObjects.NineSlice;
  private summaryTitle!: Phaser.GameObjects.Text;
  private summarySubtitle!: Phaser.GameObjects.Text;
  private summaryStatsFrame!: Phaser.GameObjects.Rectangle;
  private summaryBody!: Phaser.GameObjects.Text;
  private summaryRewardText!: Phaser.GameObjects.Text;
  private summaryStatsText!: Phaser.GameObjects.Text;
  private skillTreeFrame!: Phaser.GameObjects.Rectangle;
  private memoryTreeContent!: Phaser.GameObjects.Container;
  private memoryTreeMaskShape!: Phaser.GameObjects.Graphics;
  private skillTreeLines!: Phaser.GameObjects.Graphics;
  private skillTreeTitle!: Phaser.GameObjects.Text;
  private skillTreeHelp!: Phaser.GameObjects.Text;
  private skillTreeConnector!: Phaser.GameObjects.Rectangle;
  private memoryTreeZoomOutButton!: Phaser.GameObjects.Rectangle;
  private memoryTreeZoomOutText!: Phaser.GameObjects.Text;
  private memoryTreeZoomResetButton!: Phaser.GameObjects.Rectangle;
  private memoryTreeZoomResetText!: Phaser.GameObjects.Text;
  private memoryTreeZoomInButton!: Phaser.GameObjects.Rectangle;
  private memoryTreeZoomInText!: Phaser.GameObjects.Text;
  private memoryHoverFrame!: Phaser.GameObjects.Rectangle;
  private memoryHoverTitle!: Phaser.GameObjects.Text;
  private memoryHoverBody!: Phaser.GameObjects.Text;
  private memoryDetailFrame!: Phaser.GameObjects.Rectangle;
  private memoryDetailTitle!: Phaser.GameObjects.Text;
  private memoryDetailBranch!: Phaser.GameObjects.Text;
  private memoryDetailIconGlow!: Phaser.GameObjects.Arc;
  private memoryDetailIconFrame!: Phaser.GameObjects.Image;
  private memoryDetailIcon!: Phaser.GameObjects.Image;
  private memoryDetailBody!: Phaser.GameObjects.Text;
  private memoryDetailCost!: Phaser.GameObjects.Text;
  private memoryDetailIconBaseSize = 72;
  private memoryHoverCardEnabled = false;
  private summaryHint!: Phaser.GameObjects.Text;
  private memoryUpgradeButtons: MemoryUpgradeButtonView[] = [];
  private lockedMetaNodes: LockedMetaNodeView[] = [];
  private nextRunButton!: Phaser.GameObjects.Rectangle;
  private nextRunGlow!: Phaser.GameObjects.Rectangle;
  private nextRunText!: Phaser.GameObjects.Text;
  private introPanel!: Phaser.GameObjects.NineSlice;
  private introTitle!: Phaser.GameObjects.Text;
  private introBody!: Phaser.GameObjects.Text;
  private sensiPanel!: Phaser.GameObjects.NineSlice;
  private sensiPortraitFrame!: Phaser.GameObjects.Rectangle;
  private sensiPortrait!: Phaser.GameObjects.Image;
  private sensiGlint!: Phaser.GameObjects.Rectangle;
  private sensiTitle!: Phaser.GameObjects.Text;
  private sensiBody!: Phaser.GameObjects.Text;
  private advisorPanel!: Phaser.GameObjects.NineSlice;
  private advisorTitle!: Phaser.GameObjects.Text;
  private advisorBody!: Phaser.GameObjects.Text;
  private feedPanel!: Phaser.GameObjects.NineSlice;
  private feedTitle!: Phaser.GameObjects.Text;
  private feedRows: Phaser.GameObjects.Text[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private runTouchText!: Phaser.GameObjects.Text;
  private scourgeText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private hpBarBack!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpBarGlint!: Phaser.GameObjects.Rectangle;
  private scourgeBarFill!: Phaser.GameObjects.Rectangle;
  private runToolBar!: Phaser.GameObjects.NineSlice;
  private runToolSlots!: Record<RunToolId, RunToolSlotView>;
  private runToolSlotCapacity = BASE_RUN_TOOL_SLOT_CAPACITY + getPermanentUpgradeEffects(this.state).runToolSlotBonus;
  private equippedRunToolIds: readonly RunToolId[] = RUN_TOOL_IDS.slice(0, this.runToolSlotCapacity);
  private runToolPage = 0;
  private runToolBarLayout: RunToolBarLayout = getRunToolBarLayout(this.equippedRunToolIds.length, 1280);
  private runToolPreviousPageButton!: Phaser.GameObjects.Rectangle;
  private runToolPreviousPageText!: Phaser.GameObjects.Text;
  private runToolNextPageButton!: Phaser.GameObjects.Rectangle;
  private runToolNextPageText!: Phaser.GameObjects.Text;
  private runToolPageText!: Phaser.GameObjects.Text;
  private runToolTooltipFrame!: Phaser.GameObjects.Rectangle;
  private runToolTooltipTitle!: Phaser.GameObjects.Text;
  private runToolTooltipBody!: Phaser.GameObjects.Text;
  private hoveredRunToolId: RunToolId | null = null;
  private optionsButton!: Phaser.GameObjects.Rectangle;
  private optionsButtonText!: Phaser.GameObjects.Text;
  private optionsBackdrop!: Phaser.GameObjects.Rectangle;
  private optionsPanel!: Phaser.GameObjects.NineSlice;
  private optionsTitle!: Phaser.GameObjects.Text;
  private optionsMusicLabel!: Phaser.GameObjects.Text;
  private optionsMusicTrack!: Phaser.GameObjects.Rectangle;
  private optionsMusicFill!: Phaser.GameObjects.Rectangle;
  private optionsMusicHit!: Phaser.GameObjects.Rectangle;
  private optionsMusicKnob!: Phaser.GameObjects.Arc;
  private optionsSfxLabel!: Phaser.GameObjects.Text;
  private optionsSfxTrack!: Phaser.GameObjects.Rectangle;
  private optionsSfxFill!: Phaser.GameObjects.Rectangle;
  private optionsSfxHit!: Phaser.GameObjects.Rectangle;
  private optionsSfxKnob!: Phaser.GameObjects.Arc;
  private optionsMusicToggleButton!: Phaser.GameObjects.Rectangle;
  private optionsMusicToggleText!: Phaser.GameObjects.Text;
  private optionsSfxTestButton!: Phaser.GameObjects.Rectangle;
  private optionsSfxTestText!: Phaser.GameObjects.Text;
  private optionsCloseButton!: Phaser.GameObjects.Rectangle;
  private optionsCloseText!: Phaser.GameObjects.Text;
  private rootNodes: RootNodeView[] = [];
  private activeRootCount = 1;
  private activeGridSize = 1;
  private fieldCenterX = 0;
  private fieldCenterY = 0;
  private fieldTouchRadius = 220;
  private oneTileMasteryRank = 0;
  private dormantAnimationPlayed = false;
  private scourgeDamageAccum = 0;
  private scourgePulseElapsed = 0;
  private woundElapsed = 0;
  private woundPressureWarned = false;
  private scourgeSenseTargetRootId: number | null = null;
  private lastScourgeSenseWarningAt = 0;
  private lastScourgeSenseTargetRootId: number | null = null;
  private tinySprinklerElapsed = 0;
  private optionsOpen = false;
  private draggingOptionsVolume: "music" | "sfx" | null = null;
  private musicVolume = readStoredMusicVolume();
  private lastAudibleMusicVolume = this.musicVolume > 0 ? this.musicVolume : DEFAULT_MUSIC_VOLUME;
  private sfxVolume = readStoredSfxVolume();
  private optionsMusicTrackX = 0;
  private optionsMusicTrackWidth = 1;
  private optionsSfxTrackX = 0;
  private optionsSfxTrackWidth = 1;
  private readonly sfx = new AudioSystem();
  private lastSfxPreviewAt = -Infinity;
  private audioStarted = false;
  private lucidTheme?: PrototypeMusicTrack;
  private groveTheme?: PrototypeMusicTrack;
  private musicMode: PrototypeMusicMode = "field";
  private musicTransition?: Phaser.Tweens.Tween;
  private feedEntries: PrototypeFeedEntry[] = [];
  private sensiPortraitBaseX = 0;
  private sensiPortraitBaseY = 0;
  private sensiPortraitDisplaySize = PLAYER_PORTRAIT_SIZE;
  private currentSensiLine = "";
  private lastMemoryPurchaseHint = "";
  private selectedMemoryUpgradeId: PermanentUpgradeId = "softTouch";
  private hoveredMemoryUpgradeId: PermanentUpgradeId | null = null;
  private memoryTreeZoom = 1;
  private memoryTreePanX = 0;
  private memoryTreePanY = 0;
  private memoryTreeFitScale = 1;
  private memoryTreeFittedWidth = 1;
  private memoryTreeFittedHeight = 1;
  private memoryTreeViewport: MemoryTreeViewport = { centerX: 0, centerY: 0, width: 1, height: 1 };
  private memoryTreeDragging = false;
  private memoryTreeDragPointerId = -1;
  private memoryTreeDragStartX = 0;
  private memoryTreeDragStartY = 0;
  private memoryTreeDragStartPanX = 0;
  private memoryTreeDragStartPanY = 0;
  private sensiMood: SensiMood = "idle";
  private sensiBark?: SensiBark;
  private objectiveState: FirstRunObjectiveState = createFirstRunObjectiveState();
  private lastMissBarkAt = -Infinity;
  private lastHealingFeedbackKind: "none" | "root" | "wound" | "salve" | "dewPulse" | "sprinkler" = "none";
  private lastHealingFeedbackAt = 0;
  private lastRunToolKind: "none" | "dewPulse" | "rootSalve" | "tinySprinkler" = "none";
  private lastRunToolAt = 0;
  private lastTinySprinklerPulseAt = 0;
  private lastTinySprinklerRootId: number | null = null;
  private dewPulseWasUsable = false;
  private lastDewPulseReadyAt = 0;
  private lastScourgeEvent: "none" | "tick" | "pressure-warning" | "wound-open" | "dormancy-collapse" | "last-stand" = "none";
  private lastScourgePulseAt = 0;
  private lastScourgePressureWaveAt = 0;
  private lastWoundPressureWarningAt = 0;
  private lastDormancyCollapseAt = 0;
  private lastStandTriggeredAt = 0;
  private domBridge?: RedesignDomBridge;

  constructor() {
    super("RedesignPrototypeScene");
  }

  private get dewPulseButton(): Phaser.GameObjects.Rectangle {
    return this.runToolSlots.dewPulse.button;
  }

  private get rootSalveButton(): Phaser.GameObjects.Rectangle {
    return this.runToolSlots.rootSalve.button;
  }

  private get tinySprinklerButton(): Phaser.GameObjects.Rectangle {
    return this.runToolSlots.tinySprinkler.button;
  }

  preload(): void {
    this.load.image("redesign-meadow-bg", "/assets/backgrounds/meadow-clearing-concept.webp");
    this.load.image("panel-emerald", "/assets/ui/panel-emerald.png");
    this.load.image("skill-node-locked", "/assets/ui/skill-node-locked.png");
    this.load.image("skill-node-available", "/assets/ui/skill-node-available.png");
    this.load.image("skill-node-owned", "/assets/ui/skill-node-owned.png");
    this.load.image("skill-node-selected", "/assets/ui/skill-node-selected.png");
    for (const upgradeId of MEMORY_UPGRADE_IDS) {
      const view = MEMORY_UPGRADE_VIEW[upgradeId];
      this.load.image(view.iconKey, view.iconPath);
    }
    for (const toolId of RUN_TOOL_IDS) {
      const view = RUN_TOOL_VIEW[toolId];
      this.load.image(view.iconKey, view.iconPath);
    }
    this.load.image("player-pixel-portrait", "/assets/ui/characters/player-field-heir.png");
    this.load.image("tile-dirt", "/assets/tiles/tile-dirt.png");
    this.load.image("grass-normal", "/assets/tiles/grass-normal.png");
    this.load.image("grass-thick", "/assets/tiles/grass-thick.png");
    this.load.image("grass-clover", "/assets/tiles/grass-clover.png");
    this.load.image("grass-wildflower", "/assets/tiles/grass-wildflower.png");
    this.load.image("grass-moss", "/assets/tiles/grass-moss.png");
    this.load.image("grass-fleck", "/assets/tiles/grass-fleck.png");
    this.load.image("effect-magic-spore", "/assets/effects/magic-spore.png");
    this.load.image("effect-pollen-fleck", "/assets/effects/pollen-fleck.png");
    this.load.audio("redesign-lucid-theme", "/assets/music/lucid-field-theme.wav");
    this.load.audio("redesign-grove-theme", "/assets/music/epic_menu_theme_mellow.wav");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#395f3e");
    this.input.setDefaultCursor("crosshair");

    this.background = this.add.image(0, 0, "redesign-meadow-bg").setOrigin(0.5).setDepth(0);
    this.shade = this.add.rectangle(0, 0, 10, 10, 0x122318, 0.38).setOrigin(0).setDepth(1);
    this.scourgeVeil = this.add.rectangle(0, 0, 10, 10, 0x351231, 0.08).setOrigin(0).setDepth(1.5);
    this.hudPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, HUD_PANEL_BASE_WIDTH, HUD_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(2);
    const initialRunToolBarLayout = getRunToolBarLayout(this.equippedRunToolIds.length, this.scale.width);
    this.runToolBar = this.add
      .nineslice(0, 0, "panel-emerald", undefined, initialRunToolBarLayout.width, initialRunToolBarLayout.height, 18, 18, 18, 18)
      .setDepth(15)
      .setAlpha(0.94)
      .setVisible(false);
    this.fieldPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, FIELD_PANEL_BASE_WIDTH, FIELD_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(2)
      .setAlpha(0.92);
    this.rootAura = this.add.circle(0, 0, 130, 0x9dff77, 0.05).setDepth(2.5).setStrokeStyle(2, 0xd7ff9b, 0.18);
    this.touchHintRing = this.add.circle(0, 0, 150, 0xeaff9b, 0.02).setDepth(7).setStrokeStyle(3, 0xeaff9b, 0.34);
    this.touchHintText = this.add.text(0, 0, "TOUCH ROOTS", {
      color: "#f1ffd4",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);
    this.oneTileMasteryText = this.add.text(0, 0, "", {
      align: "center",
      color: "#eaff9b",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      lineSpacing: 2,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);
    this.summaryBackdrop = this.add
      .rectangle(0, 0, 10, 10, 0x06100d, 0.88)
      .setOrigin(0)
      .setDepth(29)
      .setVisible(false);
    this.summaryPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, SUMMARY_PANEL_BASE_WIDTH, SUMMARY_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(30)
      .setVisible(false);
    this.summaryTitle = this.add.text(0, 0, "Game Over: Dormancy", {
      color: "#f7ffd6",
      fontFamily: "Georgia, serif",
      fontSize: "30px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(31).setVisible(false);
    this.summarySubtitle = this.add.text(0, 0, "The run is over. Spend permanent GT before the next attempt.", {
      align: "center",
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(31).setVisible(false);
    this.summaryStatsFrame = this.add
      .rectangle(0, 0, 260, 260, 0x07170f, 0.58)
      .setDepth(31)
      .setStrokeStyle(2, 0xd7a64e, 0.5)
      .setVisible(false);
    this.summaryBody = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      lineSpacing: 4,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0, 0).setDepth(32).setVisible(false);
    this.summaryRewardText = this.add.text(0, 0, "", {
      color: "#eaff9b",
      fontFamily: "Georgia, serif",
      fontSize: "25px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setOrigin(0, 0).setDepth(32).setVisible(false);
    this.summaryStatsText = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      lineSpacing: 3,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0, 0).setDepth(32).setVisible(false);
    this.skillTreeFrame = this.add
      .rectangle(0, 0, 360, 260, 0x07170f, 0.58)
      .setDepth(31)
      .setStrokeStyle(2, 0xd7a64e, 0.5)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.skillTreeFrame.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) =>
        this.startMemoryTreePan(pointer, event),
    );
    this.memoryTreeContent = this.add.container(0, 0).setDepth(31.5).setVisible(false);
    this.memoryTreeMaskShape = this.make.graphics({ x: 0, y: 0 }, false);
    this.memoryTreeContent.setMask(this.memoryTreeMaskShape.createGeometryMask());
    this.skillTreeLines = this.add.graphics();
    this.memoryTreeContent.add(this.skillTreeLines);
    this.skillTreeTitle = this.add.text(0, 0, "Memory Skill Tree", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "21px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setDepth(32).setVisible(false);
    this.skillTreeHelp = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      lineSpacing: 2,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(32).setVisible(false);
    const zoomOutControl = this.createMemoryTreeZoomControl("-", 34, () => this.adjustMemoryTreeZoom(-MEMORY_TREE_ZOOM_STEP));
    this.memoryTreeZoomOutButton = zoomOutControl.button;
    this.memoryTreeZoomOutText = zoomOutControl.text;
    const zoomResetControl = this.createMemoryTreeZoomControl("100%", 58, () => this.resetMemoryTreeView());
    this.memoryTreeZoomResetButton = zoomResetControl.button;
    this.memoryTreeZoomResetText = zoomResetControl.text;
    const zoomInControl = this.createMemoryTreeZoomControl("+", 34, () => this.adjustMemoryTreeZoom(MEMORY_TREE_ZOOM_STEP));
    this.memoryTreeZoomInButton = zoomInControl.button;
    this.memoryTreeZoomInText = zoomInControl.text;
    this.skillTreeConnector = this.add
      .rectangle(0, 0, 4, 140, 0xd7a64e, 0.38)
      .setDepth(31)
      .setVisible(false);
    this.memoryHoverFrame = this.add
      .rectangle(0, 0, 230, 96, 0x07170f, 0.96)
      .setDepth(34)
      .setStrokeStyle(2, 0xeaff9b, 0.68)
      .setVisible(false);
    this.memoryHoverTitle = this.add.text(0, 0, "", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "15px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(35).setVisible(false);
    this.memoryHoverBody = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      lineSpacing: 2,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(35).setVisible(false);
    this.memoryDetailFrame = this.add
      .rectangle(0, 0, 260, 260, 0x07170f, 0.7)
      .setDepth(31)
      .setStrokeStyle(2, 0xd7a64e, 0.58)
      .setVisible(false);
    this.memoryDetailTitle = this.add.text(0, 0, "", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setDepth(32).setVisible(false);
    this.memoryDetailBranch = this.add.text(0, 0, "", {
      color: "#eaff9b",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(32).setVisible(false);
    this.memoryDetailIconGlow = this.add
      .circle(0, 0, 42, 0xeaff9b, 0.1)
      .setDepth(31.6)
      .setStrokeStyle(2, 0xeaff9b, 0.22)
      .setVisible(false);
    this.memoryDetailIconFrame = this.add
      .image(0, 0, "skill-node-selected")
      .setDepth(32.2)
      .setVisible(false);
    this.memoryDetailIcon = this.add
      .image(0, 0, "memory-icon-soft-touch")
      .setDepth(32.4)
      .setVisible(false);
    this.memoryDetailBody = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      lineSpacing: 4,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(32).setVisible(false);
    this.memoryDetailCost = this.add.text(0, 0, "", {
      color: "#f7ffd6",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      lineSpacing: 4,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(32).setVisible(false);
    this.summaryHint = this.add.text(0, 0, "Spend GT in the skill tree, then use Begin Next Run.", {
      color: "#ffefb0",
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(31).setVisible(false);
    this.introPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, INTRO_PANEL_BASE_WIDTH, INTRO_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(13)
      .setAlpha(0.94)
      .setVisible(false);
    this.introTitle = this.add.text(0, 0, "Sensi, field advisor", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(14).setVisible(false);
    this.introBody = this.add.text(0, 0, "", {
      color: "#f1ffd4",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      lineSpacing: 3,
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0, 0).setDepth(14).setVisible(false);
    for (const upgradeId of MEMORY_UPGRADE_IDS) {
      const upgrade = PERMANENT_UPGRADE_DEFINITIONS[upgradeId];
      const view = MEMORY_UPGRADE_VIEW[upgradeId];
      const glow = this.add
        .circle(0, 0, 54, view.color, 0.12)
        .setDepth(31.8)
        .setStrokeStyle(2, view.color, 0.28)
        .setVisible(false);
      const hoverRing = this.add
        .circle(0, 0, 60, view.color, 0.04)
        .setDepth(31.9)
        .setStrokeStyle(3, 0xffef78, 0.9)
        .setVisible(false);
      const background = this.add
        .rectangle(0, 0, 140, 110, 0xffffff, 0.001)
        .setDepth(33)
        .setStrokeStyle(1, 0xffffff, 0)
        .setVisible(false)
        .setInteractive({ useHandCursor: true });
      const frame = this.add.image(0, 0, "skill-node-locked").setDepth(32).setVisible(false);
      const icon = this.add.image(0, 0, view.iconKey).setDepth(32.2).setVisible(false);
      const title = this.add.text(0, 0, upgrade.name, {
        align: "center",
        color: "#ffefb0",
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        fontStyle: "bold",
        stroke: "#07100c",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(33).setVisible(false);
      const branch = this.add.text(0, 0, view.branch, {
        align: "center",
        color: "#dff6ca",
        fontFamily: "Arial, sans-serif",
        fontSize: "10px",
        fontStyle: "bold",
        stroke: "#07100c",
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(33).setVisible(false);
      const detail = this.add.text(0, 0, "", {
        align: "center",
        color: "#dff6ca",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        stroke: "#07100c",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(33).setVisible(false);
      background.on("pointerover", () => {
        this.previewMemoryUpgrade(upgradeId);
      });
      background.on("pointerout", () => {
        this.clearMemoryUpgradePreview(upgradeId);
      });
      background.on("pointerdown", () => {
        this.previewMemoryUpgrade(upgradeId);
        this.handleMemoryUpgradeClick(upgradeId);
      });
      this.memoryTreeContent.add([glow, hoverRing, frame, icon, title, branch, detail, background]);
      this.memoryUpgradeButtons.push({ upgradeId, background, glow, hoverRing, frame, icon, title, branch, detail, nodeSize: 72 });
    }
    for (const node of LOCKED_META_NODES) {
      const background = this.add
        .rectangle(0, 0, 210, 54, 0x121b17, 0.78)
        .setDepth(32)
        .setStrokeStyle(2, 0x6f6a52, 0.48)
        .setVisible(false);
      const title = this.add.text(0, 0, node.title, {
        color: "#b8aa82",
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        fontStyle: "bold",
        stroke: "#07100c",
        strokeThickness: 3,
      }).setDepth(33).setVisible(false);
      const detail = this.add.text(0, 0, node.detail, {
        color: "#9e9a84",
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        stroke: "#07100c",
        strokeThickness: 3,
      }).setDepth(33).setVisible(false);
      this.memoryTreeContent.add([background, title, detail]);
      this.lockedMetaNodes.push({ background, title, detail });
    }
    this.nextRunGlow = this.add
      .rectangle(0, 0, 230, 50, 0xeaff9b, 0.08)
      .setDepth(31.7)
      .setStrokeStyle(2, 0xeaff9b, 0.24)
      .setVisible(false);
    this.nextRunButton = this.add
      .rectangle(0, 0, 190, 38, 0x1b4f2c, 0.94)
      .setDepth(32)
      .setStrokeStyle(2, 0xeaff9b, 0.82)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.nextRunButton.on("pointerdown", () => this.startNextRunFromMeta());
    this.nextRunText = this.add.text(0, 0, "Begin Next Run", {
      align: "center",
      color: "#f7ffd6",
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(33).setVisible(false);
    this.sensiPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, SIDE_PANEL_BASE_WIDTH, SIDE_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(9)
      .setAlpha(0.92);
    this.sensiPortraitFrame = this.add
      .rectangle(0, 0, 74, 74, 0x07100c, 0.62)
      .setDepth(10)
      .setStrokeStyle(2, 0xd7a64e, 0.82);
    this.sensiPortrait = this.add
      .image(0, 0, "player-pixel-portrait")
      .setDepth(11)
      .setDisplaySize(PLAYER_PORTRAIT_SIZE, PLAYER_PORTRAIT_SIZE);
    this.sensiGlint = this.add
      .rectangle(0, 0, 34, 3, 0xffffff, 0)
      .setDepth(12)
      .setAngle(-12)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.sensiTitle = this.add.text(0, 0, "Grass Toucher", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "22px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setDepth(10);
    this.sensiBody = this.add.text(0, 0, "", {
      color: "#edf8cf",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      lineSpacing: 4,
      stroke: "#07100c",
      strokeThickness: 3,
      wordWrap: { width: SIDE_PANEL_BASE_WIDTH - 38 },
    }).setDepth(10);
    this.advisorPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, SIDE_PANEL_BASE_WIDTH, ADVISOR_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(9)
      .setAlpha(0.9);
    this.advisorTitle = this.add.text(0, 0, "Sensi // Advisor", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "17px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setDepth(10);
    this.advisorBody = this.add.text(0, 0, "", {
      color: "#edf8cf",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      lineSpacing: 3,
      stroke: "#07100c",
      strokeThickness: 3,
      wordWrap: { width: SIDE_PANEL_BASE_WIDTH - 36 },
    }).setDepth(10);
    this.feedPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, SIDE_PANEL_BASE_WIDTH, SIDE_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(9)
      .setAlpha(0.92);
    this.feedTitle = this.add.text(0, 0, "Run Feed", {
      color: "#ffefb0",
      fontFamily: "Georgia, serif",
      fontSize: "19px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setDepth(10);
    for (let index = 0; index < FEED_VISIBLE_ROWS; index += 1) {
      this.feedRows.push(
        this.add.text(0, 0, "", {
          color: "#dff6ca",
          fontFamily: "Arial, sans-serif",
          fontSize: "12px",
          lineSpacing: 2,
          stroke: "#07100c",
          strokeThickness: 3,
          wordWrap: { width: SIDE_PANEL_BASE_WIDTH - 34 },
        }).setDepth(10),
      );
    }
    this.titleText = this.add.text(0, 0, "Ancient Grass: Scourge Prototype", {
      color: "#ecf8d8",
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      fontStyle: "bold",
      stroke: "#12341f",
      strokeThickness: 5,
    }).setDepth(3);

    this.hpBarBack = this.add.rectangle(0, 0, 520, 24, 0x14271a, 0.96).setOrigin(0, 0.5).setDepth(3);
    this.hpBarFill = this.add.rectangle(0, 0, 520, 24, 0x8bdc69).setOrigin(0, 0.5).setDepth(4);
    this.hpBarGlint = this.add.rectangle(0, 0, 18, 20, 0xf6ffd8, 0).setOrigin(0.5).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
    this.scourgeBarFill = this.add.rectangle(0, 0, 160, 8, 0xb85b7a).setOrigin(0, 0.5).setDepth(4);

    this.hpText = this.add.text(0, 0, "", {
      color: "#f6ffd8",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(5);
    this.runTouchText = this.add.text(0, 0, "", {
      color: "#c9ffba",
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(5);
    this.objectiveText = this.add.text(0, 0, "", {
      color: "#ffefb0",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
      wordWrap: { width: 520 },
    }).setDepth(5);
    this.runToolSlots = Object.fromEntries(
      RUN_TOOL_IDS.map((toolId) => [
        toolId,
        this.createRunToolSlot(toolId, this.getRunToolCost(toolId), () => this.activateRunTool(toolId)),
      ]),
    ) as Record<RunToolId, RunToolSlotView>;
    this.runToolPreviousPageButton = this.add
      .rectangle(0, 0, 24, 20, 0x102d1c, 0.96)
      .setDepth(16)
      .setStrokeStyle(1, 0xd7a64e, 0.72)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.runToolPreviousPageButton.on("pointerdown", () => this.changeRunToolPage(-1));
    this.runToolPreviousPageText = this.add.text(0, 0, "<", {
      color: "#f7ffd6",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(17).setVisible(false);
    this.runToolNextPageButton = this.add
      .rectangle(0, 0, 24, 20, 0x102d1c, 0.96)
      .setDepth(16)
      .setStrokeStyle(1, 0xd7a64e, 0.72)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.runToolNextPageButton.on("pointerdown", () => this.changeRunToolPage(1));
    this.runToolNextPageText = this.add.text(0, 0, ">", {
      color: "#f7ffd6",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(17).setVisible(false);
    this.runToolPageText = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(17).setVisible(false);
    this.runToolTooltipFrame = this.add
      .rectangle(0, 0, RUN_TOOL_TOOLTIP_WIDTH, RUN_TOOL_TOOLTIP_HEIGHT, 0x07170f, 0.97)
      .setDepth(22)
      .setStrokeStyle(2, 0xbff4ff, 0.78)
      .setVisible(false);
    this.runToolTooltipTitle = this.add.text(0, 0, "", {
      color: "#f7ffd6",
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(23).setVisible(false);
    this.runToolTooltipBody = this.add.text(0, 0, "", {
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      lineSpacing: 2,
      stroke: "#07100c",
      strokeThickness: 3,
      wordWrap: { width: RUN_TOOL_TOOLTIP_WIDTH - 24 },
    }).setDepth(23).setVisible(false);
    this.scourgeText = this.add.text(0, 0, "", {
      color: "#ffb1c7",
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setDepth(5);
    this.promptText = this.add.text(0, 0, "", {
      align: "center",
      color: "#dbe8d0",
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      stroke: "#07100c",
      strokeThickness: 3,
      wordWrap: { width: 580 },
    }).setOrigin(0.5, 0).setDepth(5);

    this.createOptionsButton();
    this.createOptionsPanel();
    this.createRootField();
    this.sfx.setVolume(this.sfxVolume);
    this.sharpenPersistentText();
    this.domBridge = new RedesignDomBridge({
      touchRoot: (rootId) => this.handleRootDomClick(rootId),
      useDewPulse: () => this.handleDewPulseClick(),
      useRootSalve: () => this.handleRootSalveClick(),
      useTinySprinkler: () => this.handleTinySprinklerClick(),
      previewRunTool: (toolId) => this.previewRunTool(toolId),
      clearRunToolPreview: (toolId) => this.clearRunToolPreview(toolId),
      previousRunToolPage: () => this.changeRunToolPage(-1),
      nextRunToolPage: () => this.changeRunToolPage(1),
      previewMemory: (upgradeId) => this.previewMemoryUpgrade(upgradeId),
      clearMemoryPreview: (upgradeId) => this.clearMemoryUpgradePreview(upgradeId),
      purchaseMemory: (upgradeId) => this.handleMemoryUpgradeClick(upgradeId),
      beginNextRun: () => this.startNextRunFromMeta(),
      zoomMemoryTreeIn: () => this.adjustMemoryTreeZoom(MEMORY_TREE_ZOOM_STEP),
      zoomMemoryTreeOut: () => this.adjustMemoryTreeZoom(-MEMORY_TREE_ZOOM_STEP),
      resetMemoryTreeView: () => this.resetMemoryTreeView(),
      openOptions: () => this.openOptions(),
      closeOptions: () => this.closeOptions(),
      turnMusicOn: () => this.turnPrototypeMusicOn(),
      turnMusicOff: () => this.turnPrototypeMusicOff(),
      setMusicVolume: (volume) => this.setPrototypeMusicVolume(volume),
      setSfxVolume: (volume) => this.setPrototypeSfxVolume(volume, true),
      testSfx: () => this.testPrototypeSfx(),
      forceDormancy: () => this.forcePlaytestDormancy(),
      grantMemory: () => this.grantPlaytestMemory(),
      restartRun: () => this.restartPlaytestRun(),
      resetMemory: () => this.resetPlaytestMemory(),
    });
    this.events.once("shutdown", () => this.domBridge?.destroy());
    this.events.once("destroy", () => this.domBridge?.destroy());
    this.addFeedEntry("Field online", "Ancient root system detected", "OK", "#b7eba5");
    this.addFeedEntry("Sensi advice", this.introActive ? "Inherited field assessment" : "Touch music awake when ready", "SE", "#ffefb0");
    if (this.loadedMemory) {
      this.addFeedEntry("Memory loaded", `${this.loadedMemory.permanentGrassTouches} GT remembered`, "SV", "#bff4ff");
      this.saySensi("The field remembers.\nThis is either good or legally complex.", "approval", 5200);
    } else if (this.introActive) {
      this.addFeedEntry("Inheritance", "one dramatic grass tile", "IN", "#ffefb0");
      this.saySensi("Your uncle left you this field.\nSorry.\nThat tile is Ancient Grass.", "idle", 7200);
    } else {
      this.saySensi("Breathe in.\nTouch roots when they ask.", "idle", 5200);
    }
    this.syncFirstRunObjectives(false);
    this.input.on("pointerdown", this.handleTouch, this);
    this.input.on("pointermove", this.handleMemoryTreePan, this);
    this.input.on("pointerup", this.stopMemoryTreePan, this);
    this.input.on("pointerupoutside", this.stopMemoryTreePan, this);
    this.input.on("wheel", this.handleMemoryTreeWheel, this);
    this.scale.on("resize", this.layout, this);
    this.layout();
    this.refreshReadout();
    this.publishBrowserDebugState();
    window.__grassAppReady?.();
  }

  private createMemoryTreeZoomControl(
    label: string,
    width: number,
    onPress: () => void,
  ): { button: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text } {
    const button = this.add
      .rectangle(0, 0, width, 30, 0x123621, 0.94)
      .setDepth(33)
      .setStrokeStyle(2, 0xd7a64e, 0.68)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    button.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        onPress();
      },
    );
    const text = this.add.text(0, 0, label, {
      align: "center",
      color: "#f7ffd6",
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(34).setVisible(false);
    return { button, text };
  }

  private sharpenPersistentText(): void {
    this.children.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Text) {
        child.setResolution(UI_TEXT_RESOLUTION);
      }
    });
  }

  private createOptionsButton(): void {
    this.optionsButton = this.add
      .rectangle(0, 0, OPTIONS_BUTTON_WIDTH, OPTIONS_BUTTON_HEIGHT, 0x173822, 0.92)
      .setDepth(34)
      .setStrokeStyle(2, 0xd7a64e, 0.78)
      .setInteractive({ useHandCursor: true });
    this.optionsButton.on("pointerdown", () => this.openOptions());
    this.optionsButtonText = this.add.text(0, 0, "Options", {
      align: "center",
      color: "#ffefb0",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(35);
  }

  private createOptionsPanel(): void {
    this.optionsBackdrop = this.add
      .rectangle(0, 0, 10, 10, 0x06100d, 0.7)
      .setOrigin(0)
      .setDepth(40)
      .setInteractive()
      .setVisible(false);
    this.optionsBackdrop.on("pointerdown", () => this.closeOptions());
    this.optionsPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, OPTIONS_PANEL_BASE_WIDTH, OPTIONS_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setDepth(41)
      .setAlpha(0.98)
      .setInteractive()
      .setVisible(false);
    this.optionsPanel.on("pointerdown", this.stopOptionsPointerEvent, this);
    this.optionsTitle = this.add.text(0, 0, "Options", {
      color: "#f7ffd6",
      fontFamily: "Georgia, serif",
      fontSize: "26px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(42).setVisible(false);
    this.optionsMusicLabel = this.add.text(0, 0, "", {
      align: "center",
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(42).setVisible(false);
    this.optionsMusicTrack = this.add
      .rectangle(0, 0, OPTIONS_TRACK_BASE_WIDTH, OPTIONS_TRACK_BASE_HEIGHT, 0x10251a, 1)
      .setOrigin(0, 0.5)
      .setDepth(42)
      .setStrokeStyle(1, 0xd7a64e, 0.52)
      .setVisible(false);
    this.optionsMusicFill = this.add
      .rectangle(0, 0, OPTIONS_TRACK_BASE_WIDTH, OPTIONS_TRACK_BASE_HEIGHT, 0x8bdc69, 1)
      .setOrigin(0, 0.5)
      .setDepth(43)
      .setVisible(false);
    this.optionsMusicHit = this.add
      .rectangle(0, 0, OPTIONS_HIT_BASE_WIDTH, OPTIONS_HIT_BASE_HEIGHT, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setDepth(44)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsMusicKnob = this.add
      .circle(0, 0, 13, 0xf7ffd6, 1)
      .setDepth(45)
      .setStrokeStyle(3, 0x8bdc69, 0.92)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsSfxLabel = this.add.text(0, 0, "", {
      align: "center",
      color: "#dff6ca",
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(42).setVisible(false);
    this.optionsSfxTrack = this.add
      .rectangle(0, 0, OPTIONS_TRACK_BASE_WIDTH, OPTIONS_TRACK_BASE_HEIGHT, 0x10251a, 1)
      .setOrigin(0, 0.5)
      .setDepth(42)
      .setStrokeStyle(1, 0xbff4ff, 0.52)
      .setVisible(false);
    this.optionsSfxFill = this.add
      .rectangle(0, 0, OPTIONS_TRACK_BASE_WIDTH, OPTIONS_TRACK_BASE_HEIGHT, 0xbff4ff, 1)
      .setOrigin(0, 0.5)
      .setDepth(43)
      .setVisible(false);
    this.optionsSfxHit = this.add
      .rectangle(0, 0, OPTIONS_HIT_BASE_WIDTH, OPTIONS_HIT_BASE_HEIGHT, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setDepth(44)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsSfxKnob = this.add
      .circle(0, 0, 13, 0xf7ffd6, 1)
      .setDepth(45)
      .setStrokeStyle(3, 0xbff4ff, 0.92)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsMusicToggleButton = this.add
      .rectangle(0, 0, 138, 38, 0x173822, 0.94)
      .setDepth(42)
      .setStrokeStyle(2, 0xd7a64e, 0.78)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsMusicToggleButton.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.togglePrototypeMusic();
    });
    this.optionsMusicToggleText = this.add.text(0, 0, "", {
      align: "center",
      color: "#ffefb0",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(43).setVisible(false);
    this.optionsSfxTestButton = this.add
      .rectangle(0, 0, 118, 38, 0x173822, 0.94)
      .setDepth(42)
      .setStrokeStyle(2, 0xbff4ff, 0.72)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsSfxTestButton.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.testPrototypeSfx();
    });
    this.optionsSfxTestText = this.add.text(0, 0, "Test SFX", {
      align: "center",
      color: "#d9fbff",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(43).setVisible(false);
    this.optionsCloseButton = this.add
      .rectangle(0, 0, 104, 38, 0x173822, 0.94)
      .setDepth(42)
      .setStrokeStyle(2, 0xbff4ff, 0.72)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.optionsCloseButton.on("pointerdown", (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.closeOptions();
    });
    this.optionsCloseText = this.add.text(0, 0, "Back", {
      align: "center",
      color: "#d9fbff",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(43).setVisible(false);

    this.optionsMusicHit.on("pointerdown", (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) =>
      this.startOptionsVolumeDrag(pointer, "music", event));
    this.optionsMusicKnob.on("pointerdown", (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) =>
      this.startOptionsVolumeDrag(pointer, "music", event));
    this.optionsSfxHit.on("pointerdown", (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) =>
      this.startOptionsVolumeDrag(pointer, "sfx", event));
    this.optionsSfxKnob.on("pointerdown", (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) =>
      this.startOptionsVolumeDrag(pointer, "sfx", event));
    this.input.on("pointermove", this.handleOptionsVolumeDrag, this);
    this.input.on("pointerup", this.stopOptionsVolumeDrag, this);
    this.input.on("pointerupoutside", this.stopOptionsVolumeDrag, this);
    this.refreshOptionsPanel();
  }

  private getRunToolCost(toolId: RunToolId): number {
    switch (toolId) {
      case "dewPulse":
        return DEW_PULSE_RUN_TOUCH_COST;
      case "rootSalve":
        return ROOT_SALVE_RUN_TOUCH_COST;
      case "tinySprinkler":
        return TINY_SPRINKLER_RUN_TOUCH_COST;
    }
  }

  private activateRunTool(toolId: RunToolId): void {
    switch (toolId) {
      case "dewPulse":
        this.handleDewPulseClick();
        return;
      case "rootSalve":
        this.handleRootSalveClick();
        return;
      case "tinySprinkler":
        this.handleTinySprinklerClick();
    }
  }

  private createRunToolSlot(toolId: RunToolId, cost: number, activate: () => void): RunToolSlotView {
    const view = RUN_TOOL_VIEW[toolId];
    const button = this.add
      .rectangle(0, 0, RUN_TOOL_SLOT_SIZE, RUN_TOOL_SLOT_SIZE, 0x102d1c, 0.94)
      .setDepth(16)
      .setStrokeStyle(2, view.color, 0.74)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    button.on("pointerdown", activate);
    button.on("pointerover", () => this.previewRunTool(toolId));
    button.on("pointerout", () => this.clearRunToolPreview(toolId));

    const icon = this.add
      .image(0, 0, view.iconKey)
      .setDepth(17)
      .setDisplaySize(RUN_TOOL_ICON_SIZE, RUN_TOOL_ICON_SIZE)
      .setVisible(false);
    const costBadge = this.add
      .rectangle(0, 0, 44, 15, 0x06150d, 0.92)
      .setDepth(18)
      .setStrokeStyle(1, view.color, 0.52)
      .setVisible(false);
    const costText = this.add.text(0, 0, `${cost} RT`, {
      align: "center",
      color: "#f7ffd6",
      fontFamily: "Arial, sans-serif",
      fontSize: "9px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(19).setVisible(false);
    const countBadge = this.add
      .circle(0, 0, 10, 0x173822, 0.98)
      .setDepth(20)
      .setStrokeStyle(2, 0xeaff9b, 0.82)
      .setVisible(false);
    const countText = this.add.text(0, 0, "", {
      align: "center",
      color: "#eaff9b",
      fontFamily: "Arial, sans-serif",
      fontSize: "10px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(21).setVisible(false);

    return { toolId, button, icon, costBadge, costText, countBadge, countText, available: false, usable: false, count: 0 };
  }

  private syncRunToolSlotCapacity(): void {
    this.runToolSlotCapacity = BASE_RUN_TOOL_SLOT_CAPACITY + getPermanentUpgradeEffects(this.state).runToolSlotBonus;
    this.equippedRunToolIds = RUN_TOOL_IDS.slice(0, this.runToolSlotCapacity);
    this.runToolBarLayout = getRunToolBarLayout(this.equippedRunToolIds.length, this.scale.width, this.runToolPage);
    this.runToolPage = this.runToolBarLayout.page;
  }

  update(_time: number, delta: number): void {
    if (this.introActive) {
      this.refreshReadout();
      this.animateScene(this.time.now);
      return;
    }

    const tick = advanceRun(this.state, delta, {
      drainMultiplier: this.activeRootCount === 1 ? ONE_TILE_SCOURGE_DRAIN_MULTIPLIER : 1,
    });
    if (this.state.phase === "active") {
      this.scourgeDamageAccum += tick.drained;
      this.scourgePulseElapsed += delta;
      this.woundElapsed += delta;
      const woundPressureActive = this.isWoundPressureActive();
      const warningRatio = this.getWoundWarningRatio();
      this.updateScourgeSenseWarning(woundPressureActive);
      if (woundPressureActive && !this.woundPressureWarned && this.getWoundPressureRatio() >= warningRatio) {
        this.woundPressureWarned = true;
        this.playScourgePressureWave("pressure-warning");
        this.publishBrowserDebugState();
      } else if (!woundPressureActive) {
        this.woundPressureWarned = false;
        this.clearScourgeSenseTarget();
      }
      if (
        woundPressureActive &&
        this.woundElapsed >= this.woundIntervalMs
      ) {
        this.woundElapsed = 0;
        this.woundPressureWarned = false;
        this.openRandomWound();
      }
      if (this.scourgeDamageAccum > 0 && this.scourgePulseElapsed >= 950) {
        this.playScourgeTick(this.scourgeDamageAccum);
        this.scourgeDamageAccum = 0;
        this.scourgePulseElapsed = 0;
      }
      this.updateTinySprinklers(delta);
    } else {
      this.scourgeDamageAccum = 0;
      this.scourgePulseElapsed = 0;
      this.tinySprinklerElapsed = 0;
      this.woundPressureWarned = false;
    }
    if (tick.lastStandTriggered) {
      this.scourgeDamageAccum = 0;
      this.scourgePulseElapsed = 0;
      this.woundElapsed = 0;
      this.woundPressureWarned = false;
      this.clearScourgeSenseTarget();
      this.playLastStandRevive();
      this.addFeedEntry("Last Stand", "Ancient HP restored once", "LS", "#eaff9b");
      this.saySensi("Last Stand.\nThe field refuses to fold.", "approval", 5200);
      this.refreshReadout();
      this.publishBrowserDebugState();
    }
    if (tick.becameDormant && !this.dormantAnimationPlayed) {
      this.dormantAnimationPlayed = true;
      this.saySensi("Game over.\nThe run died. The memory did not.", "dormant", 8000);
      this.savePermanentMemory();
      this.playDormancyCollapse();
      this.showDormancySummary();
      this.syncFirstRunObjectives();
    }
    this.refreshReadout();
    if (tick.becameDormant) {
      this.publishBrowserDebugState();
    }
    this.animateScene(this.time.now);
  }

  private createRootField(): void {
    for (let index = 0; index < ROOT_COUNT; index += 1) {
      const base = this.add.image(0, 0, "tile-dirt").setDepth(3);
      const grass = this.add.image(0, 0, GRASS_TEXTURES[index % GRASS_TEXTURES.length]).setDepth(4);
      const spark = this.add.image(0, 0, index % 7 === 0 ? "effect-magic-spore" : "effect-pollen-fleck").setDepth(6).setAlpha(0.72);
      const pulse = this.add.circle(0, 0, 8, 0xc9ff8f, 0.04).setDepth(5).setStrokeStyle(2, 0xe1ffb0, 0.28);
      const recoveryHalo = this.add.circle(0, 0, 10, 0x8fdfff, 0.05).setDepth(7).setStrokeStyle(2, 0xbff4ff, 0.48).setVisible(false);
      const senseHalo = this.add.circle(0, 0, 12, 0xffe38a, 0.08).setDepth(7.5).setStrokeStyle(3, 0xffefb0, 0.82).setVisible(false);
      const woundHalo = this.add.circle(0, 0, 12, 0x7c1939, 0.16).setDepth(7).setStrokeStyle(3, 0xff6b9a, 0.92).setVisible(false);
      const woundShard = this.add.rectangle(0, 0, 8, 24, 0xff6b9a, 0.88).setDepth(8).setStrokeStyle(1, 0xffd2df, 0.8).setVisible(false);
      this.rootNodes.push({
        base,
        grass,
        spark,
        pulse,
        recoveryHalo,
        senseHalo,
        woundHalo,
        woundShard,
        homeX: 0,
        homeY: 0,
        visualSize: 72,
        phase: index * 0.58,
        rootId: index,
        recoveringUntil: -Infinity,
        lastTouchAt: -Infinity,
        touchImpactAt: -Infinity,
        touchImpactStrength: 0,
        touchImpactDirection: index % 2 === 0 ? 1 : -1,
      });
    }
  }

  private layout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const top = Math.max(24, height * 0.07);
    const compact = width < 720;

    const coverScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setPosition(centerX, height / 2).setScale(coverScale);
    this.shade.setSize(width, height);
    this.scourgeVeil.setSize(width, height);

    const panelWidth = Math.min(HUD_PANEL_BASE_WIDTH, Math.max(360, width - 42));
    const panelScaleX = panelWidth / HUD_PANEL_BASE_WIDTH;
    this.hudPanel.setScale(panelScaleX, 1);
    this.hudPanel.setPosition(centerX, top + HUD_PANEL_BASE_HEIGHT / 2);
    const hudLeft = centerX - panelWidth / 2;
    const hudRight = centerX + panelWidth / 2;
    this.titleText.setText(width < 600 ? "Ancient Grass" : "Ancient Grass: Scourge");
    this.titleText.setFontSize(width < 600 ? 23 : width < 900 ? 25 : 28);
    this.titleText.setWordWrapWidth(Math.max(210, panelWidth - OPTIONS_BUTTON_WIDTH - 124));
    this.titleText.setPosition(hudLeft + 38, top + 2);
    this.objectiveText.setPosition(hudLeft + 40, top + 52);
    this.objectiveText.setWordWrapWidth(panelWidth - 80);
    this.hpBarBack.setPosition(hudLeft + 38, top + 82).setSize(panelWidth - 76, 24);
    this.hpBarFill.setPosition(hudLeft + 38, top + 82);
    this.hpBarGlint.setPosition(this.hpBarFill.x, this.hpBarFill.y).setSize(18, 20);
    this.hpText.setPosition(hudLeft + 40, top + 98);
    this.runTouchText.setPosition(hudLeft + 40, top + 124);
    const optionsButtonX = hudRight - OPTIONS_BUTTON_WIDTH / 2 - 18;
    const optionsButtonY = top + 22;
    this.optionsButton.setPosition(optionsButtonX, optionsButtonY).setSize(OPTIONS_BUTTON_WIDTH, OPTIONS_BUTTON_HEIGHT);
    this.optionsButtonText.setPosition(optionsButtonX, optionsButtonY);
    this.scourgeBarFill.setPosition(centerX - 82, top + 172);
    this.scourgeText.setPosition(hudLeft + 40, top + 160);
    const promptY = height - 96;
    this.promptText.setWordWrapWidth(Math.min(580, width - 52));
    this.promptText.setPosition(centerX, promptY);

    const sidePanelVisible = width >= 1040 && height >= 650;
    const compactPanelsVisible = !sidePanelVisible && width >= COMPACT_PANEL_MIN_WIDTH && height >= COMPACT_PANEL_MIN_HEIGHT;
    const compactPanelsStacked = compactPanelsVisible && width < COMPACT_STACK_MAX_WIDTH && height >= COMPACT_STACK_MIN_HEIGHT;
    const activeFieldTopOffset = this.introActive ? 252 : 236;
    const fieldAreaTop = top + (compactPanelsVisible ? (compactPanelsStacked ? 408 : 326) : activeFieldTopOffset);
    const fieldAreaBottom = promptY - 52;
    const availableFieldHeight = Math.max(230, fieldAreaBottom - fieldAreaTop);
    const maxGridSize = this.getMaxGridSize();
    const minGridSize = Math.min(maxGridSize, this.activeGridSize * 84 + 64);
    const gridSize = Math.min(maxGridSize, Math.max(minGridSize, Math.min(width * 0.58, availableFieldHeight)));
    const tileSize = gridSize / this.activeGridSize;
    const startX = centerX - gridSize / 2 + tileSize / 2;
    const startY = fieldAreaTop + Math.max(0, availableFieldHeight - gridSize) / 2 + tileSize / 2;
    this.fieldCenterX = centerX;
    this.fieldCenterY = startY + gridSize / 2 - tileSize / 2;
    this.fieldTouchRadius = Math.max(tileSize * 0.8, gridSize * 0.56);
    const fieldPanelHeight = gridSize + (this.activeGridSize === 1 ? 118 : 78);
    this.fieldPanel.setScale((gridSize + 78) / FIELD_PANEL_BASE_WIDTH, fieldPanelHeight / FIELD_PANEL_BASE_HEIGHT);
    this.fieldPanel.setPosition(centerX, startY + gridSize / 2 - tileSize / 2);
    this.rootAura.setPosition(this.fieldCenterX, this.fieldCenterY).setRadius(gridSize * 0.36);
    this.touchHintRing.setPosition(this.fieldCenterX, this.fieldCenterY).setRadius(gridSize * 0.43);
    this.touchHintText.setPosition(this.fieldCenterX, startY - 28);
    this.oneTileMasteryText
      .setPosition(this.fieldCenterX, this.fieldCenterY + tileSize / 2 + 14)
      .setWordWrapWidth(gridSize + 54);
    this.layoutRunToolBar(width, height, centerX, this.fieldCenterY, gridSize, promptY);
    const introPanelVisible = this.introActive && this.state.phase === "active" && !compactPanelsVisible;
    const introPanelWidth = Math.min(INTRO_PANEL_BASE_WIDTH, width - 48);
    const introPanelHeight = compact ? 76 : INTRO_PANEL_BASE_HEIGHT;
    const introPanelTop = Math.max(top + HUD_PANEL_BASE_HEIGHT + 8, fieldAreaTop - introPanelHeight - 4);
    const introPanelY = introPanelTop + introPanelHeight / 2;
    this.introPanel
      .setVisible(introPanelVisible)
      .setScale(introPanelWidth / INTRO_PANEL_BASE_WIDTH, introPanelHeight / INTRO_PANEL_BASE_HEIGHT)
      .setPosition(centerX, introPanelY);
    this.introTitle
      .setVisible(introPanelVisible)
      .setFontSize(compact ? 15 : 18)
      .setPosition(centerX - introPanelWidth / 2 + 24, introPanelY - introPanelHeight / 2 + (compact ? 20 : 24));
    this.introBody
      .setVisible(introPanelVisible)
      .setFontSize(compact ? 12 : 14)
      .setWordWrapWidth(introPanelWidth - 48)
      .setPosition(centerX - introPanelWidth / 2 + 24, introPanelY - introPanelHeight / 2 + (compact ? 34 : 42));

    this.summaryBackdrop.setPosition(0, 0).setSize(width, height);
    const metaMargin = width < 720 ? 10 : 22;
    const summaryWidth = Math.max(320, width - metaMargin * 2);
    const summaryHeight = Math.max(420, height - metaMargin * 2);
    const summaryLeft = centerX - summaryWidth / 2;
    const summaryTop = height / 2 - summaryHeight / 2;
    const summaryRight = summaryLeft + summaryWidth;
    const summaryBottom = summaryTop + summaryHeight;
    const compactReport = summaryWidth < 820;
    this.summaryPanel.setScale(summaryWidth / SUMMARY_PANEL_BASE_WIDTH, summaryHeight / SUMMARY_PANEL_BASE_HEIGHT);
    this.summaryPanel.setPosition(centerX, height / 2);
    this.summaryTitle.setText("Memory Grove").setFontSize(width < 720 ? 27 : 36).setPosition(centerX, summaryTop + 42);
    this.summarySubtitle
      .setText("Game Over: dormancy claimed the Ancient Grass. Spend memory, then begin the next run.")
      .setFontSize(width < 720 ? 12 : 14)
      .setPosition(centerX, summaryTop + 76);
    this.summarySubtitle.setWordWrapWidth(summaryWidth - (compactReport ? 110 : 80));

    const contentTop = summaryTop + (compactReport ? 100 : 112);
    const contentBottom = summaryBottom - (compactReport ? 116 : 122);
    const contentHeight = Math.max(260, contentBottom - contentTop);
    const contentLeft = summaryLeft + 26;
    const contentRight = summaryRight - 26;
    const contentWidth = Math.max(300, contentRight - contentLeft);
    const gap = compactReport ? 12 : 18;
    const summaryFrameWidth = compactReport ? contentWidth : Math.min(300, Math.max(250, contentWidth * 0.27));
    const detailFrameWidth = compactReport ? contentWidth : Math.min(290, Math.max(246, contentWidth * 0.25));
    const skillFrameWidth = compactReport ? contentWidth : Math.max(340, contentWidth - summaryFrameWidth - detailFrameWidth - gap * 2);
    const summaryFrameHeight = compactReport ? Math.min(168, contentHeight * 0.34) : contentHeight;
    const detailFrameHeight = compactReport ? Math.min(200, Math.max(176, contentHeight * 0.31)) : contentHeight;
    const skillFrameHeight = compactReport ? Math.max(230, contentHeight - summaryFrameHeight - detailFrameHeight - gap * 2) : contentHeight;
    const summaryFrameX = compactReport ? centerX : contentLeft + summaryFrameWidth / 2;
    const summaryFrameY = compactReport ? contentTop + summaryFrameHeight / 2 : contentTop + summaryFrameHeight / 2;
    const skillFrameX = compactReport
      ? centerX
      : contentLeft + summaryFrameWidth + gap + skillFrameWidth / 2;
    const skillFrameY = compactReport
      ? contentTop + summaryFrameHeight + gap + skillFrameHeight / 2
      : contentTop + skillFrameHeight / 2;
    const detailFrameX = compactReport
      ? centerX
      : contentRight - detailFrameWidth / 2;
    const detailFrameY = compactReport
      ? contentBottom - detailFrameHeight / 2
      : contentTop + detailFrameHeight / 2;

    this.summaryStatsFrame.setPosition(summaryFrameX, summaryFrameY).setSize(summaryFrameWidth, summaryFrameHeight);
    const summaryFrameLeft = summaryFrameX - summaryFrameWidth / 2;
    const summaryFrameTop = summaryFrameY - summaryFrameHeight / 2;
    this.summaryBody.setFontSize(compactReport ? 11 : 13);
    this.summaryBody.setWordWrapWidth(summaryFrameWidth - 34);
    this.summaryBody.setPosition(summaryFrameLeft + 18, summaryFrameTop + (compactReport ? 12 : 18));
    this.summaryRewardText.setFontSize(compactReport ? 21 : 27);
    this.summaryRewardText.setWordWrapWidth(summaryFrameWidth - 34);
    this.summaryRewardText.setPosition(summaryFrameLeft + 18, summaryFrameTop + (compactReport ? 50 : 98));
    this.summaryStatsText.setFontSize(compactReport ? 10 : 12);
    this.summaryStatsText.setWordWrapWidth(summaryFrameWidth - 34);
    this.summaryStatsText.setPosition(summaryFrameLeft + 18, summaryFrameTop + (compactReport ? 84 : 150));
    if (this.summaryPanel.visible) {
      this.refreshDormancyReport();
    }

    this.skillTreeFrame.setPosition(skillFrameX, skillFrameY).setSize(skillFrameWidth, skillFrameHeight);
    const skillFrameLeft = skillFrameX - skillFrameWidth / 2;
    const skillFrameTop = skillFrameY - skillFrameHeight / 2;
    this.skillTreeTitle
      .setText(compactReport ? "Memory Tree" : "Memory Skill Tree")
      .setFontSize(compactReport ? 18 : 24)
      .setPosition(skillFrameLeft + 22, skillFrameTop + 18);
    this.skillTreeHelp
      .setText(`Available GT: ${this.state.economy.permanentGrassTouches}\nMemories carry into future runs.`)
      .setWordWrapWidth(skillFrameWidth - 36)
      .setPosition(skillFrameLeft + 22, skillFrameTop + (compactReport ? 44 : 54));
    this.skillTreeConnector.setVisible(false);
    const zoomControlY = skillFrameTop + 30;
    const zoomInX = skillFrameLeft + skillFrameWidth - 34;
    const zoomResetX = zoomInX - 54;
    const zoomOutX = zoomResetX - 52;
    this.memoryTreeZoomOutButton.setPosition(zoomOutX, zoomControlY);
    this.memoryTreeZoomOutText.setPosition(zoomOutX, zoomControlY);
    this.memoryTreeZoomResetButton.setPosition(zoomResetX, zoomControlY);
    this.memoryTreeZoomResetText.setPosition(zoomResetX, zoomControlY);
    this.memoryTreeZoomInButton.setPosition(zoomInX, zoomControlY);
    this.memoryTreeZoomInText.setPosition(zoomInX, zoomControlY);

    const treeLeft = skillFrameLeft + 28;
    const treeTop = skillFrameTop + (compactReport ? 64 : 92);
    const treeWidth = skillFrameWidth - 56;
    const treeHeight = skillFrameHeight - (compactReport ? 82 : 126);
    const nodeSize = MEMORY_TREE_NODE_SIZE;
    this.memoryTreeViewport = {
      centerX: treeLeft + treeWidth / 2,
      centerY: treeTop + treeHeight / 2,
      width: treeWidth,
      height: treeHeight,
    };
    this.memoryTreeFitScale = Math.min(
      treeWidth / MEMORY_TREE_WORLD_WIDTH,
      treeHeight / MEMORY_TREE_WORLD_HEIGHT,
    );
    this.memoryTreeFittedWidth = MEMORY_TREE_WORLD_WIDTH * this.memoryTreeFitScale;
    this.memoryTreeFittedHeight = MEMORY_TREE_WORLD_HEIGHT * this.memoryTreeFitScale;
    this.memoryTreeMaskShape.clear().fillStyle(0xffffff, 1).fillRect(treeLeft, treeTop, treeWidth, treeHeight);
    const clampedPan = clampMemoryTreePan(
      { x: this.memoryTreePanX, y: this.memoryTreePanY },
      this.memoryTreeViewport,
      this.memoryTreeZoom,
      this.getMemoryTreeFittedContentSize(),
    );
    this.memoryTreePanX = clampedPan.x;
    this.memoryTreePanY = clampedPan.y;
    this.applyMemoryTreeViewTransform();
    this.memoryUpgradeButtons.forEach((button) => {
      const view = MEMORY_UPGRADE_VIEW[button.upgradeId];
      const x = MEMORY_TREE_WORLD_WIDTH * (view.x - 0.5);
      const y = MEMORY_TREE_WORLD_HEIGHT * (view.y - 0.5);
      button.nodeSize = nodeSize;
      button.background
        .setPosition(x, y + nodeSize * 0.28)
        .setSize(nodeSize + (compactReport ? 42 : 70), nodeSize + (compactReport ? 48 : 72));
      button.glow.setPosition(x, y).setRadius(nodeSize * 0.7);
      button.hoverRing.setPosition(x, y).setRadius(nodeSize * 0.78);
      button.frame.setPosition(x, y).setDisplaySize(nodeSize, nodeSize);
      button.icon.setPosition(x, y).setDisplaySize(nodeSize * 0.28, nodeSize * 0.28);
      button.title
        .setFontSize(16)
        .setPosition(
          x + (view.labelOffsetX ?? 0),
          y + (view.labelOffsetY ?? nodeSize * 0.76),
        );
      button.title.setWordWrapWidth(nodeSize + 68);
      button.branch.setFontSize(10).setPosition(x, y + nodeSize * 1);
      button.branch.setAlpha(0);
      button.branch.setWordWrapWidth(nodeSize + 70);
      button.detail
        .setFontSize(11)
        .setLineSpacing(1)
        .setPosition(x, y + nodeSize * 1.14);
      button.detail.setWordWrapWidth(nodeSize + 74);
      button.detail.setVisible(false);
    });
    this.drawMemorySkillTreeLines(nodeSize);
    this.syncMemoryTreeInteractiveBounds();

    const hoverCardWidth = Phaser.Math.Clamp(skillFrameWidth * 0.38, 190, 240);
    const hoverCardHeight = 98;
    const hoverCardX = skillFrameLeft + skillFrameWidth - hoverCardWidth / 2 - 16;
    const hoverCardY = skillFrameTop + hoverCardHeight / 2 + 68;
    const hoverCardLeft = hoverCardX - hoverCardWidth / 2;
    const hoverCardTop = hoverCardY - hoverCardHeight / 2;
    this.memoryHoverCardEnabled = !compactReport && skillFrameWidth >= 440 && skillFrameHeight >= 340;
    this.memoryHoverFrame.setPosition(hoverCardX, hoverCardY).setSize(hoverCardWidth, hoverCardHeight);
    this.memoryHoverTitle
      .setFontSize(16)
      .setWordWrapWidth(hoverCardWidth - 26)
      .setPosition(hoverCardLeft + 13, hoverCardTop + 11);
    this.memoryHoverBody
      .setFontSize(11)
      .setLineSpacing(2)
      .setWordWrapWidth(hoverCardWidth - 26)
      .setPosition(hoverCardLeft + 13, hoverCardTop + 38);

    this.memoryDetailFrame.setPosition(detailFrameX, detailFrameY).setSize(detailFrameWidth, detailFrameHeight);
    const detailFrameLeft = detailFrameX - detailFrameWidth / 2;
    const detailFrameTop = detailFrameY - detailFrameHeight / 2;
    const detailIconSize = compactReport ? 50 : Phaser.Math.Clamp(detailFrameWidth * 0.38, 80, 104);
    const detailIconX = compactReport ? detailFrameLeft + detailFrameWidth - 52 : detailFrameX;
    const detailIconY = detailFrameTop + (compactReport ? 48 : 122);
    this.memoryDetailIconBaseSize = detailIconSize;
    this.memoryDetailTitle
      .setFontSize(compactReport ? 18 : 24)
      .setWordWrapWidth(detailFrameWidth - 36)
      .setPosition(detailFrameLeft + 18, detailFrameTop + 18);
    this.memoryDetailBranch.setFontSize(compactReport ? 11 : 13).setPosition(detailFrameLeft + 18, detailFrameTop + (compactReport ? 46 : 54));
    this.memoryDetailIconGlow.setPosition(detailIconX, detailIconY).setRadius(detailIconSize * 0.64);
    this.memoryDetailIconFrame.setPosition(detailIconX, detailIconY).setDisplaySize(detailIconSize, detailIconSize);
    this.memoryDetailIcon.setPosition(detailIconX, detailIconY).setDisplaySize(detailIconSize * 0.54, detailIconSize * 0.54);
    this.memoryDetailBody
      .setFontSize(compactReport ? 10 : 14)
      .setLineSpacing(compactReport ? 2 : 4)
      .setWordWrapWidth(detailFrameWidth - 36)
      .setPosition(
        detailFrameLeft + 18,
        compactReport ? detailFrameTop + 76 : detailIconY + detailIconSize * 0.58 + 20,
      );
    this.memoryDetailCost
      .setFontSize(compactReport ? 11 : 14)
      .setLineSpacing(compactReport ? 2 : 4)
      .setWordWrapWidth(detailFrameWidth - 36)
      .setPosition(detailFrameLeft + 18, detailFrameY + detailFrameHeight / 2 - (compactReport ? 50 : 70));
    this.refreshMemoryDetail();
    this.lockedMetaNodes.forEach((node, index) => {
      const x = (index % 2 === 0 ? 1 : -1) * Math.min(120, treeWidth * 0.3);
      const y = treeHeight / 2 - 40;
      node.background.setPosition(x, y).setSize(120, 48);
      node.title.setPosition(x - 48, y - 16);
      node.detail.setPosition(x - 48, y + 8);
      node.detail.setWordWrapWidth(96);
    });

    this.summaryHint.setFontSize(compactReport ? 12 : 15).setPosition(centerX, summaryBottom - (compactReport ? 90 : 94));
    this.summaryHint.setWordWrapWidth(summaryWidth - 80);
    const nextRunWidth = compactReport ? 230 : 300;
    const nextRunHeight = compactReport ? 48 : 54;
    const nextRunY = summaryBottom - (compactReport ? 36 : 39);
    this.nextRunGlow.setPosition(centerX, nextRunY).setSize(nextRunWidth + 16, nextRunHeight + 12);
    this.nextRunButton.setPosition(centerX, nextRunY).setSize(nextRunWidth, nextRunHeight);
    this.nextRunText.setFontSize(compactReport ? 15 : 17).setPosition(centerX, nextRunY);
    this.refreshMemoryTreeZoomControls();
    this.layoutOptionsPanel(width, height, centerX);
    const compactMetaOptionsHidden = this.summaryPanel.visible && compactReport && width < 720;
    if (this.summaryPanel.visible && !compactMetaOptionsHidden) {
      const metaOptionsX = summaryRight - OPTIONS_BUTTON_WIDTH / 2 - 34;
      const metaOptionsY = summaryTop + 56;
      this.optionsButton.setPosition(metaOptionsX, metaOptionsY).setSize(OPTIONS_BUTTON_WIDTH, OPTIONS_BUTTON_HEIGHT);
      this.optionsButtonText.setPosition(metaOptionsX, metaOptionsY);
    }
    this.optionsButton.setVisible(!compactMetaOptionsHidden);
    this.optionsButtonText.setVisible(!compactMetaOptionsHidden);

    const sideX = Math.max(150, centerX - panelWidth / 2 - SIDE_PANEL_BASE_WIDTH / 2 - 18);
    const playerPanelVisible = sidePanelVisible || compactPanelsVisible;
    const advisorPanelVisible = sidePanelVisible || compactPanelsVisible;
    this.sensiPanel.setVisible(playerPanelVisible);
    this.sensiPortraitFrame.setVisible(playerPanelVisible);
    this.sensiPortrait.setVisible(playerPanelVisible);
    this.sensiGlint.setVisible(false);
    this.sensiTitle.setVisible(playerPanelVisible);
    this.sensiBody.setVisible(playerPanelVisible);
    this.advisorPanel.setVisible(advisorPanelVisible);
    this.advisorTitle.setVisible(advisorPanelVisible);
    this.advisorBody.setVisible(advisorPanelVisible);
    const feedPanelVisible = false;
    this.feedPanel.setVisible(feedPanelVisible);
    this.feedTitle.setVisible(feedPanelVisible);
    this.feedRows.forEach((row) => row.setVisible(feedPanelVisible));
    if (sidePanelVisible) {
      const sensiLeft = sideX - SIDE_PANEL_BASE_WIDTH / 2 + 18;
      this.sensiPortraitBaseX = sensiLeft + 37;
      this.sensiPortraitBaseY = top + 68;
      this.sensiPortraitDisplaySize = PLAYER_PORTRAIT_SIZE;
      this.sensiPanel.setScale(1, PLAYER_PANEL_HEIGHT / SIDE_PANEL_BASE_HEIGHT);
      this.sensiPanel.setAlpha(0.92);
      this.sensiPanel.setPosition(sideX, top + 82);
      this.sensiPortraitFrame.setSize(74, 74);
      this.sensiPortraitFrame.setPosition(this.sensiPortraitBaseX, this.sensiPortraitBaseY);
      this.sensiPortrait.setDisplaySize(this.sensiPortraitDisplaySize, this.sensiPortraitDisplaySize).setPosition(this.sensiPortraitBaseX, this.sensiPortraitBaseY);
      this.sensiGlint.setAlpha(0);
      this.sensiTitle.setFontSize(22);
      this.sensiTitle.setPosition(sensiLeft + 88, top + 28);
      this.sensiBody.setFontSize(12);
      this.sensiBody.setLineSpacing(4);
      this.sensiBody.setPosition(sensiLeft + 88, top + 58);
      this.sensiBody.setWordWrapWidth(SIDE_PANEL_BASE_WIDTH - 118);
      this.advisorPanel.setScale(1);
      this.advisorPanel.setPosition(sideX, top + 214);
      this.advisorTitle.setFontSize(17);
      this.advisorTitle.setPosition(sensiLeft, top + 168);
      this.advisorBody.setFontSize(13);
      this.advisorBody.setLineSpacing(3);
      this.advisorBody.setPosition(sensiLeft, top + 194);
      this.advisorBody.setWordWrapWidth(SIDE_PANEL_BASE_WIDTH - 36);
      this.feedPanel.setPosition(sideX, top + 372);
      this.feedTitle.setPosition(sideX - SIDE_PANEL_BASE_WIDTH / 2 + 18, top + 306);
      this.feedRows.forEach((row, index) => {
        row.setPosition(sideX - SIDE_PANEL_BASE_WIDTH / 2 + 18, top + 338 + index * 29);
        row.setWordWrapWidth(SIDE_PANEL_BASE_WIDTH - 34);
      });
    } else if (compactPanelsVisible) {
      const compactPanelWidth = compactPanelsStacked
        ? Math.min(520, width - 44)
        : Math.min(250, (width - 52 - COMPACT_PANEL_GAP) / 2);
      const compactPlayerX = compactPanelsStacked ? centerX : centerX - compactPanelWidth / 2 - COMPACT_PANEL_GAP / 2;
      const compactAdvisorX = compactPanelsStacked ? centerX : centerX + compactPanelWidth / 2 + COMPACT_PANEL_GAP / 2;
      const compactPlayerY = top + (compactPanelsStacked ? 220 : 230);
      const compactAdvisorY = compactPanelsStacked ? compactPlayerY + COMPACT_PLAYER_PANEL_HEIGHT + COMPACT_PANEL_GAP : compactPlayerY;
      const playerLeft = compactPlayerX - compactPanelWidth / 2 + 14;
      const advisorLeft = compactAdvisorX - compactPanelWidth / 2 + 14;
      const showCompactPortrait = compactPanelsStacked || compactPanelWidth >= 210;
      const playerTextLeft = showCompactPortrait ? playerLeft + 62 : playerLeft + 2;
      const compactPlayerTitleSize = compactPanelWidth < 190 ? 14 : compactPanelsStacked ? 18 : 16;
      const compactBodySize = compactPanelsStacked ? 12 : 10;

      this.sensiPanel.setScale(compactPanelWidth / SIDE_PANEL_BASE_WIDTH, COMPACT_PLAYER_PANEL_HEIGHT / SIDE_PANEL_BASE_HEIGHT);
      this.sensiPanel.setAlpha(0.9);
      this.sensiPanel.setPosition(compactPlayerX, compactPlayerY);
      this.sensiPortraitBaseX = playerLeft + 26;
      this.sensiPortraitBaseY = compactPlayerY;
      this.sensiPortraitDisplaySize = compactPanelsStacked ? 46 : 42;
      this.sensiPortraitFrame.setVisible(showCompactPortrait);
      this.sensiPortrait.setVisible(showCompactPortrait);
      this.sensiPortraitFrame.setSize(this.sensiPortraitDisplaySize + 8, this.sensiPortraitDisplaySize + 8);
      this.sensiPortraitFrame.setPosition(this.sensiPortraitBaseX, this.sensiPortraitBaseY);
      this.sensiPortrait.setDisplaySize(this.sensiPortraitDisplaySize, this.sensiPortraitDisplaySize).setPosition(this.sensiPortraitBaseX, this.sensiPortraitBaseY);
      this.sensiGlint.setAlpha(0);
      this.sensiTitle.setFontSize(compactPlayerTitleSize);
      this.sensiTitle.setPosition(playerTextLeft, compactPlayerY - 30);
      this.sensiBody.setFontSize(compactBodySize);
      this.sensiBody.setLineSpacing(compactPanelsStacked ? 2 : 1);
      this.sensiBody.setPosition(playerTextLeft, compactPlayerY - 7);
      this.sensiBody.setWordWrapWidth(Math.max(96, compactPanelWidth - (showCompactPortrait ? 78 : 28)));

      this.advisorPanel.setScale(compactPanelWidth / SIDE_PANEL_BASE_WIDTH, COMPACT_ADVISOR_PANEL_HEIGHT / ADVISOR_PANEL_BASE_HEIGHT);
      this.advisorPanel.setAlpha(0.9);
      this.advisorPanel.setPosition(compactAdvisorX, compactAdvisorY);
      this.advisorTitle.setFontSize(compactPanelWidth < 190 ? 14 : 16);
      this.advisorTitle.setPosition(advisorLeft, compactAdvisorY - 30);
      this.advisorBody.setFontSize(compactBodySize);
      this.advisorBody.setLineSpacing(compactPanelsStacked ? 2 : 1);
      this.advisorBody.setPosition(advisorLeft, compactAdvisorY - 8);
      this.advisorBody.setWordWrapWidth(Math.max(110, compactPanelWidth - 28));
    }

    this.rootNodes.forEach((node, index) => {
      const active = index < this.activeRootCount;
      node.base.setVisible(active);
      node.grass.setVisible(active);
      node.spark.setVisible(active);
      node.pulse.setVisible(active);
      if (!active) {
        node.recoveryHalo.setVisible(false);
        node.senseHalo.setVisible(false);
        node.woundHalo.setVisible(false);
        node.woundShard.setVisible(false);
        node.homeX = this.fieldCenterX;
        node.homeY = this.fieldCenterY;
        return;
      }

      const col = index % this.activeGridSize;
      const row = Math.floor(index / this.activeGridSize);
      const x = startX + col * tileSize;
      const y = startY + row * tileSize;
      const visualSize = tileSize - 8;
      node.homeX = x;
      node.homeY = y;
      node.visualSize = visualSize;
      node.base.setPosition(x, y).setDisplaySize(visualSize, visualSize);
      node.grass.setPosition(x, y).setDisplaySize(visualSize * 0.92, visualSize * 0.92);
      node.spark.setPosition(x + visualSize * 0.2, y - visualSize * 0.2).setDisplaySize(visualSize * 0.16, visualSize * 0.16);
      node.pulse.setPosition(x, y).setRadius(Math.max(5, tileSize * 0.11));
      node.recoveryHalo.setPosition(x, y).setRadius(Math.max(14, tileSize * 0.18));
      node.senseHalo.setPosition(x, y).setRadius(Math.max(16, tileSize * 0.22));
      node.woundHalo.setPosition(x, y).setRadius(Math.max(14, tileSize * 0.18));
      node.woundShard.setPosition(x, y - visualSize * 0.2).setSize(Math.max(5, visualSize * 0.06), Math.max(18, visualSize * 0.22));
    });
  }

  private layoutRunToolBar(
    width: number,
    height: number,
    fieldCenterX: number,
    fieldCenterY: number,
    gridSize: number,
    promptY: number,
  ): void {
    this.runToolBarLayout = getRunToolBarLayout(this.equippedRunToolIds.length, width, this.runToolPage);
    this.runToolPage = this.runToolBarLayout.page;
    const barWidth = this.runToolBarLayout.width;
    const barHeight = this.runToolBarLayout.height;
    const preferredX = fieldCenterX + gridSize / 2 + barWidth / 2 + 26;
    const barX = Phaser.Math.Clamp(preferredX, barWidth / 2 + 12, width - barWidth / 2 - 12);
    const minY = barHeight / 2 + 12;
    const maxY = Math.max(minY, Math.min(height - barHeight / 2 - 12, promptY - barHeight / 2 - 12));
    const barY = Phaser.Math.Clamp(fieldCenterY, minY, maxY);
    this.runToolBar.setPosition(barX, barY).setSize(barWidth, barHeight);

    RUN_TOOL_IDS.forEach((toolId) => {
      const slot = this.runToolSlots[toolId];
      const catalogIndex = this.equippedRunToolIds.indexOf(toolId);
      const position = this.runToolBarLayout.slotPositions.find((candidate) => candidate.catalogIndex === catalogIndex);
      if (!position) {
        this.applyRunToolSlotVisibility(slot);
        return;
      }
      const slotX = barX + position.x;
      const slotY = barY + position.y;
      slot.button.setPosition(slotX, slotY).setSize(RUN_TOOL_SLOT_SIZE, RUN_TOOL_SLOT_SIZE);
      slot.icon.setPosition(slotX, slotY - 6).setDisplaySize(RUN_TOOL_ICON_SIZE, RUN_TOOL_ICON_SIZE);
      slot.costBadge.setPosition(slotX, slotY + RUN_TOOL_SLOT_SIZE / 2 - 9);
      slot.costText.setPosition(slotX, slotY + RUN_TOOL_SLOT_SIZE / 2 - 9);
      slot.countBadge.setPosition(slotX + RUN_TOOL_SLOT_SIZE / 2 - 7, slotY - RUN_TOOL_SLOT_SIZE / 2 + 7);
      slot.countText.setPosition(slot.countBadge.x, slot.countBadge.y);
      this.applyRunToolSlotVisibility(slot);
    });
    const navigationY = barY + this.runToolBarLayout.navigationY;
    this.runToolPreviousPageButton.setPosition(barX - 30, navigationY);
    this.runToolPreviousPageText.setPosition(barX - 30, navigationY);
    this.runToolPageText.setPosition(barX, navigationY).setText(`${this.runToolPage + 1}/${this.runToolBarLayout.pageCount}`);
    this.runToolNextPageButton.setPosition(barX + 30, navigationY);
    this.runToolNextPageText.setPosition(barX + 30, navigationY);
    this.layoutRunToolTooltip();
  }

  private layoutRunToolTooltip(): void {
    if (!this.hoveredRunToolId) {
      return;
    }

    const slot = this.runToolSlots[this.hoveredRunToolId];
    const width = this.scale.width;
    const height = this.scale.height;
    const rightX = slot.button.x + RUN_TOOL_SLOT_SIZE / 2 + 12 + RUN_TOOL_TOOLTIP_WIDTH / 2;
    const leftX = slot.button.x - RUN_TOOL_SLOT_SIZE / 2 - 12 - RUN_TOOL_TOOLTIP_WIDTH / 2;
    const tooltipX = rightX + RUN_TOOL_TOOLTIP_WIDTH / 2 <= width - 12 ? rightX : Math.max(RUN_TOOL_TOOLTIP_WIDTH / 2 + 12, leftX);
    const tooltipY = Phaser.Math.Clamp(
      slot.button.y,
      RUN_TOOL_TOOLTIP_HEIGHT / 2 + 12,
      height - RUN_TOOL_TOOLTIP_HEIGHT / 2 - 12,
    );
    const tooltipLeft = tooltipX - RUN_TOOL_TOOLTIP_WIDTH / 2;
    const tooltipTop = tooltipY - RUN_TOOL_TOOLTIP_HEIGHT / 2;
    this.runToolTooltipFrame.setPosition(tooltipX, tooltipY);
    this.runToolTooltipTitle.setPosition(tooltipLeft + 12, tooltipTop + 9);
    this.runToolTooltipBody.setPosition(tooltipLeft + 12, tooltipTop + 32);
  }

  private layoutOptionsPanel(width: number, height: number, centerX: number): void {
    this.optionsBackdrop.setPosition(0, 0).setSize(width, height);
    const panelWidth = Math.min(OPTIONS_PANEL_BASE_WIDTH, width - 48);
    const panelHeight = Math.min(OPTIONS_PANEL_BASE_HEIGHT, height - 72);
    const centerY = height / 2;
    const panelTop = centerY - panelHeight / 2;
    const panelBottom = centerY + panelHeight / 2;
    const trackWidth = Math.max(160, Math.min(OPTIONS_TRACK_BASE_WIDTH, panelWidth - 112));
    const trackX = centerX - trackWidth / 2;
    const musicLabelY = panelTop + 86;
    const musicTrackY = panelTop + 120;
    const sfxLabelY = panelTop + 164;
    const sfxTrackY = panelTop + 198;
    const buttonY = panelBottom - 44;

    this.optionsPanel.setScale(panelWidth / OPTIONS_PANEL_BASE_WIDTH, panelHeight / OPTIONS_PANEL_BASE_HEIGHT);
    this.optionsPanel.setPosition(centerX, centerY);
    this.optionsTitle.setPosition(centerX, panelTop + 40);
    this.optionsMusicLabel.setPosition(centerX, musicLabelY);
    this.optionsMusicTrack.setPosition(trackX, musicTrackY).setSize(trackWidth, OPTIONS_TRACK_BASE_HEIGHT);
    this.optionsMusicFill.setPosition(trackX, musicTrackY);
    this.optionsMusicHit.setPosition(centerX, musicTrackY).setSize(trackWidth + 38, OPTIONS_HIT_BASE_HEIGHT);
    this.optionsSfxLabel.setPosition(centerX, sfxLabelY);
    this.optionsSfxTrack.setPosition(trackX, sfxTrackY).setSize(trackWidth, OPTIONS_TRACK_BASE_HEIGHT);
    this.optionsSfxFill.setPosition(trackX, sfxTrackY);
    this.optionsSfxHit.setPosition(centerX, sfxTrackY).setSize(trackWidth + 38, OPTIONS_HIT_BASE_HEIGHT);
    this.optionsMusicToggleButton.setPosition(centerX - 112, buttonY).setSize(124, 38);
    this.optionsMusicToggleText.setPosition(centerX - 112, buttonY);
    this.optionsSfxTestButton.setPosition(centerX + 22, buttonY).setSize(112, 38);
    this.optionsSfxTestText.setPosition(centerX + 22, buttonY);
    this.optionsCloseButton.setPosition(centerX + 136, buttonY).setSize(92, 38);
    this.optionsCloseText.setPosition(centerX + 136, buttonY);
    this.optionsMusicTrackX = trackX;
    this.optionsMusicTrackWidth = trackWidth;
    this.optionsSfxTrackX = trackX;
    this.optionsSfxTrackWidth = trackWidth;
    this.refreshOptionsPanel();
  }

  private getMaxGridSize(): number {
    if (this.activeGridSize <= 1) {
      return 190;
    }

    if (this.activeGridSize <= 2) {
      return 300;
    }

    if (this.activeGridSize <= 3) {
      return 380;
    }

    return 430;
  }

  private getActiveRootNodes(): RootNodeView[] {
    return this.rootNodes.slice(0, this.activeRootCount);
  }

  private applyOneTileMasteryPresentation(announce: boolean): void {
    const mastery = getFirstRunOneTileMastery(this.objectiveState);
    this.oneTileMasteryRank = mastery.rank;
    const ancientRoot = this.rootNodes[0];
    const colors = [0xdff6ca, 0xd9c48f, 0xbff4ff, 0xa8df68, 0xffef78];
    const color = colors[Math.min(mastery.rank, colors.length - 1)] ?? colors[0];
    const texture = ONE_TILE_MASTERY_TEXTURES[Math.min(mastery.rank, ONE_TILE_MASTERY_TEXTURES.length - 1)] ?? "grass-normal";

    ancientRoot?.grass.setTexture(texture);
    ancientRoot?.base.setTint(color);
    this.rootAura.setStrokeStyle(2 + mastery.rank * 0.35, color, 0.18 + mastery.rank * 0.06);
    this.oneTileMasteryText
      .setColor(`#${color.toString(16).padStart(6, "0")}`)
      .setText(`TILE MASTERY ${mastery.rank}/${mastery.maxRank}\n${mastery.name}\n${mastery.shortEffect}`);

    if (!announce || !ancientRoot) {
      return;
    }

    this.playOneTileUpgrade(ancientRoot, mastery.name, color);
  }

  private playOneTileUpgrade(root: RootNodeView, name: string, color: number): void {
    root.touchImpactAt = this.time.now;
    root.touchImpactStrength = 0.9;
    const ring = this.add
      .circle(root.homeX, root.homeY, Math.max(28, root.visualSize * 0.3), color, 0.08)
      .setDepth(8)
      .setStrokeStyle(3, color, 0.92);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 2.1,
      duration: 680,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    this.cameras.main.flash(120, 212, 255, 154, false);
    this.sfx.play("upgrade");
    this.floatText(root.homeX, root.homeY - root.visualSize * 0.6, name, `#${color.toString(16).padStart(6, "0")}`);
    const barks = [
      "",
      "Soft Loam.\nThe tile has standards now.",
      "Dew Veins.\nIt catches its breath faster.",
      "Root Heart.\nThat little thing is getting stubborn.",
      "Ancient Crown.\nAll right. Now it may spread.",
    ];
    this.saySensi(barks[this.oneTileMasteryRank] ?? `${name}.\nThe old root remembers.`, "approval", 3400);
  }

  private syncFieldExpansion(announce: boolean): void {
    const nextExpansion = getFirstRunFieldExpansion(this.objectiveState);
    if (nextExpansion.rootCount === this.activeRootCount && nextExpansion.gridSize === this.activeGridSize) {
      return;
    }

    const previousRootCount = this.activeRootCount;
    this.activeRootCount = nextExpansion.rootCount;
    this.activeGridSize = nextExpansion.gridSize;
    if (previousRootCount < 9 && this.activeRootCount >= 9) {
      this.woundElapsed = 0;
      this.woundPressureWarned = false;
    }

    this.layout();
    if (announce) {
      this.addFeedEntry("Field expanded", `${this.activeRootCount} roots awake`, "GR", "#b7eba5");
      this.saySensi("The field opened.\nTry not to look responsible.", "approval", 3600);
      this.playFieldExpansion(previousRootCount);
    }
  }

  private playFieldExpansion(previousRootCount: number): void {
    const newlyAwakeRoots = this.rootNodes.slice(previousRootCount, this.activeRootCount);
    if (newlyAwakeRoots.length === 0) {
      return;
    }

    const fieldPanelScaleX = this.fieldPanel.scaleX;
    const fieldPanelScaleY = this.fieldPanel.scaleY;
    this.tweens.killTweensOf(this.fieldPanel);
    this.tweens.add({
      targets: this.fieldPanel,
      duration: 360,
      ease: "Sine.easeOut",
      scaleX: fieldPanelScaleX * 1.025,
      scaleY: fieldPanelScaleY * 1.025,
      yoyo: true,
      onComplete: () => this.fieldPanel.setScale(fieldPanelScaleX, fieldPanelScaleY),
    });

    const fieldRing = this.add
      .circle(this.fieldCenterX, this.fieldCenterY, Math.max(44, this.rootAura.radius * 0.6), 0xeaff9b, 0.12)
      .setDepth(8)
      .setStrokeStyle(2, 0xf7ffd6, 0.78);
    this.tweens.add({
      targets: fieldRing,
      alpha: 0,
      duration: 720,
      ease: "Sine.easeOut",
      radius: Math.max(110, this.rootAura.radius * 1.45),
      onComplete: () => fieldRing.destroy(),
    });
    this.floatText(this.fieldCenterX, this.fieldCenterY - Math.max(64, this.rootAura.radius * 0.62), "roots awake", "#eaff9b");

    newlyAwakeRoots.forEach((node, index) => {
      const delay = index * 70;
      const baseScaleX = node.base.scaleX;
      const baseScaleY = node.base.scaleY;
      const grassScaleX = node.grass.scaleX;
      const grassScaleY = node.grass.scaleY;
      const sparkScaleX = node.spark.scaleX;
      const sparkScaleY = node.spark.scaleY;

      node.base.setScale(baseScaleX * 0.76, baseScaleY * 0.76);
      node.grass.setScale(grassScaleX * 0.58, grassScaleY * 0.58).setAngle(Phaser.Math.Between(-5, 5));
      node.spark.setScale(sparkScaleX * 0.5, sparkScaleY * 0.5);
      node.pulse.setScale(0.35);
      this.tweens.add({
        targets: node.base,
        delay,
        duration: 240,
        ease: "Back.easeOut",
        scaleX: baseScaleX,
        scaleY: baseScaleY,
      });
      this.tweens.add({
        targets: node.grass,
        duration: 320,
        delay: delay + 35,
        ease: "Back.easeOut",
        angle: 0,
        scaleX: grassScaleX,
        scaleY: grassScaleY,
      });
      this.tweens.add({
        targets: node.spark,
        duration: 260,
        delay: delay + 85,
        ease: "Back.easeOut",
        scaleX: sparkScaleX,
        scaleY: sparkScaleY,
      });
      this.tweens.add({
        targets: node.pulse,
        alpha: 0.78,
        delay: delay + 30,
        duration: 260,
        ease: "Sine.easeOut",
        scaleX: 1.95,
        scaleY: 1.95,
        yoyo: true,
        onComplete: () => node.pulse.setScale(1),
      });
      this.time.delayedCall(delay + 80, () => {
        this.playExpansionRing(node);
        this.emitExpansionFlecks(node.homeX, node.homeY, node.visualSize);
      });
    });
    this.cameras.main.flash(220, 196, 255, 156, false);
    this.cameras.main.shake(150, 0.0012);
  }

  private playExpansionRing(node: RootNodeView): void {
    const ring = this.add
      .circle(node.homeX, node.homeY, Math.max(10, node.visualSize * 0.16), 0xeaff9b, 0.2)
      .setDepth(9)
      .setStrokeStyle(2, 0xf7ffd6, 0.9);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: 620,
      ease: "Sine.easeOut",
      radius: node.visualSize * 0.56,
      onComplete: () => ring.destroy(),
    });
  }

  private handleTouch(pointer: Phaser.Input.Pointer): void {
    if (this.optionsOpen || this.isPointerOverOptionsButton(pointer)) {
      return;
    }

    if (
      this.isPointerOverDewPulseButton(pointer) ||
      this.isPointerOverRootSalveButton(pointer) ||
      this.isPointerOverTinySprinklerButton(pointer) ||
      this.isPointerOverRunToolPageButton(pointer)
    ) {
      return;
    }

    if (this.state.phase === "dormant") {
      if (this.isPointerOverMemoryUpgradeButton(pointer)) {
        return;
      }
      if (this.isPointerOverNextRunButton(pointer)) {
        return;
      }
      if (this.summaryPanel.visible) {
        this.floatText(pointer.x, pointer.y, "use Begin Next Run", "#ffefb0");
      }
      return;
    }

    const nearest = this.getRootNodeAtPointer(pointer.x, pointer.y);
    if (!nearest) {
      this.handleMissedRootTouch(pointer);
      return;
    }

    this.touchRootNode(nearest, pointer.x, pointer.y);
  }

  private handleRootDomClick(rootId: number): void {
    const node = this.getActiveRootNodes().find((candidate) => candidate.rootId === rootId);
    if (!node) {
      return;
    }

    this.touchRootNode(node, node.homeX, node.homeY);
  }

  private touchRootNode(nearest: RootNodeView, touchX: number, touchY: number): void {
    if (this.state.phase !== "active") {
      return;
    }

    this.startPrototypeAudio();
    const firstTouch = this.introActive;
    if (this.introActive) {
      this.beginIntroRun();
    }

    const distance = Phaser.Math.Distance.Between(touchX, touchY, this.fieldCenterX, this.fieldCenterY);
    const proximity = Phaser.Math.Clamp(1 - distance / this.fieldTouchRadius, 0.35, 1);
    const wounded = isRootWounded(this.state, nearest.rootId);
    if (!wounded && this.isRootRecovering(nearest)) {
      this.playRootRecoveryReject(nearest);
      this.floatText(touchX, touchY, "recovering", "#bff4ff");
      this.publishBrowserDebugState();
      return;
    }

    const tileMastery = getFirstRunOneTileMastery(this.objectiveState);
    const upgradeEffects = getPermanentUpgradeEffects(this.state);
    const healing =
      (wounded ? WOUNDED_TOUCH_HEALING : TOUCH_HEALING) *
      proximity *
      upgradeEffects.manualHealingMultiplier *
      tileMastery.manualHealingMultiplier;
    const result = touchAncientGrassRoot(this.state, healing, nearest.rootId);
    this.playRootTouchSfx(nearest, firstTouch, result.healedWound, result.effectiveHealing > 0, proximity);
    const text = result.healedWound ? `wound healed +${result.runTouchesGained}` : result.effectiveHealing > 0 ? `+${result.runTouchesGained} RT` : "overheal";
    nearest.lastTouchAt = this.time.now;
    const baseRecoveryDuration = result.healedWound
      ? WOUNDED_ROOT_RECOVERY_MS
      : result.effectiveHealing > 0
        ? ROOT_RECOVERY_MS
        : OVERHEAL_RECOVERY_MS;
    nearest.recoveringUntil =
      this.time.now +
      Math.round(
        baseRecoveryDuration *
          tileMastery.recoveryDurationMultiplier *
          upgradeEffects.manualRecoveryDurationMultiplier,
      );
    if (result.healedWound) {
      this.addFeedEntry("Wound healed", `root ${nearest.rootId + 1} stabilized`, "WD", "#ffefb0");
      this.saySensi("Clean work.\nPressure drops when the root believes you.", "approval", 3600);
      this.playWoundSeal(nearest);
    } else if (result.effectiveHealing <= 0) {
      this.saySensi("That was kindness.\nThe ledger wanted healing.", "idle", 2600);
    }
    this.playRootTouch(nearest, proximity, result.effectiveHealing > 0);
    if (result.effectiveHealing > 0) {
      this.playRootRecoveryStart(nearest);
    }
    this.emitTouchBurst(touchX, touchY, result.effectiveHealing > 0);
    this.playHealingFeedback(nearest, result.effectiveHealing, result.healedWound ? "wound" : "root");
    this.floatText(touchX, touchY, text, result.effectiveHealing > 0 ? "#e5ff9a" : "#9ac8ff");
    this.syncFirstRunObjectives();
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private handleMissedRootTouch(pointer: Phaser.Input.Pointer): void {
    if (this.time.now - this.lastMissBarkAt < 1600) {
      return;
    }

    this.lastMissBarkAt = this.time.now;
    this.cameras.main.shake(60, 0.0006);
    this.floatText(pointer.x, pointer.y, "touch the tile", "#ffefb0");
    if (this.introActive) {
      this.saySensi("The Ancient Grass is the tile.\nThe meadow is mostly innocent.", "idle", 2600);
    }
  }

  private beginIntroRun(): void {
    this.introActive = false;
    this.setIntroCardVisible(false);
    this.scourgeDamageAccum = 0;
    this.scourgePulseElapsed = 0;
    this.woundElapsed = 0;
    this.woundPressureWarned = false;
    this.resetScourgeFeedbackState();
    this.resetRunToolFeedbackState();
    this.addFeedEntry("Run begun", "Ancient Grass awake", "AG", "#b7eba5");
    this.saySensi("Good.\nNow the field has a pulse.\nThe bad news starts shortly.", "approval", 5200);
    this.cameras.main.flash(180, 205, 255, 160, false);
    this.publishBrowserDebugState();
  }

  private syncFirstRunObjectives(announce = true): void {
    const previousMasteryRank = getFirstRunOneTileMastery(this.objectiveState).rank;
    const update = updateFirstRunObjectives(this.objectiveState, this.state);
    if (announce) {
      update.newlyCompleted.forEach((objective) => {
        this.addFeedEntry("Objective", objective.definition.completedFeed, "Q", "#eaff9b");
        this.floatText(this.scale.width / 2, Math.max(104, this.scale.height * 0.14), "objective complete", "#eaff9b");
      });
    }
    const nextMasteryRank = getFirstRunOneTileMastery(this.objectiveState).rank;
    this.applyOneTileMasteryPresentation(announce && nextMasteryRank > previousMasteryRank);
    this.syncFieldExpansion(announce);
    this.setObjectiveText(update.activeObjective);
    this.publishBrowserDebugState();
  }

  private setObjectiveText(objective?: FirstRunObjectiveProgress): void {
    if (this.introActive) {
      this.objectiveText.setText("Goal: touch the inherited Ancient Grass.");
      this.updateIntroCard();
      return;
    }

    this.setIntroCardVisible(false);

    if (!objective) {
      this.objectiveText.setText("Goal: keep the Ancient Grass alive.");
      return;
    }

    this.objectiveText.setText(`Goal: ${objective.definition.title} ${objective.current}/${objective.target}`);
  }

  private refreshReadout(): void {
    const hpRatio = getAncientGrassHpRatio(this.state);
    this.hpBarFill.width = this.hpBarBack.width * hpRatio;
    this.hpBarFill.fillColor = hpRatio < 0.3 ? 0xf07070 : hpRatio < 0.62 ? 0xf0c864 : 0x8bdc69;
    this.hpText.setText(`Ancient HP ${formatAncientGrassHp(this.state)}`);
    const compact = this.scale.width < 720;
    this.runTouchText.setText(
      compact
        ? `RT ${this.state.economy.runTouches}   Earned ${this.state.economy.totalRunTouchesEarned}   GT ${this.state.economy.permanentGrassTouches}`
        : `RT ${this.state.economy.runTouches}   Earned ${this.state.economy.totalRunTouchesEarned}   GT ${this.state.economy.permanentGrassTouches}`,
    );
    const compactPanelCopy = this.scale.width < 1040;
    this.updatePlayerPanel(compactPanelCopy);
    this.scourgeBarFill.width = Math.min(360, 120 + this.state.scourge.pressure * 36);
    const senseTargetText = this.scourgeSenseTargetRootId === null ? "" : `   root ${this.scourgeSenseTargetRootId + 1} next`;
    this.scourgeText.setText(
      this.introActive
        ? compact
          ? "Scourge dormant   touch to begin"
          : "Scourge dormant   touch the Ancient Grass to begin"
        : compact
          ? `Scourge x${this.state.scourge.pressure.toFixed(2)}   ${this.state.phase}${senseTargetText}`
          : `Scourge pressure x${this.state.scourge.pressure.toFixed(2)}   phase ${this.state.phase}${senseTargetText}`,
    );
    const woundedCount = getWoundedRootCount(this.state);
    const activeObjectiveId = getActiveFirstRunObjective(this.objectiveState, this.state)?.definition.id;
    const tileMastery = getFirstRunOneTileMastery(this.objectiveState);
    const dewPulseUsable = this.isDewPulseUsable();
    this.refreshDewPulseButton();
    this.refreshRootSalveButton(woundedCount);
    this.refreshTinySprinklerButton();
    this.refreshRunToolBarVisibility();
    this.updateSensiMessage(this.getSensiMessage(woundedCount, compactPanelCopy));
    this.refreshFeedRows();
    const lastStandPrompt = this.hasLastStand()
      ? this.state.revivals.lastStandUsed
        ? compact
          ? "Last Stand spent. Next zero HP ends the run."
          : "Last Stand already fired. The next collapse becomes real dormancy."
        : hpRatio < 0.28
          ? compact
            ? "Last Stand armed. Survive the rebound."
            : "Last Stand is armed. If HP hits zero once, the field will rebound."
          : ""
      : "";
    this.promptText.setText(
      this.introActive
        ? compact
          ? "Inherited field. Touch the Ancient Grass."
          : "Your uncle left one suspicious tile. Touch it to wake the Ancient Grass."
        : this.state.phase === "active"
        ? lastStandPrompt
          ? lastStandPrompt
          : this.scourgeSenseTargetRootId !== null
          ? compact
            ? `Scourge Sense: root ${this.scourgeSenseTargetRootId + 1} next.`
            : `Scourge Sense marks root ${this.scourgeSenseTargetRootId + 1}. It will likely wound next.`
          : woundedCount > 0
          ? activeObjectiveId === "completeDormancy"
            ? compact
              ? dewPulseUsable
                ? `Pressure remains. Dew Pulse can buy time.`
                : `Pressure remains: ${woundedCount} wounds.`
              : dewPulseUsable
                ? `Pressure remains. Heal pink roots when useful; Dew Pulse can buy time.`
                : `Pressure remains. Heal pink roots when useful; reaching dormancy keeps the memory.`
            : compact
              ? `Heal wounded roots: ${woundedCount} open.`
              : `Sensi points at the sick roots. Heal wounds first: ${woundedCount} open.`
          : this.activeRootCount === 1
            ? compact
              ? `${tileMastery.name} ${tileMastery.rank}/${tileMastery.maxRank}. Keep tending it.`
              : `Tend the one Ancient tile. Each care milestone upgrades it before the field is allowed to spread.`
          : dewPulseUsable
            ? compact
              ? "Dew Pulse ready. Spend RT to buy time."
              : "Dew Pulse is ready. Spend RT to buy time before the Scourge presses harder."
            : compact
              ? "The roots shimmer. The Scourge presses in."
              : "Sensi watches the roots shimmer. The Scourge presses in. Real healing becomes memory."
        : compact
          ? "Dormancy settles. The memory remains."
          : "Dormancy settles over the field. The memory remains.",
    );
    this.scourgeVeil.setAlpha(Math.min(0.34, 0.05 + (1 - hpRatio) * 0.16 + (this.state.scourge.pressure - 1) * 0.08));
    this.shade.setAlpha(this.state.phase === "active" ? 0.3 + (1 - hpRatio) * 0.16 : 0.58);
    this.fieldPanel.setAlpha(this.state.phase === "active" ? 0.88 + hpRatio * 0.08 : 0.62);
    const showTouchHint = this.shouldShowTouchHint();
    this.touchHintRing.setVisible(showTouchHint);
    this.touchHintText.setVisible(showTouchHint);
    this.oneTileMasteryText.setVisible(this.state.phase === "active" && this.activeRootCount === 1);

    this.rootNodes.forEach((node, index) => {
      if (index >= this.activeRootCount) {
        node.base.setVisible(false);
        node.grass.setVisible(false);
        node.spark.setVisible(false);
        node.pulse.setVisible(false);
        node.recoveryHalo.setVisible(false);
        node.senseHalo.setVisible(false);
        node.woundHalo.setVisible(false);
        node.woundShard.setVisible(false);
        return;
      }

      const wave = Math.sin(this.time.now / 420 + index * 0.72) * 0.18 + 0.82;
      const wounded = isRootWounded(this.state, node.rootId);
      const woundVisible = this.state.phase === "active" && wounded;
      const recoveryRatio = this.getRootRecoveryRatio(node);
      const recoveryVisible = this.state.phase === "active" && !wounded && recoveryRatio < 1;
      const senseVisible = this.isScourgeSenseMarkerVisible(node);
      node.pulse.setAlpha(this.state.phase === "active" ? (wounded ? 0.5 + wave * 0.28 : wave * hpRatio * (0.22 + recoveryRatio * 0.16)) : 0.18);
      node.pulse.setStrokeStyle(wounded ? 3 : 2, wounded ? 0xff6b9a : 0xe1ffb0, wounded ? 0.9 : 0.28);
      node.pulse.setFillStyle(wounded ? 0x7c1939 : 0xc9ff8f, wounded ? 0.18 : 0.04);
      node.base.setAlpha(this.state.phase === "active" ? 0.7 + recoveryRatio * 0.12 : 0.42);
      node.grass.setAlpha(this.state.phase === "active" ? (wounded ? 0.95 : (0.46 + hpRatio * 0.42) * (0.72 + recoveryRatio * 0.28)) : 0.22);
      node.grass.setTint(wounded ? 0xff8aaa : recoveryRatio < 1 ? 0xa7d5c8 : 0xffffff);
      node.spark.setAlpha(this.state.phase === "active" ? wave * (0.28 + recoveryRatio * 0.54) : 0.1);
      node.spark.setTint(wounded ? 0xff3f7a : 0xffffff);
      node.recoveryHalo.setVisible(recoveryVisible);
      node.recoveryHalo.setAlpha(recoveryVisible ? 0.18 + (1 - recoveryRatio) * 0.24 : 0);
      node.recoveryHalo.setFillStyle(0x8fdfff, recoveryVisible ? 0.04 + (1 - recoveryRatio) * 0.05 : 0);
      node.recoveryHalo.setStrokeStyle(2, 0xbff4ff, recoveryVisible ? 0.28 + (1 - recoveryRatio) * 0.42 : 0);
      node.senseHalo.setVisible(senseVisible);
      node.senseHalo.setAlpha(senseVisible ? 0.18 + wave * 0.28 : 0);
      node.senseHalo.setFillStyle(0xffe38a, senseVisible ? 0.05 : 0);
      node.senseHalo.setStrokeStyle(3, 0xffefb0, senseVisible ? 0.62 + wave * 0.18 : 0);
      node.woundHalo.setVisible(woundVisible);
      node.woundShard.setVisible(woundVisible);
      node.woundHalo.setAlpha(woundVisible ? 0.32 + wave * 0.38 : 0);
      node.woundShard.setAlpha(woundVisible ? 0.76 + wave * 0.18 : 0);
    });
  }

  private updateIntroCard(): void {
    const compact = this.scale.width < 720;
    this.introTitle.setText("Sensi, field advisor");
    this.introBody.setText(
      compact
        ? "Your uncle left one Ancient Grass tile.\nIt is already losing HP. Touch the tile."
        : "Your uncle left one Ancient Grass tile. Something invisible is draining it.\nTouch the tile to wake the field.",
    );
    this.setIntroCardVisible(this.state.phase === "active");
  }

  private setIntroCardVisible(visible: boolean): void {
    const sidePanelVisible = this.scale.width >= 1040 && this.scale.height >= 650;
    const compactPanelsVisible = !sidePanelVisible && this.scale.width >= COMPACT_PANEL_MIN_WIDTH && this.scale.height >= COMPACT_PANEL_MIN_HEIGHT;
    const nextVisible = visible && this.introActive && !compactPanelsVisible;
    this.introPanel.setVisible(nextVisible);
    this.introTitle.setVisible(nextVisible);
    this.introBody.setVisible(nextVisible);
  }

  private shouldShowTouchHint(): boolean {
    if (this.state.phase !== "active") {
      return false;
    }

    const activeObjectiveId = getActiveFirstRunObjective(this.objectiveState, this.state)?.definition.id;
    return activeObjectiveId === "wakeAncientGrass";
  }

  private updatePlayerPanel(compact: boolean): void {
    const ownedMemoryCount = MEMORY_UPGRADE_IDS.filter((upgradeId) => hasPermanentUpgrade(this.state, upgradeId)).length;
    const ownedMemory = ownedMemoryCount > 0 ? `${ownedMemoryCount} remembered` : "none";
    const phaseText = this.state.phase === "dormant" ? "Dormant heir" : this.introActive ? "Field heir" : "Manual caretaker";
    this.sensiTitle.setText("Grass Toucher");
    this.sensiTitle.setColor("#ffefb0");
    this.sensiBody.setText(
      compact
        ? `${phaseText}\nGT ${this.state.economy.permanentGrassTouches}\nMemory: ${ownedMemory}`
        : `Player / ${phaseText}\nPermanent GT ${this.state.economy.permanentGrassTouches}\nMemory: ${ownedMemory}`,
    );
  }

  private animateScene(now: number): void {
    const seconds = now / 1000;
    const hpRatio = getAncientGrassHpRatio(this.state);
    const pressure = this.state.scourge.pressure;
    this.background.setPosition(this.scale.width / 2 + Math.sin(seconds * 0.12) * 4, this.scale.height / 2 + Math.cos(seconds * 0.1) * 3);
    const masteryGlow = this.activeRootCount === 1 ? this.oneTileMasteryRank * 0.014 : 0;
    this.rootAura.setAlpha(this.state.phase === "active" ? 0.04 + hpRatio * 0.06 + masteryGlow + Math.sin(seconds * 1.8) * 0.018 : 0.02);
    this.rootAura.setScale(1 + Math.sin(seconds * 1.35) * 0.025);
    const showTouchHint = this.shouldShowTouchHint();
    this.touchHintRing.setAlpha(showTouchHint ? 0.14 + Math.sin(seconds * 2.1) * 0.06 : 0);
    this.touchHintRing.setScale(1 + Math.sin(seconds * 2.1) * 0.035);
    this.touchHintText.setAlpha(showTouchHint ? 0.72 + Math.sin(seconds * 2.1) * 0.16 : 0);
    if (this.oneTileMasteryText.visible) {
      this.oneTileMasteryText.setAlpha(0.82 + Math.sin(seconds * 1.6) * 0.08);
    }

    this.rootNodes.forEach((node, index) => {
      if (index >= this.activeRootCount) {
        return;
      }

      const breath = this.state.phase === "active" ? 1 + Math.sin(seconds * 2.2 + node.phase) * 0.022 * hpRatio : 0.96;
      const sway = Math.sin(seconds * 1.35 + node.phase) * 1.4 * hpRatio;
      const wounded = isRootWounded(this.state, node.rootId);
      const recoveryRatio = this.getRootRecoveryRatio(node);
      const recoveryScale = wounded ? 1 : 0.88 + recoveryRatio * 0.12;
      const pressureJitter = Math.sin(seconds * (wounded ? 16 : 9.5) + node.phase * 3) * Math.max(0, pressure - 1) * (wounded ? 0.62 : 0.22);
      const touchProgress = Phaser.Math.Clamp((now - node.touchImpactAt) / ROOT_TOUCH_IMPACT_MS, 0, 1);
      const touchWave =
        touchProgress < 1
          ? Math.sin((touchProgress + 0.14) * Math.PI * 3) * (1 - touchProgress) * (1 - touchProgress) * node.touchImpactStrength
          : 0;
      const touchPress = Math.abs(touchWave);
      const masteryScale = index === 0 ? 1 + this.oneTileMasteryRank * 0.012 : 1;
      node.grass
        .setPosition(
          node.homeX + sway + pressureJitter,
          node.homeY + Math.cos(seconds * 1.7 + node.phase) * 0.9 * hpRatio + touchPress * node.visualSize * 0.035,
        )
        .setAngle(Math.sin(seconds * 1.1 + node.phase) * 0.9 * hpRatio + node.touchImpactDirection * touchWave * 3.8)
        .setDisplaySize(
          node.visualSize * 0.92 * breath * recoveryScale * masteryScale * (1 + touchWave * 0.13),
          node.visualSize * 0.92 * breath * recoveryScale * masteryScale * (1 - touchWave * 0.18),
        );
      node.spark
        .setPosition(
          node.homeX + node.visualSize * 0.2 + Math.sin(seconds * 1.8 + node.phase) * 3,
          node.homeY - node.visualSize * 0.2 + Math.cos(seconds * 1.5 + node.phase) * 3 - touchPress * node.visualSize * 0.05,
        )
        .setAngle(now * 0.025 + node.phase * 20);
      node.pulse
        .setPosition(node.homeX + sway * 0.4, node.homeY)
        .setScale(
          (wounded ? 1.25 : 1) +
            Math.sin(seconds * (wounded ? 4.6 : 2.4) + node.phase) * (wounded ? 0.22 : 0.12) +
            touchPress * 0.62,
        );
      if (!wounded && recoveryRatio < 1) {
        const recoveryBeat = 0.9 + recoveryRatio * 0.2 + Math.sin(seconds * 4.2 + node.phase) * 0.04;
        node.recoveryHalo.setPosition(node.homeX + sway * 0.25, node.homeY).setScale(recoveryBeat);
      } else {
        node.recoveryHalo.setScale(1);
      }
      if (this.isScourgeSenseMarkerVisible(node)) {
        const senseBeat = 1 + Math.sin(seconds * 4.8 + node.phase) * 0.12;
        node.senseHalo.setPosition(node.homeX + pressureJitter * 0.2, node.homeY).setScale(senseBeat);
      } else {
        node.senseHalo.setScale(1);
      }
      if (wounded) {
        const woundBeat = 1 + Math.sin(seconds * 5.2 + node.phase) * 0.16;
        node.woundHalo.setPosition(node.homeX + pressureJitter * 0.35, node.homeY).setScale(woundBeat);
        node.woundShard
          .setPosition(node.homeX + pressureJitter * 0.5, node.homeY - node.visualSize * 0.23 + Math.sin(seconds * 5.8 + node.phase) * 2)
          .setAngle(-12 + Math.sin(seconds * 4.2 + node.phase) * 6);
      } else {
        node.woundHalo.setScale(1);
        node.woundShard.setAngle(-12);
      }
    });
    this.animateRunToolBar(seconds);
    this.animateMemoryGrove(seconds);
    this.animateSensi(seconds);
  }

  private animateRunToolBar(seconds: number): void {
    if (!this.runToolBar.visible) {
      return;
    }

    this.runToolBar.setAlpha(0.92 + Math.sin(seconds * 1.8) * 0.025);
    for (const toolId of RUN_TOOL_IDS) {
      const slot = this.runToolSlots[toolId];
      if (!slot.button.visible) {
        continue;
      }
      const hovered = this.hoveredRunToolId === toolId;
      slot.icon
        .setPosition(slot.button.x, slot.button.y - 6 + (hovered ? Math.sin(seconds * 5.2) * 2 : 0))
        .setAngle(hovered ? Math.sin(seconds * 4.4) * 3 : 0);
      if (slot.countBadge.visible) {
        slot.countBadge.setScale(1 + Math.sin(seconds * 3.8) * 0.06);
      }
    }
  }

  private animateMemoryGrove(seconds: number): void {
    if (!this.summaryPanel.visible) {
      return;
    }

    for (const button of this.memoryUpgradeButtons) {
      if (!button.frame.visible) {
        continue;
      }

      const selected = button.upgradeId === this.selectedMemoryUpgradeId;
      const hovered = button.upgradeId === this.hoveredMemoryUpgradeId;
      const baseSize = Math.max(1, button.nodeSize);
      const framePulse = hovered
        ? 1.06 + Math.sin(seconds * 6.2) * 0.055
        : selected
          ? 1.025 + Math.sin(seconds * 4.2) * 0.025
          : 1;
      const iconPulse = hovered
        ? 1.13 + Math.sin(seconds * 7.1) * 0.09
        : selected
          ? 1.05 + Math.sin(seconds * 5.1) * 0.045
          : 1;
      const iconBob = hovered
        ? Math.sin(seconds * 5.6) * baseSize * 0.05
        : selected
          ? Math.sin(seconds * 4.1) * baseSize * 0.018
          : 0;
      const iconSize = baseSize * (selected || hovered ? 0.33 : 0.28) * iconPulse;
      button.frame.setDisplaySize(baseSize * framePulse, baseSize * framePulse);
      button.icon
        .setPosition(button.frame.x, button.frame.y + iconBob)
        .setDisplaySize(iconSize, iconSize)
        .setAngle(hovered ? Math.sin(seconds * 4.4) * 3.4 : selected ? Math.sin(seconds * 3.4) * 1.2 : 0);
      button.glow.setScale(hovered ? 1.1 + Math.sin(seconds * 5.4) * 0.07 : selected ? 1.03 : 1);
      button.hoverRing
        .setVisible(hovered)
        .setAlpha(hovered ? 0.52 + Math.sin(seconds * 5.8) * 0.24 : 0)
        .setScale(hovered ? 0.94 + Math.sin(seconds * 4.8) * 0.1 : 1);
    }

    if (this.memoryDetailIcon.visible) {
      const hoverActive = this.hoveredMemoryUpgradeId !== null;
      const detailPulse = hoverActive ? 1.08 + Math.sin(seconds * 5.2) * 0.06 : 1.02 + Math.sin(seconds * 3.8) * 0.02;
      const detailIconPulse = hoverActive ? 1.12 + Math.sin(seconds * 6.8) * 0.08 : 1.04 + Math.sin(seconds * 4.4) * 0.035;
      this.memoryDetailIconGlow.setScale(hoverActive ? 1.06 + Math.sin(seconds * 4.2) * 0.09 : 1.01);
      this.memoryDetailIconFrame.setDisplaySize(
        this.memoryDetailIconBaseSize * detailPulse,
        this.memoryDetailIconBaseSize * detailPulse,
      );
      this.memoryDetailIcon
        .setDisplaySize(this.memoryDetailIconBaseSize * 0.54 * detailIconPulse, this.memoryDetailIconBaseSize * 0.54 * detailIconPulse)
        .setAngle(hoverActive ? Math.sin(seconds * 3.8) * 2.8 : 0);
    }

    const nextRunPulse = (Math.sin(seconds * 2.8) + 1) / 2;
    this.nextRunGlow
      .setAlpha(0.08 + nextRunPulse * 0.12)
      .setScale(1 + nextRunPulse * 0.035);
    this.nextRunButton.setStrokeStyle(2, 0xeaff9b, 0.72 + nextRunPulse * 0.24);
    this.nextRunText.setScale(1 + nextRunPulse * 0.018);
  }

  private animateSensi(seconds: number): void {
    if (!this.sensiPortrait.visible) {
      return;
    }

    const portraitPulse = 0.62 + Math.sin(seconds * 1.4) * 0.08;
    const bob = Math.sin(seconds * 1.35) * 1.05;
    this.sensiPortrait.setPosition(this.sensiPortraitBaseX, this.sensiPortraitBaseY + bob * 0.35);
    this.sensiPortrait.setAngle(Math.sin(seconds * 0.72) * 0.18);
    this.sensiPortraitFrame.setStrokeStyle(2, 0xd7a64e, Phaser.Math.Clamp(portraitPulse, 0.34, 0.82));
    this.sensiGlint.setAlpha(0);
  }

  private getRootNodeAtPointer(x: number, y: number): RootNodeView | undefined {
    return this.getActiveRootNodes().find((node) => {
      const halfSize = node.visualSize / 2;
      return Math.abs(x - node.homeX) <= halfSize && Math.abs(y - node.homeY) <= halfSize;
    });
  }

  private isRootRecovering(node: RootNodeView): boolean {
    return this.state.phase === "active" && this.time.now < node.recoveringUntil;
  }

  private getRootRecoveryRatio(node: RootNodeView): number {
    if (!this.isRootRecovering(node)) {
      return 1;
    }

    const duration = Math.max(1, node.recoveringUntil - node.lastTouchAt);
    return Phaser.Math.Clamp((this.time.now - node.lastTouchAt) / duration, 0, 1);
  }

  private isWoundPressureActive(): boolean {
    return this.activeRootCount >= 9 && getWoundedRootCount(this.state) < Math.min(MAX_OPEN_WOUNDS, this.activeRootCount);
  }

  private getWoundPressureRatio(): number {
    return Phaser.Math.Clamp(this.woundElapsed / this.woundIntervalMs, 0, 1);
  }

  private getWoundWarningRatio(): number {
    return this.hasScourgeSense() ? SCOURGE_SENSE_WARNING_RATIO : DEFAULT_WOUND_WARNING_RATIO;
  }

  private hasScourgeSense(): boolean {
    return getPermanentUpgradeEffects(this.state).scourgeSense;
  }

  private hasLastStand(): boolean {
    return getPermanentUpgradeEffects(this.state).lastStand;
  }

  private isLastStandAvailable(): boolean {
    return this.state.phase === "active" && this.hasLastStand() && !this.state.revivals.lastStandUsed;
  }

  private updateScourgeSenseWarning(woundPressureActive: boolean): void {
    if (!woundPressureActive || !this.hasScourgeSense() || this.getWoundPressureRatio() < SCOURGE_SENSE_WARNING_RATIO) {
      if (!woundPressureActive || !this.hasScourgeSense()) {
        this.clearScourgeSenseTarget();
      }
      return;
    }

    const existingTarget = this.scourgeSenseTargetRootId;
    if (existingTarget !== null && this.isValidScourgeSenseTarget(existingTarget)) {
      return;
    }

    const targetRootId = this.pickScourgeSenseTargetRootId();
    if (targetRootId === null) {
      this.clearScourgeSenseTarget();
      return;
    }

    this.scourgeSenseTargetRootId = targetRootId;
    this.lastScourgeSenseTargetRootId = targetRootId;
    this.lastScourgeSenseWarningAt = Math.round(this.time.now);
    this.addFeedEntry("Scourge Sense", `root ${targetRootId + 1} will split`, "SS", "#ffefb0");
    this.saySensi(`Scourge Sense.\nRoot ${targetRootId + 1} is about to go pink.`, "alert", 3000);
    const node = this.rootNodes[targetRootId];
    node.senseHalo.setVisible(true);
    this.floatText(node.homeX, node.homeY - node.visualSize * 0.42, "sense", "#ffefb0");
    this.tweens.add({
      targets: node.senseHalo,
      alpha: 0.64,
      duration: 140,
      ease: "Quad.easeOut",
      scaleX: 1.42,
      scaleY: 1.42,
      yoyo: true,
      onComplete: () => node.senseHalo.setScale(1),
    });
    this.publishBrowserDebugState();
  }

  private pickScourgeSenseTargetRootId(): number | null {
    const candidates = this.getActiveRootNodes()
      .map((node) => node.rootId)
      .filter((rootId) => this.isValidScourgeSenseTarget(rootId));
    if (candidates.length <= 0) {
      return null;
    }

    const index = (this.state.wounds.totalWoundsOpened + Math.floor(this.state.elapsedMs / 1000)) % candidates.length;
    return candidates[index];
  }

  private isValidScourgeSenseTarget(rootId: number): boolean {
    return rootId >= 0 && rootId < this.activeRootCount && !isRootWounded(this.state, rootId);
  }

  private clearScourgeSenseTarget(): void {
    this.scourgeSenseTargetRootId = null;
    this.rootNodes.forEach((node) => {
      node.senseHalo.setVisible(false).setScale(1);
    });
  }

  private isScourgeSenseMarkerVisible(node: RootNodeView): boolean {
    return (
      this.state.phase === "active" &&
      this.hasScourgeSense() &&
      this.scourgeSenseTargetRootId === node.rootId &&
      !isRootWounded(this.state, node.rootId)
    );
  }

  private resetRootRecoveryState(): void {
    this.rootNodes.forEach((node) => {
      node.recoveringUntil = -Infinity;
      node.lastTouchAt = -Infinity;
      node.touchImpactAt = -Infinity;
      node.touchImpactStrength = 0;
      node.recoveryHalo.setVisible(false).setScale(1);
    });
  }

  private resetScourgeFeedbackState(): void {
    this.lastScourgeEvent = "none";
    this.lastScourgePulseAt = 0;
    this.lastScourgePressureWaveAt = 0;
    this.lastWoundPressureWarningAt = 0;
    this.lastDormancyCollapseAt = 0;
    this.lastStandTriggeredAt = 0;
    this.lastScourgeSenseWarningAt = 0;
    this.lastScourgeSenseTargetRootId = null;
    this.clearScourgeSenseTarget();
  }

  private resetRunToolFeedbackState(): void {
    this.lastRunToolKind = "none";
    this.lastRunToolAt = 0;
    this.hoveredRunToolId = null;
    this.setRunToolTooltipVisible(false);
    this.dewPulseWasUsable = false;
    this.lastDewPulseReadyAt = 0;
    this.tinySprinklerElapsed = 0;
    this.lastTinySprinklerPulseAt = 0;
    this.lastTinySprinklerRootId = null;
  }

  private handleDewPulseClick(): void {
    this.startPrototypeAudio();
    const result = useDewPulse(this.state);
    if (!result.used) {
      this.sfx.play("blocked");
      const reasonText =
        result.reason === "not-enough-run-touches"
          ? `need ${DEW_PULSE_RUN_TOUCH_COST} RT`
          : result.reason === "no-missing-hp"
            ? "HP full"
            : "dormant";
      this.floatText(this.dewPulseButton.x, this.dewPulseButton.y - 20, reasonText, "#ffb1c7");
      this.saySensi(
        result.reason === "not-enough-run-touches"
          ? "Dew is not free.\nIt is just wet capitalism."
          : result.reason === "no-missing-hp"
            ? "The Ancient Grass is already topped up.\nRare. Enjoy the paperwork."
            : "Dormancy is quiet.\nNo pulse to push.",
        "idle",
        3000,
      );
      return;
    }

    this.lastRunToolKind = "dewPulse";
    this.lastRunToolAt = Math.round(this.time.now);
    this.sfx.play("regrow");
    this.addFeedEntry("Dew Pulse", `+${result.effectiveHealing.toFixed(0)} HP bought`, "DP", "#bff4ff");
    this.saySensi("Dew Pulse.\nBought time, not victory.", "approval", 3200);
    this.floatText(this.dewPulseButton.x, this.dewPulseButton.y - 20, `-${result.spent} RT`, "#bff4ff");
    this.playDewPulse(result.effectiveHealing);
    this.syncFirstRunObjectives();
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private playDewPulse(effectiveHealing: number): void {
    const origin = this.getActiveRootNodes().reduce<RootNodeView | undefined>((closest, node) => {
      if (!closest) {
        return node;
      }

      const nodeDistance = Phaser.Math.Distance.Between(node.homeX, node.homeY, this.fieldCenterX, this.fieldCenterY);
      const closestDistance = Phaser.Math.Distance.Between(closest.homeX, closest.homeY, this.fieldCenterX, this.fieldCenterY);
      return nodeDistance < closestDistance ? node : closest;
    }, undefined);
    this.cameras.main.shake(110, 0.0011);
    const ring = this.add
      .circle(this.fieldCenterX, this.fieldCenterY, Math.max(20, this.fieldTouchRadius * 0.18), 0x8fdfff, 0.12)
      .setDepth(12)
      .setStrokeStyle(3, 0xd9fbff, 0.72);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: 580,
      ease: "Sine.easeOut",
      radius: Math.max(90, this.fieldTouchRadius * 0.72),
      onComplete: () => ring.destroy(),
    });
    this.rootNodes.slice(0, this.activeRootCount).forEach((node, index) => {
      if (index % 2 === 0) {
        this.emitDewFleck(node.homeX, node.homeY - node.visualSize * 0.34, node.visualSize);
      }
    });
    if (origin) {
      this.playHealingFeedback(origin, effectiveHealing, "dewPulse");
    }
  }

  private emitDewFleck(x: number, y: number, visualSize: number): void {
    const fleck = this.add.image(x, y, "effect-pollen-fleck").setDepth(14).setTint(0xbff4ff).setAlpha(0.88).setScale(Phaser.Math.FloatBetween(1.2, 1.9));
    this.tweens.add({
      targets: fleck,
      alpha: 0,
      duration: Phaser.Math.Between(420, 640),
      ease: "Sine.easeOut",
      scaleX: 0.35,
      scaleY: 0.35,
      x: x + Phaser.Math.FloatBetween(-visualSize * 0.18, visualSize * 0.18),
      y: y + visualSize * Phaser.Math.FloatBetween(0.25, 0.48),
      onComplete: () => fleck.destroy(),
    });
  }

  private handleRootSalveClick(): void {
    this.startPrototypeAudio();
    const result = useRootSalve(this.state);
    if (!result.used) {
      this.sfx.play("blocked");
      const reasonText =
        result.reason === "not-enough-run-touches"
          ? `need ${ROOT_SALVE_RUN_TOUCH_COST} RT`
          : result.reason === "no-wounded-roots"
            ? "no wound"
            : "dormant";
      this.floatText(this.rootSalveButton.x, this.rootSalveButton.y - 20, reasonText, "#ffb1c7");
      this.saySensi(result.reason === "not-enough-run-touches" ? "No salve without Run Touches.\nTemporary power, temporary price." : "No wound to salve.\nA rare administrative victory.", "idle", 3000);
      return;
    }

    const healedNode = this.rootNodes.find((node) => node.rootId === result.healedRootId);
    this.lastRunToolKind = "rootSalve";
    this.lastRunToolAt = Math.round(this.time.now);
    this.sfx.play("regrow");
    this.addFeedEntry("Root Salve", `root ${(result.healedRootId ?? 0) + 1} sealed`, "RS", "#bff4ff");
    this.saySensi("Good.\nTemporary money, permanent lesson.", "approval", 3600);
    this.floatText(this.rootSalveButton.x, this.rootSalveButton.y - 20, `-${result.spent} RT`, "#bff4ff");
    if (healedNode) {
      healedNode.lastTouchAt = this.time.now;
      healedNode.recoveringUntil = this.time.now + WOUNDED_ROOT_RECOVERY_MS;
      this.playRootSalve(healedNode, result.effectiveHealing);
    }
    this.syncFirstRunObjectives();
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private refreshDewPulseButton(): void {
    const visible = this.shouldShowDewPulseButton();
    const usable = this.isDewPulseUsable();
    this.setRunToolSlotState("dewPulse", visible, usable);
    if (usable && !this.dewPulseWasUsable) {
      this.dewPulseWasUsable = true;
      this.lastDewPulseReadyAt = Math.round(this.time.now);
      this.playDewPulseReady();
    } else if (!usable) {
      this.dewPulseWasUsable = false;
    }
  }

  private isDewPulseUsable(): boolean {
    return (
      this.state.phase === "active" &&
      !this.introActive &&
      this.activeRootCount > 1 &&
      this.state.economy.runTouches >= DEW_PULSE_RUN_TOUCH_COST &&
      this.state.ancientGrass.currentHp < this.state.ancientGrass.maxHp
    );
  }

  private shouldShowDewPulseButton(): boolean {
    return (
      this.state.phase === "active" &&
      !this.introActive &&
      this.activeRootCount > 1 &&
      (this.state.economy.runTouches >= DEW_PULSE_RUN_TOUCH_COST ||
        this.state.economy.totalRunTouchesEarned >= DEW_PULSE_RUN_TOUCH_COST ||
        this.lastDewPulseReadyAt > 0)
    );
  }

  private playDewPulseReady(): void {
    this.addFeedEntry("Dew Pulse ready", "spend RT to buy time", "DP", "#bff4ff");
    this.saySensi("Dew Pulse ready.\nSpend Run Touches to buy time.", "approval", 3600);
    const icon = this.runToolSlots.dewPulse.icon;
    this.tweens.killTweensOf([this.dewPulseButton, icon]);
    this.tweens.add({
      targets: [this.dewPulseButton, icon],
      duration: 150,
      ease: "Quad.easeOut",
      scaleX: 1.06,
      scaleY: 1.06,
      yoyo: true,
      onComplete: () => {
        this.dewPulseButton.setScale(1);
        icon.setScale(1);
      },
    });
  }

  private playRootSalve(node: RootNodeView, effectiveHealing: number): void {
    this.floatText(node.homeX, node.homeY - node.visualSize * 0.35, `salve +${effectiveHealing.toFixed(0)}`, "#bff4ff");
    this.emitTouchBurst(node.homeX, node.homeY, true);
    this.playHealingFeedback(node, effectiveHealing, "salve");
    this.cameras.main.shake(120, 0.0012);
    this.tweens.add({
      targets: node.pulse,
      alpha: 0.82,
      duration: 180,
      ease: "Quad.easeOut",
      scaleX: 2.3,
      scaleY: 2.3,
      yoyo: true,
    });
    this.tweens.add({
      targets: node.grass,
      duration: 160,
      ease: "Back.easeOut",
      tint: 0xbff4ff,
      yoyo: true,
    });
  }

  private refreshRootSalveButton(woundedCount: number): void {
    const visible = this.shouldShowRootSalveButton(woundedCount);
    const affordable = this.state.economy.runTouches >= ROOT_SALVE_RUN_TOUCH_COST;
    const usable = visible && woundedCount > 0 && affordable;
    this.setRunToolSlotState("rootSalve", visible, usable);
  }

  private shouldShowRootSalveButton(woundedCount = getWoundedRootCount(this.state)): boolean {
    return this.state.phase === "active" && !this.introActive && woundedCount > 0;
  }

  private handleTinySprinklerClick(): void {
    this.startPrototypeAudio();
    const result = buyTinySprinkler(this.state);
    if (!result.bought) {
      this.sfx.play("blocked");
      const reasonText =
        result.reason === "license-missing"
          ? "need license"
          : result.reason === "not-enough-run-touches"
            ? `need ${TINY_SPRINKLER_RUN_TOUCH_COST} RT`
            : "dormant";
      this.floatText(this.tinySprinklerButton.x, this.tinySprinklerButton.y - 20, reasonText, "#ffb1c7");
      this.saySensi(
        result.reason === "license-missing"
          ? "No sprinkler license.\nThe field bureaucracy lives."
          : result.reason === "not-enough-run-touches"
            ? "Sprinklers cost Run Touches.\nTiny does not mean free."
            : "Dormancy has no plumbing.",
        "idle",
        3000,
      );
      this.publishBrowserDebugState();
      return;
    }

    this.lastRunToolKind = "tinySprinkler";
    this.lastRunToolAt = Math.round(this.time.now);
    this.sfx.play("upgrade");
    this.tinySprinklerElapsed = 0;
    this.addFeedEntry("Tiny Sprinkler", `x${result.tinySprinklers} installed`, "SP", "#bff4ff");
    this.saySensi(`Tiny Sprinkler x${result.tinySprinklers}.\nThe field has a little helper now.`, "approval", 3600);
    this.floatText(this.tinySprinklerButton.x, this.tinySprinklerButton.y - 20, `-${result.spent} RT`, "#bff4ff");
    this.pulseTinySprinklerButton();
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private refreshTinySprinklerButton(): void {
    const licensed = hasPermanentUpgrade(this.state, "tinySprinkler");
    const visible = this.shouldShowTinySprinklerButton(licensed);
    const affordable = this.state.economy.runTouches >= TINY_SPRINKLER_RUN_TOUCH_COST;
    const count = this.state.automation.tinySprinklers;
    const usable = visible && affordable;
    this.setRunToolSlotState("tinySprinkler", visible, usable, count);
  }

  private shouldShowTinySprinklerButton(licensed = hasPermanentUpgrade(this.state, "tinySprinkler")): boolean {
    return (
      this.state.phase === "active" &&
      !this.introActive &&
      this.activeRootCount > 1 &&
      licensed &&
      (this.state.economy.runTouches >= TINY_SPRINKLER_RUN_TOUCH_COST ||
        this.state.automation.tinySprinklers > 0 ||
        this.lastRunToolKind === "tinySprinkler")
    );
  }

  private pulseTinySprinklerButton(): void {
    const icon = this.runToolSlots.tinySprinkler.icon;
    this.tweens.killTweensOf([this.tinySprinklerButton, icon]);
    this.tweens.add({
      targets: [this.tinySprinklerButton, icon],
      duration: 150,
      ease: "Quad.easeOut",
      scaleX: 1.06,
      scaleY: 1.06,
      yoyo: true,
      onComplete: () => {
        this.tinySprinklerButton.setScale(1);
        icon.setScale(1);
      },
    });
  }

  private setRunToolSlotState(toolId: RunToolId, visible: boolean, usable: boolean, count = 0): void {
    const slot = this.runToolSlots[toolId];
    const view = RUN_TOOL_VIEW[toolId];
    slot.available = visible;
    slot.usable = usable;
    slot.count = count;
    slot.button
      .setFillStyle(usable ? 0x16452c : 0x17231b, usable ? 0.96 : 0.74)
      .setStrokeStyle(2, usable ? view.color : 0x6f6a52, usable ? 0.92 : 0.46);
    slot.icon
      .setAlpha(usable ? 1 : 0.46)
      .setTint(usable ? 0xffffff : 0x829083);
    slot.costBadge
      .setFillStyle(usable ? 0x06150d : 0x111914, usable ? 0.94 : 0.84)
      .setStrokeStyle(1, usable ? view.color : 0x6f6a52, usable ? 0.62 : 0.36);
    slot.costText.setColor(usable ? "#f7ffd6" : "#9e9a84");
    slot.countText.setText(count > 0 ? `${count}` : "");
    this.applyRunToolSlotVisibility(slot);
  }

  private applyRunToolSlotVisibility(slot: RunToolSlotView): void {
    const catalogIndex = this.equippedRunToolIds.indexOf(slot.toolId);
    const firstPageIndex = this.runToolBarLayout.page * this.runToolBarLayout.pageCapacity;
    const onCurrentPage =
      catalogIndex >= 0 &&
      catalogIndex >= firstPageIndex &&
      catalogIndex < firstPageIndex + this.runToolBarLayout.pageCapacity;
    const visible = slot.available && onCurrentPage;
    slot.button.setVisible(visible);
    slot.icon.setVisible(visible);
    slot.costBadge.setVisible(visible);
    slot.costText.setVisible(visible);
    const showCount = visible && slot.toolId === "tinySprinkler" && slot.count > 0;
    slot.countBadge.setVisible(showCount);
    slot.countText.setVisible(showCount);
  }

  private refreshRunToolBarVisibility(): void {
    for (const toolId of RUN_TOOL_IDS) {
      this.applyRunToolSlotVisibility(this.runToolSlots[toolId]);
    }
    const visible = RUN_TOOL_IDS.some((toolId) => this.runToolSlots[toolId].available);
    this.runToolBar.setVisible(visible);
    const navigationVisible = visible && this.runToolBarLayout.pageCount > 1;
    const canGoPrevious = this.runToolPage > 0;
    const canGoNext = this.runToolPage < this.runToolBarLayout.pageCount - 1;
    this.runToolPreviousPageButton
      .setVisible(navigationVisible)
      .setFillStyle(canGoPrevious ? 0x173822 : 0x17231b, canGoPrevious ? 0.96 : 0.72)
      .setStrokeStyle(1, canGoPrevious ? 0xd7a64e : 0x6f6a52, canGoPrevious ? 0.76 : 0.36);
    this.runToolPreviousPageText.setVisible(navigationVisible).setColor(canGoPrevious ? "#f7ffd6" : "#777f76");
    this.runToolNextPageButton
      .setVisible(navigationVisible)
      .setFillStyle(canGoNext ? 0x173822 : 0x17231b, canGoNext ? 0.96 : 0.72)
      .setStrokeStyle(1, canGoNext ? 0xd7a64e : 0x6f6a52, canGoNext ? 0.76 : 0.36);
    this.runToolNextPageText.setVisible(navigationVisible).setColor(canGoNext ? "#f7ffd6" : "#777f76");
    this.runToolPageText.setVisible(navigationVisible);
    if (!visible || (this.hoveredRunToolId && !this.runToolSlots[this.hoveredRunToolId].button.visible)) {
      this.hoveredRunToolId = null;
      this.setRunToolTooltipVisible(false);
      return;
    }
    this.refreshRunToolTooltip();
  }

  private changeRunToolPage(delta: number): void {
    const nextLayout = getRunToolBarLayout(this.equippedRunToolIds.length, this.scale.width, this.runToolPage + delta);
    if (nextLayout.page === this.runToolPage) {
      return;
    }
    this.runToolPage = nextLayout.page;
    this.hoveredRunToolId = null;
    this.setRunToolTooltipVisible(false);
    this.layout();
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private previewRunTool(toolId: RunToolId): void {
    if (!this.runToolSlots[toolId].button.visible) {
      return;
    }
    this.hoveredRunToolId = toolId;
    this.refreshRunToolTooltip();
  }

  private clearRunToolPreview(toolId: RunToolId): void {
    if (this.hoveredRunToolId !== toolId) {
      return;
    }
    this.hoveredRunToolId = null;
    this.setRunToolTooltipVisible(false);
  }

  private refreshRunToolTooltip(): void {
    const toolId = this.hoveredRunToolId;
    if (!toolId || !this.runToolSlots[toolId].button.visible) {
      this.setRunToolTooltipVisible(false);
      return;
    }

    const view = RUN_TOOL_VIEW[toolId];
    const status = this.getRunToolStatus(toolId);
    const count = toolId === "tinySprinkler" ? this.state.automation.tinySprinklers : 0;
    const description =
      toolId === "tinySprinkler"
        ? `${view.description} Each pulse restores ${this.state.automation.tinySprinklerHealingPerUnit} HP.`
        : view.description;
    this.runToolTooltipFrame.setStrokeStyle(2, view.color, 0.82);
    this.runToolTooltipTitle
      .setText(count > 0 ? `${view.name} x${count}` : view.name)
      .setColor(`#${view.color.toString(16).padStart(6, "0")}`);
    this.runToolTooltipBody.setText(`${description}\n${status}`);
    this.layoutRunToolTooltip();
    this.setRunToolTooltipVisible(true);
  }

  private getRunToolStatus(toolId: RunToolId): string {
    const runTouches = this.state.economy.runTouches;
    const cost =
      toolId === "dewPulse"
        ? DEW_PULSE_RUN_TOUCH_COST
        : toolId === "rootSalve"
          ? ROOT_SALVE_RUN_TOUCH_COST
          : TINY_SPRINKLER_RUN_TOUCH_COST;
    if (runTouches < cost) {
      return `Need ${cost - runTouches} more RT.`;
    }
    if (toolId === "dewPulse" && this.state.ancientGrass.currentHp >= this.state.ancientGrass.maxHp) {
      return "Ancient HP is already full.";
    }
    if (toolId === "rootSalve" && getWoundedRootCount(this.state) <= 0) {
      return "No open wound to seal.";
    }
    return `Ready: spend ${cost} RT.`;
  }

  private setRunToolTooltipVisible(visible: boolean): void {
    this.runToolTooltipFrame.setVisible(visible);
    this.runToolTooltipTitle.setVisible(visible);
    this.runToolTooltipBody.setVisible(visible);
  }

  private isPointerOverRootSalveButton(pointer: Phaser.Input.Pointer): boolean {
    return this.rootSalveButton.visible && this.rootSalveButton.getBounds().contains(pointer.x, pointer.y);
  }

  private isPointerOverDewPulseButton(pointer: Phaser.Input.Pointer): boolean {
    return this.dewPulseButton.visible && this.dewPulseButton.getBounds().contains(pointer.x, pointer.y);
  }

  private isPointerOverTinySprinklerButton(pointer: Phaser.Input.Pointer): boolean {
    return this.tinySprinklerButton.visible && this.tinySprinklerButton.getBounds().contains(pointer.x, pointer.y);
  }

  private isPointerOverRunToolPageButton(pointer: Phaser.Input.Pointer): boolean {
    return (
      (this.runToolPreviousPageButton.visible && this.runToolPreviousPageButton.getBounds().contains(pointer.x, pointer.y)) ||
      (this.runToolNextPageButton.visible && this.runToolNextPageButton.getBounds().contains(pointer.x, pointer.y))
    );
  }

  private isPointerOverOptionsButton(pointer: Phaser.Input.Pointer): boolean {
    return this.optionsButton.visible && this.optionsButton.getBounds().contains(pointer.x, pointer.y);
  }

  private updateTinySprinklers(delta: number): void {
    if (this.state.phase !== "active" || this.introActive || this.state.automation.tinySprinklers <= 0) {
      return;
    }

    this.tinySprinklerElapsed += delta;
    const intervalMs = this.fastDormancy ? FAST_TINY_SPRINKLER_PULSE_INTERVAL_MS : TINY_SPRINKLER_PULSE_INTERVAL_MS;
    if (this.tinySprinklerElapsed < intervalMs) {
      return;
    }

    this.tinySprinklerElapsed = 0;
    this.applyTinySprinklerPulse();
  }

  private applyTinySprinklerPulse(): void {
    const target = this.getTinySprinklerTarget();
    const result = applyTinySprinklerPulse(this.state, target?.rootId);
    if (!result.applied || !target) {
      this.publishBrowserDebugState();
      return;
    }

    this.lastTinySprinklerPulseAt = Math.round(this.time.now);
    this.lastTinySprinklerRootId = target.rootId;
    if (result.healedWound) {
      this.addFeedEntry("Sprinkler triage", `root ${target.rootId + 1} misted shut`, "SP", "#bff4ff");
      this.playWoundSeal(target);
    }
    this.playTinySprinklerPulse(target, result.effectiveHealing);
    this.syncFirstRunObjectives();
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private getTinySprinklerTarget(): RootNodeView | undefined {
    const activeRoots = this.getActiveRootNodes();
    return activeRoots.find((node) => isRootWounded(this.state, node.rootId)) ?? activeRoots[Math.floor(this.time.now / 997) % activeRoots.length];
  }

  private playTinySprinklerPulse(node: RootNodeView, effectiveHealing: number): void {
    this.lastHealingFeedbackKind = "sprinkler";
    this.lastHealingFeedbackAt = Math.round(this.time.now);
    this.floatText(
      node.homeX,
      node.homeY - node.visualSize * 0.35,
      effectiveHealing > 0 ? `sprinkle +${effectiveHealing.toFixed(0)}` : "sprinkle",
      effectiveHealing > 0 ? "#bff4ff" : "#9ac8ff",
    );
    this.emitTouchBurst(node.homeX, node.homeY, effectiveHealing > 0);
    this.playHealingFeedback(node, effectiveHealing, "sprinkler");
    const drop = this.add.circle(node.homeX, node.homeY - node.visualSize * 0.34, Math.max(4, node.visualSize * 0.05), 0xbff4ff, 0.78).setDepth(12);
    this.tweens.add({
      targets: drop,
      y: node.homeY + node.visualSize * 0.24,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeIn",
      onComplete: () => drop.destroy(),
    });
    this.tweens.add({
      targets: node.recoveryHalo,
      alpha: 0.8,
      duration: 160,
      ease: "Quad.easeOut",
      yoyo: true,
    });
  }

  private openOptions(): void {
    this.optionsOpen = true;
    this.setOptionsPanelVisible(true);
    this.refreshOptionsPanel();
    this.layout();
    this.publishBrowserDebugState();
  }

  private closeOptions(): void {
    this.optionsOpen = false;
    this.draggingOptionsVolume = null;
    this.setOptionsPanelVisible(false);
    this.publishBrowserDebugState();
  }

  private setOptionsPanelVisible(visible: boolean): void {
    this.optionsBackdrop.setVisible(visible);
    this.optionsPanel.setVisible(visible);
    this.optionsTitle.setVisible(visible);
    this.optionsMusicLabel.setVisible(visible);
    this.optionsMusicTrack.setVisible(visible);
    this.optionsMusicFill.setVisible(visible);
    this.optionsMusicHit.setVisible(visible);
    this.optionsMusicKnob.setVisible(visible);
    this.optionsSfxLabel.setVisible(visible);
    this.optionsSfxTrack.setVisible(visible);
    this.optionsSfxFill.setVisible(visible);
    this.optionsSfxHit.setVisible(visible);
    this.optionsSfxKnob.setVisible(visible);
    this.optionsMusicToggleButton.setVisible(visible);
    this.optionsMusicToggleText.setVisible(visible);
    this.optionsSfxTestButton.setVisible(visible);
    this.optionsSfxTestText.setVisible(visible);
    this.optionsCloseButton.setVisible(visible);
    this.optionsCloseText.setVisible(visible);
  }

  private togglePrototypeMusic(): void {
    if (this.musicVolume > 0) {
      this.turnPrototypeMusicOff();
      return;
    }

    this.turnPrototypeMusicOn();
  }

  private turnPrototypeMusicOff(): void {
    if (this.musicVolume <= 0) {
      return;
    }

    this.setPrototypeMusicVolume(0);
    this.saySensi("Music off.\nThe grass will hum internally.", "idle", 2600);
  }

  private turnPrototypeMusicOn(): void {
    if (this.musicVolume > 0) {
      return;
    }

    this.setPrototypeMusicVolume(this.lastAudibleMusicVolume > 0 ? this.lastAudibleMusicVolume : DEFAULT_MUSIC_VOLUME);
    this.saySensi(this.audioStarted ? "Music on.\nLucid grass, tasteful menace." : "Music armed.\nFirst root touch wakes it.", "approval", 3000);
  }

  private stopOptionsPointerEvent(_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData): void {
    event.stopPropagation();
  }

  private startOptionsVolumeDrag(pointer: Phaser.Input.Pointer, target: "music" | "sfx", event?: Phaser.Types.Input.EventData): void {
    event?.stopPropagation();
    this.draggingOptionsVolume = target;
    this.setOptionsVolumeFromPointer(pointer, target);
  }

  private handleOptionsVolumeDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingOptionsVolume || !this.optionsOpen) {
      return;
    }

    this.setOptionsVolumeFromPointer(pointer, this.draggingOptionsVolume);
  }

  private stopOptionsVolumeDrag(): void {
    const target = this.draggingOptionsVolume;
    this.draggingOptionsVolume = null;
    if (target === "sfx" && this.sfxVolume > 0) {
      this.sfx.play("skill_select");
    }
  }

  private setOptionsVolumeFromPointer(pointer: Phaser.Input.Pointer, target: "music" | "sfx"): void {
    const trackX = target === "music" ? this.optionsMusicTrackX : this.optionsSfxTrackX;
    const trackWidth = target === "music" ? this.optionsMusicTrackWidth : this.optionsSfxTrackWidth;
    const volume = Phaser.Math.Clamp((pointer.x - trackX) / Math.max(1, trackWidth), 0, 1);
    if (target === "music") {
      this.setPrototypeMusicVolume(volume);
      return;
    }

    this.setPrototypeSfxVolume(volume);
  }

  private setPrototypeMusicVolume(volume: number): void {
    this.musicVolume = writeStoredMusicVolume(volume);
    if (this.musicVolume > 0) {
      this.lastAudibleMusicVolume = this.musicVolume;
    }
    this.applyPrototypeMusicVolume();
    this.refreshOptionsPanel();
    this.publishBrowserDebugState();
  }

  private setPrototypeSfxVolume(volume: number, preview = false): void {
    this.sfxVolume = writeStoredSfxVolume(volume);
    this.sfx.setVolume(this.sfxVolume);
    this.refreshOptionsPanel();
    if (preview && this.sfxVolume > 0 && this.time.now - this.lastSfxPreviewAt > 180) {
      this.lastSfxPreviewAt = this.time.now;
      this.sfx.play("skill_select");
    }
    this.publishBrowserDebugState();
  }

  private testPrototypeSfx(): void {
    if (this.sfxVolume <= 0) {
      this.saySensi("SFX are muted.\nThe grass is doing silent cinema.", "idle", 2600);
      return;
    }

    this.sfx.play("skill_select");
    this.saySensi("SFX test.\nThat little tick is alive.", "approval", 2400);
    this.publishBrowserDebugState();
  }

  private applyPrototypeMusicVolume(): void {
    this.sound.setVolume(this.musicVolume);
    if (!this.audioStarted || !this.lucidTheme || !this.groveTheme) {
      return;
    }

    if (this.musicVolume <= 0) {
      this.musicTransition?.stop();
      this.musicTransition = undefined;
      this.lucidTheme.stop();
      this.groveTheme.stop();
      return;
    }

    const activeTrack = this.musicMode === "field" ? this.lucidTheme : this.groveTheme;
    const activeGain = this.musicMode === "field" ? FIELD_MUSIC_GAIN : GROVE_MUSIC_GAIN;
    if (!activeTrack.isPlaying) {
      activeTrack.play({ volume: activeGain });
    }
  }

  private transitionPrototypeMusic(mode: PrototypeMusicMode): void {
    if (this.musicMode === mode) {
      return;
    }

    this.musicMode = mode;
    if (!this.audioStarted || this.musicVolume <= 0 || !this.lucidTheme || !this.groveTheme) {
      return;
    }

    const incoming = mode === "field" ? this.lucidTheme : this.groveTheme;
    const outgoing = mode === "field" ? this.groveTheme : this.lucidTheme;
    const targetGain = mode === "field" ? FIELD_MUSIC_GAIN : GROVE_MUSIC_GAIN;
    this.musicTransition?.stop();
    const incomingStart = incoming.isPlaying ? incoming.volume : 0;
    const outgoingStart = outgoing.isPlaying ? outgoing.volume : 0;
    if (!incoming.isPlaying) {
      incoming.play({ volume: incomingStart });
    }

    this.musicTransition = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: MUSIC_CROSSFADE_MS,
      ease: "Sine.easeInOut",
      onUpdate: (tween) => {
        const mix = tween.getValue() ?? 1;
        incoming.setVolume(Phaser.Math.Linear(incomingStart, targetGain, mix));
        if (outgoing.isPlaying) {
          outgoing.setVolume(Phaser.Math.Linear(outgoingStart, 0, mix));
        }
      },
      onComplete: () => {
        incoming.setVolume(targetGain);
        if (outgoing.isPlaying) {
          outgoing.stop();
        }
        this.musicTransition = undefined;
      },
    });
  }

  private refreshOptionsPanel(): void {
    const musicEnabled = this.musicVolume > 0;
    this.optionsMusicLabel?.setText(`Music volume: ${Math.round(this.musicVolume * 100)}%`);
    this.optionsSfxLabel?.setText(`SFX volume: ${Math.round(this.sfxVolume * 100)}%`);
    this.optionsMusicToggleText?.setText(musicEnabled ? "Music: On" : "Music: Off");
    this.optionsMusicToggleText?.setColor(musicEnabled ? "#ffefb0" : "#9e9a84");
    this.optionsMusicToggleButton?.setFillStyle(musicEnabled ? 0x173822 : 0x223026, musicEnabled ? 0.94 : 0.74);
    this.optionsMusicFill?.setSize(Math.max(0, this.optionsMusicTrackWidth * this.musicVolume), OPTIONS_TRACK_BASE_HEIGHT);
    this.optionsMusicKnob?.setPosition(this.optionsMusicTrackX + this.optionsMusicTrackWidth * this.musicVolume, this.optionsMusicTrack.y);
    this.optionsSfxFill?.setSize(Math.max(0, this.optionsSfxTrackWidth * this.sfxVolume), OPTIONS_TRACK_BASE_HEIGHT);
    this.optionsSfxKnob?.setPosition(this.optionsSfxTrackX + this.optionsSfxTrackWidth * this.sfxVolume, this.optionsSfxTrack.y);
  }

  private playRootTouchSfx(node: RootNodeView, firstTouch: boolean, healedWound: boolean, effective: boolean, proximity: number): void {
    const profile = this.getRootAudioProfile(node);
    if (firstTouch) {
      this.sfx.playFirstTouch(profile.tier, profile.trait);
      return;
    }

    this.sfx.playGrassTouch(profile.tier, profile.trait, healedWound, effective ? Math.round(proximity * 8) : 0);
  }

  private getRootAudioProfile(node: RootNodeView): { tier: GrassTierId; trait: TileTrait } {
    return GRASS_TEXTURE_AUDIO[GRASS_TEXTURES[node.rootId % GRASS_TEXTURES.length]];
  }

  private playRootTouch(node: RootNodeView, proximity: number, effective: boolean): void {
    this.cameras.main.shake(80, effective ? 0.0015 + proximity * 0.0015 : 0.0008);
    node.touchImpactAt = this.time.now;
    node.touchImpactStrength = effective ? 0.88 + proximity * 0.24 : 0.52;
    node.touchImpactDirection = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    const impactRing = this.add
      .circle(node.homeX, node.homeY, Math.max(8, node.visualSize * 0.18), effective ? 0xeaff9b : 0x9fcaff, effective ? 0.18 : 0.1)
      .setDepth(9)
      .setStrokeStyle(2, effective ? 0xf7ffd6 : 0xbdd7ff, effective ? 0.88 : 0.52);
    this.tweens.add({
      targets: impactRing,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeOut",
      radius: node.visualSize * (effective ? 0.58 : 0.42),
      onComplete: () => impactRing.destroy(),
    });
  }

  private playHealingFeedback(node: RootNodeView, effectiveHealing: number, kind: "root" | "wound" | "salve" | "dewPulse" | "sprinkler"): void {
    if (effectiveHealing <= 0 || this.state.phase !== "active") {
      return;
    }

    this.lastHealingFeedbackKind = kind;
    this.lastHealingFeedbackAt = Math.round(this.time.now);
    const hpTargetX = this.hpBarFill.x + Math.max(12, this.hpBarFill.width);
    const hpTargetY = this.hpBarFill.y;
    const tint = kind === "salve" || kind === "dewPulse" || kind === "sprinkler" ? 0xbff4ff : kind === "wound" ? 0xeaff9b : 0xdfff8f;
    for (let index = 0; index < 3; index += 1) {
      const mote = this.add
        .image(
          node.homeX + Phaser.Math.FloatBetween(-node.visualSize * 0.08, node.visualSize * 0.08),
          node.homeY + Phaser.Math.FloatBetween(-node.visualSize * 0.06, node.visualSize * 0.06),
          index === 1 ? "effect-magic-spore" : "effect-pollen-fleck",
        )
        .setDepth(18)
        .setTint(tint)
        .setAlpha(0.9 - index * 0.12)
        .setScale(Phaser.Math.FloatBetween(1.1, 1.65))
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: mote,
        alpha: 0.08,
        delay: index * 48,
        duration: 430 + index * 55,
        ease: "Sine.easeInOut",
        scaleX: 0.46,
        scaleY: 0.46,
        x: hpTargetX + Phaser.Math.FloatBetween(-8, 8),
        y: hpTargetY + Phaser.Math.FloatBetween(-4, 4),
        onComplete: () => mote.destroy(),
      });
    }

    this.tweens.killTweensOf([this.hpBarFill, this.hpBarGlint]);
    this.hpBarGlint.setPosition(hpTargetX, hpTargetY).setAlpha(kind === "wound" ? 0.62 : 0.46);
    this.tweens.add({
      targets: this.hpBarGlint,
      alpha: 0,
      duration: 420,
      ease: "Sine.easeOut",
      scaleX: kind === "wound" ? 2.4 : 1.8,
      scaleY: 1,
      onComplete: () => this.hpBarGlint.setScale(1),
    });
    this.tweens.add({
      targets: this.hpBarFill,
      alpha: 1,
      duration: 110,
      ease: "Quad.easeOut",
      scaleY: kind === "wound" ? 1.5 : 1.28,
      yoyo: true,
      onComplete: () => this.hpBarFill.setScale(1),
    });
  }

  private playRootRecoveryStart(node: RootNodeView): void {
    const recoveryRing = this.add
      .circle(node.homeX, node.homeY, Math.max(10, node.visualSize * 0.2), 0x8fdfff, 0.11)
      .setDepth(13)
      .setStrokeStyle(2, 0xd9fbff, 0.62);
    this.tweens.add({
      targets: recoveryRing,
      alpha: 0,
      duration: 360,
      ease: "Sine.easeOut",
      radius: node.visualSize * 0.46,
      onComplete: () => recoveryRing.destroy(),
    });
  }

  private playRootRecoveryReject(node: RootNodeView): void {
    this.sfx.play("blocked");
    this.cameras.main.shake(55, 0.0007);
    this.tweens.killTweensOf([node.grass, node.pulse, node.recoveryHalo]);
    const rejectRing = this.add
      .circle(node.homeX, node.homeY, Math.max(8, node.visualSize * 0.16), 0x8fdfff, 0.1)
      .setDepth(13)
      .setStrokeStyle(2, 0xbff4ff, 0.62);
    this.tweens.add({
      targets: rejectRing,
      alpha: 0,
      duration: 260,
      ease: "Sine.easeOut",
      radius: node.visualSize * 0.34,
      onComplete: () => rejectRing.destroy(),
    });
    this.tweens.add({
      targets: node.grass,
      duration: 70,
      ease: "Quad.easeOut",
      x: node.homeX + 2,
      yoyo: true,
      repeat: 1,
      onComplete: () => node.grass.setPosition(node.homeX, node.homeY),
    });
    this.tweens.add({
      targets: node.pulse,
      alpha: 0.46,
      duration: 120,
      ease: "Sine.easeOut",
      scaleX: 1.3,
      scaleY: 1.3,
      yoyo: true,
    });
    if (node.recoveryHalo.visible) {
      this.tweens.add({
        targets: node.recoveryHalo,
        alpha: 0.64,
        duration: 120,
        ease: "Sine.easeOut",
        scaleX: 1.42,
        scaleY: 1.42,
        yoyo: true,
        onComplete: () => node.recoveryHalo.setScale(1),
      });
    }
  }

  private emitTouchBurst(x: number, y: number, effective: boolean): void {
    const count = effective ? 8 : 5;
    const tints = effective ? [0xeaff9b, 0xbff4ff, 0xffefb0] : [0x9fcaff, 0xb7c7ff];
    for (let index = 0; index < count; index += 1) {
      const angle = -Math.PI / 2 + Phaser.Math.FloatBetween(-2.15, 2.15);
      const distance = Phaser.Math.Between(20, effective ? 58 : 42);
      const texture = index % 3 === 0 ? "effect-magic-spore" : "effect-pollen-fleck";
      const fleck = this.add
        .image(
          x + Phaser.Math.FloatBetween(-5, 5),
          y + Phaser.Math.FloatBetween(-4, 4),
          texture,
        )
        .setDepth(12)
        .setTint(tints[index % tints.length])
        .setAlpha(Phaser.Math.FloatBetween(0.68, 0.94))
        .setAngle(Phaser.Math.Between(-24, 24))
        .setScale(Phaser.Math.FloatBetween(0.9, 1.8));
      this.tweens.add({
        targets: fleck,
        alpha: 0,
        angle: fleck.angle + Phaser.Math.Between(-80, 80),
        duration: Phaser.Math.Between(360, 660),
        ease: "Sine.easeOut",
        scaleX: 0.28,
        scaleY: 0.28,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - distance * 0.18,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  private playWoundOpen(node: RootNodeView): void {
    this.sfx.play("prick");
    const ring = this.add
      .circle(node.homeX, node.homeY, Math.max(12, node.visualSize * 0.18), 0x7c1939, 0.2)
      .setDepth(13)
      .setStrokeStyle(3, 0xff6b9a, 0.95);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: 620,
      ease: "Sine.easeOut",
      radius: node.visualSize * 0.72,
      onComplete: () => ring.destroy(),
    });

    for (let index = 0; index < 8; index += 1) {
      const angle = (Math.PI * 2 * index) / 8 + Phaser.Math.FloatBetween(-0.18, 0.18);
      const distance = Phaser.Math.FloatBetween(node.visualSize * 0.18, node.visualSize * 0.42);
      const fleck = this.add.image(node.homeX, node.homeY, "effect-magic-spore").setDepth(14).setTint(0xff4f8b).setAlpha(0.95).setScale(Phaser.Math.FloatBetween(1.4, 2.2));
      this.tweens.add({
        targets: fleck,
        alpha: 0,
        duration: Phaser.Math.Between(480, 760),
        ease: "Sine.easeOut",
        scaleX: 0.4,
        scaleY: 0.4,
        x: node.homeX + Math.cos(angle) * distance,
        y: node.homeY + Math.sin(angle) * distance,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  private playWoundSeal(node: RootNodeView): void {
    this.sfx.play("wound_seal");
    const ring = this.add
      .circle(node.homeX, node.homeY, Math.max(12, node.visualSize * 0.18), 0xbff4ff, 0.18)
      .setDepth(13)
      .setStrokeStyle(3, 0xeaff9b, 0.82);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: 560,
      ease: "Sine.easeOut",
      radius: node.visualSize * 0.62,
      onComplete: () => ring.destroy(),
    });
    this.tweens.add({
      targets: [node.woundHalo, node.woundShard],
      alpha: 0,
      duration: 180,
      ease: "Quad.easeOut",
    });
  }

  private emitExpansionFlecks(x: number, y: number, visualSize: number): void {
    for (let index = 0; index < 7; index += 1) {
      const texture = index % 2 === 0 ? "effect-pollen-fleck" : "effect-magic-spore";
      const tint = index % 2 === 0 ? 0xeaff9b : 0xbff4ff;
      const angle = (Math.PI * 2 * index) / 7 + Phaser.Math.FloatBetween(-0.28, 0.28);
      const distance = Phaser.Math.FloatBetween(visualSize * 0.22, visualSize * 0.5);
      const fleck = this.add.image(x, y, texture).setDepth(12).setTint(tint).setAlpha(0.95).setScale(Phaser.Math.FloatBetween(1.6, 2.7));
      this.tweens.add({
        targets: fleck,
        alpha: 0,
        duration: Phaser.Math.Between(420, 680),
        ease: "Sine.easeOut",
        scaleX: 0.35,
        scaleY: 0.35,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        onComplete: () => fleck.destroy(),
      });
    }
  }

  private playDormancyCollapse(): void {
    this.sfx.play("dormancy");
    this.lastScourgeEvent = "dormancy-collapse";
    this.lastDormancyCollapseAt = Math.round(this.time.now);
    this.lastScourgePressureWaveAt = this.lastDormancyCollapseAt;
    this.playScourgePressureWave("dormancy-collapse");
    this.cameras.main.shake(360, 0.004);
    this.cameras.main.flash(360, 92, 28, 80, false);
    this.rootNodes.forEach((node, index) => {
      this.tweens.add({
        targets: [node.grass, node.spark],
        alpha: 0.16,
        delay: index * 18,
        duration: 420,
        ease: "Sine.easeInOut",
      });
    });
    this.publishBrowserDebugState();
  }

  private playLastStandRevive(): void {
    this.sfx.play("last_stand");
    this.lastScourgeEvent = "last-stand";
    this.lastStandTriggeredAt = Math.round(this.time.now);
    this.lastScourgePressureWaveAt = this.lastStandTriggeredAt;
    this.cameras.main.shake(260, 0.003);
    this.cameras.main.flash(260, 218, 255, 155, false);
    this.floatText(this.fieldCenterX, this.fieldCenterY - this.fieldTouchRadius * 0.52, "LAST STAND", "#eaff9b");

    const reviveRing = this.add
      .circle(this.fieldCenterX, this.fieldCenterY, Math.max(36, this.fieldTouchRadius * 0.18), 0xeaff9b, 0.16)
      .setDepth(17)
      .setStrokeStyle(5, 0xf7ffd6, 0.88)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: reviveRing,
      alpha: 0,
      duration: 780,
      ease: "Sine.easeOut",
      radius: this.fieldTouchRadius * 1.08,
      onComplete: () => reviveRing.destroy(),
    });

    this.tweens.killTweensOf([this.hpBarFill, this.hpBarGlint]);
    this.hpBarGlint.setPosition(this.hpBarFill.x + Math.max(20, this.hpBarFill.width), this.hpBarFill.y).setAlpha(0.78);
    this.tweens.add({
      targets: this.hpBarGlint,
      alpha: 0,
      duration: 560,
      ease: "Sine.easeOut",
      scaleX: 2.8,
      scaleY: 1,
      onComplete: () => this.hpBarGlint.setScale(1),
    });
    this.tweens.add({
      targets: this.hpBarFill,
      alpha: 1,
      duration: 130,
      ease: "Quad.easeOut",
      scaleY: 1.7,
      yoyo: true,
      onComplete: () => this.hpBarFill.setScale(1),
    });

    this.getActiveRootNodes().forEach((node, index) => {
      const delay = index * 12;
      this.tweens.add({
        targets: [node.grass, node.spark],
        alpha: 1,
        delay,
        duration: 220,
        ease: "Sine.easeOut",
      });
      const mote = this.add
        .image(node.homeX, node.homeY, index % 2 === 0 ? "effect-pollen-fleck" : "effect-magic-spore")
        .setDepth(18)
        .setTint(index % 2 === 0 ? 0xeaff9b : 0xbff4ff)
        .setAlpha(0.9)
        .setScale(2);
      this.tweens.add({
        targets: mote,
        alpha: 0,
        delay,
        duration: 520,
        ease: "Sine.easeOut",
        y: node.homeY - node.visualSize * 0.55,
        scaleX: 0.45,
        scaleY: 0.45,
        onComplete: () => mote.destroy(),
      });
    });
  }

  private showDormancySummary(): void {
    this.refreshDormancyReport();
    this.setDormancySummaryVisible(true);
    this.transitionPrototypeMusic("grove");
  }

  private setDormancySummaryVisible(visible: boolean): void {
    this.summaryBackdrop.setVisible(visible);
    this.summaryPanel.setVisible(visible);
    this.summaryTitle.setVisible(visible);
    this.summarySubtitle.setVisible(visible);
    this.summaryStatsFrame.setVisible(visible);
    this.summaryBody.setVisible(visible);
    this.summaryRewardText.setVisible(visible);
    this.summaryStatsText.setVisible(visible);
    this.skillTreeFrame.setVisible(visible);
    this.memoryTreeContent.setVisible(visible);
    this.skillTreeLines.setVisible(visible);
    this.skillTreeTitle.setVisible(visible);
    this.skillTreeHelp.setVisible(visible);
    this.skillTreeConnector.setVisible(visible);
    this.memoryTreeZoomOutButton.setVisible(visible);
    this.memoryTreeZoomOutText.setVisible(visible);
    this.memoryTreeZoomResetButton.setVisible(visible);
    this.memoryTreeZoomResetText.setVisible(visible);
    this.memoryTreeZoomInButton.setVisible(visible);
    this.memoryTreeZoomInText.setVisible(visible);
    if (!visible) {
      this.hoveredMemoryUpgradeId = null;
      this.memoryTreeDragging = false;
      this.memoryTreeDragPointerId = -1;
      this.setMemoryHoverCalloutVisible(false);
    }
    this.memoryDetailFrame.setVisible(visible);
    this.memoryDetailTitle.setVisible(visible);
    this.memoryDetailBranch.setVisible(visible);
    this.memoryDetailIconGlow.setVisible(visible);
    this.memoryDetailIconFrame.setVisible(visible);
    this.memoryDetailIcon.setVisible(visible);
    this.memoryDetailBody.setVisible(visible);
    this.memoryDetailCost.setVisible(visible);
    this.summaryHint.setVisible(visible);
    this.memoryUpgradeButtons.forEach((button) => {
      button.background.setVisible(visible);
      button.glow.setVisible(visible);
      button.hoverRing.setVisible(visible && this.hoveredMemoryUpgradeId === button.upgradeId);
      button.frame.setVisible(visible);
      button.icon.setVisible(visible);
      button.title.setVisible(visible);
      button.branch.setVisible(visible);
      button.detail.setVisible(visible);
    });
    this.lockedMetaNodes.forEach((node) => {
      node.background.setVisible(visible);
      node.title.setVisible(visible);
      node.detail.setVisible(visible);
    });
    this.nextRunGlow.setVisible(visible);
    this.nextRunButton.setVisible(visible);
    this.nextRunText.setVisible(visible);
    if (visible) {
      this.refreshDormancyReport();
      this.refreshMemoryUpgradeButtons();
    }
    this.layout();
  }

  private refreshDormancyReport(): void {
    const summary = getDormancySummary(this.state);
    const compact = this.isCompactDormancyReport();
    this.summaryTitle.setText("Memory Grove");
    this.summarySubtitle.setText("Game Over: dormancy claimed the Ancient Grass. Spend memory, then begin the next run.");
    this.summaryBody.setText(
      compact
        ? "Run over. Healing became GT; unspent RT is gone."
        : "The Scourge ended this attempt. Useful healing became permanent GT; unspent Run Touches were lost.",
    );
    this.summaryRewardText.setText(this.formatDormancyReward(summary));
    this.summaryStatsText.setText(this.formatDormancyStats(summary, compact));
    this.summaryHint.setText(this.getDormancyActionHint());
  }

  private isCompactDormancyReport(): boolean {
    const summaryWidth = Math.min(SUMMARY_PANEL_BASE_WIDTH, Math.max(280, this.scale.width - 64));
    const summaryHeight = Math.min(SUMMARY_PANEL_BASE_HEIGHT, Math.max(260, this.scale.height - 80));
    return summaryWidth < 680 || summaryHeight < 420;
  }

  private formatDormancyReward(summary: DormancySummary): string {
    return `+${summary.permanentGrassTouchesEarned} Permanent GT`;
  }

  private formatDormancyStats(summary: DormancySummary, compact: boolean): string {
    if (compact) {
      return [
        `Useful healing ${this.formatHpAmount(summary.effectiveHealing)} HP -> +${summary.permanentGrassTouchesEarned} GT`,
        `Rate 1 GT / ${EFFECTIVE_HEALING_PER_PERMANENT_TOUCH} HP   Lost ${summary.unspentRunTouches} RT`,
        `Survived ${this.formatDuration(summary.survivedMs)}   Earned ${summary.runTouchesEarned} RT`,
        `Banked ${summary.totalPermanentGrassTouches} GT   Memory: ${this.formatOwnedMemory()}`,
      ].join("\n");
    }

    return [
      `Survived: ${this.formatDuration(summary.survivedMs)}`,
      this.formatDormancyConversion(summary),
      `Run Touches: ${summary.runTouchesEarned} earned, ${summary.unspentRunTouches} unspent lost`,
      `Wounds healed: ${summary.woundsHealed}/${summary.woundsOpened}`,
      `Banked GT: ${summary.totalPermanentGrassTouches}`,
      `Owned memory: ${this.formatOwnedMemory()}`,
    ].join("\n");
  }

  private getDormancyReportLines(summary: DormancySummary): string[] {
    return [
      "Run ended: the Ancient Grass is dormant.",
      this.formatDormancyConversion(summary),
      `Survived: ${this.formatDuration(summary.survivedMs)}`,
      `Run Touches: ${summary.runTouchesEarned} earned, ${summary.unspentRunTouches} unspent lost`,
      `Wounds healed: ${summary.woundsHealed}/${summary.woundsOpened}`,
      `Banked GT: ${summary.totalPermanentGrassTouches}`,
      `Owned memory: ${this.formatOwnedMemory()}`,
    ];
  }

  private formatDormancyConversion(summary: DormancySummary): string {
    return `Useful healing: ${this.formatHpAmount(summary.effectiveHealing)} HP -> +${summary.permanentGrassTouchesEarned} GT (1 GT per ${EFFECTIVE_HEALING_PER_PERMANENT_TOUCH} HP)`;
  }

  private getDormancyActionHint(): string {
    const compact = this.isCompactDormancyReport();
    if (this.lastMemoryPurchaseHint) {
      return compact ? `${this.lastMemoryPurchaseHint} Next run ready.` : `${this.lastMemoryPurchaseHint} Begin Next Run when ready.`;
    }

    return compact ? "Spend GT, then begin next run." : "Spend GT in the skill tree, then use Begin Next Run.";
  }

  private applyMemoryTreeViewTransform(syncInteractiveBounds = true): void {
    this.memoryTreeContent
      .setPosition(
        this.memoryTreeViewport.centerX + this.memoryTreePanX,
        this.memoryTreeViewport.centerY + this.memoryTreePanY,
      )
      .setScale(this.getMemoryTreeDisplayScale());
    if (syncInteractiveBounds) {
      this.syncMemoryTreeInteractiveBounds();
    }
  }

  private syncMemoryTreeInteractiveBounds(): void {
    if (!this.summaryPanel.visible) {
      return;
    }

    const displayScale = this.getMemoryTreeDisplayScale();
    for (const button of this.memoryUpgradeButtons) {
      const input = button.background.input;
      if (!input || !(input.hitArea instanceof Phaser.Geom.Rectangle)) {
        continue;
      }

      const bounds = button.background.getBounds();
      const clipped = this.clipBoundsToMemoryTreeViewport(bounds);
      input.hitArea.setTo(
        Math.max(0, (clipped.left - bounds.left) / displayScale),
        Math.max(0, (clipped.top - bounds.top) / displayScale),
        clipped.width / displayScale,
        clipped.height / displayScale,
      );
    }
  }

  private getMemoryTreeDisplayScale(): number {
    return this.memoryTreeFitScale * this.memoryTreeZoom;
  }

  private getMemoryTreeFittedContentSize(): { width: number; height: number } {
    return {
      width: this.memoryTreeFittedWidth,
      height: this.memoryTreeFittedHeight,
    };
  }

  private clipBoundsToMemoryTreeViewport(bounds: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    const viewportLeft = this.memoryTreeViewport.centerX - this.memoryTreeViewport.width / 2;
    const viewportTop = this.memoryTreeViewport.centerY - this.memoryTreeViewport.height / 2;
    const left = Math.max(bounds.left, viewportLeft);
    const top = Math.max(bounds.top, viewportTop);
    const right = Math.min(bounds.right, viewportLeft + this.memoryTreeViewport.width);
    const bottom = Math.min(bounds.bottom, viewportTop + this.memoryTreeViewport.height);
    return new Phaser.Geom.Rectangle(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
  }

  private refreshMemoryTreeZoomControls(): void {
    const canZoomOut = this.memoryTreeZoom > MEMORY_TREE_MIN_ZOOM + 0.01;
    const canZoomIn = this.memoryTreeZoom < MEMORY_TREE_MAX_ZOOM - 0.01;
    this.memoryTreeZoomResetText.setText(`${Math.round(this.memoryTreeZoom * 100)}%`);
    this.memoryTreeZoomOutButton
      .setFillStyle(canZoomOut ? 0x123621 : 0x17231b, canZoomOut ? 0.94 : 0.62)
      .setStrokeStyle(2, canZoomOut ? 0xd7a64e : 0x6f6a52, canZoomOut ? 0.68 : 0.4);
    this.memoryTreeZoomOutText.setColor(canZoomOut ? "#f7ffd6" : "#8e9588");
    this.memoryTreeZoomInButton
      .setFillStyle(canZoomIn ? 0x123621 : 0x17231b, canZoomIn ? 0.94 : 0.62)
      .setStrokeStyle(2, canZoomIn ? 0xd7a64e : 0x6f6a52, canZoomIn ? 0.68 : 0.4);
    this.memoryTreeZoomInText.setColor(canZoomIn ? "#f7ffd6" : "#8e9588");
  }

  private adjustMemoryTreeZoom(delta: number, anchorX = this.memoryTreeViewport.centerX, anchorY = this.memoryTreeViewport.centerY): void {
    if (!this.summaryPanel.visible) {
      return;
    }

    const result = zoomMemoryTreeAtPoint(
      this.memoryTreeZoom,
      this.memoryTreeZoom + delta,
      { x: this.memoryTreePanX, y: this.memoryTreePanY },
      { x: anchorX, y: anchorY },
      this.memoryTreeViewport,
      this.getMemoryTreeFittedContentSize(),
    );
    if (Math.abs(result.zoom - this.memoryTreeZoom) < 0.001) {
      return;
    }

    this.memoryTreeZoom = result.zoom;
    this.memoryTreePanX = result.pan.x;
    this.memoryTreePanY = result.pan.y;
    this.applyMemoryTreeViewTransform();
    this.refreshMemoryTreeZoomControls();
    this.publishBrowserDebugState();
  }

  private resetMemoryTreeView(): void {
    if (!this.summaryPanel.visible) {
      return;
    }

    this.memoryTreeZoom = 1;
    this.memoryTreePanX = 0;
    this.memoryTreePanY = 0;
    this.applyMemoryTreeViewTransform();
    this.refreshMemoryTreeZoomControls();
    this.publishBrowserDebugState();
  }

  private handleMemoryTreeWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (!this.isPointerInsideMemoryTreeViewport(pointer.x, pointer.y) || deltaY === 0) {
      return;
    }

    this.adjustMemoryTreeZoom(deltaY > 0 ? -MEMORY_TREE_ZOOM_STEP : MEMORY_TREE_ZOOM_STEP, pointer.x, pointer.y);
  }

  private startMemoryTreePan(pointer: Phaser.Input.Pointer, event: Phaser.Types.Input.EventData): void {
    if (
      !this.summaryPanel.visible ||
      this.memoryTreeZoom <= 1 ||
      !this.isPointerInsideMemoryTreeViewport(pointer.x, pointer.y)
    ) {
      return;
    }

    event.stopPropagation();
    this.memoryTreeDragging = true;
    this.memoryTreeDragPointerId = pointer.id;
    this.memoryTreeDragStartX = pointer.x;
    this.memoryTreeDragStartY = pointer.y;
    this.memoryTreeDragStartPanX = this.memoryTreePanX;
    this.memoryTreeDragStartPanY = this.memoryTreePanY;
    this.publishBrowserDebugState();
  }

  private handleMemoryTreePan(pointer: Phaser.Input.Pointer): void {
    if (!this.memoryTreeDragging || pointer.id !== this.memoryTreeDragPointerId) {
      return;
    }

    const pan = clampMemoryTreePan(
      {
        x: this.memoryTreeDragStartPanX + pointer.x - this.memoryTreeDragStartX,
        y: this.memoryTreeDragStartPanY + pointer.y - this.memoryTreeDragStartY,
      },
      this.memoryTreeViewport,
      this.memoryTreeZoom,
      this.getMemoryTreeFittedContentSize(),
    );
    this.memoryTreePanX = pan.x;
    this.memoryTreePanY = pan.y;
    this.applyMemoryTreeViewTransform(false);
  }

  private stopMemoryTreePan(): void {
    if (!this.memoryTreeDragging) {
      return;
    }

    this.memoryTreeDragging = false;
    this.memoryTreeDragPointerId = -1;
    this.syncMemoryTreeInteractiveBounds();
    this.publishBrowserDebugState();
  }

  private isPointerInsideMemoryTreeViewport(x: number, y: number): boolean {
    const left = this.memoryTreeViewport.centerX - this.memoryTreeViewport.width / 2;
    const top = this.memoryTreeViewport.centerY - this.memoryTreeViewport.height / 2;
    return x >= left && x <= left + this.memoryTreeViewport.width && y >= top && y <= top + this.memoryTreeViewport.height;
  }

  private drawMemorySkillTreeLines(nodeSize: number): void {
    this.skillTreeLines.clear();
    if (!this.summaryPanel.visible) {
      return;
    }

    const nodes = new Map(this.memoryUpgradeButtons.map((button) => [button.upgradeId, button]));
    this.skillTreeLines.fillStyle(0xeaff9b, 0.42);
    for (const button of this.memoryUpgradeButtons) {
      this.skillTreeLines.fillCircle(
        button.frame.x + Math.sin(button.frame.x * 0.03) * nodeSize * 0.92,
        button.frame.y - nodeSize * 0.92,
        Math.max(1.2, nodeSize * 0.025),
      );
    }

    for (const button of this.memoryUpgradeButtons) {
      const meta = MEMORY_UPGRADE_VIEW[button.upgradeId];
      const upgrade = PERMANENT_UPGRADE_DEFINITIONS[button.upgradeId];
      for (const sourceId of upgrade.prerequisiteIds) {
        const source = nodes.get(sourceId);
        if (!source) {
          continue;
        }

        const targetOwned = hasPermanentUpgrade(this.state, button.upgradeId);
        const sourceOwned = hasPermanentUpgrade(this.state, sourceId);
        const unlocked = getMissingPermanentUpgradePrerequisites(this.state, button.upgradeId).length === 0;
        const affordable = unlocked && this.state.economy.permanentGrassTouches >= upgrade.cost;
        const selected = this.selectedMemoryUpgradeId === button.upgradeId || this.selectedMemoryUpgradeId === sourceId;
        const active = targetOwned && sourceOwned;
        const color = selected ? 0xf4df6a : active ? 0x8bdc69 : affordable ? meta.color : 0x6f9473;
        const alpha = selected ? 0.58 : active ? 0.46 : affordable ? 0.34 : 0.16;
        this.drawMemoryConnector(source.frame.x, source.frame.y, button.frame.x, button.frame.y, color, alpha, selected, nodeSize);
      }
    }
  }

  private drawMemoryConnector(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    color: number,
    alpha: number,
    selected: boolean,
    nodeSize: number,
  ): void {
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const trim = nodeSize * 0.42;
    const fromX = startX + (dx / distance) * trim;
    const fromY = startY + (dy / distance) * trim;
    const toX = endX - (dx / distance) * trim;
    const toY = endY - (dy / distance) * trim;
    const midX = fromX + dx * 0.52;

    if (selected) {
      this.skillTreeLines.lineStyle(8, color, alpha * 0.16);
      this.skillTreeLines.beginPath();
      this.skillTreeLines.moveTo(fromX, fromY);
      this.skillTreeLines.lineTo(midX, fromY);
      this.skillTreeLines.lineTo(midX, toY);
      this.skillTreeLines.lineTo(toX, toY);
      this.skillTreeLines.strokePath();
    }

    this.skillTreeLines.lineStyle(4, 0x06190f, 0.36);
    this.skillTreeLines.beginPath();
    this.skillTreeLines.moveTo(fromX, fromY);
    this.skillTreeLines.lineTo(midX, fromY);
    this.skillTreeLines.lineTo(midX, toY);
    this.skillTreeLines.lineTo(toX, toY);
    this.skillTreeLines.strokePath();

    this.skillTreeLines.lineStyle(selected ? 3 : 2, color, alpha);
    this.skillTreeLines.beginPath();
    this.skillTreeLines.moveTo(fromX, fromY);
    this.skillTreeLines.lineTo(midX, fromY);
    this.skillTreeLines.lineTo(midX, toY);
    this.skillTreeLines.lineTo(toX, toY);
    this.skillTreeLines.strokePath();
  }

  private refreshMemoryDetail(): void {
    const upgrade = PERMANENT_UPGRADE_DEFINITIONS[this.selectedMemoryUpgradeId];
    const meta = MEMORY_UPGRADE_VIEW[this.selectedMemoryUpgradeId];
    const owned = hasPermanentUpgrade(this.state, this.selectedMemoryUpgradeId);
    const missingPrerequisiteIds = getMissingPermanentUpgradePrerequisites(this.state, this.selectedMemoryUpgradeId);
    const unlocked = missingPrerequisiteIds.length === 0;
    const affordable = unlocked && this.state.economy.permanentGrassTouches >= upgrade.cost;
    const shortfall = Math.max(0, upgrade.cost - this.state.economy.permanentGrassTouches);
    const frameKey = owned ? "skill-node-owned" : affordable ? "skill-node-available" : "skill-node-locked";
    const compact = this.isCompactDormancyReport();
    this.memoryDetailTitle
      .setFontSize(upgrade.name.length > 20 ? (compact ? 14 : 18) : compact ? 18 : 24)
      .setText(upgrade.name);
    this.memoryDetailTitle.setColor(owned ? "#eaff9b" : affordable ? "#ffefb0" : "#c8b98b");
    this.memoryDetailBranch.setText(`${meta.branch} memory`);
    this.memoryDetailBranch.setColor(`#${meta.color.toString(16).padStart(6, "0")}`);
    this.memoryDetailIconGlow
      .setFillStyle(meta.color, owned ? 0.18 : affordable ? 0.16 : 0.08)
      .setStrokeStyle(2, owned || affordable ? meta.color : 0x6f9473, owned || affordable ? 0.5 : 0.2);
    this.memoryDetailIconFrame.setTexture(frameKey).setAlpha(owned || affordable ? 1 : 0.68);
    this.memoryDetailIcon
      .setTexture(meta.iconKey)
      .setAlpha(owned || affordable ? 1 : 0.52)
      .setTint(owned || affordable ? 0xffffff : 0x809080);
    this.memoryDetailBody.setText(`${upgrade.description}\n\n${this.formatMemoryUpgradeFlavor(this.selectedMemoryUpgradeId)}`);
    this.memoryDetailCost.setText(
      owned
        ? `Remembered.\n${this.formatMemoryUpgradeShortEffect(this.selectedMemoryUpgradeId)}`
        : !unlocked
          ? `Cost: ${upgrade.cost} GT\nRequires: ${this.formatMemoryPrerequisiteNames(missingPrerequisiteIds)}`
          : affordable
            ? `Cost: ${upgrade.cost} GT\nReady to remember.`
            : `Cost: ${upgrade.cost} GT\nAvailable: ${this.state.economy.permanentGrassTouches} GT\nShort: ${shortfall} GT`,
    );
    this.memoryDetailCost.setColor(owned ? "#eaff9b" : affordable ? "#f4df6a" : "#ffb1c7");
    this.refreshMemoryHoverCard();
  }

  private refreshMemoryHoverCard(): void {
    const upgradeId = this.hoveredMemoryUpgradeId;
    if (!upgradeId || !this.summaryPanel.visible || !this.memoryHoverCardEnabled) {
      this.setMemoryHoverCalloutVisible(false);
      return;
    }

    const upgrade = PERMANENT_UPGRADE_DEFINITIONS[upgradeId];
    const meta = MEMORY_UPGRADE_VIEW[upgradeId];
    const owned = hasPermanentUpgrade(this.state, upgradeId);
    const missingPrerequisiteIds = getMissingPermanentUpgradePrerequisites(this.state, upgradeId);
    const unlocked = missingPrerequisiteIds.length === 0;
    const shortfall = Math.max(0, upgrade.cost - this.state.economy.permanentGrassTouches);
    const status = owned
      ? `Remembered - ${this.formatMemoryUpgradeShortEffect(upgradeId)}`
      : !unlocked
        ? `Requires ${this.formatMemoryPrerequisiteNames(missingPrerequisiteIds)}`
        : shortfall === 0
          ? `Cost ${upgrade.cost} GT - ready`
          : `Cost ${upgrade.cost} GT - short ${shortfall} GT`;

    this.memoryHoverFrame
      .setFillStyle(0x07170f, 0.97)
      .setStrokeStyle(2, meta.color, 0.82);
    this.memoryHoverTitle
      .setFontSize(upgrade.name.length > 20 ? 13 : 16)
      .setText(upgrade.name)
      .setColor(`#${meta.color.toString(16).padStart(6, "0")}`);
    this.memoryHoverBody.setText(`${upgrade.description}\n${status}`);
    this.setMemoryHoverCalloutVisible(true);
  }

  private setMemoryHoverCalloutVisible(visible: boolean): void {
    this.memoryHoverFrame.setVisible(visible);
    this.memoryHoverTitle.setVisible(visible);
    this.memoryHoverBody.setVisible(visible);
  }

  private refreshMemoryUpgradeButtons(): void {
    this.skillTreeHelp.setText(`Available GT: ${this.state.economy.permanentGrassTouches}\nMemories carry into future runs.`);
    for (const button of this.memoryUpgradeButtons) {
      const upgrade = PERMANENT_UPGRADE_DEFINITIONS[button.upgradeId];
      const meta = MEMORY_UPGRADE_VIEW[button.upgradeId];
      const owned = hasPermanentUpgrade(this.state, button.upgradeId);
      const missingPrerequisiteIds = getMissingPermanentUpgradePrerequisites(this.state, button.upgradeId);
      const unlocked = missingPrerequisiteIds.length === 0;
      const affordable = unlocked && this.state.economy.permanentGrassTouches >= upgrade.cost;
      const selected = this.selectedMemoryUpgradeId === button.upgradeId;
      const shortfall = Math.max(0, upgrade.cost - this.state.economy.permanentGrassTouches);
      const detail = owned
        ? "Owned"
        : !unlocked
          ? missingPrerequisiteIds.length === 1
            ? `Requires\n${PERMANENT_UPGRADE_DEFINITIONS[missingPrerequisiteIds[0]].name}`
            : `Requires ${missingPrerequisiteIds.length}\nmemories`
          : affordable
            ? `Cost ${upgrade.cost} GT`
            : `Cost ${upgrade.cost} GT\nShort ${shortfall} GT`;
      const frameKey = selected ? "skill-node-selected" : owned ? "skill-node-owned" : affordable ? "skill-node-available" : "skill-node-locked";
      const nodeAlpha = owned || affordable || selected ? 1 : unlocked ? 0.72 : 0.5;
      button.background.setFillStyle(0xffffff, 0.001).setStrokeStyle(1, meta.color, 0);
      button.hoverRing
        .setFillStyle(meta.color, 0.06)
        .setStrokeStyle(3, selected ? 0xffef78 : meta.color, 0.92)
        .setVisible(this.summaryPanel.visible && this.hoveredMemoryUpgradeId === button.upgradeId);
      button.frame.setTexture(frameKey).setAlpha(nodeAlpha);
      button.icon.setAlpha(owned || affordable || selected ? 1 : 0.46);
      button.icon.setTint(owned || affordable || selected ? 0xffffff : 0x809080);
      button.glow
        .setFillStyle(meta.color, selected ? 0.24 : affordable ? 0.18 : owned ? 0.16 : 0.05)
        .setStrokeStyle(selected ? 3 : 2, selected ? 0xf4df6a : meta.color, selected ? 0.82 : affordable ? 0.48 : 0.18);
      button.title.setColor(owned ? "#eaff9b" : affordable || selected ? "#ffefb0" : "#b8aa82");
      button.branch.setText("").setColor(owned || affordable || selected ? "#dff6ca" : "#85927d");
      button.detail.setColor(owned ? "#eaff9b" : affordable ? "#dff6ca" : "#aaa790");
      button.detail.setAlpha(selected || owned || affordable ? 1 : 0.76);
      button.detail.setText(detail);
    }
    this.drawMemorySkillTreeLines(this.memoryUpgradeButtons[0]?.frame.displayWidth ?? 72);
    this.refreshMemoryDetail();
  }

  private previewMemoryUpgrade(upgradeId: PermanentUpgradeId): void {
    if (this.state.phase !== "dormant") {
      return;
    }

    const selectionChanged = this.selectedMemoryUpgradeId !== upgradeId;
    const hoverChanged = this.hoveredMemoryUpgradeId !== upgradeId;
    if (!selectionChanged && !hoverChanged) {
      return;
    }

    this.selectedMemoryUpgradeId = upgradeId;
    this.hoveredMemoryUpgradeId = upgradeId;
    this.refreshMemoryUpgradeButtons();
  }

  private clearMemoryUpgradePreview(upgradeId: PermanentUpgradeId): void {
    if (this.hoveredMemoryUpgradeId !== upgradeId) {
      return;
    }

    this.hoveredMemoryUpgradeId = null;
    this.refreshMemoryUpgradeButtons();
  }

  private handleMemoryUpgradeClick(upgradeId: PermanentUpgradeId): void {
    if (this.state.phase !== "dormant") {
      return;
    }

    const result = purchasePermanentUpgrade(this.state, upgradeId);
    const button = this.memoryUpgradeButtons.find((candidate) => candidate.upgradeId === upgradeId);
    const x = button?.background.x ?? this.scale.width / 2;
    const y = button?.background.y ?? this.scale.height / 2;

    if (!result.purchased) {
      this.sfx.play("blocked");
      const missingNames = this.formatMemoryPrerequisiteNames(result.missingPrerequisiteIds ?? []);
      const alreadyOwned = result.reason === "already-owned";
      const pathLocked = result.reason === "prerequisites-missing";
      const message = alreadyOwned ? "already memory" : pathLocked ? "path locked" : "not enough GT";
      const sensiLine = alreadyOwned
        ? "Already remembered.\nVery efficient brain grass."
        : pathLocked
          ? `That memory has no roots yet.\nRemember ${missingNames} first.`
          : "Not enough memory yet.\nSuffer usefully, then return.";
      this.floatText(x, y - 18, message, alreadyOwned ? "#eaff9b" : "#ffb1c7");
      this.saySensi(sensiLine, "dormant", 3400);
      this.refreshMemoryUpgradeButtons();
      return;
    }

    this.floatText(x, y - 18, "remembered", "#eaff9b");
    this.sfx.play("upgrade");
    const impact = this.formatMemoryUpgradeImpact(upgradeId);
    this.lastMemoryPurchaseHint = `${result.upgrade.name} remembered: ${impact}.`;
    this.syncRunToolSlotCapacity();
    this.addFeedEntry("Memory bought", impact, "GT", "#eaff9b");
    this.saySensi(`${result.upgrade.name}.\n${impact}.`, "approval", 4200);
    this.savePermanentMemory();
    this.syncFirstRunObjectives();
    this.refreshDormancyReport();
    this.refreshMemoryUpgradeButtons();
    if (button) {
      this.tweens.add({
        targets: [button.frame, button.glow],
        alpha: 1,
        duration: 140,
        ease: "Quad.easeOut",
        scaleX: 1.08,
        scaleY: 1.08,
        yoyo: true,
      });
    }
  }

  private startNextRunFromMeta(): void {
    if (this.state.phase !== "dormant") {
      return;
    }

    this.startPrototypeAudio();
    this.state = createNextRunFromDormancy(this.state, this.getRunOptions());
    this.syncRunToolSlotCapacity();
    this.objectiveState = createFirstRunObjectiveState();
    this.introActive = false;
    this.lastMemoryPurchaseHint = "";
    this.dormantAnimationPlayed = false;
    this.scourgeDamageAccum = 0;
    this.scourgePulseElapsed = 0;
    this.woundElapsed = 0;
    this.woundPressureWarned = false;
    this.resetScourgeFeedbackState();
    this.resetRunToolFeedbackState();
    this.resetRootRecoveryState();
    this.setDormancySummaryVisible(false);
    this.transitionPrototypeMusic("field");
    this.cameras.main.flash(260, 190, 255, 160, false);
    this.addFeedEntry("New run", "The grass remembers", "GT", "#dfffc8");
    this.saySensi("Again.\nThis time the memory comes with us.", "approval", 4200);
    this.syncFirstRunObjectives(false);
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private forcePlaytestDormancy(): void {
    if (!this.playtestMode || this.state.phase !== "active") {
      return;
    }

    this.state.economy.permanentGrassTouches += getDormancyGrassTouches(this.state);
    this.state.ancientGrass.currentHp = 0;
    this.state.phase = "dormant";
    this.dormantAnimationPlayed = true;
    this.scourgeDamageAccum = 0;
    this.scourgePulseElapsed = 0;
    this.woundElapsed = 0;
    this.woundPressureWarned = false;
    this.clearScourgeSenseTarget();
    this.addFeedEntry("Playtest", "forced dormancy", "PT", "#bff4ff");
    this.saySensi("Playtest collapse.\nVery official. Very fake.", "dormant", 4200);
    this.savePermanentMemory();
    this.playDormancyCollapse();
    this.showDormancySummary();
    this.syncFirstRunObjectives(false);
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private grantPlaytestMemory(): void {
    if (!this.playtestMode) {
      return;
    }

    this.state.economy.permanentGrassTouches += PLAYTEST_MEMORY_GRANT;
    this.lastMemoryPurchaseHint = `Playtest grant: +${PLAYTEST_MEMORY_GRANT} GT.`;
    this.addFeedEntry("Playtest", `+${PLAYTEST_MEMORY_GRANT} GT granted`, "PT", "#bff4ff");
    this.saySensi("Memory grant.\nFor science, not lore.", "approval", 3200);
    this.savePermanentMemory();
    if (this.state.phase === "dormant") {
      this.refreshDormancyReport();
      this.refreshMemoryUpgradeButtons();
    }
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private restartPlaytestRun(): void {
    if (!this.playtestMode) {
      return;
    }

    const permanentUpgrades = [...this.state.permanentUpgrades];
    const permanentGrassTouches = this.state.economy.permanentGrassTouches;
    this.state = this.createPrototypeRunState(permanentUpgrades, permanentGrassTouches);
    this.syncRunToolSlotCapacity();
    this.objectiveState = createFirstRunObjectiveState();
    this.introActive = false;
    this.lastMemoryPurchaseHint = "";
    this.dormantAnimationPlayed = false;
    this.scourgeDamageAccum = 0;
    this.scourgePulseElapsed = 0;
    this.woundElapsed = 0;
    this.woundPressureWarned = false;
    this.resetScourgeFeedbackState();
    this.resetRunToolFeedbackState();
    this.resetRootRecoveryState();
    this.setDormancySummaryVisible(false);
    this.transitionPrototypeMusic("field");
    this.clearScourgeSenseTarget();
    this.addFeedEntry("Playtest", "run restarted", "PT", "#bff4ff");
    this.saySensi("Fresh playtest run.\nPlease complain accurately.", "idle", 3600);
    this.syncFirstRunObjectives(false);
    this.refreshReadout();
    this.publishBrowserDebugState();
  }

  private resetPlaytestMemory(): void {
    if (!this.playtestMode) {
      return;
    }

    try {
      window.localStorage.removeItem(REDESIGN_MEMORY_SAVE_KEY);
    } catch {
      // A blocked storage reset should not break the playtest overlay.
    }
    window.location.reload();
  }

  private isPointerOverMemoryUpgradeButton(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.isPointerInsideMemoryTreeViewport(pointer.x, pointer.y) &&
      this.memoryUpgradeButtons.some((button) => button.background.visible && button.background.getBounds().contains(pointer.x, pointer.y))
    );
  }

  private isPointerOverNextRunButton(pointer: Phaser.Input.Pointer): boolean {
    return this.nextRunButton.visible && this.nextRunButton.getBounds().contains(pointer.x, pointer.y);
  }

  private formatOwnedMemory(): string {
    const owned = MEMORY_UPGRADE_IDS.filter((upgradeId) => hasPermanentUpgrade(this.state, upgradeId));
    return owned.length > 0 ? owned.map((upgradeId) => PERMANENT_UPGRADE_DEFINITIONS[upgradeId].name).join(", ") : "none";
  }

  private formatMemoryPrerequisiteNames(upgradeIds: PermanentUpgradeId[]): string {
    return upgradeIds.map((upgradeId) => PERMANENT_UPGRADE_DEFINITIONS[upgradeId].name).join(" + ");
  }

  private formatMemoryUpgradeImpact(upgradeId: PermanentUpgradeId): string {
    return MEMORY_UPGRADE_VIEW[upgradeId].impact;
  }

  private formatMemoryUpgradeFlavor(upgradeId: PermanentUpgradeId): string {
    return MEMORY_UPGRADE_VIEW[upgradeId].flavor;
  }

  private formatMemoryUpgradeShortEffect(upgradeId: PermanentUpgradeId): string {
    return MEMORY_UPGRADE_VIEW[upgradeId].shortEffect;
  }

  private formatHpAmount(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds.toString().padStart(2, "0")}s` : `${seconds}s`;
  }

  private playScourgeTick(drained: number): void {
    this.lastScourgeEvent = "tick";
    this.lastScourgePulseAt = Math.round(this.time.now);
    const x = this.hpBarFill.x + Math.max(20, this.hpBarFill.width);
    const y = this.hpBarFill.y - 20;
    this.floatText(x, y, `-${drained.toFixed(1)} HP`, "#ff9db6");
    this.scourgeVeil.setAlpha(Math.min(0.42, this.scourgeVeil.alpha + 0.12));
    const spark = this.add
      .rectangle(this.scourgeBarFill.x + Math.max(10, this.scourgeBarFill.width), this.scourgeBarFill.y, 8, 16, 0xff91b2, 0.56)
      .setDepth(7)
      .setStrokeStyle(1, 0xffd2df, 0.5);
    this.tweens.add({
      targets: this.scourgeBarFill,
      alpha: 1,
      duration: 110,
      ease: "Quad.easeOut",
      scaleY: 1.8,
      yoyo: true,
    });
    this.tweens.add({
      targets: spark,
      alpha: 0,
      duration: 360,
      ease: "Sine.easeOut",
      scaleX: 2.6,
      scaleY: 0.7,
      x: spark.x + 34,
      onComplete: () => spark.destroy(),
    });
    this.publishBrowserDebugState();
  }

  private playScourgePressureWave(kind: "pressure-warning" | "wound-open" | "dormancy-collapse", targetNode?: RootNodeView): void {
    this.lastScourgeEvent = kind;
    this.lastScourgePressureWaveAt = Math.round(this.time.now);
    if (kind === "pressure-warning") {
      this.lastWoundPressureWarningAt = this.lastScourgePressureWaveAt;
    }
    const intense = kind !== "pressure-warning";
    const dormant = kind === "dormancy-collapse";
    const startRadius = Math.max(28, this.fieldTouchRadius * (dormant ? 0.22 : 0.34));
    const endRadius = Math.max(90, this.fieldTouchRadius * (dormant ? 1.05 : intense ? 0.86 : 0.72));
    const ring = this.add
      .circle(this.fieldCenterX, this.fieldCenterY, startRadius, 0x39152e, dormant ? 0.2 : intense ? 0.16 : 0.09)
      .setDepth(11)
      .setStrokeStyle(dormant ? 5 : intense ? 4 : 3, intense ? 0xff5d9a : 0xd15f8d, dormant ? 0.88 : intense ? 0.76 : 0.46);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      duration: dormant ? 760 : intense ? 560 : 640,
      ease: "Sine.easeOut",
      radius: endRadius,
      onComplete: () => ring.destroy(),
    });

    if (targetNode) {
      this.playScourgeWoundStrike(targetNode);
    }
  }

  private playScourgeWoundStrike(node: RootNodeView): void {
    const startX = this.fieldCenterX;
    const startY = this.fieldCenterY;
    const dx = node.homeX - startX;
    const dy = node.homeY - startY;
    const length = Math.max(24, Math.hypot(dx, dy));
    const strike = this.add
      .rectangle(startX + dx / 2, startY + dy / 2, length, 4, 0xff5d9a, 0.42)
      .setDepth(12)
      .setRotation(Phaser.Math.Angle.Between(startX, startY, node.homeX, node.homeY))
      .setStrokeStyle(1, 0xffd2df, 0.58);
    this.tweens.add({
      targets: strike,
      alpha: 0,
      duration: 280,
      ease: "Quad.easeOut",
      scaleY: 3.2,
      onComplete: () => strike.destroy(),
    });
  }

  private openRandomWound(): void {
    const result = openRootWound(this.state, this.activeRootCount, this.scourgeSenseTargetRootId ?? undefined);
    if (result.openedRootId === undefined) {
      this.clearScourgeSenseTarget();
      return;
    }

    const node = this.rootNodes[result.openedRootId];
    this.clearScourgeSenseTarget();
    const activeObjectiveId = getActiveFirstRunObjective(this.objectiveState, this.state)?.definition.id;
    const triageLessonActive = activeObjectiveId === "stabilizeWound" || activeObjectiveId === "holdTheLine";
    const postTutorialTriage = !triageLessonActive;
    const woundedCount = getWoundedRootCount(this.state);
    if (!postTutorialTriage || woundedCount === 1 || woundedCount % 3 === 0) {
      this.addFeedEntry(
        postTutorialTriage ? "Wound pressure" : "Wound opened",
        postTutorialTriage ? `${woundedCount} roots bleeding` : `root ${node.rootId + 1} is bleeding pressure`,
        "SC",
        "#ff91b2",
      );
    }
    if (activeObjectiveId === "stabilizeWound") {
      this.saySensi("Pink wound. No debate.\nGo there first.", "alert", 3600);
    } else if (activeObjectiveId === "holdTheLine" && woundedCount <= 2) {
      this.saySensi("Hold the line.\nThree sealed wounds opens the patch.", "alert", 3600);
    }
    node.woundHalo.setVisible(true);
    node.woundShard.setVisible(true);
    this.floatText(node.homeX, node.homeY - node.visualSize * 0.35, "wound", "#ff91b2");
    this.playScourgePressureWave("wound-open", node);
    this.playWoundOpen(node);
    this.cameras.main.shake(110, 0.0018);
    this.tweens.add({
      targets: node.pulse,
      alpha: 0.9,
      duration: 160,
      ease: "Quad.easeOut",
      scaleX: 2.15,
      scaleY: 2.15,
      yoyo: true,
    });
    this.publishBrowserDebugState();
  }

  private createPrototypeRunState(
    permanentUpgrades: PermanentUpgradeId[] = this.loadedMemory?.permanentUpgrades ?? [],
    permanentGrassTouches = this.loadedMemory?.permanentGrassTouches ?? 0,
  ): RunSpineState {
    return createRunSpineState({
      ...this.getRunOptions(permanentUpgrades),
      permanentGrassTouches,
    });
  }

  private getRunOptions(permanentUpgrades: PermanentUpgradeId[] = this.state?.permanentUpgrades ?? this.loadedMemory?.permanentUpgrades ?? []): Parameters<typeof createRunSpineState>[0] {
    const baseCurrentHp = this.fastDormancy ? FAST_STARTING_HP : this.playtestMode ? PLAYTEST_STARTING_HP : NORMAL_STARTING_HP;
    const baseDrainPerSecond = this.fastDormancy
      ? FAST_SCOURGE_DRAIN_PER_SECOND
      : this.playtestMode
        ? PLAYTEST_SCOURGE_DRAIN_PER_SECOND
        : NORMAL_SCOURGE_DRAIN_PER_SECOND;
    const pressureGrowthPerSecond = this.fastDormancy
      ? FAST_SCOURGE_PRESSURE_GROWTH_PER_SECOND
      : this.playtestMode
        ? PLAYTEST_SCOURGE_PRESSURE_GROWTH_PER_SECOND
        : NORMAL_SCOURGE_PRESSURE_GROWTH_PER_SECOND;
    const maxHpBonus = getPermanentUpgradeEffects(permanentUpgrades).maxHpBonus;
    const currentHp = baseCurrentHp + (baseCurrentHp / DEFAULT_ANCIENT_GRASS_MAX_HP) * maxHpBonus;
    return {
      currentHp,
      baseDrainPerSecond,
      pressureGrowthPerSecond,
      permanentUpgrades,
      pressure: this.playtestMode && !this.fastDormancy ? 1.08 : 1,
    };
  }

  private loadPermanentMemory(): PermanentMemorySnapshot | undefined {
    try {
      if (this.routeParams.has("resetMemory")) {
        window.localStorage.removeItem(REDESIGN_MEMORY_SAVE_KEY);
        return undefined;
      }

      const rawSave = window.localStorage.getItem(REDESIGN_MEMORY_SAVE_KEY);
      if (!rawSave) {
        return undefined;
      }

      return normalizePermanentMemorySnapshot(JSON.parse(rawSave));
    } catch {
      return undefined;
    }
  }

  private savePermanentMemory(): void {
    const snapshot = createPermanentMemorySnapshot(this.state, Date.now());
    try {
      window.localStorage.setItem(REDESIGN_MEMORY_SAVE_KEY, JSON.stringify(snapshot));
    } catch {
      // Saving should never interrupt the prototype loop.
    }
    this.publishBrowserDebugState(snapshot);
  }

  private publishBrowserDebugState(lastSavedMemory?: PermanentMemorySnapshot): void {
    let persistedMemory = lastSavedMemory;
    const activeObjective = getActiveFirstRunObjective(this.objectiveState, this.state);
    const tileMastery = getFirstRunOneTileMastery(this.objectiveState);
    if (!persistedMemory) {
      try {
        const rawSave = window.localStorage.getItem(REDESIGN_MEMORY_SAVE_KEY);
        persistedMemory = rawSave ? normalizePermanentMemorySnapshot(JSON.parse(rawSave)) : undefined;
      } catch {
        persistedMemory = undefined;
      }
    }

    const dormancySummary = this.state.phase === "dormant" ? getDormancySummary(this.state) : null;
    const debugState = {
      phase: this.state.phase,
      runEnded: this.state.phase === "dormant",
      ancientHp: this.state.ancientGrass.currentHp,
      ancientMaxHp: this.state.ancientGrass.maxHp,
      runTouches: this.state.economy.runTouches,
      totalRunTouchesEarned: this.state.economy.totalRunTouchesEarned,
      permanentGrassTouches: this.state.economy.permanentGrassTouches,
      permanentUpgrades: this.state.permanentUpgrades,
      tinySprinklers: this.state.automation.tinySprinklers,
      scourgeSenseOwned: this.hasScourgeSense(),
      scourgeSenseTargetRootId: this.scourgeSenseTargetRootId,
      scourgeSenseWarningVisible: this.scourgeSenseTargetRootId !== null,
      lastScourgeSenseWarningAt: this.lastScourgeSenseWarningAt,
      lastScourgeSenseTargetRootId: this.lastScourgeSenseTargetRootId,
      lastStandOwned: this.hasLastStand(),
      lastStandAvailable: this.isLastStandAvailable(),
      lastStandUsed: this.state.revivals.lastStandUsed,
      lastStandTriggeredAt: this.lastStandTriggeredAt,
      activeObjectiveId: activeObjective?.definition.id ?? null,
      oneTileMasteryRank: tileMastery.rank,
      oneTileMasteryMaxRank: tileMastery.maxRank,
      oneTileMasteryName: tileMastery.name,
      oneTileMasteryEffect: tileMastery.shortEffect,
      cumulativeCareRunTouches: this.objectiveState.cumulativeRunTouchesEarned,
      activeRootCount: this.activeRootCount,
      activeGridSize: this.activeGridSize,
      woundedRootIds: [...this.state.wounds.woundedRootIds],
      roots: this.getBrowserDebugRootNodes(),
      introCardVisible: this.introPanel.visible,
      playerPanelVisible: this.sensiPanel.visible,
      playerPanelTitle: this.sensiTitle.text,
      playerPanelBody: this.sensiBody.text,
      advisorPanelVisible: this.advisorPanel.visible,
      advisorPanelTitle: this.advisorTitle.text,
      advisorPanelBody: this.advisorBody.text,
      feedPanelVisible: this.feedPanel.visible,
      objectiveText: this.objectiveText.text,
      promptText: this.promptText.text,
      lastHealingFeedbackKind: this.lastHealingFeedbackKind,
      lastHealingFeedbackAt: this.lastHealingFeedbackAt,
      lastRunToolKind: this.lastRunToolKind,
      lastRunToolAt: this.lastRunToolAt,
      lastTinySprinklerPulseAt: this.lastTinySprinklerPulseAt,
      lastTinySprinklerRootId: this.lastTinySprinklerRootId,
      lastDewPulseReadyAt: this.lastDewPulseReadyAt,
      lastScourgeEvent: this.lastScourgeEvent,
      lastScourgePulseAt: this.lastScourgePulseAt,
      lastScourgePressureWaveAt: this.lastScourgePressureWaveAt,
      lastWoundPressureWarningAt: this.lastWoundPressureWarningAt,
      lastDormancyCollapseAt: this.lastDormancyCollapseAt,
      musicMode: this.musicMode,
      fieldThemePlaying: this.lucidTheme?.isPlaying ?? false,
      groveThemePlaying: this.groveTheme?.isPlaying ?? false,
      woundPressureWarned: this.woundPressureWarned,
      woundPressureRatio: Math.round(this.getWoundPressureRatio() * 100) / 100,
      metaScreenVisible: this.summaryBackdrop.visible,
      summaryVisible: this.summaryPanel.visible,
      dormancySummary,
      dormancyRewardLine: dormancySummary ? this.formatDormancyReward(dormancySummary) : "",
      dormancyReportLines: dormancySummary ? this.getDormancyReportLines(dormancySummary) : [],
      dormancyActionHint: dormancySummary ? this.getDormancyActionHint() : "",
      memoryUpgradeButtons: this.getBrowserDebugMemoryButtons(),
      lockedMetaNodes: this.getBrowserDebugLockedMetaNodes(),
      memoryTreeView: this.getBrowserDebugMemoryTreeView(),
      nextRunButton: this.getBrowserDebugNextRunButton(),
      runToolButtons: this.getBrowserDebugRunToolButtons(),
      runToolBarVisible: this.runToolBar.visible,
      runToolSlotCapacity: this.runToolSlotCapacity,
      equippedRunToolIds: this.equippedRunToolIds,
      runToolBarView: this.getBrowserDebugRunToolBarView(),
      runToolBarPage: this.runToolPage,
      runToolBarPageCount: this.runToolBarLayout.pageCount,
      runToolBarPageCapacity: this.runToolBarLayout.pageCapacity,
      runToolBarColumns: this.runToolBarLayout.columns,
      runToolBarRows: this.runToolBarLayout.rows,
      hoveredRunToolId: this.hoveredRunToolId,
      runToolTooltipVisible: this.runToolTooltipFrame.visible,
      options: this.getBrowserDebugOptionsState(),
      playtest: this.getBrowserDebugPlaytestState(),
      introActive: this.introActive,
      loadedMemory: this.loadedMemory ?? null,
      persistedMemory: persistedMemory ?? null,
    };
    document.documentElement.dataset.grassRedesignPrototype = JSON.stringify(debugState);
    this.domBridge?.render(debugState);
  }

  private getBrowserDebugRootNodes(): BrowserDebugRootNode[] {
    return this.getActiveRootNodes().map((node) => ({
      rootId: node.rootId,
      x: Math.round(node.homeX),
      y: Math.round(node.homeY),
      visualSize: Math.round(node.visualSize),
      wounded: isRootWounded(this.state, node.rootId),
      recovering: this.isRootRecovering(node),
      recoveryRatio: Math.round(this.getRootRecoveryRatio(node) * 100) / 100,
      recoveryMarkerVisible: node.recoveryHalo.visible,
      scourgeSenseTarget: this.scourgeSenseTargetRootId === node.rootId,
      scourgeSenseMarkerVisible: node.senseHalo.visible,
      woundMarkerVisible: node.woundHalo.visible,
    }));
  }

  private getBrowserDebugMemoryButtons(): BrowserDebugMemoryButton[] {
    return this.memoryUpgradeButtons.map((button) => {
      const upgrade = PERMANENT_UPGRADE_DEFINITIONS[button.upgradeId];
      const unlocked = getMissingPermanentUpgradePrerequisites(this.state, button.upgradeId).length === 0;
      const bounds = this.clipBoundsToMemoryTreeViewport(button.background.getBounds());
      return {
        upgradeId: button.upgradeId,
        x: Math.round(bounds.centerX),
        y: Math.round(bounds.centerY),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        visible: button.background.visible && bounds.width > 0 && bounds.height > 0,
        unlocked,
        affordable: unlocked && this.state.economy.permanentGrassTouches >= upgrade.cost,
        owned: hasPermanentUpgrade(this.state, button.upgradeId),
      };
    });
  }

  private getBrowserDebugLockedMetaNodes(): BrowserDebugMetaNode[] {
    return this.lockedMetaNodes.map((node) => {
      const bounds = node.background.getBounds();
      return {
        title: node.title.text,
        x: Math.round(bounds.centerX),
        y: Math.round(bounds.centerY),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        visible: node.background.visible,
      };
    });
  }

  private getBrowserDebugNextRunButton(): BrowserDebugNextRunButton {
    const bounds = this.nextRunButton.getBounds();
    return {
      x: Math.round(bounds.centerX),
      y: Math.round(bounds.centerY),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      visible: this.nextRunButton.visible,
    };
  }

  private getBrowserDebugRunToolButtons(): BrowserDebugRunToolButton[] {
    return RUN_TOOL_IDS.map((toolId) => {
      const slot = this.runToolSlots[toolId];
      const bounds = slot.button.getBounds();
      const cost = this.getRunToolCost(toolId);
      return {
        toolId,
        x: Math.round(bounds.centerX),
        y: Math.round(bounds.centerY),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        cost,
        count: slot.count,
        visible: slot.button.visible,
        usable: slot.usable,
        affordable: this.state.economy.runTouches >= cost,
      };
    });
  }

  private getBrowserDebugRunToolBarView(): BrowserDebugRunToolBarView {
    const visible = this.runToolBar.visible && this.runToolBarLayout.pageCount > 1;
    return {
      slotCapacity: this.runToolSlotCapacity,
      equippedCount: this.equippedRunToolIds.length,
      page: this.runToolPage,
      pageCount: this.runToolBarLayout.pageCount,
      pageCapacity: this.runToolBarLayout.pageCapacity,
      columns: this.runToolBarLayout.columns,
      rows: this.runToolBarLayout.rows,
      previousButton: this.getBrowserDebugButtonBounds(
        this.runToolPreviousPageButton,
        visible && this.runToolPage > 0,
        visible && this.runToolPage > 0,
      ),
      nextButton: this.getBrowserDebugButtonBounds(
        this.runToolNextPageButton,
        visible && this.runToolPage < this.runToolBarLayout.pageCount - 1,
        visible && this.runToolPage < this.runToolBarLayout.pageCount - 1,
      ),
    };
  }

  private getBrowserDebugOptionsState(): BrowserDebugOptionsState {
    return {
      visible: this.optionsOpen,
      musicEnabled: this.musicVolume > 0,
      musicVolume: Math.round(this.musicVolume * 100) / 100,
      sfxVolume: Math.round(this.sfxVolume * 100) / 100,
      openButton: this.getBrowserDebugButtonBounds(this.optionsButton, true),
      closeButton: this.getBrowserDebugButtonBounds(this.optionsCloseButton, this.optionsOpen),
      musicOnButton: this.getBrowserDebugButtonBounds(this.optionsMusicToggleButton, this.optionsOpen && this.musicVolume <= 0, this.optionsOpen && this.musicVolume <= 0),
      musicOffButton: this.getBrowserDebugButtonBounds(this.optionsMusicToggleButton, this.optionsOpen && this.musicVolume > 0, this.optionsOpen && this.musicVolume > 0),
      musicVolumeSlider: this.getBrowserDebugSliderBounds(this.optionsMusicHit),
      sfxVolumeSlider: this.getBrowserDebugSliderBounds(this.optionsSfxHit, this.sfxVolume),
      sfxTestButton: this.getBrowserDebugButtonBounds(this.optionsSfxTestButton, this.optionsOpen && this.sfxVolume > 0),
    };
  }

  private getBrowserDebugMemoryTreeView(): BrowserDebugMemoryTreeView {
    const visible = this.summaryPanel.visible;
    return {
      zoom: Math.round(this.memoryTreeZoom * 100) / 100,
      minZoom: MEMORY_TREE_MIN_ZOOM,
      maxZoom: MEMORY_TREE_MAX_ZOOM,
      panX: Math.round(this.memoryTreePanX),
      panY: Math.round(this.memoryTreePanY),
      dragging: this.memoryTreeDragging,
      viewportX: Math.round(this.memoryTreeViewport.centerX),
      viewportY: Math.round(this.memoryTreeViewport.centerY),
      viewportWidth: Math.round(this.memoryTreeViewport.width),
      viewportHeight: Math.round(this.memoryTreeViewport.height),
      worldWidth: MEMORY_TREE_WORLD_WIDTH,
      worldHeight: MEMORY_TREE_WORLD_HEIGHT,
      fitScale: Math.round(this.memoryTreeFitScale * 1_000) / 1_000,
      zoomOutButton: this.getBrowserDebugButtonBounds(
        this.memoryTreeZoomOutButton,
        visible && this.memoryTreeZoom > MEMORY_TREE_MIN_ZOOM + 0.01,
      ),
      resetButton: this.getBrowserDebugButtonBounds(this.memoryTreeZoomResetButton, visible),
      zoomInButton: this.getBrowserDebugButtonBounds(
        this.memoryTreeZoomInButton,
        visible && this.memoryTreeZoom < MEMORY_TREE_MAX_ZOOM - 0.01,
      ),
    };
  }

  private getBrowserDebugPlaytestState(): {
    enabled: boolean;
    modeLabel: string;
    grantAmount: number;
    canForceDormancy: boolean;
    canRestartRun: boolean;
    canResetMemory: boolean;
  } {
    return {
      enabled: this.playtestMode,
      modeLabel: this.playtestMode
        ? this.fastDormancy
          ? "Playtest + fast dormancy"
          : "Playtest loop pacing"
        : "Standard loop",
      grantAmount: PLAYTEST_MEMORY_GRANT,
      canForceDormancy: this.playtestMode && this.state.phase === "active",
      canRestartRun: this.playtestMode,
      canResetMemory: this.playtestMode,
    };
  }

  private getBrowserDebugButtonBounds(button: Phaser.GameObjects.Rectangle, enabled: boolean, visibleOverride?: boolean): BrowserDebugButtonBounds {
    const bounds = button.getBounds();
    return {
      x: Math.round(bounds.centerX),
      y: Math.round(bounds.centerY),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      visible: visibleOverride ?? button.visible,
      enabled,
    };
  }

  private getBrowserDebugSliderBounds(slider: Phaser.GameObjects.Rectangle, value = this.musicVolume): BrowserDebugSliderBounds {
    const bounds = slider.getBounds();
    return {
      x: Math.round(bounds.centerX),
      y: Math.round(bounds.centerY),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      visible: slider.visible,
      value: Math.round(value * 100) / 100,
    };
  }

  private getSensiMessage(woundedCount: number, compact: boolean): SensiMessage {
    if (this.sensiBark) {
      if (this.time.now <= this.sensiBark.expiresAt) {
        return this.sensiBark;
      }
      this.sensiBark = undefined;
    }

    if (this.introActive) {
      return {
        mood: "idle",
        text: compact
          ? "Your uncle left one tile.\nIt is already making problems."
          : "Your uncle left you this field.\nThat tile is Ancient Grass.\nTouch it when you are emotionally ready.",
      };
    }

    if (this.state.phase === "dormant") {
      return {
        mood: "dormant",
        text: "Dormancy is not death.\nIt is grass with a dramatic memory.",
      };
    }

    const activeObjectiveId = getActiveFirstRunObjective(this.objectiveState, this.state)?.definition.id;
    const hpRatio = getAncientGrassHpRatio(this.state);
    if (this.hasLastStand() && this.state.revivals.lastStandUsed) {
      return {
        mood: "alert",
        text: compact
          ? "Last Stand spent.\nNo second save."
          : "Last Stand is spent.\nThe next collapse is real dormancy.",
      };
    }

    if (this.isLastStandAvailable() && hpRatio < 0.28) {
      return {
        mood: "approval",
        text: compact
          ? "Last Stand armed.\nKeep your nerve."
          : "Last Stand is armed.\nIf HP breaks once, memory catches it.",
      };
    }

    if (this.scourgeSenseTargetRootId !== null) {
      return {
        mood: "alert",
        text: compact
          ? `Scourge Sense.\nRoot ${this.scourgeSenseTargetRootId + 1} next.`
          : `Scourge Sense caught it early.\nRoot ${this.scourgeSenseTargetRootId + 1} is next.`,
      };
    }

    if (woundedCount > 0 && activeObjectiveId === "completeDormancy") {
      return {
        mood: "alert",
        text: compact
          ? `Pressure remains.\nHeal pink roots when useful.`
          : `Pressure remains.\nHeal pink roots when useful.`,
      };
    }

    if (woundedCount > 0) {
      return {
        mood: "alert",
        text: compact
          ? `Bad roots first.\n${woundedCount} wound${woundedCount === 1 ? "" : "s"} open.`
          : `Bad roots first.\nThe pink ones are not decorative.\n${woundedCount} wound${woundedCount === 1 ? "" : "s"} open.`,
      };
    }

    if (this.activeRootCount === 1) {
      const mastery = getFirstRunOneTileMastery(this.objectiveState);
      return {
        mood: mastery.rank > 0 ? "approval" : "idle",
        text: compact
          ? `${mastery.name}.\nTile mastery ${mastery.rank}/${mastery.maxRank}.`
          : `${mastery.name}.\nMaster this one tile before asking it to become a field.`,
      };
    }

    if (this.isDewPulseUsable()) {
      return {
        mood: "approval",
        text: compact
          ? "Dew Pulse ready.\nSpend RT for time."
          : "Dew Pulse is ready.\nSpend Run Touches when HP is slipping.",
      };
    }

    if (!this.audioStarted) {
      return {
        mood: "idle",
        text: "First touch wakes the field.\nAnd the music, if the browser behaves.",
      };
    }

    return {
      mood: "idle",
      text: "Steady hands.\nUseful panic.\nThat is basically wisdom.",
    };
  }

  private updateSensiMessage(message: SensiMessage): void {
    const lineChanged = this.currentSensiLine !== message.text;
    const moodChanged = this.sensiMood !== message.mood;
    if (lineChanged) {
      this.currentSensiLine = message.text;
      this.advisorTitle.setText("Sensi // Advisor");
      this.advisorBody.setText(message.text);
    }
    if (lineChanged || moodChanged) {
      this.pulseSensi(message.mood);
    }
  }

  private saySensi(text: string, mood: SensiMood, durationMs: number): void {
    this.sensiBark = {
      text,
      mood,
      expiresAt: this.time.now + durationMs,
    };
    this.updateSensiMessage(this.sensiBark);
  }

  private pulseSensi(mood: SensiMood): void {
    this.sensiMood = mood;
    this.advisorTitle.setColor(SENSI_MOOD_TITLE_COLORS[mood]);
    this.tweens.killTweensOf([this.advisorPanel, this.advisorTitle]);
    this.tweens.add({
      targets: this.advisorPanel,
      alpha: 0.98,
      duration: 120,
      ease: "Quad.easeOut",
      yoyo: true,
    });
  }

  private addFeedEntry(label: string, detail: string, icon: string, color: string): void {
    this.feedEntries.unshift({ label, detail, icon, color });
    this.feedEntries = this.feedEntries.slice(0, FEED_VISIBLE_ROWS);
    this.refreshFeedRows();
  }

  private refreshFeedRows(): void {
    this.feedRows.forEach((row, index) => {
      const entry = this.feedEntries[index];
      row.setText(entry ? `${entry.icon}  ${entry.label}\n${entry.detail}` : "");
      row.setColor(entry?.color ?? "#dff6ca");
    });
  }

  private startPrototypeAudio(): void {
    if (this.audioStarted) {
      return;
    }

    this.audioStarted = true;
    this.sound.setVolume(this.musicVolume);
    this.lucidTheme = this.sound.add("redesign-lucid-theme", {
      loop: true,
      volume: this.musicMode === "field" ? FIELD_MUSIC_GAIN : 0,
    }) as PrototypeMusicTrack;
    this.groveTheme = this.sound.add("redesign-grove-theme", {
      loop: true,
      volume: this.musicMode === "grove" ? GROVE_MUSIC_GAIN : 0,
    }) as PrototypeMusicTrack;
    if (this.musicVolume > 0) {
      const activeTrack = this.musicMode === "field" ? this.lucidTheme : this.groveTheme;
      activeTrack.play();
      this.addFeedEntry("Music awake", this.musicMode === "field" ? "lucid field theme online" : "memory grove theme online", "AU", "#bff4ff");
      this.saySensi("Good.\nNow the field has a pulse.", "approval", 3400);
    } else {
      this.addFeedEntry("Music muted", "lucid field theme standing by", "AU", "#bff4ff");
      this.saySensi("Field awake.\nMusic stayed respectfully muted.", "idle", 3400);
    }
    this.publishBrowserDebugState();
  }

  private floatText(x: number, y: number, value: string, color: string): void {
    const label = this.add.text(x, y, value, {
      color,
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      fontStyle: "bold",
      stroke: "#07100c",
      strokeThickness: 3,
    });
    label.setOrigin(0.5);
    label.setResolution(UI_TEXT_RESOLUTION);
    label.setDepth(20);
    this.tweens.add({
      targets: label,
      alpha: 0,
      duration: 760,
      ease: "Sine.easeOut",
      y: y - 34,
      onComplete: () => label.destroy(),
    });
  }
}
