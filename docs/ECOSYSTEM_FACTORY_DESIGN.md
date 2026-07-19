# Ecosystem Works And Expanding Field

## Prototype Boundary

The ecosystem implementation has two entry surfaces:

```text
/
?alpha
?redesign&ecosystemPrototype
```

The bare production URL and `?alpha` open the dedicated ecosystem title screen.
Players explicitly choose Continue or Begin New Field before the ecosystem
scene loads. `?redesign&ecosystemPrototype` remains the direct developer route
for playtests and harnesses. The older redesign remains available through
`?redesign`, while `?legacy` and the legacy harness parameters still select the
old `GameScene`.

The ecosystem owns separate permanent and active-run saves, browser
diagnostics, and performance harnesses. It must not read or migrate either
existing save.

## Player Promise

The player begins with one living patch and their own hands. A run gradually
becomes a visible production ecosystem: dew is gathered, growth is cultivated,
animals and tools move materials, and Ancient Roots turn the whole chain into
Care. The Scourge is an increasing demand curve, not a scripted timer. A run
ends only after available Care and manual intervention can no longer cover that
demand and the Ancient Grass reaches zero HP.

The first run is a deliberately brutal 2-4 second lesson in touching and
inevitable Scourge pressure. Its Game Over reward always covers the first Broad
Palm rank, while also making the cheaper Tiny Sprinkler unlock affordable. The
first automation run grows into minutes, and mature fields can remain active
across saved browser sessions. Closing the game never grants resources and
never advances Scourge.

## Production Graph

```text
Field -> Dew -> Moisture -> Growth -> Flowers -> Pollinated Blooms
                                      |                 |
                                      |                 +-> Seeds
                                      +--------------------> Clippings

Clippings -> Compost -> Humus -> Root Energy -> Care
Seeds ------> Growth
```

Natural conversions provide a deliberately slow route through every stage so
that a full or missing helper can stall efficiency without permanently locking
a run. Helper recipes provide the useful throughput:

| Helper | Primary role | Alternate mode |
| --- | --- | --- |
| Tiny Sprinkler | Dew to Moisture and Care | Cultivator favors Moisture and Growth |
| Field Mouse | Seeds to Growth and RT | Cache favors input efficiency |
| Bee Hive | Flowers to Pollinated Blooms | Honey Reserve adds Care at lower throughput |
| Chicken Patrol | Clippings to Compost and RT | Forage also produces Clippings from Growth |
| Earthworm Crew | Compost to Humus | Triage adds Care at lower throughput |
| Ancient Roots | Humus to Root Energy and Care | Wellspring spends Root Energy on Dew and Care |
| Sheep Loop | Growth to Clippings and Care | Close Crop favors Clippings |
| Meadow Rabbit | Seeds to Growth | Bloom Run turns Seeds into Flowers |

Every resource is capacity constrained. A recipe pauses, without consuming its
input, when any required output has no room. The Living Ledger identifies those
pauses and reports the resource currently limiting Care throughput.

### First Automation

Remembering Tiny Sprinkler reveals the Living Ledger on the following run. A
fixed First Automation strip fills from current RT toward the first 14 RT
sprinkler purchase. Once bought, the same strip becomes its production-cycle
meter and explicitly reports `Dew -> Moisture + Care`; if the recipe pauses for
Dew, it tells the player to touch the field. The first purchase uses the pooled
arrival, water-spray, impact, sound, and HP-bar feedback so automation reads as
a run milestone rather than a silent number change.

The teaching state advances through gathering, purchase readiness, the first
spray, sustained Care, and a dry-sprinkler recovery prompt. The first completed
Care cycle celebrates at the water impact; subsequent cycles retain the meter
and Dew-reserve instruction without repeatedly interrupting play. Both Phaser
and the semantic browser layer derive their copy from the same objective state.

### First Seed Runner

After the first Care cycle is online, an unlocked Field Mouse becomes the next
guided production chapter. The Ledger tracks RT toward its first purchase, then
switches to the mouse's planting cycle, Seed reserve, Growth output, and any
blocked or starved state.

