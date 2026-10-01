# Campaign maps

Map data and chapter ordering live in `src/game/campaign.ts`. `createMatch` loads an authored map or uses the existing random generator when no map is supplied. The gameplay engine remains shared.

Each map defines a stable ID, title, briefing, world size, attack range, objective, and planets. Planet coordinates are world units; ships are non-negative integers. Supported owners are the four existing faction colors and neutral gray. Planets can optionally list the superweapons they produce while owned. The current objective is enemy-capital elimination; the player's capital must survive. Validation rejects duplicate IDs, invalid dimensions or owners, invalid weapon lists, missing capitals, and unreachable planets.

To add a level, create another `MapDefinition` and place it at the intended position in the chapter's `maps` array. Do not rename released map IDs. Winning records the ID and automatically starts the next array entry after six seconds; the victory button can start it immediately. If no next map is released, the player can replay or return to the menu. Chapter 2 remains unavailable until its first map is added.

The versioned browser save stores completed map IDs; its legacy selected-mode field is ignored when loading, so every page opening selects Chapter 1. Players can still choose another mode for the current session. Start Chapter 1 always begins with First Strike's tutorial, regardless of previous wins, then victories advance through The Breach Line (Level 2), The Turning Tide (Level 3), The Pincer (Level 4), and Helios Counteroffensive (Level 5). Retrying a defeat stays on the current level. Starting another run from the menu or refreshing returns to the tutorial, without deleting completed-level records. Existing completion IDs remain valid when a new map is inserted. Invalid saves reset safely; unavailable browser storage shows a warning.

Five text-only Chapter 1 Test options in the mode picker start directly at Levels 1–5, regardless of saved wins. The Level 3 option retains the previous testing route. Victories advance through the remaining Chapter 1 maps in order, using the same maps and rules as the normal campaign; Level 5 ends the run. Test wins do not change saved campaign completion. Selecting normal Chapter 1 still starts at the tutorial.

Checks: `npm run lint`, `npx tsx --test src/game/*.test.ts`, `npm run build`.

## Friendly logistics network

The 600-world-unit range remains a strict source-to-target limit for attacks against enemy and neutral planets. Friendly transfers use the same radius only to determine network connectivity: if two owned planets are joined by any chain of friendly links where every link is 600 units or shorter, ships may fly directly between them regardless of their direct distance. Disconnected friendly planets cannot transfer to each other.

Connectivity is recalculated when the order is issued, using current ownership and live positions. Capturing a bridge can join or split networks, and moving planets can create temporary connections. Once launched, a transfer continues to its destination even if the connection later breaks. Mouse and touch orders share the same rule. Selection and range visuals remain the existing game visuals; this feature adds no network lines or destination rings. Hostile AI logic, Omni-Strike range, and ordinary attack range are unchanged.

Current content: Chapter 1 / First Strike (9 fixed planets), The Breach Line (23 fixed planets and seven Overdrive sites), The Turning Tide (24 planets, one orbiting system and a decorative star), The Pincer (27 fixed planets and Repulse Shield fronts), and Helios Counteroffensive (38 planets, a four-world orbit, and a capturable Dyson Sphere). Blue and red appear throughout the chapter, green appears in Level 3, and yellow appears in Level 4. Chapter 2 is not released yet.

## Galaxy and camera

Authored maps choose a `galaxyTheme`: First Strike has one faint blue cloud, The Breach Line uses muted violet and rose, The Turning Tide uses teal and violet, The Pincer uses indigo and warm amber, and Helios Counteroffensive adds a deeper red and amber palette around the central star. Cloud and star counts grow with battlefield area. Quick Match keeps the original palette; Hard Mode uses a slightly redder backdrop and more red clouds. These are visual settings and do not affect combat.

The camera's minimum zoom follows the viewport size relative to the map, so an overview remains available without pulling far beyond a small battlefield. Maximum zoom grows from 1.8 on the tutorial map to 3 on the 3000-unit random maps. Wheel, pinch, double tap, intro, camera shortcuts, and the end-of-battle camera use those limits.

## First Strike tutorial

First Strike alone opts into an action-driven tutorial via `tutorial.attackTargetId`. It is an authored 1500 × 1500 static map with three blue worlds, four red worlds, and two neutral worlds. Red controls most of the far side, but its outpost directly ahead of the player's capital has only 10 ships and remains the first attack target. The red capital is beyond direct attack range from that outpost, so the player must take another world to reach it. The red central crossing has 14 ships and is the shortest route toward the 70-ship red capital; blue western and eastern harbours offer optional expansion. All nine positions, owners, and starting ship counts are identical on each launch. No orbit, central star, or superweapon is present.

