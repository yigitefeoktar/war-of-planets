import type { Base } from './types';

export type SelectionPoint = { x: number; y: number };
export const MIN_MULTI_SELECT_PLANETS = 30;

export function countOwnedPlanets(bases: Iterable<Base>, playerColor: string): number {
  let count = 0;
  for (const base of bases) if (base.color === playerColor && !base.isDysonSphere) count++;
  return count;
}

export function canUseMultiSelect(bases: Iterable<Base>, playerColor: string, enabled = true): boolean {
  return enabled && countOwnedPlanets(bases, playerColor) >= MIN_MULTI_SELECT_PLANETS;
}

/** Include friendly planet centers, including those exactly on the box boundary. */
export function friendlyPlanetsInRectangle(bases: Iterable<Base>, start: SelectionPoint, end: SelectionPoint, playerColor: string): Set<string> {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  return new Set([...bases].filter(base => base.color === playerColor
    && base.x >= left && base.x <= right && base.y >= top && base.y <= bottom).map(base => base.id));
}
