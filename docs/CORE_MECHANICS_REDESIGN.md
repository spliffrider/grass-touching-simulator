# Core Mechanics Redesign

## Design Intent

This document defines the new canonical direction for Grass Touching Simulator. The redesign changes the game from a mostly currency-driven incremental field clicker into a survival/incremental roguelite loop about keeping the Ancient Grass alive against an escalating force called the Scourge.

The new core promise:

> You touch grass because the grass is alive, it is dying, and somehow this is now your problem.

The redesign should:

- Make touching grass emotionally and mechanically meaningful.
- Give the player an immediate reason to care about each touch.
- Replace aimless number growth with escalating survival pressure.
- Keep the dopamine of incremental automation, unlocks, and big numbers.
- Make failure useful through permanent progression.
- Preserve the absurd comedy while giving the game a sincere survival spine.
- Rebuild with the useful parts of prior work: concepts, assets, music, art direction, tuning lessons, and helper code can return only after they fit the new game.

Non-goals:

- Do not design offline progress.
- Do not preserve the old Grass Touches economy unchanged.
- Do not require full migration of old saves.
- Do not make this first document a complete final balance sheet.
- Do not build the rhythm game yet; document it as future design space.
- Do not treat the previous implementation as the new game's architecture.

## Clean Break Rule

The old game is obsolete for this branch's gameplay structure. It remains useful as a library of lessons and raw material.

Reusable with adaptation:

- Music, sound effects, visual assets, pixel-art motifs, grass textures, and UI craft.
- Concepts such as automation, quests, class flavor, field growth, companions, seeds, gold, and skill trees.
- Performance lessons, rendering constraints, mobile guardrails, and proven utility code.

Visual continuity is a goal. The redesign should preserve the strongest graphical aspects of the current game unless the new mechanics demand changes:

- Meadow backgrounds and cozy field atmosphere.
- Grass tile art, dirt/stubble bases, flecks, spores, and tactile touch effects.
- Emerald/bronze fantasy UI framing, adjusted for the new HUD and run/dormancy surfaces.
- Existing music and sound palette, adapted to the Scourge survival loop.
- Pixel-art density and charm.

Not reusable as-is for milestone acceptance:

- Old economy flow.
- Old stores and upgrade tree.
- Old quest progression.
- Old save schema.
- Old tests that prove old rules.
- Old `?stress` gameplay screen as evidence of redesign progress.

The redesign should feel like a new game built from familiar ingredients, not the previous game with extra meters.

## Core Fantasy

The player is a permanently online burnout who has inherited a suspicious patch of ancient grass from their uncle. The grass is alive, the world is weird, and the only thing standing between it and cosmic lawn-collapse is the player's ability to touch grass better than before.

The player should feel:

- Mildly bullied by the situation.
- Guided by Grass Guru/Sensi.
- Under growing pressure from the Scourge.
- Clever for timing touches and buying automation.
- Comforted by permanent progress after failure.
- Amused by the lore, but invested in keeping the grass alive.

This should not become a grim survival game. It should feel playful, ridiculous, and warm, but with enough stakes that the player's actions matter.

## Narrative Premise

Grass Guru, also known as Sensi, introduces the player to the field. Sensi is quest giver, lore teller, tutorial guide, and unreliable mentor. He is kind, funny, confident, frequently wrong, and eventually suspiciously knowledgeable.

Fixed lore points:

- The player inherited the field from their uncle.
- The field begins with one tile of special Ancient Grass.
- The Ancient Grass is being drained by a mysterious force called the Scourge.
- Early explanations are deliberately stupid and contradictory: climate change, internet conspiracies, bad vibes, chemicals, lawn politics.
- The deeper truth is that the Scourge is an alien plague.
- This truth is revealed gradually through quests, runs, Scourge stages, and meta progression.
- Run failure is called dormancy, not death.
- Dormancy means the Ancient Grass collapses into memory, and that memory becomes permanent Grass Touches.

Tone rules:

- Player-facing writing should be polished English.
- The vibe should be absurd plus sincere.
- Sensi should be warm and unreliable rather than purely chaotic.
- The stakes should feel real, but not bleak.

Example Sensi intro tone:

```text
Your uncle left you this field. Sorry.

That there is Ancient Grass. Very rare. Very dramatic.

Touch it when it suffers. It likes that. Probably.
```

## First Five Minutes

The first run should teach the entire new loop quickly. The first loss should be likely, not hard-scripted.

Desired first-run sequence:

