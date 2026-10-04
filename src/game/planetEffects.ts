import type { Base } from './types';
import { OVERDRIVE_DURATION, REPULSE_DURATION } from './superweapons';

export interface RepelledShip {
  x: number; y: number; vx: number; vy: number;
  angle: number; spin: number; life: number; color: string;
}

export function drawPlanetEffects(ctx: CanvasRenderingContext2D, base: Base) {
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