Prompts teach selecting blue then attacking red, scrolling down/pinching fingers together to zoom out, and capturing the red capital while protecting the player's own. They also explain that later battles can have several enemy capitals. Tutorial accents use the existing Chapter 1 cyan-blue (`#73dcff`). Click targets have a circle pulsing every 700ms with no arrow. The zoom prompt shows two matching circles at 58% across/down the viewport; they spread apart and snap back side-by-side every 1.6 seconds while also pulsing in scale, brightness, and glow every 700ms. This requested outward visual cue does not change actual pinch controls. Reduced-motion preferences disable the CSS animations. The win lesson highlights the surviving red capital, not ordinary planets.

Selection immediately advances to the attack prompt. After the first fleet launches, the tutorial hides for four active-play seconds before showing the zoom lesson, leaving time to watch the attack. Pausing also pauses this delay; later attacks cannot restart it. A manual zoom completed during the delay is remembered, but the capital explanation still waits until the delay ends. Retry creates a fresh tutorial state and there are no delayed browser timers to leak into the next mission.

The zoom lesson and two-circle cue are touch-only (`hover: none` and `pointer: coarse`). PC players go directly from the post-attack delay to the capital explanation, with a two-step counter instead of three; mouse-wheel zoom still works normally. Detection is based on input capability rather than viewport width, so shrinking a desktop window does not enable the touch lesson.

The simulation runs continuously during every tutorial prompt, including the initial selection and attack instructions: ships move, planets produce units, and AI keeps playing. Only the player's normal Pause control stops gameplay. The camera settles on the player's opening fleet on both desktop and mobile. Selecting/deselecting updates the first prompt; a real launch advances it, and manually zooming out to the map overview advances to the win explanation on touch devices. The intro camera never completes that lesson. Players can skip at any time or dismiss the final explanation with Got it. The tutorial restarts on mission retry/replay and does not change campaign saves. Other missions and Quick Match have no tutorial. The old persistent mission title/objective overlay and pause-menu mission briefing are removed from every level.

## Mission 2: The Breach Line

A 2500 × 2500 static battlefield rotated into a west-to-east confrontation. Blue starts with ten connected worlds on the left, including its capital with 220 ships. Red controls ten of the 23 planets on the right, just under half the map. Seven Overdrive worlds cluster near the center; blue starts with the two western junction sites, three start neutral, and red holds the two eastern ring sites.

- Central route: move ships through the blue supply world into the western Overdrive site. The exact center planet is also a marked Overdrive world. Another marked site and a red gate lead toward the eastern capital.
- Upper route: the blue harbour, entry, and relay lead into the central ring or into a red bastion, approach, and outpost.
- Lower route: a matching blue flank leads into the ring or through a red bastion, approach, and lookout.
- All seven marked planets sit within 500 units of the map center and produce only Overdrive. Blue's two starting sites generate a charge in 30 seconds; one held site takes 60 seconds, and seven take about 9 seconds. Losing sites pauses future generation; an already earned charge remains available. Overdrive triples production on one owned planet for 15 seconds.

Winning First Strike starts The Breach Line in the current run. Winning The Breach Line starts The Turning Tide. No tutorial prompts repeat after Mission 1.

## Mission 3: The Turning Tide

A 2600 × 2600 battlefield, with 12 fixed outer worlds and 12 rotating worlds around one white star. Rotation remains clockwise, once every 180 seconds. Both enemy capitals must fall; the blue capital must survive.

- Opening: blue, red, and green each hold only their capital. Blue has 260 ships and three cheap nearby choices: two outer harbours and the boarding planet. Red and green each have 200 ships and can take a cheap outpost, an orbiting Overdrive world, or the contested northern divide.
- Moving route: board the outer orbit, develop the four inner worlds, and use passing planets as staging positions. All 12 orbiting worlds share angular speed; connections to the fixed outer ring open and close. Both rotating rings alternate Omni Strike and Production Overdrive worlds.
- Fixed routes: the west and east flanks provide permanent, more heavily defended alternatives to riding the orbit.
- Pressure: red and green expand from their single northern capitals into neutral territory. Their orbiting footholds now start neutral, so control of the ring develops during the battle. The northern divide is affordable and reachable from both enemy capitals, inviting an early contest between them.
- Reward: capturing marked rotating worlds unlocks their weapon and generates charges while held. The center is a normal star and cannot be captured.

