import Phaser from "phaser";
import { hasSavedGame, resetSave } from "../systems/SaveSystem";

const SOURCE_WIDTH = 1366;
const SOURCE_HEIGHT = 768;

interface TitleButton {
  id: "start" | "continue" | "options" | "quit" | "credits";
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  hit: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  label?: Phaser.GameObjects.Text;
}

export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private buttons: TitleButton[] = [];
  private noticeText!: Phaser.GameObjects.Text;
  private creditsRoot!: Phaser.GameObjects.Container;
  private creditsBackdrop!: Phaser.GameObjects.Rectangle;
  private creditsPanel!: Phaser.GameObjects.Rectangle;
  private creditsTitle!: Phaser.GameObjects.Text;
  private creditsRole!: Phaser.GameObjects.Text;
  private creditsName!: Phaser.GameObjects.Text;
  private creditsBackHit!: Phaser.GameObjects.Rectangle;
  private creditsBackText!: Phaser.GameObjects.Text;
  private optionsOpen = false;
  private creditsOpen = false;

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
    this.createMenuButton("credits", 683, 704, 260, 48, "CREDITS");

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

    this.createCreditsPanel();

    this.input.keyboard?.on("keydown-ENTER", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-SPACE", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-ESC", () => this.closeCredits());

    this.scale.on("resize", () => this.layoutTitle());
    this.layoutTitle();
  }

  private createMenuButton(
    id: TitleButton["id"],
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    labelText?: string,
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

    const label = labelText
      ? this.add
          .text(0, 0, labelText, {
            fontFamily: "Trebuchet MS, Arial",
            fontSize: "36px",
            color: "#ffe299",
            stroke: "#4b2514",
            strokeThickness: 8,
          })
          .setOrigin(0.5)
          .setDepth(12)
      : undefined;

    this.buttons.push({ id, sourceX, sourceY, sourceWidth, sourceHeight, hit, outline, label });
  }

  private createCreditsPanel(): void {
    this.creditsRoot = this.add.container(0, 0).setDepth(30).setVisible(false);
    this.creditsBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x102315, 0.78)
      .setOrigin(0, 0)
      .setInteractive();
    this.creditsPanel = this.add
      .rectangle(0, 0, 420, 290, 0xf4ffdc, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(5, 0x2d6f36);
    this.creditsTitle = this.add
      .text(0, 0, "Credits", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "38px",
        color: "#183d20",
      })
      .setOrigin(0.5);
    this.creditsRole = this.add
      .text(0, 0, "Playtester", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#416247",
      })
      .setOrigin(0.5);
    this.creditsName = this.add
      .text(0, 0, "Cosmodeus", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "30px",
        color: "#17491f",
        stroke: "#dfffc8",
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.creditsBackHit = this.add
      .rectangle(0, 0, 138, 44, 0xe9ffd0, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0x2d6f36)
      .setInteractive({ useHandCursor: true });
    this.creditsBackText = this.add
      .text(0, 0, "Back", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#183d20",
      })
      .setOrigin(0.5);

    this.creditsBackHit.on("pointerdown", () => this.closeCredits());
    this.creditsRoot.add([
      this.creditsBackdrop,
      this.creditsPanel,
      this.creditsTitle,
      this.creditsRole,
      this.creditsName,
      this.creditsBackHit,
      this.creditsBackText,
    ]);
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
      button.label?.setPosition(x, y).setFontSize(Math.max(22, 36 * scale));
    }

    this.layoutCreditsPanel();
  }

  private layoutCreditsPanel(): void {
    const panelWidth = Math.min(420, this.scale.width - 40);
    const panelHeight = 290;
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.creditsBackdrop?.setSize(this.scale.width, this.scale.height);
    this.creditsPanel?.setPosition(centerX, centerY).setSize(panelWidth, panelHeight);
    this.creditsTitle?.setPosition(centerX, centerY - 86);
    this.creditsRole?.setPosition(centerX, centerY - 18);
    this.creditsName?.setPosition(centerX, centerY + 24);
    this.creditsBackHit?.setPosition(centerX, centerY + 102);
    this.creditsBackText?.setPosition(centerX, centerY + 102);
  }

  private handleButton(id: TitleButton["id"]): void {
    if (this.creditsOpen && id !== "credits") {
      return;
    }

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
      case "credits":
        this.openCredits();
        break;
      case "quit":
        this.showNotice("Browser version: closing the tab is the quit button.");
        break;
    }
  }

  private startOrContinue(): void {
    if (this.creditsOpen) {
      this.closeCredits();
      return;
    }

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

  private openCredits(): void {
    this.creditsOpen = true;
    this.creditsRoot.setVisible(true);
    this.showNotice("");
  }

  private closeCredits(): void {
    this.creditsOpen = false;
    this.creditsRoot?.setVisible(false);
  }
}
