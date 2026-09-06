# Campaign maps

Map data and chapter ordering live in `src/game/campaign.ts`. `createMatch` loads an authored map or uses the existing random generator when no map is supplied. The gameplay engine remains shared.

Each map defines a stable ID, title, briefing, world size, attack range, objective, and planets. Planet coordinates are world units; ships are non-negative integers. Supported owners are the four existing faction colors and neutral gray. The current objective is enemy-capital elimination; the player's capital must survive. Validation rejects duplicate IDs, invalid dimensions or owners, missing capitals, and unreachable planets.

To add a level, create another `MapDefinition` and append it to the chapter's `maps` array. Do not rename released map IDs. Winning records the ID and automatically starts the next array entry after six seconds; the victory button can start it immediately. If no next map is released, the player can replay or return to the menu. Chapter 2 remains unavailable until its first map is added.

The versioned browser save stores the selected mode and completed map IDs. Continue starts the first incomplete released mission. If all released missions are completed, replay begins at the first map. Finishing a replay never removes progress. Refreshing or returning to the menu restarts the current battle, not its exact simulation state. Invalid saves reset safely; unavailable browser storage shows a warning.

Checks: `npm run lint`, `npx tsx --test src/game/*.test.ts`, `npm run build`.

Current content: Chapter 1 / First Strike, a nine-planet, two-faction introduction with one orbiting system. Other authored levels and special-planet mechanics are not implemented yet.

## Orbiting system

An optional `orbit` defines the fixed white star centre (`x`, `y`), a clockwise rotation period in simulation seconds (`periodSeconds`), and participating `planetIds`. First Strike rotates all nine planets once every 180 seconds. Every member uses the same angular speed, preserving their spacing and mutual attack ranges. The star is decorative: no ownership, collision, gravity, damage, ships, or effect on victory. The inner neutral planet was moved away from the star to keep both readable.

Stationed ships move with their planet; launched ships pursue the moving target in world space. Captures do not stop an orbit. Pausing stops rotation, retry resets positions, and end-of-battle slow motion applies to orbits too. Quick Match still uses the unchanged static random map. Validation checks membership, period, star clearance, and the complete orbit's map-edge clearance. Only one system per map is supported for now; multiple stars are intentionally deferred.
