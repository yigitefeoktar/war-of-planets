# Campaign maps

Map data and chapter ordering live in `src/game/campaign.ts`. `createMatch` loads an authored map or uses the existing random generator when no map is supplied. The gameplay engine remains shared.

Each map defines a stable ID, title, briefing, world size, attack range, objective, and planets. Planet coordinates are world units; ships are non-negative integers. Supported owners are the four existing faction colors and neutral gray. Planets can optionally list the superweapons they produce while owned. The current objective is enemy-capital elimination; the player's capital must survive. Validation rejects duplicate IDs, invalid dimensions or owners, invalid weapon lists, missing capitals, and unreachable planets.

To add a level, create another `MapDefinition` and place it at the intended position in the chapter's `maps` array. Do not rename released map IDs. Winning records the ID and automatically starts the next array entry after six seconds; the victory button can start it immediately. If no next map is released, the player can replay or return to the menu. Chapter 2 remains unavailable until its first map is added.

The versioned browser save stores completed map IDs; its legacy selected-mode field is ignored when loading, so every page opening selects Chapter 1. Players can still choose another mode for the current session. Start Chapter 1 always begins with First Strike's tutorial, regardless of previous wins, then victories advance through The Breach Line (Level 2), The Turning Tide (Level 3), The Pincer (Level 4), and The Battle for Helios (Level 5). Retrying a defeat stays on the current level. Starting another run from the menu or refreshing returns to the tutorial, without deleting completed-level records. Existing completion IDs remain valid when a new map is inserted. Invalid saves reset safely; unavailable browser storage shows a warning.

Five text-only Chapter 1 Test options in the mode picker start directly at Levels 1–5, regardless of saved wins. The Level 3 option retains the previous testing route. Victories advance through the remaining Chapter 1 maps in order, using the same maps and rules as the normal campaign; Level 5 ends the run. Test wins do not change saved campaign completion. Selecting normal Chapter 1 still starts at the tutorial.

Checks: `npm run lint`, `npx tsx --test src/game/*.test.ts`, `npm run build`.

## Friendly logistics network

The 600-world-unit range remains a strict source-to-target limit for attacks against enemy and neutral planets. Friendly transfers use the same radius only to determine network connectivity: if two owned planets are joined by any chain of friendly links where every link is 600 units or shorter, ships may fly directly between them regardless of their direct distance. Disconnected friendly planets cannot transfer to each other.

Connectivity is recalculated when the order is issued, using current ownership and live positions. Capturing a bridge can join or split networks, and moving planets can create temporary connections. Once launched, a transfer continues to its destination even if the connection later breaks. Mouse and touch orders share the same rule. Selection and range visuals remain the existing game visuals; this feature adds no network lines or destination rings. Hostile AI logic, Omni-Strike range, and ordinary attack range are unchanged.

Current content: Chapter 1 / First Strike (9 fixed planets), The Breach Line (23 fixed planets and seven Overdrive sites), The Turning Tide (24 planets, one orbiting system and a decorative star), The Pincer (49 fixed planets, a Repulse Shield hub, and six isolated outer branches), and The Battle for Helios (108 planets across five normal stars with 60 orbiting worlds and 48 fixed connecting worlds). Blue and red appear throughout the chapter, green appears in Level 3, and yellow appears in Level 4. Chapter 2 is not released yet.

## Galaxy and camera

Authored maps choose a `galaxyTheme`: First Strike has one faint blue cloud, The Breach Line uses muted violet and rose, The Turning Tide uses teal and violet, The Pincer uses indigo and warm amber, and The Battle for Helios adds a deeper red and amber palette around the central star. Cloud and star counts grow with battlefield area. Quick Match keeps the original palette; Hard Mode uses a slightly redder backdrop and more red clouds. These are visual settings and do not affect combat.

The camera's minimum zoom follows the viewport size relative to the map, so an overview remains available without pulling far beyond a small battlefield. Maximum zoom grows from 1.8 on the tutorial map to 3 on the 3000-unit random maps. Wheel, pinch, double tap, intro, camera shortcuts, and the end-of-battle camera use those limits.

## First Strike tutorial

First Strike alone opts into an action-driven tutorial via `tutorial.attackTargetId`. It is an authored 1500 × 1500 static map with three blue worlds, four red worlds, and two neutral worlds. Red controls most of the far side, but its outpost directly ahead of the player's capital has only 10 ships and remains the first attack target. The red capital is beyond direct attack range from that outpost, so the player must take another world to reach it. The red central crossing has 14 ships and is the shortest route toward the 70-ship red capital; blue western and eastern harbours offer optional expansion. All nine positions, owners, and starting ship counts are identical on each launch. No orbit, central star, or superweapon is present.

