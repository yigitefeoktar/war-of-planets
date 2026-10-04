import { GameEngine } from '../src/game/engine';
import { renderTestContext } from '../src/game/renderTestContext';

// Node measures simulation time and Canvas command counts, not browser FPS.
export function crowdedMatch(count: number, now = () => 1000) {
  let seed = 1;
  const engine = new GameEngine(1500, 1000, { now,
    rng: () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32) });
  engine.bases.clear(); engine.pixels = []; engine.nextPixelId = 0;
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308'];
  colors.forEach((color, i) => engine.addBase(`base-${i}`, 300 + (i % 2) * 700, 250 + Math.floor(i / 2) * 500, color, 0, false));
  for (let id = 0; id < count; id++) {
    const base = engine.bases.get(`base-${id % 4}`)!;
    const angle = id * 2.399963;
    const r = 20 + (id % 200);
    const x = base.x + Math.cos(angle) * r, y = base.y + Math.sin(angle) * r;
    const moving = id % 10 >= 6;
    const warp = id % 20 === 19;
    engine.pixels.push({ id, baseId: base.id, color: base.color, x, y, angle, speed: 1,
      targetX: base.x, targetY: base.y, state: moving ? 'moving' : 'idle',
      targetBaseId: moving ? `base-${(id + 1) % 4}` : undefined, isWarp: warp,
      trail: warp ? Array.from({ length: 10 }, (_, i) => ({ x: x - i * 4, y, alpha: 1 - i / 10 })) : undefined });
  }
  engine.nextPixelId = count;
  return engine;
}

function median(samples: number[]) {
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)];
}

export function measureUpdate(count: number, fullDetail = false) {
  const engine = crowdedMatch(count);
  if (!fullDetail) engine.shipRendering.update(count);
  const samples: number[] = [];
  for (let i = 0; i < 160; i++) {
    const start = performance.now();
    engine.update(1 / 60);
    if (i >= 40) samples.push(performance.now() - start);
  }
  return median(samples);
}

if (typeof document === 'undefined' && process.argv[1]?.endsWith('ship-benchmark.ts')) {
  globalThis.Path2D = class {} as typeof Path2D;
  for (const count of [500, 2000, 10000, 20000, 30000]) {
    const engine = crowdedMatch(count);
    if (process.argv.includes('--full-detail')) engine.shipRendering.update = () => false;
    engine.stars = []; engine.nebulae = [];
    for (const base of engine.bases.values()) engine.shipCache.set(base.color, {} as HTMLCanvasElement);
    const { ctx, calls } = renderTestContext();
    engine.draw(ctx, null, 0, 0);
    console.log(JSON.stringify({ ships: count, medianUpdateMs: +measureUpdate(count, process.argv.includes('--full-detail')).toFixed(3),
      performanceMode: engine.shipRendering.active,
      canvasCommands: [...calls.values()].reduce((sum, n) => sum + n, 0),
      individualShipImages: calls.get('drawImage') ?? 0 }));
  }
}
