import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overlapsView, visibleWorldBounds } from './visibility';
import { createMatch } from './mapLoader';
import { SIEGE_OF_HELIOS } from './campaign';
import { generateMap } from './generatedMaps';

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

test('dense generated Chaos maps reuse badge and nebula artwork across camera movement', t => {
  const originalDocument = globalThis.document;
  const originalPath = globalThis.Path2D;
  t.after(() => {
    if (originalDocument) globalThis.document = originalDocument; else Reflect.deleteProperty(globalThis, 'document');
    if (originalPath) globalThis.Path2D = originalPath; else Reflect.deleteProperty(globalThis, 'Path2D');
  });
  globalThis.Path2D = class {} as typeof Path2D;
  let canvases = 0, artworkPaints = 0, spriteDraws = 0;
  const paint = new Proxy({
    fill: () => { artworkPaints++; }, stroke: () => { artworkPaints++; },
    createRadialGradient: () => ({ addColorStop: () => {} }),
  }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) }) as unknown as CanvasRenderingContext2D;
  globalThis.document = { createElement: () => {
    canvases++;
    return { width: 0, height: 0, getContext: () => paint };
  } } as unknown as Document;
  const map = generateMap('chaos-mode', 4, 4);
  const engine = createMatch(map);
  const transform = { a: 0.2, b: 0, c: 0, d: 0.2, e: 0, f: 0 };
  const methods = {
    canvas: { width: 1200, height: 1000 }, getTransform: () => transform,
    drawImage: () => { spriteDraws++; },
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  const ctx = new Proxy(methods, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) }) as unknown as CanvasRenderingContext2D;
  const before = JSON.stringify({ pixels: engine.pixels, bases: [...engine.bases.values()] });
  engine.draw(ctx, null, 0, 0);
  const initialPaints = artworkPaints, initialCanvases = canvases;
  assert.ok(initialCanvases > 0 && initialCanvases <= engine.nebulae.length + 3);
  for (let frame = 1; frame <= 10; frame++) {
    transform.e = -frame * 5;
    engine.draw(ctx, null, frame * 25, 0);
  }
  assert.equal(canvases, initialCanvases);
  assert.equal(artworkPaints, initialPaints, 'panning never repaints the cached glow artwork');
  assert.ok(spriteDraws > map.planets.length * 10);
  assert.equal(JSON.stringify({ pixels: engine.pixels, bases: [...engine.bases.values()] }), before);
  t.diagnostic(`${map.planets.length} Chaos planets: ${initialCanvases} cached canvases, ${initialPaints} artwork paints at warmup, 0 additional artwork paints during 10 panning frames.`);
});