1. Title/menu leads into the field.
2. Sensi welcomes the player.
3. Sensi explains the inherited field.
4. The player sees one Ancient Grass tile and one shared HP bar.
5. HP begins slowly draining.
6. Sensi gives the first quest: touch the grass.
7. Player touches the tile.
8. HP rises.
9. Run Touches increase.
10. The tile enters a short recovery state.
11. Sensi comments that something is draining the grass.
12. A first quest completes.
13. The single tile earns several care upgrades while remaining 1x1.
14. Mastering the Ancient Crown permits the first expansion to 2x2.
15. The first Scourge stage begins or is hinted.
16. The player eventually loses unless they play unusually well.
17. On dormancy, the game shows effective healing converted into permanent Grass Touches.
18. The permanent skill tree opens.
19. The player buys their first meta upgrade.
20. The next run starts stronger.

The first five minutes should prove the redesign thesis:

- The Ancient Grass has life.
- Touching heals it.
- The Scourge drains it.
- The field grows.
- Failure becomes progress.

Current prototype notes:

- Fresh redesign runs now begin with a short inherited-field intro. The Scourge does not drain HP until the player touches the first Ancient Grass tile; that same touch wakes the run and counts as the first healing action.
- Fresh intros now include a non-blocking Sensi callout above the first tile. The callout gives the inheritance/draining-grass premise without making the whole canvas clickable; the run still starts only from a real Ancient Grass tile touch.
- Touch input is now target-based: only active Ancient Grass/root tiles count as healing touches. Empty meadow or HUD-area canvas clicks may show guidance, but they do not wake the intro, heal HP, award Run Touches, or advance objectives.
- Valid root touches now put normal roots into a short visual/mechanical recovery. Recovering roots show a subtle blue halo/readiness cue; immediate repeat clicks on the same recovering root give feedback but do not award extra Run Touches. Wounded roots remain immediately touchable so triage does not feel blocked by recovery timing.
- First-run guidance should appear as a small new-canon objective line on the run HUD. It should not reuse the old quest surface unless that system is deliberately recast later.
- Every run now begins with a real one-tile chapter instead of a one-click transition. Run-local care RT unlocks four automatic tile upgrades: `Soft Loam` at 6 RT, `Dew Veins` at 14 RT, `Root Heart` at 24 RT, and `Ancient Crown` at 36 RT. These upgrades improve manual healing and recovery cadence for the current run and visibly evolve the tile from dormant moss toward wildflowers.
- The field remains 1x1 through the first three care upgrades. `Ancient Crown` opens 2x2 at 36 run-local care RT, mapping 50 care RT opens 3x3, and `Hold the Line` still gates the final 5x5 patch. Dormancy resets field size, tile mastery, wounds, and care RT; permanent GT and purchased Memory upgrades remain.
- While the field is still a single isolated tile, Scourge HP drain runs at 58% of its normal value while elapsed time and pressure continue normally. Full drain resumes at 2x2. This preserves the established post-expansion balance while giving the one-tile mastery chapter enough room to breathe.
- Dew Pulse and Tiny Sprinkler remain hidden and unusable during the one-tile chapter. The opening teaches direct care and tile upgrades before run tools compete for attention.
- The `Hold the Line` objective asks the player to heal three wounded roots before the full patch opens; if the run collapses early, dormancy still advances the tutorial into the meta lesson so the first loop cannot soft-lock.
- Field expansion now has a presentational wake beat: the field frame pulses, newly awake roots pop in with rings and existing spore/fleck art, and rules/state remain unchanged.
- Browser debug state for the prototype now reports active root hitboxes, recovery marker state, and wounded root ids so first-run smoke checks can click actual roots instead of relying on approximate canvas coordinates.
- Wounded roots now have a persistent presentational marker while wounded, with a pink halo/shard beacon plus open/seal effects. This does not change wound timing, healing, rewards, or hitboxes.
- Scourge pressure now has event-only presentation: a dark pressure wave warns shortly before timed wound pressure opens a root, wound opening gets a Scourge strike into the target root, Scourge HP drain flashes the HUD pressure bar, and dormancy collapse plays a larger pressure wave. This does not change drain, wound timing, wound selection, rewards, or dormancy math.
- Effective healing now has a presentational root-to-HP read: a small mote travels from the healed root to the Ancient HP bar and the bar flashes briefly. This does not change healing amounts, Run Touch rewards, or HP math.
- Dew Pulse is the first recast in-run tool: it spends 22 Run Touches to heal the shared Ancient HP immediately for 10 HP, contributes effective healing through the tuned dormancy conversion, and does not mint replacement Run Touches. It is a tactical buy-time button, not automation yet.
- Dew Pulse now has first-pass discoverability cues: when it becomes usable, its field-kit slot pulses, the internal event history logs readiness, the bottom prompt calls out the spend, and Sensi briefly claims the advisor panel with a "buy time" line. Browser debug state reports `promptText`, `objectiveText`, and `lastDewPulseReadyAt` so smoke checks can verify the cue.
- Run tools now live in an icon-led `Field Kit` dock beside the playfield instead of a row of text buttons inside the status HUD. Stable square slots use existing item art, compact RT cost badges, owned-count badges, hover/focus detail cards, and real DOM controls over the canvas.
- The Field Kit is catalog-driven and prepared for a larger item roster: it uses two columns on wide layouts, one column on narrow layouts, and automatic previous/next paging when equipped tools exceed the visible page. Unlocking a tool and having room to equip it are separate progression concerns.
- Players begin with three equipped Field Kit slots. The 30 GT `Field Satchel` Memory requires Tiny Sprinkler and adds three slots, raising capacity to six; the current three tools fit the base kit so this first capacity gate becomes meaningful as later tools arrive.
- The status HUD is shorter now that tools have moved out of it, keeping objective, HP, currencies, and Scourge pressure in dedicated lanes while returning more vertical space to the playfield.
- Run tools are now introduced only when they matter: Dew Pulse stays hidden until the player has earned enough RT to understand the spend, Root Salve appears only when wounds exist, and Tiny Sprinkler appears only after its Memory license and enough RT or an owned run sprinkler.
- The run HUD and Memory Grove keep the Options button out of title/subtitle lanes. The redesign route also renders Phaser text at higher text resolution and stops forcing the canvas through CSS pixelated scaling so UI text stays more readable.
- The large `TOUCH ROOTS` field prompt is only a first-touch learning cue. After the first Ancient Grass wake objective, wound markers and objective text carry guidance instead of a permanent label over the field.
- The old-style Run Feed panel is hidden from the main play screen. It may remain useful as an internal event log/debug source, but it should not be treated as a core player surface unless it is deliberately redesigned.
- Active runs use the new Lucid field source as a browser-safe WAV asset (`public/assets/music/lucid-field-theme.wav`) generated from `docs/lucid.aif`. Dormancy crossfades into the higher-fidelity mellow Memory Grove track (`public/assets/music/epic_menu_theme_mellow.wav`), and `Begin Next Run` crossfades back to the field track.
- Root touches now use an animation-loop-driven squash and rebound so ambient grass motion no longer overwrites impact motion. Touch flecks travel in varied upward-biased sprays, effective healing sends a small staggered stream toward the HP bar, and wound sealing, dormancy, and Last Stand each have a dedicated procedural sound signature.
- HP collapse now presents a real game-over/meta screen: the active run loop stops, the playfield is replaced by a full-screen `Memory Grove`, the run report calls out that the run is over, the reward line shows permanent GT gained, and the skill tree is the main available action before the next run.
- The Game Over report now spells out the current conversion: useful healing becomes permanent GT at 1 GT per 5 effective HP, while unspent Run Touches are lost.
- The meta screen now uses a full-screen Memory Grove layout inspired by the original skill tree: a run summary column, a larger old-style hex-node Memory Skill Tree, a selected-memory detail panel, eleven functional memory nodes across five prototype lanes, and an explicit `Begin Next Run` button. Random screen clicks no longer restart the run.
- Locked Memory Grove nodes show their true total cost plus the remaining shortfall (`Cost X GT` / `Short Y GT`) so an upgrade cannot look purchasable merely because the player has the shortfall amount.
- Memory Grove node hover/focus updates the selected-memory detail panel, including through the transparent DOM agent controls layered above the canvas. Locked and owned memory nodes remain hoverable/focusable for info even when they are not purchasable.
- The selected Memory Grove node also shows a small in-tree callout with name, cost/status, and owned/shortfall state so the tree itself carries OG-style hover feedback instead of relying only on the side detail panel.
- The Memory Skill Tree now lives inside a masked navigation viewport. Players can zoom from 60% to 180% with `-`, percentage-reset, and `+` controls or the mouse wheel, then drag-pan the tree while zoomed in. Zoom-at-pointer preserves the inspected branch, and pan is clamped so the tree cannot be lost offscreen.
- Memory definitions and presentation now live in a shared data-driven catalog rather than scene switches. The first expandable catalog uses a fixed 720x450 logical world, small icon-and-name overview nodes, enlarged hover/detail presentation, and eleven connected nodes without unrelated connector crossings.
- The first second-tier memories are functional: `Fast Touch` shortens manual-root recovery by 20%, `Ancient Resilience` reduces base Scourge drain by 12%, `Sprinkler Tuning` adds 1 HP per sprinkler pulse, `Distributed Roots` reduces open-wound pressure by 25%, and `Emergency Photosynthesis` raises Last Stand recovery from 35% to 55% max HP.
- The tree navigation controls and clipped node hitboxes are mirrored into the DOM agent layer. Nodes outside the visible viewport cannot leave invisible interactive regions over the run report or detail panel.
- Compact Memory Grove layouts use smaller name-only nodes and a reorganized selected-memory panel; costs, effects, and flavor remain readable in that panel instead of colliding inside the overview. This is the mobile basis for a much larger future Memory catalog.
- `Begin Next Run` is now the dominant footer action: 300x54 on wide layouts and 230x48 on compact layouts, with a restrained idle glow/text pulse and an unchanged hitbox.
- Memory purchases now give immediate post-purchase feedback that states what changed for the next run.
- The prototype HUD now treats player identity and Sensi dialogue as separate surfaces in the wide layout: the portrait panel is the player/Grass Toucher status, while Sensi lives in an advisor panel below it.
- The player portrait now uses a dedicated new-canon Field Heir pixel portrait (`public/assets/ui/characters/player-field-heir.png`) instead of reusing the old Grass Toucher hand icon or Sensi's portrait.
- Compact layouts now preserve that identity split too: medium widths use side-by-side player/advisor panels, tall narrow screens stack them, and the separate intro callout is suppressed there because the Sensi advisor panel carries the same first-run premise.
- Browser debug state also reports player/advisor panel text and visibility so smoke checks can catch identity regressions even though Phaser text is rendered inside the canvas.
- After the `Hold the Line` pressure lesson, ongoing wound pressure is presented as background pressure instead of repeating urgent tutorial copy over the dormancy objective.
- Browser debug state also reports Scourge presentation markers (`lastScourgeEvent`, `lastWoundPressureWarningAt`, `lastScourgePressureWaveAt`, `lastDormancyCollapseAt`, wound pressure progress, Scourge Sense ownership, Scourge Sense target, and Scourge Sense warning timestamps), `feedPanelVisible`, `runEnded`, `metaScreenVisible`, the next-run button, dormancy reward/report text, plus Field Kit capacity, equipped ids, page/layout state, tooltip state, and per-tool bounds/state so smoke checks can verify threat beats, tool purchases, and high-level screen state even when canvas effects are brief.
- The redesign prototype now exposes an agent-readable DOM control layer above the Phaser canvas. The canvas remains the visual/gameplay presentation surface, but critical actions are mirrored as real HTML buttons for roots, Dew Pulse, Root Salve, Memory nodes, and `Begin Next Run`; a readable state output is exposed at `data-testid="redesign-readable-state"` and `document.documentElement.dataset.grassAgentDom` reports `ready`.
- The redesign route now has a first-pass Options overlay reachable from the run HUD. It persists the existing project music volume setting, controls the Lucid track volume/mute state, and mirrors the controls into the DOM agent layer with an options button, close button, music volume range, and a state-sensitive music-off button. DOM agents unmute by setting `redesign-music-volume-range` above zero.
- Options now also persists a separate SFX volume and exposes `redesign-sfx-volume-range`. Manual root touches use the existing procedural grass-touch SFX system with per-texture variation, while wounds, recovery rejects, tools, and Memory purchases have first-pass feedback sounds.
- Tiny Sprinkler is now the first recast automation system: a 24 GT permanent Memory node unlocks a run-tool purchase, each run sprinkler costs 16 RT, run-owned sprinkler count resets on the next run, and pulses heal missing Ancient HP for 2 HP per owned sprinkler while awarding Run Touches and dormancy payout only from effective healing. Sprinkler pulses prefer wounded roots when one is open.
- Scourge Sense is now the first threat-readability Memory node: a 20 GT permanent node forecasts the next wound target earlier than baseline pressure warning, marks that root with a gold halo, updates HUD/prompt/advisor copy, and exposes `scourgeSenseTargetRootId`, `lastScourgeSenseWarningAt`, and per-root `scourgeSenseMarkerVisible` for browser checks. It does not change drain, wound timing, rewards, or dormancy math.
- Human playtesting now has a dedicated `?redesign&playtest` route. It uses accelerated but still playable first-loop pacing and exposes visible dev controls for forcing Game Over, granting permanent GT, restarting the run, and resetting the redesign memory save.
- Fast dormancy mode is tuned for repeatable loop checks: the player can wake the field, earn Run Touches, heal the tutorial wound, enter dormancy, buy Soft Touch, and start the next run within a short browser smoke.

