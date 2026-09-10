import { GameEngine } from './engine';
import { DYSON_SPHERE_ID, type OrbitDefinition } from './campaign';
import type { SuperweaponTargetMode } from './superweapons';
import type { Base } from './types';

const ORBITING_PASSIVE_ENERGY_PER_SECOND = 1;

// A rigid rotating system, not a gravity simulation. The center is either a
// decorative star or an optional capturable Dyson sphere defined by the map.
export class OrbitingGameEngine extends GameEngine {
  private readonly orbitIds: Set<string>;

  constructor(width: number, height: number, private readonly orbit: OrbitDefinition) {
    super(width, height, { superweaponUnlocksEnabled: Boolean(orbit.dysonSphere) });
    this.orbitIds = new Set(orbit.planetIds);
  }

  override getEnergyRate(color: string) {
    if (!this.orbit.dysonSphere || !Array.from(this.bases.values()).some(base => base.isCapital && base.color === color)) return 0;
    const ownsSphere = this.bases.get(DYSON_SPHERE_ID)?.color === color;
    return ORBITING_PASSIVE_ENERGY_PER_SECOND + (ownsSphere ? this.orbit.dysonSphere.energyPerSecond : 0);
  }

  override update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (this.orbit.dysonSphere) {
      const worldCounts = new Map<string, number>();
      for (const base of this.bases.values()) {
        if (!base.isDysonSphere && base.color !== '#6b7280') worldCounts.set(base.color, (worldCounts.get(base.color) ?? 0) + 1);
      }
      for (const [color, count] of worldCounts) if (count >= 5) this.grantSuperweapon(color, 'omni');
    }
    const angle = (Math.PI * 2 * dt) / this.orbit.periodSeconds;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const { x: cx, y: cy } = this.orbit;
    for (const base of this.bases.values()) {
      if (!this.orbitIds.has(base.id)) continue;
      const x = base.x - cx, y = base.y - cy;
      base.x = cx + x * cos - y * sin;
      base.y = cy + x * sin + y * cos;
    }
    // Carry stationed fleets and their local movement targets with the system.
    // Launched fleets stay in world space; the shared combat engine homes in
    // on targetBaseId's current position every frame, including Omni-Strike.
    for (const ship of this.pixels) {
      if (ship.dead || ship.state !== 'idle' || !this.orbitIds.has(ship.baseId)) continue;
      const x = ship.x - cx, y = ship.y - cy;
      const tx = ship.targetX - cx, ty = ship.targetY - cy;
      ship.x = cx + x * cos - y * sin;
      ship.y = cy + x * sin + y * cos;
      ship.targetX = cx + tx * cos - ty * sin;
      ship.targetY = cy + tx * sin + ty * cos;
      ship.angle += angle;
    }
    super.update(dt);
  }

  override draw(ctx: CanvasRenderingContext2D, selectedBaseId: string | null, cameraX: number, cameraY: number, targetingMode: SuperweaponTargetMode = null) {
    super.draw(ctx, selectedBaseId, cameraX, cameraY, targetingMode);
    if (this.orbit.dysonSphere) return;
    ctx.save();
    ctx.translate(this.orbit.x, this.orbit.y);
    this.drawStar(ctx);
    ctx.restore();
  }

  private drawStar(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowBlur = 0;
    const halo = ctx.createRadialGradient(0, 0, 32, 0, 0, 115);
    halo.addColorStop(0, 'rgba(255,255,255,0.55)');
    halo.addColorStop(0.4, 'rgba(210,231,255,0.16)');
    halo.addColorStop(1, 'rgba(210,231,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 115, 0, Math.PI * 2);
    ctx.fill();

    const surface = ctx.createRadialGradient(-12, -12, 5, 0, 0, 42);
    surface.addColorStop(0, '#ffffff');
    surface.addColorStop(0.65, '#ffffff');
    surface.addColorStop(1, '#d8e8ff');
    ctx.fillStyle = surface;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  protected override drawSpecialBase(ctx: CanvasRenderingContext2D, base: Base) {
    if (!base.isDysonSphere) return false;
    const accent = base.color === '#6b7280' ? '#ffffff' : base.color;
    const rotation = Date.now() / 18000;

    ctx.save();
    this.drawStar(ctx);
    ctx.shadowBlur = 0;

    ctx.save();
    ctx.rotate(rotation);
    for (let index = 0; index < 12; index++) {
      const start = index * Math.PI / 6 + 0.04;
      const end = (index + 1) * Math.PI / 6 - 0.04;
      ctx.beginPath();
      ctx.arc(0, 0, 62, start, end);
      ctx.arc(0, 0, 48, end, start, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(15,23,42,0.96)'; ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    for (const tilt of [-0.58, 0.58]) {
      ctx.beginPath(); ctx.ellipse(0, 0, 64, 23, tilt + rotation * 0.18, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px monospace'; ctx.fillStyle = accent;
    ctx.fillText('DYSON SPHERE', 0, -82);
    ctx.font = '10px monospace'; ctx.fillStyle = accent;
    ctx.fillText(base.color === '#6b7280' ? 'CAPTURE FOR ENERGY' : `+${this.orbit.dysonSphere!.energyPerSecond} ENERGY / SEC`, 0, 84);
    ctx.restore();
    return true;
  }
}
