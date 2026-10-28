import test from 'node:test';
import assert from 'node:assert/strict';
import { drawConversionCountdown, drawPlanetEffects, drawPinkTerraform } from './planetEffects';
import { CONVERSION_COLOR } from './superweapons';
import type { Base } from './types';

function recorder() {
  const calls: { method: string; args: unknown[] }[] = [];
  const colors: unknown[] = [];
  const ctx = new Proxy({}, {
    get: (_target, property) => property === 'createRadialGradient'
      ? () => ({ addColorStop: (_offset: number, color: string) => colors.push(color) })
      : (...args: unknown[]) => calls.push({ method: String(property), args }),
    set: (_target, property, value) => {
      if (['strokeStyle', 'shadowColor'].includes(String(property))) colors.push(value);
      return true;
    },
  }) as CanvasRenderingContext2D;
  return { ctx, calls, colors };
}

test('the arrival halo is pink for every owner and follows the live planet without a countdown label', () => {
  for (const color of ['#3b82f6', '#ef4444', '#ff8fc7']) {
    const base: Base = { id: 'target', x: 300, y: 400, color, pixelCount: 60 };
    const before = recorder();
    drawPlanetEffects(before.ctx, base);
    assert.equal(before.calls.length, 0, 'no arrival marker before impact');
    base.conversionArrival = { color, remaining: 0.9 };
    const effect = recorder();
    drawPlanetEffects(effect.ctx, base);
    assert.ok(effect.colors.includes(CONVERSION_COLOR), 'impact uses weapon pink, regardless of fleet color');
    assert.deepEqual(effect.calls.find(call => call.method === 'translate')?.args, [300, 400]);
    assert.ok(effect.calls.some(call => call.method === 'arc'));
    assert.ok(!effect.calls.some(call => ['fillText', 'strokeText'].includes(call.method)), 'no arrival timer or extra label');
    base.x = 450; base.y = 525;
    const moved = recorder();
    drawPlanetEffects(moved.ctx, base);
    assert.deepEqual(moved.calls.find(call => call.method === 'translate')?.args, [450, 525], 'orbit movement carries the halo');
  }
});

test('pending conversion drains a pink ring and shows seconds independently of the arrival burst', () => {
  const base: Base = { id: 'target', x: 300, y: 400, color: '#ef4444', pixelCount: 60 };
  for (const remaining of [5, 2.5, 2.500000000000005, 0.1, 0.10000000000000037]) {
    const pending = recorder();
    drawConversionCountdown(pending.ctx, base, { color: '#3b82f6', remaining });
    assert.ok(pending.colors.includes(CONVERSION_COLOR));
    assert.deepEqual(pending.calls.find(call => call.method === 'translate')?.args, [300, 400]);
    assert.equal(pending.calls.find(call => call.method === 'fillText')?.args[0], `CONVERT ${remaining.toFixed(1)}s`);
    const timer = pending.calls.filter(call => call.method === 'arc')[1];
    assert.ok(Math.abs(Number(timer.args[4]) - (-Math.PI / 2 + Math.PI * 2 * remaining / 5)) < 1e-9);
    assert.equal(base.conversionArrival, undefined, 'rendering a countdown cannot start the arrival burst');
  }
  base.x = 700; base.y = 800;
  const moved = recorder();
  drawConversionCountdown(moved.ctx, base, { color: '#3b82f6', remaining: 1 });
  assert.deepEqual(moved.calls.find(call => call.method === 'translate')?.args, [700, 800]);
});

