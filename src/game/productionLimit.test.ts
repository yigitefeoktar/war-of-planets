import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTION_SHIP_LIMIT, LOW_GARRISON_THRESHOLD, GameEngine } from './engine';
import { createMatch } from './mapLoader';
import { SIEGE_OF_HELIOS } from './campaign';

const BLUE = '#3b82f6', RED = '#ef4444', GREEN = '#22c55e', YELLOW = '#eab308', NEUTRAL = '#6b7280';

function match() {
  let now = 0;
  const engine = new GameEngine(20_000, 20_000, { now: () => now });
  engine.bases.clear();
  engine.pixels = [];
  engine.lastAITime = Infinity;
  return {
    engine,
    tick: () => { now += 251; engine.update(0); },
    count: (color: string) => engine.pixels.filter(ship => !ship.dead && ship.color === color).length,
    stationed: (id: string) => engine.pixels.filter(ship => !ship.dead && ship.state === 'idle' && ship.baseId === id).length,
  };
}

test('ordinary production stays unchanged below the limit, including neutral and Dyson exclusions', () => {
  const { engine, tick, count } = match();
  engine.addBase('blue', 1000, 1000, BLUE, 100);
  engine.addBase('neutral', 3000, 1000, NEUTRAL, 40);
  engine.addBase('sphere', 5000, 1000, RED, 100);
  engine.bases.get('sphere')!.isDysonSphere = true;
  tick();
  assert.equal(count(BLUE), 101);
  assert.equal(count(NEUTRAL), 40);
  assert.equal(count(RED), 100);
});

test('all four factions have independent 10,000-ship limits', () => {
  const { engine, tick, count } = match();
  for (const [index, color] of [BLUE, RED, GREEN, YELLOW].entries()) {
    engine.addBase(color, 1000 + index * 3000, 1000, color, color === BLUE ? FACTION_SHIP_LIMIT - 1 : FACTION_SHIP_LIMIT);
  }
  tick();
  for (const color of [BLUE, RED, GREEN, YELLOW]) assert.equal(count(color), FACTION_SHIP_LIMIT);
  tick();
  for (const color of [BLUE, RED, GREEN, YELLOW]) assert.equal(count(color), FACTION_SHIP_LIMIT);
});

test('the cap is shared between planets and production resumes after losses', () => {
  const { engine, tick, count } = match();
  engine.addBase('first', 1000, 1000, BLUE, 5000);
  engine.addBase('second', 3000, 1000, BLUE, 4999);
  tick();
  assert.equal(count(BLUE), FACTION_SHIP_LIMIT);
  assert.equal(engine.bases.get('second')!.pixelCount, 4999);
  engine.pixels[0].dead = true;
  engine.pixels[1].dead = true;
  tick();
  assert.equal(count(BLUE), FACTION_SHIP_LIMIT);
  assert.equal(engine.bases.get('second')!.pixelCount, 5000);
});

test('ships in flight still count toward the cap; launching does not free allowance', () => {
  const { engine, tick, count } = match();
  engine.addBase('source', 1000, 1000, BLUE, FACTION_SHIP_LIMIT);
  engine.addBase('target', 1500, 1000, NEUTRAL, 40);
  engine.sendUnits('source', 'target', 0.5);
  for (const ship of engine.pixels) {
    if (ship.color === BLUE) { ship.x = 1000; ship.y = 1000; }
  }
  tick();
  assert.equal(count(BLUE), FACTION_SHIP_LIMIT);
  assert.equal(engine.pixels.filter(ship => ship.color === BLUE && ship.state === 'moving').length, 5000);
});

test('low garrisons bypass the faction cap through 40 ships, then stop at 41', () => {
  const { engine, tick, stationed } = match();
  engine.addBase('stock', 1000, 1000, BLUE, FACTION_SHIP_LIMIT);
  for (const size of [0, 39, 40, 41, 42]) engine.addBase(`small-${size}`, 3000 + size * 100, 1000, BLUE, size);
  tick();
  for (const size of [0, 39, 40, 41, 42]) assert.equal(stationed(`small-${size}`), size <= LOW_GARRISON_THRESHOLD ? size + 1 : size);
  for (let i = 0; i < 45; i++) tick();
  for (const size of [0, 39, 40, 41]) assert.equal(stationed(`small-${size}`), 41);
  assert.equal(stationed('small-42'), 42);
  assert.equal(stationed('stock'), FACTION_SHIP_LIMIT);
});

test('the low-garrison exception applies equally to every enemy faction', () => {
  const { engine, tick, stationed } = match();
  for (const [index, color] of [RED, GREEN, YELLOW].entries()) {
    engine.addBase(`stock-${color}`, 1000 + index * 4000, 1000, color, FACTION_SHIP_LIMIT);
    engine.addBase(`small-${color}`, 1000 + index * 4000, 3000, color, 40);
  }
  tick();
  for (const color of [RED, GREEN, YELLOW]) assert.equal(stationed(`small-${color}`), 41);
});

