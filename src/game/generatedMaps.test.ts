import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAOS_LAYOUTS, QUICK_LAYOUTS, createGeneratedMap, generateMap, mapConnected, seededRandom, validateChaosGeometry, validateQuickGeometry } from './generatedMaps';
import { FACTIONS, NEUTRAL, validateMap, type MapDefinition, type PlanetDefinition } from './campaign';
import { createMatch } from './mapLoader';
import { OrbitingGameEngine } from './orbitingEngine';
import { issueFleetOrder } from './logistics';
import { openingFrame } from './camera';
import { generatedOrbitPeriod, validateConnectionDensity } from './mapGenerationUtils';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const fingerprint = (map: MapDefinition) => JSON.stringify({ planets: map.planets.map(({ id, ...planet }) => planet), orbits: map.orbits });

function captureCosts(capital: PlanetDefinition, planets: PlanetDefinition[]) {
  const remaining = new Set(planets.filter(planet => !planet.capital || planet === capital));
  const costs = new Map([[capital.id, 0]]);
  while (remaining.size) {
    const next = [...remaining].filter(planet => costs.has(planet.id)).sort((a, b) => costs.get(a.id)! - costs.get(b.id)!)[0];
    if (!next) break;
    remaining.delete(next);
    for (const other of remaining) if (distance(next, other) <= 600) {
      costs.set(other.id, Math.min(costs.get(other.id) ?? Infinity, costs.get(next.id)! + other.ships));
    }
  }
  return (['omni', 'overdrive', 'repulse'] as const).map(weapon =>
    Math.min(...planets.filter(planet => planet.superweaponUnlocks?.includes(weapon)).map(planet => costs.get(planet.id) ?? Infinity)));
}

function routeSignature(map: MapDefinition): string {
  const neighbors = map.planets.map(planet => map.planets.map((other, i) => other !== planet && distance(planet, other) <= map.attackRange ? i : -1).filter(i => i >= 0));
  const hash = (value: string) => { let result = 2166136261; for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619); return (result >>> 0).toString(36); };
  let labels: string[] = map.planets.map(planet => planet.capital ? 'capital' : 'world');
  // Ignore coordinates, IDs, colors, costs and weapon placements. This compares
  // the route structure itself, rather than counting cosmetic seed changes.
  for (let round = 0; round < 6; round++) labels = labels.map((label, i) => hash(`${label}:${neighbors[i].map(n => labels[n]).sort().join(',')}`));
  return labels.sort().join(':');
}

function assertSurvivingNeighborFloor(map: MapDefinition, planets: PlanetDefinition[]) {
  const entrances = new Set(map.generated?.modules?.filter(module => module.kind === 'corridor').flatMap(module => module.planetIds));
  for (const planet of planets) {
    const degree = planets.filter(other => other !== planet && distance(planet, other) <= map.attackRange).length;
    assert.ok(degree >= 3 || degree === 2 && entrances.has(planet.id), `Elimination leaves ${planet.id} with only ${degree} neighbors`);
  }
}

test('generated orbital periods depend only on physical size, never population or seed', () => {
  for (const radius of [272, 280, 310, 315, 320, 330]) assert.equal(generatedOrbitPeriod(radius), 100);
  for (const radius of [500, 580, 590, 630, 640, 670, 680, 720]) assert.equal(generatedOrbitPeriod(radius), 300);
});

test('generated compact arenas visibly rotate faster and each star keeps its own period', () => {
  const map = generateMap('quick-match', 1), [fast, other] = map.orbits!;
  assert.equal(fast.periodSeconds, 100);
  // Give the second star a normal period to verify mixed speeds in one match.
  other.periodSeconds = 300;
  const engine = createMatch(map);
  engine.lastAITime = engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  const elapsed = fast.periodSeconds / 4;
  engine.update(elapsed);
  for (const orbit of map.orbits!) for (const id of orbit.planetIds) {
    const opening = map.planets.find(planet => planet.id === id)!, actual = engine.bases.get(id)!;
    const angle = Math.PI * 2 * elapsed / orbit.periodSeconds, x = opening.x - orbit.x, y = opening.y - orbit.y;
    assert.ok(Math.abs(actual.x - (orbit.x + x * Math.cos(angle) - y * Math.sin(angle))) < 1e-6);
    assert.ok(Math.abs(actual.y - (orbit.y + x * Math.sin(angle) + y * Math.cos(angle))) < 1e-6);
  }
});

