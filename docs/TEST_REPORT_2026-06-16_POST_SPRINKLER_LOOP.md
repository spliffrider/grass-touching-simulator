# Post-Sprinkler Loop Playtest

Date: 2026-06-16

Build: local Vite dev server at `http://127.0.0.1:5174`

Starting checkpoint: continued the fresh-save run after first Tiny Sprinkler placement.

## Checkpoints

- Started at 264 lifetime touches, 11 seeds, 15 gold, 23 patches, 10/min automation, 1 system.
- At 434 lifetime touches, Meadow Starts expanded the field from 23 to 35 patches.
- The first Field Mouse Route was affordable from the Automation Store at that point and raised automation from 10/min to 30/min.
- Claiming ready quests after Meadow Starts pushed seeds to 39, making both Field Journal and Wild Spread ready at the same time.
- Field Journal unlocked cleanly, added the Journal button, and exposed journal progress.
- Buying Wild Spread at 37 seeds felt natural but delayed Weather Jar and Quest Clipboard.
- At 700 lifetime touches, Palm Memory put Wild Spread cleanly in reach when claimed.
- Bee Hive Shift was affordable soon after and raised automation from 30/min to 61/min.
- Neighbor Notices at 820 lifetime touches expanded the field from 35 to 51 patches.
- Wild Spread later added an extra patch before the next milestone, but its moment-to-moment payoff was subtle compared with milestone expansion.
- Extra Tiny Sprinkler and Field Mouse buys raised automation to 91/min and helped the seed grind feel less stalled.
- Quest Clipboard became ready shortly after the 1,200-touch tier reward wave.
- Clipboard did not claim rewards instantly in the Seed Shop, but after returning to the field it auto-claimed ready rewards and made its value clear.
- Serious Pasture at 1,500 lifetime touches expanded the field to 76 patches and made Weather Jar comfortably affordable.
- Weather Jar unlocked Warm Sunlight, updated the HUD weather line, showed the weather badge, and produced no browser warnings or errors.
- Reloading the Weather Jar save initially exposed a scene creation crash when weather discovery tried to play the Journal celebration before the Journal button existed.

## Findings

- First post-sprinkler automation pacing is strong. Field Mouse Route and Bee Hive Shift arrive soon enough to make automation feel like a growing system.
- Field Journal is the better first seed-shop nudge after the sprinkler because it unlocks Journal, Weather Jar, and Quest Clipboard.
- Wild Spread is fun but subtle; it works better as a branch after the journal lane is visible, not as the first listed ready item.
- Quest Clipboard feels worth its 54-seed price. It is late enough not to obsolete manual claiming immediately, and the first auto-claim is easy to notice from the HUD jump.
- Weather Jar is satisfying after Clipboard and the 1,500-touch milestone, but it is delayed if the player buys Wild Spread first.

## Changes Made From This Pass

- Reordered Seed Shop items so Field Journal appears before Wild Spread.
- Moved the desktop Weather Jar badge left of the right-side menu rail so it does not overlap the Auto or Journal buttons.
- Moved the initial weather update later in scene creation and guarded Journal celebration so Weather Jar saves reload safely.
