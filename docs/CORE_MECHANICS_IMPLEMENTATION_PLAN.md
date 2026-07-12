# Core Mechanics Implementation Plan

This plan chunks the core mechanics redesign into playable, reviewable milestones. Each milestone should keep the game buildable and should leave the branch in a state where the next agent can continue without guessing the intent.

Reference design doc:

- `docs/CORE_MECHANICS_REDESIGN.md`

Project constraints:

- Preserve mobile/tablet performance.
- Preserve the game's graphical identity where it still fits: grass tile art, meadow backgrounds, emerald UI framing, effects, music, and general pixel-art craft should be adapted into the redesign instead of discarded.
- Do not add offline progress.
- Keep old production behavior recoverable on `master`; this branch can replace canon.
- Treat the old implementation as obsolete gameplay architecture. Mine it for concepts, assets, music, art, tuning lessons, and helper ideas only when they serve the new game.
- New gameplay rules should live in new-canon modules first. Legacy systems do not count as the foundation for milestone acceptance.
- Prefer pure systems for new game rules and keep Phaser scenes focused on orchestration.
- Run `npm run check` after each milestone unless a milestone explicitly changes only prose.
- Do not use `?stress` as proof of redesign progress; it is an old-game performance harness path.

## Redesign Branch Rule

This branch is a rebuild, not a compatibility patch.

- Old scenes, stores, quests, automation, saves, and tests are obsolete unless deliberately recast.
- Old graphical/audio assets should be preserved, reused, edited, or replaced only when needed so the rebuild still feels like Grass Touching Simulator.
- Old concepts can survive, but only after being translated into the new run/dormancy/meta structure.
- Tests for old systems do not count as redesign safety net.
- A playable redesign slice should avoid showing legacy HUD, legacy currencies, legacy stores, field-item panels, minimaps, or quest surfaces unless that slice is specifically recasting them.

## Milestone 0: Safety Net And Roadmap

Goal:

- Add low-noise linting, unit testing, and this implementation roadmap before gameplay changes.

Changes:

- Add `npm run lint`.
- Add `npm run test`.
- Add `npm run check`.
- Add Vitest for pure TypeScript unit tests.
- Add ESLint flat config focused on bug-catching rules.
- Add baseline tests for new-canon pure systems only.

Acceptance:

- `npm run lint` passes.
- `npm run test` passes.
- `npm run build` passes.
- `docs/CORE_MECHANICS_IMPLEMENTATION_PLAN.md` exists.

## Milestone 1: New Run Spine

Goal:

- Make the new Ancient Grass survival loop exist in a clean prototype route without using the old game scene as the playable surface.

Gameplay:

- Add Ancient Grass HP state.
- Add max HP.
- Add global HP drain.
- Touching the Ancient Grass/root field restores HP.
- Effective healing grants temporary Run Touches.
- Track effective healing separately from overheal.
- Overheal does not count toward permanent progress.
- Add a simple new-canon HP/Run Touch readout.
- Keep the prototype structurally distinct from the legacy game while preserving the recognizable grass/meadow/emerald visual language.

State concepts:

- `RunSpineState.ancientGrass.currentHp`
- `RunSpineState.ancientGrass.maxHp`
- `RunSpineState.ancientGrass.effectiveHealingThisRun`
- `RunSpineState.ancientGrass.overhealThisRun`
- `RunSpineState.economy.runTouches`

Implementation notes:

- Use a new pure system under `src/game/redesign/` for drain/heal/run-economy calculations.
- Use a separate prototype route such as `?redesign` for the first playable slice.
- Reuse existing art assets directly where they support the new loop: meadow background, grass tiles, dirt tiles, emerald panel frame, and fleck/spore effects are valid in Milestone 1.
- Reintroduce the old game's warmth through new-canon presentation layers: Sensi commentary, a small run feed, emerald/bronze UI framing, and touch-unlocked music are valid as long as they do not bring back obsolete progression systems.
- Do not wire Milestone 1 into `GameScene`, `FieldSystem`, old saves, old shops, old quests, or old HUD.
- Do not show old permanent `grassTouches`, seeds, gold, automation, store, minimap, quest, or field-item surfaces in the prototype.
- Dormancy can exist as a minimal phase transition if it makes the prototype loop easier to understand, but full dormancy UX belongs in Milestone 2.

