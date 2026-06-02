import Phaser from "phaser";
import { GameScene } from "./game/scenes/GameScene";
import { TitleScene } from "./game/scenes/TitleScene";
import "./style.css";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#9edc7c",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
  scene: [TitleScene, GameScene],
};

new Phaser.Game(config);
