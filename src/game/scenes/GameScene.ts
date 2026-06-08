import Phaser from "phaser";
import { DEFAULT_MUSIC_VOLUME, readStoredMusicVolume, writeStoredMusicVolume } from "../data/audio-settings";
import { GRASS_TIERS, getGrassTier, getNextGrassTier } from "../data/grass-tiers";
import { BUILD_LABEL } from "../data/build-info";
import { GOLD_STORE_ITEMS } from "../data/gold-store";
import { MILESTONES } from "../data/milestones";
import { SEED_SHOP_ITEMS, getSeedDropChance } from "../data/seed-shop";
import { getSeasonForDate } from "../data/seasons";
import { UPGRADES, canUnlockUpgrade, getUpgradeCost } from "../data/upgrades";
import { getWeather, pickWeather } from "../data/weather";
import { expandField, getFieldBounds, getFieldTiles, getRegrowingTiles, tileKey, touchTile, updateRegrowth } from "../systems/FieldSystem";
import { addInventoryItem, consumeInventoryItem, getInventoryQuantity } from "../systems/InventorySystem";
import { AnimalCompanionSystem } from "../systems/AnimalCompanionSystem";
import { AudioSystem } from "../systems/AudioSystem";
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
const TREE_WIDTH = 880;
const TREE_HEIGHT = 560;
const SKILL_NODE_SIZE = 78;
const SHOP_ICON_SIZE = 48;

const SKILL_BRANCH_LABELS = [
  { text: "Touch", x: 230, y: 50, color: "#dfffc8" },
  { text: "Growth", x: 430, y: 190, color: "#bff4ff" },
  { text: "Nature", x: 660, y: 50, color: "#d7fff2" },
  { text: "Crits", x: 420, y: 525, color: "#ffef78" },
  { text: "Meadow", x: 700, y: 335, color: "#dfffc8" },
];

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
};

