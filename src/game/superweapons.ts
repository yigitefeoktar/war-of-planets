import type { Base, Pixel, SuperweaponId } from './types';

export type { SuperweaponId } from './types';

export const SUPERWEAPON_MAX_ENERGY = 100;
export const ENERGY_PER_PLANET_PER_SECOND = 0.2;

export type SuperweaponTargetMode = Exclude<SuperweaponId, 'aegis'> | null;

export const SUPERWEAPON_IDS: SuperweaponId[] = ['aegis', 'singularity', 'omni', 'dominion'];

const QUICK_MATCH_UNLOCK_GROUPS: SuperweaponId[][] = [
  ['aegis'],
  ['singularity'],
  ['omni'],
  ['dominion'],
  ['aegis', 'omni'],
  ['singularity', 'dominion'],
];

/** Spread two unlock sites for every weapon across a generated Quick Match map. */
export function assignQuickMatchSuperweaponPlanets(bases: Iterable<Base>) {
  const candidates = Array.from(bases).filter(base => !base.isCapital && base.color === '#6b7280');
  if (candidates.length < QUICK_MATCH_UNLOCK_GROUPS.length) return;
  QUICK_MATCH_UNLOCK_GROUPS.forEach((unlocks, index) => {
    const candidateIndex = Math.floor(index * candidates.length / QUICK_MATCH_UNLOCK_GROUPS.length);
    candidates[candidateIndex].superweaponUnlocks = [...unlocks];
  });
}

export const SUPERWEAPON_COSTS: Record<SuperweaponId, number> = {
  aegis: 30,
  singularity: 50,
  omni: 70,
  dominion: 100,
};

export function isPointAccessible(
  bases: Iterable<Base>,
  color: string,
  x: number,
  y: number,
  range: number,
): boolean {
  for (const base of bases) {
    if (base.color === color && Math.hypot(base.x - x, base.y - y) <= range) return true;
  }
  return false;
}

export function aegisTargets(
  pixels: Iterable<Pixel>,
  bases: Iterable<Base>,
  color: string,
  range: number,
): Pixel[] {
  const owned = Array.from(bases).filter(base => base.color === color);
  if (owned.length === 0) return [];
  return Array.from(pixels).filter(pixel =>
    !pixel.dead &&
    pixel.state === 'moving' &&
    pixel.color !== color &&
    owned.some(base => Math.hypot(base.x - pixel.x, base.y - pixel.y) <= range)
  );
}
