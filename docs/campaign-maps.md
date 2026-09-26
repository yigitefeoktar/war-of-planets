# Campaign maps

Map data and chapter ordering live in `src/game/campaign.ts`. `createMatch` loads an authored map or uses the existing random generator when no map is supplied. The gameplay engine remains shared.

Each map defines a stable ID, title, briefing, world size, attack range, objective, and planets. Planet coordinates are world units; ships are non-negative integers. Supported owners are the four existing faction colors and neutral gray. Planets can optionally list the superweapons they produce while owned. The current objective is enemy-capital elimination; the player's capital must survive. Validation rejects duplicate IDs, invalid dimensions or owners, invalid weapon lists, missing capitals, and unreachable planets.

To add a level, create another `MapDefinition` and place it at the intended position in the chapter's `maps` array. Do not rename released map IDs. Winning records the ID and automatically starts the next array entry after six seconds; the victory button can start it immediately. If no next map is released, the player can replay or return to the menu. Chapter 2 remains unavailable until its first map is added.

The versioned browser save stores completed map IDs; its legacy selected-mode field is ignored when loading, so every page opening selects Chapter 1. Players can still choose another mode for the current session. Start Chapter 1 always begins with First Strike's tutorial, regardless of previous wins, then victory advances to The Breach Line as Level 2 and The Turning Tide as Level 3. Retrying a defeat stays on the current level. Starting another run from the menu or refreshing returns to the tutorial, without deleting completed-level records. Existing completion IDs remain valid when a new map is inserted. Invalid saves reset safely; unavailable browser storage shows a warning.

Checks: `npm run lint`, `npx tsx --test src/game/*.test.ts`, `npm run build`.

## Friendly logistics network

The 600-world-unit range remains a strict source-to-target limit for attacks against enemy and neutral planets. Friendly transfers use the same radius only to determine network connectivity: if two owned planets are joined by any chain of friendly links where every link is 600 units or shorter, ships may fly directly between them regardless of their direct distance. Disconnected friendly planets cannot transfer to each other.

Connectivity is recalculated when the order is issued, using current ownership and live positions. Capturing a bridge can join or split networks, and moving planets can create temporary connections. Once launched, a transfer continues to its destination even if the connection later breaks. Mouse and touch orders share the same rule. Selection and range visuals remain the existing game visuals; this feature adds no network lines or destination rings. Hostile AI logic, Omni-Strike range, and ordinary attack range are unchanged.

Current content: Chapter 1 / First Strike (9 fixed planets), The Breach Line (23 fixed planets and six Overdrive sites), and The Turning Tide (24 planets, one orbiting system and a decorative star). Missions 4–5 and Chapter 2 are not released yet.

## Galaxy and camera

Authored maps choose a `galaxyTheme`: First Strike has one faint blue cloud, The Breach Line uses muted violet and rose, and The Turning Tide uses teal and violet. Cloud and star counts grow with battlefield area. Quick Match keeps the original palette; Hard Mode uses a slightly redder backdrop and more red clouds. These are visual settings and do not affect combat.

The camera's minimum zoom follows the viewport size relative to the map, so an overview remains available without pulling far beyond a small battlefield. Maximum zoom grows from 1.8 on the tutorial map to 3 on the 3000-unit random maps. Wheel, pinch, double tap, intro, camera shortcuts, and the end-of-battle camera use those limits.

## First Strike tutorial

First Strike alone opts into an action-driven tutorial via `tutorial.attackTargetId`. It is an authored 1500 × 1500 static map with one blue capital, one red capital, a weak red outpost directly ahead of the player, and six neutral worlds. The outpost is the first attack target. The red capital is beyond direct attack range from that outpost, so the player must take another world to reach it. A central crossing is the shortest route; western and eastern worlds offer optional expansion. All nine positions, owners, and starting ship counts are identical on each launch. No orbit, central star, or superweapon is present.

Prompts teach selecting blue then attacking red, scrolling down/pinching fingers together to zoom out, and capturing the red capital while protecting the player's own. They also explain that later battles can have several enemy capitals. Tutorial accents use the existing Chapter 1 cyan-blue (`#73dcff`). Click targets have a circle pulsing every 700ms with no arrow. The zoom prompt shows two matching circles at 58% across/down the viewport; they spread apart and snap back side-by-side every 1.6 seconds while also pulsing in scale, brightness, and glow every 700ms. This requested outward visual cue does not change actual pinch controls. Reduced-motion preferences disable the CSS animations. The win lesson highlights the surviving red capital, not ordinary planets.

