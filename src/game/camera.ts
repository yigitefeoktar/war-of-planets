export type ZoomLimits = { min: number; max: number };

export function zoomLimits(viewWidth: number, viewHeight: number, worldWidth: number, worldHeight: number): ZoomLimits {
  const fit = Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
  const worldScale = Math.max(0, Math.min(1, (Math.max(worldWidth, worldHeight) - 1500) / 1500));
  const max = 1.8 + worldScale * 1.2;
  return { min: Math.min(max * 0.8, Math.max(0.08, fit * 0.68)), max };
}

export function clampZoom(zoom: number, limits: ZoomLimits) {
  return Math.max(limits.min, Math.min(zoom, limits.max));
}
