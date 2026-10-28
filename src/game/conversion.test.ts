import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './engine';
import { TacticalAI } from './ai';
import { CHAPTER_TWO_WEAPONS, CONVERSION_PROBE_SPEED, PINK } from './superweapons';
import { resolveSuperweaponClick } from './popups';
import { CONVERSION_ARRIVAL_DURATION } from './planetEffects';

const BLUE = '#3b82f6', RED = '#ef4444', NEUTRAL = '#6b7280';
function match() {
  const engine = new GameEngine(3000, 2000, { now: () => 0, rng: () => 0.5 });
  engine.bases.clear(); engine.pixels = [];
  engine.lastAITime = Infinity; engine.lastSpawnTime = Infinity;
  engine.weaponPalette = CHAPTER_TWO_WEAPONS;
  engine.addBase('blue', 200, 500, BLUE, 40, true);
  engine.addBase('bridge', 700, 500, BLUE, 10);
  engine.addBase('target', 1200, 500, RED, 80);
  engine.addBase('red', 1700, 500, RED, 100, true);
  engine.bases.get('blue')!.superweaponUnlocks = ['conversion'];
  return engine;
}

test('conversion requires a full charge and a hostile neighboring non-capital target', () => {
  const engine = match();
  assert.equal(engine.activateConversionProbe(BLUE, 'target'), false);
  engine.update(59);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 0);
  engine.update(1);
  for (const id of ['blue', 'bridge', 'red', 'missing']) {
    assert.equal(engine.activateConversionProbe(BLUE, id), false);
    assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 1);
  }
  engine.bases.get('bridge')!.color = NEUTRAL;
  assert.equal(engine.canConversionProbe(BLUE, 'target'), false);
  engine.bases.get('bridge')!.color = BLUE;
  assert.equal(resolveSuperweaponClick(engine, BLUE, 'conversion', null), 'cancelled');
  assert.equal(resolveSuperweaponClick(engine, BLUE, 'conversion', 'target'), 'activated');
  assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 0);
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  assert.equal(engine.activateConversionProbe(BLUE, 'target'), false, 'no duplicate in-flight conversion from the same faction');
});

test('a probe travels from the capital at twice normal fleet speed and converts the current garrison', () => {
  const engine = match();
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.sendUnits('target', 'red', 0.25);
  const departed = engine.pixels.filter(ship => ship.state === 'moving');
  const remaining = engine.pixels.filter(ship => ship.baseId === 'target' && ship.state === 'idle');
  let captures = 0;
  engine.onCapture = (id, color) => { assert.equal(id, 'target'); assert.equal(color, BLUE); captures++; };
  assert.equal(engine.activateConversionProbe(BLUE, 'target'), true);
  assert.deepEqual([engine.conversionProbes[0].x, engine.conversionProbes[0].y], [200, 500]);
  engine.update(1);
  assert.equal(CONVERSION_PROBE_SPEED, 225);
  assert.equal(engine.conversionProbes[0].x, 425, 'travels 225 world units in one second');
  assert.equal(engine.bases.get('target')!.color, RED);
  assert.equal(captures, 0);
  // An additional defender that arrives before impact must also convert.
  engine.addBase('late', 2000, 1500, RED, 0);
  const late = engine.createIdlePixel('target', 1200, 500, RED);
  engine.pixels.push(late);
  for (let step = 0; step < 90; step++) engine.update(0.1);
  assert.equal(engine.bases.get('target')!.color, BLUE);
  assert.equal(captures, 1);
  assert.equal(engine.conversionProbes.length, 0);
  assert.ok(remaining.every(ship => !ship.dead && ship.color === BLUE));
  assert.equal(late.color, BLUE);
  assert.ok(departed.every(ship => ship.color === RED));
  assert.equal(engine.bases.get('target')!.pixelCount, 61);
});