## Core Run Loop

The repeated run loop:

1. Start a run with current permanent upgrades and selected friend loadout.
2. Ancient Grass HP begins draining.
3. Player touches tiles to heal HP.
4. Good timing through care windows increases healing.
5. Touches generate temporary Run Touches.
6. Player spends Run Touches on unlocked in-run automation and tools.
7. Scourge drain increases through time and named stages.
8. Field expands automatically at key tutorial, survival, or healing moments.
9. Tiles become wounded, Scourged, or collapsed.
10. Automation and friends help produce touches, heal wounds, restore collapsed tiles, or slow pressure.
11. Eventually HP reaches zero.
12. Run ends in dormancy.
13. Effective healing converts to permanent Grass Touches.
14. Player buys meta upgrades.
15. Repeat.

This loop should support short early runs and much longer later runs. A first run can be tiny. Later runs can become serious endurance sessions.

## Ancient Grass HP

There is one shared Ancient Grass HP bar. It represents the health of the whole grass organism.

Rules:

- HP drains constantly during a run.
- Scourge stages increase drain over time.
- Touching grass restores HP.
- Effective healing counts only missing HP actually restored.
- Overheal does not count toward permanent Grass Touches by default.
- Overheal may still contribute to score, combos, or temporary run value.
- A late-game meta skill can unlock overheal shielding.

