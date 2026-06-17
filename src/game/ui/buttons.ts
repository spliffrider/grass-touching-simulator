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
    .rectangle(width / 2, height / 2, width + 10, height + 10, 0xffef78, 0.12)
    .setOrigin(0.5)
    .setStrokeStyle(3, 0xffef78, 0.9)
    .setVisible(false);
  const hasEmeraldButtons =
    scene.textures.exists("button-emerald-normal") &&
    scene.textures.exists("button-emerald-hover") &&
    scene.textures.exists("button-emerald-active");
  const bg: TextButtonBg = hasEmeraldButtons
    ? scene.add.nineslice(0, 0, "button-emerald-normal", undefined, width, height, 14, 14, 12, 12).setOrigin(0, 0)
    : scene.add
        .rectangle(0, 0, width, height, 0xf4ffdc, 0.96)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0x2d6f36);
  const label = scene.add
    .text(width / 2, height / 2, text, {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: height < 40 ? "14px" : "18px",
      color: "#f7ffe8",
      stroke: "#0a2414",
      strokeThickness: height < 40 ? 3 : 4,
    })
    .setOrigin(0.5)
    .setShadow(0, 2, "#06190f", 2, false, true);

  attentionGlow.setData("attentionActive", false);
  bg.setInteractive({ useHandCursor: true });
  bg.on("pointerover", () => {
    if (button.getData("enabled") === false) {
      return;
    }
    setButtonTexture(bg, "button-emerald-hover");
    label.setColor("#fff3a8");
    label.setScale(1.03);
  });
  bg.on("pointerout", () => {
    const enabled = button.getData("enabled") !== false;
    setButtonTexture(bg, "button-emerald-normal");
    label.setColor(enabled ? "#f7ffe8" : "#9ba992");
    label.setScale(1);
    label.setY(height / 2);
  });
  bg.on("pointerdown", () => {
    if (button.getData("enabled") === false) {
      return;
    }
    setButtonTexture(bg, "button-emerald-active");
    label.setY(height / 2 + 1);
    label.setScale(0.98);
    onClick();
  });
  bg.on("pointerup", () => {
    const enabled = button.getData("enabled") !== false;
    setButtonTexture(bg, enabled ? "button-emerald-hover" : "button-emerald-normal");
    label.setColor(enabled ? "#fff3a8" : "#9ba992");
    label.setY(height / 2);
    label.setScale(enabled ? 1.03 : 1);
  });
  button.add([attentionGlow, bg, label]);
  button.setData("bg", bg);
  button.setData("label", label);
  button.setData("attentionGlow", attentionGlow);
  button.setData("enabled", true);
  return button;
}

export function setTextButtonText(button: Phaser.GameObjects.Container, text: string): void {
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;
  if (label && label.text !== text) {
    label.setText(text);
  }
}

export function setTextButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
  const bg = button.getData("bg") as TextButtonBg | undefined;
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;

  button.setData("enabled", enabled);
  setButtonTexture(bg, "button-emerald-normal");

  if (bg instanceof Phaser.GameObjects.Rectangle) {
    bg.setFillStyle(enabled ? 0xf4ffdc : 0xb9c8ab, enabled ? 0.96 : 0.74);
    bg.setStrokeStyle(3, enabled ? 0x2d6f36 : 0x63715d);
  }

  bg?.setAlpha(enabled ? 1 : 0.58);
  label?.setColor(enabled ? "#f7ffe8" : "#9ba992");
  label?.setAlpha(enabled ? 1 : 0.82);
}

export function setTextButtonAttention(button: Phaser.GameObjects.Container, active: boolean): void {
  const glow = button.getData("attentionGlow") as Phaser.GameObjects.Rectangle | undefined;
  const bg = button.getData("bg") as TextButtonBg | undefined;
  if (!glow || glow.getData("attentionActive") === active) {
    return;
  }

  glow.setData("attentionActive", active);
  button.scene.tweens.killTweensOf(glow);
  glow.setVisible(active);

  if (!active) {
    glow.setAlpha(1);
    glow.setScale(1);
    if (bg instanceof Phaser.GameObjects.Rectangle) {
      bg.setStrokeStyle(3, 0x2d6f36);
    }
    return;
  }

  if (bg instanceof Phaser.GameObjects.Rectangle) {
    bg.setStrokeStyle(3, 0xffef78, 0.98);
  }

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

function setButtonTexture(bg: TextButtonBg | undefined, texture: string): void {
  if (!bg || bg instanceof Phaser.GameObjects.Rectangle || !bg.scene.textures.exists(texture)) {
    return;
  }

  bg.setTexture(texture);
}
