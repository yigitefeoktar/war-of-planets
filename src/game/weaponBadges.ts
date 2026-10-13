import type { SuperweaponId } from './types';
import { SUPERWEAPON_VISUALS } from './superweaponVisuals';

const pathsByWeapon = new Map<SuperweaponId, Path2D[]>();
const sprites = new Map<string, HTMLCanvasElement>();
const PADDING = 28;
const RESOLUTION = 2;

function paintBadge(ctx: CanvasRenderingContext2D, weapon: SuperweaponId, diameter: number, blur = 14) {
  ctx.save();
  ctx.scale(diameter / 30, diameter / 30);
  const visual = SUPERWEAPON_VISUALS[weapon];
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = visual.color; ctx.fillStyle = visual.color;
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = visual.color; ctx.shadowBlur = blur;
  ctx.translate(-12, -12);
  let paths = pathsByWeapon.get(weapon);
  if (!paths) {
    paths = visual.paths.map(path => new Path2D(path.d));
    pathsByWeapon.set(weapon, paths);
  }
  visual.paths.forEach((path, index) => {
    if (path.fill) ctx.fill(paths[index]); else ctx.stroke(paths[index]);
  });
  ctx.restore();
}

/** Cache at screen size: badges and their glow stay crisp at every world zoom. */
export function drawWeaponBadge(ctx: CanvasRenderingContext2D, weapon: SuperweaponId,
  x: number, y: number, scale: number, zoom: number) {
  const diameter = Math.max(20, Math.min(42, Math.round(30 * scale * zoom)));
  const key = `${weapon}:${diameter}`;
  let sprite = sprites.get(key);
  if (!sprite && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const size = diameter + PADDING * 2;
    canvas.width = canvas.height = size * RESOLUTION;
    const paint = canvas.getContext('2d');
    if (paint) {
      paint.scale(RESOLUTION, RESOLUTION);
      paint.translate(size / 2, size / 2);
      paintBadge(paint, weapon, diameter, 14 * RESOLUTION);
      sprites.set(key, canvas);
      sprite = canvas;
    }
  }
  if (sprite) {
    const size = (diameter + PADDING * 2) / zoom;
    ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  } else {
    // Headless canvas consumers can still use the original vector artwork.
    ctx.save(); ctx.translate(x, y);
    paintBadge(ctx, weapon, scale * 30);
    ctx.restore();
  }
}