test('pending conversion keeps its timer with reduced motion and separates competing faction rings', () => {
  const base: Base = { id: 'target', x: 0, y: 0, color: '#6b7280', pixelCount: 60 };
  for (const zoom of [0.1, 0.35, 1, 3]) {
    const first = recorder(), second = recorder();
    drawConversionCountdown(first.ctx, base, { color: '#3b82f6', remaining: 4 }, true, zoom);
    drawConversionCountdown(second.ctx, base, { color: '#ef4444', remaining: 2 }, true, zoom, 1);
    assert.ok(!first.calls.some(call => call.method === 'rotate'));
    assert.equal(first.calls.find(call => call.method === 'fillText')?.args[0], 'CONVERT 4.0s');
    const r1 = Number(first.calls.find(call => call.method === 'arc')!.args[2]);
    const r2 = Number(second.calls.find(call => call.method === 'arc')!.args[2]);
    assert.ok(r1 >= 76 && r2 > r1);
  }
  for (const incoming of [{ color: '#3b82f6', remaining: 0 }, { color: base.color, remaining: 3 }]) {
    const inactive = recorder(); drawConversionCountdown(inactive.ctx, base, incoming);
    assert.equal(inactive.calls.length, 0, 'expired or friendly countdowns never render');
  }
});

test('reduced motion removes arrival rotation and streaks, and stale effects do not render', () => {
  const base: Base = { id: 'target', x: 0, y: 0, color: '#3b82f6', pixelCount: 0,
    conversionArrival: { color: '#3b82f6', remaining: 0.6 } };
  const normal = recorder(), reduced = recorder();
  drawPlanetEffects(normal.ctx, base);
  drawPlanetEffects(reduced.ctx, base, true);
  assert.ok(normal.calls.some(call => call.method === 'rotate'));
  assert.ok(!reduced.calls.some(call => call.method === 'rotate'));
  assert.ok(reduced.calls.filter(call => call.method === 'lineTo').length < normal.calls.filter(call => call.method === 'lineTo').length);
  for (const effect of [{ color: base.color, remaining: 0 }, { color: '#ef4444', remaining: 1 }]) {
    base.conversionArrival = effect;
    const inactive = recorder();
    drawPlanetEffects(inactive.ctx, base);
    assert.equal(inactive.calls.length, 0);
  }
});

test('pink removal and construction have large distinct bursts anchored to the live planet', () => {
  for (const action of ['strip', 'build'] as const) {
    const base: Base = { id: 'factory', x: 300, y: 400, color: CONVERSION_COLOR, pixelCount: 0,
      pinkTerraformEffect: { action, remaining: 1.8 } };
    const burst = recorder();
    drawPinkTerraform(burst.ctx, base);
    assert.ok(burst.colors.includes(CONVERSION_COLOR));
    assert.deepEqual(burst.calls.find(call => call.method === 'translate')?.args, [300, 400]);
    assert.ok(burst.calls.some(call => call.method === 'arc' && Number(call.args[2]) >= 100), 'burst extends well beyond the planet');
    assert.ok(!burst.calls.some(call => ['fillText', 'strokeText', 'fillRect'].includes(call.method)), 'burst has no text or label background');
    base.x = 500; base.y = 600;
    const moved = recorder(); drawPinkTerraform(moved.ctx, base);
    assert.deepEqual(moved.calls.find(call => call.method === 'translate')?.args, [500, 600]);
    const reduced = recorder(); drawPinkTerraform(reduced.ctx, base, true);
    assert.ok(!reduced.calls.some(call => call.method === 'rotate'));
    assert.ok(!reduced.calls.some(call => ['fillText', 'strokeText', 'fillRect'].includes(call.method)), 'reduced motion stays text-free');
    assert.ok(reduced.calls.length < burst.calls.length);
  }
});

test('pink bursts stop after expiry or a change of ownership', () => {
  const base: Base = { id: 'factory', x: 0, y: 0, color: CONVERSION_COLOR, pixelCount: 0 };
  const absent = recorder(); drawPinkTerraform(absent.ctx, base);
  assert.equal(absent.calls.length, 0);
  base.pinkTerraformEffect = { action: 'strip', remaining: 0 };
  const expired = recorder(); drawPinkTerraform(expired.ctx, base);
  assert.equal(expired.calls.length, 0);
  base.pinkTerraformEffect.remaining = 1;
  base.color = '#3b82f6';
  const captured = recorder(); drawPinkTerraform(captured.ctx, base);
  assert.equal(captured.calls.length, 0);
});
