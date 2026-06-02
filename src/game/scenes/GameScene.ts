import Phaser from "phaser";
import { GRASS_TIERS, getGrassTier, getNextGrassTier } from "../data/grass-tiers";
import { MILESTONES } from "../data/milestones";
import { SEED_SHOP_ITEMS, getSeedDropChance } from "../data/seed-shop";
import { UPGRADES, canUnlockUpgrade, getUpgradeCost } from "../data/upgrades";
import { expandField, tileKey, touchTile, updateRegrowth } from "../systems/FieldSystem";
import { AudioSystem } from "../systems/AudioSystem";
import { loadGame, resetSave, saveGame } from "../systems/SaveSystem";
import { getRuntimeStats } from "../systems/UpgradeSystem";
import type { FieldTile, GameState, TileKey } from "../types/game-state";

const TILE_SIZE = 58;
const TILE_GAP = 8;
const BOARD_Y_OFFSET = 24;
const TREE_WIDTH = 720;
const TREE_HEIGHT = 390;
const SKILL_NODE_SIZE = 92;

interface TileView {
  base: Phaser.GameObjects.Image;
  grass: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
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

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private tileViews = new Map<TileKey, TileView>();
  private titleText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private milestoneText!: Phaser.GameObjects.Text;
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
  private skillDetailBody!: Phaser.GameObjects.Text;
  private skillDetailCost!: Phaser.GameObjects.Text;
  private skillBuyButton!: Phaser.GameObjects.Container;
  private resetButton!: Phaser.GameObjects.Container;
  private seedRoot!: Phaser.GameObjects.Container;
  private seedBackdrop!: Phaser.GameObjects.Rectangle;
  private seedTitleText!: Phaser.GameObjects.Text;
  private seedResourceText!: Phaser.GameObjects.Text;
  private seedStatusText!: Phaser.GameObjects.Text;
  private seedBackButton!: Phaser.GameObjects.Container;
  private seedItemViews = new Map<string, SeedShopItemView>();
  private resetArmed = false;
  private lastAutoSaveAt = 0;
  private sprinklerElapsed = 0;
  private audio = new AudioSystem();
  private skillTreeOpen = false;
  private seedShopOpen = false;
  private selectedSkillId = UPGRADES[0].id;
  private boardScale = 1;

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
    this.createTileTextures();
    this.createHeader();
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
      this.layoutTiles();
      this.layoutSkillTree();
      this.layoutSeedShop();
    });
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
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
  }

  private createSkillTree(): void {
    this.skillRoot?.destroy();
    this.skillNodeViews.clear();

    this.skillRoot = this.add.container(0, 0).setDepth(100).setVisible(false);
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
      .text(0, 0, "Hover a skill to inspect it. Upgrade from the info box.", {
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
      bg.on("pointerdown", () => this.previewSkill(upgrade.id));
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
    this.skillDetailBody = this.add.text(16, 46, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "16px",
      color: "#416247",
      wordWrap: { width: 298 },
    });
    this.skillDetailCost = this.add.text(16, 142, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "18px",
      color: "#6d4c19",
      wordWrap: { width: 298 },
    });
    this.skillBuyButton = this.createTextButton("Upgrade", () => this.upgradeSelectedSkill(), 138, 40, 101);
    this.skillBuyButton.setPosition(16, 216);
    this.skillDetailPanel.add([this.skillDetailBg, this.skillDetailTitle, this.skillDetailBody, this.skillDetailCost, this.skillBuyButton]);
    this.skillRoot.add(this.skillDetailPanel);

    this.resetButton = this.createTextButton("Reset", () => this.handleResetPressed(), 92, 34, 101);
    this.skillRoot.add(this.resetButton);

    this.layoutSkillTree();
  }

  private layoutSkillTree(): void {
    const shortLandscape = this.scale.width > this.scale.height && this.scale.height < 520;
    const narrowPortrait = this.scale.width < 500 && this.scale.height >= this.scale.width;
    const narrowDesktop = this.scale.width < 760 && !shortLandscape && !narrowPortrait;
    const treeScale = shortLandscape
      ? Math.max(0.32, Math.min(0.62, (this.scale.width - 310) / TREE_WIDTH, (this.scale.height - 130) / TREE_HEIGHT))
      : Math.min(1, (this.scale.width - 48) / TREE_WIDTH, (this.scale.height - 190) / TREE_HEIGHT);
    const treeWidth = TREE_WIDTH * treeScale;
    const treeX = shortLandscape ? 24 : (this.scale.width - treeWidth) / 2;
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
      this.hasTouchScreen() ? "Tap a skill to inspect it. Upgrade from the info box." : "Hover a skill to inspect it. Upgrade from the info box.",
    );
    this.skillStatusText.setPosition(
      shortLandscape ? this.scale.width / 2 + 20 : this.scale.width / 2,
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
      shortLandscape ? 112 : narrowPortrait ? this.scale.height - 310 : this.scale.height - 270,
    );

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
    let y = compact ? 146 : 154;

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
      view.bg.setSize(panelWidth, 92);
      view.container.setPosition(x, y);
      y += 106;
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
      for (const prerequisiteId of upgrade.prerequisiteIds ?? []) {
        const prerequisite = UPGRADES.find((candidate) => candidate.id === prerequisiteId);
        if (!prerequisite) {
          continue;
        }

        const prerequisiteLevel = this.state.upgrades[prerequisite.id]?.level ?? 0;
        const upgradeLevel = this.state.upgrades[upgrade.id]?.level ?? 0;
        const active = prerequisiteLevel > 0 && upgradeLevel > 0;
        const available = prerequisiteLevel > 0 && canUnlockUpgrade(this.state, upgrade);
        const color = active ? 0xdfffc8 : available ? 0x87d6d0 : 0x34473f;

        this.skillLineGraphics.lineStyle(active ? 5 : 4, color, active || available ? 0.95 : 0.75);
        this.skillLineGraphics.beginPath();
        this.skillLineGraphics.moveTo(treeX + prerequisite.tree.x * treeScale, treeY + prerequisite.tree.y * treeScale);
        this.skillLineGraphics.lineTo(treeX + upgrade.tree.x * treeScale, treeY + upgrade.tree.y * treeScale);
        this.skillLineGraphics.strokePath();
      }
    }
  }

  private previewSkill(upgradeId: string): void {
    this.selectedSkillId = upgradeId;
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
    this.tileViews.forEach((view) => {
      view.base.destroy();
      view.grass.destroy();
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

  private renderAllTiles(): void {
    for (const tile of Object.values(this.state.field)) {
      this.createTileView(tile);
    }
    this.layoutTiles();
  }

  private createTileView(tile: FieldTile): void {
    const base = this.add
      .image(0, 0, "tile-dirt")
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const grass = this.add
      .image(0, 0, "grass-normal")
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

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

    this.tileViews.set(tileKey(tile.x, tile.y), { base, grass, label });
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
    const topY = Math.max(142, this.milestoneText.y + this.milestoneText.height + 24);
    const availableWidth = Math.max(120, this.scale.width - 24);
    const availableHeight = Math.max(120, this.scale.height - topY - 24);
    this.boardScale = Math.min(1, availableWidth / boardWidth, availableHeight / boardHeight);
    const centerX = this.scale.width / 2;
    const centerY = topY + availableHeight / 2 + BOARD_Y_OFFSET * this.boardScale;
    const scaledStep = (TILE_SIZE + TILE_GAP) * this.boardScale;
    const startX = centerX - (boardWidth * this.boardScale) / 2 + (TILE_SIZE * this.boardScale) / 2;
    const startY = centerY - (boardHeight * this.boardScale) / 2 + (TILE_SIZE * this.boardScale) / 2;

    for (const tile of tiles) {
      const view = this.tileViews.get(tileKey(tile.x, tile.y));
      if (!view) {
        continue;
      }

      const x = startX + (tile.x - minX) * scaledStep;
      const y = startY + (tile.y - minY) * scaledStep;
      view.base.setPosition(x, y);
      view.grass.setPosition(x, y);
      view.label.setPosition(x, y);
      view.base.setScale(this.boardScale);
      view.grass.setScale(this.boardScale * this.getGrassScale(tile));
      view.label.setScale(this.boardScale);
    }
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
    this.popAtTile(
      tile,
      touch.isCrit
        ? `CRIT x${touch.critMultiplier.toFixed(1)} +${touch.gained}`
        : touchedTier.id === "normal"
          ? `+${touch.gained}`
          : `${touchedTier.label} +${touch.gained}`,
      touch.isCrit ? "#ffef78" : touchedTier.id === "normal" ? "#f9ffe5" : "#dfffc8",
    );
    this.tryDropSeed(tile, touchedTrait, stats);
    this.cameras.main.shake(touch.isCrit ? 140 : 70, touch.isCrit ? 0.004 : 0.0013);
    this.audio.play(touch.isCrit ? "crit" : "touch");
    saveGame(this.state);
  }

  private tryDropSeed(tile: FieldTile, touchedTrait: FieldTile["trait"], stats: ReturnType<typeof getRuntimeStats>): void {
    let chance = getSeedDropChance(this.state);
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
      touch.isCrit
        ? `sprinkler CRIT +${touch.gained}`
        : touchedTier.id === "normal"
          ? `sprinkler +${touch.gained}`
          : `${touchedTier.label} +${touch.gained}`,
      touch.isCrit ? "#ffef78" : "#d7fff2",
    );
    this.audio.play(touch.isCrit ? "crit" : "touch");
    saveGame(this.state);
  }

  private refreshTile(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const isGrown = tile.grassState === "grown";
    const tier = getGrassTier(tile.tier);
    const grassTexture = this.getGrassTextureKey(tile);

    view.grass.setVisible(isGrown);
    view.grass.setTexture(grassTexture);
    view.grass.setScale(this.boardScale * this.getGrassScale(tile));
    view.grass.setAlpha(1);
    view.label.setText(isGrown ? this.getTileLabel(tile, tier.label) : "...");
    view.base.setTexture(isGrown ? "tile-dirt" : "tile-stubble");
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
    const compact = this.scale.width < 620;
    const resourceSeparator = compact ? "\n" : " | ";

    this.titleText.setText("Grass Touching Simulator");
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
    this.seedResourceText.setText(
      `Seeds: ${Math.floor(this.state.seeds)} | Lifetime Seeds: ${Math.floor(this.state.lifetimeSeeds)} | Drop Chance: ${Math.round(
        getSeedDropChance(this.state) * 100,
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
            ? "Tap a skill to inspect it. Upgrade from the info box."
            : "Hover a skill to inspect it. Upgrade from the info box.",
        );
      }
    });
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
