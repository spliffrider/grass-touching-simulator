# Emerald Grass Magic UI Implementation Guide (for GPT-5.5)

This guide outlines how to implement the new **"Emerald Grass Magic"** UI theme. All the custom pixel-art assets have already been generated and placed in the project's asset directories. Your task is to update the Phaser 3 scene and helper files to use these new visual resources.

---

## 🎨 Asset Inventory

The following assets have been generated and are ready to be preloaded:

| Category | File Path | Keys / Dimensions | Purpose |
| :--- | :--- | :--- | :--- |
| **Title Background** | [title-screen-emerald.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/title-screen-emerald.png) | `"title-screen-emerald"` (1366x768) | Background for the Title Screen scene. |
| **UI Background** | [emerald-bg.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/ui/emerald-bg.png) | `"emerald-bg"` (512x512) | Tileable emerald background texture for the game field. |
| **UI Panel** | [panel-emerald.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/ui/panel-emerald.png) | `"panel-emerald"` (96x96, 32px borders) | Ornate 9-slice panel for stat windows, stores, and options. |
| **Normal Button** | [button-emerald-normal.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/ui/button-emerald-normal.png) | `"button-emerald-normal"` (96x44) | Button background for standard state. |
| **Hover Button** | [button-emerald-hover.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/ui/button-emerald-hover.png) | `"button-emerald-hover"` (96x44) | Button background when pointer is over. |
| **Pressed Button** | [button-emerald-active.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/ui/button-emerald-active.png) | `"button-emerald-active"` (96x44) | Button background when clicked. |
| **Tile Selector** | [selector-gold.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/ui/selector-gold.png) | `"selector-gold"` (64x64) | Highlights hovered or focused grass tiles. |
| **Effect Particle** | [magic-spore.png](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/public/assets/effects/magic-spore.png) | `"magic-spore"` (16x16) | Particle sprite for floating gold dust/spores. |

---

## 🛠️ Step-by-Step Implementation Instructions

### Step 1: Preload the Assets
You need to load these assets into memory in the `preload()` phase.

#### A. In [TitleScene.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/scenes/TitleScene.ts#L65-L70):
Add loading statements for the emerald title screen and the panel:
```typescript
preload(): void {
  this.load.image("title-screen-emerald", "/assets/title-screen-emerald.png");
  this.load.image("panel-emerald", "/assets/ui/panel-emerald.png");
  // Existing preloads...
}
```

#### B. In [GameScene.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/scenes/GameScene.ts#L236-L274):
Add loading statements for all emerald UI and particle assets inside the `preload` method:
```typescript
// Preload Emerald UI assets
this.load.image("emerald-bg", "/assets/ui/emerald-bg.png");
this.load.image("panel-emerald", "/assets/ui/panel-emerald.png");
this.load.image("button-emerald-normal", "/assets/ui/button-emerald-normal.png");
this.load.image("button-emerald-hover", "/assets/ui/button-emerald-hover.png");
this.load.image("button-emerald-active", "/assets/ui/button-emerald-active.png");
this.load.image("selector-gold", "/assets/ui/selector-gold.png");
this.load.image("magic-spore", "/assets/effects/magic-spore.png");
```

---

### Step 2: Update the Title Screen
Modify `TitleScene.ts` to display the new background and frame the options/credits using the new emerald panel.

#### A. Background Image:
In `create()`, update the background image texture:
```typescript
this.background = this.add.image(0, 0, "title-screen-emerald").setOrigin(0.5);
```

#### B. Options & Credits Panels (9-slice):
Replace the flat colored rectangles with 9-slice panels in `createCreditsPanel()` and `createOptionsPanel()`.
Phaser 3 supports `scene.add.nineslice` natively:
```typescript
// In createCreditsPanel()
// Replace: this.creditsPanel = this.add.rectangle(...)
this.creditsPanel = this.add.nineslice(
  centerX, 
  centerY, 
  "panel-emerald", 
  0, 
  panelWidth, 
  panelHeight, 
  32, 32, 32, 32
).setOrigin(0.5);
```
Repeat this pattern for `this.optionsPanel` in `createOptionsPanel()`.

---

### Step 3: Game Board Background & Spore Particles
Modify [GameScene.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/scenes/GameScene.ts) to replace the solid background color with the tileable texture and add floating spore particles.

#### A. Add Tileable Game Background:
In `create()`, instead of just `this.cameras.main.setBackgroundColor("#7fc66c");`, instantiate a tileable background behind the board.
```typescript
// Add tileable background sprite
const bgWidth = this.scale.width * 2;
const bgHeight = this.scale.height * 2;
this.boardBackground = this.add.tileSprite(0, 0, bgWidth, bgHeight, "emerald-bg")
  .setOrigin(0.5)
  .setDepth(0)
  .setScrollFactor(0.2); // slight parallax movement
```
*Note: Make sure to position this behind the grass tiles.*

#### B. Floating Magic Spores (Particle Emitter):
Create a particle emitter in `create()` that floats magical golden dust across the screen:
```typescript
this.sporeEmitter = this.add.particles(0, 0, "magic-spore", {
  x: { min: -100, max: this.scale.width + 100 },
  y: { min: -100, max: this.scale.height + 100 },
  speed: { min: 5, max: 15 },
  angle: { min: -130, max: -50 },
  scale: { start: 0.4, end: 1.0 },
  alpha: { start: 0, end: 0.7, steps: 15 },
  lifespan: 10000,
  frequency: 300,
  maxParticles: 50,
});
this.sporeEmitter.setDepth(1).setScrollFactor(0);
```

