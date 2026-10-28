import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildQuickMap, QUICK_ROUTE_VARIANTS, quickRouteVariant, validateQuickGeometry } from './quickMapGenerator';
import { generateMap } from './generatedMaps';
import { validateMap, type MapDefinition } from './campaign';
import { createCustomMap, DEFAULT_CUSTOM_MAP } from './customMaps';

/** Compare the permanent route graph without IDs, coordinates, weapons, colors or costs. */
function fixedRouteSignature(map: MapDefinition) {
  const moving = new Set(map.orbits!.flatMap(orbit => orbit.planetIds));
  const planets = map.planets.filter(planet => !moving.has(planet.id));
  const neighbors = planets.map(planet => planets.map((other, i) => other !== planet && Math.hypot(planet.x - other.x, planet.y - other.y) <= map.attackRange ? i : -1).filter(i => i >= 0));
  let labels: string[] = planets.map(planet => planet.capital ? 'capital' : 'world');
  for (let round = 0; round < 6; round++) labels = labels.map((label, i) => createHash('sha256').update(`${label}:${neighbors[i].map(n => labels[n]).sort().join(',')}`).digest('hex'));
  return labels.sort().join(':');
}

test('all twelve Quick foundations have different permanent route structures', () => {
  const signatures = new Set<string>();
  assert.equal(new Set(QUICK_ROUTE_VARIANTS.flat()).size, 12);
  for (const seed of [0, 4, 8]) for (const family of [0, 1, 2, 3]) {
    const map = buildQuickMap(seed, family, { orbitingPlanets: 6, flankRegions: 1, weaponFocus: 'balanced' });
    validateMap(map);
    validateQuickGeometry(map);
    const signature = fixedRouteSignature(map);
    assert.equal(signatures.has(signature), false, `${family}/${quickRouteVariant(seed)} duplicates a foundation`);
    signatures.add(signature);
    assert.deepEqual(map, buildQuickMap(seed, family, { orbitingPlanets: 6, flankRegions: 1, weaponFocus: 'balanced' }));
  }
  assert.equal(signatures.size, 12);
});

test('Crossroads and Outer Arsenals stay different with matching manual parameters', () => {
  for (let seed = 0; seed < 48; seed++) {
    const options = { orbitingPlanets: 6 as const, flankRegions: 1 as const, weaponFocus: 'balanced' as const };
    assert.notEqual(fixedRouteSignature(buildQuickMap(seed, 0, options)), fixedRouteSignature(buildQuickMap(seed, 2, options)));
  }
});

test('manual controls stay certified across every Quick foundation and ring/flank combination', () => {
  for (const seed of [0, 4, 8, 0xFFFFFFFF]) for (const family of [0, 1, 2, 3]) {
    for (const orbitingPlanets of [5, 6, 7] as const) for (const flankRegions of [0, 1, 2] as const) {
      // The custom menu restricts single-core families to their supported flank ranges.
      if (family === 0 && flankRegions > 1 || family === 2 && flankRegions < 1) continue;
      const map = buildQuickMap(seed, family, { orbitingPlanets, flankRegions, weaponFocus: 'defense' });
      assert.doesNotThrow(() => validateQuickGeometry(map), `${family}/${quickRouteVariant(seed)}, ring ${orbitingPlanets}, flanks ${flankRegions}`);
      const capitals = map.planets.filter(planet => planet.capital);
      const openings = capitals.map(capital => map.planets.filter(planet => planet !== capital && Math.hypot(capital.x - planet.x, capital.y - planet.y) <= 600).map(planet => planet.ships).sort());
      openings.forEach(opening => assert.deepEqual(opening, openings[0]));
      assert.ok(capitals.every(capital => capital.ships === 200));
    }
  }
});

test('Quick improvements leave the Chaos generator output unchanged', () => {
  const before = [
    'e75d9768e64c51f86442ffeb9cc86308f2eb68d838c646976d31479619251d4d',
    '8da6d9c4dd0a4c8ca66a4a0bfcb7f1a38cb6b51b726c9963e1c090460e612dd6',
    '233be39a4afe2e7a88da41d68990e97d5d3fa7209924fbae4da4ee60afa9eb2a',
    '023883d1cbaba7264639404b01f70e5f76c12fe39cd5a4f7fb6482f1ca3ec6bd',
  ];
  for (let seed = 0; seed < before.length; seed++) assert.equal(createHash('sha256').update(JSON.stringify(generateMap('chaos-mode', seed))).digest('hex'), before[seed]);
});

