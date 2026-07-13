import type Phaser from "phaser";
import { TileStage } from "./EcosystemCatalog";

export const ECOSYSTEM_HERO_TILE_SIZE = 256;

export const ECOSYSTEM_HERO_TILE_TEXTURE_KEYS: Record<TileStage, string> = {
  [TileStage.Dormant]: "eco-hero-tile-dormant",
  [TileStage.Dewy]: "eco-hero-tile-dewy",
  [TileStage.Moist]: "eco-hero-tile-moist",
  [TileStage.Sprouting]: "eco-hero-tile-sprouting",
  [TileStage.Verdant]: "eco-hero-tile-verdant",
  [TileStage.Flowering]: "eco-hero-tile-flowering",
  [TileStage.Pollinated]: "eco-hero-tile-pollinated",
  [TileStage.Rooted]: "eco-hero-tile-rooted",
};

interface HeroTilePalette {
  ground: string;
  groundDark: string;
  groundLight: string;
  bladeDark: string;
  bladeMid: string;
  bladeLight: string;
  accent: string;
}

interface HeroTileSpec {
  palette: HeroTilePalette;
  grassDensity: number;
  seed: number;
}

export const ECOSYSTEM_HERO_TILE_SPECS: Record<TileStage, HeroTileSpec> = {
  [TileStage.Dormant]: {
    palette: {
      ground: "#4a3822",
      groundDark: "#2c261b",
      groundLight: "#71552d",
      bladeDark: "#344525",
      bladeMid: "#657238",
      bladeLight: "#929753",
      accent: "#c1a96a",
    },
    grassDensity: 130,
    seed: 0x1138a1,
  },
  [TileStage.Dewy]: {
    palette: {
      ground: "#163e28",
      groundDark: "#0c251c",
      groundLight: "#286342",
      bladeDark: "#164d2c",
      bladeMid: "#29844a",
      bladeLight: "#62bb63",
      accent: "#8de7ff",
    },
    grassDensity: 620,
    seed: 0x2e77d2,
  },
  [TileStage.Moist]: {
    palette: {
      ground: "#174c2b",
      groundDark: "#0b2f21",
      groundLight: "#2f7040",
      bladeDark: "#185d31",
      bladeMid: "#2f9548",
      bladeLight: "#79ca69",
      accent: "#5ac8c8",
    },
    grassDensity: 780,
    seed: 0x3ca04f,
  },
  [TileStage.Sprouting]: {
    palette: {
      ground: "#194a25",
      groundDark: "#0d2c1c",
      groundLight: "#2c6b35",
      bladeDark: "#155a27",
      bladeMid: "#26953d",
      bladeLight: "#82d65d",
      accent: "#b5e66e",
    },
    grassDensity: 720,
    seed: 0x4bc10e,
  },
  [TileStage.Verdant]: {
    palette: {
      ground: "#134322",
      groundDark: "#082a18",
      groundLight: "#246b31",
      bladeDark: "#0c5525",
      bladeMid: "#1d8d37",
      bladeLight: "#72c956",
      accent: "#d8d76a",
    },
    grassDensity: 1_120,
    seed: 0x5ade91,
  },
  [TileStage.Flowering]: {
    palette: {
      ground: "#174a27",
      groundDark: "#0a2c1b",
      groundLight: "#2a7039",
      bladeDark: "#105629",
      bladeMid: "#258f3e",
      bladeLight: "#76cf60",
      accent: "#f3a0ca",
    },
    grassDensity: 960,
    seed: 0x6f10ae,
  },
  [TileStage.Pollinated]: {
    palette: {
      ground: "#234b25",
      groundDark: "#102c1a",
      groundLight: "#426f34",
      bladeDark: "#245628",
      bladeMid: "#57913a",
      bladeLight: "#a0c858",
      accent: "#f2cf62",
    },
    grassDensity: 900,
    seed: 0x7b7d22,
  },
  [TileStage.Rooted]: {
    palette: {
      ground: "#173d2b",
      groundDark: "#09251d",
      groundLight: "#315d3c",
      bladeDark: "#17482c",
      bladeMid: "#3c7650",
      bladeLight: "#72aa69",
      accent: "#c89558",
    },
    grassDensity: 680,
    seed: 0x8d244c,
  },
};

type Random = () => number;

function createRandom(seed: number): Random {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function evenPixel(random: Random, limit = ECOSYSTEM_HERO_TILE_SIZE): number {
  return Math.floor((random() * limit) / 2) * 2;
}

function drawGround(ctx: CanvasRenderingContext2D, spec: HeroTileSpec, random: Random): void {
  const { palette } = spec;
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, 0, ECOSYSTEM_HERO_TILE_SIZE, ECOSYSTEM_HERO_TILE_SIZE);

  for (let index = 0; index < 74; index += 1) {
    const x = evenPixel(random);
    const y = evenPixel(random);
    const width = 10 + evenPixel(random, 34);
    const height = 8 + evenPixel(random, 28);
    ctx.globalAlpha = 0.15 + random() * 0.2;
    ctx.fillStyle = random() > 0.48 ? palette.groundLight : palette.groundDark;
    ctx.fillRect(x, y, width, height);
  }

  ctx.globalAlpha = 1;
  for (let index = 0; index < 620; index += 1) {
    ctx.fillStyle = random() > 0.54 ? palette.groundLight : palette.groundDark;
    ctx.globalAlpha = 0.22 + random() * 0.26;
    const size = random() > 0.86 ? 4 : 2;
    ctx.fillRect(evenPixel(random), evenPixel(random), size, size);
  }
  ctx.globalAlpha = 1;
}

