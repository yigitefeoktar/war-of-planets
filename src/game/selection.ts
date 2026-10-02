import type { Base } from './types';

export type SelectionPoint = { x: number; y: number };

/** Include friendly planet centers, including those exactly on the box boundary. */
export function friendlyPlanetsInRectangle(bases: Iterable<Base>, start: SelectionPoint, end: SelectionPoint, playerColor: string): Set<string> {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  return new Set([...bases].filter(base => base.color === playerColor
    && base.x >= left && base.x <= right && base.y >= top && base.y <= bottom).map(base => base.id));
}
