# Ship rendering under high load

The regular ship renderer is unchanged below 2,000 ships. At 2,000 ships,
`ShipRendering` enables a presentation-only budget. It stays enabled until the
fleet falls to 1,500 ships and outstanding explosion particles fall to 400.
This gap prevents repeated mode changes near the entry threshold and keeps a
large destruction effect from immediately restoring expensive rendering.

The high-count path:

- Culls ships before assigning a visual budget of at most 1,200 representatives.
- Groups by faction, station or launch route, and normal/warp travel. Each
  visible group gets a representative, then shares the remaining budget using
  square-root weights so large garrisons do not erase small incoming fleets.
  If distinct routes themselves exceed 1,200, samples across those routes.
- Uses stable ID hash buckets and reused buffers to avoid sorting or changing
  the selection every frame. Empty historical route buffers are discarded.
- Batches ship silhouettes by faction at every zoom. Close-up glow images
  return when full detail resumes.
- Draws at most 96 warp trails, 400 visible explosion particles and 128 visible
  repelled ships. Warp trails are batched by color with simpler opacity.

No ship is removed from the simulation or assigned extra combat strength.
Movement, launch percentages, combat, production, AI, superweapons, fleet
counts and orbiting systems retain their existing update sequence. Under high
load, defender scratch arrays are reused and dead ships are compacted in place
in the same order to reduce temporary allocation and garbage collection. The
normal path keeps its existing allocation behavior. Effect state
and the simulation RNG are also unchanged; only presentation is sampled.
Planet selection, attack ranges, abilities and HUD counts keep full detail.

## Verification and profiling

Run `npx tsx --test src/game/shipRendering.test.ts` for threshold transitions,
small-battle drawing parity, representative stability and route coverage,
offscreen culling, effect budgets, seeded combat/production/AI equivalence
and Helios orbiting-fleet state preservation.

Run these separately for a repeatable mixed idle/travel/warp workload:

```
npx tsx scripts/ship-benchmark.ts --full-detail
npx tsx scripts/ship-benchmark.ts
```

The headless benchmark reports median simulation update time and records
Canvas commands; it does **not** measure browser rasterization or FPS.
For the 1,200 × 800 close-up fixture, the 500-ship case uses 2,875 commands
with either path. At 10,000 ships, commands drop from 56,075 to 5,693; at
30,000 they drop from 168,075 to 5,795. These counts explain the conservative
2,000-ship entry point, where commands drop from 11,275 to 3,793.

The simulation still scales with actual ship count. This bounds expensive
drawing work without promising unlimited fleets or a fixed FPS on every
device. Future profiling should separately measure simulation, Canvas
rasterization and mass-destruction particle updates before altering any
gameplay path.
