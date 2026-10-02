import type { Base, Pixel } from './types';
import { canUseMultiSelect } from './selection';

type FleetNetwork = {
  bases: Map<string, Base>;
  pixels: Pixel[];
  MAX_ATTACK_RANGE: number;
  readonly multiSelectEnabled?: boolean;
  sendUnits: (fromId: string, toId: string, percentage?: number) => void;
};

const distance = (a: Base, b: Base) => Math.hypot(a.x - b.x, a.y - b.y);

export function hasIncomingHostile(pixels: readonly Pixel[], base: Base): boolean {
  return pixels.some(ship => !ship.dead && ship.state === 'moving'
    && ship.targetBaseId === base.id && ship.color !== base.color);
}

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
  const source = engine.bases.get(fromId)!;
  // Leave a small garrison only when a full launch would empty a threatened planet.
  const deployed = percentage === 1 && hasIncomingHostile(engine.pixels, source) ? 0.9 : percentage;
  engine.sendUnits(fromId, toId, deployed);
  return true;
}

/** Group orders can only reinforce worlds still owned by the player at launch time. */
export function issueFriendlyGroupOrder(engine: FleetNetwork, sourceIds: Iterable<string>, toId: string, percentage: number, playerColor: string): number {
  if (!canUseMultiSelect(engine.bases.values(), playerColor, engine.multiSelectEnabled)) return 0;
  if (engine.bases.get(toId)?.color !== playerColor) return 0;
  let launched = 0;
  for (const fromId of new Set(sourceIds)) {
    if (engine.bases.get(fromId)?.color !== playerColor || fromId === toId) continue;
    if (issueFleetOrder(engine, fromId, toId, percentage)) launched++;
  }
  return launched;
}
