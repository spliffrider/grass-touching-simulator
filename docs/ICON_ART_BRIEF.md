# Grass Touching Simulator Icon Art Brief

This brief is for generating a replacement icon set for Grass Touching Simulator. The goal is a coherent, crisp, wholesome 16-bit-style icon pass that matches the new meadow field backdrop and the close-up skill tree.

## Overall Style

- Style: old-school 16-bit pixel art, cozy meadow fantasy, wholesome garden simulator.
- Mood: warm, bright, readable, charming, slightly magical, not grim or realistic.
- Camera: simple 3/4 view or clear front-facing object view depending on the icon.
- Background: transparent PNG only. No square background, no UI frame, no badge, no text.
- Shape language: chunky silhouettes, readable at small size, strong outline, small clusters of highlight pixels.
- Linework: dark green/brown outline, 1-3 px depending on canvas size.
- Lighting: soft top-left light, warm highlight, darker lower-right shadow.
- Palette: meadow greens, golden straw, warm cream, soft sky blue, muted flower pinks, earthy browns.
- Avoid: blur, painterly rendering, photo texture, smooth vector gradients, tiny unreadable details, text/letters/numbers inside icons, black pure-shadow blobs, neon sci-fi.
- Export format: PNG with alpha transparency.
- Pixel requirement: edges should be crisp when scaled with nearest-neighbor filtering.

## Required Output Sizes

Create final files at exactly these dimensions:

- Skill icons: `96x96` PNG.
- Seed/shop item icons: `48x48` PNG.
- Automation/world system icons: `64x64` PNG.

Keep each object centered with 4-8 px transparent padding. The subject should fill about 72-84% of the canvas. Do not include any drop shadow outside the sprite unless it is a tiny pixel-art contact shadow inside the transparent canvas.

## Folder Targets

Place generated files here, keeping exact kebab-case filenames:

- `public/assets/ui/skills/*.png`
- `public/assets/ui/items/*.png`
- `public/assets/world/*.png`

Existing files can be replaced after review. New files listed as "missing/new" can be added, then the game code can be wired to use them.

## Prompt Template

Use this template per icon:

```text
Create a transparent-background 16-bit pixel art game icon for [ICON NAME].
Canvas: [48x48 / 64x64 / 96x96] pixels.
Subject: [specific visual direction].
Style: cozy wholesome meadow fantasy, crisp pixel art, chunky readable silhouette, dark green-brown outline, warm top-left highlight, tiny dithering clusters, no text, no frame, no background, no blur, no realistic rendering.
Export as a PNG with alpha transparency.
```

## Skill Icons

All skill icons go in `public/assets/ui/skills/` and must be `96x96`.

