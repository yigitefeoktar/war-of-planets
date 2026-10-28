import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from './engine';

const BLUE = '#3b82f6', RED = '#ef4444', NEUTRAL = '#6b7280';

function fixture(planets: number) {
  let now = 0;
  const engine = new GameEngine(20_000, 20_000, { now: () => now, rng: () => 0.5 });
  engine.bases.clear();
  engine.pixels = [];
  engine.lastAITime = Infinity;
  for (let i = 0; i < planets; i++) engine.addBase(`blue-${i}`, 1000 + i * 100, 1000, BLUE, 0);
  const activate = (id: string) => {
    engine.setSuperweaponCharge(BLUE, 'overdrive', 1);
    assert.equal(engine.activatePlanetAbility(BLUE, id, 'overdrive'), true);
  };
  return {
    engine, activate,
    tick: () => { now += 251; engine.update(0.251); },
    count: (id: string) => engine.pixels.filter(ship => !ship.dead && ship.baseId === id).length,
  };
}

test('Overdrive scales with empire size and keeps normal production for one or two planets', () => {
  for (const planets of [1, 2, 3, 20, 100]) {
    const { activate, tick, count } = fixture(planets);
    activate('blue-0');
    tick();
    assert.equal(count('blue-0'), Math.max(1, planets - 1), `${planets} owned planets`);
    for (let i = 1; i < planets; i++) assert.equal(count(`blue-${i}`), 1);
  }
});

test('Overdrive excludes hostile, neutral and Dyson worlds regardless of stationed army size', () => {
  const { engine, activate, tick, count } = fixture(4);
  engine.bases.get('blue-3')!.isDysonSphere = true;
  engine.addBase('hostile', 5000, 5000, RED, 500);
  engine.addBase('neutral', 8000, 5000, NEUTRAL, 500);
  engine.addBase('blue-stock', 8000, 8000, BLUE, 1000);
  activate('blue-0');
  tick();
  assert.equal(count('blue-0'), 3);
  assert.equal(count('blue-3'), 0);
  assert.equal(count('hostile'), 501);
  assert.equal(count('neutral'), 500);
  assert.equal(count('blue-stock'), 1001);
});

test('simultaneous Overdrives use normal production without multiplying each other', () => {
  const { activate, tick, count } = fixture(6);
  activate('blue-0');
  activate('blue-1');
  tick();
  assert.equal(count('blue-0'), 5);
  assert.equal(count('blue-1'), 5);
  assert.equal(count('blue-2'), 1);
  tick();
  assert.equal(count('blue-0'), 10);
  assert.equal(count('blue-1'), 10);
});

test('active Overdrive follows gains and losses of producing planets each cycle', () => {
  const { engine, activate, tick, count } = fixture(4);
  activate('blue-0');
  tick();
  assert.equal(count('blue-0'), 3);
  engine.addBase('captured', 5000, 5000, BLUE, 0);
  tick();
  assert.equal(count('blue-0'), 7);
  engine.bases.get('captured')!.color = RED;
  engine.recordPlanetCapture('captured', RED);
  tick();
  assert.equal(count('blue-0'), 10);
  engine.bases.get('blue-1')!.color = RED;
  engine.recordPlanetCapture('blue-1', RED);
  tick();
  assert.equal(count('blue-0'), 12);
});