Acceptance:

- Starting a run shows Ancient Grass HP.
- HP drains over time.
- Touching the prototype root field heals missing HP.
- Scourge wounds create priority touch targets on the root field.
- Only active root tile hitboxes count as manual healing input; empty canvas clicks do not wake the intro, heal HP, award Run Touches, or advance first-run objectives.
- Normal roots enter a short recovery after valid touches; immediate repeat clicks on a recovering normal root are rejected with feedback instead of awarding more Run Touches.
- Healing increases Run Touches.
- Effective healing is capped to missing HP.
- Overheal is tracked separately or ignored for meta credit.
- The prototype can start from one active root tile and expand the active field through new-canon objectives.
- The prototype route does not display the legacy game UI.
- `npm run check` passes.

Verification routes:

- `?redesign`: current new-canon prototype.
- `?redesign&playtest`: human playtest mode with accelerated first-loop pacing plus visible dev controls for forcing Game Over, granting GT, restarting the run, and resetting the redesign memory save.
- `?redesign&fastDormancy`: same prototype tuned for quick collapse/summary verification while still allowing the first tutorial wound and first memory purchase in a guided smoke.
- `?redesign&resetMemory`: repeatable fresh first-run checks; the prototype debug dataset includes active root hitboxes and wounded root ids for smoke automation.

Tests:

- HP drain clamps at zero.
- Healing clamps at max HP.
- Effective healing excludes overheal.
- Run Touches increase from effective healing.
- Pure overheal grants no Run Touches.
- Spending Run Touches does not reduce effective-healing payout accounting.
- Wounded roots can open, clear on targeted touch, and increase Scourge pressure while open.

## Milestone 2: Dormancy And Permanent Grass Touches

Goal:

- Close the loop from run failure to permanent progress.

Gameplay:

- HP reaching zero ends the run in dormancy.
- Show a dormancy summary.
- Convert effective healing into permanent Grass Touches.
- Allow starting the next run.
- Next run starts fresh but keeps permanent Grass Touches.

State concepts:

- Permanent meta `grassTouches`.
- Current run `runTouches`.
- Run history: survival time, peak HP or peak Scourge stage if available, effective healing.

Implementation notes:

- Avoid full old-save migration in this slice.
- Use an explicit new-canon save namespace or version boundary before this ships broadly.
- Make the reset path clear and testable.
- Current prototype namespace: `grass-touching-simulator.redesign-memory.v1`.
- Current prototype persistence is deliberately narrow: permanent Grass Touches plus permanent upgrade ids only.
- Use `?redesign&resetMemory` for repeatable browser checks.
- Do not save active-run HP, wounds, Scourge pressure, Run Touches, or old-game currencies in this milestone.

Acceptance:

