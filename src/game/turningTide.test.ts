import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DYSON_SPHERE_ID, TURNING_TIDE, PLAYER, NEUTRAL, validateMap, getOutcome } from './campaign';
import { createMatch } from './mapLoader';

function quietMap() {
  const engine = createMatch(TURNING_TIDE);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  engine.pixels = [];
  return engine;
}

test('Turning Tide loads its authored planets, central Dyson sphere, orbit members, and three factions', () => {
  validateMap(TURNING_TIDE);
  const engine = createMatch(TURNING_TIDE);
  assert.equal(engine.bases.size, 25);
  const sphere = engine.bases.get(DYSON_SPHERE_ID)!;
  assert.deepEqual([sphere.x, sphere.y, sphere.color, sphere.pixelCount, sphere.isDysonSphere], [1300, 1300, NEUTRAL, 75, true]);
  assert.equal(TURNING_TIDE.orbit!.planetIds.length, 12);
  assert.equal([...engine.bases.values()].filter(p => p.isCapital).length, 3);
  assert.equal(getOutcome(engine.bases.values()), null);
  for (const p of TURNING_TIDE.planets) {
    const b = engine.bases.get(p.id)!;
    assert.deepEqual([b.x, b.y, b.color, b.pixelCount], [p.x, p.y, p.owner, p.ships]);
  }
});

test('opening gives three affordable expansion choices without an immediate enemy attack', () => {
  const home = TURNING_TIDE.planets.find(p => p.id === 'tide-home')!;
  const reachable = TURNING_TIDE.planets.filter(p => p.id !== home.id && Math.hypot(p.x - home.x, p.y - home.y) <= TURNING_TIDE.attackRange);
  assert.equal(reachable.length, 3);
  assert.ok(reachable.every(p => p.owner === NEUTRAL && p.ships <= 12));
  assert.ok(reachable.reduce((sum, p) => sum + p.ships, 0) < home.ships / 4);
});

test('full rotation preserves clear spacing, fixed fortresses, and map connectivity', () => {
  const engine = quietMap();
  const orbitIds = new Set(TURNING_TIDE.orbit!.planetIds);
  for (let second = 0; second <= 180; second++) {
    const bases = [...engine.bases.values()];
    for (const p of bases) {
      if (p.isDysonSphere) {
        assert.deepEqual([p.x, p.y], [TURNING_TIDE.orbit!.x, TURNING_TIDE.orbit!.y]);
        continue;
      }
      if (!orbitIds.has(p.id)) {
        const original = TURNING_TIDE.planets.find(q => q.id === p.id)!;
        assert.equal(p.x, original.x); assert.equal(p.y, original.y);
      }
      for (const q of bases) if (p.id !== q.id) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > 250, `Crowded planets at ${second}s: ${p.id}/${q.id}`);
    }
    const reached = new Set(['tide-home']);
    for (let pass = 0; pass < bases.length; pass++) {
      for (const p of bases) if (bases.some(q => reached.has(q.id) && Math.hypot(p.x - q.x, p.y - q.y) <= engine.MAX_ATTACK_RANGE)) reached.add(p.id);
    }
    assert.equal(reached.size, bases.length, `Disconnected map at ${second}s`);
    engine.update(1);
  }
});

test('Dyson sphere grants configurable bonus energy, makes no ships, and five worlds unlock Omni Strike', () => {
  const engine = quietMap();
  const sphere = engine.bases.get(DYSON_SPHERE_ID)!;
  sphere.color = PLAYER;
  engine.setEnergy(PLAYER, 0);
  engine.lastSpawnTime = 0;
  const sphereShips = () => engine.pixels.filter(ship => ship.baseId === DYSON_SPHERE_ID).length;
  engine.update(1);
  assert.equal(engine.getEnergy(PLAYER), 1.4);
  assert.equal(sphereShips(), 0);

  for (const base of [...engine.bases.values()].filter(base => !base.isDysonSphere).slice(0, 5)) base.color = PLAYER;
  engine.update(1 / 60);
  assert.equal(engine.isSuperweaponUnlocked(PLAYER, 'omni'), true);
});

test('a boarding world leaves home range and opens an attack on the red command', () => {
  const engine = quietMap();
  const inRange = (a: string, b: string) => {
    const from = engine.bases.get(a)!, to = engine.bases.get(b)!;
    return Math.hypot(from.x - to.x, from.y - to.y) <= engine.MAX_ATTACK_RANGE;
  };
  assert.equal(inRange('tide-home', 'tide-boarding'), true);
  assert.equal(inRange('red-command', 'tide-boarding'), false);
  engine.update(75);
  assert.equal(inRange('tide-home', 'tide-boarding'), false);
  assert.equal(inRange('red-command', 'tide-boarding'), true);
});

test('both enemy capitals must fall; losing the player capital still loses the mission', () => {
  const engine = quietMap();
  engine.bases.get('red-command')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), null);
  engine.bases.get('green-command')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'victory');
  engine.bases.get('tide-home')!.isCapital = false;
  assert.equal(getOutcome(engine.bases.values()), 'defeat');
  assert.equal(TURNING_TIDE.planets.find(p => p.id === 'tide-home')!.owner, PLAYER);
});
