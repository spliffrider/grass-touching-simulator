import Phaser from "phaser";
import {
  readStoredMusicVolume,
  readStoredSfxVolume,
  writeStoredMusicVolume,
  writeStoredSfxVolume,
} from "../data/audio-settings";
import { BUILD_LABEL } from "../data/build-info";
import {
  CREDIT_DEVELOPER,
  CREDITS_ACCESSIBLE_COPY,
  GRASS_TOUCHER_CREDITS,
  PLAYTESTER_CREDITS,
} from "../data/credits";
import { MEMORY_GROWTH_LABEL } from "../ecosystem/EcosystemCatalog";
import {
  getTitleAtmosphereBudget,
  getTitleScourgeStrength,
} from "../ecosystem/EcosystemTitleAtmosphere";
import {
  clearEcosystemProgress,
  getEcosystemSaveSummary,
  type EcosystemSaveSummary,
} from "../ecosystem/EcosystemSave";
import { getEcosystemTitleLayout } from "../ecosystem/EcosystemTitleLayout";
import { AudioSystem } from "../systems/AudioSystem";

const TITLE_BACKGROUND_LANDSCAPE = "ecosystem-title-landscape";
const TITLE_BACKGROUND_PORTRAIT = "ecosystem-title-portrait";
const TITLE_MOTE_COUNT = 18;
const TITLE_CLOUD_COUNT = 5;
const TITLE_BIRD_COUNT = 5;
const TITLE_BEE_COUNT = 4;
const TITLE_CLOUD_TEXTURE = "ecosystem-title-scourge-cloud";
const TITLE_SCOURGE_VEIL_TEXTURE = "ecosystem-title-scourge-veil";
const TITLE_BIRD_UP_TEXTURE = "ecosystem-title-bird-up";
const TITLE_BIRD_DOWN_TEXTURE = "ecosystem-title-bird-down";
const NEW_FIELD_CONFIRM_MS = 4_500;

type MenuAction = "continue" | "newField" | "options" | "credits";

interface TitleMenuButton {
  id: MenuAction;
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
  enabled: boolean;
  setLabel(label: string, detail: string): void;
}

interface TitleSlider {
  kind: "music" | "sfx";
  label: Phaser.GameObjects.Text;
  track: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  knob: Phaser.GameObjects.Arc;
  hit: Phaser.GameObjects.Rectangle;
  x: number;
  width: number;
  value: number;
}

export class EcosystemTitleScene extends Phaser.Scene {
  private background!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Graphics;
  private menuPanel!: Phaser.GameObjects.NineSlice;
  private titleTop!: Phaser.GameObjects.Text;
  private titleBottom!: Phaser.GameObjects.Text;
  private chapterTitle!: Phaser.GameObjects.Text;
  private alphaLabel!: Phaser.GameObjects.Text;
  private buildLabel!: Phaser.GameObjects.Text;
  private saveStateText!: Phaser.GameObjects.Text;
  private saveDetailText!: Phaser.GameObjects.Text;
  private selectorLeft!: Phaser.GameObjects.Image;
  private selectorRight!: Phaser.GameObjects.Image;
  private selectorDisplaySize = 24;
  private readonly buttons: TitleMenuButton[] = [];
  private selectedButtonIndex = 0;
  private saveSummary!: EcosystemSaveSummary;
  private confirmingNewField = false;
  private confirmTimer?: Phaser.Time.TimerEvent;
  private transitioning = false;

  private optionsRoot!: Phaser.GameObjects.Container;
  private optionsPanel!: Phaser.GameObjects.NineSlice;
  private optionsTitle!: Phaser.GameObjects.Text;
  private optionsBackButton!: TitleMenuButton;
  private readonly sliders: TitleSlider[] = [];
  private draggingSlider: TitleSlider | null = null;

  private creditsRoot!: Phaser.GameObjects.Container;
  private creditsPanel!: Phaser.GameObjects.NineSlice;
  private creditsTitle!: Phaser.GameObjects.Text;
  private creditsDeveloper!: Phaser.GameObjects.Text;
  private creditsPlaytesterTitle!: Phaser.GameObjects.Text;
  private creditsPlaytesterNames!: Phaser.GameObjects.Text;
  private creditsGrassToucherTitle!: Phaser.GameObjects.Text;
  private creditsGrassToucherNames!: Phaser.GameObjects.Text;
  private creditsThanks!: Phaser.GameObjects.Text;
  private creditsBackButton!: TitleMenuButton;

  private readonly motes: Phaser.GameObjects.Image[] = [];
  private readonly motePhases = new Float32Array(TITLE_MOTE_COUNT);
  private readonly moteSpeeds = new Float32Array(TITLE_MOTE_COUNT);
  private readonly moteLanes = new Float32Array(TITLE_MOTE_COUNT);
  private readonly moteDepthFactors = new Float32Array(TITLE_MOTE_COUNT);
  private readonly moteModes = new Uint8Array(TITLE_MOTE_COUNT);
  private scourgeVeil!: Phaser.GameObjects.Image;
  private readonly scourgeClouds: Phaser.GameObjects.Image[] = [];
  private readonly cloudPhases = new Float32Array(TITLE_CLOUD_COUNT);
  private readonly cloudSpeeds = new Float32Array(TITLE_CLOUD_COUNT);
  private readonly cloudLanes = new Float32Array(TITLE_CLOUD_COUNT);
  private readonly cloudDepthFactors = new Float32Array(TITLE_CLOUD_COUNT);
  private readonly birds: Phaser.GameObjects.Image[] = [];
  private readonly birdPhases = new Float32Array(TITLE_BIRD_COUNT);
  private readonly birdSpeeds = new Float32Array(TITLE_BIRD_COUNT);
  private readonly birdLanes = new Float32Array(TITLE_BIRD_COUNT);
  private readonly bees: Phaser.GameObjects.Image[] = [];
  private readonly beePhases = new Float32Array(TITLE_BEE_COUNT);
  private readonly beeSpeeds = new Float32Array(TITLE_BEE_COUNT);
  private readonly beeLanes = new Float32Array(TITLE_BEE_COUNT);
  private atmosphereStartedAt = 0;
  private visibleCloudCount = TITLE_CLOUD_COUNT;
  private visibleBirdCount = TITLE_BIRD_COUNT;
  private visibleBeeCount = TITLE_BEE_COUNT;
  private backgroundBaseX = 0;
  private backgroundBaseY = 0;
  private backgroundBaseScale = 1;
  private parallaxX = 0;
  private parallaxY = 0;
  private parallaxTargetX = 0;
  private parallaxTargetY = 0;
  private readonly audio = new AudioSystem();
  private music?: Phaser.Sound.BaseSound;
  private musicVolume = 0;
  private sfxVolume = 0;
  private modalOpen = false;
  private semanticRoot?: HTMLDivElement;
  private readonly semanticMenuButtons = new Map<MenuAction, HTMLButtonElement>();
  private semanticOptionsBack?: HTMLButtonElement;
  private semanticCreditsBack?: HTMLButtonElement;
  private semanticCreditsCopy?: HTMLParagraphElement;
  private semanticMusicRange?: HTMLInputElement;
  private semanticSfxRange?: HTMLInputElement;
  private readonly resizeHandler = (gameSize: Phaser.Structs.Size): void => {
    this.layout(gameSize.width, gameSize.height);
  };

  constructor() {
    super("EcosystemTitleScene");
  }

