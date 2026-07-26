# Ecosystem Works And Expanding Field

## Prototype Boundary

The ecosystem implementation has two entry surfaces:

```text
/
?alpha
?redesign&playtest
?redesign&ecosystemPrototype
```

The bare production URL and `?alpha` open the dedicated ecosystem title screen.
Players explicitly choose Continue or Begin New Field before the ecosystem
scene loads. `?redesign&playtest` and `?redesign&ecosystemPrototype` open the
ecosystem field directly for playtests and harnesses. The retired intermediate
redesign and original incremental game are no longer shipped. Their old query
parameters fall through to the current ecosystem title.

The ecosystem owns separate permanent and active-run saves, browser
diagnostics, and performance harnesses. It must not read or migrate either
existing save.

## Player Promise

The player begins with one living patch and their own hands. A run gradually
turns from a clicking game into a visible auto-clicker ecosystem: every helper
runs on its own cooldown, touches the field, restores Care, and produces a
thematic resource signal. Helpers never require fuel or consume those resources
to act. The Scourge is an increasing demand curve, not a scripted timer. A run
ends only after automated Care and manual intervention can no longer cover that
demand and the Ancient Grass reaches zero HP.

The first run is a deliberately doomed but readable roughly 15-17 second lesson
in touching and inevitable Scourge pressure. The Scourge wakes on the first
touch, then drains Ancient HP along a visible rising curve instead of applying
an immediate near-fatal strike. Its Game Over reward always covers the first
Broad Palm rank, while also making the cheaper Tiny Sprinkler unlock affordable.
The first automation run grows into minutes, and mature fields can remain active
across saved browser sessions. Closing the game never grants resources and never
advances Scourge.

## Production Graph

```text
Field -> Dew -> Moisture -> Field Growth -> Flowers -> Pollinated Blooms
                                      |                 |
                                      |                 +-> Seeds
                                      +--------------------> Clippings

Clippings -> Compost -> Humus -> Root Energy -> Care
Seeds ------> Field Growth
```

Natural conversions provide a deliberately slow background route through every
stage. They give the field ecological motion, but they never gate a purchased
helper. Helpers produce thematic resources as rewards and progression signals:

| Helper | Primary role | Alternate mode |
| --- | --- | --- |
| Tiny Sprinkler | Fuel-free automated touches, Moisture, starter Field Growth, and Care | Cultivator favors Moisture and Field Growth |
| Field Mouse | Fuel-free Field Growth and automated touches | Cache adds Care at lower speed |
| Bee Hive | Fuel-free Pollinated Blooms and automated touches | Honey Reserve adds Care at lower speed |
| Chicken Patrol | Fuel-free Compost and automated touches | Forage also produces Clippings |
| Earthworm Crew | Fuel-free Humus and automated touches | Triage adds Care at lower speed |
| Ancient Roots | Fuel-free Root Energy, Care, and automated touches | Wellspring favors Dew and Care |
| Sheep Loop | Fuel-free Clippings, Care, and automated touches | Close Crop favors Clippings |
| Meadow Rabbit | Fuel-free Field Growth and automated touches | Bloom Run favors Flowers |

Every resource remains capacity constrained, but helper outputs are
overflow-safe. A full buffer may discard excess thematic output; it never pauses
a helper cooldown, automated touch, or healing event. Empty buffers also never
stop helpers because helper recipes have no inputs. The Living Ledger reports
resource rates and automation throughput without presenting resources as fuel.

### Automated Touch Contract

Every completed helper cycle is also an automated grass-touch event. This is a
universal rule rather than a special payout on selected recipes:

| Helper tier | Automated touches per cycle |
| --- | ---: |
| Tiny Sprinkler | 1 |
| Field Mouse | 2 |
| Bee Hive | 3 |
| Chicken Patrol | 5 |
| Earthworm Crew | 8 |
| Ancient Roots | 13 |
| Sheep Loop | 21 |
| Meadow Rabbit | 34 |