- Fresh runs can show an authored inherited-field intro before Scourge drain begins.
- Fresh intro smoke confirms the Sensi callout is visible, empty canvas clicks do not advance the intro, and a real root click hides the callout while waking the run.
- Wide and compact first-run presentation avoids duplicate guidance: advisor-capable layouts suppress the center intro card and visual bottom prompt until the first touch, while tiny layouts without the advisor retain the callout.
- Prototype HUD keeps the player portrait/status separate from Sensi's advisor dialogue.
- Compact HUD smoke confirms player/advisor identity stays separated at medium and tall-phone widths, with the advisor panel replacing the separate intro callout on compact layouts.
- Field expansion has a visible wake beat that uses existing root, ring, and spore/fleck art without changing objective or reward rules.
- Wound feedback has a visible marker and open/seal effects without changing wound timing, healing, rewards, or root hitboxes.
- Effective healing has a visible root-to-HP-bar mote and HP bar flash without changing healing amounts, Run Touch rewards, or HP math.
- Root recovery has a visible blue halo/readiness cue and repeat-click feedback without changing cooldown durations, healing amounts, Run Touch rewards, or root hitboxes.
- Scourge pressure has visible warning/wound/collapse beats without changing drain, wound timing, wound selection, rewards, dormancy math, or root hitboxes.
- Dew Pulse provides a first recast in-run tool: spend 22 Run Touches to heal Ancient HP immediately for 10 HP without minting replacement Run Touches.
- The old run feed is hidden from the main play layout while retained as internal event history.
- Fresh runs without Tiny Sprinkler Memory reserve no equipment-rail space and expose no equipment purchase controls.
- Tiny Sprinkler Memory reveals the Field Equipment window with only the sprinkler row; Field Mouse, Bee Hive, Earthworm, Chicken, Sheep, and Meadow Rabbit rows appear only after their dedicated license Memories.
- The Field Equipment window grows without blank locked rows, uses a height-aware desktop rail, and uses a compact two-column layout on phones. It must not overlap the HUD, prompt, field frame, or playtest-free production viewport.
- Each unlocked helper can be bought repeatedly with current-run RT, resets at dormancy, and contributes only effective healing to RT and permanent payout.
- First-purchase cost and output must widen substantially by tier. Current endpoints are 16 RT / 2 HP for Tiny Sprinkler and 360 RT / 40 HP for Meadow Rabbit, with distinct pulse intervals and escalating repeat-purchase growth.
- HP zero presents a full-screen Memory Grove game-over/meta screen instead of a small gameplay overlay.
- The game-over/meta screen is a hard run-ending state: active run timers, wound pressure, and Tiny Sprinkler automation stop once dormancy begins.
- The dormancy report is split into explicit run-over copy, a permanent GT reward line, conversion summary stats, lost Run Touches, and a visible next-run action hint.
- Dormancy guidance detects whether any unlocked, unowned Memory is affordable. Low-GT runs say that GT is banked and allow an immediate next run instead of falsely requiring a purchase.
- The meta screen separates run summary from a larger old-style hex-node Memory Skill Tree, shows a selected-memory detail panel, includes seventeen functional memory nodes, gives post-purchase next-run feedback, and restarts only through the explicit `Begin Next Run` button.
- The Memory Skill Tree is a masked, scalable viewport with bounded 60%-180% zoom, pointer-anchored wheel zoom, explicit minus/reset/plus controls, and drag-pan above 100%. Future skills can extend the catalog without turning the whole Grove into a tiny fixed diagram.
- Memory node identity, branch presentation, icon, copy, and normalized position come from one shared catalog rendered in a 1600x1100 logical world. Overview nodes show only icon and name; hover/focus moves the full explanation and enlarged animated icon into the detail presentation. Tests reject connector crossings, connector-through-node collisions, and overlapping interactive cards.
- The first second tier has real run effects: faster manual recovery, lower base drain, stronger sprinkler pulses, lower wound pressure, and a stronger Last Stand revival. Save version 1 remains compatible because the persistent schema already stores normalized upgrade ids.
- Compact Memory Grove layouts keep tree node labels and hitboxes separated, move full skill information into the selected-memory panel, and preserve a large unobstructed next-run action.
- `Begin Next Run` is visually dominant and gently animated while keeping a stable interactive area.
- The redesign route uses the Lucid track asset converted from `docs/lucid.aif` to `public/assets/music/lucid-field-theme.wav`.
- Options pauses active-run drain, wound pressure, and automation timing while open, and it cannot remain layered over a dormancy transition.
- Compact status/player/advisor panels stack without overlapping each other's readable content.
- Public Open Graph/Twitter metadata names the Ancient Grass alpha, describes the Scourge/Memory loop, and references a checked-in current-canon preview asset rather than legacy title art.
- The bare production URL launches the redesign as an honest public alpha without playtest controls and carries a dated Alpha Test browser/HUD identity. `?alpha` remains an alias, `?legacy` preserves the previous game, and existing legacy performance/stress harness query routes retain their old routing.
- HP zero reliably enters dormancy once.
- Dormancy payout uses effective healing, not unspent Run Touches. Current prototype tuning converts 5 effective HP into 1 permanent GT.
- Spending Run Touches later will not reduce permanent payout.
- Starting next run preserves permanent Grass Touches and resets run-only values.
- Prototype HUD shows a new-canon objective line instead of using the obsolete quest system.