---

### Step 4: Re-skin Buttons using Sprite Sheets or Textures
Modify the button generator file [src/game/ui/buttons.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/ui/buttons.ts) to utilize the three generated states (`button-emerald-normal`, `button-emerald-hover`, `button-emerald-active`).

#### A. Modify `createTextButton`:
Replace the `scene.add.rectangle` background with a responsive 9-slice or scaleable image:
```typescript
export function createTextButton(
  scene: Phaser.Scene,
  text: string,
  onClick: () => void,
  width: number,
  height: number,
  depth: number,
): Phaser.GameObjects.Container {
  const button = scene.add.container(0, 0).setDepth(depth);
  
  // Create an image button (we can scale it or use a 9-slice)
  const bg = scene.add.nineslice(0, 0, "button-emerald-normal", 0, width, height, 12, 12, 12, 12)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
    
  const label = scene.add
    .text(width / 2, height / 2, text, {
      fontFamily: "Trebuchet MS, Arial",
      fontSize: height < 40 ? "14px" : "18px",
      color: "#ffe460", // Gold-yellow font
      stroke: "#0c2610", // Dark green outline
      strokeThickness: 3,
    })
    .setOrigin(0.5);

  // Text hover highlights
  bg.on("pointerover", () => {
    bg.setTexture("button-emerald-hover");
    label.setColor("#ffffff");
  });
  
  bg.on("pointerout", () => {
    bg.setTexture("button-emerald-normal");
    label.setColor("#ffe460");
  });
  
  bg.on("pointerdown", () => {
    bg.setTexture("button-emerald-active");
    onClick();
  });
  
  bg.on("pointerup", () => {
    bg.setTexture("button-emerald-hover");
  });

  button.add([bg, label]);
  button.setData("bg", bg);
  button.setData("label", label);
  return button;
}
```

#### B. Update `setTextButtonEnabled` inside `buttons.ts`:
Apply a gray/dark-green overlay tint or set texture opacity for the disabled button state:
```typescript
export function setTextButtonEnabled(button: Phaser.GameObjects.Container, enabled: boolean): void {
  const bg = button.getData("bg") as Phaser.GameObjects.NineSlice | undefined;
  const label = button.getData("label") as Phaser.GameObjects.Text | undefined;

  if (enabled) {
    bg?.setInteractive();
    bg?.setAlpha(1.0);
    bg?.setTint(0xffffff);
    label?.setColor("#ffe460");
  } else {
    bg?.disableInteractive();
    bg?.setAlpha(0.6);
    bg?.setTint(0x557755); // darken / tint to forest green
    label?.setColor("#889988");
  }
}
```

---

### Step 5: Replace Stat, Shop, Options, and Skill Tree Panels
Inside [GameScene.ts](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/game/scenes/GameScene.ts), locate the window container construction methods and convert the backgrounds to 9-slice emerald panels.

#### A. Affected Panels:
Apply this conversion style to these methods:
- `createSkillTree()` (around line 556)
- `createSeedShop()` (around line 760)
- `createGoldStore()` (around line 882)
- `createOptionsPanel()` (around line 1004)
- `createTileInfoPanel()` (around line 534)

#### B. The 9-Slice Panel Swap Pattern:
```typescript
// REPLACE:
// this.panelBg = this.add.rectangle(0, 0, width, height, 0xf4ffdc, 0.98).setStrokeStyle(5, 0x2d6f36);

// WITH:
this.panelBg = this.add.nineslice(0, 0, "panel-emerald", 0, width, height, 32, 32, 32, 32)
  .setOrigin(0.5);
```

---

### Step 6: Custom Tile Selector highlight
Update the mouse/cursor hover tile indicator box:
In `GameScene.ts`, locate the indicator graphics creation (where the tile selection frame is constructed).
```typescript
// Replace graphics rectangle selection frame with selector-gold sprite
// Replace: this.selectorGraphics.strokeRect(...)
// With:
this.selectorSprite = this.add.image(0, 0, "selector-gold")
  .setOrigin(0, 0)
  .setVisible(false)
  .setDepth(5);
```
Update its position to match the currently hovered tile `(tileX * TILE_WIDTH, tileY * TILE_HEIGHT)`.

---

### Step 7: Apply Emerald Theme Palette
Apply these hex colors across text styling options in `GameScene.ts` and `TitleScene.ts` for consistent branding:

- **Gold Text Font:** `#ffe460` (or Hex integer `0xffe460` for Phaser fills).
- **Deep Forest Outline/Stroke:** `#0c2610` (or Hex integer `0x0c2610`).
- **Cream Off-white Text:** `#f7ffe8`.
- **Muted Sage Text:** `#88a28e`.
- **Emerald Theme Headers:** Replace plain text strokes with deep forest outlines to maximize contrast.

#### CSS Styling Updates:
Update [src/style.css](file:///c:/Users/rafbu/OneDrive/Documenten/Grass%20Touching%20Simulator/src/style.css) body background to align with the new cozy emerald loading screen:
```css
body {
  background: #081a0b; /* Deep emerald-black for loading state */
  color: #ffe460;
}
```
