# Codebase Audit - 2026-07-25

## Decision

Ancient Grass: Ecosystem is the only shipped game. The original Phaser game and
the abandoned intermediate redesign prototype are retired rather than kept as
fallbacks. Old query parameters now resolve to the ecosystem title screen.

## Removed

- Original `GameScene`, `TitleScene`, their data catalogs, systems, types, UI
  helpers, tests, harnesses, and unused media.
- Intermediate `RedesignPrototypeScene`, its isolated redesign modules, and its
  tests.
- Obsolete design reports, duplicate research, mockups, TODO files, old title
  composites, duplicate PWA icons, unused character/class art, unused skill and
  item icons, unused tile variants, and the retired Memory Grove soundtrack.
- Unused ecosystem exports, a redundant route flag, and unreachable audio
  events/mobile touch synthesis.

## Ongoing Guardrails

- `npm run audit:code` runs Knip for unused files, dependencies, and exports.
- `npm run check` now runs lint, the dead-code audit, all tests, and the
  production build.
- Current performance snapshots are
  `document.documentElement.dataset.grassEcosystemPrototype` and
  `document.documentElement.dataset.grassEcosystemHarness`.
- Retired legacy performance URLs no longer select another runtime.

## Measured Result

| Surface | Before | After | Change |
| --- | ---: | ---: | ---: |
| Source files | 75 | 27 | -64% |
| Source lines | 45,807 | 12,915 | -72% |
| Application JavaScript | 998.33 kB | 280.15 kB | -72% |
| Application JavaScript, gzip | 259.54 kB | 76.46 kB | -71% |
| Public files | 162 | 68 | -58% |
| Public payload | 24.89 MiB | 11.87 MiB | -52% |

Phaser remains a separate 1,198.79 kB vendor chunk (319.33 kB gzip).

## Verification

- `npm run check`: 18 test files and 154 tests passed.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Knip: no unused files, dependencies, or exports.
- Madge: no circular dependencies from `src/main.ts`.
- `git diff --check`: clean.
- Desktop 1280x720:
  - ecosystem title loaded;
  - retired `?legacy` alias opened the ecosystem title;
  - active 100x100 field rendered 100 pooled chunk views;
  - Memory Grove rendered;
  - touch input registered;
  - no browser errors, frame spikes, horizontal overflow, or full-field scans.
- Phone 390x844:
  - title and fresh 1x1 run rendered without horizontal overflow;
  - touch input registered;
  - no browser errors, frame spikes, or full-field scans.

## Remaining Opportunities

- `public/assets/music/lucid-field-theme.wav` is current and intentionally kept,
  but at 7.91 MiB it is now the dominant public asset. A later audited
  high-quality browser encoding could reduce startup transfer without changing
  the composition.
- `EcosystemPrototypeScene.ts` remains a large orchestration class. Future
  extraction should follow measured ownership boundaries and keep hot-path
  behavior unchanged.
- Phaser dominates JavaScript transfer. Any engine-level reduction should be
  evaluated separately from gameplay code and only with browser compatibility
  evidence.
