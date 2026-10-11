import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_BATTLEFIELD, createClassicBattlefield } from './classicMap';
import { DYSON_SPHERE_ID, PLAYER, validateMap, type MapDefinition, type PlanetDefinition } from './campaign';
import { openingFrame } from './camera';
import { createMatch } from './mapLoader';
import { OrbitingGameEngine } from './orbitingEngine';

const capitalPositions = (map: MapDefinition) => map.planets.filter(planet => planet.capital).map(planet => [planet.x, planet.y]);
const neutralPlanets = (map: MapDefinition) => map.planets.filter(planet => !planet.capital);
const slots = capitalPositions(CLASSIC_BATTLEFIELD);

const inRange = (a: PlanetDefinition, b: PlanetDefinition) => Math.hypot(a.x - b.x, a.y - b.y) <= CLASSIC_BATTLEFIELD.attackRange;

function distances(start: PlanetDefinition, planets: PlanetDefinition[], captureCost = false) {
  const remaining = new Set(planets);
  const result = new Map([[start.id, 0]]);
  while (remaining.size) {
    const next = [...remaining].filter(planet => result.has(planet.id))
      .sort((a, b) => result.get(a.id)! - result.get(b.id)!)[0];
    if (!next) break;
    remaining.delete(next);
    for (const neighbor of remaining) {
      if (!inRange(next, neighbor)) continue;
      const distance = result.get(next.id)! + (captureCost ? neighbor.ships : 1);
      if (distance < (result.get(neighbor.id) ?? Infinity)) result.set(neighbor.id, distance);
    }
  }
  return result;
}

test('all four starts have equal openings, weapon travel, capture costs and capital pressure', () => {
  const planets = CLASSIC_BATTLEFIELD.planets;
  assert.doesNotThrow(() => validateMap(CLASSIC_BATTLEFIELD));
  assert.equal(CLASSIC_BATTLEFIELD.orbit?.planetIds.length, 12);
  assert.equal(CLASSIC_BATTLEFIELD.orbits, undefined);
  const capitals = planets.filter(planet => planet.capital);
  const signatures = capitals.map(capital => {
    const opening = planets.filter(planet => planet !== capital && inRange(capital, planet));
    assert.equal(opening.length, 3);
    assert.ok(opening.every(planet => !planet.capital && planet.ships === 16 && !planet.superweaponUnlocks));
    const hops = distances(capital, planets);
    // Rival capitals cannot provide a shortcut to a weapon site.
    const costs = distances(capital, planets.filter(planet => !planet.capital || planet === capital), true);
    return {
      rivalHops: capitals.filter(planet => planet !== capital).map(planet => hops.get(planet.id)).sort(),
      weapons: (['overdrive', 'repulse', 'omni'] as const).map(weapon => {
        const sites = planets.filter(planet => planet.superweaponUnlocks?.includes(weapon));
        assert.equal(sites.length, 4);
        assert.ok(sites.every(planet => planet.superweaponUnlocks?.length === 1 && !planet.capital));
        return {
          hops: sites.map(planet => hops.get(planet.id)!).sort((a, b) => a - b),
          cheapestCapture: Math.min(...sites.map(planet => costs.get(planet.id)!)),
          nearestDistance: Math.min(...sites.map(planet => Math.hypot(capital.x - planet.x, capital.y - planet.y))),
        };
      }),
    };
  });
  signatures.forEach(signature => assert.deepEqual(signature, signatures[0]));
  assert.deepEqual(signatures[0].rivalHops, [5, 5, 7]);
  assert.deepEqual(signatures[0].weapons.map(weapon => weapon.hops[0]), [2, 3, 3]);
  assert.deepEqual(signatures[0].weapons.map(weapon => weapon.cheapestCapture), [44, 80, 89]);
});