test('Quick layouts offer distinct rewards and cheaper alternatives across seeds', () => {
  for (let seed = 0; seed < 96; seed++) {
    const maps = [0, 1, 2, 3].map(family => buildQuickMap(seed, family));
    const worlds = (map: MapDefinition, ids: string[]) => map.planets.filter(planet => ids.includes(planet.id));
    const groupWorlds = (map: MapDefinition, moduleId: string) => {
      const group = map.generated!.weaponGroups.find(group => group.moduleId === moduleId)!;
      assert.ok(group, `Missing objective ${moduleId}`);
      return worlds(map, group.planetIds);
    };
    const [crossroads, fronts, arsenals, arenas] = maps;

    // The central production reward costs more than a perimeter raid.
    assert.ok(groupWorlds(crossroads, 'core-0').every(planet => planet.ships >= 44 && planet.superweaponUnlocks?.includes('overdrive')));
    const cheapPerimeter = crossroads.planets.filter(planet => planet.id.startsWith('outer-route-') && !planet.superweaponUnlocks?.length);
    assert.ok(cheapPerimeter.length >= 4 && cheapPerimeter.every(planet => planet.ships === 18));

    // Committing to either front is cheaper than crossing between fronts.
    assert.ok(groupWorlds(fronts, 'core-0').every(planet => planet.superweaponUnlocks?.includes('overdrive')));
    assert.ok(groupWorlds(fronts, 'core-1').every(planet => planet.superweaponUnlocks?.includes('omni')));
    const crossings = [0, 1, 2, 3].map(side => fronts.planets.find(planet => planet.id === `outer-route-${side}-crossing`)!);
    assert.ok(crossings[0].ships > crossings[1].ships && crossings[2].ships > crossings[3].ships);
    assert.ok(groupWorlds(fronts, 'outer-bypass').every(planet => planet.ships < crossings[0].ships));

    // Outer strike worlds demand a larger investment than the defensive center.
    const outerStrike = arsenals.generated!.weaponGroups.find(group => group.profile === 'strike')!;
    assert.ok(outerStrike.moduleId.startsWith('flank-'));
    assert.ok(worlds(arsenals, outerStrike.planetIds).every(planet => planet.ships >= 48));
    assert.ok(groupWorlds(arsenals, 'core-0').every(planet => planet.ships <= 28 && planet.superweaponUnlocks?.includes('repulse')));

    // The two arenas provide different jobs, rather than equal random prizes.
    const arenaGroups = arenas.generated!.weaponGroups.filter(group => group.moduleId.startsWith('outer-route-'));
    assert.equal(arenaGroups.length, 2);
    assert.equal(arenaGroups[0].profile, 'strike');
    assert.equal(arenaGroups[1].profile, 'support');
    assert.ok(worlds(arenas, arenaGroups[0].planetIds).every(planet => planet.ships >= 46));
    assert.ok(worlds(arenas, arenaGroups[1].planetIds).every(planet => planet.ships <= 30));
    for (const map of maps) assert.ok(map.briefing.length > 50);
  }
});

test('custom defender and weapon choices preserve Quick route tradeoffs and briefing', () => {
  for (const defenders of ['light', 'standard', 'fortified'] as const) {
    for (const weaponFocus of ['balanced', 'production', 'defense', 'strike'] as const) {
      for (const quickLayout of [0, 1, 2, 3]) {
        const map = createCustomMap({ ...DEFAULT_CUSTOM_MAP, seed: 8, quickLayout, defenders, weaponFocus });
        validateQuickGeometry(map);
        assert.equal(map.briefing, buildQuickMap(8, quickLayout).briefing);
        if (weaponFocus !== 'balanced') assert.equal(map.generated!.weaponGroups[0].profile, weaponFocus);
        if (quickLayout === 3) {
          const [assault, staging] = map.generated!.weaponGroups.filter(group => group.moduleId.startsWith('outer-route-'));
          const cost = (ids: string[]) => map.planets.filter(planet => ids.includes(planet.id)).map(planet => planet.ships);
          assert.ok(Math.min(...cost(assault.planetIds)) > Math.max(...cost(staging.planetIds)));
        }
      }
    }
  }
});
