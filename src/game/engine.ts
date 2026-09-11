import { Base, Pixel, type SuperweaponId } from './types';
import { drawPlanetEffects, drawRepelledShips, type RepelledShip } from './planetEffects';
import { canIssueFleetOrder } from './logistics';
import { TacticalAI } from './ai';
import { FactionBonuses, energyMultiplier } from './factions';
import { assignQuickMatchSuperweaponPlanets, ENERGY_PER_PLANET_PER_SECOND, isPointAccessible, SUPERWEAPON_COSTS, SUPERWEAPON_MAX_ENERGY, OVERDRIVE_DURATION, OVERDRIVE_MULTIPLIER, REPULSE_DURATION, type SuperweaponTargetMode } from './superweapons';

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
  thickness: number;
}

function drawSuperweaponIcon(ctx: CanvasRenderingContext2D, weapon: SuperweaponId, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  const color = weapon === 'repulse' ? '#a5e8ff' : weapon === 'overdrive' ? '#ffbd59' : '#00f5ff';
  ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;

  if (weapon === 'repulse') {
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7.5, -5); ctx.lineTo(5.5, 4); ctx.lineTo(0, 9); ctx.lineTo(-5.5, 4); ctx.lineTo(-7.5, -5); ctx.closePath();
    ctx.stroke();
  } else if (weapon === 'overdrive') {
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (weapon === 'omni') {
    for (let angle = -Math.PI / 2; angle < Math.PI * 1.5; angle += Math.PI * 2 / 3) {
      const tipX = Math.cos(angle) * 9;
      const tipY = Math.sin(angle) * 9;
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 3, Math.sin(angle) * 3); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.beginPath(); ctx.arc(tipX, tipY, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

type GameEngineOptions = {
  rng?: () => number;
  now?: () => number;
  superweaponUnlocksEnabled?: boolean;
};

export class GameEngine {
  bases: Map<string, Base> = new Map();
  pixels: Pixel[] = [];
  stars: Star[] = [];
  particles: Particle[] = [];
  shockwaves: Shockwave[] = [];
  repelledShips: RepelledShip[] = [];
  factionEnergy: Map<string, number> = new Map();
  factionSuperweaponUnlocks: Map<string, Set<SuperweaponId>> = new Map();
  readonly superweaponUnlocksEnabled: boolean;
  width: number;
  height: number;
  lastSpawnTime: number = Date.now();
  lastAITime: number = Date.now();
  shipCache: Map<string, HTMLCanvasElement> = new Map();
  nextPixelId: number = 0;
  MAX_ATTACK_RANGE: number = 600;
  shakeAmount: number = 0;
  shakeDuration: number = 0;
  aiOmniCooldowns: Map<string, number> = new Map();
  private tacticalAI = new TacticalAI();
  private factionBonuses = new FactionBonuses();
  private aiSeconds = 0;
  lastOmniCaptureBaseId: string | null = null;
  lastOmniCaptureTime: number = 0;
  lastDestroyedCapital: { x: number, y: number, color: string } | null = null;
  isHardMode: boolean = false;

  // Callbacks for sound/events
  onCapture?: (baseId: string, color: string) => void;
  onCapitalDestroyed?: (color: string) => void;
  onLaunch?: (fromId: string, toId: string) => void;
  onCollision?: (x: number, y: number, color: string) => void;
  onOmniStrike?: (color: string) => void;
  onSuperweapon?: (weapon: 'overdrive' | 'repulse', color: string) => void;
  onAbilityPulse?: (weapon: 'overdrive' | 'repulse', color: string) => void;
  private rng: () => number;
  private nowProvider: () => number;

  constructor(width: number, height: number, options: GameEngineOptions = {}) {
    this.width = width;
    this.height = height;
    this.rng = options.rng ?? Math.random;
    this.nowProvider = options.now ?? Date.now;
    this.superweaponUnlocksEnabled = options.superweaponUnlocksEnabled ?? true;
    this.lastSpawnTime = this.now();
    this.lastAITime = this.now();
    this.init();
  }

  private random() {
    return this.rng();
  }

  private now() {
    return this.nowProvider();
  }

  init() {
    // Player base (Blue)
    this.addBase('player_1', this.width * 0.5, this.height * 0.8, '#3b82f6', 200, true);

    // AI bases (Red, Green, Yellow)
    this.addBase('ai_1', this.width * 0.2, this.height * 0.2, '#ef4444', 200, true);
    this.addBase('ai_2', this.width * 0.8, this.height * 0.2, '#22c55e', 200, true);
    this.addBase('ai_3', this.width * 0.5, this.height * 0.2, '#eab308', 200, true);

    // Neutral bases (Gray)
    let currentMinDistance = 350; // Start with a large minimum distance for even spacing
    for (let i = 0; i < 46; i++) {
      let x = 0;
      let y = 0;
      let validPosition = false;
      let attempts = 0;

      while (!validPosition && attempts < 2000) {
        x = this.width * 0.08 + this.random() * this.width * 0.84;
        y = this.height * 0.08 + this.random() * this.height * 0.84;
        validPosition = true;

        for (const base of this.bases.values()) {
          const dx = base.x - x;
          const dy = base.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < currentMinDistance) {
            validPosition = false;
            break;
          }
        }
        
        attempts++;
        // Gradually reduce minimum distance if we're struggling to find a spot
        if (attempts % 50 === 0 && currentMinDistance > 100) {
          currentMinDistance -= 5;
        }
      }

      if (validPosition) {
        this.addBase(`neutral_${i}`, x, y, '#6b7280', 40);
      }
    }

    // Generate stars
    for (let i = 0; i < 800; i++) {
      const alpha = this.random() * 0.8 + 0.2;
      this.stars.push({
        x: this.random() * this.width,
        y: this.random() * this.height,
        size: this.random() * 1.5 + 0.5,
        alpha,
        color: `rgba(255, 255, 255, ${alpha})`
      });
    }

    if (this.superweaponUnlocksEnabled) assignQuickMatchSuperweaponPlanets(this.bases.values());
  }

  addBase(id: string, x: number, y: number, color: string, initialPixels: number, isCapital: boolean = false) {
    this.bases.set(id, { id, x, y, color, pixelCount: initialPixels, isCapital });
    for (let i = 0; i < initialPixels; i++) {
      this.pixels.push(this.createIdlePixel(id, x, y, color));
    }
  }

  createIdlePixel(baseId: string, startX: number, startY: number, color: string): Pixel {
    const base = this.bases.get(baseId);
    const planetRadius = base?.isDysonSphere ? 62 : base?.isCapital ? 40 : 20;
    const minRadius = planetRadius + 8;
    const angle = this.random() * Math.PI * 2;
    const r = minRadius + this.random() * 10;
    const x = startX + Math.cos(angle) * r;
    const y = startY + Math.sin(angle) * r;

    return {
      id: this.nextPixelId++,
      baseId,
      x,
      y,
      color,
      targetX: x,
      targetY: y,
      speed: 0.5 + this.random() * 1.5, // Random speed between 0.5 and 2.0
      state: 'idle',
      angle: this.random() * Math.PI * 2,
    };
  }

  sendUnits(fromId: string, toId: string, percentage: number = 0.9) {
    const idlePixels = this.pixels.filter(p => !p.dead && p.baseId === fromId && p.state === 'idle');
    const countToSend = Math.floor(idlePixels.length * percentage);
    
    if (countToSend > 0) {
      this.onLaunch?.(fromId, toId);
    }

    for (let i = 0; i < countToSend; i++) {
      const p = idlePixels[i];
      p.state = 'moving';
      p.targetBaseId = toId;
    }
  }

  getEnergy(color: string) {
    return this.factionEnergy.get(color) ?? 0;
  }

  getEnergyRate(color: string) {
    if (!this.superweaponUnlocksEnabled) return 0;
    return Array.from(this.bases.values()).filter(base => base.color === color).length * ENERGY_PER_PLANET_PER_SECOND * energyMultiplier(color);
  }

  getUnlockedSuperweapons(color: string) {
    return new Set(this.factionSuperweaponUnlocks.get(color) ?? []);
  }

  grantSuperweapon(color: string, weapon: SuperweaponId) {
    if (!this.superweaponUnlocksEnabled) return false;
    const unlocks = this.factionSuperweaponUnlocks.get(color) ?? new Set<SuperweaponId>();
    const newlyUnlocked = !unlocks.has(weapon);
    unlocks.add(weapon);
    this.factionSuperweaponUnlocks.set(color, unlocks);
    return newlyUnlocked;
  }

  isSuperweaponUnlocked(color: string, weapon: SuperweaponId) {
    return this.superweaponUnlocksEnabled && (this.factionSuperweaponUnlocks.get(color)?.has(weapon) ?? false);
  }

  recordPlanetCapture(baseId: string, color: string) {
    this.factionBonuses.reset(baseId);
    const captured = this.bases.get(baseId);
    if (captured) { captured.overdrive = undefined; captured.repulse = undefined; }
    if (!this.superweaponUnlocksEnabled) return [];
    const unlocks = this.bases.get(baseId)?.superweaponUnlocks ?? [];
    const factionUnlocks = this.factionSuperweaponUnlocks.get(color) ?? new Set<SuperweaponId>();
    const newlyUnlocked = unlocks.filter(weapon => !factionUnlocks.has(weapon));
    for (const weapon of unlocks) factionUnlocks.add(weapon);
    if (unlocks.length > 0) this.factionSuperweaponUnlocks.set(color, factionUnlocks);
    return newlyUnlocked;
  }

  setEnergy(color: string, amount: number) {
    this.factionEnergy.set(color, Math.max(0, Math.min(SUPERWEAPON_MAX_ENERGY, amount)));
  }

  private spendEnergy(color: string, amount: number) {
    const current = this.getEnergy(color);
    if (current < amount) return false;
    this.setEnergy(color, current - amount);
    return true;
  }

  canOmniStrike(playerColor: string, toId: string) {
    const targetBase = this.bases.get(toId);
    if (!targetBase || targetBase.color === playerColor) return false;
    return isPointAccessible(this.bases.values(), playerColor, targetBase.x, targetBase.y, this.MAX_ATTACK_RANGE);
  }

  hasOmniFleet(color: string) {
    const counts = new Map<string, number>();
    for (const ship of this.pixels) {
      if (ship.dead || ship.color !== color || ship.state !== 'idle' || this.bases.get(ship.baseId)?.color !== color) continue;
      const count = (counts.get(ship.baseId) ?? 0) + 1;
      if (count >= 4) return true;
      counts.set(ship.baseId, count);
    }
    return false;
  }

  activateOmniStrike(playerColor: string, toId: string) {
    if (!this.isSuperweaponUnlocked(playerColor, 'omni') || !this.canOmniStrike(playerColor, toId) || this.getEnergy(playerColor) < SUPERWEAPON_COSTS.omni) return false;
    if (!this.omniStrike(playerColor, toId)) return false;
    this.spendEnergy(playerColor, SUPERWEAPON_COSTS.omni);
    return true;
  }

  omniStrike(playerColor: string, toId: string) {
    const targetBase = this.bases.get(toId);
    if (!targetBase) return false;

    // Range check: Is the target in range of ANY player base?
    const playerBases = Array.from(this.bases.values()).filter(b => b.color === playerColor);
    const isInRange = playerBases.some(b => Math.hypot(b.x - targetBase.x, b.y - targetBase.y) <= this.MAX_ATTACK_RANGE);
    
    if (!isInRange || targetBase.color === playerColor) return false;

    let totalLaunched = 0;
    for (const base of playerBases) {
      const idlePixels = this.pixels.filter(p => !p.dead && p.baseId === base.id && p.state === 'idle');
      const countToSend = Math.floor(idlePixels.length * 0.3);
      
      if (countToSend > 0) {
        totalLaunched += countToSend;
        for (let i = 0; i < countToSend; i++) {
          const p = idlePixels[i];
          p.state = 'moving';
          p.targetBaseId = toId;
          p.isWarp = true;
          p.trail = [];
        }
      }
    }

    if (totalLaunched > 0) {
      this.shakeAmount = 15;
      this.shakeDuration = 0.5;
      this.onOmniStrike?.(playerColor);
      return true;
    }
    return false;
  }

  canActivatePlanetAbility(color: string, id: string, weapon: 'overdrive' | 'repulse') {
    const base = this.bases.get(id);
    return !!base && base.color === color && !(weapon === 'overdrive' && base.isDysonSphere)
      && !base[weapon] && this.isSuperweaponUnlocked(color, weapon)
      && this.getEnergy(color) >= SUPERWEAPON_COSTS[weapon];
  }

  activatePlanetAbility(color: string, id: string, weapon: 'overdrive' | 'repulse') {
    if (!this.canActivatePlanetAbility(color, id, weapon)) return false;
    const base = this.bases.get(id)!;
    if (!this.spendEnergy(color, SUPERWEAPON_COSTS[weapon])) return false;
    base[weapon] = { color, remaining: weapon === 'overdrive' ? OVERDRIVE_DURATION : REPULSE_DURATION, pulse: 1 };
    const tint = weapon === 'overdrive' ? '#ffbd59' : '#a5e8ff';
    this.shockwaves.push({ x: base.x, y: base.y, radius: 8, maxRadius: 180, color: tint, alpha: 1, thickness: 8 });
    this.createExplosion(base.x, base.y, tint, 32);
    this.shakeAmount = 9;
    this.shakeDuration = 0.25;
    this.onSuperweapon?.(weapon, color);
    return true;
  }

  private repelShip(pixel: Pixel, base: Base) {
    pixel.dead = true; // Knockback is presentation only: this ship can never fight again.
    base.repulse!.pulse = 1;
    const outward = Math.atan2(pixel.y - base.y, pixel.x - base.x);
    const angle = outward + (this.random() - 0.5) * Math.PI;
    const speed = 180 + this.random() * 180;
    if (this.repelledShips.length < 160) this.repelledShips.push({
      x: pixel.x, y: pixel.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      angle: pixel.angle, spin: (this.random() - 0.5) * 20, life: 0.45 + this.random() * 0.3, color: pixel.color,
    });
    this.createExplosion(pixel.x, pixel.y, '#c9f4ff', 3);
    this.onAbilityPulse?.('repulse', base.color);
  }

  createExplosion(x: number, y: number, color: string, count: number = 10, isCapital: boolean = false) {
    if (isCapital) {
      count = 200; // Supernova!
      this.shockwaves.push({ x, y, radius: 10, maxRadius: 800, color, alpha: 1.0, thickness: 10 });
    }
    for (let i = 0; i < count; i++) {
      const angle = this.random() * Math.PI * 2;
      const speed = isCapital ? (this.random() * 8 + 2) : (this.random() * 3 + 1);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: isCapital ? (this.random() * 2 + 1) : (this.random() * 0.5 + 0.5),
        color,
        size: isCapital ? (this.random() * 4 + 1) : (this.random() * 2 + 1)
      });
    }
  }

  getShipImage(color: string): HTMLCanvasElement {
    if (this.shipCache.has(color)) {
      return this.shipCache.get(color)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d')!;
    
    // Center at 10, 10
    ctx.translate(10, 10);
    
    ctx.beginPath();
    ctx.moveTo(5, 0); // Nose
    ctx.lineTo(-4, 4); // Right wing
    ctx.lineTo(-2, 0); // Engine indent
    ctx.lineTo(-4, -4); // Left wing
    ctx.closePath();
    
    ctx.fillStyle = color;
    ctx.shadowBlur = 4;
    ctx.shadowColor = color;
    ctx.fill();
    
    this.shipCache.set(color, canvas);
    return canvas;
  }

  update(dt: number) {
    const now = this.now();
    const timeScale = dt * 60; // Normalize to 60 FPS

    // Update screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      if (this.shakeDuration <= 0) {
        this.shakeAmount = 0;
      }
    }

    // Update AI cooldowns
    for (const [color, cooldown] of this.aiOmniCooldowns.entries()) {
      if (cooldown > 0) {
        this.aiOmniCooldowns.set(color, cooldown - dt);
      }
    }

    const ownedPlanetCounts = new Map<string, number>();
    for (const base of this.bases.values()) {
      if (base.color === '#6b7280') continue;
      ownedPlanetCounts.set(base.color, (ownedPlanetCounts.get(base.color) ?? 0) + 1);
    }
    if (this.superweaponUnlocksEnabled) for (const color of ownedPlanetCounts.keys()) {
      this.setEnergy(color, this.getEnergy(color) + this.getEnergyRate(color) * dt);
    }

    for (const base of this.bases.values()) {
      for (const weapon of ['overdrive', 'repulse'] as const) {
        const effect = base[weapon];
        if (!effect) continue;
        effect.remaining -= dt;
        effect.pulse = Math.max(0, effect.pulse - dt * 4);
        if (effect.remaining <= 0 || effect.color !== base.color) {
          this.createExplosion(base.x, base.y, weapon === 'overdrive' ? '#ffbd59' : '#a5e8ff', 12);
          base[weapon] = undefined;
        }
      }
    }
    for (let i = this.repelledShips.length - 1; i >= 0; i--) {
      const ship = this.repelledShips[i];
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      ship.angle += ship.spin * dt; ship.life -= dt;
      if (ship.life <= 0) {
        this.createExplosion(ship.x, ship.y, ship.color, 8);
        this.repelledShips.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;
      p.life -= 0.02 * timeScale; // Roughly 50 frames at 60fps
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 8 * timeScale; // Slower expansion (was 15)
      sw.alpha -= 0.025 * timeScale; // Faster fade out (was 0.015)
      sw.thickness += 0.1 * timeScale; // Slower thickness growth
      if (sw.alpha <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Spawn units every 250ms (4x faster)
    if (now - this.lastSpawnTime > 250) {
      for (const base of this.bases.values()) {
        if (base.color !== '#6b7280' && !base.isDysonSphere) { // Spawn without limit
          const count = this.factionBonuses.production(base.id, base.color) * (base.overdrive ? OVERDRIVE_MULTIPLIER : 1);
          if (base.overdrive) {
            base.overdrive.pulse = 1;
            this.createExplosion(base.x, base.y, '#ffbd59', 8);
            this.onAbilityPulse?.('overdrive', base.color);
          }
          for (let i = 0; i < count; i++) this.pixels.push(this.createIdlePixel(base.id, base.x, base.y, base.color));
        }
      }
      this.lastSpawnTime = now;
    }

    this.aiSeconds += dt;
    if (now - this.lastAITime > 2000) {
      const plans = this.tacticalAI.plan({
        bases: [...this.bases.values()], pixels: this.pixels,
        range: this.MAX_ATTACK_RANGE, seconds: this.aiSeconds, hard: this.isHardMode,
        canOmni: color => this.isSuperweaponUnlocked(color, 'omni') && this.getEnergy(color) >= SUPERWEAPON_COSTS.omni,
      });
      for (const [color, plan] of plans) {
        for (const order of plan.orders) {
          const idle = this.pixels.filter(p => !p.dead && p.baseId === order.from && p.state === 'idle').length;
          if (idle > 0 && canIssueFleetOrder(this.bases.values(), order.from, order.to, this.MAX_ATTACK_RANGE)) {
            this.sendUnits(order.from, order.to, Math.min(1, (order.count + 0.001) / idle));
          }
        }
        if (plan.omniTarget) this.activateOmniStrike(color, plan.omniTarget);
      }
      this.lastAITime = now;
    }

    // Update base pixel counts and group defenders
    const defendersByBase = new Map<string, Pixel[]>();
    for (const base of this.bases.values()) {
      defendersByBase.set(base.id, []);
    }

    for (const p of this.pixels) {
      if (p.state === 'idle' && !p.dead) {
        defendersByBase.get(p.baseId)?.push(p);
      }
    }
    
    for (const base of this.bases.values()) {
      base.pixelCount = defendersByBase.get(base.id)?.length || 0;
    }

    // Update pixels
    for (const p of this.pixels) {
      if (p.dead) continue;

      if (p.state === 'idle') {
        const base = this.bases.get(p.baseId);
        if (!base) continue;

        // Idle movement logic
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
          // Pick a new target outside the base's radius
          const planetRadius = base.isDysonSphere ? 62 : base.isCapital ? 40 : 20;
          const minRadius = planetRadius + 8; 
          const maxRadius = minRadius + 10 + Math.sqrt(base.pixelCount) * 5; 
          const angle = this.random() * Math.PI * 2;
          const r = minRadius + this.random() * (maxRadius - minRadius);
          
          p.targetX = base.x + Math.cos(angle) * r;
          p.targetY = base.y + Math.sin(angle) * r;
          
          // Keep within bounds
          p.targetX = Math.max(0, Math.min(this.width, p.targetX));
          p.targetY = Math.max(0, Math.min(this.height, p.targetY));
        } else {
          // Move towards target
          p.x += (dx / dist) * p.speed * timeScale;
          p.y += (dy / dist) * p.speed * timeScale;
          p.angle = Math.atan2(dy, dx);
        }
      } else if (p.state === 'moving' && p.targetBaseId) {
        const targetBase = this.bases.get(p.targetBaseId);
        if (!targetBase) {
          p.state = 'idle';
          continue;
        }

        const dx = targetBase.x - p.x;
        const dy = targetBase.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const barrierRadius = (targetBase.isDysonSphere ? 62 : targetBase.isCapital ? 40 : 20) + 24;
        const travel = p.speed * (p.isWarp ? 4 : 1.5) * timeScale;
        if (targetBase.repulse && targetBase.repulse.color === targetBase.color && p.color !== targetBase.color && dist <= barrierRadius + travel) {
          if (dist > barrierRadius) {
            p.x += dx / dist * (dist - barrierRadius);
            p.y += dy / dist * (dist - barrierRadius);
          }
          this.repelShip(p, targetBase);
          continue;
        }

        if (dist < 10) {
          // Reached target base
          if (targetBase.color === p.color) {
            // Reinforce
            p.baseId = targetBase.id;
            p.state = 'idle';
            p.targetX = p.x;
            p.targetY = p.y;
            p.isWarp = false;
            p.trail = [];
          } else {
            // Attack
            // Find a defender that isn't already marked as dead this frame
            const defenders = defendersByBase.get(targetBase.id);
            const defender = defenders?.pop();
            
            if (defender) {
              const bonus = this.factionBonuses.clash(targetBase.id, targetBase.color, p.color);
              p.dead = true;
              defender.dead = !bonus.saveDefender;
              if (bonus.saveDefender) defenders!.push(defender);
              if (bonus.extraDefender) {
                const extra = defenders?.pop();
                if (extra) extra.dead = true;
              }
              targetBase.lastAttackedTime = this.now();
              this.createExplosion(p.x, p.y, targetBase.color, 2);
              this.createExplosion(defender.x, defender.y, targetBase.color, 2);
              this.onCollision?.(p.x, p.y, targetBase.color);
            } else {
              // Capture base
              const oldColor = targetBase.color;
              if (p.isWarp) {
                this.lastOmniCaptureBaseId = targetBase.id;
                this.lastOmniCaptureTime = this.now();
              }
              targetBase.color = p.color;
              this.recordPlanetCapture(targetBase.id, p.color);
              p.baseId = targetBase.id;
              p.state = 'idle';
              p.targetX = p.x;
              p.targetY = p.y;
              p.isWarp = false;
              p.trail = [];
              targetBase.lastAttackedTime = this.now();
              if (!targetBase.isCapital && !this.lastDestroyedCapital) {
                this.createExplosion(targetBase.x, targetBase.y, targetBase.color, 10); // Big explosion on capture
              }
              this.onCapture?.(targetBase.id, targetBase.color);
              
              if (targetBase.isCapital) {
                targetBase.isCapital = false;
                this.lastDestroyedCapital = { x: targetBase.x, y: targetBase.y, color: oldColor };
                this.createExplosion(targetBase.x, targetBase.y, oldColor, 200, true); // Supernova explosion
                this.onCapitalDestroyed?.(oldColor);
                // Eliminate the player who lost their capital
                for (const b of this.bases.values()) {
                  if (b.color === oldColor) {
                    b.color = '#6b7280';
                    b.isCapital = false;
                  }
                }
                for (const px of this.pixels) {
                  if (px.color === oldColor) {
                    px.dead = true;
                    this.createExplosion(px.x, px.y, oldColor, 2);
                  }
                }
              }
            }
          }
        } else {
          // Move towards target (faster when attacking)
          const speedMultiplier = p.isWarp ? 4.0 : 1.5;
          p.x += (dx / dist) * Math.min(dist, (p.speed * speedMultiplier) * timeScale);
          p.y += (dy / dist) * Math.min(dist, (p.speed * speedMultiplier) * timeScale);
          p.angle = Math.atan2(dy, dx);

          if (p.isWarp) {
            p.trail = p.trail || [];
            p.trail.push({ x: p.x, y: p.y, alpha: 1.0 });
            if (p.trail.length > 10) p.trail.shift();
            for (const t of p.trail) {
              t.alpha -= 0.1 * timeScale;
            }
          }
        }
      }
    }

    // Remove dead pixels
    this.pixels = this.pixels.filter(p => !p.dead);
  }

  draw(ctx: CanvasRenderingContext2D, selectedBaseId: string | null, cameraX: number, cameraY: number, targetingMode: SuperweaponTargetMode = null) {
    ctx.save();

    // Apply screen shake
    if (this.shakeAmount > 0) {
      const sx = (this.random() - 0.5) * this.shakeAmount;
      const sy = (this.random() - 0.5) * this.shakeAmount;
      ctx.translate(sx, sy);
    }

    // Clear background
    ctx.fillStyle = '#05050a'; // Deep space black
    ctx.fillRect(0, 0, this.width, this.height);

    // Calculate visible bounds
    const transform = ctx.getTransform();
    const zoom = transform.a;
    const viewLeft = -transform.e / zoom;
    const viewTop = -transform.f / zoom;
    const viewRight = viewLeft + ctx.canvas.width / zoom;
    const viewBottom = viewTop + ctx.canvas.height / zoom;

    // Draw stars with parallax and infinite tiling
    for (const star of this.stars) {
      const parallaxFactor = star.size * 0.1; 
      
      // Calculate the effective view bounds for this star's parallax layer
      const adjViewLeft = viewLeft - cameraX * parallaxFactor;
      const adjViewRight = viewRight - cameraX * parallaxFactor;
      const adjViewTop = viewTop - cameraY * parallaxFactor;
      const adjViewBottom = viewBottom - cameraY * parallaxFactor;

      // Find which tiles intersect the visible area
      const startTx = Math.floor((adjViewLeft - star.x - star.size) / this.width);
      const endTx = Math.floor((adjViewRight - star.x + star.size) / this.width);
      const startTy = Math.floor((adjViewTop - star.y - star.size) / this.height);
      const endTy = Math.floor((adjViewBottom - star.y + star.size) / this.height);

      ctx.fillStyle = star.color;
      for (let tx = startTx; tx <= endTx; tx++) {
        for (let ty = startTy; ty <= endTy; ty++) {
          const drawX = star.x + tx * this.width + cameraX * parallaxFactor;
          const drawY = star.y + ty * this.height + cameraY * parallaxFactor;
          ctx.fillRect(drawX, drawY, star.size, star.size);
        }
      }
    }

    // Draw shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = sw.alpha;
      ctx.strokeStyle = sw.color;
      ctx.shadowBlur = 30;
      ctx.shadowColor = sw.color;
      
      // Outer chaotic ring
      ctx.beginPath();
      ctx.lineWidth = sw.thickness;
      const segments = 40;
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        const jitter = (this.random() - 0.5) * (sw.radius * 0.15); // Random jaggedness
        const r = Math.max(0, sw.radius + jitter);
        const px = sw.x + Math.cos(angle) * r;
        const py = sw.y + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Inner intense ring
      ctx.beginPath();
      ctx.lineWidth = sw.thickness * 0.5;
      for (let j = 0; j <= segments; j++) {
        const angle = (j / segments) * Math.PI * 2;
        const jitter = (this.random() - 0.5) * (sw.radius * 0.1);
        const r = Math.max(0, sw.radius * 0.7 + jitter);
        const px = sw.x + Math.cos(angle) * r;
        const py = sw.y + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;

    // Draw particles
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0; // Reset alpha

    // Draw pixels (ships)
    const isZoomedOut = zoom < 0.6;

    // Draw warp trails first
    ctx.save();
    for (const p of this.pixels) {
      if (p.isWarp && p.trail && p.trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          ctx.globalAlpha = p.trail[i].alpha;
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    if (isZoomedOut) {
      // High-performance batched vector rendering for zoomed-out view
      // This keeps ships perfectly crisp without the blurriness of scaled images
      const colorGroups = new Map<string, typeof this.pixels>();
      for (const p of this.pixels) {
        if (!colorGroups.has(p.color)) colorGroups.set(p.color, []);
        colorGroups.get(p.color)!.push(p);
      }

      for (const [color, pixels] of colorGroups) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const p of pixels) {
          const cos = Math.cos(p.angle);
          const sin = Math.sin(p.angle);
          
          // Ship coordinates: (5,0), (-4,4), (-2,0), (-4,-4)
          // Apply rotation and translation manually for batching
          const p1x = p.x + 5 * cos;
          const p1y = p.y + 5 * sin;
          
          const p2x = p.x - 4 * cos - 4 * sin;
          const p2y = p.y - 4 * sin + 4 * cos;
          
          const p3x = p.x - 2 * cos;
          const p3y = p.y - 2 * sin;
          
          const p4x = p.x - 4 * cos + 4 * sin;
          const p4y = p.y - 4 * sin - 4 * cos;
          
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.lineTo(p3x, p3y);
          ctx.lineTo(p4x, p4y);
        }
        ctx.fill();
      }
    } else {
      // Use cached images for close-up view
      for (const p of this.pixels) {
        const img = this.getShipImage(p.color);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        
        ctx.drawImage(img, -10, -10);
        
        ctx.restore();
      }
    }

    // Keep active barriers and production pulses legible over dense idle fleets.
    for (const base of this.bases.values()) drawPlanetEffects(ctx, base);
    drawRepelledShips(ctx, this.repelledShips);

    // Draw bases (planets)
    for (const base of this.bases.values()) {
      let drawX = base.x;
      let drawY = base.y;
      const timeSinceAttack = this.now() - (base.lastAttackedTime || 0);
      let isFlashing = false;

      // Attack animation (Clean Shield Flare)
      if (timeSinceAttack < 300) {
        const progress = timeSinceAttack / 300;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        
        const planetRadius = base.isDysonSphere ? 62 : base.isCapital ? 40 : 20;
        const shieldRadius = planetRadius + 4 + (progress * 8);
        
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        
        // Fill with a light tint
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.4})`;
        ctx.fill();
        
        // Bright edge
        ctx.strokeStyle = `rgba(255, 255, 255, ${(1 - progress) * 0.8})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.restore();
      }

      // Draw valid target highlight
      let isOutOfRange = false;
      
      if (targetingMode === 'omni') {
        // Highlight reachable Omni targets for callers that request it.
        const playerBases = Array.from(this.bases.values()).filter(b => b.color === '#3b82f6');
        const inRangeOfAny = playerBases.some(pb => Math.hypot(base.x - pb.x, base.y - pb.y) <= this.MAX_ATTACK_RANGE);
        
        if (base.color !== '#3b82f6') {
          if (inRangeOfAny) {
            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.beginPath();
            const planetRadius = base.isDysonSphere ? 62 : base.isCapital ? 40 : 20;
            const fleetRadius = planetRadius + 25 + Math.sqrt(base.pixelCount) * 5;
            ctx.arc(0, 0, fleetRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            ctx.stroke();
            ctx.restore();
          } else {
            isOutOfRange = true;
          }
        }
      } else if (selectedBaseId && selectedBaseId !== base.id) {
        const selectedBase = this.bases.get(selectedBaseId);
        if (selectedBase) {
          if (canIssueFleetOrder(this.bases.values(), selectedBase.id, base.id, this.MAX_ATTACK_RANGE)) {
            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.beginPath();
            const planetRadius = base.isDysonSphere ? 62 : base.isCapital ? 40 : 20;
            const fleetRadius = planetRadius + 25 + Math.sqrt(base.pixelCount) * 5;
            ctx.arc(0, 0, fleetRadius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
          } else {
            isOutOfRange = true;
          }
        }
      }

      // Draw selection ring (Orbit)
      if (selectedBaseId === base.id) {
        const planetRadius = base.isDysonSphere ? 62 : base.isCapital ? 40 : 20;
        const fleetRadius = planetRadius + 25 + Math.sqrt(base.pixelCount) * 5;
        
        ctx.save();
        ctx.translate(drawX, drawY);
        
        // Outer dashed ring
        ctx.beginPath();
        ctx.arc(0, 0, fleetRadius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff'; // Bright white
        ctx.lineWidth = 3;
        ctx.setLineDash([15, 15]);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.stroke();
        
        // Inner dashed ring
        ctx.beginPath();
        ctx.arc(0, 0, fleetRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.stroke();
        
        ctx.restore();
        
        // Pulsing center highlight
        const pulse = (Math.sin(this.now() / 150) + 1) / 2;
        ctx.beginPath();
        ctx.arc(drawX, drawY, 20 + pulse * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + pulse * 0.15})`;
        ctx.fill();
      }

      // Draw the base (Planet or Capital)
      ctx.save();
      ctx.translate(drawX, drawY);
      
      if (isOutOfRange) {
        ctx.globalAlpha = 0.3;
      }

      const planetRadius = base.isDysonSphere ? 62 : base.isCapital ? 40 : 20;

      // Planet glow
      ctx.shadowBlur = base.isCapital ? 25 : 15;
      ctx.shadowColor = base.color;
      
      if (!this.drawSpecialBase(ctx, base)) {
        // Planet body
        ctx.beginPath();
        ctx.arc(0, 0, planetRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(-planetRadius/3, -planetRadius/3, planetRadius/6, 0, 0, planetRadius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, base.color);
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, planetRadius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = base.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.restore();

      if (base.superweaponUnlocks?.length) {
        const gap = 34;
        const startX = -((base.superweaponUnlocks.length - 1) * gap) / 2;
        const iconY = -(planetRadius + 24);
        base.superweaponUnlocks.forEach((weapon, index) => drawSuperweaponIcon(ctx, weapon, drawX + startX + index * gap, drawY + iconY));
      }
    }

    ctx.restore(); // Restore from screen shake
  }

  protected drawSpecialBase(_ctx: CanvasRenderingContext2D, _base: Base) {
    return false;
  }
}
