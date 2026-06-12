import Phaser from "phaser";
import { DEFAULT_MUSIC_VOLUME, readStoredMusicVolume, writeStoredMusicVolume } from "../data/audio-settings";
import { BUILD_LABEL } from "../data/build-info";
import { CHARACTER_CLASSES, getCharacterClass, type CharacterClassDefinition } from "../data/character-classes";
import { hasSavedGame, resetSave } from "../systems/SaveSystem";
import type { CharacterClassId } from "../types/game-state";

const SOURCE_WIDTH = 1366;
const SOURCE_HEIGHT = 768;
const MENU_THEME_PATH = "/assets/music/epic_menu_theme_mellow.wav";
const CREDITS_PANEL_BASE_WIDTH = 420;
const CREDITS_PANEL_BASE_HEIGHT = 290;
const OPTIONS_PANEL_BASE_WIDTH = 460;
const OPTIONS_PANEL_BASE_HEIGHT = 220;
const CLASS_PANEL_BASE_WIDTH = 740;
const CLASS_PANEL_BASE_HEIGHT = 430;
const OPTIONS_TRACK_BASE_WIDTH = 320;
const OPTIONS_TRACK_BASE_HEIGHT = 12;
const OPTIONS_HIT_BASE_WIDTH = 350;
const OPTIONS_HIT_BASE_HEIGHT = 44;

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

interface ClassCard {
  characterClass: CharacterClassDefinition;
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
  frame: Phaser.GameObjects.Rectangle;
  iconBg: Phaser.GameObjects.Arc;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  archetype: Phaser.GameObjects.Text;
  passive: Phaser.GameObjects.Text;
  body: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Rectangle;
  buttonText: Phaser.GameObjects.Text;
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
  private creditsGrassRole!: Phaser.GameObjects.Text;
  private creditsGrassName!: Phaser.GameObjects.Text;
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
  private classSelectRoot!: Phaser.GameObjects.Container;
  private classSelectBackdrop!: Phaser.GameObjects.Rectangle;
  private classSelectPanel!: Phaser.GameObjects.NineSlice;
  private classSelectTitle!: Phaser.GameObjects.Text;
  private classSelectSubtitle!: Phaser.GameObjects.Text;
  private classCards: ClassCard[] = [];
  private classBackHit!: Phaser.GameObjects.Rectangle;
  private classBackText!: Phaser.GameObjects.Text;
  private menuTheme?: HTMLAudioElement;
  private menuThemeEnabled = true;
  private menuThemeVolume = DEFAULT_MUSIC_VOLUME;
  private optionsOpen = false;
  private creditsOpen = false;
  private classSelectOpen = false;
  private activeClassId: CharacterClassId = CHARACTER_CLASSES[0].id;
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

