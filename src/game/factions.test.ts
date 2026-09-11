import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './engine';
import { OrbitingGameEngine } from './orbitingEngine';
import { FactionBonuses } from './factions';

const BLUE = '#3b82f6', RED = '#ef4444', GREEN = '#22c55e', YELLOW = '#eab308';

test('green produces exactly eleven ships per ten cycles; ownership resets progress', () => {
  const bonus = new FactionBonuses();
  for (const color of [BLUE, RED, GREEN, YELLOW, '#6b7280']) {
    assert.equal(Array.from({ length: 10 }, () => bonus.production('p', color)).reduce((a, b) => a + b), color === GREEN ? 11 : 10);
  }
  for (let i = 0; i < 9; i++) bonus.production('p', GREEN);
  bonus.production('p', RED);
  assert.equal(bonus.production('p', GREEN), 1);
});

test('engine applies green production only to productive worlds', () => {
  let now = 0;
  const engine = new GameEngine(1000, 1000, { now: () => now });
  engine.bases.clear(); engine.pixels = []; engine.lastAITime = Infinity;
  for (const [index, color] of [BLUE, RED, GREEN, YELLOW, '#6b7280'].entries()) engine.addBase(color, index * 150, 0, color, 0);
  engine.addBase('sphere', 0, 300, GREEN, 0);
  engine.bases.get('sphere')!.isDysonSphere = true;
  for (let i = 0; i < 10; i++) { now += 251; engine.update(0.001); }
  for (const color of [BLUE, RED, GREEN, YELLOW]) assert.equal(engine.pixels.filter(p => p.baseId === color).length, color === GREEN ? 11 : 10);
  assert.equal(engine.pixels.filter(p => p.baseId === 'sphere' || p.baseId === '#6b7280').length, 0);
});

function fight(attacker: string, defender: string) {
  const engine = new GameEngine(1000, 1000, { now: () => 0, rng: () => 0.5 });
  engine.bases.clear(); engine.pixels = [];
  engine.addBase('target', 300, 300, defender, 20);
  engine.addBase('source', 0, 0, attacker, 10);
  engine.sendUnits('source', 'target', 1);
  for (const ship of engine.pixels.filter(p => p.color === attacker)) { ship.x = 300; ship.y = 300; }
  engine.update(0);
  return engine.pixels.filter(p => p.color === defender).length;
}

test('actual combat grants modest attack and defence bonuses and lets them cancel', () => {
  assert.equal(fight(YELLOW, GREEN), 10);
  assert.equal(fight(RED, GREEN), 9);
  assert.equal(fight(YELLOW, BLUE), 11);
  assert.equal(fight(RED, BLUE), 10);
});

test('yellow energy bonus respects disabled weapons and applies to orbit income', () => {
  const engine = new GameEngine(1000, 1000);
  engine.bases.clear();
  engine.addBase('blue', 0, 0, BLUE, 0, true);
  engine.addBase('yellow', 500, 0, YELLOW, 0, true);
  assert.equal(engine.getEnergyRate(YELLOW), engine.getEnergyRate(BLUE) * 1.1);
  assert.equal(new GameEngine(1000, 1000, { superweaponUnlocksEnabled: false }).getEnergyRate(YELLOW), 0);
  const orbit = new OrbitingGameEngine(1000, 1000, { x: 500, y: 500, periodSeconds: 180, planetIds: [], dysonSphere: { energyPerSecond: 0.4 } });
  orbit.bases.clear();
  orbit.addBase('yellow', 0, 0, YELLOW, 0, true);
  orbit.addBase('dyson-sphere', 500, 500, YELLOW, 0);
  assert.equal(orbit.getEnergyRate(YELLOW), 1.4 * 1.1);
  orbit.bases.get('yellow')!.isCapital = false;
  assert.equal(orbit.getEnergyRate(YELLOW), 0);
});