The full orbit stays clear of fixed planets. Desktop opens on the complete map; `mobileFocus: 'capital'` moves from the overview intro to a readable southern opening on phones. Normal panning and zoom remain available.

## Mission 4: The Pincer

A 2800 × 2600 static battlefield with 27 planets. Blue holds a compact five-world center with a 300-ship capital and 440 ships total. Red controls four western worlds and yellow controls four eastern worlds, including a capital each and 300 ships per faction. Fourteen neutral worlds separate the fronts. Both enemy capitals must fall while the blue capital survives.

- Defense: all five blue starting worlds generate Repulse Shield charges, giving the player a charge after 12 seconds while all five remain held. Two 12-ship neutral Repulse worlds sit just beyond the blue side relays, close enough for an early capture; holding both brings the charge time to about nine seconds. Red and yellow each start with one Repulse fortress, so each has far fewer sources than blue. The shield destroys incoming fleets for six seconds when activated on an owned planet.
- Pressure: enemy fronts can attack blue relays and contest the shield sites, but neither can attack the blue capital directly at the start. Capturing a shield site alone still does not put the capital in attack range.
- Counterattack: the direct west and east routes lead to the red and yellow capitals. Northern bypasses offer two Production Overdrive worlds; southern bypasses offer two Omni Strike worlds. These optional routes reuse earlier weapons without obscuring the new defensive choice.

Winning The Turning Tide starts The Pincer in the current run. Winning The Pincer starts Helios Counteroffensive.

## Mission 5: Helios Counteroffensive

A 3800 × 3400 finale with 38 authored planets and a neutral Dyson Sphere at the center. Blue starts on five connected southern worlds with 580 ships: its capital and two relays produce Repulse charges, while its two harbors produce Overdrive charges. Red starts on seven worlds with 630 ships, including two northern capitals. Red spearheads can attack the blue outer harbors but cannot reach the blue capital at the start. The released map ID remains unchanged so existing completion records still work.

- Opening: three cheap neutral choices lie in front of the blue relays, including a 16-ship Omni site on the central route. Two more 12-ship Overdrive sites sit beyond the blue harbors. Blue begins with three Repulse sources and two Overdrive sources, giving it tools to withstand red's initial pressure and choose a counterattack.
- Western route: a nearby shield site and a later Omni site support an attack toward the western capital. The western crosslink leads back toward the core, so taking this flank does not lock the player into it.
- Eastern route: production sites support a longer build-up toward the eastern capital. An eastern junction reconnects this path to the core and the northern crossings.
- Central route: a four-world clockwise ring surrounds Helios. Taking the cheap Omni entry world opens access to the ring and Dyson Sphere. Holding the sphere produces a universal charge every 30 seconds for any of the three weapons. Northern crossings connect the core to both red capitals, while either outer route can reach its capital without the sphere.
- Ending: defeating both capitals shows “Chapter 1 complete” and “Helios secured,” followed by a short hint about signals beyond the frontier. The result screen offers replay or the main menu; Chapter 2 remains unavailable. Any Chapter 1 test run that reaches this finale leaves saved campaign completion unchanged.

## Orbiting system

An optional `orbit` defines the fixed white star centre (`x`, `y`), a clockwise rotation period in simulation seconds (`periodSeconds`), and participating `planetIds`. The Turning Tide rotates 12 of its 24 planets once every 180 seconds; Helios Counteroffensive rotates four worlds around a capturable Dyson Sphere once every 300 seconds. Every member uses the same angular speed, preserving their spacing and mutual attack ranges. With no Dyson sphere configured, the star is decorative and has no effect on gravity, collision, damage, or victory. Orbit regression tests use an independent fixture so tutorial map changes do not change their coverage.

Stationed ships move with their planet; launched ships pursue the moving target in world space. Captures do not stop an orbit. Pausing stops rotation, retry resets positions, and end-of-battle slow motion applies to orbits too. Quick Match still uses the unchanged static random map. Validation checks membership, period, star clearance, and the complete orbit's map-edge clearance. Only one system per map is supported for now; multiple stars are intentionally deferred.
