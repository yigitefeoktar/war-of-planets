export type SuperweaponId = 'aegis' | 'singularity' | 'omni' | 'dominion';

export interface Base {
  id: string;
  x: number;
  y: number;
  color: string;
  pixelCount: number;
  lastAttackedTime?: number;
  isCapital?: boolean;
  superweaponUnlocks?: SuperweaponId[];
}

export interface Pixel {
  id: number;
  baseId: string;
  x: number;
  y: number;
  color: string;
  targetX: number;
  targetY: number;
  speed: number;
  state: 'idle' | 'moving';
  angle: number;
  targetBaseId?: string;
  dead?: boolean;
  isWarp?: boolean;
  trail?: { x: number; y: number; alpha: number }[];
}