  preload(): void {
    this.load.image(TITLE_BACKGROUND_LANDSCAPE, "/assets/backgrounds/title-wholesome-landscape.webp");
    this.load.image(TITLE_BACKGROUND_PORTRAIT, "/assets/backgrounds/title-wholesome-portrait.webp");
    this.load.image("ecosystem-title-panel", "/assets/ui/panel-emerald.png");
    this.load.image("ecosystem-title-button", "/assets/ui/button-emerald-normal.png");
    this.load.image("ecosystem-title-button-hover", "/assets/ui/button-emerald-hover.png");
    this.load.image("ecosystem-title-button-active", "/assets/ui/button-emerald-active.png");
    this.load.image("ecosystem-title-selector-left", "/assets/title-selector-leaf.png");
    this.load.image("ecosystem-title-selector-right", "/assets/title-selector-flower.png");
    this.load.image("ecosystem-title-pollen", "/assets/effects/pollen-fleck.png");
    this.load.image("ecosystem-title-bee", "/assets/effects/bee-pixel.png");
  }

  create(): void {
    this.buttons.length = 0;
    this.sliders.length = 0;
    this.motes.length = 0;
    this.scourgeClouds.length = 0;
    this.birds.length = 0;
    this.bees.length = 0;
    this.semanticMenuButtons.clear();
    this.confirmingNewField = false;
    this.transitioning = false;
    this.modalOpen = false;
    this.draggingSlider = null;
    this.confirmTimer = undefined;
    this.music = undefined;
    this.semanticRoot = undefined;
    this.semanticOptionsBack = undefined;
    this.semanticCreditsBack = undefined;
    this.semanticCreditsCopy = undefined;
    this.semanticMusicRange = undefined;
    this.semanticSfxRange = undefined;
    this.parallaxX = 0;
    this.parallaxY = 0;
    this.parallaxTargetX = 0;
    this.parallaxTargetY = 0;
    this.atmosphereStartedAt = this.time.now;
    this.saveSummary = getEcosystemSaveSummary();
    this.musicVolume = readStoredMusicVolume();
    this.sfxVolume = readStoredSfxVolume();
    this.audio.prepare();
    this.audio.setVolume(this.sfxVolume);

    this.background = this.add.image(0, 0, TITLE_BACKGROUND_LANDSCAPE).setOrigin(0.5).setDepth(0);
    this.createAtmosphereTextures();
    this.scourgeVeil = this.add.image(0, 0, TITLE_SCOURGE_VEIL_TEXTURE)
      .setOrigin(0.5, 0)
      .setDepth(0.25)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.createScourgeClouds();
    this.shade = this.add.graphics().setDepth(1);
    this.createBirds();
    this.createMotes();
    this.createBees();

    this.titleTop = this.createText("GRASS TOUCHING", 66, "#f2e8d5", "bold")
      .setOrigin(0.5)
      .setDepth(6)
      .setShadow(0, 4, "#07100c", 4, false, true);
    this.titleBottom = this.createText("SIMULATOR", 64, "#ffd996", "bold")
      .setOrigin(0.5)
      .setDepth(6)
      .setShadow(0, 4, "#07100c", 4, false, true);
    this.chapterTitle = this.createText("ANCIENT GRASS: ECOSYSTEM", 19, "#dff6ca", "bold")
      .setOrigin(0.5)
      .setDepth(6);
    this.alphaLabel = this.createText("ALPHA", 13, "#fff3c2", "bold")
      .setOrigin(0.5)
      .setDepth(6)
      .setBackgroundColor("#7a294e")
      .setPadding(8, 3, 8, 3);
    this.buildLabel = this.createText(BUILD_LABEL, 12, "#e3f3d6")
      .setOrigin(1, 1)
      .setDepth(7)
      .setAlpha(0.82);

    this.menuPanel = this.add.nineslice(0, 0, "ecosystem-title-panel", undefined, 520, 430, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setDepth(3)
      .setAlpha(0.95);
    this.saveStateText = this.createText("", 16, "#fff3c2", "bold").setOrigin(0.5).setDepth(6);
    this.saveDetailText = this.createText("", 12, "#b8d9a4").setOrigin(0.5).setDepth(6);

    this.createMenuButton("continue");
    this.createMenuButton("newField");
    this.createMenuButton("options");
    this.createMenuButton("credits");
    this.selectorLeft = this.add.image(0, 0, "ecosystem-title-selector-left").setOrigin(0.5).setDepth(8);
    this.selectorRight = this.add.image(0, 0, "ecosystem-title-selector-right").setOrigin(0.5).setDepth(8);

    this.createOptionsModal();
    this.createCreditsModal();
    this.createSemanticControls();
    this.refreshSavePresentation();
    this.selectedButtonIndex = this.saveSummary.hasSave ? 0 : 1;
    this.selectButton(this.selectedButtonIndex);
    this.bindInput();
    this.layout(this.scale.width, this.scale.height);

    this.queueMenuMusic();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownScene());
    window.__grassAppReady?.();
  }

  update(time: number): void {
    this.parallaxX = Phaser.Math.Linear(this.parallaxX, this.parallaxTargetX, 0.035);
    this.parallaxY = Phaser.Math.Linear(this.parallaxY, this.parallaxTargetY, 0.035);
    const landscapeDriftX = Math.sin(time * 0.000055) * this.scale.width * 0.006;
    const landscapeDriftY = Math.cos(time * 0.000043) * this.scale.height * 0.004;
    const backgroundBreath = 1 + Math.sin(time * 0.00018) * 0.0025;
    this.background
      .setPosition(
        this.backgroundBaseX + landscapeDriftX + this.parallaxX * 16,
        this.backgroundBaseY + landscapeDriftY + this.parallaxY * 10,
      )
      .setScale(this.backgroundBaseScale * backgroundBreath);

    const atmosphereElapsed = Math.max(0, time - this.atmosphereStartedAt);
    const scourgeStrength = getTitleScourgeStrength(atmosphereElapsed);
    this.updateScourgeAtmosphere(time, scourgeStrength);
    this.updateWildlife(time, scourgeStrength);

    for (let index = 0; index < this.motes.length; index += 1) {
      const mote = this.motes[index];
      const phase = this.motePhases[index];
      const travel = (time * this.moteSpeeds[index] + phase / (Math.PI * 2)) % 1;
      const depthFactor = this.moteDepthFactors[index];
      if (this.moteModes[index] === 0) {
        mote.x = this.scale.width * (0.1 + this.moteLanes[index] * 1.05)
          + Math.sin(time * 0.00075 + phase) * 18 * depthFactor
          + this.parallaxX * 10 * depthFactor;
        mote.y = this.scale.height * (1.08 - travel * 1.22)
          + Math.sin(time * 0.0009 + phase) * 14 * depthFactor
          + this.parallaxY * 7 * depthFactor;
      } else {
        mote.x = -42 + travel * (this.scale.width + 84)
          + this.parallaxX * 14 * depthFactor;
        mote.y = this.scale.height * this.moteLanes[index]
          + Math.sin(time * 0.001 + phase) * 18 * depthFactor
          + this.parallaxY * 8 * depthFactor;
      }
      mote.rotation = phase + time * (0.0001 + (index % 5) * 0.000025);
      mote.alpha = 0.1 + depthFactor * 0.12 + (Math.sin(time * 0.0014 + phase) + 1) * 0.035;
    }
    if (!this.modalOpen) {
      const pulse = 1 + Math.sin(time * 0.004) * 0.035;
      const size = this.selectorDisplaySize * pulse;
      this.selectorLeft.setDisplaySize(size, size);
      this.selectorRight.setDisplaySize(size, size);
    }
  }

