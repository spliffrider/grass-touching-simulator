import Phaser from "phaser";
import {
  readStoredMusicVolume,
  readStoredSfxVolume,
  writeStoredMusicVolume,
  writeStoredSfxVolume,
} from "../data/audio-settings";
import {
  FIELD_SIZE_LADDER,
  HELPER_IDS,
  HELPERS,
  PRODUCTION_TICK_MS,
  PRODUCTION_RESOURCE_IDS,
  PRODUCTION_RESOURCES,
  TileStage,
  type HelperId,
  type ProductionResourceId,
  type TouchBatchResult,
} from "../ecosystem/EcosystemCatalog";
import {
  getAnimatedTileCount,
  getAnimatedTileIndex,
} from "../ecosystem/EcosystemAnimationBudget";
import { EcosystemDomBridge, type EcosystemDomActions } from "../ecosystem/EcosystemDomBridge";
import {
  createEcosystemHeroTileTextures,
  ECOSYSTEM_HERO_TILE_TEXTURE_KEYS,
} from "../ecosystem/EcosystemHeroTextures";
import {
  getHealthHeartbeatPulse,
  predictHealthRatio,
  smoothHealthRatio,
} from "../ecosystem/EcosystemHealthVisual";
import {
  FieldPointerGestureRegistry,
  resizeFieldInputHitArea,
  shouldAttemptFieldTouchOnPointerDown,
  updateFieldPointerGesture,
} from "../ecosystem/EcosystemFieldInput";
import {
  ECOSYSTEM_MEMORY_EDGES,
  ECOSYSTEM_MEMORY_ROOT_ID,
  ECOSYSTEM_MEMORY_ICON_ASSETS,
  ECOSYSTEM_MEMORY_NODES,
  ECOSYSTEM_MEMORY_NODE_BY_ID,
  ECOSYSTEM_MEMORY_CONNECTOR_GAP,
  ECOSYSTEM_MEMORY_WORLD_HEIGHT,
  ECOSYSTEM_MEMORY_WORLD_WIDTH,
  FIRST_ECOSYSTEM_MEMORY_NODE_ID,
  getEcosystemMemoryEntryNodeId,
  getEcosystemMemoryNodeVisualRadius,
  getHelperModeMemoryId,
  getHelperRankMemoryId,
  getHelperUnlockMemoryId,
  getRevealedEcosystemMemoryNodeIds,
  type EcosystemMemoryNodeDefinition,
} from "../ecosystem/EcosystemMemoryTree";
import { EcosystemPerformanceMonitor } from "../ecosystem/EcosystemPerformanceMonitor";
import {
  getManualTouchCooldownMs,
  getTouchCooldownProgress,
  tryStartTouchCooldown,
} from "../ecosystem/EcosystemTouchCooldown";
import {
  clearActiveField,
  loadActiveField,
  loadPermanentEcosystemState,
  saveActiveField,
  savePermanentEcosystemState,
  type ActiveFieldViewSnapshot,
} from "../ecosystem/EcosystemSave";
import {
  FIELD_MAX_ZOOM,
  FIELD_MIN_ZOOM,
  MAX_NEAR_TILE_VIEWS_DESKTOP,
  MAX_NEAR_TILE_VIEWS_PHONE,
  panFieldViewport,
  projectField,
  screenPointToTile,
  zoomFieldAtPoint,
  type FieldProjection,
  type FieldViewportBounds,
  type FieldViewportState,
} from "../ecosystem/EcosystemViewport";
import {
  BEE_HIVE_STARTER_FLOWERS,
  FIELD_MOUSE_STARTER_SEEDS,
  advanceEcosystem,
  buyCultivationRank,
  buyHelper,
  canBeginNextEcosystemRun,
  clearDirtyChunks,
  consumeHelperPulses,
  createEcosystemState,
  createNextEcosystemRun,
  createPermanentEcosystemState,
  forceGameOver,
  getCultivationCost,
  getBeeHiveStatus,
  getDominantChunkStage,
  getEcosystemReadout,
  getFieldMouseStatus,
  getFieldTierUnlockCost,
  getFirstAutomationStatus,
  getHelperCycleIntervalMs,
  getHelperPurchaseCost,
  getHelperStorageResourceIds,
  getHelperUnlockCost,
  getManualTouchPowerBonusPercent,
  getModeUnlockCost,
  getPermanentRankCost,
  getTouchRankCost,
  isFirstEcosystemCollapse,
  isFirstMemoryPending,
  isRunEquipmentAvailable,
  purchaseFieldEmbrace,
  purchasePermanentRank,
  purchaseTouchRank,
  setPrototypeFieldSize,
  switchHelperMode,
  touchFieldTile,
  unlockAllPrototypeMemories,
  unlockHelper,
  unlockHelperMode,
  unlockNextFieldTier,
  type EcosystemState,
  type PermanentEcosystemState,
  type PermanentRankKind,
  type PermanentTouchRankKind,
} from "../ecosystem/EcosystemSystem";
import { AudioSystem } from "../systems/AudioSystem";

const TILE_TEXTURE_KEYS = [
  "eco-tile-dirt",
  "eco-tile-dewy",
  "eco-tile-moist",
  "eco-tile-clover",
  "eco-tile-grass",
  "eco-tile-flower",
  "eco-tile-pollinated",
  "eco-tile-rooted",
] as const;

const TILE_VARIANTS: Record<TileStage, readonly string[]> = {
  [TileStage.Dormant]: ["eco-tile-dirt", "eco-tile-stubble"],
  [TileStage.Dewy]: ["eco-tile-dewy", "eco-tile-moss-dewy"],
  [TileStage.Moist]: ["eco-tile-moist", "eco-tile-thick-dewy"],
  [TileStage.Sprouting]: ["eco-tile-clover", "eco-tile-clover-lush"],
  [TileStage.Verdant]: ["eco-tile-grass", "eco-tile-thick", "eco-tile-moss"],
  [TileStage.Flowering]: ["eco-tile-flower", "eco-tile-flower-lush"],
  [TileStage.Pollinated]: ["eco-tile-pollinated", "eco-tile-golden"],
  [TileStage.Rooted]: ["eco-tile-rooted", "eco-tile-mushroom"],
};

const HELPER_EFFECT_TEXTURE: Record<HelperId, string> = {
  tinySprinkler: "eco-effect-water",
  fieldMouse: "eco-effect-seed",
  beeHive: "eco-effect-bee",
  chickenPatrol: "eco-effect-spore",
  earthwormCrew: "eco-effect-spore",
  ancientRoots: "eco-effect-water",
  sheepLoop: "eco-effect-grass",
  meadowRabbit: "eco-effect-seed",
};

const HELPER_EFFECT_COLOR: Record<HelperId, number> = {
  tinySprinkler: 0x8de7ff,
  fieldMouse: 0xb8d96c,
  beeHive: 0xffe889,
  chickenPatrol: 0xd8b66a,
  earthwormCrew: 0xc98c68,
  ancientRoots: 0x83d765,
  sheepLoop: 0xb8f1a0,
  meadowRabbit: 0xe7b88e,
};

const HELPER_PULSE_COPY: Record<HelperId, string> = {
  tinySprinkler: "MOISTURE + CARE",
  fieldMouse: "GROWTH + RT",
  beeHive: "POLLINATED BLOOMS",
  chickenPatrol: "COMPOST + RT",
  earthwormCrew: "HUMUS",
  ancientRoots: "ROOT ENERGY + CARE",
  sheepLoop: "CLIPPINGS + CARE",
  meadowRabbit: "GROWTH + FLOWERS",
};

const SAVE_INTERVAL_MS = 15_000;
const DOM_REFRESH_MS = 1_000;
const HARNESS_REFRESH_MS = 500;
const MAX_EFFECTS = 24;
const MAX_CHUNK_VIEWS = 100;
const AMBIENT_MOTE_COUNT = 18;
const MAX_SCENE_CONTENT_WIDTH = 1680;
const HELPER_ARRIVAL_MS = 760;
const HELPER_PULSE_ANIMATION_MS = 620;
const HELPER_SOUND_INTERVAL_MS = 720;
const FIELD_MOUSE_SCURRY_MS = 1_080;
const FIELD_MOUSE_PLANT_RATIO = 0.62;
const BEE_FLIGHT_MS = 460;
const TOUCH_READY_FLASH_MS = 220;
const FIRST_MEMORY_CELEBRATION_MS = 520;
const FIRST_MEMORY_REVEAL_MS = 1_050;

const TILE_STAGE_LABELS: Record<TileStage, string> = {
  [TileStage.Dormant]: "Sleeping Soil",
  [TileStage.Dewy]: "Dew-Kissed Grass",
  [TileStage.Moist]: "Watered Patch",
  [TileStage.Sprouting]: "New Clover",
  [TileStage.Verdant]: "Living Grass",
  [TileStage.Flowering]: "Wildflower Patch",
  [TileStage.Pollinated]: "Pollinated Meadow",
  [TileStage.Rooted]: "Ancient Roots",
};

interface SceneButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  enabled: boolean;
  visible: boolean;
  width: number;
  height: number;
  setPosition(x: number, y: number): SceneButton;
  setSize(width: number, height: number): SceneButton;
  setLabel(label: string): SceneButton;
  setEnabled(enabled: boolean): SceneButton;
  setVisible(visible: boolean): SceneButton;
}

interface HelperActorView {
  image: Phaser.GameObjects.Image;
  carryImage: Phaser.GameObjects.Image | null;
  badgeBack: Phaser.GameObjects.Rectangle;
  progressFill: Phaser.GameObjects.Rectangle;
  countText: Phaser.GameObjects.Text;
  baseX: number;
  baseY: number;
  baseScaleX: number;
  baseScaleY: number;
  actorSize: number;
  badgeWidth: number;
  phase: number;
  arrivalStartedAt: number;
  pulseStartedAt: number;
  scurryStartedAt: number;
  scurryTargetX: number;
  scurryTargetY: number;
  scurryPulseCount: number;
  scurryPlanted: boolean;
  beeFlightActive: boolean;
  beeFlightPulseCount: number;
}

interface MemoryNodeRuntime {
  rank: number;
  maxRank: number;
  cost: number;
  complete: boolean;
  unlocked: boolean;
  affordable: boolean;
  action: () => boolean;
  status: string;
  effect: string;
  requirement: string;
}

interface MemoryNodeView {
  definition: EcosystemMemoryNodeDefinition;
  container: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Arc;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  rankPips: Phaser.GameObjects.Graphics | null;
  rankPipCount: number;
  rankPipY: number;
}

interface MemoryTreeDragState {
  pointerId: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

interface TouchRecoveryVisualState {
  tileIndex: number;
  startedAtMs: number;
  readyAtMs: number;
  blockedAtMs: number;
  readyShown: boolean;
}

export class EcosystemPrototypeScene extends Phaser.Scene {
  private permanent!: PermanentEcosystemState;
  private state!: EcosystemState;
  private fieldView: FieldViewportState = { centerX: 0.5, centerY: 0.5, zoom: 1 };
  private projection!: FieldProjection;
  private fieldBounds: FieldViewportBounds = { x: 0, y: 0, width: 1, height: 1 };
  private playtest = false;
  private showDebugPanel = false;
  private worksOpen = false;
  private optionsOpen = false;
  private memoryTreeZoom = 1;
  private memoryTreePanX = 0;
  private memoryTreePanY = 0;
  private memoryTreeFitScale = 1;
  private memoryTreeViewport: FieldViewportBounds = { x: 0, y: 0, width: 1, height: 1 };
  private memoryTreeDragState: MemoryTreeDragState | null = null;
  private memoryTreeClickSuppressed = false;
  private selectedMemoryNodeId = FIRST_ECOSYSTEM_MEMORY_NODE_ID;
  private hoveredMemoryNodeId: string | null = null;
  private memoryRevealHoldIds: Set<string> | null = null;
  private memoryRevealSequenceActive = false;
  private memoryEntryTween: Phaser.Tweens.Tween | null = null;
  private readonly fieldPointerGestures = new FieldPointerGestureRegistry();
  private saveElapsedMs = 0;
  private domElapsedMs = 0;
  private harnessElapsedMs = 0;
  private uiRefreshRequested = false;
  private fieldRenderRequested = false;
  private latestFrameDeltaMs = 0;
  private maxFrameDeltaMs = 0;
  private frameSpikes = 0;
  private fieldPointerDowns = 0;
  private fieldPointerDrags = 0;
  private touchInputAttempts = 0;
  private touchInputAccepted = 0;
  private touchInputBlocked = 0;
  private touchInputLatencyTotalMs = 0;
  private touchInputLatencyMaxMs = 0;
  private performanceMonitor = new EcosystemPerformanceMonitor();
  private renderedTileViews = 0;
  private renderedChunkViews = 0;
  private displayObjectCount = 0;
  private lastGameOverState = false;
  private firstSprinklerCycleCelebrated = false;
  private automationGoalReadyForPurchase = false;
  private returnToTitleAvailable = false;

  private background!: Phaser.GameObjects.Image;
  private fieldRoot!: Phaser.GameObjects.Container;
  private factoryRoot!: Phaser.GameObjects.Container;
  private memoryRoot!: Phaser.GameObjects.Container;
  private optionsRoot!: Phaser.GameObjects.Container;
  private fieldChrome!: Phaser.GameObjects.Graphics;
  private fieldAtmosphere!: Phaser.GameObjects.Graphics;
  private fieldGrid!: Phaser.GameObjects.Graphics;
  private fieldMaskShape!: Phaser.GameObjects.Graphics;
  private fieldSurface!: Phaser.GameObjects.Rectangle;
  private tileLayer!: Phaser.GameObjects.Container;
  private chunkLayer!: Phaser.GameObjects.Container;
  private helperLayer!: Phaser.GameObjects.Container;
  private ambienceLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private tilePool: Phaser.GameObjects.Image[] = [];
  private readonly tileAnimationPhases = new Float32Array(MAX_NEAR_TILE_VIEWS_DESKTOP);
  private readonly tileBaseYs = new Float32Array(MAX_NEAR_TILE_VIEWS_DESKTOP);
  private chunkPool: Phaser.GameObjects.Image[] = [];
  private impactPool: Phaser.GameObjects.Arc[] = [];
  private effectPool: Phaser.GameObjects.Image[] = [];
  private ambientMotes: Phaser.GameObjects.Image[] = [];
  private readonly ambientMotePhases = new Float32Array(AMBIENT_MOTE_COUNT);
  private readonly ambientMoteCenterXs = new Float32Array(AMBIENT_MOTE_COUNT);
  private readonly ambientMoteCenterYs = new Float32Array(AMBIENT_MOTE_COUNT);
  private readonly ambientMoteOrbitXs = new Float32Array(AMBIENT_MOTE_COUNT);
  private readonly ambientMoteOrbitYs = new Float32Array(AMBIENT_MOTE_COUNT);
  private helperActors = {} as Record<HelperId, HelperActorView>;
  private helperFeedbackTexts = {} as Record<HelperId, Phaser.GameObjects.Text>;
  private helperAnnouncementText!: Phaser.GameObjects.Text;
  private touchCooldownShade!: Phaser.GameObjects.Rectangle;
  private touchCooldownBarBack!: Phaser.GameObjects.Rectangle;
  private touchCooldownBarFill!: Phaser.GameObjects.Rectangle;
  private touchCooldownText!: Phaser.GameObjects.Text;
  private readonly touchCooldowns = new Map<number, number>();
  private touchRecoveryVisual: TouchRecoveryVisualState | null = null;
  private helperIcons = {} as Record<HelperId, Phaser.GameObjects.Image>;
  private helperBuyButtons = {} as Record<HelperId, SceneButton>;
  private factoryHelperButtons = {} as Record<HelperId, SceneButton>;
  private factoryModeButtons = {} as Record<HelperId, SceneButton>;

  private titleText!: Phaser.GameObjects.Text;
  private runText!: Phaser.GameObjects.Text;
  private hpBarBack!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpBarHeartbeatGlow!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private pressureText!: Phaser.GameObjects.Text;
  private currencyText!: Phaser.GameObjects.Text;
  private fieldLabelText!: Phaser.GameObjects.Text;
  private fieldHintText!: Phaser.GameObjects.Text;
  private ledgerTitle!: Phaser.GameObjects.Text;
  private ledgerStocksLeft!: Phaser.GameObjects.Text;
  private ledgerStocksRight!: Phaser.GameObjects.Text;
  private bottleneckText!: Phaser.GameObjects.Text;
  private automationGoalText!: Phaser.GameObjects.Text;
  private automationGoalBack!: Phaser.GameObjects.Rectangle;
  private automationGoalFill!: Phaser.GameObjects.Rectangle;
  private touchSummaryText!: Phaser.GameObjects.Text;
  private playerPortrait!: Phaser.GameObjects.Image;
  private caretakerTitle!: Phaser.GameObjects.Text;
  private caretakerRole!: Phaser.GameObjects.Text;
  private caretakerStats!: Phaser.GameObjects.Text;
  private balanceTitle!: Phaser.GameObjects.Text;
  private balanceStatus!: Phaser.GameObjects.Text;
  private balanceDetail!: Phaser.GameObjects.Text;
  private balanceBarBack!: Phaser.GameObjects.Rectangle;
  private balanceBarFill!: Phaser.GameObjects.Rectangle;
  private balanceGoalMarker!: Phaser.GameObjects.Rectangle;
  private scourgeHalo!: Phaser.GameObjects.Arc;
  private scourgeCore!: Phaser.GameObjects.Arc;
  private plotStageText!: Phaser.GameObjects.Text;
  private plotDetailText!: Phaser.GameObjects.Text;
  private openingPanelsVisible = false;
  private displayedHpRatio = 1;
  private hpHeartbeatPulse = 0;
  private optionsButton!: SceneButton;
  private worksButton!: SceneButton;
  private cultivationButton!: SceneButton;
  private zoomOutButton!: SceneButton;
  private zoomResetButton!: SceneButton;
  private zoomInButton!: SceneButton;

  private factoryChrome!: Phaser.GameObjects.Graphics;
  private factoryTitle!: Phaser.GameObjects.Text;
  private factorySubtitle!: Phaser.GameObjects.Text;
  private factoryBottleneck!: Phaser.GameObjects.Text;
  private factoryCloseButton!: SceneButton;
  private factoryResourceTexts = {} as Record<ProductionResourceId, Phaser.GameObjects.Text>;
  private factoryResourceBacks = {} as Record<ProductionResourceId, Phaser.GameObjects.Rectangle>;

  private memoryChrome!: Phaser.GameObjects.Graphics;
  private memoryTitle!: Phaser.GameObjects.Text;
  private memorySubtitle!: Phaser.GameObjects.Text;
  private memorySummary!: Phaser.GameObjects.Text;
  private memoryDetail!: Phaser.GameObjects.Text;
  private memoryCurrencyText!: Phaser.GameObjects.Text;
  private memoryTreeTitle!: Phaser.GameObjects.Text;
  private memoryTreeWorld!: Phaser.GameObjects.Container;
  private memoryTreeDecor!: Phaser.GameObjects.Graphics;
  private memoryTreeLines!: Phaser.GameObjects.Graphics;
  private memoryTreeMaskShape!: Phaser.GameObjects.Graphics;
  private memoryNodeViews = new Map<string, MemoryNodeView>();
  private memoryDetailTitle!: Phaser.GameObjects.Text;
  private memoryDetailBranch!: Phaser.GameObjects.Text;
  private memoryDetailStatus!: Phaser.GameObjects.Text;
  private memoryDetailIconGlow!: Phaser.GameObjects.Arc;
  private memoryDetailIconFrame!: Phaser.GameObjects.Image;
  private memoryDetailIcon!: Phaser.GameObjects.Image;
  private memoryZoomOutButton!: SceneButton;
  private memoryZoomResetButton!: SceneButton;
  private memoryZoomInButton!: SceneButton;
  private memoryOptionsButton!: SceneButton;
  private beginNextRunButton!: SceneButton;

  private optionsChrome!: Phaser.GameObjects.Graphics;
  private optionsTitle!: Phaser.GameObjects.Text;
  private optionsCopy!: Phaser.GameObjects.Text;
  private optionsResumeButton!: SceneButton;
  private optionsTitleButton!: SceneButton;
  private optionsMusicButton!: SceneButton;
  private optionsSfxButton!: SceneButton;

  private domBridge?: EcosystemDomBridge;
  private audio = new AudioSystem();
  private music?: Phaser.Sound.BaseSound;
  private musicVolume = 0;
  private sfxVolume = 0;
  private lastHelperSoundAt = -Infinity;
  private readonly handlePageHide = (): void => this.persistAll();

  constructor() {
    super("EcosystemPrototypeScene");
  }

  preload(): void {
    this.load.image("eco-background", "/assets/backgrounds/meadow-clearing-concept.webp");
    this.load.image("eco-tile-dirt", "/assets/tiles/tile-dirt.png");
    this.load.image("eco-tile-stubble", "/assets/tiles/tile-stubble.png");
    this.load.image("eco-tile-dewy", "/assets/tiles/grass-normal-dewy.png");
    this.load.image("eco-tile-moss-dewy", "/assets/tiles/grass-moss-dewy.png");
    this.load.image("eco-tile-moist", "/assets/tiles/grass-normal-lush.png");
    this.load.image("eco-tile-thick-dewy", "/assets/tiles/grass-thick-dewy.png");
    this.load.image("eco-tile-clover", "/assets/tiles/grass-clover.png");
    this.load.image("eco-tile-clover-lush", "/assets/tiles/grass-clover-lush.png");
    this.load.image("eco-tile-grass", "/assets/tiles/grass-normal.png");
    this.load.image("eco-tile-thick", "/assets/tiles/grass-thick.png");
    this.load.image("eco-tile-moss", "/assets/tiles/grass-moss.png");
    this.load.image("eco-tile-flower", "/assets/tiles/grass-wildflower.png");
    this.load.image("eco-tile-flower-lush", "/assets/tiles/grass-wildflower-lush.png");
    this.load.image("eco-tile-pollinated", "/assets/tiles/grass-wildflower-dewy.png");
    this.load.image("eco-tile-golden", "/assets/tiles/grass-golden.png");
    this.load.image("eco-tile-rooted", "/assets/tiles/grass-moss-lush.png");
    this.load.image("eco-tile-mushroom", "/assets/tiles/grass-mushroom.png");
    for (const helperId of HELPER_IDS) {
      this.load.image(`eco-helper-${helperId}`, HELPERS[helperId].assetPath);
    }
    this.load.image("eco-effect-water", "/assets/effects/water-drop.png");
    this.load.image("eco-effect-seed", "/assets/effects/seed-kernel.png");
    this.load.image("eco-effect-bee", "/assets/effects/bee-pixel.png");
    this.load.image("eco-effect-pollen", "/assets/effects/pollen-fleck.png");
    this.load.image("eco-effect-spore", "/assets/effects/magic-spore.png");
    this.load.image("eco-effect-grass", "/assets/tiles/grass-fleck.png");
    this.load.image("eco-player", "/assets/ui/characters/player-field-heir.png");
    this.load.image("memory-node-locked", "/assets/ui/skill-node-locked.png");
    this.load.image("memory-node-available", "/assets/ui/skill-node-available.png");
    this.load.image("memory-node-owned", "/assets/ui/skill-node-owned.png");
    this.load.image("memory-node-selected", "/assets/ui/skill-node-selected.png");
    for (const asset of ECOSYSTEM_MEMORY_ICON_ASSETS) this.load.image(asset.key, asset.path);
  }

  create(): void {
    this.resetRuntimeForCreate();
    const params = new URLSearchParams(window.location.search);
    this.playtest = params.has("playtest");
    this.showDebugPanel = params.has("debugPanel");
    this.returnToTitleAvailable = !params.has("ecosystemPrototype");
    createEcosystemHeroTileTextures(this);
    const pixelTextures = new Set([
      ...Object.values(TILE_VARIANTS).flat(),
      ...Object.values(ECOSYSTEM_HERO_TILE_TEXTURE_KEYS),
      ...HELPER_IDS.map((helperId) => `eco-helper-${helperId}`),
      "eco-player",
      "eco-effect-water",
      "eco-effect-seed",
      "eco-effect-bee",
      "eco-effect-pollen",
      "eco-effect-spore",
      "eco-effect-grass",
      "memory-node-locked",
      "memory-node-available",
      "memory-node-owned",
      "memory-node-selected",
      ...ECOSYSTEM_MEMORY_ICON_ASSETS.map((asset) => asset.key),
    ]);
    for (const key of pixelTextures) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.permanent = loadPermanentEcosystemState();
    const loaded = loadActiveField(this.permanent);
    if (loaded) {
      this.state = loaded.state;
      this.fieldView = loaded.view;
    } else {
      this.state = createEcosystemState(this.permanent);
    }
    const requestedField = Number(params.get("field"));
    if (this.playtest && [32, 50, 100].includes(requestedField)) {
      unlockAllPrototypeMemories(this.permanent);
      if (!this.state.active) this.state = createNextEcosystemRun(this.permanent);
      setPrototypeFieldSize(this.state, this.permanent, requestedField);
      this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    }
    this.lastGameOverState = !this.state.active;
    this.firstSprinklerCycleCelebrated = isRunEquipmentAvailable(this.state)
      && this.state.helpers.tinySprinkler.count > 0
      && getFirstAutomationStatus(this.state, this.permanent).careProduced >= 0.3;

    this.musicVolume = readStoredMusicVolume();
    this.sfxVolume = readStoredSfxVolume();
    this.audio.prepare();
    this.audio.setVolume(this.sfxVolume);
    this.sound.setVolume(this.musicVolume);
    this.queueFieldMusic();

    this.createSceneLayers();
    this.createFieldView();
    this.createFactoryView();
    this.createMemoryView();
    this.createOptionsView();
    this.displayObjectCount = this.countDisplayObjects();
    this.createDomBridge();
    this.bindInput();
    this.layout(this.scale.width, this.scale.height);
    this.prepareMemoryGroveView(!this.state.active);
    this.refreshMemoryTree();
    this.refreshUi(true);
    this.renderField(true);
    this.syncViewVisibility();
    this.cameras.main.fadeIn(240, 3, 12, 7);
    this.playRootEntrance(this.state.active ? this.fieldRoot : this.memoryRoot);

    this.scale.on(Phaser.Scale.Events.RESIZE, (gameSize: Phaser.Structs.Size) => {
      this.layout(gameSize.width, gameSize.height);
      this.prepareMemoryGroveView();
      this.renderField(true);
    });
    window.addEventListener("pagehide", this.handlePageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene());
    window.__grassAppReady?.();
  }

