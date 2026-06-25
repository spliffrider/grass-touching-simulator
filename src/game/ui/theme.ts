import Phaser from "phaser";

export const UITheme = {
  colors: {
    panelBg: 0x102716,
    panelBgDeep: 0x06190f,
    panelInset: 0x17351f,
    bronze: 0xa9683f,
    bronzeDark: 0x5b3926,
    bronzeLight: 0xe0a36c,
    cream: "#f2e8d5",
    creamBright: "#fff3c2",
    mutedGreen: "#b8d9a4",
    shadow: 0x020805,
    glow: 0xf3c16f,
  },
  text: {
    fontFamily: "Trebuchet MS, Arial",
    stroke: "#06190f",
  },
} as const;

interface OrnateFrameOptions {
  x?: number;
  y?: number;
  depth?: number;
  fillColor?: number;
  fillAlpha?: number;
  insetColor?: number;
  insetAlpha?: number;
  accentColor?: number;
  accentAlpha?: number;
  glowColor?: number;
  glowAlpha?: number;
  shadowAlpha?: number;
  trim?: number;
  cornerSize?: number;
}

export interface OrnateFrame {
  shadow: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  inset: Phaser.GameObjects.Rectangle;
  topTrim: Phaser.GameObjects.Rectangle;
  bottomTrim: Phaser.GameObjects.Rectangle;
  leftTrim: Phaser.GameObjects.Rectangle;
  rightTrim: Phaser.GameObjects.Rectangle;
  corners: Phaser.GameObjects.Graphics;
  objects: Phaser.GameObjects.GameObject[];
  setPosition(x: number, y: number): void;
  setSize(width: number, height: number): void;
  setFill(color: number, alpha?: number): void;
  setAccent(color: number, alpha?: number): void;
  setVisible(visible: boolean): void;
}

