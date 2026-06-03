import Phaser from "phaser";
import { GRASS_TIERS, getGrassTier, getNextGrassTier } from "../data/grass-tiers";
import { MILESTONES } from "../data/milestones";
import { SEED_SHOP_ITEMS, getSeedDropChance } from "../data/seed-shop";
import { UPGRADES, canUnlockUpgrade, getUpgradeCost } from "../data/upgrades";
import { getWeather, pickWeather } from "../data/weather";
import { expandField, tileKey, touchTile, updateRegrowth } from "../systems/FieldSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { loadGame, resetSave, saveGame } from "../systems/SaveSystem";
import { getRuntimeStats } from "../systems/UpgradeSystem";
import type { FieldTile, GameState, GrassTierId, TileKey, TileTrait, TouchResult, WeatherId } from "../types/game-state";

const TILE_SIZE = 58;
const TILE_GAP = 8;
const BOARD_Y_OFFSET = 24;
const MIN_BOARD_ZOOM = 0.45;
const MAX_BOARD_ZOOM = 3.2;
const TREE_WIDTH = 880;
const TREE_HEIGHT = 560;
const SKILL_NODE_SIZE = 78;

const SKILL_BRANCH_LABELS = [
  { text: "Touch", x: 230, y: 50, color: "#dfffc8" },
  { text: "Growth", x: 430, y: 190, color: "#bff4ff" },
  { text: "Nature", x: 660, y: 50, color: "#d7fff2" },
  { text: "Crits", x: 420, y: 525, color: "#ffef78" },
  { text: "Meadow", x: 700, y: 335, color: "#dfffc8" },
];

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
  status: Phaser.GameObjects.Text;
}

