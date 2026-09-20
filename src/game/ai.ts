import { connectedFriendlyIds } from './logistics';
import { attackMultiplier, defenceMultiplier } from './factions';
import type { Base, Pixel } from './types';

const NEUTRAL = '#6b7280';
const FACTIONS = ['#ef4444', '#22c55e', '#eab308'];
const distance = (a: Base, b: Base) => Math.hypot(a.x - b.x, a.y - b.y);
type Command = { from: string; to: string; count: number };
export type AIPlan = { orders: Command[]; omniTarget?: string };
type FactionState = { lastAttack: number; nextOmni: number; lastRevengeSeen?: string };
type World = {
  bases: Base[]; pixels: Pixel[]; range: number; seconds: number; hard: boolean;
  canOmni: (color: string) => boolean;
  random?: () => number;
  recentOmniCaptureId?: string | null;
  recentOmniCaptureTime?: number;
};

/** The original per-planet, high-commitment AI with narrow capital and waste guards. */
export class TacticalAI {
  private states = new Map<string, FactionState>();

  plan(world: World): Map<string, AIPlan> {
    const plans = new Map<string, AIPlan>();
    const random = world.random ?? Math.random;
    const stationed = new Map<string, number>();
    const incoming = new Map<string, Map<string, number>>();
    for (const ship of world.pixels) {
      if (ship.dead) continue;
      if (ship.state === 'idle') stationed.set(ship.baseId, (stationed.get(ship.baseId) ?? 0) + 1);
      else if (ship.targetBaseId) {
        const fleets = incoming.get(ship.targetBaseId) ?? new Map<string, number>();
        fleets.set(ship.color, (fleets.get(ship.color) ?? 0) + 1);
        incoming.set(ship.targetBaseId, fleets);
      }
    }
    const ships = (base: Base) => stationed.get(base.id) ?? 0;
    const arriving = (base: Base, color: string) => incoming.get(base.id)?.get(color) ?? 0;
    for (const color of FACTIONS) {
      const owned = world.bases.filter(base => base.color === color);
      if (!owned.length) { this.states.delete(color); continue; }
      const state = this.states.get(color) ?? { lastAttack: world.seconds, nextOmni: world.seconds + 8 };
      this.states.set(color, state);
      const plan: AIPlan = { orders: [] };
      plans.set(color, plan);
      const targets = world.bases.filter(base => base.color !== color);
      const capitals = owned.filter(base => base.isCapital);
      const threat = (base: Base) => [...(incoming.get(base.id) ?? [])]
        .reduce((sum, [attacker, count]) => sum + (attacker === color ? 0 : count * attackMultiplier(attacker) / defenceMultiplier(color)), 0);
      const reserve = (base: Base) => base.isCapital ? Math.max(45, Math.ceil(threat(base) + 12 - arriving(base, color))) : 0;
      const available = new Map(owned.map(base => [base.id, Math.max(0, ships(base) - reserve(base))]));
      const order = (from: Base, to: Base, count: number) => {
        const amount = Math.min(Math.floor(count), available.get(from.id) ?? 0);
        if (amount < 1) return;
        plan.orders.push({ from: from.id, to: to.id, count: amount });
        available.set(from.id, available.get(from.id)! - amount);
        const fleets = incoming.get(to.id) ?? new Map<string, number>();
        fleets.set(color, (fleets.get(color) ?? 0) + amount);
        incoming.set(to.id, fleets);
      };

      // A capital under attack draws help before its neighbours make new attacks.
      for (const capital of capitals) {
        let missing = Math.ceil(threat(capital) + 12 - ships(capital) - arriving(capital, color));
        if (threat(capital) <= 0 || missing <= 0) continue;
        for (const donor of owned.filter(base => base.id !== capital.id && distance(base, capital) <= world.range)
          .sort((a, b) => distance(a, capital) - distance(b, capital))) {
          const send = Math.min(missing, Math.max(0, (available.get(donor.id) ?? 0) - 20));
          order(donor, capital, send);
          missing -= send;
          if (missing <= 0) break;
        }
      }

      // Keep the original 70% chance per planet and large, independent launches.
      for (const source of owned) {
        const idle = ships(source);
        if (idle <= (world.hard ? 110 : 120) || random() <= (world.hard ? 0.15 : 0.3)) continue;
        const count = Math.min(Math.floor(idle * 0.9), available.get(source.id) ?? 0);
        if (count <= 0) continue;
        const reachable = targets.filter(target => {
          if (distance(source, target) > world.range) return false;
          const defenders = ships(target) * defenceMultiplier(target.color) / attackMultiplier(color);
          // Some risky attacks are welcome; overwhelming defences only waste a fleet.
          if (defenders > count * 1.5) return false;
          return arriving(target, color) < Math.max(12, defenders + 8);
        });
        if (!reachable.length) continue;
        reachable.sort((a, b) => distance(source, a) + ships(a) * 10 - distance(source, b) - ships(b) * 10);
        const target = reachable[Math.floor(random() * Math.min(3, reachable.length))];
        order(source, target, count);
        state.lastAttack = world.seconds;
      }

      // The old Omni could retaliate immediately. Keep its character, but make
      // retaliation occasional and require a safe capital and enough ships.
      if (world.seconds >= state.nextOmni && world.canOmni(color)) {
        const safe = capitals.every(capital => ships(capital) * 0.7 + arriving(capital, color) >= Math.max(45, threat(capital) + 10));
        const viable = targets.filter(target => owned.some(base => distance(base, target) <= world.range)
          && arriving(target, color) < 12
          && owned.reduce((sum, base) => sum + Math.floor(ships(base) * 0.3), 0)
            >= ships(target) * defenceMultiplier(target.color) / attackMultiplier(color) + 10);
        const revenge = viable.find(target => target.id === world.recentOmniCaptureId);
        const revengeKey = revenge ? `${revenge.id}:${world.recentOmniCaptureTime ?? 0}` : undefined;
        let chosen: Base | undefined;
        if (safe && revenge && state.lastRevengeSeen !== revengeKey) {
          state.lastRevengeSeen = revengeKey;
          if (random() < 0.4) chosen = revenge;
        }
        const expansion = viable.filter(target => target.id !== world.recentOmniCaptureId);
        if (!chosen && safe && expansion.length && random() < 0.15) {
          const enemyCapitals = targets.filter(target => target.isCapital);
          chosen = [...expansion].sort((a, b) => {
            const priority = (target: Base) => enemyCapitals.length
              ? Math.min(...enemyCapitals.map(capital => distance(target, capital))) : ships(target);
            return priority(a) - priority(b);
          })[0];
        }
        if (chosen) {
          // Warp consumes 30% of every idle fleet. Combining the earlier normal
          // orders would silently strip the capital reserve in the same tick.
          plan.orders = [];
          plan.omniTarget = chosen.id;
          state.nextOmni = world.seconds + 15;
          state.lastAttack = world.seconds;
        }
      }

      // A quiet faction can still gather stranded ships, but gathering never
      // slows the regular per-planet attack decisions above.
      if (world.seconds - state.lastAttack < 30) continue;
      const frontier = owned.filter(base => targets.some(target => distance(base, target) <= world.range));
      const stage = frontier.sort((a, b) => (available.get(b.id) ?? 0) - (available.get(a.id) ?? 0))[0];
      if (!stage) continue;
      const connected = connectedFriendlyIds(owned, stage.id, world.range);
      const eligible = owned.filter(base => base.id !== stage.id && connected.has(base.id) && distance(base, stage) > world.range
        && (available.get(base.id) ?? 0) >= 30).sort((a, b) => distance(a, stage) - distance(b, stage));
      if (eligible.length) {
        const target = targets.filter(base => distance(base, stage) <= world.range)
          .sort((a, b) => ships(a) - ships(b))[0];
        if (target) {
          for (const donor of eligible) {
            if (arriving(stage, color) >= 120) break;
            order(donor, stage, Math.min(120 - arriving(stage, color), Math.floor((available.get(donor.id) ?? 0) * 0.75)));
          }
        }
      }
    }
    return plans;
  }
}
