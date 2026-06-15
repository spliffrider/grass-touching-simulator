# Antigravity Asset Brief - Grass Toucher + Automation Icons

## Context

Grass Touching Simulator is a Phaser 3 pixel-art incremental game. The latest pass added:

- Grass Toucher as the baseline/default class.
- Grass Toucher class skills: Honest Work and Patient Observation.
- Sprinkler Network as a new automation upgrade.

Some of those features currently reuse existing icons. Please generate the missing dedicated assets below.

## Style

- Cozy pixel-art fantasy lawn/garden style.
- Transparent-background PNG unless specified otherwise.
- Match the existing asset tone: readable at small UI sizes, warm greens/golds, crisp silhouettes.
- Avoid text baked into icons.
- Avoid heavy blur, gradients, or realistic rendering.

## Needed Assets

### 1. Grass Toucher Class Icon

Purpose: title-screen class card icon for the default Grass Toucher class.

Concept: a simple hand gently touching a bright patch of grass, honest and beginner-friendly. It should feel calm, approachable, and baseline rather than flashy.

Output:

- Size: `128x128`
- Format: transparent PNG
- Path: `public/assets/ui/classes/grass-toucher.png`

After adding this asset, Codex should update `src/game/data/character-classes.ts`:

```ts
iconKey: "class-grass-toucher",
iconPath: "/assets/ui/classes/grass-toucher.png",
```

### 2. Honest Work Skill Icon

Purpose: skill-tree icon for the Grass Toucher-only skill `Honest Work`.

Concept: a sturdy hand, small grass patch, or simple garden glove doing steady work. Should communicate reliable basic touch value and seed consistency.

Output:

- Size: `96x96`
- Format: transparent PNG
- Path: `public/assets/ui/skills/honest-work.png`

After adding this asset, Codex should remove the temporary `iconAsset: "softer_grass"` override from the `honest_work` upgrade in `src/game/data/upgrades.ts`.

### 3. Patient Observation Skill Icon

Purpose: skill-tree icon for the Grass Toucher-only skill `Patient Observation`.

Concept: a magnifying glass over grass, a calm eye observing a rare sprout, or a field note lens. Should communicate noticing rare grass and steady regrowth.

Output:

- Size: `96x96`
- Format: transparent PNG
- Path: `public/assets/ui/skills/patient-observation.png`

After adding this asset, Codex should remove the temporary `iconAsset: "grass_identification"` override from the `patient_observation` upgrade in `src/game/data/upgrades.ts`.

### 4. Sprinkler Network Item Icon

Purpose: seed-shop icon for the new automation upgrade `Sprinkler Network`.

Concept: two or three tiny sprinklers connected by dotted water lines or a small irrigation grid. Must read clearly as "more sprinkler coverage" at shop icon size.

Output:

- Size: `96x96`
- Format: transparent PNG
- Path: `public/assets/ui/items/sprinkler-network.png`

After adding this asset, Codex should update `src/game/scenes/GameScene.ts`:

```ts
sprinkler_network: "item-sprinkler-network",
```

Currently it temporarily reuses `item-sprinkler-timer`.

## Optional Later Assets

These are not required for the current build, but would be useful soon:

- `public/assets/ui/classes/grass-toucher-card.png` - larger class-card portrait or badge, `256x256`, transparent PNG.
- `public/assets/effects/sprinkler-network-drop.png` - small water sparkle/drop for network bursts, `32x32`, transparent PNG.

## Quick Validation

After assets are added:

1. Run `npm run build`.
2. Open title screen and confirm Grass Toucher has its own icon.
3. Open skill tree and confirm Honest Work and Patient Observation have unique icons.
4. Open Seed Shop and confirm Sprinkler Network has its own icon.
5. Smoke test `/?stress&perf&tiles=120`.