const WORLD_OBJECTS = [
  { id: "sprinkler", textureKey: "world-tiny-sprinkler", label: "sprinkler", kind: "seed" },
  { id: "bee_hive", textureKey: "world-bee-hive", label: "hive", kind: "inventory" },
  { id: "chicken", textureKey: "world-chicken", label: "chicken", kind: "inventory" },
  { id: "sheep", textureKey: "world-sheep", label: "sheep", kind: "inventory" },
  { id: "field_mouse", textureKey: "world-field-mouse", label: "mouse", kind: "inventory" },
  { id: "meadow_rabbit", textureKey: "world-meadow-rabbit", label: "rabbit", kind: "inventory" },
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
  icon: Phaser.GameObjects.Text;
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

interface WorldObjectView {
  id: string;
  quantity: number;
  container: Phaser.GameObjects.Container;
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
  private worldObjectViews = new Map<string, WorldObjectView>();
  private titleText!: Phaser.GameObjects.Text;
  private buildLabelText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
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
  private seedButton!: Phaser.GameObjects.Container;
  private storeButton!: Phaser.GameObjects.Container;
  private optionsButton!: Phaser.GameObjects.Container;
  private skillRoot!: Phaser.GameObjects.Container;
  private skillBackdrop!: Phaser.GameObjects.Rectangle;
  private skillTitleText!: Phaser.GameObjects.Text;
  private skillResourceText!: Phaser.GameObjects.Text;
  private skillStatusText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Container;
  private skillLineGraphics!: Phaser.GameObjects.Graphics;
  private skillNodeViews = new Map<string, SkillNodeView>();
  private skillDetailPanel!: Phaser.GameObjects.Container;
  private skillDetailBg!: Phaser.GameObjects.Rectangle;
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
  private optionsRoot!: Phaser.GameObjects.Container;
  private optionsBackdrop!: Phaser.GameObjects.Rectangle;
  private optionsPanel!: Phaser.GameObjects.Rectangle;
  private optionsTitleText!: Phaser.GameObjects.Text;
  private optionsVolumeLabel!: Phaser.GameObjects.Text;
  private optionsVolumeTrack!: Phaser.GameObjects.Rectangle;
  private optionsVolumeFill!: Phaser.GameObjects.Rectangle;
  private optionsVolumeHit!: Phaser.GameObjects.Rectangle;
  private optionsVolumeKnob!: Phaser.GameObjects.Arc;
  private optionsBackButton!: Phaser.GameObjects.Container;
  private seedShopScroll = 0;
  private storeScroll = 0;
  private resetArmed = false;
  private lastAutoSaveAt = 0;
  private sprinkler = new SprinklerSystem();
  private animalCompanions = new AnimalCompanionSystem();
  private drops = new DropSystem();
  private audio = new AudioSystem();
  private skillTreeOpen = false;
  private seedShopOpen = false;
  private storeOpen = false;
  private optionsOpen = false;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private draggingMusicVolume = false;
  private musicVolumeSliderX = 0;
  private musicVolumeSliderWidth = 1;
  private readyUnlockKeys = new Set<string>();
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
  private isPanningBoard = false;
  private boardPanStartX = 0;
  private boardPanStartY = 0;
  private pointerPanStartX = 0;
  private pointerPanStartY = 0;

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

    for (const itemKey of new Set([...Object.values(SEED_SHOP_ICON_KEYS), ...Object.values(GOLD_STORE_ICON_KEYS)])) {
      if (itemKey.startsWith("world-")) {
        continue;
      }

      this.load.image(itemKey, `/assets/ui/items/${itemKey.replace("item-", "")}.png`);
    }

    this.load.image("effect-water-drop", "/assets/effects/water-drop.png");
    this.load.image("effect-pollen-fleck", "/assets/effects/pollen-fleck.png");
    this.load.image("effect-bee-pixel", "/assets/effects/bee-pixel.png");
    this.load.image("effect-gold-coin", "/assets/effects/gold-coin.png");
    this.load.image("effect-seed-kernel", "/assets/effects/seed-kernel.png");
  }

  create(data?: { newGame?: boolean }): void {
    this.state = data?.newGame ? resetSave() : loadGame();
    this.musicVolume = readStoredMusicVolume();
    saveGame(this.state);

    this.cameras.main.setBackgroundColor("#7fc66c");
    this.updateWeather(Date.now(), false);
    this.createTileTextures();
    this.createHeader();
    this.createSeasonVisuals();
    this.createWeatherVisuals();
    this.createTileInfoPanel();
    this.createSkillTree();
    this.createSeedShop();
    this.createGoldStore();
    this.createOptionsPanel();
    this.renderAllTiles();
    this.layoutHeader();
    this.layoutSkillTree();
    this.layoutSeedShop();
    this.refreshUi();
    this.readyUnlockKeys = this.getReadyUnlockKeys();
    this.showMessage("Touch the grass. Let it regrow. Become reasonable.", 3600);

    this.scale.on("resize", () => {
      this.layoutHeader();
      this.layoutSeasonVisuals();
      this.layoutWeatherVisuals();
      this.layoutTiles();
      this.layoutSkillTree();
      this.layoutSeedShop();
      this.layoutGoldStore();
      this.layoutOptionsPanel();
    });

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      if (this.optionsOpen) {
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
      if (this.skillTreeOpen || this.seedShopOpen || this.storeOpen || this.optionsOpen || gameObjects.length > 0) {
        return;
      }

      this.isPanningBoard = true;
      this.boardPanStartX = this.boardPanX;
      this.boardPanStartY = this.boardPanY;
      this.pointerPanStartX = pointer.x;
      this.pointerPanStartY = pointer.y;
      this.tileInfoPanel.setVisible(false);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isPanningBoard) {
        return;
      }

      this.boardPanX = this.boardPanStartX + pointer.x - this.pointerPanStartX;
      this.boardPanY = this.boardPanStartY + pointer.y - this.pointerPanStartY;
      this.layoutTiles();
    });

    this.input.on("pointerup", () => {
      this.isPanningBoard = false;
      this.draggingMusicVolume = false;
    });

    this.input.on("pointerupoutside", () => {
      this.isPanningBoard = false;
      this.draggingMusicVolume = false;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handleMusicVolumeDrag(pointer));
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
    this.updateWeather(now, true);
    const stats = getRuntimeStats(this.state);
    const regrown = updateRegrowth(this.state, stats, now);

    for (const tile of regrown) {
      this.refreshTile(tile);
      this.playRegrowFeedback(tile);
      this.popAtTile(tile, tile.trait === "lush" ? "lush" : tile.trait === "dewy" ? "dew" : "grass", "#e7ffd1");
    }

    if (regrown.length > 0) {
      this.audio.play("regrow");
    }

    this.checkMilestones(stats);
    this.updateSprinkler(delta, stats);
    this.updateAnimalCompanions(delta, stats);
    this.checkReadyUnlocks();
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
    this.seedButton = createTextButton(this, "Seeds", () => this.openSeedShop(), 118, 44, 20);
    this.storeButton = createTextButton(this, "Store", () => this.openGoldStore(), 118, 44, 20);
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

  private layoutHeader(): void {
    const compact = this.scale.width < 760;
    const headerWidth = Math.max(220, Math.min(620, this.scale.width - 180));

    this.titleText.setFontSize(compact ? 22 : 30);
    this.titleText.setWordWrapWidth(headerWidth);
    this.buildLabelText.setFontSize(compact ? 12 : 13);
    this.buildLabelText.setWordWrapWidth(headerWidth);
    this.resourceText.setFontSize(compact ? 15 : 18);
    this.resourceText.setWordWrapWidth(headerWidth);
    this.milestoneText.setFontSize(compact ? 13 : 16);
    this.milestoneText.setWordWrapWidth(headerWidth);

    this.titleText.setPosition(24, compact ? 18 : 18);
    this.buildLabelText.setPosition(26, this.titleText.y + this.titleText.height + 1);
    this.resourceText.setPosition(26, this.buildLabelText.y + this.buildLabelText.height + 8);
    this.milestoneText.setPosition(26, this.resourceText.y + this.resourceText.height + 12);
    this.skillButton.setPosition(this.scale.width - 142, 24);
    this.seedButton.setPosition(this.scale.width - 142, 76);
    this.storeButton.setPosition(this.scale.width - 142, 128);
    this.optionsButton.setPosition(this.scale.width - 142, 180);
    this.layoutSeasonVisuals();
    this.layoutWeatherVisuals();
  }

  private layoutSeasonVisuals(): void {
    if (!this.seasonTint) {
      return;
    }

    const season = getSeasonForDate(new Date());
    this.seasonTint.setSize(this.scale.width, this.scale.height);
    this.seasonTint.setFillStyle(season.color, season.alpha);
    this.seasonTint.setVisible(!this.skillTreeOpen && !this.seedShopOpen && !this.storeOpen && !this.optionsOpen);
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
      .rectangle(0, 0, 230, 112, 0xf4ffdc, 0.97)
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
      wordWrap: { width: 206 },
    });

    this.tileInfoPanel.add([this.tileInfoBg, this.tileInfoTitle, this.tileInfoBody]);
  }

  private createSkillTree(): void {
    this.skillRoot?.destroy();
    this.skillNodeViews.clear();

    this.skillRoot = this.add.container(0, 0).setDepth(100).setVisible(false);
    this.skillBranchLabels = [];
    this.skillBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x1c2520, 1)
      .setOrigin(0, 0)
      .setInteractive();

    this.skillTitleText = this.add.text(0, 0, "Grass Skill Tree", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "34px",
      color: "#f7ffe8",
      stroke: "#17491f",
      strokeThickness: 6,
    });

    this.skillResourceText = this.add.text(0, 0, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#173b20",
      backgroundColor: "#e9ffd0",
      padding: { x: 12, y: 8 },
    });

    this.skillStatusText = this.add
      .text(0, 0, "Hover a skill to inspect it. Click a skill or Upgrade to buy.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    this.backButton = createTextButton(this, "Back", () => this.closeSkillTree(), 118, 44, 101);
    this.skillLineGraphics = this.add.graphics();
    this.skillRoot.add([
      this.skillBackdrop,
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
        .rectangle(0, 0, SKILL_NODE_SIZE, SKILL_NODE_SIZE, 0x2a3730, 1)
        .setOrigin(0.5)
        .setStrokeStyle(4, upgrade.tree.color)
        .setInteractive({ useHandCursor: true });
      const icon = this.add
        .text(0, -16, upgrade.tree.icon, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "19px",
          color: "#f7ffe8",
          align: "center",
        })
        .setOrigin(0.5);
      const level = this.add
        .text(0, 22, "", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "15px",
          color: "#dfffc8",
        })
        .setOrigin(0.5);

      container.add([bg, icon, level]);
      bg.on("pointerover", () => this.previewSkill(upgrade.id));
      bg.on("pointerdown", () => this.upgradeSkill(upgrade.id));
      this.skillNodeViews.set(upgrade.id, { upgradeId: upgrade.id, container, bg, icon, level });
      this.skillRoot.add(container);
    }

    this.skillDetailPanel = this.add.container(0, 0);
    this.skillDetailBg = this.add
      .rectangle(0, 0, 330, 272, 0xf4ffdc, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x2d6f36);
    this.skillDetailTitle = this.add.text(16, 14, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "23px",
      color: "#183d20",
    });
    this.skillDetailCategory = this.add.text(16, 43, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "13px",
      color: "#2d6f36",
    });
    this.skillDetailBody = this.add.text(16, 66, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "16px",
      color: "#416247",
      wordWrap: { width: 298 },
    });
    this.skillDetailCost = this.add.text(16, 154, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#6d4c19",
      wordWrap: { width: 298 },
    });
    this.skillBuyButton = createTextButton(this, "Upgrade", () => this.upgradeSelectedSkill(), 138, 40, 101);
    this.skillBuyButton.setPosition(16, 216);
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
    const reservedBottomHeight = narrowPortrait || narrowDesktop ? 370 : 190;
    const treeScale = shortLandscape
      ? Math.max(0.32, Math.min(0.62, (this.scale.width - 310) / TREE_WIDTH, (this.scale.height - 130) / TREE_HEIGHT))
      : Math.min(1, (this.scale.width - reservedSideWidth) / TREE_WIDTH, (this.scale.height - reservedBottomHeight) / TREE_HEIGHT);
    const treeWidth = TREE_WIDTH * treeScale;
    const treeX = shortLandscape ? 24 : sidePanel ? Math.max(24, (this.scale.width - 372 - treeWidth) / 2) : (this.scale.width - treeWidth) / 2;
    const treeY = shortLandscape ? 124 : 150;

    this.skillBackdrop.setSize(this.scale.width, this.scale.height);
    this.skillTitleText.setText(narrowPortrait ? "Skills" : "Grass Skill Tree");
    this.skillTitleText.setFontSize(shortLandscape ? 25 : narrowPortrait ? 30 : 34);
    this.skillResourceText.setFontSize(shortLandscape || narrowPortrait ? 14 : 18);
    this.skillStatusText.setFontSize(shortLandscape || narrowPortrait ? 13 : 16);
    this.skillStatusText.setWordWrapWidth(Math.max(220, this.scale.width - 48));
    this.skillTitleText.setPosition(24, 24);
    this.skillResourceText.setPosition(26, shortLandscape ? 62 : 78);
    this.skillStatusText.setText(
      this.hasTouchScreen() ? "Tap a skill to upgrade it. The info box shows details." : "Hover a skill to inspect it. Click a skill or Upgrade to buy.",
    );
    this.skillStatusText.setPosition(
      shortLandscape ? this.scale.width / 2 + 20 : sidePanel ? treeX + treeWidth / 2 : this.scale.width / 2,
      shortLandscape ? 72 : this.skillResourceText.y + this.skillResourceText.height + 8,
    );
    this.backButton.setScale(narrowPortrait ? 0.9 : 1);
    this.backButton.setPosition(this.scale.width - 142, 24);
    this.resetButton.setScale(shortLandscape ? 0.78 : narrowPortrait ? 0.86 : 0.88);
    this.resetButton.setPosition(this.scale.width - 108, this.scale.height - (shortLandscape ? 42 : narrowPortrait ? 46 : 48));
    this.skillDetailPanel.setScale(shortLandscape ? 0.72 : narrowPortrait ? 1 : 1);
    this.skillDetailPanel.setPosition(
      shortLandscape
        ? this.scale.width - 252
        : narrowPortrait || narrowDesktop
          ? (this.scale.width - 330) / 2
          : Math.max(24, this.scale.width - 360),
      shortLandscape ? 112 : narrowPortrait ? this.scale.height - 310 : sidePanel ? 150 : this.scale.height - 270,
    );

    for (const label of this.skillBranchLabels) {
      label.text.setPosition(treeX + label.treeX * treeScale, treeY + label.treeY * treeScale);
      label.text.setScale(Math.max(0.72, treeScale));
      label.text.setVisible(!shortLandscape || treeScale > 0.42);
    }

    for (const upgrade of UPGRADES) {
      const view = this.skillNodeViews.get(upgrade.id);
      if (!view) {
        continue;
      }

      view.container.setPosition(treeX + upgrade.tree.x * treeScale, treeY + upgrade.tree.y * treeScale);
      view.container.setScale(treeScale);
    }

    this.drawSkillLines(treeScale, treeX, treeY);
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

    this.seedBackdrop.setSize(this.scale.width, this.scale.height);
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

    this.storeBackdrop.setSize(this.scale.width, this.scale.height);
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
      .rectangle(0, 0, 460, 210, 0xf4ffdc, 0.98)
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
      this.optionsBackButton,
    ]);
    this.refreshOptionsPanel();
  }

  private layoutOptionsPanel(): void {
    const panelWidth = Math.min(500, this.scale.width - 36);
    const panelHeight = Math.min(220, this.scale.height - 48);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const trackWidth = Math.max(190, panelWidth - 120);
    const trackX = centerX - trackWidth / 2;
    const trackY = centerY + 2;

    this.optionsBackdrop?.setSize(this.scale.width, this.scale.height);
    this.optionsPanel?.setPosition(centerX, centerY).setSize(panelWidth, panelHeight);
    this.optionsTitleText?.setPosition(centerX, centerY - panelHeight / 2 + 44);
    this.optionsVolumeLabel?.setPosition(centerX, centerY - 34);
    this.optionsVolumeTrack?.setPosition(trackX, trackY).setSize(trackWidth, 12);
    this.optionsVolumeFill?.setPosition(trackX, trackY).setSize(trackWidth * this.musicVolume, 12);
    this.optionsVolumeHit?.setPosition(centerX, trackY).setSize(trackWidth + 36, 44);
    this.optionsVolumeKnob?.setPosition(trackX + trackWidth * this.musicVolume, trackY);
    this.optionsBackButton?.setPosition(centerX - 59, centerY + panelHeight / 2 - 58);
    this.musicVolumeSliderX = trackX;
    this.musicVolumeSliderWidth = trackWidth;
  }

  private refreshOptionsPanel(): void {
    this.optionsVolumeLabel?.setText(`Music volume: ${Math.round(this.musicVolume * 100)}%`);
    this.layoutOptionsPanel();
  }

  private hasTouchScreen(): boolean {
    return navigator.maxTouchPoints > 0;
  }

  private drawSkillLines(treeScale: number, treeX: number, treeY: number): void {
    this.skillLineGraphics.clear();

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

        const color = active ? 0xdfffc8 : available ? 0x87d6d0 : 0x34473f;
        const alpha = primaryBranch ? (active || available ? 0.95 : 0.72) : active || selectedConnection ? 0.55 : 0.28;
        const width = primaryBranch ? (active ? 5 : 4) : 2;
        const startX = treeX + prerequisite.tree.x * treeScale + (SKILL_NODE_SIZE / 2) * treeScale;
        const startY = treeY + prerequisite.tree.y * treeScale;
        const endX = treeX + upgrade.tree.x * treeScale - (SKILL_NODE_SIZE / 2) * treeScale;
        const endY = treeY + upgrade.tree.y * treeScale;
        const elbowX = startX + Math.max(24 * treeScale, (endX - startX) * 0.52);

        this.skillLineGraphics.lineStyle(width, color, alpha);
        this.skillLineGraphics.beginPath();
        this.skillLineGraphics.moveTo(startX, startY);
        this.skillLineGraphics.lineTo(elbowX, startY);
        this.skillLineGraphics.lineTo(elbowX, endY);
        this.skillLineGraphics.lineTo(endX, endY);
        this.skillLineGraphics.strokePath();
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

  private openSeedShop(): void {
    this.closeSkillTree();
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
    this.closeSeedShop();
    this.closeGoldStore();
    this.optionsOpen = true;
    this.optionsRoot.setVisible(true);
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
    this.closeSeedShop();
  }

  private resetBoardView(): void {
    this.boardZoom = 1;
    this.boardPanX = 0;
    this.boardPanY = 0;
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
        view.container.destroy();
        this.worldObjectViews.delete(id);
      }
    }

    for (const object of activeObjects) {
      const existing = this.worldObjectViews.get(object.id);
      if (existing) {
        existing.quantity = object.quantity;
        existing.label.setText(object.quantity > 1 ? `${object.label} x${object.quantity}` : object.label);
        continue;
      }

      const container = this.add.container(0, 0).setDepth(36);
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

      container.add([shadow, ...ambience, sprite, label]);
      this.worldObjectViews.set(object.id, { id: object.id, quantity: object.quantity, container, shadow, sprite, label, ambience });

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

    return [];
  }

  private layoutWorldObjects(): void {
    if (this.worldObjectViews.size === 0 || this.boardScaledWidth <= 0 || this.boardScaledHeight <= 0) {
      for (const view of this.worldObjectViews.values()) {
        view.container.setVisible(false);
      }
      return;
    }

    const activeObjects = this.getActiveWorldObjects();
    const rowScale = Phaser.Math.Clamp(this.boardScale * 0.88, 0.5, 1);
    const spacing = 62 * rowScale;
    const centerX = this.boardBaseCenterX + this.boardPanX;
    const centerY = this.boardBaseCenterY + this.boardPanY;
    const rowWidth = Math.max(0, (activeObjects.length - 1) * spacing);
    const unclampedY = centerY + this.boardScaledHeight / 2 + 44 * rowScale;
    const y = Phaser.Math.Clamp(unclampedY, this.boardTopY + 52 * rowScale, this.scale.height - 48 * rowScale);
    const startX = centerX - rowWidth / 2;

    activeObjects.forEach((object, index) => {
      const view = this.worldObjectViews.get(object.id);
      if (!view) {
        return;
      }

      const x = Phaser.Math.Clamp(startX + index * spacing, 38 * rowScale, this.scale.width - 38 * rowScale);
      view.container.setVisible(!this.skillTreeOpen && !this.seedShopOpen && !this.storeOpen && !this.optionsOpen);
      view.container.setPosition(x, y);
      view.container.setScale(rowScale);
      view.shadow.setScale(1 + Math.sin(Date.now() * 0.002 + index) * 0.03, 1);
      view.sprite.setDisplaySize(56, 56);
      view.label.setFontSize(rowScale < 0.68 ? 11 : 12);
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
    this.tileInfoPanel.setVisible(false);
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

  private positionTileInfo(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const panelWidth = 230;
    const panelHeight = 112;
    const x = Phaser.Math.Clamp(view.base.x + 28 * this.boardScale, 12, this.scale.width - panelWidth - 12);
    const y = Phaser.Math.Clamp(view.base.y - panelHeight - 20 * this.boardScale, 12, this.scale.height - panelHeight - 12);

    this.tileInfoPanel.setPosition(x, y);
  }

  private handleTileClicked(tile: FieldTile): void {
    if (this.skillTreeOpen || this.seedShopOpen || this.storeOpen || this.optionsOpen) {
      return;
    }

    if (this.hasTouchScreen()) {
      this.clearTileInfo();
    }

    const stats = getRuntimeStats(this.state);
    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    const touch = touchTile(tile, this.state, stats, Date.now());

    if (touch.gained === 0) {
      this.popAtTile(tile, "regrowing", "#fff2b2");
      this.playBlockedTileFeedback(tile);
      this.audio.play("blocked");
      return;
    }

    this.playTouchFeedback(tile, touchedTrait, touch.isCrit);
    this.refreshTile(tile);
    this.popAtTile(tile, this.getTouchPopText(touch, touchedTier.label), touch.isCrit ? "#ffef78" : touchedTier.id === "normal" ? "#f9ffe5" : "#dfffc8");
    if (touch.instantRegrown) {
      this.popAtTile(tile, "instant regrow", "#dfffc8");
    }
    this.drops.tryDropSeed(this.state, tile, touchedTrait, stats, this.getDropFeedback());
    this.drops.tryDropGold(this.state, tile, touchedTrait, touchedTier.id, touch, stats, this.getDropFeedback());
    this.shakeForGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    this.audio.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    saveGame(this.state);
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
    if (this.skillTreeOpen || this.seedShopOpen || this.storeOpen || this.optionsOpen) {
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
    if (this.skillTreeOpen || this.seedShopOpen || this.storeOpen || this.optionsOpen) {
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
    const tierShake = {
      normal: { duration: 70, intensity: 0.0013 },
      thick: { duration: 90, intensity: 0.0018 },
      clover: { duration: 80, intensity: 0.00145 },
      golden: { duration: 118, intensity: 0.00235 },
    } satisfies Record<GrassTierId, { duration: number; intensity: number }>;
    const traitShake = {
      normal: { duration: 0, intensity: 1 },
      dewy: { duration: 18, intensity: 0.86 },
      lush: { duration: 12, intensity: 1.18 },
    } satisfies Record<TileTrait, { duration: number; intensity: number }>;
    const base = tierShake[tier];
    const traitBoost = traitShake[trait];
    const critDuration = isCrit ? 1.55 : 1;
    const critIntensity = isCrit ? 2.65 : 1;
    const duration = Math.round((base.duration + traitBoost.duration) * critDuration);
    const intensity = Math.min(0.008, base.intensity * traitBoost.intensity * critIntensity);

    this.cameras.main.shake(duration, intensity);
  }

  private getTouchPopText(touch: TouchResult, label: string): string {
    const prefix = [label, touch.doubled ? "DOUBLE" : "", touch.isCrit ? `CRIT x${touch.critMultiplier.toFixed(1)}` : ""].filter(Boolean).join(" ");
    return `${prefix ? `${prefix} ` : ""}+${touch.gained}`;
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

    this.weatherBadge.setVisible(!this.skillTreeOpen && !this.seedShopOpen && !this.storeOpen && !this.optionsOpen);
    this.weatherBadgeTitle.setText(`Weather Jar: ${weather.name}`);
    this.weatherBadgeTitle.setColor(weather.color);
    this.weatherBadgeBody.setText(`${weather.description} (${timeText})`);
    this.weatherTint.setVisible(!this.skillTreeOpen && !this.seedShopOpen && !this.storeOpen && !this.optionsOpen);
    this.applyWeatherTint(weather.id);

    if (this.activeWeatherVisualId !== weather.id) {
      this.activeWeatherVisualId = weather.id;
      this.createWeatherParticleEffect(weather.id);
    }
  }

  private applyWeatherTint(weatherId: WeatherId): void {
    const tint = {
      calm: { color: 0xf7ffe8, alpha: 0.035 },
      dewy_morning: { color: 0xbff4ff, alpha: 0.12 },
      warm_sunlight: { color: 0xffef78, alpha: 0.11 },
      lucky_breeze: { color: 0xdfffc8, alpha: 0.08 },
      seed_wind: { color: 0xfff1a8, alpha: 0.1 },
      soft_rain: { color: 0xa8e8ff, alpha: 0.12 },
      pollinator_swarm: { color: 0xffe08a, alpha: 0.08 },
      golden_hour: { color: 0xffd565, alpha: 0.13 },
      restless_roots: { color: 0xb7eba5, alpha: 0.1 },
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
          lifespan: { min: 1800, max: 3200 },
          speedX: { min: -6, max: 18 },
          speedY: { min: 18, max: 42 },
          scale: { start: 1.1, end: 0.35 },
          alpha: { start: 0.72, end: 0 },
          frequency: 120,
          quantity: 1,
        },
      },
      warm_sunlight: {
        texture: "sun-fleck",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 132, max: Math.max(132, this.scale.height - 24) },
          lifespan: { min: 1200, max: 2400 },
          speedX: { min: -8, max: 8 },
          speedY: { min: -10, max: 4 },
          scale: { start: 1.4, end: 0 },
          alpha: { start: 0.62, end: 0 },
          frequency: 170,
          quantity: 1,
        },
      },
      lucky_breeze: {
        texture: "breeze-fleck",
        config: {
          x: -18,
          y: { min: 138, max: Math.max(138, this.scale.height - 20) },
          lifespan: { min: 1200, max: 2100 },
          speedX: { min: 95, max: 175 },
          speedY: { min: -18, max: 18 },
          rotate: { min: -45, max: 45 },
          scale: { start: 1.05, end: 0.2 },
          alpha: { start: 0.68, end: 0 },
          frequency: 95,
          quantity: 1,
        },
      },
      seed_wind: {
        texture: "seed-fleck",
        config: {
          x: -16,
          y: { min: 138, max: Math.max(138, this.scale.height - 20) },
          lifespan: { min: 1400, max: 2600 },
          speedX: { min: 80, max: 150 },
          speedY: { min: -34, max: 10 },
          gravityY: 22,
          rotate: { min: -180, max: 180 },
          scale: { start: 1.2, end: 0.18 },
          alpha: { start: 0.78, end: 0 },
          frequency: 85,
          quantity: 1,
        },
      },
      soft_rain: {
        texture: "dew-fleck",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: -12,
          lifespan: { min: 1500, max: 2800 },
          speedX: { min: -18, max: 8 },
          speedY: { min: 90, max: 145 },
          gravityY: 38,
          scale: { start: 0.9, end: 0.16 },
          alpha: { start: 0.62, end: 0 },
          frequency: 55,
          quantity: 1,
        },
      },
      pollinator_swarm: {
        texture: "seed-fleck",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 136, max: Math.max(136, this.scale.height - 28) },
          lifespan: { min: 900, max: 1700 },
          speedX: { min: -42, max: 42 },
          speedY: { min: -32, max: 28 },
          rotate: { min: -90, max: 90 },
          scale: { start: 0.95, end: 0.2 },
          alpha: { start: 0.66, end: 0 },
          frequency: 80,
          quantity: 1,
        },
      },
      golden_hour: {
        texture: "sun-fleck",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 132, max: Math.max(132, this.scale.height - 24) },
          lifespan: { min: 1300, max: 2600 },
          speedX: { min: -10, max: 14 },
          speedY: { min: -8, max: 6 },
          scale: { start: 1.7, end: 0 },
          alpha: { start: 0.76, end: 0 },
          frequency: 125,
          quantity: 1,
        },
      },
      restless_roots: {
        texture: "grass-fleck",
        config: {
          x: { min: 12, max: Math.max(12, this.scale.width - 12) },
          y: { min: 150, max: Math.max(150, this.scale.height - 20) },
          lifespan: { min: 900, max: 1600 },
          speedX: { min: -18, max: 18 },
          speedY: { min: -78, max: -26 },
          gravityY: 60,
          rotate: { min: -140, max: 140 },
          scale: { start: 1.1, end: 0.18 },
          alpha: { start: 0.72, end: 0 },
          frequency: 105,
          quantity: 1,
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
    const highlightColor = tier.id === "golden" ? 0xffef78 : tier.id === "clover" ? 0xb7eba5 : 0x9be86b;

    view.grass.setVisible(isGrown);
    view.grass.setTexture(grassTexture);
    view.grass.setScale(this.boardScale * this.getGrassScale(tile));
    view.grass.setAlpha(1);
    view.outline.setVisible(isGrown && rareTier);
    view.outline.setStrokeStyle(tier.id === "golden" ? 5 : 4, highlightColor, tier.id === "golden" ? 0.95 : 0.72);
    view.glint.setVisible(isGrown && rareTier);
    view.glint.setFillStyle(highlightColor, tier.id === "golden" ? 0.95 : 0.82);
    view.label.setText(isGrown ? this.getTileLabel(tile, tier.label) : "...");
    view.base.setTexture(isGrown ? "tile-dirt" : "tile-stubble");

    if (this.hoveredTileKey === tileKey(tile.x, tile.y)) {
      this.refreshTileInfo(tile);
    }
  }

  private getGrassScale(tile: FieldTile): number {
    const tierScale = tile.tier === "golden" ? 1.09 : tile.tier === "clover" ? 1.06 : tile.tier === "thick" ? 1.03 : 1;
    return (tile.trait === "lush" ? 1.06 : 1) * tierScale;
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

  private playCompanionAction(tile: FieldTile, action: "pollinate" | "scratch" | "forage" | "graze"): void {
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

  private refreshUi(): void {
    const nextMilestone = MILESTONES.find((milestone) => !this.state.reachedMilestones.includes(milestone.id));
    const nextTier = getNextGrassTier(this.state);
    const weather = this.state.seedShopPurchases.weather_jar ? getWeather(this.state.activeWeatherId) : undefined;
    const season = getSeasonForDate(new Date());
    const compact = this.scale.width < 620;
    const resourceSeparator = compact ? "\n" : " | ";

    this.titleText.setText("Grass Touching Simulator");
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
    this.skillResourceText.setText(`Grass Touches: ${Math.floor(this.state.grassTouches)}`);
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
        nextTier ? `Next grass tier: ${nextTier.name} at ${nextTier.unlockAtLifetimeTouches} lifetime touches` : "",
        weather ? `Weather: ${weather.name} - ${weather.description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    this.milestoneText.setPosition(26, this.resourceText.y + this.resourceText.height + 12);

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
      const fill = level > 0 ? 0x263f2d : unlocked ? 0x2f3e36 : 0x202a25;
      const stroke = selected ? 0xf7ffe8 : available ? 0xf5ec72 : level > 0 ? upgrade.tree.color : 0x51615a;

      view.container.setAlpha(unlocked || level > 0 ? 1 : 0.5);
      view.bg.setFillStyle(fill, 1);
      view.bg.setStrokeStyle(selected ? 6 : 4, stroke, 1);
      view.icon.setText(unlocked || level > 0 ? upgrade.tree.icon : "?");
      view.level.setText(level > 0 || unlocked ? `Lv ${level}/${upgrade.maxLevel}` : "locked");
      view.level.setColor(available ? "#f7ffe8" : level > 0 ? "#dfffc8" : "#c8d1cc");
    }

    this.refreshSkillDetail();
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
        `Cost: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nNeed: ${
          cost - Math.floor(this.state.grassTouches)
        } more`,
      );
      setTextButtonText(this.skillBuyButton, `Need ${cost - Math.floor(this.state.grassTouches)}`);
      setTextButtonEnabled(this.skillBuyButton, false);
    } else {
      this.skillDetailCost.setText(`Cost: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nReady to upgrade`);
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
