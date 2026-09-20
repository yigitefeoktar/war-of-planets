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
  return { bases, pixels, range: 600, seconds: 0, hard: false, canOmni: () => false, random: () => 0.5, recentOmniCaptureId: null as string | null, recentOmniCaptureTime: 0 };
}

test('every eligible planet makes a large attack without waiting for a faction cooldown', () => {
  const ai = new TacticalAI();
  const w = world([base('a', 0, RED, 200), base('b', 100, RED, 200), base('neutral', 400, GREY, 10)]);
  const orders = ai.plan(w).get(RED)!.orders;
  assert.deepEqual(orders, [{ from: 'a', to: 'neutral', count: 180 }]);
  w.seconds = 2;
  assert.deepEqual(ai.plan(w).get(RED)!.orders, [{ from: 'a', to: 'neutral', count: 180 }]);
});

test('bold attacks leave a counterattack opening on non-capitals', () => {
  const w = world([base('outpost', 0, RED, 200), base('target', 400, BLUE, 80)]);
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, [{ from: 'outpost', to: 'target', count: 180 }]);
});

test('capital keeps 45 ships even during a large attack', () => {
  const w = world([base('capital', 0, RED, 200, true), base('target', 400, GREY, 10)]);
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, [{ from: 'capital', to: 'target', count: 155 }]);
});

test('capital under attack receives reinforcements and keeps a threat-sized reserve', () => {
  const w = world([base('capital', 0, RED, 150, true), base('donor', 200, RED, 140), base('enemy', 500, BLUE, 200)]);
  for (const p of w.pixels.filter(p => p.color === BLUE).slice(0, 180)) { p.state = 'moving'; p.targetBaseId = 'capital'; }
  const orders = new TacticalAI().plan(w).get(RED)!.orders;
  assert.ok(orders.some(o => o.from === 'donor' && o.to === 'capital' && o.count === 42));
  assert.ok(!orders.some(o => o.from === 'capital'));
});

test('does not attack friendly planets or a hopeless fortress', () => {
  const w = world([base('a', 0, RED, 200), base('b', 100, RED, 20), base('fortress', 400, BLUE, 1000)]);
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, []);
});

test('does not pile on when enough friendly ships are already incoming', () => {
  const w = world([base('a', 0, RED, 200), base('target', 400, GREY, 10)]);
  for (const p of w.pixels.filter(p => p.color === RED).slice(0, 30)) { p.state = 'moving'; p.targetBaseId = 'target'; }
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, []);
});

test('original random gate leaves occasional quiet ticks', () => {
  const w = world([base('a', 0, RED, 200), base('target', 400, GREY, 10)]);
  w.random = () => 0.2;
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, []);
});

test('hard mode attacks sooner without extra ships', () => {
  const w = world([base('a', 0, RED, 115), base('target', 400, GREY, 10)]);
  w.random = () => 0.2;
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, []);
  w.hard = true;
  assert.deepEqual(new TacticalAI().plan(w).get(RED)!.orders, [{ from: 'a', to: 'target', count: 103 }]);
});

test('after a quiet front rear ships can gather through a winding friendly network', () => {
  const ai = new TacticalAI();
  const w = world([base('rear', 0, RED, 300), base('bridge', -500, RED, 10),
    { ...base('bend', -500, RED, 10), y: 500 }, { ...base('upper', -500, RED, 10), y: 1000 },
    { ...base('stage', 0, RED, 35), y: 1000 }, { ...base('enemy', 400, BLUE, 1000), y: 1300 }]);
  ai.plan(w);
  w.seconds = 30;
  const orders = ai.plan(w).get(RED)!.orders;
  assert.ok(orders.some(o => o.from === 'rear' && o.to === 'stage'));
});

test('Omni revenge is possible but not guaranteed and respects safety', () => {
  const w = world([base('capital', -1500, RED, 600, true), base('front', 0, RED, 30), base('captured', 500, BLUE, 20)]);
  w.canOmni = () => true;
  w.recentOmniCaptureId = 'captured';
  const ai = new TacticalAI();
  ai.plan(w);
  w.seconds = 10;
  w.random = () => 0.2;
  assert.equal(ai.plan(w).get(RED)!.omniTarget, 'captured');
  w.seconds = 12;
  assert.equal(ai.plan(w).get(RED)!.omniTarget, undefined);
  const other = new TacticalAI();
  other.plan(w);
  w.seconds = 20;
  w.random = () => 0.9;
  assert.equal(other.plan(w).get(RED)!.omniTarget, undefined);
});

test('a failed revenge roll is not retried each decision for the same capture', () => {
  const ai = new TacticalAI();
  const w = world([base('capital', -1500, RED, 600, true), base('front', 0, RED, 30), base('captured', 500, BLUE, 20)]);
  w.canOmni = () => true;
  w.recentOmniCaptureId = 'captured';
  w.random = () => 0.5;
  ai.plan(w);
  for (const second of [10, 12, 14, 16]) {
    w.seconds = second;
    assert.equal(ai.plan(w).get(RED)!.omniTarget, undefined);
  }
  w.recentOmniCaptureTime = 20;
  w.seconds = 20;
  w.random = () => 0.2;
  assert.equal(ai.plan(w).get(RED)!.omniTarget, 'captured');
});

test('Omni replaces ordinary orders so a capital is not emptied twice', () => {
  const ai = new TacticalAI();
  const w = world([base('capital', 0, RED, 200, true), base('captured', 400, BLUE, 10)]);
  w.canOmni = () => true;
  w.recentOmniCaptureId = 'captured';
  w.random = () => 0.2;
  ai.plan(w);
  w.seconds = 10;
  const plan = ai.plan(w).get(RED)!;
  assert.equal(plan.omniTarget, 'captured');
  assert.deepEqual(plan.orders, []);
});

test('engine executes the large capital attack and hard mode gives no hidden production', () => {
  let now = 0;
  const engine = new GameEngine(1000, 1000, { now: () => now, rng: () => 0.5 });
  engine.bases.clear(); engine.pixels = [];
  engine.addBase('home', 0, 0, RED, 200, true);
  engine.addBase('target', 400, 0, GREY, 10);
  engine.lastSpawnTime = Number.MAX_SAFE_INTEGER;
  now = 2001;
  engine.update(0.016);
  assert.equal(engine.pixels.filter(p => p.state === 'moving').length, 155);
  engine.lastAITime = Number.MAX_SAFE_INTEGER;
  engine.lastSpawnTime = 0;
  engine.isHardMode = true;
  const count = engine.pixels.length;
  engine.update(0.016);
  assert.equal(engine.pixels.length, count + 1);
});