  private resetRuntimeForCreate(): void {
    this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    this.worksOpen = false;
    this.optionsOpen = false;
    this.memoryTreeZoom = 1;
    this.memoryTreePanX = 0;
    this.memoryTreePanY = 0;
    this.memoryTreeFitScale = 1;
    this.memoryTreeDragState = null;
    this.memoryTreeClickSuppressed = false;
    this.selectedMemoryNodeId = FIRST_ECOSYSTEM_MEMORY_NODE_ID;
    this.hoveredMemoryNodeId = null;
    this.memoryRevealHoldIds = null;
    this.memoryRevealSequenceActive = false;
    this.memoryEntryTween = null;
    this.fieldPointerGestures.clear();
    this.saveElapsedMs = 0;
    this.domElapsedMs = 0;
    this.harnessElapsedMs = 0;
    this.uiRefreshRequested = false;
    this.fieldRenderRequested = false;
    this.latestFrameDeltaMs = 0;
    this.maxFrameDeltaMs = 0;
    this.frameSpikes = 0;
    this.fieldPointerDowns = 0;
    this.fieldPointerDrags = 0;
    this.touchInputAttempts = 0;
    this.touchInputAccepted = 0;
    this.touchInputBlocked = 0;
    this.touchInputLatencyTotalMs = 0;
    this.touchInputLatencyMaxMs = 0;
    this.performanceMonitor = new EcosystemPerformanceMonitor();
    this.renderedTileViews = 0;
    this.renderedChunkViews = 0;
    this.displayObjectCount = 0;
    this.lastGameOverState = false;
    this.firstSprinklerCycleCelebrated = false;
    this.automationGoalReadyForPurchase = false;
    this.openingPanelsVisible = false;
    this.displayedHpRatio = 1;
    this.hpHeartbeatPulse = 0;
    this.tilePool.length = 0;
    this.chunkPool.length = 0;
    this.impactPool.length = 0;
    this.effectPool.length = 0;
    this.ambientMotes.length = 0;
    this.touchCooldowns.clear();
    this.touchRecoveryVisual = null;
    this.memoryNodeViews.clear();
    this.helperActors = {} as Record<HelperId, HelperActorView>;
    this.helperFeedbackTexts = {} as Record<HelperId, Phaser.GameObjects.Text>;
    this.helperIcons = {} as Record<HelperId, Phaser.GameObjects.Image>;
    this.helperBuyButtons = {} as Record<HelperId, SceneButton>;
    this.factoryHelperButtons = {} as Record<HelperId, SceneButton>;
    this.factoryModeButtons = {} as Record<HelperId, SceneButton>;
    this.factoryResourceTexts = {} as Record<ProductionResourceId, Phaser.GameObjects.Text>;
    this.factoryResourceBacks = {} as Record<ProductionResourceId, Phaser.GameObjects.Rectangle>;
    this.music = undefined;
    this.domBridge = undefined;
  }

  update(_time: number, delta: number): void {
    const frameStart = performance.now();
    this.latestFrameDeltaMs = delta;
    this.maxFrameDeltaMs = Math.max(this.maxFrameDeltaMs, delta);
    if (delta > 34) this.frameSpikes += 1;
    const simulationStart = performance.now();
    const speed = this.optionsOpen ? 0 : this.worksOpen ? 0.25 : 1;
    const result = advanceEcosystem(this.state, this.permanent, delta, speed);
    if (result.ticks > 0) {
      this.uiRefreshRequested = true;
      if (result.changedChunks > 0) this.fieldRenderRequested = true;
      const pulses = consumeHelperPulses(this.state);
      for (const helperId of HELPER_IDS) {
        if (pulses[helperId] <= 0) continue;
        const celebrateFirstCare = helperId === "tinySprinkler"
          && this.state.helpers.tinySprinkler.modeId === "caretaker"
          && !this.firstSprinklerCycleCelebrated;
        if (celebrateFirstCare) this.firstSprinklerCycleCelebrated = true;
        this.spawnHelperEffect(helperId, pulses[helperId], false, celebrateFirstCare);
      }
    }
    if (!this.state.active && !this.lastGameOverState) {
      this.lastGameOverState = true;
      this.worksOpen = false;
      this.memoryRevealHoldIds = null;
      this.memoryRevealSequenceActive = false;
      this.resetTouchRecovery();
      this.audio.play("dormancy");
      this.prepareMemoryGroveView(true);
      this.refreshMemoryTree();
      this.syncViewVisibility();
      this.playRootEntrance(this.memoryRoot, 300);
      this.refreshUi(true);
      this.persistAll();
      this.uiRefreshRequested = false;
      this.fieldRenderRequested = false;
    }
    const simulationMs = performance.now() - simulationStart;

    const animationStart = performance.now();
    this.animateHealthBar(this.time.now, delta);
    this.animateLivingField(this.time.now);
    this.animateMemoryTree(this.time.now);
    const animationMs = performance.now() - animationStart;
    this.domElapsedMs += delta;
    this.harnessElapsedMs += delta;
    this.saveElapsedMs += delta;
    let uiRefreshMs = -1;
    let fieldRenderMs = -1;
    let saveMs = -1;
    if (this.uiRefreshRequested && this.state.active && !this.optionsOpen) {
      this.uiRefreshRequested = false;
      const uiRefreshStart = performance.now();
      this.refreshUi(false);
      uiRefreshMs = performance.now() - uiRefreshStart;
    }
    if (this.fieldRenderRequested && this.fieldRoot.visible) {
      this.fieldRenderRequested = false;
      const fieldRenderStart = performance.now();
      this.renderField(true);
      fieldRenderMs = performance.now() - fieldRenderStart;
    }
    if (this.domElapsedMs >= DOM_REFRESH_MS) {
      this.domElapsedMs %= DOM_REFRESH_MS;
      const domRefreshStart = performance.now();
      this.domBridge?.update(
        this.state,
        this.permanent,
        this.worksOpen,
        this.optionsOpen,
        this.memoryRevealSequenceActive,
      );
      uiRefreshMs = Math.max(0, uiRefreshMs) + performance.now() - domRefreshStart;
    }
    if (this.playtest && this.harnessElapsedMs >= HARNESS_REFRESH_MS) {
      this.harnessElapsedMs %= HARNESS_REFRESH_MS;
      const harnessRefreshStart = performance.now();
      this.updateHarnessDataset();
      uiRefreshMs = Math.max(0, uiRefreshMs) + performance.now() - harnessRefreshStart;
    }
    if (this.saveElapsedMs >= SAVE_INTERVAL_MS) {
      this.saveElapsedMs %= SAVE_INTERVAL_MS;
      const saveStart = performance.now();
      this.persistAll();
      saveMs = performance.now() - saveStart;
    }
    this.performanceMonitor.recordFrame(
      delta,
      performance.now() - frameStart,
      simulationMs,
      animationMs,
      uiRefreshMs,
      fieldRenderMs,
      saveMs,
    );
  }

  private createSceneLayers(): void {
    this.background = this.add.image(0, 0, "eco-background").setOrigin(0).setDepth(0).setAlpha(0.86);
    this.fieldRoot = this.add.container(0, 0).setDepth(10);
    this.factoryRoot = this.add.container(0, 0).setDepth(80);
    this.memoryRoot = this.add.container(0, 0).setDepth(90);
    this.optionsRoot = this.add.container(0, 0).setDepth(120);
  }