Selection immediately advances to the attack prompt. After the first fleet launches, the tutorial hides for four active-play seconds before showing the zoom lesson, leaving time to watch the attack. Pausing also pauses this delay; later attacks cannot restart it. A manual zoom completed during the delay is remembered, but the capital explanation still waits until the delay ends. Retry creates a fresh tutorial state and there are no delayed browser timers to leak into the next mission.

The zoom lesson and two-circle cue are touch-only (`hover: none` and `pointer: coarse`). PC players go directly from the post-attack delay to the capital explanation, with a two-step counter instead of three; mouse-wheel zoom still works normally. Detection is based on input capability rather than viewport width, so shrinking a desktop window does not enable the touch lesson.

The simulation runs continuously during every tutorial prompt, including the initial selection and attack instructions: ships move, planets produce units, and AI keeps playing. Only the player's normal Pause control stops gameplay. The camera settles on the player's opening fleet on both desktop and mobile. Selecting/deselecting updates the first prompt; a real launch advances it, and manually zooming out to the map overview advances to the win explanation on touch devices. The intro camera never completes that lesson. Players can skip at any time or dismiss the final explanation with Got it. The tutorial restarts on mission retry/replay and does not change campaign saves. Other missions and Quick Match have no tutorial. The old persistent mission title/objective overlay and pause-menu mission briefing are removed from every level.

## Mission 2: The Breach Line

A 2500 × 2500 static battlefield with one red capital and six Overdrive worlds clustered in a ring near the center. The blue capital begins in the south with 220 ships. Three cheap neutral planets are in its initial attack range: one central supply world and a harbour on each flank.

- Central route: take the supply world, then the southern Overdrive world. A central hub, northern Overdrive world, and gate lead toward the red capital. This is the shortest route to a weapon site and the most direct route to the enemy.
- Western route: the harbour and entry lead into two marked junctions in the central ring. An outer relay, bastion, approach, and red outpost provide another path to the capital with more enemy pressure.
- Eastern route: a matching entry leads into two marked junctions. An outer relay, bastion, approach, and neutral lookout provide another path to the capital.
- All six marked planets sit within 500 units of the map center and produce only Overdrive. One held site generates a charge in 60 seconds, two in 30 seconds, and six in 10 seconds. Losing sites pauses future generation; an already earned charge remains available. Overdrive triples production on one owned planet for 15 seconds.

Winning First Strike starts The Breach Line in the current run. Winning The Breach Line starts The Turning Tide. No tutorial prompts repeat after Mission 1.

## Mission 3: The Turning Tide

A 2600 × 2600 battlefield, with 12 fixed outer worlds and 12 rotating worlds around one white star. Rotation remains clockwise, once every 180 seconds. Both enemy capitals must fall; the blue capital must survive.

- Opening: 260 ships at the fixed southern capital. Two cheap outer harbours and the boarding planet provide three expansion choices before enemy territory.
- Moving route: board the outer orbit, develop the four inner worlds, and use passing planets as staging positions. All 12 orbiting worlds share angular speed; connections to the fixed outer ring open and close. Both rotating rings alternate Omni Strike and Production Overdrive worlds.
- Fixed routes: the west and east flanks provide permanent, more heavily defended alternatives to riding the orbit.
- Pressure: red and green each begin with a capital, a fixed outpost, and an orbiting foothold. The northern neutral divide separates their command worlds, but they can fight each other too.
- Reward: capturing marked rotating worlds unlocks their weapon and generates charges while held. The center is a normal star and cannot be captured.

The full orbit stays clear of fixed planets. Desktop opens on the complete map; `mobileFocus: 'capital'` moves from the overview intro to a readable southern opening on phones. Normal panning and zoom remain available.

## Orbiting system

An optional `orbit` defines the fixed white star centre (`x`, `y`), a clockwise rotation period in simulation seconds (`periodSeconds`), and participating `planetIds`. The Turning Tide rotates 12 of its 24 planets once every 180 seconds. Every member uses the same angular speed, preserving their spacing and mutual attack ranges. With no Dyson sphere configured, its star is decorative and has no effect on gravity, collision, damage, or victory. Orbit regression tests use an independent fixture so tutorial map changes do not change their coverage.

Stationed ships move with their planet; launched ships pursue the moving target in world space. Captures do not stop an orbit. Pausing stops rotation, retry resets positions, and end-of-battle slow motion applies to orbits too. Quick Match still uses the unchanged static random map. Validation checks membership, period, star clearance, and the complete orbit's map-edge clearance. Only one system per map is supported for now; multiple stars are intentionally deferred.
