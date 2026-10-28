import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPlanetEffects } from './planetEffects';
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

test('the arrival halo is pink for every owner and follows the live planet without a flight marker', () => {
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
