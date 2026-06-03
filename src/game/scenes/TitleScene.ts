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
  label: Phaser.GameObjects.Text;
}

export class TitleScene extends Phaser.Scene {
  private backgroundGraphics!: Phaser.GameObjects.Graphics;
  private logoTop!: Phaser.GameObjects.Text;
  private logoBottom!: Phaser.GameObjects.Text;
  private taglineTop!: Phaser.GameObjects.Text;
  private taglineBottom!: Phaser.GameObjects.Text;
  private selectorLeft!: Phaser.GameObjects.Container;
  private selectorRight!: Phaser.GameObjects.Container;
  private activeButtonId: TitleButton["id"] = "start";
  private buttons: TitleButton[] = [];
  private noticeText!: Phaser.GameObjects.Text;
  private creditsRoot!: Phaser.GameObjects.Container;
  private creditsBackdrop!: Phaser.GameObjects.Rectangle;
  private creditsPanel!: Phaser.GameObjects.Rectangle;
  private creditsTitle!: Phaser.GameObjects.Text;
  private creditsRole!: Phaser.GameObjects.Text;
  private creditsNames!: Phaser.GameObjects.Text;
  private creditsBackHit!: Phaser.GameObjects.Rectangle;
  private creditsBackText!: Phaser.GameObjects.Text;
  private optionsOpen = false;
  private creditsOpen = false;

  constructor() {
    super("TitleScene");
  }

