import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TacticalAI } from './ai';
import { GameEngine } from './engine';
import type { Base, Pixel } from './types';

const RED = '#ef4444', BLUE = '#3b82f6', GREY = '#6b7280';
const base = (id: string, x: number, color: string, pixelCount: number, isCapital = false): Base => ({ id, x, y: 0, color, pixelCount, isCapital });
function world(bases: Base[]) {
  const pixels: Pixel[] = bases.flatMap(b => Array.from({ length: b.pixelCount }, (_, id) => ({
    id, baseId: b.id, x: b.x, y: 0, color: b.color, targetX: b.x, targetY: 0,
    speed: 1, state: 'idle' as const, angle: 0,
  })));
  return { bases, pixels, range: 600, seconds: 0, hard: false, canOmni: () => false };
}

test('captures cheap worlds with a small force and leaves capital reserves', () => {
  const w = world([base('home', 0, RED, 200, true), base('neutral', 400, GREY, 10)]);
  const plan = new TacticalAI().plan(w).get(RED)!;
  assert.deepEqual(plan.orders, [{ from: 'home', to: 'neutral', count: 21 }]);
});

test('coordinates two fleets against a target neither could take alone', () => {
  const w = world([base('a', 0, RED, 85), base('b', 100, RED, 85), base('target', 400, BLUE, 65)]);
  const plan = new TacticalAI().plan(w).get(RED)!;
  assert.equal(plan.orders.length, 2);
  assert.ok(plan.orders.every(o => o.to === 'target' && o.count <= 61));
  assert.ok(plan.orders.reduce((sum, o) => sum + o.count, 0) > 85);
});

test('reinforces a threatened capital without draining its donor', () => {
  const w = world([base('home', 0, RED, 45, true), base('donor', 200, RED, 100), base('enemy', 500, BLUE, 80)]);
  for (const p of w.pixels.filter(p => p.color === BLUE)) { p.state = 'moving'; p.targetBaseId = 'home'; }
  const plan = new TacticalAI().plan(w).get(RED)!;
  assert.ok(plan.orders.some(o => o.from === 'donor' && o.to === 'home' && o.count === 47));
  assert.ok(!plan.orders.some(o => o.from === 'home'));
});

test('offensive recovery prevents repeated launches but still permits defence', () => {
  const ai = new TacticalAI();
  const w = world([base('home', 0, RED, 200, true), base('neutral', 400, GREY, 10)]);
  assert.equal(ai.plan(w).get(RED)!.orders.length, 1);
  w.seconds = 2;
  assert.equal(ai.plan(w).get(RED)!.orders.length, 0);
  w.seconds = 10;
  assert.equal(ai.plan(w).get(RED)!.orders.length, 1);
});

test('does not duplicate a capture already covered by incoming ships', () => {
  const w = world([base('home', 0, RED, 200, true), base('neutral', 400, GREY, 10)]);
  for (const p of w.pixels.slice(0, 30)) { p.state = 'moving'; p.targetBaseId = 'neutral'; }
  assert.equal(new TacticalAI().plan(w).get(RED)!.orders.length, 0);
});

test('rear fleets move towards the frontier and never bounce backwards', () => {
  const w = world([base('rear', 0, RED, 150), base('front', 500, RED, 25), base('enemy', 1000, BLUE, 300)]);
  const orders = new TacticalAI().plan(w).get(RED)!.orders;
  assert.deepEqual(orders, [{ from: 'rear', to: 'front', count: 98 }]);
});

test('defence remains active during offensive recovery', () => {
  const ai = new TacticalAI();
  const w = world([base('home', 0, RED, 45, true), base('donor', 200, RED, 120), base('neutral', 500, GREY, 10)]);
  ai.plan(w);
  w.seconds = 2;
  const enemyFleet = world([base('enemy', 500, BLUE, 70)]).pixels;
  for (const p of enemyFleet) { p.state = 'moving'; p.targetBaseId = 'home'; }
  w.pixels.push(...enemyFleet);
  const plan = ai.plan(w).get(RED)!;
  assert.deepEqual(plan.orders, [{ from: 'donor', to: 'home', count: 37 }]);
});

test('out-of-range and hopeless attacks are rejected', () => {
  for (const target of [base('target', 601, GREY, 1), base('target', 400, BLUE, 1000)]) {
    const w = world([base('home', 0, RED, 100, true), target]);
    assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, []);
  }
});

test('Omni uses distant reserves only when affordable, useful and safe', () => {
  const ai = new TacticalAI();
  const w = world([base('rear', -1500, RED, 600, true), base('front', 0, RED, 50), base('enemy', 500, BLUE, 100)]);
  w.canOmni = () => true;
  assert.equal(ai.plan(w).get(RED)!.omniTarget, undefined);
  w.seconds = 20;
  assert.equal(ai.plan(w).get(RED)!.omniTarget, 'enemy');
  w.seconds = 22;
  assert.equal(ai.plan(w).get(RED)!.omniTarget, undefined);
  const unavailable = new TacticalAI();
  w.canOmni = () => false;
  unavailable.plan(w);
  w.seconds = 50;
  assert.equal(unavailable.plan(w).get(RED)!.omniTarget, undefined);
});

test('targeting treats blue and other rivals equally; dead ships are not resources', () => {
  const blue = world([base('home', 0, RED, 200, true), base('enemy', 400, BLUE, 20)]);
  const green = world([base('home', 0, RED, 200, true), base('enemy', 400, '#22c55e', 20)]);
  assert.deepEqual(new TacticalAI().plan(blue).get(RED), new TacticalAI().plan(green).get(RED));
  blue.pixels.filter(p => p.color === RED).forEach(p => { p.dead = true; });
  assert.equal(new TacticalAI().plan(blue).get(RED)!.orders.length, 0);
});

test('engine executes the planned fleet size and hard mode grants no extra production', () => {
  let now = 0;
  const engine = new GameEngine(1000, 1000, { now: () => now, rng: () => 0.5 });
  engine.bases.clear(); engine.pixels = [];
  engine.addBase('home', 0, 0, RED, 200, true);
  engine.addBase('target', 400, 0, GREY, 10);
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  now = 2001;
  engine.update(0.016);
  assert.equal(engine.pixels.filter(p => p.state === 'moving').length, 21);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = 0;
  engine.isHardMode = true;
  const count = engine.pixels.length;
  engine.update(0.016);
  assert.equal(engine.pixels.length, count + 1);
});