Prompts teach selecting blue then attacking red, scrolling down/pinching fingers together to zoom out, and capturing the red capital while protecting the player's own. They also explain that later battles can have several enemy capitals. Tutorial accents use the existing Chapter 1 cyan-blue (`#73dcff`). Click targets have a circle pulsing every 700ms with no arrow. The zoom prompt shows two matching circles at 58% across/down the viewport; they spread apart and snap back side-by-side every 1.6 seconds while also pulsing in scale, brightness, and glow every 700ms. This requested outward visual cue does not change actual pinch controls. Reduced-motion preferences disable the CSS animations. The win lesson highlights the surviving red capital, not ordinary planets.

Selection immediately advances to the attack prompt. After the first fleet launches, the tutorial hides for four active-play seconds before showing the zoom lesson, leaving time to watch the attack. Pausing also pauses this delay; later attacks cannot restart it. A manual zoom completed during the delay is remembered, but the capital explanation still waits until the delay ends. Retry creates a fresh tutorial state and there are no delayed browser timers to leak into the next mission.

The zoom lesson and two-circle cue are touch-only (`hover: none` and `pointer: coarse`). PC players go directly from the post-attack delay to the capital explanation, with a two-step counter instead of three; mouse-wheel zoom still works normally. Detection is based on input capability rather than viewport width, so shrinking a desktop window does not enable the touch lesson.

The simulation runs continuously during every tutorial prompt, including the initial selection and attack instructions: ships move, planets produce units, and AI keeps playing. Only the player's normal Pause control stops gameplay. The camera settles on the player's opening fleet on both desktop and mobile. Selecting/deselecting updates the first prompt; a real launch advances it, and manually zooming out to the map overview advances to the win explanation on touch devices. The intro camera never completes that lesson. Players can skip at any time or dismiss the final explanation with Got it. The tutorial restarts on mission retry/replay and does not change campaign saves. Other missions and Quick Match have no tutorial. The old persistent mission title/objective overlay and pause-menu mission briefing are removed from every level.

## Mission 2: The Breach Line

A 2500 × 2500 static battlefield rotated into a west-to-east confrontation. Blue starts with only its capital and 220 ships. Red starts with four eastern worlds: its 125-ship capital, the 48-ship gate, and the upper and lower 35-ship outposts. The other 18 planets are neutral, including all seven central Overdrive worlds. Planet positions, starting ship counts, and attack range are unchanged.

- Central route: capture the cheap neutral supply world to reach the western Overdrive site. The exact center planet is also a marked Overdrive world. Another marked site and a red gate lead toward the eastern capital.
- Upper route: neutral harbour, entry, and relay worlds lead into the central ring or through the neutral bastion and approach toward the red outpost.
- Lower route: a matching neutral flank leads into the ring or toward the red lookout.
- All seven marked planets sit within 500 units of the map center and produce only Overdrive. Neither faction starts with a weapon source. One captured site generates a charge in 60 seconds, two take 30 seconds, and seven take about 9 seconds. Losing all sites pauses future generation; an already earned charge remains available. Overdrive triples production on one owned planet for 15 seconds.

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

A 5200 × 5200 static battlefield with 49 planets: a seven-world central hub and six separate seven-world outer groups. Three enemy branches alternate with three weapon branches around the center. Blue starts with only its 360-ship capital; red, green, and yellow each start with only one 220-ship capital. All 45 other worlds are neutral. The released map ID, campaign ordering, and Level 4 test option are preserved.

- Center: the blue capital and six neutral hub planets all produce Repulse Shields. Each neutral hub has 12 defenders, offering cheap opening choices. Blue initially has one shield source; taking all six neutral hubs raises that to seven sources and a charge approximately every nine seconds. Enemies start without weapon sources. Repulse Shield protects an owned world from incoming fleets for six seconds.
- Three fronts: red approaches from the north, green from the southeast, and yellow from the southwest. Each enemy capital has three affordable neutral neighbors in its own group: an inward gate and two rear wings. Enemies must expand through their branch before contesting the central shields. Capturing all three rival capitals while preserving blue wins the mission.
- Weapon objectives: the northeast group contains seven Production Overdrive sites, the southern group seven Omni Strike sites, and the northwest group seven Repulse Shield sites. All begin neutral, with 18–32 defenders. Each group has an entrance, a gate, a rear vault, and two pairs of flank worlds. Taking a whole group supplies seven sources for its weapon, encouraging investment and later contests over those branches.
- Frontlines: every branch joins exactly one hub shield through its entrance, then passes through a gate before reaching the wider outer territory. The outer rows have two flank routes, but neither route bypasses the entrance or gate. Removing the central hub leaves exactly six disconnected seven-world groups. There are no direct range links between outer groups.
- Spacing: attack range remains 600. Intended links are 520–560 world units long, while every unintended planet pair is at least 700 units apart. This prevents attacks across branches, past a gate, or diagonally behind a frontline. Normal attacks and Omni Strike obey the same geometry; friendly transfers continue to use the existing connected ownership network. Automated tests check every pair against the complete intended connection graph, test entrance/gate cuts, and exercise actual fleet and weapon range checks.

