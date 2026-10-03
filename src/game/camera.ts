import type { MapDefinition } from './campaign';

export type ZoomLimits = { min: number; max: number };
export type CameraFrame = { focusX: number; focusY: number; zoom: number; anchorY: number };
export type CameraViewport = { width: number; height: number; top: number; bottom: number };
export type CameraPoint = { x: number; y: number };
export const CAMERA_OVERVIEW_HOLD_MS = 220;

export function zoomLimits(viewWidth: number, viewHeight: number, worldWidth: number, worldHeight: number): ZoomLimits {
  const fit = Math.min(viewWidth / worldWidth, viewHeight / worldHeight);
  const worldScale = Math.max(0, Math.min(1, (Math.max(worldWidth, worldHeight) - 1500) / 1500));
  const max = 1.8 + worldScale * 1.2;
  return { min: Math.min(max * 0.8, fit * 0.68), max };
}

export function clampZoom(zoom: number, limits: ZoomLimits) {
  return Math.max(limits.min, Math.min(zoom, limits.max));
}

export function overviewFrame(view: CameraViewport, worldWidth: number, worldHeight: number, scale = 0.9): CameraFrame {
  // The overview uses the free area between the HUD panels, including on short screens.
  const usableHeight = Math.max(1, view.height - view.top - view.bottom);
  const zoom = clampZoom(Math.min(Math.min(view.width / worldWidth, view.height / worldHeight) * scale, usableHeight / worldHeight),
    zoomLimits(view.width, view.height, worldWidth, worldHeight));
  return { focusX: worldWidth / 2, focusY: worldHeight / 2, zoom,
    anchorY: (view.top + usableHeight / 2) / view.height };
}

export function capitalFrame(view: CameraViewport, capital: CameraPoint, planets: readonly CameraPoint[],
  worldWidth: number, worldHeight: number, attackRange: number, preferredY?: number): CameraFrame {
  const mobile = view.width < 700;
  const margin = 35;
  const top = view.top + margin;
  const bottom = Math.max(top + 1, view.height - view.bottom - margin);
  // Phones fit immediate choices; wider screens also show the next steps along routes.
  // Both intro and capital recall use live geometry, including orbiting planets.
  const contextRange = attackRange * (mobile ? 1 : 2);
  const neighbors = planets.filter(point => Math.hypot(point.x - capital.x, point.y - capital.y) <= contextRange);
  const above = Math.max(0, ...neighbors.map(point => capital.y - point.y));
  const below = Math.max(0, ...neighbors.map(point => point.y - capital.y));
  // A southern capital needs more room above it. Avoid wasting half a PC view on empty space.
  const balance = mobile || above + below === 0 ? 0.5 : Math.max(0.25, Math.min(0.75, above / (above + below)));
  const anchorY = Math.max(top, Math.min(bottom, preferredY === undefined
    ? top + (bottom - top) * balance : view.height * preferredY)) / view.height;
  let zoom = mobile ? Math.min(0.35, view.width / (attackRange * 2 + 100)) : 0.6;
  for (const point of [capital, ...neighbors]) {
    const dx = Math.abs(point.x - capital.x);
    const dy = point.y - capital.y;
    if (dx > 0) zoom = Math.min(zoom, Math.max(1, view.width / 2 - margin) / dx);
    if (dy < 0) zoom = Math.min(zoom, Math.max(1, view.height * anchorY - top) / -dy);
    if (dy > 0) zoom = Math.min(zoom, Math.max(1, bottom - view.height * anchorY) / dy);
  }
  return { focusX: capital.x, focusY: capital.y, anchorY,
    zoom: clampZoom(zoom, zoomLimits(view.width, view.height, worldWidth, worldHeight)) };
}

export function openingFrame(view: CameraViewport, map: MapDefinition | undefined, capital: CameraPoint | undefined,
  planets: readonly CameraPoint[]): CameraFrame {
  const worldWidth = map?.width ?? 3000, worldHeight = map?.height ?? 3000;
  const overview = overviewFrame(view, worldWidth, worldHeight, map?.overviewScale);
  if (!capital) return overview;
  const range = map?.attackRange ?? 600;
  return capitalFrame(view, capital, planets, worldWidth, worldHeight, range, map?.capitalFocusY ?? (map?.tutorial ? 0.7 : undefined));
}

export function cameraPosition(frame: CameraFrame, view: Pick<CameraViewport, 'width' | 'height'>) {
  return { x: frame.focusX - view.width / (2 * frame.zoom),
    y: frame.focusY - view.height * frame.anchorY / frame.zoom, zoom: frame.zoom };
}

export function cameraFrame(x: number, y: number, zoom: number, view: Pick<CameraViewport, 'width' | 'height'>): CameraFrame {
  return { focusX: x + view.width / (2 * zoom), focusY: y + view.height / (2 * zoom), zoom, anchorY: 0.5 };
}

export function interpolateCamera(from: CameraFrame, to: CameraFrame, progress: number): CameraFrame {
  const p = Math.max(0, Math.min(1, progress));
  if (p === 0) return { ...from };
  if (p === 1) return { ...to };
  const ease = p * p * (3 - 2 * p);
  return { focusX: from.focusX + (to.focusX - from.focusX) * ease,
    focusY: from.focusY + (to.focusY - from.focusY) * ease,
    // Constant proportional zoom travel keeps large-map approaches from rushing at the start.
    zoom: from.zoom * Math.pow(to.zoom / from.zoom, ease),
    anchorY: from.anchorY + (to.anchorY - from.anchorY) * ease };
}

export function cameraDuration(from: CameraFrame, to: CameraFrame, view: CameraViewport, reducedMotion = false) {
  if (reducedMotion) return 0;
  const zoomTravel = Math.abs(Math.log(to.zoom / from.zoom));
  const a = cameraPosition(from, view), b = cameraPosition(to, view);
  const panTravel = Math.hypot(a.x - b.x, a.y - b.y) * Math.min(from.zoom, to.zoom);
  if (panTravel < 2 && zoomTravel < 0.01) return 0;
  return Math.min(1600, Math.max(450, 450 + zoomTravel * 450 + panTravel * 0.35));
}

// A camera clock advances only during active frames. Tab restoration cannot skip a tween.
export function cameraDelta(previous: number | null, now: number, suspended = false) {
  return suspended || previous === null ? 0 : Math.max(0, Math.min(50, now - previous));
}

export function cameraProgress(elapsed: number, duration: number, hold = 0, reducedMotion = false) {
  if (reducedMotion || duration === 0) return 1;
  return Math.max(0, Math.min(1, (elapsed - hold) / duration));
}