  private createFieldView(): void {
    this.fieldChrome = this.add.graphics();
    this.fieldAtmosphere = this.add.graphics();
    this.fieldGrid = this.add.graphics();
    this.fieldMaskShape = this.add.graphics().setVisible(false);
    this.tileLayer = this.add.container();
    this.chunkLayer = this.add.container();
    this.helperLayer = this.add.container();
    this.ambienceLayer = this.add.container();
    this.effectLayer = this.add.container();
    const mask = this.fieldMaskShape.createGeometryMask();
    this.tileLayer.setMask(mask);
    this.chunkLayer.setMask(mask);
    this.helperLayer.setMask(mask);
    this.ambienceLayer.setMask(mask);
    this.effectLayer.setMask(mask);
    this.fieldRoot.add([
      this.fieldChrome,
      this.fieldAtmosphere,
      this.chunkLayer,
      this.ambienceLayer,
      this.tileLayer,
      this.fieldGrid,
      this.helperLayer,
      this.effectLayer,
    ]);

    this.titleText = this.createText("Ancient Grass // Ecosystem", 30, "#fff3c2", "bold");
    this.runText = this.createText("", 13, "#b8d9a4");
    this.hpBarBack = this.add.rectangle(0, 0, 100, 18, 0x071b11, 0.94).setOrigin(0, 0.5);
    this.hpBarFill = this.add.rectangle(0, 0, 100, 14, 0x83d765, 1).setOrigin(0, 0.5);
    this.hpBarHeartbeatGlow = this.add.rectangle(0, 0, 100, 14, 0xb9ff9c, 0)
      .setOrigin(0, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.displayedHpRatio = Phaser.Math.Clamp(this.state.hp / Math.max(1, this.state.maxHp), 0, 1);
    this.hpText = this.createText("", 15, "#f2e8d5", "bold");
    this.pressureText = this.createText("", 13, "#f1a6ce");
    this.currencyText = this.createText("", 14, "#ffe889", "bold");
    this.fieldLabelText = this.createText("", 16, "#fff3c2", "bold");
    this.fieldHintText = this.createText("Touch the living field", 12, "#cce9bd");
    this.ledgerTitle = this.createText("Living Ledger", 22, "#fff3c2", "bold");
    this.ledgerStocksLeft = this.createText("", 11, "#e3f3d6");
    this.ledgerStocksRight = this.createText("", 11, "#e3f3d6");
    this.bottleneckText = this.createText("", 12, "#ffcf8b", "bold");
    this.automationGoalText = this.createText("", 11, "#8de7ff", "bold");
    this.automationGoalBack = this.add.rectangle(0, 0, 100, 9, 0x06190f, 0.96).setOrigin(0, 0.5).setStrokeStyle(1, 0xd8b66a, 0.58);
    this.automationGoalFill = this.add.rectangle(0, 0, 96, 5, 0x8de7ff, 0.94).setOrigin(0, 0.5);
    this.touchSummaryText = this.createText("", 13, "#fff3c2", "bold").setAlpha(0);
    this.playerPortrait = this.add.image(0, 0, "eco-player").setOrigin(0.5);
    this.caretakerTitle = this.createText("FIELD HEIR", 22, "#fff3c2", "bold");
    this.caretakerRole = this.createText("Manual caretaker", 12, "#8de7ff", "bold");
    this.caretakerStats = this.createText("", 13, "#dff6ca");
    this.balanceTitle = this.createText("CARE BALANCE", 22, "#fff3c2", "bold");
    this.balanceStatus = this.createText("", 16, "#f1a6ce", "bold");
    this.balanceDetail = this.createText("", 13, "#e3f3d6");
    this.balanceBarBack = this.add.rectangle(0, 0, 100, 18, 0x071b11, 0.98).setOrigin(0, 0.5).setStrokeStyle(2, 0x5b3926, 0.9);
    this.balanceBarFill = this.add.rectangle(0, 0, 100, 12, 0x83d765, 1).setOrigin(0, 0.5);
    this.balanceGoalMarker = this.add.rectangle(0, 0, 3, 24, 0xffe889, 0.92).setOrigin(0.5);
    this.scourgeHalo = this.add.circle(0, 0, 38, 0x5d213d, 0.22).setStrokeStyle(3, 0xf07ab2, 0.72);
    this.scourgeCore = this.add.circle(0, 0, 15, 0x9d315f, 0.7).setStrokeStyle(2, 0xffb1d3, 0.9);
    this.plotStageText = this.createText("", 20, "#fff3c2", "bold").setOrigin(0.5);
    this.plotDetailText = this.createText("", 12, "#b8d9a4", "bold").setOrigin(0.5);
    this.fieldRoot.add([
      this.titleText,
      this.runText,
      this.hpBarBack,
      this.hpBarFill,
      this.hpBarHeartbeatGlow,
      this.hpText,
      this.pressureText,
      this.currencyText,
      this.fieldLabelText,
      this.fieldHintText,
      this.ledgerTitle,
      this.ledgerStocksLeft,
      this.ledgerStocksRight,
      this.bottleneckText,
      this.automationGoalBack,
      this.automationGoalFill,
      this.automationGoalText,
      this.touchSummaryText,
      this.playerPortrait,
      this.caretakerTitle,
      this.caretakerRole,
      this.caretakerStats,
      this.balanceTitle,
      this.balanceStatus,
      this.balanceDetail,
      this.balanceBarBack,
      this.balanceBarFill,
      this.balanceGoalMarker,
      this.scourgeHalo,
      this.scourgeCore,
      this.plotStageText,
      this.plotDetailText,
    ]);

    this.optionsButton = this.createButton(this.fieldRoot, "Options", () => this.toggleOptions());
    this.worksButton = this.createButton(this.fieldRoot, "Ecosystem Works", () => this.toggleWorks(), 0x245a3a);
    this.cultivationButton = this.createButton(this.fieldRoot, "Cultivate", () => this.buyCultivation(), 0x356c35);
    this.zoomOutButton = this.createButton(this.fieldRoot, "-", () => this.adjustFieldZoom(0.78));
    this.zoomResetButton = this.createButton(this.fieldRoot, "Fit", () => this.resetFieldView());
    this.zoomInButton = this.createButton(this.fieldRoot, "+", () => this.adjustFieldZoom(1.28));

    for (const helperId of HELPER_IDS) {
      const icon = this.add.image(0, 0, `eco-helper-${helperId}`).setOrigin(0.5);
      this.helperIcons[helperId] = icon;
      this.fieldRoot.add(icon);
      this.helperBuyButtons[helperId] = this.createButton(this.fieldRoot, "", () => this.buyHelperFromUi(helperId), 0x1b4f2c);
      const actorImage = this.add.image(0, 0, `eco-helper-${helperId}`).setOrigin(0.5);
      const carryImage = helperId === "fieldMouse"
        ? this.add.image(0, 0, "eco-effect-seed").setOrigin(0.5).setVisible(false)
        : null;
      const badgeBack = this.add.rectangle(0, 0, 92, 20, 0x06190f, 0.92).setStrokeStyle(1, 0xd8b66a, 0.68);
      const progressFill = this.add.rectangle(0, 0, 1, 3, 0x8de7ff, 0.88).setOrigin(0, 0.5);
      const countText = this.createText("", 10, "#fff3c2", "bold").setOrigin(0.5);
      this.helperLayer.add([actorImage, badgeBack, progressFill, countText]);
      if (carryImage) this.helperLayer.add(carryImage);
      this.helperActors[helperId] = {
        image: actorImage,
        carryImage,
        badgeBack,
        progressFill,
        countText,
        baseX: 0,
        baseY: 0,
        baseScaleX: 1,
        baseScaleY: 1,
        actorSize: 0,
        badgeWidth: 92,
        phase: HELPER_IDS.indexOf(helperId) * 1.17,
        arrivalStartedAt: -Infinity,
        pulseStartedAt: -Infinity,
        scurryStartedAt: -Infinity,
        scurryTargetX: 0,
        scurryTargetY: 0,
        scurryPulseCount: 0,
        scurryPlanted: false,
        beeFlightActive: false,
        beeFlightPulseCount: 0,
      };
    }

    const ambienceTextures = ["eco-effect-water", "eco-effect-pollen", "eco-effect-grass", "eco-effect-spore"];
    for (let index = 0; index < AMBIENT_MOTE_COUNT; index += 1) {
      const mote = this.add.image(0, 0, ambienceTextures[index % ambienceTextures.length]).setOrigin(0.5).setVisible(false);
      this.ambientMotePhases[index] = (index / AMBIENT_MOTE_COUNT) * Math.PI * 2;
      this.ambienceLayer.add(mote);
      this.ambientMotes.push(mote);
    }
    for (let index = 0; index < MAX_EFFECTS; index += 1) {
      const impact = this.add.circle(0, 0, 20, 0x8de7ff, 0).setStrokeStyle(3, 0x8de7ff, 0).setVisible(false);
      this.effectLayer.add(impact);
      this.impactPool.push(impact);
      const effect = this.add.image(0, 0, "eco-effect-water").setVisible(false).setOrigin(0.5);
      this.effectLayer.add(effect);
      this.effectPool.push(effect);
    }
    for (const helperId of HELPER_IDS) {
      const feedback = this.createText("", 12, "#fff3c2", "bold")
        .setOrigin(0.5)
        .setBackgroundColor("#06190f")
        .setPadding(7, 3, 7, 3)
        .setVisible(false);
      this.effectLayer.add(feedback);
      this.helperFeedbackTexts[helperId] = feedback;
    }
    this.helperAnnouncementText = this.createText("", 17, "#fff3c2", "bold")
      .setOrigin(0.5)
      .setBackgroundColor("#06190f")
      .setPadding(10, 5, 10, 5)
      .setVisible(false);
    this.touchCooldownShade = this.add.rectangle(0, 0, 1, 1, 0x07130d, 0.34)
      .setStrokeStyle(3, 0x8de7ff, 0.86)
      .setVisible(false);
    this.touchCooldownBarBack = this.add.rectangle(0, 0, 1, 1, 0x06190f, 0.94)
      .setStrokeStyle(1, 0xfff3c2, 0.62)
      .setVisible(false);
    this.touchCooldownBarFill = this.add.rectangle(0, 0, 1, 1, 0x8de7ff, 1)
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.touchCooldownText = this.createText("TOUCH RECOVERING", 12, "#bff4ff", "bold")
      .setOrigin(0.5)
      .setBackgroundColor("#06190f")
      .setPadding(7, 3, 7, 3)
      .setVisible(false);
    this.effectLayer.add([
      this.touchCooldownShade,
      this.touchCooldownBarBack,
      this.touchCooldownBarFill,
      this.touchCooldownText,
      this.helperAnnouncementText,
    ]);

    this.fieldSurface = this.add.rectangle(0, 0, 1, 1, 0xffffff, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
    this.fieldRoot.add(this.fieldSurface);
  }

  private createFactoryView(): void {
    this.factoryChrome = this.add.graphics();
    this.factoryTitle = this.createText("Ecosystem Works", 32, "#fff3c2", "bold");
    this.factorySubtitle = this.createText("Production continues at quarter speed while you reconfigure the field.", 13, "#b8d9a4");
    this.factoryBottleneck = this.createText("", 13, "#ffcf8b", "bold");
    this.factoryRoot.add([this.factoryChrome, this.factoryTitle, this.factorySubtitle, this.factoryBottleneck]);
    this.factoryCloseButton = this.createButton(this.factoryRoot, "Return to Field", () => this.toggleWorks(), 0x245a3a);
    for (const resourceId of PRODUCTION_RESOURCE_IDS) {
      const back = this.add.rectangle(0, 0, 100, 60, 0x0b2617, 0.96).setOrigin(0).setStrokeStyle(2, PRODUCTION_RESOURCES[resourceId].color, 0.7);
      const text = this.createText("", 12, "#f2e8d5", "bold").setOrigin(0.5);
      this.factoryResourceBacks[resourceId] = back;
      this.factoryResourceTexts[resourceId] = text;
      this.factoryRoot.add([back, text]);
    }
    for (const helperId of HELPER_IDS) {
      this.factoryHelperButtons[helperId] = this.createButton(this.factoryRoot, "", () => this.buyHelperFromUi(helperId), 0x1b4f2c);
      this.factoryModeButtons[helperId] = this.createButton(this.factoryRoot, "", () => this.cycleHelperMode(helperId), 0x234558);
    }
  }

  private createMemoryView(): void {
    this.memoryChrome = this.add.graphics();
    this.memoryTreeMaskShape = this.add.graphics().setVisible(false);
    this.memoryTreeWorld = this.add.container();
    this.memoryTreeDecor = this.add.graphics();
    this.memoryTreeLines = this.add.graphics();
    this.memoryTreeWorld.add([this.memoryTreeDecor, this.memoryTreeLines]);
    this.memoryTreeWorld.setMask(this.memoryTreeMaskShape.createGeometryMask());
    this.memoryTitle = this.createText("Memory Grove", 34, "#fff3c2", "bold");
    this.memorySubtitle = this.createText("The field is still. Spend Grass Touches on what the next run remembers.", 14, "#b8d9a4");
    this.memorySummary = this.createText("", 13, "#e3f3d6");
    this.memoryCurrencyText = this.createText("", 15, "#ffe889", "bold");
    this.memoryTreeTitle = this.createText("Memory Web", 20, "#fff3c2", "bold");
    this.memoryDetailTitle = this.createText("", 24, "#fff3c2", "bold");
    this.memoryDetailBranch = this.createText("", 12, "#8de7ff", "bold");
    this.memoryDetail = this.createText("", 13, "#e3f3d6");
    this.memoryDetailStatus = this.createText("", 13, "#ffe889", "bold");
    this.memoryDetailIconGlow = this.add.circle(0, 0, 70, 0x8de7ff, 0.1).setStrokeStyle(2, 0x8de7ff, 0.45);
    this.memoryDetailIconFrame = this.add.image(0, 0, "memory-node-selected").setOrigin(0.5);
    this.memoryDetailIcon = this.add.image(0, 0, "eco-player").setOrigin(0.5);
    this.memoryRoot.add([
      this.memoryChrome,
      this.memoryTreeWorld,
      this.memoryTitle,
      this.memorySubtitle,
      this.memorySummary,
      this.memoryCurrencyText,
      this.memoryTreeTitle,
      this.memoryDetailIconGlow,
      this.memoryDetailIconFrame,
      this.memoryDetailIcon,
      this.memoryDetailTitle,
      this.memoryDetailBranch,
      this.memoryDetail,
      this.memoryDetailStatus,
    ]);

    this.drawMemoryTreeDecor();

    for (const definition of ECOSYSTEM_MEMORY_NODES) {
      const visualScale = definition.visualScale ?? 1;
      const frameSize = 88 * visualScale;
      const iconSize = 46 * visualScale;
      const titleY = frameSize / 2 + 10;
      const rankPipY = frameSize / 2 + 4;
      const container = this.add.container(definition.x, definition.y);
      const hitArea = this.add.rectangle(
        0,
        8,
        Math.max(104, 138 * visualScale),
        Math.max(118, 144 * visualScale),
        0xffffff,
        0.001,
      ).setInteractive({ useHandCursor: true });
      const glow = this.add.circle(0, 0, 56 * visualScale, definition.color, 0.08).setStrokeStyle(2, definition.color, 0.34);
      const frame = this.add.image(0, 0, "memory-node-locked").setOrigin(0.5).setDisplaySize(frameSize, frameSize);
      const icon = this.add.image(0, 0, definition.iconKey).setOrigin(0.5).setDisplaySize(iconSize, iconSize);
      icon.setData("baseScaleX", icon.scaleX).setData("baseScaleY", icon.scaleY);
      const titleFontSize = definition.kind === "helperRank" ? 11 : 14;
      const title = this.createText(definition.label, titleFontSize, "#fff3c2", "bold").setOrigin(0.5, 0).setPosition(0, titleY).setAlign("center");
      const status = this.createText("", 10, "#b8d9a4", "bold").setOrigin(0.5, 0).setPosition(0, titleY + 22).setAlign("center");
      const maxRank = this.getMemoryNodeMaxRank(definition);
      const rankPips = maxRank > 1 ? this.add.graphics() : null;
      if (rankPips) rankPips.setData("rank", -1);
      container.add([hitArea, glow, frame, icon, ...(rankPips ? [rankPips] : []), title, status]);
      this.memoryTreeWorld.add(container);
      this.memoryNodeViews.set(definition.id, {
        definition,
        container,
        hitArea,
        glow,
        frame,
        icon,
        title,
        status,
        rankPips,
        rankPipCount: maxRank,
        rankPipY,
      });

      hitArea.on("pointerover", () => this.previewMemoryNode(definition.id));
      hitArea.on("pointerout", () => this.stopPreviewingMemoryNode(definition.id));
      hitArea.on("pointerdown", () => {
        this.tweens.killTweensOf(icon);
        this.tweens.add({
          targets: icon,
          scaleX: Number(icon.getData("baseScaleX")) * 0.92,
          scaleY: Number(icon.getData("baseScaleY")) * 0.92,
          duration: 70,
        });
      });
      hitArea.on("pointerup", () => {
        this.tweens.killTweensOf(icon);
        this.tweens.add({
          targets: icon,
          scaleX: Number(icon.getData("baseScaleX")) * 1.14,
          scaleY: Number(icon.getData("baseScaleY")) * 1.14,
          duration: 120,
          yoyo: true,
          ease: "Back.easeOut",
        });
        if (!this.memoryTreeClickSuppressed) this.buyMemoryNode(definition.id);
      });
    }
    this.memoryZoomOutButton = this.createButton(this.memoryRoot, "-", () => this.adjustMemoryTreeZoom(1 / 1.35));
    this.memoryZoomResetButton = this.createButton(this.memoryRoot, "Fit", () => this.resetMemoryTreeView());
    this.memoryZoomInButton = this.createButton(this.memoryRoot, "+", () => this.adjustMemoryTreeZoom(1.35));
    this.memoryOptionsButton = this.createButton(this.memoryRoot, "Options", () => this.toggleOptions());
    this.beginNextRunButton = this.createButton(this.memoryRoot, "Begin Next Run", () => this.beginNextRun(), 0x397a3f);
  }

  private createOptionsView(): void {
    this.optionsChrome = this.add.graphics();
    this.optionsTitle = this.createText("Options", 30, "#fff3c2", "bold");
    this.optionsCopy = this.createText("The ecosystem is completely paused while this screen is open.", 14, "#dff6ca");
    this.optionsRoot.add([this.optionsChrome, this.optionsTitle, this.optionsCopy]);
    this.optionsResumeButton = this.createButton(this.optionsRoot, "Resume", () => this.toggleOptions(), 0x397a3f);
    this.optionsTitleButton = this.createButton(
      this.optionsRoot,
      "Save & Return to Title",
      () => this.returnToTitle(),
      0x234558,
    );
    this.optionsMusicButton = this.createButton(this.optionsRoot, "", () => this.cycleMusicVolume());
    this.optionsSfxButton = this.createButton(this.optionsRoot, "", () => this.cycleSfxVolume());
    this.optionsTitleButton.setVisible(this.returnToTitleAvailable);
  }

  private createDomBridge(): void {
    const actions: EcosystemDomActions = {
      touchCoordinates: (x, y) => this.touchCoordinates(x, y),
      buyHelper: (helperId) => this.buyHelperFromUi(helperId),
      switchMode: (helperId, modeId) => this.switchModeFromUi(helperId, modeId),
      buyCultivation: () => this.buyCultivation(),
      toggleWorks: () => this.toggleWorks(),
      toggleOptions: () => this.toggleOptions(),
      returnToTitle: () => this.returnToTitle(),
      beginNextRun: () => this.beginNextRun(),
      unlockHelper: (helperId) => this.buyMemoryNode(getHelperUnlockMemoryId(helperId)),
      unlockMode: (helperId) => this.buyMemoryNode(getHelperModeMemoryId(helperId)),
      buyRank: (helperId, kind) => this.buyMemoryNode(getHelperRankMemoryId(helperId, kind)),
      unlockFieldTier: () => this.buyMemoryNode("field:tier"),
      buyTouchRank: (kind) => this.buyMemoryNode(`touch:${kind}`),
      buyFieldEmbrace: () => this.buyMemoryNode("touch:fieldEmbrace"),
      addPrototypeCurrency: () => {
        this.permanent.grassTouches += 250;
        this.state.runTouches += 250;
        this.state.resources.growth.amount = this.state.resources.growth.capacity;
        this.persistAll();
        this.refreshMemoryTree();
      },
      forceGameOver: () => {
        forceGameOver(this.state, this.permanent);
        this.refreshUi(true);
      },
      setPrototypeField: (size) => {
        if (!this.state.active) {
          this.state = createNextEcosystemRun(this.permanent);
          this.firstSprinklerCycleCelebrated = false;
          this.lastGameOverState = false;
          this.syncViewVisibility();
        }
        setPrototypeFieldSize(this.state, this.permanent, size);
        this.resetTouchRecovery();
        this.layout(this.scale.width, this.scale.height);
        this.resetFieldView();
        this.persistAll();
      },
      unlockPrototype: () => {
        unlockAllPrototypeMemories(this.permanent);
        this.permanent.grassTouches += 500;
        this.state.runTouches += 50_000;
        for (const resourceId of PRODUCTION_RESOURCE_IDS) {
          this.state.resources[resourceId].amount = this.state.resources[resourceId].capacity * 0.72;
        }
        this.layout(this.scale.width, this.scale.height);
        this.refreshMemoryTree();
        this.persistAll();
      },
      resetPrototypeSave: () => this.resetPrototypeSave(),
    };
    this.domBridge = new EcosystemDomBridge(
      actions,
      this.playtest,
      this.showDebugPanel,
      this.returnToTitleAvailable,
    );
  }

  private bindInput(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.state.active || this.optionsOpen || !this.pointInMemoryTree(pointer.x, pointer.y)) return;
      this.audio.unlock();
      this.memoryTreeClickSuppressed = false;
      this.memoryTreeDragState = { pointerId: pointer.id, lastX: pointer.x, lastY: pointer.y, moved: false };
    });
    this.fieldSurface.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.state.active || this.worksOpen || this.optionsOpen) return;
      const startedAtMs = performance.now();
      const touchOnDown = shouldAttemptFieldTouchOnPointerDown(
        pointer.wasTouch,
        this.state.field.stages.length,
      );
      this.audio.unlock();
      this.fieldPointerDowns += 1;
      this.fieldPointerGestures.begin(
        pointer.id,
        pointer.wasTouch,
        pointer.x,
        pointer.y,
        startedAtMs,
        touchOnDown,
      );
      if (touchOnDown) this.touchScreenPoint(pointer.x, pointer.y, startedAtMs);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.memoryTreeDragState && pointer.id === this.memoryTreeDragState.pointerId && pointer.isDown) {
        const dx = pointer.x - this.memoryTreeDragState.lastX;
        const dy = pointer.y - this.memoryTreeDragState.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          this.memoryTreeDragState.moved = true;
          this.memoryTreeClickSuppressed = true;
        }
        if (this.memoryTreeDragState.moved) {
          this.memoryTreePanX += dx;
          this.memoryTreePanY += dy;
          this.applyMemoryTreeViewTransform();
        }
        this.memoryTreeDragState.lastX = pointer.x;
        this.memoryTreeDragState.lastY = pointer.y;
        return;
      }
      const gesture = this.fieldPointerGestures.get(pointer.id);
      if (!gesture || !pointer.isDown) return;
      if (updateFieldPointerGesture(gesture, pointer.x, pointer.y)) {
        this.fieldPointerDrags += 1;
      }
      if (gesture.moved && this.projection && this.state.field.stages.length > 1) {
        this.fieldView = panFieldViewport(
          this.fieldView,
          this.projection,
          gesture.deltaX,
          gesture.deltaY,
        );
        this.renderField(true);
      }
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (this.memoryTreeDragState && pointer.id === this.memoryTreeDragState.pointerId) {
        this.memoryTreeDragState = null;
        this.time.delayedCall(0, () => {
          this.memoryTreeClickSuppressed = false;
        });
        return;
      }
      const gesture = this.fieldPointerGestures.end(pointer.id);
      if (!gesture) return;
      if (!gesture.moved && !gesture.touchAttemptedOnDown) {
        this.touchScreenPoint(pointer.x, pointer.y, gesture.startedAtMs);
      }
    });
    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.state.active && !this.optionsOpen && this.pointInMemoryTree(pointer.x, pointer.y)) {
        this.adjustMemoryTreeZoom(deltaY > 0 ? 1 / 1.22 : 1.22, pointer.x, pointer.y);
        return;
      }
      if (!this.state.active || this.worksOpen || this.optionsOpen || this.state.field.stages.length === 1 || !this.pointInField(pointer.x, pointer.y)) return;
      const factor = deltaY > 0 ? 0.82 : 1.22;
      this.fieldView = zoomFieldAtPoint(this.fieldView, this.projection, pointer.x, pointer.y, factor);
      this.renderField(true);
    });
    this.input.keyboard?.on("keydown-PLUS", () => this.state.active ? this.adjustFieldZoom(1.28) : this.adjustMemoryTreeZoom(1.35));
    this.input.keyboard?.on("keydown-MINUS", () => this.state.active ? this.adjustFieldZoom(0.78) : this.adjustMemoryTreeZoom(1 / 1.35));
    this.input.keyboard?.on("keydown-ZERO", () => this.state.active ? this.resetFieldView() : this.resetMemoryTreeView());
    this.input.keyboard?.on("keydown-ESC", () => this.toggleOptions());
  }

  private layout(width: number, height: number): void {
    const mobile = width < 760;
    const ledgerUnlocked = isRunEquipmentAvailable(this.state)
      && this.permanent.unlockedHelpers.tinySprinkler;
    const contentWidth = mobile ? width - 16 : Math.min(MAX_SCENE_CONTENT_WIDTH, width - 44);
    const contentX = (width - contentWidth) / 2;
    const backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setDisplaySize(this.background.width * backgroundScale, this.background.height * backgroundScale);
    this.background.setPosition((width - this.background.displayWidth) / 2, (height - this.background.displayHeight) / 2);

    this.fieldChrome.clear();
    const header = { x: contentX, y: mobile ? 8 : 16, width: contentWidth, height: mobile ? 94 : 102 };
    this.drawPanel(this.fieldChrome, header.x, header.y, header.width, header.height, 0.94);
    if (mobile) {
      this.titleText.setText("Ancient Grass: Ecosystem").setFontSize(19).setPosition(header.x + 14, header.y + 8);
      this.runText.setFontSize(11).setPosition(header.x + 15, header.y + 36);
      this.hpBarBack.setPosition(header.x + 14, header.y + 64).setSize(header.width - 150, 18);
      this.hpBarFill.setPosition(header.x + 17, header.y + 64).setSize(header.width - 156, 12);
      this.hpBarHeartbeatGlow.setPosition(header.x + 17, header.y + 64).setSize(header.width - 156, 12);
      this.hpText.setFontSize(12).setPosition(header.x + 18, header.y + 52);
      this.pressureText.setFontSize(10).setPosition(header.x + 18, header.y + 78);
      this.currencyText.setFontSize(11).setOrigin(1, 0).setPosition(header.x + header.width - 12, header.y + 53);
      this.optionsButton.setPosition(header.x + header.width - 90, header.y + 8);
      this.optionsButton.setSize(78, 28);
    } else {
      this.titleText.setText("Ancient Grass: Ecosystem").setFontSize(30).setPosition(header.x + 22, header.y + 11);
      this.runText.setFontSize(13).setPosition(header.x + 24, header.y + 58);
      const barX = header.x + Math.min(420, header.width * 0.34);
      const barWidth = Math.min(880, Math.max(320, header.width - (barX - header.x) - 254));
      this.hpBarBack.setPosition(barX, header.y + 39).setSize(barWidth, 24);
      this.hpBarFill.setPosition(barX + 3, header.y + 39).setSize(barWidth - 6, 18);
      this.hpBarHeartbeatGlow.setPosition(barX + 3, header.y + 39).setSize(barWidth - 6, 18);
      this.hpText.setFontSize(15).setPosition(barX + 9, header.y + 25);
      this.pressureText.setFontSize(13).setPosition(barX + 9, header.y + 65);
      this.currencyText.setFontSize(15).setOrigin(1, 0).setPosition(header.x + header.width - 116, header.y + 59);
      this.optionsButton.setPosition(header.x + header.width - 104, header.y + 14);
      this.optionsButton.setSize(86, 36);
    }
    this.animateHealthBar(this.time.now, 0);

    let ledgerX = 0;
    let ledgerY = 0;
    let ledgerWidth = 0;
    let ledgerHeight = 0;
    let caretakerX = 0;
    let caretakerWidth = 0;
    let balanceX = 0;
    let balanceWidth = 0;
    this.openingPanelsVisible = !mobile && !ledgerUnlocked && width >= 1100;
    if (mobile) {
      const fieldY = header.y + header.height + 8;
      const fieldHeight = ledgerUnlocked ? Math.min(350, Math.max(250, height * 0.43)) : height - fieldY - 10;
      this.fieldBounds = { x: 12, y: fieldY, width: width - 24, height: fieldHeight };
      if (ledgerUnlocked) {
        ledgerX = 12;
        ledgerY = this.fieldBounds.y + this.fieldBounds.height + 8;
        ledgerWidth = width - 24;
        ledgerHeight = Math.max(190, height - ledgerY - 10);
      }
    } else {
      ledgerY = header.y + header.height + 12;
      ledgerHeight = height - ledgerY - 20;
      if (ledgerUnlocked) {
        ledgerX = contentX;
        ledgerWidth = Math.min(314, Math.max(284, contentWidth * 0.24));
        this.fieldBounds = {
          x: ledgerX + ledgerWidth + 14,
          y: ledgerY,
          width: contentWidth - ledgerWidth - 14,
          height: ledgerHeight,
        };
      } else if (this.openingPanelsVisible) {
        const gap = 14;
        caretakerWidth = Phaser.Math.Clamp(contentWidth * 0.19, 240, 310);
        balanceWidth = caretakerWidth;
        caretakerX = contentX;
        this.fieldBounds = {
          x: caretakerX + caretakerWidth + gap,
          y: ledgerY,
          width: contentWidth - caretakerWidth - balanceWidth - gap * 2,
          height: ledgerHeight,
        };
        balanceX = this.fieldBounds.x + this.fieldBounds.width + gap;
      } else {
        const fieldWidth = Math.min(contentWidth, 900);
        this.fieldBounds = {
          x: contentX + (contentWidth - fieldWidth) / 2,
          y: ledgerY,
          width: fieldWidth,
          height: ledgerHeight,
        };
      }
    }
    this.drawPanel(this.fieldChrome, this.fieldBounds.x, this.fieldBounds.y, this.fieldBounds.width, this.fieldBounds.height, 0.84);
    if (ledgerUnlocked) this.drawPanel(this.fieldChrome, ledgerX, ledgerY, ledgerWidth, ledgerHeight, 0.94);
    if (this.openingPanelsVisible) {
      this.drawPanel(this.fieldChrome, caretakerX, ledgerY, caretakerWidth, ledgerHeight, 0.94);
      this.drawPanel(this.fieldChrome, balanceX, ledgerY, balanceWidth, ledgerHeight, 0.94);
      this.fieldChrome.lineStyle(2, 0xd8b66a, 0.38);
      this.fieldChrome.lineBetween(caretakerX + 18, ledgerY + 58, caretakerX + caretakerWidth - 18, ledgerY + 58);
      this.fieldChrome.lineBetween(balanceX + 18, ledgerY + 58, balanceX + balanceWidth - 18, ledgerY + 58);
    }

    this.fieldMaskShape.clear().fillStyle(0xffffff, 1).fillRect(
      this.fieldBounds.x + 6,
      this.fieldBounds.y + 42,
      this.fieldBounds.width - 12,
      this.fieldBounds.height - 48,
    );
    const fieldSurfaceWidth = this.fieldBounds.width - 12;
    const fieldSurfaceHeight = this.fieldBounds.height - 48;
    this.fieldSurface
      .setPosition(this.fieldBounds.x + 6, this.fieldBounds.y + 42)
      .setSize(fieldSurfaceWidth, fieldSurfaceHeight);
    resizeFieldInputHitArea(this.fieldSurface.input?.hitArea, fieldSurfaceWidth, fieldSurfaceHeight);
    this.fieldLabelText.setFontSize(mobile ? 12 : 16).setPosition(this.fieldBounds.x + 16, this.fieldBounds.y + (mobile ? 13 : 10));
    const fieldCanZoom = this.state.field.width > 1 || this.state.field.height > 1;
    this.fieldHintText.setVisible(!mobile && fieldCanZoom).setOrigin(1, 0).setPosition(this.fieldBounds.x + this.fieldBounds.width - 150, this.fieldBounds.y + 15);
    this.zoomOutButton.setVisible(fieldCanZoom).setPosition(this.fieldBounds.x + this.fieldBounds.width - 138, this.fieldBounds.y + 8).setSize(36, 28);
    this.zoomResetButton.setVisible(fieldCanZoom).setPosition(this.fieldBounds.x + this.fieldBounds.width - 98, this.fieldBounds.y + 8).setSize(52, 28);
    this.zoomInButton.setVisible(fieldCanZoom).setPosition(this.fieldBounds.x + this.fieldBounds.width - 42, this.fieldBounds.y + 8).setSize(34, 28);
    this.touchSummaryText.setOrigin(0.5).setPosition(this.fieldBounds.x + this.fieldBounds.width / 2, this.fieldBounds.y + 52);

    const openingObjects = [
      this.playerPortrait,
      this.caretakerTitle,
      this.caretakerRole,
      this.caretakerStats,
      this.balanceTitle,
      this.balanceStatus,
      this.balanceDetail,
      this.balanceBarBack,
      this.balanceBarFill,
      this.balanceGoalMarker,
      this.scourgeHalo,
      this.scourgeCore,
    ];
    for (const object of openingObjects) object.setVisible(this.openingPanelsVisible);
    if (this.openingPanelsVisible) {
      const portraitSize = Math.min(118, caretakerWidth - 72);
      this.caretakerTitle.setFontSize(20).setPosition(caretakerX + 18, ledgerY + 18);
      this.playerPortrait
        .setPosition(caretakerX + caretakerWidth / 2, ledgerY + 124)
        .setDisplaySize(portraitSize, portraitSize)
        .setData("baseY", ledgerY + 124);
      this.caretakerRole.setOrigin(0.5, 0).setPosition(caretakerX + caretakerWidth / 2, ledgerY + 190);
      this.caretakerStats.setPosition(caretakerX + 20, ledgerY + 230).setWordWrapWidth(caretakerWidth - 40);

      this.balanceTitle.setFontSize(20).setPosition(balanceX + 18, ledgerY + 18);
      this.scourgeHalo.setPosition(balanceX + balanceWidth / 2, ledgerY + 120);
      this.scourgeCore.setPosition(balanceX + balanceWidth / 2, ledgerY + 120);
      this.balanceStatus.setOrigin(0.5, 0).setPosition(balanceX + balanceWidth / 2, ledgerY + 176);
      const careBarWidth = balanceWidth - 42;
      this.balanceBarBack.setPosition(balanceX + 21, ledgerY + 224).setSize(careBarWidth, 20);
      this.balanceBarFill.setPosition(balanceX + 24, ledgerY + 224).setSize(careBarWidth - 6, 14);
      this.balanceGoalMarker.setPosition(balanceX + balanceWidth - 24, ledgerY + 224).setSize(3, 26);
      this.balanceDetail.setPosition(balanceX + 21, ledgerY + 254).setWordWrapWidth(balanceWidth - 42);
    }

    this.ledgerTitle.setVisible(ledgerUnlocked);
    this.ledgerStocksLeft.setVisible(ledgerUnlocked);
    this.ledgerStocksRight.setVisible(ledgerUnlocked);
    this.bottleneckText.setVisible(ledgerUnlocked);
    this.automationGoalText.setVisible(ledgerUnlocked);
    this.automationGoalBack.setVisible(ledgerUnlocked);
    this.automationGoalFill.setVisible(ledgerUnlocked);
    this.worksButton.setVisible(ledgerUnlocked);
    this.cultivationButton.setVisible(ledgerUnlocked);
    if (ledgerUnlocked) {
      this.ledgerTitle.setFontSize(mobile ? 18 : 22).setPosition(ledgerX + 16, ledgerY + 12);
      this.bottleneckText.setPosition(ledgerX + 16, ledgerY + 42).setWordWrapWidth(ledgerWidth - 32);
      this.automationGoalText.setFontSize(mobile ? 9 : 10).setPosition(ledgerX + 16, ledgerY + 68).setWordWrapWidth(ledgerWidth - 32);
      this.automationGoalBack.setPosition(ledgerX + 16, ledgerY + 92).setSize(ledgerWidth - 32, 9);
      this.automationGoalFill.setPosition(ledgerX + 18, ledgerY + 92).setSize(ledgerWidth - 36, 5);
      const stockY = ledgerY + (mobile ? 106 : 110);
      this.ledgerStocksLeft.setPosition(ledgerX + 16, stockY);
      this.ledgerStocksRight.setPosition(ledgerX + ledgerWidth * 0.52, stockY);
      const unlockedHelpers = HELPER_IDS.filter((helperId) => this.permanent.unlockedHelpers[helperId]);
      const helperStartY = stockY + (mobile ? 96 : 112);
      const footerHeight = 82;
      const availableRows = Math.max(22, ledgerHeight - (helperStartY - ledgerY) - footerHeight);
      const rowHeight = Math.min(mobile ? 28 : 34, availableRows / Math.max(1, unlockedHelpers.length));
      for (const helperId of HELPER_IDS) {
        const unlockedIndex = unlockedHelpers.indexOf(helperId);
        const visible = unlockedIndex >= 0;
        this.helperIcons[helperId].setVisible(visible);
        this.helperBuyButtons[helperId].setVisible(visible);
        if (visible) {
          const rowY = helperStartY + unlockedIndex * rowHeight;
          this.helperIcons[helperId].setPosition(ledgerX + 28, rowY + rowHeight / 2).setDisplaySize(rowHeight - 5, rowHeight - 5);
          this.helperBuyButtons[helperId].setPosition(ledgerX + 48, rowY + 1).setSize(ledgerWidth - 62, rowHeight - 3);
          this.helperBuyButtons[helperId].label.setFontSize(mobile ? 10 : 11);
        }
      }
      this.worksButton.setPosition(ledgerX + 14, ledgerY + ledgerHeight - 72).setSize(ledgerWidth - 28, 32);
      this.cultivationButton.setPosition(ledgerX + 14, ledgerY + ledgerHeight - 36).setSize(ledgerWidth - 28, 28);
    } else {
      for (const helperId of HELPER_IDS) {
        this.helperIcons[helperId].setVisible(false);
        this.helperBuyButtons[helperId].setVisible(false);
      }
    }

    this.layoutFactory(width, height, mobile);
    this.layoutMemory(width, height, mobile);
    this.layoutOptions(width, height, mobile);
  }

  private layoutFactory(width: number, height: number, mobile: boolean): void {
    this.factoryChrome.clear();
    this.factoryChrome.fillStyle(0x06190f, 0.985).fillRect(0, 0, width, height);
    this.factoryChrome.lineStyle(3, 0xd8b66a, 0.9).strokeRect(8, 8, width - 16, height - 16);
    this.factoryTitle.setFontSize(mobile ? 25 : 34).setPosition(mobile ? 18 : 32, mobile ? 14 : 20);
    this.factorySubtitle.setFontSize(mobile ? 10 : 13).setPosition(mobile ? 18 : 34, mobile ? 48 : 60).setWordWrapWidth(width - 180);
    this.factoryCloseButton.setPosition(width - (mobile ? 110 : 174), mobile ? 14 : 24).setSize(mobile ? 94 : 150, mobile ? 30 : 36);
    const points = new Map<ProductionResourceId, { x: number; y: number; width: number; height: number }>();
    if (mobile) {
      const nodeWidth = (width - 44) / 2;
      const nodeHeight = Math.max(38, Math.min(49, (height * 0.46) / 6 - 4));
      for (let index = 0; index < PRODUCTION_RESOURCE_IDS.length; index += 1) {
        const row = Math.floor(index / 2);
        const forward = row % 2 === 0;
        const column = index % 2;
        const xColumn = forward ? column : 1 - column;
        points.set(PRODUCTION_RESOURCE_IDS[index], { x: 16 + xColumn * (nodeWidth + 12), y: 78 + row * (nodeHeight + 6), width: nodeWidth, height: nodeHeight });
      }
    } else {
      const nodeWidth = Math.min(172, (width - 96) / 6 - 10);
      const nodeHeight = 66;
      for (let index = 0; index < PRODUCTION_RESOURCE_IDS.length; index += 1) {
        const top = index < 6;
        const position = top ? index : 10 - index;
        points.set(PRODUCTION_RESOURCE_IDS[index], {
          x: 34 + position * (nodeWidth + 10),
          y: top ? 98 : 182,
          width: nodeWidth,
          height: nodeHeight,
        });
      }
    }
    this.factoryChrome.lineStyle(mobile ? 2 : 3, 0xd8b66a, 0.52);
    for (let index = 0; index < PRODUCTION_RESOURCE_IDS.length - 1; index += 1) {
      const from = points.get(PRODUCTION_RESOURCE_IDS[index])!;
      const to = points.get(PRODUCTION_RESOURCE_IDS[index + 1])!;
      this.factoryChrome.lineBetween(from.x + from.width / 2, from.y + from.height / 2, to.x + to.width / 2, to.y + to.height / 2);
    }
    for (const resourceId of PRODUCTION_RESOURCE_IDS) {
      const point = points.get(resourceId)!;
      this.factoryResourceBacks[resourceId].setPosition(point.x, point.y).setSize(point.width, point.height);
      this.factoryResourceTexts[resourceId].setFontSize(mobile ? 9 : 11).setPosition(point.x + point.width / 2, point.y + point.height / 2).setWordWrapWidth(point.width - 8);
    }
    const graphBottom = Math.max(...[...points.values()].map((point) => point.y + point.height));
    const helperTop = mobile ? Math.min(height - 292, graphBottom + 38) : 282;
    this.factoryBottleneck.setPosition(mobile ? 16 : 34, helperTop - 26).setWordWrapWidth(width - 40);
    const helperColumns = mobile ? 2 : 4;
    const helperGap = mobile ? 7 : 12;
    const helperWidth = (width - (mobile ? 32 : 68) - helperGap * (helperColumns - 1)) / helperColumns;
    const helperHeight = mobile ? 59 : 72;
    for (let index = 0; index < HELPER_IDS.length; index += 1) {
      const helperId = HELPER_IDS[index];
      const column = index % helperColumns;
      const row = Math.floor(index / helperColumns);
      const x = (mobile ? 16 : 34) + column * (helperWidth + helperGap);
      const y = helperTop + row * (helperHeight + 8);
      this.factoryHelperButtons[helperId].setPosition(x, y).setSize(helperWidth, mobile ? 30 : 36);
      this.factoryModeButtons[helperId].setPosition(x, y + (mobile ? 32 : 39)).setSize(helperWidth, mobile ? 25 : 29);
      this.factoryHelperButtons[helperId].label.setFontSize(mobile ? 9 : 11);
      this.factoryModeButtons[helperId].label.setFontSize(mobile ? 9 : 10);
    }
  }

  private layoutMemory(width: number, height: number, mobile: boolean): void {
    this.memoryChrome.clear();
    this.memoryChrome.fillStyle(0x04130c, 0.975).fillRect(0, 0, width, height);
    this.memoryChrome.lineStyle(3, 0xd8b66a, 0.92).strokeRect(8, 8, width - 16, height - 16);
    this.memoryChrome.lineStyle(1, 0x77a65d, 0.28).strokeRect(14, 14, width - 28, height - 28);
    const contentWidth = mobile ? width - 16 : Math.min(1760, width - 32);
    const contentX = (width - contentWidth) / 2;
    this.memoryTitle.setFontSize(mobile ? 25 : 38).setOrigin(0.5, 0).setPosition(width / 2, mobile ? 12 : 16);
    this.memorySubtitle
      .setFontSize(mobile ? 10 : 13)
      .setOrigin(0.5, 0)
      .setPosition(width / 2, mobile ? 45 : 60)
      .setWordWrapWidth(mobile ? width - 126 : width - 360)
      .setAlign("center");
    this.memoryCurrencyText.setFontSize(mobile ? 11 : 15).setOrigin(0, 0).setPosition(contentX + 16, mobile ? 58 : 38);
    this.memoryOptionsButton
      .setPosition(contentX + contentWidth - (mobile ? 88 : 104), mobile ? 16 : 24)
      .setSize(mobile ? 78 : 88, mobile ? 28 : 34);

    let treePanelX: number;
    let treePanelY: number;
    let treePanelWidth: number;
    let treePanelHeight: number;
    let detailX: number;
    let detailY: number;
    let detailWidth: number;
    let detailHeight: number;
    if (mobile) {
      treePanelX = 10;
      treePanelY = 82;
      treePanelWidth = width - 20;
      treePanelHeight = Math.min(450, Math.max(330, height * 0.52));
      detailX = 10;
      detailY = treePanelY + treePanelHeight + 8;
      detailWidth = width - 20;
      detailHeight = Math.max(170, height - detailY - 76);
      this.drawPanel(this.memoryChrome, treePanelX, treePanelY, treePanelWidth, treePanelHeight, 0.82);
      this.drawPanel(this.memoryChrome, detailX, detailY, detailWidth, detailHeight, 0.9);
      this.memorySummary.setVisible(false);
    } else {
      const mainY = 94;
      const mainHeight = height - mainY - 86;
      const gap = 14;
      const summaryWidth = Phaser.Math.Clamp(contentWidth * 0.19, 230, 286);
      detailWidth = Phaser.Math.Clamp(contentWidth * 0.21, 270, 324);
      treePanelX = contentX + summaryWidth + gap;
      treePanelY = mainY;
      treePanelWidth = contentWidth - summaryWidth - detailWidth - gap * 2;
      treePanelHeight = mainHeight;
      detailX = treePanelX + treePanelWidth + gap;
      detailY = mainY;
      detailHeight = mainHeight;
      this.drawPanel(this.memoryChrome, contentX, mainY, summaryWidth, mainHeight, 0.9);
      this.drawPanel(this.memoryChrome, treePanelX, treePanelY, treePanelWidth, treePanelHeight, 0.78);
      this.drawPanel(this.memoryChrome, detailX, detailY, detailWidth, detailHeight, 0.9);
      this.memorySummary
        .setVisible(true)
        .setFontSize(12)
        .setPosition(contentX + 18, mainY + 20)
        .setWordWrapWidth(summaryWidth - 36);
    }

    this.memoryTreeTitle
      .setFontSize(mobile ? 16 : 21)
      .setPosition(treePanelX + 18, treePanelY + (mobile ? 13 : 16));
    const zoomY = treePanelY + (mobile ? 9 : 13);
    const zoomInX = treePanelX + treePanelWidth - 40;
    const zoomResetX = zoomInX - (mobile ? 48 : 58);
    const zoomOutX = zoomResetX - (mobile ? 36 : 42);
    this.memoryZoomOutButton.setPosition(zoomOutX, zoomY).setSize(mobile ? 30 : 34, mobile ? 26 : 30);
    this.memoryZoomResetButton.setPosition(zoomResetX, zoomY).setSize(mobile ? 44 : 52, mobile ? 26 : 30);
    this.memoryZoomInButton.setPosition(zoomInX, zoomY).setSize(mobile ? 30 : 34, mobile ? 26 : 30);
    this.memoryTreeViewport = {
      x: treePanelX + 10,
      y: treePanelY + (mobile ? 48 : 58),
      width: treePanelWidth - 20,
      height: treePanelHeight - (mobile ? 58 : 70),
    };
    this.memoryTreeMaskShape.clear().fillStyle(0xffffff, 1).fillRect(
      this.memoryTreeViewport.x,
      this.memoryTreeViewport.y,
      this.memoryTreeViewport.width,
      this.memoryTreeViewport.height,
    );
    this.memoryTreeFitScale = Math.min(
      this.memoryTreeViewport.width / ECOSYSTEM_MEMORY_WORLD_WIDTH,
      this.memoryTreeViewport.height / ECOSYSTEM_MEMORY_WORLD_HEIGHT,
    ) * 0.94;

    if (mobile) {
      const iconX = detailX + 58;
      const iconY = detailY + 58;
      this.memoryDetailIconGlow.setPosition(iconX, iconY).setRadius(43);
      this.memoryDetailIconFrame.setPosition(iconX, iconY).setDisplaySize(76, 76);
      this.memoryDetailIcon.setPosition(iconX, iconY).setDisplaySize(40, 40);
      this.memoryDetailTitle.setFontSize(18).setPosition(detailX + 108, detailY + 18).setWordWrapWidth(detailWidth - 122);
      this.memoryDetailBranch.setPosition(detailX + 108, detailY + 48).setWordWrapWidth(detailWidth - 122);
      this.memoryDetail.setFontSize(10).setPosition(detailX + 108, detailY + 72).setWordWrapWidth(detailWidth - 122);
      this.memoryDetailStatus.setFontSize(10).setPosition(detailX + 18, detailY + detailHeight - 42).setWordWrapWidth(detailWidth - 36);
    } else {
      const iconX = detailX + detailWidth / 2;
      const iconY = detailY + 112;
      this.memoryDetailIconGlow.setPosition(iconX, iconY).setRadius(66);
      this.memoryDetailIconFrame.setPosition(iconX, iconY).setDisplaySize(112, 112);
      this.memoryDetailIcon.setPosition(iconX, iconY).setDisplaySize(58, 58);
      this.memoryDetailTitle.setFontSize(23).setPosition(detailX + 20, detailY + 194).setWordWrapWidth(detailWidth - 40);
      this.memoryDetailBranch.setPosition(detailX + 20, detailY + 230).setWordWrapWidth(detailWidth - 40);
      this.memoryDetail.setFontSize(12).setPosition(detailX + 20, detailY + 268).setWordWrapWidth(detailWidth - 40);
      this.memoryDetailStatus.setFontSize(12).setPosition(detailX + 20, detailY + detailHeight - 76).setWordWrapWidth(detailWidth - 40);
    }
    this.memoryDetailIcon
      .setData("baseScaleX", this.memoryDetailIcon.scaleX)
      .setData("baseScaleY", this.memoryDetailIcon.scaleY);

    this.beginNextRunButton
      .setPosition(width / 2 - (mobile ? 176 : 150), height - (mobile ? 64 : 70))
      .setSize(mobile ? 352 : 300, mobile ? 50 : 52);
    this.applyMemoryTreeViewTransform();
  }

  private layoutOptions(width: number, height: number, mobile: boolean): void {
    this.optionsChrome.clear();
    this.optionsChrome.fillStyle(0x020805, 0.76).fillRect(0, 0, width, height);
    const panelWidth = Math.min(mobile ? width - 32 : 520, width - 24);
    const panelHeight = this.returnToTitleAvailable ? (mobile ? 370 : 390) : (mobile ? 310 : 330);
    const x = (width - panelWidth) / 2;
    const y = (height - panelHeight) / 2;
    this.drawPanel(this.optionsChrome, x, y, panelWidth, panelHeight, 0.98);
    this.optionsTitle.setOrigin(0.5, 0).setPosition(width / 2, y + 24);
    this.optionsCopy.setOrigin(0.5, 0).setPosition(width / 2, y + 74).setWordWrapWidth(panelWidth - 60).setAlign("center");
    this.optionsMusicButton.setPosition(x + 34, y + 126).setSize(panelWidth - 68, 40);
    this.optionsSfxButton.setPosition(x + 34, y + 174).setSize(panelWidth - 68, 40);
    this.optionsTitleButton
      .setVisible(this.returnToTitleAvailable)
      .setPosition(x + 34, y + 222)
      .setSize(panelWidth - 68, 40);
    this.optionsResumeButton.setPosition(x + 34, y + panelHeight - 68).setSize(panelWidth - 68, 44);
  }

  private refreshUi(force: boolean): void {
    this.uiRefreshRequested = false;
    const readout = getEcosystemReadout(this.state);
    const equipmentAvailable = isRunEquipmentAvailable(this.state);
    if (this.state.active && !this.worksOpen) {
      const awaitingFirstTouch = this.state.runNumber === 1 && this.state.manualTouchCount === 0;
      const elapsedSeconds = Math.floor(readout.elapsedMs / 1_000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      this.setTextIfChanged(this.runText, awaitingFirstTouch
        ? "Run 1  |  Awaiting your first touch"
        : `Run ${this.state.runNumber}  |  ${elapsedMinutes}:${`${elapsedSeconds % 60}`.padStart(2, "0")}  |  Field active`);
      const hpRatio = Phaser.Math.Clamp(readout.hpRatio, 0, 1);
      const hpColor = hpRatio > 0.55 ? 0x83d765 : hpRatio > 0.25 ? 0xf0c85b : 0xe8616a;
      if (this.hpBarFill.fillColor !== hpColor) {
        this.hpBarFill.setFillStyle(hpColor, 1);
        this.hpBarHeartbeatGlow.setFillStyle(hpColor, 1);
      }
      this.setTextIfChanged(this.hpText, `Ancient HP ${readout.hp.toFixed(1)} / ${readout.maxHp.toFixed(0)}`);
      this.setTextIfChanged(this.pressureText, awaitingFirstTouch
        ? "Scourge dormant  |  Touch the grass to begin"
        : `Scourge ${readout.scourgeDemandPerSecond.toFixed(2)} Care/s  |  produced ${readout.careProductionPerSecond.toFixed(2)}/s`);
      this.setTextIfChanged(this.currencyText, `RT ${readout.runTouches.toFixed(0)}   GT ${this.permanent.grassTouches.toFixed(0)}`);
      this.setTextIfChanged(this.fieldLabelText, this.scale.width < 760
        ? `${readout.fieldSize}x${readout.fieldSize} | Cultivation ${readout.cultivationRank}/10`
        : `${readout.fieldSize}x${readout.fieldSize} Living Field  |  Cultivation ${readout.cultivationRank}/10`);
      this.setTextIfChanged(this.fieldHintText, `${this.projection?.lod ?? "near"} view  |  wheel / +/- to zoom`);
      this.setTextIfChanged(this.bottleneckText, `Bottleneck: ${readout.bottleneck}`);
      const palmRadius = this.permanent.broadPalmRank > 0 ? 1 + Math.floor((this.permanent.broadPalmRank - 1) / 2) : 0;
      this.setTextIfChanged(this.caretakerStats, [
        `Touch yield     ${this.state.runNumber === 1 ? "0 Care (overwhelmed)" : "5.2 Care"}`,
        "Dew gathered    1.15",
        "Run Touches     +0.92",
        "",
        `Fast Touch      ${getManualTouchCooldownMs(this.permanent.fastTouchRank)} ms recovery`,
        `Broad Palm      ${palmRadius > 0 ? `radius ${palmRadius}` : "single plot"}`,
        `Many Hands      ${this.permanent.manyHandsRank * 2} echoes`,
        `Touches made    ${this.state.manualTouchCount}`,
      ].join("\n"));
      const careRatio = readout.scourgeDemandPerSecond <= 0
        ? 1
        : readout.careProductionPerSecond / readout.scourgeDemandPerSecond;
      const careBarWidth = Math.max(1, this.balanceBarBack.width - 6);
      const careDisplayWidth = Math.max(1, careBarWidth * Math.min(1, careRatio));
      if (Math.abs(this.balanceBarFill.displayWidth - careDisplayWidth) > 0.1) {
        this.balanceBarFill.setDisplaySize(careDisplayWidth, this.balanceBarFill.height);
      }
      const careColor = careRatio >= 1 ? 0x83d765 : careRatio >= 0.55 ? 0xf0c85b : 0xe8616a;
      if (this.balanceBarFill.fillColor !== careColor) this.balanceBarFill.setFillStyle(careColor, 1);
      const balanceStatus = awaitingFirstTouch
        ? "TOUCH TO BEGIN"
        : careRatio >= 1
          ? "CARE HOLDS"
          : careRatio >= 0.55
            ? "PRESSURE RISING"
            : "SCOURGE ADVANCES";
      if (this.balanceStatus.text !== balanceStatus) {
        this.balanceStatus
          .setText(balanceStatus)
          .setColor(awaitingFirstTouch ? "#fff3c2" : careRatio >= 1 ? "#9be27c" : careRatio >= 0.55 ? "#ffe889" : "#f1a6ce");
      }
      this.setTextIfChanged(this.balanceDetail, [
        `Demand         ${readout.scourgeDemandPerSecond.toFixed(2)} Care/s`,
        `Production     ${readout.careProductionPerSecond.toFixed(2)} Care/s`,
        `Deficit        ${Math.max(0, readout.scourgeDemandPerSecond - readout.careProductionPerSecond).toFixed(2)} Care/s`,
        "",
        `Ancient HP     ${readout.hp.toFixed(1)} / ${readout.maxHp.toFixed(0)}`,
        `Field stage    ${TILE_STAGE_LABELS[this.state.field.stages[0] as TileStage]}`,
      ].join("\n"));
      const firstStage = this.state.field.stages[0] as TileStage;
      this.setTextIfChanged(this.plotStageText, TILE_STAGE_LABELS[firstStage].toUpperCase());
      this.setTextIfChanged(this.plotDetailText, `Stage ${firstStage + 1} / ${TILE_TEXTURE_KEYS.length}   |   ${this.state.manualTouchCount} touches`);
      if (awaitingFirstTouch) {
        this.touchSummaryText
          .setText("TOUCH THE GRASS TO BEGIN")
          .setY(this.fieldBounds.y + 39)
          .setAlpha(1);
      }

      const firstAutomation = getFirstAutomationStatus(this.state, this.permanent);
      const fieldMouse = getFieldMouseStatus(this.state, this.permanent);
      const beeHive = getBeeHiveStatus(this.state, this.permanent);
      const showBeeHiveChapter = beeHive.stage !== "locked"
        && (this.state.helpers.beeHive.count > 0 || fieldMouse.cyclesCompleted >= 1);
      const showFieldMouseChapter = !showBeeHiveChapter
        && fieldMouse.stage !== "locked"
        && firstAutomation.stage === "sustain";
      this.automationGoalReadyForPurchase = showBeeHiveChapter
        ? beeHive.stage === "ready"
        : showFieldMouseChapter
          ? fieldMouse.stage === "ready"
          : this.state.helpers.tinySprinkler.count === 0 && this.state.runTouches >= firstAutomation.purchaseCost;
      let automationProgress = 0;
      let automationColor: number;
      let automationCopy: string;
      if (showBeeHiveChapter) {
        switch (beeHive.stage) {
          case "ready":
            automationProgress = 1;
            automationColor = 0xffe889;
            automationCopy = `BEE HIVE READY  |  Establish it for ${beeHive.purchaseCost} RT`;
            break;
          case "firstFlight":
            automationProgress = beeHive.cycleProgress;
            automationColor = HELPER_EFFECT_COLOR.beeHive;
            automationCopy = `FIRST POLLINATION  |  ${BEE_HIVE_STARTER_FLOWERS} Flowers opened - follow the bee`;
            break;
          case "working":
            automationProgress = beeHive.cycleProgress;
            automationColor = HELPER_EFFECT_COLOR.beeHive;
            automationCopy = `BLOOMS ACTIVE  |  ${beeHive.flowerAmount.toFixed(1)} Flowers  |  ${beeHive.pollinatedBloomAmount.toFixed(1)} Pollinated`;
            break;
          case "starved":
            automationColor = 0xe8616a;
            automationCopy = "HIVE SEARCHING  |  Flower stores empty - cultivate more Growth";
            break;
          case "blocked":
            automationColor = 0xe8616a;
            automationCopy = `HIVE WAITING  |  ${beeHive.pauseReason ?? "Check its buffers"}`;
            break;
          default:
            automationProgress = beeHive.purchaseProgress;
            automationColor = HELPER_EFFECT_COLOR.beeHive;
            automationCopy = `BEE HIVE  |  Gather RT ${Math.floor(this.state.runTouches)} / ${beeHive.purchaseCost}`;
        }
      } else if (showFieldMouseChapter) {
        switch (fieldMouse.stage) {
          case "ready":
            automationProgress = 1;
            automationColor = 0xffe889;
            automationCopy = `FIELD MOUSE READY  |  Invite it for ${fieldMouse.purchaseCost} RT`;
            break;
          case "firstTrip":
            automationProgress = fieldMouse.cycleProgress;
            automationColor = HELPER_EFFECT_COLOR.fieldMouse;
            automationCopy = `STARTER CACHE  |  ${FIELD_MOUSE_STARTER_SEEDS} Seeds found - watch the first planting`;
            break;
          case "working":
            automationProgress = fieldMouse.cycleProgress;
            automationColor = HELPER_EFFECT_COLOR.fieldMouse;
            automationCopy = `SEED RUN ACTIVE  |  ${fieldMouse.seedAmount.toFixed(1)} Seeds  |  ${fieldMouse.growthAmount.toFixed(1)} Growth`;
            break;
          case "starved":
            automationColor = 0xe8616a;
            automationCopy = "MOUSE SEARCHING  |  Seed cache empty - keep the ecosystem growing";
            break;
          case "blocked":
            automationColor = 0xe8616a;
            automationCopy = `MOUSE WAITING  |  ${fieldMouse.pauseReason ?? "Check its buffers"}`;
            break;
          default:
            automationProgress = fieldMouse.purchaseProgress;
            automationColor = HELPER_EFFECT_COLOR.fieldMouse;
            automationCopy = `FIELD MOUSE  |  Gather RT ${Math.floor(this.state.runTouches)} / ${fieldMouse.purchaseCost}`;
        }
      } else {
        switch (firstAutomation.stage) {
          case "ready":
            automationProgress = 1;
            automationColor = 0xffe889;
            automationCopy = `FIRST AUTOMATION READY  |  Buy Tiny Sprinkler for ${firstAutomation.purchaseCost} RT`;
            break;
          case "firstCycle":
            automationProgress = firstAutomation.cycleProgress;
            automationColor = 0x8de7ff;
            automationCopy = "FIRST SPRAY  |  Watch Dew become Moisture + Care";
            break;
          case "sustain":
            automationProgress = firstAutomation.cycleProgress;
            automationColor = 0x83d765;
            automationCopy = `CARE ONLINE  |  Keep Dew supplied (${Math.floor(firstAutomation.dewAmount)} Dew)`;
            break;
          case "dry":
            automationColor = 0xe8616a;
            automationCopy = "SPRINKLER DRY  |  Touch the field to gather Dew";
            break;
          case "paused":
            automationColor = 0xe8616a;
            automationCopy = `SPRINKLER PAUSED  |  ${firstAutomation.pauseReason ?? "Check its buffers"}`;
            break;
          default:
            automationProgress = firstAutomation.purchaseProgress;
            automationColor = 0x8de7ff;
            automationCopy = `FIRST AUTOMATION  |  Gather RT ${Math.floor(this.state.runTouches)} / ${firstAutomation.purchaseCost}`;
        }
      }
      this.setTextIfChanged(this.automationGoalText, automationCopy);
      const automationHex = `#${automationColor.toString(16).padStart(6, "0")}`;
      if (this.automationGoalText.getData("goalColor") !== automationHex) {
        this.automationGoalText.setData("goalColor", automationHex).setColor(automationHex);
      }
      if (this.automationGoalFill.fillColor !== automationColor) {
        this.automationGoalFill.setFillStyle(automationColor, 0.94);
      }
      const automationWidth = Math.max(1, (this.automationGoalBack.width - 4) * automationProgress);
      if (Math.abs(this.automationGoalFill.displayWidth - automationWidth) > 0.1) {
        this.automationGoalFill.setDisplaySize(automationWidth, this.automationGoalFill.height);
      }

      const stockLines = PRODUCTION_RESOURCE_IDS.map((resourceId) => {
        const resource = PRODUCTION_RESOURCES[resourceId];
        const buffer = this.state.resources[resourceId];
        const pausedMark = buffer.amount >= buffer.capacity - 0.01 ? " [FULL]" : "";
        return `${resource.shortLabel.padEnd(5)} ${buffer.amount.toFixed(1)}/${buffer.capacity.toFixed(0)}  +${this.state.rates[resourceId].toFixed(2)}${pausedMark}`;
      });
      this.setTextIfChanged(this.ledgerStocksLeft, stockLines.slice(0, 6).join("\n"));
      this.setTextIfChanged(this.ledgerStocksRight, stockLines.slice(6).join("\n"));

      for (const helperId of HELPER_IDS) {
        const helper = this.state.helpers[helperId];
        const cost = getHelperPurchaseCost(this.state, helperId);
        const pause = helper.lastPauseReason ? ` | ${helper.lastPauseReason}` : "";
        const label = helperId === "tinySprinkler" && helper.count === 0
          ? this.state.runTouches >= cost
            ? `Buy first Tiny Sprinkler  |  ${cost} RT`
            : `Tiny Sprinkler  |  ${Math.floor(this.state.runTouches)} / ${cost} RT`
          : helperId === "fieldMouse" && helper.count === 0
            ? this.state.runTouches >= cost
              ? `Invite Field Mouse  |  ${cost} RT`
              : `Field Mouse  |  ${Math.floor(this.state.runTouches)} / ${cost} RT`
          : helperId === "beeHive" && helper.count === 0
            ? this.state.runTouches >= cost
              ? `Establish Bee Hive  |  ${cost} RT`
              : `Bee Hive  |  ${Math.floor(this.state.runTouches)} / ${cost} RT`
          : `${HELPERS[helperId].label} x${helper.count}  Buy ${cost} RT${pause}`;
        this.helperBuyButtons[helperId]
          .setLabel(label)
          .setEnabled(equipmentAvailable && this.state.runTouches >= cost);
        const actor = this.helperActors[helperId];
        if (helper.count > 0) {
          this.setTextIfChanged(actor.countText, helper.lastPauseReason ? `x${helper.count}  |  PAUSED` : `x${helper.count}`);
          const progressRatio = helper.lastPauseReason ? 0 : Phaser.Math.Clamp(helper.pulseProgress, 0, 1);
          actor.progressFill.setDisplaySize(Math.max(1, (actor.badgeWidth - 4) * progressRatio), 3);
          const progressColor = helper.lastPauseReason ? 0xe8616a : HELPER_EFFECT_COLOR[helperId];
          if (actor.progressFill.fillColor !== progressColor) actor.progressFill.setFillStyle(progressColor, 0.9);
          const statusColor = helper.lastPauseReason ? "#f1a6ce" : "#fff3c2";
          if (actor.countText.getData("statusColor") !== statusColor) {
            actor.countText.setData("statusColor", statusColor).setColor(statusColor);
          }
        }
      }
      const cultivationCost = getCultivationCost(this.state);
      const cultivationComplete = this.state.field.cultivationRank >= 10;
      this.cultivationButton
        .setLabel(cultivationComplete ? "Cultivation complete" : `Cultivate ${this.state.field.cultivationRank + 1}/10 | ${cultivationCost} Growth`)
        .setEnabled(!cultivationComplete && this.state.resources.growth.amount >= cultivationCost);
      this.zoomOutButton.setEnabled(this.fieldView.zoom > FIELD_MIN_ZOOM + 0.01);
      this.zoomInButton.setEnabled(this.fieldView.zoom < FIELD_MAX_ZOOM - 0.01);
    }

    if (this.state.active && this.worksOpen) {
      for (const helperId of HELPER_IDS) {
        const helper = this.state.helpers[helperId];
        const cost = getHelperPurchaseCost(this.state, helperId);
        const unlocked = equipmentAvailable && this.permanent.unlockedHelpers[helperId];
        this.factoryHelperButtons[helperId]
          .setVisible(unlocked)
          .setLabel(`${HELPERS[helperId].label} x${helper.count} | Buy ${cost} RT`)
          .setEnabled(this.state.runTouches >= cost);
        const mode = HELPERS[helperId].modes.find((candidate) => candidate.id === helper.modeId)!;
        const availableModes = HELPERS[helperId].modes.filter((candidate) => this.permanent.unlockedModes[helperId].includes(candidate.id));
        const cooldown = helper.reconfigureRemainingMs > 0 ? ` (${Math.ceil(helper.reconfigureRemainingMs / 1_000)}s)` : "";
        this.factoryModeButtons[helperId]
          .setVisible(unlocked)
          .setLabel(`Mode: ${mode.label}${cooldown}`)
          .setEnabled(helper.count > 0 && availableModes.length > 1 && helper.reconfigureRemainingMs <= 0);
      }
      for (const resourceId of PRODUCTION_RESOURCE_IDS) {
        const buffer = this.state.resources[resourceId];
        this.setTextIfChanged(
          this.factoryResourceTexts[resourceId],
          `${PRODUCTION_RESOURCES[resourceId].label}\n${buffer.amount.toFixed(1)} / ${buffer.capacity.toFixed(0)}\n+${this.state.rates[resourceId].toFixed(2)}/s`,
        );
        const resourceColor = buffer.amount >= buffer.capacity - 0.01 ? 0x412f1d : 0x0b2617;
        if (this.factoryResourceBacks[resourceId].fillColor !== resourceColor) {
          this.factoryResourceBacks[resourceId].setFillStyle(resourceColor, 0.96);
        }
      }
      this.setTextIfChanged(this.factoryBottleneck, `Current bottleneck: ${this.state.bottleneck}`);
    }

    if (!this.state.active && force) {
      const summary = this.state.endedSummary;
      const firstCollapse = isFirstEcosystemCollapse(this.state, this.permanent);
      const firstMemoryPending = isFirstMemoryPending(this.state, this.permanent);
      this.setTextIfChanged(this.memoryTitle, "Memory Grove");
      this.setTextIfChanged(this.memorySubtitle, firstMemoryPending
        ? `The first field was overwhelmed. Spend ${getHelperUnlockCost("tinySprinkler")} GT to remember Tiny Sprinkler.`
        : firstCollapse
          ? "Tiny Sprinkler is remembered. Run 2 can turn Dew into its first steady Care."
          : "The field is still. Spend Grass Touches on what the next run remembers.");
      this.setTextIfChanged(
        this.memoryTreeTitle,
        firstMemoryPending ? "First Memory" : "Memory Web",
      );
      this.beginNextRunButton
        .setLabel(
          this.memoryRevealSequenceActive
            ? "Memory Web Awakening..."
            : firstMemoryPending
              ? "Remember Tiny Sprinkler First"
              : firstCollapse
                ? "Begin Run 2"
                : "Begin Next Run",
        )
        .setEnabled(
          !this.memoryRevealSequenceActive
          && canBeginNextEcosystemRun(this.state, this.permanent),
        );
      this.setTextIfChanged(this.memorySummary, summary
        ? firstMemoryPending || firstCollapse
          ? [
            "THE FIRST FIELD FELL",
            "",
            "Bare hands gathered Dew and Run Touches, but could not create enough Care to stop the Scourge.",
            "",
            `+${summary.grassTouchesAwarded} GT REMEMBERED`,
            "",
            firstMemoryPending
              ? `NEXT: Tiny Sprinkler  |  ${getHelperUnlockCost("tinySprinkler")} GT`
              : "TINY SPRINKLER REMEMBERED",
            firstMemoryPending
              ? "Select the glowing Memory in the web."
              : "Run 2: gather 14 RT, install it, and keep it supplied with Dew.",
            "",
            `Collapse: ${(summary.durationMs / 1_000).toFixed(2)}s`,
            `Manual touches: ${summary.touches}`,
            `Available GT: ${this.permanent.grassTouches.toFixed(0)}`,
          ].join("\n")
          : [
            `+${summary.grassTouchesAwarded} Grass Touches`,
            "",
            `Field reached: ${summary.fieldSize}x${summary.fieldSize}`,
            `Cultivation: ${summary.cultivationRank}/10`,
            `Care produced: ${summary.careProduced.toFixed(1)}`,
            `Manual Care: ${summary.manualCare.toFixed(1)}`,
            `Helpers bought: ${summary.helpersBought}`,
            `Manual touches: ${summary.touches}`,
            "",
            `Available GT: ${this.permanent.grassTouches.toFixed(0)}`,
          ].join("\n")
        : `Available GT: ${this.permanent.grassTouches.toFixed(0)}`);
      this.refreshMemoryTree();
    }
    if (this.optionsOpen || force) {
      this.optionsMusicButton.setLabel(`Music volume: ${Math.round(this.musicVolume * 100)}%`);
      this.optionsSfxButton.setLabel(`SFX volume: ${Math.round(this.sfxVolume * 100)}%`);
    }
    if (force) {
      this.domBridge?.update(
        this.state,
        this.permanent,
        this.worksOpen,
        this.optionsOpen,
        this.memoryRevealSequenceActive,
      );
      this.updateHarnessDataset();
      this.syncViewVisibility();
    }
  }

  private renderField(force: boolean): void {
    this.fieldRenderRequested = false;
    if (!force) {
      let dirty = false;
      for (let index = 0; index < this.state.field.dirtyChunks.length; index += 1) {
        if (this.state.field.dirtyChunks[index] === 1) {
          dirty = true;
          break;
        }
      }
      if (!dirty) return;
    }
    const viewport = {
      x: this.fieldBounds.x + 8,
      y: this.fieldBounds.y + 44,
      width: Math.max(1, this.fieldBounds.width - 16),
      height: Math.max(1, this.fieldBounds.height - 52),
    };
    this.projection = projectField(this.state.field.width, this.state.field.height, viewport, this.fieldView);

    for (const image of this.tilePool) image.setVisible(false);
    for (const image of this.chunkPool) image.setVisible(false);
    for (const mote of this.ambientMotes) mote.setVisible(false);
    this.fieldAtmosphere.clear();
    this.fieldGrid.clear();
    const mobileBudget = this.scale.width < 760 ? MAX_NEAR_TILE_VIEWS_PHONE : MAX_NEAR_TILE_VIEWS_DESKTOP;
    const near = this.projection.lod === "near" && this.projection.visibleTiles.count <= mobileBudget;
    const singlePlot = near && this.state.field.stages.length === 1;
    this.plotStageText.setVisible(singlePlot);
    this.plotDetailText.setVisible(singlePlot);
    if (singlePlot) this.drawSinglePlotPresentation();
    if (near) {
      this.ensureTilePoolSize(Math.min(mobileBudget, this.projection.visibleTiles.count));
      this.renderedTileViews = this.renderNearTiles(mobileBudget);
      this.renderedChunkViews = 0;
    } else {
      this.ensureChunkPoolSize(Math.min(MAX_CHUNK_VIEWS, this.projection.visibleChunks.count));
      this.renderedTileViews = 0;
      this.renderedChunkViews = this.renderChunkTiles();
    }
    this.layoutHelperActors();
    clearDirtyChunks(this.state.field);
  }

  private ensureTilePoolSize(required: number): void {
    if (this.tilePool.length >= required) return;
    for (let index = this.tilePool.length; index < required; index += 1) {
      const image = this.add.image(0, 0, TILE_TEXTURE_KEYS[0]).setVisible(false).setOrigin(0.5);
      this.tileAnimationPhases[index] = (index * 2.399) % (Math.PI * 2);
      this.tileLayer.add(image);
      this.tilePool.push(image);
    }
    this.displayObjectCount = this.countDisplayObjects();
  }

  private ensureChunkPoolSize(required: number): void {
    if (this.chunkPool.length >= required) return;
    for (let index = this.chunkPool.length; index < required; index += 1) {
      const image = this.add.image(0, 0, TILE_TEXTURE_KEYS[0])
        .setVisible(false)
        .setOrigin(0.5)
        .setAlpha(0.82);
      this.chunkLayer.add(image);
      this.chunkPool.push(image);
    }
    this.displayObjectCount = this.countDisplayObjects();
  }

  private renderNearTiles(budget: number): number {
    const range = this.projection.visibleTiles;
    let poolIndex = 0;
    const singlePlot = this.state.field.stages.length === 1;
    const visualSize = singlePlot
      ? Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72)
      : Math.min(240, this.projection.cellSize * 0.9);
    this.fieldGrid.lineStyle(this.projection.cellSize >= 38 ? 2 : 1, 0x3f271c, 0.62);
    for (let y = range.startY; y <= range.endY && poolIndex < budget; y += 1) {
      for (let x = range.startX; x <= range.endX && poolIndex < budget; x += 1) {
        const tileIndex = y * this.state.field.width + x;
        const stage = this.state.field.stages[tileIndex] as TileStage;
        const image = this.tilePool[poolIndex];
        const variants = TILE_VARIANTS[stage];
        image.setTexture(singlePlot
          ? ECOSYSTEM_HERO_TILE_TEXTURE_KEYS[stage]
          : variants[(tileIndex * 17 + stage * 3) % variants.length]);
        const screenX = this.projection.originX + (x + 0.5) * this.projection.cellSize;
        const screenY = this.projection.originY + (y + 0.5) * this.projection.cellSize;
        image
          .setPosition(screenX, screenY)
          .setRotation(0)
          .setDisplaySize(visualSize, visualSize)
          .setVisible(true)
          .setAlpha(0.94);
        this.tileBaseYs[poolIndex] = screenY;
        if (singlePlot) {
          this.fieldGrid.lineStyle(3, 0xd8b66a, 0.82).strokeRoundedRect(
            screenX - visualSize / 2 - 4,
            screenY - visualSize / 2 - 4,
            visualSize + 8,
            visualSize + 8,
            4,
          );
          this.fieldGrid.lineStyle(1, 0xffe889, 0.38).strokeRoundedRect(
            screenX - visualSize / 2 + 5,
            screenY - visualSize / 2 + 5,
            visualSize - 10,
            visualSize - 10,
            2,
          );
        } else if (this.projection.cellSize >= 24) {
          this.fieldGrid.strokeRect(
            this.projection.originX + x * this.projection.cellSize + this.projection.cellSize * 0.05,
            this.projection.originY + y * this.projection.cellSize + this.projection.cellSize * 0.05,
            this.projection.cellSize * 0.9,
            this.projection.cellSize * 0.9,
          );
        }
        poolIndex += 1;
      }
    }
    return poolIndex;
  }

  private drawSinglePlotPresentation(): void {
    const centerX = this.projection.originX + this.projection.cellSize / 2;
    const centerY = this.projection.originY + this.projection.cellSize / 2;
    const visualSize = Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72);
    const outerSize = visualSize + 54;
    const frameX = centerX - outerSize / 2;
    const frameY = centerY - outerSize / 2;
    const stage = this.state.field.stages[0] as TileStage;
    const auraColors = [0x7b5a37, 0x7cc9de, 0x4e9c6d, 0x82c95b, 0x65bb54, 0xe48cab, 0xe4bd55, 0x69b98b];
    const auraColor = auraColors[stage];

    this.fieldAtmosphere.fillStyle(0x020b07, 0.5).fillRoundedRect(frameX - 16, frameY + 12, outerSize + 32, outerSize + 30, 14);
    this.fieldAtmosphere.fillStyle(0x21170f, 0.96).fillRoundedRect(frameX, frameY, outerSize, outerSize, 12);
    this.fieldAtmosphere.lineStyle(6, 0x3d2619, 0.96).strokeRoundedRect(frameX + 2, frameY + 2, outerSize - 4, outerSize - 4, 11);
    this.fieldAtmosphere.lineStyle(3, 0xd8b66a, 0.92).strokeRoundedRect(frameX + 9, frameY + 9, outerSize - 18, outerSize - 18, 8);
    this.fieldAtmosphere.lineStyle(2, auraColor, 0.72).strokeRoundedRect(frameX + 18, frameY + 18, outerSize - 36, outerSize - 36, 6);
    this.fieldAtmosphere.fillStyle(0x17351f, 0.76).fillRoundedRect(
      centerX - visualSize / 2 - 10,
      centerY - visualSize / 2 - 10,
      visualSize + 20,
      visualSize + 20,
      5,
    );
    this.fieldAtmosphere.lineStyle(2, auraColor, 0.2).strokeCircle(centerX, centerY, visualSize * 0.68);
    this.fieldAtmosphere.lineStyle(1, auraColor, 0.16).strokeCircle(centerX, centerY, visualSize * 0.75);

    const cornerInset = 18;
    for (const [cornerX, cornerY] of [
      [frameX + cornerInset, frameY + cornerInset],
      [frameX + outerSize - cornerInset, frameY + cornerInset],
      [frameX + cornerInset, frameY + outerSize - cornerInset],
      [frameX + outerSize - cornerInset, frameY + outerSize - cornerInset],
    ]) {
      this.fieldAtmosphere.fillStyle(0x75452b, 1).fillCircle(cornerX, cornerY, 7);
      this.fieldAtmosphere.fillStyle(0xffe889, 0.82).fillCircle(cornerX, cornerY, 3);
    }

    const plaqueWidth = Math.min(310, visualSize * 0.74);
    const plaqueY = centerY + visualSize / 2 + 8;
    this.fieldAtmosphere.fillStyle(0x06190f, 0.96).fillRoundedRect(centerX - plaqueWidth / 2, plaqueY, plaqueWidth, 54, 5);
    this.fieldAtmosphere.lineStyle(2, 0xd8b66a, 0.82).strokeRoundedRect(centerX - plaqueWidth / 2, plaqueY, plaqueWidth, 54, 5);
    this.plotStageText.setFontSize(this.scale.width < 760 ? 15 : 19).setPosition(centerX, plaqueY + 15);
    this.plotDetailText.setFontSize(this.scale.width < 760 ? 9 : 11).setPosition(centerX, plaqueY + 39);

    for (let index = 0; index < this.ambientMotes.length; index += 1) {
      const mote = this.ambientMotes[index];
      const phase = this.ambientMotePhases[index];
      const orbitBand = index % 3;
      this.ambientMoteCenterXs[index] = centerX;
      this.ambientMoteCenterYs[index] = centerY - 4;
      this.ambientMoteOrbitXs[index] = visualSize * (0.58 + orbitBand * 0.065);
      this.ambientMoteOrbitYs[index] = visualSize * (0.45 + orbitBand * 0.05);
      mote.setDisplaySize(9 + (index % 4) * 2, 9 + (index % 4) * 2);
      mote.setPosition(centerX + Math.cos(phase) * visualSize * 0.6, centerY + Math.sin(phase) * visualSize * 0.47);
      mote.setAlpha(0.24 + (index % 4) * 0.09).setVisible(true);
    }
  }

  private renderChunkTiles(): number {
    const range = this.projection.visibleChunks;
    let poolIndex = 0;
    const chunkCellSize = this.projection.cellSize * 10;
    this.fieldGrid.lineStyle(2, 0xd8b66a, this.projection.lod === "far" ? 0.3 : 0.44);
    for (let chunkY = range.startY; chunkY <= range.endY && poolIndex < this.chunkPool.length; chunkY += 1) {
      for (let chunkX = range.startX; chunkX <= range.endX && poolIndex < this.chunkPool.length; chunkX += 1) {
        const chunkIndex = chunkY * this.state.field.chunkColumns + chunkX;
        const stage = getDominantChunkStage(this.state.field, chunkIndex);
        const variants = TILE_VARIANTS[stage];
        const image = this.chunkPool[poolIndex];
        const tileWidth = Math.min(10, this.state.field.width - chunkX * 10);
        const tileHeight = Math.min(10, this.state.field.height - chunkY * 10);
        const displayWidth = tileWidth * this.projection.cellSize * 0.96;
        const displayHeight = tileHeight * this.projection.cellSize * 0.96;
        const x = this.projection.originX + (chunkX * 10 + tileWidth / 2) * this.projection.cellSize;
        const y = this.projection.originY + (chunkY * 10 + tileHeight / 2) * this.projection.cellSize;
        image.setTexture(variants[(chunkIndex * 7 + stage) % variants.length]);
        image.setPosition(x, y).setDisplaySize(displayWidth, displayHeight).setVisible(true).setAlpha(this.projection.lod === "far" ? 0.76 : 0.86);
        this.fieldGrid.strokeRect(
          this.projection.originX + chunkX * chunkCellSize + 2,
          this.projection.originY + chunkY * chunkCellSize + 2,
          Math.max(1, displayWidth - 4),
          Math.max(1, displayHeight - 4),
        );
        poolIndex += 1;
      }
    }
    return poolIndex;
  }

  private layoutHelperActors(): void {
    const owned = isRunEquipmentAvailable(this.state)
      ? HELPER_IDS.filter((helperId) => this.state.helpers[helperId].count > 0)
      : [];
    const singlePlot = this.state.field.stages.length === 1 && this.projection?.lod === "near";
    const singlePlotSize = singlePlot
      ? Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72)
      : 0;
    const actorSize = Phaser.Math.Clamp(
      Math.min((singlePlot ? singlePlotSize : this.fieldBounds.width) / Math.max(5, owned.length + 1), singlePlot ? 64 : 54),
      singlePlot ? 38 : 26,
      singlePlot ? 64 : 54,
    );
    const singlePlotCenterX = singlePlot ? this.projection.originX + this.projection.cellSize / 2 : 0;
    const singlePlotCenterY = singlePlot ? this.projection.originY + this.projection.cellSize / 2 : 0;
    const visibleLeft = Math.max(this.fieldBounds.x + 28, this.projection.originX + actorSize * 0.7);
    const visibleRight = Math.min(
      this.fieldBounds.x + this.fieldBounds.width - 28,
      this.projection.originX + this.projection.worldWidth - actorSize * 0.7,
    );
    const visibleBottom = Math.min(
      this.fieldBounds.y + this.fieldBounds.height - 14,
      this.projection.originY + this.projection.worldHeight,
    );
    for (const helperId of HELPER_IDS) {
      const actor = this.helperActors[helperId];
      const index = owned.indexOf(helperId);
      const visible = index >= 0;
      actor.image.setVisible(visible);
      actor.badgeBack.setVisible(visible);
      actor.progressFill.setVisible(visible);
      actor.countText.setVisible(visible);
      if (!visible) {
        actor.carryImage?.setVisible(false);
        actor.scurryStartedAt = -Infinity;
        actor.scurryPulseCount = 0;
        actor.scurryPlanted = false;
        actor.beeFlightActive = false;
        actor.beeFlightPulseCount = 0;
        continue;
      }
      const fraction = (index + 1) / (owned.length + 1);
      actor.baseX = singlePlot
        ? singlePlotCenterX - singlePlotSize / 2 + actorSize * 0.8 + fraction * (singlePlotSize - actorSize * 1.6)
        : visibleLeft + fraction * Math.max(0, visibleRight - visibleLeft);
      actor.baseY = singlePlot
        ? singlePlotCenterY + singlePlotSize / 2 - actorSize * 0.92
        : visibleBottom - actorSize * 0.9;
      actor.actorSize = actorSize;
      actor.badgeWidth = Phaser.Math.Clamp(actorSize * 1.78, 78, 112);
      actor.image.setPosition(actor.baseX, actor.baseY).setDisplaySize(actorSize, actorSize);
      actor.baseScaleX = actor.image.scaleX;
      actor.baseScaleY = actor.image.scaleY;
      actor.badgeBack.setDisplaySize(actor.badgeWidth, 20).setPosition(actor.baseX, actor.baseY + actorSize * 0.53);
      actor.progressFill.setPosition(actor.baseX - actor.badgeWidth / 2 + 2, actor.baseY + actorSize * 0.53 + 7);
      const countFontSize = actorSize >= 48 ? 10 : 9;
      if (actor.countText.getData("fontSize") !== countFontSize) {
        actor.countText.setData("fontSize", countFontSize).setFontSize(countFontSize);
      }
      actor.countText.setPosition(actor.baseX, actor.baseY + actorSize * 0.53 - 1);
      if (this.time.now - actor.arrivalStartedAt >= HELPER_ARRIVAL_MS) {
        actor.image.setAlpha(1).setScale(actor.baseScaleX, actor.baseScaleY);
        actor.badgeBack.setAlpha(1);
        actor.progressFill.setAlpha(0.9);
        actor.countText.setAlpha(1);
      }
    }
  }

  private animateLivingField(now: number): void {
    if (!this.fieldRoot.visible || this.optionsOpen) return;
    const animatedTileCount = getAnimatedTileCount(this.renderedTileViews, this.scale.width < 760);
    for (let sampleIndex = 0; sampleIndex < animatedTileCount; sampleIndex += 1) {
      const index = getAnimatedTileIndex(sampleIndex, this.renderedTileViews, animatedTileCount);
      const image = this.tilePool[index];
      const phase = this.tileAnimationPhases[index];
      const baseY = this.tileBaseYs[index];
      const speed = 0.0012 + (index % 7) * 0.00007;
      const sway = Math.sin(now * speed + phase);
      image.y = baseY + sway * Math.min(2.4, this.projection.cellSize * 0.035);
      image.rotation = sway * 0.012;
    }
    for (let index = 0; index < this.ambientMotes.length; index += 1) {
      const mote = this.ambientMotes[index];
      if (!mote.visible) continue;
      const phase = this.ambientMotePhases[index];
      const centerX = this.ambientMoteCenterXs[index];
      const centerY = this.ambientMoteCenterYs[index];
      const orbitX = this.ambientMoteOrbitXs[index];
      const orbitY = this.ambientMoteOrbitYs[index];
      const angle = phase + now * (0.0001 + (index % 5) * 0.000012);
      mote.x = centerX + Math.cos(angle) * orbitX;
      mote.y = centerY + Math.sin(angle) * orbitY + Math.sin(now * 0.0011 + phase * 2) * 5;
      mote.rotation = angle + Math.sin(now * 0.0008 + phase) * 0.24;
      mote.alpha = 0.22 + (index % 4) * 0.07 + (Math.sin(now * 0.0015 + phase) + 1) * 0.06;
    }
    if (this.openingPanelsVisible) {
      const portraitBaseY = Number(this.playerPortrait.getData("baseY"));
      this.playerPortrait.y = portraitBaseY + Math.sin(now * 0.00115) * 2.5;
      const scourgePulse = 1 + Math.sin(now * 0.0022) * 0.055;
      this.scourgeHalo.setScale(scourgePulse).setAlpha(0.78 + Math.sin(now * 0.0017) * 0.12);
      this.scourgeCore.setScale(1 + Math.sin(now * 0.0031 + 0.8) * 0.09);
    }
    if (this.automationGoalText.visible) {
      this.automationGoalText.setAlpha(this.automationGoalReadyForPurchase
        ? 0.82 + (Math.sin(now * 0.006) + 1) * 0.09
        : 1);
    }
    for (const helperId of HELPER_IDS) {
      const actor = this.helperActors[helperId];
      if (!actor.image.visible) continue;
      const arrivalAge = now - actor.arrivalStartedAt;
      const arrivalRatio = Phaser.Math.Clamp(arrivalAge / HELPER_ARRIVAL_MS, 0, 1);
      const arrivalEase = 1 - Math.pow(1 - arrivalRatio, 3);
      const arrivalScale = arrivalRatio < 1 ? arrivalEase * (1 + Math.sin(arrivalRatio * Math.PI) * 0.16) : 1;
      const pulseAge = now - actor.pulseStartedAt;
      const pulseRatio = Phaser.Math.Clamp(pulseAge / HELPER_PULSE_ANIMATION_MS, 0, 1);
      const pulseScale = pulseAge >= 0 && pulseAge < HELPER_PULSE_ANIMATION_MS
        ? 1 + Math.sin(pulseRatio * Math.PI) * 0.14
        : 1;
      const pulseKick = pulseAge >= 0 && pulseAge < HELPER_PULSE_ANIMATION_MS
        ? Math.sin(pulseRatio * Math.PI * 3) * (1 - pulseRatio) * 0.1
        : 0;
      const idleX = Math.sin(now * 0.0011 + actor.phase) * 4;
      const idleY = Math.sin(now * 0.0017 + actor.phase) * 3;
      let actorX = actor.baseX + idleX;
      let actorY = actor.baseY + idleY - Math.sin(pulseRatio * Math.PI) * actor.actorSize * 0.08;
      let actorRotation = Math.sin(now * 0.0013 + actor.phase) * 0.05 + pulseKick;
      let scurryScale = 1;
      let scurryActive = false;
      if (helperId === "fieldMouse" && Number.isFinite(actor.scurryStartedAt)) {
        const scurryRatio = Phaser.Math.Clamp((now - actor.scurryStartedAt) / FIELD_MOUSE_SCURRY_MS, 0, 1);
        if (scurryRatio >= FIELD_MOUSE_PLANT_RATIO && !actor.scurryPlanted) {
          actor.scurryPlanted = true;
          actor.carryImage?.setVisible(false);
          this.completeHelperEffect("fieldMouse", actor.scurryTargetX, actor.scurryTargetY, actor.scurryPulseCount, false, false);
        }
        if (scurryRatio >= 1) {
          actor.scurryStartedAt = -Infinity;
          actor.scurryPulseCount = 0;
          actor.scurryPlanted = false;
          actor.image.setFlipX(false);
          actor.carryImage?.setVisible(false);
        } else {
          scurryActive = true;
          if (scurryRatio < 0.16) {
            const pickupRatio = scurryRatio / 0.16;
            actorY -= Math.sin(pickupRatio * Math.PI) * actor.actorSize * 0.13;
            actorRotation += Math.sin(pickupRatio * Math.PI * 2) * 0.11;
          } else if (scurryRatio < FIELD_MOUSE_PLANT_RATIO) {
            const travelRatio = (scurryRatio - 0.16) / (FIELD_MOUSE_PLANT_RATIO - 0.16);
            const eased = 1 - Math.pow(1 - travelRatio, 3);
            actorX = actor.baseX + (actor.scurryTargetX - actor.baseX) * eased;
            actorY = actor.baseY + (actor.scurryTargetY - actor.baseY) * eased - Math.sin(travelRatio * Math.PI * 5) * actor.actorSize * 0.12;
            actorRotation = Math.sin(travelRatio * Math.PI * 10) * 0.09;
            actor.image.setFlipX(actor.scurryTargetX < actor.baseX);
          } else if (scurryRatio < 0.74) {
            const plantRatio = (scurryRatio - FIELD_MOUSE_PLANT_RATIO) / (0.74 - FIELD_MOUSE_PLANT_RATIO);
            actorX = actor.scurryTargetX + Math.sin(plantRatio * Math.PI * 5) * actor.actorSize * 0.05;
            actorY = actor.scurryTargetY + Math.sin(plantRatio * Math.PI) * actor.actorSize * 0.08;
            actorRotation = Math.sin(plantRatio * Math.PI * 6) * 0.16;
            scurryScale = 1 - Math.sin(plantRatio * Math.PI) * 0.12;
          } else {
            const returnRatio = (scurryRatio - 0.74) / 0.26;
            const eased = 1 - Math.pow(1 - returnRatio, 3);
            actorX = actor.scurryTargetX + (actor.baseX - actor.scurryTargetX) * eased;
            actorY = actor.scurryTargetY + (actor.baseY - actor.scurryTargetY) * eased - Math.sin(returnRatio * Math.PI * 4) * actor.actorSize * 0.1;
            actorRotation = Math.sin(returnRatio * Math.PI * 8) * 0.08;
            actor.image.setFlipX(actor.baseX < actor.scurryTargetX);
          }
          const carryVisible = scurryRatio >= 0.08 && scurryRatio < FIELD_MOUSE_PLANT_RATIO;
          actor.carryImage
            ?.setVisible(carryVisible)
            .setPosition(actorX + (actor.image.flipX ? -1 : 1) * actor.actorSize * 0.18, actorY - actor.actorSize * 0.28)
            .setRotation(now * 0.006)
            .setAlpha(carryVisible ? 0.96 : 0);
        }
      }
      actor.image.setPosition(actorX, actorY).setRotation(actorRotation);
      actor.image.setScale(
        actor.baseScaleX * arrivalScale * pulseScale * scurryScale,
        actor.baseScaleY * arrivalScale * pulseScale * scurryScale,
      );
      actor.image.setAlpha(arrivalRatio);
      const badgeX = scurryActive ? actor.baseX : actor.image.x;
      const badgeY = (scurryActive ? actor.baseY : actor.image.y) + actor.actorSize * 0.53;
      actor.badgeBack.setPosition(badgeX, badgeY).setAlpha(arrivalRatio);
      actor.progressFill.setPosition(badgeX - actor.badgeWidth / 2 + 2, badgeY + 7).setAlpha(arrivalRatio * 0.9);
      actor.countText.setPosition(badgeX, badgeY - 1).setAlpha(arrivalRatio);
    }
    this.animateTouchRecovery(now);
  }

  private animateTouchRecovery(now: number): void {
    const feedback = this.touchRecoveryVisual;
    if (!feedback || !this.state.active || this.worksOpen || this.optionsOpen) {
      this.setTouchRecoveryVisible(false);
      return;
    }
    if (now > feedback.readyAtMs + TOUCH_READY_FLASH_MS) {
      this.touchRecoveryVisual = null;
      this.setTouchRecoveryVisible(false);
      return;
    }

    const tileX = feedback.tileIndex % this.state.field.width;
    const tileY = Math.floor(feedback.tileIndex / this.state.field.width);
    const centerX = this.projection.originX + (tileX + 0.5) * this.projection.cellSize;
    const centerY = this.projection.originY + (tileY + 0.5) * this.projection.cellSize;
    if (!this.pointInField(centerX, centerY)) {
      this.setTouchRecoveryVisible(false);
      return;
    }

    const singlePlot = this.state.field.stages.length === 1 && this.projection.lod === "near";
    const visualSize = singlePlot
      ? Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72)
      : Math.max(14, Math.min(240, this.projection.cellSize * 0.9));
    const ready = now >= feedback.readyAtMs;
    const blockedAge = now - feedback.blockedAtMs;
    const blockedPulse = blockedAge >= 0 && blockedAge < 170
      ? Math.sin((blockedAge / 170) * Math.PI)
      : 0;
    const barWidth = Phaser.Math.Clamp(visualSize * 0.56, 16, 180);
    const barHeight = Phaser.Math.Clamp(visualSize * 0.024, 3, 8);
    const barY = visualSize >= 72 ? centerY - visualSize * 0.31 : centerY;
    const labelY = centerY - visualSize * 0.4;

    if (ready) {
      if (!feedback.readyShown) {
        feedback.readyShown = true;
        this.touchCooldownText.setText("TOUCH READY").setColor("#dfff8f");
      }
      const readyAlpha = 1 - Phaser.Math.Clamp((now - feedback.readyAtMs) / TOUCH_READY_FLASH_MS, 0, 1);
      this.touchCooldownShade
        .setPosition(centerX, centerY)
        .setSize(visualSize, visualSize)
        .setFillStyle(0x83d765, 0.05)
        .setStrokeStyle(3, 0x83d765, 0.8)
        .setAlpha(readyAlpha)
        .setVisible(true);
      this.touchCooldownBarBack.setVisible(false);
      this.touchCooldownBarFill.setVisible(false);
      this.touchCooldownText
        .setPosition(centerX, labelY)
        .setAlpha(readyAlpha)
        .setVisible(visualSize >= 72);
      return;
    }

    const progress = getTouchCooldownProgress(feedback.startedAtMs, feedback.readyAtMs, now);
    const cooldownColor = blockedPulse > 0 ? 0xf07ab2 : 0x8de7ff;
    const pulseSize = visualSize * (1 + blockedPulse * 0.025);
    this.touchCooldownShade
      .setPosition(centerX, centerY)
      .setSize(pulseSize, pulseSize)
      .setFillStyle(blockedPulse > 0 ? 0x5d213d : 0x07130d, 0.34 + blockedPulse * 0.12)
      .setStrokeStyle(3 + blockedPulse * 2, cooldownColor, 0.86)
      .setAlpha(1)
      .setVisible(true);
    this.touchCooldownBarBack
      .setPosition(centerX, barY)
      .setSize(barWidth + 4, barHeight + 4)
      .setVisible(true);
    this.touchCooldownBarFill
      .setPosition(centerX - barWidth / 2, barY)
      .setSize(Math.max(1, barWidth * progress), barHeight)
      .setFillStyle(cooldownColor, 1)
      .setVisible(true);
    this.touchCooldownText
      .setPosition(centerX, labelY)
      .setAlpha(0.9 + blockedPulse * 0.1)
      .setVisible(visualSize >= 72);
  }

  private setTouchRecoveryVisible(visible: boolean): void {
    this.touchCooldownShade.setVisible(visible);
    this.touchCooldownBarBack.setVisible(visible);
    this.touchCooldownBarFill.setVisible(visible);
    this.touchCooldownText.setVisible(visible);
  }

  private resetTouchRecovery(): void {
    this.touchCooldowns.clear();
    this.touchRecoveryVisual = null;
    this.setTouchRecoveryVisible(false);
  }

  private spawnHelperEffect(helperId: HelperId, pulseCount = 1, priming = false, celebrateFirstCare = false): void {
    const actor = this.helperActors[helperId];
    if (!actor.image.visible || !this.state.active || this.worksOpen) return;
    actor.pulseStartedAt = this.time.now;
    if (helperId === "fieldMouse") {
      if (!priming) this.spawnFieldMouseScurry(actor, pulseCount);
      return;
    }
    if (helperId === "beeHive") {
      if (!priming) this.spawnBeeFlight(actor, pulseCount);
      return;
    }
    if (helperId === "tinySprinkler" && this.time.now - this.lastHelperSoundAt >= HELPER_SOUND_INTERVAL_MS) {
      this.lastHelperSoundAt = this.time.now;
      this.audio.play("sprinkler");
    }
    const singlePlot = this.state.field.stages.length === 1 && this.projection.lod === "near";
    const burstCount = helperId === "tinySprinkler"
      ? singlePlot
        ? 3
        : this.projection.lod === "near"
          ? 2
          : 1
      : 1;
    const centerX = this.projection.originX + this.projection.worldWidth / 2;
    const centerY = this.projection.originY + this.projection.worldHeight / 2;
    const singlePlotVisualSize = singlePlot
      ? Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72)
      : 0;
    for (let burstIndex = 0; burstIndex < burstCount; burstIndex += 1) {
      const effect = this.effectPool.find((candidate) => !candidate.visible);
      if (!effect) break;
      const targetX = singlePlot
        ? centerX + (burstIndex - (burstCount - 1) / 2) * Math.min(42, singlePlotVisualSize * 0.13) + (Math.random() - 0.5) * 12
        : Phaser.Math.Clamp(
          this.projection.originX + Math.random() * this.projection.worldWidth,
          this.fieldBounds.x + 22,
          this.fieldBounds.x + this.fieldBounds.width - 22,
        );
      const targetY = singlePlot
        ? centerY - singlePlotVisualSize * 0.08 + (Math.random() - 0.5) * Math.min(70, singlePlotVisualSize * 0.18)
        : Phaser.Math.Clamp(
          this.projection.originY + Math.random() * this.projection.worldHeight,
          this.fieldBounds.y + 58,
          this.fieldBounds.y + this.fieldBounds.height - 36,
        );
      effect
        .setTexture(HELPER_EFFECT_TEXTURE[helperId])
        .setPosition(actor.image.x, actor.image.y - actor.actorSize * 0.18)
        .setDisplaySize(helperId === "tinySprinkler" ? 20 : 18, helperId === "tinySprinkler" ? 20 : 18)
        .setAlpha(1)
        .setScale(1)
        .setVisible(true);
      this.tweens.killTweensOf(effect);
      this.tweens.add({
        targets: effect,
        x: targetX,
        y: targetY,
        rotation: helperId === "tinySprinkler" ? (burstIndex - 1) * 0.26 : Math.PI * 2,
        scale: 0.72,
        alpha: 0.3,
        delay: burstIndex * 70,
        duration: 540 + HELPER_IDS.indexOf(helperId) * 32,
        ease: "Sine.easeInOut",
        onComplete: () => {
          effect.setVisible(false);
          if (burstIndex === 0) this.completeHelperEffect(helperId, targetX, targetY, pulseCount, priming, celebrateFirstCare);
        },
      });
    }
  }

  private spawnBeeFlight(actor: HelperActorView, pulseCount: number): void {
    if (actor.beeFlightActive) {
      actor.beeFlightPulseCount += pulseCount;
      return;
    }
    const bee = this.effectPool.find((candidate) => !candidate.visible);
    if (!bee) return;
    const singlePlot = this.state.field.stages.length === 1 && this.projection.lod === "near";
    const centerX = this.projection.originX + this.projection.worldWidth / 2;
    const centerY = this.projection.originY + this.projection.worldHeight / 2;
    const singlePlotSize = singlePlot
      ? Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72)
      : 0;
    const targetX = singlePlot
      ? centerX + (Math.random() - 0.5) * singlePlotSize * 0.54
      : Phaser.Math.Clamp(
        this.projection.originX + Math.random() * this.projection.worldWidth,
        this.fieldBounds.x + 22,
        this.fieldBounds.x + this.fieldBounds.width - 22,
      );
    const targetY = singlePlot
      ? centerY + (Math.random() - 0.5) * singlePlotSize * 0.42
      : Phaser.Math.Clamp(
        this.projection.originY + Math.random() * this.projection.worldHeight,
        this.fieldBounds.y + 58,
        this.fieldBounds.y + this.fieldBounds.height - 36,
      );

    actor.beeFlightActive = true;
    actor.beeFlightPulseCount = Math.max(1, pulseCount);
    bee
      .setTexture("eco-effect-bee")
      .setPosition(actor.image.x, actor.image.y - actor.actorSize * 0.2)
      .setAlpha(1)
      .setScale(1)
      .setDisplaySize(20, 20)
      .setRotation(-0.08)
      .setFlipX(targetX < actor.image.x)
      .setVisible(true);
    this.tweens.killTweensOf(bee);
    this.tweens.add({
      targets: bee,
      x: targetX,
      y: targetY,
      rotation: 0.08,
      duration: BEE_FLIGHT_MS,
      ease: "Sine.easeInOut",
      hold: 120,
      yoyo: true,
      onYoyo: () => {
        const deliveredPulses = Math.max(1, actor.beeFlightPulseCount);
        actor.beeFlightPulseCount = 0;
        bee.setFlipX(actor.image.x >= targetX);
        if (!this.state.active || this.worksOpen) return;
        this.spawnBeePollinationBurst(targetX, targetY);
        this.completeHelperEffect("beeHive", targetX, targetY, deliveredPulses, false, false);
      },
      onComplete: () => {
        bee.setVisible(false).setFlipX(false);
        actor.beeFlightActive = false;
        const queuedPulses = actor.beeFlightPulseCount;
        actor.beeFlightPulseCount = 0;
        if (queuedPulses > 0 && this.state.active && !this.worksOpen) {
          this.spawnBeeFlight(actor, queuedPulses);
        }
      },
    });
  }

  private spawnBeePollinationBurst(x: number, y: number): void {
    for (let index = 0; index < 3; index += 1) {
      const pollen = this.effectPool.find((candidate) => !candidate.visible);
      if (!pollen) break;
      pollen
        .setTexture("eco-effect-pollen")
        .setPosition(x + (index - 1) * 7, y)
        .setAlpha(0.94)
        .setScale(0.68)
        .setRotation(index * 0.8)
        .setVisible(true);
      this.tweens.killTweensOf(pollen);
      this.tweens.add({
        targets: pollen,
        x: x + (index - 1) * 22,
        y: y - 24 - index * 5,
        rotation: pollen.rotation + Math.PI * 1.5,
        scale: 1.2,
        alpha: 0,
        duration: 460 + index * 45,
        ease: "Cubic.easeOut",
        onComplete: () => pollen.setVisible(false),
      });
    }
  }

  private spawnFieldMouseScurry(actor: HelperActorView, pulseCount: number): void {
    if (this.time.now - actor.scurryStartedAt < FIELD_MOUSE_SCURRY_MS) {
      actor.scurryPulseCount += pulseCount;
      return;
    }
    const singlePlot = this.state.field.stages.length === 1 && this.projection.lod === "near";
    const centerX = this.projection.originX + this.projection.worldWidth / 2;
    const centerY = this.projection.originY + this.projection.worldHeight / 2;
    const singlePlotSize = singlePlot
      ? Math.min(420, this.projection.cellSize * 0.86, this.fieldBounds.height * 0.72)
      : 0;
    actor.scurryTargetX = singlePlot
      ? centerX + (Math.random() - 0.5) * singlePlotSize * 0.42
      : Phaser.Math.Clamp(
        this.projection.originX + Math.random() * this.projection.worldWidth,
        this.fieldBounds.x + actor.actorSize,
        this.fieldBounds.x + this.fieldBounds.width - actor.actorSize,
      );
    actor.scurryTargetY = singlePlot
      ? centerY + (Math.random() - 0.5) * singlePlotSize * 0.32
      : Phaser.Math.Clamp(
        this.projection.originY + Math.random() * this.projection.worldHeight,
        this.fieldBounds.y + 64,
        this.fieldBounds.y + this.fieldBounds.height - actor.actorSize * 1.4,
      );
    actor.scurryStartedAt = this.time.now;
    actor.scurryPulseCount = Math.max(1, pulseCount);
    actor.scurryPlanted = false;
    const carrySize = Phaser.Math.Clamp(actor.actorSize * 0.34, 12, 22);
    actor.carryImage
      ?.setDisplaySize(carrySize, carrySize)
      .setPosition(actor.baseX, actor.baseY - actor.actorSize * 0.22)
      .setAlpha(0)
      .setVisible(true);
  }

  private completeHelperEffect(
    helperId: HelperId,
    x: number,
    y: number,
    pulseCount: number,
    priming: boolean,
    celebrateFirstCare: boolean,
  ): void {
    const color = HELPER_EFFECT_COLOR[helperId];
    if (!priming
      && (helperId === "fieldMouse" || helperId === "beeHive")
      && this.time.now - this.lastHelperSoundAt >= HELPER_SOUND_INTERVAL_MS) {
      this.lastHelperSoundAt = this.time.now;
      this.audio.play("seed");
    }
    const impact = this.impactPool.find((candidate) => !candidate.visible);
    if (impact) {
      impact.setPosition(x, y).setRadius(14).setFillStyle(color, 0.1).setStrokeStyle(3, color, 0.9).setAlpha(1).setScale(0.4).setVisible(true);
      this.tweens.killTweensOf(impact);
      this.tweens.add({
        targets: impact,
        scale: 2.1,
        alpha: 0,
        duration: 460,
        ease: "Cubic.easeOut",
        onComplete: () => impact.setVisible(false),
      });
    }

    if (!priming) {
      const feedback = this.helperFeedbackTexts[helperId];
      const modeCopy = helperId === "tinySprinkler" && this.state.helpers.tinySprinkler.modeId === "cultivator"
        ? "MOISTURE + GROWTH"
        : HELPER_PULSE_COPY[helperId];
      feedback
        .setText(`${modeCopy}${pulseCount > 1 ? ` x${pulseCount}` : ""}`)
        .setColor(`#${color.toString(16).padStart(6, "0")}`)
        .setPosition(x, y - 18)
        .setAlpha(1)
        .setVisible(true);
      this.tweens.killTweensOf(feedback);
      this.tweens.add({
        targets: feedback,
        y: y - 42,
        alpha: 0,
        duration: 820,
        ease: "Cubic.easeOut",
        onComplete: () => feedback.setVisible(false),
      });
    }

    if (!priming && helperId === "tinySprinkler" && this.state.helpers.tinySprinkler.modeId === "caretaker") {
      this.tweens.killTweensOf(this.hpBarFill);
      this.hpBarFill.setAlpha(1);
      this.tweens.add({ targets: this.hpBarFill, alpha: 0.64, yoyo: true, duration: 120, onComplete: () => this.hpBarFill.setAlpha(1) });
    }
    if (celebrateFirstCare) this.showFirstCareOnline();
  }

  private showFirstCareOnline(): void {
    const actor = this.helperActors.tinySprinkler;
    this.audio.play("milestone");
    this.helperAnnouncementText
      .setText("CARE ONLINE")
      .setColor("#83d765")
      .setPosition(actor.baseX, actor.baseY - actor.actorSize * 0.95)
      .setAlpha(1)
      .setVisible(true);
    this.tweens.killTweensOf(this.helperAnnouncementText);
    this.tweens.add({
      targets: this.helperAnnouncementText,
      y: actor.baseY - actor.actorSize * 1.35,
      alpha: 0,
      delay: 460,
      duration: 1_000,
      ease: "Cubic.easeOut",
      onComplete: () => this.helperAnnouncementText.setVisible(false),
    });
    this.tweens.killTweensOf(this.automationGoalText);
    this.automationGoalText.setScale(1);
    this.tweens.add({ targets: this.automationGoalText, scale: 1.08, yoyo: true, duration: 180, ease: "Back.easeOut" });
  }

  private showHelperArrival(helperId: HelperId): void {
    const actor = this.helperActors[helperId];
    actor.arrivalStartedAt = this.time.now;
    actor.pulseStartedAt = this.time.now;
    actor.image.setAlpha(0).setScale(0.01);
    actor.badgeBack.setAlpha(0);
    actor.progressFill.setAlpha(0);
    actor.countText.setAlpha(0);

    const color = HELPER_EFFECT_COLOR[helperId];
    const impact = this.impactPool.find((candidate) => !candidate.visible);
    if (impact) {
      impact
        .setPosition(actor.baseX, actor.baseY)
        .setRadius(Math.max(18, actor.actorSize * 0.45))
        .setFillStyle(color, 0.08)
        .setStrokeStyle(3, color, 0.94)
        .setAlpha(1)
        .setScale(0.35)
        .setVisible(true);
      this.tweens.killTweensOf(impact);
      this.tweens.add({
        targets: impact,
        scale: 2.25,
        alpha: 0,
        duration: 720,
        ease: "Back.easeOut",
        onComplete: () => impact.setVisible(false),
      });
    }

    this.helperAnnouncementText
      .setText(helperId === "tinySprinkler"
        ? "FIRST SPRINKLER ONLINE"
        : helperId === "fieldMouse"
          ? `FIELD MOUSE ONLINE  |  +${FIELD_MOUSE_STARTER_SEEDS} SEEDS`
        : helperId === "beeHive"
          ? `BEE HIVE ONLINE  |  +${BEE_HIVE_STARTER_FLOWERS} FLOWERS`
          : `${HELPERS[helperId].label.toUpperCase()} ONLINE`)
      .setColor(`#${color.toString(16).padStart(6, "0")}`)
      .setPosition(actor.baseX, actor.baseY - actor.actorSize * 0.95)
      .setAlpha(1)
      .setVisible(true);
    this.tweens.killTweensOf(this.helperAnnouncementText);
    this.tweens.add({
      targets: this.helperAnnouncementText,
      y: actor.baseY - actor.actorSize * 1.35,
      alpha: 0,
      delay: 360,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => this.helperAnnouncementText.setVisible(false),
    });
    this.spawnHelperEffect(helperId, 1, true);
  }

  private showTouchImpacts(result: TouchBatchResult): void {
    const impactBudget = this.scale.width < 760
      ? 8
      : this.projection.lod === "far"
        ? 12
        : this.impactPool.length;
    for (let index = 0; index < result.representativeImpacts.length && index < impactBudget; index += 1) {
      const impact = result.representativeImpacts[index];
      const x = impact.tileIndex % this.state.field.width;
      const y = Math.floor(impact.tileIndex / this.state.field.width);
      const screenX = this.projection.originX + (x + 0.5) * this.projection.cellSize;
      const screenY = this.projection.originY + (y + 0.5) * this.projection.cellSize;
      if (!this.pointInField(screenX, screenY)) continue;
      const view = this.impactPool[index];
      const color = impact.kind === "primary" ? 0xffe889 : impact.kind === "area" ? 0x8de7ff : impact.kind === "chain" ? 0x8bd25a : 0xf1a6ce;
      view.setPosition(screenX, screenY).setRadius(Math.max(8, Math.min(34, this.projection.cellSize * 0.34))).setFillStyle(color, 0.08).setStrokeStyle(3, color, 0.86).setAlpha(1).setScale(0.45).setVisible(true);
      this.tweens.killTweensOf(view);
      this.tweens.add({
        targets: view,
        scale: 1.45,
        alpha: 0,
        duration: 520 + index * 8,
        ease: "Cubic.easeOut",
        onComplete: () => view.setVisible(false),
      });
    }
    this.touchSummaryText.setText(
      `${result.affectedTileCount} tile${result.affectedTileCount === 1 ? "" : "s"} cared for  |  +${result.dewGained.toFixed(1)} Dew  +${result.runTouchesGained.toFixed(1)} RT`,
    ).setAlpha(1).setY(this.fieldBounds.y + 56);
    this.tweens.killTweensOf(this.touchSummaryText);
    this.tweens.add({ targets: this.touchSummaryText, y: this.fieldBounds.y + 39, alpha: 0, duration: 1_100, ease: "Cubic.easeOut" });
  }

  private touchCoordinates(x: number, y: number): void {
    const tileX = Phaser.Math.Clamp(Math.floor(x), 0, this.state.field.width - 1);
    const tileY = Phaser.Math.Clamp(Math.floor(y), 0, this.state.field.height - 1);
    this.touchTile(tileY * this.state.field.width + tileX);
  }

  private touchScreenPoint(x: number, y: number, inputStartedAtMs: number): void {
    if (!this.pointInField(x, y)) return;
    const tile = screenPointToTile(this.projection, x, y);
    if (tile) this.touchTile(tile.index, inputStartedAtMs);
  }

  private touchTile(tileIndex: number, inputStartedAtMs = performance.now()): void {
    if (!this.state.active || this.worksOpen || this.optionsOpen) return;
    const touchStart = performance.now();
    const inputLatencyMs = Math.max(0, touchStart - inputStartedAtMs);
    this.touchInputAttempts += 1;
    this.touchInputLatencyTotalMs += inputLatencyMs;
    this.touchInputLatencyMaxMs = Math.max(this.touchInputLatencyMaxMs, inputLatencyMs);
    const now = touchStart;
    const cooldownMs = getManualTouchCooldownMs(this.permanent.fastTouchRank);
    const cooldown = tryStartTouchCooldown(this.touchCooldowns, tileIndex, now, cooldownMs);
    if (!cooldown.accepted) {
      this.touchInputBlocked += 1;
      this.touchRecoveryVisual = {
        tileIndex,
        startedAtMs: cooldown.readyAtMs - cooldownMs,
        readyAtMs: cooldown.readyAtMs,
        blockedAtMs: now,
        readyShown: false,
      };
      this.touchCooldownText.setText("TOUCH RECOVERING").setColor("#ffb1d3");
      this.audio.play("touch_cooldown");
      this.animateTouchRecovery(now);
      return;
    }
    this.touchInputAccepted += 1;
    this.touchRecoveryVisual = {
      tileIndex,
      startedAtMs: now,
      readyAtMs: cooldown.readyAtMs,
      blockedAtMs: -Infinity,
      readyShown: false,
    };
    this.touchCooldownText.setText("TOUCH RECOVERING").setColor("#bff4ff");
    this.animateTouchRecovery(now);
    const result = touchFieldTile(this.state, this.permanent, tileIndex);
    if (!result) return;
    const modelEnd = performance.now();
    this.audio.playGrassTouch("normal", "lush", result.fieldEmbraceTriggered, result.affectedTileCount, true);
    const audioEnd = performance.now();
    this.showTouchImpacts(result);
    const effectsEnd = performance.now();
    this.uiRefreshRequested = true;
    this.fieldRenderRequested = true;
    const renderEnd = performance.now();
    const touchEnd = performance.now();
    this.performanceMonitor.recordTouchAction(
      touchEnd - touchStart,
      modelEnd - touchStart,
      audioEnd - modelEnd,
      effectsEnd - audioEnd,
      renderEnd - effectsEnd,
      touchEnd - renderEnd,
    );
  }

  private buyHelperFromUi(helperId: HelperId): void {
    const previousCount = this.state.helpers[helperId].count;
    if (buyHelper(this.state, this.permanent, helperId)) {
      const firstSprinkler = helperId === "tinySprinkler" && previousCount === 0;
      this.audio.play(firstSprinkler ? "milestone" : previousCount === 0 ? "unlock" : "upgrade");
      const button = this.worksOpen ? this.factoryHelperButtons[helperId] : this.helperBuyButtons[helperId];
      this.tweens.add({ targets: button.container, scale: 1.06, yoyo: true, duration: 110 });
      if (firstSprinkler) {
        this.tweens.killTweensOf(this.automationGoalText);
        this.tweens.add({ targets: this.automationGoalText, scale: 1.06, yoyo: true, duration: 180, ease: "Back.easeOut" });
      }
      this.layoutHelperActors();
      if (previousCount === 0 && !this.worksOpen) this.showHelperArrival(helperId);
      this.persistAll();
      this.refreshUi(false);
    } else {
      this.audio.play("blocked");
    }
  }

  private buyCultivation(): void {
    const previousSize = this.state.field.width;
    if (buyCultivationRank(this.state, this.permanent)) {
      this.audio.play(previousSize !== this.state.field.width ? "milestone" : "upgrade");
      if (previousSize !== this.state.field.width) {
        this.layout(this.scale.width, this.scale.height);
        this.resetFieldView();
      } else {
        this.renderField(true);
      }
      this.persistAll();
      this.refreshUi(false);
    } else {
      this.audio.play("blocked");
    }
  }

  private cycleHelperMode(helperId: HelperId): void {
    const available = HELPERS[helperId].modes.filter((mode) => this.permanent.unlockedModes[helperId].includes(mode.id));
    const currentIndex = available.findIndex((mode) => mode.id === this.state.helpers[helperId].modeId);
    if (available.length <= 1) {
      this.audio.play("blocked");
      return;
    }
    this.switchModeFromUi(helperId, available[(currentIndex + 1) % available.length].id);
  }

  private switchModeFromUi(helperId: HelperId, modeId: string): void {
    if (switchHelperMode(this.state, this.permanent, helperId, modeId)) {
      this.audio.play("skill_select");
      this.persistAll();
      this.refreshUi(false);
    } else {
      this.audio.play("blocked");
    }
  }

  private toggleWorks(): void {
    if (
      !isRunEquipmentAvailable(this.state)
      || !this.permanent.unlockedHelpers.tinySprinkler
      || this.optionsOpen
    ) {
      return;
    }
    this.worksOpen = !this.worksOpen;
    this.audio.play("skill_select");
    this.syncViewVisibility();
    this.playRootEntrance(this.worksOpen ? this.factoryRoot : this.fieldRoot, 180);
    this.refreshUi(true);
    this.persistAll();
  }

  private toggleOptions(): void {
    this.optionsOpen = !this.optionsOpen;
    this.audio.play("skill_select");
    this.syncViewVisibility();
    if (this.optionsOpen) this.playRootEntrance(this.optionsRoot, 160);
    this.refreshUi(true);
  }

  private beginNextRun(): void {
    if (
      this.memoryRevealSequenceActive
      || !canBeginNextEcosystemRun(this.state, this.permanent)
    ) {
      this.audio.play("blocked");
      return;
    }
    this.state = createNextEcosystemRun(this.permanent);
    this.displayedHpRatio = 1;
    this.hpHeartbeatPulse = 0;
    this.firstSprinklerCycleCelebrated = false;
    this.memoryRevealHoldIds = null;
    this.memoryRevealSequenceActive = false;
    this.memoryEntryTween?.stop();
    this.memoryEntryTween = null;
    this.resetTouchRecovery();
    this.lastGameOverState = false;
    this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    this.audio.play("milestone");
    this.layout(this.scale.width, this.scale.height);
    this.syncViewVisibility();
    this.playRootEntrance(this.fieldRoot, 280);
    this.renderField(true);
    this.persistAll();
    this.refreshUi(true);
  }

  private returnToTitle(): void {
    if (!this.returnToTitleAvailable) return;
    this.persistAll();
    this.audio.play("skill_select");
    this.cameras.main.fadeOut(260, 3, 12, 7);
    this.time.delayedCall(270, () => {
      this.music?.stop();
      this.scene.start("EcosystemTitleScene");
    });
  }

  private performMemoryPurchase(nodeId: string, action: () => boolean): boolean {
    if (this.state.active) return false;
    if (action()) {
      this.permanent.lastPurchasedMemoryNodeId = nodeId;
      this.audio.play("unlock");
      savePermanentEcosystemState(this.permanent);
      this.layout(this.scale.width, this.scale.height);
      this.refreshMemoryTree();
      this.refreshUi(true);
      return true;
    } else {
      this.audio.play("blocked");
      return false;
    }
  }

  private getMemoryNodeMaxRank(definition: EcosystemMemoryNodeDefinition): number {
    if (definition.kind === "helperRank") return definition.rankKind === "startingStock" ? 5 : 10;
    if (definition.kind === "fieldTier") return FIELD_SIZE_LADDER.length - 1;
    if (definition.kind === "touchRank") return 10;
    return 1;
  }

  private getHelperMemoryRank(helperId: HelperId, kind: PermanentRankKind): number {
    if (kind === "throughput") return this.permanent.throughputRanks[helperId];
    if (kind === "storage") return this.permanent.storageRanks[helperId];
    if (kind === "efficiency") return this.permanent.efficiencyRanks[helperId];
    return this.permanent.startingStockRanks[helperId];
  }

  private getMemoryNodeRuntime(definition: EcosystemMemoryNodeDefinition): MemoryNodeRuntime {
    const availableGt = this.permanent.grassTouches;
    if (definition.kind === "root") {
      return {
        rank: 1,
        maxRank: 1,
        cost: 0,
        complete: true,
        unlocked: true,
        affordable: false,
        action: () => false,
        status: "Origin remembered",
        effect: "The permanent Memory Web is awake.",
        requirement: "",
      };
    }

    if (definition.kind === "helperUnlock") {
      const helperId = definition.helperId!;
      const complete = this.permanent.unlockedHelpers[helperId];
      const prerequisite = HELPERS[helperId].unlockRequires;
      const unlocked = !prerequisite || this.permanent.unlockedHelpers[prerequisite];
      const cost = getHelperUnlockCost(helperId);
      return {
        rank: complete ? 1 : 0,
        maxRank: 1,
        cost,
        complete,
        unlocked,
        affordable: unlocked && !complete && availableGt >= cost,
        action: () => unlockHelper(this.permanent, helperId),
        status: complete ? "Remembered" : unlocked ? `${cost} GT` : "Locked",
        effect: complete
          ? `${HELPERS[helperId].label} and its recipes are available in every run.`
          : `Reveals ${HELPERS[helperId].label}, its equipment purchases, and its production recipes.`,
        requirement: unlocked ? "" : `Requires ${HELPERS[prerequisite!].label}.`,
      };
    }

    if (definition.kind === "helperMode") {
      const helperId = definition.helperId!;
      const alternateMode = HELPERS[helperId].modes[1];
      const complete = this.permanent.unlockedModes[helperId].includes(alternateMode.id);
      const unlocked = this.permanent.unlockedHelpers[helperId];
      const cost = getModeUnlockCost(helperId);
      return {
        rank: complete ? 1 : 0,
        maxRank: 1,
        cost,
        complete,
        unlocked,
        affordable: unlocked && !complete && availableGt >= cost,
        action: () => unlockHelperMode(this.permanent, helperId, alternateMode.id),
        status: complete ? "Remembered" : unlocked ? `${cost} GT` : "Locked",
        effect: `${alternateMode.label}: ${alternateMode.description}`,
        requirement: unlocked ? "" : `Awaken ${HELPERS[helperId].label} first.`,
      };
    }

    if (definition.kind === "helperRank") {
      const helperId = definition.helperId!;
      const kind = definition.rankKind!;
      const rank = this.getHelperMemoryRank(helperId, kind);
      const maxRank = this.getMemoryNodeMaxRank(definition);
      const complete = rank >= maxRank;
      const unlocked = this.permanent.unlockedHelpers[helperId];
      const cost = complete ? 0 : getPermanentRankCost(this.permanent, helperId, kind);
      const nextRank = Math.min(maxRank, rank + 1);
      const currentIntervalMs = getHelperCycleIntervalMs(helperId, rank);
      const nextIntervalMs = getHelperCycleIntervalMs(helperId, nextRank);
      const formatInterval = (intervalMs: number): string => `${(intervalMs / 1_000).toFixed(2)}s`;
      const storageLabels = getHelperStorageResourceIds(helperId)
        .map((resourceId) => PRODUCTION_RESOURCES[resourceId].label)
        .join(", ");
      const effects: Record<PermanentRankKind, string> = {
        throughput: complete
          ? `${HELPERS[helperId].label} cycle cooldown: ${formatInterval(currentIntervalMs)}.`
          : `${HELPERS[helperId].label} cycle cooldown: ${formatInterval(currentIntervalMs)} -> ${formatInterval(nextIntervalMs)} next rank.`,
        storage: complete
          ? `${storageLabels} capacity: +${rank * 15}% from this Memory.`
          : `${storageLabels} capacity: +${rank * 15}% -> +${nextRank * 15}% next rank.`,
        efficiency: complete
          ? `Recipe input cost: -${(rank * 3.5).toFixed(1)}%.`
          : `Recipe input cost: -${(rank * 3.5).toFixed(1)}% -> -${(nextRank * 3.5).toFixed(1)}% next rank.`,
        startingStock: complete
          ? `Each new field starts with +${rank * 3} stock.`
          : `Starting stock: +${rank * 3} -> +${nextRank * 3} next rank.`,
      };
      return {
        rank,
        maxRank,
        cost,
        complete,
        unlocked,
        affordable: unlocked && !complete && availableGt >= cost,
        action: () => purchasePermanentRank(this.permanent, helperId, kind),
        status: complete ? `${rank}/${maxRank} complete` : unlocked ? `${rank}/${maxRank} | ${cost} GT` : "Locked",
        effect: effects[kind],
        requirement: unlocked ? "" : `Awaken ${HELPERS[helperId].label} first.`,
      };
    }

    if (definition.kind === "fieldTier") {
      const rank = this.permanent.maxFieldTier;
      const maxRank = FIELD_SIZE_LADDER.length - 1;
      const complete = rank >= maxRank;
      const cost = complete ? 0 : getFieldTierUnlockCost(rank + 1);
      const currentSize = FIELD_SIZE_LADDER[rank];
      const nextSize = complete ? currentSize : FIELD_SIZE_LADDER[rank + 1];
      return {
        rank,
        maxRank,
        cost,
        complete,
        unlocked: true,
        affordable: !complete && availableGt >= cost,
        action: () => unlockNextFieldTier(this.permanent),
        status: complete ? "100x100 remembered" : `${currentSize}x${currentSize} | ${cost} GT`,
        effect: complete
          ? "Cultivation may expand a run all the way to 100x100."
          : `Current maximum ${currentSize}x${currentSize}; next memory permits ${nextSize}x${nextSize}.`,
        requirement: "",
      };
    }

    if (definition.kind === "touchRank") {
      const kind: PermanentTouchRankKind = definition.touchKind!;
      const rank = kind === "fastTouch"
        ? this.permanent.fastTouchRank
        : kind === "broadPalm"
          ? this.permanent.broadPalmRank
          : this.permanent.manyHandsRank;
      const maxRank = 10;
      const complete = rank >= maxRank;
      const unlocked = kind !== "manyHands" || this.permanent.broadPalmRank >= 2;
      const cost = complete ? 0 : getTouchRankCost(kind, rank);
      let effect = "Manual touch affects one chosen tile at full strength.";
      if (kind === "fastTouch") {
        const recoveryMs = getManualTouchCooldownMs(rank);
        const nextRecoveryMs = getManualTouchCooldownMs(Math.min(maxRank, rank + 1));
        effect = rank >= maxRank
          ? `Each tile recovers in ${recoveryMs} ms, the fastest remembered rhythm.`
          : `Each tile recovers in ${recoveryMs} ms; the next rank lowers it to ${nextRecoveryMs} ms.`;
      } else if (kind === "broadPalm" && rank > 0) {
        const radius = 1 + Math.floor((rank - 1) / 2);
        const effectiveness = Math.round(40 + ((rank - 1) / 9) * 60);
        effect = `Nearby tiles within radius ${radius} receive ${effectiveness}% touch strength.`;
      } else if (kind === "manyHands") {
        const effectiveness = rank > 0 ? Math.round(35 + ((rank - 1) / 9) * 45) : 35;
        effect = rank > 0
          ? `${rank * 2} distant tiles receive ${effectiveness}% touch strength.`
          : "Distant touch echoes have not been remembered yet.";
      }
      return {
        rank,
        maxRank,
        cost,
        complete,
        unlocked,
        affordable: unlocked && !complete && availableGt >= cost,
        action: () => purchaseTouchRank(this.permanent, kind),
        status: complete ? "10/10 complete" : unlocked ? `${rank}/10 | ${cost} GT` : "Locked",
        effect,
        requirement: unlocked ? "" : "Requires Broad Palm rank 2.",
      };
    }

    const complete = this.permanent.fieldEmbrace;
    const unlocked = this.permanent.broadPalmRank >= 10 && this.permanent.manyHandsRank >= 10;
    const cost = 180;
    return {
      rank: complete ? 1 : 0,
      maxRank: 1,
      cost,
      complete,
      unlocked,
      affordable: unlocked && !complete && availableGt >= cost,
      action: () => purchaseFieldEmbrace(this.permanent),
      status: complete ? "Remembered" : unlocked ? `${cost} GT` : "Capstone locked",
      effect: "Every tenth manual touch sends a half-strength wave to one tile in every 10x10 field chunk.",
      requirement: unlocked ? "" : "Requires Broad Palm 10/10 and Many Hands 10/10.",
    };
  }

  private getRevealedMemoryNodeIds(): Set<string> {
    if (this.memoryRevealHoldIds) return this.memoryRevealHoldIds;
    return getRevealedEcosystemMemoryNodeIds(
      this.permanent,
      isFirstMemoryPending(this.state, this.permanent),
    );
  }

  private refreshMemoryTree(): void {
    if (!this.memoryTreeWorld) return;
    const revealedNodeIds = this.getRevealedMemoryNodeIds();
    if (
      !ECOSYSTEM_MEMORY_NODE_BY_ID.has(this.selectedMemoryNodeId)
      || !revealedNodeIds.has(this.selectedMemoryNodeId)
    ) {
      this.selectedMemoryNodeId = revealedNodeIds.has(FIRST_ECOSYSTEM_MEMORY_NODE_ID)
        ? FIRST_ECOSYSTEM_MEMORY_NODE_ID
        : revealedNodeIds.has(ECOSYSTEM_MEMORY_ROOT_ID)
          ? ECOSYSTEM_MEMORY_ROOT_ID
          : [...revealedNodeIds][0] ?? ECOSYSTEM_MEMORY_ROOT_ID;
    }
    this.memoryCurrencyText.setText(`AVAILABLE GT  ${Math.floor(this.permanent.grassTouches)}`);
    this.drawMemoryTreeDecor(revealedNodeIds);
    this.drawMemoryTreeConnectors(revealedNodeIds);
    for (const view of this.memoryNodeViews.values()) {
      const runtime = this.getMemoryNodeRuntime(view.definition);
      const selected = view.definition.id === this.selectedMemoryNodeId;
      const hovered = view.definition.id === this.hoveredMemoryNodeId;
      const frameKey = selected || hovered
        ? "memory-node-selected"
        : runtime.complete
          ? "memory-node-owned"
          : runtime.affordable
            ? "memory-node-available"
            : "memory-node-locked";
      view.frame.setTexture(frameKey).setAlpha(runtime.unlocked || runtime.complete ? 1 : 0.58);
      view.icon.setAlpha(runtime.unlocked || runtime.complete ? 1 : 0.34);
      view.glow
        .setFillStyle(view.definition.color, selected || hovered ? 0.2 : runtime.complete ? 0.12 : runtime.affordable ? 0.1 : 0.035)
        .setStrokeStyle(selected || hovered ? 4 : 2, view.definition.color, selected || hovered ? 0.9 : runtime.complete ? 0.56 : 0.24);
      view.title.setColor(runtime.unlocked || runtime.complete ? "#fff3c2" : "#718371");
      view.status.setText(runtime.status).setColor(runtime.affordable ? "#ffe889" : runtime.complete ? "#9bd66f" : "#8fa08e");
      this.refreshMemoryRankPips(view, runtime.rank);
    }
    this.refreshMemoryDetail();
    this.applyMemoryTreeViewTransform();
  }

  private refreshMemoryRankPips(view: MemoryNodeView, rank: number): void {
    const graphics = view.rankPips;
    if (!graphics || graphics.getData("rank") === rank) return;
    graphics.clear().lineStyle(1, view.definition.color, 0.45);
    for (let index = 0; index < view.rankPipCount; index += 1) {
      const x = (index - (view.rankPipCount - 1) / 2) * 8;
      graphics
        .fillStyle(index < rank ? view.definition.color : 0x11261a, index < rank ? 1 : 0.94)
        .fillCircle(x, view.rankPipY, 2.7)
        .strokeCircle(x, view.rankPipY, 2.7);
    }
    graphics.setData("rank", rank);
  }

  private drawMemoryTreeConnectors(revealedNodeIds = this.getRevealedMemoryNodeIds()): void {
    this.memoryTreeLines.clear();
    for (const edge of ECOSYSTEM_MEMORY_EDGES) {
      if (!revealedNodeIds.has(edge.from) || !revealedNodeIds.has(edge.to)) continue;
      const from = ECOSYSTEM_MEMORY_NODE_BY_ID.get(edge.from);
      const to = ECOSYSTEM_MEMORY_NODE_BY_ID.get(edge.to);
      if (!from || !to) continue;
      const runtime = this.getMemoryNodeRuntime(to);
      const active = runtime.complete || runtime.rank > 0;
      const color = active ? to.color : runtime.affordable ? 0xffe889 : runtime.unlocked ? 0x6f8e61 : 0x294033;
      const alpha = active ? 0.82 : runtime.affordable ? 0.72 : runtime.unlocked ? 0.42 : 0.2;
      this.strokeMemoryConnector(from, to, 11, 0x020805, 0.88);
      this.strokeMemoryConnector(from, to, active ? 5 : 3, color, alpha);
    }
  }

  private drawMemoryTreeDecor(revealedNodeIds = this.getRevealedMemoryNodeIds()): void {
    this.memoryTreeDecor.clear();
    if (
      revealedNodeIds.size === 1
      && revealedNodeIds.has(FIRST_ECOSYSTEM_MEMORY_NODE_ID)
    ) {
      const firstMemory = ECOSYSTEM_MEMORY_NODE_BY_ID.get(FIRST_ECOSYSTEM_MEMORY_NODE_ID);
      if (firstMemory) {
        this.memoryTreeDecor
          .fillStyle(firstMemory.color, 0.045)
          .fillCircle(firstMemory.x, firstMemory.y, 116)
          .lineStyle(3, firstMemory.color, 0.2)
          .strokeCircle(firstMemory.x, firstMemory.y, 116)
          .lineStyle(1, firstMemory.color, 0.12)
          .strokeCircle(firstMemory.x, firstMemory.y, 156);
      }
      return;
    }

    const root = ECOSYSTEM_MEMORY_NODE_BY_ID.get(ECOSYSTEM_MEMORY_ROOT_ID);
    if (root && revealedNodeIds.has(root.id)) {
      this.memoryTreeDecor
        .fillStyle(root.color, 0.025)
        .fillCircle(root.x, root.y, 148)
        .lineStyle(3, root.color, 0.13)
        .strokeCircle(root.x, root.y, 148)
        .lineStyle(1, root.color, 0.08)
        .strokeCircle(root.x, root.y, 182);
    }

    for (let helperIndex = 0; helperIndex < HELPER_IDS.length; helperIndex += 1) {
      const helperId = HELPER_IDS[helperIndex];
      const cluster = ECOSYSTEM_MEMORY_NODES.filter(
        (node) => node.helperId === helperId && revealedNodeIds.has(node.id),
      );
      const unlock = cluster.find((node) => node.kind === "helperUnlock");
      if (!unlock || cluster.length === 0) continue;
      const minX = Math.min(...cluster.map((node) => node.x));
      const maxX = Math.max(...cluster.map((node) => node.x));
      const minY = Math.min(...cluster.map((node) => node.y));
      const maxY = Math.max(...cluster.map((node) => node.y));
      const width = Math.max(310, maxX - minX + 150);
      const height = Math.max(330, maxY - minY + 150);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const outerContour: Phaser.Math.Vector2[] = [];
      const innerContour: Phaser.Math.Vector2[] = [];
      for (let point = 0; point < 12; point += 1) {
        const angle = (point / 12) * Math.PI * 2;
        const outerWobble = 0.9 + ((point * 7 + helperIndex * 3) % 5) * 0.035 + Math.sin(angle * 3 + helperIndex) * 0.035;
        const innerWobble = 0.68 + ((point * 5 + helperIndex) % 4) * 0.025 + Math.cos(angle * 2 + helperIndex) * 0.025;
        outerContour.push(new Phaser.Math.Vector2(
          centerX + Math.cos(angle) * width * 0.5 * outerWobble,
          centerY + Math.sin(angle) * height * 0.5 * outerWobble,
        ));
        innerContour.push(new Phaser.Math.Vector2(
          centerX + Math.cos(angle + 0.06) * width * 0.5 * innerWobble,
          centerY + Math.sin(angle + 0.06) * height * 0.5 * innerWobble,
        ));
      }
      this.memoryTreeDecor
        .fillStyle(unlock.color, 0.03)
        .fillPoints(outerContour, true)
        .lineStyle(2, unlock.color, 0.14)
        .strokePoints(outerContour, true)
        .lineStyle(1, unlock.color, 0.075)
        .strokePoints(innerContour, true);

      for (let bud = 0; bud < 5; bud += 1) {
        const angle = helperIndex * 0.83 + bud * 1.41;
        const x = centerX + Math.cos(angle) * width * 0.48;
        const y = centerY + Math.sin(angle) * height * 0.48;
        this.memoryTreeDecor.fillStyle(unlock.color, 0.32).fillCircle(x, y, bud % 2 === 0 ? 4 : 2.5);
      }
    }
  }

  private strokeMemoryConnector(
    from: EcosystemMemoryNodeDefinition,
    to: EcosystemMemoryNodeDefinition,
    width: number,
    color: number,
    alpha: number,
  ): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const unitX = dx / length;
    const unitY = dy / length;
    const fromInset = getEcosystemMemoryNodeVisualRadius(from) + ECOSYSTEM_MEMORY_CONNECTOR_GAP;
    const toInset = getEcosystemMemoryNodeVisualRadius(to) + ECOSYSTEM_MEMORY_CONNECTOR_GAP;
    if (fromInset + toInset >= length) return;
    this.memoryTreeLines
      .lineStyle(width, color, alpha)
      .lineBetween(
        from.x + unitX * fromInset,
        from.y + unitY * fromInset,
        to.x - unitX * toInset,
        to.y - unitY * toInset,
      );
  }

  private refreshMemoryDetail(): void {
    const definition = ECOSYSTEM_MEMORY_NODE_BY_ID.get(this.selectedMemoryNodeId) ?? ECOSYSTEM_MEMORY_NODES[0];
    const runtime = this.getMemoryNodeRuntime(definition);
    const frameKey = runtime.complete
      ? "memory-node-owned"
      : runtime.affordable
        ? "memory-node-available"
        : runtime.unlocked
          ? "memory-node-selected"
          : "memory-node-locked";
    const mobile = this.scale.width < 760;
    const frameSize = mobile ? 76 : 112;
    const iconSize = mobile ? 40 : 58;
    this.memoryDetailIconFrame.setTexture(frameKey).setDisplaySize(frameSize, frameSize);
    this.memoryDetailIcon
      .setTexture(definition.iconKey)
      .setDisplaySize(iconSize, iconSize)
      .setAlpha(runtime.unlocked || runtime.complete ? 1 : 0.42)
      .setAngle(0)
      .setData("baseScaleX", this.memoryDetailIcon.scaleX)
      .setData("baseScaleY", this.memoryDetailIcon.scaleY);
    this.memoryDetailIconGlow
      .setFillStyle(definition.color, runtime.complete ? 0.16 : runtime.affordable ? 0.12 : 0.06)
      .setStrokeStyle(2, definition.color, runtime.unlocked || runtime.complete ? 0.62 : 0.28);
    this.memoryDetailTitle.setText(definition.label);
    this.memoryDetailBranch.setText(`${definition.branch.toUpperCase()} MEMORY`);
    const rankLine = runtime.maxRank > 1 ? `Rank ${runtime.rank} / ${runtime.maxRank}` : runtime.complete ? "Remembered" : "Single memory";
    const touchBonusLine = definition.kind === "root"
      ? ""
      : `\n\nEvery Memory purchase adds +1% manual touch power. Current total: +${getManualTouchPowerBonusPercent(this.permanent)}%.`;
    this.memoryDetail.setText(`${definition.description}\n\n${rankLine}\n${runtime.effect}${touchBonusLine}`);
    const firstMemoryPending = isFirstMemoryPending(this.state, this.permanent);
    const firstCollapse = isFirstEcosystemCollapse(this.state, this.permanent);
    if (firstMemoryPending && definition.id === FIRST_ECOSYSTEM_MEMORY_NODE_ID && !runtime.complete) {
      this.memoryDetailStatus
        .setText(`FIRST MEMORY  |  ${runtime.cost} GT\nRemember Tiny Sprinkler to unlock Run 2.`)
        .setColor("#ffe889");
    } else if (firstCollapse && definition.id === FIRST_ECOSYSTEM_MEMORY_NODE_ID && runtime.complete) {
      this.memoryDetailStatus
        .setText("FIRST MEMORY REMEMBERED\nRun 2 can now begin.")
        .setColor("#9bd66f");
    } else if (definition.kind === "root") {
      this.memoryDetailStatus.setText("Every permanent branch begins here.").setColor("#b8d9a4");
    } else if (runtime.complete) {
      this.memoryDetailStatus.setText("REMEMBERED\nThis memory is active in future runs.").setColor("#9bd66f");
    } else if (!runtime.unlocked) {
      this.memoryDetailStatus.setText(`LOCKED\n${runtime.requirement}`).setColor("#f1a6ce");
    } else if (runtime.affordable) {
      this.memoryDetailStatus.setText(`READY TO REMEMBER  |  ${runtime.cost} GT\nClick the node to purchase.`).setColor("#ffe889");
    } else {
      const short = Math.max(0, Math.ceil(runtime.cost - this.permanent.grassTouches));
      this.memoryDetailStatus.setText(`COST ${runtime.cost} GT  |  AVAILABLE ${Math.floor(this.permanent.grassTouches)}\nNeed ${short} more GT.`).setColor("#f1a6ce");
    }
  }

  private previewMemoryNode(nodeId: string): void {
    const view = this.memoryNodeViews.get(nodeId);
    if (!view || !this.getRevealedMemoryNodeIds().has(nodeId)) return;
    this.hoveredMemoryNodeId = nodeId;
    this.selectedMemoryNodeId = nodeId;
    this.tweens.killTweensOf(view.icon);
    const baseScaleX = Number(view.icon.getData("baseScaleX"));
    const baseScaleY = Number(view.icon.getData("baseScaleY"));
    this.tweens.add({
      targets: view.icon,
      scaleX: baseScaleX * 1.13,
      scaleY: baseScaleY * 1.13,
      y: -4,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.refreshMemoryTree();
  }

  private stopPreviewingMemoryNode(nodeId: string): void {
    if (this.hoveredMemoryNodeId === nodeId) this.hoveredMemoryNodeId = null;
    const view = this.memoryNodeViews.get(nodeId);
    if (view) {
      this.tweens.killTweensOf(view.icon);
      view.icon
        .setPosition(0, 0)
        .setScale(Number(view.icon.getData("baseScaleX")), Number(view.icon.getData("baseScaleY")));
    }
    this.refreshMemoryTree();
  }

  private buyMemoryNode(nodeId: string): void {
    const definition = ECOSYSTEM_MEMORY_NODE_BY_ID.get(nodeId);
    if (
      !definition
      || this.memoryRevealSequenceActive
      || !this.getRevealedMemoryNodeIds().has(nodeId)
    ) {
      return;
    }
    if (this.memoryEntryTween) this.prepareMemoryGroveView();
    this.selectedMemoryNodeId = nodeId;
    if (definition.kind === "root") {
      this.audio.play("skill_select");
      this.refreshMemoryTree();
      return;
    }
    const runtime = this.getMemoryNodeRuntime(definition);
    if (!runtime.affordable) {
      this.audio.play("blocked");
      this.refreshMemoryTree();
      return;
    }
    const firstMemoryUnlock = isFirstMemoryPending(this.state, this.permanent)
      && nodeId === FIRST_ECOSYSTEM_MEMORY_NODE_ID;
    const previouslyRevealed = this.getRevealedMemoryNodeIds();
    if (firstMemoryUnlock) {
      this.memoryRevealSequenceActive = true;
      this.memoryRevealHoldIds = new Set(previouslyRevealed);
    }
    const purchased = this.performMemoryPurchase(nodeId, runtime.action);
    if (!purchased) {
      this.memoryRevealSequenceActive = false;
      this.memoryRevealHoldIds = null;
      return;
    }
    if (firstMemoryUnlock) {
      this.playFirstMemoryReveal(previouslyRevealed);
    }
  }

  private adjustMemoryTreeZoom(factor: number, focusX?: number, focusY?: number): void {
    if (this.state.active || this.optionsOpen) return;
    const previousZoom = this.memoryTreeZoom;
    const nextZoom = Phaser.Math.Clamp(previousZoom * factor, 1, 8);
    if (Math.abs(nextZoom - previousZoom) < 0.001) return;
    const viewportCenterX = this.memoryTreeViewport.x + this.memoryTreeViewport.width / 2;
    const viewportCenterY = this.memoryTreeViewport.y + this.memoryTreeViewport.height / 2;
    const previousScale = this.memoryTreeFitScale * previousZoom;
    const nextScale = this.memoryTreeFitScale * nextZoom;
    if (focusX !== undefined && focusY !== undefined && previousScale > 0) {
      const worldX = (focusX - viewportCenterX - this.memoryTreePanX) / previousScale;
      const worldY = (focusY - viewportCenterY - this.memoryTreePanY) / previousScale;
      this.memoryTreePanX = focusX - viewportCenterX - worldX * nextScale;
      this.memoryTreePanY = focusY - viewportCenterY - worldY * nextScale;
    }
    this.memoryTreeZoom = nextZoom;
    if (focusX === undefined) this.audio.play("skill_select");
    this.applyMemoryTreeViewTransform();
  }

  private getMemoryTreeFocus(
    nodeIds: ReadonlySet<string>,
    padding = 150,
    maximumZoom = 8,
  ): { zoom: number; panX: number; panY: number } {
    const nodes = [...nodeIds]
      .map((nodeId) => ECOSYSTEM_MEMORY_NODE_BY_ID.get(nodeId))
      .filter((node): node is EcosystemMemoryNodeDefinition => Boolean(node));
    if (nodes.length === 0 || this.memoryTreeFitScale <= 0) {
      return { zoom: 1, panX: 0, panY: 0 };
    }
    const minX = Math.min(...nodes.map((node) => node.x - getEcosystemMemoryNodeVisualRadius(node)));
    const maxX = Math.max(...nodes.map((node) => node.x + getEcosystemMemoryNodeVisualRadius(node)));
    const minY = Math.min(...nodes.map((node) => node.y - getEcosystemMemoryNodeVisualRadius(node)));
    const maxY = Math.max(...nodes.map((node) => node.y + getEcosystemMemoryNodeVisualRadius(node)));
    const worldWidth = Math.max(1, maxX - minX + padding * 2);
    const worldHeight = Math.max(1, maxY - minY + padding * 2);
    const targetScale = Math.min(
      this.memoryTreeViewport.width / worldWidth,
      this.memoryTreeViewport.height / worldHeight,
    ) * 0.9;
    const zoom = Phaser.Math.Clamp(targetScale / this.memoryTreeFitScale, 1, maximumZoom);
    const scale = this.memoryTreeFitScale * zoom;
    return {
      zoom,
      panX: -((minX + maxX) / 2) * scale,
      panY: -((minY + maxY) / 2) * scale,
    };
  }

  private resetMemoryTreeView(): void {
    const focus = this.getMemoryTreeFocus(this.getRevealedMemoryNodeIds());
    this.memoryTreeZoom = focus.zoom;
    this.memoryTreePanX = focus.panX;
    this.memoryTreePanY = focus.panY;
    if (this.memoryTreeWorld) this.applyMemoryTreeViewTransform();
  }

  private prepareMemoryGroveView(animateEntry = false): void {
    if (!this.memoryTreeWorld || this.state.active) return;
    const firstMemoryPending = isFirstMemoryPending(this.state, this.permanent);
    const targetNodeId = getEcosystemMemoryEntryNodeId(this.permanent, firstMemoryPending);
    const node = ECOSYSTEM_MEMORY_NODE_BY_ID.get(targetNodeId);
    if (!node) return;
    this.memoryEntryTween?.stop();
    this.memoryEntryTween = null;
    this.selectedMemoryNodeId = targetNodeId;
    const mobile = this.scale.width < 760;
    const targetZoom = firstMemoryPending
      ? mobile ? 7.4 : 5.8
      : mobile ? 5.2 : 3.8;
    const targetScale = this.memoryTreeFitScale * targetZoom;
    const targetPanX = -node.x * targetScale;
    const targetPanY = -node.y * targetScale;
    if (animateEntry) {
      const entryFocus = this.getMemoryTreeFocus(
        this.getRevealedMemoryNodeIds(),
        mobile ? 110 : 150,
        firstMemoryPending ? mobile ? 2.4 : 2 : targetZoom * 0.55,
      );
      const camera = {
        zoom: entryFocus.zoom,
        panX: entryFocus.panX,
        panY: entryFocus.panY,
      };
      this.memoryTreeZoom = camera.zoom;
      this.memoryTreePanX = camera.panX;
      this.memoryTreePanY = camera.panY;
      this.applyMemoryTreeViewTransform();
      this.memoryEntryTween = this.tweens.add({
        targets: camera,
        zoom: targetZoom,
        panX: targetPanX,
        panY: targetPanY,
        delay: 90,
        duration: 720,
        ease: "Cubic.easeOut",
        onUpdate: () => {
          this.memoryTreeZoom = camera.zoom;
          this.memoryTreePanX = camera.panX;
          this.memoryTreePanY = camera.panY;
          this.applyMemoryTreeViewTransform();
        },
        onComplete: () => {
          this.memoryTreeZoom = targetZoom;
          this.memoryTreePanX = targetPanX;
          this.memoryTreePanY = targetPanY;
          this.memoryEntryTween = null;
          this.applyMemoryTreeViewTransform();
        },
      });
      return;
    }
    this.memoryTreeZoom = targetZoom;
    this.memoryTreePanX = targetPanX;
    this.memoryTreePanY = targetPanY;
    this.applyMemoryTreeViewTransform();
  }

  private playFirstMemoryReveal(previouslyRevealed: ReadonlySet<string>): void {
    const node = ECOSYSTEM_MEMORY_NODE_BY_ID.get(FIRST_ECOSYSTEM_MEMORY_NODE_ID);
    const view = this.memoryNodeViews.get(FIRST_ECOSYSTEM_MEMORY_NODE_ID);
    if (!node || !view) {
      this.memoryRevealHoldIds = null;
      this.memoryRevealSequenceActive = false;
      this.refreshMemoryTree();
      this.refreshUi(true);
      return;
    }

    this.tweens.killTweensOf(view.icon);
    this.tweens.killTweensOf(view.frame);
    this.tweens.killTweensOf(view.glow);
    const iconScaleX = Number(view.icon.getData("baseScaleX"));
    const iconScaleY = Number(view.icon.getData("baseScaleY"));
    const frameScaleX = view.frame.scaleX;
    const frameScaleY = view.frame.scaleY;
    const glowScaleX = view.glow.scaleX;
    const glowScaleY = view.glow.scaleY;
    this.tweens.add({
      targets: view.icon,
      scaleX: iconScaleX * 1.42,
      scaleY: iconScaleY * 1.42,
      duration: 240,
      yoyo: true,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: view.frame,
      scaleX: frameScaleX * 1.2,
      scaleY: frameScaleY * 1.2,
      duration: 300,
      yoyo: true,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: view.glow,
      scaleX: glowScaleX * 1.8,
      scaleY: glowScaleY * 1.8,
      alpha: 0.96,
      duration: FIRST_MEMORY_CELEBRATION_MS,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    this.tweens.add({
      targets: [this.memoryDetailIconFrame, this.memoryDetailIconGlow],
      alpha: 1,
      duration: 180,
      yoyo: true,
      repeat: 1,
    });

    for (let index = 0; index < 2; index += 1) {
      const ring = this.add.circle(
        node.x,
        node.y,
        getEcosystemMemoryNodeVisualRadius(node) + 8,
        node.color,
        0,
      ).setStrokeStyle(index === 0 ? 5 : 2, node.color, 0.92);
      this.memoryTreeWorld.add(ring);
      this.tweens.add({
        targets: ring,
        scale: index === 0 ? 2.7 : 3.45,
        alpha: 0,
        delay: index * 120,
        duration: 680,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
      });
    }

    this.time.delayedCall(FIRST_MEMORY_CELEBRATION_MS, () => {
      this.memoryRevealHoldIds = null;
      const revealedNodeIds = this.getRevealedMemoryNodeIds();
      const newlyRevealed = [...revealedNodeIds]
        .filter((nodeId) => !previouslyRevealed.has(nodeId))
        .sort((leftId, rightId) => {
          const left = ECOSYSTEM_MEMORY_NODE_BY_ID.get(leftId)!;
          const right = ECOSYSTEM_MEMORY_NODE_BY_ID.get(rightId)!;
          return Math.hypot(left.x - node.x, left.y - node.y)
            - Math.hypot(right.x - node.x, right.y - node.y);
        });
      for (const nodeId of newlyRevealed) {
        this.memoryNodeViews.get(nodeId)?.container.setAlpha(0).setScale(0.72);
      }
      this.refreshMemoryTree();
      this.memoryTreeLines.setAlpha(0);
      this.memoryTreeDecor.setAlpha(0.35);
      this.audio.play("milestone");

      const focus = this.getMemoryTreeFocus(revealedNodeIds, this.scale.width < 760 ? 105 : 145, 5);
      const camera = {
        zoom: this.memoryTreeZoom,
        panX: this.memoryTreePanX,
        panY: this.memoryTreePanY,
      };
      this.tweens.add({
        targets: camera,
        zoom: focus.zoom,
        panX: focus.panX,
        panY: focus.panY,
        duration: FIRST_MEMORY_REVEAL_MS,
        ease: "Cubic.easeInOut",
        onUpdate: () => {
          this.memoryTreeZoom = camera.zoom;
          this.memoryTreePanX = camera.panX;
          this.memoryTreePanY = camera.panY;
          this.applyMemoryTreeViewTransform();
        },
        onComplete: () => {
          this.memoryTreeZoom = focus.zoom;
          this.memoryTreePanX = focus.panX;
          this.memoryTreePanY = focus.panY;
          this.memoryRevealSequenceActive = false;
          this.applyMemoryTreeViewTransform();
          this.refreshUi(true);
        },
      });
      this.tweens.add({
        targets: this.memoryTreeLines,
        alpha: 1,
        duration: 720,
        ease: "Sine.easeOut",
      });
      this.tweens.add({
        targets: this.memoryTreeDecor,
        alpha: 1,
        duration: 900,
        ease: "Sine.easeOut",
      });
      newlyRevealed.forEach((nodeId, index) => {
        const revealedView = this.memoryNodeViews.get(nodeId);
        if (!revealedView) return;
        this.tweens.add({
          targets: revealedView.container,
          alpha: 1,
          scale: 1,
          delay: 110 + index * 65,
          duration: 430,
          ease: "Back.easeOut",
        });
      });
      this.refreshUi(true);
    });
  }

  private applyMemoryTreeViewTransform(): void {
    if (!this.memoryTreeWorld || this.memoryTreeFitScale <= 0) return;
    const revealedNodeIds = this.getRevealedMemoryNodeIds();
    const scale = this.memoryTreeFitScale * this.memoryTreeZoom;
    const maxPanX = Math.max(0, (ECOSYSTEM_MEMORY_WORLD_WIDTH * scale - this.memoryTreeViewport.width) / 2);
    const maxPanY = Math.max(0, (ECOSYSTEM_MEMORY_WORLD_HEIGHT * scale - this.memoryTreeViewport.height) / 2);
    this.memoryTreePanX = Phaser.Math.Clamp(this.memoryTreePanX, -maxPanX, maxPanX);
    this.memoryTreePanY = Phaser.Math.Clamp(this.memoryTreePanY, -maxPanY, maxPanY);
    const centerX = this.memoryTreeViewport.x + this.memoryTreeViewport.width / 2;
    const centerY = this.memoryTreeViewport.y + this.memoryTreeViewport.height / 2;
    this.memoryTreeWorld.setPosition(centerX + this.memoryTreePanX, centerY + this.memoryTreePanY).setScale(scale);
    const showLabels = this.memoryTreeZoom >= 1.75;
    const showStatus = this.memoryTreeZoom >= 3.25;
    const showPips = this.memoryTreeZoom >= 1.45;
    for (const view of this.memoryNodeViews.values()) {
      const screenX = centerX + this.memoryTreePanX + view.definition.x * scale;
      const screenY = centerY + this.memoryTreePanY + view.definition.y * scale;
      const margin = 100 * scale + 8;
      const visible = revealedNodeIds.has(view.definition.id) &&
        screenX >= this.memoryTreeViewport.x - margin &&
        screenX <= this.memoryTreeViewport.x + this.memoryTreeViewport.width + margin &&
        screenY >= this.memoryTreeViewport.y - margin &&
        screenY <= this.memoryTreeViewport.y + this.memoryTreeViewport.height + margin;
      const highlighted = view.definition.id === this.selectedMemoryNodeId || view.definition.id === this.hoveredMemoryNodeId;
      view.container.setVisible(visible);
      if (view.hitArea.input) view.hitArea.input.enabled = visible;
      view.title.setVisible(visible && (showLabels || highlighted));
      view.status.setVisible(visible && (showStatus || highlighted));
      view.rankPips?.setVisible(visible && (showPips || highlighted));
    }
    this.memoryZoomOutButton.setEnabled(this.memoryTreeZoom > 1.001);
    this.memoryZoomInButton.setEnabled(this.memoryTreeZoom < 7.999);
    this.memoryZoomResetButton.setLabel(this.memoryTreeZoom <= 1.001 ? "Fit" : `${this.memoryTreeZoom.toFixed(1)}x`);
  }

  private animateHealthBar(now: number, delta: number): void {
    if (!this.state.active || !this.fieldRoot.visible || this.optionsOpen) {
      if (this.hpHeartbeatPulse > 0) {
        this.hpBarFill.setScale(this.hpBarFill.scaleX, 1);
        this.hpBarHeartbeatGlow.setAlpha(0).setScale(this.hpBarHeartbeatGlow.scaleX, 1);
      }
      this.hpHeartbeatPulse = 0;
      return;
    }

    const targetRatio = predictHealthRatio(
      this.state.hp,
      this.state.maxHp,
      -this.state.careDeficitPerSecond,
      this.state.tickAccumulatorMs,
      PRODUCTION_TICK_MS,
    );
    this.displayedHpRatio = smoothHealthRatio(this.displayedHpRatio, targetRatio, delta);
    const barWidth = Math.max(1, this.hpBarBack.width - 6);
    const displayWidth = Math.max(1, barWidth * this.displayedHpRatio);
    if (Math.abs(this.hpBarFill.displayWidth - displayWidth) > 0.1) {
      this.hpBarFill.setDisplaySize(displayWidth, this.hpBarFill.height);
      this.hpBarHeartbeatGlow.setDisplaySize(displayWidth, this.hpBarHeartbeatGlow.height);
    }

    const previousPulse = this.hpHeartbeatPulse;
    const rawPulse = getHealthHeartbeatPulse(now, targetRatio);
    this.hpHeartbeatPulse = rawPulse >= 0.002 ? rawPulse : 0;
    if (this.hpHeartbeatPulse <= 0 && previousPulse <= 0) return;
    const urgency = 1 - targetRatio;
    const fillPulse = 1 + this.hpHeartbeatPulse * (0.045 + urgency * 0.065);
    const glowPulse = 1 + this.hpHeartbeatPulse * (0.16 + urgency * 0.18);
    this.hpBarFill.setScale(this.hpBarFill.scaleX, fillPulse);
    this.hpBarHeartbeatGlow
      .setScale(this.hpBarHeartbeatGlow.scaleX, glowPulse)
      .setAlpha(this.hpHeartbeatPulse * (0.12 + urgency * 0.22));
  }

  private animateMemoryTree(now: number): void {
    if (this.state.active || !this.memoryRoot.visible || this.optionsOpen) return;
    const pulse = Math.sin(now * 0.0032);
    const baseScaleX = Number(this.memoryDetailIcon.getData("baseScaleX") ?? this.memoryDetailIcon.scaleX);
    const baseScaleY = Number(this.memoryDetailIcon.getData("baseScaleY") ?? this.memoryDetailIcon.scaleY);
    this.memoryDetailIcon
      .setScale(baseScaleX * (1 + pulse * 0.035), baseScaleY * (1 + pulse * 0.035))
      .setAngle(pulse * 1.5);
    this.memoryDetailIconGlow.setScale(1 + pulse * 0.035).setAlpha(0.88 + pulse * 0.1);
    this.beginNextRunButton.container.setScale(
      this.beginNextRunButton.enabled ? 1 + Math.sin(now * 0.004) * 0.018 : 1,
    );
  }

  private adjustFieldZoom(factor: number): void {
    if (!this.state.active || this.worksOpen || this.optionsOpen || this.state.field.stages.length === 1) return;
    const x = this.fieldBounds.x + this.fieldBounds.width / 2;
    const y = this.fieldBounds.y + this.fieldBounds.height / 2;
    this.fieldView = zoomFieldAtPoint(this.fieldView, this.projection, x, y, factor);
    this.audio.play("skill_select");
    this.renderField(true);
  }

  private resetFieldView(): void {
    this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    this.renderField(true);
  }

  private queueFieldMusic(): void {
    if (this.cache.audio.exists("eco-music")) {
      this.createFieldMusic();
      return;
    }
    this.load.audio("eco-music", "/assets/music/lucid-field-theme.wav");
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.sys.isActive()) this.createFieldMusic();
    });
    this.load.start();
  }

  private createFieldMusic(): void {
    if (this.music) return;
    this.music = this.sound.add("eco-music", { loop: true, volume: this.musicVolume });
    this.music.play();
  }

  private cycleMusicVolume(): void {
    this.musicVolume = this.nextVolume(this.musicVolume);
    writeStoredMusicVolume(this.musicVolume);
    this.sound.setVolume(this.musicVolume);
    this.audio.play("skill_select");
    this.refreshUi(false);
  }

  private cycleSfxVolume(): void {
    this.sfxVolume = this.nextVolume(this.sfxVolume);
    writeStoredSfxVolume(this.sfxVolume);
    this.audio.setVolume(this.sfxVolume);
    this.audio.play("upgrade");
    this.refreshUi(false);
  }

  private nextVolume(volume: number): number {
    const steps = [0, 0.25, 0.5, 0.75, 1];
    const currentIndex = steps.findIndex((step) => Math.abs(step - volume) < 0.01);
    return steps[(currentIndex + 1 + steps.length) % steps.length];
  }

  private syncViewVisibility(): void {
    if (!isRunEquipmentAvailable(this.state)) {
      this.worksOpen = false;
    }
    this.fieldRoot.setVisible(this.state.active && !this.worksOpen);
    this.factoryRoot.setVisible(this.state.active && this.worksOpen);
    this.memoryRoot.setVisible(!this.state.active);
    this.optionsRoot.setVisible(this.optionsOpen);
  }

  private persistAll(): void {
    savePermanentEcosystemState(this.permanent);
    const view: ActiveFieldViewSnapshot = { ...this.fieldView };
    saveActiveField(this.state, view);
  }

  private resetPrototypeSave(): void {
    clearActiveField();
    localStorage.removeItem("grass-touching-simulator.ecosystem-memory.v1");
    this.permanent = createPermanentEcosystemState();
    this.state = createEcosystemState(this.permanent);
    this.displayedHpRatio = 1;
    this.hpHeartbeatPulse = 0;
    this.firstSprinklerCycleCelebrated = false;
    this.memoryRevealHoldIds = null;
    this.memoryRevealSequenceActive = false;
    this.memoryEntryTween?.stop();
    this.memoryEntryTween = null;
    this.resetTouchRecovery();
    this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    this.worksOpen = false;
    this.optionsOpen = false;
    this.lastGameOverState = false;
    this.selectedMemoryNodeId = FIRST_ECOSYSTEM_MEMORY_NODE_ID;
    this.resetMemoryTreeView();
    this.refreshMemoryTree();
    this.layout(this.scale.width, this.scale.height);
    this.syncViewVisibility();
    this.renderField(true);
    this.persistAll();
    this.refreshUi(true);
  }

  private updateHarnessDataset(): void {
    const readout = getEcosystemReadout(this.state);
    const performanceSnapshot = this.performanceMonitor.getSnapshot();
    let activeEffects = 0;
    for (const effect of this.effectPool) activeEffects += effect.visible ? 1 : 0;
    for (const impact of this.impactPool) activeEffects += impact.visible ? 1 : 0;
    document.documentElement.dataset.grassEcosystemHarness = JSON.stringify({
      route: "ecosystemPrototype",
      active: this.state.active,
      runNumber: this.state.runNumber,
      firstMemoryPending: isFirstMemoryPending(this.state, this.permanent),
      memoryTreeZoom: Number(this.memoryTreeZoom.toFixed(3)),
      selectedMemoryNodeId: this.selectedMemoryNodeId,
      lastPurchasedMemoryNodeId: this.permanent.lastPurchasedMemoryNodeId,
      elapsedMs: Math.round(this.state.elapsedMs),
      field: `${this.state.field.width}x${this.state.field.height}`,
      logicalTiles: readout.logicalTiles,
      lod: this.projection?.lod ?? "near",
      renderedTileViews: this.renderedTileViews,
      animatedTileViews: getAnimatedTileCount(this.renderedTileViews, this.scale.width < 760),
      renderedChunkViews: this.renderedChunkViews,
      pooledTileViews: this.tilePool.length,
      pooledChunkViews: this.chunkPool.length,
      pooledImpacts: this.impactPool.length,
      pooledEffects: this.effectPool.length,
      displayObjects: this.displayObjectCount,
      visibleDisplayObjects: this.countVisibleDisplayObjects(),
      activeTweens: this.getActiveTweenCount(),
      compactFieldBytes: this.state.field.stages.byteLength
        + this.state.field.chunkStageCounts.byteLength
        + this.state.field.dirtyChunks.byteLength,
      sparseWounds: this.state.field.sparseWounds.size,
      dirtyChunks: readout.dirtyChunks,
      fixedTicks: readout.fixedTicks,
      activeEffects,
      latestFrameDeltaMs: Number(this.latestFrameDeltaMs.toFixed(2)),
      maxFrameDeltaMs: Number(this.maxFrameDeltaMs.toFixed(2)),
      frameSpikes: this.frameSpikes,
      sampleWindowMs: Number(performanceSnapshot.windowMs.toFixed(2)),
      sampledFrames: performanceSnapshot.frames,
      fps: Number(performanceSnapshot.fps.toFixed(2)),
      averageFrameDeltaMs: Number(performanceSnapshot.averageFrameDeltaMs.toFixed(2)),
      p95FrameDeltaMs: Number(performanceSnapshot.p95FrameDeltaMs.toFixed(2)),
      windowMaxFrameDeltaMs: Number(performanceSnapshot.maxFrameDeltaMs.toFixed(2)),
      averageFrameWorkMs: Number(performanceSnapshot.averageFrameWorkMs.toFixed(3)),
      maxFrameWorkMs: Number(performanceSnapshot.maxFrameWorkMs.toFixed(3)),
      averageSimulationMs: Number(performanceSnapshot.averageSimulationMs.toFixed(3)),
      maxSimulationMs: Number(performanceSnapshot.maxSimulationMs.toFixed(3)),
      averageAnimationMs: Number(performanceSnapshot.averageAnimationMs.toFixed(3)),
      maxAnimationMs: Number(performanceSnapshot.maxAnimationMs.toFixed(3)),
      uiRefreshes: performanceSnapshot.uiRefreshes,
      averageUiRefreshMs: Number(performanceSnapshot.averageUiRefreshMs.toFixed(3)),
      maxUiRefreshMs: Number(performanceSnapshot.maxUiRefreshMs.toFixed(3)),
      fieldRenders: performanceSnapshot.fieldRenders,
      averageFieldRenderMs: Number(performanceSnapshot.averageFieldRenderMs.toFixed(3)),
      maxFieldRenderMs: Number(performanceSnapshot.maxFieldRenderMs.toFixed(3)),
      saves: performanceSnapshot.saves,
      averageSaveMs: Number(performanceSnapshot.averageSaveMs.toFixed(3)),
      maxSaveMs: Number(performanceSnapshot.maxSaveMs.toFixed(3)),
      touchActions: performanceSnapshot.touchActions,
      fieldPointerDowns: this.fieldPointerDowns,
      fieldPointerDrags: this.fieldPointerDrags,
      touchInputAttempts: this.touchInputAttempts,
      touchInputAccepted: this.touchInputAccepted,
      touchInputBlocked: this.touchInputBlocked,
      activeFieldPointerGestures: this.fieldPointerGestures.size,
      fieldInputWidth: Math.round(this.fieldSurface.width),
      fieldInputHeight: Math.round(this.fieldSurface.height),
      fieldInputHitAreaWidth: Math.round(Number(this.fieldSurface.input?.hitArea?.width ?? 0)),
      fieldInputHitAreaHeight: Math.round(Number(this.fieldSurface.input?.hitArea?.height ?? 0)),
      averageTouchInputLatencyMs: this.touchInputAttempts > 0
        ? Number((this.touchInputLatencyTotalMs / this.touchInputAttempts).toFixed(3))
        : 0,
      maxTouchInputLatencyMs: Number(this.touchInputLatencyMaxMs.toFixed(3)),
      manualTouchCooldownMs: getManualTouchCooldownMs(this.permanent.fastTouchRank),
      displayedHpRatio: Number(this.displayedHpRatio.toFixed(4)),
      hpHeartbeatPulse: Number(this.hpHeartbeatPulse.toFixed(4)),
      trackedTouchCooldowns: this.touchCooldowns.size,
      touchCooldownRemainingMs: this.touchRecoveryVisual
        ? Math.max(0, Math.round(this.touchRecoveryVisual.readyAtMs - performance.now()))
        : 0,
      averageTouchActionMs: Number(performanceSnapshot.averageTouchActionMs.toFixed(3)),
      maxTouchActionMs: Number(performanceSnapshot.maxTouchActionMs.toFixed(3)),
      averageTouchModelMs: Number(performanceSnapshot.averageTouchModelMs.toFixed(3)),
      averageTouchAudioMs: Number(performanceSnapshot.averageTouchAudioMs.toFixed(3)),
      averageTouchEffectsMs: Number(performanceSnapshot.averageTouchEffectsMs.toFixed(3)),
      averageTouchRenderMs: Number(performanceSnapshot.averageTouchRenderMs.toFixed(3)),
      averageTouchUiMs: Number(performanceSnapshot.averageTouchUiMs.toFixed(3)),
      fullFieldScans: 0,
      productionRunsPerFrame: 0,
    });
  }

  private pointInField(x: number, y: number): boolean {
    return x >= this.fieldBounds.x && x <= this.fieldBounds.x + this.fieldBounds.width &&
      y >= this.fieldBounds.y + 42 && y <= this.fieldBounds.y + this.fieldBounds.height;
  }

  private getActiveTweenCount(): number {
    const tweenManager = this.tweens as unknown as { getTweens?: () => unknown[]; getAllTweens?: () => unknown[] };
    return tweenManager.getTweens?.().length ?? tweenManager.getAllTweens?.().length ?? 0;
  }

  private countDisplayObjects(): number {
    const stack = [...this.children.list];
    let count = 0;
    while (stack.length > 0) {
      const gameObject = stack.pop();
      if (!gameObject) continue;
      count += 1;
      if (gameObject instanceof Phaser.GameObjects.Container) stack.push(...gameObject.list);
    }
    return count;
  }

  private countVisibleDisplayObjects(): number {
    const stack = [...this.children.list];
    let count = 0;
    while (stack.length > 0) {
      const gameObject = stack.pop();
      if (!gameObject) continue;
      const renderState = gameObject as unknown as { visible: boolean; renderFlags: number };
      if (!renderState.visible || renderState.renderFlags !== 15) continue;
      if (gameObject instanceof Phaser.GameObjects.Container) {
        stack.push(...gameObject.list);
      } else {
        count += 1;
      }
    }
    return count;
  }

  private pointInMemoryTree(x: number, y: number): boolean {
    return x >= this.memoryTreeViewport.x && x <= this.memoryTreeViewport.x + this.memoryTreeViewport.width &&
      y >= this.memoryTreeViewport.y && y <= this.memoryTreeViewport.y + this.memoryTreeViewport.height;
  }

  private createText(text: string, fontSize: number, color: string, fontStyle = "normal"): Phaser.GameObjects.Text {
    return this.add.text(0, 0, text, {
      fontFamily: "Trebuchet MS, Arial, sans-serif",
      fontSize,
      color,
      fontStyle,
      stroke: "#06190f",
      strokeThickness: fontSize >= 20 ? 4 : 2,
      lineSpacing: 2,
    });
  }

  private setTextIfChanged(target: Phaser.GameObjects.Text, value: string): void {
    if (target.text !== value) target.setText(value);
  }

  private playRootEntrance(root: Phaser.GameObjects.Container, duration = 220): void {
    this.tweens.killTweensOf(root);
    root.setAlpha(0.25).setScale(0.988);
    this.tweens.add({
      targets: root,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration,
      ease: "Cubic.easeOut",
    });
  }

  private createButton(
    parent: Phaser.GameObjects.Container,
    label: string,
    onClick: () => void,
    fillColor = 0x17351f,
  ): SceneButton {
    const container = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, 100, 32, fillColor, 0.98).setOrigin(0).setStrokeStyle(2, 0xd8b66a, 0.82).setInteractive({ useHandCursor: true });
    const text = this.createText(label, 12, "#fff3c2", "bold").setOrigin(0.5);
    container.add([bg, text]);
    parent.add(container);
    const button = {} as SceneButton;
    const syncAppearance = (): void => {
      container.setVisible(button.visible).setAlpha(button.enabled ? 1 : 0.46);
      bg.setFillStyle(fillColor, button.enabled ? 0.98 : 0.76);
      bg.setStrokeStyle(2, button.enabled ? 0xd8b66a : 0x756a55, button.enabled ? 0.82 : 0.45);
      if (!button.enabled) container.setScale(1);
    };
    Object.assign(button, {
      container,
      bg,
      label: text,
      enabled: true,
      visible: true,
      width: 100,
      height: 32,
      setPosition: (x: number, y: number) => {
        container.setPosition(x, y);
        return button;
      },
      setSize: (width: number, height: number) => {
        button.width = width;
        button.height = height;
        bg.setSize(width, height);
        text.setPosition(width / 2, height / 2).setWordWrapWidth(Math.max(20, width - 12));
        return button;
      },
      setLabel: (nextLabel: string) => {
        if (text.text !== nextLabel) text.setText(nextLabel);
        return button;
      },
      setEnabled: (enabled: boolean) => {
        if (button.enabled === enabled) return button;
        button.enabled = enabled;
        syncAppearance();
        return button;
      },
      setVisible: (visible: boolean) => {
        if (button.visible === visible) return button;
        button.visible = visible;
        syncAppearance();
        return button;
      },
    });
    bg.on("pointerover", () => {
      if (!button.enabled) return;
      bg.setFillStyle(0x2f6c42, 1).setStrokeStyle(2, 0xffe889, 1);
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scale: 1.018, duration: 90, ease: "Quad.easeOut" });
    });
    bg.on("pointerout", () => {
      syncAppearance();
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scale: 1, duration: 90, ease: "Quad.easeOut" });
    });
    bg.on("pointerdown", () => {
      if (!button.enabled) return;
      this.tweens.killTweensOf(container);
      container.setScale(0.972);
    });
    bg.on("pointerup", () => {
      if (!button.enabled || !button.visible) return;
      this.tweens.killTweensOf(container);
      this.tweens.add({
        targets: container,
        scale: 1.035,
        duration: 80,
        yoyo: true,
        ease: "Quad.easeOut",
      });
      onClick();
    });
    syncAppearance();
    return button;
  }

  private drawPanel(graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number, alpha: number): void {
    graphics.fillStyle(0x06190f, alpha).fillRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(3, 0x5b3926, 0.96).strokeRoundedRect(x + 2, y + 3, width, height, 6);
    graphics.lineStyle(2, 0xd8b66a, 0.88).strokeRoundedRect(x, y, width, height, 6);
    graphics.lineStyle(1, 0xe0a36c, 0.26).strokeRoundedRect(x + 6, y + 6, width - 12, height - 12, 4);
  }

  private shutdownScene(): void {
    this.memoryEntryTween?.stop();
    this.memoryEntryTween = null;
    this.persistAll();
    this.music?.stop();
    this.domBridge?.destroy();
    window.removeEventListener("pagehide", this.handlePageHide);
    this.scale.off(Phaser.Scale.Events.RESIZE);
  }
}
