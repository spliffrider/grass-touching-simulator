export function createTextButton(
  scene: Phaser.Scene,
  text: string,
  onClick: () => void,
  width: number,
  height: number,
  depth: number,
): Phaser.GameObjects.Container {
  const button = scene.add.container(0, 0).setDepth(depth);
  const bg = scene.add
    .rectangle(0, 0, width, height, 0xf4ffdc, 0.96)
    .setOrigin(0, 0)
    .setStrokeStyle(3, 0x2d6f36)
    .setInteractive({ useHandCursor: true });
  const label = scene.add
    .text(width / 2, height / 2, text, {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: height < 40 ? "14px" : "18px",
      color: "#183d20",
    })
    .setOrigin(0.5);

  bg.on("pointerdown", onClick);
  button.add([bg, label]);
  button.setData("bg", bg);
  button.setData("label", label);
  return button;
}

export function setTextButtonText(button: Phaser.GameObjects.Container, text: string): void {
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;
  label?.setText(text);
}

export function setTextButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
  const bg = button.getData("bg") as Phaser.GameObjects.Rectangle | undefined;
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;

  bg?.setFillStyle(enabled ? 0xf4ffdc : 0xb9c8ab, enabled ? 0.96 : 0.74);
  bg?.setStrokeStyle(3, enabled ? 0x2d6f36 : 0x63715d);
  label?.setColor(enabled ? "#183d20" : "#53604f");
}
