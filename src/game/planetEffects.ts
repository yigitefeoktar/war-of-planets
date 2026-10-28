import type { Base } from './types';
import { CONVERSION_COLOR, CONVERSION_TRAVEL_SECONDS, OVERDRIVE_DURATION, REPULSE_DURATION } from './superweapons';

export const CONVERSION_ARRIVAL_DURATION = 1.2;
export const PINK_TERRAFORM_EFFECT_DURATION = 2.4;

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

export function drawPinkTerraform(ctx: CanvasRenderingContext2D, base: Base, reducedMotion = false) {
  const effect = base.pinkTerraformEffect;
  if (!effect || effect.remaining <= 0 || base.color !== CONVERSION_COLOR) return;
  const progress = Math.max(0, Math.min(1, 1 - effect.remaining / PINK_TERRAFORM_EFFECT_DURATION));
  const building = effect.action === 'build';
  const spread = reducedMotion ? 0.55 : 1 - Math.pow(1 - progress, 3);
  const fade = Math.min(1, (1 - progress) * 3);
  const radius = 42 + spread * 75;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.globalAlpha = fade;
  ctx.shadowColor = CONVERSION_COLOR; ctx.shadowBlur = 28;
  const halo = ctx.createRadialGradient(0, 0, 12, 0, 0, 145);
  halo.addColorStop(0, '#fff0f8aa');
  halo.addColorStop(0.3, '#ff8fc788');
  halo.addColorStop(0.65, '#ec489944');
  halo.addColorStop(1, '#ff8fc700');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, 145, 0, Math.PI * 2); ctx.fill();

  // Stripping blasts the old arsenal outward; building draws energy into the new factory.
  ctx.strokeStyle = CONVERSION_COLOR; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, building ? 155 - radius : radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffe4f3'; ctx.lineWidth = 3;
  ctx.save();
  if (!reducedMotion) ctx.rotate((building ? -1 : 1) * progress * Math.PI * 1.5);
  for (let index = 0; index < 3; index++) {
    const angle = index * Math.PI * 2 / 3;
    ctx.beginPath(); ctx.arc(0, 0, 62, angle, angle + Math.PI * 0.45); ctx.stroke();
  }
  ctx.restore();
  if (!reducedMotion) {
    ctx.fillStyle = '#ffd1e8'; ctx.strokeStyle = '#ff8fc7'; ctx.lineWidth = 3;
    for (let index = 0; index < 12; index++) {
      const angle = index * Math.PI / 6;
      const r = building ? 138 - spread * 105 : 38 + spread * 100;
      ctx.save(); ctx.rotate(angle);
      if (building) {
        ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r + 28 * (1 - progress), 0); ctx.stroke();
      } else {
        ctx.translate(r, 0); ctx.rotate(progress * Math.PI);
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }

  // A fixed central emblem keeps the two actions distinct at a glance.
  ctx.shadowBlur = 12; ctx.strokeStyle = '#fff0f8'; ctx.lineWidth = 4;
  ctx.beginPath();
  if (building) {
    ctx.moveTo(0, -24); ctx.lineTo(16, 12); ctx.lineTo(0, 5); ctx.lineTo(-16, 12); ctx.closePath();
  } else {
    ctx.moveTo(-14, -14); ctx.lineTo(14, 14); ctx.moveTo(14, -14); ctx.lineTo(-14, 14);
  }
  ctx.stroke();
  ctx.restore();
}

/** Pending effects read the probe timer directly; cancelling or resolving removes the marker. */
export function drawConversionCountdown(ctx: CanvasRenderingContext2D, base: Base,
  incoming: { color: string; remaining: number }, reducedMotion = false, zoom = 1, slot = 0, total = slot + 1) {
  if (incoming.remaining <= 0 || incoming.color === base.color) return;
  const remaining = Math.min(CONVERSION_TRAVEL_SECONDS, incoming.remaining);
  const progress = 1 - remaining / CONVERSION_TRAVEL_SECONDS;
  // Leave room for shields and planet badges; keep the timer legible at overview zoom.
  const unit = 1 / zoom;
  const radius = Math.max(76, 30 * unit) + slot * 18 * unit;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.lineCap = 'round'; ctx.setLineDash([]);
  ctx.shadowColor = CONVERSION_COLOR; ctx.shadowBlur = 12;
  ctx.strokeStyle = '#ff8fc733'; ctx.lineWidth = 2 * unit;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = CONVERSION_COLOR; ctx.lineWidth = 3 * unit;
  ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining / CONVERSION_TRAVEL_SECONDS); ctx.stroke();

  // The icon's paired turning arcs gather inward; impact replaces them with an outward wave.
  if (slot === 0) {
    ctx.save();
    if (!reducedMotion) ctx.rotate(progress * Math.PI * 2);
    ctx.strokeStyle = '#ffd1e8'; ctx.lineWidth = 2;
    const orbit = 44 + (1 - progress) * 12;
    for (let side = 0; side < 2; side++) {
      const start = side * Math.PI, end = start + Math.PI * 0.72;
      ctx.beginPath(); ctx.arc(0, 0, orbit, start, end); ctx.stroke();
      const x = Math.cos(end) * orbit, y = Math.sin(end) * orbit;
      const tx = -Math.sin(end), ty = Math.cos(end);
      ctx.beginPath(); ctx.moveTo(x - tx * 8 + Math.cos(end) * 5, y - ty * 8 + Math.sin(end) * 5);
      ctx.lineTo(x, y); ctx.lineTo(x - tx * 8 - Math.cos(end) * 5, y - ty * 8 - Math.sin(end) * 5); ctx.stroke();
    }
    ctx.restore();
  }

  // Faction-colored marker identifies the sender when multiple conversions target one world.
  const angle = -Math.PI / 2 + Math.PI * 2 * remaining / CONVERSION_TRAVEL_SECONDS;
  ctx.fillStyle = incoming.color;
  ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 4 * unit, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  const labelY = Math.max(76, 30 * unit) + (total - 1 + slot) * 18 * unit + 16 * unit;
  ctx.fillStyle = '#300c28e6'; ctx.fillRect(-53 * unit, labelY - 11 * unit, 106 * unit, 17 * unit);
  ctx.fillStyle = CONVERSION_COLOR; ctx.font = `bold ${11 * unit}px monospace`; ctx.textAlign = 'center';
  ctx.fillText(`CONVERT ${(Math.ceil(remaining * 10 - 1e-8) / 10).toFixed(1)}s`, 0, labelY);
  ctx.restore();
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