  private createAtmosphereTextures(): void {
    if (!this.textures.exists(TITLE_SCOURGE_VEIL_TEXTURE)) {
      const veil = this.add.graphics();
      for (let band = 0; band < 32; band += 1) {
        const progress = band / 31;
        const alpha = 0.55 * Math.pow(1 - progress, 1.45);
        veil.fillStyle(band < 12 ? 0x192230 : 0x33233c, alpha);
        veil.fillRect(0, band * 8, 8, 8);
      }
      veil.generateTexture(TITLE_SCOURGE_VEIL_TEXTURE, 8, 256);
      veil.destroy();
    }

    if (!this.textures.exists(TITLE_CLOUD_TEXTURE)) {
      const cloud = this.add.graphics();
      cloud.fillStyle(0x282638, 0.18);
      cloud.fillEllipse(280, 125, 540, 150);
      cloud.fillStyle(0x212532, 0.64);
      cloud.fillEllipse(105, 132, 210, 104);
      cloud.fillEllipse(235, 96, 260, 152);
      cloud.fillEllipse(370, 116, 300, 132);
      cloud.fillEllipse(475, 145, 180, 88);
      cloud.fillStyle(0x3d2b46, 0.56);
      cloud.fillEllipse(75, 154, 165, 66);
      cloud.fillEllipse(208, 155, 250, 76);
      cloud.fillEllipse(360, 160, 290, 82);
      cloud.fillEllipse(495, 166, 155, 58);
      cloud.fillStyle(0x746275, 0.22);
      cloud.fillEllipse(226, 70, 148, 74);
      cloud.fillEllipse(382, 102, 172, 74);
      cloud.lineStyle(3, 0xa94c79, 0.22);
      cloud.lineBetween(168, 157, 201, 184);
      cloud.lineBetween(201, 184, 228, 161);
      cloud.lineBetween(390, 163, 415, 191);
      cloud.lineBetween(415, 191, 440, 166);
      cloud.generateTexture(TITLE_CLOUD_TEXTURE, 560, 220);
      cloud.destroy();
    }

    if (!this.textures.exists(TITLE_BIRD_UP_TEXTURE)) {
      const bird = this.add.graphics();
      bird.fillStyle(0x1b2a27, 1);
      bird.fillTriangle(14, 10, 1, 2, 9, 12);
      bird.fillTriangle(14, 10, 29, 2, 20, 12);
      bird.fillCircle(14, 10, 2.4);
      bird.generateTexture(TITLE_BIRD_UP_TEXTURE, 30, 16);
      bird.destroy();
    }

    if (!this.textures.exists(TITLE_BIRD_DOWN_TEXTURE)) {
      const bird = this.add.graphics();
      bird.fillStyle(0x1b2a27, 1);
      bird.fillTriangle(14, 7, 2, 14, 9, 5);
      bird.fillTriangle(14, 7, 28, 14, 20, 5);
      bird.fillCircle(14, 7, 2.4);
      bird.generateTexture(TITLE_BIRD_DOWN_TEXTURE, 30, 16);
      bird.destroy();
    }
  }

  private createScourgeClouds(): void {
    const tints = [0x7d7282, 0x5f556b, 0x83727e, 0x51495d, 0x766373] as const;
    for (let index = 0; index < TITLE_CLOUD_COUNT; index += 1) {
      const cloud = this.add.image(0, 0, TITLE_CLOUD_TEXTURE)
        .setOrigin(0.5)
        .setDepth(0.55 + index * 0.025)
        .setTint(tints[index]);
      if (index % 2 === 1) cloud.setFlipX(true);
      this.cloudPhases[index] = (index * 0.213) % 1;
      this.cloudSpeeds[index] = 0.0000072 + index * 0.0000008;
      this.cloudLanes[index] = 0.045 + (index % 3) * 0.085;
      this.cloudDepthFactors[index] = 0.72 + index * 0.09;
      this.scourgeClouds.push(cloud);
    }
  }

  private createBirds(): void {
    for (let index = 0; index < TITLE_BIRD_COUNT; index += 1) {
      const bird = this.add.image(0, 0, TITLE_BIRD_UP_TEXTURE)
        .setOrigin(0.5)
        .setDepth(1.35 + index * 0.01)
        .setTint(index % 2 === 0 ? 0x263a36 : 0x4a403b);
      this.birdPhases[index] = (index * 0.227) % 1;
      this.birdSpeeds[index] = 0.000035 + index * 0.000002;
      this.birdLanes[index] = 0.09 + (index % 3) * 0.065;
      this.birds.push(bird);
    }
  }

  private createBees(): void {
    this.textures.get("ecosystem-title-bee").setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (let index = 0; index < TITLE_BEE_COUNT; index += 1) {
      const bee = this.add.image(0, 0, "ecosystem-title-bee")
        .setOrigin(0.5)
        .setDepth(2.35 + index * 0.02);
      this.beePhases[index] = (index * 0.271) % 1;
      this.beeSpeeds[index] = 0.000028 + index * 0.000002;
      this.beeLanes[index] = 0.59 + (index % 3) * 0.105;
      this.bees.push(bee);
    }
  }

  private updateScourgeAtmosphere(time: number, strength: number): void {
    this.scourgeVeil.alpha = strength * 0.72;
    for (let index = 0; index < this.visibleCloudCount; index += 1) {
      const cloud = this.scourgeClouds[index];
      const travel = (time * this.cloudSpeeds[index] + this.cloudPhases[index]) % 1;
      const depthFactor = this.cloudDepthFactors[index];
      cloud.x = this.scale.width * (1.24 - travel * 1.52)
        + this.parallaxX * 10 * depthFactor;
      cloud.y = this.scale.height * this.cloudLanes[index]
        + Math.sin(time * (0.00013 + index * 0.000015) + index * 1.7) * 10 * depthFactor
        + this.parallaxY * 6 * depthFactor;
      cloud.alpha = strength * (0.42 + index * 0.055);
    }
  }

  private updateWildlife(time: number, scourgeStrength: number): void {
    for (let index = 0; index < this.visibleBirdCount; index += 1) {
      const bird = this.birds[index];
      const travel = (time * this.birdSpeeds[index] + this.birdPhases[index]) % 1;
      const rightward = index % 2 === 0;
      const horizontalProgress = rightward ? travel : 1 - travel;
      bird.x = -40 + horizontalProgress * (this.scale.width + 80)
        + this.parallaxX * (5 + index);
      bird.y = this.scale.height * this.birdLanes[index]
        + Math.sin(time * 0.00085 + index * 1.9) * (5 + index * 1.4)
        + this.parallaxY * 4;
      const wingUp = Math.sin(time * 0.011 + index * 1.35) >= 0;
      const textureKey = wingUp ? TITLE_BIRD_UP_TEXTURE : TITLE_BIRD_DOWN_TEXTURE;
      if (bird.texture.key !== textureKey) bird.setTexture(textureKey);
      bird.setFlipX(!rightward);
      bird.scaleY = bird.scaleX * (0.88 + Math.sin(time * 0.011 + index) * 0.08);
      bird.rotation = Math.sin(time * 0.001 + index * 2.1) * 0.06;
      bird.alpha = 0.76 - scourgeStrength * 0.24;
    }

    for (let index = 0; index < this.visibleBeeCount; index += 1) {
      const bee = this.bees[index];
      const travel = (time * this.beeSpeeds[index] + this.beePhases[index]) % 1;
      const rightward = index % 2 === 0;
      const horizontalProgress = rightward ? travel : 1 - travel;
      bee.x = -28 + horizontalProgress * (this.scale.width + 56)
        + Math.sin(time * 0.0014 + index * 2.3) * 24
        + this.parallaxX * 12;
      bee.y = this.scale.height * this.beeLanes[index]
        + Math.sin(time * (0.0021 + index * 0.00017) + index) * 18
        + Math.cos(time * 0.0007 + index * 1.7) * 9
        + this.parallaxY * 8;
      bee.setFlipX(!rightward);
      bee.scaleY = bee.scaleX * (0.9 + Math.sin(time * 0.018 + index) * 0.1);
      bee.rotation = Math.sin(time * 0.0032 + index * 1.4) * 0.12;
      bee.alpha = 0.76 + Math.sin(time * 0.0015 + index) * 0.12;
    }
  }