| File | Skill | Visual Direction |
| --- | --- | --- |
| `softer-grass.png` | Softer Grass | A plush tuft of bright grass with rounded blades, tiny dew sparkle, soft golden highlight. |
| `faster-regrowth.png` | Faster Regrowth | Fresh grass blades springing upward from soil with two small motion sprouts, no arrows/text. |
| `dew-appreciation.png` | Dew Appreciation | Grass blade cluster holding large blue dew drops like little gems. |
| `barefoot-confidence.png` | Barefoot Confidence | A cozy bare foot stepping gently into grass, playful and clean, no body attached. |
| `palm-press.png` | Palm Press | A hand pressing grass down softly, palm visible, grass bending under it. |
| `two-handed-technique.png` | Two-Handed Technique | Two hands cupping or patting a tuft of grass together, clear paired-hand silhouette. |
| `mindful-contact.png` | Mindful Contact | A calm hand hovering over grass with a small zen-like glow ring, no symbol text. |
| `lucky-clover.png` | Lucky Clover | A bright four-leaf clover with a golden sparkle and thick readable leaves. |
| `dramatic-touch.png` | Dramatic Touch | A theatrical hand pose touching grass with a burst of warm sparkle pixels. |
| `satisfying-crunch.png` | Satisfying Crunch | Crisp dry grass/stubble bending with small crunchy flecks, cozy not destructive. |
| `overreaction.png` | Overreaction | Grass tuft exploding into exaggerated harmless sparkles and motion pixels. |
| `fertile-soil.png` | Fertile Soil | Rich dark soil mound with sprouting roots and a small healthy shoot. |
| `morning-mist.png` | Morning Mist | Grass tuft partly wrapped in pale blue morning mist curls. |
| `warm-sunlight.png` | Warm Sunlight | Sunbeam falling onto grass, golden rays and warm glow, no full sun face. |
| `root-network.png` | Root Network | Cross-section of grass with visible branching roots beneath. |
| `perennial-patches.png` | Perennial Patches | Several connected grass clumps returning from the same root mat. |
| `dew-respecter.png` | Dew Respecter | A careful hand near dew-covered grass, preserving the drops. |
| `weather-watching.png` | Weather Watching | Tiny meadow weather vane or jar with cloud/sun/rain pixels around it. |
| `sprinkler-calibration.png` | Sprinkler Calibration | Tiny sprinkler head spraying an even arc onto grass. New dedicated icon; currently the game reuses `warm-sunlight.png`. |
| `helper-routes.png` | Helper Routes | Curving little trail through grass with tiny helper paw/footprint marks. New dedicated icon; currently the game reuses `grass-identification.png`. |
| `grazing-logistics.png` | Grazing Logistics | Small meadow path connecting grass, hoof marks, and a tiny feed sign. New dedicated icon; currently the game reuses `soft-meadow.png`. |
| `ecosystem-loop.png` | Ecosystem Loop | Circular meadow cycle: grass, water drop, flower, root, arranged as a loop without arrow text. New dedicated icon; currently the game reuses `root-network.png`. |
| `soft-meadow.png` | Soft Meadow | A miniature cozy meadow patch with flowers and varied grass heights. |
| `grass-identification.png` | Grass Identification | Magnifying glass over a special grass blade, clear lens and bright leaf. |
| `better-eyes.png` | Better Eyes | Friendly eye/looking-glass motif focused on rare grass, not creepy. |
| `clover-magnet.png` | Clover Magnet | Horseshoe magnet gently pulling clovers and sparkle pixels. |
| `premium-pasture.png` | Premium Pasture | Luxurious grass patch with golden clover and tiny flower accents. |
| `grassmaxxing.png` | Grassmaxxing | Ultimate radiant grass tuft, roots, clover, dew, and golden glow combined. |
| `honest-work.png` | Honest Work | Simple garden glove or hand with a small grass tuft, earnest and sturdy. |
| `patient-observation.png` | Patient Observation | Small notebook/binoculars looking at grass, quiet observation vibe. |
| `slay-footwork.png` | Slay Footwork | Stylish footstep in grass with pink sparkle accents, playful but readable. New dedicated icon; currently the game reuses `two-handed-technique.png`. |
| `perfect-pose.png` | Perfect Pose | Dramatic balanced pose silhouette or elegant foot/hand gesture with golden sparkles. New dedicated icon; currently the game reuses `dramatic-touch.png`. |
| `steady-tempo.png` | Steady Tempo | Tiny metronome or music-note pulse beside grass, calm rhythmic feel. New dedicated icon; currently the game reuses `mindful-contact.png`. |
| `encore-circle.png` | Encore Circle | Circular ring of grass sparkles and music-note-like pixels, no text. New dedicated icon; currently the game reuses `premium-pasture.png`. |

## Seed/Item Shop Icons

All item icons go in `public/assets/ui/items/` and must be `48x48`.

