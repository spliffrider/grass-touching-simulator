import Phaser from "phaser";
import { GameScene } from "./game/scenes/GameScene";
import { TitleScene } from "./game/scenes/TitleScene";
import "./style.css";

function getViewportSize() {
  const root = document.documentElement;
  return {
    width: Math.floor(root.clientWidth || window.innerWidth),
    height: Math.floor(window.innerHeight || root.clientHeight),
  };
}

const initialViewport = getViewportSize();

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

function resizeGame(): void {
  const viewport = getViewportSize();
  if (viewport.width === lastViewport.width && viewport.height === lastViewport.height) {
    return;
  }

  const gameElement = document.getElementById("game");
  if (gameElement) {
    gameElement.style.width = `${viewport.width}px`;
    gameElement.style.height = `${viewport.height}px`;
  }

  if (game.canvas) {
    game.canvas.style.width = `${viewport.width}px`;
    game.canvas.style.height = `${viewport.height}px`;
  }

  game.scale.resize(viewport.width, viewport.height);
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
window.addEventListener("orientationchange", () => {
  window.setTimeout(resizeGame, 120);
  window.setTimeout(resizeGame, 360);
});

window.setInterval(() => {
  const viewport = getViewportSize();
  if (viewport.width !== lastViewport.width || viewport.height !== lastViewport.height) {
    resizeGame();
  }
}, 250);
