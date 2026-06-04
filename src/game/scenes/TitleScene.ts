import Phaser from "phaser";
import { hasSavedGame, resetSave } from "../systems/SaveSystem";

const SOURCE_WIDTH = 1366;
const SOURCE_HEIGHT = 768;
const MENU_THEME_PATH = "/assets/music/epic_menu_theme_mellow.wav";

interface TitleButton {
  id: "start" | "continue" | "options" | "quit" | "credits";
  sourceX: number;
  sourceY: number;
  hitWidth: number;
  hitHeight: number;
  selectorWidth: number;
  hit: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class TitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private selectorLeft!: Phaser.GameObjects.Image;
  private selectorRight!: Phaser.GameObjects.Image;
  private menuPanel!: Phaser.GameObjects.Graphics;
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
  private menuTheme?: HTMLAudioElement;
  private menuThemeEnabled = true;
  private optionsOpen = false;
  private creditsOpen = false;

  constructor() {
    super("TitleScene");
  }

  preload(): void {
    this.load.image("title-screen", "/assets/title-screen.png");
    this.load.image("title-selector-leaf", "/assets/title-selector-leaf.png");
    this.load.image("title-selector-flower", "/assets/title-selector-flower.png");
  }

  create(): void {
    this.background = this.add.image(0, 0, "title-screen").setOrigin(0.5);
    this.createMenuButton("start", 683, 469, 390, 56, 220);
    this.createMenuButton("continue", 683, 529, 350, 54, 205);
    this.createMenuButton("options", 683, 589, 300, 54, 170);
    this.createMenuButton("quit", 683, 650, 230, 54, 105);
    this.createMenuButton("credits", 683, 704, 260, 50, 145);
    this.menuPanel = this.add.graphics().setDepth(6);
    this.selectorLeft = this.add.image(0, 0, "title-selector-leaf").setOrigin(0.5).setDepth(8);
    this.selectorRight = this.add.image(0, 0, "title-selector-flower").setOrigin(0.5).setDepth(8);

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
    this.startMenuThemeWhenAllowed();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stopMenuTheme());

