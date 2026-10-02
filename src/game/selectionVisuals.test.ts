import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from './engine';
import { OrbitingGameEngine } from './orbitingEngine';

const PLAYER = '#3b82f6';

// Record the canvas commands that distinguish a selected planet from a target.
function recordingCanvas() {
  type State = { x: number; y: number; dash: number[]; strokeStyle: string; fillStyle: unknown; globalAlpha: number };
  let state: State = { x: 0, y: 0, dash: [], strokeStyle: '', fillStyle: '', globalAlpha: 1 };
  const stack: State[] = [];
  let radius = 0;
  const paints: (State & { kind: 'stroke' | 'fill'; radius: number })[] = [];
  const methods = {
    canvas: { width: 1600, height: 1000 },
    save: () => stack.push({ ...state }),
    restore: () => { state = stack.pop()!; },
    translate: (x: number, y: number) => { state.x += x; state.y += y; },
    getTransform: () => ({ a: 1, b: 0, e: 0, f: 0 }),
    setLineDash: (dash: number[]) => { state.dash = dash; },
    beginPath: () => { radius = 0; },
    arc: (_x: number, _y: number, r: number) => { radius = r; },
    stroke: () => paints.push({ ...state, kind: 'stroke', radius }),
    fill: () => paints.push({ ...state, kind: 'fill', radius }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  const ctx = new Proxy(methods, {
    get: (target, key) => key in state ? state[key as keyof State] : Reflect.get(target, key) ?? (() => {}),
    set: (_target, key, value) => { Reflect.set(state, key, value); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, paints };
}

for (const orbiting of [false, true]) {
  test(`${orbiting ? 'orbiting' : 'fixed'} map keeps group selections visible above planets and separate from targets`, () => {
    const engine = orbiting
      ? new OrbitingGameEngine(1600, 1000, { x: 800, y: 500, periodSeconds: 60, planetIds: ['a', 'b'] })
      : new GameEngine(1600, 1000);
    engine.bases.clear(); engine.pixels = [];
    engine.addBase('a', 200, 300, PLAYER, 0);
    engine.addBase('b', 1400, 300, PLAYER, 0, true);
    engine.addBase('neighbor', 230, 300, '#ef4444', 0);
    engine.addBase('friendly-target', 350, 300, PLAYER, 0);
    const selected = new Set(['a', 'b']);
    for (const activeSource of [null, 'a']) {
      const { ctx, paints } = recordingCanvas();
      engine.draw(ctx, activeSource, 0, 0, null, selected);
      for (const id of selected) {
        const base = engine.bases.get(id)!;
        const strokes = paints.filter(paint => paint.kind === 'stroke' && paint.x === base.x && paint.y === base.y);
        const rings = strokes.filter(paint => paint.dash.length > 0);
        assert.deepEqual(rings.map(paint => paint.dash), [[15, 15], [8, 8]], `${id} uses only selected rings`);
        assert.ok(rings.every(paint => paint.globalAlpha === 1 && paint.radius > 0));
        const body = paints.find(paint => paint.kind === 'fill' && paint.x === base.x && paint.y === base.y);
        assert.equal(body?.globalAlpha, 1, `${id} must not be dimmed as an unreachable target`);
      }
      const lastBody = paints.reduce((last, paint, index) => paint.kind === 'fill'
        && typeof paint.fillStyle === 'object'
        && [...engine.bases.values()].some(base => base.x === paint.x && base.y === paint.y) ? index : last, -1);
      const firstRing = paints.findIndex(paint => paint.kind === 'stroke' && paint.dash[0] === 15);
      assert.ok(firstRing > lastBody, 'selection rings must be painted after every planet body');
      if (activeSource) assert.ok(paints.some(paint => paint.x === 350 && paint.dash[0] === 4), 'unselected valid targets retain their target visual');
    }
    // Lost planets are no longer shown as group-selected sources.
    engine.bases.get('b')!.color = '#ef4444';
    const { ctx, paints } = recordingCanvas();
    engine.draw(ctx, null, 0, 0, null, selected);
    assert.equal(paints.filter(paint => paint.kind === 'stroke' && paint.dash[0] === 15).length, 1);
  });
}
