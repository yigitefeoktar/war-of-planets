import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawWeaponBadge } from './weaponBadges';
import { superweaponIconLayout } from './superweaponVisuals';

test('dense maps reuse badge glow artwork while panning, with bounded screen sizes', t => {
  const oldDocument = globalThis.document;
  const oldPath = globalThis.Path2D;
  t.after(() => {
    if (oldDocument) globalThis.document = oldDocument; else Reflect.deleteProperty(globalThis, 'document');
    if (oldPath) globalThis.Path2D = oldPath; else Reflect.deleteProperty(globalThis, 'Path2D');
  });
  globalThis.Path2D = class {} as typeof Path2D;
  let canvases = 0, glowPaints = 0;
  const paint = new Proxy({ fill: () => { glowPaints++; } }, {
    get: (target, key) => Reflect.get(target, key) ?? (() => {}),
  }) as unknown as CanvasRenderingContext2D;
  globalThis.document = { createElement: () => {
    canvases++;
    return { width: 0, height: 0, getContext: () => paint };
  } } as unknown as Document;
  const draws: number[][] = [];
  const ctx = { drawImage: (_sprite: HTMLCanvasElement, ...args: number[]) => draws.push(args) } as unknown as CanvasRenderingContext2D;
  for (const zoom of [0.2, 0.4, 0.6]) {
    const { scale } = superweaponIconLayout(zoom, 20);
    for (let frame = 0; frame < 10; frame++) for (let planet = 0; planet < 184; planet++) {
      drawWeaponBadge(ctx, 'overdrive', planet + frame, 50, scale, zoom);
    }
    const last = draws.at(-1)!;
    assert.equal(last[2] * zoom - 56, 20, 'badge size and glow padding remain constant on screen');
    assert.equal(last[0] + last[2] / 2, 192, 'panning uses the current planet position');
  }
  assert.equal(canvases, 1, 'overview zoom levels share one screen-sized sprite');
  assert.equal(glowPaints, 2, 'the badge background and glow are painted only once');
  assert.equal(draws.length, 5520);
  for (let zoom = 0.01; zoom <= 5; zoom += 0.01) {
    drawWeaponBadge(ctx, 'overdrive', 0, 0, superweaponIconLayout(zoom, 20).scale, zoom);
  }
  assert.ok(canvases <= 23, 'continuous zoom cannot grow the cache without bound');
});
