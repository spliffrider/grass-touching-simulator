import Phaser from "phaser";
import { MILESTONES } from "../data/milestones";
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
  cost: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private tileViews = new Map<TileKey, TileView>();
  private titleText!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private milestoneText!: Phaser.GameObjects.Text;
  private skillButton!: Phaser.GameObjects.Container;
  private skillRoot!: Phaser.GameObjects.Container;
  private skillBackdrop!: Phaser.GameObjects.Rectangle;
  private skillTitleText!: Phaser.GameObjects.Text;
  private skillResourceText!: Phaser.GameObjects.Text;
  private skillStatusText!: Phaser.GameObjects.Text;
  private backButton!: Phaser.GameObjects.Container;
  private skillLineGraphics!: Phaser.GameObjects.Graphics;
  private skillNodeViews = new Map<string, SkillNodeView>();
  private skillDetailPanel!: Phaser.GameObjects.Container;
  private skillDetailTitle!: Phaser.GameObjects.Text;
  private skillDetailBody!: Phaser.GameObjects.Text;
  private skillDetailCost!: Phaser.GameObjects.Text;
  private resetButton!: Phaser.GameObjects.Container;
  private lastAutoSaveAt = 0;
  private audio = new AudioSystem();
  private skillTreeOpen = false;
  private selectedSkillId = UPGRADES[0].id;

  constructor() {
    super("GameScene");
  }

  create(data?: { newGame?: boolean }): void {
    this.state = data?.newGame ? resetSave() : loadGame();
    saveGame(this.state);

    this.cameras.main.setBackgroundColor("#7fc66c");
    this.createTileTextures();
    this.createHeader();
    this.createSkillTree();
    this.renderAllTiles();
    this.layoutHeader();
    this.layoutSkillTree();
    this.refreshUi();
    this.showMessage("Touch the grass. Let it regrow. Become reasonable.", 3600);

    this.scale.on("resize", () => {
      this.layoutHeader();
      this.layoutTiles();
      this.layoutSkillTree();
    });
  }

  update(_time: number, delta: number): void {
    const now = Date.now();
    const stats = getRuntimeStats(this.state);
    const regrown = updateRegrowth(this.state, stats, now);

    for (const tile of regrown) {
      this.refreshTile(tile);
      this.popAtTile(tile, tile.trait === "lush" ? "lush" : tile.trait === "dewy" ? "dew" : "grass", "#e7ffd1");
    }

    if (regrown.length > 0) {
      this.audio.play("regrow");
    }

    this.checkMilestones(stats);
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
      .text(0, 0, "Left click a skill to upgrade it.", {
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
        .rectangle(0, 0, 70, 70, 0x2a3730, 1)
        .setOrigin(0.5)
        .setStrokeStyle(4, upgrade.tree.color)
        .setInteractive({ useHandCursor: true });
      const icon = this.add
        .text(0, -16, upgrade.tree.icon, {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "15px",
          color: "#f7ffe8",
          align: "center",
        })
        .setOrigin(0.5);
      const level = this.add
        .text(0, 9, "", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "10px",
          color: "#dfffc8",
        })
        .setOrigin(0.5);
      const cost = this.add
        .text(0, 24, "", {
          fontFamily: "Trebuchet MS, Arial",
          fontSize: "10px",
          color: "#fff7c7",
        })
        .setOrigin(0.5);

      container.add([bg, icon, level, cost]);
      bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.leftButtonDown()) {
          this.upgradeSkill(upgrade.id);
        }
      });
      this.skillNodeViews.set(upgrade.id, { upgradeId: upgrade.id, container, bg, icon, level, cost });
      this.skillRoot.add(container);
    }

    this.skillDetailPanel = this.add.container(0, 0);
    const detailBg = this.add
      .rectangle(0, 0, 300, 210, 0xf4ffdc, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(3, 0x2d6f36);
    this.skillDetailTitle = this.add.text(16, 14, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "20px",
      color: "#183d20",
    });
    this.skillDetailBody = this.add.text(16, 46, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "14px",
      color: "#416247",
      wordWrap: { width: 268 },
    });
    this.skillDetailCost = this.add.text(16, 130, "", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "15px",
      color: "#6d4c19",
      wordWrap: { width: 268 },
    });
    this.skillDetailPanel.add([detailBg, this.skillDetailTitle, this.skillDetailBody, this.skillDetailCost]);
    this.skillRoot.add(this.skillDetailPanel);

    this.resetButton = this.createTextButton("Reset Save", () => this.resetPrototypeSave(), 150, 44, 101);
    this.skillRoot.add(this.resetButton);

    this.layoutSkillTree();
  }

  private layoutSkillTree(): void {
    const treeScale = Math.min(1, (this.scale.width - 48) / TREE_WIDTH, (this.scale.height - 190) / TREE_HEIGHT);
    const treeWidth = TREE_WIDTH * treeScale;
    const treeHeight = TREE_HEIGHT * treeScale;
    const treeX = (this.scale.width - treeWidth) / 2;
    const treeY = 150;

    this.skillBackdrop.setSize(this.scale.width, this.scale.height);
    this.skillTitleText.setPosition(24, 24);
    this.skillResourceText.setPosition(26, 78);
    this.skillStatusText.setPosition(this.scale.width / 2, 104);
    this.backButton.setPosition(this.scale.width - 142, 24);
    this.resetButton.setPosition(24, this.scale.height - 64);
    this.skillDetailPanel.setPosition(Math.max(24, this.scale.width - 324), this.scale.height - 246);

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
        fontSize: "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);

    bg.on("pointerdown", onClick);
    button.add([bg, label]);
    return button;
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

  private upgradeSkill(upgradeId: string): void {
    this.selectedSkillId = upgradeId;
    const upgraded = this.buyUpgrade(upgradeId);
    this.bumpSkillNode(upgradeId, upgraded);
    this.refreshUi();
  }

  private openSkillTree(): void {
    this.skillTreeOpen = true;
    this.skillRoot.setVisible(true);
    this.audio.play("upgrade");
    this.refreshUi();
  }

  private closeSkillTree(): void {
    this.skillTreeOpen = false;
    this.skillRoot.setVisible(false);
    this.refreshUi();
  }

  private resetPrototypeSave(): void {
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
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2 + BOARD_Y_OFFSET;
    const startX = centerX - boardWidth / 2 + TILE_SIZE / 2;
    const startY = centerY - boardHeight / 2 + TILE_SIZE / 2;

    for (const tile of tiles) {
      const view = this.tileViews.get(tileKey(tile.x, tile.y));
      if (!view) {
        continue;
      }

      const x = startX + (tile.x - minX) * (TILE_SIZE + TILE_GAP);
      const y = startY + (tile.y - minY) * (TILE_SIZE + TILE_GAP);
      view.base.setPosition(x, y);
      view.grass.setPosition(x, y);
      view.label.setPosition(x, y);
    }
  }

  private handleTileClicked(tile: FieldTile): void {
    if (this.skillTreeOpen) {
      return;
    }

    const stats = getRuntimeStats(this.state);
    const gained = touchTile(tile, this.state, stats, Date.now());

    if (gained === 0) {
      this.popAtTile(tile, "regrowing", "#fff2b2");
      this.audio.play("blocked");
      return;
    }

    this.refreshTile(tile);
    this.popAtTile(tile, `+${gained}`, "#f9ffe5");
    this.cameras.main.shake(55, 0.0018);
    this.audio.play("touch");
    saveGame(this.state);
  }

  private refreshTile(tile: FieldTile): void {
    const view = this.tileViews.get(tileKey(tile.x, tile.y));
    if (!view) {
      return;
    }

    const isGrown = tile.grassState === "grown";
    const grassTexture = tile.trait === "lush" ? "grass-lush" : tile.trait === "dewy" ? "grass-dewy" : "grass-normal";

    view.grass.setVisible(isGrown);
    view.grass.setTexture(grassTexture);
    view.grass.setScale(tile.trait === "lush" ? 1.06 : 1);
    view.label.setText(isGrown ? (tile.trait === "normal" ? "" : tile.trait) : "...");
    view.base.setTexture(isGrown ? "tile-dirt" : "tile-stubble");
  }

  private createTileTextures(): void {
    if (this.textures.exists("grass-normal")) {
      return;
    }

    this.createDirtTexture("tile-dirt", 0x8a6139, 0x6b4529);
    this.createDirtTexture("tile-stubble", 0x6f4c2f, 0x4c301f, true);
    this.createGrassTexture("grass-normal", [0x2f8436, 0x3fa244, 0x58bd4f, 0x75d35d], false, false);
    this.createGrassTexture("grass-dewy", [0x338e4b, 0x45ad62, 0x75d894, 0xa9f2bc], true, false);
    this.createGrassTexture("grass-lush", [0x1f6f32, 0x2d9340, 0x4fc45b, 0x7be06a], false, true);
  }

  private createDirtTexture(key: string, baseColor: number, shadowColor: number, stubble = false): void {
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

  private refreshUi(): void {
    const nextMilestone = MILESTONES.find((milestone) => !this.state.reachedMilestones.includes(milestone.id));

    this.titleText.setText("Grass Touching Simulator");
    this.resourceText.setText(
      `Grass Touches: ${Math.floor(this.state.grassTouches)} | Lifetime: ${Math.floor(this.state.lifetimeGrassTouches)} | Patches: ${Object.keys(this.state.field).length}`,
    );
    this.skillResourceText.setText(`Grass Touches: ${Math.floor(this.state.grassTouches)}`);
    this.milestoneText.setText(
      nextMilestone
        ? `Next surface spread: ${nextMilestone.name} at ${nextMilestone.requiredLifetimeTouches} lifetime touches`
        : "All prototype surface spreads discovered.",
    );

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
      view.cost.setText(maxed ? "maxed" : unlocked ? `Cost ${cost}` : "");
      view.cost.setColor(available ? "#f7ffe8" : "#fff7c7");
    }

    this.refreshSkillDetail();
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
    } else if (missingPrerequisites.length > 0) {
      this.skillDetailCost.setText(`Requires: ${missingPrerequisites.join(", ")}`);
    } else if (!upgrade.isUnlocked(this.state)) {
      this.skillDetailCost.setText("Keep touching grass to reveal this.");
    } else if (this.state.grassTouches < cost) {
      this.skillDetailCost.setText(
        `Cost: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nNeed: ${
          cost - Math.floor(this.state.grassTouches)
        } more`,
      );
    } else {
      this.skillDetailCost.setText(`Cost: ${cost} Grass Touches\nYou have: ${Math.floor(this.state.grassTouches)}\nReady to upgrade`);
    }
  }

  private setSkillStatus(message: string): void {
    this.skillStatusText.setText(message);
    this.time.delayedCall(1800, () => {
      if (this.skillTreeOpen) {
        this.skillStatusText.setText("Left click a skill to upgrade it.");
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
        fontSize: "16px",
        color,
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(40);

    this.tweens.add({
      targets: pop,
      y: pop.y - 34,
      alpha: 0,
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
