import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShipRendering, SHIP_DETAIL_LIMITS, sampleEffects } from './shipRendering';
import { crowdedMatch } from '../../scripts/ship-benchmark';
import { renderTestContext } from './renderTestContext';
import { createMatch } from './mapLoader';
import { SIEGE_OF_HELIOS } from './campaign';
import type { GameEngine } from './engine';
import type { Pixel } from './types';

const view = { left: 0, top: 0, right: 1500, bottom: 1000 };
const groupKey = (p: Pixel) => `${p.color}|${p.baseId}|${p.state}|${p.targetBaseId}|${!!p.isWarp}`;

test('high count mode uses separate entry and exit thresholds and settles destruction effects', () => {
  const mode = new ShipRendering();
  assert.equal(mode.update(1999), false);
  assert.equal(mode.update(2000), true);
  for (const count of [1999, 1800, 1990, 1501]) assert.equal(mode.update(count), true);
  assert.equal(mode.update(1500, 5000), true);
  assert.equal(mode.update(1500, 400), false);
  assert.equal(mode.update(1800), false);
  assert.equal(mode.update(2000), true);
  assert.equal(mode.update(0), false);
});

test('small fleets keep the exact original ship array and detailed close-up rendering', t => {
  canvasGlobals(t);
  const engine = crowdedMatch(500);
  prepareCanvas(engine);
  const { ctx, calls } = renderTestContext();
  engine.draw(ctx, null, 0, 0);
  assert.equal(engine.shipRendering.active, false);
  assert.equal(engine.shipRendering.select(engine.pixels, view, 0.8), engine.pixels);
  assert.equal(calls.get('drawImage'), 500);
  const normal = crowdedMatch(500); prepareCanvas(normal);
  normal.shipRendering.update = () => false;
  const reference = renderTestContext(); normal.draw(reference.ctx, null, 0, 0);
  assert.deepEqual(calls, reference.calls);
});

test('dense fleets have bounded representatives with every visible faction, station and route retained', () => {
  const engine = crowdedMatch(30000);
  // A lone hostile attacker must not disappear among 30,000 stationed/route ships.
  const lone = { ...engine.pixels[0], id: 90000, baseId: 'tiny-launch', targetBaseId: 'base-0', state: 'moving' as const };
  engine.pixels.push(lone);
  const before = JSON.stringify(engine.pixels);
  const mode = new ShipRendering(); mode.update(engine.pixels.length);
  const selected = [...mode.select(engine.pixels, view, 0.8)];
  assert.ok(selected.length <= SHIP_DETAIL_LIMITS.ships);
  assert.ok(selected.length > SHIP_DETAIL_LIMITS.ships * 0.8);
  assert.ok(selected.includes(lone));
  assert.deepEqual(new Set(selected.map(groupKey)), new Set(engine.pixels.map(groupKey)));
  assert.equal(new Set(selected).size, selected.length);
  assert.equal(JSON.stringify(engine.pixels), before);
  assert.deepEqual([...mode.select(engine.pixels, view, 0.8)], selected);
  engine.pixels.push({ ...engine.pixels[0], id: 90001 });
  const next = [...mode.select(engine.pixels, view, 0.8)];
  assert.ok(selected.filter(p => next.includes(p)).length > selected.length * 0.95, 'ordinary production keeps representatives stable');
});

test('culling happens before sampling and a small visible fleet is rendered in full', () => {
  const engine = crowdedMatch(5000);
  for (const p of engine.pixels) { p.x = -10000; p.y = -10000; }
  const visible = engine.pixels.slice(-12);
  for (const p of visible) { p.x = 100; p.y = 100; }
  engine.pixels[0].x = -20; engine.pixels[0].y = 100; // overlapping halo
  engine.pixels[1].x = 100; engine.pixels[1].y = 100; engine.pixels[1].dead = true;
  const mode = new ShipRendering(); mode.update(5000);
  assert.deepEqual(new Set(mode.select(engine.pixels, view, 0.8)), new Set([...visible, engine.pixels[0]]));
  assert.equal(mode.select(engine.pixels, { left: 2000, right: 2500, top: 2000, bottom: 2500 }, 0.8).length, 0);
});

test('even an extreme number of distinct routes stays within the visual budget', () => {
  const engine = crowdedMatch(5000);
  for (const p of engine.pixels) { p.baseId = `source-${p.id}`; }
  const mode = new ShipRendering(); mode.update(5000);
  const selected = mode.select(engine.pixels, view, 0.8);
  assert.equal(selected.length, SHIP_DETAIL_LIMITS.ships);
  assert.equal(new Set(selected.map(p => p.color)).size, 4);
});

test('combat effects are bounded after visibility filtering without changing their state', () => {
  const effects = Array.from({ length: 10000 }, (_, i) => ({ x: i < 9500 ? -10000 : 100, y: 100, life: i }));
  const before = JSON.stringify(effects);
  const visible = sampleEffects(effects, view, 400);
  assert.equal(visible.length, 400);
  assert.ok(visible.every(p => p.x === 100));
  assert.equal(JSON.stringify(effects), before);
});

