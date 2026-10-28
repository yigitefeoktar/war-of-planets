import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './engine';
import { OrbitingGameEngine } from './orbitingEngine';
import { OVERDRIVE_MULTIPLIER, SUPERWEAPON_CHARGE_INTERVAL_SECONDS, SUPERWEAPON_IDS } from './superweapons';

const BLUE = '#3b82f6', RED = '#ef4444', GREEN = '#22c55e', YELLOW = '#eab308';

test('every faction produces one ship per cycle and the same Overdrive output', () => {
  let now = 0;
  const engine = new GameEngine(1000, 1000, { now: () => now });
  engine.bases.clear(); engine.pixels = []; engine.lastAITime = Infinity;
  for (const [index, color] of [BLUE, RED, GREEN, YELLOW, '#6b7280'].entries()) engine.addBase(color, index * 150, 0, color, 0);
  for (const [index, color] of [BLUE, RED, GREEN, YELLOW].entries()) {
    engine.addBase(`boosted-${color}`, index * 150, 600, color, 0);
    engine.bases.get(`boosted-${color}`)!.overdrive = { color, remaining: 7.5, pulse: 0 };
  }
  engine.addBase('sphere', 0, 300, GREEN, 0);
  engine.bases.get('sphere')!.isDysonSphere = true;
  for (let i = 0; i < 10; i++) { now += 251; engine.update(0.001); }
  for (const color of [BLUE, RED, GREEN, YELLOW]) {
    assert.equal(engine.pixels.filter(p => p.baseId === color).length, 10);
    assert.equal(engine.pixels.filter(p => p.baseId === `boosted-${color}`).length, 10 * OVERDRIVE_MULTIPLIER);
  }
  assert.equal(engine.pixels.filter(p => p.baseId === 'sphere' || p.baseId === '#6b7280').length, 0);
});

function fight(attacker: string, defender: string) {
  const engine = new GameEngine(1000, 1000, { now: () => 0, rng: () => 0.5 });
  engine.bases.clear(); engine.pixels = [];
  engine.lastAITime = Infinity; engine.lastSpawnTime = Infinity;
  engine.addBase('target', 300, 300, defender, 20);
  engine.addBase('source', 0, 0, attacker, 10);
  engine.sendUnits('source', 'target', 1);
  for (const ship of engine.pixels.filter(p => p.color === attacker)) { ship.x = 300; ship.y = 300; }
  engine.update(0);
  return engine.pixels.filter(p => p.color === defender).length;
}

test('ordinary combat exchanges ships one for one for every faction pairing', () => {
  for (const attacker of [BLUE, RED, GREEN, YELLOW]) {
    for (const defender of [BLUE, RED, GREEN, YELLOW, '#6b7280']) {
      if (attacker !== defender) assert.equal(fight(attacker, defender), 10, `${attacker} attacking ${defender}`);
    }
  }
});

test('every faction charges specialist weapons at the same rate and shows the same countdown', () => {
  const engine = new GameEngine(1000, 1000, { now: () => 0 });
  engine.bases.clear(); engine.pixels = [];
  for (const [index, color] of [BLUE, RED, GREEN, YELLOW].entries()) {
    engine.addBase(color, index * 250, 0, color, 0, true);
    engine.bases.get(color)!.superweaponUnlocks = [...SUPERWEAPON_IDS];
  }
  engine.update(10);
  for (const color of [BLUE, RED, GREEN, YELLOW]) for (const weapon of SUPERWEAPON_IDS) {
    assert.equal(engine.getSuperweaponProgress(color, weapon), 10 / SUPERWEAPON_CHARGE_INTERVAL_SECONDS);
    assert.equal(engine.getSuperweaponSecondsRemaining(color, weapon), SUPERWEAPON_CHARGE_INTERVAL_SECONDS - 10);
  }
  engine.update(SUPERWEAPON_CHARGE_INTERVAL_SECONDS - 10);
  for (const color of [BLUE, RED, GREEN, YELLOW]) for (const weapon of SUPERWEAPON_IDS) {
    assert.equal(engine.getSuperweaponCharge(color, weapon), 1);
    assert.equal(engine.getSuperweaponSecondsRemaining(color, weapon), 0);
  }
});

test('weapon charging stays disabled when the map has no weapon unlocks', () => {
  const disabled = new GameEngine(1000, 1000, { superweaponUnlocksEnabled: false });
  disabled.bases.get('player_1')!.superweaponUnlocks = ['omni'];
  disabled.update(60);
  assert.equal(disabled.getSuperweaponCharge(BLUE, 'omni'), 0);
});

test('every faction needs the full Dyson interval and shows the same countdown', () => {
  for (const color of [BLUE, RED, GREEN, YELLOW]) {
    const orbit = new OrbitingGameEngine(1000, 1000, { x: 500, y: 500, periodSeconds: 180, planetIds: [], dysonSphere: { chargeIntervalSeconds: 90 } });
    orbit.bases.clear(); orbit.pixels = [];
    orbit.lastAITime = Infinity; orbit.lastSpawnTime = Infinity;
    orbit.addBase('capital', 0, 0, color, 0, true);
    orbit.addBase('dyson-sphere', 500, 500, color, 0);
    orbit.bases.get('dyson-sphere')!.isDysonSphere = true;
    orbit.update(45);
    assert.equal(orbit.getUniversalProgress(color), 0.5);
    for (const weapon of SUPERWEAPON_IDS) assert.equal(orbit.getSuperweaponSecondsRemaining(color, weapon), 45);
    orbit.update(44);
    assert.equal(orbit.getUniversalCharge(color), 0);
    orbit.update(1);
    assert.equal(orbit.getUniversalCharge(color), 1);
  }
});
