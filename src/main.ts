import Phaser from "phaser";
import { resolveGameRoute } from "./game/routing/GameRoute";
import { GameScene } from "./game/scenes/GameScene";
import { EcosystemPrototypeScene } from "./game/scenes/EcosystemPrototypeScene";
import { EcosystemTitleScene } from "./game/scenes/EcosystemTitleScene";
import { RedesignPrototypeScene } from "./game/scenes/RedesignPrototypeScene";
import { TitleScene } from "./game/scenes/TitleScene";
import {
  applyViewportResize,
  isUsableViewportSize,
  type ViewportSize,
} from "./viewport";
import "./style.css";

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
const {
  publicAlphaRoute,
  useEcosystemTitle,
  useRedesignPrototype,
  useEcosystemPrototype,
} = resolveGameRoute(window.location.search);
const useEcosystemVisuals = useEcosystemTitle || useEcosystemPrototype;
if (useRedesignPrototype || useEcosystemVisuals) {
  document.documentElement.classList.add("grass-redesign-route");
}
if (useEcosystemPrototype) {
  document.title = "Grass Touching Simulator: Ecosystem Prototype";
}
if (publicAlphaRoute) {
  document.documentElement.classList.add("grass-public-alpha-route");
  document.title = "Grass Touching Simulator: Ancient Grass Ecosystem";
}

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
    pixelArt: !(useRedesignPrototype || useEcosystemVisuals),
    antialias: useRedesignPrototype || useEcosystemVisuals,
    roundPixels: !(useRedesignPrototype || useEcosystemVisuals),
    powerPreference: useEcosystemVisuals ? "high-performance" : "default",
  },
  scene: useEcosystemPrototype
    ? [EcosystemPrototypeScene]
    : useEcosystemTitle
      ? [EcosystemTitleScene, EcosystemPrototypeScene]
      : useRedesignPrototype
        ? [RedesignPrototypeScene]
        : [TitleScene, GameScene],
};

const game = new Phaser.Game(config);
let lastViewport = initialViewport;
let resizeQueued = false;
let resizeTimeoutHandle: number | undefined;
let lastResizeAppliedAt = 0;

function resizeGame(force = false): void {
  if (document.hidden) {
    return;
  }

  const viewport = getViewportSize();
  if (!isUsableViewportSize(viewport)) {
    return;
  }
  syncViewportCss(viewport);

  const widthDelta = Math.abs(viewport.width - lastViewport.width);
  const heightDelta = Math.abs(viewport.height - lastViewport.height);
  if (!force && widthDelta === 0 && heightDelta <= RESIZE_JITTER_PX) {
    return;
  }

  applyViewportResize(
    viewport,
    document.getElementById("game"),
    game.canvas,
    (width, height) => game.scale.setParentSize(width, height),
  );

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
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  window.requestAnimationFrame(() => resizeGame(true));
});
window.addEventListener("focus", () => resizeGame(true));
window.addEventListener("pageshow", () => resizeGame(true));
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
