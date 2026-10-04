// Canvas command recording for headless stress tests. This measures drawing
// work, not browser raster time or FPS; production code never imports it.
export function renderTestContext(zoom = 0.8, width = 1200, height = 800) {
  const calls = new Map<string, number>();
  const gradient = { addColorStop: () => {} };
  const values: Record<string, unknown> = {
    canvas: { width, height },
    getTransform: () => ({ a: zoom, b: 0, c: 0, d: zoom, e: 0, f: 0 }),
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
  };
  const ctx = new Proxy(values, {
    get: (target, key) => {
      if (key in target) return target[key as string];
      return (..._args: unknown[]) => calls.set(String(key), (calls.get(String(key)) ?? 0) + 1);
    },
    set: (target, key, value) => { target[key as string] = value; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}
