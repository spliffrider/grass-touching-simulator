# Ecosystem Works And Expanding Field

## Prototype Boundary

The ecosystem prototype runs only at:

```text
?redesign&ecosystemPrototype
```

The public Ancient Grass alpha and the legacy `GameScene` remain separate. The
prototype owns separate permanent and active-run saves, browser diagnostics,
and performance harnesses. It must not read or migrate either existing save.

## Player Promise

The player begins with one living patch and their own hands. A run gradually
becomes a visible production ecosystem: dew is gathered, growth is cultivated,
animals and tools move materials, and Ancient Roots turn the whole chain into
Care. The Scourge is an increasing demand curve, not a scripted timer. A run
ends only after available Care and manual intervention can no longer cover that
demand and the Ancient Grass reaches zero HP.

Early runs last minutes. Mature fields can remain active across saved browser
sessions. Closing the game never grants resources and never advances Scourge.

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
- throughput, storage, efficiency, and starting-stock ranks
- Broad Palm, Many Hands, and Field Embrace

Helper unlocks reveal their equipment row and recipes; hidden helpers cannot be
bought. Tiny Sprinkler is the first unlock and also reveals the Living Ledger.

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

The prototype is not the public alpha merely because it builds. Promotion
requires deterministic tests, save/resume checks, desktop and phone browser
passes, measured 32x32/50x50/100x100 harness results, and hands-on approval that
the production decisions are enjoyable.
