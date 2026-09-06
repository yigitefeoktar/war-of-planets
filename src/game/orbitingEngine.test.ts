import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_STRIKE, NEUTRAL, PLAYER, getOutcome, validateMap, type MapDefinition } from './campaign';
import { createMatch } from './mapLoader';
import { OrbitingGameEngine } from './orbitingEngine';

function quietEngine(map?: MapDefinition) {
  const engine = createMatch(map);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  return engine;
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('all orbiting planets rotate at the same rate and preserve every pair distance', () => {
  const engine = quietEngine(FIRST_STRIKE);
  assert.ok(engine instanceof OrbitingGameEngine);
  engine.pixels = [];
  engine.update(45); // One quarter of a 180-second clockwise orbit.
  for (const p of FIRST_STRIKE.planets) {
    const actual = engine.bases.get(p.id)!;
    near(actual.x, 800 - (p.y - 700));
    near(actual.y, 700 + (p.x - 800));
    for (const q of FIRST_STRIKE.planets) {
      const other = engine.bases.get(q.id)!;
      near(Math.hypot(actual.x - other.x, actual.y - other.y), Math.hypot(p.x - q.x, p.y - q.y));
    }
  }
  assert.equal(engine.bases.size, 9); // The white star is not a capturable base.
});

test('rotation is frame-rate independent, returns after a full turn, and retry resets it', () => {
  const a = quietEngine(FIRST_STRIKE), b = quietEngine(FIRST_STRIKE);
  a.pixels = []; b.pixels = [];
  for (let i = 0; i < 180 * 30; i++) a.update(1 / 30);
  for (let i = 0; i < 180 * 120; i++) b.update(1 / 120);
  for (const p of FIRST_STRIKE.planets) {
    near(a.bases.get(p.id)!.x, p.x); near(a.bases.get(p.id)!.y, p.y);
    near(a.bases.get(p.id)!.x, b.bases.get(p.id)!.x);
    near(a.bases.get(p.id)!.y, b.bases.get(p.id)!.y);
  }
  a.update(10);
  const retry = quietEngine(FIRST_STRIKE);
  near(retry.bases.get('player_1')!.x, FIRST_STRIKE.planets[0].x);
  near(retry.bases.get('player_1')!.y, FIRST_STRIKE.planets[0].y);
});

test('stationed ships and their movement targets rotate with their planet', () => {
  const engine = quietEngine(FIRST_STRIKE);
  const ship = engine.pixels[0];
  engine.pixels = [ship]; ship.speed = 0;
  ship.targetX += 10; ship.targetY += 20;
  const before = { ...ship };
  engine.update(45);
  near(ship.x, 800 - (before.y - 700)); near(ship.y, 700 + (before.x - 800));
  near(ship.targetX, 800 - (before.targetY - 700)); near(ship.targetY, 700 + (before.targetX - 800));
});

test('launched fleets are not dragged around the star; zero time does not advance', () => {
  const engine = quietEngine(FIRST_STRIKE);
  engine.sendUnits('player_1', 'ai_1', 1);
  const ship = engine.pixels.find(p => p.state === 'moving')!;
  ship.speed = 0;
  const before = { ...ship };
  engine.update(1);
  near(ship.x, before.x); near(ship.y, before.y);
  const positions = [...engine.bases.values()].map(p => [p.x, p.y]);
  engine.update(0);
  assert.deepEqual([...engine.bases.values()].map(p => [p.x, p.y]), positions);
});

for (const warp of [false, true]) test(`${warp ? 'Omni-Strike' : 'normal attack'} captures a moving world and its orbit continues`, () => {
  const map: MapDefinition = { ...FIRST_STRIKE, planets: [
    { id: 'player', x: 800, y: 1000, owner: PLAYER, ships: 100, capital: true },
    { id: 'enemy', x: 800, y: 400, owner: '#ef4444', ships: 1, capital: true },
    { id: 'target', x: 1000, y: 700, owner: NEUTRAL, ships: 1 },
  ], orbit: { x: 800, y: 700, periodSeconds: 180, planetIds: ['player', 'enemy', 'target'] } };
  const engine = quietEngine(map);
  for (const ship of engine.pixels) ship.speed = 2;
  if (warp) engine.omniStrike(PLAYER, 'target');
  else engine.sendUnits('player', 'target', 1);
  for (let i = 0; i < 2400 && engine.bases.get('target')!.color !== PLAYER; i++) engine.update(1 / 60);
  const target = engine.bases.get('target')!;
  assert.equal(target.color, PLAYER);
  const before = { ...target };
  engine.update(1 / 60);
  assert.notEqual(target.x, before.x);
  near(Math.hypot(target.x - 800, target.y - 700), 200);
  // Captured fleets can reinforce, then destroy the moving enemy capital.
  for (let i = 0; i < 1200; i++) engine.update(1 / 60);
  engine.sendUnits('target', 'enemy', 1);
  for (let i = 0; i < 2400 && !getOutcome(engine.bases.values()); i++) engine.update(1 / 60);
  assert.equal(getOutcome(engine.bases.values()), 'victory');
});

test('Quick Match and non-member planets stay fixed', () => {
  const quick = quietEngine();
  assert.ok(!(quick instanceof OrbitingGameEngine));
  const before = [...quick.bases.values()].map(p => [p.x, p.y]);
  quick.update(1 / 60);
  assert.deepEqual([...quick.bases.values()].map(p => [p.x, p.y]), before);
  const partial = quietEngine({ ...FIRST_STRIKE, orbit: { ...FIRST_STRIKE.orbit!, planetIds: ['midway'] } });
  partial.update(1);
  near(partial.bases.get('player_1')!.x, FIRST_STRIKE.planets[0].x);
  near(partial.bases.get('player_1')!.y, FIRST_STRIKE.planets[0].y);
});

test('invalid orbit definitions are rejected', () => {
  const orbit = FIRST_STRIKE.orbit!;
  for (const invalid of [
    { ...orbit, periodSeconds: 0 }, { ...orbit, periodSeconds: NaN },
    { ...orbit, planetIds: [] }, { ...orbit, planetIds: ['missing'] },
    { ...orbit, planetIds: ['midway', 'midway'] },
    { ...orbit, x: 0 }, { ...orbit, y: Infinity },
    { ...orbit, x: 800, y: 860 },
  ]) assert.throws(() => validateMap({ ...FIRST_STRIKE, orbit: invalid }));
});
