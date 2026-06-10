# Antigravity Asset Brief: New Grass Tiers

Generate a first batch of new tile art for **Grass Touching Simulator**.

The game currently loads grass tile sprites from:

```text
public/assets/tiles/
```

Existing grass tile assets are `58x58` PNGs:

```text
grass-normal.png
grass-normal-dewy.png
grass-normal-lush.png
grass-thick.png
grass-thick-dewy.png
grass-thick-lush.png
grass-clover.png
grass-clover-dewy.png
grass-clover-lush.png
grass-golden.png
grass-golden-dewy.png
grass-golden-lush.png
```

Use those existing files as the visual/style reference.

## Global Requirements

- Output format: PNG.
- Exact size: `58x58`.
- Style: cozy pixel-art grass/tile patch, readable at small size.
- Camera: top-down / slightly angled patch, matching the existing grass sprites.
- Canvas: same visual footprint as existing grass patches.
- Background: transparent where appropriate, or match the existing grass sprite alpha style exactly.
- No text, no UI frame, no shadows outside the tile footprint, no watermark.
- Do not overwrite existing files.
- Place all final files directly in:

```text
public/assets/tiles/
```

Each tier needs exactly three variants:

- Base: `grass-{tier}.png`
- Dewy: `grass-{tier}-dewy.png`
- Lush: `grass-{tier}-lush.png`

The `-dewy` variant should visibly add cool dew highlights/droplets.
The `-lush` variant should look fuller, denser, softer, and more abundant.

## Requested New Tiers

### 1. Wildflower Grass

Theme: cheerful meadow grass with tiny flowers.

Visual direction:

- Green grass base with small white, yellow, and pink wildflowers.
- Should still read as grass first, flowers second.
- Cozy and playful, not noisy.

Files to create:

```text
public/assets/tiles/grass-wildflower.png
public/assets/tiles/grass-wildflower-dewy.png
public/assets/tiles/grass-wildflower-lush.png
```

### 2. Moss Grass

Theme: soft emerald moss carpet.

Visual direction:

- Rounded, velvety texture.
- Deeper emerald and blue-green tones.
- Lush variant can have extra puffiness and tiny bright sprouts.

Files to create:

```text
public/assets/tiles/grass-moss.png
public/assets/tiles/grass-moss-dewy.png
public/assets/tiles/grass-moss-lush.png
```

### 3. Mushroom Grass

Theme: damp grass with small mushrooms.

Visual direction:

- Green grass with tiny red/brown/cream mushroom caps.
- Keep mushrooms small enough that this still feels like a grass tier.
- Dewy variant should feel damp and foresty.
- Lush variant can have a few more mushrooms and thicker grass.

Files to create:

```text
public/assets/tiles/grass-mushroom.png
public/assets/tiles/grass-mushroom-dewy.png
public/assets/tiles/grass-mushroom-lush.png
```

### 4. Crystal Grass

Theme: magical crystalline grass.

Visual direction:

- Teal, cyan, and pale blue crystal-like blades mixed with grass.
- Small faceted highlights.
- Should feel rare and magical, but still cozy.
- Avoid making it look like ice; save that for Frost Grass.

Files to create:

```text
public/assets/tiles/grass-crystal.png
public/assets/tiles/grass-crystal-dewy.png
public/assets/tiles/grass-crystal-lush.png
```

### 5. Frost Grass

Theme: icy winter grass.

Visual direction:

- Pale green, mint, white, and light blue.
- Frosted blade tips and small snow/ice sparkle pixels.
- Dewy variant should look extra glassy/cold.
- Lush variant should be dense but frosted.

Files to create:

```text
public/assets/tiles/grass-frost.png
public/assets/tiles/grass-frost-dewy.png
public/assets/tiles/grass-frost-lush.png
```

## Optional Preview Contact Sheet

If convenient, also create a preview sheet for human review:

```text
docs/generated-grass-tier-preview.png
```

Preview sheet layout:

- Rows: one row per tier.
- Columns: base, dewy, lush.
- Include labels outside the actual tile sprites.

Do not put the preview sheet in `public/assets/tiles/`; it is only for review.

## Handoff Notes For Codex

After the assets exist, Codex will wire the tiers into code:

- `src/game/types/game-state.ts`: add new `GrassTierId` values.
- `src/game/data/grass-tiers.ts`: add tier definitions and balance placeholders.
- `src/game/systems/SaveSystem.ts`: normalize/read new tier ids.
- `src/game/scenes/GameScene.ts`: add tier-specific shake/audio/visual tuning if needed.
- `src/game/systems/AudioSystem.ts`: add tier sound profiles if needed.

No code generation is needed from Antigravity for this asset request.
