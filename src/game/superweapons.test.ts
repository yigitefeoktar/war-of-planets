import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from './engine';
import { SUPERWEAPON_IDS, assignQuickMatchSuperweaponPlanets, isPointAccessible } from './superweapons';
import type { Base } from './types';

const BLUE = '#3b82f6';
const RED = '#ef4444';

function fixture(now = () => 0) {
  const engine = new GameEngine(2000, 1200, { rng: () => 0.5, now });
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

test('Quick Match has three specialist sites and one rare combined arsenal', () => {
  const bases: Base[] = Array.from({ length: 18 }, (_, index) => ({
    id: `neutral-${index}`, x: index * 100, y: 100, color: '#6b7280', pixelCount: 20,
  }));
  assignQuickMatchSuperweaponPlanets(bases);
  for (const weapon of SUPERWEAPON_IDS) {
    assert.equal(bases.filter(base => base.superweaponUnlocks?.includes(weapon)).length, 2);
  }
  assert.equal(bases.filter(base => base.superweaponUnlocks?.length).length, 4);
  assert.equal(bases.filter(base => base.superweaponUnlocks?.length === 3).length, 1);
});

test('weapon access follows current ownership and supports multi-weapon planets', () => {
  const engine = new GameEngine(1200, 800, { rng: () => 0.5, now: () => 0 });
  engine.bases.clear();
  engine.pixels = [];
  engine.addBase('relic', 900, 400, '#6b7280', 0);
  engine.bases.get('relic')!.superweaponUnlocks = ['overdrive', 'repulse'];

  assert.deepEqual([...engine.getOwnedSuperweapons(BLUE)], []);
  engine.bases.get('relic')!.color = BLUE;
  assert.deepEqual([...engine.getOwnedSuperweapons(BLUE)], ['overdrive', 'repulse']);
  engine.bases.get('relic')!.color = RED;
  assert.deepEqual([...engine.getOwnedSuperweapons(BLUE)], []);
  assert.deepEqual([...engine.getOwnedSuperweapons(RED)], ['overdrive', 'repulse']);
});

test('authored-map engines without weapon systems cannot charge or activate them', () => {
  const engine = new GameEngine(1000, 1000, { superweaponUnlocksEnabled: false });
  const marked = Array.from(engine.bases.values()).find(base => !base.isCapital)!;
  marked.superweaponUnlocks = ['repulse'];
  marked.color = BLUE;
  engine.update(120);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'repulse'), 0);
  assert.equal(engine.activatePlanetAbility(BLUE, marked.id, 'repulse'), false);
});

test('owned sites generate capped charges, duplicates accelerate, and losing a site pauses progress', () => {
  const engine = fixture();
  const capital = engine.bases.get('capital')!;
  capital.superweaponUnlocks = ['overdrive'];
  engine.addBase('home', 100, 500, BLUE, 0);
  engine.addBase('second-site', 300, 300, BLUE, 0);
  engine.bases.get('second-site')!.superweaponUnlocks = ['overdrive'];
  engine.update(29.9);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'overdrive'), 0);
  engine.update(0.1);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'overdrive'), 1);
  engine.update(120);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'overdrive'), 1);

  capital.color = RED;
  engine.bases.get('second-site')!.color = RED;
  assert.equal(engine.activatePlanetAbility(BLUE, 'home', 'overdrive'), true);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'overdrive'), 0);

  capital.color = BLUE;
  engine.bases.get('second-site')!.color = BLUE;
  engine.update(10);
  const heldProgress = engine.getSuperweaponProgress(BLUE, 'overdrive');
  capital.color = RED;
  engine.bases.get('second-site')!.color = RED;
  engine.update(20);
  assert.equal(engine.getSuperweaponProgress(BLUE, 'overdrive'), heldProgress);
});

test('accessible territory is the union of 600-unit areas around owned planets', () => {
  const engine = fixture();
  assert.equal(isPointAccessible(engine.bases.values(), BLUE, 700, 100, 600), true);
  assert.equal(isPointAccessible(engine.bases.values(), BLUE, 701, 100, 600), false);
});

test('Omni Strike spends one charge and creates 30% of idle ships on each owned planet', () => {
  const engine = fixture();
  engine.addBase('second', 200, 300, BLUE, 7);
  const originalShips = [...engine.pixels];
  engine.setSuperweaponCharge(BLUE, 'omni', 1);
  assert.equal(engine.activateOmniStrike(BLUE, 'enemy'), true);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'omni'), 0);
  assert.equal(engine.pixels.length, originalShips.length + 5);
  assert.ok(originalShips.every(pixel => pixel.state === 'idle' && !pixel.isWarp));
  assert.equal(engine.pixels.filter(pixel => pixel.baseId === 'capital' && pixel.state === 'moving' && pixel.isWarp && pixel.targetBaseId === 'enemy').length, 3);
  assert.equal(engine.pixels.filter(pixel => pixel.baseId === 'second' && pixel.state === 'moving' && pixel.isWarp && pixel.targetBaseId === 'enemy').length, 2);
  assert.equal(new Set(engine.pixels.map(pixel => pixel.id)).size, engine.pixels.length);
});