Tests:

- Dormancy conversion awards expected permanent Grass Touches.
- Dormancy conversion uses the published 1 permanent GT per 5 effective HP tuning.
- Run values reset.
- Permanent values persist.
- Re-entering dormancy does not double-award the same run.
- Redesign memory snapshots normalize bad/old data and reject incompatible save versions.
- Permanent-memory tests cover all eleven upgrade ids, prerequisite gates, save round-tripping, Field Satchel capacity, and each second-tier run effect.
- Memory catalog tests require presentation data for every permanent upgrade and reject unrelated orthogonal connector crossings.
- Field Kit catalog/layout tests require unique tool ids and icons, valid descriptive metadata, one-column seven-slot geometry, stable hotkey mapping, non-overlapping desktop/phone rail placement, clamped pages, and correct future overflow behavior.
- First-run objectives advance in order from first healing through four one-tile care upgrades, 2x2 and 3x3 root-network expansion, first wound triage, a three-wound `Hold the Line` pressure lesson, dormancy, and memory purchase.
- Each run's field expansion follows the new objective sequence: remain at 1 active root through `Soft Loam`, `Dew Veins`, and `Root Heart`; open 2x2 with `Ancient Crown` at 36 run-local care RT; open 3x3 at 50 care RT; then open 5x5 after `Hold the Line`.
- One-tile mastery grants real manual-healing and recovery benefits for the current run. Dormancy resets mastery and field size to 1x1, while permanent GT and purchased Memory upgrades carry forward. The isolated tile uses reduced Scourge drain until the first expansion without slowing elapsed time or pressure growth.
- Browser smoke covers the one-tile chapter with real root clicks: each mastery rank appears while `activeRootCount` remains 1, the thirteenth paced playtest touch reaches `Ancient Crown` and opens 2x2, and the run remains active after expansion.
- Browser smoke covers the first wound triage path with real active-root clicks: master the opening tile, earn 50 care RT in the run to open 3x3, heal the first reported wounded root, continue the `Hold the Line` pressure lesson, and confirm the field remains 3x3 until that lesson completes.
- Browser smoke covers the run reset: after reaching a larger field and entering dormancy, `Begin Next Run` returns to 1 active root at mastery rank 0 while permanent GT and purchased Memory upgrades remain.
- Browser smoke covers root recovery: after a valid root touch, the touched root reports `recovering`, `recoveryRatio < 1`, and `recoveryMarkerVisible`; an immediate repeat click on that same root does not award Run Touches, while the same root awards again after recovery expires.
- Browser smoke covers the fast first loop: wake the field, complete wound triage, reach dormancy, verify permanent payout persisted, buy Soft Touch, and start the next run with run-only values reset and Soft Touch preserved.
- Browser smoke verifies player/advisor panel debug text: player panel remains `Grass Toucher`, Sensi dialogue remains in `Sensi // Advisor`, and the split survives the first real root click.
- Browser smoke covers compact layout at 640x720 and 390x844: player and advisor panels are visible and non-overlapping, the first real root click keeps the field at 1x1, and the one-tile mastery label remains readable.
- Browser smoke verifies wound markers: after opening the 3x3 wound lesson, the wounded root reports `woundMarkerVisible`, and after clicking that wounded root, the healed root marker clears.
- Browser smoke verifies healing feedback: the first real root touch reports `lastHealingFeedbackKind: root`, and a wounded-root heal reports `lastHealingFeedbackKind: wound`.
- Browser smoke verifies Scourge pressure feedback: after opening the 3x3 wound lesson in fast dormancy, `lastWoundPressureWarningAt` fires before or at `lastScourgePressureWaveAt`, the wound-open event reports `lastScourgeEvent: wound-open`, and HP zero reports `lastScourgeEvent: dormancy-collapse` with `lastDormancyCollapseAt > 0`.
- Browser smoke verifies Dew Pulse: after earning 22 RT, the `dewPulse` run-tool button reports usable, the prompt/advisor cue mentions Dew Pulse, `lastDewPulseReadyAt` is set, clicking it spends exactly 22 RT, heals HP, keeps total Run Touches earned unchanged, and reports `lastRunToolKind: dewPulse`.
- Browser smoke verifies the UI/meta correction: Lucid audio starts without warn/error logs, `feedPanelVisible` is false, tools occupy a separated Field Kit dock, HP collapse reports `runEnded`, `metaScreenVisible`, `summaryVisible`, a non-empty dormancy reward/report, memory buttons are visible, random screen clicks do not restart the run, and clicking `Begin Next Run` starts the next run.
- Browser smoke verifies the Field Kit progression and actions: Field Satchel changes equipped capacity from three to six; all four current tools report one shared x-coordinate and hotkeys `1`-`4`; the rail stays left of the field frame; keyboard `1` spends exactly 22 RT and reports Dew Pulse; Tiny Sprinkler spends exactly 16 RT and increments its count; and keyboard focus keeps accessible DOM text visually transparent while preserving a focus outline.
- Browser smoke verifies root recovery republishes ready state after the cooldown, allowing ten legitimate paced DOM touches to complete the one-tile chapter without per-frame bridge rendering.
- Browser smoke verifies Pocket Sunshine through `redesign-pocket-sunshine-button`: Field Satchel equips the fourth tool, the slot becomes usable at 38 RT and sufficient pressure, activation spends exactly 28 RT, reports `lastRunToolKind: pocketSunshine`, and the pure run-spine result reduces pressure by exactly 0.35 without healing or payout.
- Browser smoke verifies the DOM agent layer without canvas coordinate clicks: `grassAgentDom` reports `ready`, `redesign-readable-state` exposes the active phase/objective, real root buttons wake and heal roots, the Dew Pulse DOM button spends exactly 22 RT and reports `lastRunToolKind: dewPulse`, and the `Begin Next Run` DOM button restarts from the meta screen.
- Browser smoke verifies the DOM dormancy report: `redesign-dormancy-report` appears on the meta screen and mirrors the game-over reward/report/action text for agents that cannot inspect canvas text.
- Browser smoke verifies Memory Tree navigation: DOM zoom controls report 60%-180% state, wheel zoom remains anchored around the pointer, drag-pan is bounded, reset returns to 100% with zero pan, and clipped node controls never extend beyond the tree viewport.
- Browser smoke covers the Memory Grove at 390x844: tree controls do not collide with the compact title, name-only nodes remain distinct, the selected-memory explanation and cost do not overlap, and the next-run footer stays inside the viewport.
- Browser smoke verifies the first-pass Options layer through DOM controls: `redesign-options-button` opens the panel, `redesign-music-volume-range` changes and restores music volume, `redesign-sfx-volume-range` changes and restores SFX volume, `redesign-music-off-button` mutes while music is on, `redesign-options-close-button` closes the panel, and root DOM clicks still award a single root-touch result after the shared DOM button activation change.
- Browser smoke verifies the Tiny Sprinkler recast: a fast run earns enough GT, `redesign-memory-tinySprinkler` purchases the permanent license, the next run exposes `redesign-tiny-sprinkler-button`, buying it spends 16 RT and sets `tinySprinklers: 1`, an automated pulse fires, and the pulse increases RT/effective healing through real missing-HP restoration.
- Browser smoke verifies the Scourge Sense recast: a fast run earns enough GT, `redesign-memory-scourgeSense` purchases the permanent forecast node, the next run reports `scourgeSenseOwned`, wound pressure reaches the early Scourge Sense threshold, `scourgeSenseTargetRootId` and per-root `scourgeSenseMarkerVisible` appear before wound-open, and the forecast root becomes wounded.
- Browser smoke verifies Last Stand: a fast run earns enough GT, `redesign-memory-lastStand` purchases the permanent revive node, the next run reports `lastStandOwned` and `lastStandAvailable`, the first HP-zero event fires `lastStandTriggeredAt` while the phase remains active, and the second HP-zero event reaches real dormancy.
- Public-alpha smoke verifies the bare route and `?alpha` alias have no playtest controls, use the Alpha Test browser title/build mark, suppress redundant wide-layout intro surfaces, transition cleanly after the first real root touch, preserve exact music/SFX slider values, reach a hard Memory Grove game-over, give affordability-aware guidance, and begin another one-tile run without requiring a purchase. Route tests also preserve the explicit `?legacy` fallback and existing legacy performance/stress harness links.

