# Grass Touching Simulator Agent Notes

Grass Touching Simulator is a Phaser 3 browser game. Performance is a first-class project constraint, especially on phones and tablets.

## Performance Rules

- Profile before optimizing. Prefer `?perf`, `?stress&perf&tiles=1200`, and the repeatable harness at `?perfHarness&tiles=1200`.
- Treat every-frame and every-tick work as suspicious until measured: `update`, regrowth, automation systems, UI refresh, save serialization, big-number formatting, tile layout, render-texture work, tweens, particles, and object creation/destruction.
- Do not refactor hot paths blindly. Add or use timing markers first, then make targeted changes.
- Keep ordinary tap/regrow/automation updates from forcing board layout or common-layer redraws.
- Avoid expensive graphics resource operations in normal gameplay. `RenderTexture.resize(...)` should only happen when viewport dimensions change.
- On large fields, preserve viewport culling and dirty-tile overlays. Phone and tablet runs should not treat all field tiles as visible.
- Watch allocation in hot loops. Reuse cached tile keys and pooled display objects where possible.
- Saves should be queued/deferred during active layout, panning, or redraw work unless the page is hiding/shutting down.

## Required Checks For Performance-Sensitive Changes

Run:

```sh
npm run build
```

For browser perf checks, use:

```text
http://127.0.0.1:5173/?perfHarness&tiles=1200
```

Read:

```js
document.documentElement.dataset.grassPerfHarness
```

Compare at least these fields across phases:

- `visibleTiles`
- `layoutPasses`
- `redraws`
- `redrawQueued`
- `maxFrameDeltaMs`
- `frameSpikes`
- `displayObjects`
- `activeTweens`
- `hotspots`

## Reference Docs

- `docs/PERFORMANCE_NOTES.md`: performance postmortems and guardrails.
- `docs/PERFORMANCE_HARNESS.md`: harness usage and exported metrics.
- `docs/PROJECT_MANUAL.md`: project architecture and feature workflow.
