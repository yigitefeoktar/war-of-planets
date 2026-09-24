import type { Base, SuperweaponId } from './types';

export type { SuperweaponId } from './types';

export const SUPERWEAPON_CHARGE_INTERVAL_SECONDS = 60;
export const SUPERWEAPON_MAX_CHARGES = 1;

export type SuperweaponTargetMode = SuperweaponId | null;

export const SUPERWEAPON_IDS: SuperweaponId[] = ['omni', 'overdrive', 'repulse'];

const QUICK_MATCH_UNLOCK_GROUPS: SuperweaponId[][] = [
  ['overdrive'], ['repulse'], ['omni'],
  ['overdrive', 'repulse', 'omni'],
];

export const OVERDRIVE_DURATION = 15;
export const OVERDRIVE_MULTIPLIER = 3;
export const REPULSE_DURATION = 6;

/** Spread three specialist sites and one rare combined arsenal across Quick Match. */
export function assignQuickMatchSuperweaponPlanets(bases: Iterable<Base>) {
  const candidates = Array.from(bases).filter(base => !base.isCapital && base.color === '#6b7280');
  if (candidates.length < QUICK_MATCH_UNLOCK_GROUPS.length) return;
  QUICK_MATCH_UNLOCK_GROUPS.forEach((unlocks, index) => {
    const candidateIndex = Math.floor(index * candidates.length / QUICK_MATCH_UNLOCK_GROUPS.length);
    candidates[candidateIndex].superweaponUnlocks = [...unlocks];
  });
}

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
