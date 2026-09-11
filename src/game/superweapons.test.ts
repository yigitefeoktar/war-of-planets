import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from './engine';
import { SUPERWEAPON_COSTS, SUPERWEAPON_IDS, assignQuickMatchSuperweaponPlanets, isPointAccessible } from './superweapons';
import type { Base } from './types';

const BLUE = '#3b82f6';
const RED = '#ef4444';

function fixture() {
  const engine = new GameEngine(2000, 1200, { rng: () => 0.5, now: () => 0 });
  engine.bases.clear();
  engine.pixels = [];
  engine.nextPixelId = 0;
  engine.addBase('capital', 100, 100, BLUE, 10, true);
  engine.addBase('enemy', 500, 100, RED, 10);
  engine.addBase('far', 1500, 100, RED, 10);
  engine.bases.get('capital')!.superweaponUnlocks = [...SUPERWEAPON_IDS];
  engine.recordPlanetCapture('capital', BLUE);
  return engine;
}

test('Quick Match sites include two copies of every weapon', () => {
  const bases: Base[] = Array.from({ length: 18 }, (_, index) => ({
    id: `neutral-${index}`, x: index * 100, y: 100, color: '#6b7280', pixelCount: 20,
  }));
  assignQuickMatchSuperweaponPlanets(bases);
  for (const weapon of SUPERWEAPON_IDS) {
    assert.equal(bases.filter(base => base.superweaponUnlocks?.includes(weapon)).length, 2);
  }
  assert.equal(bases.filter(base => base.superweaponUnlocks?.length).length, 6);
});

test('different factions permanently unlock every weapon on a captured site', () => {
  const engine = new GameEngine(1200, 800, { rng: () => 0.5, now: () => 0 });
  engine.bases.clear();
  engine.pixels = [];
  engine.factionSuperweaponUnlocks.clear();
  engine.addBase('relic', 900, 400, '#6b7280', 0);
  engine.bases.get('relic')!.superweaponUnlocks = ['overdrive', 'repulse'];

  assert.deepEqual(engine.recordPlanetCapture('relic', BLUE), ['overdrive', 'repulse']);
  assert.deepEqual(engine.recordPlanetCapture('relic', RED), ['overdrive', 'repulse']);
  assert.equal(engine.isSuperweaponUnlocked(BLUE, 'overdrive'), true);
  assert.equal(engine.isSuperweaponUnlocked(RED, 'overdrive'), true);
  assert.equal(engine.isSuperweaponUnlocked(RED, 'repulse'), true);
  assert.deepEqual(engine.recordPlanetCapture('relic', RED), []);
});

test('authored-map engines cannot unlock or activate superweapons', () => {
  const engine = new GameEngine(1000, 1000, { superweaponUnlocksEnabled: false });
  const marked = Array.from(engine.bases.values()).find(base => !base.isCapital)!;
  marked.superweaponUnlocks = ['repulse'];
  assert.deepEqual(engine.recordPlanetCapture(marked.id, BLUE), []);
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.repulse);
  assert.equal(engine.activatePlanetAbility(BLUE, marked.id, 'repulse'), false);
});

test('accessible territory is the union of 600-unit areas around owned planets', () => {
  const engine = fixture();
  assert.equal(isPointAccessible(engine.bases.values(), BLUE, 700, 100, 600), true);
  assert.equal(isPointAccessible(engine.bases.values(), BLUE, 701, 100, 600), false);
});

test('Omni Strike spends 70 energy and launches from the whole empire', () => {
  const engine = fixture();
  engine.setEnergy(BLUE, SUPERWEAPON_COSTS.omni);
  assert.equal(engine.activateOmniStrike(BLUE, 'enemy'), true);
  assert.equal(engine.getEnergy(BLUE), 0);
  assert.ok(engine.pixels.some(pixel => pixel.color === BLUE && pixel.state === 'moving' && pixel.isWarp));
});

function incoming(engine: GameEngine, color = RED, warp = false) {
  const ship = engine.createIdlePixel('enemy', 165, 100, color);
  Object.assign(ship, { state: 'moving', targetBaseId: 'capital', x: 165, y: 100, isWarp: warp });
  engine.pixels.push(ship);
  return ship;
}

