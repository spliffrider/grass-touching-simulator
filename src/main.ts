import Phaser from "phaser";
import { GameScene } from "./game/scenes/GameScene";
import { TitleScene } from "./game/scenes/TitleScene";
import "./style.css";

function getViewportSize() {
  return {
    width: Math.floor(window.visualViewport?.width ?? window.innerWidth),
    height: Math.floor(window.visualViewport?.height ?? window.innerHeight),
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

function resizeGame(): void {
  const viewport = getViewportSize();
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

window.addEventListener("resize", resizeGame);
window.visualViewport?.addEventListener("resize", resizeGame);
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
