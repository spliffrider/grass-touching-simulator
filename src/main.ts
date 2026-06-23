import Phaser from "phaser";
import { GameScene } from "./game/scenes/GameScene";
import { TitleScene } from "./game/scenes/TitleScene";
import "./style.css";

interface ViewportSize {
  width: number;
  height: number;
}

function readPositiveSize(...values: Array<number | undefined>): number {
  const value = values.find((candidate) => Number.isFinite(candidate) && candidate !== undefined && candidate > 0);
  return Math.max(1, Math.round(value ?? 1));
}

function getViewportSize() {
  const root = document.documentElement;
  const visualViewport = window.visualViewport;

  return {
    width: readPositiveSize(visualViewport?.width, window.innerWidth, root.clientWidth),
    height: readPositiveSize(visualViewport?.height, window.innerHeight, root.clientHeight),
  };
}

const initialViewport = getViewportSize();

function syncViewportCss(viewport: ViewportSize): void {
  document.documentElement.style.setProperty("--app-width", `${viewport.width}px`);
  document.documentElement.style.setProperty("--app-height", `${viewport.height}px`);
}

syncViewportCss(initialViewport);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#9edc7c",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: initialViewport.width,
    height: initialViewport.height,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scene: [TitleScene, GameScene],
};

const game = new Phaser.Game(config);
let lastViewport = initialViewport;
let resizeQueued = false;

function resizeGame(force = false): void {
  const viewport = getViewportSize();
  syncViewportCss(viewport);

  if (!force && viewport.width === lastViewport.width && viewport.height === lastViewport.height) {
    return;
  }

  const gameElement = document.getElementById("game");
  if (gameElement) {
    gameElement.style.width = `${viewport.width}px`;
    gameElement.style.height = `${viewport.height}px`;
  }

  game.scale.setParentSize(viewport.width, viewport.height);

  if (game.canvas) {
    game.canvas.style.width = `${viewport.width}px`;
    game.canvas.style.height = `${viewport.height}px`;
  }

  lastViewport = viewport;
}

function queueResizeGame(): void {
  if (resizeQueued) {
    return;
  }

  resizeQueued = true;
  window.requestAnimationFrame(() => {
    resizeQueued = false;
    resizeGame();
  });
}

window.addEventListener("resize", queueResizeGame);
window.visualViewport?.addEventListener("resize", queueResizeGame);
window.visualViewport?.addEventListener("scroll", queueResizeGame);
window.addEventListener("orientationchange", () => {
  resizeGame(true);
  for (const delayMs of [80, 180, 360, 720, 1200]) {
    window.setTimeout(() => resizeGame(true), delayMs);
  }
});

window.setInterval(() => {
  const viewport = getViewportSize();
  if (viewport.width !== lastViewport.width || viewport.height !== lastViewport.height) {
    resizeGame();
  }
}, 250);
