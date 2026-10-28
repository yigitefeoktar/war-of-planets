export const CONVERSION_TRAIL_SECONDS = 1.6;
export const CONVERSION_SHIP_WORLD_LENGTH = 36;
export type ConversionTrailPoint = { x: number; y: number; age: number };
export type ConversionShip = {
  x: number; y: number; color: string; angle?: number; trail?: ConversionTrailPoint[];
};

/** Only ship position and past movement are available here: no destination markers. */
export function drawConversionShip(ctx: CanvasRenderingContext2D, ship: ConversionShip, zoom: number) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = ship.color;
  const trail = ship.trail ?? [];
  for (let index = 1; index < trail.length; index++) {
    const older = trail[index - 1], newer = trail[index];
    const alpha = Math.max(0, 1 - older.age / CONVERSION_TRAIL_SECONDS);
    ctx.globalAlpha = alpha * 0.45;
    ctx.lineWidth = 1 + alpha * 2;
    ctx.beginPath(); ctx.moveTo(older.x, older.y); ctx.lineTo(newer.x, newer.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Share the world camera with normal ships and planets, including zoom.
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle ?? 0);
  const scale = CONVERSION_SHIP_WORLD_LENGTH / 66;
  ctx.scale(scale, scale);

  // Sender-colored exhaust scales with the hull.
  const exhaust = ctx.createLinearGradient(-86, 0, -26, 0);
  exhaust.addColorStop(0, `${ship.color}00`);
  exhaust.addColorStop(1, `${ship.color}b3`);
  ctx.fillStyle = exhaust;
  ctx.beginPath(); ctx.moveTo(-86, 0); ctx.lineTo(-26, -7); ctx.lineTo(-26, 7); ctx.closePath(); ctx.fill();

  // Hull, glow, and exhaust all identify the faction launching the cruiser.
  ctx.fillStyle = ship.color; ctx.strokeStyle = '#ffffffb3'; ctx.lineWidth = 1.5;
  ctx.shadowColor = ship.color; ctx.shadowBlur = 5 * zoom;
  ctx.beginPath();
  ctx.moveTo(36, 0); ctx.lineTo(8, -12); ctx.lineTo(-6, -24); ctx.lineTo(-28, -24);
  ctx.lineTo(-20, -10); ctx.lineTo(-30, -8); ctx.lineTo(-30, 8); ctx.lineTo(-20, 10);
  ctx.lineTo(-28, 24); ctx.lineTo(-6, 24); ctx.lineTo(8, 12); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#00000040';
  ctx.beginPath(); ctx.moveTo(-22, -5); ctx.lineTo(18, 0); ctx.lineTo(-22, 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffffd9';
  ctx.beginPath(); ctx.moveTo(15, -4); ctx.lineTo(26, 0); ctx.lineTo(15, 4); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-19, side * 19); ctx.lineTo(-8, side * 19); ctx.lineTo(2, side * 10); ctx.stroke();
  }
  ctx.restore();
}
