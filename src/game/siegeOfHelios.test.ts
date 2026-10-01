import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, DYSON_SPHERE_ID, FACTIONS, NEUTRAL, PLAYER, SIEGE_OF_HELIOS, TURNING_TIDE, getOutcome, mapOrbits, validateMap } from './campaign';
import { createMatch } from './mapLoader';

const map = SIEGE_OF_HELIOS;
const orbits = mapOrbits(map);
const orbitIds = new Set(orbits.flatMap(orbit => orbit.planetIds));
const fixed = map.planets.filter(planet => !orbitIds.has(planet.id));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function connected(planets: { id: string; x: number; y: number }[]) {
  const reached = new Set([planets[0].id]);
  const queue = [planets[0]];
  for (let index = 0; index < queue.length; index++) {
    for (const planet of planets) {
      if (!reached.has(planet.id) && distance(queue[index], planet) <= map.attackRange) {
        reached.add(planet.id); queue.push(planet);
      }
    }
  }
  return reached.size === planets.length;
}

function quietEngine() {
  const engine = createMatch(map);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  return engine;
}

test('the finale has five normal stars, Level 3 sized systems, and one orbiting capital per faction', () => {
  validateMap(map);
  assert.deepEqual([map.width, map.height, map.planets.length, orbits.length], [5600, 5600, 108, 5]);
  assert.ok(orbits.every(orbit => !orbit.dysonSphere && orbit.planetIds.length === TURNING_TIDE.orbit!.planetIds.length));
  assert.ok(orbits.some(orbit => orbit.x === map.width / 2 && orbit.y === map.height / 2));
  assert.deepEqual(orbits.slice(0, 4).map(orbit => [orbit.x, orbit.y]).sort(),
    [[1200, 1200], [1200, 4400], [4400, 1200], [4400, 4400]]);
  for (const owner of FACTIONS) {
    const owned = map.planets.filter(planet => planet.owner === owner);
    assert.equal(owned.length, 1);
    assert.equal(owned[0].capital, true);
    assert.ok(orbits.slice(0, 4).some(orbit => orbit.planetIds.includes(owned[0].id)));
    const nearby = map.planets.filter(planet => planet.owner === NEUTRAL && distance(planet, owned[0]) <= map.attackRange);
    assert.ok(nearby.filter(planet => planet.ships <= 18).length >= 3);
    assert.ok(nearby.filter(planet => planet.ships === 12 && planet.superweaponUnlocks?.length).length >= 2);
  }
  assert.equal(map.planets.filter(planet => planet.owner === NEUTRAL).length, 104);
  const engine = createMatch(map);
  assert.equal(engine.bases.size, 108);
  assert.equal(engine.bases.has(DYSON_SPHERE_ID), false);
  assert.ok([...engine.bases.values()].every(base => !base.isDysonSphere));
});

test('the neutral core concentrates all three weapons on moving and fixed worlds', () => {
  const center = orbits[4];
  const coreWorlds = map.planets.filter(planet => distance(planet, center) <= 1000);
  assert.equal(coreWorlds.length, 28);
  assert.ok(coreWorlds.every(planet => planet.owner === NEUTRAL));
  assert.equal(coreWorlds.filter(planet => planet.superweaponUnlocks?.length).length, 20);
  assert.ok(center.planetIds.every(id => map.planets.find(planet => planet.id === id)!.superweaponUnlocks?.length));
  assert.deepEqual([...new Set(coreWorlds.flatMap(planet => planet.superweaponUnlocks ?? []))].sort(), ['omni', 'overdrive', 'repulse']);
  const engine = quietEngine();
  engine.pixels = [];
  assert.equal(engine.getOwnedSuperweapons(PLAYER).size, 0);
  for (const weapon of ['omni', 'overdrive', 'repulse'] as const) {
    const world = coreWorlds.find(planet => planet.superweaponUnlocks?.includes(weapon))!;
    engine.bases.get(world.id)!.color = PLAYER;
  }
  engine.update(60);
  for (const weapon of ['omni', 'overdrive', 'repulse'] as const) assert.equal(engine.getSuperweaponCharge(PLAYER, weapon), 1);
  assert.equal(engine.getUniversalCharge(PLAYER), 0);
});

test('ambiguous or shared orbit membership is rejected before loading', () => {
  assert.throws(() => validateMap({ ...map, orbit: orbits[0] }), /Use orbit or orbits/);
  assert.throws(() => validateMap({ ...map, orbits: [] }), /must not be empty/);
  assert.throws(() => validateMap({ ...map, orbits: [...orbits, orbits[0]] }), /multiple orbit systems/);
  assert.throws(() => validateMap({ ...map, orbits: orbits.map(orbit => ({ ...orbit, dysonSphere: { chargeIntervalSeconds: 30 } })) }), /Only one Dyson/);
});

