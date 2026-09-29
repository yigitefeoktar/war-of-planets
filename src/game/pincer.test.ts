import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOutcome, NEUTRAL, PLAYER, THE_PINCER, validateMap } from './campaign';
import { createMatch } from './mapLoader';

const byId = (id: string) => THE_PINCER.planets.find(planet => planet.id === id)!;
const distance = (from: string, to: string) => Math.hypot(byId(from).x - byId(to).x, byId(from).y - byId(to).y);

test('The Pincer has a safe blue center, contested side shields, and routes to both capitals', () => {
  validateMap(THE_PINCER);
  assert.deepEqual([THE_PINCER.width, THE_PINCER.height, THE_PINCER.planets.length], [2800, 2600, 27]);
  assert.equal(THE_PINCER.orbit, undefined);
  assert.deepEqual(THE_PINCER.planets.filter(planet => planet.capital).map(planet => planet.id),
    ['pincer-home', 'pincer-red-capital', 'pincer-yellow-capital']);
  assert.deepEqual([PLAYER, '#ef4444', '#eab308', NEUTRAL].map(owner => THE_PINCER.planets.filter(planet => planet.owner === owner).length),
    [5, 4, 4, 14]);
  const startingShips = (owner: string) => THE_PINCER.planets.filter(planet => planet.owner === owner)
    .reduce((total, planet) => total + planet.ships, 0);
  assert.deepEqual([PLAYER, '#ef4444', '#eab308'].map(startingShips), [440, 300, 300]);
  assert.ok(THE_PINCER.planets.filter(planet => planet.owner === '#ef4444').every(planet => planet.x < byId('pincer-home').x));
  assert.ok(THE_PINCER.planets.filter(planet => planet.owner === '#eab308').every(planet => planet.x > byId('pincer-home').x));
  assert.ok(THE_PINCER.planets.filter(planet => planet.owner !== PLAYER && planet.owner !== NEUTRAL)
    .every(planet => distance('pincer-home', planet.id) > THE_PINCER.attackRange));
  for (const side of ['west', 'east']) {
    assert.equal(byId(`pincer-${side}-shield`).owner, NEUTRAL);
    assert.equal(byId(`pincer-${side}-shield`).ships, 12);
    assert.deepEqual(byId(`pincer-${side}-shield`).superweaponUnlocks, ['repulse']);
    assert.ok(distance(`pincer-${side}-relay`, `pincer-${side}-shield`) <= THE_PINCER.attackRange);
    assert.ok(distance('pincer-home', `pincer-${side}-shield`) > THE_PINCER.attackRange);
  }
  for (const route of [
    ['pincer-home', 'pincer-west-relay', 'pincer-west-shield', 'pincer-red-front', 'pincer-red-capital'],
    ['pincer-home', 'pincer-east-relay', 'pincer-east-shield', 'pincer-yellow-front', 'pincer-yellow-capital'],
    ['pincer-home', 'pincer-north-reserve', 'pincer-northwest-overdrive', 'pincer-red-north-wing', 'pincer-red-front', 'pincer-red-capital'],
    ['pincer-home', 'pincer-south-reserve', 'pincer-southeast-omni', 'pincer-yellow-south-wing', 'pincer-yellow-front', 'pincer-yellow-capital'],
  ]) for (let index = 1; index < route.length; index++) {
    assert.ok(distance(route[index - 1], route[index]) <= THE_PINCER.attackRange,
      `${route[index - 1]} cannot reach ${route[index]}`);
  }
  for (const first of THE_PINCER.planets) for (const second of THE_PINCER.planets) {
    if (first.id !== second.id) assert.ok(distance(first.id, second.id) >= 250, `${first.id} overlaps ${second.id}`);
  }
});

test('blue starts with five Repulse sources against one per enemy while outer routes retain earlier weapons', () => {
  const sites = THE_PINCER.planets.filter(planet => planet.superweaponUnlocks?.length);
  assert.deepEqual(['repulse', 'overdrive', 'omni'].map(weapon =>
    sites.filter(planet => planet.superweaponUnlocks?.includes(weapon as 'repulse' | 'overdrive' | 'omni')).length), [9, 2, 2]);
  assert.deepEqual(sites.filter(planet => planet.superweaponUnlocks?.includes('repulse')).map(planet => planet.id),
    ['pincer-home', 'pincer-north-reserve', 'pincer-south-reserve', 'pincer-west-relay', 'pincer-east-relay',
      'pincer-west-shield', 'pincer-east-shield', 'pincer-red-front', 'pincer-yellow-front']);
  const engine = createMatch(THE_PINCER);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'repulse'), 5);
  assert.equal(engine.getSuperweaponSourceCount('#ef4444', 'repulse'), 1);
  assert.equal(engine.getSuperweaponSourceCount('#eab308', 'repulse'), 1);
  engine.update(11);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 0);
  engine.update(1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 1);
  assert.equal(engine.activatePlanetAbility(PLAYER, 'pincer-home', 'repulse'), true);
  engine.bases.get('pincer-west-shield')!.color = PLAYER;
  engine.bases.get('pincer-east-shield')!.color = PLAYER;
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'repulse'), 7);
  engine.update(8);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 0);
  engine.update(1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'repulse'), 1);
});

test('both enemy capitals must fall and the blue capital must survive', () => {
  const engine = createMatch(THE_PINCER);
  assert.equal(getOutcome(engine.bases.values()), null);
  engine.bases.get('pincer-red-capital')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), null);
  engine.bases.get('pincer-yellow-capital')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'victory');
  engine.bases.get('pincer-home')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'defeat');
});
