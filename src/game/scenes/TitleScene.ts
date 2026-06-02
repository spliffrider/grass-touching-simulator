import Phaser from "phaser";
import { hasSavedGame, resetSave } from "../systems/SaveSystem";

const SOURCE_WIDTH = 1366;
const SOURCE_HEIGHT = 768;

interface TitleButton {
  id: "start" | "continue" | "options" | "quit";
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  hit: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
}

export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private buttons: TitleButton[] = [];
  private noticeText!: Phaser.GameObjects.Text;
  private optionsOpen = false;

  constructor() {
    super("TitleScene");
  }

  preload(): void {
    this.load.image("title-screen", "/assets/title-screen.png");
  }

  create(): void {
    this.background = this.add.image(0, 0, "title-screen").setOrigin(0.5);
    this.createMenuButton("start", 683, 469, 360, 54);
    this.createMenuButton("continue", 683, 529, 320, 52);
    this.createMenuButton("options", 683, 589, 290, 52);
    this.createMenuButton("quit", 683, 650, 230, 52);

    this.noticeText = this.add
      .text(this.scale.width / 2, this.scale.height - 34, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.input.keyboard?.on("keydown-ENTER", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-SPACE", () => this.startOrContinue());

    this.scale.on("resize", () => this.layoutTitle());
    this.layoutTitle();
  }

  private createMenuButton(
    id: TitleButton["id"],
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
  ): void {
    const hit = this.add
      .rectangle(0, 0, sourceWidth, sourceHeight, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setDepth(9)
      .setInteractive({ useHandCursor: true });
    const outline = this.add
      .rectangle(0, 0, sourceWidth, sourceHeight, 0xffffff, 0)
      .setOrigin(0.5)
      .setDepth(8)
      .setStrokeStyle(4, 0xf7ffe8, 0.9)
      .setVisible(false);

    hit.on("pointerover", () => outline.setVisible(true));
    hit.on("pointerout", () => outline.setVisible(false));
    hit.on("pointerdown", () => this.handleButton(id));

    this.buttons.push({ id, sourceX, sourceY, sourceWidth, sourceHeight, hit, outline });
  }

  private layoutTitle(): void {
    const shortLandscape = this.scale.width > this.scale.height && this.scale.height < 520;
    const scale = shortLandscape
      ? Math.min(this.scale.width / SOURCE_WIDTH, this.scale.height / SOURCE_HEIGHT)
      : Math.max(this.scale.width / SOURCE_WIDTH, this.scale.height / SOURCE_HEIGHT);
    const displayWidth = SOURCE_WIDTH * scale;
    const displayHeight = SOURCE_HEIGHT * scale;
    const offsetX = (this.scale.width - displayWidth) / 2;
    const offsetY = (this.scale.height - displayHeight) / 2;

    this.background.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.background.setDisplaySize(displayWidth, displayHeight);
    this.noticeText?.setPosition(this.scale.width / 2, this.scale.height - 34);

    for (const button of this.buttons) {
      const x = offsetX + button.sourceX * scale;
      const y = offsetY + button.sourceY * scale;
      const width = button.sourceWidth * scale;
      const height = button.sourceHeight * scale;

      button.hit.setPosition(x, y).setSize(width, height);
      button.outline.setPosition(x, y).setSize(width, height);
    }
  }

  private handleButton(id: TitleButton["id"]): void {
    switch (id) {
      case "start":
        resetSave();
        this.scene.start("GameScene", { newGame: true });
        break;
      case "continue":
        if (hasSavedGame()) {
          this.scene.start("GameScene");
        } else {
          this.showNotice("No save yet. Start Game begins your first patch.");
        }
        break;
      case "options":
        this.optionsOpen = !this.optionsOpen;
        this.showNotice(this.optionsOpen ? "Options: audio starts after your first click." : "");
        break;
      case "quit":
        this.showNotice("Browser version: closing the tab is the quit button.");
        break;
    }
  }

  private startOrContinue(): void {
    if (hasSavedGame()) {
      this.scene.start("GameScene");
      return;
    }

    resetSave();
    this.scene.start("GameScene", { newGame: true });
  }

  private showNotice(message: string): void {
    this.noticeText.setText(message);
  }
}
