import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, DYSON_SPHERE_ID, FACTIONS, NEUTRAL, PLAYER, SIEGE_OF_HELIOS, getOutcome, validateMap } from './campaign';
import { createMatch } from './mapLoader';

const byId = (id: string) => SIEGE_OF_HELIOS.planets.find(planet => planet.id === id)!;
const distance = (from: string, to: string) => Math.hypot(byId(from).x - byId(to).x, byId(from).y - byId(to).y);

test('Helios Counteroffensive has a larger three-route battlefield with a manageable opening', () => {
  validateMap(SIEGE_OF_HELIOS);
  assert.deepEqual([SIEGE_OF_HELIOS.width, SIEGE_OF_HELIOS.height, SIEGE_OF_HELIOS.planets.length], [3800, 3400, 38]);
  assert.deepEqual([PLAYER, '#ef4444', NEUTRAL].map(owner => SIEGE_OF_HELIOS.planets.filter(planet => planet.owner === owner).length), [5, 7, 26]);
  assert.deepEqual([PLAYER, '#ef4444'].map(owner => SIEGE_OF_HELIOS.planets.filter(planet => planet.owner === owner)
    .reduce((total, planet) => total + planet.ships, 0)), [580, 630]);
  assert.deepEqual(SIEGE_OF_HELIOS.planets.filter(planet => planet.capital).map(planet => planet.id),
    ['siege-home', 'siege-west-capital', 'siege-east-capital']);
  assert.deepEqual(['siege-home', 'siege-west-relay', 'siege-east-relay', 'siege-west-harbor', 'siege-east-harbor']
    .map(id => byId(id).superweaponUnlocks), [['repulse'], ['repulse'], ['repulse'], ['overdrive'], ['overdrive']]);
  assert.ok(SIEGE_OF_HELIOS.planets.filter(planet => planet.owner === '#ef4444')
    .every(planet => distance('siege-home', planet.id) > SIEGE_OF_HELIOS.attackRange));
  for (const side of ['west', 'east']) {
    assert.ok(distance(`siege-${side}-spear`, `siege-${side}-harbor`) <= SIEGE_OF_HELIOS.attackRange);
    assert.equal(byId(`siege-${side}-landing`).ships, 12);
    assert.ok(distance(`siege-${side}-relay`, `siege-${side}-landing`) <= SIEGE_OF_HELIOS.attackRange);
  }
  assert.equal(byId('siege-center-entry').ships, 16);
  assert.deepEqual(byId('siege-center-entry').superweaponUnlocks, ['omni']);
  assert.ok(distance('siege-west-relay', 'siege-center-entry') <= SIEGE_OF_HELIOS.attackRange);
  assert.equal(SIEGE_OF_HELIOS.orbit?.planetIds.length, 4);
  assert.equal(SIEGE_OF_HELIOS.orbit?.dysonSphere?.chargeIntervalSeconds, 30);
  assert.ok(distance('siege-center-entry', 'siege-orbit-south') <= SIEGE_OF_HELIOS.attackRange);
  assert.ok(Math.hypot(byId('siege-orbit-south').x - SIEGE_OF_HELIOS.orbit!.x,
    byId('siege-orbit-south').y - SIEGE_OF_HELIOS.orbit!.y) <= SIEGE_OF_HELIOS.attackRange);
  for (const route of [
    ['siege-west-relay', 'siege-west-landing', 'siege-west-crosslink', 'siege-west-shield',
      'siege-west-outpost', 'siege-west-omni', 'siege-northwest-pass', 'siege-west-capital'],
    ['siege-east-relay', 'siege-east-landing', 'siege-east-crosslink', 'siege-east-forge',
      'siege-east-outpost', 'siege-east-shield', 'siege-northeast-pass', 'siege-east-capital'],
    ['siege-west-relay', 'siege-center-entry', 'siege-orbit-south', 'siege-orbit-west',
      'siege-orbit-north', 'siege-north-bridge', 'siege-command', 'siege-west-north-bridge',
      'siege-west-guard', 'siege-west-capital'],
  ]) {
    for (let index = 1; index < route.length; index++) {
      assert.ok(distance(route[index - 1], route[index]) <= SIEGE_OF_HELIOS.attackRange,
        `${route[index - 1]} cannot reach ${route[index]}`);
    }
  }
  for (const first of SIEGE_OF_HELIOS.planets) for (const second of SIEGE_OF_HELIOS.planets) {
    if (first.id !== second.id) assert.ok(distance(first.id, second.id) >= 250, `${first.id} overlaps ${second.id}`);
  }
});

test('all four faction colors appear during Chapter 1', () => {
  const owners = new Set(CHAPTERS['chapter-1'].maps.flatMap(map => map.planets.map(planet => planet.owner)));
  assert.ok(FACTIONS.every(color => owners.has(color)));
});

test('the short orbit keeps clear of fixed worlds throughout a full revolution', () => {
  const engine = createMatch(SIEGE_OF_HELIOS);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  const orbitIds = new Set(SIEGE_OF_HELIOS.orbit!.planetIds);
  const fixed = [...engine.bases.values()].filter(base => !orbitIds.has(base.id) && !base.isDysonSphere);
  for (let step = 0; step < 72; step++) {
    for (const id of orbitIds) for (const base of fixed) {
      const moving = engine.bases.get(id)!;
      assert.ok(Math.hypot(moving.x - base.x, moving.y - base.y) >= 250,
        `${id} overlaps ${base.id} at orbit step ${step}`);
    }
    engine.update(SIEGE_OF_HELIOS.orbit!.periodSeconds / 72);
  }
});

test('holding the Dyson Sphere generates a charge usable for any weapon', () => {
  const engine = createMatch(SIEGE_OF_HELIOS);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  const sphere = engine.bases.get(DYSON_SPHERE_ID)!;
  assert.equal(sphere.color, NEUTRAL);
  assert.equal(sphere.isDysonSphere, true);
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'repulse'), 3);
  assert.equal(engine.getSuperweaponSourceCount(PLAYER, 'overdrive'), 2);
  assert.equal(engine.getSuperweaponSourceCount('#ef4444', 'repulse'), 2);
  assert.equal(engine.getSuperweaponSourceCount('#ef4444', 'overdrive'), 1);
  assert.equal(engine.getUniversalCharge(PLAYER), 0);
  sphere.color = PLAYER;
  assert.deepEqual([...engine.getOwnedSuperweapons(PLAYER)].sort(), ['omni', 'overdrive', 'repulse']);
  engine.update(29);
  assert.equal(engine.getUniversalCharge(PLAYER), 0);
  engine.update(1);
  assert.equal(engine.getUniversalCharge(PLAYER), 1);
});

test('both red capitals must fall while the blue capital survives', () => {
  const engine = createMatch(SIEGE_OF_HELIOS);
  assert.equal(getOutcome(engine.bases.values()), null);
  engine.bases.get('siege-west-capital')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), null);
  engine.bases.get('siege-east-capital')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'victory');
  engine.bases.get('siege-home')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'defeat');
});