Automated touches add current-run Run Touches, advance aggregate field stages,
and restore Ancient HP. Extra copies scale cycle output linearly. Each helper
has four numeric Memory branches: Speed increases cycle frequency by 30% per
rank, Reach adds 15% more automated touches per activation, Care adds 12% more
healing per automated touch, and Momentum pre-charges the first purchased copy
by 20% per rank. Tiny Sprinkler deliberately replaces Reach and Care with the
bespoke Dew Cistern afterglow and Fine Mist area-touch branches.

Simulation applies these values as aggregate fixed-tick counters. It never loops
once per automated touch and never scans the field. Presentation summarizes
completed cycles through pooled helper actions, field-impact rings, touch and
healing numbers, grass-touch audio, and a pooled restorative mote that travels
from the impact to the Ancient HP bar. Additional simultaneous cycles increase
the displayed payload without creating proportional actors or particles. A
round-robin presentation scheduler batches fast repeated helper pulses and
meters representative launches at 120 ms on desktop or 210 ms on phone-sized
views. The model still resolves every cycle immediately; only redundant visual
and audio presentations wait and combine.

### First Automation

Remembering Tiny Sprinkler reveals the Living Ledger on the following run. A
fixed First Automation strip fills from current Run Touches toward the first
10-Run-Touch sprinkler purchase. Once bought, the same strip becomes its
production-cycle meter and explicitly reports its first automated touch.
Sprinklers never consume Dew and cannot stall on full output buffers: every
completed cycle always sprinkles and awards its automated touch. The first
purchase uses the pooled
arrival, water-spray, impact, sound, and HP-bar feedback so automation reads as
a run milestone rather than a silent number change.

The teaching state advances through gathering, purchase readiness, the first
spray, and sustained Care. The first completed Care cycle celebrates at the
water impact; subsequent cycles retain the meter without repeatedly interrupting
play. Both Phaser and the semantic browser layer derive their copy from the same
objective state.

### First Seed Runner

After the first Care cycle is online, an unlocked Field Mouse becomes the next
guided production chapter. The Ledger tracks Run Touches toward its first
purchase, then switches to the mouse's scamper cycle, Field Growth output, and
automated touches. Spread mode runs quickly for stronger Field Growth throughput;
Cache mode runs more slowly while adding steady Care. Neither mode consumes
Seeds or any other resource.

On the field, the pooled mouse actor visibly picks up a Seed, scurries to a
representative patch, plants it, and returns to its parked status badge. One
pooled carried-Seed sprite and the existing impact pool represent the action;
additional simultaneous cycles are summarized by the same bounded animation.

### First Pollination Flight

Once the Field Mouse has completed a planting cycle, an unlocked Bee Hive
becomes the next guided chapter. The Ledger tracks Run Touches toward its first
hive, then follows pollination-cycle progress, Pollinated Blooms, and automated
touches. Pollinate mode favors Bloom throughput; Honey Reserve trades some
throughput for Care. Neither mode consumes Flowers or any other resource.

One pooled bee sprite flies from the hive to a representative flowering patch,
releases a bounded three-fleck pollen burst, and returns. Extra cycles queue on
that same flight instead of creating one actor or tween per hive, preserving a
fixed presentation budget as equipment counts grow.

## Fixed-Tick Simulation

Production runs on deterministic 250 ms ticks. Frame rendering never executes
recipes. A tick:

1. Calculates current Scourge demand from run age, field scale, and completed
   runs.
2. Adds field Dew and runs natural fallback recipes.
3. Runs helper recipes in graph order, limited by input, output capacity,
   Impact rank, helper count, and any reconfiguration timer.
4. Converts every completed helper cycle into tiered automated touches, field
   stage progress, Run Touches, and direct Ancient HP restoration.
5. Consumes buffered Care against Scourge demand and applies only the deficit
   to Ancient HP.
6. Advances a bounded number of representative tile stages and records rates,
   pauses, and helper pulses for presentation.

The Ecosystem Works view applies one production tick for each second of real
time, making the active run operate at quarter speed. Options pauses the model.

## Run And Permanent State

Run-local state resets at Game Over:

- HP, resources, RT, resource capacities, and measured rates
- automated-touch and automated-healing totals
- bought helper counts and selected modes
- helper reconfiguration timers
- current field size and all tile stages
- Scourge age and touch counters

