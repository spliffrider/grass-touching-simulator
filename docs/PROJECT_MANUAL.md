# Grass Touching Simulator Project Manual

This manual explains how the project is organized, how the current systems work, and where new game content should go. Use it as the first stop before adding more mechanics, art, audio, UI, or save data.

## Project Shape

Grass Touching Simulator is a Phaser 3 browser game built with TypeScript and Vite.

Core folders:

- `src/main.ts`: Phaser game bootstrap, viewport resizing, scene registration.
- `src/game/scenes/`: Phaser scenes. These own rendering, input, layout, and high-level orchestration.
- `src/game/systems/`: Gameplay logic that mutates state or computes runtime behavior.
- `src/game/data/`: Static content and balance definitions.
- `src/game/types/`: Shared TypeScript state and gameplay types.
- `src/game/ui/`: Reusable Phaser UI helpers.
- `public/assets/`: Images and audio served directly by Vite/Phaser.
- `vite.config.ts`: Build strategy, including Phaser chunk splitting.

Run locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

## Runtime Architecture

The game has two scenes:

- `TitleScene`: title screen, menu buttons, credits, menu music, title options.
- `GameScene`: main game board, HUD, panels, input handling, visual feedback, and system orchestration.

The important rule:

`GameScene` should coordinate, while systems should own gameplay behavior.

Good responsibilities for `GameScene`:

- Create Phaser objects.
- Position UI and tiles.
- Listen for input.
- Call systems during `update`.
- Save after a system reports state changes.
- Play visual feedback through callbacks.

Good responsibilities for systems:

- Mutate `GameState`.
- Decide when an automation fires.
- Compute drops, rewards, and timers.
- Return whether state changed.
- Avoid directly creating Phaser objects unless the system is specifically visual.

Current runtime systems:

- `FieldSystem`: field tiles, tile keys, field expansion, regrowth, tile touches, field queries.
- `UpgradeSystem`: computes `RuntimeStats` from upgrades, seed shop purchases, weather, inventory, and seasons.
- `DropSystem`: seed and gold drop logic, including Wild Spread field expansion.
- `SprinklerSystem`: Tiny Sprinkler automation.
- `AnimalCompanionSystem`: Bee Hive, Chicken, and Sheep passive effects.
- `InventorySystem`: inventory add, consume, and quantity helpers.
- `SaveSystem`: localStorage save/load/reset and save migration.
- `AudioSystem`: procedural in-game sound effects.

## Game State

The saved state shape lives in:

```text
src/game/types/game-state.ts
```

`GameState` contains currencies, lifetime totals, field tiles, upgrades, seed shop purchases, inventory, milestones, weather, and save metadata.

When adding persistent data:

1. Add it to `GameState`.
2. Add a default value in `createInitialState` in `FieldSystem.ts`.
3. Add migration/default handling in `SaveSystem.ts`.
4. Increase `CURRENT_SAVE_VERSION` if the change needs explicit save migration.

Do not assume old players have the new field. Always provide a migration/default.

## Save System

Saves are stored in localStorage using:

```text
grass-touching-simulator.save.v1
```

The key name is still `v1` for compatibility with existing browser saves. Actual schema versioning is handled by `CURRENT_SAVE_VERSION`.

Use:

- `loadGame()` to load and migrate.
- `saveGame(state)` to write.
- `resetSave()` to clear and create a fresh state.
- `hasSavedGame()` for title screen Continue behavior.

Recommended pattern for new systems:

```ts
const changed = mySystem.update(delta, this.state, stats, feedback);
if (changed) {
  saveGame(this.state);
}
```

Avoid saving from deep inside a system. Let `GameScene` decide when to persist.

## Field And Tiles

Field tiles are stored as:

```ts
Record<TileKey, FieldTile>
```

Tile keys are created with:

```ts
tileKey(x, y)
```

Use the query helpers in `FieldSystem.ts` instead of directly calling `Object.values(state.field)`:

- `getFieldTiles(state)`
- `getGrownTiles(state)`
- `getRegrowingTiles(state)`
- `getFieldBounds(state)`

This keeps the code ready for future indexing/caching if the field becomes huge.

Tile art is loaded by `GameScene.preload` from:

```text
public/assets/tiles/
```

Expected tile files:

- `tile-dirt.png`
- `tile-stubble.png`
- `grass-fleck.png`
- `dew-fleck.png`
- `grass-normal.png`
- `grass-normal-dewy.png`
- `grass-normal-lush.png`
- `grass-thick.png`
- `grass-thick-dewy.png`
- `grass-thick-lush.png`
- `grass-clover.png`
- `grass-clover-dewy.png`
- `grass-clover-lush.png`
- `grass-golden.png`
- `grass-golden-dewy.png`
- `grass-golden-lush.png`

Alternative art lives in:

```text
public/assets/alternative-tiles/
```

Those files are available as a checked-in alternate set, but the game currently loads from `public/assets/tiles/`.

## Adding A Grass Tier

Grass tiers are defined in:

```text
src/game/data/grass-tiers.ts
```

To add a tier:

1. Add the new id to `GrassTierId` in `game-state.ts`.
2. Add a definition to `GRASS_TIERS`.
3. Add matching tile assets:
   - `grass-yourid.png`
   - `grass-yourid-dewy.png`
   - `grass-yourid-lush.png`
4. Update any tier-specific visuals/audio if needed:
   - `GameScene.getGrassTextureKey`
   - `GameScene.shakeForGrassTouch`
   - `AudioSystem.playGrassTouchNow`
   - `DropSystem.tryDropGold` if the tier should affect gold.
5. Update save normalization in `SaveSystem.readGrassTier`.

Keep ids lowercase and stable. Save files store ids.

## Adding A New Runtime System

Use this pattern for mechanics that run over time, such as tools, automation, quests, animal placement, offline progress, or world events.

Create a file in:

```text
src/game/systems/
```

Example structure:

```ts
export interface MySystemFeedback {
  refreshTile(tile: FieldTile): void;
  popAtTile(tile: FieldTile, text: string, color: string): void;
  playSound(sound: "seed" | "gold" | "regrow"): void;
}

export class MySystem {
  private elapsed = 0;

  reset(): void {
    this.elapsed = 0;
  }

  update(delta: number, state: GameState, stats: RuntimeStats, feedback: MySystemFeedback): boolean {
    // Return true only when state changed.
    return false;
  }
}
```

Then in `GameScene`:

1. Import and instantiate it as a private field.
2. Call it from `update`.
3. Pass callbacks for visuals/audio.
4. Save if it returns `true`.
5. Reset it in `resetPrototypeSave` if it has timers.

Systems should not know about `GameScene`. Feedback callbacks keep gameplay logic testable and keep Phaser rendering in the scene.

## Adding Upgrades

Upgrade content lives in:

```text
src/game/data/upgrades.ts
```

Each upgrade has:

- `id`: stable save key.
- `name`: display name.
- `description`: UI text.
- `baseCost` and `costGrowth`: scaling.
- `maxLevel`.
- `prerequisiteIds`: optional dependency list.
- `tree`: skill tree position/icon/color.
- `apply(stats, level)`: modifies `RuntimeStats`.
- `isUnlocked(state)`: unlock condition.

Upgrade effects flow like this:

1. `GameScene.update` calls `getRuntimeStats(state)`.
2. `UpgradeSystem` loops over `UPGRADES`.
3. Each owned upgrade applies its stat modifications.
4. Systems and tile touches use the resulting `RuntimeStats`.

When adding an upgrade branch, update `GameScene.getUpgradeBranch` so the detail panel labels it correctly.

## Adding Seed Shop Items

Seed shop content lives in:

```text
src/game/data/seed-shop.ts
```

Seed shop purchases are permanent booleans stored in:

```ts
state.seedShopPurchases[item.id]
```

Use seed shop items for permanent feature unlocks or automation upgrades.

If the item modifies stats, add its effect in:

```text
src/game/systems/UpgradeSystem.ts
```

If the item unlocks a new runtime behavior, wire that behavior into a system. Existing examples:

- `sprinkler` and `sprinkler_timer` are handled by `SprinklerSystem`.
- `wild_spread` and `seed_catalog` are handled by `DropSystem`.
- `weather_jar` is handled by `GameScene.updateWeather` and weather data.

## Adding Gold Store Items

Gold store content lives in:

```text
src/game/data/gold-store.ts
```

Gold store items can be:

- `consumable`: bought into inventory and used.
- `animal`: passive inventory companion.

Inventory helpers live in:

```text
src/game/systems/InventorySystem.ts
```

For a new consumable:

1. Add it to `GOLD_STORE_ITEMS`.
2. Add its behavior in `GameScene.useGoldStoreItem`.
3. Use `consumeInventoryItem` before applying the effect.
4. Save and refresh UI after use.

For a new passive animal:

1. Add it to `GOLD_STORE_ITEMS`.
2. Add its passive behavior in `AnimalCompanionSystem`.
3. Add any stat-only passive in `UpgradeSystem`.
4. Keep visual/audio output behind feedback callbacks.

If animals become placeable world objects later, make a separate placement/rendering system instead of overloading inventory.

## Adding Weather

Weather definitions live in:

```text
src/game/data/weather.ts
```

Each weather type has:

- `id`
- `name`
- `description`
- `color`
- `apply(stats)`

Weather state is stored in:

```ts
state.activeWeatherId
state.weatherEndsAt
```

To add weather:

1. Add the id to `WeatherId` in `game-state.ts`.
2. Add a definition in `WEATHER_TYPES`.
3. Update `SaveSystem.readWeatherId`.
4. Add tint/particle behavior in:
   - `GameScene.applyWeatherTint`
   - `GameScene.createWeatherParticleEffect`
5. Decide whether it should affect stats through `apply(stats)`.

Weather is unlocked by `weather_jar`.

## Adding Seasons

Season data lives in:

```text
src/game/data/seasons.ts
```

Seasons are date-based. `UpgradeSystem` applies the current season to runtime stats every time `getRuntimeStats` runs.

To add or change seasonal behavior:

1. Edit season definitions.
2. Keep descriptions accurate; they appear in the HUD.
3. If adding a new season id, update `SeasonId` in `game-state.ts`.

## Adding Milestones

Milestones live in:

```text
src/game/data/milestones.ts
```

They unlock when lifetime grass touches reach a threshold. `GameScene.checkMilestones` expands the field and shows the message.

Use milestones for:

- Expanding the field.
- Pacing early progression.
- Giving the player visible goals.

## Adding Music

Menu music currently lives in:

```text
public/assets/music/epic_menu_theme_mellow.wav
```

Title music is handled directly by `TitleScene` using an `HTMLAudioElement`, because browsers have special autoplay rules.

Music settings live in:

```text
src/game/data/audio-settings.ts
```

To add more music:

1. Put the file in `public/assets/music/`.
2. Add a path constant in the scene or a future music data file.
3. For title/menu music, follow the existing `TitleScene` pattern.
4. For in-game background music, prefer a small `MusicSystem` instead of adding more audio state to `GameScene`.
5. Use the shared stored volume helpers.

Important browser rule: music playback usually must be triggered after user interaction.

## Adding Sound Effects

In-game SFX are procedural and live in:

```text
src/game/systems/AudioSystem.ts
```

To add a new procedural sound:

1. Add the sound id to the `SoundName` union.
2. Add a case in `playNow`.
3. Implement a private method using `playTone`, `playNoiseSweep`, or a new helper.
4. Trigger it from scene/system feedback.

If you switch to sample-based SFX later:

- Put files in `public/assets/sfx/`.
- Add preload calls in the scene or a loader helper.
- Keep the high-level `audio.play("name")` API so callers do not care whether sounds are procedural or sampled.

## Adding Graphics And Animations

Static bitmap assets go under:

```text
public/assets/
```

Suggested future folders:

- `public/assets/tiles/`: tile and field art.
- `public/assets/animals/`: animal sprites.
- `public/assets/ui/`: UI frames, icons, buttons.
- `public/assets/effects/`: particle sprites and one-off visual effects.
- `public/assets/music/`: music tracks.
- `public/assets/sfx/`: sample-based sound effects if added.

Phaser assets must be preloaded before use. Existing tile images are preloaded in `GameScene.preload`.

For simple effects:

- Use tweens in `GameScene`.
- Use particle emitters for weather or bursts.
- Keep reusable visuals in helper methods or future visual systems.

For complex animation:

1. Add sprite sheet or atlas to `public/assets/`.
2. Preload it in the scene.
3. Create animations once during scene setup.
4. Put repeated animation logic in a visual helper/system.

Avoid mixing permanent game logic with animation code. The animation should react to state changes, not own them.

## Adding UI

Current shared UI helper:

```text
src/game/ui/buttons.ts
```

Use `createTextButton` for simple Phaser text buttons. Use `setTextButtonText` and `setTextButtonEnabled` to update existing buttons.