test('1000 Quick seeds preserve frontlines, equal opening costs and substantially varied routes', t => {
  const fingerprints = new Set<string>(), counts = new Set<number>(), graphs = new Set<string>();
  const families = QUICK_LAYOUTS.map(() => new Set<string>());
  const started = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap('quick-match', seed);
    assert.doesNotThrow(() => validateMap(map));
    assert.doesNotThrow(() => validateQuickGeometry(map));
    assert.ok(map.orbits!.length >= 1 && map.orbits!.length <= 2);
    assert.ok(map.orbits!.every(orbit => orbit.periodSeconds === 100));
    assert.ok(map.planets.length >= 35 && map.planets.length <= 50);
    assert.equal(map.generated?.mode, 'quick-match');
    const capitals = map.planets.filter(planet => planet.capital);
    assert.deepEqual(capitals.map(planet => planet.owner).sort(), [...FACTIONS].sort());
    const costs = capitals.map(capital => {
      assert.equal(capital.ships, 200);
      const neighbors = map.planets.filter(planet => planet !== capital && distance(planet, capital) <= 600);
      assert.ok(neighbors.length === 4);
      assert.ok(neighbors.every(planet => planet.owner === NEUTRAL && !planet.superweaponUnlocks) && neighbors.filter(planet => planet.ships <= 18).length === 3);
      return captureCosts(capital, map.planets);
    });
    const openings = capitals.map(capital => map.planets.filter(planet => planet !== capital && distance(planet, capital) <= 600).map(planet => planet.ships).sort());
    openings.forEach(opening => assert.deepEqual(opening, openings[0]));
    costs.forEach(cost => assert.ok(cost.every(value => Number.isFinite(value) && value > 18)));
    for (let index = 0; index < map.planets.length; index++) {
      const planet = map.planets[index];
      const neighbors = map.planets.filter(other => other !== planet && distance(planet, other) <= 600);
      assert.ok(neighbors.length >= 2 && neighbors.length <= 9);
      for (const other of map.planets.slice(index + 1)) {
        const d = distance(planet, other);
        assert.ok(d >= 270 - 1e-5);
      }
    }
    const grouped = new Set<string>();
    for (const group of map.generated!.weaponGroups!) {
      assert.ok(group.planetIds.length >= 3 && group.planetIds.length <= 5);
      const worlds = map.planets.filter(planet => group.planetIds.includes(planet.id));
      assert.ok(mapConnected(worlds));
      worlds.forEach(planet => {
        assert.equal(grouped.has(planet.id), false); grouped.add(planet.id);
        assert.ok(planet.superweaponUnlocks!.every(weapon => group.allowedWeapons.includes(weapon)));
      });
    }
    assert.equal(grouped.size, map.planets.filter(planet => planet.superweaponUnlocks?.length).length);
    for (const capital of capitals) {
      const home = map.generated!.modules!.find(module => module.planetIds.includes(capital.id))!;
      const exits = map.planets.filter(planet => home.planetIds.includes(planet.id) && !planet.capital && map.planets.some(other => !home.planetIds.includes(other.id) && distance(planet, other) <= 600));
      assert.ok(exits.length >= 2, 'A home is trapped behind a single exit');
      assert.ok(mapConnected(map.planets.filter(planet => planet !== capital)), 'Capital elimination strands routes');
    }
    const moving = new Set(map.orbits!.flatMap(orbit => orbit.planetIds));
    const fixed = map.planets.filter(planet => !moving.has(planet.id) && !planet.capital);
    for (const removed of fixed) assert.ok(mapConnected(fixed.filter(planet => planet !== removed)), 'One fixed crossing controls the battlefield');
    fingerprints.add(fingerprint(map)); counts.add(map.planets.length);
    const signature = routeSignature(map);
    graphs.add(signature); families[seed % QUICK_LAYOUTS.length].add(signature);
  }
  assert.equal(fingerprints.size, 1000);
  assert.ok(counts.size >= 7);
  assert.ok(graphs.size >= 200, `Only ${graphs.size} different route structures`);
  families.forEach((signatures, index) => assert.ok(signatures.size >= 40, `${QUICK_LAYOUTS[index]} has only ${signatures.size} route structures`));
  t.diagnostic(`1000 Quick maps: ${Math.round(performance.now() - started)}ms; ${counts.size} planet counts, ${graphs.size} route structures; per family ${families.map(f => f.size).join(', ')}.`);
});