## Milestone 3: Minimal Meta Skill Tree

Goal:

- Give permanent Grass Touches somewhere meaningful to go.

Gameplay:

- Add a minimal permanent meta tree shell.
- Include real early nodes:
  - Soft Touch: manual healing bonus.
  - Deeper Roots: max HP bonus.
  - Tiny Sprinkler License: implemented as the first automation unlock.
  - Field Mouse Routes, Bee Support, Earthworm Recovery, Chicken Patrol, Sheep Grazing Loop, and Meadow Rabbit Circuit: sequential equipment licenses from early to late Automation depth.
  - Field Satchel: add three equipped Field Kit slots after Tiny Sprinkler.
  - Scourge Sense: early wound forecast.
  - Last Stand: one automatic revive per run.
- Buying nodes spends permanent Grass Touches.

Implementation notes:

- Keep the first tree small and data-driven.
- Do not port the entire old upgrade tree yet.
- Use stable ids because saves will store them.

Acceptance:

- Dormancy payout can buy Soft Touch or Deeper Roots.
- Purchased nodes persist across runs.
- Soft Touch changes healing.
- Deeper Roots changes max HP.
- Locked future nodes communicate their requirement without needing their final behavior.

Tests:

- Skill purchase affordability.
- Purchased skill persistence.
- Soft Touch stat calculation.
- Deeper Roots max HP calculation.

