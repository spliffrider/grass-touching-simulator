import Phaser from "phaser";
import { DEFAULT_MUSIC_VOLUME, readStoredMusicVolume, writeStoredMusicVolume } from "../data/audio-settings";
import { BUILD_LABEL } from "../data/build-info";
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
  private creditsPanel!: Phaser.GameObjects.NineSlice;
  private creditsTitle!: Phaser.GameObjects.Text;
  private creditsRole!: Phaser.GameObjects.Text;
  private creditsNames!: Phaser.GameObjects.Text;
  private creditsBackHit!: Phaser.GameObjects.Rectangle;
  private creditsBackText!: Phaser.GameObjects.Text;
  private buildLabelText!: Phaser.GameObjects.Text;
  private optionsRoot!: Phaser.GameObjects.Container;
  private optionsBackdrop!: Phaser.GameObjects.Rectangle;
  private optionsPanel!: Phaser.GameObjects.NineSlice;
  private optionsTitle!: Phaser.GameObjects.Text;
  private volumeLabel!: Phaser.GameObjects.Text;
  private volumeTrack!: Phaser.GameObjects.Rectangle;
  private volumeFill!: Phaser.GameObjects.Rectangle;
  private volumeHit!: Phaser.GameObjects.Rectangle;
  private volumeKnob!: Phaser.GameObjects.Arc;
  private musicToggleHit!: Phaser.GameObjects.Rectangle;
  private musicToggleText!: Phaser.GameObjects.Text;
  private optionsBackHit!: Phaser.GameObjects.Rectangle;
  private optionsBackText!: Phaser.GameObjects.Text;
  private menuTheme?: HTMLAudioElement;
  private menuThemeEnabled = true;
  private menuThemeVolume = DEFAULT_MUSIC_VOLUME;
  private optionsOpen = false;
  private creditsOpen = false;
  private draggingVolume = false;
  private titleReady = false;
  private volumeSliderX = 0;
  private volumeSliderWidth = 1;

  constructor() {
    super("TitleScene");
  }

  preload(): void {
    this.load.image("title-screen", "/assets/title-screen.png");
    this.load.image("panel-emerald", "/assets/ui/panel-emerald.png");
    this.load.image("title-selector-leaf", "/assets/title-selector-leaf.png");
    this.load.image("title-selector-flower", "/assets/title-selector-flower.png");
  }

  create(): void {
    this.titleReady = true;
    this.menuThemeVolume = readStoredMusicVolume();
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

    this.buildLabelText = this.add
      .text(0, 0, BUILD_LABEL, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "13px",
        color: "#f7ffe8",
        stroke: "#17491f",
        strokeThickness: 4,
      })
      .setOrigin(1, 1)
      .setDepth(10)
      .setAlpha(0.82);

    this.createCreditsPanel();
    this.createOptionsPanel();

    this.input.keyboard?.on("keydown-ENTER", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-SPACE", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-ESC", () => {
      this.closeCredits();
      this.closeOptions();
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handleVolumeDrag(pointer));
    this.input.on("pointerup", () => {
      this.draggingVolume = false;
    });
    this.input.on("pointerupoutside", () => {
      this.draggingVolume = false;
    });
    this.startMenuThemeWhenAllowed();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.titleReady = false;
      this.stopMenuTheme();
    });

    this.scale.on("resize", () => this.layoutTitle());
    this.layoutTitle();
  }

  private startMenuThemeWhenAllowed(): void {
    this.menuTheme = new Audio(MENU_THEME_PATH);
    this.menuTheme.loop = true;
    this.menuTheme.volume = this.menuThemeVolume;
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
        this.refreshOptionsPanel();
      }
    });
    document.body.appendChild(this.menuTheme);

    this.playMenuTheme();
  }

  private playMenuTheme(): void {
    if (!this.menuTheme || !this.menuThemeEnabled || !this.menuTheme.paused) {
      return;
    }

    void this.menuTheme
      .play()
      .then(() => this.refreshOptionsPanel())
      .catch(() => {
        // Browsers block unprompted audio; menu interactions retry playback.
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
      this.refreshOptionsPanel();
      return;
    }

    this.menuThemeEnabled = true;
    this.menuTheme.volume = this.menuThemeVolume;
    void this.menuTheme
      .play()
      .then(() => {
        this.showNotice("Music: on.");
        this.refreshOptionsPanel();
      })
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
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x06190f, 0.8)
      .setOrigin(0, 0)
      .setInteractive();
    this.creditsPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, 420, 290, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setAlpha(0.98);
    this.creditsTitle = this.add
      .text(0, 0, "Credits", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "38px",
        color: "#f7ffe8",
        stroke: "#092213",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.creditsRole = this.add
      .text(0, 0, "Playtesters", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#b7eba5",
      })
      .setOrigin(0.5);
    this.creditsNames = this.add
      .text(0, 0, "Cosmodeus\nRemy\nRobin C.\ntussukarva🇫🇮🇸🇪\n🔪⋆🎀  𝒦𝒾𝓉𝓉𝓎 𝒩💔𝒾𝓇 🎀⋆🔪", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "22px",
        color: "#f7ffe8",
        stroke: "#12341c",
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

  private createOptionsPanel(): void {
    this.optionsRoot = this.add.container(0, 0).setDepth(28).setVisible(false);
    this.optionsBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x06190f, 0.58)
      .setOrigin(0, 0)
      .setInteractive();
    this.optionsPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, 460, 220, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setAlpha(0.98);
    this.optionsTitle = this.add
      .text(0, 0, "Options", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "34px",
        color: "#f7ffe8",
        stroke: "#092213",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.volumeLabel = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#b7eba5",
      })
      .setOrigin(0.5);
    this.volumeTrack = this.add.rectangle(0, 0, 320, 12, 0x163b22, 1).setOrigin(0, 0.5);
    this.volumeFill = this.add.rectangle(0, 0, 220, 12, 0xb7eba5, 1).setOrigin(0, 0.5);
    this.volumeHit = this.add
      .rectangle(0, 0, 350, 44, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.volumeKnob = this.add.circle(0, 0, 14, 0xf7ffe8, 1).setStrokeStyle(4, 0xb7eba5).setInteractive({ useHandCursor: true });
    this.musicToggleHit = this.add
      .rectangle(0, 0, 136, 42, 0xe9ffd0, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0x2d6f36)
      .setInteractive({ useHandCursor: true });
    this.musicToggleText = this.add
      .text(0, 0, "", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);
    this.optionsBackHit = this.add
      .rectangle(0, 0, 100, 42, 0xe9ffd0, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0x2d6f36)
      .setInteractive({ useHandCursor: true });
    this.optionsBackText = this.add
      .text(0, 0, "Back", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);

    this.volumeHit.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.startVolumeDrag(pointer));
    this.volumeKnob.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.startVolumeDrag(pointer));
    this.musicToggleHit.on("pointerdown", () => this.toggleMenuTheme());
    this.optionsBackHit.on("pointerdown", () => this.closeOptions());
    this.optionsRoot.add([
      this.optionsBackdrop,
      this.optionsPanel,
      this.optionsTitle,
      this.volumeLabel,
      this.volumeTrack,
      this.volumeFill,
      this.volumeHit,
      this.volumeKnob,
      this.musicToggleHit,
      this.musicToggleText,
      this.optionsBackHit,
      this.optionsBackText,
    ]);
    this.refreshOptionsPanel();
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
    this.buildLabelText?.setPosition(this.scale.width - 14, this.scale.height - 10);
    this.drawMenuPanel(scale, offsetX, offsetY);
    this.layoutOptionsPanel();

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
    this.menuPanel.fillStyle(0x071b11, 0.88);
    this.menuPanel.fillRect(x, y, width, height);
    this.menuPanel.fillStyle(0x0f3d22, 0.72);
    this.menuPanel.fillRect(x + border, y + border, width - border * 2, height - border * 2);
    this.menuPanel.fillStyle(0xb7eba5, 0.16);
    this.menuPanel.fillRect(x + inset, y + inset, width - inset * 2, Math.max(6, 12 * scale));
    this.menuPanel.lineStyle(border, 0xb7eba5, 0.86);
    this.menuPanel.strokeRect(x, y, width, height);
    this.menuPanel.lineStyle(Math.max(2, Math.round(2 * scale)), 0x05130b, 0.78);
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

  private layoutOptionsPanel(): void {
    const panelWidth = Math.min(500, this.scale.width - 36);
    const panelHeight = Math.min(230, this.scale.height - 48);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const trackWidth = Math.max(190, panelWidth - 120);
    const trackX = centerX - trackWidth / 2;
    const trackY = centerY - 5;
    const buttonY = centerY + panelHeight / 2 - 45;

    this.optionsBackdrop?.setSize(this.scale.width, this.scale.height);
    this.optionsPanel?.setPosition(centerX, centerY).setSize(panelWidth, panelHeight);
    this.optionsTitle?.setPosition(centerX, centerY - panelHeight / 2 + 42);
    this.volumeLabel?.setPosition(centerX, centerY - 42);
    this.volumeTrack?.setPosition(trackX, trackY).setSize(trackWidth, 12);
    this.volumeFill?.setPosition(trackX, trackY).setSize(trackWidth * this.menuThemeVolume, 12);
    this.volumeHit?.setPosition(centerX, trackY).setSize(trackWidth + 36, 44);
    this.volumeKnob?.setPosition(trackX + trackWidth * this.menuThemeVolume, trackY);
    this.musicToggleHit?.setPosition(centerX - 72, buttonY);
    this.musicToggleText?.setPosition(centerX - 72, buttonY);
    this.optionsBackHit?.setPosition(centerX + 86, buttonY);
    this.optionsBackText?.setPosition(centerX + 86, buttonY);
    this.volumeSliderX = trackX;
    this.volumeSliderWidth = trackWidth;
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
        this.openOptions();
        break;
      case "credits":
        this.closeOptions();
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
    if (!this.titleReady || !this.noticeText?.active) {
      return;
    }

    this.noticeText.setText(message);
  }

  private openOptions(): void {
    this.closeCredits();
    this.optionsOpen = true;
    this.optionsRoot.setVisible(true);
    this.playMenuTheme();
    this.refreshOptionsPanel();
    this.showNotice("Drag the slider to set menu music volume.");
  }

  private closeOptions(): void {
    this.optionsOpen = false;
    this.draggingVolume = false;
    this.optionsRoot?.setVisible(false);
  }

  private startVolumeDrag(pointer: Phaser.Input.Pointer): void {
    this.draggingVolume = true;
    this.setVolumeFromPointer(pointer);
    this.playMenuTheme();
  }

  private handleVolumeDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.draggingVolume || !this.optionsOpen) {
      return;
    }

    this.setVolumeFromPointer(pointer);
  }

  private setVolumeFromPointer(pointer: Phaser.Input.Pointer): void {
    const nextVolume = Phaser.Math.Clamp((pointer.x - this.volumeSliderX) / this.volumeSliderWidth, 0, 1);
    this.setMenuThemeVolume(nextVolume);
  }

  private setMenuThemeVolume(volume: number): void {
    this.menuThemeVolume = writeStoredMusicVolume(volume);

    if (this.menuTheme) {
      this.menuTheme.volume = this.menuThemeVolume;
    }

    if (this.menuThemeVolume <= 0) {
      this.menuThemeEnabled = false;
      this.menuTheme?.pause();
      this.showNotice("Music: muted.");
    } else if (!this.menuThemeEnabled) {
      this.menuThemeEnabled = true;
      this.playMenuTheme();
    }

    this.refreshOptionsPanel();
  }

  private refreshOptionsPanel(): void {
    this.volumeLabel?.setText(`Music volume: ${Math.round(this.menuThemeVolume * 100)}%`);
    this.musicToggleText?.setText(this.menuThemeEnabled && !this.menuTheme?.paused ? "Music: On" : "Music: Off");
    this.layoutOptionsPanel();
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
