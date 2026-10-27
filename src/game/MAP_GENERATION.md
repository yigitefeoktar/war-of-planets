# Generated battlefield requirements

Chapter 1 uses authored maps and is outside these generators. Hard Mode doubles enemy planet ship production; AI decisions and geometry requirements are the same as normal difficulty.

## Quick Match

Build strategic networks before placing modules. Divided territories favour regional crossings; branching fronts have sparse paths and occasional loops; outer circuits join modules around a circuit; linked arenas favour connected rooms. Seed variation changes route structure, module composition, specialist regions and geometry.

The attack range remains 600 world units. All planets stay at least 500 apart throughout rotation. Static route steps are 500–503. Orbital gateways can have longer attack links, certified below 599 at the worst phase. Only declared fixed gateways may enter an orbit's attack envelope; other fixed worlds and other swept systems remain beyond it. Home gates remain mandatory entrances to rear territory.

Each faction starts with 200 ships and two equal-cost expansion choices. Four equivalent home modules use an eight-world loop or nine-world crossing. All homes share a single starter specialty with equal first-weapon capture costs. Other specialties occur in public regions; their routes can be asymmetric. Capital elimination must leave the remaining routes connected.

### Module recipe and specialist groups

`quickMapGenerator.ts` composes home territories, junctions, fixed arenas, one or two star systems, specialist regions and shared fixed gateways. `generated.modules` records each module's interior worlds, location and port IDs. Port worlds belong to corridor modules and are shared references, so neighboring modules cannot duplicate them.

Star modules have twelve worlds on a rigid ring, radius twice the route unit, with fixed ports three units from the star. The regular ring's worst nearest-planet distance proves each port stays connected for all angles. A fixed skeleton with certified virtual links between each star's ports proves the whole map stays connected even after all capitals disappear. Map bounds include fixed home worlds and full orbital paths.

Every weapon planet belongs to exactly one connected group of 3–5 worlds. `generated.weaponGroups` stores membership and allowed weapon types: production (Overdrive), defense (Repulse), strike (Omni), or support (Overdrive/Repulse). A group stays entirely within one module and is entirely fixed or rotates rigidly together. Public groups occupy both stationary modules and orbiting arcs. No isolated weapon assignment is permitted. Every map offers all three weapons overall.

## Chaos Mode

Every world, including capitals, orbits a star and carries one or two distinct weapons. Generate chains, branching constellations, circuits and multiple fronts rather than selecting fixed star coordinates. Outer circuits have 10 or 12 worlds roughly 532–552 apart. Inner capitals sit 520 units inside their outer circuit, so another system cannot directly attack past that frontier.

All planet pairs remain at least 450 apart. Internal spacing is invariant under rigid rotation; swept orbital discs certify spacing between stars. Systems remain connected at all independent orbit phases, including after capital elimination. Gateways may change planets during rotation; a connection must always exist.

`permanentBridge` subdivides the two rings' phase intervals. A candidate planet pair's measured distance plus an arc-displacement bound covers the entire interval. Only fully covered intervals certify a bridge. Sampled snapshots alone are insufficient: an initially connected bridge can close later.

## Replay and variety

Explicit seeds reproduce complete maps. Play Again reuses the map and resets battle state. New Map generates a fresh seed and consumes a shuffled bag of all four families before refilling it, avoiding immediate repeats across rounds. Optional storage uses `war-of-planets.generated-maps.v3` and must tolerate corrupt or blocked storage.

Run the gameplay suite when modifying these rules. Tests cover 1,000 seeds per mode, another 1,024 distributed 32-bit seeds plus boundaries, 2,000 Quick and 3,000 Chaos independent orbital configurations, route diversity, specialist membership, real captures across orbital gateways, replay and rendering caches. Route fingerprints deliberately ignore coordinates, colors, weapon placement and ship counts. Chapter 1 and Chaos gameplay are unchanged by the Quick module recipe.