test('conversion passes through an active Repulse Shield and takes the full stationed garrison', () => {
  const engine = match();
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, 'target');
  engine.update(1.5);
  engine.setSuperweaponCharge(RED, 'repulse', 1);
  assert.equal(engine.activatePlanetAbility(RED, 'target', 'repulse'), true);
  engine.update(2.5);
  assert.ok(engine.bases.get('target')!.repulse!.remaining > 0);
  assert.equal(engine.bases.get('target')!.color, RED);
  assert.equal(engine.conversionProbes.length, 1, 'crossing the shield barrier cannot intercept the ship');
  engine.update(0.5);
  assert.equal(engine.bases.get('target')!.color, BLUE);
  assert.equal(engine.conversionProbes.length, 0);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 0);
  assert.equal(engine.pixels.filter(ship => ship.color === BLUE && ship.baseId === 'target').length, 80);
  assert.equal(engine.bases.get('target')!.repulse, undefined, "capturing still clears the former owner's shield");
});

test('conversion arrival animation starts only on impact, pauses with dt zero, and expires', () => {
  const engine = match();
  const target = engine.bases.get('target')!;
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, target.id);
  assert.equal(target.conversionArrival, undefined);
  engine.update(4);
  assert.equal(target.conversionArrival, undefined, 'no effect reveals the destination during flight');
  engine.update(0.5);
  assert.equal(target.color, BLUE);
  assert.deepEqual(target.conversionArrival, { color: BLUE, remaining: CONVERSION_ARRIVAL_DURATION });
  engine.update(0);
  assert.equal(target.conversionArrival!.remaining, CONVERSION_ARRIVAL_DURATION);
  engine.update(0.4);
  assert.ok(target.conversionArrival!.remaining < CONVERSION_ARRIVAL_DURATION);
  engine.update(CONVERSION_ARRIVAL_DURATION);
  assert.equal(target.conversionArrival, undefined);
});

test('cancelled probes have no arrival effect and recapture clears an active conversion animation', () => {
  const engine = match();
  const target = engine.bases.get('target')!;
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, target.id);
  target.color = BLUE;
  engine.update(0.1);
  assert.equal(target.conversionArrival, undefined);
  assert.equal(engine.conversionProbes.length, 0);
  target.conversionArrival = { color: BLUE, remaining: CONVERSION_ARRIVAL_DURATION };
  target.color = RED;
  engine.recordPlanetCapture(target.id, RED);
  assert.equal(target.conversionArrival, undefined);
});

test('conversion records a bounded fading history of the ship movement in its sender color', () => {
  const engine = match();
  engine.bases.get('target')!.x = 20_000;
  engine.bases.get('bridge')!.x = 19_500;
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, 'target');
  for (let frame = 0; frame < 1200; frame++) engine.update(1 / 60);
  const probe = engine.conversionProbes[0];
  assert.equal(probe.color, BLUE);
  assert.equal(probe.angle, 0);
  const maxTrailPoints = Math.ceil(CONVERSION_PROBE_SPEED * 1.6 / 4) + 1;
  assert.ok(probe.trail!.length >= 20 && probe.trail!.length <= maxTrailPoints);
  assert.ok(probe.trail!.every(point => point.x <= probe.x && point.y === probe.y && point.age < 1.6));
  assert.ok(probe.trail![0].x > 200, 'old launch coordinates cannot grow into a permanent flight path');
  const before = structuredClone(probe.trail);
  engine.update(0);
  assert.deepEqual(probe.trail, before);
});

test('probes follow moving targets, survive lost launch range, and cancel if their faction loses its capital', () => {
  const engine = match();
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, 'target');
  engine.bases.get('bridge')!.color = RED;
  engine.bases.get('target')!.y = 1000;
  engine.update(1);
  assert.ok(engine.conversionProbes[0].y > 500);
  assert.equal(engine.bases.get('target')!.color, RED);
  engine.bases.get('blue')!.isCapital = false;
  engine.update(0.1);
  assert.equal(engine.conversionProbes.length, 0);
  assert.equal(engine.bases.get('target')!.color, RED);
});

