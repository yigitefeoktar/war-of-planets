import type { Base, Pixel } from './types';

export const SUPERWEAPON_MAX_ENERGY = 100;
export const ENERGY_PER_PLANET_PER_SECOND = 0.2;

export type SuperweaponId = 'aegis' | 'singularity' | 'omni' | 'dominion';
export type SuperweaponTargetMode = Exclude<SuperweaponId, 'aegis'> | null;

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