Suggested state concepts:

```ts
interface AncientGrassState {
  currentHp: number;
  maxHp: number;
  shieldHp: number;
  scourgeStage: number;
  scourgeElapsedMs: number;
  effectiveHealingThisRun: number;
  overhealThisRun: number;
}
```

Implementation defaults:

- Start with one global HP bar.
- Do not implement per-tile HP in v1.
- Individual tiles affect shared HP through wounds, collapse, and healing opportunities.

## Field Tiles As Body Parts

Tiles are body parts of the same Ancient Grass organism. This preserves the field as a meaningful board without requiring every tile to have its own independent health bar.

Each tile can be:

- Healthy: touchable when ready.
- Recovering: recently touched and temporarily unavailable.
- Wounded: still touchable, but contributes extra pressure or reduced healing until treated.
- Scourged: a stronger wound state caused by later Scourge stages.
- Collapsed: temporarily unavailable; recovers by timer or support effects.

Core rules:

- Touching a healthy tile heals shared HP.
- Touching a wounded tile heals shared HP and reduces or clears the wound.
- Wounded tiles create triage decisions.
- Collapsed tiles reduce available touch surface.
- Collapsed tiles are not permanently lost.
- Collapsed tiles recover after a timer.
- Skills, friends, or automation can speed recovery or restore collapsed tiles instantly.