test('1000 Chaos seeds have weapons on every world and certified non-overlapping orbit networks', t => {
  const fingerprints = new Set<string>(), starCounts = new Set<number>(), planetCounts = new Set<number>();
  const families = CHAOS_LAYOUTS.map(() => new Set<string>());
  const routeGraphs = new Set<string>();
  const started = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap('chaos-mode', seed);
    assert.doesNotThrow(() => validateMap(map));
    assert.doesNotThrow(() => validateChaosGeometry(map));
    assert.ok(map.planets.length >= 35 && map.planets.length <= 50);
    assert.equal(new Set(map.orbits!.flatMap(orbit => orbit.planetIds)).size, map.planets.length);
    const capitals = map.planets.filter(planet => planet.capital);
    assert.deepEqual(capitals.map(planet => planet.owner).sort(), [...FACTIONS].sort());
    assert.ok(capitals.every(planet => planet.ships === 200));
    capitals.forEach(capital => {
      assert.deepEqual(capital.superweaponUnlocks, capitals[0].superweaponUnlocks);
      assert.ok(map.planets.filter(planet => planet !== capital && planet.ships <= 16 && distance(planet, capital) <= 600).length >= 2);
      assert.ok(capitals.filter(other => other !== capital).every(other => distance(other, capital) > 600));
    });
    for (const planet of map.planets) {
      assert.ok(planet.superweaponUnlocks!.length >= 1 && planet.superweaponUnlocks!.length <= 2);
      assert.equal(new Set(planet.superweaponUnlocks).size, planet.superweaponUnlocks!.length);
    }
    for (const orbit of map.orbits!) {
      const members = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
      const radius = Math.max(...members.map(planet => distance(planet, orbit)));
      assert.equal(orbit.periodSeconds, generatedOrbitPeriod(radius));
      assert.equal(orbit.dysonSphere, undefined);
      for (let index = 0; index < members.length; index++) {
        const planet = members[index], radius = distance(planet, orbit);
        assert.ok(radius >= 110);
        assert.ok(radius + 80 <= Math.min(orbit.x, orbit.y, map.width - orbit.x, map.height - orbit.y));
        for (const other of members.slice(index + 1)) assert.ok(distance(planet, other) >= 250);
      }
    }
    const signature = routeSignature(map);
    families[seed % CHAOS_LAYOUTS.length].add(signature); routeGraphs.add(signature);
    fingerprints.add(fingerprint(map)); starCounts.add(map.orbits!.length); planetCounts.add(map.planets.length);
  }
  assert.equal(fingerprints.size, 1000);
  assert.deepEqual([...starCounts].sort((a, b) => a - b), [4]);
  assert.ok(planetCounts.size >= 3);
  assert.ok(routeGraphs.size >= 40, `Only ${routeGraphs.size} Chaos route structures`);
  families.forEach((structures, i) => assert.ok(structures.size >= 10, `${CHAOS_LAYOUTS[i]} has only ${structures.size} route structures`));
  t.diagnostic(`1000 Chaos maps: ${Math.round(performance.now() - started)}ms; ${planetCounts.size} planet counts; route structures per family ${families.map(f => f.size).join(', ')}.`);
});

