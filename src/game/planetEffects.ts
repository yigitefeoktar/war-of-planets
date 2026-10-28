import type { Base } from './types';
import { CONVERSION_COLOR, OVERDRIVE_DURATION, REPULSE_DURATION } from './superweapons';

export const CONVERSION_ARRIVAL_DURATION = 1.2;

export interface RepelledShip {
  x: number; y: number; vx: number; vy: number;
  angle: number; spin: number; life: number; color: string;
}

export function drawPlanetEffects(ctx: CanvasRenderingContext2D, base: Base, reducedMotion = false) {
  const radius = (base.isDysonSphere ? 62 : base.isCapital ? 40 : 20) + 24;
  for (const weapon of ['overdrive', 'repulse'] as const) {
    const effect = base[weapon];
    if (!effect || effect.color !== base.color) continue;
    const reactor = weapon === 'overdrive';
    const duration = reactor ? OVERDRIVE_DURATION : REPULSE_DURATION;
    const elapsed = duration - effect.remaining;
    const r = radius + (reactor ? 15 : 0);
    const tint = reactor ? '#ffbd59' : '#b9efff';
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.shadowColor = tint; ctx.shadowBlur = 22;
    ctx.globalAlpha = effect.remaining < 1 ? 0.55 + Math.sin(elapsed * 40) * 0.25 : 1;
    const halo = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
    halo.addColorStop(0, reactor ? '#ffb13b33' : '#a5e8ff22');
    halo.addColorStop(0.5, reactor ? '#ffb13b55' : '#75d9ff55');
    halo.addColorStop(1, '#00000000');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = tint;
    ctx.lineWidth = 3 + effect.pulse * 3;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    if (!reactor) {
      // A geometric shell, with a bright ripple on each rejected impact.
      ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.55 + effect.pulse * 0.45;
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.lineTo(Math.cos(angle + Math.PI / 6) * r, Math.sin(angle + Math.PI / 6) * r);
        ctx.lineTo(Math.cos(angle) * r * 0.7, Math.sin(angle) * r * 0.7);
        ctx.closePath(); ctx.stroke();
      }
    } else {
      ctx.save(); ctx.rotate(elapsed * 1.8); ctx.setLineDash([10, 7]);
      ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      // Every actual production burst sends bright launch streaks into orbit.
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + elapsed;
        const start = r * (1.6 - effect.pulse * 0.7);
        ctx.globalAlpha = effect.pulse;
        ctx.beginPath(); ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
        ctx.lineTo(Math.cos(angle) * (start + 22), Math.sin(angle) * (start + 22)); ctx.stroke();
      }
    }
    ctx.globalAlpha = 0.45 * effect.pulse;
    ctx.beginPath(); ctx.arc(0, 0, r + (1 - effect.pulse) * 40, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(0, 0, r + 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * effect.remaining / duration); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = tint; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${reactor ? '3×' : 'SHIELD'} ${Math.ceil(effect.remaining)}s`, 0, -r - 25);
    ctx.restore();
  }
  drawConversionArrival(ctx, base, reducedMotion);
}

function drawConversionArrival(ctx: CanvasRenderingContext2D, base: Base, reducedMotion: boolean) {
  const effect = base.conversionArrival;
  if (!effect || effect.remaining <= 0 || effect.color !== base.color) return;
  const progress = Math.max(0, Math.min(1, 1 - effect.remaining / CONVERSION_ARRIVAL_DURATION));
  const spread = reducedMotion ? 0.35 : 1 - Math.pow(1 - progress, 3);
  const radius = 44;
  const fade = 1 - progress;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.shadowColor = CONVERSION_COLOR; ctx.shadowBlur = 22;
  ctx.globalAlpha = fade;
  const halo = ctx.createRadialGradient(0, 0, 16, 0, 0, radius * (1.6 + spread * 0.5));
  halo.addColorStop(0, '#fff0f866');
  halo.addColorStop(0.35, '#ff8fc766');
  halo.addColorStop(1, '#ff8fc700');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, radius * (1.6 + spread * 0.5), 0, Math.PI * 2); ctx.fill();

  // A pink capture wave, followed by the two turning arcs of the weapon icon.
  ctx.strokeStyle = CONVERSION_COLOR; ctx.lineWidth = 4 * (1 - progress) + 1;
  ctx.beginPath(); ctx.arc(0, 0, radius * (0.65 + spread * 1.1), 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffd1e8'; ctx.lineWidth = 2.5;
  ctx.save();
  if (!reducedMotion) ctx.rotate(progress * Math.PI);
  const orbit = radius * (0.9 + spread * 0.15);
  for (let side = 0; side < 2; side++) {
    const start = side * Math.PI, end = start + Math.PI * 0.72;
    ctx.beginPath(); ctx.arc(0, 0, orbit, start, end); ctx.stroke();
    const x = Math.cos(end) * orbit, y = Math.sin(end) * orbit;
    const tx = -Math.sin(end), ty = Math.cos(end);
    ctx.beginPath(); ctx.moveTo(x - tx * 8 + Math.cos(end) * 5, y - ty * 8 + Math.sin(end) * 5);
    ctx.lineTo(x, y); ctx.lineTo(x - tx * 8 - Math.cos(end) * 5, y - ty * 8 - Math.sin(end) * 5); ctx.stroke();
  }
  ctx.restore();
  if (!reducedMotion) {
    ctx.strokeStyle = CONVERSION_COLOR; ctx.lineWidth = 2; ctx.globalAlpha = fade * fade * 0.7;
    for (let index = 0; index < 8; index++) {
      const angle = index * Math.PI / 4;
      const r = radius * (0.85 + spread * 1.25), length = 16 * fade;
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      ctx.lineTo(Math.cos(angle) * (r + length), Math.sin(angle) * (r + length)); ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawRepelledShips(ctx: CanvasRenderingContext2D, ships: RepelledShip[]) {
  for (const ship of ships) {
    ctx.save(); ctx.translate(ship.x, ship.y);
    ctx.strokeStyle = '#b9efff'; ctx.lineWidth = 2; ctx.globalAlpha = Math.min(1, ship.life * 5);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-ship.vx * 0.08, -ship.vy * 0.08); ctx.stroke();
    ctx.rotate(ship.angle); ctx.fillStyle = ship.color; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-7, 6); ctx.lineTo(-3, 0); ctx.lineTo(-7, -6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
