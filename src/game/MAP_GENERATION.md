# Generated battlefield requirements

Chapter 1 uses authored maps and is outside these generators. Hard Mode doubles enemy planet ship production; AI decisions and geometry requirements are the same as normal difficulty.

## Quick Match

Quick Match has four layout families, each with three seed-selected route plans (`QUICK_ROUTE_VARIANTS`). Crossroads retains four inward approaches; Twin Fronts separates two orbital fronts and varies its public crossing/bypass; Outer Arsenals has two inward approaches and offset perimeter entrances; Linked Arenas connects two public arenas with different inward shortcuts, including a perimeter-only variant. The seed selects a plan independently of the four-family selection (`(seed >>> 2) % 3`). Tests compare permanent route graphs without IDs, coordinates, colors, costs or weapons and require twelve different foundations.

The attack range remains 600 world units, and maps contain 35–50 planets. All planets stay at least 270 apart throughout rotation. Only declared fixed gateways may enter an orbit's attack envelope. The fixed network must survive removal of every capital and any single crossing. Independent-phase tests also retain the existing neighbor-density and maximum-neighbor requirements.

Each faction starts with 200 ships in an unchanged five-world home module. All four homes have three equally priced affordable expansion choices, four internal capital neighbors, no initial weapon world, and at least two exits. Public routes and specialist regions may be asymmetric, but cannot bypass a capital's protected opening.

### Module recipe and specialist groups

Quick Match assigns costs and rewards by layout, rather than shuffling the same specialties across every map. Crossroads has a guarded production center and cheaper perimeter raids. Twin Fronts separates production and strike systems, with fortified cross-front crossings and an outer support bypass. Outer Arsenals places its strike specialty on a guarded flank while the inner defensive route stays cheaper. Linked Arenas pairs an expensive assault arena with a cheaper support staging arena. Custom weapon focus can change specialties, while the route cost tradeoffs and protected home openings remain. The preview and match briefing explain each layout's decision.

`quickMapGenerator.ts` composes home territories, junctions, fixed arenas, one or two star systems, specialist regions and shared fixed gateways. `generated.modules` records each module's interior worlds, location and port IDs. Port worlds belong to corridor modules and are shared references, so neighboring modules cannot duplicate them.

Star modules have 5–7 worlds on a rigid ring, with binary layouts using five per star. The regular ring's worst nearest-planet distance proves at least two fixed ports stay connected for all angles. A fixed skeleton connects each star's ports even after all capitals disappear. Map bounds include fixed home worlds and full orbital paths.

Every weapon planet belongs to exactly one connected group of 3–5 worlds. `generated.weaponGroups` stores membership and allowed weapon types: production (Overdrive), defense (Repulse), strike (Omni), or support (Overdrive/Repulse). A group stays entirely within one module and is entirely fixed or rotates rigidly together. Public groups occupy both stationary modules and orbiting arcs. No isolated weapon assignment is permitted. Every map offers all three weapons overall.

Custom Quick Match has an Automatic seed option, enabled by default when migrating older setups. Each setup visit resolves a fresh seed before generating the preview; Launch uses that exact map. Entering a seed or turning Automatic seed off preserves reproducibility. The option does not alter Chaos seeds, generation, controls or campaign maps.

## Chaos Mode

Every world, including capitals, orbits a star and carries one or two distinct weapons. Generate chains, branching constellations, circuits and multiple fronts rather than selecting fixed star coordinates. Outer circuits have 10 or 12 worlds roughly 532–552 apart. Inner capitals sit 520 units inside their outer circuit, so another system cannot directly attack past that frontier.

All planet pairs remain at least 450 apart. Internal spacing is invariant under rigid rotation; swept orbital discs certify spacing between stars. Systems remain connected at all independent orbit phases, including after capital elimination. Gateways may change planets during rotation; a connection must always exist.

`permanentBridge` subdivides the two rings' phase intervals. A candidate planet pair's measured distance plus an arc-displacement bound covers the entire interval. Only fully covered intervals certify a bridge. Sampled snapshots alone are insufficient: an initially connected bridge can close later.

## Replay and variety

Explicit seeds reproduce complete maps. Play Again reuses the map and resets battle state. New Map generates a fresh seed and consumes a shuffled bag of all four families before refilling it, avoiding immediate repeats across rounds. Optional storage uses `war-of-planets.generated-maps.v3` and must tolerate corrupt or blocked storage.

Run the gameplay suite when modifying these rules. Tests cover 1,000 seeds per mode, another 1,024 distributed 32-bit seeds plus boundaries, 2,000 Quick and 3,000 Chaos independent orbital configurations, route diversity, specialist membership, real captures across orbital gateways, replay and rendering caches. Route fingerprints deliberately ignore coordinates, colors, weapon placement and ship counts. Chapter 1 and Chaos gameplay are unchanged by the Quick module recipe.
