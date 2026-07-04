# Polish And Systems Roadmap

This document captures the current product-design direction for Grass Touching Simulator. It is not a locked spec. It is a shared map for future sessions so polish work does not get lost between performance fixes, balance tweaks, and feature experiments.

## Current Diagnosis

The game has a playable core and a lot of promising systems, but many of them still feel piled on rather than shaped into one clear progression arc.

The hard part from here is no longer making a working concept. The hard part is making the game feel intentional for longer play sessions:

- It should explain itself with less friction.
- Unlocks should arrive as satisfying moments, not as surprise panels.
- The UI should feel coherent and calm even when the game state is busy.
- Systems should create different player behaviors, not only add more numbers.
- Classes should meaningfully affect play style instead of feeling like flavor plus stat branches.
- The first 30-60 minutes should feel designed, paced, and rewarding.

## Product-Level Goal

Move the project from a systems prototype toward a polished incremental game product.

That means prioritizing:

- first-session clarity
- reward pacing
- readable UI hierarchy
- stronger class identity
- fewer overlapping systems
- better feedback and presentation
- save/performance reliability

Do not add major new systems until the existing ones have clearer roles.

## First 30-60 Minutes

This should be the next major design focus. Run fresh-save playthroughs and record every moment that feels confusing, slow, noisy, ugly, or underwhelming.

Questions to answer:

- What does the player understand in the first 60 seconds?
- What is the first satisfying unlock?
- When do seeds become meaningful?
- When does the Store appear, and is it useful immediately?
- When does automation feel earned?
- Are quests guiding the player or just adding another panel?
- Does each new UI button arrive with a clear reason?
- Is the player ever waiting with no interesting choice?

Desired outcome:

- The player always has one or two obvious next goals.
- Unlocks introduce one idea at a time.
- The game earns complexity instead of presenting a pile.

## Polish Buckets

### Core Feel

Touching grass should feel good every time.

Improve:

- tap/click feedback
- reward arcs
- touch burst timing
- combo readability
- unlock fanfare
- sound balance
- animation timing
- idle/regrow feedback

Reduce:

- feedback spam
- overlapping text
- unclear popups
- effects that hide the board
- moments where reward text is too small or too fast to parse

### UI Clarity

The UI currently works, but it can still feel dense and prototype-like.

Improve:

- panel hierarchy
- locked and empty states
- action button labels
- shop/store wording
- quest guidance
- compact mobile readability
- consistent icon language
- options/title/save/reset flow

Avoid:

- adding more always-visible counters
- putting unrelated systems in the same panel
- making text explain controls that should be obvious from layout
- adding new panels without checking mobile first

### Game Rhythm

Systems should arrive in a rhythm:

1. manual touching
2. first upgrades
3. seeds as a new currency
4. quests as guidance and rewards
5. Store and first automation
6. animals/gold as tangible helpers
7. weather/journal/rare grass as deeper texture
8. prestige as a long-term reset goal

This order can change, but the player should feel a clean progression from simple to rich.

### Presentation

The game needs to feel less like a debug-heavy incremental prototype.

Improve:

- title screen polish
- first-run flow
- panel transitions
- button states
- asset consistency
- music/SFX mix
- setting persistence
- fullscreen/window behavior for a future desktop build

## Systems Consolidation Pass

Before adding more systems, audit every existing system.

For each system, ask:

- What player behavior does this create?
- What fantasy does it support?
- What resource or decision does it affect?
- When does it appear in the first hour?
- Does it overlap with another system?
- Is it core, supporting, class-specific, late-game, or cuttable?

If the answer is mostly "number goes up", either:

- fold it into another system
- make it create a visible behavior
- delay it until late-game
- tie it to a class identity
- remove it

Potential roles:

- **Core:** touching, regrowth, upgrades, quests, save/progression.
- **Economy:** seeds, gold, Store, Seed Shop.
- **Automation:** passive routes, active helpers, directives.
- **Texture:** weather, seasons, rare grass, journal.
- **Identity:** classes, class upgrades, class-specific progression.
- **Long-term:** prestige, late automation synergies, collection completion.

