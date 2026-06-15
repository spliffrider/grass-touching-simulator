# Test Report: First Sprinkler Pacing

Date: 2026-06-16

Build under test: Alpha 2.0 build 2026-06-16

Final commit tested and deployed: `7db05b8` - `Tune first sprinkler unlock pacing`

Production URL checked: https://grasstouchingsimulator.com

## Purpose

This test pass focused on the fresh-save pacing from the first manual touches through the first running automation system.

The main question was whether a new player can naturally move from:

1. First field expansion.
2. First quest rewards.
3. Seed Pouch.
4. Tiny Sprinkler Blueprint.
5. First running Tiny Sprinkler.

The goal was to identify whether the first automation unlock felt reachable at a satisfying time without needing extra grinding after a major early quest checkpoint.

## Test Environment

- Local workspace: `C:\Users\rafbu\OneDrive\Documenten\Grass Touching Simulator`
- Local dev server: `http://127.0.0.1:5174`
- Browser viewport: desktop, approximately 1280x720
- Class selected: Grass Toucher
- Save state: fresh local origin on port `5174`, chosen to avoid disturbing the existing local save on the normal dev port
- Verification tools:
  - In-app browser screenshots and coordinate interactions
  - Browser console warning/error inspection
  - `npm run build`
  - Production deployment through Vercel
  - Public domain HTTP check

## Scope

In scope:

- Fresh-save early game pacing.
- Seed income before and after Seed Pouch.
- Quest reward timing around 25, 100, and 250 lifetime Grass Touches.
- Seed Shop readability for Seed Pouch and Tiny Sprinkler Blueprint.
- Automation Store availability after buying the blueprint.
- First Tiny Sprinkler purchase and HUD confirmation.
- Local smoke testing after the balance change.
- Production deployment verification.

Out of scope:

- Full mid-game and late-game pacing.
- Mobile viewport layout.
- Other character classes.
- Long-run automation scaling.
- Full regression of every Seed Shop item.
- Full production browser playthrough after deployment.

## Baseline Fresh-Save Observations

### New Game Start

The run started as Grass Toucher.

Initial HUD:

```text
Grass Touches: 0 | Seeds: 0 | Gold: 0 | Patches: 1
```

The first field spread occurred at 8 lifetime touches.

Observed state after first spread:

```text
Grass Touches: 8 | Seeds: 0 | Gold: 1 | Patches: 4
Next spread: 28 lifetime touches
```

Finding:

- The one-patch opening is naturally wait-heavy if clicks are too impatient.
- Once the field reaches 4 patches, the rhythm becomes easier to read and play.

### Early Quest and Seed Income

At 32 lifetime touches:

```text
Grass Touches: 32 | Seeds: 1 | Gold: 2 | Patches: 8
Quest ready: 1
```

The ready quest was `Touch Grass, Actually`, rewarding 2 seeds.

After claiming:

```text
Grass Touches: 32 | Seeds: 3 | Gold: 2 | Patches: 8
```

Finding:

- Natural seed drops were low early.
- The first quest reward mattered and helped the player recover from unlucky seed RNG.

### Seed Pouch Timing

At 96 lifetime touches:

```text
Grass Touches: 96 | Seeds: 7 | Gold: 3 | Patches: 14
Quest ready: 1
```

Seed Shop showed:

```text
Seeds: 7 | Lifetime Seeds: 7 | Drop Chance: 8%
Seed Pouch: Cost 6 seeds
Tiny Sprinkler Blueprint: Locked until Seed Pouch
```

Seed Pouch was purchased successfully.

After purchase:

```text
Seeds: 1 | Lifetime Seeds: 7 | Drop Chance: 14%
Tiny Sprinkler Blueprint: Cost 22 seeds | Need 21 more
Field Journal: Cost 28 seeds
```

Finding:

- Seed Pouch timing felt good.
- The upgrade was affordable before 100 lifetime touches.
- The drop chance improvement was visible and understandable.
- The post-pouch sprinkler runway looked long but not obviously broken yet.

### 100-Touch Quest Recovery

At 105 lifetime touches:

```text
Grass Touches: 105 | Seeds: 1 | Gold: 3 | Patches: 14
Quests ready: 2
```

After claiming ready quests:

```text
Grass Touches: 105 | Seeds: 12 | Gold: 5 | Patches: 14
```

Finding:

- Claiming the ready quest chain felt good.
- Seeds jumped from 1 to 12, making the next goal feel much closer.
- The player still needed roughly 10 more seeds for the original 22-seed sprinkler cost.

### 200-Touch Checkpoint

At approximately 204 lifetime touches:

```text
Grass Touches: 204 | Seeds: 15 | Gold: 8 | Patches: 23
Quest: A Reasonable Afternoon - 204/250 touches
Next spread: Meadow Starts at 420
Next tier: Clover Grass at 500
```

Finding:

- The player was still short of the original sprinkler cost.
- Seed drops remained a little stingy even after Seed Pouch.
- The 250-touch quest was clearly going to be important.

## Critical Checkpoint: 250-Touch Quest

At 239 lifetime touches, before finishing the 250-touch quest:

```text
Grass Touches: 239 | Seeds: 16 | Gold: 9 | Patches: 23
Quest: A Reasonable Afternoon - 239/250 touches
```

After a short click batch, the player reached:

```text
Grass Touches: 271 | Seeds: 17 | Gold: 9 | Patches: 23
Quest ready: 1
```

The ready quest was `A Reasonable Afternoon`:

```text
Requirement: Reach 250 lifetime Grass Touches
Reward: 4 seeds + 1 gold
```

After claiming:

```text
Grass Touches: 271 | Seeds: 21 | Gold: 10 | Patches: 23
```

Seed Shop then showed:

```text
Tiny Sprinkler Blueprint
Cost: 22 seeds | Need 1 more
```

Finding:

- This was the main pacing problem.
- Landing exactly 1 seed short after the 250-touch quest felt unnecessarily frustrating.
- The player had just completed a major early checkpoint, so the next natural action should be buying or strongly engaging with the first automation unlock.
- Requiring one more random seed drop at this exact moment added friction without adding an interesting decision.

## Change Made

The Tiny Sprinkler Blueprint cost was reduced from 22 seeds to 20 seeds.

Changed file:

```text
src/game/data/seed-shop.ts
```

Diff:

```diff
-    cost: 22,
+    cost: 20,
```

Reasoning:

- This directly fixes the observed 250-touch checkpoint snag.
- It does not inflate quest rewards that would affect every later seed purchase.
- It preserves Seed Pouch pacing, because Seed Pouch was already in a good place.
- It keeps the player at 1 seed after buying the blueprint in the tested run, so the next purchases still need continued play.

## Post-Change Verification

After rebuilding and reloading the local dev game, the same fresh-save checkpoint showed:

```text
Seeds: 21 | Lifetime Seeds: 27 | Drop Chance: 14%
Tiny Sprinkler Blueprint
Cost: 20 seeds | Ready
```

Buying the blueprint succeeded.

After purchase:

```text
Seeds: 1 | Lifetime Seeds: 27 | Drop Chance: 14%
Tiny Sprinkler Blueprint unlocked.
Wild Spread: Cost 35 seeds | Need 34 more
Field Journal: Cost 28 seeds | Need 27 more
```

Automation Store then exposed Tiny Sprinkler:

```text
Grass Touches: 271 | Automation: 0/min
Tiny Sprinkler
Owned 0 | 0/min (+10/min) | at 5 | Cost 48
```

Buying the first Tiny Sprinkler succeeded.

After purchase:

```text
Grass Touches: 223 | Automation: 10/min
Tiny Sprinkler running x1. Output: 10/min (+10/min).
```

Returning to the field showed:

```text
Grass Touches: 224 | Seeds: 1 | Gold: 10 | Auto: 10/min | Systems: 1 | Patches: 23
Quest ready: 1
```

Finding:

- The updated pacing achieved the target outcome.
- The player can now convert the 250-touch checkpoint into first automation.
- The first automation purchase is still meaningful because it spends both seeds and Grass Touches.

## Technical Verification

### Local Build

Command:

```text
npm run build
```

Result:

```text
tsc && vite build
vite v8.0.16 building client environment for production...
42 modules transformed.
build completed successfully
```

### Browser Smoke Test

Checks performed:

- Reloaded local dev game after the data change.
- Continued the tested fresh save.
- Confirmed Seed Shop displayed Tiny Sprinkler Blueprint as ready at 21 seeds.
- Bought Tiny Sprinkler Blueprint.
- Opened Automation Store.
- Bought first Tiny Sprinkler.
- Returned to field.
- Confirmed HUD displayed active automation.
- Checked browser warnings/errors after each important step.

Browser warning/error result:

```text
[]
```

### Git

Commit created:

```text
7db05b8 Tune first sprinkler unlock pacing
```

Pushed branch:

```text
master
```

### Production Deploy

Deploy command:

```text
npx vercel --prod --yes
```

Result:

```text
Deployment ready.
Production: https://grass-touching-simulator-q91nr8ibj-sensitech.vercel.app
Aliased: https://grasstouchingsimulator.com
```

Public domain check:

```text
StatusCode: 200
Length: 2085
Title: Grass Touching Simulator
```

## Assessment

The early game is now smoother at the first automation handoff.

Before the tuning change, the player completed the 250-touch quest and still saw:

```text
Need 1 more
```

After the tuning change, the same point now reads:

```text
Ready
```

This is a better emotional beat. The player finishes a named early quest, claims the reward, opens the Seed Shop, and can immediately unlock the first automation layer. The game still asks the player to spend Grass Touches in the Automation Store, so there is still a second purchase decision before automation begins.

## Risks and Limitations

- This was a single fresh-save run, so seed RNG could produce slightly different outcomes in another run.
- The test used Grass Toucher only.
- The test used a desktop viewport only.
- The test did not cover a long mid-game loop after the first sprinkler.
- The test did not compare the other character classes' early economy.

The cost reduction is low risk because it affects only the first blueprint unlock and does not alter passive output, automation scaling, quest availability, or later shop costs.

## Recommended Next Test

The next most valuable pacing test is the stretch after first automation:

1. First Tiny Sprinkler running.
2. Field Journal unlock.
3. Quest Clipboard unlock.
4. Weather Jar or Wild Spread choice.
5. First companion purchase.

The key question for that pass is whether the player gets a satisfying alternation between manual play, quest claiming, automation output, and new shop unlocks after the first sprinkler starts.