test('Chaos designs are internally dense, keep old systems as an option and synchronize similar sizes', () => {
  const patterns = new Set<string>(), populations = new Map<string, Set<number>>();
  let classicMaps = 0, mixedMaps = 0;
  for (let seed = 0; seed < 300; seed++) {
    const map = generateMap('chaos-mode', seed), systems = map.generated!.systems!;
    if (systems.every(system => system.pattern === 'classic')) classicMaps++;
    if (new Set(systems.map(system => system.size)).size > 1) mixedMaps++;
    assert.equal(systems.flatMap(system => system.planetIds).length, map.planets.length);
    for (const system of systems) {
      const orbit = map.orbits!.find(orbit => orbit.planetIds[0] === system.planetIds[0])!;
      assert.deepEqual(system.planetIds, orbit.planetIds);
      patterns.add(system.pattern);
      const counts = populations.get(system.size) ?? new Set<number>(); counts.add(system.planetIds.length); populations.set(system.size, counts);
      const local = map.planets.filter(planet => system.planetIds.includes(planet.id));
      const degrees = local.map(planet => local.filter(other => other !== planet && distance(planet, other) <= 600).length);
      assert.ok(degrees.every(degree => degree >= 3));
      assert.ok(degrees.filter(degree => degree === 4 || degree === 5).length >= Math.ceil(local.length * 0.7), `${system.pattern} has too few internal choices`);
      assert.ok(degrees.reduce((sum, degree) => sum + degree, 0) / degrees.length >= 4);
      const radius = Math.max(...local.map(planet => distance(planet, orbit)));
      assert.equal(orbit.periodSeconds, generatedOrbitPeriod(radius));
      for (const other of map.orbits!) {
        const otherRadius = Math.max(...map.planets.filter(planet => other.planetIds.includes(planet.id)).map(planet => distance(planet, other)));
        if (Math.abs(radius - otherRadius) <= 100) assert.equal(orbit.periodSeconds, other.periodSeconds, 'Similarly sized systems have different speeds');
      }
    }
  }
  assert.ok(classicMaps > 0 && mixedMaps > 0);
  assert.deepEqual([...patterns].sort(), ['classic', 'pentagon-web', 'ring', 'scattered', 'woven-rings']);
  assert.deepEqual([...populations.get('small')!].sort((a, b) => a - b), [5, 6, 7]);
  assert.deepEqual([...populations.get('large')!].sort((a, b) => a - b), [16, 17, 18]);
});

test('a weak individual system is rejected even when the whole map has enough connections', () => {
  const map = Array.from({ length: 80 }, (_, seed) => generateMap('chaos-mode', seed)).find(map => map.generated!.systems!.some(system => system.size === 'small' && system.planetIds.length === 5))!;
  const system = map.generated!.systems!.find(system => system.size === 'small' && system.planetIds.length === 5)!;
  const orbit = map.orbits!.find(orbit => orbit.planetIds[0] === system.planetIds[0])!;
  const removed = system.planetIds.pop()!;
  orbit.planetIds = orbit.planetIds.filter(id => id !== removed);
  map.planets = map.planets.filter(planet => planet.id !== removed);
  assert.doesNotThrow(() => validateConnectionDensity(map));
  assert.throws(() => validateChaosGeometry(map), /dense internal routes/);
});

test('Chaos connects through independently varied orbit phases even after all rival capitals disappear', () => {
  const random = seededRandom(2026);
  for (let seed = 0; seed < 100; seed++) {
    const map = generateMap('chaos-mode', seed);
    for (let sample = 0; sample < 30; sample++) {
      const phases = map.orbits!.map(orbit => ({ ...orbit, phase: random() * Math.PI * 2 }));
      const planets = map.planets.map(planet => {
        const orbit = phases.find(orbit => orbit.planetIds.includes(planet.id))!;
        const x = planet.x - orbit.x, y = planet.y - orbit.y;
        return { ...planet, x: orbit.x + x * Math.cos(orbit.phase) - y * Math.sin(orbit.phase), y: orbit.y + x * Math.sin(orbit.phase) + y * Math.cos(orbit.phase) };
      });
      assert.doesNotThrow(() => validateConnectionDensity({ ...map, planets }), `Density at seed ${seed}, phase ${sample}`);
      assert.ok(mapConnected(planets), `Seed ${seed}, phase ${sample}`);
      const survivors = planets.filter(planet => !planet.capital || planet.owner === FACTIONS[0]);
      assert.ok(mapConnected(survivors), `Elimination strands seed ${seed}, phase ${sample}`);
      assertSurvivingNeighborFloor(map, survivors);
      for (let i = 0; i < planets.length; i++) {
        const neighbors = planets.filter(other => other !== planets[i] && distance(planets[i], other) <= 600);
        assert.ok(neighbors.length >= 2 && neighbors.length <= 9, `Invalid orbital degree, seed ${seed}, phase ${sample}`);
        for (const other of planets.slice(i + 1)) assert.ok(distance(planets[i], other) >= 250 - 1e-5, `Orbit spacing, seed ${seed}, phase ${sample}`);
      }
      for (const capital of planets.filter(planet => planet.capital)) {
        const orbit = phases.find(orbit => orbit.planetIds.includes(capital.id))!;
        assert.ok(planets.filter(planet => !orbit.planetIds.includes(planet.id)).every(other => distance(capital, other) > 600), 'An enemy system can attack past the outer frontier');
      }
    }
  }
});