The old regrowth/cooldown concept can be reused, but reframed as tile recovery rather than grass being spent for currency.

## The Scourge

The Scourge is the main run pressure.

Behavior:

- Constant HP drain starts low.
- Drain increases over time.
- Named Scourge stages mark meaningful pressure increases.
- Stages can unlock new visual effects, wound types, events, or dialogue.
- The first reveal is vague and comedic.
- Later stages imply the alien plague truth.

Recommended stage examples:

| Stage | Name | Design Role |
| --- | --- | --- |
| 0 | Bad Vibes | Baseline drain, tutorial pressure. |
| 1 | Unnatural Dryness | First drain increase and wound chance. |
| 2 | Root Static | Faster drain and early collapse risk. |
| 3 | Green Fever | Stronger wounds and more urgent triage. |
| 4 | Scourge Bloom | Scourged tile state appears more often. |
| 5 | Extraterrestrial Lawn Event | The alien truth starts becoming hard to deny. |

Tunable pacing placeholders:

```text
Stage 0: 0:00, baseline drain
Stage 1: ~1:00, drain increase and first wound chance
Stage 2: ~3:00, faster drain and collapse risk
Stage 3: ~6:00, Scourged tile state appears
Stage 4+: later endurance tuning
```

These timings are pacing targets, not locked balance.

## Touching And Care Windows

Manual touch is the emotional core of the game.

Touching should:

- Restore shared HP.
- Add temporary Run Touches.
- Count effective healing for post-run permanent Grass Touches.
- Interact with wounded and Scourged tiles.
- Trigger tactile feedback, pop text, and sound.

Care windows:

- A tile can briefly become especially valuable after recovery, wound appearance, Scourge pulse, or field expansion.
- Touching during a care window gives bonus healing.
- Care windows are the first version of the timing/rhythm idea.
- Beat-based touching or music-synced play is future design space, not v1.

Suggested touch result concept:

```ts
interface CareTouchResult {
  healing: number;
  effectiveHealing: number;
  overheal: number;
  runTouchesGained: number;
  wasCareWindow: boolean;
  woundReduced: boolean;
  tileCollapsed: boolean;
}
```

Touching should feel useful even when the player is under pressure. Bad touches can be less optimal, but the basic action should not feel punishing.

## Run Economy

The redesign uses two main touch currencies.

| Currency | Scope | Use |
| --- | --- | --- |
| Run Touches | Current run only | Buy in-run automation, tools, and temporary upgrades. |
| Grass Touches | Permanent meta currency | Buy permanent skill-tree upgrades after dormancy. |

Rules:

- Touching grass creates Run Touches.
- Run Touches reset at dormancy.
- Effective healing converts to permanent Grass Touches at run end.
- Spending Run Touches does not reduce permanent Grass Touch rewards.
- Permanent Grass Touches buy meta skill-tree nodes.
- Overheal does not create permanent Grass Touches unless a later skill allows shielding or partial conversion.

