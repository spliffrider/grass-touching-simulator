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
  PRODUCTION_RESOURCE_IDS,
  PRODUCTION_RESOURCES,
  TileStage,
  type HelperId,
  type ProductionResourceId,
  type TouchBatchResult,
} from "../ecosystem/EcosystemCatalog";
import { EcosystemDomBridge, type EcosystemDomActions } from "../ecosystem/EcosystemDomBridge";
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
  advanceEcosystem,
  buyCultivationRank,
  buyHelper,
  clearDirtyChunks,
  consumeHelperPulses,
  createEcosystemState,
  createNextEcosystemRun,
  createPermanentEcosystemState,
  forceGameOver,
  getCultivationCost,
  getDominantChunkStage,
  getEcosystemReadout,
  getFieldTierUnlockCost,
  getHelperPurchaseCost,
  getHelperUnlockCost,
  getModeUnlockCost,
  getPermanentRankCost,
  getTouchRankCost,
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
  beeHive: "eco-effect-pollen",
  chickenPatrol: "eco-effect-spore",
  earthwormCrew: "eco-effect-spore",
  ancientRoots: "eco-effect-water",
  sheepLoop: "eco-effect-grass",
  meadowRabbit: "eco-effect-seed",
};

const SAVE_INTERVAL_MS = 15_000;
const UI_REFRESH_MS = 120;
const FIELD_REDRAW_MS = 180;
const MAX_EFFECTS = 24;

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
  countText: Phaser.GameObjects.Text;
  baseX: number;
  baseY: number;
  phase: number;
}

interface MemoryOffer {
  label: string;
  detail: string;
  cost: number;
  affordable: boolean;
  action: () => boolean;
}

interface DragState {
  pointerId: number;
  lastX: number;
  lastY: number;
  moved: boolean;
}

export class EcosystemPrototypeScene extends Phaser.Scene {
  private permanent!: PermanentEcosystemState;
  private state!: EcosystemState;
  private fieldView: FieldViewportState = { centerX: 0.5, centerY: 0.5, zoom: 1 };
  private projection!: FieldProjection;
  private fieldBounds: FieldViewportBounds = { x: 0, y: 0, width: 1, height: 1 };
  private playtest = false;
  private worksOpen = false;
  private optionsOpen = false;
  private memoryPage = 0;
  private memoryOffers: MemoryOffer[] = [];
  private dragState: DragState | null = null;
  private saveElapsedMs = 0;
  private uiElapsedMs = 0;
  private fieldRedrawElapsedMs = 0;
  private latestFrameDeltaMs = 0;
  private maxFrameDeltaMs = 0;
  private frameSpikes = 0;
  private renderedTileViews = 0;
  private renderedChunkViews = 0;
  private lastGameOverState = false;

  private background!: Phaser.GameObjects.Image;
  private fieldRoot!: Phaser.GameObjects.Container;
  private factoryRoot!: Phaser.GameObjects.Container;
  private memoryRoot!: Phaser.GameObjects.Container;
  private optionsRoot!: Phaser.GameObjects.Container;
  private fieldChrome!: Phaser.GameObjects.Graphics;
  private fieldGrid!: Phaser.GameObjects.Graphics;
  private fieldMaskShape!: Phaser.GameObjects.Graphics;
  private fieldSurface!: Phaser.GameObjects.Rectangle;
  private tileLayer!: Phaser.GameObjects.Container;
  private chunkLayer!: Phaser.GameObjects.Container;
  private helperLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private tilePool: Phaser.GameObjects.Image[] = [];
  private chunkPool: Phaser.GameObjects.Image[] = [];
  private impactPool: Phaser.GameObjects.Arc[] = [];
  private effectPool: Phaser.GameObjects.Image[] = [];
  private helperActors = {} as Record<HelperId, HelperActorView>;
  private helperIcons = {} as Record<HelperId, Phaser.GameObjects.Image>;
  private helperBuyButtons = {} as Record<HelperId, SceneButton>;
  private factoryHelperButtons = {} as Record<HelperId, SceneButton>;
  private factoryModeButtons = {} as Record<HelperId, SceneButton>;

  private titleText!: Phaser.GameObjects.Text;
  private runText!: Phaser.GameObjects.Text;
  private hpBarBack!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;
  private pressureText!: Phaser.GameObjects.Text;
  private currencyText!: Phaser.GameObjects.Text;
  private fieldLabelText!: Phaser.GameObjects.Text;
  private fieldHintText!: Phaser.GameObjects.Text;
  private ledgerTitle!: Phaser.GameObjects.Text;
  private ledgerStocksLeft!: Phaser.GameObjects.Text;
  private ledgerStocksRight!: Phaser.GameObjects.Text;
  private bottleneckText!: Phaser.GameObjects.Text;
  private touchSummaryText!: Phaser.GameObjects.Text;
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
  private memoryOfferButtons: SceneButton[] = [];
  private memoryPreviousButton!: SceneButton;
  private memoryNextButton!: SceneButton;
  private beginNextRunButton!: SceneButton;

  private optionsChrome!: Phaser.GameObjects.Graphics;
  private optionsTitle!: Phaser.GameObjects.Text;
  private optionsCopy!: Phaser.GameObjects.Text;
  private optionsResumeButton!: SceneButton;
  private optionsMusicButton!: SceneButton;
  private optionsSfxButton!: SceneButton;

  private domBridge?: EcosystemDomBridge;
  private audio = new AudioSystem();
  private music?: Phaser.Sound.BaseSound;
  private musicVolume = 0;
  private sfxVolume = 0;
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
    this.load.image("eco-effect-pollen", "/assets/effects/pollen-fleck.png");
    this.load.image("eco-effect-spore", "/assets/effects/magic-spore.png");
    this.load.image("eco-effect-grass", "/assets/effects/grass-fleck.png");
    this.load.audio("eco-music", "/assets/music/lucid-field-theme.wav");
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.playtest = params.has("playtest");
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

    this.musicVolume = readStoredMusicVolume();
    this.sfxVolume = readStoredSfxVolume();
    this.audio.setVolume(this.sfxVolume);
    this.music = this.sound.add("eco-music", { loop: true, volume: this.musicVolume });
    this.music.play();

    this.createSceneLayers();
    this.createFieldView();
    this.createFactoryView();
    this.createMemoryView();
    this.createOptionsView();
    this.createDomBridge();
    this.bindInput();
    this.layout(this.scale.width, this.scale.height);
    this.refreshMemoryOffers();
    this.refreshUi(true);
    this.renderField(true);
    this.syncViewVisibility();