function drawGrassBlade(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, random: Random): void {
  const height = 4 + Math.floor(random() * 4) * 2;
  const leanRoll = random();
  const lean = leanRoll > 0.66 ? 2 : leanRoll < 0.33 ? -2 : 0;
  ctx.fillStyle = color;
  for (let offsetY = 0; offsetY < height; offsetY += 2) {
    const upperLean = offsetY >= height / 2 ? lean : 0;
    ctx.fillRect(x + upperLean, y - offsetY - 2, 2, 2);
  }
  if (random() > 0.48) ctx.fillRect(x - (lean || 2), y - 4, 4, 2);
}

function drawGrass(ctx: CanvasRenderingContext2D, spec: HeroTileSpec, random: Random): void {
  const colors = [spec.palette.bladeDark, spec.palette.bladeMid, spec.palette.bladeLight];
  const groundCover = Math.max(260, Math.floor(spec.grassDensity * 1.8));
  ctx.globalAlpha = 0.72;
  for (let index = 0; index < groundCover; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 4) + 2;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 4) + 2;
    const colorIndex = random() > 0.88 ? 2 : random() > 0.42 ? 1 : 0;
    ctx.fillStyle = colors[colorIndex];
    ctx.fillRect(x, y, random() > 0.7 ? 4 : 2, 2);
    if (random() > 0.84) ctx.fillRect(x + (random() > 0.5 ? 2 : -2), y + 2, 2, 2);
  }
  ctx.globalAlpha = 1;
  for (let index = 0; index < spec.grassDensity; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 4) + 2;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 8) + 8;
    const colorIndex = random() > 0.82 ? 2 : random() > 0.36 ? 1 : 0;
    drawGrassBlade(ctx, x, y, colors[colorIndex], random);
    if (random() > 0.78) {
      const companionColor = colors[random() > 0.76 ? 2 : 1];
      drawGrassBlade(ctx, x + (random() > 0.5 ? 4 : -4), y + 2, companionColor, random);
    }
  }
}

function drawDew(ctx: CanvasRenderingContext2D, random: Random, amount: number): void {
  for (let index = 0; index < amount; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 8) + 4;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 8) + 4;
    ctx.fillStyle = index % 3 === 0 ? "#d9fbff" : "#7edce9";
    ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = "#efffff";
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = "#267b85";
    ctx.fillRect(x + 4, y + 4, 2, 2);
  }
}

function drawClover(ctx: CanvasRenderingContext2D, random: Random, amount: number): void {
  for (let index = 0; index < amount; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 16) + 8;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 16) + 8;
    const color = index % 4 === 0 ? "#82d65d" : index % 3 === 0 ? "#52b94d" : "#319342";
    ctx.fillStyle = "#155a2a";
    ctx.fillRect(x, y, 2, 8);
    ctx.fillStyle = color;
    ctx.fillRect(x - 6, y - 6, 6, 6);
    ctx.fillRect(x + 2, y - 6, 6, 6);
    ctx.fillRect(x - 2, y - 12, 6, 6);
    if (random() > 0.72) ctx.fillRect(x - 2, y + 2, 6, 6);
    ctx.fillStyle = "#b9e477";
    ctx.fillRect(x, y - 6, 2, 2);
  }
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, petal: string, center: string): void {
  ctx.fillStyle = "#1e7533";
  ctx.fillRect(x, y + 4, 2, 8);
  ctx.fillStyle = petal;
  ctx.fillRect(x - 4, y, 4, 4);
  ctx.fillRect(x + 4, y, 4, 4);
  ctx.fillRect(x, y - 4, 4, 4);
  ctx.fillRect(x, y + 4, 4, 4);
  ctx.fillStyle = center;
  ctx.fillRect(x, y, 4, 4);
  ctx.fillStyle = "#fff6d0";
  ctx.fillRect(x, y, 2, 2);
}

function drawFlowers(ctx: CanvasRenderingContext2D, random: Random, amount: number, pollinated: boolean): void {
  const petals = pollinated
    ? ["#f0c85b", "#fff1b0", "#e89977", "#d5e675"]
    : ["#f18fbd", "#f6d9eb", "#fff4c7", "#e7669b", "#8de7ff"];
  for (let index = 0; index < amount; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 20) + 8;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 24) + 8;
    drawFlower(ctx, x, y, petals[Math.floor(random() * petals.length)], pollinated ? "#9d6b27" : "#f0c85b");
  }
}

