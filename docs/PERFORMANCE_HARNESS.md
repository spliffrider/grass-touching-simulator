# Legacy Performance Harness

This harness measures the previous incremental game's `GameScene`. The route resolver intentionally sends `?perfHarness`, `?perf`, and `?stress` URLs to the legacy game.

Do not use its tile, redraw, frame, or object metrics as evidence that the Ancient Grass redesign performs well. Redesign performance work must profile the redesign route directly until a dedicated redesign harness is implemented.

Use this harness only to collect repeatable browser performance samples for legacy-game maintenance without manual clicking.

## Run

Start the dev server:

```sh
npm run dev
```

Open a stress harness URL:

```text
http://127.0.0.1:5173/?perfHarness&tiles=1200
```

`perfHarness` implies stress mode and enables the perf overlay. It runs these phases:

- `idle`
- `tapBurst`
- `skillOpen`
- `skillSelect`
- `storeOpen`
- `questOpen`
- `questScroll`
- `pan`
- `zoom`
- `saveStringify`
- `complete`

## Read Results

The harness writes JSON to:

```js
document.documentElement.dataset.grassPerfHarness
```

The current perf overlay snapshot is also available at:

```js
document.documentElement.dataset.grassPerf
```

Useful fields to compare across phone, tablet, and desktop runs:

- `visibleTiles`
- `tileViews`
- `tileMode`
- `layoutPasses`
- `redraws`
- `redrawQueued`
- `staleTiles`
- `commonStamps`
- `maxFrameDeltaMs`
- `frameSpikes`
- `displayObjects`
- `activeTweens`
- `hotspots`