test('outer routes connect all starts without weapons and no single neutral planet disconnects the map', () => {
  const planets = CLASSIC_BATTLEFIELD.planets;
  const outer = planets.filter(planet => !planet.superweaponUnlocks);
  assert.equal(distances(outer[0], outer).size, outer.length);
  for (const removed of neutralPlanets(CLASSIC_BATTLEFIELD)) {
    const remaining = planets.filter(planet => planet !== removed);
    assert.equal(distances(remaining[0], remaining).size, remaining.length, removed.id);
  }
});

test('the complete orbit preserves connected routes, equal access and clear space around the star', () => {
  const map = CLASSIC_BATTLEFIELD;
  const orbit = map.orbit!;
  const moving = map.planets.filter(planet => orbit.planetIds.includes(planet.id));
  const fixed = map.planets.filter(planet => !orbit.planetIds.includes(planet.id));
  assert.deepEqual(moving.map(planet => planet.id).sort(), map.planets.filter(planet => planet.superweaponUnlocks?.length).map(planet => planet.id).sort());
  assert.equal(moving.length, 12);
  assert.equal(fixed.length, 24);
  assert.equal(orbit.dysonSphere, undefined);
  for (const planet of moving) {
    const radius = Math.hypot(planet.x - orbit.x, planet.y - orbit.y);
    assert.ok(radius >= 200);
    assert.ok(radius + 50 < Math.min(orbit.x, orbit.y, map.width - orbit.x, map.height - orbit.y));
    for (const outer of fixed) {
      // Exact closest separation over a full revolution.
      assert.ok(Math.abs(Math.hypot(outer.x - orbit.x, outer.y - orbit.y) - radius) > 150);
    }
  }
  for (const [index, planet] of moving.entries()) {
    for (const other of moving.slice(index + 1)) assert.ok(Math.hypot(planet.x - other.x, planet.y - other.y) > 150);
  }

  const engine = createMatch();
  engine.lastAITime = engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  const opening = [...engine.bases.values()].filter(base => base.isCapital).map(base => ({ x: base.x, y: base.y }));
  for (let step = 0; step <= 720; step++) {
    const planets = map.planets.map(planet => {
      const actual = engine.bases.get(planet.id)!;
      return { ...planet, x: actual.x, y: actual.y };
    });
    assert.equal(distances(planets[0], planets).size, planets.length, `disconnected at step ${step}`);
    const capitals = planets.filter(planet => planet.capital);
    const costs = capitals.map(capital => {
      const neighbors = planets.filter(planet => planet !== capital && inRange(capital, planet));
      assert.equal(neighbors.length, 3);
      assert.ok(neighbors.every(planet => planet.ships === 16 && !planet.superweaponUnlocks));
      const reachable = distances(capital, planets.filter(planet => !planet.capital || planet === capital), true);
      return (['overdrive', 'repulse', 'omni'] as const).map(weapon =>
        Math.min(...planets.filter(planet => planet.superweaponUnlocks?.includes(weapon)).map(planet => reachable.get(planet.id)!)));
    });
    costs.forEach(cost => assert.deepEqual(cost, costs[0]));
    // Sample neutral removals every five degrees as the core turns.
    if (step % 10 === 0) for (const removed of planets.filter(planet => !planet.capital)) {
      const remaining = planets.filter(planet => planet !== removed);
      assert.equal(distances(remaining[0], remaining).size, remaining.length, `${removed.id} at step ${step}`);
    }
    if (step < 720) engine.update(orbit.periodSeconds / 720);
  }
  assert.deepEqual([...engine.bases.values()].filter(base => base.isCapital).map(base => ({ x: base.x, y: base.y })), opening);
});