function drawDormantDetails(ctx: CanvasRenderingContext2D, random: Random): void {
  for (let index = 0; index < 34; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 10) + 4;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 12) + 6;
    ctx.fillStyle = index % 3 === 0 ? "#9f8854" : "#746442";
    ctx.fillRect(x, y, 2, 10);
    ctx.fillRect(x + (index % 2 === 0 ? 2 : -2), y, 4, 2);
  }
  for (let index = 0; index < 20; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 14) + 6;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 10) + 4;
    ctx.fillStyle = "#2c261b";
    ctx.fillRect(x, y, 8, 2);
    ctx.fillRect(x + 6, y + 2, 2, 4);
  }
}

function drawWetPatches(ctx: CanvasRenderingContext2D, random: Random): void {
  for (let index = 0; index < 18; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 30) + 6;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 20) + 6;
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#0a3330";
    ctx.fillRect(x, y, 20 + evenPixel(random, 14), 8 + evenPixel(random, 10));
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = "#4e9f8b";
    ctx.fillRect(x + 4, y + 2, 8, 2);
  }
  ctx.globalAlpha = 1;
}

function drawPollen(ctx: CanvasRenderingContext2D, random: Random): void {
  for (let index = 0; index < 86; index += 1) {
    const x = evenPixel(random);
    const y = evenPixel(random);
    ctx.fillStyle = index % 5 === 0 ? "#fff1a0" : "#e5b845";
    ctx.fillRect(x, y, index % 4 === 0 ? 4 : 2, index % 4 === 0 ? 4 : 2);
  }
}

function drawRootedDetails(ctx: CanvasRenderingContext2D, random: Random): void {
  ctx.strokeStyle = "#9a7545";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.72;
  for (let index = 0; index < 11; index += 1) {
    const startX = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 24) + 12;
    const startY = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 24) + 12;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + (random() > 0.5 ? 12 : -12), startY + 10);
    ctx.lineTo(startX + (random() > 0.5 ? 22 : -22), startY + 24);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let index = 0; index < 18; index += 1) {
    const x = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 12) + 6;
    const y = evenPixel(random, ECOSYSTEM_HERO_TILE_SIZE - 12) + 6;
    ctx.fillStyle = index % 3 === 0 ? "#d8b66a" : "#b67253";
    ctx.fillRect(x - 4, y, 10, 4);
    ctx.fillRect(x - 2, y - 2, 6, 2);
    ctx.fillStyle = "#f3e4bd";
    ctx.fillRect(x, y + 4, 2, 6);
  }
}

function drawEdgeDepth(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, ECOSYSTEM_HERO_TILE_SIZE);
  gradient.addColorStop(0, "rgba(255,255,220,0.08)");
  gradient.addColorStop(0.58, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,18,10,0.24)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ECOSYSTEM_HERO_TILE_SIZE, ECOSYSTEM_HERO_TILE_SIZE);
  ctx.strokeStyle = "rgba(5,24,14,0.46)";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, ECOSYSTEM_HERO_TILE_SIZE - 6, ECOSYSTEM_HERO_TILE_SIZE - 6);
}

function drawStageDetails(ctx: CanvasRenderingContext2D, stage: TileStage, random: Random): void {
  if (stage === TileStage.Dormant) {
    drawDormantDetails(ctx, random);
    return;
  }
  if (stage === TileStage.Dewy) {
    drawDew(ctx, random, 48);
    return;
  }
  if (stage === TileStage.Moist) {
    drawWetPatches(ctx, random);
    drawDew(ctx, random, 24);
    return;
  }
  if (stage === TileStage.Sprouting) {
    drawClover(ctx, random, 72);
    return;
  }
  if (stage === TileStage.Verdant) {
    drawClover(ctx, random, 18);
    return;
  }
  if (stage === TileStage.Flowering) {
    drawFlowers(ctx, random, 48, false);
    drawDew(ctx, random, 14);
    return;
  }
  if (stage === TileStage.Pollinated) {
    drawFlowers(ctx, random, 42, true);
    drawPollen(ctx, random);
    return;
  }
  drawRootedDetails(ctx, random);
  drawDew(ctx, random, 12);
}

export function createEcosystemHeroTileTextures(scene: Phaser.Scene): void {
  for (let stage = TileStage.Dormant; stage <= TileStage.Rooted; stage += 1) {
    const typedStage = stage as TileStage;
    const key = ECOSYSTEM_HERO_TILE_TEXTURE_KEYS[typedStage];
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, ECOSYSTEM_HERO_TILE_SIZE, ECOSYSTEM_HERO_TILE_SIZE);
    if (!texture) continue;
    const ctx = texture.context;
    ctx.imageSmoothingEnabled = false;
    const spec = ECOSYSTEM_HERO_TILE_SPECS[typedStage];
    const random = createRandom(spec.seed);
    drawGround(ctx, spec, random);
    drawGrass(ctx, spec, random);
    drawStageDetails(ctx, typedStage, random);
    drawEdgeDepth(ctx);
    texture.refresh();
  }
}
