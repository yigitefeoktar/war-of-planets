import type { Base, Pixel } from './types';

const NEUTRAL = '#6b7280';
const FACTIONS = ['#ef4444', '#22c55e', '#eab308'];
const distance = (a: Base, b: Base) => Math.hypot(a.x - b.x, a.y - b.y);
type Command = { from: string; to: string; count: number };
export type AIPlan = { orders: Command[]; omniTarget?: string };
type FactionState = { nextAttack: number; nextOmni: number };
type World = {
  bases: Base[]; pixels: Pixel[]; range: number; seconds: number; hard: boolean;
  canOmni: (color: string) => boolean;
};

/** Visible fleet commitments create pressure; fixed recovery windows create counterplay.
 * No player win/loss tracking, hidden resource gifts, or player-specific targeting.
 */
export class TacticalAI {
  private states = new Map<string, FactionState>();

  plan(world: World): Map<string, AIPlan> {
    const plans = new Map<string, AIPlan>();
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
    const ships = (b: Base) => stationed.get(b.id) ?? 0;
    const arriving = (b: Base, color: string) => incoming.get(b.id)?.get(color) ?? 0;
    for (const [index, color] of FACTIONS.entries()) {
      const owned = world.bases.filter(b => b.color === color);
      if (!owned.length) { this.states.delete(color); continue; }
      const state = this.states.get(color) ?? { nextAttack: world.seconds + index * 2, nextOmni: world.seconds + 18 };
      this.states.set(color, state);
      const plan: AIPlan = { orders: [] };
      plans.set(color, plan);
      const enemies = world.bases.filter(b => b.color !== color && b.color !== NEUTRAL);
      const targets = world.bases.filter(b => b.color !== color);
      const threat = (b: Base) => [...(incoming.get(b.id) ?? [])].reduce((n, [c, count]) => n + (c !== color ? count : 0), 0);
      const frontierDistance = (b: Base) => Math.min(...targets.map(t => distance(b, t)));
      const available = new Map<string, number>();
      for (const b of owned) {
        const exposed = enemies.some(e => distance(b, e) <= world.range);
        const reserve = Math.max(b.isCapital ? 45 : exposed ? 24 : 10, threat(b) > 0 ? threat(b) + 12 - arriving(b, color) : 0);
        available.set(b.id, Math.max(0, ships(b) - reserve));
      }
      const order = (from: Base, to: Base, count: number) => {
        count = Math.min(Math.floor(count), available.get(from.id) ?? 0);
        if (count < 1) return;
        plan.orders.push({ from: from.id, to: to.id, count });
        available.set(from.id, available.get(from.id)! - count);
        const fleets = incoming.get(to.id) ?? new Map<string, number>();
        fleets.set(color, (fleets.get(color) ?? 0) + count);
        incoming.set(to.id, fleets);
      };

      // Defence always runs, including while an offensive is recovering.
      for (const target of [...owned].sort((a, b) => Number(Boolean(b.isCapital)) - Number(Boolean(a.isCapital)))) {
        let deficit = threat(target) + 12 - ships(target) - arriving(target, color);
        if (threat(target) === 0 || deficit <= 0) continue;
        for (const donor of owned.filter(b => b.id !== target.id && distance(b, target) <= world.range).sort((a, b) => distance(a, target) - distance(b, target))) {
          const count = Math.min(deficit, available.get(donor.id)!);
          order(donor, target, count);
          deficit -= count;
          if (deficit <= 0) break;
        }
      }

      if (world.seconds >= state.nextAttack) {
        // Red raids often, green values expansion, yellow favours weakened rivals.
        const candidates = targets.map(target => {
          const donors = owned.filter(b => distance(b, target) <= world.range && available.get(b.id)! > 0)
            .sort((a, b) => distance(a, target) - distance(b, target)).slice(0, world.hard ? 3 : 2);
          const nearest = donors.length ? distance(donors[0], target) : Infinity;
          // Ships travel at mixed speeds. Budget production during the approach.
          const growth = target.color === NEUTRAL || target.isDysonSphere ? 0 : nearest / 24;
          const need = Math.ceil((ships(target) + growth) * (world.hard ? 1.15 : 1.3) + 8 - arriving(target, color));
          const total = donors.reduce((sum, b) => sum + available.get(b.id)!, 0);
          const value = (target.isCapital ? 95 : 0) + (target.isDysonSphere ? 70 : 0)
            + (target.superweaponUnlocks?.length ? 35 : 0)
            + (target.color === NEUTRAL ? (index === 1 ? 45 : 20) : index === 2 ? 30 : 15);
          return { target, donors, need, total, score: value - need * 0.6 - nearest * 0.04 };
        }).filter(c => c.need > 0 && c.total >= c.need);
        candidates.sort((a, b) => b.score - a.score);
        const chosen = candidates[0];
        if (chosen) {
          let remaining = chosen.need;
          for (const donor of chosen.donors) {
            const count = Math.min(remaining, available.get(donor.id)!);
            order(donor, chosen.target, count);
            remaining -= count;
            if (remaining <= 0) break;
          }
          state.nextAttack = world.seconds + (world.hard ? 7 : 10) + index * 3;
        }
      }

      // Move rear reserves towards the frontier, never shuttle them backwards.
      for (const donor of owned) {
        if (available.get(donor.id)! < 20 || frontierDistance(donor) <= world.range) continue;
        const receiver = owned.filter(b => b.id !== donor.id && distance(donor, b) <= world.range && frontierDistance(b) + 50 < frontierDistance(donor))
          .sort((a, b) => frontierDistance(a) - frontierDistance(b))[0];
        if (receiver && arriving(receiver, color) < 80) order(donor, receiver, available.get(donor.id)! * 0.7);
      }

      // Omni is a strategic commitment, not an automatic response to player success.
      // Do not combine it with fleet orders: evaluate exactly the force it will use.
      if (!plan.orders.length && world.seconds >= state.nextOmni && world.seconds >= state.nextAttack && world.canOmni(color)) {
        const strength = owned.reduce((sum, b) => sum + Math.floor(ships(b) * 0.3), 0);
        const safe = owned.every(b => ships(b) - Math.floor(ships(b) * 0.3) + arriving(b, color) >= threat(b) + (b.isCapital ? 45 : 10));
        const target = targets.filter(t => owned.some(b => distance(b, t) <= world.range)
          && arriving(t, color) === 0 && strength >= ships(t) * 1.35 + 20)
          .sort((a, b) => (Number(Boolean(b.isCapital)) * 100 + Number(Boolean(b.isDysonSphere)) * 60 - ships(b))
            - (Number(Boolean(a.isCapital)) * 100 + Number(Boolean(a.isDysonSphere)) * 60 - ships(a)))[0];
        if (safe && target) {
          plan.omniTarget = target.id;
          state.nextOmni = world.seconds + 30;
          state.nextAttack = world.seconds + 12;
        }
      }
    }
    return plans;
  }
}
