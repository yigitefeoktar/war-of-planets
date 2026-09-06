import { GameEngine } from './engine';
import type { OrbitDefinition } from './campaign';

// A rigid rotating system, not a gravity simulation. The star is scenery,
// deliberately excluded from bases, selection, ship production and victory.
export class OrbitingGameEngine extends GameEngine {
  private readonly orbitIds: Set<string>;

  constructor(width: number, height: number, private readonly orbit: OrbitDefinition) {
    super(width, height);
    this.orbitIds = new Set(orbit.planetIds);
  }

  override update(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
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

  override draw(ctx: CanvasRenderingContext2D, selectedBaseId: string | null, cameraX: number, cameraY: number, isOmniTargeting = false) {
    super.draw(ctx, selectedBaseId, cameraX, cameraY, isOmniTargeting);
    ctx.save();
    ctx.translate(this.orbit.x, this.orbit.y);

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
}
