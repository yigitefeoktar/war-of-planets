import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREACH_LINE, NEUTRAL, PLAYER, validateMap } from './campaign';
import { createMatch } from './mapLoader';

const byId = (id: string) => BREACH_LINE.planets.find(planet => planet.id === id)!;
const inRange = (from: string, to: string) => Math.hypot(byId(from).x - byId(to).x, byId(from).y - byId(to).y) <= BREACH_LINE.attackRange;

test('Breach Line has three affordable openings and connected routes to the red capital', () => {
  validateMap(BREACH_LINE);
  assert.deepEqual([BREACH_LINE.width, BREACH_LINE.height, BREACH_LINE.planets.length], [2400, 2400, 20]);
  assert.deepEqual(BREACH_LINE.planets.filter(planet => planet.capital).map(planet => planet.id), ['breach-home', 'breach-red-capital']);
  const opening = BREACH_LINE.planets.filter(planet => planet.id !== 'breach-home' && inRange('breach-home', planet.id));
  assert.deepEqual(opening.map(planet => planet.id), ['breach-supply', 'breach-west-harbour', 'breach-east-harbour']);
  assert.ok(opening.every(planet => planet.owner === NEUTRAL && planet.ships <= 14));
  for (const route of [
    ['breach-home', 'breach-supply', 'breach-overdrive', 'breach-gate', 'breach-north-gate', 'breach-red-capital'],
    ['breach-home', 'breach-west-harbour', 'breach-west-relay', 'breach-west-bastion', 'breach-west-approach', 'breach-northwest-signal', 'breach-red-capital'],
    ['breach-home', 'breach-east-harbour', 'breach-east-relay', 'breach-east-bastion', 'breach-east-approach', 'breach-northeast-signal', 'breach-red-capital'],
  ]) for (let index = 1; index < route.length; index++) {
    assert.ok(inRange(route[index - 1], route[index]), `${route[index - 1]} cannot reach ${route[index]}`);
  }
  assert.equal(inRange('breach-home', 'breach-overdrive'), false);
  assert.equal(inRange('breach-overdrive', 'breach-red-capital'), false);
  for (const first of BREACH_LINE.planets) for (const second of BREACH_LINE.planets) {
    if (first.id !== second.id) assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= 250, `${first.id} overlaps ${second.id}`);
  }
});

test('holding the authored Overdrive site generates a charge that can be used', () => {
  const engine = createMatch(BREACH_LINE);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  const site = engine.bases.get('breach-overdrive')!;
  assert.deepEqual(site.superweaponUnlocks, ['overdrive']);
  assert.equal(engine.superweaponUnlocksEnabled, true);
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'overdrive'), 0);
  site.color = PLAYER;
  engine.update(59);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 0);
  engine.update(1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 1);
  assert.equal(engine.activatePlanetAbility(PLAYER, 'breach-home', 'overdrive'), true);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 0);
  site.color = '#ef4444';
  engine.update(60);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 0);
});

test('all three marked worlds produce only Overdrive and duplicate sites charge faster', () => {
  const sites = BREACH_LINE.planets.filter(planet => planet.superweaponUnlocks?.length);
  assert.deepEqual(sites.map(planet => planet.id), ['breach-overdrive', 'breach-west-bastion', 'breach-east-bastion']);
  assert.ok(sites.every(planet => planet.owner === NEUTRAL && planet.superweaponUnlocks?.join() === 'overdrive'));

  const engine = createMatch(BREACH_LINE);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  engine.bases.get(sites[0].id)!.color = PLAYER;
  engine.bases.get(sites[1].id)!.color = PLAYER;
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'overdrive'), 2);
  assert.deepEqual([...engine.getOwnedSuperweapons(PLAYER)], ['overdrive']);
  engine.update(29);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 0);
  engine.update(1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 1);
  assert.equal(engine.activatePlanetAbility(PLAYER, 'breach-home', 'overdrive'), true);

  engine.bases.get(sites[2].id)!.color = PLAYER;
  engine.update(19);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 0);
  engine.update(1);
  assert.equal(engine.getSuperweaponCharge(PLAYER, 'overdrive'), 1);
});

test('authored weapon lists reject duplicates and unknown abilities', () => {
  for (const superweaponUnlocks of [['overdrive', 'overdrive'], ['unknown']]) {
    const planets = BREACH_LINE.planets.map(planet => planet.id === 'breach-overdrive'
      ? { ...planet, superweaponUnlocks: superweaponUnlocks as typeof planet.superweaponUnlocks }
      : planet);
    assert.throws(() => validateMap({ ...BREACH_LINE, planets }));
  }
});