test('both modes rotate all twelve central worlds clockwise in four minutes and reset on retry', () => {
  for (const hardMode of [false, true]) {
    const engine = createMatch(undefined, { hardMode });
    assert.ok(engine instanceof OrbitingGameEngine);
    assert.equal(engine.isHardMode, hardMode);
    assert.equal(engine.bases.has(DYSON_SPHERE_ID), false);
    engine.lastAITime = engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
    engine.pixels = [];
    const start = [...engine.bases.values()].map(base => ({ ...base }));
    engine.update(60);
    for (const planet of start) {
      const actual = engine.bases.get(planet.id)!;
      if (planet.superweaponUnlocks?.length) {
        assert.ok(Math.abs(actual.x - (3000 - planet.y)) < 1e-6);
        assert.ok(Math.abs(actual.y - planet.x) < 1e-6);
      } else assert.deepEqual([actual.x, actual.y], [planet.x, planet.y]);
      assert.deepEqual(actual.superweaponUnlocks, planet.superweaponUnlocks);
    }
    engine.update(180);
    for (const planet of start) {
      const actual = engine.bases.get(planet.id)!;
      assert.ok(Math.hypot(actual.x - planet.x, actual.y - planet.y) < 1e-6);
    }
    const retry = createMatch(undefined, { hardMode });
    for (const planet of neutralPlanets(CLASSIC_BATTLEFIELD)) {
      const actual = retry.bases.get(planet.id)!;
      assert.deepEqual([actual.x, actual.y], [planet.x, planet.y]);
    }
  }
});

function withStorage(storage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void }, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { run(); } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('every faction changes slots on each match without moving neutral planets or changing fleets', () => {
  const original = structuredClone(CLASSIC_BATTLEFIELD);
  let saved = JSON.stringify([0, 1, 2, 3]);
  withStorage({ getItem: () => saved, setItem: (_key, value) => { saved = value; } }, () => {
    let previous = slots;
    for (let index = 0; index < 30; index++) {
      const map = createClassicBattlefield(() => index / 30);
      assert.doesNotThrow(() => validateMap(map));
      assert.equal(map.planets.length, 36);
      assert.equal(map.planets.some(planet => planet.id === 'west-landing'), false);
      assert.deepEqual(neutralPlanets(map), neutralPlanets(original));
      const positions = capitalPositions(map);
      assert.deepEqual([...positions].sort(), [...slots].sort());
      positions.forEach((position, faction) => assert.notDeepEqual(position, previous[faction]));
      for (const planet of map.planets.filter(planet => planet.capital)) {
        assert.equal(planet.ships, planet.owner === PLAYER ? 200 : 90);
      }
      previous = positions;
    }
  });
  assert.deepEqual(CLASSIC_BATTLEFIELD, original);
});

test('persisted positions drive the next shuffle and unavailable or corrupt storage stays playable', () => {
  let saved = JSON.stringify([2, 3, 0, 1]);
  withStorage({ getItem: () => saved, setItem: (_key, value) => { saved = value; } }, () => {
    const map = createClassicBattlefield(() => 0);
    const positions = capitalPositions(map);
    const previous = [slots[2], slots[3], slots[0], slots[1]];
    positions.forEach((position, index) => assert.notDeepEqual(position, previous[index]));
    assert.deepEqual(JSON.parse(saved).map((slot: number) => slots[slot]), positions);
    for (const invalid of ['{', 'null', '[0,0,0,0]', '[0,1,2,4]', '[0,1,2]', '[0,1,2,"3"]']) {
      saved = invalid;
      assert.doesNotThrow(() => validateMap(createClassicBattlefield(() => 0.5)));
    }
  });
  withStorage({ getItem: () => { throw new Error('Blocked storage'); }, setItem: () => { throw new Error('Blocked storage'); } }, () => {
    const first = capitalPositions(createClassicBattlefield(() => 0));
    const next = capitalPositions(createClassicBattlefield(() => 0));
    next.forEach((position, index) => assert.notDeepEqual(position, first[index]));
  });
});

test('the opening camera follows blue at every shuffled capital slot on desktop and phone', () => {
  for (const position of slots) {
    for (const view of [
      { width: 1280, height: 720, top: 110, bottom: 125 },
      { width: 390, height: 844, top: 90, bottom: 220 },
    ]) {
      const frame = openingFrame(view, undefined, { x: position[0], y: position[1] }, CLASSIC_BATTLEFIELD.planets);
      assert.deepEqual([frame.focusX, frame.focusY], position);
      assert.ok(Number.isFinite(frame.zoom) && frame.zoom > 0);
    }
  }
});