test('Quick module connections, spacing and frontiers survive 2000 independent orbit configurations', () => {
  const random = seededRandom(15102026);
  for (let seed = 0; seed < 80; seed++) {
    const map = generateMap('quick-match', seed);
    for (let sample = 0; sample < 25; sample++) {
      const phases = map.orbits!.map(orbit => ({ ...orbit, phase: random() * Math.PI * 2 }));
      const planets = map.planets.map(planet => {
        const orbit = phases.find(orbit => orbit.planetIds.includes(planet.id));
        if (!orbit) return { ...planet };
        const x = planet.x - orbit.x, y = planet.y - orbit.y;
        return { ...planet, x: orbit.x + x * Math.cos(orbit.phase) - y * Math.sin(orbit.phase), y: orbit.y + x * Math.sin(orbit.phase) + y * Math.cos(orbit.phase) };
      });
      assert.doesNotThrow(() => validateConnectionDensity({ ...map, planets }), `Density at seed ${seed}, phase ${sample}`);
      const survivors = planets.filter(planet => !planet.capital || planet.owner === FACTIONS[0]);
      assert.ok(mapConnected(survivors));
      assertSurvivingNeighborFloor(map, survivors);
      for (let i = 0; i < planets.length; i++) {
        const planet = planets[i], neighbors = planets.filter(other => other !== planet && distance(planet, other) <= 600);
        assert.ok(neighbors.length >= 2 && neighbors.length <= 9);
        for (const other of planets.slice(i + 1)) assert.ok(distance(planet, other) >= 270 - 1e-5);
        if (planet.capital) {
          const prefix = /^home-\d+-/.exec(planet.id)![0];
          assert.ok(neighbors.every(other => other.id.startsWith(prefix)));
        }
      }
      for (const group of map.generated!.weaponGroups!) assert.ok(mapConnected(planets.filter(planet => group.planetIds.includes(planet.id))));
    }
  }
});

test('modular certificate rejects ungrouped weapons, wrong specialty, broken modules and closing gateways', () => {
  const map = generateMap('quick-match', 26);
  const lone = structuredClone(map);
  lone.planets.find(planet => !planet.superweaponUnlocks?.length && !planet.id.startsWith('home-'))!.superweaponUnlocks = ['omni'];
  assert.throws(() => validateQuickGeometry(lone), /Ungrouped weapon/);
  const wrong = structuredClone(map), group = wrong.generated!.weaponGroups!.find(group => !group.allowedWeapons.includes('omni'))!;
  wrong.planets.find(planet => planet.id === group.planetIds[0])!.superweaponUnlocks = ['omni'];
  assert.throws(() => validateQuickGeometry(wrong), /allowed types/);
  const missing = structuredClone(map);
  missing.generated!.modules![0].planetIds.pop();
  assert.throws(() => validateQuickGeometry(missing), /module membership/);
  const closes = structuredClone(map), star = closes.generated!.modules!.find(module => module.kind === 'star-system')!;
  star.ports = [closes.planets.filter(planet => !closes.orbits!.some(orbit => orbit.planetIds.includes(planet.id))).sort((a, b) => distance(b, star) - distance(a, star))[0].id];
  assert.throws(() => validateQuickGeometry(closes), /gateways close/);
  const blocked = structuredClone(map), home = blocked.generated!.modules!.find(module => module.kind === 'home')!;
  for (const id of home.planetIds) blocked.planets.find(planet => planet.id === id)!.x += 10000;
  assert.throws(() => validateQuickGeometry(blocked), /one approach|capital opening|permanent neighbors|crossing/);

});

