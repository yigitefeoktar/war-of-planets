import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAOS_LAYOUTS, QUICK_LAYOUTS, createGeneratedMap, generateMap, mapConnected, seededRandom, validateChaosGeometry } from './generatedMaps';
import { FACTIONS, NEUTRAL, validateMap, type MapDefinition, type PlanetDefinition } from './campaign';
import { createMatch } from './mapLoader';
import { OrbitingGameEngine } from './orbitingEngine';
import { issueFleetOrder } from './logistics';
import { openingFrame } from './camera';

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

test('1000 Quick seeds give fair openings, equal weapon costs, safe spacing and multiple routes', t => {
  const fingerprints = new Set<string>(), counts = new Set<number>(), graphs = new Set<string>();
  const started = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap('quick-match', seed);
    assert.doesNotThrow(() => validateMap(map));
    assert.ok(!map.orbit && !map.orbits);
    assert.ok(map.planets.length >= 37 && map.planets.length <= 81);
    assert.equal(map.generated?.mode, 'quick-match');
    const capitals = map.planets.filter(planet => planet.capital);
    assert.deepEqual(capitals.map(planet => planet.owner).sort(), [...FACTIONS].sort());
    const costs = capitals.map(capital => {
      assert.equal(capital.ships, 200);
      const neighbors = map.planets.filter(planet => planet !== capital && distance(planet, capital) <= 600);
      assert.equal(neighbors.length, 3);
      assert.ok(neighbors.every(planet => planet.owner === NEUTRAL && planet.ships <= 18 && !planet.superweaponUnlocks));
      return captureCosts(capital, map.planets);
    });
    costs.forEach(cost => assert.deepEqual(cost, costs[0]));
    assert.ok(costs[0].every(cost => Number.isFinite(cost) && cost > 18));
    for (let index = 0; index < map.planets.length; index++) {
      const planet = map.planets[index];
      assert.ok(map.planets.filter(other => other !== planet && distance(planet, other) <= 600).length >= 2);
      for (const other of map.planets.slice(index + 1)) assert.ok(distance(planet, other) > 300);
    }
    for (const removed of map.planets.filter(planet => !planet.capital)) assert.ok(mapConnected(map.planets.filter(planet => planet !== removed)));
    fingerprints.add(fingerprint(map)); counts.add(map.planets.length);
    graphs.add(JSON.stringify(map.planets.map(planet => map.planets.filter(other => other !== planet && distance(planet, other) <= 600).length).sort((a, b) => a - b)));
  }
  assert.equal(fingerprints.size, 1000);
  assert.ok(counts.size >= 8);
  assert.ok(graphs.size >= 80, `Only ${graphs.size} different connection patterns`);
  t.diagnostic(`1000 Quick maps: ${Math.round(performance.now() - started)}ms; ${counts.size} planet counts, ${graphs.size} connection patterns.`);
});

test('1000 Chaos seeds have weapons on every world and certified non-overlapping orbit networks', t => {
  const fingerprints = new Set<string>(), starCounts = new Set<number>(), planetCounts = new Set<number>();
  const started = performance.now();
  for (let seed = 0; seed < 1000; seed++) {
    const map = generateMap('chaos-mode', seed);
    assert.doesNotThrow(() => validateMap(map));
    assert.doesNotThrow(() => validateChaosGeometry(map));
    assert.ok(map.planets.length >= 64 && map.planets.length <= 198);
    assert.equal(new Set(map.orbits!.flatMap(orbit => orbit.planetIds)).size, map.planets.length);
    const capitals = map.planets.filter(planet => planet.capital);
    assert.deepEqual(capitals.map(planet => planet.owner).sort(), [...FACTIONS].sort());
    assert.ok(capitals.every(planet => planet.ships === 200));
    capitals.forEach(capital => {
      assert.deepEqual(capital.superweaponUnlocks, capitals[0].superweaponUnlocks);
      assert.ok(map.planets.filter(planet => planet !== capital && planet.ships <= 16 && distance(planet, capital) <= 600).length >= 3);
      assert.ok(capitals.filter(other => other !== capital).every(other => distance(other, capital) > 1200));
    });
    for (const planet of map.planets) {
      assert.ok(planet.superweaponUnlocks!.length >= 1 && planet.superweaponUnlocks!.length <= 2);
      assert.equal(new Set(planet.superweaponUnlocks).size, planet.superweaponUnlocks!.length);
    }
    for (const orbit of map.orbits!) {
      const members = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
      assert.ok(orbit.periodSeconds >= 160 && orbit.periodSeconds <= 320);
      assert.equal(orbit.dysonSphere, undefined);
      for (let index = 0; index < members.length; index++) {
        const planet = members[index], radius = distance(planet, orbit);
        assert.ok(radius >= 200);
        assert.ok(radius + 80 <= Math.min(orbit.x, orbit.y, map.width - orbit.x, map.height - orbit.y));
        for (const other of members.slice(index + 1)) assert.ok(distance(planet, other) > 150);
      }
    }
    fingerprints.add(fingerprint(map)); starCounts.add(map.orbits!.length); planetCounts.add(map.planets.length);
  }
  assert.equal(fingerprints.size, 1000);
  assert.deepEqual([...starCounts].sort((a, b) => a - b), [4, 5, 6, 8, 9]);
  assert.ok(planetCounts.size > 60);
  t.diagnostic(`1000 Chaos maps: ${Math.round(performance.now() - started)}ms; ${planetCounts.size} planet counts, all five star layouts.`);
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
      assert.ok(mapConnected(planets), `Seed ${seed}, phase ${sample}`);
      assert.ok(mapConnected(planets.filter(planet => !planet.capital || planet.owner === FACTIONS[0])), `Elimination strands seed ${seed}, phase ${sample}`);
    }
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
    assert.equal(again instanceof OrbitingGameEngine, mode === 'chaos-mode');
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
    for (const ship of engine.pixels) ship.speed = 2;
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
});
