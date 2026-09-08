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

export function drawFriendlyNetwork(ctx: CanvasRenderingContext2D, bases: Iterable<Base>, sourceId: string | null, linkRange: number, zoom: number) {
  if (!sourceId) return;
  const planets = [...bases];
  const source = planets.find(planet => planet.id === sourceId);
  if (!source) return;
  const connectedIds = connectedFriendlyIds(planets, sourceId, linkRange);
  const connected = planets.filter(planet => connectedIds.has(planet.id));
  if (connected.length < 2) return;

  ctx.save();
  ctx.strokeStyle = '#73dcff';
  ctx.shadowColor = '#73dcff';
  ctx.lineWidth = 1.5 / zoom;
  ctx.globalAlpha = 0.25;
  // Show the actual friendly links that make the network connected.
  for (let i = 0; i < connected.length; i++) for (let j = i + 1; j < connected.length; j++) {
    if (distance(connected[i], connected[j]) > linkRange) continue;
    ctx.beginPath();
    ctx.moveTo(connected[i].x, connected[i].y);
    ctx.lineTo(connected[j].x, connected[j].y);
    ctx.stroke();
  }
  // Every connected friendly planet is a valid direct transfer destination.
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([7 / zoom, 7 / zoom]);
  for (const planet of connected) {
    if (planet.id === sourceId) continue;
    const radius = (planet.isCapital ? 40 : 20) + 17 + Math.sqrt(planet.pixelCount) * 5;
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
