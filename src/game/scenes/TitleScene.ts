import Phaser from "phaser";
import { DEFAULT_MUSIC_VOLUME, readStoredMusicVolume, writeStoredMusicVolume } from "../data/audio-settings";
import { BUILD_LABEL } from "../data/build-info";
import { CHARACTER_CLASSES, getCharacterClass, type CharacterClassDefinition } from "../data/character-classes";
import { ChiptuneMusicSystem, TITLE_TRACK_ID } from "../systems/ChiptuneMusicSystem";
import { hasSavedGame, resetSave } from "../systems/SaveSystem";
import type { CharacterClassId } from "../types/game-state";

const TITLE_BACKGROUND_KEY = "title-background";
const CREDITS_PANEL_BASE_WIDTH = 420;
const CREDITS_PANEL_BASE_HEIGHT = 290;
const OPTIONS_PANEL_BASE_WIDTH = 460;
const OPTIONS_PANEL_BASE_HEIGHT = 220;
const CLASS_PANEL_BASE_WIDTH = 1060;
const CLASS_PANEL_BASE_HEIGHT = 560;
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
  frame: Phaser.GameObjects.Rectangle;
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
  private titleArt!: Phaser.GameObjects.Graphics;
  private foregroundArt!: Phaser.GameObjects.Graphics;
  private titleTopText!: Phaser.GameObjects.Text;
  private titleBottomText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
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
  private creditsDevRole!: Phaser.GameObjects.Text;
  private creditsDevName!: Phaser.GameObjects.Text;
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
  private menuTheme = new ChiptuneMusicSystem();
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
  private readonly layoutTitleHandler = () => this.layoutTitle();

  constructor() {
    super("TitleScene");
  }

  preload(): void {
    this.load.image(TITLE_BACKGROUND_KEY, "/assets/title-screen.png");
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
      this.titleReady = false;
      this.scale.off("resize", this.layoutTitleHandler);
      this.scene.start("GameScene", { stressMode: true });
      return;
    }

    this.menuThemeVolume = readStoredMusicVolume();
    this.background = this.add.image(0, 0, TITLE_BACKGROUND_KEY).setOrigin(0.5).setDepth(0);
    this.titleArt = this.add.graphics().setDepth(2);
    this.foregroundArt = this.add.graphics().setDepth(5);
    this.createTitleMark();
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
      this.scale.off("resize", this.layoutTitleHandler);
      this.stopMenuTheme();
    });

    this.scale.off("resize", this.layoutTitleHandler);
    this.scale.on("resize", this.layoutTitleHandler);
    this.layoutTitle();
  }

  private createTitleMark(): void {
    this.titleTopText = this.add
      .text(0, 0, "GRASS TOUCHING", {
        fontFamily: "Impact, Trebuchet MS, Arial",
        fontSize: "66px",
        color: "#95ee66",
        stroke: "#062713",
        strokeThickness: 10,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setShadow(0, 4, "#0a180c", 3, false, true);

    this.titleBottomText = this.add
      .text(0, 0, "SIMULATOR", {
        fontFamily: "Impact, Trebuchet MS, Arial",
        fontSize: "64px",
        color: "#ffd76a",
        stroke: "#3a1c10",
        strokeThickness: 10,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setShadow(0, 4, "#0a180c", 3, false, true);

    this.subtitleText = this.add
      .text(0, 0, "A SOOTHING JOURNEY INTO NATURE\nFEEL THE GRASS. RELAX. BREATHE.", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "19px",
        color: "#f7ffe8",
        stroke: "#092213",
        strokeThickness: 5,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setShadow(0, 2, "#06190f", 2, false, true);
    this.subtitleText.setLineSpacing(2);
  }

  private startMenuThemeWhenAllowed(): void {
    this.menuTheme.setTrack(TITLE_TRACK_ID);
    this.menuTheme.setComboLevel(32);
    this.menuTheme.setVolume(this.menuThemeVolume);
    this.playMenuTheme();
  }

  private isStressModeRequested(): boolean {
    return new URLSearchParams(window.location.search).has("stress");
  }

  private playMenuTheme(): void {
    if (!this.menuThemeEnabled || this.menuTheme.isPlaying()) {
      return;
    }

    this.menuTheme.start(this.menuThemeVolume);
    this.refreshOptionsPanel();
  }

  private stopMenuTheme(): void {
    this.menuTheme.stop();
  }

  private toggleMenuTheme(): void {
    if (this.menuTheme.isPlaying()) {
      this.menuThemeEnabled = false;
      this.menuTheme.stop();
      this.showNotice("Music: off.");
      this.refreshOptionsPanel();
      return;
    }

    this.menuThemeEnabled = true;
    this.menuTheme.start(this.menuThemeVolume);
    this.showNotice("Music: on.");
    this.refreshOptionsPanel();
  }

  private createMenuButton(
    id: TitleButton["id"],
    sourceX: number,
    sourceY: number,
    hitWidth: number,
    hitHeight: number,
    selectorWidth: number,
  ): void {
    const frame = this.add
      .rectangle(0, 0, hitWidth, hitHeight, 0x0b2a18, 0.72)
      .setOrigin(0.5)
      .setDepth(7)
      .setStrokeStyle(2, 0xb7eba5, 0.42);
    const hit = this.add
      .rectangle(0, 0, hitWidth, hitHeight, 0xffffff, 0.001)
      .setOrigin(0.5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, this.getMenuButtonLabel(id), {
        fontFamily: "Impact, Trebuchet MS, Arial",
        fontSize: "42px",
        color: "#fff1a8",
        stroke: "#2b160f",
        strokeThickness: 6,
        shadow: { offsetX: 0, offsetY: 3, color: "#06190f", blur: 2, stroke: false, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(9);

    hit.on("pointerover", () => this.setActiveMenuButton(id));
    hit.on("pointerdown", () => this.handleButton(id));

    this.buttons.push({ id, sourceX, sourceY, hitWidth, hitHeight, selectorWidth, frame, hit, label });
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
    this.creditsDevRole = this.add
      .text(0, 0, "Developer", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "20px",
        color: "#b7eba5",
      })
      .setOrigin(0.5);
    this.creditsDevName = this.add
      .text(0, 0, "sensiburner", {
        fontFamily: "Trebuchet MS, Arial",
        fontSize: "24px",
        color: "#f7ffe8",
        stroke: "#12341c",
        strokeThickness: 4,
        align: "center",
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
      .text(0, 0, "Cosmodeus\nRemy\nRobin C.\nTuloWodash\ntussukarva🇫🇮🇸🇪\n🔪⋆🎀  𝒦𝒾𝓉𝓉𝓎 𝒩💔𝒾𝓇 🎀⋆🔪", {
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
      this.creditsDevRole,
      this.creditsDevName,
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
    if (!this.titleReady || !this.background?.active || !this.menuPanel?.active || !this.titleArt?.active) {
      return;
    }

    const short = this.scale.height < 560;
    const narrow = this.scale.width < 680;
    const compact = short || narrow;
    const coverScale = Math.max(this.scale.width / this.background.width, this.scale.height / this.background.height);
    const displayWidth = this.background.width * coverScale;
    const displayHeight = this.background.height * coverScale;
    const centerX = this.scale.width / 2;

    this.background.setPosition(centerX, this.scale.height / 2);
    this.background.setDisplaySize(displayWidth, displayHeight);
    this.noticeText?.setPosition(this.scale.width / 2, this.scale.height - 34);
    this.buildLabelText?.setPosition(this.scale.width - 14, this.scale.height - 10);

    const titleY = short ? 38 : compact ? 58 : 70;
    const titleMaxWidth = Math.max(260, Math.min(760, this.scale.width - 36));
    this.fitTextToWidth(this.titleTopText, titleMaxWidth, short ? 36 : compact ? 48 : 68, 30);
    this.fitTextToWidth(this.titleBottomText, titleMaxWidth, short ? 35 : compact ? 47 : 66, 29);
    this.subtitleText.setFontSize(short ? 12 : compact ? 15 : 19);
    this.subtitleText.setWordWrapWidth(titleMaxWidth);
    this.titleTopText.setPosition(centerX, titleY);
    this.titleBottomText.setPosition(centerX, titleY + (short ? 37 : compact ? 48 : 66));
    this.subtitleText.setPosition(centerX, titleY + (short ? 78 : compact ? 102 : 138));

    const menuRowHeight = short ? 34 : compact ? 42 : 50;
    const menuGap = short ? 5 : compact ? 8 : 10;
    const menuWidth = Math.min(short ? 286 : compact ? 330 : 390, this.scale.width - 38);
    const menuHeight = this.buttons.length * menuRowHeight + (this.buttons.length - 1) * menuGap + (short ? 24 : 36);
    const menuTop = Phaser.Math.Clamp(
      Math.max(this.subtitleText.y + (short ? 26 : 42), this.scale.height * (short ? 0.38 : 0.48)),
      short ? 84 : 174,
      Math.max(short ? 84 : 174, this.scale.height - menuHeight - 26),
    );

    this.drawTitleArt(centerX, titleY, titleMaxWidth, menuTop, menuWidth, menuHeight, compact, short);
    this.layoutOptionsPanel();
    this.layoutClassSelectPanel();

    this.buttons.forEach((button, index) => {
      const active = button.id === this.activeButtonId;
      const y = menuTop + (short ? 12 : 18) + menuRowHeight / 2 + index * (menuRowHeight + menuGap);
      const rowWidth = button.id === "credits" ? menuWidth * 0.72 : button.id === "quit" ? menuWidth * 0.66 : menuWidth * 0.86;
      button.frame.setPosition(centerX, y).setSize(rowWidth, menuRowHeight);
      button.frame.setFillStyle(active ? 0xffef78 : 0x0b2a18, active ? 0.32 : 0.7);
      button.frame.setStrokeStyle(active ? 4 : 2, active ? 0xffef78 : 0xb7eba5, active ? 0.96 : 0.42);
      button.hit.setPosition(centerX, y).setSize(Math.max(rowWidth, 180), menuRowHeight + 8).setScale(1);
      button.label.setPosition(centerX, y - (short ? 1 : 2));
      button.label.setFontSize(short ? (button.id === "credits" ? 22 : 29) : compact ? (button.id === "credits" ? 25 : 34) : button.id === "credits" ? 30 : 41);
      button.label.setColor(active ? "#fff7c7" : "#ffe6a3");
      button.label.setStroke("#2b160f", short ? 4 : 6);
    });

    this.layoutMenuSelectors();
    this.layoutCreditsPanel();
  }

  private fitTextToWidth(text: Phaser.GameObjects.Text, maxWidth: number, preferredSize: number, minSize: number): void {
    let size = preferredSize;
    text.setFontSize(size);

    while (text.width > maxWidth && size > minSize) {
      size -= 2;
      text.setFontSize(size);
    }
  }

  private drawTitleArt(
    centerX: number,
    titleY: number,
    titleMaxWidth: number,
    menuTop: number,
    menuWidth: number,
    menuHeight: number,
    compact: boolean,
    short: boolean,
  ): void {
    const narrow = this.scale.width < 680;
    const titleWidth = narrow ? this.scale.width - 2 : Math.min(this.scale.width - 28, Math.max(330, titleMaxWidth + (compact ? 18 : 56)));
    const titleHeight = short ? 150 : narrow ? Math.min(this.scale.height * 0.44, 372) : compact ? 216 : 306;
    const titleX = centerX - titleWidth / 2;
    const titleTop = Math.max(10, titleY - (short ? 29 : compact ? 39 : 53));
    const menuX = centerX - menuWidth / 2;

    this.titleArt.clear();
    this.titleArt.fillStyle(0x06190f, 0.56);
    this.titleArt.fillRoundedRect(titleX + 8, titleTop + 8, titleWidth, titleHeight, 22);
    this.titleArt.fillStyle(0x123d22, 1);
    this.titleArt.fillRoundedRect(titleX, titleTop, titleWidth, titleHeight, 22);
    this.titleArt.fillStyle(0x1f6a36, 0.2);
    this.titleArt.fillRoundedRect(titleX + 10, titleTop + 10, titleWidth - 20, titleHeight - 20, 16);
    this.titleArt.lineStyle(compact ? 3 : 4, 0xe0ffc9, 0.78);
    this.titleArt.strokeRoundedRect(titleX, titleTop, titleWidth, titleHeight, 22);
    this.titleArt.lineStyle(2, 0xffef78, 0.36);
    this.titleArt.strokeRoundedRect(titleX + 9, titleTop + 9, titleWidth - 18, titleHeight - 18, 15);

    this.drawMenuPanel(menuX, menuTop, menuWidth, menuHeight, compact);
    this.drawForegroundShade();
  }

  private drawMenuPanel(x: number, y: number, width: number, height: number, compact: boolean): void {
    const border = compact ? 3 : 4;
    const inset = compact ? 8 : 12;
    const narrow = this.scale.width < 680;
    const panelX = narrow ? 12 : x;
    const panelWidth = narrow ? this.scale.width - 24 : width;
    const panelHeight = narrow && this.scale.height >= 560 ? Math.min(this.scale.height - y - 28, height + 72) : height;
    this.menuPanel.clear();
    this.menuPanel.fillStyle(0x04130b, 0.72);
    this.menuPanel.fillRoundedRect(panelX + 9, y + 10, panelWidth, panelHeight, 18);
    this.menuPanel.fillStyle(0x071b11, 0.94);
    this.menuPanel.fillRoundedRect(panelX, y, panelWidth, panelHeight, 18);
    this.menuPanel.fillStyle(0x15522b, 0.82);
    this.menuPanel.fillRoundedRect(panelX + border, y + border, panelWidth - border * 2, panelHeight - border * 2, 14);
    this.menuPanel.fillStyle(0xb7eba5, 0.16);
    this.menuPanel.fillRoundedRect(panelX + inset, y + inset, panelWidth - inset * 2, compact ? 8 : 12, 4);
    this.menuPanel.lineStyle(border, 0xb7eba5, 0.76);
    this.menuPanel.strokeRoundedRect(panelX, y, panelWidth, panelHeight, 18);
    this.menuPanel.lineStyle(2, 0xffef78, 0.24);
    this.menuPanel.strokeRoundedRect(panelX + inset, y + inset, panelWidth - inset * 2, panelHeight - inset * 2, 10);
  }

  private drawForegroundShade(): void {
    this.foregroundArt.clear();

    const bandCount = 6;
    for (let index = 0; index < bandCount; index += 1) {
      const bandHeight = 34 + index * 9;
      const y = this.scale.height - bandHeight;
      this.foregroundArt.fillStyle(0x06190f, 0.05 + index * 0.025);
      this.foregroundArt.fillRect(0, y, this.scale.width, bandHeight);
    }
  }

  private setActiveMenuButton(id: TitleButton["id"]): void {
    this.activeButtonId = id;
    this.layoutTitle();
  }

  private layoutMenuSelectors(): void {
    const button = this.buttons.find((candidate) => candidate.id === this.activeButtonId) ?? this.buttons[0];
    if (!button) {
      return;
    }

    const iconScale = this.scale.height < 560 ? 0.42 : this.scale.width < 680 ? 0.58 : 0.78;
    const sidePadding = this.scale.height < 560 ? 18 : 28;
    const halfWidth = button.frame.width / 2;
    this.selectorLeft.setVisible(true);
    this.selectorRight.setVisible(true);
    this.selectorLeft.setPosition(button.frame.x - halfWidth - sidePadding, button.frame.y);
    this.selectorRight.setPosition(button.frame.x + halfWidth + sidePadding, button.frame.y + 1);
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
    this.creditsDevRole?.setPosition(centerX, centerY - panelHeight / 2 + 84);
    this.creditsDevName?.setPosition(centerX, centerY - panelHeight / 2 + 111);
    this.creditsRole?.setPosition(centerX, centerY - panelHeight / 2 + 150);
    this.creditsNames?.setPosition(centerX, centerY + 16);
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
    const compact = this.scale.width < 980;
    const columns = narrow ? 1 : Math.min(this.classCards.length, compact ? 2 : 3);
    const rows = Math.max(1, Math.ceil(this.classCards.length / columns));
    const panelWidth = Math.min(narrow ? 370 : columns === 2 ? 800 : 1080, this.scale.width - (narrow ? 20 : 36));
    const panelHeight = Math.min(narrow ? 820 : rows > 1 ? 700 : 570, this.scale.height - (narrow ? 24 : 32));
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    const columnGap = narrow ? 0 : 24;
    const rowGap = narrow ? 12 : 20;
    const cardsAreaHeight = Math.max(300, panelHeight - (narrow ? 184 : 210));
    const cardWidth = narrow ? Math.min(316, panelWidth - 48) : Math.min(316, (panelWidth - 72 - (columns - 1) * columnGap) / columns);
    const cardHeight = Math.min(narrow ? 188 : rows > 1 ? 276 : 300, (cardsAreaHeight - (rows - 1) * rowGap) / rows);
    const cardScale = narrow ? Math.min(1, cardWidth / 316) : 1;
    const cardScaleX = narrow ? cardScale : cardWidth / 316;
    const cardScaleY = narrow ? cardScale : cardHeight / 300;
    const cardsTop = centerY - panelHeight / 2 + (narrow ? 124 : 150);

    this.resizeInteractiveBackdrop(this.classSelectBackdrop);
    this.classSelectPanel?.setPosition(centerX, centerY);
    this.classSelectPanel?.setScale(panelWidth / CLASS_PANEL_BASE_WIDTH, panelHeight / CLASS_PANEL_BASE_HEIGHT);
    this.classSelectTitle?.setPosition(centerX, centerY - panelHeight / 2 + 42);
    this.classSelectTitle?.setFontSize(narrow ? 26 : 36);
    this.classSelectSubtitle?.setPosition(centerX, centerY - panelHeight / 2 + (narrow ? 82 : 86));
    this.classSelectSubtitle?.setFontSize(narrow ? 16 : 17);
    this.classSelectSubtitle?.setWordWrapWidth(Math.max(240, panelWidth - 76));

    this.classCards.forEach((card, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const cardsInRow = Math.min(columns, this.classCards.length - row * columns);
      const columnOffset = column - (cardsInRow - 1) / 2;
      const cardX = centerX + columnOffset * (cardWidth + columnGap);
      const cardY = cardsTop + row * (cardHeight + rowGap) + cardHeight / 2;
      card.container.setPosition(cardX, cardY);
      card.container.setScale(cardScaleX, cardScaleY);
      this.layoutClassCard(card, narrow, compact, cardHeight / cardScaleY);
    });

    this.classBackHit?.setPosition(centerX, centerY + panelHeight / 2 - 38);
    this.classBackText?.setPosition(centerX, centerY + panelHeight / 2 - 38);
  }

  private layoutClassCard(card: ClassCard, narrow: boolean, compact: boolean, cardBaseHeight: number): void {
    if (!narrow) {
      const hasIcon = Boolean(card.characterClass.iconKey);
      const iconX = hasIcon ? -104 : 0;
      const textX = hasIcon ? 32 : 0;

      card.frame.setSize(316, 300);
      card.hit.setSize(316, 300);
      card.iconBg.setPosition(iconX, -100).setScale(1);
      card.icon.setPosition(iconX, -100).setDisplaySize(78, 78);
      card.name.setPosition(textX, -126).setFontSize(compact ? 24 : hasIcon ? 25 : 28);
      card.archetype.setPosition(textX, -96).setFontSize(compact ? 15 : 16);
      card.passive.setPosition(textX, -66).setFontSize(hasIcon ? 17 : 19);
      card.body
        .setPosition(0, -40)
        .setText([card.characterClass.passiveDescription, "", ...card.characterClass.statLines].join("\n"))
        .setFontSize(14)
        .setWordWrapWidth(compact ? 260 : 266)
        .setLineSpacing(2);
      card.button.setPosition(0, 130).setSize(188, 38);
      card.buttonText.setPosition(0, 130).setFontSize(18);
      return;
    }

    const top = -cardBaseHeight / 2;
    const shortCard = cardBaseHeight < 168;

    card.frame.setSize(316, cardBaseHeight);
    card.hit.setSize(316, cardBaseHeight);
    card.iconBg.setPosition(-108, top + 42).setScale(shortCard ? 0.66 : 0.74);
    card.icon.setPosition(-108, top + 42).setDisplaySize(shortCard ? 54 : 62, shortCard ? 54 : 62);
    card.name.setPosition(40, top + 23).setFontSize(shortCard ? 19 : 21);
    card.archetype.setPosition(40, top + 45).setFontSize(shortCard ? 12 : 13);
    card.passive.setPosition(40, top + 67).setFontSize(shortCard ? 13 : 14);
    card.body
      .setPosition(0, top + (shortCard ? 82 : 84))
      .setText(card.characterClass.statLines.join("\n"))
      .setFontSize(shortCard ? 11 : 12)
      .setWordWrapWidth(260)
      .setLineSpacing(shortCard ? -1 : 0);
    card.button.setPosition(0, cardBaseHeight / 2 - 20).setSize(178, 32);
    card.buttonText.setPosition(0, cardBaseHeight / 2 - 20).setFontSize(16);
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

    this.menuTheme.setVolume(this.menuThemeVolume);

    if (this.menuThemeVolume <= 0) {
      this.menuThemeEnabled = false;
      this.menuTheme.stop();
      this.showNotice("Music: muted.");
    } else if (!this.menuThemeEnabled) {
      this.menuThemeEnabled = true;
      this.playMenuTheme();
    }

    this.refreshOptionsPanel();
  }

  private refreshOptionsPanel(): void {
    this.volumeLabel?.setText(`Music volume: ${Math.round(this.menuThemeVolume * 100)}%`);
    this.musicToggleText?.setText(this.menuThemeEnabled && this.menuTheme.isPlaying() ? "Music: On" : "Music: Off");
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