Permanent Memories retain:

- banked Growth and completed-run count
- helper and alternate-mode unlocks
- field-size ceilings
- named helper ranks for Speed, Reach, Care, and Momentum
- Fast Touch, Broad Palm, Many Hands, and Field Embrace

The Memory Grove names its permanent currency **Growth**. The save model retains
the legacy `grassTouches` field name so existing saves load without migration or
lost purchases. Run-local ecological Growth is labeled **Field Growth** wherever
it appears to keep the two concepts distinct.

Helper unlocks reveal their equipment row and recipes; hidden helpers cannot be
bought. Tiny Sprinkler is the first unlock and also reveals the Living Ledger.

### Helper Memories And Remembered Touch

Every helper cluster contains a dependable ten-rank skill that improves the
helper's basic action rhythm. These skills use helper-specific identities in the
Memory Web instead of exposing internal system labels. Tiny Sprinkler's
`Clockwork Nozzle`, for example, lowers its Caretaker spray cooldown from about
2.08 seconds at rank zero to about 0.52 seconds at rank ten. The equivalent
Field Mouse, Bee Hive, and later-helper skills shorten their own trips, flights,
or production cycles.

Reach, Care, and Momentum ranks also have helper-specific names and copy. Reach
adds 15% automated touches per activation, Care adds 12% healing per automated
touch, and Momentum pre-charges the first purchased copy of that helper by 20%
per rank. Tiny Sprinkler is the deliberate exception: `Dew Cistern` turns each
sprinkler hit into a four-second, stacking healing afterglow, while `Fine Mist`
gives each sprinkler hit a 6%-per-rank chance to touch every neighboring tile.
Internal save keys retain their old names so existing player investments migrate
without being reset; those names are not exposed as current mechanics.

When a multi-rank Memory reaches its final rank, the node plays a bounded
mastery fanfare with milestone audio, gold rings, sparks, and a `MASTERED`
banner. Afterwards its frame, glow, title, status, and completed rank pips remain
gold. One-time unlock nodes retain their ordinary owned styling so full-rank
mastery stays visually meaningful.

Every permanent Memory purchase also contributes one point of Remembered
Touch. Each point adds 3% to the power of ordinary manual touch batches,
including HP restored, Dew gathered, Field Growth tended, and RT earned. Unlocks, alternate modes,
field tiers, capstones, and each numeric rank all contribute one point. This
keeps the player's hands relevant as automation grows and makes every branch a
small step toward surviving later Scourge pressure. A fresh Run 1 has no
Memories and manual healing is disabled there, so its authored collapse rhythm
is unchanged.

After the authored first collapse, **Hand Tending** gives every accepted manual
touch `0.35 Field Growth` per point of touch power. This makes the inherited 1x1 plot
an active Field Growth source before the Field Mouse arrives. The default Tiny
Sprinkler Caretaker spray also produces a small Field Growth trickle while preserving
its primary Moisture and Care role. Run 1 grants no Hand Tending Field Growth because
its first touch is still the deliberate onboarding collapse.

## Field Ladder And Expansion

```text
1x1 -> 2x2 -> 3x3 -> 5x5 -> 8x8 -> 12x12
    -> 20x20 -> 32x32 -> 50x50 -> 75x75 -> 100x100
```

Field expansion is a major run milestone, not a ten-step Field Growth sink. The next
Expanding Field Memory first permits a larger size. During a later active run,
the player buys that expansion once with Run Touches, the same currency used
for helpers such as Tiny Sprinkler.

| Expansion | Run Touches |
| --- | ---: |
| `1x1 -> 2x2` | 250 |
| `2x2 -> 3x3` | 1,000 |
| `3x3 -> 5x5` | 2,000 |
| `5x5 -> 8x8` | 4,000 |
| `8x8 -> 12x12` | 8,000 |
| `12x12 -> 20x20` | 16,000 |
| `20x20 -> 32x32` | 32,000 |
| `32x32 -> 50x50` | 64,000 |
| `50x50 -> 75x75` | 128,000 |
| `75x75 -> 100x100` | 256,000 |

