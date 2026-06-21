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
- `docs/REMOTE_MAC_MINI_SETUP.md`: SSH/GitHub/Vercel setup for the always-on Mac mini.
- `docs/DESKTOP_MAC_SYNC_WORKFLOW.md`: daily desktop-to-Mac handoff and resume workflow.

## Cross-Machine Workflow

- The Windows desktop is the preferred interactive workstation when home.
- The Mac mini is the always-on Codex Remote host for work-away sessions.
- Sync project source through GitHub, not by SSH-copying source files.
- Use `node scripts/sync-mac-mini.mjs status` to compare desktop and Mac state.
- Use `node scripts/sync-mac-mini.mjs handoff` after committing/pushing desktop work before shutting down.
- Use `node scripts/sync-mac-mini.mjs resume` after booting the desktop to pull GitHub/Mac-side work back locally.
- Add `--build` to `handoff` or `resume` when build verification is desired.
- Keep machine-local files such as `.vercel/`, `node_modules/`, `dist/`, browser saves, and secrets out of Git.

## Handoff Documents

- Keep all handoff artifacts in `handoffs/` at the project root.
- When reading or writing handoffs, look in `handoffs/` first instead of `docs/`.
- At the start of a new session, read `AGENTS.md`, then `handoffs/LATEST.json`, then the latest handoff file referenced there, then run `git status --short`.
- At the end of a substantial session, create a dated handoff named `handoffs/HANDOFF_YYYY-MM-DD_SHORT_TOPIC.json` and update `handoffs/LATEST.json`.
- Handoffs should capture: current user goal, changes made, files touched, verification run, current git status, known issues, next recommended steps, and anything future agents should not revert.
- Keep long-lived architecture and design reference material in `docs/`; keep short-lived session state in `handoffs/`.
