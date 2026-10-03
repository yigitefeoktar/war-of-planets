import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overlapsView, visibleWorldBounds } from './visibility';
import { createMatch } from './mapLoader';
import { SIEGE_OF_HELIOS } from './campaign';

test('visibility includes viewport corners through zoom, rotation, and shake', () => {
  for (const zoom of [0.05, 0.3, 0.6, 2.5]) for (const angle of [0, 0.15, -0.25, Math.PI / 2]) {
    const transform = { a: zoom * Math.cos(angle), b: zoom * Math.sin(angle),
      c: -zoom * Math.sin(angle), d: zoom * Math.cos(angle), e: -100, f: 20 };
    const view = visibleWorldBounds(transform, 390, 844);
    const determinant = transform.a * transform.d - transform.b * transform.c;
    for (const [sx, sy] of [[0, 0], [390, 0], [0, 844], [390, 844], [195, 422]]) {
      const x = (transform.d * (sx - transform.e) - transform.c * (sy - transform.f)) / determinant;
      const y = (-transform.b * (sx - transform.e) + transform.a * (sy - transform.f)) / determinant;
      assert.ok(overlapsView(view, x, y, 1e-6));
    }
  }
});

test('objects beyond the viewport remain visible while their halo overlaps an edge', () => {
  const view = { left: 0, top: 0, right: 100, bottom: 100 };
  assert.ok(overlapsView(view, -20, 50, 25));
  assert.ok(overlapsView(view, 120, 50, 25));
  assert.ok(overlapsView(view, 50, -20, 25));
  assert.ok(overlapsView(view, 50, 120, 25));
  assert.equal(overlapsView(view, 150, 50, 25), false);
});

test('Helios close opening avoids offscreen ship geometry without changing simulation state', t => {
  const originalPath = globalThis.Path2D;
  globalThis.Path2D = class {} as typeof Path2D;
  t.after(() => {
    if (originalPath) globalThis.Path2D = originalPath;
    else Reflect.deleteProperty(globalThis, 'Path2D');
  });
  const engine = createMatch(SIEGE_OF_HELIOS);
  engine.stars = [];
  let shipPaths = 0;
  const transform = { a: 0.3, b: 0, c: 0, d: 0.3, e: -180, f: -1150 };
  const methods = {
    canvas: { width: 390, height: 844 },
    getTransform: () => transform,
    moveTo: () => { shipPaths++; },
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  const ctx = new Proxy(methods, { get: (target, key) => Reflect.get(target, key) ?? (() => {}),
    set: (target, key, value) => Reflect.set(target, key, value) }) as unknown as CanvasRenderingContext2D;
  const before = JSON.stringify({ pixels: engine.pixels, bases: [...engine.bases.values()] });
  const ships = engine.pixels.length;
  engine.draw(ctx, null, 600, 1150 / 0.3);
  assert.ok(shipPaths < ships * 0.5, `only ${shipPaths} ship paths for ${ships} ships`);
  t.diagnostic(`Helios opening: ${shipPaths} ship paths emitted for ${ships} total ships.`);
  assert.equal(JSON.stringify({ pixels: engine.pixels, bases: [...engine.bases.values()] }), before);
});
