import { createOrnateFrame, type OrnateFrame, UITheme } from "./theme";

type TextButtonBg = Phaser.GameObjects.Rectangle | Phaser.GameObjects.NineSlice;

export function createTextButton(
  scene: Phaser.Scene,
  text: string,
  onClick: () => void,
  width: number,
  height: number,
  depth: number,
): Phaser.GameObjects.Container {
  const button = scene.add.container(0, 0).setDepth(depth);
  const attentionGlow = scene.add
    .rectangle(width / 2, height / 2, width + 12, height + 12, UITheme.colors.glow, 0.12)
    .setOrigin(0.5)
    .setStrokeStyle(3, UITheme.colors.glow, 0.9)
    .setVisible(false);
  const pressGlow = scene.add
    .rectangle(width / 2, height / 2, width - 8, height - 8, 0xffffff, 0.2)
    .setOrigin(0.5)
    .setVisible(false);
  const frame = createOrnateFrame(scene, width, height, {
    fillColor: UITheme.colors.panelBg,
    fillAlpha: 0.96,
    insetAlpha: 0.18,
    accentColor: UITheme.colors.bronze,
    accentAlpha: 0.92,
    glowAlpha: 0.07,
    shadowAlpha: 0.42,
    trim: height < 40 ? 2 : 3,
    cornerSize: height < 40 ? 14 : 18,
  });
  const bg: TextButtonBg = frame.bg;
  const label = scene.add
    .text(width / 2, height / 2, text, {
      fontFamily: UITheme.text.fontFamily,
      fontSize: height < 40 ? "14px" : "18px",
      color: UITheme.colors.cream,
      stroke: UITheme.text.stroke,
      strokeThickness: height < 40 ? 3 : 4,
    })
    .setOrigin(0.5)
    .setShadow(0, 2, "#020805", 2, false, true);

  attentionGlow.setData("attentionActive", false);
  bg.setInteractive({ useHandCursor: true });
  bg.on("pointerover", () => {
    if (button.getData("enabled") === false) {
      return;
    }
    frame.setFill(0x173a22, 0.98);
    frame.setAccent(UITheme.colors.bronzeLight, 0.98);
    label.setColor(UITheme.colors.creamBright);
    label.setScale(1.03);
  });
  bg.on("pointerout", () => {
    const enabled = button.getData("enabled") !== false;
    const attentive = attentionGlow.getData("attentionActive") === true;
    frame.setFill(UITheme.colors.panelBg, enabled ? 0.96 : 0.62);
    frame.setAccent(attentive ? UITheme.colors.glow : UITheme.colors.bronze, attentive ? 0.98 : 0.92);
    label.setColor(enabled ? (attentive ? UITheme.colors.creamBright : UITheme.colors.cream) : "#9b9b8a");
    label.setScale(1);
    label.setY(height / 2);
  });
  bg.on("pointerdown", () => {
    if (button.getData("enabled") === false) {
      return;
    }
    frame.setFill(0x0a2113, 1);
    frame.setAccent(UITheme.colors.glow, 1);
    playPressFlash(button, pressGlow);
    label.setY(height / 2 + 1);
    label.setScale(0.98);
    onClick();
  });
  bg.on("pointerup", () => {
    const enabled = button.getData("enabled") !== false;
    frame.setFill(enabled ? 0x173a22 : UITheme.colors.panelBg, enabled ? 0.98 : 0.62);
    frame.setAccent(enabled ? UITheme.colors.bronzeLight : UITheme.colors.bronzeDark, enabled ? 0.98 : 0.46);
    label.setColor(enabled ? UITheme.colors.creamBright : "#9b9b8a");
    label.setY(height / 2);
    label.setScale(enabled ? 1.03 : 1);
  });
  button.add([attentionGlow, ...frame.objects, pressGlow, label]);
  button.setData("frame", frame);
  button.setData("bg", bg);
  button.setData("label", label);
  button.setData("attentionGlow", attentionGlow);
  button.setData("pressGlow", pressGlow);
  button.setData("enabled", true);
  button.setData("baseWidth", width);
  button.setData("baseHeight", height);
  button.setData("baseFontSize", height < 40 ? 14 : 18);
  fitButtonLabel(button, label, text);
  return button;
}