test('neutral garrisons can be converted and already-friendly arrivals cancel harmlessly', () => {
  const engine = match();
  engine.bases.get('target')!.color = NEUTRAL;
  for (const ship of engine.pixels.filter(ship => ship.baseId === 'target')) ship.color = NEUTRAL;
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, 'target');
  engine.update(10);
  assert.equal(engine.bases.get('target')!.color, BLUE);
  assert.equal(engine.pixels.filter(ship => ship.baseId === 'target' && ship.color === BLUE).length, 80);
  const again = match();
  again.setSuperweaponCharge(BLUE, 'conversion', 1);
  again.activateConversionProbe(BLUE, 'target');
  again.bases.get('target')!.color = BLUE;
  again.update(1);
  assert.equal(again.conversionProbes.length, 0);
});

test('a normal capture of the destination makes its conversion ship explode in flight only once', () => {
  const engine = match();
  const target = engine.bases.get('target')!;
  engine.setSuperweaponCharge(BLUE, 'conversion', 1);
  engine.activateConversionProbe(BLUE, target.id);
  engine.update(1);
  // Let an ordinary attacking ship take the empty destination first.
  engine.pixels = engine.pixels.filter(ship => ship.baseId !== target.id);
  target.pixelCount = 0;
  const attacker = engine.createIdlePixel('bridge', target.x, target.y, BLUE);
  attacker.x = target.x; attacker.y = target.y;
  attacker.state = 'moving'; attacker.targetBaseId = target.id;
  engine.pixels.push(attacker);
  let captures = 0;
  engine.onCapture = () => captures++;
  engine.update(1 / 60);
  assert.equal(target.color, BLUE);
  const position = { x: engine.conversionProbes[0].x, y: engine.conversionProbes[0].y };
  engine.particles = [];
  engine.update(1 / 60);
  assert.equal(engine.conversionProbes.length, 0);
  assert.equal(engine.particles.length, 22, 'the cancelled ship emits a visible burst');
  assert.ok(engine.particles.every(particle => particle.color === BLUE
    && Math.hypot(particle.x - position.x, particle.y - position.y) <= 5), 'the burst is at the ship, not the destination');
  assert.equal(captures, 1, 'the probe does not capture the friendly planet again');
  assert.equal(target.conversionArrival, undefined);
  assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 0);
  engine.update(1 / 60);
  assert.equal(engine.particles.length, 22, 'the burst is not emitted repeatedly');
});

test('conversion charging caps at four effective sites and stores only one charge', () => {
  const engine = match();
  for (let index = 0; index < 9; index++) {
    engine.addBase(`factory-${index}`, 100, 100, BLUE, 0);
    engine.bases.get(`factory-${index}`)!.superweaponUnlocks = ['conversion'];
  }
  assert.equal(engine.getSuperweaponSourceCount(BLUE, 'conversion'), 10);
  assert.equal(engine.getSuperweaponSecondsRemaining(BLUE, 'conversion'), 15);
  engine.update(14); assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 0);
  engine.update(1); assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 1);
  engine.update(120); assert.equal(engine.getSuperweaponCharge(BLUE, 'conversion'), 1);
});

test('pink strips existing sources at 30 seconds and finishes an exclusive conversion source at 60', () => {
  const engine = match();
  engine.pinkTerraformingEnabled = true;
  const base = engine.bases.get('target')!;
  base.color = PINK; base.superweaponUnlocks = ['omni', 'repulse'];
  engine.update(29);
  assert.deepEqual(base.superweaponUnlocks, ['omni', 'repulse']);
  engine.update(1); assert.deepEqual(base.superweaponUnlocks, []);
  engine.update(29); assert.deepEqual(base.superweaponUnlocks, []);
  engine.update(1); assert.deepEqual(base.superweaponUnlocks, ['conversion']);
  assert.equal(engine.getSuperweaponCharge(PINK, 'conversion'), 0);
  assert.equal(base.pinkTransformSeconds, undefined);
  assert.equal(engine.getSuperweaponProgress(PINK, 'omni'), 0.5);
  engine.update(60); assert.equal(engine.getSuperweaponCharge(PINK, 'conversion'), 1);
  assert.equal(engine.bases.get('blue')!.pinkTransformSeconds, undefined);
});

