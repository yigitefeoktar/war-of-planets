import test from 'node:test';
import assert from 'node:assert/strict';
import { CONVERSION_SHIP_WORLD_LENGTH, drawConversionShip } from './conversionVisuals';
import { PINK } from './superweapons';
import { SUPERWEAPON_VISUALS } from './superweaponVisuals';

test('the new faction exactly matches conversion pink and stays distinct from Omni Strike', () => {
  assert.equal(PINK, '#ff8fc7');
  assert.equal(PINK, SUPERWEAPON_VISUALS.conversion.color);
  assert.notEqual(PINK, SUPERWEAPON_VISUALS.omni.color);
});

test('the conversion hull keeps its size relative to normal ships and planets at every zoom', () => {
  for (const zoom of [0.04, 0.1, 0.35, 0.6, 1, 2, 3]) {
    const calls: { method: string; args: unknown[] }[] = [];
    const ctx = new Proxy({}, {
      get: (_target, property) => property === 'getTransform'
        ? () => ({ a: 0, b: zoom, c: -zoom, d: 0, e: 120, f: 80 })
        : property === 'createLinearGradient'
          ? () => ({ addColorStop: () => {} })
          : (...args: unknown[]) => calls.push({ method: String(property), args }),
      set: () => true,
    }) as CanvasRenderingContext2D;
    drawConversionShip(ctx, { x: 240, y: 300, color: PINK, angle: 0.5 }, zoom);
    assert.ok(!calls.some(call => ['setTransform', 'resetTransform'].includes(call.method)), 'keep the world camera transform');
    assert.deepEqual(calls.find(call => call.method === 'translate')?.args, [240, 300]);
    assert.deepEqual(calls.find(call => call.method === 'rotate')?.args, [0.5]);
    const scale = calls.find(call => call.method === 'scale')!.args[0] as number;
    const screenLength = scale * 66 * zoom;
    assert.ok(Math.abs(screenLength / (9 * zoom) - 4) < 1e-6, 'four times a normal ship hull');
    assert.ok(Math.abs(screenLength / (40 * zoom) - 0.9) < 1e-6, 'slightly shorter than a normal planet diameter');
  }
  assert.equal(CONVERSION_SHIP_WORLD_LENGTH, 36);
});

test('flight rendering uses the sender color for hull, glow, and exhaust with no destination annotation', () => {
  for (const color of ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', PINK]) {
    const calls: { method: string; args: unknown[] }[] = [];
    const colors: string[] = [];
    const fills: string[] = [];
    const shadows: string[] = [];
    const gradientColors: string[] = [];
    const ctx = new Proxy({}, {
      get: (_target, property) => property === 'getTransform'
        ? () => ({ a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 })
        : property === 'createLinearGradient'
        ? () => ({ addColorStop: (_offset: number, value: string) => gradientColors.push(value) })
        : (...args: unknown[]) => calls.push({ method: String(property), args }),
      set: (_target, property, value) => {
        if ((property === 'fillStyle' || property === 'strokeStyle') && typeof value === 'string') colors.push(value);
        if (property === 'fillStyle' && typeof value === 'string') fills.push(value);
        if (property === 'shadowColor' && typeof value === 'string') shadows.push(value);
        return true;
      },
    }) as CanvasRenderingContext2D;
    drawConversionShip(ctx, { x: 240, y: 300, color, angle: 0.5, trail: [
      { x: 210, y: 290, age: 0.4 }, { x: 230, y: 295, age: 0.1 },
    ] }, 0.5);
    assert.deepEqual(calls.find(call => call.method === 'translate')?.args, [240, 300]);
    assert.equal(fills[0], color, 'the hull itself uses the sender color');
    assert.deepEqual(shadows, [color], 'the glow uses the sender color');
    if (color !== PINK) assert.ok(!colors.includes(PINK), 'other factions do not inherit a pink hull');
    assert.ok(colors.includes(color), 'the flight history uses the sender color');
    assert.ok(gradientColors.includes(`${color}b3`), 'the exhaust uses the sender color');
    assert.ok(!calls.some(call => ['fillText', 'strokeText', 'arc', 'setLineDash'].includes(call.method)), 'no target ring, path guide, or countdown is drawn');
    assert.ok(calls.filter(call => call.method === 'lineTo' || call.method === 'moveTo')
      .every(call => call.args.every(value => typeof value !== 'number' || Math.abs(value) < 400)), 'all strokes stay on the ship or its past movement');
  }
});