## Milestone 4: Scourge Stages

Goal:

- Make time pressure legible and named.

Gameplay:

- Add time-based Scourge stages.
- Increase drain by stage.
- Display current stage in the HUD.
- Add simple Sensi callouts for first stage transitions.

Implementation notes:

- Keep stage calculation pure and cheap.
- Do not scan all field tiles for Scourge every frame.
- Start with simple time thresholds and drain multipliers.

Acceptance:

- Stage changes happen at configured elapsed times.
- HP drain increases by stage.
- HUD updates when stage changes.
- Callouts appear once per stage.

Tests:

- Stage selection by elapsed time.
- Drain calculation by stage.
- Stage callout dedupe state if implemented outside scene-only UI.

## Milestone 5: Wounds And Collapse

Goal:

- Make individual tiles matter as body parts of the shared organism.

Gameplay:

- Scourge can wound tiles.
- Wounded tiles increase pressure or reduce local healing until treated.
- Touching a wounded tile heals HP and reduces or clears the wound.
- Neglected or severe wounds can collapse a tile.
- Collapsed tiles are temporarily unavailable.
- Collapsed tiles recover by timer.

Implementation notes:

- Track wounded/collapsed tile keys in cached sets.
- Do not perform full-field scans every frame.
- Reuse dirty tile redraw paths.

Acceptance:

- Wounded tiles are visible.
- Wounded tiles affect the run in a clear way.
- Touching wounded tiles treats them.
- Collapsed tiles cannot be touched.
- Collapsed tiles recover without permanent loss.

Tests:

- Wound creation.
- Wound treatment.
- Collapse trigger.
- Collapse recovery timing.
- Cached key cleanup.

## Milestone 6: Tiny Sprinkler Recast

Goal:

- Reintroduce the first automation system under the new economy.
- Dew Pulse is already implemented as a small manual run-tool precursor; Tiny Sprinkler should build on the same Run Touch spend and effective-healing accounting rules.

Gameplay:

