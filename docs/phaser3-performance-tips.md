# Phaser 3 Performance Tips for Tile-Based Incremental Games

## 1. Use a Tilemap instead of individual sprites

This is the biggest win. Rendering hundreds of individual `Sprite` or `Image` objects kills performance. Tilemaps are rendered in a single draw call.

```javascript
// Instead of:
tiles.forEach(t => this.add.image(t.x, t.y, 'grass'))

// Use a static tilemap layer:
const map = this.make.tilemap({ width: 40, height: 30, tileWidth: 32, tileHeight: 32 });
const tileset = map.addTilesetImage('tiles');
const layer = map.createBlankLayer('ground', tileset);
layer.fill(GRASS_TILE_INDEX); // one draw call for the whole grid
```

## 2. Use `StaticGroup` for non-moving tiles

If tiles don't move, use `this.add.group({ immovable: true })` or better yet `StaticGroup`. But honestly for pure visuals, tilemaps beat both.

## 3. Batch your "special tile" updates with dirty flagging

Instead of updating every tile every frame, only redraw tiles that actually changed:

```javascript
// Track dirty tiles
const dirtyTiles = new Set();

function markDirty(tileX, tileY) {
  dirtyTiles.add(`${tileX},${tileY}`);
}

// In update():
update() {
  for (const key of dirtyTiles) {
    const [x, y] = key.split(',').map(Number);
    updateTileVisual(x, y);
  }
  dirtyTiles.clear();
}
```

## 4. Throttle your increment logic

Incremental games don't need to update game state every 16ms. Use a ticker at a lower rate:

```javascript
// Run game logic at 10 ticks/second instead of 60fps
this.time.addEvent({
  delay: 100,
  callback: this.gameLogicTick,
  callbackScope: this,
  loop: true
});
```

## 5. Use `RenderTexture` to bake static regions

For large areas that rarely change, bake them into a texture:

```javascript
const rt = this.add.renderTexture(0, 0, 1024, 1024);
rt.draw(spritesToBake); // rendered once
rt.setImmovable(true);
// Now it's one draw call, not 200
```

## 6. Object pooling for particles/effects

If you're spawning grass-touch effects, use a pool:

```javascript
const pool = this.add.group({
  classType: Phaser.GameObjects.Sprite,
  maxSize: 50,
  runChildUpdate: false
});

function spawnEffect(x, y) {
  const effect = pool.get(x, y, 'sparkle');
  if (effect) {
    effect.setActive(true).setVisible(true);
    effect.once('animationcomplete', () => pool.killAndHide(effect));
    effect.play('sparkle_anim');
  }
}
```

## 7. Disable physics on visual-only objects

If you're using Arcade Physics but tiles are just decorative, make sure they're not in the physics world:

```javascript
// Use this.add.image NOT this.physics.add.image for non-physics tiles
```

## 8. Camera culling — let Phaser do it

Make sure `setVisible(false)` or culling is active. Phaser auto-culls sprites outside the camera, but only if you haven't set `setActive(false)` incorrectly. Use `this.cameras.main.setBounds()` properly.

---

## Quick Diagnosis

Add this to see your actual bottleneck:

```javascript
// In create():
this.fpsText = this.add.text(10, 10, '', { fontSize: '16px', fill: '#fff' }).setDepth(999);

// In update():
this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)} | Objects: ${this.children.length}`);
```

If `Objects` is in the hundreds+, the tilemap approach will be your biggest win. If FPS is fine but logic is slow, the tick throttling is your fix.
