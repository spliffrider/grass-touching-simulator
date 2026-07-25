# Grass Touching Simulator Project Manual

Grass Touching Simulator is a Phaser 3 browser game about keeping the Ancient
Grass alive while building a visible production ecosystem. The original
incremental game and the intermediate Scourge prototype are retired. There is
one canonical runtime.

## Runtime Routes

| Route | Purpose |
| --- | --- |
| `/` | Public ecosystem title screen |
| `?alpha` | Stable alias for the public title |
| `?redesign&playtest` | Direct ecosystem field with playtest controls |
| `?redesign&playtest&debugPanel` | Direct field with diagnostics |
| `?ecosystemPrototype` | Direct ecosystem field alias |

Retired parameters such as `?legacy`, `?perf`, `?stress`, and `?perfHarness`
fall through to the ecosystem title. They do not select hidden game code.

## Source Map

```text
src/
  main.ts
  viewport.ts
  game/
    data/
      audio-settings.ts
      build-info.ts
      credits.ts
    ecosystem/
      EcosystemCatalog.ts
      EcosystemSystem.ts
      EcosystemSave.ts
      EcosystemMemoryTree.ts
      EcosystemViewport.ts
      EcosystemFieldInput.ts
      EcosystemDomBridge.ts
      EcosystemAnimationBudget.ts
      EcosystemPerformanceMonitor.ts
      EcosystemHelperEffectScheduler.ts
      EcosystemHealthVisual.ts
      EcosystemHeroTextures.ts
      EcosystemTitleAtmosphere.ts
      EcosystemTitleLayout.ts
      EcosystemTouchCooldown.ts
    routing/
      GameRoute.ts
    scenes/
      EcosystemTitleScene.ts
      EcosystemPrototypeScene.ts
    systems/
      AudioSystem.ts
      SoundVariation.ts
```

## Ownership Boundaries

### EcosystemCatalog

Owns static definitions:

- resources and capacities
- helper identities and modes
- production recipes
- field-size ladder
- tile-stage enum
- touch-batch contracts

Definitions should remain data. Runtime state and purchases belong in
`EcosystemSystem`.

### EcosystemSystem

Owns deterministic gameplay:

- permanent and active state creation
- fixed production ticks
- Scourge and Care balance
- helper purchases, modes, and automation
- manual and automated touches
- cultivation and field expansion
- memory ranks and unlock rules
- compact tile arrays and dirty chunks

It must not create Phaser objects, read DOM state, or write browser storage.
Tests should exercise this module directly whenever a rule can be expressed
without rendering.

### EcosystemSave

Owns versioned permanent and active-field persistence. There is intentionally no
offline progress. Loading a field resumes the saved state without simulating
elapsed time.

### EcosystemPrototypeScene

Coordinates Phaser:

- creates display objects
- translates pointer input into model commands
- schedules bounded representative effects
- refreshes visible UI
- requests saves after meaningful changes
- exposes playtest diagnostics

Do not move deterministic economy rules into the scene. When this file grows,
extract a bounded visual or input concern rather than creating another gameplay
authority.

### EcosystemDomBridge

Provides semantic HTML controls and readable debug snapshots. Canvas remains the
visual game, while the bridge makes important controls and state available to
accessibility tools and browser automation.

### Viewport And Rendering

`EcosystemViewport` computes pan, zoom, LOD, and visible ranges.
`EcosystemAnimationBudget` bounds effects and ambient presentation.
`EcosystemPerformanceMonitor` records measured frame behavior.

The field may contain 10,000 logical tiles, but display-object count must stay
bounded by the viewport. Never add one persistent Phaser object or DOM control
per logical tile.

## Performance Rules

- Simulate at fixed ticks instead of performing recipe work every frame.
- Never scan every tile during a normal frame.
- Keep tile state in typed arrays and exceptional state in sparse collections.
- Redraw only dirty visible chunks.
- Pool impact effects, helper effects, and ambient objects.
- Cap representative automation effects independently of numerical throughput.
- Avoid allocations, formatting, and save serialization in hot loops.
- Resize render resources only when viewport dimensions change.
- Defer routine saves during layout, panning, and redraw work.
- Profile the ecosystem route before claiming a performance improvement.

Current browser diagnostics:

```js
document.documentElement.dataset.grassEcosystemPrototype
document.documentElement.dataset.grassEcosystemHarness
```

## Adding Gameplay

1. Add or update static definitions in `EcosystemCatalog.ts` or
   `EcosystemMemoryTree.ts`.
2. Implement the deterministic rule in `EcosystemSystem.ts`.
3. Add focused model tests.
4. Connect the action and bounded visual feedback in
   `EcosystemPrototypeScene.ts`.
5. Expose semantic state through `EcosystemDomBridge.ts` when players or browser
   automation need to inspect or trigger it.
6. Update save normalization if persistent state changed.
7. Exercise active-run and Memory Grove states in a browser.

## Assets

Runtime assets live under `public/assets/`. Only ship files referenced by the
title scene, ecosystem scene, social metadata, manifest, or current catalogs.
Design references that are not runtime inputs belong under `docs/` rather than
`public/`.

The current music track is:

```text
public/assets/music/lucid-field-theme.wav
```

Do not replace or remove player-facing art merely because it originated in an
earlier iteration. Remove it only when the current runtime and current design
documents have no consumer.

## Verification

Run the complete gate for every game change:

```sh
npm run check
```

The gate runs:

- ESLint
- Knip dead-code analysis
- Vitest
- strict TypeScript
- Vite production build

For visual, input, or performance-sensitive changes, also verify:

```text
http://127.0.0.1:5173/?redesign&playtest&debugPanel
```

Use at least `1280x720` and `390x844`. Check the active field, Memory Grove,
browser warnings, semantic DOM state, field interaction after resizing, and
bounded display/effect counts.

## Deployment And Handoff

- Production deploys through Vercel.
- Source syncs between Windows and the Mac mini through GitHub.
- Never copy source directly over SSH.
- Follow `docs/DESKTOP_MAC_SYNC_WORKFLOW.md`.
- Record substantial sessions under `handoffs/` and update
  `handoffs/LATEST.json`.
