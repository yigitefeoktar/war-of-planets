import { GameEngine } from './engine';
import { OrbitingGameEngine } from './orbitingEngine';
import { DYSON_SPHERE_ID, SIEGE_OF_HELIOS, mapOrbits, validateMap, type MapDefinition } from './campaign';
import { createClassicBattlefield } from './classicMap';

// Standalone matches use balanced fixed geography with shuffled capitals. Authored games replace
// only the initial planets and ships; stars, combat, AI, and controls are shared.
export function createMatch(map?: MapDefinition, options: { hardMode?: boolean } = {}): GameEngine {
  const battlefield = map ?? createClassicBattlefield();
  validateMap(battlefield);
  const multiSelectEnabled = !map || battlefield.id === SIEGE_OF_HELIOS.id;
  const hasWeaponPlanets = !map || battlefield.planets.some(planet => planet.superweaponUnlocks?.length);
  const galaxyTheme = options.hardMode ? 'hard' : battlefield.galaxyTheme;
  const orbits = mapOrbits(battlefield);
  const engine = orbits.length
    ? new OrbitingGameEngine(battlefield.width, battlefield.height, orbits, hasWeaponPlanets, galaxyTheme, multiSelectEnabled)
    : new GameEngine(battlefield.width, battlefield.height, { superweaponUnlocksEnabled: hasWeaponPlanets, galaxyTheme, multiSelectEnabled });
  engine.isHardMode = options.hardMode ?? false;
  engine.bases.clear();
  engine.pixels = [];
  engine.nextPixelId = 0;
  engine.MAX_ATTACK_RANGE = battlefield.attackRange;
  for (const planet of battlefield.planets) {
    engine.addBase(planet.id, planet.x, planet.y, planet.owner, planet.ships, planet.capital);
    if (planet.superweaponUnlocks?.length) engine.bases.get(planet.id)!.superweaponUnlocks = [...planet.superweaponUnlocks];
  }
  const dyson = orbits.find(orbit => orbit.dysonSphere);
  if (dyson) {
    engine.addBase(DYSON_SPHERE_ID, dyson.x, dyson.y, '#6b7280', 0);
    engine.bases.get(DYSON_SPHERE_ID)!.isDysonSphere = true;
  }
  return engine;
}
