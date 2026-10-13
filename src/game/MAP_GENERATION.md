# Generated battlefield requirements

Chapter 1 uses authored maps and is outside these generators. Hard Mode changes AI difficulty; it uses the same geometry requirements as normal difficulty.

## Quick Match

Build strategic networks before placing worlds. Divided territories have limited crossings; branching fronts have sparse paths and occasional loops; outer circuits have central crossings and variable weapon pockets; linked arenas join independently chosen rooms. Seed variation must change route structure, not only coordinates, colors or garrisons.

The attack range remains 600 world units. Planets must be at least 500 apart. Intended links stay within 575 and non-links stay beyond 650, providing a margin around the attack threshold. Reject triangles, excess neighbors and attacks into a home's rear from outside its frontier. Most worlds have 2–4 neighbors; deliberate resource pockets may be dead ends.

Each faction starts with 200 ships and two equal-cost expansion choices. Home weapon capture costs are equivalent between colors, even when public routes are asymmetric. Capital elimination must leave the remaining routes connected. Frontier gates may be bottlenecks: losing an ordinary neutral planet does not delete it from the map.

## Chaos Mode

Every world, including capitals, orbits a star and carries one or two distinct weapons. Generate chains, branching constellations, circuits and multiple fronts rather than selecting fixed star coordinates. Outer circuits have 10 or 12 worlds roughly 532–552 apart. Inner capitals sit 520 units inside their outer circuit, so another system cannot directly attack past that frontier.

All planet pairs remain at least 450 apart. Internal spacing is invariant under rigid rotation; swept orbital discs certify spacing between stars. Systems remain connected at all independent orbit phases, including after capital elimination. Gateways may change planets during rotation; a connection must always exist.

`permanentBridge` subdivides the two rings' phase intervals. A candidate planet pair's measured distance plus an arc-displacement bound covers the entire interval. Only fully covered intervals certify a bridge. Sampled snapshots alone are insufficient: an initially connected bridge can close later.

## Replay and variety

Explicit seeds reproduce complete maps. Play Again reuses the map and resets battle state. New Map generates a fresh seed and consumes a shuffled bag of all four families before refilling it, avoiding immediate repeats across rounds. Optional storage uses `war-of-planets.generated-maps.v2` and must tolerate corrupt or blocked storage.

Run the gameplay suite when modifying these rules. Tests cover 1,000 seeds per mode, another 1,024 distributed 32-bit seeds plus boundaries, 3,000 independent orbital configurations, route diversity, affordable real fleet captures, replay and rendering caches. Route fingerprints deliberately ignore rotation, coordinates, colors, weapon placement and ship counts.