| File | Item | Visual Direction |
| --- | --- | --- |
| `seed-pouch.png` | Seed Pouch | Small cloth pouch open at the top, a few seeds visible. |
| `wild-spread.png` | Wild Spread | Seeds scattering from one grass patch into a nearby tiny sprout. |
| `field-journal.png` | Field Journal | Green field notebook with a pressed leaf/clover on the cover. |
| `quest-clipboard.png` | Quest Clipboard | Small clipboard with leaf checklist marks, no readable text. Missing/new. |
| `weather-jar.png` | Weather Jar | Glass jar containing tiny cloud, rain drop, and sun sparkle. |
| `compost-bin.png` | Compost Bin | Cozy wooden compost box with leaves and rich soil. |
| `bug-hotel.png` | Bug Hotel | Tiny wooden bug hotel with holes, twigs, and a leaf roof. |
| `rain-barrel.png` | Rain Barrel | Wooden rain barrel with blue water and a leaf floating on top. |
| `forager-trails.png` | Forager Trails | Little winding trail through grass with small paw/foot marks. Missing/new. |
| `sprinkler-timer.png` | Sprinkler Timer | Small timer dial attached to a sprinkler valve, no numbers. |
| `self-seeding-nozzle.png` | Self-Seeding Nozzle | Sprinkler nozzle spraying water and a few seeds together. |
| `sprinkler-network.png` | Sprinkler Network | Three small sprinkler heads linked by little hoses. Current file is `96x96`; replace with `48x48`. |
| `clover-press.png` | Clover Press | Little hand press flattening or preserving a clover, cute and simple. |
| `seed-catalog.png` | Seed Catalog | Small seed catalog booklet with packets/leaf marks, no text. |
| `pocket-sunshine.png` | Pocket Sunshine | Tiny pocket or pouch holding a warm sun glow. |
| `seed-satchel.png` | Seed Satchel | Larger seed bag/satchel with strap and visible seed kernels. |

## Automation/World System Icons

All automation/world icons go in `public/assets/world/` and must be `64x64`.

These are shown in the automation store and on the main screen. They need to be extra readable and charming.

| File | System | Visual Direction |
| --- | --- | --- |
| `tiny-sprinkler.png` | Tiny Sprinkler | Small brass/green sprinkler on grass, water arc droplets, clear round base. |
| `field-mouse.png` | Field Mouse Route | Cute small field mouse in 3/4 view beside a little grass trail. |
| `bee-hive.png` | Bee Hive Shift | Honey-gold beehive with a few bee pixels and flowers/grass at base. |
| `earthworm.png` | Earthworm Crew | Friendly earthworm emerging from soil with tiny grass roots. Must be exactly `64x64`; current asset is oversized. |
| `chicken.png` | Chicken Patrol | Small white/brown chicken pecking at grass, strong silhouette. |
| `sheep.png` | Sheep Grazing Loop | Round woolly sheep nibbling grass, cozy and compact. |
| `meadow-rabbit.png` | Meadow Rabbit Circuit | Small rabbit mid-hop near grass, long ears readable at 64 px. |

## Consistency Checks Before Delivery

- Every PNG has transparent background.
- No icon contains written words, labels, numbers, or UI frames.
- Every skill icon is exactly `96x96`.
- Every item icon is exactly `48x48`.
- Every world/automation icon is exactly `64x64`.
- Sprites remain readable when displayed at about half size.
- All filenames exactly match the tables.
- New dedicated skill icons may require code mapping updates after files are added:
  - `sprinkler-calibration.png`
  - `helper-routes.png`
  - `grazing-logistics.png`
  - `ecosystem-loop.png`
  - `slay-footwork.png`
  - `perfect-pose.png`
  - `steady-tempo.png`
  - `encore-circle.png`
- New item icons may require code mapping updates after files are added:
  - `quest-clipboard.png`
  - `forager-trails.png`

## Suggested Batch Strategy

Generate in three batches:

1. Automation/world icons first, because these are the most visible and include the oversized earthworm replacement.
2. Item shop icons second, because they are smaller and benefit from simpler silhouettes.
3. Skill tree icons third, because they need the most variation and should harmonize with the redesigned skill map.

After the files are in place, run the game and check:

- Main field HUD and automation panel readability.
- Store list icons at their actual displayed size.
- Skill tree icons at the zoomed-in tree scale.
- `npm run build`.
