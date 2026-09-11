# Tactical AI

The intended feeling is recurring territorial friction: a rival takes a useful world,
the player responds, and the rival's fleet commitment offers a counterattack.
Fun and replay value still need human playtesting; longer sessions are not proof of fun.

- Red attacks every 10 seconds when a worthwhile capture is possible; green every
  13 and yellow every 16. Initial decisions are staggered by faction.
- One offensive target per window, up to two contributing planets. Fleet sizes
  budget defenders and approximate production during travel, rather than sending 90%.
- Capitals retain at least 45 ships; exposed worlds 24; rear worlds 10.
  Incoming enemy fleets raise reserves and trigger nearby reinforcements.
- Incoming friendly ships count toward a capture or defence to reduce overcommitment.
- Rear worlds move surplus toward nearby frontier worlds. Actual positions are
  reevaluated every decision, so rotating worlds create changing opportunities.
- Green prefers neutral expansion; yellow puts more value on rival territory;
  red attacks more frequently. Capitals, unlock worlds and Dyson spheres have
  explicit strategic value. All rival colours use the same scoring rules.
- Omni needs sufficient energy, a viable target, safe remaining garrisons, and a
  30-second recovery. It is not triggered by the player's recent success.
- Hard mode uses three contributing planets, shorter recovery and a smaller
  combat safety margin. Production is identical to normal mode.

No hidden player-performance adjustment or resource gifts. No guaranteed wins,
scripted near-misses, or automatic punishment for using an ability.

Playtest for whether players can identify enemy commitments, successfully
counterattack, and contest objectives without excessive planet ping-pong.
Fleet arrival estimates are intentionally approximate; this is not perfect foresight.

## Colour specialties

Blue Guardians (the player) prevent one defending loss every tenth clash.
Red Raiders kill one extra defender, if available, every tenth attacking clash.
These deterministic bonuses roughly cancel in red-versus-blue combat. They apply
only to ship clashes at planets, not instant superweapon effects. Counters belong
to the target world and reset on capture.
Green Industrialists produce eleven ships per ten normal production cycles;
neutral worlds and Dyson spheres still produce none. Yellow Engineers earn 10%
more energy, including Dyson income, only in modes with energy enabled.

Bonuses follow current faction ownership rather than a planet's original colour.
AI force estimates include combat and production advantages. Green prioritises
expansion; red maintains its frequent offensives; yellow places extra value on
Dyson spheres and weapon unlock sites. The menu lists all four specialties.
These are initial balance values, not evidence that the factions are equally strong.