    this.scale.on(Phaser.Scale.Events.RESIZE, (gameSize: Phaser.Structs.Size) => {
      this.layout(gameSize.width, gameSize.height);
      this.renderField(true);
    });
    window.addEventListener("pagehide", this.handlePageHide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene());
    window.__grassAppReady?.();
  }

  update(_time: number, delta: number): void {
    this.latestFrameDeltaMs = delta;
    this.maxFrameDeltaMs = Math.max(this.maxFrameDeltaMs, delta);
    if (delta > 34) this.frameSpikes += 1;
    const speed = this.optionsOpen ? 0 : this.worksOpen ? 0.25 : 1;
    const result = advanceEcosystem(this.state, this.permanent, delta, speed);
    if (result.ticks > 0) {
      const pulses = consumeHelperPulses(this.state);
      for (const helperId of HELPER_IDS) {
        if (pulses[helperId] > 0) this.spawnHelperEffect(helperId);
      }
    }
    if (!this.state.active && !this.lastGameOverState) {
      this.lastGameOverState = true;
      this.worksOpen = false;
      this.audio.play("dormancy");
      clearActiveField();
      savePermanentEcosystemState(this.permanent);
      this.refreshMemoryOffers();
      this.syncViewVisibility();
    }

    this.animateLivingField(this.time.now);
    this.uiElapsedMs += delta;
    this.fieldRedrawElapsedMs += delta;
    this.saveElapsedMs += delta;
    if (this.uiElapsedMs >= UI_REFRESH_MS) {
      this.uiElapsedMs %= UI_REFRESH_MS;
      this.refreshUi(false);
    }
    if (this.fieldRedrawElapsedMs >= FIELD_REDRAW_MS) {
      this.fieldRedrawElapsedMs %= FIELD_REDRAW_MS;
      this.renderField(false);
    }
    if (this.saveElapsedMs >= SAVE_INTERVAL_MS) {
      this.saveElapsedMs %= SAVE_INTERVAL_MS;
      this.persistAll();
    }
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
    this.fieldGrid = this.add.graphics();
    this.fieldMaskShape = this.add.graphics().setVisible(false);
    this.tileLayer = this.add.container();
    this.chunkLayer = this.add.container();
    this.helperLayer = this.add.container();
    this.effectLayer = this.add.container();
    const mask = this.fieldMaskShape.createGeometryMask();
    this.tileLayer.setMask(mask);
    this.chunkLayer.setMask(mask);
    this.helperLayer.setMask(mask);
    this.effectLayer.setMask(mask);
    this.fieldRoot.add([this.fieldChrome, this.chunkLayer, this.tileLayer, this.fieldGrid, this.helperLayer, this.effectLayer]);

    this.titleText = this.createText("Ancient Grass // Ecosystem", 30, "#fff3c2", "bold");
    this.runText = this.createText("", 13, "#b8d9a4");
    this.hpBarBack = this.add.rectangle(0, 0, 100, 18, 0x071b11, 0.94).setOrigin(0, 0.5);
    this.hpBarFill = this.add.rectangle(0, 0, 100, 14, 0x83d765, 1).setOrigin(0, 0.5);
    this.hpText = this.createText("", 15, "#f2e8d5", "bold");
    this.pressureText = this.createText("", 13, "#f1a6ce");
    this.currencyText = this.createText("", 14, "#ffe889", "bold");
    this.fieldLabelText = this.createText("", 16, "#fff3c2", "bold");
    this.fieldHintText = this.createText("Touch the living field", 12, "#cce9bd");
    this.ledgerTitle = this.createText("Living Ledger", 22, "#fff3c2", "bold");
    this.ledgerStocksLeft = this.createText("", 11, "#e3f3d6");
    this.ledgerStocksRight = this.createText("", 11, "#e3f3d6");
    this.bottleneckText = this.createText("", 12, "#ffcf8b", "bold");
    this.touchSummaryText = this.createText("", 13, "#fff3c2", "bold").setAlpha(0);
    this.fieldRoot.add([
      this.titleText,
      this.runText,
      this.hpBarBack,
      this.hpBarFill,
      this.hpText,
      this.pressureText,
      this.currencyText,
      this.fieldLabelText,
      this.fieldHintText,
      this.ledgerTitle,
      this.ledgerStocksLeft,
      this.ledgerStocksRight,
      this.bottleneckText,
      this.touchSummaryText,
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
      const countText = this.createText("", 11, "#fff3c2", "bold").setOrigin(0.5, 0);
      this.helperLayer.add([actorImage, countText]);
      this.helperActors[helperId] = { image: actorImage, countText, baseX: 0, baseY: 0, phase: HELPER_IDS.indexOf(helperId) * 1.17 };
    }

    const tilePoolSize = MAX_NEAR_TILE_VIEWS_DESKTOP;
    for (let index = 0; index < tilePoolSize; index += 1) {
      const image = this.add.image(0, 0, TILE_TEXTURE_KEYS[0]).setVisible(false).setOrigin(0.5);
      image.setData("phase", (index * 2.399) % (Math.PI * 2));
      image.setData("baseY", 0);
      this.tileLayer.add(image);
      this.tilePool.push(image);
    }
    for (let index = 0; index < 100; index += 1) {
      const image = this.add.image(0, 0, TILE_TEXTURE_KEYS[0]).setVisible(false).setOrigin(0.5).setAlpha(0.82);
      this.chunkLayer.add(image);
      this.chunkPool.push(image);
    }
    for (let index = 0; index < MAX_EFFECTS; index += 1) {
      const impact = this.add.circle(0, 0, 20, 0x8de7ff, 0).setStrokeStyle(3, 0x8de7ff, 0).setVisible(false);
      this.effectLayer.add(impact);
      this.impactPool.push(impact);
      const effect = this.add.image(0, 0, "eco-effect-water").setVisible(false).setOrigin(0.5);
      this.effectLayer.add(effect);
      this.effectPool.push(effect);
    }

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
    this.memoryTitle = this.createText("Memory Nursery", 34, "#fff3c2", "bold");
    this.memorySubtitle = this.createText("The field is still. Spend Grass Touches on what the next run remembers.", 14, "#b8d9a4");
    this.memorySummary = this.createText("", 13, "#e3f3d6");
    this.memoryDetail = this.createText("Choose a Memory node to inspect and remember it.", 13, "#fff3c2");
    this.memoryRoot.add([this.memoryChrome, this.memoryTitle, this.memorySubtitle, this.memorySummary, this.memoryDetail]);
    for (let index = 0; index < 8; index += 1) {
      const button = this.createButton(this.memoryRoot, "", () => this.buyMemoryOffer(index), 0x1b4f2c);
      button.bg.on("pointerover", () => this.previewMemoryOffer(index));
      this.memoryOfferButtons.push(button);
    }
    this.memoryPreviousButton = this.createButton(this.memoryRoot, "Previous", () => this.changeMemoryPage(-1));
    this.memoryNextButton = this.createButton(this.memoryRoot, "Next", () => this.changeMemoryPage(1));
    this.beginNextRunButton = this.createButton(this.memoryRoot, "Begin Next Run", () => this.beginNextRun(), 0x397a3f);
  }

  private createOptionsView(): void {
    this.optionsChrome = this.add.graphics();
    this.optionsTitle = this.createText("Options", 30, "#fff3c2", "bold");
    this.optionsCopy = this.createText("The ecosystem is completely paused while this screen is open.", 14, "#dff6ca");
    this.optionsRoot.add([this.optionsChrome, this.optionsTitle, this.optionsCopy]);
    this.optionsResumeButton = this.createButton(this.optionsRoot, "Resume", () => this.toggleOptions(), 0x397a3f);
    this.optionsMusicButton = this.createButton(this.optionsRoot, "", () => this.cycleMusicVolume());
    this.optionsSfxButton = this.createButton(this.optionsRoot, "", () => this.cycleSfxVolume());
  }

  private createDomBridge(): void {
    const actions: EcosystemDomActions = {
      touchCoordinates: (x, y) => this.touchCoordinates(x, y),
      buyHelper: (helperId) => this.buyHelperFromUi(helperId),
      switchMode: (helperId, modeId) => this.switchModeFromUi(helperId, modeId),
      buyCultivation: () => this.buyCultivation(),
      toggleWorks: () => this.toggleWorks(),
      toggleOptions: () => this.toggleOptions(),
      beginNextRun: () => this.beginNextRun(),
      unlockHelper: (helperId) => this.performMemoryPurchase(() => unlockHelper(this.permanent, helperId)),
      unlockMode: (helperId, modeId) => this.performMemoryPurchase(() => unlockHelperMode(this.permanent, helperId, modeId)),
      buyRank: (helperId, kind) => this.performMemoryPurchase(() => purchasePermanentRank(this.permanent, helperId, kind)),
      unlockFieldTier: () => this.performMemoryPurchase(() => unlockNextFieldTier(this.permanent)),
      buyTouchRank: (kind) => this.performMemoryPurchase(() => purchaseTouchRank(this.permanent, kind)),
      buyFieldEmbrace: () => this.performMemoryPurchase(() => purchaseFieldEmbrace(this.permanent)),
      addPrototypeCurrency: () => {
        this.permanent.grassTouches += 250;
        this.state.runTouches += 250;
        this.state.resources.growth.amount = this.state.resources.growth.capacity;
        this.persistAll();
        this.refreshMemoryOffers();
      },
      forceGameOver: () => {
        forceGameOver(this.state, this.permanent);
        this.refreshUi(true);
      },
      setPrototypeField: (size) => {
        if (!this.state.active) {
          this.state = createNextEcosystemRun(this.permanent);
          this.lastGameOverState = false;
          this.syncViewVisibility();
        }
        setPrototypeFieldSize(this.state, this.permanent, size);
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
        this.refreshMemoryOffers();
        this.persistAll();
      },
      resetPrototypeSave: () => this.resetPrototypeSave(),
    };
    this.domBridge = new EcosystemDomBridge(actions, this.playtest);
  }

  private bindInput(): void {
    this.fieldSurface.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.state.active || this.worksOpen || this.optionsOpen) return;
      this.audio.unlock();
      this.dragState = { pointerId: pointer.id, lastX: pointer.x, lastY: pointer.y, moved: false };
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragState || pointer.id !== this.dragState.pointerId || !pointer.isDown) return;
      const dx = pointer.x - this.dragState.lastX;
      const dy = pointer.y - this.dragState.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) this.dragState.moved = true;
      if (this.dragState.moved && this.projection) {
        this.fieldView = panFieldViewport(this.fieldView, this.projection, dx, dy);
        this.renderField(true);
      }
      this.dragState.lastX = pointer.x;
      this.dragState.lastY = pointer.y;
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragState || pointer.id !== this.dragState.pointerId) return;
      const moved = this.dragState.moved;
      this.dragState = null;
      if (!moved && this.pointInField(pointer.x, pointer.y)) {
        const tile = screenPointToTile(this.projection, pointer.x, pointer.y);
        if (tile) this.touchTile(tile.index);
      }
    });
    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.state.active || this.worksOpen || this.optionsOpen || !this.pointInField(pointer.x, pointer.y)) return;
      const factor = deltaY > 0 ? 0.82 : 1.22;
      this.fieldView = zoomFieldAtPoint(this.fieldView, this.projection, pointer.x, pointer.y, factor);
      this.renderField(true);
    });
    this.input.keyboard?.on("keydown-PLUS", () => this.adjustFieldZoom(1.28));
    this.input.keyboard?.on("keydown-MINUS", () => this.adjustFieldZoom(0.78));
    this.input.keyboard?.on("keydown-ZERO", () => this.resetFieldView());
  }

  private layout(width: number, height: number): void {
    const mobile = width < 760;
    const ledgerUnlocked = this.permanent.unlockedHelpers.tinySprinkler;
    const backgroundScale = Math.max(width / this.background.width, height / this.background.height);
    this.background.setDisplaySize(this.background.width * backgroundScale, this.background.height * backgroundScale);
    this.background.setPosition((width - this.background.displayWidth) / 2, (height - this.background.displayHeight) / 2);

    this.fieldChrome.clear();
    const header = { x: mobile ? 8 : 22, y: mobile ? 8 : 16, width: width - (mobile ? 16 : 44), height: mobile ? 86 : 88 };
    this.drawPanel(this.fieldChrome, header.x, header.y, header.width, header.height, 0.94);
    if (mobile) {
      this.titleText.setText("Ancient Grass // Ecosystem").setFontSize(18).setPosition(header.x + 14, header.y + 8);
      this.runText.setPosition(header.x + 15, header.y + 34);
      this.hpBarBack.setPosition(header.x + 14, header.y + 59).setSize(header.width - 150, 17);
      this.hpBarFill.setPosition(header.x + 16, header.y + 59).setSize(header.width - 154, 13);
      this.hpText.setFontSize(12).setPosition(header.x + 18, header.y + 50);
      this.pressureText.setFontSize(10).setPosition(header.x + 18, header.y + 72);
      this.currencyText.setFontSize(11).setOrigin(1, 0).setPosition(header.x + header.width - 12, header.y + 47);
      this.optionsButton.setPosition(header.x + header.width - 90, header.y + 8);
      this.optionsButton.setSize(78, 28);
    } else {
      this.titleText.setText("Ancient Grass // Ecosystem").setFontSize(30).setPosition(header.x + 20, header.y + 10);
      this.runText.setPosition(header.x + 22, header.y + 52);
      const barX = header.x + Math.min(430, header.width * 0.37);
      const barWidth = Math.max(240, header.width - (barX - header.x) - 230);
      this.hpBarBack.setPosition(barX, header.y + 34).setSize(barWidth, 22);
      this.hpBarFill.setPosition(barX + 3, header.y + 34).setSize(barWidth - 6, 16);
      this.hpText.setFontSize(14).setPosition(barX + 8, header.y + 24);
      this.pressureText.setFontSize(12).setPosition(barX + 8, header.y + 58);
      this.currencyText.setFontSize(14).setOrigin(1, 0).setPosition(header.x + header.width - 112, header.y + 51);
      this.optionsButton.setPosition(header.x + header.width - 102, header.y + 12);
      this.optionsButton.setSize(84, 34);
    }

    let ledgerX = 0;
    let ledgerY = 0;
    let ledgerWidth = 0;
    let ledgerHeight = 0;
    if (mobile) {
      const fieldHeight = ledgerUnlocked ? Math.min(350, Math.max(250, height * 0.43)) : height - 122;
      this.fieldBounds = { x: 12, y: 108, width: width - 24, height: fieldHeight };
      if (ledgerUnlocked) {
        ledgerX = 12;
        ledgerY = this.fieldBounds.y + this.fieldBounds.height + 8;
        ledgerWidth = width - 24;
        ledgerHeight = Math.max(190, height - ledgerY - 10);
      }
    } else {
      ledgerX = 22;
      ledgerY = 118;
      ledgerWidth = ledgerUnlocked ? Math.min(314, Math.max(284, width * 0.24)) : 0;
      ledgerHeight = height - ledgerY - 20;
      this.fieldBounds = {
        x: ledgerUnlocked ? ledgerX + ledgerWidth + 14 : 22,
        y: ledgerY,
        width: width - (ledgerUnlocked ? ledgerX + ledgerWidth + 36 : 44),
        height: height - ledgerY - 20,
      };
    }
    this.drawPanel(this.fieldChrome, this.fieldBounds.x, this.fieldBounds.y, this.fieldBounds.width, this.fieldBounds.height, 0.9);
    if (ledgerUnlocked) this.drawPanel(this.fieldChrome, ledgerX, ledgerY, ledgerWidth, ledgerHeight, 0.94);

    this.fieldMaskShape.clear().fillStyle(0xffffff, 1).fillRect(
      this.fieldBounds.x + 6,
      this.fieldBounds.y + 42,
      this.fieldBounds.width - 12,
      this.fieldBounds.height - 48,
    );
    this.fieldSurface.setPosition(this.fieldBounds.x + 6, this.fieldBounds.y + 42).setSize(this.fieldBounds.width - 12, this.fieldBounds.height - 48);
    this.fieldLabelText.setFontSize(mobile ? 12 : 16).setPosition(this.fieldBounds.x + 16, this.fieldBounds.y + (mobile ? 13 : 10));
    this.fieldHintText.setVisible(!mobile).setOrigin(1, 0).setPosition(this.fieldBounds.x + this.fieldBounds.width - 150, this.fieldBounds.y + 15);
    this.zoomOutButton.setPosition(this.fieldBounds.x + this.fieldBounds.width - 138, this.fieldBounds.y + 8).setSize(36, 28);
    this.zoomResetButton.setPosition(this.fieldBounds.x + this.fieldBounds.width - 98, this.fieldBounds.y + 8).setSize(52, 28);
    this.zoomInButton.setPosition(this.fieldBounds.x + this.fieldBounds.width - 42, this.fieldBounds.y + 8).setSize(34, 28);
    this.touchSummaryText.setOrigin(0.5).setPosition(this.fieldBounds.x + this.fieldBounds.width / 2, this.fieldBounds.y + 52);

    this.ledgerTitle.setVisible(ledgerUnlocked);
    this.ledgerStocksLeft.setVisible(ledgerUnlocked);
    this.ledgerStocksRight.setVisible(ledgerUnlocked);
    this.bottleneckText.setVisible(ledgerUnlocked);
    this.worksButton.setVisible(ledgerUnlocked);
    this.cultivationButton.setVisible(ledgerUnlocked);
    if (ledgerUnlocked) {
      this.ledgerTitle.setFontSize(mobile ? 18 : 22).setPosition(ledgerX + 16, ledgerY + 12);
      this.bottleneckText.setPosition(ledgerX + 16, ledgerY + 42).setWordWrapWidth(ledgerWidth - 32);
      const stockY = ledgerY + (mobile ? 68 : 76);
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
    this.memoryChrome.fillStyle(0x071c11, 0.985).fillRect(0, 0, width, height);
    this.memoryChrome.lineStyle(3, 0xd8b66a, 0.9).strokeRect(8, 8, width - 16, height - 16);
    this.memoryTitle.setFontSize(mobile ? 27 : 36).setOrigin(0.5, 0).setPosition(width / 2, 18);
    this.memorySubtitle.setFontSize(mobile ? 10 : 14).setOrigin(0.5, 0).setPosition(width / 2, mobile ? 54 : 62).setWordWrapWidth(width - 40).setAlign("center");
    const summaryWidth = mobile ? width - 32 : Math.min(290, width * 0.25);
    const summaryX = mobile ? 16 : 28;
    const summaryY = mobile ? 86 : 106;
    const summaryHeight = mobile ? 112 : height - 178;
    this.drawPanel(this.memoryChrome, summaryX, summaryY, summaryWidth, summaryHeight, 0.82);
    this.memorySummary.setFontSize(mobile ? 10 : 13).setPosition(summaryX + 14, summaryY + 12).setWordWrapWidth(summaryWidth - 28);
    const offersX = mobile ? 16 : summaryX + summaryWidth + 18;
    const offersY = mobile ? summaryY + summaryHeight + 12 : summaryY;
    const offersWidth = mobile ? width - 32 : width - offersX - 28;
    const offersHeight = mobile ? height - offersY - 112 : height - offersY - 86;
    this.drawPanel(this.memoryChrome, offersX, offersY, offersWidth, offersHeight, 0.78);
    const columns = 2;
    const rows = 4;
    const gap = mobile ? 7 : 12;
    const detailHeight = mobile ? 42 : 62;
    const buttonWidth = (offersWidth - 28 - gap) / columns;
    const buttonHeight = Math.max(42, (offersHeight - 34 - detailHeight - gap * (rows - 1)) / rows);
    for (let index = 0; index < this.memoryOfferButtons.length; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = offersX + 14 + column * (buttonWidth + gap);
      const y = offersY + 14 + row * (buttonHeight + gap);
      this.memoryOfferButtons[index].setPosition(x, y).setSize(buttonWidth, buttonHeight);
      this.memoryOfferButtons[index].label.setFontSize(mobile ? 9 : 11).setWordWrapWidth(buttonWidth - 12);
    }
    this.memoryDetail.setFontSize(mobile ? 10 : 12).setPosition(offersX + 16, offersY + offersHeight - detailHeight).setWordWrapWidth(offersWidth - 32);
    this.memoryPreviousButton.setPosition(offersX, height - 64).setSize(mobile ? 72 : 100, 34);
    this.memoryNextButton.setPosition(offersX + (mobile ? 78 : 108), height - 64).setSize(mobile ? 72 : 100, 34);
    this.beginNextRunButton.setPosition(width - (mobile ? 174 : 264), height - 72).setSize(mobile ? 158 : 236, 46);
    this.memoryChrome.lineStyle(2, 0xd8b66a, 0.34);
    const spineX = offersX + offersWidth / 2;
    const spineTop = this.memoryOfferButtons[0].container.y + this.memoryOfferButtons[0].height / 2;
    const spineBottom = this.memoryOfferButtons[6].container.y + this.memoryOfferButtons[6].height / 2;
    this.memoryChrome.lineBetween(spineX, spineTop, spineX, spineBottom);
    for (let row = 0; row < 4; row += 1) {
      const left = this.memoryOfferButtons[row * 2];
      const right = this.memoryOfferButtons[row * 2 + 1];
      const rowY = left.container.y + left.height / 2;
      this.memoryChrome.lineBetween(left.container.x + left.width, rowY, right.container.x, rowY);
    }
  }

  private layoutOptions(width: number, height: number, mobile: boolean): void {
    this.optionsChrome.clear();
    this.optionsChrome.fillStyle(0x020805, 0.76).fillRect(0, 0, width, height);
    const panelWidth = Math.min(mobile ? width - 32 : 520, width - 24);
    const panelHeight = mobile ? 310 : 330;
    const x = (width - panelWidth) / 2;
    const y = (height - panelHeight) / 2;
    this.drawPanel(this.optionsChrome, x, y, panelWidth, panelHeight, 0.98);
    this.optionsTitle.setOrigin(0.5, 0).setPosition(width / 2, y + 24);
    this.optionsCopy.setOrigin(0.5, 0).setPosition(width / 2, y + 74).setWordWrapWidth(panelWidth - 60).setAlign("center");
    this.optionsMusicButton.setPosition(x + 34, y + 126).setSize(panelWidth - 68, 40);
    this.optionsSfxButton.setPosition(x + 34, y + 174).setSize(panelWidth - 68, 40);
    this.optionsResumeButton.setPosition(x + 34, y + panelHeight - 68).setSize(panelWidth - 68, 44);
  }

  private refreshUi(force: boolean): void {
    const readout = getEcosystemReadout(this.state);
    const elapsedSeconds = Math.floor(readout.elapsedMs / 1_000);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    this.runText.setText(`Run ${this.state.runNumber}  |  ${elapsedMinutes}:${`${elapsedSeconds % 60}`.padStart(2, "0")}  |  ${this.worksOpen ? "Works at 1/4 speed" : "Field active"}`);
    const hpRatio = Phaser.Math.Clamp(readout.hpRatio, 0, 1);
    const hpBarWidth = Math.max(1, this.hpBarBack.width - 6);
    this.hpBarFill.setDisplaySize(Math.max(1, hpBarWidth * hpRatio), this.hpBarFill.height);
    this.hpBarFill.setFillStyle(hpRatio > 0.55 ? 0x83d765 : hpRatio > 0.25 ? 0xf0c85b : 0xe8616a, 1);
    this.hpText.setText(`Ancient HP ${readout.hp.toFixed(1)} / ${readout.maxHp.toFixed(0)}`);
    this.pressureText.setText(`Scourge ${readout.scourgeDemandPerSecond.toFixed(2)} Care/s  |  produced ${readout.careProductionPerSecond.toFixed(2)}/s`);
    this.currencyText.setText(`RT ${readout.runTouches.toFixed(0)}   GT ${this.permanent.grassTouches.toFixed(0)}`);
    this.fieldLabelText.setText(this.scale.width < 760
      ? `${readout.fieldSize}x${readout.fieldSize} | Cultivation ${readout.cultivationRank}/10`
      : `${readout.fieldSize}x${readout.fieldSize} Living Field  |  Cultivation ${readout.cultivationRank}/10`);
    this.fieldHintText.setText(`${this.projection?.lod ?? "near"} view  |  wheel / +/- to zoom`);
    this.bottleneckText.setText(`Bottleneck: ${readout.bottleneck}`);

    const stockLines = PRODUCTION_RESOURCE_IDS.map((resourceId) => {
      const resource = PRODUCTION_RESOURCES[resourceId];
      const buffer = this.state.resources[resourceId];
      const pausedMark = buffer.amount >= buffer.capacity - 0.01 ? " [FULL]" : "";
      return `${resource.shortLabel.padEnd(5)} ${buffer.amount.toFixed(1)}/${buffer.capacity.toFixed(0)}  +${this.state.rates[resourceId].toFixed(2)}${pausedMark}`;
    });
    this.ledgerStocksLeft.setText(stockLines.slice(0, 6).join("\n"));
    this.ledgerStocksRight.setText(stockLines.slice(6).join("\n"));

    for (const helperId of HELPER_IDS) {
      const helper = this.state.helpers[helperId];
      const cost = getHelperPurchaseCost(this.state, helperId);
      const pause = helper.lastPauseReason ? ` | ${helper.lastPauseReason}` : "";
      const label = `${HELPERS[helperId].label} x${helper.count}  Buy ${cost} RT${pause}`;
      this.helperBuyButtons[helperId].setLabel(label).setEnabled(this.state.active && this.state.runTouches >= cost);
      const unlocked = this.permanent.unlockedHelpers[helperId];
      this.factoryHelperButtons[helperId]
        .setVisible(unlocked)
        .setLabel(`${HELPERS[helperId].label} x${helper.count} | Buy ${cost} RT`)
        .setEnabled(this.state.active && this.state.runTouches >= cost);
      const mode = HELPERS[helperId].modes.find((candidate) => candidate.id === helper.modeId)!;
      const availableModes = HELPERS[helperId].modes.filter((candidate) => this.permanent.unlockedModes[helperId].includes(candidate.id));
      const cooldown = helper.reconfigureRemainingMs > 0 ? ` (${Math.ceil(helper.reconfigureRemainingMs / 1_000)}s)` : "";
      this.factoryModeButtons[helperId]
        .setVisible(unlocked)
        .setLabel(`Mode: ${mode.label}${cooldown}`)
        .setEnabled(helper.count > 0 && availableModes.length > 1 && helper.reconfigureRemainingMs <= 0);
    }

    const cultivationCost = getCultivationCost(this.state);
    const cultivationComplete = this.state.field.cultivationRank >= 10;
    this.cultivationButton
      .setLabel(cultivationComplete ? "Cultivation complete" : `Cultivate ${this.state.field.cultivationRank + 1}/10 | ${cultivationCost} Growth`)
      .setEnabled(!cultivationComplete && this.state.resources.growth.amount >= cultivationCost);
    this.zoomOutButton.setEnabled(this.fieldView.zoom > FIELD_MIN_ZOOM + 0.01);
    this.zoomInButton.setEnabled(this.fieldView.zoom < FIELD_MAX_ZOOM - 0.01);

    for (const resourceId of PRODUCTION_RESOURCE_IDS) {
      const buffer = this.state.resources[resourceId];
      this.factoryResourceTexts[resourceId].setText(
        `${PRODUCTION_RESOURCES[resourceId].label}\n${buffer.amount.toFixed(1)} / ${buffer.capacity.toFixed(0)}\n+${this.state.rates[resourceId].toFixed(2)}/s`,
      );
      this.factoryResourceBacks[resourceId].setFillStyle(
        buffer.amount >= buffer.capacity - 0.01 ? 0x412f1d : 0x0b2617,
        0.96,
      );
    }
    this.factoryBottleneck.setText(`Current bottleneck: ${this.state.bottleneck}`);
    this.optionsMusicButton.setLabel(`Music volume: ${Math.round(this.musicVolume * 100)}%`);
    this.optionsSfxButton.setLabel(`SFX volume: ${Math.round(this.sfxVolume * 100)}%`);

    if (!this.state.active) {
      const summary = this.state.endedSummary;
      this.memorySummary.setText(summary
        ? [
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
      this.updateMemoryOfferButtons();
    }
    this.beginNextRunButton.container.setScale(1 + Math.sin(this.time.now * 0.004) * 0.018);
    this.domBridge?.update(this.state, this.permanent, this.worksOpen, this.optionsOpen);
    this.updateHarnessDataset();
    if (force) this.syncViewVisibility();
  }

  private renderField(force: boolean): void {
    const viewport = {
      x: this.fieldBounds.x + 8,
      y: this.fieldBounds.y + 44,
      width: Math.max(1, this.fieldBounds.width - 16),
      height: Math.max(1, this.fieldBounds.height - 52),
    };
    this.projection = projectField(this.state.field.width, this.state.field.height, viewport, this.fieldView);
    const dirty = this.state.field.dirtyChunks.some((value) => value === 1);
    if (!force && !dirty) return;

    for (const image of this.tilePool) image.setVisible(false);
    for (const image of this.chunkPool) image.setVisible(false);
    this.fieldGrid.clear();
    const mobileBudget = this.scale.width < 760 ? MAX_NEAR_TILE_VIEWS_PHONE : MAX_NEAR_TILE_VIEWS_DESKTOP;
    const near = this.projection.lod === "near" && this.projection.visibleTiles.count <= mobileBudget;
    if (near) {
      this.renderedTileViews = this.renderNearTiles(mobileBudget);
      this.renderedChunkViews = 0;
    } else {
      this.renderedTileViews = 0;
      this.renderedChunkViews = this.renderChunkTiles();
    }
    this.layoutHelperActors();
    clearDirtyChunks(this.state.field);
  }

  private renderNearTiles(budget: number): number {
    const range = this.projection.visibleTiles;
    let poolIndex = 0;
    const visualSize = Math.min(240, this.projection.cellSize * 0.9);
    this.fieldGrid.lineStyle(this.projection.cellSize >= 38 ? 2 : 1, 0x3f271c, 0.62);
    for (let y = range.startY; y <= range.endY && poolIndex < budget; y += 1) {
      for (let x = range.startX; x <= range.endX && poolIndex < budget; x += 1) {
        const tileIndex = y * this.state.field.width + x;
        const stage = this.state.field.stages[tileIndex] as TileStage;
        const image = this.tilePool[poolIndex];
        const variants = TILE_VARIANTS[stage];
        image.setTexture(variants[(tileIndex * 17 + stage * 3) % variants.length]);
        const screenX = this.projection.originX + (x + 0.5) * this.projection.cellSize;
        const screenY = this.projection.originY + (y + 0.5) * this.projection.cellSize;
        image.setPosition(screenX, screenY).setDisplaySize(visualSize, visualSize).setVisible(true).setAlpha(0.94);
        image.setData("baseY", screenY);
        image.setData("tileIndex", tileIndex);
        if (this.projection.cellSize >= 24) {
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
    const owned = HELPER_IDS.filter((helperId) => this.state.helpers[helperId].count > 0);
    const actorSize = Phaser.Math.Clamp(Math.min(this.fieldBounds.width / Math.max(5, owned.length + 1), 54), 26, 54);
    for (const helperId of HELPER_IDS) {
      const actor = this.helperActors[helperId];
      const index = owned.indexOf(helperId);
      const visible = index >= 0;
      actor.image.setVisible(visible);
      actor.countText.setVisible(visible);
      if (!visible) continue;
      const fraction = (index + 1) / (owned.length + 1);
      actor.baseX = this.fieldBounds.x + 24 + fraction * (this.fieldBounds.width - 48);
      actor.baseY = this.fieldBounds.y + this.fieldBounds.height - actorSize * 0.72;
      actor.image.setPosition(actor.baseX, actor.baseY).setDisplaySize(actorSize, actorSize);
      actor.countText.setText(`x${this.state.helpers[helperId].count}`).setPosition(actor.baseX, actor.baseY + actorSize * 0.45);
    }
  }

  private animateLivingField(now: number): void {
    for (let index = 0; index < this.renderedTileViews; index += 1) {
      const image = this.tilePool[index];
      const phase = Number(image.getData("phase"));
      const baseY = Number(image.getData("baseY"));
      const speed = 0.0012 + (index % 7) * 0.00007;
      image.y = baseY + Math.sin(now * speed + phase) * Math.min(2.4, this.projection.cellSize * 0.035);
      image.rotation = Math.sin(now * speed * 0.73 + phase * 1.4) * 0.012;
    }
    for (const helperId of HELPER_IDS) {
      const actor = this.helperActors[helperId];
      if (!actor.image.visible) continue;
      actor.image.x = actor.baseX + Math.sin(now * 0.0011 + actor.phase) * 4;
      actor.image.y = actor.baseY + Math.sin(now * 0.0017 + actor.phase) * 3;
      actor.image.rotation = Math.sin(now * 0.0013 + actor.phase) * 0.05;
      actor.countText.x = actor.image.x;
      actor.countText.y = actor.image.y + actor.image.displayHeight * 0.45;
    }
  }

  private spawnHelperEffect(helperId: HelperId): void {
    const actor = this.helperActors[helperId];
    if (!actor.image.visible || !this.state.active || this.worksOpen) return;
    const effect = this.effectPool.find((candidate) => !candidate.visible);
    if (!effect) return;
    const targetX = Phaser.Math.Clamp(
      this.projection.originX + Math.random() * this.projection.worldWidth,
      this.fieldBounds.x + 22,
      this.fieldBounds.x + this.fieldBounds.width - 22,
    );
    const targetY = Phaser.Math.Clamp(
      this.projection.originY + Math.random() * this.projection.worldHeight,
      this.fieldBounds.y + 58,
      this.fieldBounds.y + this.fieldBounds.height - 36,
    );
    effect.setTexture(HELPER_EFFECT_TEXTURE[helperId]).setPosition(actor.image.x, actor.image.y).setDisplaySize(18, 18).setAlpha(1).setScale(1).setVisible(true);
    this.tweens.killTweensOf(effect);
    this.tweens.add({
      targets: effect,
      x: targetX,
      y: targetY,
      rotation: Math.PI * 2,
      scale: 0.72,
      alpha: 0.25,
      duration: 620 + HELPER_IDS.indexOf(helperId) * 32,
      ease: "Sine.easeInOut",
      onComplete: () => effect.setVisible(false),
    });
  }

  private showTouchImpacts(result: TouchBatchResult): void {
    for (let index = 0; index < result.representativeImpacts.length && index < this.impactPool.length; index += 1) {
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

  private touchTile(tileIndex: number): void {
    if (!this.state.active || this.worksOpen || this.optionsOpen) return;
    const result = touchFieldTile(this.state, this.permanent, tileIndex);
    if (!result) return;
    this.audio.playGrassTouch("normal", "lush", result.fieldEmbraceTriggered, result.affectedTileCount);
    this.showTouchImpacts(result);
    this.renderField(true);
    this.refreshUi(false);
  }

  private buyHelperFromUi(helperId: HelperId): void {
    if (buyHelper(this.state, this.permanent, helperId)) {
      this.audio.play("upgrade");
      const button = this.worksOpen ? this.factoryHelperButtons[helperId] : this.helperBuyButtons[helperId];
      this.tweens.add({ targets: button.container, scale: 1.06, yoyo: true, duration: 110 });
      this.layoutHelperActors();
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
      if (previousSize !== this.state.field.width) this.resetFieldView();
      this.renderField(true);
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
    if (!this.state.active || !this.permanent.unlockedHelpers.tinySprinkler || this.optionsOpen) return;
    this.worksOpen = !this.worksOpen;
    this.audio.play("skill_select");
    this.syncViewVisibility();
    this.refreshUi(true);
    this.persistAll();
  }

  private toggleOptions(): void {
    this.optionsOpen = !this.optionsOpen;
    this.audio.play("skill_select");
    this.syncViewVisibility();
    this.refreshUi(true);
  }

  private beginNextRun(): void {
    if (this.state.active) return;
    this.state = createNextEcosystemRun(this.permanent);
    this.lastGameOverState = false;
    this.memoryPage = 0;
    this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    this.audio.play("milestone");
    this.layout(this.scale.width, this.scale.height);
    this.syncViewVisibility();
    this.renderField(true);
    this.persistAll();
    this.refreshUi(true);
  }

  private performMemoryPurchase(action: () => boolean): void {
    if (this.state.active) return;
    if (action()) {
      this.audio.play("unlock");
      savePermanentEcosystemState(this.permanent);
      this.refreshMemoryOffers();
      this.layout(this.scale.width, this.scale.height);
      this.refreshUi(true);
    } else {
      this.audio.play("blocked");
    }
  }

  private refreshMemoryOffers(): void {
    const offers: MemoryOffer[] = [];
    const nextHelper = HELPER_IDS.find((helperId) => {
      if (this.permanent.unlockedHelpers[helperId]) return false;
      const prerequisite = HELPERS[helperId].unlockRequires;
      return !prerequisite || this.permanent.unlockedHelpers[prerequisite];
    });
    if (nextHelper) {
      const cost = getHelperUnlockCost(nextHelper);
      offers.push({
        label: `Awaken ${HELPERS[nextHelper].label}\n${cost} GT`,
        detail: `Reveals ${HELPERS[nextHelper].label} in the Living Ledger and adds its recipes to Ecosystem Works.`,
        cost,
        affordable: this.permanent.grassTouches >= cost,
        action: () => unlockHelper(this.permanent, nextHelper),
      });
    }

    for (const helperId of HELPER_IDS) {
      if (!this.permanent.unlockedHelpers[helperId]) continue;
      const alternate = HELPERS[helperId].modes[1];
      if (!this.permanent.unlockedModes[helperId].includes(alternate.id)) {
        const cost = getModeUnlockCost(helperId);
        offers.push({
          label: `${HELPERS[helperId].label}\n${alternate.label} mode\n${cost} GT`,
          detail: alternate.description,
          cost,
          affordable: this.permanent.grassTouches >= cost,
          action: () => unlockHelperMode(this.permanent, helperId, alternate.id),
        });
      }
      for (const kind of ["throughput", "storage", "efficiency", "startingStock"] as const) {
        const rank = kind === "throughput"
          ? this.permanent.throughputRanks[helperId]
          : kind === "storage"
            ? this.permanent.storageRanks[helperId]
            : kind === "efficiency"
              ? this.permanent.efficiencyRanks[helperId]
              : this.permanent.startingStockRanks[helperId];
        const maxRank = kind === "startingStock" ? 5 : 10;
        if (rank >= maxRank) continue;
        const cost = getPermanentRankCost(this.permanent, helperId, kind);
        const details: Record<PermanentRankKind, string> = {
          throughput: "Each rank makes this helper's recipes 12% faster.",
          storage: "Each rank adds 15% storage to this helper's part of the chain.",
          efficiency: "Each rank reduces this helper's recipe inputs by 3.5%.",
          startingStock: "Each rank carries three units of useful starting stock into a new run.",
        };
        offers.push({
          label: `${HELPERS[helperId].label}\n${this.formatRankKind(kind)} ${rank + 1}/${maxRank}\n${cost} GT`,
          detail: details[kind],
          cost,
          affordable: this.permanent.grassTouches >= cost,
          action: () => purchasePermanentRank(this.permanent, helperId, kind),
        });
      }
    }

    if (this.permanent.maxFieldTier < FIELD_SIZE_LADDER.length - 1) {
      const nextTier = this.permanent.maxFieldTier + 1;
      const cost = getFieldTierUnlockCost(nextTier);
      offers.push({
        label: `Field Memory\nMax ${FIELD_SIZE_LADDER[nextTier]}x${FIELD_SIZE_LADDER[nextTier]}\n${cost} GT`,
        detail: `Allows Cultivation rank ten to expand a run from ${FIELD_SIZE_LADDER[nextTier - 1]}x${FIELD_SIZE_LADDER[nextTier - 1]} to ${FIELD_SIZE_LADDER[nextTier]}x${FIELD_SIZE_LADDER[nextTier]}.`,
        cost,
        affordable: this.permanent.grassTouches >= cost,
        action: () => unlockNextFieldTier(this.permanent),
      });
    }
    if (this.permanent.broadPalmRank < 10) {
      const rank = this.permanent.broadPalmRank;
      const cost = getTouchRankCost("broadPalm", rank);
      offers.push({
        label: `Broad Palm ${rank + 1}/10\n${cost} GT`,
        detail: "Touches nearby tiles. Higher ranks widen the radius and raise area effectiveness from 40% to 100%.",
        cost,
        affordable: this.permanent.grassTouches >= cost,
        action: () => purchaseTouchRank(this.permanent, "broadPalm"),
      });
    }
    if (this.permanent.broadPalmRank >= 2 && this.permanent.manyHandsRank < 10) {
      const rank = this.permanent.manyHandsRank;
      const cost = getTouchRankCost("manyHands", rank);
      offers.push({
        label: `Many Hands ${rank + 1}/10\n${cost} GT`,
        detail: "Each manual touch also reaches two random distant tiles per rank, with improving effectiveness.",
        cost,
        affordable: this.permanent.grassTouches >= cost,
        action: () => purchaseTouchRank(this.permanent, "manyHands"),
      });
    }
    if (!this.permanent.fieldEmbrace && this.permanent.broadPalmRank >= 10 && this.permanent.manyHandsRank >= 10) {
      offers.push({
        label: "Field Embrace\n180 GT",
        detail: "Every tenth manual touch sends a half-strength wave to one random tile in every 10x10 chunk.",
        cost: 180,
        affordable: this.permanent.grassTouches >= 180,
        action: () => purchaseFieldEmbrace(this.permanent),
      });
    }
    this.memoryOffers = offers;
    const pageCount = Math.max(1, Math.ceil(offers.length / this.memoryOfferButtons.length));
    this.memoryPage = Phaser.Math.Clamp(this.memoryPage, 0, pageCount - 1);
    this.updateMemoryOfferButtons();
  }

  private updateMemoryOfferButtons(): void {
    const pageSize = this.memoryOfferButtons.length;
    const pageCount = Math.max(1, Math.ceil(this.memoryOffers.length / pageSize));
    for (let index = 0; index < pageSize; index += 1) {
      const offer = this.memoryOffers[this.memoryPage * pageSize + index];
      this.memoryOfferButtons[index]
        .setVisible(Boolean(offer))
        .setLabel(offer?.label ?? "")
        .setEnabled(Boolean(offer?.affordable));
    }
    this.memoryPreviousButton.setLabel(`Previous ${this.memoryPage + 1}/${pageCount}`).setEnabled(this.memoryPage > 0);
    this.memoryNextButton.setLabel(`Next ${this.memoryPage + 1}/${pageCount}`).setEnabled(this.memoryPage < pageCount - 1);
  }

  private previewMemoryOffer(index: number): void {
    const offer = this.memoryOffers[this.memoryPage * this.memoryOfferButtons.length + index];
    if (offer) this.memoryDetail.setText(`${offer.detail}  Cost: ${offer.cost} GT.`);
  }

  private buyMemoryOffer(index: number): void {
    const offer = this.memoryOffers[this.memoryPage * this.memoryOfferButtons.length + index];
    if (!offer || !offer.affordable) {
      this.audio.play("blocked");
      return;
    }
    this.performMemoryPurchase(offer.action);
  }

  private changeMemoryPage(delta: number): void {
    const pageCount = Math.max(1, Math.ceil(this.memoryOffers.length / this.memoryOfferButtons.length));
    this.memoryPage = Phaser.Math.Clamp(this.memoryPage + delta, 0, pageCount - 1);
    this.audio.play("skill_select");
    this.updateMemoryOfferButtons();
  }

  private formatRankKind(kind: PermanentRankKind): string {
    if (kind === "startingStock") return "Starting Stock";
    return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  }

  private adjustFieldZoom(factor: number): void {
    if (!this.state.active || this.worksOpen || this.optionsOpen) return;
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
    this.fieldRoot.setVisible(this.state.active && !this.worksOpen);
    this.factoryRoot.setVisible(this.state.active && this.worksOpen);
    this.memoryRoot.setVisible(!this.state.active);
    this.optionsRoot.setVisible(this.optionsOpen);
  }

  private persistAll(): void {
    savePermanentEcosystemState(this.permanent);
    if (this.state.active) {
      const view: ActiveFieldViewSnapshot = { ...this.fieldView };
      saveActiveField(this.state, view);
    } else {
      clearActiveField();
    }
  }

  private resetPrototypeSave(): void {
    clearActiveField();
    localStorage.removeItem("grass-touching-simulator.ecosystem-memory.v1");
    this.permanent = createPermanentEcosystemState();
    this.state = createEcosystemState(this.permanent);
    this.fieldView = { centerX: 0.5, centerY: 0.5, zoom: 1 };
    this.worksOpen = false;
    this.optionsOpen = false;
    this.lastGameOverState = false;
    this.refreshMemoryOffers();
    this.layout(this.scale.width, this.scale.height);
    this.syncViewVisibility();
    this.renderField(true);
    this.persistAll();
    this.refreshUi(true);
  }

  private updateHarnessDataset(): void {
    const readout = getEcosystemReadout(this.state);
    document.documentElement.dataset.grassEcosystemHarness = JSON.stringify({
      route: "ecosystemPrototype",
      field: `${this.state.field.width}x${this.state.field.height}`,
      logicalTiles: readout.logicalTiles,
      lod: this.projection?.lod ?? "near",
      renderedTileViews: this.renderedTileViews,
      renderedChunkViews: this.renderedChunkViews,
      dirtyChunks: readout.dirtyChunks,
      fixedTicks: readout.fixedTicks,
      activeEffects: this.effectPool.filter((effect) => effect.visible).length + this.impactPool.filter((impact) => impact.visible).length,
      latestFrameDeltaMs: Number(this.latestFrameDeltaMs.toFixed(2)),
      maxFrameDeltaMs: Number(this.maxFrameDeltaMs.toFixed(2)),
      frameSpikes: this.frameSpikes,
      fullFieldScans: 0,
      productionRunsPerFrame: 0,
    });
  }

  private pointInField(x: number, y: number): boolean {
    return x >= this.fieldBounds.x && x <= this.fieldBounds.x + this.fieldBounds.width &&
      y >= this.fieldBounds.y + 42 && y <= this.fieldBounds.y + this.fieldBounds.height;
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
        text.setText(nextLabel);
        return button;
      },
      setEnabled: (enabled: boolean) => {
        button.enabled = enabled;
        syncAppearance();
        return button;
      },
      setVisible: (visible: boolean) => {
        button.visible = visible;
        syncAppearance();
        return button;
      },
    });
    bg.on("pointerover", () => {
      if (button.enabled) bg.setFillStyle(0x2f6c42, 1).setStrokeStyle(2, 0xffe889, 1);
    });
    bg.on("pointerout", () => syncAppearance());
    bg.on("pointerdown", () => {
      if (button.enabled) container.setScale(0.975);
    });
    bg.on("pointerup", () => {
      container.setScale(1);
      if (button.enabled && button.visible) onClick();
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
    this.persistAll();
    this.music?.stop();
    this.domBridge?.destroy();
    window.removeEventListener("pagehide", this.handlePageHide);
    this.scale.off(Phaser.Scale.Events.RESIZE);
  }
}