This avoids punishing the player for buying fun automation during a run.

## Dormancy And Meta Progression

When Ancient Grass HP reaches zero:

- The run ends.
- The state is called dormancy.
- Sensi explains that the grass remembers care.
- Effective healing converts into permanent Grass Touches.
- Run stats are shown.
- Player enters the permanent skill tree.

End-of-run reward basis:

- Effective healing.
- Survival time.
- Peak Scourge stage reached.
- Maximum field size reached.
- Collapsed tiles restored.
- Optional quest or milestone bonuses.

Recommended reward identity:

```text
Permanent Grass Touches = effective healing converted through a tunable formula. Current prototype tuning is 1 permanent GT per 5 effective HP.
```

Effective healing is the primary source. Survival time and stage progress can modify or bonus the payout, but should not replace healing as the main identity.

## Permanent Skill Tree

The permanent skill tree has five branches:

- Touch
- Vitality
- Automation
- Field Growth
- Friends and Scourge Control

The current ten-node prototype presents five narrower visual lanes (`Touch`, `Vitality`, `Automation`, `Scourge`, and `Resolve`) while the broader Field Growth and Friends systems are still unimplemented. Those lane labels are presentation for the current vertical slice, not a rejection of the long-term branch doctrine above.

The tree should unlock systems and long-term power. It should not contain every in-run purchase. The player unlocks a system permanently, then buys that system during each run with Run Touches.

### Touch Branch

Purpose:

- Improve manual healing.
- Improve care-window value.
- Reduce touch cooldowns.
- Unlock touch timing skill expression.

Example nodes:

- Soft Touch: manual touches restore more HP.
- Fast Touch: reduce tile recovery/cooldown after manual touch.
- Careful Hands: care-window touches heal more.
- Persistent Touch: hold/tap assist for accessibility or late-game comfort.
- Overheal Shield: overheal creates temporary shield HP.

### Vitality Branch

Purpose:

- Improve max HP, baseline survival, and recovery from pressure.

Example nodes:

- Deeper Roots: increase max Ancient Grass HP.
- Ancient Resilience: reduce baseline Scourge drain.
- Dormant Recovery: collapsed tiles recover faster.
- Last Stand: unlock one automatic revive per run.
- Emergency Photosynthesis: Last Stand restores more HP.

### Automation Branch

Purpose:

- Unlock and enhance run automation.

Example nodes:

- Tiny Sprinkler License: unlock sprinkler purchases during runs.
- Field Mouse Routes: unlock mouse automation.
- Bee Support: unlock bee wound support.
- Earthworm Recovery: unlock collapse recovery support.
- Automation Calibration: increase touches/min from all automation.
- Split Systems: improve support automation separately from production automation.

### Field Growth Branch

Purpose:

- Improve field expansion, max field size, and tile body-part resilience.

Example nodes:

- Bigger Patch: raise maximum stage-based field size.
- Better Tissue: newly expanded tiles start with more resilience.
- Safer Expansion: expansion causes less immediate Scourge pressure.
- Distributed Roots: wounds add less extra drain.
- Recovery Network: healthy tiles help collapsed tiles recover.

### Friends And Scourge Control Branch

Purpose:

- Unlock friends, friend slots, Scourge counterplay, and lore progression.

Example nodes:

- First Friend: unlock friend loadouts.
- Second Slot: bring two friends.
- Third Slot: bring three friends.
- Scourge Notes: reveal stage information earlier.
- Guru's Bad Advice: occasional random support event.
- Alien Lawn Theory: unlock clearer Scourge lore and counter-systems.

This document intentionally defines branch examples rather than a complete final tree.

## Field Expansion

Expansion is automatic, not manually purchased, but it must be earned after meaningful investment in the current field size.

Use a hybrid trigger model:

- First expansion is driven by four one-tile care/mastery upgrades.
- Main expansion is tied to survival and Scourge stages.
- Run-local effective-healing rewards act as the early readiness checks. Each new attempt returns to one inherited tile and rebuilds the field with help from permanent Memory upgrades.

Expansion meaning:

- Bigger field increases max HP.
- Bigger field creates more touch opportunities.
- Bigger field creates more body parts that can become wounded or collapsed.
- Bigger field increases strategic surface area and pressure.
- Bigger field should feel exciting, not purely punishing.

Progression examples:

```text
1x1: tutorial organism
2x2: first real field
3x3: wounds begin to matter
4x4: automation becomes valuable
5x5+: Scourge triage and support systems become central
```

Do not allow unlimited growth in v1.

## Automation Systems

Recast existing automation instead of replacing it.

Automation has split roles:

