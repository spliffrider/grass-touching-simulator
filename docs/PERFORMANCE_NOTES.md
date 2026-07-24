# Performance Notes

## Board redraw hitch postmortem

Date: 2026-06-12

This note documents the performance issue that made the game feel slow even on a small or medium field. The important lesson: the game was not simply "too much for a web browser." The main slowdown came from an expensive board redraw path being used during ordinary play.

## Symptoms

The game felt sluggish after only a few field expansions, even when the field and object counts were still modest.

One bad perf overlay sample looked like this:

```text
PERF  fps 79  tiles 62/62  views 0  objects 67  emitters 7  tw 4  dt 74  spikes 6  layout 1/1  fx 1  save queued
```

The suspicious parts were:

- `dt 74`: a frame took about 74 ms, far above the 16.7 ms budget for 60 FPS.
- `spikes 6`: repeated frame spikes were happening.
- `layout 1/1`: the board was doing a layout pass and a common layer redraw.
- Low object, emitter, and tween counts: this was not primarily caused by too many visible effects.

After the fix, a comparable sample looked like this:

```text
PERF  fps 118  tiles 92/92  views 92  objects 532  emitters 12  tw 22  dt 9  spikes 0  layout 1/1  fx 1
hot regrow 2.3  layout 0.2  ui 0.2  ready 0.2
```

That told us the field could be larger and busier while staying smooth, as long as the redraw path stayed cheap.

## Root Cause

`GameScene.layoutBoardLayers()` was resizing the shared tile `RenderTexture` during board redraws. Resizing a render texture is expensive because it can force GPU/resource work. Doing it during normal redraws caused visible frame spikes.

The render texture only needs to resize when the viewport dimensions change. It should not resize just because grass tiles changed, a tile was touched, or the board layer needs to be cleared and redrawn.

The fix tracks the last known common layer size:

- `commonTileLayerWidth`
- `commonTileLayerHeight`

`commonTileLayer.resize(...)` now only runs when `this.scale.width` or `this.scale.height` actually changes.

## Other Fixes From The Same Round

Small and medium fields now keep live pooled tile views instead of stamping everything into the common render texture. For fields at or below `LIVE_TILE_VIEW_FIELD_LIMIT` in `src/game/scenes/GameScene.ts`, live views are cheaper and feel more responsive than repeatedly redrawing the render texture.

The current threshold is:

```text
LIVE_TILE_VIEW_FIELD_LIMIT = 180
```

The 120-patch threshold was too low. It caused a visible smoothness cliff around 140-150 patches because normal play switched into the render-texture batching path while the board was still small enough for live tile views to run better.

The tile view pool also stopped running hidden infinite glint tweens on every pooled tile view. Infinite tweens on pooled or invisible objects are dangerous because they can keep adding per-frame work even when the object is not visually important.

## Guardrails

Do not call `RenderTexture.resize(...)` during ordinary board redraws. Resize only when the viewport changes.

On compact large fields, avoid mixing viewport culling with common-layer redraw stamping. If only 80-120 tiles are visible, live viewport tile views are cheaper than creating temporary views and stamping them back into the common render texture during pan, zoom, or menu interactions.

When a blocking overlay is open, defer common-layer redraw queue work. Skill, store, quest, journal, automation, and options panels should not compete with background tile stamping in the same frame. Let queued board catch-up resume after the overlay closes.

Skill-tree hover and selection should stay local to the skill UI. Do not call the full HUD refresh path from `previewSkill`; repeated pointerover events can otherwise refresh resources, milestones, button attention, weather visuals, and all skill nodes before the player even clicks.

Before blaming browser limits, check the perf overlay:

- If `dt` and `spikes` are high while object/tween/emitter counts are low, suspect a layout, render texture, save, or browser rendering bottleneck.
- If `layout X/Y` is active and `hot layout` is high, inspect board redraw and tile positioning code first.
- If `queue`, `stale`, or `stamps` are high while opening a menu, inspect common redraw scheduling before optimizing the menu itself.
- If `ui:skillTree` or `text:set` spikes while hovering skills, inspect node render-state caching and avoid setting Phaser text/graphics properties that have not changed.
- If `hot ...` scopes are low but `dt` is high, suspect work outside the profiled update scopes, such as GPU work, browser painting, garbage collection, or Phaser internals.
- If `tw` climbs steadily, look for forgotten infinite tweens or pooled objects that still animate while hidden.
- If `objects` climbs steadily while visible activity does not, inspect pooling and destruction paths.

For small and medium fields, prefer live pooled tile views when they avoid full render-texture churn. For large fields, batching/stamping can still be useful, but only if redraws are infrequent and the render texture is not being resized.

## Perf Overlay Cheatsheet

Use `?perf` to show the overlay during normal play:

```text
/?perf
```

Useful stress URLs:

```text
/?stress&perf&tiles=120
/?stress&perf&tiles=500
```

Important fields:

- `fps`: current loop FPS.
- `tiles A/B`: visible tiles over total tiles.
- `views`: live tile views currently in the scene.
- `objects`: Phaser display object count.
- `emitters`: active burst emitter count.
- `tw`: active tween count.
- `dt`: max frame delta seen in the recent sample.
- `spikes`: frame spikes above the threshold.
- `layout X/Y`: layout passes and common layer redraws since the last overlay refresh.
- `queue`: common-layer redraw entries waiting to be stamped.
- `stale`: tile keys known to be stale in the common layer.
- `stamps`: common-layer render texture stamp operations during the last sample.
- `fx`: current effect quality scalar.
- `hot ...`: slowest profiled update scopes during the sample window.

