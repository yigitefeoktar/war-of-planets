import type { GameEngine } from './engine';
import type { SuperweaponId } from './types';

export const IMPOSSIBLE_PLANET_NOTICE_MS = 3000;

export type GamePopupState = {
  targetingMode: SuperweaponId | null;
  impossiblePlanetUntil: number;
  shipLimitActive: boolean;
};

/** Hidden timed notices retain their original deadline; the ship limit has none. */
export function activeGamePopup(state: GamePopupState, now: number): 'superweapon' | 'impossible-planet' | 'ship-limit' | null {
  if (state.targetingMode) return 'superweapon';
  if (state.impossiblePlanetUntil > now) return 'impossible-planet';
  if (state.shipLimitActive) return 'ship-limit';
  return null;
}

/** Every target click ends weapon mode, including an impossible target. */
export function resolveSuperweaponClick(
  engine: Pick<GameEngine, 'activateOmniStrike' | 'activatePlanetAbility'>,
  color: string,
  weapon: SuperweaponId,
  targetId: string | null,
): 'activated' | 'cancelled' | 'impossible' {
  if (!targetId) return 'cancelled';
  const activated = weapon === 'omni'
    ? engine.activateOmniStrike(color, targetId)
    : engine.activatePlanetAbility(color, targetId, weapon);
  return activated ? 'activated' : 'impossible';
}