test('ordinary fleets cross a fixed gateway and capture a moving Quick specialist world', () => {
  const map = generateMap('quick-match', 12), star = map.generated!.modules!.find(module => module.kind === 'star-system')!;
  const port = map.planets.find(planet => planet.id === star.ports[0])!;
  port.owner = FACTIONS[0]; port.ships = 140;
  const target = map.planets.find(planet => star.planetIds.includes(planet.id) && planet.superweaponUnlocks?.length)!;
  const engine = createMatch(map);
  engine.lastAITime = engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = engine.pixels.filter(ship => ship.baseId === port.id || ship.baseId === target.id);
  for (let step = 0; step < 840 && distance(engine.bases.get(port.id)!, engine.bases.get(target.id)!) > 600; step++) engine.update(0.5);
  assert.ok(issueFleetOrder(engine, port.id, target.id, 0.75));
  for (let step = 0; step < 3600 && engine.bases.get(target.id)!.color !== FACTIONS[0]; step++) engine.update(1 / 60);
  assert.equal(engine.bases.get(target.id)!.color, FACTIONS[0]);
  assert.ok(engine.getSuperweaponSourceCount(FACTIONS[0], target.superweaponUnlocks![0]) > 0);
  assert.deepEqual([engine.bases.get(port.id)!.x, engine.bases.get(port.id)!.y], [port.x, port.y]);
});

test('density requires a four/five-neighbor majority and explicit narrow entrance modules', () => {
  // Merely meeting the three-neighbor floor is not enough: an isolated K4
  // passes that floor, but provides none of the requested four/five choices.
  const sparse = structuredClone(generateMap('quick-match', 0));
  sparse.planets = [[0, 0], [300, 0], [300, 300], [0, 300]].map(([x, y], i) => ({ id: `test-${i}`, x, y, owner: NEUTRAL, ships: 20 }));
  assert.throws(() => validateConnectionDensity(sparse), /Most planets/);
  const map = Array.from({ length: 40 }, (_, seed) => generateMap('quick-match', seed)).find(map => map.planets.some(planet =>
    map.planets.filter(other => other !== planet && distance(planet, other) <= 600).length === 2))!;
  assert.ok(map, 'Narrow crossings remain a supported, intentional recipe');
  assert.doesNotThrow(() => validateConnectionDensity(map));
  map.generated!.modules!.forEach(module => { if (module.kind === 'corridor') module.kind = 'arena'; });
  assert.throws(() => validateConnectionDensity(map), /intentional entrance/);
});

test('compact recipes enforce their planet budget and fit the complete swept geometry', () => {
  for (const mode of ['quick-match', 'chaos-mode'] as const) for (let seed = 0; seed < 40; seed++) {
    const map = generateMap(mode, seed);
    assert.ok(Math.max(map.width, map.height) <= 6800, 'A long corridor inflated the battlefield');
    assert.ok(map.width * map.height <= 36_000_000, 'Oversized empty battlefield');
    const bounds = map.planets.map(planet => ({ left: planet.x, right: planet.x, top: planet.y, bottom: planet.y }));
    for (const orbit of map.orbits!) {
      const radius = Math.max(...map.planets.filter(planet => orbit.planetIds.includes(planet.id)).map(planet => distance(planet, orbit)));
      bounds.push({ left: orbit.x - radius, right: orbit.x + radius, top: orbit.y - radius, bottom: orbit.y + radius });
    }
    const margins = [Math.min(...bounds.map(b => b.left)), map.width - Math.max(...bounds.map(b => b.right)),
      Math.min(...bounds.map(b => b.top)), map.height - Math.max(...bounds.map(b => b.bottom))];
    margins.forEach(margin => assert.ok(margin >= 240 - 1e-5 && margin < 290 + 1e-5, 'Empty square padding or a clipped orbit'));
    const oversized = structuredClone(map);
    while (oversized.planets.length <= 50) oversized.planets.push({ ...oversized.planets[0], id: `extra-${oversized.planets.length}` });
    assert.throws(() => mode === 'quick-match' ? validateQuickGeometry(oversized) : validateChaosGeometry(oversized), /planet budget/);
  }
});

test('seeds reproduce the complete opening; Play Again resets fleets, charges, ownership and orbit phase', () => {
  for (const mode of ['quick-match', 'chaos-mode'] as const) for (let seed = 0; seed < 20; seed++) {
    const map = generateMap(mode, seed), original = structuredClone(map);
    assert.deepEqual(generateMap(mode, seed), map);
    const first = createMatch(map, { hardMode: true });
    first.lastAITime = first.lastSpawnTime = Number.MAX_SAFE_INTEGER;
    first.pixels = [];
    first.update(47);
    first.bases.values().next().value!.color = FACTIONS[0];
    first.setSuperweaponCharge(FACTIONS[0], 'omni', 1);
    const again = createMatch(map, { hardMode: true });
    assert.equal(again.isHardMode, true);
    assert.equal(again.multiSelectEnabled, true);
    assert.equal(again instanceof OrbitingGameEngine, true);
    for (const planet of map.planets) {
      const base = again.bases.get(planet.id)!;
      assert.deepEqual([base.x, base.y, base.color, base.pixelCount, !!base.isCapital, base.superweaponUnlocks ?? []],
        [planet.x, planet.y, planet.owner, planet.ships, !!planet.capital, planet.superweaponUnlocks ?? []]);
    }
    assert.equal(again.getSuperweaponCharge(FACTIONS[0], 'omni'), 0);
    assert.deepEqual(map, original);
  }
});

