import { NEUTRAL, PLAYER } from './campaign';
import type { Base } from './types';

export type TutorialState = { step: 'select' | 'attack' | 'zoom' | 'capitals' | 'done'; zoomStart?: number };
export type TutorialEvent =
  | { type: 'selection'; playerSelected: boolean }
  | { type: 'launch'; hostile: boolean; zoom: number }
  | { type: 'zoom'; before: number; after: number }
  | { type: 'dismiss' };

export function advanceTutorial(state: TutorialState, event: TutorialEvent): TutorialState {
  if (state.step === 'done') return state;
  if (event.type === 'dismiss') return { step: 'done' };
  if (event.type === 'selection' && (state.step === 'select' || state.step === 'attack')) {
    const step = event.playerSelected ? 'attack' : 'select';
    return step === state.step ? state : { step };
  }
  if (event.type === 'launch' && event.hostile && (state.step === 'select' || state.step === 'attack')) return { step: 'zoom', zoomStart: event.zoom };
  // Only an actual user zoom-out counts, never the automatic camera intro.
  if (event.type === 'zoom' && state.step === 'zoom' && event.after < event.before && event.after <= state.zoomStart! * 0.9) return { step: 'capitals' };
  return state;
}

export function tutorialHoldsOpening(state: TutorialState): boolean {
  return state.step === 'select' || state.step === 'attack';
}

export function tutorialTargets(state: TutorialState, bases: readonly Base[], selectedId: string | null, preferredId: string | undefined, attackRange: number): Base[] {
  if (state.step === 'select') return bases.filter(p => p.color === PLAYER && p.isCapital);
  if (state.step === 'capitals') return bases.filter(p => p.isCapital && p.color !== PLAYER && p.color !== NEUTRAL);
  if (state.step !== 'attack') return [];
  const source = bases.find(p => p.id === selectedId && p.color === PLAYER);
  if (!source) return [];
  const targets = bases.filter(p => p.color !== PLAYER && Math.hypot(p.x - source.x, p.y - source.y) <= attackRange);
  const preferred = targets.find(p => p.id === preferredId);
  return preferred ? [preferred] : targets.filter(p => p.color !== NEUTRAL).slice(0, 1);
}

export function drawTutorialHighlights(ctx: CanvasRenderingContext2D, targets: readonly Base[], zoom: number, time: number) {
  ctx.save();
  ctx.strokeStyle = '#fef08a';
  ctx.fillStyle = '#fef08a';
  ctx.lineWidth = 3 / zoom;
  const pulse = (Math.sin(time / 240) + 1) / 2;
  for (const base of targets) {
    const radius = (base.isCapital ? 40 : 20) + 15 + Math.sqrt(base.pixelCount) * 5 + (8 + pulse * 5) / zoom;
    ctx.beginPath();
    ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    // A small inward-pointing arrow stays attached as the world rotates.
    const y = base.y - radius - 9 / zoom;
    ctx.beginPath();
    ctx.moveTo(base.x, y);
    ctx.lineTo(base.x - 7 / zoom, y - 10 / zoom);
    ctx.lineTo(base.x + 7 / zoom, y - 10 / zoom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