    for (const characterClass of CHARACTER_CLASSES) {
      if (characterClass.iconKey && characterClass.iconPath) {
        this.load.image(characterClass.iconKey, characterClass.iconPath);
      }
    }
  }

  create(): void {
    this.titleReady = true;
    if (this.isStressModeRequested()) {
      this.scene.start("GameScene", { stressMode: true });
      return;
    }

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
    this.createClassSelectPanel();

    this.input.keyboard?.on("keydown-ENTER", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-SPACE", () => this.startOrContinue());
    this.input.keyboard?.on("keydown-ESC", () => {
      this.closeClassSelect();
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

  private isStressModeRequested(): boolean {
    return new URLSearchParams(window.location.search).has("stress");
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
      .nineslice(0, 0, "panel-emerald", undefined, CREDITS_PANEL_BASE_WIDTH, CREDITS_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
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
    this.creditsGrassRole = this.add
      .text(0, 0, "Grass Toucher", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#b7eba5",
      })
      .setOrigin(0.5);
    this.creditsGrassName = this.add
      .text(0, 0, "Sad choupbese", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "22px",
        color: "#f7ffe8",
        stroke: "#12341c",
        strokeThickness: 4,
        align: "center",
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
      this.creditsGrassRole,
      this.creditsGrassName,
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
      .nineslice(0, 0, "panel-emerald", undefined, OPTIONS_PANEL_BASE_WIDTH, OPTIONS_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
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
    this.volumeTrack = this.add.rectangle(0, 0, OPTIONS_TRACK_BASE_WIDTH, OPTIONS_TRACK_BASE_HEIGHT, 0x163b22, 1).setOrigin(0, 0.5);
    this.volumeFill = this.add.rectangle(0, 0, OPTIONS_TRACK_BASE_WIDTH, OPTIONS_TRACK_BASE_HEIGHT, 0xb7eba5, 1).setOrigin(0, 0.5);
    this.volumeHit = this.add
      .rectangle(0, 0, OPTIONS_HIT_BASE_WIDTH, OPTIONS_HIT_BASE_HEIGHT, 0xffffff, 0.001)
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

  private createClassSelectPanel(): void {
    this.classSelectRoot = this.add.container(0, 0).setDepth(32).setVisible(false);
    this.classSelectBackdrop = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x06190f, 0.72)
      .setOrigin(0, 0)
      .setInteractive();
    this.classSelectPanel = this.add
      .nineslice(0, 0, "panel-emerald", undefined, CLASS_PANEL_BASE_WIDTH, CLASS_PANEL_BASE_HEIGHT, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setAlpha(0.98);
    this.classSelectTitle = this.add
      .text(0, 0, "Choose Your Grass Toucher", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "36px",
        color: "#f7ffe8",
        stroke: "#092213",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.classSelectSubtitle = this.add
      .text(0, 0, "This starts a new save. Pick the passive you want to grow around.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "17px",
        color: "#b7eba5",
        align: "center",
      })
      .setOrigin(0.5);

    this.classSelectRoot.add([this.classSelectBackdrop, this.classSelectPanel, this.classSelectTitle, this.classSelectSubtitle]);

    this.classCards = CHARACTER_CLASSES.map((characterClass) => this.createClassCard(characterClass));

    this.classBackHit = this.add
      .rectangle(0, 0, 118, 42, 0xe9ffd0, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0x2d6f36)
      .setInteractive({ useHandCursor: true });
    this.classBackText = this.add
      .text(0, 0, "Back", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);

    this.classBackHit.on("pointerdown", () => this.closeClassSelect());
    this.classSelectRoot.add([this.classBackHit, this.classBackText]);
    this.refreshClassCards();
  }

  private createClassCard(characterClass: CharacterClassDefinition): ClassCard {
    const container = this.add.container(0, 0);
    const hit = this.add
      .rectangle(0, 0, 316, 300, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const frame = this.add
      .rectangle(0, 0, 316, 300, 0x0b2a18, 0.92)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0xb7eba5, 0.72);
    const hasIcon = Boolean(characterClass.iconKey);
    const iconX = hasIcon ? -104 : 0;
    const textX = hasIcon ? 32 : 0;
    const iconBg = this.add
      .circle(iconX, -100, 42, 0x06190f, 0.88)
      .setStrokeStyle(3, 0xffef78, hasIcon ? 0.9 : 0)
      .setVisible(hasIcon);
    const icon = this.add
      .image(iconX, -100, characterClass.iconKey ?? "title-selector-leaf")
      .setDisplaySize(78, 78)
      .setVisible(hasIcon);
    const name = this.add
      .text(textX, -126, characterClass.name, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: hasIcon ? "25px" : "28px",
        color: "#f7ffe8",
        stroke: "#092213",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const archetype = this.add
      .text(textX, -96, characterClass.archetype, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "16px",
        color: "#b7eba5",
      })
      .setOrigin(0.5);
    const passive = this.add
      .text(textX, -66, characterClass.passiveName, {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: hasIcon ? "17px" : "19px",
        color: "#ffef78",
        stroke: "#092213",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    const body = this.add
      .text(0, -40, [characterClass.passiveDescription, "", ...characterClass.statLines].join("\n"), {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "14px",
        color: "#f7ffe8",
        align: "center",
        lineSpacing: 2,
        wordWrap: { width: 266 },
      })
      .setOrigin(0.5, 0);
    const button = this.add
      .rectangle(0, 130, 188, 38, 0xe9ffd0, 0.98)
      .setOrigin(0.5)
      .setStrokeStyle(3, 0x2d6f36);
    const buttonText = this.add
      .text(0, 130, "Start", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "18px",
        color: "#183d20",
      })
      .setOrigin(0.5);

    container.add([frame, iconBg, icon, hit, name, archetype, passive, body, button, buttonText]);
    hit.on("pointerover", () => this.setActiveClass(characterClass.id));
    hit.on("pointerdown", () => this.startNewGameWithClass(characterClass.id));
    this.classSelectRoot.add(container);

    return { characterClass, container, hit, frame, iconBg, icon, name, archetype, passive, body, button, buttonText };
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
    this.layoutClassSelectPanel();

    for (const button of this.buttons) {
      const x = offsetX + button.sourceX * scale;
      const y = offsetY + button.sourceY * scale;
      button.hit.setPosition(x, y);
      button.hit.setScale(scale);
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
    const panelHeight = Math.min(430, this.scale.height - 36);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    this.resizeInteractiveBackdrop(this.creditsBackdrop);
    this.creditsPanel?.setPosition(centerX, centerY);
    this.creditsPanel?.setScale(panelWidth / CREDITS_PANEL_BASE_WIDTH, panelHeight / CREDITS_PANEL_BASE_HEIGHT);
    this.creditsTitle?.setPosition(centerX, centerY - panelHeight / 2 + 42);
    this.creditsRole?.setPosition(centerX, centerY - panelHeight / 2 + 88);
    this.creditsNames?.setPosition(centerX, centerY - 24);
    this.creditsNames?.setWordWrapWidth(Math.max(220, panelWidth - 50));
    this.creditsGrassRole?.setPosition(centerX, centerY + panelHeight / 2 - 110);
    this.creditsGrassName?.setPosition(centerX, centerY + panelHeight / 2 - 82);
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

    this.resizeInteractiveBackdrop(this.optionsBackdrop);
    this.optionsPanel?.setPosition(centerX, centerY);
    this.optionsPanel?.setScale(panelWidth / OPTIONS_PANEL_BASE_WIDTH, panelHeight / OPTIONS_PANEL_BASE_HEIGHT);
    this.optionsTitle?.setPosition(centerX, centerY - panelHeight / 2 + 42);
    this.volumeLabel?.setPosition(centerX, centerY - 42);
    this.volumeTrack?.setPosition(trackX, trackY);
    this.volumeTrack?.setScale(trackWidth / OPTIONS_TRACK_BASE_WIDTH, 1);
    this.volumeFill?.setPosition(trackX, trackY);
    this.volumeFill?.setScale((trackWidth * this.menuThemeVolume) / OPTIONS_TRACK_BASE_WIDTH, 1);
    this.volumeHit?.setPosition(centerX, trackY);
    this.volumeHit?.setScale((trackWidth + 36) / OPTIONS_HIT_BASE_WIDTH, 1);
    this.volumeKnob?.setPosition(trackX + trackWidth * this.menuThemeVolume, trackY);
    this.musicToggleHit?.setPosition(centerX - 72, buttonY);
    this.musicToggleText?.setPosition(centerX - 72, buttonY);
    this.optionsBackHit?.setPosition(centerX + 86, buttonY);
    this.optionsBackText?.setPosition(centerX + 86, buttonY);
    this.volumeSliderX = trackX;
    this.volumeSliderWidth = trackWidth;
  }

  private layoutClassSelectPanel(): void {
    const narrow = this.scale.width < 720;
    const panelWidth = Math.min(narrow ? 520 : 790, this.scale.width - 36);
    const panelHeight = Math.min(narrow ? 700 : 560, this.scale.height - 32);
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const cardWidth = narrow ? Math.min(330, panelWidth - 58) : Math.min(316, (panelWidth - 110) / 2);
    const cardHeight = narrow ? 274 : 300;
    const cardScaleX = cardWidth / 316;
    const cardScaleY = cardHeight / 300;

    this.resizeInteractiveBackdrop(this.classSelectBackdrop);
    this.classSelectPanel?.setPosition(centerX, centerY);
    this.classSelectPanel?.setScale(panelWidth / CLASS_PANEL_BASE_WIDTH, panelHeight / CLASS_PANEL_BASE_HEIGHT);
    this.classSelectTitle?.setPosition(centerX, centerY - panelHeight / 2 + 42);
    this.classSelectTitle?.setFontSize(narrow ? 28 : 36);
    this.classSelectSubtitle?.setPosition(centerX, centerY - panelHeight / 2 + (narrow ? 78 : 86));
    this.classSelectSubtitle?.setWordWrapWidth(Math.max(240, panelWidth - 76));

    this.classCards.forEach((card, index) => {
      const cardX = narrow ? centerX : centerX + (index === 0 ? -cardWidth / 2 - 18 : cardWidth / 2 + 18);
      const cardY = narrow ? centerY - 122 + index * (cardHeight + 18) : centerY + 42;
      card.container.setPosition(cardX, cardY);
      card.frame.setSize(316, 300);
      card.hit.setSize(316, 300);
      card.container.setScale(cardScaleX, cardScaleY);
      card.name.setFontSize(narrow ? 25 : 28);
      card.body.setWordWrapWidth(narrow ? 272 : 266);
      card.body.setFontSize(narrow ? 13 : 14);
    });

    this.classBackHit?.setPosition(centerX, centerY + panelHeight / 2 - 38);
    this.classBackText?.setPosition(centerX, centerY + panelHeight / 2 - 38);
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

  private handleButton(id: TitleButton["id"]): void {
    if (this.classSelectOpen && id !== "start") {
      return;
    }

    if (this.creditsOpen && id !== "credits") {
      return;
    }

    switch (id) {
      case "start":
        this.openClassSelect();
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

    if (this.classSelectOpen) {
      this.startNewGameWithClass(this.activeClassId);
      return;
    }

    if (this.creditsOpen) {
      this.closeCredits();
      return;
    }

    if (hasSavedGame()) {
      this.scene.start("GameScene");
      return;
    }

    this.openClassSelect();
  }

  private openClassSelect(): void {
    this.closeCredits();
    this.closeOptions();
    this.classSelectOpen = true;
    this.activeClassId = CHARACTER_CLASSES[0].id;
    this.classSelectRoot.setVisible(true);
    this.playMenuTheme();
    this.refreshClassCards();
    this.layoutClassSelectPanel();
    this.showNotice("");
  }

  private closeClassSelect(): void {
    this.classSelectOpen = false;
    this.classSelectRoot?.setVisible(false);
  }

  private setActiveClass(id: CharacterClassId): void {
    this.activeClassId = id;
    this.refreshClassCards();
  }

  private refreshClassCards(): void {
    for (const card of this.classCards) {
      const active = card.characterClass.id === this.activeClassId;
      card.frame.setFillStyle(active ? 0x123d23 : 0x0b2a18, active ? 0.98 : 0.92);
      card.frame.setStrokeStyle(active ? 4 : 3, active ? 0xffef78 : 0xb7eba5, active ? 0.98 : 0.72);
      card.button.setFillStyle(active ? 0xffef78 : 0xe9ffd0, 0.98);
      card.button.setStrokeStyle(3, active ? 0xf4df6a : 0x2d6f36);
      card.buttonText.setText(active ? "Start as This" : "Start");
      card.buttonText.setColor("#183d20");
      card.name.setColor(active ? "#ffef78" : "#f7ffe8");
      card.passive.setColor(active ? "#fff2b2" : "#ffef78");
    }
  }

  private startNewGameWithClass(id: CharacterClassId): void {
    const characterClass = getCharacterClass(id);
    resetSave(id);
    this.showNotice(`Starting as ${characterClass.name}.`);
    this.scene.start("GameScene", { newGame: true, characterClassId: id });
  }

  private showNotice(message: string): void {
    if (!this.titleReady || !this.noticeText?.active) {
      return;
    }

    this.noticeText.setText(message);
  }

  private openOptions(): void {
    this.closeCredits();
    this.closeClassSelect();
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
    this.closeClassSelect();
    this.creditsOpen = true;
    this.creditsRoot.setVisible(true);
    this.showNotice("");
  }

  private closeCredits(): void {
    this.creditsOpen = false;
    this.creditsRoot?.setVisible(false);
  }
}
