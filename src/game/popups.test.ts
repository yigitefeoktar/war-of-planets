import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from './engine';
import { activeGamePopup, IMPOSSIBLE_PLANET_NOTICE_MS, resolveSuperweaponClick, type GamePopupState } from './popups';
import { SUPERWEAPON_IDS } from './superweapons';

const BLUE = '#3b82f6', RED = '#ef4444';
const atLimit: GamePopupState = { targetingMode: null, impossiblePlanetUntil: 0, shipLimitActive: true };

test('the ship limit notice persists without a deadline and clears only below the limit', () => {
  for (const now of [0, 8000, 60_000, 3_600_000]) assert.equal(activeGamePopup(atLimit, now), 'ship-limit');
  assert.equal(activeGamePopup({ ...atLimit, shipLimitActive: false }, 3_600_000), null);
});

test('Impossible Planet interrupts the ship limit, which returns at its original expiry', () => {
  const state = { ...atLimit, impossiblePlanetUntil: 1000 + IMPOSSIBLE_PLANET_NOTICE_MS };
  assert.equal(activeGamePopup(state, 1000), 'impossible-planet');
  assert.equal(activeGamePopup(state, 3999), 'impossible-planet');
  assert.equal(activeGamePopup(state, 4000), 'ship-limit');
});

test('every weapon takes priority and cancelling before the deadline restores Impossible Planet', () => {
  for (const weapon of SUPERWEAPON_IDS) {
    const state = { ...atLimit, impossiblePlanetUntil: 3000, targetingMode: weapon };
    assert.equal(activeGamePopup(state, 1000), 'superweapon');
    assert.equal(activeGamePopup({ ...state, targetingMode: null }, 2000), 'impossible-planet');
    assert.equal(activeGamePopup({ ...state, targetingMode: null }, 3000), 'ship-limit');
  }
});

test('Impossible Planet expires behind a weapon without restarting when targeting ends', () => {
  const state: GamePopupState = { ...atLimit, impossiblePlanetUntil: 3000, targetingMode: 'omni' };
  assert.equal(activeGamePopup(state, 5000), 'superweapon');
  assert.equal(activeGamePopup({ ...state, targetingMode: null }, 5000), 'ship-limit');
});

test('dropping below the cap while hidden prevents the ship notice returning', () => {
  const state: GamePopupState = { targetingMode: 'repulse', impossiblePlanetUntil: 3000, shipLimitActive: false };
  assert.equal(activeGamePopup(state, 1000), 'superweapon');
  assert.equal(activeGamePopup({ ...state, targetingMode: null }, 2000), 'impossible-planet');
  assert.equal(activeGamePopup({ ...state, targetingMode: null }, 4000), null);
});

function match() {
  const engine = new GameEngine(3000, 3000, { now: () => 0 });
  engine.bases.clear(); engine.pixels = [];
  engine.addBase('home', 100, 100, BLUE, 100);
  engine.addBase('enemy', 500, 100, RED, 100);
  engine.addBase('far', 2000, 100, RED, 100);
  for (const weapon of SUPERWEAPON_IDS) engine.setSuperweaponCharge(BLUE, weapon, 1);
  return engine;
}

test('impossible weapon targets replace targeting with Impossible Planet and preserve charges', () => {
  const engine = match();
  for (const [weapon, target] of [['omni', 'far'], ['omni', 'home'], ['overdrive', 'enemy'], ['repulse', 'enemy'], ['repulse', 'missing']] as const) {
    const result = resolveSuperweaponClick(engine, BLUE, weapon, target);
    assert.equal(result, 'impossible');
    const state = { ...atLimit, targetingMode: null, impossiblePlanetUntil: 1000 + IMPOSSIBLE_PLANET_NOTICE_MS };
    assert.equal(activeGamePopup(state, 1000), 'impossible-planet');
    assert.equal(activeGamePopup(state, 4000), 'ship-limit');
    assert.equal(engine.getSuperweaponCharge(BLUE, weapon), 1);
  }
  assert.equal(engine.pixels.length, 300);
});

test('clicking empty space cancels weapon mode without an impossible notice or spending a charge', () => {
  const engine = match();
  for (const weapon of SUPERWEAPON_IDS) {
    assert.equal(resolveSuperweaponClick(engine, BLUE, weapon, null), 'cancelled');
    assert.equal(engine.getSuperweaponCharge(BLUE, weapon), 1);
  }
});

test('valid weapon targets still activate their actual effects and spend exactly one charge', () => {
  const engine = match();
  assert.equal(resolveSuperweaponClick(engine, BLUE, 'omni', 'enemy'), 'activated');
  assert.equal(engine.pixels.filter(ship => ship.isWarp).length, 30);
  assert.equal(resolveSuperweaponClick(engine, BLUE, 'overdrive', 'home'), 'activated');
  assert.ok(engine.bases.get('home')!.overdrive);
  assert.equal(resolveSuperweaponClick(engine, BLUE, 'repulse', 'home'), 'activated');
  assert.ok(engine.bases.get('home')!.repulse);
  for (const weapon of SUPERWEAPON_IDS) assert.equal(engine.getSuperweaponCharge(BLUE, weapon), 0);
});
