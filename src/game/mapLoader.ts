import { GameEngine } from './engine';
import { OrbitingGameEngine } from './orbitingEngine';
import { DYSON_SPHERE_ID, validateMap, type MapDefinition } from './campaign';

// Keep the legacy random generator for Quick Match. Authored games replace
// only the initial planets and ships; stars, combat, AI, and controls are shared.
export function createMatch(map?: MapDefinition, options: { hardMode?: boolean } = {}): GameEngine {
  if (map) validateMap(map);
  const hasWeaponPlanets = map?.planets.some(planet => planet.superweaponUnlocks?.length) ?? false;
  const galaxyTheme = options.hardMode ? 'hard' : map?.galaxyTheme;
  const engine = map?.orbit
    ? new OrbitingGameEngine(map.width, map.height, map.orbit, hasWeaponPlanets, galaxyTheme)
    : new GameEngine(map?.width ?? 3000, map?.height ?? 3000, { superweaponUnlocksEnabled: !map || hasWeaponPlanets, galaxyTheme });
  if (map) {
    engine.bases.clear();
    engine.pixels = [];
    engine.nextPixelId = 0;
    engine.MAX_ATTACK_RANGE = map.attackRange;
    for (const planet of map.planets) {
      engine.addBase(planet.id, planet.x, planet.y, planet.owner, planet.ships, planet.capital);
      if (planet.superweaponUnlocks?.length) engine.bases.get(planet.id)!.superweaponUnlocks = [...planet.superweaponUnlocks];
    }
    if (map.orbit?.dysonSphere) {
      engine.addBase(DYSON_SPHERE_ID, map.orbit.x, map.orbit.y, '#6b7280', 0);
      engine.bases.get(DYSON_SPHERE_ID)!.isDysonSphere = true;
    }
  }
  return engine;
}
