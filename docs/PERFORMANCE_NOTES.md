# Ecosystem Performance Notes

The Ancient Grass ecosystem is the only runtime performance surface. Measure it
directly through `?redesign&playtest&debugPanel`.

## Guardrails

- Profile before changing a hot path.
- Keep production on fixed ticks rather than per-frame recipe work.
- Never scan all logical tiles during a normal frame.
- Keep near-tile and chunk pools bounded by the viewport.
- Cache common visuals and redraw only dirty visible chunks.
- Reuse display objects, tweens, text, and temporary collections.
- Cap representative effects independently of mechanical throughput.
- Keep save serialization out of active layout, pan, and redraw work.
- Resize render resources only when the viewport actually changes.
- Treat DOM snapshot generation and debug instrumentation as budgeted work.

Current snapshots:

```js
document.documentElement.dataset.grassEcosystemPrototype
document.documentElement.dataset.grassEcosystemHarness
```

## 2026-07-15 Adaptive Pool Pass

The fixed-tick economy was already inexpensive, but a fresh 1x1 field eagerly
created 360 near-tile images, 100 chunk images, and one display object for every
Memory rank pip. That produced 1,483 Phaser display objects before the player
needed almost any of them.

Near-tile and chunk pools now grow only to the current projection's bounded
visible count. They retain their high-water mark after growth so zoom and
field-size transitions do not destroy and recreate graphics. Multi-rank Memory
pips are drawn into one `Graphics` object per node and redraw only when the
owned rank changes.

Measured on `?redesign&ecosystemPrototype&playtest&debugPanel`:

- Fresh 1x1 field: 740 display objects, 1 pooled tile view, 0 pooled chunk
  views, 144 FPS, no frame spikes, and about 0.03 ms average frame work.
- Rapid-touch 1x1 run: touch action about 0.4 ms with no frame spikes.
- 100x100 field: 10,000 logical tiles represented by 100 rendered chunk views,
  840 display objects, 144 FPS, no full-field scans, and about 0.04 ms average
  frame work.
- 390x844 fresh field: 60 FPS, no frame spikes, and about 0.01 ms average frame
  work.

## 2026-07-16 Startup And Animation Budget

Title and field music load after each scene has built its first usable visual
state. Multi-megabyte audio does not block the title or first field from
appearing.

Near-field motion has explicit per-frame budgets:

- Desktop: at most 144 representative tile transforms.
- Phone: at most 48 representative tile transforms.

The sample is distributed across the visible tile pool, while every rendered
tile keeps real state and resets to a stable transform when the projection is
redrawn. Far fields use at most 100 summarized chunk views.

The debug snapshot reports `animatedTileViews`. Its heavier object count and
JSON snapshot refresh runs twice per second. The first-sprinkler attention
animation uses a cached affordability flag instead of recomputing purchase cost
every frame.

## 2026-07-24 Dense Automation Presentation Budget

A 100x100 field with all helper families active remained computationally
inexpensive, but a phone viewport could overlap dozens of pooled effects,
tweens, and helper labels. The measured problem was presentation congestion,
not simulation work.

Helper pulses now enter a fixed-size round-robin scheduler. Repeated cycles from
the same helper combine into one payload, every helper gets a fair turn, and
only representative animation and audio are delayed. Mechanical touches,
healing, Run Touches, resources, and field progress resolve on the fixed
production tick.

The playtest panel includes `Stress automation`. It creates a 100x100 field with
12 copies of every helper, rank-ten Speed and Impact, filled buffers, and 10,000
compact logical tiles.

Measured on `?redesign&ecosystemPrototype&playtest&debugPanel`:

- 390x844 at roughly 5,537 automated touches per second: zero frame spikes,
  about 0.086 ms average frame work, 1.3 ms maximum frame work, 6 active
  effects, and 9 active tweens at capture.
- An eight-second phone-sized sample kept queued representative payload between
  48 and 71 while presentations continued, confirming batching instead of an
  accumulating visual backlog.
- 1280x720 at roughly 3,228 automated touches per second: zero frame spikes,
  about 0.145 ms average frame work, 2 ms maximum frame work, 8 active effects,
  and 12 active tweens at capture.
- Both views represented the 100x100 field with 100 chunk views and performed
  no per-frame full-field scan.

Viewport measurements prove bounded architecture and catch regressions. They do
not replace real-device testing on a physically slow phone.