  create(): void {
    this.backgroundGraphics = this.add.graphics().setDepth(0);
    this.createTitleText();
    this.createMenuButton("start", 683, 420, 390, 56, "START GAME");
    this.createMenuButton("continue", 683, 488, 350, 54, "CONTINUE");
    this.createMenuButton("options", 683, 556, 300, 54, "OPTIONS");
    this.createMenuButton("quit", 683, 624, 230, 54, "QUIT");
    this.createMenuButton("credits", 683, 694, 260, 50, "CREDITS");
    this.selectorLeft = this.createLeafSelector();
    this.selectorRight = this.createFlowerSelector();

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

  private createTitleText(): void {
    this.logoTop = this.add
      .text(0, 0, "GRASS TOUCHING", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "76px",
        fontStyle: "bold",
        color: "#77d65b",
        stroke: "#102315",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.logoBottom = this.add
      .text(0, 0, "SIMULATOR", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "68px",
        fontStyle: "bold",
        color: "#ffd565",
        stroke: "#4b2514",
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.taglineTop = this.add
      .text(0, 0, "A SOOTHING JOURNEY INTO NATURE", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "26px",
        fontStyle: "bold",
        color: "#f7ffe8",
        stroke: "#102315",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(4);
    this.taglineBottom = this.add
      .text(0, 0, "FEEL THE GRASS! RELAX. BREATHE.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "28px",
        fontStyle: "bold",
        color: "#f7ffe8",
        stroke: "#102315",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(4);
  }

  private createMenuButton(
    id: TitleButton["id"],
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    labelText: string,
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
    const label = this.add
      .text(0, 0, labelText, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "46px",
        fontStyle: "bold",
        color: "#ffe299",
        stroke: "#4b2514",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(7);

    hit.on("pointerover", () => {
      outline.setVisible(true);
      this.setActiveMenuButton(id);
    });
    hit.on("pointerout", () => outline.setVisible(false));
    hit.on("pointerdown", () => this.handleButton(id));

    this.buttons.push({ id, sourceX, sourceY, sourceWidth, sourceHeight, hit, outline, label });
  }

  private createLeafSelector(): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0).setDepth(8);
    const graphics = this.add.graphics();
    graphics.fillStyle(0x102315, 1);
    graphics.fillEllipse(0, 0, 56, 34);
    graphics.fillStyle(0x64c957, 1);
    graphics.fillEllipse(-12, -4, 30, 20);
    graphics.fillEllipse(12, -6, 30, 21);
    graphics.fillEllipse(-1, 12, 28, 18);
    graphics.fillStyle(0xb8f07a, 0.9);
    graphics.fillEllipse(-14, -8, 9, 5);
    graphics.fillEllipse(12, -11, 9, 5);
    graphics.lineStyle(5, 0x20491f, 1);
    graphics.lineBetween(-1, 13, -20, 26);
    graphics.lineStyle(2, 0xf7ffe8, 0.78);
    graphics.lineBetween(-2, 10, 10, -11);
    graphics.lineBetween(-2, 10, -15, -8);
    root.add(graphics);
    return root;
  }

  private createFlowerSelector(): Phaser.GameObjects.Container {
    const root = this.add.container(0, 0).setDepth(8);
    const graphics = this.add.graphics();
    graphics.lineStyle(5, 0x173b20, 1);
    graphics.lineBetween(0, 12, -2, 30);
    graphics.fillStyle(0x45a94f, 1);
    graphics.fillEllipse(-11, 23, 19, 10);
    graphics.fillEllipse(11, 25, 19, 10);
    graphics.fillStyle(0x1b321c, 1);
    graphics.fillEllipse(0, 0, 48, 48);
    graphics.fillStyle(0xf7dcff, 1);
    graphics.fillEllipse(0, -18, 20, 22);
    graphics.fillEllipse(16, -5, 22, 19);
    graphics.fillEllipse(9, 16, 19, 22);
    graphics.fillEllipse(-14, 10, 22, 19);
    graphics.fillEllipse(-16, -7, 22, 19);
    graphics.fillStyle(0xffef78, 1);
    graphics.fillCircle(0, 0, 9);
    graphics.fillStyle(0xffffff, 0.75);
    graphics.fillCircle(-3, -3, 3);
    root.add(graphics);
    return root;
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
    this.creditsTitle = this.add.text(0, 0, "Credits", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "38px",
      color: "#183d20",
    }).setOrigin(0.5);
    this.creditsRole = this.add.text(0, 0, "Playtesters", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "20px",
      color: "#416247",
    }).setOrigin(0.5);
    this.creditsNames = this.add.text(0, 0, "Cosmodeus\nRemy\ntussukarva🇫🇮🇸🇪\n🔪⋆🎀  𝒦𝒾𝓉𝓉𝓎 𝒩💔𝒾𝓇 🎀⋆🔪", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "22px",
      color: "#17491f",
      stroke: "#dfffc8",
      strokeThickness: 4,
      align: "center",
      lineSpacing: 4,
      wordWrap: { width: 390 },
    }).setOrigin(0.5);
    this.creditsBackHit = this.add
      .rectangle(0, 0, 138, 44, 0xe9ffd0, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0x2d6f36)
      .setInteractive({ useHandCursor: true });
    this.creditsBackText = this.add.text(0, 0, "Back", {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: "20px",
      color: "#183d20",
    }).setOrigin(0.5);

    this.creditsBackHit.on("pointerdown", () => this.closeCredits());
    this.creditsRoot.add([
      this.creditsBackdrop,
      this.creditsPanel,
      this.creditsTitle,
      this.creditsRole,
      this.creditsNames,
      this.creditsBackHit,
      this.creditsBackText,
    ]);
  }

  private layoutTitle(): void {
    const shortLandscape = this.scale.width > this.scale.height && this.scale.height < 520;
    const scale = shortLandscape
      ? Math.min(this.scale.width / SOURCE_WIDTH, this.scale.height / SOURCE_HEIGHT)
      : Math.min(this.scale.width / SOURCE_WIDTH, this.scale.height / SOURCE_HEIGHT);
    const offsetX = (this.scale.width - SOURCE_WIDTH * scale) / 2;
    const offsetY = (this.scale.height - SOURCE_HEIGHT * scale) / 2;

    this.drawBackground();
    this.positionSourceObject(this.logoTop, 683, 118, scale, offsetX, offsetY, 76);
    this.positionSourceObject(this.logoBottom, 683, 194, scale, offsetX, offsetY, 68);
    this.positionSourceObject(this.taglineTop, 683, 280, scale, offsetX, offsetY, 26);
    this.positionSourceObject(this.taglineBottom, 683, 318, scale, offsetX, offsetY, 28);
    this.noticeText?.setPosition(this.scale.width / 2, this.scale.height - 34);

    for (const button of this.buttons) {
      const x = offsetX + button.sourceX * scale;
      const y = offsetY + button.sourceY * scale;
      const width = button.sourceWidth * scale;
      const height = button.sourceHeight * scale;

      button.hit.setPosition(x, y).setSize(width, height);
      button.outline.setPosition(x, y).setSize(width, height);
      button.label.setPosition(x, y).setFontSize(Math.max(22, 46 * scale));
    }

    this.layoutMenuSelectors(scale, offsetX, offsetY);
    this.layoutCreditsPanel();
  }

  private positionSourceObject(
    text: Phaser.GameObjects.Text,
    sourceX: number,
    sourceY: number,
    scale: number,
    offsetX: number,
    offsetY: number,
    sourceFontSize: number,
  ): void {
    text.setPosition(offsetX + sourceX * scale, offsetY + sourceY * scale).setFontSize(Math.max(18, sourceFontSize * scale));
  }

  private drawBackground(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    const g = this.backgroundGraphics;
    g.clear();
    g.fillStyle(0xaedfed, 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(0xffe2a8, 0.78);
    g.fillRect(0, height * 0.22, width, height * 0.18);
    g.fillStyle(0xfff1ba, 1);
    g.fillCircle(width * 0.76, height * 0.25, Math.min(width, height) * 0.07);
    g.fillStyle(0x89b7aa, 1);
    g.fillTriangle(0, height * 0.36, width * 0.22, height * 0.18, width * 0.48, height * 0.36);
    g.fillStyle(0x6f9f87, 1);
    g.fillTriangle(width * 0.05, height * 0.38, width * 0.34, height * 0.22, width * 0.66, height * 0.38);
    g.fillStyle(0x9bd56f, 1);
    g.fillRect(0, height * 0.38, width, height * 0.62);
    g.fillStyle(0x76bd5d, 1);
    for (let i = 0; i < 36; i += 1) {
      const x = (i / 35) * width;
      g.fillTriangle(x - 28, height, x + 18, height * 0.5 + Math.sin(i) * 18, x + 68, height);
    }
    g.fillStyle(0x5aa84e, 1);
    for (let i = 0; i < 90; i += 1) {
      const x = ((i * 37) % 100) / 100 * width;
      const y = height * (0.56 + ((i * 19) % 38) / 100);
      g.fillRect(x, y, 3, height * 0.08);
    }
    g.fillStyle(0xf7ffe8, 0.84);
    for (let i = 0; i < 28; i += 1) {
      const x = ((i * 53) % 100) / 100 * width;
      const y = height * (0.64 + ((i * 17) % 28) / 100);
      g.fillCircle(x, y, 4);
    }
  }

  private setActiveMenuButton(id: TitleButton["id"]): void {
    this.activeButtonId = id;
    this.layoutTitle();
  }

  private layoutMenuSelectors(scale?: number, offsetX?: number, offsetY?: number): void {
    const titleScale = scale ?? Math.min(this.scale.width / SOURCE_WIDTH, this.scale.height / SOURCE_HEIGHT);
    const titleOffsetX = offsetX ?? (this.scale.width - SOURCE_WIDTH * titleScale) / 2;
    const titleOffsetY = offsetY ?? (this.scale.height - SOURCE_HEIGHT * titleScale) / 2;
    const button = this.buttons.find((candidate) => candidate.id === this.activeButtonId) ?? this.buttons[0];
    if (!button) {
      return;
    }

    const sidePadding = button.id === "credits" ? 46 : 52;
    const iconScale = titleScale * (button.id === "credits" ? 0.82 : 1);
    this.selectorLeft.setPosition(
      titleOffsetX + (button.sourceX - button.sourceWidth / 2 - sidePadding) * titleScale,
      titleOffsetY + button.sourceY * titleScale,
    );
    this.selectorRight.setPosition(
      titleOffsetX + (button.sourceX + button.sourceWidth / 2 + sidePadding) * titleScale,
      titleOffsetY + (button.sourceY + 1) * titleScale,
    );
    this.selectorLeft.setScale(iconScale);
    this.selectorRight.setScale(iconScale);
  }

  private layoutCreditsPanel(): void {
    const panelWidth = Math.min(520, this.scale.width - 40);
    const panelHeight = Math.min(360, this.scale.height - 36);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.creditsBackdrop?.setSize(this.scale.width, this.scale.height);
    this.creditsPanel?.setPosition(centerX, centerY).setSize(panelWidth, panelHeight);
    this.creditsTitle?.setPosition(centerX, centerY - panelHeight / 2 + 48);
    this.creditsRole?.setPosition(centerX, centerY - panelHeight / 2 + 100);
    this.creditsNames?.setPosition(centerX, centerY + 12).setWordWrapWidth(Math.max(220, panelWidth - 50));
    this.creditsBackHit?.setPosition(centerX, centerY + panelHeight / 2 - 44);
    this.creditsBackText?.setPosition(centerX, centerY + panelHeight / 2 - 44);
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