## Files To Check First

- `src/game/scenes/GameScene.ts`
  - `layoutBoardLayers`
  - `needsTileView`
  - `createPooledTileView`
  - `refreshPerfPanel`
  - `profileScope`
- `src/game/systems/FieldSystem.ts`
  - field expansion
  - regrowth
  - tile touch mutation paths

## Main Lesson

The browser was not the blocker. The killer issue was using an expensive render-texture resize path during normal gameplay. Keep expensive graphics resource operations out of the hot redraw path, and use the perf overlay's `dt`, `spikes`, `layout`, `tw`, `objects`, and `hot ...` fields before guessing.

## 2026-07-15 Ecosystem Adaptive Pool Pass

The ecosystem prototype was profiled on its own redesign route before this
change. The fixed-tick economy was already inexpensive, but a fresh 1x1 field
eagerly created 360 near-tile images, 100 chunk images, and one display object
for every Memory rank pip. That produced 1,483 Phaser display objects before
the player needed almost any of them.

Near-tile and chunk image pools now grow only to the current projection's
bounded visible count. They retain their high-water mark after growth so zoom
and field-size transitions do not destroy and recreate graphics. Multi-rank
Memory pips are drawn into one `Graphics` object per node and redraw only when
the owned rank changes.

Measured on `?redesign&ecosystemPrototype&playtest&debugPanel`:

- Fresh 1x1 field: 740 display objects, 1 pooled tile view, 0 pooled chunk
  views, 144 FPS, no frame spikes, and about 0.03 ms average frame work.
- Rapid-touch 1x1 run: touch action about 0.4 ms with no frame spikes.
- 100x100 field: 10,000 logical tiles represented by 100 rendered chunk views,
  840 display objects, 144 FPS, no full-field scans, and about 0.04 ms average
  frame work.
- 390x844 fresh field: 60 FPS, no frame spikes, and about 0.01 ms average frame
  work.

These figures come from the ecosystem redesign harness. The legacy 1,200-tile
`GameScene` harness was not used and is not evidence for this architecture.

## 2026-07-16 Pre-Main Startup And Animation Budget

The production ecosystem title and field music are now loaded after each scene
has built its first usable visual state. Multi-megabyte audio no longer blocks
the title screen or the first playable field from appearing.

Near-field motion also has explicit per-frame budgets:

- Desktop: at most 144 representative tile transforms.
- Phone: at most 48 representative tile transforms.

The sample is distributed across the visible tile pool, while every rendered
tile keeps real state and is reset to a stable transform when the projection is
redrawn. Far fields continue to use at most 100 summarized chunk views.

The redesign debug snapshot now reports `animatedTileViews`. Its heavier object
count and JSON snapshot refresh runs twice per second instead of four times per
second. The first-sprinkler attention animation also consumes a cached
affordability flag rather than recomputing purchase cost every frame.

These changes are structural guardrails, not new benchmark claims. Re-run the
ecosystem-specific desktop and phone harness after hands-on title/gameplay
verification before merging to `master`.

## 2026-07-24 Dense Automation Presentation Budget

The universal automated-touch system was profiled on the ecosystem redesign
route before changing its presentation path. A 100x100 field with all eight
helper families active at about 245 automated touches per second remained
computationally inexpensive, but a 390x844 viewport could overlap 28 pooled
effects, 35 tweens, and several large helper labels. The measured problem was
presentation congestion rather than simulation work.

Helper pulses now enter a fixed-size round-robin scheduler. Repeated cycles from
the same helper combine into one payload, every helper gets a fair turn, and
only the representative animation and audio are delayed. Mechanical touches,
healing, Run Touches, resources, and field progress still resolve on the
original fixed production tick.

The playtest panel includes a repeatable `Stress automation` control. It creates
a 100x100 field with 12 copies of all eight helpers, rank-ten Speed and Impact,
filled production buffers, and 10,000 compact logical tiles. The redesign
harness now reports presentation cadence, queued pulse payload, launches,
represented pulses, active feedback labels, effects, and tweens.

Measured after scheduling on
`?redesign&ecosystemPrototype&playtest&debugPanel`:

- 390x844 viewport at roughly 5,537 automated touches per second: zero frame
  spikes, about 0.086 ms average frame work, 1.3 ms maximum frame work in the
  sampled window, 6 active effects, and 9 active tweens at capture.
- An eight-second sustained phone-sized sample kept queued pulse payload between
  48 and 71 while presentations continued, confirming batching rather than an
  accumulating backlog.
- 1280x720 at roughly 3,228 automated touches per second: zero frame spikes,
  about 0.145 ms average frame work, 2 ms maximum frame work, 8 active effects,
  and 12 active tweens at capture.
- Both views represented the 100x100 field with 100 chunk views and performed no
  per-frame full-field scan.

The phone-sized result is a browser viewport measurement, not physical
low-powered phone emulation. It proves bounded architecture and catches visual
regressions; a real-device pass is still required before making hardware-wide
FPS claims. The legacy 1,200-tile harness was not used.