    this.scale.on("resize", () => this.layoutTitle());
    this.layoutTitle();
  }

  private startMenuThemeWhenAllowed(): void {
    this.menuTheme = new Audio(MENU_THEME_PATH);
    this.menuTheme.loop = true;
    this.menuTheme.volume = 0.72;
    this.menuTheme.preload = "auto";
    this.menuTheme.setAttribute("playsinline", "true");
    this.menuTheme.style.display = "none";
    this.menuTheme.addEventListener("error", () => {
      const code = this.menuTheme?.error?.code ?? "unknown";
      this.showNotice(`Menu music could not load. Audio error ${code}.`);
    });
    this.menuTheme.addEventListener("playing", () => {
      if (this.optionsOpen) {
        this.showNotice("Music: on.");
      }
    });
    document.body.appendChild(this.menuTheme);

    this.playMenuTheme();
  }

  private playMenuTheme(): void {
    if (!this.menuTheme || !this.menuThemeEnabled || !this.menuTheme.paused) {
      return;
    }

    void this.menuTheme.play().catch(() => {
      // Browsers block unprompted audio; the window gesture listeners retry playback.
    });
  }

  private stopMenuTheme(): void {
    if (!this.menuTheme) {
      return;
    }

    this.menuTheme.pause();
    this.menuTheme.currentTime = 0;
    this.menuTheme.remove();
    this.menuTheme.src = "";
    this.menuTheme = undefined;
  }

  private toggleMenuTheme(): void {
    if (!this.menuTheme) {
      this.showNotice("Music is still waking up. Try once more.");
      return;
    }

    if (!this.menuTheme.paused) {
      this.menuThemeEnabled = false;
      this.menuTheme.pause();
      this.showNotice("Music: off.");
      return;
    }

    this.menuThemeEnabled = true;
    void this.menuTheme
      .play()
      .then(() => this.showNotice("Music: on."))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.name : "blocked";
        this.showNotice(`Music blocked by browser: ${message}. Tap Options again.`);
      });
  }

  private createMenuButton(
    id: TitleButton["id"],
    sourceX: number,
    sourceY: number,
    hitWidth: number,
    hitHeight: number,
    selectorWidth: number,
  ): void {
    const hit = this.add
      .rectangle(0, 0, hitWidth, hitHeight, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setDepth(9)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, this.getMenuButtonLabel(id), {
        fontFamily: "Impact, Trebuchet MS, Arial",
        fontSize: "42px",
        color: "#ffe6a3",
        stroke: "#2b160f",
        strokeThickness: 7,
        shadow: { offsetX: 2, offsetY: 3, color: "#f7ffe8", blur: 0, stroke: false, fill: false },
      })
      .setOrigin(0.5)
      .setDepth(7);

    hit.on("pointerover", () => this.setActiveMenuButton(id));
    hit.on("pointerdown", () => this.handleButton(id));

    this.buttons.push({ id, sourceX, sourceY, hitWidth, hitHeight, selectorWidth, hit, label });
  }

  private getMenuButtonLabel(id: TitleButton["id"]): string {
    const labels = {
      start: "START GAME",
      continue: "CONTINUE",
      options: "OPTIONS",
      quit: "QUIT",
      credits: "CREDITS",
    } satisfies Record<TitleButton["id"], string>;

    return labels[id];
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
      .text(0, 0, "Playtesters", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#416247",
      })
      .setOrigin(0.5);
    this.creditsNames = this.add
      .text(0, 0, "Cosmodeus\nRemy\ntussukarva🇫🇮🇸🇪\n🔪⋆🎀  𝒦𝒾𝓉𝓉𝓎 𝒩💔𝒾𝓇 🎀⋆🔪", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "22px",
        color: "#17491f",
        stroke: "#dfffc8",
        strokeThickness: 4,
        align: "center",
        lineSpacing: 4,
        wordWrap: { width: 390 },
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
      this.creditsNames,
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
    this.drawMenuPanel(scale, offsetX, offsetY);

    for (const button of this.buttons) {
      const x = offsetX + button.sourceX * scale;
      const y = offsetY + button.sourceY * scale;
      button.hit.setPosition(x, y).setSize(button.hitWidth * scale, button.hitHeight * scale);
      button.label.setPosition(x, y - 1 * scale);
      button.label.setFontSize(Math.max(20, Math.round((button.id === "credits" ? 30 : button.id === "quit" ? 38 : 43) * scale)));
      button.label.setStroke("#2b160f", Math.max(3, Math.round(7 * scale)));
    }

    this.layoutMenuSelectors(scale, offsetX, offsetY);
    this.layoutCreditsPanel();
  }

  private drawMenuPanel(scale: number, offsetX: number, offsetY: number): void {
    const x = offsetX + 482 * scale;
    const y = offsetY + 410 * scale;
    const width = 402 * scale;
    const height = 326 * scale;
    const border = Math.max(3, Math.round(5 * scale));
    const inset = Math.max(6, Math.round(10 * scale));

    this.menuPanel.clear();
    this.menuPanel.fillStyle(0x173b20, 0.94);
    this.menuPanel.fillRect(x, y, width, height);
    this.menuPanel.fillStyle(0x2d6f36, 0.94);
    this.menuPanel.fillRect(x + border, y + border, width - border * 2, height - border * 2);
    this.menuPanel.fillStyle(0xf4ffdc, 0.18);
    this.menuPanel.fillRect(x + inset, y + inset, width - inset * 2, Math.max(6, 12 * scale));
    this.menuPanel.lineStyle(border, 0xf7ffe8, 0.95);
    this.menuPanel.strokeRect(x, y, width, height);
    this.menuPanel.lineStyle(Math.max(2, Math.round(2 * scale)), 0x102315, 0.75);
    this.menuPanel.strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);
  }

  private setActiveMenuButton(id: TitleButton["id"]): void {
    this.activeButtonId = id;
    this.layoutTitle();
  }

  private layoutMenuSelectors(scale?: number, offsetX?: number, offsetY?: number): void {
    const titleScale = scale ?? Math.max(this.scale.width / SOURCE_WIDTH, this.scale.height / SOURCE_HEIGHT);
    const titleOffsetX = offsetX ?? (this.scale.width - SOURCE_WIDTH * titleScale) / 2;
    const titleOffsetY = offsetY ?? (this.scale.height - SOURCE_HEIGHT * titleScale) / 2;
    const button = this.buttons.find((candidate) => candidate.id === this.activeButtonId) ?? this.buttons[0];
    if (!button) {
      return;
    }

    const sidePadding = button.id === "credits" ? 48 : 54;
    const iconScale = titleScale * (button.id === "credits" ? 0.78 : 0.86);
    this.selectorLeft.setPosition(
      titleOffsetX + (button.sourceX - button.selectorWidth / 2 - sidePadding) * titleScale,
      titleOffsetY + button.sourceY * titleScale,
    );
    this.selectorRight.setPosition(
      titleOffsetX + (button.sourceX + button.selectorWidth / 2 + sidePadding) * titleScale,
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
          this.playMenuTheme();
          this.showNotice("No save yet. Start Game begins your first patch.");
        }
        break;
      case "options":
        this.optionsOpen = !this.optionsOpen;
        this.toggleMenuTheme();
        break;
      case "credits":
        this.playMenuTheme();
        this.openCredits();
        break;
      case "quit":
        this.playMenuTheme();
        this.showNotice("Browser version: closing the tab is the quit button.");
        break;
    }
  }

  private startOrContinue(): void {
    this.playMenuTheme();

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