test('garrison allowance uses live stationed ships rather than stale planet counts or departing fleets', () => {
  const { engine, tick, stationed, count } = match();
  engine.addBase('source', 1000, 1000, BLUE, FACTION_SHIP_LIMIT);
  engine.addBase('target', 1500, 1000, NEUTRAL, 40);
  engine.sendUnits('source', 'target', (FACTION_SHIP_LIMIT - 40) / FACTION_SHIP_LIMIT);
  for (const ship of engine.pixels) {
    if (ship.color === BLUE) { ship.x = 1000; ship.y = 1000; }
  }
  assert.equal(engine.bases.get('source')!.pixelCount, FACTION_SHIP_LIMIT);
  tick();
  assert.equal(stationed('source'), 41);
  assert.equal(count(BLUE), FACTION_SHIP_LIMIT + 1);
});

test('Overdrive production respects remaining faction allowance', () => {
  const { engine, tick, count } = match();
  engine.addBase('boosted', 1000, 1000, BLUE, FACTION_SHIP_LIMIT - 2);
  engine.bases.get('boosted')!.overdrive = { color: BLUE, remaining: 7.5, pulse: 0 };
  tick();
  assert.equal(count(BLUE), FACTION_SHIP_LIMIT);
  tick();
  assert.equal(count(BLUE), FACTION_SHIP_LIMIT);
});

test('Overdrive cannot extend the low-garrison exception above 41', () => {
  const { engine, tick, stationed } = match();
  engine.addBase('stock', 1000, 1000, BLUE, FACTION_SHIP_LIMIT);
  engine.addBase('boosted', 3000, 1000, BLUE, 40);
  engine.bases.get('boosted')!.overdrive = { color: BLUE, remaining: 7.5, pulse: 0 };
  tick();
  assert.equal(stationed('boosted'), 41);
  tick();
  assert.equal(stationed('boosted'), 41);
});

test('green bonus production cannot overshoot the ordinary cap', () => {
  const { engine, tick, count } = match();
  engine.addBase('green', 1000, 1000, GREEN, 100);
  for (let i = 0; i < 9; i++) tick();
  engine.addBase('stock', 3000, 1000, GREEN, FACTION_SHIP_LIMIT - count(GREEN) - 1);
  tick();
  assert.equal(count(GREEN), FACTION_SHIP_LIMIT);
});

test('Omni Strike bypasses the cap and immediately reports reaching it', () => {
  const { engine, count, tick } = match();
  engine.addBase('source', 1000, 1000, BLUE, 9900);
  engine.addBase('target', 1300, 1000, NEUTRAL, 40);
  const notices: string[] = [];
  engine.onShipLimitReached = color => notices.push(color);
  engine.setSuperweaponCharge(BLUE, 'omni', 1);
  assert.equal(engine.activateOmniStrike(BLUE, 'target'), true);
  assert.equal(count(BLUE), 12_870);
  assert.equal(engine.pixels.filter(ship => ship.isWarp && ship.color === BLUE).length, 2970);
  assert.deepEqual(notices, [BLUE]);
  for (const ship of engine.pixels) if (ship.color === BLUE) { ship.x = 1000; ship.y = 1000; }
  tick();
  assert.equal(count(BLUE), 12_870);
  assert.deepEqual(notices, [BLUE]);
});

test('limit notices fire once per crossing and rearm after dropping below the cap', () => {
  const { engine, tick } = match();
  engine.addBase('blue', 1000, 1000, BLUE, FACTION_SHIP_LIMIT - 1);
  const notices: string[] = [];
  engine.onShipLimitReached = color => notices.push(color);
  tick(); tick(); tick();
  assert.deepEqual(notices, [BLUE]);
  engine.pixels[0].dead = true;
  engine.update(0);
  tick();
  assert.deepEqual(notices, [BLUE, BLUE]);
});

test('starting above the limit stops production without deleting any ships', () => {
  const { engine, tick, count } = match();
  engine.addBase('red', 1000, 1000, RED, FACTION_SHIP_LIMIT + 500);
  tick();
  assert.equal(count(RED), FACTION_SHIP_LIMIT + 500);
});

test('the same production cap is active on the orbiting Helios finale', () => {
  const engine = createMatch(SIEGE_OF_HELIOS);
  const capital = [...engine.bases.values()].find(base => base.color === BLUE && base.isCapital)!;
  engine.pixels = engine.pixels.filter(ship => ship.color !== BLUE);
  engine.addBase(capital.id, capital.x, capital.y, BLUE, FACTION_SHIP_LIMIT, true);
  engine.lastAITime = Infinity;
  engine.lastSpawnTime = -Infinity;
  engine.update(0.001);
  assert.equal(engine.pixels.filter(ship => ship.color === BLUE && !ship.dead).length, FACTION_SHIP_LIMIT);
  assert.equal(engine.bases.size, 108);
});
