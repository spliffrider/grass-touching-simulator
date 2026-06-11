import Phaser from "phaser";
import { DEFAULT_MUSIC_VOLUME, readStoredMusicVolume, writeStoredMusicVolume } from "../data/audio-settings";
import { GRASS_TIERS, getGrassTier, getNextGrassTier } from "../data/grass-tiers";
import { BUILD_LABEL } from "../data/build-info";
import { GOLD_STORE_ITEMS } from "../data/gold-store";
import { JOURNAL_COMPANION_NOTES, JOURNAL_GRASS_NOTES, JOURNAL_TRAIT_NOTES, JOURNAL_WEATHER_NOTES } from "../data/journal";
import { MILESTONES } from "../data/milestones";
import { QUESTS, formatQuestProgress, formatQuestReward, isQuestAvailable, isQuestClaimable, type QuestDefinition } from "../data/quests";
import { SEED_SHOP_ITEMS, getSeedDropChance } from "../data/seed-shop";
import { getSeasonForDate } from "../data/seasons";
import { UPGRADES, canUnlockUpgrade, getUpgradeCost } from "../data/upgrades";
import { WEATHER_TYPES, getWeather, pickWeather } from "../data/weather";
import { expandField, getFieldBounds, getFieldTiles, getRegrowingTiles, tileKey, touchTile, updateRegrowth } from "../systems/FieldSystem";
import { addInventoryItem, consumeInventoryItem, getInventoryQuantity } from "../systems/InventorySystem";
import { AnimalCompanionSystem } from "../systems/AnimalCompanionSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { ChiptuneMusicSystem } from "../systems/ChiptuneMusicSystem";
import { ComboSystem, type ComboResult } from "../systems/ComboSystem";
import { DropSystem, type DropFeedback } from "../systems/DropSystem";
import { loadGame, resetSave, saveGame } from "../systems/SaveSystem";
import { SprinklerSystem } from "../systems/SprinklerSystem";
import { getRuntimeStats } from "../systems/UpgradeSystem";
import type { FieldTile, GameState, GrassTierId, TileKey, TileTrait, TouchResult, WeatherId } from "../types/game-state";
import { createTextButton, setTextButtonEnabled, setTextButtonText } from "../ui/buttons";

const TILE_SIZE = 58;
const TILE_GAP = 8;
const BOARD_Y_OFFSET = 24;
const MIN_BOARD_ZOOM = 0.45;
const MAX_BOARD_ZOOM = 3.2;
const BOARD_PAN_THRESHOLD_PX = 18;
const TOUCH_SHAKE_COOLDOWN_MS = 140;
const TREE_WIDTH = 880;
const TREE_HEIGHT = 560;
const COMBO_AOE_MIN_COUNT = 10;
const COMBO_AOE_HIGH_COUNT = 20;
const COMBO_AOE_CHANCE = 0.25;
const COMBO_AOE_HIGH_CHANCE = 0.5;
const PERFECT_TOUCH_WINDOW_MS = 800;
const PERFECT_TOUCH_BONUS_MULTIPLIER = 0.5;
const GOLDEN_HOUR_PERFECT_GOLD_CHANCE = 0.35;
const WILDFLOWER_POLLINATE_CHANCE = 0.35;
const MUSHROOM_SPORE_CHANCE = 0.3;
const CRYSTAL_GOLD_CHANCE = 0.28;
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
const SKILL_NODE_VISUAL_SIZE = 58;
const SKILL_DETAIL_WIDTH = 360;
const SKILL_DETAIL_HEIGHT = 400;
const SHOP_ICON_SIZE = 48;
const PANEL_SLICE = 18;

const SKILL_BRANCH_LABELS = [
  { text: "Touch", x: 230, y: 50, color: "#dfffc8" },
  { text: "Growth", x: 430, y: 190, color: "#bff4ff" },
  { text: "Nature", x: 660, y: 50, color: "#d7fff2" },
  { text: "Crits", x: 420, y: 525, color: "#ffef78" },
  { text: "Meadow", x: 700, y: 335, color: "#dfffc8" },
];

const getSkillIconKey = (upgradeId: string): string => `skill-${upgradeId.replace(/_/g, "-")}`;