export function createOrnateFrame(scene: Phaser.Scene, width: number, height: number, options: OrnateFrameOptions = {}): OrnateFrame {
  let frameX = options.x ?? 0;
  let frameY = options.y ?? 0;
  let frameWidth = width;
  let frameHeight = height;
  let fillColor = options.fillColor ?? UITheme.colors.panelBg;
  let fillAlpha = options.fillAlpha ?? 0.94;
  let accentColor = options.accentColor ?? UITheme.colors.bronze;
  let accentAlpha = options.accentAlpha ?? 0.9;
  const trim = options.trim ?? 3;
  const cornerSize = options.cornerSize ?? 18;
  const depth = options.depth;

  const shadow = scene.add.rectangle(0, 0, width, height, UITheme.colors.shadow, options.shadowAlpha ?? 0.48).setOrigin(0, 0);
  const glow = scene.add
    .rectangle(0, 0, width + 8, height + 8, options.glowColor ?? UITheme.colors.glow, options.glowAlpha ?? 0.1)
    .setOrigin(0, 0)
    .setStrokeStyle(2, options.glowColor ?? UITheme.colors.glow, (options.glowAlpha ?? 0.1) * 2.8);
  const bg = scene.add
    .rectangle(0, 0, width, height, fillColor, fillAlpha)
    .setOrigin(0, 0)
    .setStrokeStyle(trim, accentColor, accentAlpha);
  const inset = scene.add
    .rectangle(0, 0, width - trim * 4, height - trim * 4, options.insetColor ?? UITheme.colors.panelInset, options.insetAlpha ?? 0.26)
    .setOrigin(0, 0)
    .setStrokeStyle(1, UITheme.colors.bronzeLight, 0.2);
  const topTrim = scene.add.rectangle(0, 0, width, trim, accentColor, accentAlpha).setOrigin(0, 0);
  const bottomTrim = scene.add.rectangle(0, 0, width, trim, UITheme.colors.bronzeDark, accentAlpha).setOrigin(0, 0);
  const leftTrim = scene.add.rectangle(0, 0, trim, height, UITheme.colors.bronzeDark, accentAlpha).setOrigin(0, 0);
  const rightTrim = scene.add.rectangle(0, 0, trim, height, accentColor, accentAlpha).setOrigin(0, 0);
  const corners = scene.add.graphics();
  const objects: Phaser.GameObjects.GameObject[] = [shadow, glow, bg, inset, topTrim, bottomTrim, leftTrim, rightTrim, corners];

  if (depth !== undefined) {
    for (const object of objects) {
      (object as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
    }
  }

  const redraw = (): void => {
    const safeWidth = Math.max(12, frameWidth);
    const safeHeight = Math.max(12, frameHeight);
    const insetPad = trim * 2;
    const detail = Math.min(cornerSize, safeWidth * 0.34, safeHeight * 0.46);

    shadow.setPosition(frameX + 4, frameY + 5).setSize(safeWidth, safeHeight);
    glow.setPosition(frameX - 4, frameY - 4).setSize(safeWidth + 8, safeHeight + 8);
    bg.setPosition(frameX, frameY).setSize(safeWidth, safeHeight).setFillStyle(fillColor, fillAlpha).setStrokeStyle(trim, accentColor, accentAlpha);
    inset
      .setPosition(frameX + insetPad, frameY + insetPad)
      .setSize(Math.max(4, safeWidth - insetPad * 2), Math.max(4, safeHeight - insetPad * 2));
    topTrim.setPosition(frameX + trim, frameY + trim).setSize(Math.max(4, safeWidth - trim * 2), trim);
    bottomTrim.setPosition(frameX + trim, frameY + safeHeight - trim * 2).setSize(Math.max(4, safeWidth - trim * 2), trim);
    leftTrim.setPosition(frameX + trim, frameY + trim).setSize(trim, Math.max(4, safeHeight - trim * 2));
    rightTrim.setPosition(frameX + safeWidth - trim * 2, frameY + trim).setSize(trim, Math.max(4, safeHeight - trim * 2));

    corners.clear();
    corners.lineStyle(Math.max(1, trim - 1), UITheme.colors.bronzeDark, accentAlpha);
    drawCorner(corners, frameX, frameY, detail, 1, 1);
    drawCorner(corners, frameX + safeWidth, frameY, detail, -1, 1);
    drawCorner(corners, frameX, frameY + safeHeight, detail, 1, -1);
    drawCorner(corners, frameX + safeWidth, frameY + safeHeight, detail, -1, -1);
    corners.lineStyle(Math.max(1, trim - 1), accentColor, accentAlpha);
    drawCorner(corners, frameX + 2, frameY + 2, detail * 0.82, 1, 1);
    drawCorner(corners, frameX + safeWidth - 2, frameY + 2, detail * 0.82, -1, 1);
    drawCorner(corners, frameX + 2, frameY + safeHeight - 2, detail * 0.82, 1, -1);
    drawCorner(corners, frameX + safeWidth - 2, frameY + safeHeight - 2, detail * 0.82, -1, -1);
    drawLeaves(corners, frameX, frameY, safeWidth, safeHeight, detail, accentColor, accentAlpha);
  };

  redraw();

  return {
    shadow,
    glow,
    bg,
    inset,
    topTrim,
    bottomTrim,
    leftTrim,
    rightTrim,
    corners,
    objects,
    setPosition(x: number, y: number): void {
      if (frameX === x && frameY === y) {
        return;
      }
      frameX = x;
      frameY = y;
      redraw();
    },
    setSize(nextWidth: number, nextHeight: number): void {
      if (frameWidth === nextWidth && frameHeight === nextHeight) {
        return;
      }
      frameWidth = nextWidth;
      frameHeight = nextHeight;
      redraw();
    },
    setFill(color: number, alpha = fillAlpha): void {
      if (fillColor === color && fillAlpha === alpha) {
        return;
      }
      fillColor = color;
      fillAlpha = alpha;
      redraw();
    },
    setAccent(color: number, alpha = accentAlpha): void {
      if (accentColor === color && accentAlpha === alpha) {
        return;
      }
      accentColor = color;
      accentAlpha = alpha;
      redraw();
    },
    setVisible(visible: boolean): void {
      for (const object of objects) {
        (object as unknown as Phaser.GameObjects.Components.Visible).setVisible(visible);
      }
    },
  };
}

function drawCorner(graphics: Phaser.GameObjects.Graphics, x: number, y: number, size: number, sx: 1 | -1, sy: 1 | -1): void {
  const short = size * 0.34;
  const long = size * 0.86;
  graphics.beginPath();
  graphics.moveTo(x + sx * short, y + sy * 3);
  graphics.lineTo(x + sx * long, y + sy * 3);
  graphics.lineTo(x + sx * long, y + sy * short);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(x + sx * 3, y + sy * short);
  graphics.lineTo(x + sx * 3, y + sy * long);
  graphics.lineTo(x + sx * short, y + sy * long);
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(x + sx * (size * 0.22), y + sy * (size * 0.72));
  graphics.lineTo(x + sx * (size * 0.36), y + sy * (size * 0.5));
  graphics.lineTo(x + sx * (size * 0.5), y + sy * (size * 0.34));
  graphics.lineTo(x + sx * (size * 0.68), y + sy * (size * 0.24));
  graphics.strokePath();
}

function drawLeaves(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color: number,
  alpha: number,
): void {
  const leafW = Math.max(3, size * 0.18);
  const leafH = Math.max(5, size * 0.28);
  graphics.fillStyle(color, alpha * 0.58);
  const points = [
    { x: x + size * 0.54, y: y + size * 0.34, angle: -36 },
    { x: x + width - size * 0.54, y: y + size * 0.34, angle: 36 },
    { x: x + size * 0.54, y: y + height - size * 0.34, angle: 36 },
    { x: x + width - size * 0.54, y: y + height - size * 0.34, angle: -36 },
  ];

  for (const point of points) {
    graphics.save();
    graphics.translateCanvas(point.x, point.y);
    graphics.rotateCanvas(Phaser.Math.DegToRad(point.angle));
    graphics.fillEllipse(0, 0, leafW, leafH);
    graphics.restore();
  }
}
