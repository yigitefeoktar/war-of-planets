import type { Base, SuperweaponId } from './types';

export type { SuperweaponId } from './types';

export const SUPERWEAPON_CHARGE_INTERVAL_SECONDS = 60;
export const SUPERWEAPON_MAX_CHARGES = 1;

export type SuperweaponTargetMode = SuperweaponId | null;

// Legacy maps and random modes retain their original three-weapon selection.
export const SUPERWEAPON_IDS: SuperweaponId[] = ['omni', 'overdrive', 'repulse'];
export const ALL_SUPERWEAPON_IDS: SuperweaponId[] = [...SUPERWEAPON_IDS, 'conversion'];
export const CHAPTER_TWO_WEAPONS: SuperweaponId[] = ['conversion', 'omni', 'repulse'];
export const CONVERSION_COLOR = '#ff8fc7';
export const PINK = CONVERSION_COLOR;
export const PINK_TERRAFORM_INTERVAL_SECONDS = 5;
// Twice the average attacking ship speed: 1.25 world units/frame * 1.5 * 60fps * 2.
export const CONVERSION_PROBE_SPEED = 225;
// Additional sites remain valuable without enabling near-continuous army theft.
export const CONVERSION_MAX_EFFECTIVE_SOURCES = 4;

const QUICK_MATCH_UNLOCK_GROUPS: SuperweaponId[][] = [
  ['overdrive'], ['repulse'], ['omni'],
  ['overdrive', 'repulse', 'omni'],
];

export const OVERDRIVE_DURATION = 7.5;
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