const SEED_SHOP_ICON_KEYS: Record<string, string> = {
  seed_pouch: "item-seed-pouch",
  sprinkler: "world-tiny-sprinkler",
  wild_spread: "item-wild-spread",
  field_journal: "item-field-journal",
  weather_jar: "item-weather-jar",
  compost_bin: "item-compost-bin",
  bug_hotel: "item-bug-hotel",
  rain_barrel: "item-rain-barrel",
  sprinkler_timer: "item-sprinkler-timer",
  self_seeding_nozzle: "item-self-seeding-nozzle",
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

const WORLD_OBJECTS = [
  { id: "sprinkler", textureKey: "world-tiny-sprinkler", label: "sprinkler", kind: "seed" },
  { id: "bee_hive", textureKey: "world-bee-hive", label: "hive", kind: "inventory" },
  { id: "chicken", textureKey: "world-chicken", label: "chicken", kind: "inventory" },
  { id: "sheep", textureKey: "world-sheep", label: "sheep", kind: "inventory" },
  { id: "field_mouse", textureKey: "world-field-mouse", label: "mouse", kind: "inventory" },
  { id: "meadow_rabbit", textureKey: "world-meadow-rabbit", label: "rabbit", kind: "inventory" },
  { id: "earthworm", textureKey: "world-earthworm", label: "worm", kind: "inventory" },
] satisfies Array<{ id: string; textureKey: string; label: string; kind: "seed" | "inventory" }>;

interface TileView {
  base: Phaser.GameObjects.Image;
  grass: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  outline: Phaser.GameObjects.Rectangle;
  glint: Phaser.GameObjects.Star;
}

interface SkillNodeView {
  upgradeId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  frame: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Image;
  lockedIcon: Phaser.GameObjects.Text;
  level: Phaser.GameObjects.Text;
}

interface SeedShopItemView {
  itemId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  iconBg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

interface GoldStoreItemView {
  itemId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  iconBg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
}

interface QuestItemView {
  questId: string;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  progress: Phaser.GameObjects.Text;
  reward: Phaser.GameObjects.Text;
  claimButton: Phaser.GameObjects.Container;
}

type QuestFilterId = "all" | "ready" | "active" | "journal" | "claimed";

interface QuestFilterView {
  filterId: QuestFilterId;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

const QUEST_FILTERS: Array<{ id: QuestFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "ready", label: "Ready" },
  { id: "active", label: "Active" },
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

interface SkillBranchLabelView {
  text: Phaser.GameObjects.Text;
  treeX: number;
  treeY: number;
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private tileViews = new Map<TileKey, TileView>();
  private recentlyRegrownAt = new Map<TileKey, number>();
  private perfectTouchCues = new Map<TileKey, Phaser.GameObjects.GameObject[]>();
  private worldObjectViews = new Map<string, WorldObjectView>();
  private emeraldBackground!: Phaser.GameObjects.Image;
  private ambientSpores?: Phaser.GameObjects.Particles.ParticleEmitter;
  private titleText!: Phaser.GameObjects.Text;
  private buildLabelText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private comboBadge!: Phaser.GameObjects.Container;
  private comboBadgeBg!: Phaser.GameObjects.Rectangle;
  private comboBadgeText!: Phaser.GameObjects.Text;
  private comboBadgeMeter!: Phaser.GameObjects.Rectangle;
  private milestoneText!: Phaser.GameObjects.Text;
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
  private journalButton!: Phaser.GameObjects.Container;
  private optionsButton!: Phaser.GameObjects.Container;
  private skillRoot!: Phaser.GameObjects.Container;
  private skillBackdrop!: Phaser.GameObjects.Rectangle;
  private skillBackdropPattern!: Phaser.GameObjects.Image;
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
  private storeBackButton!: Phaser.GameObjects.Container;
  private storeItemViews = new Map<string, GoldStoreItemView>();
  private questRoot!: Phaser.GameObjects.Container;
  private questBackdrop!: Phaser.GameObjects.Rectangle;
  private questTitleText!: Phaser.GameObjects.Text;
  private questResourceText!: Phaser.GameObjects.Text;
  private questStatusText!: Phaser.GameObjects.Text;
  private questBackButton!: Phaser.GameObjects.Container;
  private questItemViews = new Map<string, QuestItemView>();
  private questFilterViews = new Map<QuestFilterId, QuestFilterView>();
  private journalRoot!: Phaser.GameObjects.Container;
  private journalBackdrop!: Phaser.GameObjects.Rectangle;
  private journalTitleText!: Phaser.GameObjects.Text;
  private journalResourceText!: Phaser.GameObjects.Text;
  private journalStatusText!: Phaser.GameObjects.Text;
  private journalBodyText!: Phaser.GameObjects.Text;
  private journalBackButton!: Phaser.GameObjects.Container;
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
  private lastAutoSaveAt = 0;
  private sprinkler = new SprinklerSystem();
  private animalCompanions = new AnimalCompanionSystem();
  private combo = new ComboSystem();
  private drops = new DropSystem();
  private audio = new AudioSystem();
  private music = new ChiptuneMusicSystem();
  private skillTreeOpen = false;
  private questLogOpen = false;
  private journalOpen = false;
  private seedShopOpen = false;
  private storeOpen = false;
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
    this.load.image("emerald-bg", "/assets/ui/emerald-bg.png");
    this.load.image("panel-emerald", "/assets/ui/panel-emerald.png");
    this.load.image("button-emerald-normal", "/assets/ui/button-emerald-normal.png");
    this.load.image("button-emerald-hover", "/assets/ui/button-emerald-hover.png");
    this.load.image("button-emerald-active", "/assets/ui/button-emerald-active.png");
    this.load.image("node-hexagon-frame", "/assets/ui/node-hexagon-frame.png");
    this.load.image("selector-gold", "/assets/ui/selector-gold.png");

    for (const itemKey of new Set([...Object.values(SEED_SHOP_ICON_KEYS), ...Object.values(GOLD_STORE_ICON_KEYS)])) {
      if (itemKey.startsWith("world-")) {
        continue;
      }

      this.load.image(itemKey, `/assets/ui/items/${itemKey.replace("item-", "")}.png`);
    }

    for (const upgrade of UPGRADES) {
      const fileName = upgrade.id.replace(/_/g, "-");
      this.load.image(getSkillIconKey(upgrade.id), `/assets/ui/skills/${fileName}.png`);
    }

    this.load.image("effect-water-drop", "/assets/effects/water-drop.png");
    this.load.image("effect-pollen-fleck", "/assets/effects/pollen-fleck.png");
    this.load.image("effect-bee-pixel", "/assets/effects/bee-pixel.png");
    this.load.image("effect-gold-coin", "/assets/effects/gold-coin.png");
    this.load.image("effect-seed-kernel", "/assets/effects/seed-kernel.png");
    this.load.image("effect-magic-spore", "/assets/effects/magic-spore.png");
  }

  create(data?: { newGame?: boolean }): void {
    this.state = data?.newGame ? resetSave() : loadGame();
    this.musicVolume = readStoredMusicVolume();
    this.music.setVolume(this.musicVolume);
    this.music.setTrack(this.state.selectedTrackId || "cozy_meadow");
    this.updateJournalDiscoveries();
    saveGame(this.state);

    this.cameras.main.setBackgroundColor("#06190f");
    this.createEmeraldBackdrop();
    this.updateWeather(Date.now(), false);
    this.createTileTextures();
    this.createHeader();
    this.createSeasonVisuals();
    this.createWeatherVisuals();
    this.createTileInfoPanel();
    this.createSkillTree();
    this.createQuestLog();
    this.createJournal();
    this.createSeedShop();
    this.createGoldStore();
    this.createOptionsPanel();
    this.renderAllTiles();
    this.layoutHeader();
    this.layoutSkillTree();
    this.layoutSeedShop();
    this.refreshUi();
    this.readyUnlockKeys = this.getReadyUnlockKeys();
    this.readyQuestKeys = this.getReadyQuestKeys();
    this.showMessage("Touch the grass. Let it regrow. Become reasonable.", 3600);

    this.scale.on("resize", () => {
      this.layoutHeader();
      this.layoutEmeraldBackdrop();
      this.layoutSeasonVisuals();
      this.layoutWeatherVisuals();
      this.layoutTiles();
      this.layoutSkillTree();
      this.layoutQuestLog();
      this.layoutJournal();
      this.layoutSeedShop();
      this.layoutGoldStore();
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

      this.zoomBoard(deltaY, pointer.x, pointer.y);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      this.music.start(this.musicVolume);

      if (this.hasBlockingOverlayOpen() || gameObjects.length > 0) {
        return;
      }

      this.isBoardPanArmed = true;
      this.isPanningBoard = false;
      this.boardPanStartX = this.boardPanX;
      this.boardPanStartY = this.boardPanY;
      this.pointerPanStartX = pointer.x;
      this.pointerPanStartY = pointer.y;
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
        this.boardPanStartX = this.boardPanX;
        this.boardPanStartY = this.boardPanY;
        this.pointerPanStartX = pointer.x;
        this.pointerPanStartY = pointer.y;
        this.tileInfoPanel.setVisible(false);
        return;
      }

      if (!this.isPanningBoard) {
        return;
      }

      this.boardPanX = this.boardPanStartX + pointer.x - this.pointerPanStartX;
      this.boardPanY = this.boardPanStartY + pointer.y - this.pointerPanStartY;
      this.layoutTiles();
    });

    this.input.on("pointerup", () => {
      this.isBoardPanArmed = false;
      this.isPanningBoard = false;
      this.draggingMusicVolume = false;
    });

    this.input.on("pointerupoutside", () => {
      this.isBoardPanArmed = false;
      this.isPanningBoard = false;
      this.draggingMusicVolume = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handleMusicVolumeDrag(pointer));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.music.stop());
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
    this.updateWeather(now, true);
    const stats = getRuntimeStats(this.state);
    const regrown = updateRegrowth(this.state, stats, now);

    for (const tile of regrown) {
      this.markRecentlyRegrown(tile, now);
      this.refreshTile(tile);
      this.playRegrowFeedback(tile);
      this.popAtTile(tile, tile.trait === "lush" ? "lush" : tile.trait === "dewy" ? "dew" : "grass", "#e7ffd1");
    }

    if (regrown.length > 0) {
      this.audio.play("regrow");
    }

    this.checkMilestones(stats);
    this.combo.update(now);
    this.pruneRecentlyRegrown(now);
    let journalChanged = this.updateJournalDiscoveries();
    this.updateSprinkler(delta, stats);
    this.updateAnimalCompanions(delta, stats);
    this.checkReadyUnlocks();
    this.checkReadyQuests();
    journalChanged = this.updateJournalDiscoveries() || journalChanged;
    if (journalChanged) {
      saveGame(this.state);
    }
    this.refreshUi();

    this.lastAutoSaveAt += delta;
    if (this.lastAutoSaveAt >= 5000) {
      this.lastAutoSaveAt = 0;
      saveGame(this.state);
    }
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
      .setDepth(20);

    this.buildLabelText = this.add
      .text(26, 50, BUILD_LABEL, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setDepth(20)
      .setAlpha(0.82);

    this.resourceText = this.add
      .text(26, 62, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#173b20",
        backgroundColor: "#e9ffd0",
        padding: { x: 12, y: 8 },
      })
      .setDepth(20);

    this.comboBadge = this.add.container(0, 0).setDepth(22).setVisible(false);
    this.comboBadgeBg = this.add
      .rectangle(0, 0, 178, 40, 0x12341c, 0.94)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xf4df6a, 0.78);
    this.comboBadgeText = this.add
      .text(12, -10, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#06190f",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);
    this.comboBadgeMeter = this.add.rectangle(12, 12, 0, 4, 0xf4df6a, 0.92).setOrigin(0, 0.5);
    this.comboBadge.add([this.comboBadgeBg, this.comboBadgeText, this.comboBadgeMeter]);

    this.milestoneText = this.add
      .text(26, 108, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#fff7c7",
        stroke: "#215228",
        strokeThickness: 4,
        wordWrap: { width: 420 },
      })
      .setDepth(20);

    this.skillButton = createTextButton(this, "Skills", () => this.openSkillTree(), 118, 44, 20);
    this.questButton = createTextButton(this, "Quests", () => this.openQuestLog(), 118, 44, 20);
    this.seedButton = createTextButton(this, "Seeds", () => this.openSeedShop(), 118, 44, 20);
    this.storeButton = createTextButton(this, "Store", () => this.openGoldStore(), 118, 44, 20);
    this.journalButton = createTextButton(this, "Journal", () => this.openJournal(), 118, 44, 20);
    this.optionsButton = createTextButton(this, "Options", () => this.openOptions(), 118, 44, 20);
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
      .image(this.scale.width / 2, this.scale.height / 2, "emerald-bg")
      .setOrigin(0.5)
      .setDepth(-20)
      .setAlpha(0.76);
    this.layoutEmeraldBackdrop();
    this.createAmbientSpores();
  }

  private layoutEmeraldBackdrop(): void {
    if (!this.emeraldBackground) {
      return;
    }

    this.emeraldBackground.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.emeraldBackground.setDisplaySize(this.scale.width, this.scale.height);
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
        frequency: 360,
        quantity: 1,
      })
      .setDepth(16);
  }

  private layoutHeader(): void {
    const compact = this.scale.width < 760;
    const headerWidth = Math.max(220, Math.min(620, this.scale.width - 180));

    this.titleText.setFontSize(compact ? 22 : 30);
    this.titleText.setWordWrapWidth(headerWidth);
    this.buildLabelText.setFontSize(compact ? 12 : 13);
    this.buildLabelText.setWordWrapWidth(headerWidth);
    this.resourceText.setFontSize(compact ? 15 : 18);
    this.resourceText.setWordWrapWidth(headerWidth);
    this.comboBadgeText.setFontSize(compact ? 14 : 16);
    this.milestoneText.setFontSize(compact ? 13 : 16);
    this.milestoneText.setWordWrapWidth(headerWidth);

    this.titleText.setPosition(24, compact ? 18 : 18);
    this.buildLabelText.setPosition(26, this.titleText.y + this.titleText.height + 1);
    this.resourceText.setPosition(26, this.buildLabelText.y + this.buildLabelText.height + 8);
    this.milestoneText.setPosition(26, this.layoutComboBadge());
    this.skillButton.setPosition(this.scale.width - 142, 24);
    this.questButton.setPosition(this.scale.width - 142, 76);
    this.seedButton.setPosition(this.scale.width - 142, 128);
    this.storeButton.setPosition(this.scale.width - 142, 180);
    this.journalButton.setPosition(this.scale.width - 142, 232);
    this.optionsButton.setPosition(this.scale.width - 142, this.state?.seedShopPurchases.field_journal ? 284 : 232);
    this.layoutSeasonVisuals();
    this.layoutWeatherVisuals();
  }

  private layoutComboBadge(): number {
    const compact = this.scale.width < 760;
    const badgeWidth = compact ? 158 : 178;
    const badgeHeight = compact ? 36 : 40;
    const resourceBottom = this.resourceText.y + this.resourceText.height;
    const rightUiLeft = this.scale.width - 156;
    const fitsRight = !compact && this.resourceText.x + this.resourceText.width + badgeWidth + 22 < rightUiLeft;

    this.comboBadgeBg.setSize(badgeWidth, badgeHeight);
    this.comboBadgeMeter.setPosition(12, compact ? 10 : 12);

    if (fitsRight) {
      this.comboBadge.setPosition(this.resourceText.x + this.resourceText.width + 12, this.resourceText.y + this.resourceText.height / 2);
      return resourceBottom + 12;
    }

    this.comboBadge.setPosition(26, resourceBottom + 24);
    return resourceBottom + badgeHeight + 20;
  }

  private layoutSeasonVisuals(): void {
    if (!this.seasonTint) {
      return;
    }

    const season = getSeasonForDate(new Date());
    this.seasonTint.setSize(this.scale.width, this.scale.height);
    this.seasonTint.setFillStyle(season.color, season.alpha);
    this.seasonTint.setVisible(!this.hasBlockingOverlayOpen());
  }

  private layoutWeatherVisuals(): void {
    if (!this.weatherTint || !this.weatherBadge) {
      return;
    }

    this.weatherTint.setSize(this.scale.width, this.scale.height);
    const compact = this.scale.width < 720;
    const badgeWidth = compact ? Math.max(220, this.scale.width - 180) : 280;
    this.weatherBadgeBg.setSize(badgeWidth, compact ? 66 : 58);
    this.weatherBadgeBody.setWordWrapWidth(badgeWidth - 30);
    this.weatherBadge.setPosition(compact ? 26 : this.scale.width - 320, compact ? this.optionsButton.y + 58 : 232);

    if (this.state?.seedShopPurchases.weather_jar && this.state.activeWeatherId && this.activeWeatherVisualId === this.state.activeWeatherId) {
      this.createWeatherParticleEffect(this.state.activeWeatherId);
    }
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
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x06190f, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.skillBackdropPattern = this.add
      .image(this.scale.width / 2, this.scale.height / 2, "emerald-bg")
      .setOrigin(0.5)
      .setAlpha(0.18);

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
      .setOrigin(0.5, 0);

    this.backButton = createTextButton(this, "Back", () => this.closeSkillTree(), 118, 44, 101);
    this.skillLineGraphics = this.add.graphics();
    this.skillRoot.add([
      this.skillBackdrop,
      this.skillBackdropPattern,
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
        .setOrigin(0.5);

      this.skillBranchLabels.push({ text, treeX: branch.x, treeY: branch.y });
      this.skillRoot.add(text);
    }

    for (const upgrade of UPGRADES) {
      const container = this.add.container(0, 0);
      const bg = this.add
        .rectangle(0, 0, SKILL_NODE_SIZE, SKILL_NODE_SIZE, 0xffffff, 0.001)
        .setOrigin(0.5)
        .setStrokeStyle(1, upgrade.tree.color, 0)
        .setInteractive({ useHandCursor: true });
      const frame = this.add.image(0, 0, "node-hexagon-frame").setDisplaySize(SKILL_NODE_VISUAL_SIZE, SKILL_NODE_VISUAL_SIZE).setAlpha(0.88);
      const iconPlate = this.add.circle(0, -4, 17, 0xf7ffe8, 0.08).setStrokeStyle(1, upgrade.tree.color, 0.38);
      const icon = this.add.image(0, -4, getSkillIconKey(upgrade.id)).setDisplaySize(25, 25);
      const lockedIcon = this.add
        .text(0, -7, "?", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "24px",
          color: "#f7ffe8",
          align: "center",
          stroke: "#102318",
          strokeThickness: 5,
        })
        .setOrigin(0.5);
      const level = this.add
        .text(0, 17, "", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "10px",
          color: "#dfffc8",
        })
        .setOrigin(0.5);

      container.add([bg, frame, iconPlate, icon, lockedIcon, level]);
      bg.on("pointerover", () => this.previewSkill(upgrade.id));
      bg.on("pointerdown", () => this.upgradeSkill(upgrade.id));
      this.skillNodeViews.set(upgrade.id, { upgradeId: upgrade.id, container, bg, frame, icon, lockedIcon, level });
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
    });
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

    this.resetButton = createTextButton(this, "Reset", () => this.handleResetPressed(), 92, 34, 101);
    this.skillRoot.add(this.resetButton);

    this.layoutSkillTree();
  }

  private layoutSkillTree(): void {
    const shortLandscape = this.scale.width > this.scale.height && this.scale.height < 520;
    const narrowPortrait = this.scale.width < 500 && this.scale.height >= this.scale.width;
    const narrowDesktop = this.scale.width < 760 && !shortLandscape && !narrowPortrait;
    const sidePanel = !shortLandscape && !narrowPortrait && !narrowDesktop;
    const reservedSideWidth = sidePanel ? 430 : 48;
    const reservedBottomHeight = narrowPortrait || narrowDesktop ? 420 : 140;
    const mapWidth = TREE_WIDTH * SKILL_MAP_X_SCALE;
    const mapHeight = TREE_HEIGHT * SKILL_MAP_Y_SCALE;
    const treeScale = shortLandscape
      ? Math.max(0.38, Math.min(0.7, (this.scale.width - 310) / mapWidth, (this.scale.height - 126) / mapHeight))
      : Math.min(1, (this.scale.width - reservedSideWidth) / mapWidth, (this.scale.height - reservedBottomHeight) / mapHeight);
    const treeWidth = mapWidth * treeScale;
    const treeX = shortLandscape ? 34 : sidePanel ? Math.max(70, (this.scale.width - reservedSideWidth - treeWidth) / 2) : (this.scale.width - treeWidth) / 2;
    const treeY = shortLandscape ? 118 : narrowPortrait || narrowDesktop ? 136 : 158;

    this.skillBackdrop.setSize(this.scale.width, this.scale.height);
    this.skillBackdropPattern?.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.skillBackdropPattern?.setDisplaySize(this.scale.width, this.scale.height);
    this.skillTitleText.setText(narrowPortrait ? "Skills" : "Grass Skill Tree");
    this.skillTitleText.setFontSize(shortLandscape ? 25 : narrowPortrait ? 30 : 34);
    this.skillResourceText.setFontSize(shortLandscape || narrowPortrait ? 14 : 18);
    this.skillStatusText.setFontSize(shortLandscape || narrowPortrait ? 13 : 16);
    this.skillStatusText.setWordWrapWidth(Math.max(220, this.scale.width - 48));
    this.skillTitleText.setPosition(shortLandscape ? 22 : 52, shortLandscape ? 22 : 42);
    this.skillResourceText.setPosition(shortLandscape ? 24 : 54, shortLandscape ? 58 : 82);
    this.skillStatusText.setText(
      this.hasTouchScreen() ? "Tap a skill to upgrade it. The info box shows details." : "Hover a skill to inspect it. Click a skill or Upgrade to buy.",
    );
    this.skillStatusText.setPosition(
      shortLandscape ? this.scale.width / 2 + 20 : sidePanel ? treeX + treeWidth / 2 : this.scale.width / 2,
      shortLandscape ? 72 : 118,
    );
    this.backButton.setScale(narrowPortrait ? 0.9 : 1);
    this.backButton.setPosition(this.scale.width - (shortLandscape ? 130 : 166), shortLandscape ? 20 : 42);
    this.resetButton.setScale(shortLandscape ? 0.78 : narrowPortrait ? 0.86 : 0.88);
    this.resetButton.setPosition(this.scale.width - 108, this.scale.height - (shortLandscape ? 42 : narrowPortrait ? 46 : 48));
    this.skillDetailPanel.setScale(shortLandscape ? 0.72 : narrowPortrait ? 1 : 1);
    this.skillDetailPanel.setPosition(
      shortLandscape
        ? this.scale.width - 252
        : narrowPortrait || narrowDesktop
          ? (this.scale.width - SKILL_DETAIL_WIDTH) / 2
          : Math.max(24, this.scale.width - 410),
      shortLandscape ? 112 : narrowPortrait ? this.scale.height - 430 : sidePanel ? 150 : this.scale.height - 420,
    );
    this.skillDetailBg.setSize(SKILL_DETAIL_WIDTH, SKILL_DETAIL_HEIGHT);

    for (const label of this.skillBranchLabels) {
      label.text.setVisible(false);
    }

    for (const upgrade of UPGRADES) {
      const view = this.skillNodeViews.get(upgrade.id);
      if (!view) {
        continue;
      }

      const point = this.getSkillTreePoint(upgrade, treeScale, treeX, treeY);
      view.container.setPosition(point.x, point.y);
      view.container.setScale(treeScale);
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
    });
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
    this.questRoot.add([this.questBackdrop, this.questTitleText, this.questResourceText, this.questStatusText, this.questBackButton]);

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

      container.add([bg, name, description, progress, reward, claimButton]);
      this.questItemViews.set(quest.id, { questId: quest.id, container, bg, name, description, progress, reward, claimButton });
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
    const filterY = compact ? 132 : 136;
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
      view.container.setPosition(x, y);
      view.container.setVisible(y > 118 - itemGap && y < this.scale.height + itemGap);
      y += itemGap;
    }
  }

  private layoutQuestFilterButtons(x: number, panelWidth: number, y: number, compact: boolean): void {
    const gap = compact ? 6 : 8;
    const buttonWidth = compact ? Math.floor((panelWidth - gap * 2) / 3) : Math.floor((panelWidth - gap * 4) / 5);
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
    const claimed = this.state.claimedQuestIds.includes(quest.id);
    const available = isQuestAvailable(this.state, quest);
    const ready = isQuestClaimable(this.state, quest);

    switch (filterId) {
      case "ready":
        return ready;
      case "active":
        return available && !claimed;
      case "journal":
        return quest.category === "Field Journal";
      case "claimed":
        return claimed;
      case "all":
      default:
        return true;
    }
  }

  private getQuestFilterCounts(): Record<QuestFilterId, number> {
    return {
      all: QUESTS.length,
      ready: QUESTS.filter((quest) => this.questMatchesFilter(quest, "ready")).length,
      active: QUESTS.filter((quest) => this.questMatchesFilter(quest, "active")).length,
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
        case "journal":
          return "No Field Journal quests available in this list.";
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
      case "journal":
        return "Field Journal specimen quests.";
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
    });
    this.journalResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#173b20",
      backgroundColor: "#e9ffd0",
      padding: { x: 12, y: 8 },
    });
    this.journalStatusText = this.add
      .text(0, 0, "A living record of grass, weather, companions, and suspiciously productive habits.", {
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
    const startY = compact ? 154 : 162;
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
    this.journalStatusText.setPosition(this.scale.width / 2, compact ? 108 : 112);
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
    });
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

      bg.on("pointerdown", () => this.buySeedShopItem(item.id));
      container.add([bg, iconBg, icon, name, description, status]);
      this.seedItemViews.set(item.id, { itemId: item.id, container, bg, iconBg, icon, name, description, status });
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
      view.container.setPosition(x, y);
      view.container.setVisible(y > 118 - itemGap && y < this.scale.height + itemGap);
      y += itemGap;
    }
  }

  private createGoldStore(): void {
    this.storeRoot?.destroy();
    this.storeItemViews.clear();

    this.storeRoot = this.add.container(0, 0).setDepth(108).setVisible(false);
    this.storeBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x2a2f1c, 1)
      .setOrigin(0, 0)
      .setInteractive();
    this.storeTitleText = this.add.text(0, 0, "Gold Store", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f7ffe8",
      stroke: "#17491f",
      strokeThickness: 6,
    });
    this.storeResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#173b20",
      backgroundColor: "#fff1a8",
      padding: { x: 12, y: 8 },
    });
    this.storeStatusText = this.add
      .text(0, 0, "Gold buys consumables and field companions.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.storeBackButton = createTextButton(this, "Back", () => this.closeGoldStore(), 118, 44, 109);

    this.storeRoot.add([this.storeBackdrop, this.storeTitleText, this.storeResourceText, this.storeStatusText, this.storeBackButton]);

    for (const item of GOLD_STORE_ITEMS) {
      const container = this.add.container(0, 0);
      const bg = this.add
        .rectangle(0, 0, 430, 98, 0xfff8d4, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x8f6a1a)
        .setInteractive({ useHandCursor: true });
      const iconBg = this.add
        .rectangle(14, 15, SHOP_ICON_SIZE + 10, SHOP_ICON_SIZE + 10, 0xfff1a8, 0.72)
        .setOrigin(0, 0)
        .setStrokeStyle(2, 0xc69232, 0.58);
      const icon = this.add.image(43, 44, GOLD_STORE_ICON_KEYS[item.id] ?? "item-pocket-sunshine").setDisplaySize(SHOP_ICON_SIZE, SHOP_ICON_SIZE);
      const name = this.add.text(78, 10, item.name, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#183d20",
      });
      const description = this.add.text(78, 38, item.description, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#5f5425",
        wordWrap: { width: 334 },
      });
      const status = this.add.text(78, 74, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "15px",
        color: "#6d4c19",
      });

      bg.on("pointerdown", () => this.handleGoldStoreItemPressed(item.id));
      container.add([bg, iconBg, icon, name, description, status]);
      this.storeItemViews.set(item.id, { itemId: item.id, container, bg, iconBg, icon, name, description, status });
      this.storeRoot.add(container);
    }

    this.layoutGoldStore();
  }

  private layoutGoldStore(): void {
    const compact = this.scale.width < 560;
    const panelWidth = Math.min(430, this.scale.width - 32);
    const x = (this.scale.width - panelWidth) / 2;
    const itemHeight = compact ? 112 : 98;
    const itemGap = itemHeight + 10;
    const startY = compact ? 150 : 158;
    const availableHeight = Math.max(120, this.scale.height - startY - 22);
    const totalHeight = GOLD_STORE_ITEMS.length * itemGap;
    const maxScroll = Math.max(0, totalHeight - availableHeight);
    this.storeScroll = Math.min(this.storeScroll, maxScroll);
    let y = startY - this.storeScroll;

    this.resizeInteractiveBackdrop(this.storeBackdrop);
    this.storeTitleText.setFontSize(compact ? 30 : 34);
    this.storeResourceText.setFontSize(compact ? 14 : 18);
    this.storeStatusText.setFontSize(compact ? 13 : 16);
    this.storeStatusText.setWordWrapWidth(Math.max(240, this.scale.width - 48));
    this.storeTitleText.setPosition(24, 24);
    this.storeResourceText.setPosition(26, compact ? 72 : 78);
    this.storeStatusText.setPosition(this.scale.width / 2, compact ? 110 : 116);
    this.storeBackButton.setScale(compact ? 0.9 : 1);
    this.storeBackButton.setPosition(this.scale.width - 142, 24);

    for (const view of this.storeItemViews.values()) {
      const textX = compact ? 70 : 78;
      const iconSize = compact ? 42 : SHOP_ICON_SIZE;
      const iconFrame = iconSize + 10;

      view.bg.setSize(panelWidth, itemHeight);
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
      view.status.setPosition(textX, itemHeight - 24);
      view.status.setWordWrapWidth(Math.max(160, panelWidth - textX - 12));
      view.container.setPosition(x, y);
      view.container.setVisible(y > 118 - itemGap && y < this.scale.height + itemGap);
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
      .setOrigin(0.5);
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

  private refreshOptionsPanel(): void {
    this.optionsVolumeLabel?.setText(`Music volume: ${Math.round(this.musicVolume * 100)}%`);
    this.optionsTrackLabel?.setText(`Track: ${this.music.getCurrentTrackName()}`);
    this.layoutOptionsPanel();
  }

  private cycleTrack(direction: number): void {
    const trackIds = ["cozy_meadow", "grasslands_groove", "dreamy_dewdrops", "constellation_climb"];
    const currentIndex = trackIds.indexOf(this.music.getCurrentTrackId());
    let nextIndex = (currentIndex + direction) % trackIds.length;
    if (nextIndex < 0) {
      nextIndex += trackIds.length;
    }
    const nextTrackId = trackIds[nextIndex];
    this.music.setTrack(nextTrackId);
    this.state.selectedTrackId = nextTrackId;
    saveGame(this.state);
    this.refreshOptionsPanel();
  }

  private hasTouchScreen(): boolean {
    return navigator.maxTouchPoints > 0;
  }

  private hasBlockingOverlayOpen(): boolean {
    return this.skillTreeOpen || this.questLogOpen || this.journalOpen || this.seedShopOpen || this.storeOpen || this.optionsOpen;
  }

  private getSkillTreePoint(
    upgrade: (typeof UPGRADES)[number],
    treeScale: number,
    treeX: number,
    treeY: number,
  ): { x: number; y: number } {
    return {
      x: treeX + upgrade.tree.x * SKILL_MAP_X_SCALE * treeScale,
      y: treeY + upgrade.tree.y * SKILL_MAP_Y_SCALE * treeScale,
    };
  }

  private drawSkillLines(treeScale: number, treeX: number, treeY: number): void {
    this.skillLineGraphics.clear();
    this.skillLineGraphics.fillStyle(0x000000, 0.4);
    this.skillLineGraphics.fillCircle(treeX + 155 * treeScale, treeY + 138 * treeScale, 95 * treeScale);
    this.skillLineGraphics.fillCircle(treeX + 265 * treeScale, treeY + 250 * treeScale, 132 * treeScale);
    this.skillLineGraphics.fillCircle(treeX + 420 * treeScale, treeY + 210 * treeScale, 74 * treeScale);

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

    this.skillLineGraphics.fillStyle(0xf4df6a, 0.26);
    for (const [x, y] of starPoints) {
      this.skillLineGraphics.fillCircle(treeX + x * treeScale, treeY + y * treeScale, Math.max(1.2, 2 * treeScale));
    }

    for (const upgrade of UPGRADES) {
      const prerequisiteIds = upgrade.prerequisiteIds ?? [];

      for (const prerequisiteId of prerequisiteIds) {
        const prerequisite = UPGRADES.find((candidate) => candidate.id === prerequisiteId);
        if (!prerequisite) {
          continue;
        }

        const primaryBranch = prerequisiteId === prerequisiteIds[0];
        const prerequisiteLevel = this.state.upgrades[prerequisite.id]?.level ?? 0;
        const upgradeLevel = this.state.upgrades[upgrade.id]?.level ?? 0;
        const active = prerequisiteLevel > 0 && upgradeLevel > 0;
        const available = prerequisiteLevel > 0 && canUnlockUpgrade(this.state, upgrade);
        const selectedConnection = upgrade.id === this.selectedSkillId || prerequisite.id === this.selectedSkillId;

        if (!primaryBranch && !active && !available && !selectedConnection) {
          continue;
        }

        const color = active ? 0xffe460 : available ? 0xffd24a : selectedConnection ? 0xf4df6a : 0x44624c;
        const alpha = primaryBranch ? (active || available || selectedConnection ? 0.9 : 0.3) : active || selectedConnection ? 0.55 : 0.18;
        const width = primaryBranch ? Math.max(2, 2.4 * treeScale) : Math.max(1.2, 1.6 * treeScale);
        const start = this.getSkillTreePoint(prerequisite, treeScale, treeX, treeY);
        const end = this.getSkillTreePoint(upgrade, treeScale, treeX, treeY);

        this.skillLineGraphics.lineStyle(width + 7 * treeScale, 0xff9c00, alpha * 0.22);
        this.skillLineGraphics.beginPath();
        this.skillLineGraphics.moveTo(start.x, start.y);
        this.skillLineGraphics.lineTo(end.x, end.y);
        this.skillLineGraphics.strokePath();

        this.skillLineGraphics.lineStyle(width, color, alpha);
        this.skillLineGraphics.beginPath();
        this.skillLineGraphics.moveTo(start.x, start.y);
        this.skillLineGraphics.lineTo(end.x, end.y);
        this.skillLineGraphics.strokePath();

        if (active || available || selectedConnection) {
          this.skillLineGraphics.fillStyle(color, Math.min(0.82, alpha + 0.1));
          this.skillLineGraphics.fillCircle(start.x, start.y, Math.max(2.2, 3.2 * treeScale));
          this.skillLineGraphics.fillCircle(end.x, end.y, Math.max(2.2, 3.2 * treeScale));
        }
      }
    }
  }

  private previewSkill(upgradeId: string): void {
    this.selectedSkillId = upgradeId;
    this.refreshUi();
  }

  private upgradeSkill(upgradeId: string): void {
    this.selectedSkillId = upgradeId;
    const upgraded = this.buyUpgrade(upgradeId);
    this.bumpSkillNode(upgradeId, upgraded);
    this.refreshUi();
  }

  private upgradeSelectedSkill(): void {
    const upgraded = this.buyUpgrade(this.selectedSkillId);
    this.bumpSkillNode(this.selectedSkillId, upgraded);
    this.refreshUi();
  }

  private openSkillTree(): void {
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeOptions();
    this.skillTreeOpen = true;
    this.skillRoot.setVisible(true);
    this.disarmReset();
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeSkillTree(): void {
    this.skillTreeOpen = false;
    this.skillRoot.setVisible(false);
    this.disarmReset();
    this.refreshUi();
  }

  private openQuestLog(): void {
    this.closeSkillTree();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
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
    this.closeOptions();
    this.storeOpen = true;
    this.storeScroll = 0;
    this.storeRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeGoldStore(): void {
    this.storeOpen = false;
    this.storeRoot?.setVisible(false);
    this.refreshUi();
  }

  private openOptions(): void {
    this.closeSkillTree();
    this.closeQuestLog();
    this.closeJournal();
    this.closeSeedShop();
    this.closeGoldStore();
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

    this.state.gold -= item.cost;
    addInventoryItem(this.state, item.id, item.kind);
    this.setStoreStatus(`${item.name} added to inventory.`);
    this.audio.play(item.kind === "animal" ? "milestone" : "upgrade");
    saveGame(this.state);
    this.refreshUi();
    this.playGoldStoreItemSuccess(item.id);
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
        this.setStoreStatus("Seed Satchel opened into 5 seeds.");
        this.audio.play("seed");
        saveGame(this.state);
        this.refreshUi();
        this.playGoldStoreItemSuccess(itemId);
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

    for (const tile of restingTiles) {
      tile.grassState = "grown";
      tile.regrowEndsAt = 0;
      tile.trait = "dewy";
      this.refreshTile(tile);
      this.popAtTile(tile, "sunny", "#ffef78");
    }

    this.setStoreStatus(`Pocket Sunshine regrew ${restingTiles.length} patch${restingTiles.length === 1 ? "" : "es"}.`);
    this.audio.play("regrow");
    saveGame(this.state);
    this.refreshUi();
    this.playGoldStoreItemSuccess("pocket_sunshine");
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
    if (item.id === "weather_jar") {
      this.state.weatherEndsAt = 0;
      this.updateWeather(Date.now(), false);
    }
    this.setSeedStatus(`${item.name} unlocked.`);
    this.audio.play("upgrade");
    saveGame(this.state);
    this.refreshUi();
    this.playSeedShopItemSuccess(item.id);
  }

  private handleResetPressed(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
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
    this.disarmReset();
    this.state = resetSave();
    this.sprinkler.reset();
    this.animalCompanions.reset();
    this.combo.reset();
    this.recentlyRegrownAt.clear();
    this.destroyAllPerfectTouchCues();
    this.resetBoardView();
    this.tileViews.forEach((view) => {
      view.base.destroy();
      view.grass.destroy();
      view.outline.destroy();
      view.glint.destroy();
      view.label.destroy();
    });
    this.tileViews.clear();
    this.worldObjectViews.forEach((view) => view.container.destroy());
    this.worldObjectViews.clear();
    this.selectedSkillId = UPGRADES[0].id;
    this.renderAllTiles();
    this.refreshUi();
    this.showMessage("Fresh start. One patch. Infinite responsibility.", 2600);
    this.closeSkillTree();
    this.closeQuestLog();
    this.closeSeedShop();
    this.closeGoldStore();
    this.closeOptions();
  }

  private resetBoardView(): void {
    this.boardZoom = 1;
    this.boardPanX = 0;
    this.boardPanY = 0;
    this.isBoardPanArmed = false;
    this.isPanningBoard = false;
  }

  private renderAllTiles(): void {
    for (const tile of getFieldTiles(this.state)) {
      this.createTileView(tile);
    }
    this.layoutTiles();
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
    this.layoutTiles();
  }

  private createTileView(tile: FieldTile): void {
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

    base.on("pointerdown", () => this.handleTileClicked(tile));
    grass.on("pointerdown", () => this.handleTileClicked(tile));
    base.on("pointerover", () => this.showTileInfo(tile));
    grass.on("pointerover", () => this.showTileInfo(tile));
    base.on("pointerout", () => this.hideTileInfo(tile));
    grass.on("pointerout", () => this.hideTileInfo(tile));

    this.tweens.add({
      targets: glint,
      scaleX: 1.45,
      scaleY: 1.45,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.tileViews.set(tileKey(tile.x, tile.y), { base, grass, label, outline, glint });
    this.refreshTile(tile);
  }

  private layoutTiles(): void {
    const tiles = getFieldTiles(this.state);
    const bounds = getFieldBounds(this.state);
    if (tiles.length === 0) {
      return;
    }

    if (!bounds) {
      return;
    }

    const boardWidth = bounds.width * (TILE_SIZE + TILE_GAP);
    const boardHeight = bounds.height * (TILE_SIZE + TILE_GAP);
    this.boardTopY = Math.max(142, this.milestoneText.y + this.milestoneText.height + 24);
    this.boardAvailableWidth = Math.max(120, this.scale.width - 24);
    this.boardAvailableHeight = Math.max(120, this.scale.height - this.boardTopY - 24);
    const fitScale = Math.min(1, this.boardAvailableWidth / boardWidth, this.boardAvailableHeight / boardHeight);
    this.boardScale = fitScale * this.boardZoom;
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

    for (const tile of tiles) {
      const view = this.tileViews.get(tileKey(tile.x, tile.y));
      if (!view) {
        continue;
      }

      const x = startX + (tile.x - bounds.minX) * scaledStep;
      const y = startY + (tile.y - bounds.minY) * scaledStep;
      view.base.setPosition(x, y);
      view.outline.setPosition(x, y);
      view.grass.setPosition(x, y);
      view.glint.setPosition(x + 19 * this.boardScale, y - 20 * this.boardScale);
      view.label.setPosition(x, y);
      view.base.setScale(this.boardScale);
      view.outline.setScale(this.boardScale);
      view.grass.setScale(this.boardScale * this.getGrassScale(tile));
      view.glint.setScale(this.boardScale);
      view.label.setScale(this.boardScale);
    }

    this.layoutWorldObjects();

    if (this.hoveredTileKey) {
      const hoveredTile = this.state.field[this.hoveredTileKey];
      if (hoveredTile) {
        this.positionTileInfo(hoveredTile);
      }
    }
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
        existing.label.setText(object.quantity > 1 ? `${object.label} x${object.quantity}` : object.label);
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
        .text(0, 15, object.quantity > 1 ? `${object.label} x${object.quantity}` : object.label, {
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
        this.pulseWorldObject(object.id, 0xdfffc8);
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
      const quantity = object.kind === "seed" ? (this.state.seedShopPurchases[object.id] ? 1 : 0) : getInventoryQuantity(this.state, object.id);

      if (quantity <= 0) {
        return [];
      }

      return [{ id: object.id, textureKey: object.textureKey, label: object.label, quantity }];
    });
  }

  private createWorldObjectAmbience(id: string): Phaser.GameObjects.GameObject[] {
    if (id === "sprinkler") {
      const drop = this.add.image(16, -38, "effect-water-drop").setScale(0.72).setAlpha(0.72);
      const shine = this.add.star(-17, -42, 4, 2, 8, 0xd7fff2, 0.72).setStrokeStyle(1, 0xffffff, 0.8);

      this.tweens.add({
        targets: drop,
        y: -28,
        alpha: 0.18,
        duration: 920,
        delay: Phaser.Math.Between(0, 500),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      this.tweens.add({
        targets: shine,
        angle: 35,
        scaleX: 1.35,
        scaleY: 1.35,
        alpha: 0.16,
        duration: 1180,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      return [drop, shine];
    }

    if (id === "bee_hive") {
      return Array.from({ length: 4 }, (_value, index) => {
        const bee = this.add
          .image(Phaser.Math.Between(-23, 23), Phaser.Math.Between(-43, -20), "effect-bee-pixel")
          .setScale(0.55)
          .setAlpha(0.82);

        this.tweens.add({
          targets: bee,
          x: bee.x + Phaser.Math.Between(-12, 12),
          y: bee.y + Phaser.Math.Between(-8, 8),
          angle: index % 2 === 0 ? 18 : -18,
          duration: 640 + index * 130,
          delay: index * 80,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        return bee;
      });
    }

    if (id === "chicken") {
      const dust = this.add.image(-18, -5, "dust-fleck").setScale(1.35).setAlpha(0.5);

      this.tweens.add({
        targets: dust,
        x: -10,
        alpha: 0.08,
        duration: 1040,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      return [dust];
    }

    if (id === "sheep") {
      const fleck = this.add.image(20, -18, "grass-fleck").setScale(1.25).setAlpha(0.58);

      this.tweens.add({
        targets: fleck,
        y: -25,
        angle: 16,
        alpha: 0.12,
        duration: 1280,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      return [fleck];
    }

    if (id === "field_mouse" || id === "meadow_rabbit") {
      const seed = this.add.image(18, -16, "effect-seed-kernel").setScale(0.68).setAlpha(0.58);

      this.tweens.add({
        targets: seed,
        y: -22,
        angle: 22,
        alpha: 0.16,
        duration: 1220,
        delay: id === "meadow_rabbit" ? 240 : 0,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      return [seed];
    }

    if (id === "earthworm") {
      const dirt = this.add.image(18, -5, "dust-fleck").setScale(1.1).setAlpha(0.46);

      this.tweens.add({
        targets: dirt,
        x: 10,
        y: -2,
        alpha: 0.12,
        duration: 960,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

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
    const dockScale = this.scale.width < 620 ? 0.68 : 0.76;
    const horizontal = this.scale.height < 560 || this.scale.width < 620 || activeObjects.length >= 5;
    const spacing = horizontal ? 78 * dockScale : 98 * dockScale;
    const dockX = Phaser.Math.Clamp(48, 34, Math.max(34, this.scale.width - 44));
    const dockTop = Math.max(this.boardTopY + 44, this.milestoneText.y + this.milestoneText.height + 34);
    const maxDockY = this.scale.height - 50 * dockScale;
    const neededHeight = Math.max(0, (activeObjects.length - 1) * spacing);
    const verticalStartY = Phaser.Math.Clamp(dockTop, this.boardTopY + 34, Math.max(this.boardTopY + 34, maxDockY - neededHeight));
    const horizontalY = Phaser.Math.Clamp(this.scale.height - 54 * dockScale, this.boardTopY + 42, this.scale.height - 38);
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
    const origin = this.getWorldObjectOrigin(sourceId);
    if (!origin) {
      return;
    }

    this.pulseWorldObject(sourceId, color);

    for (let index = 0; index < count; index += 1) {
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

  private showTileInfo(tile: FieldTile): void {
    if (this.hasTouchScreen()) {
      this.clearTileInfo();
      return;
    }

    this.hoveredTileKey = tileKey(tile.x, tile.y);
    this.hoveredWorldObjectId = undefined;
    this.refreshTileInfo(tile);
    this.positionTileInfo(tile);
    this.tileInfoPanel.setVisible(true);
  }

  private hideTileInfo(tile: FieldTile): void {
    if (this.hoveredTileKey === tileKey(tile.x, tile.y)) {
      this.hoveredTileKey = undefined;
      this.tileInfoPanel.setVisible(false);
    }
  }

  private clearTileInfo(): void {
    this.hoveredTileKey = undefined;
    this.hoveredWorldObjectId = undefined;
    this.tileInfoPanel.setVisible(false);
  }

  private showWorldObjectInfo(id: string): void {
    this.hoveredTileKey = undefined;
    this.hoveredWorldObjectId = id;
    this.refreshWorldObjectInfo(id);
    this.positionWorldObjectInfo(id);
    this.tileInfoPanel.setVisible(true);
  }

  private hideWorldObjectInfo(id: string): void {
    if (this.hoveredWorldObjectId === id && !this.hasTouchScreen()) {
      this.hoveredWorldObjectId = undefined;
      this.tileInfoPanel.setVisible(false);
    }
  }

  private refreshTileInfo(tile: FieldTile): void {
    const tier = getGrassTier(tile.tier);
    const isGrown = tile.grassState === "grown";
    const traitValue = tile.trait === "lush" ? 2 : tile.trait === "dewy" ? 1 : 0;
    const traitLine = tile.trait === "normal" ? "Trait: normal" : `Trait: ${tile.trait} (+${traitValue})`;
    const tierLine = `Value: ${tier.touchValue}${traitValue > 0 ? ` + ${traitValue}` : ""} before upgrades`;
    const critLine = tile.trait === "lush" ? "Better crit and seed odds" : tile.trait === "dewy" ? "Slightly better crit and seed odds" : "";

    this.tileInfoTitle.setText(isGrown ? tier.name : "Regrowing Patch");
    this.tileInfoBody.setText(isGrown ? [tierLine, traitLine, critLine].filter(Boolean).join("\n") : "This patch is growing back.");
  }

  private refreshWorldObjectInfo(id: string): void {
    const quantity = id === "sprinkler" ? (this.state.seedShopPurchases.sprinkler ? 1 : 0) : getInventoryQuantity(this.state, id);
    const storeItem = GOLD_STORE_ITEMS.find((item) => item.id === id);
    const seedItem = SEED_SHOP_ITEMS.find((item) => item.id === id);
    const title = storeItem?.name ?? seedItem?.name ?? this.getWorldObjectLabel(id);
    const summary = this.getWorldObjectSummary(id);
    const countLine = quantity > 1 ? `Owned: ${quantity}` : quantity === 1 ? "Owned: 1" : "";

    this.tileInfoTitle.setText(title);
    this.tileInfoBody.setText([summary, countLine].filter(Boolean).join("\n"));
  }

  private getWorldObjectSummary(id: string): string {
    switch (id) {
      case "sprinkler":
        return "Waters resting patches so the field keeps moving.";
      case "bee_hive":
        return "Bees periodically pollinate clusters into better grass.";
      case "chicken":
        return "Scratches up gold or improves a random patch.";
      case "sheep":
        return "Grazes grown grass and turns touches into gold.";
      case "field_mouse":
        return "Sniffs out tiny glints and improves gold luck.";
      case "meadow_rabbit":
        return "Keeps the field lively, nudging seed and dew luck.";
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
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const panelWidth = 260;
    const panelHeight = 128;
    const x = Phaser.Math.Clamp(view.base.x + 28 * this.boardScale, 12, this.scale.width - panelWidth - 12);
    const y = Phaser.Math.Clamp(view.base.y - panelHeight - 20 * this.boardScale, 12, this.scale.height - panelHeight - 12);

    this.tileInfoPanel.setPosition(x, y);
  }

  private positionWorldObjectInfo(id: string): void {
    const view = this.worldObjectViews.get(id);
    if (!view) {
      return;
    }

    const panelWidth = 260;
    const panelHeight = 128;
    const x = Phaser.Math.Clamp(view.container.x + 36 * view.container.scaleX, 12, this.scale.width - panelWidth - 12);
    const y = Phaser.Math.Clamp(view.container.y - panelHeight - 62 * view.container.scaleY, 12, this.scale.height - panelHeight - 12);

    this.tileInfoPanel.setPosition(x, y);
  }

  private handleTileClicked(tile: FieldTile): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    if (this.hasTouchScreen()) {
      this.clearTileInfo();
    }

    const stats = getRuntimeStats(this.state);
    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    const now = Date.now();
    this.addJournalValue(this.state.journal.discoveredGrassTiers, touchedTier.id);
    this.addJournalValue(this.state.journal.discoveredTileTraits, touchedTrait);
    const touch = touchTile(tile, this.state, stats, now);

    if (touch.gained === 0) {
      this.popAtTile(tile, "regrowing", "#fff2b2");
      this.playBlockedTileFeedback(tile);
      this.audio.play("blocked");
      return;
    }

    const combo = this.combo.recordManualTouch(now, touch.gained);
    if (combo.count > this.state.journal.bestComboCount) {
      this.state.journal.bestComboCount = combo.count;
    }
    if (combo.bonusTouches > 0) {
      this.state.grassTouches += combo.bonusTouches;
      this.state.lifetimeGrassTouches += combo.bonusTouches;
    }
    const perfectTouchBonus = this.consumePerfectTouchBonus(tile, touch.gained, now);
    if (perfectTouchBonus > 0) {
      this.state.grassTouches += perfectTouchBonus;
      this.state.lifetimeGrassTouches += perfectTouchBonus;
    }
    const perfectGoldBonus = perfectTouchBonus > 0 ? this.rollPerfectTouchGoldBonus(touch.gained) : 0;
    if (perfectGoldBonus > 0) {
      this.state.gold += perfectGoldBonus;
      this.state.lifetimeGold += perfectGoldBonus;
    }

    this.playTouchFeedback(tile, touchedTrait, touch.isCrit);
    this.refreshTile(tile);
    this.popAtTile(tile, this.getTouchPopText(touch, touchedTier.label), touch.isCrit ? "#ffef78" : touchedTier.id === "normal" ? "#f9ffe5" : "#dfffc8");
    if (perfectTouchBonus > 0) {
      this.playPerfectTouchFeedback(tile, perfectTouchBonus);
      if (perfectGoldBonus > 0) {
        this.popAtTile(tile, `golden +${perfectGoldBonus}`, "#ffef78");
        this.emitGoldBurst(tile, perfectGoldBonus);
        this.audio.play("gold");
      }
    }
    this.playComboFeedback(tile, combo);
    if (touch.instantRegrown) {
      this.popAtTile(tile, "instant regrow", "#dfffc8");
    }
    this.drops.tryDropSeed(this.state, tile, touchedTrait, stats, this.getDropFeedback());
    this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier.id, touch, stats, this.getDropFeedback());
    this.applyGrassTierIdentityBonus(tile, touchedTier.id, touch, stats, now);
    this.shakeForGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    this.audio.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, combo.count);
    this.tryComboAoeTouch(tile, stats, combo.count, now);
    saveGame(this.state);
  }

  private applyGrassTierIdentityBonus(originTile: FieldTile, tier: GrassTierId, touch: TouchResult, stats: ReturnType<typeof getRuntimeStats>, now: number): void {
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

  private tryMushroomSpores(originTile: FieldTile, stats: ReturnType<typeof getRuntimeStats>, now: number): void {
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

    const gold = Math.max(1, Math.floor(touch.gained * (touch.isCrit ? 0.08 : 0.04)));
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
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    this.emitBurst(texture, view.label.x, view.label.y - 8, count, scale, 0.28);
  }

  private markRecentlyRegrown(tile: FieldTile, now: number): void {
    const key = tileKey(tile.x, tile.y);
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
    const key = tileKey(tile.x, tile.y);
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

    return windowMs;
  }

  private getPerfectTouchBonusMultiplier(tile: FieldTile): number {
    if (tile.tier === "frost") {
      return 0.75;
    }

    if (tile.tier === "moss") {
      return 0.6;
    }

    return PERFECT_TOUCH_BONUS_MULTIPLIER;
  }

  private showPerfectTouchCue(tile: FieldTile, key: TileKey): void {
    const view = this.tileViews.get(key);
    if (!view) {
      return;
    }

    this.destroyPerfectTouchCue(key);
    const x = view.label.x;
    const y = view.label.y;
    const ring = this.add
      .ellipse(x, y, TILE_SIZE * 0.94 * this.boardScale, TILE_SIZE * 0.62 * this.boardScale, 0xffef78, 0.2)
      .setStrokeStyle(Math.max(2, 3 * this.boardScale), 0xffef78, 0.96)
      .setDepth(35);
    const sparkle = this.add
      .star(x, y - 16 * this.boardScale, 5, TILE_SIZE * 0.065 * this.boardScale, TILE_SIZE * 0.28 * this.boardScale, 0xdfffc8, 0.84)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(38);

    this.perfectTouchCues.set(key, [ring, sparkle]);
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
  }

  private destroyAllPerfectTouchCues(): void {
    for (const key of this.perfectTouchCues.keys()) {
      this.destroyPerfectTouchCue(key);
    }
  }

  private tryComboAoeTouch(originTile: FieldTile, stats: ReturnType<typeof getRuntimeStats>, comboCount: number, now: number): void {
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
      const key = tileKey(tile.x, tile.y);
      this.recentlyRegrownAt.delete(key);
      this.destroyPerfectTouchCue(key);

      touchedTiles += 1;
      gainedTouches += touch.gained;
      this.playTouchFeedback(tile, touchedTrait, touch.isCrit);
      this.refreshTile(tile);
      this.popAtTile(tile, this.getTouchPopText(touch, touchedTier.label), touch.isCrit ? "#ffef78" : "#d7fff2");
      if (touch.instantRegrown) {
        this.popAtTile(tile, "instant regrow", "#dfffc8");
      }
      this.drops.tryDropSeed(this.state, tile, touchedTrait, stats, this.getDropFeedback());
      this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier.id, touch, stats, this.getDropFeedback());
      this.audio.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit, comboCount);
    }

    if (touchedTiles === 0) {
      return;
    }

    this.popAtTile(originTile, `AOE ${touchedTiles} tiles +${gainedTouches}`, "#bff4ff");
    const view = this.tileViews.get(tileKey(originTile.x, originTile.y));
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
      chance += 0.15;
    }

    return Math.min(0.9, chance);
  }

  private isWeatherActive(weatherId: WeatherId): boolean {
    return Boolean(this.state.seedShopPurchases.weather_jar && this.state.activeWeatherId === weatherId);
  }

  private getDropFeedback(): DropFeedback {
    return {
      createTileView: (tile) => this.createTileView(tile),
      layoutTiles: () => this.layoutTiles(),
      popAtTile: (tile, text, color) => this.popAtTile(tile, text, color),
      emitSeedBurst: (tile) => this.emitSeedBurst(tile),
      emitGoldBurst: (tile, amount) => this.emitGoldBurst(tile, amount),
      playSound: (sound) => this.audio.play(sound),
    };
  }

  private emitSeedBurst(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    this.emitBurst("seed-fleck", view.base.x, view.base.y - 8, 18, 0.82, 0.32);
    this.spawnRewardArc("effect-seed-kernel", view.base.x, view.base.y - 8, "seed");
  }

  private emitGoldBurst(tile: FieldTile, amount = 1): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    this.emitBurst("gold-fleck", view.base.x, view.base.y - 10, 14, 0.7, 0.24);
    this.spawnRewardArc("effect-gold-coin", view.base.x, view.base.y - 10, "gold", amount);
  }

  private updateSprinkler(delta: number, stats: ReturnType<typeof getRuntimeStats>): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    const changed = this.sprinkler.update(delta, this.state, stats, {
      refreshTile: (tile) => this.refreshTile(tile),
      popAtTile: (tile, text, color) => this.popAtTile(tile, text, color),
      playSprinklerBurst: (tile) => this.playSprinklerBurst(tile),
      playTouchFeedback: (tile, touchedTrait, isCrit) => this.playTouchFeedback(tile, touchedTrait, isCrit),
      tryDropSeed: (tile, touchedTrait, runtimeStats, chanceScale) =>
        this.drops.tryDropSeed(this.state, tile, touchedTrait, runtimeStats, this.getDropFeedback(), chanceScale),
      tryDropGold: (tile, touchedTrait, touchedTier, touch, runtimeStats, chanceScale) =>
        this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier, touch, runtimeStats, this.getDropFeedback(), chanceScale),
      playGrassTouch: (tier, trait, isCrit) => this.audio.playGrassTouch(tier, trait, isCrit),
    });

    if (changed) {
      saveGame(this.state);
    }
  }

  private updateAnimalCompanions(delta: number, stats: ReturnType<typeof getRuntimeStats>): void {
    if (this.hasBlockingOverlayOpen()) {
      return;
    }

    const changed = this.animalCompanions.update(delta, this.state, stats, {
      refreshTile: (tile) => this.refreshTile(tile),
      popAtTile: (tile, text, color) => this.popAtTile(tile, text, color),
      emitGoldBurst: (tile, amount) => this.emitGoldBurst(tile, amount),
      playCompanionAction: (tile, action) => this.playCompanionAction(tile, action),
      playTouchFeedback: (tile, touchedTrait, isCrit) => this.playTouchFeedback(tile, touchedTrait, isCrit),
      playSound: (sound) => this.audio.play(sound),
      playGrassTouch: (tier, trait, isCrit) => this.audio.playGrassTouch(tier, trait, isCrit),
    });

    if (changed) {
      saveGame(this.state);
    }
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

  private getTouchPopText(touch: TouchResult, label: string): string {
    const prefix = [label, touch.doubled ? "DOUBLE" : "", touch.isCrit ? `CRIT x${touch.critMultiplier.toFixed(1)}` : ""].filter(Boolean).join(" ");
    return `${prefix ? `${prefix} ` : ""}+${touch.gained}`;
  }

  private playComboFeedback(tile: FieldTile, combo: ComboResult): void {
    if (combo.count < 2) {
      return;
    }

    if (combo.bonusTouches > 0) {
      this.popAtTile(tile, `combo +${combo.bonusTouches}`, "#f4df6a");
    } else {
      this.popAtTile(tile, `${combo.count} combo`, "#b7eba5");
    }

    this.refreshComboBadge();
    this.bumpComboBadge();

    if (!combo.thresholdReached) {
      return;
    }

    const multiplier = combo.multiplier.toFixed(combo.multiplier >= 2 ? 0 : 2);
    this.showMessage(`${combo.thresholdReached} combo! Touch streak x${multiplier}.`, 1600);
    this.audio.play(combo.thresholdReached >= 15 ? "unlock" : "crit");

    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (view) {
      this.emitBurst("crit-fleck", view.label.x, view.label.y - 12, 26, 1.1 + Math.min(1, combo.thresholdReached / 40), 0.16);
    }
  }

  private bumpComboBadge(): void {
    if (!this.comboBadge.visible) {
      return;
    }

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
      this.refreshWeatherVisuals();
      return;
    }

    if (this.state.activeWeatherId && this.state.weatherEndsAt && now < this.state.weatherEndsAt) {
      this.refreshWeatherVisuals();
      return;
    }

    const weather = pickWeather(this.state.activeWeatherId);
    this.state.activeWeatherId = weather.id;
    this.state.weatherEndsAt = now + (this.state.seedShopPurchases.rain_barrel ? 150000 : 120000);

    if (announce) {
      this.showMessage(`${weather.name}: ${weather.description}`, 2600);
    }

    this.refreshWeatherVisuals();
    saveGame(this.state);
  }

  private refreshWeatherVisuals(): void {
    if (!this.weatherTint || !this.weatherBadge || !this.weatherBadgeTitle || !this.weatherBadgeBody) {
      return;
    }

    if (!this.state.seedShopPurchases.weather_jar) {
      this.weatherTint.setVisible(false);
      this.weatherBadge.setVisible(false);
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

    this.weatherBadge.setVisible(!this.hasBlockingOverlayOpen());
    this.weatherBadgeTitle.setText(`Weather Jar: ${weather.name}`);
    this.weatherBadgeTitle.setColor(weather.color);
    this.weatherBadgeBody.setText(`${weather.description} (${timeText})`);
    this.weatherTint.setVisible(!this.hasBlockingOverlayOpen());
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
          frequency: 75,
          quantity: 2,
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
          frequency: 95,
          quantity: 1,
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
          frequency: 58,
          quantity: 2,
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
          frequency: 48,
          quantity: 2,
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
          frequency: 18,
          quantity: 3,
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
          frequency: 42,
          quantity: 2,
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
          frequency: 66,
          quantity: 2,
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
          frequency: 54,
          quantity: 2,
        },
      },
    } satisfies Record<Exclude<WeatherId, "calm">, { texture: string; config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig }>;
    const effect = configs[weatherId];

    this.weatherParticles = this.add.particles(0, 0, effect.texture, effect.config).setDepth(19);
  }

  private refreshTile(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const isGrown = tile.grassState === "grown";
    const tier = getGrassTier(tile.tier);
    const grassTexture = this.getGrassTextureKey(tile);
    const rareTier = tier.id !== "normal";
    const highlightColor = this.getTierHighlightColor(tier.id);

    view.grass.setVisible(isGrown);
    view.grass.setTexture(grassTexture);
    view.grass.setScale(this.boardScale * this.getGrassScale(tile));
    view.grass.setAlpha(1);
    view.outline.setVisible(isGrown && rareTier);
    view.outline.setStrokeStyle(tier.id === "golden" || tier.id === "crystal" || tier.id === "frost" ? 5 : 4, highlightColor, tier.id === "normal" ? 0 : 0.82);
    view.glint.setVisible(isGrown && rareTier);
    view.glint.setFillStyle(highlightColor, tier.id === "normal" ? 0 : 0.88);
    view.label.setText(isGrown ? this.getTileLabel(tile, tier.label) : "...");
    view.base.setTexture(isGrown ? "tile-dirt" : "tile-stubble");

    if (this.hoveredTileKey === tileKey(tile.x, tile.y)) {
      this.refreshTileInfo(tile);
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

  private getTileLabel(tile: FieldTile, tierLabel: string): string {
    const parts = [tierLabel, tile.trait === "normal" ? "" : tile.trait].filter(Boolean);
    return parts.join(" ");
  }

  private playTouchFeedback(tile: FieldTile, touchedTrait = tile.trait, isCrit = false): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    this.resetBaseTilePose(view);
    const x = view.label.x;
    const y = view.label.y;
    const baseScale = this.boardScale;
    const fleckTexture = touchedTrait === "dewy" ? "dew-fleck" : "grass-fleck";
    const grassGhost = this.add
      .image(x, y, view.grass.texture.key)
      .setScale(view.grass.scaleX, view.grass.scaleY)
      .setAlpha(0.95)
      .setDepth(33);

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

    this.tweens.killTweensOf(view.base);
    this.tweens.add({
      targets: view.base,
      scaleX: baseScale * 1.05,
      scaleY: baseScale * 0.95,
      duration: 75,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => this.resetBaseTilePose(view),
    });

    this.emitBurst(fleckTexture, x, y - 4, isCrit ? 46 : 28, isCrit ? 1.42 : 1.05, isCrit ? 0.3 : 0.42);
    this.emitBurst("dust-fleck", x, y + 12, 12, 0.8, 0.28);
    if (isCrit) {
      this.emitBurst("crit-fleck", x, y - 10, 30, 1.35, 0.18);
      this.addCritFlash(x, y);
    }
    this.addTouchRing(x, y);
    this.addTouchFlash(x, y);
  }

  private playPerfectTouchFeedback(tile: FieldTile, bonusTouches: number): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
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
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    this.resetBaseTilePose(view);
    const finalScale = this.boardScale * this.getGrassScale(tile);
    view.grass.setScale(this.boardScale * 0.18, this.boardScale * 0.08);
    view.grass.setAlpha(0);
    view.grass.setPosition(view.label.x, view.label.y + 12);

    this.tweens.add({
      targets: view.grass,
      scaleX: finalScale * 1.18,
      scaleY: finalScale * 1.18,
      alpha: 1,
      y: view.label.y,
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

    this.emitBurst(tile.trait === "dewy" ? "dew-fleck" : "grass-fleck", view.label.x, view.label.y, 10, 0.55, 0.22);
  }

  private playSprinklerBurst(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const x = view.label.x;
    const y = view.label.y;
    this.spawnWorldActionArc("effect-water-drop", "sprinkler", x, y - 12 * this.boardScale, 4, 0xa8e8ff);
    const ring = this.add
      .ellipse(x, y, TILE_SIZE * 0.42 * this.boardScale, TILE_SIZE * 0.24 * this.boardScale, 0xa8e8ff, 0.22)
      .setStrokeStyle(3, 0xd7fff2, 0.9)
      .setDepth(38);
    const sparkle = this.add
      .star(x, y - 17 * this.boardScale, 6, TILE_SIZE * 0.08 * this.boardScale, TILE_SIZE * 0.33 * this.boardScale, 0xd7fff2, 0.78)
      .setStrokeStyle(2, 0xffffff, 0.85)
      .setDepth(39);

    this.emitBurst("effect-water-drop", x, y - 14 * this.boardScale, 30, 1.28, 0.5);

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

  private playCompanionAction(tile: FieldTile, action: "pollinate" | "scratch" | "forage" | "graze" | "burrow"): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const x = view.label.x;
    const y = view.label.y;

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

  private playBlockedTileFeedback(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
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

  private emitBurst(texture: string, x: number, y: number, quantity: number, speedScale: number, gravityScale: number): void {
    const particles = this.add.particles(x, y, texture, {
      lifespan: { min: 420, max: 760 },
      speed: { min: 38 * speedScale, max: 112 * speedScale },
      angle: { min: 205, max: 335 },
      gravityY: 240 * gravityScale,
      rotate: { min: -120, max: 120 },
      scale: { start: 1.55, end: 0 },
      alpha: { start: 1, end: 0 },
      quantity,
      emitting: false,
    });

    particles.setDepth(35);
    particles.explode(quantity, x, y);
    this.time.delayedCall(850, () => particles.destroy());
  }

  private emitUiBurst(texture: string, x: number, y: number, quantity: number, color = 0xffef78): void {
    const particles = this.add.particles(x, y, texture, {
      lifespan: { min: 520, max: 880 },
      speed: { min: 34, max: 120 },
      angle: { min: 190, max: 350 },
      gravityY: 40,
      rotate: { min: -160, max: 160 },
      scale: { start: 1.35, end: 0 },
      alpha: { start: 0.95, end: 0 },
      tint: [color, 0xffffff],
      quantity,
      emitting: false,
    });

    particles.setDepth(125);
    particles.explode(quantity, x, y);
    this.time.delayedCall(960, () => particles.destroy());
  }

  private playMilestoneCelebration(): void {
    this.flashScreen(0xffef78, 0.18, 460);
    this.emitUiBurst("crit-fleck", this.scale.width / 2, Math.max(150, this.boardTopY - 24), 46, 0xffef78);
    this.emitUiBurst("grass-fleck", this.scale.width / 2, Math.max(170, this.boardTopY), 34, 0xdfffc8);
    this.pulseText(this.milestoneText, 1.045);
  }

  private playJournalCelebration(): void {
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
    const ring = this.add
      .ellipse(x, y, TILE_SIZE * 0.82 * this.boardScale, TILE_SIZE * 0.48 * this.boardScale, 0xf7ffe8, 0.18)
      .setStrokeStyle(4, 0xf7ffe8, 0.95)
      .setDepth(34);

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
    const flash = this.add
      .rectangle(x, y, TILE_SIZE * 0.78 * this.boardScale, TILE_SIZE * 0.78 * this.boardScale, 0xf7ffe8, 0.36)
      .setDepth(36)
      .setAngle(45);

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
    const burst = this.add
      .star(x, y, 7, TILE_SIZE * 0.18 * this.boardScale, TILE_SIZE * 0.72 * this.boardScale, 0xfff08a, 0.8)
      .setStrokeStyle(3, 0xffffff, 0.95)
      .setDepth(37);

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

  private refreshUi(): void {
    const nextMilestone = MILESTONES.find((milestone) => !this.state.reachedMilestones.includes(milestone.id));
    const nextQuest = QUESTS.find((quest) => !this.state.claimedQuestIds.includes(quest.id) && isQuestAvailable(this.state, quest));
    const readyQuestCount = this.getReadyQuestKeys().size;
    const nextTier = getNextGrassTier(this.state);
    const weather = this.state.seedShopPurchases.weather_jar ? getWeather(this.state.activeWeatherId) : undefined;
    const season = getSeasonForDate(new Date());
    const compact = this.scale.width < 620;
    const resourceSeparator = compact ? "\n" : " | ";

    this.titleText.setText("Grass Touching Simulator");
    this.ambientSpores?.setVisible(!this.hasBlockingOverlayOpen());
    this.layoutSeasonVisuals();
    this.refreshWeatherVisuals();
    this.resourceText.setText(
      [
        `Grass Touches: ${Math.floor(this.state.grassTouches)}`,
        `Seeds: ${Math.floor(this.state.seeds)}`,
        `Gold: ${Math.floor(this.state.gold)}`,
        `Lifetime: ${Math.floor(this.state.lifetimeGrassTouches)}`,
        `Patches: ${Object.keys(this.state.field).length}`,
      ].join(resourceSeparator),
    );
    this.refreshComboBadge();
    this.skillResourceText.setText(`Available Grass Touches: ${Math.floor(this.state.grassTouches)}`);
    this.refreshQuestLog();
    this.refreshJournal();
    this.refreshSeedShop();
    this.refreshGoldStore();
    this.syncWorldObjects();
    this.layoutWorldObjects();
    this.milestoneText.setText(
      [
        nextMilestone
          ? `Next surface spread: ${nextMilestone.name} at ${nextMilestone.requiredLifetimeTouches} lifetime touches`
          : "All prototype surface spreads discovered.",
        `Season: ${season.name} - ${season.description}`,
        readyQuestCount > 0
          ? `Quest ready: ${readyQuestCount} reward${readyQuestCount === 1 ? "" : "s"} waiting`
          : nextQuest
            ? `Next quest: ${nextQuest.name} - ${formatQuestProgress(nextQuest, this.state)}`
            : "All current quests claimed.",
        nextTier ? `Next grass tier: ${nextTier.name} at ${nextTier.unlockAtLifetimeTouches} lifetime touches` : "",
        weather ? `Weather: ${weather.name} - ${weather.description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.milestoneText.setPosition(26, this.layoutComboBadge());

    for (const upgrade of UPGRADES) {
      const view = this.skillNodeViews.get(upgrade.id);
      const level = this.state.upgrades[upgrade.id]?.level ?? 0;
      const unlocked = canUnlockUpgrade(this.state, upgrade);
      const maxed = level >= upgrade.maxLevel;
      const cost = getUpgradeCost(upgrade, level);
      const available = unlocked && !maxed && this.state.grassTouches >= cost;

      if (!view) {
        continue;
      }

      const selected = upgrade.id === this.selectedSkillId;
      const stroke = selected ? 0xffe460 : available ? 0xf4df6a : level > 0 ? upgrade.tree.color : 0x506056;

      view.container.setAlpha(unlocked || level > 0 ? 1 : 0.5);
      view.bg.setFillStyle(0xffffff, 0.001);
      view.bg.setStrokeStyle(1, stroke, 0);
      view.frame.setTint(stroke);
      view.frame.setAlpha(selected ? 1 : available ? 0.96 : level > 0 ? 0.86 : 0.46);
      view.frame.setDisplaySize(selected ? 70 : SKILL_NODE_VISUAL_SIZE, selected ? 70 : SKILL_NODE_VISUAL_SIZE);
      view.icon.setTexture(getSkillIconKey(upgrade.id));
      view.icon.setVisible(unlocked || level > 0);
      view.icon.setAlpha(available ? 1 : level > 0 ? 0.95 : 0.72);
      view.icon.setTint(level > 0 || unlocked ? 0xffffff : 0x8fa08f);
      view.lockedIcon.setVisible(!unlocked && level === 0);
      view.level.setText(`Lv ${level}/${upgrade.maxLevel}`);
      view.level.setColor(available || selected ? "#f4df6a" : level > 0 ? "#dfffc8" : "#7c8b82");
    }

    this.refreshSkillDetail();
  }

  private refreshComboBadge(): void {
    const count = this.combo.getCount();
    const show = count >= 2 && !this.hasBlockingOverlayOpen();
    this.comboBadge.setVisible(show);

    if (!show) {
      return;
    }

    const multiplier = this.combo.getMultiplier();
    const remaining = Phaser.Math.Clamp((this.combo.getExpiresAt() - Date.now()) / this.combo.getWindowMs(), 0, 1);
    const badgeWidth = this.comboBadgeBg.width;
    const meterWidth = Math.max(8, (badgeWidth - 24) * remaining);
    const multiplierText = multiplier > 1 ? ` x${multiplier.toFixed(multiplier >= 2 ? 0 : 2)}` : "";

    this.comboBadgeText.setText(`Combo ${count}${multiplierText}`);
    this.comboBadgeMeter.setSize(meterWidth, 4);
    this.comboBadgeMeter.setFillStyle(multiplier > 1 ? 0xf4df6a : 0xb7eba5, 0.92);
  }

  private refreshQuestLog(): void {
    const readyCount = QUESTS.filter((quest) => isQuestClaimable(this.state, quest)).length;
    const claimedCount = this.state.claimedQuestIds.length;
    const filteredQuests = this.getFilteredQuests();
    const filterCounts = this.getQuestFilterCounts();

    setTextButtonText(this.questButton, readyCount > 0 ? `Quests (${readyCount})` : "Quests");
    this.questResourceText?.setText(`Showing: ${filteredQuests.length}/${QUESTS.length} | Claimed: ${claimedCount}/${QUESTS.length} | Ready: ${readyCount}`);
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

      view.bg.setFillStyle(claimed ? 0x20351f : complete ? 0x1c4728 : available ? 0x12341c : 0x14231a, claimed ? 0.74 : 0.95);
      view.bg.setStrokeStyle(3, claimed ? 0x51615a : complete ? 0xf4df6a : available ? 0xb7eba5 : 0x496455, complete ? 0.9 : 0.62);
      view.container.setAlpha(claimed ? 0.72 : available ? 1 : 0.78);
      view.progress.setText(claimed ? "Claimed" : formatQuestProgress(quest, this.state));
      view.progress.setColor(complete ? "#f4df6a" : available ? "#b7eba5" : "#8ea594");
      view.reward.setText(`Reward:\n${formatQuestReward(quest.reward)}`);
      setTextButtonText(view.claimButton, claimed ? "Claimed" : complete ? "Claim" : "Locked");
      setTextButtonEnabled(view.claimButton, complete && !claimed);
    }

    if (this.questLogOpen) {
      this.layoutQuestLog();
    }
  }

  private refreshJournal(): void {
    if (!this.journalRoot) {
      return;
    }

    const journalUnlocked = this.state.seedShopPurchases.field_journal === true;
    this.journalButton.setVisible(journalUnlocked);
    this.journalButton.setPosition(this.scale.width - 142, 232);
    this.optionsButton.setPosition(this.scale.width - 142, journalUnlocked ? 284 : 232);

    const ownedCompanions = GOLD_STORE_ITEMS.filter((item) => item.kind === "animal" && getInventoryQuantity(this.state, item.id) > 0);
    this.journalResourceText.setText(
      [
        `Grass: ${this.state.journal.discoveredGrassTiers.length}/${GRASS_TIERS.length}`,
        `Weather: ${this.state.journal.seenWeatherIds.length}/${WEATHER_TYPES.length}`,
        `Companions: ${ownedCompanions.length}/${GOLD_STORE_ITEMS.filter((item) => item.kind === "animal").length}`,
      ].join(" | "),
    );

    this.journalBodyText.setText(
      [
        this.formatJournalGrassSection(),
        this.formatJournalTraitSection(),
        this.formatJournalWeatherSection(),
        this.formatJournalCompanionSection(),
        this.formatJournalProgressSection(),
      ].join("\n\n"),
    );
    this.layoutJournal();
  }

  private updateJournalDiscoveries(): boolean {
    let changed = false;

    for (const tile of getFieldTiles(this.state)) {
      changed = this.addJournalValue(this.state.journal.discoveredGrassTiers, tile.tier) || changed;
      changed = this.addJournalValue(this.state.journal.discoveredTileTraits, tile.trait) || changed;
    }

    if (this.state.activeWeatherId) {
      changed = this.addJournalValue(this.state.journal.seenWeatherIds, this.state.activeWeatherId) || changed;
    }

    if (this.combo.getCount() > this.state.journal.bestComboCount) {
      this.state.journal.bestComboCount = this.combo.getCount();
      changed = true;
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

  private formatJournalCompanionSection(): string {
    const animals = GOLD_STORE_ITEMS.filter((item) => item.kind === "animal");

    return [
      "Companions",
      ...animals.map((item) => {
        const quantity = getInventoryQuantity(this.state, item.id);
        return quantity > 0
          ? `- ${item.name} x${quantity}: ${JOURNAL_COMPANION_NOTES[item.id] ?? item.description}`
          : `- Undiscovered companion: ${item.isUnlocked(this.state) ? "Available in the Gold Store." : "Keep earning gold and meeting companions."}`;
      }),
    ].join("\n");
  }

  private formatJournalProgressSection(): string {
    return [
      "Progress Notes",
      `- Milestones reached: ${this.state.reachedMilestones.length}/${MILESTONES.length}`,
      `- Quests claimed: ${this.state.claimedQuestIds.length}/${QUESTS.length}`,
      `- Best manual combo: ${this.state.journal.bestComboCount}`,
    ].join("\n");
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

    this.state.claimedQuestIds.push(questId);
    this.state.grassTouches += quest.reward.grassTouches ?? 0;
    this.state.seeds += quest.reward.seeds ?? 0;
    this.state.lifetimeSeeds += quest.reward.seeds ?? 0;
    this.state.gold += quest.reward.gold ?? 0;
    this.state.lifetimeGold += quest.reward.gold ?? 0;
    const claimMessage = `${quest.name} claimed: ${formatQuestReward(quest.reward)}.`;
    this.audio.play("milestone");
    saveGame(this.state);
    this.readyQuestKeys = this.getReadyQuestKeys();
    this.playQuestClaimFeedback(questId);
    this.refreshUi();
    this.questStatusText.setText(claimMessage);
  }

  private playQuestClaimFeedback(questId: string): void {
    const view = this.questItemViews.get(questId);
    if (!view || !this.questLogOpen || !view.container.visible) {
      this.bumpResourceHud();
      return;
    }

    const x = view.container.x + view.bg.width / 2;
    const y = view.container.y + view.bg.height / 2;
    const burst = this.add
      .star(x, y, 7, 12, 42, 0xf4df6a, 0.62)
      .setStrokeStyle(2, 0xf7ffe8, 0.72)
      .setDepth(118);
    const pop = this.add
      .text(x, y - 8, "claimed", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#f7ffe8",
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
    const stats = getRuntimeStats(this.state);
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

      view.container.setAlpha(unlocked || purchased ? 1 : 0.76);
      view.bg.setFillStyle(purchased ? 0xdfffc8 : 0xf4ffdc, unlocked || purchased ? 0.96 : 0.7);
      view.bg.setStrokeStyle(3, purchased ? 0x85d35e : affordable && unlocked ? 0xf5ec72 : 0x2d6f36);

      if (purchased) {
        view.status.setText("Unlocked");
        view.status.setColor("#26652e");
      } else if (!unlocked) {
        view.status.setText("Locked");
        view.status.setColor("#c8d1cc");
      } else if (!affordable) {
        view.status.setText(`Cost: ${item.cost} seeds | Need ${item.cost - Math.floor(this.state.seeds)} more`);
        view.status.setColor("#6d4c19");
      } else {
        view.status.setText(`Cost: ${item.cost} seeds | Ready`);
        view.status.setColor("#26652e");
      }
    }
  }

  private refreshGoldStore(): void {
    this.storeResourceText.setText(`Gold: ${Math.floor(this.state.gold)} | Lifetime Gold: ${Math.floor(this.state.lifetimeGold)}`);

    for (const item of GOLD_STORE_ITEMS) {
      const view = this.storeItemViews.get(item.id);
      if (!view) {
        continue;
      }

      const quantity = getInventoryQuantity(this.state, item.id);
      const unlocked = item.isUnlocked(this.state);
      const affordable = this.state.gold >= item.cost;
      const maxed = item.maxQuantity !== undefined && quantity >= item.maxQuantity;
      const owned = quantity > 0;

      view.container.setAlpha(unlocked || owned ? 1 : 0.72);
      view.bg.setFillStyle(owned ? 0xfff1a8 : 0xfff8d4, unlocked || owned ? 0.96 : 0.68);
      view.bg.setStrokeStyle(3, maxed ? 0x85d35e : affordable && unlocked ? 0xffef78 : 0x8f6a1a);

      if (!unlocked && !owned) {
        view.status.setText("Locked");
        view.status.setColor("#c8d1cc");
      } else if (maxed) {
        view.status.setText(item.maxQuantity ? `Owned: ${quantity}/${item.maxQuantity} | Passive active` : "Owned | Passive active");
        view.status.setColor("#26652e");
      } else if (item.kind === "consumable" && owned) {
        view.status.setText(`Owned: ${quantity} | Tap to use`);
        view.status.setColor("#26652e");
      } else if (item.kind === "animal" && owned && item.maxQuantity !== undefined) {
        const countText = `Owned: ${quantity}/${item.maxQuantity}`;
        view.status.setText(affordable ? `${countText} | Cost: ${item.cost} gold | Tap to add` : `${countText} | Need ${item.cost - Math.floor(this.state.gold)} more`);
        view.status.setColor(affordable ? "#26652e" : "#6d4c19");
      } else if (!affordable) {
        view.status.setText(`Cost: ${item.cost} gold | Need ${item.cost - Math.floor(this.state.gold)} more`);
        view.status.setColor("#6d4c19");
      } else {
        view.status.setText(`Cost: ${item.cost} gold | Tap to buy`);
        view.status.setColor("#26652e");
      }
    }
  }

  private refreshSkillDetail(): void {
    const upgrade = UPGRADES.find((candidate) => candidate.id === this.selectedSkillId) ?? UPGRADES[0];
    const level = this.state.upgrades[upgrade.id]?.level ?? 0;
    const cost = getUpgradeCost(upgrade, level);
    const maxed = level >= upgrade.maxLevel;
    const unlocked = canUnlockUpgrade(this.state, upgrade);
    const missingPrerequisites = (upgrade.prerequisiteIds ?? [])
      .filter((id) => (this.state.upgrades[id]?.level ?? 0) === 0)
      .map((id) => UPGRADES.find((candidate) => candidate.id === id)?.name ?? id);

    this.skillDetailTitle.setText(upgrade.name);
    this.skillDetailCategory.setText(`${this.getUpgradeBranch(upgrade.id)} branch`);
    this.skillDetailBody.setText(`${upgrade.description}\n\nLevel ${level}/${upgrade.maxLevel}`);

    if (maxed) {
      this.skillDetailCost.setText("Fully unlocked.");
      setTextButtonText(this.skillBuyButton, "Maxed");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (missingPrerequisites.length > 0) {
      this.skillDetailCost.setText(`Requires: ${missingPrerequisites.join(", ")}`);
      setTextButtonText(this.skillBuyButton, "Locked");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (!upgrade.isUnlocked(this.state)) {
      this.skillDetailCost.setText("Keep touching grass to reveal this.");
      setTextButtonText(this.skillBuyButton, "Locked");
      setTextButtonEnabled(this.skillBuyButton, false);
    } else if (this.state.grassTouches < cost) {
      this.skillDetailCost.setText(
        `Cost to Upgrade: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nNeed: ${
          cost - Math.floor(this.state.grassTouches)
        } more`,
      );
      setTextButtonText(this.skillBuyButton, `Need ${cost - Math.floor(this.state.grassTouches)}`);
      setTextButtonEnabled(this.skillBuyButton, false);
    } else {
      this.skillDetailCost.setText(`Cost to Upgrade: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nReady to upgrade`);
      setTextButtonText(this.skillBuyButton, "Upgrade");
      setTextButtonEnabled(this.skillBuyButton, true);
    }
  }

  private setSkillStatus(message: string): void {
    this.skillStatusText.setText(message);
    this.time.delayedCall(1800, () => {
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
    if (["softer_grass", "palm_press", "two_handed_technique", "mindful_contact", "barefoot_confidence"].includes(upgradeId)) {
      return "Touch";
    }

    if (["faster_regrowth", "warm_sunlight", "fertile_soil", "root_network", "perennial_patches"].includes(upgradeId)) {
      return "Growth";
    }

    if (["lucky_clover", "dramatic_touch", "satisfying_crunch", "overreaction"].includes(upgradeId)) {
      return "Crits";
    }

    if (["dew_appreciation", "morning_mist", "dew_respecter", "weather_watching"].includes(upgradeId)) {
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

  private setStoreStatus(message: string): void {
    this.storeStatusText.setText(message);
    this.time.delayedCall(1900, () => {
      if (this.storeOpen) {
        this.storeStatusText.setText("Gold buys consumables and field companions.");
      }
    });
  }

  private playGoldStoreItemSuccess(itemId: string): void {
    const view = this.storeItemViews.get(itemId);
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
      const level = this.state.upgrades[upgrade.id]?.level ?? 0;
      const maxed = level >= upgrade.maxLevel;
      const cost = getUpgradeCost(upgrade, level);

      if (!maxed && canUnlockUpgrade(this.state, upgrade) && this.state.grassTouches >= cost) {
        keys.add(`upgrade:${upgrade.id}:${level + 1}`);
      }
    }

    for (const item of SEED_SHOP_ITEMS) {
      if (!this.state.seedShopPurchases[item.id] && item.isUnlocked(this.state) && this.state.seeds >= item.cost) {
        keys.add(`seed:${item.id}`);
      }
    }

    for (const item of GOLD_STORE_ITEMS) {
      const quantity = getInventoryQuantity(this.state, item.id);
      const maxed = item.maxQuantity !== undefined && quantity >= item.maxQuantity;
      if (!maxed && item.isUnlocked(this.state) && this.state.gold >= item.cost) {
        keys.add(`gold:${item.id}:${quantity}`);
      }
    }

    return keys;
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
    this.showMessage(quest ? `Quest complete: ${quest.name}. Claim it in the Quest Log.` : "Quest complete. Claim it in the Quest Log.", 3200);
  }

  private bumpSkillNode(upgradeId: string, success: boolean): void {
    const view = this.skillNodeViews.get(upgradeId);
    if (!view) {
      return;
    }

    this.tweens.killTweensOf(view.container);
    this.tweens.add({
      targets: view.container,
      scaleX: success ? view.container.scaleX * 1.16 : view.container.scaleX * 0.94,
      scaleY: success ? view.container.scaleY * 1.16 : view.container.scaleY * 0.94,
      duration: 80,
      yoyo: true,
      ease: "Sine.easeOut",
    });

    if (!success) {
      this.tweens.add({
        targets: view.container,
        x: view.container.x + 5,
        duration: 45,
        yoyo: true,
        repeat: 3,
        ease: "Sine.easeInOut",
      });
    }
  }

  private buyUpgrade(upgradeId: string): boolean {
    const upgrade = UPGRADES.find((candidate) => candidate.id === upgradeId);
    if (!upgrade || !canUnlockUpgrade(this.state, upgrade)) {
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
    if (this.state.grassTouches < cost) {
      this.setSkillStatus(
        `${upgrade.name} costs ${cost}. You have ${Math.floor(this.state.grassTouches)}. Need ${
          cost - Math.floor(this.state.grassTouches)
        } more.`,
      );
      this.audio.play("blocked");
      this.refreshUi();
      return false;
    }

    this.state.grassTouches -= cost;
    this.state.upgrades[upgrade.id] = { level: level + 1 };
    this.setSkillStatus(`${upgrade.name} upgraded to ${level + 1}/${upgrade.maxLevel}.`);
    this.audio.play("upgrade");
    saveGame(this.state);
    this.layoutSkillTree();
    this.refreshUi();
    return true;
  }

  private checkMilestones(stats: ReturnType<typeof getRuntimeStats>): void {
    for (const milestone of MILESTONES) {
      if (
        this.state.lifetimeGrassTouches >= milestone.requiredLifetimeTouches &&
        !this.state.reachedMilestones.includes(milestone.id)
      ) {
        this.state.reachedMilestones.push(milestone.id);
        const addedTiles = expandField(this.state, milestone.tilesToAdd, stats);

        for (const tile of addedTiles) {
          this.createTileView(tile);
        }

        this.layoutTiles();
        this.playTileDropCascade(addedTiles);
        this.showMessage(milestone.message, 3200);
        this.playMilestoneCelebration();
        this.audio.play("milestone");
        saveGame(this.state);
      }
    }
  }

  private popAtTile(tile: FieldTile, text: string, color: string): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const pop = this.add
      .text(view.base.x, view.base.y - 18, text, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color,
        stroke: "#17491f",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(40);
    pop.setScale(0.75);

    this.tweens.add({
      targets: pop,
      y: pop.y - 34,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 760,
      ease: "Sine.easeOut",
      onComplete: () => pop.destroy(),
    });
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
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
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
    const spriteCount = Phaser.Math.Clamp(Math.ceil(amount), 1, 4);

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
      .setDepth(82)
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

    if (this.scale.width < 620) {
      const lineHeight = Math.max(18, bounds.height / 5);
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
    this.milestoneText.setText(message);
    this.time.delayedCall(duration, () => this.refreshUi());
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
