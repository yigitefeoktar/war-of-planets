# Faction AI

The enemy AI follows the original fast, per-planet attack rhythm. Every two seconds,
each enemy planet with more than 120 idle ships independently has a 70% chance to
send 90% of them toward one of its three nearest/weakest hostile or neutral worlds
within attack range. It favours short routes and small garrisons, but the choice
among the top three remains random. Different planets can attack in the same tick.
On hard mode the threshold is 110 ships and the chance is 85%. This deliberately
creates bold commitments and exposed worlds for counterattacks.

Capital worlds retain at least 45 ships and ask nearby friendly worlds for help
when a hostile fleet is incoming. The AI excludes friendly attack targets,
avoids a target already covered by an incoming fleet, and declines a fortress
whose defending force exceeds its proposed attack by more than 50%. That last
rule permits risky, losing attacks without repeatedly wasting a fleet against
an overwhelming garrison. These are narrow safeguards, not a guaranteed-win
planner. They do not delay the next ordinary attack.

If no attack launches for 30 seconds, connected rear worlds can move surplus
ships toward a front planet, including through a winding friendly route.
Regular attack decisions continue while this happens. An isolated faction may
still be unable to advance.

Omni-Strike requires unlock and energy, a viable target and a safe capital.
It is considered after an eight-second opening delay. A recent Omni capture can
inspire a 40% retaliation attempt per decision, once per capture, with a 15-second cooldown after
use. Otherwise the standard expansion attempt has a 15% chance. A warp
replaces ordinary orders in that decision so the capital reserve survives. The AI does not
use Overdrive or Repulse. There are no hidden resources or adjustments based on
the player's win/loss history.

# Colour specialties

Blue Guardians (the player) prevent one defending loss every tenth clash.
Red Raiders kill one extra defender, if available, every tenth attacking clash.
These bonuses roughly cancel in red-versus-blue combat. Green Industrialists
produce eleven ships per ten normal production cycles. Yellow Engineers earn 10%
more energy, including Dyson income, when energy is enabled. Bonuses follow the
current owner. Faction specialties are gameplay rules; no menu legend is shown.

This version restores movement and opportunities for counterattacks. Match
playtesting is still needed to determine whether it is more fun than either
previous AI and whether attack frequency or capital reserves need tuning.