test('planet abilities reject locked, unaffordable, hostile, missing and repeated casts without spending', () => {
  for (const weapon of ['overdrive', 'repulse'] as const) {
    const engine = fixture();
    assert.equal(engine.activatePlanetAbility(BLUE, 'capital', weapon), false);
    engine.setEnergy(BLUE, 100);
    for (const id of ['enemy', 'missing']) assert.equal(engine.activatePlanetAbility(BLUE, id, weapon), false);
    assert.equal(engine.activatePlanetAbility(RED, 'enemy', weapon), false);
    assert.equal(engine.getEnergy(BLUE), 100);
    assert.equal(engine.activatePlanetAbility(BLUE, 'capital', weapon), true);
    const remaining = engine.getEnergy(BLUE);
    assert.equal(engine.activatePlanetAbility(BLUE, 'capital', weapon), false);
    assert.equal(engine.getEnergy(BLUE), remaining);
  }
});

test('Overdrive triples local production in bursts, leaves other worlds alone and expires', () => {
  const engine = fixture();
  engine.setEnergy(BLUE, 100);
  engine.addBase('other', 100, 500, BLUE, 10);
  assert.equal(engine.activatePlanetAbility(BLUE, 'capital', 'overdrive'), true);
  engine.lastSpawnTime = -251;
  engine.update(0.25);
  assert.equal(engine.bases.get('capital')!.pixelCount, 13);
  assert.equal(engine.bases.get('other')!.pixelCount, 11);
  assert.equal(engine.bases.get('capital')!.overdrive!.pulse, 1);
  engine.update(15);
  assert.equal(engine.bases.get('capital')!.overdrive, undefined);
  engine.lastSpawnTime = -251;
  engine.update(0.25);
  assert.equal(engine.bases.get('capital')!.pixelCount, 14);
});

test('Overdrive cannot create production on a Dyson sphere', () => {
  const engine = fixture();
  engine.bases.get('capital')!.isDysonSphere = true;
  engine.setEnergy(BLUE, 100);
  assert.equal(engine.activatePlanetAbility(BLUE, 'capital', 'overdrive'), false);
  assert.equal(engine.getEnergy(BLUE), 100);
});

test('Repulse rejects ordinary and warp attackers without defender losses and wrecks explode', () => {
  const engine = fixture();
  engine.setEnergy(BLUE, 100);
  engine.activatePlanetAbility(BLUE, 'capital', 'repulse');
  const ordinary = incoming(engine), warp = incoming(engine, RED, true);
  const friendly = incoming(engine, BLUE);
  engine.update(0.016);
  assert.equal(ordinary.dead, true);
  assert.equal(warp.dead, true);
  assert.notEqual(friendly.dead, true);
  assert.equal(engine.bases.get('capital')!.pixelCount, 10);
  assert.equal(engine.bases.get('capital')!.color, BLUE);
  assert.equal(engine.repelledShips.length, 2);
  const initialX = engine.repelledShips[0].x;
  engine.update(0.1);
  assert.ok(engine.repelledShips[0].x > initialX);
  engine.update(0.8);
  assert.equal(engine.repelledShips.length, 0);
});

test('Repulse protects an empty capital, expires, then allows normal combat', () => {
  const engine = fixture();
  engine.pixels = engine.pixels.filter(ship => ship.color !== BLUE);
  engine.setEnergy(BLUE, 100);
  engine.activatePlanetAbility(BLUE, 'capital', 'repulse');
  incoming(engine);
  engine.update(0.016);
  assert.equal(engine.bases.get('capital')!.color, BLUE);
  engine.update(6);
  const attacker = incoming(engine);
  attacker.x = 100;
  engine.update(0.016);
  assert.equal(engine.bases.get('capital')!.color, RED);
});

test('effects clear on capture or faction elimination and never transfer to the new owner', () => {
  const engine = fixture();
  engine.setEnergy(BLUE, 100);
  engine.activatePlanetAbility(BLUE, 'capital', 'overdrive');
  engine.activatePlanetAbility(BLUE, 'capital', 'repulse');
  engine.bases.get('capital')!.color = RED;
  engine.recordPlanetCapture('capital', RED);
  assert.equal(engine.bases.get('capital')!.overdrive, undefined);
  assert.equal(engine.bases.get('capital')!.repulse, undefined);
  engine.addBase('colony', 200, 200, BLUE, 1);
  engine.setEnergy(BLUE, 100);
  engine.activatePlanetAbility(BLUE, 'colony', 'overdrive');
  engine.bases.get('colony')!.color = '#6b7280';
  engine.update(0.016);
  assert.equal(engine.bases.get('colony')!.overdrive, undefined);
});