test('large updates do not retroactively charge pink sources before they exist', () => {
  const engine = match(); engine.pinkTerraformingEnabled = true;
  engine.bases.get('target')!.color = PINK;
  engine.bases.get('target')!.superweaponUnlocks = ['repulse'];
  engine.update(90);
  assert.equal(engine.getSuperweaponProgress(PINK, 'repulse'), 0.5);
  assert.equal(engine.getSuperweaponProgress(PINK, 'conversion'), 0.5);
});

test('captures reset unfinished pink construction and completed factories persist under new ownership', () => {
  const engine = match(); engine.pinkTerraformingEnabled = true;
  const base = engine.bases.get('target')!;
  base.color = PINK;
  engine.update(40);
  base.color = BLUE; engine.recordPlanetCapture(base.id, BLUE);
  assert.equal(base.pinkTransformSeconds, undefined);
  engine.update(60); assert.deepEqual(base.superweaponUnlocks, []);
  base.color = PINK; engine.recordPlanetCapture(base.id, PINK);
  engine.update(59); assert.deepEqual(base.superweaponUnlocks, []);
  engine.update(1); assert.deepEqual(base.superweaponUnlocks, ['conversion']);
  base.color = BLUE; engine.recordPlanetCapture(base.id, BLUE);
  engine.update(60);
  assert.deepEqual(base.superweaponUnlocks, ['conversion']);
  assert.equal(engine.getSuperweaponSourceCount(BLUE, 'conversion'), 2);
});

test('pink capitals are never retooled and transformation stays disabled on earlier maps', () => {
  const engine = match();
  const capital = engine.bases.get('red')!;
  capital.color = PINK; capital.superweaponUnlocks = ['repulse'];
  const normal = engine.bases.get('target')!; normal.color = PINK;
  engine.update(120); assert.equal(normal.superweaponUnlocks, undefined);
  engine.pinkTerraformingEnabled = true;
  engine.update(120);
  assert.deepEqual(capital.superweaponUnlocks, ['repulse']);
  assert.equal(capital.pinkTransformSeconds, undefined);
});

test('pink AI expands and targets shielded worlds with conversion without casting an ineffective shield', () => {
  const engine = match();
  const capital = engine.bases.get('red')!; capital.color = PINK;
  for (const ship of engine.pixels.filter(ship => ship.baseId === capital.id)) ship.color = PINK;
  const factory = engine.bases.get('target')!; factory.color = PINK;
  for (const ship of engine.pixels.filter(ship => ship.baseId === factory.id)) ship.color = PINK;
  engine.bases.get('bridge')!.repulse = { color: BLUE, remaining: 6, pulse: 0 };
  engine.setSuperweaponCharge(PINK, 'conversion', 1);
  engine.setSuperweaponCharge(PINK, 'repulse', 1);
  const ai = new TacticalAI();
  const world = {
    bases: [...engine.bases.values()], pixels: engine.pixels, range: 600, seconds: 0, hard: false,
    canOmni: () => false, canConversion: (color: string, id: string) => color === PINK && engine.canConversionProbe(color, id),
    canAbility: (color: string, id: string, weapon: 'repulse' | 'overdrive') => engine.canActivatePlanetAbility(color, id, weapon),
    random: () => 0.5,
  };
  const plan = ai.plan(world).get(PINK)!;
  assert.ok(plan);
  assert.equal(plan.conversionTarget, 'bridge');
  assert.equal(plan.repulseTarget, undefined);
  capital.pixelCount = 240;
  for (let index = 0; index < 140; index++) engine.pixels.push(engine.createIdlePixel(factory.id, factory.x, factory.y, PINK));
  const expanded = ai.plan({ ...world, pixels: engine.pixels, seconds: 2 }).get(PINK)!;
  assert.ok(expanded.orders.length > 0);
});
