# Campaign maps

Map data and chapter ordering live in `src/game/campaign.ts`. `createMatch` loads an authored map or uses the existing random generator when no map is supplied. The gameplay engine remains shared.

Each map defines a stable ID, title, briefing, world size, attack range, objective, and planets. Planet coordinates are world units; ships are non-negative integers. Supported owners are the four existing faction colors and neutral gray. The current objective is enemy-capital elimination; the player's capital must survive. Validation rejects duplicate IDs, invalid dimensions or owners, missing capitals, and unreachable planets.

To add a level, create another `MapDefinition` and append it to the chapter's `maps` array. Do not rename released map IDs. Winning records the ID and automatically starts the next array entry after six seconds; the victory button can start it immediately. If no next map is released, the player can replay or return to the menu. Chapter 2 remains unavailable until its first map is added.

The versioned browser save stores completed map IDs; its legacy selected-mode field is ignored when loading, so every page opening selects Chapter 1. Players can still choose another mode for the current session. Start Chapter 1 always begins with First Strike's tutorial, regardless of previous wins, then victory automatically advances to The Turning Tide as Level 2. Retrying a defeat stays on the current level. Starting another run from the menu or refreshing returns to the tutorial, without deleting completed-level records. Invalid saves reset safely; unavailable browser storage shows a warning.

Checks: `npm run lint`, `npx tsx --test src/game/*.test.ts`, `npm run build`.

Current content: Chapter 1 / First Strike (34 fixed planets, four factions) and The Turning Tide (24 planets, three factions, one orbiting system). Missions 3–5 and Chapter 2 are not released yet.

## First Strike tutorial

First Strike alone opts into an action-driven tutorial via `tutorial.attackTargetId`. It is an authored 3000 × 3000 static map inspired by the original random battlefield: blue capital in the south, red/green/yellow capitals in the north, and neutral expansion routes between them. All 34 planet positions, owners, and starting ship counts are identical on each launch. No orbit or central star is present. A weak red outpost directly ahead of the player teaches the first attack.

Prompts teach selecting blue then attacking red, scrolling down/pinching fingers together to zoom out, and capturing every enemy capital while protecting the player's own. Tutorial accents use the existing Chapter 1 cyan-blue (`#73dcff`). Click targets have a circle pulsing every 700ms with no arrow. The zoom prompt shows two matching circles at 58% across/down the viewport; they spread apart and snap back side-by-side every 1.6 seconds while also pulsing in scale, brightness, and glow every 700ms. This requested outward visual cue does not change actual pinch controls. Reduced-motion preferences disable the CSS animations. The win lesson highlights surviving enemy capitals, not ordinary planets.

Selection immediately advances to the attack prompt. After the first fleet launches, the tutorial hides for four active-play seconds before showing the zoom lesson, leaving time to watch the attack. Pausing also pauses this delay; later attacks cannot restart it. A manual zoom completed during the delay is remembered, but the capital explanation still waits until the delay ends. Retry creates a fresh tutorial state and there are no delayed browser timers to leak into the next mission.

The zoom lesson and two-circle cue are touch-only (`hover: none` and `pointer: coarse`). PC players go directly from the post-attack delay to the capital explanation, with a two-step counter instead of three; mouse-wheel zoom still works normally. Detection is based on input capability rather than viewport width, so shrinking a desktop window does not enable the touch lesson.

The opening simulation is held still until the first hostile fleet launch (or Skip), without accumulating production or AI time. The camera settles on the player's opening fleet on both desktop and mobile. Selecting/deselecting updates the first prompt; a real launch advances it, and manually zooming out to the map overview advances to the win explanation. The intro camera never completes that lesson. Players can skip at any time or dismiss the final explanation with Got it. The tutorial restarts on mission retry/replay and does not change campaign saves. Other missions and Quick Match have no tutorial. The old persistent mission title/objective overlay and pause-menu mission briefing are removed from every level.

## Mission 2: The Turning Tide

A 2600 × 2600 battlefield, with 12 fixed outer worlds and 12 rotating worlds around one white star. Rotation remains clockwise, once every 180 seconds. Both enemy capitals must fall; the blue capital must survive.

- Opening: 260 ships at the fixed southern capital. Two cheap outer harbours and the boarding planet provide three expansion choices before enemy territory.
- Moving route: board the outer orbit, develop the four inner worlds, and use passing planets as staging positions. All 12 orbiting worlds share angular speed; connections to the fixed outer ring open and close.
- Fixed routes: the west and east flanks provide permanent, more heavily defended alternatives to riding the orbit.
- Pressure: red and green each begin with a capital, a fixed outpost, and an orbiting foothold. The northern neutral divide separates their command worlds, but they can fight each other too.
- Reward: more captured worlds mean more ship production and access to the existing five-planet Omni-Strike. No new special-planet mechanic is introduced.

The full orbit stays clear of fixed planets. Desktop opens on the complete map; `mobileFocus: 'capital'` moves from the overview intro to a readable southern opening on phones. Normal panning and zoom remain available. Mission 2 is reached by winning the tutorial mission in the current campaign run, not by skipping ahead using old completion records.

## Orbiting system

An optional `orbit` defines the fixed white star centre (`x`, `y`), a clockwise rotation period in simulation seconds (`periodSeconds`), and participating `planetIds`. The Turning Tide rotates 12 of its 24 planets once every 180 seconds. Every member uses the same angular speed, preserving their spacing and mutual attack ranges. The star is decorative: no ownership, collision, gravity, damage, ships, or effect on victory. Orbit regression tests use an independent fixture so tutorial map changes do not change their coverage.

Stationed ships move with their planet; launched ships pursue the moving target in world space. Captures do not stop an orbit. Pausing stops rotation, retry resets positions, and end-of-battle slow motion applies to orbits too. Quick Match still uses the unchanged static random map. Validation checks membership, period, star clearance, and the complete orbit's map-edge clearance. Only one system per map is supported for now; multiple stars are intentionally deferred.