interface SkillBranchLabelView {
  text: Phaser.GameObjects.Text;
  treeX: number;
  treeY: number;
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private tileViews = new Map<TileKey, TileView>();
  private titleText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private milestoneText!: Phaser.GameObjects.Text;
  private weatherTint!: Phaser.GameObjects.Rectangle;
  private weatherBadge!: Phaser.GameObjects.Container;
  private weatherBadgeBg!: Phaser.GameObjects.Rectangle;
  private weatherBadgeTitle!: Phaser.GameObjects.Text;
  private weatherBadgeBody!: Phaser.GameObjects.Text;
  private weatherParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
  private activeWeatherVisualId?: WeatherId | "none";
  private skillButton!: Phaser.GameObjects.Container;
  private seedButton!: Phaser.GameObjects.Container;
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
  private seedShopScroll = 0;
  private resetArmed = false;
  private lastAutoSaveAt = 0;
  private sprinklerElapsed = 0;
  private audio = new AudioSystem();
  private skillTreeOpen = false;
  private seedShopOpen = false;
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
  }

  create(data?: { newGame?: boolean }): void {
    this.state = data?.newGame ? resetSave() : loadGame();
    saveGame(this.state);

    this.cameras.main.setBackgroundColor("#7fc66c");
    this.updateWeather(Date.now(), false);
    this.createTileTextures();
    this.createHeader();
    this.createWeatherVisuals();
    this.createTileInfoPanel();
    this.createSkillTree();
    this.createSeedShop();
    this.renderAllTiles();
    this.layoutHeader();
    this.layoutSkillTree();
    this.layoutSeedShop();
    this.refreshUi();
    this.showMessage("Touch the grass. Let it regrow. Become reasonable.", 3600);

    this.scale.on("resize", () => {
      this.layoutHeader();
      this.layoutWeatherVisuals();
      this.layoutTiles();
      this.layoutSkillTree();
      this.layoutSeedShop();
    });

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _objects: unknown[], _deltaX: number, deltaY: number) => {
      if (this.seedShopOpen) {
        this.seedShopScroll = Math.max(0, this.seedShopScroll + deltaY * 0.75);
        this.layoutSeedShop();
        return;
      }

      this.zoomBoard(deltaY, pointer.x, pointer.y);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
      if (this.skillTreeOpen || this.seedShopOpen || gameObjects.length > 0) {
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
    });

    this.input.on("pointerupoutside", () => {
      this.isPanningBoard = false;
    });
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

    this.skillButton = this.createTextButton("Skills", () => this.openSkillTree(), 118, 44, 20);
    this.seedButton = this.createTextButton("Seeds", () => this.openSeedShop(), 118, 44, 20);
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

  private layoutHeader(): void {
    const compact = this.scale.width < 760;
    const headerWidth = Math.max(220, Math.min(620, this.scale.width - 180));

    this.titleText.setFontSize(compact ? 22 : 30);
    this.titleText.setWordWrapWidth(headerWidth);
    this.resourceText.setFontSize(compact ? 15 : 18);
    this.resourceText.setWordWrapWidth(headerWidth);
    this.milestoneText.setFontSize(compact ? 13 : 16);
    this.milestoneText.setWordWrapWidth(headerWidth);

    this.titleText.setPosition(24, compact ? 18 : 18);
    this.resourceText.setPosition(26, this.titleText.y + this.titleText.height + 10);
    this.milestoneText.setPosition(26, this.resourceText.y + this.resourceText.height + 12);
    this.skillButton.setPosition(this.scale.width - 142, 24);
    this.seedButton.setPosition(this.scale.width - 142, 76);
    this.layoutWeatherVisuals();
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
    this.weatherBadge.setPosition(compact ? 26 : this.scale.width - 320, compact ? this.seedButton.y + 58 : 128);

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

    this.backButton = this.createTextButton("Back", () => this.closeSkillTree(), 118, 44, 101);
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
    this.skillBuyButton = this.createTextButton("Upgrade", () => this.upgradeSelectedSkill(), 138, 40, 101);
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

    this.resetButton = this.createTextButton("Reset", () => this.handleResetPressed(), 92, 34, 101);
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
    this.seedBackButton = this.createTextButton("Back", () => this.closeSeedShop(), 118, 44, 106);

    this.seedRoot.add([this.seedBackdrop, this.seedTitleText, this.seedResourceText, this.seedStatusText, this.seedBackButton]);

    for (const item of SEED_SHOP_ITEMS) {
      const container = this.add.container(0, 0);
      const bg = this.add
        .rectangle(0, 0, 420, 92, 0xf4ffdc, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x2d6f36)
        .setInteractive({ useHandCursor: true });
      const name = this.add.text(14, 10, item.name, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#183d20",
      });
      const description = this.add.text(14, 38, item.description, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#416247",
        wordWrap: { width: 392 },
      });
      const status = this.add.text(14, 68, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "15px",
        color: "#6d4c19",
      });

      bg.on("pointerdown", () => this.buySeedShopItem(item.id));
      container.add([bg, name, description, status]);
      this.seedItemViews.set(item.id, { itemId: item.id, container, bg, status });
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
      view.bg.setSize(panelWidth, compact ? 82 : 92);
      view.container.setPosition(x, y);
      view.container.setVisible(y > 118 - itemGap && y < this.scale.height + itemGap);
      y += itemGap;
    }
  }

  private createTextButton(
    text: string,
    onClick: () => void,
    width: number,
    height: number,
    depth: number,
  ): Phaser.GameObjects.Container {
    const button = this.add.container(0, 0).setDepth(depth);
    const bg = this.add
      .rectangle(0, 0, width, height, 0xf4ffdc, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x2d6f36)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(width / 2, height / 2, text, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: height < 40 ? "14px" : "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);

    bg.on("pointerdown", onClick);
    button.add([bg, label]);
    button.setData("bg", bg);
    button.setData("label", label);
    return button;
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
  }

  private handleResetPressed(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.setButtonText(this.resetButton, "Confirm?");
      this.setSkillStatus("Tap Confirm? to reset your save.");
      this.audio.play("blocked");
      this.time.delayedCall(2600, () => this.disarmReset());
      return;
    }

    this.resetPrototypeSave();
  }

  private disarmReset(): void {
    this.resetArmed = false;
    this.setButtonText(this.resetButton, "Reset");
  }

  private setButtonText(button: Phaser.GameObjects.Container, text: string): void {
    const label = button.getData("label") as Phaser.GameObjects.Text | undefined;
    label?.setText(text);
  }

  private setButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
    const bg = button.getData("bg") as Phaser.GameObjects.Rectangle | undefined;
    const label = button.getData("label") as Phaser.GameObjects.Text | undefined;

    bg?.setFillStyle(enabled ? 0xf4ffdc : 0xb9c8ab, enabled ? 0.96 : 0.74);
    bg?.setStrokeStyle(3, enabled ? 0x2d6f36 : 0x63715d);
    label?.setColor(enabled ? "#183d20" : "#53604f");
  }

  private resetPrototypeSave(): void {
    this.disarmReset();
    this.state = resetSave();
    this.resetBoardView();
    this.tileViews.forEach((view) => {
      view.base.destroy();
      view.grass.destroy();
      view.outline.destroy();
      view.glint.destroy();
      view.label.destroy();
    });
    this.tileViews.clear();
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
    for (const tile of Object.values(this.state.field)) {
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
    const tiles = Object.values(this.state.field);
    if (tiles.length === 0) {
      return;
    }

    const minX = Math.min(...tiles.map((tile) => tile.x));
    const maxX = Math.max(...tiles.map((tile) => tile.x));
    const minY = Math.min(...tiles.map((tile) => tile.y));
    const maxY = Math.max(...tiles.map((tile) => tile.y));
    const boardWidth = (maxX - minX + 1) * (TILE_SIZE + TILE_GAP);
    const boardHeight = (maxY - minY + 1) * (TILE_SIZE + TILE_GAP);
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

      const x = startX + (tile.x - minX) * scaledStep;
      const y = startY + (tile.y - minY) * scaledStep;
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

    if (this.hoveredTileKey) {
      const hoveredTile = this.state.field[this.hoveredTileKey];
      if (hoveredTile) {
        this.positionTileInfo(hoveredTile);
      }
    }
  }

  private clampBoardPan(): void {
    const maxPanX = Math.max(72, (this.boardScaledWidth - this.boardAvailableWidth) / 2 + 72);
    const maxPanY = Math.max(72, (this.boardScaledHeight - this.boardAvailableHeight) / 2 + 72);
    const headerSafety = Math.max(0, this.boardTopY - this.boardBaseCenterY + 42);
    this.boardPanX = Phaser.Math.Clamp(this.boardPanX, -maxPanX, maxPanX);
    this.boardPanY = Phaser.Math.Clamp(this.boardPanY, headerSafety - maxPanY, maxPanY);
  }

  private showTileInfo(tile: FieldTile): void {
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
    if (this.skillTreeOpen || this.seedShopOpen) {
      return;
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
    this.tryDropSeed(tile, touchedTrait, stats);
    this.shakeForGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    this.audio.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    saveGame(this.state);
  }

  private tryDropSeed(tile: FieldTile, touchedTrait: FieldTile["trait"], stats: ReturnType<typeof getRuntimeStats>): void {
    let chance = getSeedDropChance(this.state, stats.seedDropBonus);
    chance += touchedTrait === "lush" ? 0.08 : touchedTrait === "dewy" ? 0.04 : 0;

    if (Math.random() >= chance) {
      return;
    }

    this.state.seeds += 1;
    this.state.lifetimeSeeds += 1;
    this.popAtTile(tile, "+1 seed", "#fff1a8");
    this.emitSeedBurst(tile);
    this.audio.play("seed");

    if (this.state.seedShopPurchases.wild_spread && Math.random() < 0.35) {
      const addedTiles = expandField(this.state, 1, stats);

      for (const addedTile of addedTiles) {
        this.createTileView(addedTile);
      }

      if (addedTiles.length > 0) {
        this.layoutTiles();
        for (const addedTile of addedTiles) {
          this.popAtTile(addedTile, "sprout", "#dfffc8");
        }
        this.audio.play("regrow");
      }
    }
  }

  private emitSeedBurst(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    this.emitBurst("seed-fleck", view.base.x, view.base.y - 8, 18, 0.82, 0.32);
  }

  private updateSprinkler(delta: number, stats: ReturnType<typeof getRuntimeStats>): void {
    if (!this.state.seedShopPurchases.sprinkler || this.skillTreeOpen || this.seedShopOpen) {
      return;
    }

    this.sprinklerElapsed += delta;
    if (this.sprinklerElapsed < 4800) {
      return;
    }

    this.sprinklerElapsed = 0;
    const grownTiles = Object.values(this.state.field).filter((tile) => tile.grassState === "grown");
    const tile = Phaser.Utils.Array.GetRandom(grownTiles);
    if (!tile) {
      return;
    }

    const touchedTrait = tile.trait;
    const touchedTier = getGrassTier(tile.tier);
    const touch = touchTile(tile, this.state, stats, Date.now());
    if (touch.gained === 0) {
      return;
    }

    this.playTouchFeedback(tile, touchedTrait, touch.isCrit);
    this.refreshTile(tile);
    this.popAtTile(
      tile,
      this.getTouchPopText(touch, touchedTier.id === "normal" ? "sprinkler" : touchedTier.label),
      touch.isCrit ? "#ffef78" : "#d7fff2",
    );
    this.audio.playGrassTouch(touchedTier.id, touchedTrait, touch.isCrit);
    saveGame(this.state);
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
    this.state.weatherEndsAt = now + 120000;

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

    this.weatherBadge.setVisible(!this.skillTreeOpen && !this.seedShopOpen);
    this.weatherBadgeTitle.setText(`Weather Jar: ${weather.name}`);
    this.weatherBadgeTitle.setColor(weather.color);
    this.weatherBadgeBody.setText(`${weather.description} (${timeText})`);
    this.weatherTint.setVisible(!this.skillTreeOpen && !this.seedShopOpen);
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
    const compact = this.scale.width < 620;
    const resourceSeparator = compact ? "\n" : " | ";

    this.titleText.setText("Grass Touching Simulator");
    this.refreshWeatherVisuals();
    this.resourceText.setText(
      [
        `Grass Touches: ${Math.floor(this.state.grassTouches)}`,
        `Seeds: ${Math.floor(this.state.seeds)}`,
        `Lifetime: ${Math.floor(this.state.lifetimeGrassTouches)}`,
        `Patches: ${Object.keys(this.state.field).length}`,
      ].join(resourceSeparator),
    );
    this.skillResourceText.setText(`Grass Touches: ${Math.floor(this.state.grassTouches)}`);
    this.refreshSeedShop();
    this.milestoneText.setText(
      [
        nextMilestone
          ? `Next surface spread: ${nextMilestone.name} at ${nextMilestone.requiredLifetimeTouches} lifetime touches`
          : "All prototype surface spreads discovered.",
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
      this.setButtonText(this.skillBuyButton, "Maxed");
      this.setButtonEnabled(this.skillBuyButton, false);
    } else if (missingPrerequisites.length > 0) {
      this.skillDetailCost.setText(`Requires: ${missingPrerequisites.join(", ")}`);
      this.setButtonText(this.skillBuyButton, "Locked");
      this.setButtonEnabled(this.skillBuyButton, false);
    } else if (!upgrade.isUnlocked(this.state)) {
      this.skillDetailCost.setText("Keep touching grass to reveal this.");
      this.setButtonText(this.skillBuyButton, "Locked");
      this.setButtonEnabled(this.skillBuyButton, false);
    } else if (this.state.grassTouches < cost) {
      this.skillDetailCost.setText(
        `Cost: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nNeed: ${
          cost - Math.floor(this.state.grassTouches)
        } more`,
      );
      this.setButtonText(this.skillBuyButton, `Need ${cost - Math.floor(this.state.grassTouches)}`);
      this.setButtonEnabled(this.skillBuyButton, false);
    } else {
      this.skillDetailCost.setText(`Cost: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nReady to upgrade`);
      this.setButtonText(this.skillBuyButton, "Upgrade");
      this.setButtonEnabled(this.skillBuyButton, true);
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
