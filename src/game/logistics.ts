import type { Base } from './types';

type FleetNetwork = {
  bases: Map<string, Base>;
  MAX_ATTACK_RANGE: number;
  sendUnits: (fromId: string, toId: string, percentage?: number) => void;
};

const distance = (a: Base, b: Base) => Math.hypot(a.x - b.x, a.y - b.y);

/** Friendly planets connected by one or more in-range friendly links. */
export function connectedFriendlyIds(bases: Iterable<Base>, sourceId: string, linkRange: number): Set<string> {
  const planets = [...bases];
  const source = planets.find(planet => planet.id === sourceId);
  if (!source || !Number.isFinite(linkRange) || linkRange <= 0) return new Set();
  const connected = new Set([source.id]);
  const queue = [source];
  while (queue.length) {
    const current = queue.shift()!;
    for (const candidate of planets) {
      if (connected.has(candidate.id) || candidate.color !== source.color) continue;
      if (distance(current, candidate) <= linkRange) {
        connected.add(candidate.id);
        queue.push(candidate);
      }
    }
  }
  return connected;
}

export function canIssueFleetOrder(bases: Iterable<Base>, fromId: string, toId: string, attackRange: number): boolean {
  if (fromId === toId) return false;
  const planets = [...bases];
  const source = planets.find(planet => planet.id === fromId);
  const target = planets.find(planet => planet.id === toId);
  if (!source || !target) return false;
  return target.color === source.color
    ? connectedFriendlyIds(planets, fromId, attackRange).has(toId)
    : distance(source, target) <= attackRange;
}

/** Validate the order at launch time. A launched fleet is never cancelled later. */
export function issueFleetOrder(engine: FleetNetwork, fromId: string, toId: string, percentage: number): boolean {
  if (!canIssueFleetOrder(engine.bases.values(), fromId, toId, engine.MAX_ATTACK_RANGE)) return false;
  engine.sendUnits(fromId, toId, percentage);
  return true;
}