After the discounted first expansion, the cost doubles at every rung. Field
Growth remains an ecosystem production resource and is never spent to resize
the field. Expansion preserves old tiles
in the center, creates new dormant tiles around them, recenters the view, and
plays a dedicated milestone presentation. The larger field remains run-local
and resets at Game Over.

## Manual Touch Batches

A touch always applies full power to its primary tile. It heals HP, generates
Dew and RT, and advances that tile's natural stage.

Each primary tile then enters a short, explicit recovery window. The tile dims,
a recovery strip fills, and an early repeat tap pulses immediately without
awarding another touch. Different tiles remain independently touchable, so a
larger field supports fast fluid routing. Fast Touch has ten permanent ranks;
each rank removes 24 ms from the base 380 ms recovery, reaching a 140 ms floor.

- Fast Touch has ten ranks. It costs more than the guaranteed first-run reward,
  preserving Broad Palm and Tiny Sprinkler as the first immediate choices.
- Broad Palm has ten ranks. Radius is
  `1 + floor((rank - 1) / 2)` and nearby effectiveness scales linearly from
  40% to 100%.
- Many Hands has ten ranks. It selects `2 * rank` random tiles outside the
  Broad Palm area at 35% to 80% effectiveness.
- Field Embrace triggers every tenth manual touch and selects one random tile
  in every 10x10 chunk at 50% effectiveness.

One tile can appear only once in a batch. State changes are applied together.
At most 24 representative impacts are returned to the renderer; additional
effects are summarized numerically.

## 10,000-Tile Representation

Every tile has real state, but a tile is not a Phaser object:

- `Uint8Array` stores common tile stage.
- `Uint16Array` stores per-chunk stage counts.
- sparse sets/maps store wounds and exceptional timers.
- field changes update their chunk summary immediately and mark only that chunk
  dirty.
- aggregate recipe counters and a bounded stage cursor replace field scans.
- 10x10 chunks form the fixed simulation and far-view unit.

The renderer has three levels of detail:

| Level | Presentation | Bound |
| --- | --- | --- |
| Near | Pooled individual tile images for visible cells | viewport budget |
| Mid | Pooled chunk panels plus selected special tiles | visible chunks |
| Far | One summarized region per 10x10 chunk | at most 100 regions |

Input uses one mathematical field surface. It converts a pointer coordinate to
a logical tile or chunk; there are never 10,000 Phaser or DOM hit targets. The
DOM bridge exposes coordinate inputs, a readable chunk summary, and virtualized
visible-tile information for keyboard and agent access.

## Active Save Contract

`ActiveFieldSnapshot` is versioned separately from permanent memory. It stores:

- HP, Scourge age, fixed-tick accumulator, deterministic RNG state
- all resource buffers and measured totals
- helper counts, modes, cooldowns, and recipe progress
- field size, compact base64 tile bytes, and sparse exceptions
- RT, manual and automated touch counters, automated healing, production
  totals, measured automation rates, and current view state

Snapshots are written after purchases, mode changes, field expansion,
periodically, and on page hide. Loading reconstructs chunk counts from compact
tile bytes.
Wall-clock timestamps are informational only; elapsed real time is never fed
back into the simulation.

## Performance Gates

Prototype harness routes use the ecosystem scene itself:

```text
?redesign&ecosystemPrototype&playtest&field=32
?redesign&ecosystemPrototype&playtest&field=50
?redesign&ecosystemPrototype&playtest&field=100
```

`document.documentElement.dataset.grassEcosystemHarness` reports logical tile
count, rendered tile/chunk objects, dirty chunks, fixed ticks, active effects,
frame delta, and full-field scan count. Ordinary production must keep the final
value at zero. Targets are approximately 60 FPS on desktop and at least 30 FPS
on phones, with object counts bounded by viewport size.

## Promotion Gate

The ecosystem may own the production entry route on its release branch without
being ready to merge. Promotion to `master` still requires deterministic tests,
save/resume checks, desktop and phone browser passes, measured
32x32/50x50/100x100 harness results, and hands-on approval that the production
decisions are enjoyable.