Current UI still mostly lives in `GameScene`, especially:

- HUD/header.
- Skill tree.
- Seed shop.
- Gold store.
- Options panel.
- Tile info panel.

Recommended next UI refactors:

- Extract `SeedShopPanel`.
- Extract `GoldStorePanel`.
- Extract shared scrollable panel/card layout.
- Extract shared volume slider used by title and game options.

When adding new panels now:

1. Prefer a dedicated class in `src/game/ui/` if the panel is large.
2. Let the panel own Phaser objects and layout.
3. Let `GameScene` pass state and callbacks.
4. Keep economy/purchase rules in systems/data where possible.

## Adding A New Currency

For a new currency:

1. Add current and lifetime totals to `GameState`.
2. Add defaults in `createInitialState`.
3. Add migration/default handling in `SaveSystem`.
4. Display it in `GameScene.refreshUi`.
5. Add drop/earn logic in a system.
6. Add spend logic near the shop/system that owns it.

Try not to spread currency math across many scene methods. If it has drops or rewards, use a system.

## Adding Offline Progress

Offline progress should use:

```ts
state.lastSavedAt
```

Recommended approach:

1. On load, compute elapsed time since `lastSavedAt`.
2. Clamp elapsed time to a sane maximum.
3. Run a dedicated `OfflineProgressSystem`.
4. Return a summary for UI.
5. Save once after applying.

Do not try to simulate every frame while offline. Compute aggregate rewards.

## Build And Deployment

The project deploys to Vercel.

Production build:

```bash
npm run build
```

Production deploy:

```bash
vercel --prod --yes
```

`vite.config.ts` splits Phaser into its own chunk:

- Phaser chunk: expected to be large.
- App chunk: should stay much smaller.

If bundle warnings return, inspect whether app code grew or whether Phaser/library config changed.

## Code Style Guidelines

Keep these rules in mind as the game grows:

- Put data in `src/game/data`.
- Put stateful gameplay behavior in `src/game/systems`.
- Put shared types in `src/game/types`.
- Put reusable UI in `src/game/ui`.
- Keep `GameScene` as an orchestrator and visual owner.
- Keep save migrations explicit.
- Return `changed: boolean` from systems that mutate state.
- Use field query helpers instead of direct field scans.
- Prefer stable ids; saves store ids.
- Build after each meaningful refactor.

## Common Recipes

### Add A New Animal

1. Add item data in `gold-store.ts`.
2. If it has a stat passive, edit `UpgradeSystem.ts`.
3. If it acts over time, edit `AnimalCompanionSystem.ts`.
4. Add visuals later through a future animal placement/rendering system.
5. Build and playtest.

### Add A New Tool Or Automation

1. Add unlock item in `seed-shop.ts` or `gold-store.ts`.
2. Create a system in `src/game/systems`.
3. Instantiate it in `GameScene`.
4. Call it from `update`.
5. Save if it returns `true`.
6. Reset its timers in `resetPrototypeSave`.

### Add A New Reward Drop

1. Add persistent state if needed.
2. Add drop math in `DropSystem`.
3. Add visual/audio feedback to `DropFeedback`.
4. Call it from manual touch, sprinkler, animals, or future systems.

### Add A New Panel

1. Start in `src/game/ui/` if it will be more than a few controls.
2. Pass callbacks instead of importing `GameScene`.
3. Give it `create`, `layout`, `refresh`, `open`, and `close` methods.
4. Keep purchase/effect logic outside the panel when possible.

### Add New Tile Art

1. Put PNG files in `public/assets/tiles/`.
2. Match the naming convention used in `GameScene.preload`.
3. If adding a new tier, update `GrassTierId`, `GRASS_TIERS`, and save normalization.
4. Build and visually smoke test the board.

## Future-Proofing Checklist

Before adding a large feature, ask:

- Does this need saved state?
- Does old save data need a migration?
- Is this a stat modifier, runtime system, UI panel, or visual effect?
- Can it use existing field query helpers?
- Should it return `changed` and let `GameScene` save?
- Does it need asset preloading?
- Does it need mobile layout handling?
- Does it affect bundle size or load time?

If the answer touches more than one area, make the feature in small slices:

1. Data/state.
2. System behavior.
3. Scene wiring.
4. UI/visual feedback.
5. Save/build/browser verification.