  private createMotes(): void {
    for (let index = 0; index < TITLE_MOTE_COUNT; index += 1) {
      const mote = this.add.image(0, 0, "ecosystem-title-pollen")
        .setOrigin(0.5)
        .setDepth(index % 4 === 0 ? 5 : 2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(index % 5 === 0 ? 0x8de7ff : index % 3 === 0 ? 0xc9f89d : 0xffdf74);
      const depthFactor = 0.58 + (index % 5) * 0.105;
      const size = 4 + depthFactor * 6;
      mote.setDisplaySize(size, size);
      this.motePhases[index] = (index / TITLE_MOTE_COUNT) * Math.PI * 2;
      this.moteSpeeds[index] = index % 2 === 0
        ? 0.000018 + (index % 5) * 0.000002
        : 0.000027 + (index % 6) * 0.0000025;
      this.moteLanes[index] = index % 2 === 0
        ? (index * 0.173) % 0.74
        : 0.42 + ((index * 0.119) % 0.5);
      this.moteDepthFactors[index] = depthFactor;
      this.moteModes[index] = index % 2 === 0 ? 0 : 1;
      this.motes.push(mote);
    }
  }

  private createMenuButton(id: MenuAction): TitleMenuButton {
    const container = this.add.container(0, 0).setDepth(7);
    const back = this.add.nineslice(0, 0, "ecosystem-title-button", undefined, 390, 58, 12, 12, 12, 12)
      .setOrigin(0.5);
    const label = this.createText("", 23, "#f2e8d5", "bold").setOrigin(0.5);
    const detail = this.createText("", 10, "#b8d9a4", "bold").setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, 390, 58, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    container.add([back, label, detail, hit]);
    const button: TitleMenuButton = {
      id,
      container,
      back,
      label,
      detail,
      hit,
      enabled: true,
      setLabel: (nextLabel, nextDetail) => {
        label.setText(nextLabel);
        detail.setText(nextDetail);
      },
    };
    hit.on("pointerover", () => {
      if (!button.enabled || this.modalOpen) return;
      this.selectButton(this.buttons.indexOf(button));
      back.setTexture("ecosystem-title-button-hover");
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scale: 1.025, duration: 100, ease: "Quad.easeOut" });
    });
    hit.on("pointerout", () => {
      if (!button.enabled) return;
      back.setTexture(this.buttons[this.selectedButtonIndex] === button
        ? "ecosystem-title-button-active"
        : "ecosystem-title-button");
      this.tweens.killTweensOf(container);
      this.tweens.add({ targets: container, scale: 1, duration: 100, ease: "Quad.easeOut" });
    });
    hit.on("pointerdown", () => {
      if (!button.enabled || this.modalOpen) return;
      this.ensureAudioUnlocked();
      container.setScale(0.975);
    });
    hit.on("pointerup", () => {
      if (!button.enabled || this.modalOpen) return;
      container.setScale(1);
      this.activateButton(id);
    });
    this.buttons.push(button);
    return button;
  }

  private createOptionsModal(): void {
    this.optionsRoot = this.add.container(0, 0).setDepth(30).setVisible(false);
    const backdrop = this.add.rectangle(0, 0, 1, 1, 0x020805, 0.76)
      .setOrigin(0)
      .setInteractive();
    this.optionsPanel = this.add.nineslice(0, 0, "ecosystem-title-panel", undefined, 520, 390, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setAlpha(0.99);
    this.optionsTitle = this.createText("OPTIONS", 32, "#fff3c2", "bold").setOrigin(0.5);
    this.optionsRoot.add([backdrop, this.optionsPanel, this.optionsTitle]);
    this.createSlider("music");
    this.createSlider("sfx");
    this.optionsBackButton = this.createModalButton(this.optionsRoot, "BACK", () => this.closeModal());
    backdrop.setData("layoutBackdrop", true);
  }

  private createCreditsModal(): void {
    this.creditsRoot = this.add.container(0, 0).setDepth(30).setVisible(false);
    const backdrop = this.add.rectangle(0, 0, 1, 1, 0x020805, 0.76)
      .setOrigin(0)
      .setInteractive();
    this.creditsPanel = this.add.nineslice(0, 0, "ecosystem-title-panel", undefined, 700, 500, 18, 18, 18, 18)
      .setOrigin(0.5)
      .setAlpha(0.99);
    this.creditsTitle = this.createText("CREDITS", 32, "#fff3c2", "bold").setOrigin(0.5);
    this.creditsDeveloper = this.createText(
      `Created by ${CREDIT_DEVELOPER}\nAncient Grass redesign, systems, and art direction`,
      13,
      "#dff6ca",
    ).setOrigin(0.5, 0).setAlign("center").setLineSpacing(3);
    this.creditsPlaytesterTitle = this.createText("PLAYTESTERS", 16, "#8de7ff", "bold").setOrigin(0.5, 0);
    this.creditsPlaytesterNames = this.createText(
      PLAYTESTER_CREDITS.join("\n"),
      15,
      "#f2e8d5",
    ).setOrigin(0.5, 0).setAlign("center").setLineSpacing(2);
    this.creditsGrassToucherTitle = this.createText("GRASS TOUCHERS", 16, "#cde99b", "bold").setOrigin(0.5, 0);
    this.creditsGrassToucherNames = this.createText(
      GRASS_TOUCHER_CREDITS.join("\n"),
      15,
      "#f2e8d5",
    ).setOrigin(0.5, 0).setAlign("center").setLineSpacing(2);
    this.creditsThanks = this.createText(
      "Thank you for touching the grass, finding the rough patches,\nand asking when the next build would be ready.",
      12,
      "#b8d9a4",
    ).setOrigin(0.5).setAlign("center").setLineSpacing(2);
    this.creditsRoot.add([
      backdrop,
      this.creditsPanel,
      this.creditsTitle,
      this.creditsDeveloper,
      this.creditsPlaytesterTitle,
      this.creditsPlaytesterNames,
      this.creditsGrassToucherTitle,
      this.creditsGrassToucherNames,
      this.creditsThanks,
    ]);
    this.creditsBackButton = this.createModalButton(this.creditsRoot, "BACK", () => this.closeModal());
    backdrop.setData("layoutBackdrop", true);
  }

  private createSemanticControls(): void {
    const root = document.createElement("div");
    root.className = "ecosystem-title-semantic-layer";
    root.setAttribute("aria-label", "Grass Touching Simulator title menu");
    for (const action of ["continue", "newField", "options", "credits"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ecosystem-title-semantic-button";
      button.addEventListener("focus", () => this.selectButton(this.buttons.findIndex((candidate) => candidate.id === action)));
      button.addEventListener("pointerenter", () => this.selectButton(this.buttons.findIndex((candidate) => candidate.id === action)));
      button.addEventListener("click", () => this.activateButton(action));
      root.append(button);
      this.semanticMenuButtons.set(action, button);
    }

    this.semanticMusicRange = this.createSemanticRange(root, "Music volume", (value) => this.setVolumeValue("music", value));
    this.semanticSfxRange = this.createSemanticRange(root, "Sound effects volume", (value) => this.setVolumeValue("sfx", value));
    this.semanticOptionsBack = this.createSemanticButton(root, "Back from options", () => this.closeModal());
    this.semanticCreditsCopy = document.createElement("p");
    this.semanticCreditsCopy.className = "ecosystem-agent-readable";
    this.semanticCreditsCopy.textContent = CREDITS_ACCESSIBLE_COPY;
    this.semanticCreditsCopy.hidden = true;
    root.append(this.semanticCreditsCopy);
    this.semanticCreditsBack = this.createSemanticButton(root, "Back from credits", () => this.closeModal());
    document.body.append(root);
    this.semanticRoot = root;
    this.syncSemanticVisibility();
  }

  private createSemanticRange(
    root: HTMLElement,
    label: string,
    onInput: (value: number) => void,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.className = "ecosystem-title-semantic-range";
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => onInput(Number(input.value) / 100));
    root.append(input);
    return input;
  }

  private createSemanticButton(
    root: HTMLElement,
    label: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = "ecosystem-title-semantic-button";
    button.addEventListener("click", onClick);
    root.append(button);
    return button;
  }

  private createSlider(kind: TitleSlider["kind"]): void {
    const label = this.createText("", 17, "#dff6ca", "bold").setOrigin(0.5);
    const track = this.add.rectangle(0, 0, 330, 10, 0x102716, 1)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0x5b3926, 0.9);
    const fill = this.add.rectangle(0, 0, 330, 6, kind === "music" ? 0x83d765 : 0x8de7ff, 1)
      .setOrigin(0, 0.5);
    const knob = this.add.circle(0, 0, 14, 0xfff3c2, 1)
      .setStrokeStyle(4, kind === "music" ? 0x83d765 : 0x8de7ff, 1)
      .setInteractive({ useHandCursor: true });
    const hit = this.add.rectangle(0, 0, 360, 42, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const slider: TitleSlider = {
      kind,
      label,
      track,
      fill,
      knob,
      hit,
      x: 0,
      width: 330,
      value: kind === "music" ? this.musicVolume : this.sfxVolume,
    };
    this.optionsRoot.add([label, track, fill, knob, hit]);
    this.sliders.push(slider);
    const startDrag = (pointer: Phaser.Input.Pointer): void => {
      this.ensureAudioUnlocked();
      this.draggingSlider = slider;
      this.setSliderFromPointer(slider, pointer.x);
    };
    hit.on("pointerdown", startDrag);
    knob.on("pointerdown", startDrag);
  }

  private createModalButton(
    parent: Phaser.GameObjects.Container,
    labelText: string,
    onClick: () => void,
  ): TitleMenuButton {
    const container = this.add.container(0, 0);
    const back = this.add.nineslice(0, 0, "ecosystem-title-button", undefined, 230, 48, 12, 12, 12, 12)
      .setOrigin(0.5);
    const label = this.createText(labelText, 19, "#f2e8d5", "bold").setOrigin(0.5);
    const detail = this.createText("", 10, "#b8d9a4").setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, 230, 48, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    container.add([back, label, detail, hit]);
    parent.add(container);
    const button: TitleMenuButton = {
      id: "options",
      container,
      back,
      label,
      detail,
      hit,
      enabled: true,
      setLabel: (nextLabel, nextDetail) => {
        label.setText(nextLabel);
        detail.setText(nextDetail);
      },
    };
    hit.on("pointerover", () => {
      back.setTexture("ecosystem-title-button-hover");
      container.setScale(1.03);
    });
    hit.on("pointerout", () => {
      back.setTexture("ecosystem-title-button");
      container.setScale(1);
    });
    hit.on("pointerdown", () => container.setScale(0.975));
    hit.on("pointerup", () => {
      container.setScale(1);
      this.ensureAudioUnlocked();
      this.audio.play("skill_select");
      onClick();
    });
    return button;
  }

  private bindInput(): void {
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.parallaxTargetX = Phaser.Math.Clamp(pointer.x / Math.max(1, this.scale.width) - 0.5, -0.5, 0.5);
      this.parallaxTargetY = Phaser.Math.Clamp(pointer.y / Math.max(1, this.scale.height) - 0.5, -0.5, 0.5);
      if (this.draggingSlider) this.setSliderFromPointer(this.draggingSlider, pointer.x);
    });
    this.input.on("pointerup", () => {
      if (this.draggingSlider?.kind === "sfx") this.audio.play("upgrade");
      this.draggingSlider = null;
    });
    this.input.on("pointerupoutside", () => {
      this.draggingSlider = null;
    });
    this.input.keyboard?.on("keydown-UP", () => this.moveSelection(-1));
    this.input.keyboard?.on("keydown-DOWN", () => this.moveSelection(1));
    this.input.keyboard?.on("keydown-ENTER", () => this.activateSelected());
    this.input.keyboard?.on("keydown-SPACE", () => this.activateSelected());
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.modalOpen) this.closeModal();
      else this.cancelNewFieldConfirmation();
    });
  }

  private refreshSavePresentation(): void {
    const continueButton = this.buttons.find((button) => button.id === "continue")!;
    const newButton = this.buttons.find((button) => button.id === "newField")!;
    const optionsButton = this.buttons.find((button) => button.id === "options")!;
    const creditsButton = this.buttons.find((button) => button.id === "credits")!;
    continueButton.enabled = this.saveSummary.hasSave;
    if (this.saveSummary.hasSave) {
      continueButton.setLabel(
        this.saveSummary.active ? "CONTINUE FIELD" : "RETURN TO MEMORY GROVE",
        this.saveSummary.active ? `Run ${this.saveSummary.runNumber} is still alive` : `Spend ${MEMORY_GROWTH_LABEL} before the next run`,
      );
      const elapsedSeconds = Math.floor(this.saveSummary.elapsedMs / 1_000);
      const elapsed = `${Math.floor(elapsedSeconds / 60)}:${`${elapsedSeconds % 60}`.padStart(2, "0")}`;
      this.saveStateText.setText(this.saveSummary.active
        ? `RUN ${this.saveSummary.runNumber}  |  ${this.saveSummary.fieldSize}x${this.saveSummary.fieldSize} LIVING FIELD`
        : `MEMORY GROVE  |  ${this.saveSummary.permanentGrassTouches.toFixed(0)} ${MEMORY_GROWTH_LABEL.toUpperCase()} REMEMBERED`);
      this.saveDetailText.setText(this.saveSummary.active
        ? `${elapsed} elapsed  |  ${this.saveSummary.manualTouchCount} touches  |  ${Math.max(0, this.saveSummary.hp).toFixed(0)} HP`
        : `${this.saveSummary.completedRuns} field${this.saveSummary.completedRuns === 1 ? "" : "s"} completed  |  Run ${this.saveSummary.runNumber} awaits`);
    } else {
      continueButton.setLabel("CONTINUE", "No field has been remembered yet");
      this.saveStateText.setText("A NEW MEMORY");
      this.saveDetailText.setText("Run 1  |  1x1 field  |  bare hands");
    }
    continueButton.container.setAlpha(continueButton.enabled ? 1 : 0.36);
    continueButton.hit.input!.enabled = continueButton.enabled;
    newButton.setLabel(
      this.confirmingNewField ? "CONFIRM NEW FIELD" : "BEGIN NEW FIELD",
      this.confirmingNewField ? "Erase the current ecosystem save" : "Start again from the first touch",
    );
    optionsButton.setLabel("OPTIONS", "Music and sound");
    creditsButton.setLabel("CREDITS", "The people behind the grass");
    for (const button of this.buttons) {
      const semantic = this.semanticMenuButtons.get(button.id);
      if (!semantic) continue;
      semantic.textContent = `${button.label.text}. ${button.detail.text}`;
      semantic.disabled = !button.enabled;
    }
    this.refreshButtonTextures();
  }

  private selectButton(index: number): void {
    if (this.buttons.length === 0 || this.modalOpen) return;
    let nextIndex = Phaser.Math.Wrap(index, 0, this.buttons.length);
    for (let attempts = 0; attempts < this.buttons.length && !this.buttons[nextIndex].enabled; attempts += 1) {
      nextIndex = Phaser.Math.Wrap(nextIndex + 1, 0, this.buttons.length);
    }
    this.selectedButtonIndex = nextIndex;
    this.refreshButtonTextures();
    this.layoutSelectors();
  }

  private moveSelection(direction: number): void {
    if (this.modalOpen || this.transitioning) return;
    this.ensureAudioUnlocked();
    let next = this.selectedButtonIndex;
    do {
      next = Phaser.Math.Wrap(next + direction, 0, this.buttons.length);
    } while (!this.buttons[next].enabled && next !== this.selectedButtonIndex);
    this.selectButton(next);
    this.audio.play("skill_select");
  }

  private refreshButtonTextures(): void {
    for (let index = 0; index < this.buttons.length; index += 1) {
      const button = this.buttons[index];
      button.back.setTexture(index === this.selectedButtonIndex && button.enabled
        ? "ecosystem-title-button-active"
        : "ecosystem-title-button");
    }
  }

  private activateSelected(): void {
    if (this.modalOpen) return;
    const button = this.buttons[this.selectedButtonIndex];
    if (button?.enabled) this.activateButton(button.id);
  }

  private activateButton(id: MenuAction): void {
    if (this.transitioning) return;
    this.ensureAudioUnlocked();
    switch (id) {
      case "continue":
        if (this.saveSummary.hasSave) this.launchEcosystem(false);
        break;
      case "newField":
        this.beginNewField();
        break;
      case "options":
        this.openOptions();
        break;
      case "credits":
        this.openCredits();
        break;
    }
  }

  private beginNewField(): void {
    if (!this.saveSummary.hasSave) {
      this.launchEcosystem(true);
      return;
    }
    if (!this.confirmingNewField) {
      this.confirmingNewField = true;
      this.audio.play("blocked");
      this.confirmTimer?.remove(false);
      this.confirmTimer = this.time.delayedCall(NEW_FIELD_CONFIRM_MS, () => this.cancelNewFieldConfirmation());
      this.refreshSavePresentation();
      return;
    }
    this.launchEcosystem(true);
  }

  private cancelNewFieldConfirmation(): void {
    if (!this.confirmingNewField) return;
    this.confirmingNewField = false;
    this.confirmTimer?.remove(false);
    this.confirmTimer = undefined;
    this.refreshSavePresentation();
  }

  private launchEcosystem(newField: boolean): void {
    this.transitioning = true;
    this.syncSemanticVisibility();
    this.confirmTimer?.remove(false);
    if (newField) clearEcosystemProgress();
    this.audio.play("milestone");
    this.cameras.main.fadeOut(300, 3, 12, 7);
    if (this.music) {
      this.tweens.add({
        targets: this.music,
        volume: 0,
        duration: 260,
      });
    }
    this.time.delayedCall(310, () => {
      this.music?.stop();
      this.scene.start("EcosystemPrototypeScene");
    });
  }

  private openOptions(): void {
    this.modalOpen = true;
    this.cancelNewFieldConfirmation();
    this.optionsRoot.setVisible(true).setAlpha(0);
    this.creditsRoot.setVisible(false);
    this.refreshSliders();
    this.syncSemanticVisibility();
    this.tweens.add({ targets: this.optionsRoot, alpha: 1, duration: 160 });
  }

  private openCredits(): void {
    this.modalOpen = true;
    this.cancelNewFieldConfirmation();
    this.creditsRoot.setVisible(true).setAlpha(0);
    this.optionsRoot.setVisible(false);
    this.syncSemanticVisibility();
    this.tweens.add({ targets: this.creditsRoot, alpha: 1, duration: 160 });
  }

  private closeModal(): void {
    this.modalOpen = false;
    this.draggingSlider = null;
    this.optionsRoot.setVisible(false);
    this.creditsRoot.setVisible(false);
    this.syncSemanticVisibility();
    this.layoutSelectors();
  }

  private setSliderFromPointer(slider: TitleSlider, pointerX: number): void {
    const value = Phaser.Math.Clamp((pointerX - slider.x) / slider.width, 0, 1);
    this.setVolumeValue(slider.kind, value);
  }

  private setVolumeValue(kind: TitleSlider["kind"], value: number): void {
    const clamped = Phaser.Math.Clamp(value, 0, 1);
    if (kind === "music") {
      this.musicVolume = writeStoredMusicVolume(clamped);
      this.sound.setVolume(this.musicVolume);
    } else {
      this.sfxVolume = writeStoredSfxVolume(clamped);
      this.audio.setVolume(this.sfxVolume);
    }
    const slider = this.sliders.find((candidate) => candidate.kind === kind);
    if (slider) {
      slider.value = kind === "music" ? this.musicVolume : this.sfxVolume;
      this.refreshSlider(slider);
    }
    if (kind === "music") {
      if (this.semanticMusicRange) this.semanticMusicRange.value = `${Math.round(this.musicVolume * 100)}`;
    } else {
      if (this.semanticSfxRange) this.semanticSfxRange.value = `${Math.round(this.sfxVolume * 100)}`;
    }
  }

  private refreshSliders(): void {
    for (const slider of this.sliders) {
      slider.value = slider.kind === "music" ? this.musicVolume : this.sfxVolume;
      this.refreshSlider(slider);
    }
  }

  private refreshSlider(slider: TitleSlider): void {
    const value = Phaser.Math.Clamp(slider.value, 0, 1);
    slider.fill
      .setPosition(slider.x, slider.track.y)
      .setDisplaySize(Math.max(1, slider.width * value), 6);
    slider.knob.setPosition(slider.x + slider.width * value, slider.track.y);
    slider.label.setText(`${slider.kind === "music" ? "Music" : "Sound effects"}  ${Math.round(value * 100)}%`);
    const semantic = slider.kind === "music" ? this.semanticMusicRange : this.semanticSfxRange;
    if (semantic) semantic.value = `${Math.round(value * 100)}`;
  }

  private ensureAudioUnlocked(): void {
    this.audio.unlock();
    this.tryStartMusic();
  }

  private queueMenuMusic(): void {
    if (this.cache.audio.exists("eco-music")) {
      this.createMenuMusic();
      return;
    }
    this.load.audio("eco-music", "/assets/music/lucid-field-theme.wav");
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.sys.isActive()) this.createMenuMusic();
    });
    this.load.start();
  }

  private createMenuMusic(): void {
    if (this.music) return;
    this.music = this.sound.add("eco-music", {
      loop: true,
      volume: this.musicVolume,
    });
    this.tryStartMusic();
  }

  private tryStartMusic(): void {
    if (!this.music || this.music.isPlaying || this.musicVolume <= 0) return;
    this.sound.setVolume(this.musicVolume);
    this.music.play();
  }

  private layout(width: number, height: number): void {
    const titleLayout = getEcosystemTitleLayout(width, height, this.buttons.length);
    const mobile = titleLayout.phone;
    const portrait = height > width * 1.08;
    const backgroundKey = portrait ? TITLE_BACKGROUND_PORTRAIT : TITLE_BACKGROUND_LANDSCAPE;
    if (this.background.texture.key !== backgroundKey) this.background.setTexture(backgroundKey);
    const coverScale = Math.max(width / this.background.width, height / this.background.height);
    this.backgroundBaseScale = coverScale * 1.045;
    this.backgroundBaseX = width / 2;
    this.backgroundBaseY = height / 2;
    this.background
      .setScale(this.backgroundBaseScale)
      .setPosition(this.backgroundBaseX, this.backgroundBaseY);
    this.layoutAtmosphere(width, height, portrait);

    this.shade.clear();
    this.shade
      .fillStyle(0x031009, portrait ? 0.3 : titleLayout.centered ? 0.25 : 0.22)
      .fillRect(0, 0, width, height);

    this.fitTextToWidth(
      this.titleTop,
      titleLayout.titleMaxWidth,
      titleLayout.titleTopFontSize,
      Math.max(28, titleLayout.titleTopFontSize - 18),
    );
    this.fitTextToWidth(
      this.titleBottom,
      titleLayout.titleMaxWidth * 0.82,
      titleLayout.titleBottomFontSize,
      Math.max(27, titleLayout.titleBottomFontSize - 16),
    );
    this.titleTop
      .setStroke("#06190f", mobile ? 4 : 5)
      .setPosition(titleLayout.titleX, titleLayout.titleTopY);
    this.titleBottom
      .setStroke("#06190f", mobile ? 4 : 5)
      .setPosition(titleLayout.titleX, titleLayout.titleBottomY);
    this.alphaLabel
      .setOrigin(0, 0.5)
      .setFontSize(titleLayout.alphaFontSize);
    this.chapterTitle
      .setOrigin(0, 0.5);
    this.fitTextToWidth(
      this.chapterTitle,
      titleLayout.titleMaxWidth - this.alphaLabel.width - 16,
      titleLayout.chapterFontSize,
      10,
    );
    const chapterGroupWidth = this.chapterTitle.width + 12 + this.alphaLabel.width;
    const chapterStartX = titleLayout.titleX - chapterGroupWidth / 2;
    this.chapterTitle.setPosition(chapterStartX, titleLayout.chapterY);
    this.alphaLabel.setPosition(
      chapterStartX + this.chapterTitle.width + 12,
      titleLayout.chapterY,
    );

    this.menuPanel
      .setPosition(titleLayout.panelX, titleLayout.panelY)
      .setSize(titleLayout.panelWidth, titleLayout.panelHeight);
    this.saveStateText.setFontSize(mobile ? 13 : 15);
    this.fitTextToWidth(
      this.saveStateText,
      titleLayout.panelWidth - 36,
      mobile ? 13 : 15,
      10,
    );
    this.saveStateText.setPosition(titleLayout.panelX, titleLayout.saveStateY);
    this.saveDetailText
      .setFontSize(mobile ? 10 : 11)
      .setPosition(titleLayout.panelX, titleLayout.saveDetailY);

    for (let index = 0; index < this.buttons.length; index += 1) {
      const button = this.buttons[index];
      const y = titleLayout.buttonFirstY + index * titleLayout.buttonStep;
      button.container.setPosition(titleLayout.panelX, y);
      button.back.setSize(titleLayout.buttonWidth, titleLayout.buttonHeight);
      button.hit.setSize(titleLayout.buttonWidth, titleLayout.buttonHeight);
      this.fitTextToWidth(
        button.label,
        titleLayout.buttonWidth - 28,
        titleLayout.buttonLabelFontSize,
        14,
      );
      button.label.setPosition(0, mobile ? -6 : -7);
      button.detail
        .setFontSize(titleLayout.buttonDetailFontSize)
        .setPosition(0, mobile ? 15 : 16);
    }
    this.selectorDisplaySize = titleLayout.selectorSize;
    this.layoutSelectors();
    this.buildLabel.setPosition(width - 12, height - 10);
    this.layoutModals(width, height, mobile);
    this.layoutSemanticControls();
  }

  private layoutAtmosphere(width: number, height: number, portrait: boolean): void {
    const budget = getTitleAtmosphereBudget(width, height);
    this.visibleCloudCount = budget.clouds;
    this.visibleBirdCount = budget.birds;
    this.visibleBeeCount = budget.bees;
    this.scourgeVeil
      .setPosition(width / 2, 0)
      .setDisplaySize(width, Math.max(280, height * (portrait ? 0.58 : 0.62)));

    for (let index = 0; index < this.scourgeClouds.length; index += 1) {
      const cloud = this.scourgeClouds[index];
      const cloudWidth = Math.max(320, width * (portrait ? 0.82 : 0.5) * (0.88 + index * 0.075));
      cloud
        .setVisible(index < this.visibleCloudCount)
        .setDisplaySize(cloudWidth, cloudWidth * (220 / 560));
    }

    const sceneScale = Phaser.Math.Clamp(Math.min(width / 1280, height / 720), 0.68, 1.2);
    for (let index = 0; index < this.birds.length; index += 1) {
      this.birds[index]
        .setVisible(index < this.visibleBirdCount)
        .setScale(sceneScale * (0.72 + index * 0.06));
    }
    for (let index = 0; index < this.bees.length; index += 1) {
      this.bees[index]
        .setVisible(index < this.visibleBeeCount)
        .setScale(sceneScale * (1.18 + index * 0.09));
    }
  }

  private layoutSelectors(): void {
    if (this.modalOpen || this.buttons.length === 0) {
      this.selectorLeft.setVisible(false);
      this.selectorRight.setVisible(false);
      return;
    }
    const button = this.buttons[this.selectedButtonIndex];
    const selectorOffset = button.back.displayWidth / 2 + 25;
    this.selectorLeft
      .setVisible(true)
      .setDisplaySize(this.selectorDisplaySize, this.selectorDisplaySize)
      .setPosition(button.container.x - selectorOffset, button.container.y);
    this.selectorRight
      .setVisible(true)
      .setDisplaySize(this.selectorDisplaySize, this.selectorDisplaySize)
      .setPosition(button.container.x + selectorOffset, button.container.y);
  }

  private syncSemanticVisibility(): void {
    for (const button of this.semanticMenuButtons.values()) {
      button.hidden = this.modalOpen || this.transitioning;
    }
    const optionsVisible = this.modalOpen && this.optionsRoot.visible;
    if (this.semanticMusicRange) this.semanticMusicRange.hidden = !optionsVisible;
    if (this.semanticSfxRange) this.semanticSfxRange.hidden = !optionsVisible;
    if (this.semanticOptionsBack) this.semanticOptionsBack.hidden = !optionsVisible;
    const creditsVisible = this.modalOpen && this.creditsRoot.visible;
    if (this.semanticCreditsCopy) this.semanticCreditsCopy.hidden = !creditsVisible;
    if (this.semanticCreditsBack) this.semanticCreditsBack.hidden = !creditsVisible;
  }

  private layoutSemanticControls(): void {
    for (const button of this.buttons) {
      const semantic = this.semanticMenuButtons.get(button.id);
      if (!semantic) continue;
      this.setSemanticBounds(
        semantic,
        button.container.x - button.back.displayWidth / 2,
        button.container.y - button.back.displayHeight / 2,
        button.back.displayWidth,
        button.back.displayHeight,
      );
    }
    for (const slider of this.sliders) {
      const semantic = slider.kind === "music" ? this.semanticMusicRange : this.semanticSfxRange;
      if (!semantic) continue;
      this.setSemanticBounds(semantic, slider.x - 15, slider.track.y - 21, slider.width + 30, 42);
    }
    this.setSemanticButtonBounds(this.semanticOptionsBack, this.optionsBackButton);
    this.setSemanticButtonBounds(this.semanticCreditsBack, this.creditsBackButton);
    this.syncSemanticVisibility();
  }

  private setSemanticButtonBounds(
    element: HTMLElement | undefined,
    button: TitleMenuButton,
  ): void {
    if (!element) return;
    this.setSemanticBounds(
      element,
      button.container.x - button.back.displayWidth / 2,
      button.container.y - button.back.displayHeight / 2,
      button.back.displayWidth,
      button.back.displayHeight,
    );
  }

  private setSemanticBounds(
    element: HTMLElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    element.style.left = `${Math.round(x)}px`;
    element.style.top = `${Math.round(y)}px`;
    element.style.width = `${Math.max(1, Math.round(width))}px`;
    element.style.height = `${Math.max(1, Math.round(height))}px`;
  }

  private layoutModals(width: number, height: number, mobile: boolean): void {
    for (const root of [this.optionsRoot, this.creditsRoot]) {
      const backdrop = root.list.find((item) => item.getData("layoutBackdrop")) as Phaser.GameObjects.Rectangle | undefined;
      backdrop?.setSize(width, height);
    }

    const optionsWidth = Math.min(mobile ? width - 24 : 520, width - 16);
    const optionsHeight = mobile ? 390 : 390;
    const optionsX = width / 2;
    const optionsY = height / 2;
    this.optionsPanel.setPosition(optionsX, optionsY).setSize(optionsWidth, optionsHeight);
    this.optionsTitle.setPosition(optionsX, optionsY - optionsHeight / 2 + 48);
    for (let index = 0; index < this.sliders.length; index += 1) {
      const slider = this.sliders[index];
      const sliderWidth = Math.min(330, optionsWidth - 80);
      const y = optionsY - 70 + index * 100;
      slider.x = optionsX - sliderWidth / 2;
      slider.width = sliderWidth;
      slider.label.setPosition(optionsX, y - 28);
      slider.track.setPosition(slider.x, y).setSize(sliderWidth, 10);
      slider.hit.setPosition(optionsX, y).setSize(sliderWidth + 30, 42);
    }
    this.optionsBackButton.container.setPosition(optionsX, optionsY + optionsHeight / 2 - 58);
    this.optionsBackButton.back.setSize(230, 48);
    this.optionsBackButton.hit.setSize(230, 48);
    this.refreshSliders();

    const creditsWidth = Math.min(mobile ? width - 20 : 700, width - 16);
    const creditsHeight = Math.min(mobile ? 590 : 500, height - (mobile ? 20 : 24));
    const creditsX = width / 2;
    const creditsY = height / 2;
    const creditsTop = creditsY - creditsHeight / 2;
    const creditsBottom = creditsY + creditsHeight / 2;
    const compactCredits = creditsHeight < 450;
    this.creditsPanel.setPosition(creditsX, creditsY).setSize(creditsWidth, creditsHeight);
    this.creditsTitle
      .setFontSize(compactCredits ? 24 : 32)
      .setPosition(creditsX, creditsTop + (compactCredits ? 28 : 40));
    this.creditsDeveloper
      .setFontSize(compactCredits ? 9 : mobile ? 11 : 13)
      .setWordWrapWidth(creditsWidth - 48)
      .setPosition(creditsX, creditsTop + (compactCredits ? 51 : 72));

    const sectionTitleSize = compactCredits ? 11 : mobile ? 13 : 16;
    const nameSize = compactCredits ? 10 : mobile ? 12 : 15;
    const titleY = creditsTop + (compactCredits ? 100 : mobile ? 126 : 140);
    if (mobile) {
      this.creditsPlaytesterTitle.setFontSize(sectionTitleSize).setPosition(creditsX, titleY);
      this.creditsPlaytesterNames
        .setFontSize(nameSize)
        .setLineSpacing(compactCredits ? 0 : 1)
        .setWordWrapWidth(creditsWidth - 42)
        .setPosition(creditsX, titleY + (compactCredits ? 17 : 22));
      const grassTitleY = this.creditsPlaytesterNames.y + this.creditsPlaytesterNames.height + (compactCredits ? 7 : 12);
      this.creditsGrassToucherTitle.setFontSize(sectionTitleSize).setPosition(creditsX, grassTitleY);
      this.creditsGrassToucherNames
        .setFontSize(nameSize)
        .setLineSpacing(compactCredits ? 0 : 1)
        .setWordWrapWidth(creditsWidth - 42)
        .setPosition(creditsX, grassTitleY + (compactCredits ? 17 : 22));
    } else {
      const columnOffset = Math.min(170, creditsWidth * 0.24);
      const columnWidth = Math.max(180, creditsWidth / 2 - 46);
      this.creditsPlaytesterTitle.setFontSize(sectionTitleSize).setPosition(creditsX - columnOffset, titleY);
      this.creditsGrassToucherTitle.setFontSize(sectionTitleSize).setPosition(creditsX + columnOffset, titleY);
      this.creditsPlaytesterNames
        .setFontSize(nameSize)
        .setLineSpacing(compactCredits ? 0 : 2)
        .setWordWrapWidth(columnWidth)
        .setPosition(creditsX - columnOffset, titleY + (compactCredits ? 18 : 26));
      this.creditsGrassToucherNames
        .setFontSize(nameSize)
        .setLineSpacing(compactCredits ? 0 : 2)
        .setWordWrapWidth(columnWidth)
        .setPosition(creditsX + columnOffset, titleY + (compactCredits ? 18 : 26));
    }

    this.creditsThanks
      .setFontSize(compactCredits ? 9 : mobile ? 10 : 12)
      .setWordWrapWidth(creditsWidth - 48)
      .setPosition(creditsX, creditsBottom - (compactCredits ? 70 : 92));
    const backHeight = compactCredits ? 38 : 46;
    this.creditsBackButton.container.setPosition(creditsX, creditsBottom - (compactCredits ? 28 : 42));
    this.creditsBackButton.back.setSize(Math.min(230, creditsWidth - 70), backHeight);
    this.creditsBackButton.hit.setSize(Math.min(230, creditsWidth - 70), backHeight);
  }

  private createText(
    text: string,
    fontSize: number,
    color: string,
    fontStyle = "normal",
  ): Phaser.GameObjects.Text {
    return this.add.text(0, 0, text, {
      fontFamily: "Georgia, Trebuchet MS, Arial, sans-serif",
      fontSize,
      color,
      fontStyle,
      stroke: "#06190f",
      strokeThickness: fontSize >= 20 ? 6 : 3,
      letterSpacing: 0,
    });
  }

  private fitTextToWidth(
    text: Phaser.GameObjects.Text,
    maxWidth: number,
    preferredSize: number,
    minSize: number,
  ): void {
    let size = preferredSize;
    text.setFontSize(size);
    while (text.width > maxWidth && size > minSize) {
      size -= 1;
      text.setFontSize(size);
    }
  }

  private shutdownScene(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.confirmTimer?.remove(false);
    this.music?.stop();
    this.semanticRoot?.remove();
    this.semanticRoot = undefined;
    this.semanticMenuButtons.clear();
  }
}
