import type { Pixel } from './types';
import { overlapsView, type ViewBounds } from './visibility';

export const SHIP_DETAIL_LIMITS = {
  enter: 2000,
  exit: 1500,
  ships: 1200,
  trails: 96,
  particles: 400,
  repelled: 128,
} as const;

type FleetGroup = { ships: Pixel[]; quota: number; slots: (Pixel | undefined)[]; hashes: number[] };

// A stable, presentation-only priority. Never consume the simulation's RNG or
// change a ship to select the representatives of a dense fleet.
function shipHash(id: number) {
  let hash = Math.imul(id ^ (id >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export class ShipRendering {
  private busy = false;
  private groups = new Map<string, FleetGroup>();
  private usedGroups: FleetGroup[] = [];
  private selected: Pixel[] = [];

  get active() { return this.busy; }

  update(shipCount: number, particleCount = 0) {
    if (!this.busy && shipCount >= SHIP_DETAIL_LIMITS.enter) this.busy = true;
    // Keep the cheaper effects until a mass fleet destruction has settled.
    else if (this.busy && shipCount <= SHIP_DETAIL_LIMITS.exit && particleCount <= SHIP_DETAIL_LIMITS.particles) {
      this.busy = false;
      this.groups.clear(); this.usedGroups.length = 0; this.selected.length = 0;
    }
    return this.busy;
  }

  select(ships: readonly Pixel[], view: ViewBounds, zoom: number): readonly Pixel[] {
    if (!this.busy) return ships;
    this.usedGroups.length = 0; this.selected.length = 0;
    for (const group of this.groups.values()) group.ships.length = 0;
    let visibleCount = 0;
    for (const ship of ships) {
      if (ship.dead || !overlapsView(view, ship.x, ship.y, 12 + 16 / zoom)) continue;
      // Keep small incoming fleets, separate launch routes and each faction
      // represented even when one planet has thousands of stationed ships.
      const key = ship.state === 'idle' ? `${ship.color}|${ship.baseId}|idle`
        : `${ship.color}|${ship.baseId}|${ship.targetBaseId}|${ship.isWarp ? 'warp' : 'moving'}`;
      let group = this.groups.get(key);
      if (!group) {
        group = { ships: [], quota: 0, slots: [], hashes: [] };
        this.groups.set(key, group);
      }
      if (!group.ships.length) this.usedGroups.push(group);
      group.ships.push(ship);
      visibleCount++;
    }
    // Discard inactive routes instead of retaining every historical order.
    for (const [key, group] of this.groups) if (!group.ships.length) this.groups.delete(key);
    if (visibleCount <= SHIP_DETAIL_LIMITS.ships) {
      for (const group of this.usedGroups) for (const ship of group.ships) this.selected.push(ship);
      return this.selected;
    }

    const budget = SHIP_DETAIL_LIMITS.ships;
    // An extreme case of more routes than the entire visual budget still has
    // bounded work; sample across routes rather than taking the first faction.
    if (this.usedGroups.length > budget) {
      for (let i = 0; i < budget; i++) {
        const group = this.usedGroups[Math.floor(i * this.usedGroups.length / budget)];
        this.selected.push(group.ships[0]);
      }
      return this.selected;
    }
    const extra = budget - this.usedGroups.length;
    const weight = this.usedGroups.reduce((sum, group) => sum + Math.sqrt(group.ships.length - 1), 0);
    let assigned = 0;
    for (const group of this.usedGroups) {
      group.quota = Math.min(group.ships.length, 1 + Math.floor(extra * Math.sqrt(group.ships.length - 1) / weight));
      assigned += group.quota;
    }
    while (assigned < budget) {
      for (const group of this.usedGroups) {
        if (group.quota < group.ships.length) { group.quota++; assigned++; }
        if (assigned === budget) break;
      }
    }
    for (const group of this.usedGroups) {
      if (group.quota === group.ships.length) {
        for (const ship of group.ships) this.selected.push(ship);
        continue;
      }
      // Fixed hash buckets keep the chosen ships stable between frames and
      // during ordinary production. No sorting or per-ship Canvas transforms.
      const bucketCount = 2 ** Math.ceil(Math.log2(group.quota));
      group.slots.length = bucketCount; group.slots.fill(undefined);
      group.hashes.length = bucketCount; group.hashes.fill(Infinity);
      for (const ship of group.ships) {
        const hash = shipHash(ship.id), slot = hash & (bucketCount - 1);
        if (slot < group.quota && hash < group.hashes[slot]) {
          group.slots[slot] = ship; group.hashes[slot] = hash;
        }
      }
      const before = this.selected.length;
      for (let i = 0; i < group.quota; i++) if (group.slots[i]) this.selected.push(group.slots[i]!);
      if (this.selected.length === before) this.selected.push(group.ships[0]);
    }
    return this.selected;
  }
}

export function sampleEffects<T extends { x: number; y: number; size?: number }>(effects: readonly T[], view: ViewBounds, budget: number): readonly T[] {
  const visible = effects.filter(effect => overlapsView(view, effect.x, effect.y, effect.size ?? 24));
  if (visible.length <= budget) return visible;
  return Array.from({ length: budget }, (_, i) => visible[Math.floor(i * visible.length / budget)]);
}