The first Field Mouse bought in each run discovers a three-Seed starter cache.
This guarantees an immediate planting demonstration without bypassing the
long-term Seed economy. Later mice do not create more starter stock. Spread mode
plants quickly for stronger Growth and RT throughput; Cache mode works more
slowly while spending fewer Seeds.

On the field, the pooled mouse actor visibly picks up a Seed, scurries to a
representative patch, plants it, and returns to its parked status badge. One
pooled carried-Seed sprite and the existing impact pool represent the action;
additional simultaneous cycles are summarized by the same bounded animation.

### First Pollination Flight

Once the Field Mouse has completed a planting cycle, an unlocked Bee Hive
becomes the next guided chapter. The Ledger tracks RT toward its first hive,
then follows Flower reserves, pollination-cycle progress, Pollinated Blooms,
and blocked or flower-starved states.

The first Bee Hive bought in each run opens four nearby Flowers. The reserve is
large enough to demonstrate the new conversion immediately without replacing
the natural Growth-to-Flowers chain. Later hives do not create more Flowers.
Pollinate mode favors Bloom throughput; Honey Reserve trades some throughput
for Care.

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
   efficiency rank, helper count, and any reconfiguration timer.
4. Consumes buffered Care against Scourge demand and applies only the deficit
   to Ancient HP.
5. Advances a bounded number of representative tile stages and records rates,
   pauses, and helper pulses for presentation.

The Ecosystem Works view applies one production tick for each second of real
time, making the active run operate at quarter speed. Options pauses the model.

## Run And Permanent State

Run-local state resets at Game Over:

- HP, resources, RT, resource capacities, and measured rates
- bought helper counts and selected modes
- helper reconfiguration timers
- cultivation rank, current field size, and all tile stages
- Scourge age and touch counters

Permanent Memories retain:

- banked GT and completed-run count
- helper and alternate-mode unlocks
- field-size ceilings
- named helper ranks for action speed, storage, efficiency, and starting stock
- Fast Touch, Broad Palm, Many Hands, and Field Embrace

Helper unlocks reveal their equipment row and recipes; hidden helpers cannot be
bought. Tiny Sprinkler is the first unlock and also reveals the Living Ledger.

### Helper Memories And Remembered Touch

Every helper cluster contains a dependable ten-rank skill that improves the
helper's basic action rhythm. These skills use helper-specific identities in the
Memory Web instead of exposing internal system labels. Tiny Sprinkler's
`Clockwork Nozzle`, for example, lowers its Caretaker spray cooldown from about
2.94 seconds at rank zero to about 1.34 seconds at rank ten. The equivalent
Field Mouse, Bee Hive, and later-helper skills shorten their own trips, flights,
or production cycles.

Storage, efficiency, and starting-stock ranks also have helper-specific names
and copy. Every storage rank expands the actual input or output buffers used by
its helper; no helper may expose a storage Memory with no mechanical target.
The underlying rank fields retain their stable save identifiers, so existing
permanent saves receive the new presentation and behavior without migration.

Every permanent Memory purchase also contributes one point of Remembered
Touch. Each point adds 1% to the power of ordinary manual touch batches,
including HP restored, Dew gathered, and RT earned. Unlocks, alternate modes,
field tiers, capstones, and each numeric rank all contribute one point. This
keeps the player's hands relevant as automation grows and makes every branch a
small step toward surviving later Scourge pressure. A fresh Run 1 has no
Memories and manual healing is disabled there, so its authored collapse rhythm
is unchanged.

## Field Ladder And Cultivation

```text
1x1 -> 2x2 -> 3x3 -> 5x5 -> 8x8 -> 12x12
    -> 20x20 -> 32x32 -> 50x50 -> 75x75 -> 100x100
```

Each size has ten run-local Cultivation ranks bought with Growth. A rank adds
Dew yield and field storage. Rank ten expands the logical field if the next
size Memory is owned. Expansion preserves old tiles in the center and creates
new dormant tiles around them. At the current permanent ceiling, rank ten
remains a useful maximum-rank production bonus.

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
- field size, cultivation, compact base64 tile bytes, and sparse exceptions
- RT, touch counters, production totals, and current view state

Snapshots are written after purchases, mode changes, cultivation, periodically,
and on page hide. Loading reconstructs chunk counts from compact tile bytes.
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