test('New Map varies geometry and family on every launch, with corrupt or blocked storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const cases = ['{', 'null', '{}', '{"quick-match":{"seed":-1,"layout":999}}', '{"chaos-mode":{"seed":"x","layout":null}}'];
  try {
    for (const bad of cases) {
      let saved = bad;
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
      for (const mode of ['quick-match', 'chaos-mode'] as const) {
        const layouts = mode === 'quick-match' ? QUICK_LAYOUTS : CHAOS_LAYOUTS;
        const fingerprints = new Set<string>();
        let previous: MapDefinition | undefined;
        for (let index = 0; index < 30; index++) {
          const map = createGeneratedMap(mode);
          assert.ok(layouts.includes(map.generated!.layout as never));
          if (previous) {
            assert.notEqual(map.generated!.seed, previous.generated!.seed);
            assert.notEqual(map.generated!.layout, previous.generated!.layout);
          }
          fingerprints.add(fingerprint(map)); previous = map;
        }
        assert.equal(fingerprints.size, 30);
      }
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } } });
    for (const mode of ['quick-match', 'chaos-mode'] as const) {
      const a = createGeneratedMap(mode), b = createGeneratedMap(mode);
      assert.notEqual(a.generated!.layout, b.generated!.layout);
      assert.notEqual(fingerprint(a), fingerprint(b));
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('New Map consumes all four families before refilling its shuffled bag', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = '{}';
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } } });
    for (const mode of ['quick-match', 'chaos-mode'] as const) {
      let previous = createGeneratedMap(mode);
      for (let i = 0; i < 20; i++) {
        const before = JSON.parse(saved)[mode] as { layout: number; remaining: number[] };
        const next = createGeneratedMap(mode);
        const after = JSON.parse(saved)[mode] as { layout: number; remaining: number[] };
        assert.notEqual(next.generated!.layout, previous.generated!.layout);
        if (before.remaining.length) {
          assert.equal(after.layout, before.remaining[0]);
          assert.deepEqual(after.remaining, before.remaining.slice(1));
        } else assert.equal(new Set([after.layout, ...after.remaining]).size, 4);
        previous = next;
      }
    }
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('generation certifies compact bounds for boundary seeds and 4096 distributed 32-bit seeds', () => {
  const random = seededRandom(0xC0FFEE);
  const seeds = [0, 1, 0x7FFFFFFF, 0x80000000, 0xFFFFFFFF, ...Array.from({ length: 4096 }, () => Math.floor(random() * 4294967296))];
  for (const seed of seeds) for (const mode of ['quick-match', 'chaos-mode'] as const) {
    const map = generateMap(mode, seed);
    assert.ok(Math.max(map.width, map.height) <= 6800 && map.width * map.height <= 36_000_000, `${mode}, seed ${seed} exceeds compact bounds`);
  }
});

test('real fleets capture an affordable opening world on stationary and moving generated maps', () => {
  for (const mode of ['quick-match', 'chaos-mode'] as const) for (let seed = 0; seed < 5; seed++) {
    const map = generateMap(mode, seed);
    const engine = createMatch(map, { hardMode: seed % 2 === 0 });
    engine.lastAITime = engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
    const capital = [...engine.bases.values()].find(base => base.isCapital && base.color === FACTIONS[0])!;
    const target = [...engine.bases.values()].filter(base => base.color === NEUTRAL && base.pixelCount <= 18 && distance(base, capital) <= 600)
      .sort((a, b) => distance(a, capital) - distance(b, capital))[0];
    assert.ok(target);
    engine.pixels = engine.pixels.filter(ship => ship.baseId === capital.id || ship.baseId === target.id);
    assert.equal(issueFleetOrder(engine, capital.id, target.id, 0.5), true);
    for (let step = 0; step < 2400 && target.color !== FACTIONS[0]; step++) engine.update(1 / 60);
    assert.equal(target.color, FACTIONS[0], `${mode}, seed ${seed}`);
    for (const weapon of target.superweaponUnlocks ?? []) assert.ok(engine.getSuperweaponSourceCount(FACTIONS[0], weapon) > 0);
    for (const view of [{ width: 1280, height: 720, top: 110, bottom: 125 }, { width: 390, height: 844, top: 90, bottom: 220 }]) {
      const frame = openingFrame(view, map, capital, [...engine.bases.values()]);
      assert.equal(frame.focusX, capital.x); assert.equal(frame.focusY, capital.y);
      assert.ok(Number.isFinite(frame.zoom) && frame.zoom > 0);
    }
  }
});