## Class Identity Direction

Classes need to change how players approach the game. They should not only be stat packages.

### Grass Toucher

Baseline, reliable, straightforward.

Possible identity:

- strong manual touches
- clear quest progression
- steady seed reliability
- forgiving pacing
- best choice for simple, low-friction play

Potential system ties:

- quests
- basic upgrades
- consistent seed income
- fewer risky mechanics

### Femboy Slim

Fast, stylish, timing and combo focused.

Possible identity:

- crit chains
- combo windows
- quick burst rewards
- double-touch play
- active clicking rhythm

Potential system ties:

- combo splash
- crit upgrades
- perfect touch windows
- high-input rewards

### Goth Girl Baddie

Rare grass, weird events, risk/reward.

Possible identity:

- rare tiers
- hazards as opportunity
- night/moon/weather flavor
- stronger rewards from strange grass
- more volatile outcomes

Potential system ties:

- rare grass/journal
- hazards
- instant regrowth
- unusual mutations

### Bard De Wever

Rhythm, automation conducting, chain reactions.

Possible identity:

- automation timing
- route synergies
- combo-to-automation bridges
- field-wide sequences
- "conducting" the lawn rather than only touching it

Potential system ties:

- automation directives
- paired automation synergies
- chain reactions
- high-combo AOE

### Chill Philosopher

Slow scaling, control, weather, patience.

Possible identity:

- regrowth control
- weather benefits
- stable long-term scaling
- less frantic play
- deliberate optimization

Potential system ties:

- weather
- seasons
- regrowth
- persistent/passive systems
- rare value over time

## System-To-Class Mapping Ideas

These are exploratory and should be tested before implementation:

- Weather matters more to Chill Philosopher.
- Rare grass and journal discoveries matter more to Goth Girl Baddie.
- Combo splash and crit rhythm matter more to Femboy Slim.
- Automation directives and route synergies matter more to Bard De Wever.
- Quests and straightforward multipliers matter more to Grass Toucher.

The goal is not to lock systems away from other classes. The goal is to make each class care about different parts of the same game.

## Candidate Next Work

### 1. First-Session Polish Audit

Run a fresh save for 30-60 minutes and write down:

- confusing moments
- dull waits
- awkward unlocks
- unclear panel openings
- wording that feels technical
- UI crowding
- weak reward moments

Then fix the highest-impact issues before adding content.

### 2. Unlock Pacing Pass

Create a rough timeline for:

- first upgrade
- first quest claim
- first seed
- Seed Shop
- Store
- first automation
- first gold spend
- first animal
- journal/weather
- prestige teaser

Use this timeline to remove surprise complexity.

### 3. Class Redesign Pass

For each class, define:

- primary play style
- secondary play style
- first unique unlock
- first "this class feels different" moment
- late-game identity

Only then rebalance class upgrades.

### 4. UI Product Pass

Focus on:

- main HUD hierarchy
- action dock/menu layout
- locked states
- panel transitions
- quest/goal nudge
- mobile-first readability

### 5. Feedback Pass

Improve the feel of:

- touching
- crits
- seed/gold drops
- quest claims
- shop purchases
- automation starting
- animal placement
- major unlocks

## Anti-Goals For Now

Avoid these until the foundation feels better:

- adding another major currency
- adding more classes
- adding more panels
- adding another automation layer
- adding Steam-specific features
- adding desktop packaging work

Those can happen later. The current need is polish, clarity, and stronger structure.

## Future Steam Readiness Notes

Steam is not a near-term target, but the direction should keep it possible.

Eventually needed:

- desktop wrapper such as Electron or Tauri
- clean retail build without debug routes exposed
- robust save migration and optional Steam Cloud
- achievements mapped to meaningful milestones
- controller/Steam Input consideration
- polished store assets and trailer
- stable Windows build first

Do not optimize for Steam before the game feels like a finished product.