- Production systems add touches/min and healing output.
- Support systems reduce wounds, restore collapsed tiles, or slow pressure.
- Hybrid systems do both.

Recommended roster mapping:

| System | New Role |
| --- | --- |
| Tiny Sprinkler | Production first; touches/heals random or priority tiles. |
| Field Mouse Route | Production; quick small touches, good at care-window opportunism. |
| Meadow Rabbit | Production; faster but less predictable touch bursts. |
| Bee Hive | Support; improves wounded tiles, boosts care windows, stabilizes clusters. |
| Earthworm | Support; speeds recovery and collapsed tile restoration. |
| Chicken Patrol | Hybrid; scratches up support drops and occasionally clears wounds. |
| Sheep Loop | Hybrid; steady grazing/touches plus crisis smoothing. |

Rules:

- Meta tree unlocks each automation family.
- During each run, unlocked automation can be bought with Run Touches.
- Bought automation resets at dormancy.
- Automation can contribute effective healing if it restores missing HP.
- Automation should not create permanent Grass Touches through overheal by default.

Current prototype precursor:

- Dew Pulse is a manual run-tool purchase rather than automation. It exists to prove the Run Touch spend loop before Tiny Sprinkler introduces periodic/ticked healing.
- Dew Pulse readiness should be visible without reading docs: button pulse, run feed, prompt, and advisor bark all point at the spend once the player has enough RT and missing HP.
- Automation-heavy play is expected and desirable.

## Friends

Existing character classes become unlockable friends.

Friend loadout rules:

- Start with one friend slot.
- Permanent upgrades can unlock up to three slots.
- Friends are selected before a run.
- Friends do not replace automation; they shape the run.

Friend identities:

| Friend | Role |
| --- | --- |
| Grass Toucher | Baseline healing friend; improves direct manual touch and early stability. |
| Femboy Slim | Timing friend; improves care windows, quick touches, and style/combo hooks. |
| Goth Girl Baddie | Scourge friend; reduces wound pressure, improves anti-Scourge effects, boosts rare/dark events. |
| Bard De Wever | Rhythm/tempo friend; improves automation cadence, future beat systems, and streak-like effects. |
| Chill Philosopher | Stability friend; smooths drain, slows panic spikes, improves recovery windows. |

Exact friend numbers are future balance work. The role identities above are fixed for the first redesign pass.

## Seeds, Gold, And Support Drops

Seeds and gold are recast as secondary support drops.

Rules:

- Run Touches remain the main in-run purchase currency.
- Seeds and gold are support drops.
- Seeds lean toward growth, field biology, recovery, and unlock flavor.
- Gold leans toward tangible tools, friend support, and practical items.
- Seeds and gold should not become the main permanent meta currencies in v1.

Example uses:

- Seeds buy temporary run upgrades for growth, recovery, or field expansion quality.
- Gold buys tangible tools such as gloves, emergency sprinkler charges, friend snacks, or support items.
- Some meta nodes can unlock new seed/gold shop categories.

## Revives And Savepoints

Browser save behavior:

- Active runs should save normally.
- Closing the browser should allow continuing the current run.
- No offline rewards should be granted.

Current prototype save boundary:

- The `?redesign` prototype uses a new-canon localStorage key: `grass-touching-simulator.redesign-memory.v1`.
- This key stores only permanent memory: permanent Grass Touches, purchased permanent upgrade ids, `saveVersion`, and `savedAt`.
- It intentionally does not store active-run HP, Run Touches, wounds, Scourge pressure, timers, audio state, or old-game economy data yet.
- `?redesign&resetMemory` clears this new-canon memory key for repeatable loop testing.
- `document.documentElement.dataset.grassRedesignPrototype` is a browser-smoke/debug signal for the prototype, not the gameplay save contract. It includes active root hitboxes, root recovery/wound flags, Scourge presentation markers, Scourge Sense target/marker state, Last Stand revive state, intro callout visibility, summary visibility, run-ended state, dormancy payout/report text, and memory button bounds so smoke checks can use real UI targets.
- `document.documentElement.dataset.grassAgentDom` is the DOM-accessibility/agent-control readiness signal. When it is `ready`, browser agents can use stable `data-testid` controls including `redesign-root-{id}`, `redesign-dew-pulse-button`, `redesign-root-salve-button`, `redesign-tiny-sprinkler-button`, `redesign-memory-softTouch`, `redesign-memory-deeperRoots`, `redesign-memory-tinySprinkler`, `redesign-memory-scourgeSense`, `redesign-memory-lastStand`, `redesign-begin-next-run-button`, `redesign-options-button`, `redesign-options-close-button`, `redesign-music-off-button`, `redesign-music-volume-range`, `redesign-sfx-volume-range`, `redesign-readable-state`, and `redesign-dormancy-report`.

Revive behavior:

- Revives are unlockable, not baseline.
- First revive system is Last Stand.
- Last Stand triggers automatically once per run when HP would hit zero.
- It restores 35% of max HP.
- It resets immediate wound-pressure warning so the revive buys a short breath.
- It has no end-of-run reward penalty.
- It should feel like permanent progression power.

Avoid checkpoint rewind for v1.

## Veteran Save Treatment

Existing browser saves should not be fully migrated into the new economy.

Use a fresh new-canon save path/version, but check for old save data.

Veteran bonus:

- Legacy badge or title.
- Sensi flavor line acknowledging old grass-touching history.
- Small permanent starting Grass Touch bonus or tiny early unlock.
- Bonus must not dominate progression.
- Do not map every old upgrade, currency, item, and class into the new system.

## Public Types And Save Interface Changes

When implemented later, expect new or heavily revised saved state around these concepts.

```ts
interface AncientGrassState {
  currentHp: number;
  maxHp: number;
  shieldHp: number;
  scourgeStage: number;
  scourgeElapsedMs: number;
  effectiveHealingThisRun: number;
  overhealThisRun: number;
}

interface RunEconomyState {
  runTouches: number;
  lifetimeRunTouchesThisRun: number;
  seeds: number;
  gold: number;
}

interface MetaProgressionState {
  grassTouches: number;
  unlockedSkillIds: string[];
  unlockedFriendIds: string[];
  friendSlots: number;
  veteranBonusClaimed: boolean;
}

interface RunLifecycleState {
  runStartedAt: number;
  survivalMs: number;
  dormancyCount: number;
  lastStandOwned: boolean;
  lastStandAvailable: boolean;
  lastStandUsed: boolean;
  lastStandTriggeredAt: number;
}
```

Exact names can be adjusted during implementation, but the document should preserve these concepts.

## Implementation Notes

Recommended implementation order:

1. Create this design document.
2. Add new save namespace/version for the redesign branch.
3. Add Ancient Grass HP state and UI.
4. Convert manual touch to healing plus Run Touch generation.
5. Add dormancy flow and post-run Grass Touch reward.
6. Add simple permanent skill tree shell.
7. Add Scourge drain and stages.
8. Add wounded tile state.
9. Add collapsed tile state and recovery timer.
10. Recast first automation system: Tiny Sprinkler.
11. Add first friend loadout.
12. Add veteran bonus detection.
13. Expand automation, friends, and secondary drops.

Performance constraints:

- Do not scan all tiles every frame for wounds/collapse on large fields.
- Use cached sets for wounded, Scourged, collapsed, and recovering tiles.
- Preserve viewport culling and dirty-tile redraws.
- Keep Scourge drain global and cheap.
- Keep automation updates staggered.
- Run `npm run build` after implementation changes.
- Use `?perfHarness&tiles=1200` before merging performance-sensitive systems.

## Test Scenarios

The eventual implementation should be accepted against these scenarios.

### New Player First Run

- Starts with one tile.
- Sees HP draining.
- Touch heals HP.
- First quest completes.
- Field expands.
- Dormancy likely occurs within a short first-run window.
- Permanent skill tree appears.

### Currency Separation

- Touching missing HP increases Run Touches.
- Effective healing contributes to post-run Grass Touches.
- Spending Run Touches does not reduce post-run Grass Touch reward.
- Overheal does not increase permanent Grass Touches by default.

### Wound Triage

- Scourge creates a wounded tile.
- Wound increases pressure or reduces local effectiveness.
- Touching wounded tile heals and reduces or clears wound.

### Collapse

- Neglected tile can collapse.
- Collapsed tile is unavailable.
- Collapsed tile recovers by timer.
- Support systems can speed recovery.

### Automation

- Meta unlock enables Tiny Sprinkler in run shop.
- Buying sprinkler during a run adds automated healing/touches.
- Sprinkler ownership resets after dormancy.
- Permanent unlock remains.

### Friend Loadout

- Player can select one unlocked friend.
- Friend modifies run behavior according to role.
- Later skill can increase slots up to three.

### Last Stand

- Without unlock, HP zero causes dormancy.
- With unlock, HP zero triggers one automatic revive.
- Revive restores 35% of max HP and marks Last Stand spent for the run.
- Second HP zero causes dormancy.

### Veteran Bonus

- Old save is detected.
- New save starts fresh.
- Legacy badge/flavor and tiny boost are granted once.

## Open Design Spaces

These are intentionally unresolved future work:

- Exact Scourge drain formulas.
- Exact HP and healing numbers.
- Full meta skill tree node list.
- Full first-run dialogue script.
- Beat/rhythm touching system.
- Long-run pacing beyond early stages.
- Advanced Scourge enemy/event types.
- Cosmetic rewards and friend relationship progression.
- Whether seeds/gold ever persist across runs.