function incoming(engine: GameEngine, color = RED, warp = false) {
  const ship = engine.createIdlePixel('enemy', 165, 100, color);
  Object.assign(ship, { state: 'moving', targetBaseId: 'capital', x: 165, y: 100, isWarp: warp });
  engine.pixels.push(ship);
  return ship;
}

test('planet abilities reject uncharged, hostile, missing and repeated casts without wasting charges', () => {
  for (const weapon of ['overdrive', 'repulse'] as const) {
    const engine = fixture();
    assert.equal(engine.activatePlanetAbility(BLUE, 'capital', weapon), false);
    engine.setSuperweaponCharge(BLUE, weapon, 1);
    for (const id of ['enemy', 'missing']) assert.equal(engine.activatePlanetAbility(BLUE, id, weapon), false);
    assert.equal(engine.activatePlanetAbility(RED, 'enemy', weapon), false);
    assert.equal(engine.getSuperweaponCharge(BLUE, weapon), 1);
    assert.equal(engine.activatePlanetAbility(BLUE, 'capital', weapon), true);
    assert.equal(engine.getSuperweaponCharge(BLUE, weapon), 0);
    assert.equal(engine.activatePlanetAbility(BLUE, 'capital', weapon), false);
  }
});

test('Overdrive produces sevenfold local bursts for 7.5 seconds and leaves other worlds alone', () => {
  const engine = fixture();
  engine.setSuperweaponCharge(BLUE, 'overdrive', 1);
  engine.addBase('other', 100, 500, BLUE, 10);
  assert.equal(engine.activatePlanetAbility(BLUE, 'capital', 'overdrive'), true);
  assert.equal(engine.bases.get('capital')!.overdrive!.remaining, 7.5);
  engine.lastSpawnTime = -251;
  engine.update(0.25);
  assert.equal(engine.bases.get('capital')!.pixelCount, 17);
  assert.equal(engine.bases.get('other')!.pixelCount, 11);
  assert.equal(engine.bases.get('capital')!.overdrive!.pulse, 1);
  engine.update(7.25);
  assert.equal(engine.bases.get('capital')!.overdrive, undefined);
  engine.lastSpawnTime = -251;
  engine.update(0.25);
  assert.equal(engine.bases.get('capital')!.pixelCount, 18);
});

test('a full Overdrive burst yields 50% more extra ships than the former 15-second burst', () => {
  let now = 0;
  const boosted = fixture(() => now);
  const normal = fixture(() => now);
  for (const engine of [boosted, normal]) {
    // Offset the production clock so both durations contain whole production cycles.
    engine.lastSpawnTime = -126;
    engine.lastAITime = Infinity;
  }
  boosted.setSuperweaponCharge(BLUE, 'overdrive', 1);
  assert.equal(boosted.activatePlanetAbility(BLUE, 'capital', 'overdrive'), true);
  for (let step = 1; step <= 120; step++) {
    now = step * 125;
    boosted.update(0.125);
    normal.update(0.125);
    if (step === 59) assert.ok(boosted.bases.get('capital')!.overdrive);
    if (step === 60) {
      assert.equal(boosted.bases.get('capital')!.overdrive, undefined);
      assert.equal(boosted.bases.get('capital')!.pixelCount - normal.bases.get('capital')!.pixelCount, 120);
    }
  }
  const normalProduction = normal.bases.get('capital')!.pixelCount - 10;
  assert.equal(normalProduction, 40);
  const formerExtraShips = normalProduction * (3 - 1);
  const extraShips = boosted.bases.get('capital')!.pixelCount - normal.bases.get('capital')!.pixelCount;
  assert.equal(extraShips, formerExtraShips * 1.5);
});

test('Overdrive cannot create production on a Dyson sphere', () => {
  const engine = fixture();
  engine.bases.get('capital')!.isDysonSphere = true;
  engine.setSuperweaponCharge(BLUE, 'overdrive', 1);
  assert.equal(engine.activatePlanetAbility(BLUE, 'capital', 'overdrive'), false);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'overdrive'), 1);
});

test('Repulse rejects ordinary and warp attackers without defender losses and wrecks explode', () => {
  const engine = fixture();
  engine.setSuperweaponCharge(BLUE, 'repulse', 1);
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
  engine.setSuperweaponCharge(BLUE, 'repulse', 1);
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
  engine.setSuperweaponCharge(BLUE, 'overdrive', 1);
  engine.activatePlanetAbility(BLUE, 'capital', 'overdrive');
  engine.setSuperweaponCharge(BLUE, 'repulse', 1);
  engine.activatePlanetAbility(BLUE, 'capital', 'repulse');
  engine.bases.get('capital')!.color = RED;
  engine.recordPlanetCapture('capital', RED);
  assert.equal(engine.bases.get('capital')!.overdrive, undefined);
  assert.equal(engine.bases.get('capital')!.repulse, undefined);
  engine.addBase('colony', 200, 200, BLUE, 1);
  engine.setSuperweaponCharge(BLUE, 'overdrive', 1);
  engine.activatePlanetAbility(BLUE, 'colony', 'overdrive');
  engine.bases.get('colony')!.color = '#6b7280';
  engine.update(0.016);
  assert.equal(engine.bases.get('colony')!.overdrive, undefined);
});