test('stress drawing bounds ship, warp and explosion work at both camera zooms', t => {
  canvasGlobals(t);
  for (const count of [2000, 10000, 30000]) for (const zoom of [0.3, 0.8]) {
    const engine = crowdedMatch(count); prepareCanvas(engine);
    for (let i = 0; i < 10000; i++) engine.createExplosion(400, 400, '#ef4444', 1);
    const before = JSON.stringify({ ships: engine.pixels, particles: engine.particles });
    const { ctx, calls } = renderTestContext(zoom);
    engine.draw(ctx, null, 0, 0);
    assert.equal(engine.shipRendering.active, true);
    assert.equal(calls.get('drawImage') ?? 0, 0);
    assert.ok((calls.get('moveTo') ?? 0) <= SHIP_DETAIL_LIMITS.ships + SHIP_DETAIL_LIMITS.trails + 20);
    assert.ok((calls.get('arc') ?? 0) <= SHIP_DETAIL_LIMITS.particles + 30);
    assert.equal(JSON.stringify({ ships: engine.pixels, particles: engine.particles }), before);
    t.diagnostic(`${count} ships, zoom ${zoom}: ${calls.get('moveTo')} paths, ${calls.get('arc')} arcs`);
  }
});

test('full detail resumes when the fleet drops, including cached ship images', t => {
  canvasGlobals(t);
  const engine = crowdedMatch(5000); prepareCanvas(engine);
  const { ctx } = renderTestContext(); engine.draw(ctx, null, 0, 0);
  engine.pixels = engine.pixels.slice(0, 500);
  const resumed = renderTestContext(); engine.draw(resumed.ctx, null, 0, 0);
  assert.equal(engine.shipRendering.active, false);
  assert.equal(resumed.calls.get('drawImage'), 500);
});

test('high count rendering preserves seeded combat, production and effects over a simulated battle', t => {
  canvasGlobals(t);
  let now = 1000;
  const optimized = crowdedMatch(5000, () => now), reference = crowdedMatch(5000, () => now);
  prepareCanvas(optimized); prepareCanvas(reference);
  reference.shipRendering.update = () => false;
  const ctx = renderTestContext().ctx;
  for (let frame = 0; frame < 360; frame++) {
    now += 1000 / 60;
    optimized.update(1 / 60); reference.update(1 / 60);
    optimized.draw(ctx, null, 0, 0); reference.draw(ctx, null, 0, 0);
  }
  assert.deepEqual(optimized.pixels, reference.pixels);
  assert.deepEqual(optimized.bases, reference.bases);
  assert.deepEqual(optimized.particles, reference.particles);
  assert.deepEqual(optimized.factionSuperweaponCharges, reference.factionSuperweaponCharges);
  assert.ok(optimized.nextPixelId > 5000, 'production ran during the comparison');
  assert.ok(optimized.lastAITime > 1000, 'AI ran during the comparison');
});

test('Helios orbiting fleets keep the same motion and state through repeated high count draws', t => {
  canvasGlobals(t);
  const engine = createMatch(SIEGE_OF_HELIOS); prepareCanvas(engine);
  const snapshot = JSON.stringify({ ships: engine.pixels, bases: [...engine.bases.values()] });
  const ctx = renderTestContext(0.3, 1600, 1000).ctx;
  engine.draw(ctx, null, 0, 0); engine.draw(ctx, null, 0, 0);
  assert.equal(engine.shipRendering.active, true);
  assert.equal(JSON.stringify({ ships: engine.pixels, bases: [...engine.bases.values()] }), snapshot);
  engine.update(1 / 60);
  const afterMotion = JSON.stringify({ ships: engine.pixels, bases: [...engine.bases.values()] });
  engine.draw(ctx, null, 0, 0);
  assert.equal(JSON.stringify({ ships: engine.pixels, bases: [...engine.bases.values()] }), afterMotion);
});

test('mass capital destruction and recovery preserve elimination, callbacks and ship order', t => {
  canvasGlobals(t);
  const optimized = crowdedMatch(5000), reference = crowdedMatch(5000);
  const events: string[][] = [[], []];
  const ctx = renderTestContext().ctx;
  for (const [i, engine] of [optimized, reference].entries()) {
    prepareCanvas(engine);
    if (i === 1) engine.shipRendering.update = () => false;
    const enemy = engine.bases.get('base-1')!;
    enemy.isCapital = true;
    engine.pixels = engine.pixels.filter(p => p.baseId !== enemy.id);
    const attacker = engine.pixels[0];
    attacker.state = 'moving'; attacker.targetBaseId = enemy.id;
    attacker.x = enemy.x; attacker.y = enemy.y;
    engine.onCapitalDestroyed = color => events[i].push(color);
    engine.draw(ctx, null, 0, 0);
    engine.update(1 / 60);
    engine.draw(ctx, null, 0, 0);
    // The high-count scratch buffers must not leave stale defenders after
    // dropping below the exit point and continuing in the regular path.
    engine.pixels = engine.pixels.slice(0, 500);
    for (let frame = 0; frame < 60; frame++) {
      engine.update(1 / 60); engine.draw(ctx, null, 0, 0);
    }
  }
  assert.deepEqual(events[0], ['#ef4444']);
  assert.deepEqual(events[0], events[1]);
  assert.deepEqual(optimized.pixels, reference.pixels);
  assert.deepEqual(optimized.bases, reference.bases);
  assert.deepEqual(optimized.particles, reference.particles);
  assert.equal(optimized.shipRendering.active, false);
});

function prepareCanvas(engine: GameEngine) {
  engine.stars = []; engine.nebulae = [];
  for (const base of engine.bases.values()) engine.shipCache.set(base.color, {} as HTMLCanvasElement);
}

function canvasGlobals(t: { after: (fn: () => void) => void }) {
  const original = globalThis.Path2D;
  globalThis.Path2D = class {} as typeof Path2D;
  t.after(() => {
    if (original) globalThis.Path2D = original;
    else Reflect.deleteProperty(globalThis, 'Path2D');
  });
}
