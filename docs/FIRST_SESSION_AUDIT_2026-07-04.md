# First Session Audit - 2026-07-04

This note captures a fresh-save product audit against the polish roadmap. It is not a balance spec. It is a first-pass read of what a new player sees, understands, and gets asked to care about.

## Run Setup

- Desktop fresh save on `http://127.0.0.1:5174/`.
- Mobile fresh save on `http://127.0.0.1:5175/` with a 390 x 844 viewport.
- Class: Grass Toucher.
- The desktop run was accelerated by repeated clicking after the first few organic beats. Treat timing as directional, not a true 30-60 minute pacing measurement.
- No game code was changed during this audit.

## What Worked

- The title screen has a strong first impression. The brand and background art make the game feel more complete than the average prototype.
- The first field expansion at 8 lifetime touches is a good first reward. Going from 1 tile to a 2 x 2 patch feels tangible.
- The first skill purchase is readable. `Softer Grass` is selected, affordable, and easy to understand.
- The Store now unlocks early enough to be useful. At first Store access, `Sprinkler Route` is ready and starts passive income immediately.
- The placed Tiny Sprinkler interaction is promising. Once discovered, the object card and coverage rectangle make automation feel physical.
- Mobile first gameplay is calmer than desktop. It hides some of the extra future-facing text and keeps the early board readable.

## Main Friction

### Too Many Systems Speak Early

The first desktop gameplay screen immediately exposes:

- Skills
- Quests
- Seeds
- Options
- Trigger Feed
- Auto
- quest status
- next spread
- next tier
- next automation helper

The player can still start tapping, but the screen explains future systems before the first loop has landed.

### Class Choice Comes Before Context

The class picker is readable, but asking players to choose between five identities before they know the base loop is a lot. The class passives are understandable mechanically, but their play-style meaning is mostly theoretical at this point.

### Quest Log Is Too Big For The First Reward

The first quest reward is clear, but opening Quest Log immediately shows `78/78`, category tabs, long chains of locked quests, and global claim controls. This makes quests feel like a system database instead of a gentle first goal.

### Reward Lanes Pile Up Around Store Unlock

By the time Store appears, the run also had multiple ready quests, several available skills, seeds, gold, field growth, a larger board, and first automation. Store is useful, but several systems light up at once.

### Store Purchase Affordance Is Ambiguous

The `Sprinkler Route` row is clear, but the top `Buy 1` button is actually a buy-mode toggle. Clicking it changes to `To Boost` instead of buying the ready route. The actual purchase is done by clicking the row, which is learnable but surprising.

### Automation Manager Arrives Too Advanced

After first automation, the Automation Manager immediately shows lanes, output multipliers, helper tempo, supplies, Auto-Pilot, route percentages, and synergy text. It is useful later, but it is a lot for the first passive helper.

### Seed Shop Has A Sprinkler Concept Collision

After buying and placing a Store `Sprinkler Route`, Seed Shop still offers `Tiny Sprinkler Blueprint`. The description says Store routes are separate passive operations, but the player has already interacted with a placed Tiny Sprinkler. This reads like overlapping ownership.

### Skill Tree Can Spend On Inspection

Clicking an available skill node can purchase it directly. That is efficient once known, but a first-time player trying to inspect `Faster Regrowth` can buy it by accident.

### Mobile Skill Copy Still Says Hover

The mobile Skills panel says, `Hover a skill to inspect it. Click a skill or Upgrade to buy.` The panel is otherwise readable, but this line breaks mobile polish.

## Timeline Notes

- Start: strong title, clear `START GAME`, but `CONTINUE` is visible even with no save.
- Class picker: clear enough, but too much identity commitment before gameplay context.
- First gameplay: one obvious patch, but desktop HUD is busy.
- First touch: counter updates clearly; reward feedback is subtle in screenshots.
- First spread at 8: good moment. Guidance changes to `upgrade Softer Grass`.
- First skill: clear purchase and understandable effect. Prestige appears very early.
- First quest at 25: quest ready state is discoverable. Quest Log itself is too large.
- First seed reward: rewards seeds but first Seed Shop purchase is not affordable until later.
- Around 100-120: Store becomes useful, but ready quests and skills stack up at the same time.
- First automation: passive income starts cleanly. Purchase interaction is the confusing part.
- Sprinkler placement: good tangible object feedback once the icon is discovered.
- Around 250: field growth, Thick Grass, cactus hazards, ready quests, Store badges, and skill badges are all competing for attention.

## Candidate Fixes

1. Add a beginner display mode for the first few minutes that hides future-facing desktop text until relevant.
2. Make the first Quest Log view show only active and ready quests by default, with `All` as a secondary tab.
3. Rename or redesign the Store buy-mode toggle so it does not look like the primary purchase button.
4. Add an explicit row button or `Buy Sprinkler Route` affordance for the first automation purchase.
5. After the first Store automation purchase, keep the placement instruction visible until the player places the sprinkler.
6. Gate the Automation Manager lane/directive UI behind a second automation moment, or add a simple first-run summary mode.
7. Resolve the Store route vs Seed Shop `Tiny Sprinkler Blueprint` overlap.
8. Change mobile skill helper copy from `Hover` to touch/click-neutral language.
9. Consider making class choice optional or default-first for the very first run, then let players change/commit after learning the base loop.
10. Add stronger fanfare for field expansions and major unlocks so they do not feel like quiet counter updates.

## Suggested Next Pass

Start with the smallest product fixes that reduce first-session noise:

- First Quest Log default filter.
- Store first-purchase affordance.
- Mobile Skills helper copy.
- Sprinkler placement nudge persistence.
- Desktop beginner HUD text reduction.

These would improve clarity without adding new systems or changing the core economy.
