# GPT Handoff: Emerald Grass Magic UI Implementation

Hello! You are tasking with implementing the newly approved **"Emerald Grass Magic"** UI theme for the cozy incremental Phaser game: *Grass Touching Simulator*. 

The player has approved the **Mystic Constellation** variation for the Skill Screen. All custom pixel-art assets have already been programmatically generated and placed in the project repository.

Please follow the instructions below to implement this redesign.

---

## 📋 Direct Instructions for GPT

1.  **Read the Step-by-Step Guide:** Refer to the comprehensive implementation manual located at:
    *   [EMERALD_GRASS_MAGIC_IMPLEMENTATION_GUIDE.md](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/docs/EMERALD_GRASS_MAGIC_IMPLEMENTATION_GUIDE.md)
2.  **No Logic Changes:** Keep all system logic, upgrade maths, and save data structures exactly as they are. This is a purely visual/theme upgrade.
3.  **Files to Modify:**
    *   [src/game/scenes/TitleScene.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/scenes/TitleScene.ts) (Preload assets, update title background image, convert credits/options panels to 9-slice)
    *   [src/game/scenes/GameScene.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/scenes/GameScene.ts) (Preload assets, add field background, setup floating spore particle emitter, replace standard rects with 9-slice panels, draw constellation connection lines, add hexagon node frame, swap selection frame)
    *   [src/game/ui/buttons.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/ui/buttons.ts) (Refactor `createTextButton` and `setTextButtonEnabled` to use the 3-state image buttons)
    *   [src/style.css](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/style.css) (Align background color variables)

---

## 📦 Asset Cheat-Sheet

All files are placed in `public/assets/` and can be loaded in Phaser with the following keys:

| Asset Name | Phaser Key | File Path |
| :--- | :--- | :--- |
| **Title Background** | `"title-screen-emerald"` | `/assets/title-screen-emerald.png` |
| **Grid Background** | `"emerald-bg"` | `/assets/ui/emerald-bg.png` |
| **9-Slice Frame** | `"panel-emerald"` | `/assets/ui/panel-emerald.png` |
| **Node Frame** | `"node-hexagon-frame"` | `/assets/ui/node-hexagon-frame.png` |
| **Normal Button** | `"button-emerald-normal"` | `/assets/ui/button-emerald-normal.png` |
| **Hover Button** | `"button-emerald-hover"` | `/assets/ui/button-emerald-hover.png` |
| **Pressed Button** | `"button-emerald-active"` | `/assets/ui/button-emerald-active.png` |
| **Tile Selector** | `"selector-gold"` | `/assets/ui/selector-gold.png` |
| **Spore Particle** | `"magic-spore"` | `/assets/effects/magic-spore.png` |

---

## 🚀 Recommended Action
Begin by opening the guide at [docs/EMERALD_GRASS_MAGIC_IMPLEMENTATION_GUIDE.md](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/docs/EMERALD_GRASS_MAGIC_IMPLEMENTATION_GUIDE.md) and reading through each step. Modify the files sequentially and verify that the game still builds correctly by running `npm run build` after changes.