test('fixed lanes remain connected without the moving planets and have no single bridge bottleneck', () => {
  assert.equal(fixed.length, 48);
  assert.ok(connected(fixed));
  for (const removed of fixed) assert.ok(connected(fixed.filter(planet => planet.id !== removed.id)), `${removed.id} is a bottleneck`);
  // Every home system has several entrances, each guaranteed to reach its outer
  // ring even at the worst 22.5-degree gap between its eight moving worlds.
  for (const orbit of orbits) {
    const entrances = fixed.filter(planet => {
      const radius = distance(planet, orbit);
      return Math.sqrt(radius ** 2 + 620 ** 2 - 2 * radius * 620 * Math.cos(Math.PI / 8)) <= map.attackRange;
    });
    assert.ok(entrances.length >= 3);
  }
});

test('all systems stay connected during their different rotation periods', () => {
  const engine = quietEngine();
  engine.pixels = [];
  // 720 seconds is the combined repeat period of the 180/240-second systems.
  for (let step = 0; step < 144; step++) {
    assert.ok(connected([...engine.bases.values()]), `Disconnected at ${step * 5} seconds`);
    engine.update(5);
  }
  for (const planet of map.planets) assert.ok(distance(engine.bases.get(planet.id)!, planet) < 1e-6);
});

test('complete swept orbits stay clear of stars, fixed worlds, other systems, and map edges', () => {
  for (const first of map.planets) for (const second of map.planets) {
    if (first.id !== second.id) assert.ok(distance(first, second) >= 250, `${first.id} overlaps ${second.id}`);
  }
  for (const orbit of orbits) for (const id of orbit.planetIds) {
    const planet = map.planets.find(candidate => candidate.id === id)!;
    const radius = distance(planet, orbit);
    assert.ok(radius >= 110);
    assert.ok(radius + 80 <= Math.min(orbit.x, orbit.y, map.width - orbit.x, map.height - orbit.y));
    for (const planet of fixed) assert.ok(Math.abs(distance(planet, orbit) - radius) >= 250);
    for (const other of orbits) {
      if (orbit === other) continue;
      assert.ok(distance(orbit, other) - radius >= 110);
      for (const otherId of other.planetIds) {
        const otherPlanet = map.planets.find(candidate => candidate.id === otherId)!;
        assert.ok(distance(orbit, other) - radius - distance(otherPlanet, other) >= 250);
      }
    }
  }
});

test('each system carries its own stationed fleets at its own speed and leaves fixed worlds still', () => {
  const engine = quietEngine();
  const ships = orbits.map(orbit => engine.pixels.find(ship => ship.baseId === orbit.planetIds[0])!);
  engine.pixels = ships;
  for (const ship of ships) { ship.speed = 0; ship.targetX += 10; ship.targetY += 20; }
  const before = ships.map(ship => ({ ...ship }));
  engine.update(60);
  for (const [index, orbit] of orbits.entries()) {
    const angle = Math.PI * 2 * 60 / orbit.periodSeconds;
    const rotate = (x: number, y: number) => ({
      x: orbit.x + (x - orbit.x) * Math.cos(angle) - (y - orbit.y) * Math.sin(angle),
      y: orbit.y + (x - orbit.x) * Math.sin(angle) + (y - orbit.y) * Math.cos(angle),
    });
    assert.ok(distance(ships[index], rotate(before[index].x, before[index].y)) < 1e-6);
    assert.ok(distance({ x: ships[index].targetX, y: ships[index].targetY }, rotate(before[index].targetX, before[index].targetY)) < 1e-6);
    const planet = map.planets.find(candidate => candidate.id === orbit.planetIds[0])!;
    assert.ok(distance(engine.bases.get(planet.id)!, rotate(planet.x, planet.y)) < 1e-6);
  }
  for (const planet of fixed) assert.equal(distance(engine.bases.get(planet.id)!, planet), 0);
});

test('the player can capture a cheap weapon world from the orbiting capital', () => {
  const engine = quietEngine();
  const home = map.planets.find(planet => planet.owner === PLAYER)!;
  const target = map.planets.find(planet => planet.ships === 12 && planet.superweaponUnlocks?.length && distance(planet, home) <= map.attackRange)!;
  engine.sendUnits(home.id, target.id, 0.5);
  for (let step = 0; step < 2400 && engine.bases.get(target.id)!.color !== PLAYER; step++) engine.update(1 / 60);
  assert.equal(engine.bases.get(target.id)!.color, PLAYER);
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, target.superweaponUnlocks![0]), 1);
  assert.equal(engine.bases.get(home.id)!.isCapital, true);
});

test('all three rival capitals must fall and losing blue still ends the run', () => {
  const engine = createMatch(map);
  assert.equal(getOutcome(engine.bases.values()), null);
  for (const [index, color] of FACTIONS.slice(1).entries()) {
    [...engine.bases.values()].find(base => base.isCapital && base.color === color)!.isCapital = false;
    assert.equal(getOutcome(engine.bases.values()), index < 2 ? null : 'victory');
  }
  engine.bases.get('helios-blue-capital')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'defeat');
  const owners = new Set(CHAPTERS['chapter-1'].maps.flatMap(map => map.planets.map(planet => planet.owner)));
  assert.ok(FACTIONS.every(color => owners.has(color)));
});