- Tiny Sprinkler is unlocked by meta skill.
- During a run, buy sprinkler units with Run Touches.
- Sprinklers add automated healing/touches.
- Sprinklers can prefer wounded or low-value targets if simple enough.
- Sprinkler purchases reset at dormancy.

Implementation notes:

- Reuse the existing `SprinklerSystem` only where it helps.
- Prefer a new adapter or rewritten system if old Grass Touch currency assumptions make it awkward.
- Keep automation updates staggered.

Acceptance:

- Without license, sprinkler cannot be bought. Implemented.
- With license, sprinkler appears in the run shop. Implemented.
- Bought sprinkler heals over time. Implemented.
- Sprinkler effective healing contributes to dormancy payout only when it restores missing HP. Implemented.
- Sprinkler count resets next run. Implemented.

Tests:

- Unit tests cover license requirement, RT purchase cost, run-only sprinkler count reset, pulse healing/RT payout, wound healing, and no full-HP reward minting.
- Browser smoke covers the DOM-accessible meta unlock, run purchase, pulse, readable state, and empty warn/error logs.
- License gate.
- Purchase cost and affordability.
- Automated healing result.
- Reset behavior.

## Milestone 7: Last Stand

Goal:

- Add the first revive without weakening the dormancy loop.

Gameplay:

- Last Stand is unlocked by meta skill.
- Last Stand triggers automatically once per run when HP would hit zero.
- It restores 35% of max HP.
- It resets immediate wound-pressure warning so the revive buys a short breath.
- It has no reward penalty.
- A second HP zero causes dormancy.

Acceptance:

- No Last Stand means HP zero enters dormancy.
- Last Stand available means first HP zero revives.
- Last Stand cannot trigger twice in one run.
- Dormancy payout is not penalized.
- Browser/DOM debug reports `lastStandOwned`, `lastStandAvailable`, `lastStandUsed`, and `lastStandTriggeredAt`.

Tests:

- Revive trigger.
- One-use guard.
- No-penalty payout.

## Milestone 8: Friend Loadout V1

Goal:

- Convert current classes into selectable friends.

Gameplay:

- Current five classes become friends:
  - Grass Toucher
  - Femboy Slim
  - Goth Girl Baddie
  - Bard De Wever
  - Chill Philosopher
- Player starts with one friend slot.
- Meta upgrades can unlock up to three slots.
- Friend selection affects runs through simple passives.

Acceptance:

- Friend selection appears before or at run start.
- One friend can be selected initially.
- Purchased slot upgrades allow more friends.
- Friend bonuses affect the relevant systems.

Tests:

- Slot limit.
- Friend unlock gate.
- Friend stat effects.

## Milestone 9: Secondary Drops And More Automation

Goal:

- Recast seeds, gold, and the rest of automation into support systems.

Gameplay:

- Seeds become field/growth/recovery support drops.
- Gold becomes tangible tool/friend support currency.
- Recast mouse, rabbit, bee, earthworm, chicken, and sheep.
- Keep Run Touches as the main run shop currency.

Acceptance:

- Seeds and gold have clear support roles.
- At least one seed use and one gold use work in-run.
- Existing automation names map to new roles.
- Run reset behavior is clear.

Tests:

- Drop awarding.
- Support purchase effects.
- Run reset rules.

## Milestone 10: First-Run Polish And Performance

Goal:

- Make the first run coherent, readable, and performant.

Gameplay:

- Add Sensi first-run tutorial text.
- Tune first-run likely loss.
- Tune first meta purchase.
- Improve HUD clarity for HP, Run Touches, and permanent Grass Touches.
- Add mobile layout pass.

Verification:

- `npm run check`
- Browser smoke on desktop and mobile-sized viewport.
- Exercise the changed redesign systems through `?redesign&playtest` and check browser warnings/errors plus DOM/debug state.
- Profile the redesign route directly before making performance claims. The existing `?perfHarness&tiles=1200` route selects the legacy game and is not redesign validation.

Acceptance:

- First run communicates the new loop.
- No obvious text overlap on mobile.
- Perf harness does not show runaway redraw/layout or display-object pressure.