test('the geometry certificate rejects missing orbit membership, missing weapons and overlapping systems', () => {
  const map = generateMap('chaos-mode', 101);
  const missingOrbit = structuredClone(map);
  missingOrbit.orbits![0].planetIds.pop();
  assert.throws(() => validateChaosGeometry(missingOrbit), /Every Chaos world/);
  const missingWeapons = structuredClone(map);
  missingWeapons.planets[0].superweaponUnlocks = [];
  assert.throws(() => validateChaosGeometry(missingWeapons), /one or two weapons/);
  const overlapping = structuredClone(map);
  const from = overlapping.orbits![1], to = overlapping.orbits![0];
  overlapping.planets.filter(planet => from.planetIds.includes(planet.id)).forEach(planet => {
    planet.x += to.x - from.x; planet.y += to.y - from.y;
  });
  from.x = to.x; from.y = to.y;
  assert.throws(() => validateChaosGeometry(overlapping), /overlap/);
  const wrongSpeed = structuredClone(map);
  wrongSpeed.orbits![0].periodSeconds += 1;
  assert.throws(() => validateChaosGeometry(wrongSpeed), /orbital speed/);
  const wrongRecipe = structuredClone(map);
  wrongRecipe.generated!.systems![0].planetIds.pop();
  assert.throws(() => validateChaosGeometry(wrongRecipe), /recipe membership/);
  const crowded = structuredClone(map);
  const orbit = crowded.orbits![0];
  const a = crowded.planets.find(planet => planet.id === orbit.planetIds[0])!;
  const b = crowded.planets.find(planet => planet.id === orbit.planetIds[1])!;
  b.x = a.x + 100; b.y = a.y;
  assert.throws(() => validateChaosGeometry(crowded));
});

test('continuous-phase certificate rejects a bridge that connects initially but closes later', () => {
  const map: MapDefinition = {
    id: 'unsafe-orbit-bridge', title: 'Unsafe', briefing: '', width: 6000, height: 4000, attackRange: 600,
    objective: { type: 'eliminate-capitals', description: '' }, planets: [], orbits: [],
  };
  for (let system = 0; system < 2; system++) {
    const orbit = { x: 1400 + system * 2300, y: 2000, periodSeconds: 300, planetIds: [] as string[] };
    for (let ring = 0; ring < 2; ring++) for (let index = 0; index < (ring ? 4 : 10); index++) {
      const theta = index * Math.PI * 2 / (ring ? 4 : 10), radius = ring ? 380 : 900, capital = ring === 1 && index === 0;
      const planet: PlanetDefinition = { id: `${system}-${ring}-${index}`, x: orbit.x + radius * Math.cos(theta), y: orbit.y + radius * Math.sin(theta), ships: 20, owner: capital ? FACTIONS[system] : NEUTRAL, superweaponUnlocks: ['omni'], ...(capital ? { capital: true } : {}) };
      map.planets.push(planet); orbit.planetIds.push(planet.id);
    }
    map.orbits!.push(orbit);
  }
  assert.doesNotThrow(() => validateMap(map));
  assert.throws(() => validateChaosGeometry(map), /lose their connections/);
  const orbit = map.orbits![0], angle = Math.PI / 10;
  for (const planet of map.planets.filter(planet => orbit.planetIds.includes(planet.id))) {
    const x = planet.x - orbit.x, y = planet.y - orbit.y;
    planet.x = orbit.x + x * Math.cos(angle) - y * Math.sin(angle);
    planet.y = orbit.y + x * Math.sin(angle) + y * Math.cos(angle);
  }
  assert.equal(mapConnected(map.planets), false);
});
