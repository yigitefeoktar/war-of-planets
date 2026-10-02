import { GameEngine } from './engine';
import { OrbitingGameEngine } from './orbitingEngine';
import { DYSON_SPHERE_ID, SIEGE_OF_HELIOS, mapOrbits, validateMap, type MapDefinition } from './campaign';
import { SUPERWEAPON_IDS } from './superweapons';

// Keep the legacy random generator for Quick Match. Authored games replace
// only the initial planets and ships; stars, combat, AI, and controls are shared.
export function createMatch(map?: MapDefinition, options: { hardMode?: boolean } = {}): GameEngine {
  if (map) validateMap(map);
  // Authored campaign/test maps share the same policy; random modes keep all weapons.
  const enabledSuperweapons = SUPERWEAPON_IDS.filter(weapon => weapon !== 'overdrive' || !map || map.id === SIEGE_OF_HELIOS.id);
  const hasWeaponPlanets = map?.planets.some(planet => planet.superweaponUnlocks?.some(weapon => enabledSuperweapons.includes(weapon))) ?? false;
  const galaxyTheme = options.hardMode ? 'hard' : map?.galaxyTheme;
  const orbits = mapOrbits(map);
  const engine = map && orbits.length
    ? new OrbitingGameEngine(map.width, map.height, orbits, hasWeaponPlanets, galaxyTheme, enabledSuperweapons)
    : new GameEngine(map?.width ?? 3000, map?.height ?? 3000, { superweaponUnlocksEnabled: !map || hasWeaponPlanets, enabledSuperweapons, galaxyTheme });
  if (map) {
    engine.bases.clear();
    engine.pixels = [];
    engine.nextPixelId = 0;
    engine.MAX_ATTACK_RANGE = map.attackRange;
    for (const planet of map.planets) {
      engine.addBase(planet.id, planet.x, planet.y, planet.owner, planet.ships, planet.capital);
      const unlocks = planet.superweaponUnlocks?.filter(weapon => enabledSuperweapons.includes(weapon));
      if (unlocks?.length) engine.bases.get(planet.id)!.superweaponUnlocks = unlocks;
    }
    const dyson = orbits.find(orbit => orbit.dysonSphere);
    if (dyson) {
      engine.addBase(DYSON_SPHERE_ID, dyson.x, dyson.y, '#6b7280', 0);
      engine.bases.get(DYSON_SPHERE_ID)!.isDysonSphere = true;
    }
  }
  return engine;
}
