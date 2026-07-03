import Phaser from "phaser";
import { GameScene } from "./game/scenes/GameScene";
import { TitleScene } from "./game/scenes/TitleScene";
import "./style.css";

interface ViewportSize {
  width: number;
  height: number;
}

declare global {
  interface Window {
    __grassAppReady?: () => void;
  }
}

const RESIZE_THROTTLE_MS = 120;
const RESIZE_JITTER_PX = 2;

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
const bootStartedAt = performance.now();
document.documentElement.dataset.grassBootStarted = `${Math.round(bootStartedAt)}`;

let appReadyMarked = false;
window.__grassAppReady = () => {
  if (appReadyMarked) {
    return;
  }

  appReadyMarked = true;
  document.documentElement.dataset.grassBootReadyMs = `${Math.round(performance.now() - bootStartedAt)}`;
  document.documentElement.classList.add("grass-app-ready");
  window.setTimeout(() => document.getElementById("loading-shell")?.remove(), 260);
};

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
let resizeTimeoutHandle: number | undefined;
let lastResizeAppliedAt = 0;

function resizeGame(force = false): void {
  const viewport = getViewportSize();
  syncViewportCss(viewport);

  const widthDelta = Math.abs(viewport.width - lastViewport.width);
  const heightDelta = Math.abs(viewport.height - lastViewport.height);
  if (!force && widthDelta === 0 && heightDelta <= RESIZE_JITTER_PX) {
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
  lastResizeAppliedAt = performance.now();
}

function queueResizeGame(): void {
  if (resizeQueued) {
    return;
  }

  resizeQueued = true;
  const delayMs = Math.max(0, RESIZE_THROTTLE_MS - (performance.now() - lastResizeAppliedAt));
  const runResize = () => {
    resizeTimeoutHandle = undefined;
    window.requestAnimationFrame(() => {
      resizeQueued = false;
      resizeGame();
    });
  };

  if (delayMs > 0) {
    resizeTimeoutHandle = window.setTimeout(runResize, delayMs);
    return;
  }

  runResize();
}

window.addEventListener("resize", queueResizeGame);
window.visualViewport?.addEventListener("resize", queueResizeGame);
window.addEventListener("orientationchange", () => {
  if (resizeTimeoutHandle !== undefined) {
    window.clearTimeout(resizeTimeoutHandle);
    resizeTimeoutHandle = undefined;
    resizeQueued = false;
  }
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