Desktop opens with the full map visible; its authored `overviewScale: 0.68` leaves room for the top status panel and bottom commands. Phones focus on the blue capital after the overview intro; `capitalFocusY: 0.5` centers the hub vertically so all six opening shield worlds stay visible above the command bar. The existing map-scaled zoom limits support both views. The indigo and amber background retains the Pincer palette, with more clouds and stars for its larger area. Winning The Turning Tide starts The Pincer, and winning The Pincer starts The Battle for Helios.

## Mission 5: The Battle for Helios

A 5600 × 5600 finale with 108 planets, five normal white stars, and no Dyson spheres. Four corner systems and the central Helios system each have eight outer worlds at radius 620 and four inner worlds at radius 300, matching Level 3's orbiting planet count. The released map ID remains unchanged so saves, chapter progression, and the Level 5 test option still work.

- Opening: blue, red, green, and yellow each own only one capital, orbiting their own corner star. Blue starts with 300 ships; each rival starts with 240. All 104 other worlds start neutral. Each capital faces inward, with two neighboring 12-ship weapon sites and affordable inner/outer expansion choices. No faction starts with weapon production; capturing nearby sites opens those tools.
- Connectivity: 48 fixed planets connect the systems. Four perimeter lanes permit attacks between neighboring factions without capturing Helios. Diagonal approaches branch into those lanes and the central routes. Four crossings join the outer lanes to a continuous 16-world necklace around the center. The fixed network stays connected if any single fixed world is removed. Each system has several entrances that stay within attack range of some outer-ring planet at every rotation phase.
- Central objective: all 12 central orbiting worlds produce weapons, alternating Omni Strike, Production Overdrive, and Repulse Shield. Eight nearby fixed necklace worlds also produce those weapons. These 20 weapon sites are neutral at the start, with 28–44 defenders; the remaining necklace links have 22. Owning multiple sites speeds up weapon charging under the existing weapon rules. The normal center star cannot be captured and grants no universal charge.
- Movement: corner systems rotate clockwise every 240 seconds; Helios rotates every 180. Swept orbits remain clear of stars, fixed planets, other systems, and the map edges. The battlefield stays connected across their full combined 720-second cycle. Orbiting capitals and stationed fleets move with their star system; launched fleets pursue targets in world space.
- Ending: capture all three rival capitals while keeping blue's capital alive. Victory shows “Chapter 1 complete” and “Helios secured,” followed by the frontier hint. Replay and the main menu remain available; Chapter 2 is unavailable. Test wins leave saved campaign completion unchanged.

Desktop opens on a complete overview; phones settle on the blue capital after the overview intro. The minimum zoom scales to the full 5600-unit map, including narrow phone viewports. Existing pan, zoom, and capital camera shortcuts remain available.

## Orbiting systems

An optional `orbit` defines a single fixed star center (`x`, `y`), clockwise period in simulation seconds (`periodSeconds`), and participating `planetIds`. Maps with several stars use `orbits` instead. The Turning Tide retains its single 180-second system; The Battle for Helios uses five independent systems. Members of each system share angular speed, preserving spacing and mutual attack ranges. Decorative stars have no effect on gravity, collision, damage, or victory. An optional `dysonSphere` still supports one legacy capturable sphere per map, though no current Chapter 1 map uses it.

Stationed ships and their local movement targets rotate with their own system. Launched ships pursue moving targets in world space; captures do not stop rotation. Pausing stops rotation, retry resets positions, and end-of-battle slow motion applies to all systems. Quick Match keeps its static random map. Validation rejects mixed single/multiple definitions, empty systems, duplicate or shared membership, invalid periods, star intersections, and swept map-edge intersections. Regression tests cover independent rotation rates, fleets, central weapon charges, opening captures, clearance, connectivity, and all three rival capitals.
