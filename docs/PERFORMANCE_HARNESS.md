# Performance Harness

Use the in-game harness to collect repeatable browser performance samples without manual clicking.

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
- `layoutPasses`
- `redraws`
- `redrawQueued`
- `maxFrameDeltaMs`
- `frameSpikes`
- `displayObjects`
- `activeTweens`
- `hotspots`