export function setTextButtonText(button: Phaser.GameObjects.Container, text: string): void {
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;
  if (label && label.text !== text) {
    label.setText(text);
    fitButtonLabel(button, label, text);
  }
}

export function setTextButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
  const bg = button.getData("bg") as TextButtonBg | undefined;
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;
  const frame = button.getData("frame") as OrnateFrame | undefined;

  if (button.getData("enabled") === enabled) {
    return;
  }

  button.setData("enabled", enabled);
  frame?.setFill(UITheme.colors.panelBg, enabled ? 0.96 : 0.62);
  frame?.setAccent(enabled ? UITheme.colors.bronze : UITheme.colors.bronzeDark, enabled ? 0.92 : 0.5);

  if (bg instanceof Phaser.GameObjects.Rectangle) {
    bg.setFillStyle(enabled ? UITheme.colors.panelBg : UITheme.colors.panelBgDeep, enabled ? 0.96 : 0.62);
    bg.setStrokeStyle(3, enabled ? UITheme.colors.bronze : UITheme.colors.bronzeDark, enabled ? 0.92 : 0.5);
  }

  bg?.setAlpha(enabled ? 1 : 0.58);
  const glow = button.getData("attentionGlow") as Phaser.GameObjects.Rectangle | undefined;
  const attentive = glow?.getData("attentionActive") === true;
  label?.setColor(enabled ? (attentive ? UITheme.colors.creamBright : UITheme.colors.cream) : "#9b9b8a");
  label?.setAlpha(enabled ? 1 : 0.82);
}

export function setTextButtonAttention(button: Phaser.GameObjects.Container, active: boolean): void {
  const glow = button.getData("attentionGlow") as Phaser.GameObjects.Rectangle | undefined;
  const bg = button.getData("bg") as TextButtonBg | undefined;
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;
  const frame = button.getData("frame") as OrnateFrame | undefined;
  if (!glow || glow.getData("attentionActive") === active) {
    return;
  }

  glow.setData("attentionActive", active);
  button.scene.tweens.killTweensOf(glow);
  glow.setVisible(active);

  if (!active) {
    glow.setAlpha(1);
    glow.setScale(1);
    label?.setColor(button.getData("enabled") === false ? "#9b9b8a" : UITheme.colors.cream);
    frame?.setAccent(UITheme.colors.bronze, 0.92);
    if (bg instanceof Phaser.GameObjects.Rectangle) {
      bg.setStrokeStyle(3, UITheme.colors.bronze, 0.92);
    }
    return;
  }

  frame?.setAccent(UITheme.colors.glow, 0.98);
  if (bg instanceof Phaser.GameObjects.Rectangle) {
    bg.setStrokeStyle(3, UITheme.colors.glow, 0.98);
  }
  label?.setColor(UITheme.colors.creamBright);

  glow.setAlpha(0.72);
  glow.setScale(1);
  button.scene.tweens.add({
    targets: glow,
    alpha: 0.2,
    scaleX: 1.08,
    scaleY: 1.16,
    duration: 760,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

function fitButtonLabel(button: Phaser.GameObjects.Container, label: Phaser.GameObjects.Text, text: string): void {
  const width = Number(button.getData("baseWidth") ?? 118);
  const baseFontSize = Number(button.getData("baseFontSize") ?? 18);
  const compactForLength = text.length > 15 ? 4 : text.length > 11 ? 2 : 0;
  const compactForWidth = width < 110 && text.length > 8 ? 2 : 0;
  const fontSize = Math.max(10, baseFontSize - compactForLength - compactForWidth);
  label.setFontSize(fontSize);
  label.setWordWrapWidth(Math.max(40, width - 14));
}

function playPressFlash(button: Phaser.GameObjects.Container, pressGlow: Phaser.GameObjects.Rectangle): void {
  button.scene.tweens.killTweensOf(pressGlow);
  pressGlow.setVisible(true);
  pressGlow.setAlpha(0.28);
  pressGlow.setScale(0.92);
  button.scene.tweens.add({
    targets: pressGlow,
    alpha: 0,
    scaleX: 1.1,
    scaleY: 1.22,
    duration: 180,
    ease: "Sine.easeOut",
    onComplete: () => {
      pressGlow.setVisible(false);
      pressGlow.setScale(1);
    },
  });
}
