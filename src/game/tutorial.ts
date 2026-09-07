import { NEUTRAL, PLAYER } from './campaign';
import type { Base } from './types';

export type TutorialState = { step: 'select' | 'attack' | 'zoom' | 'capitals' | 'done'; zoomStart?: number; zoomGoal?: number };
export type TutorialEvent =
  | { type: 'selection'; playerSelected: boolean }
  | { type: 'launch'; hostile: boolean; zoom: number; overviewZoom?: number }
  | { type: 'zoom'; before: number; after: number }
  | { type: 'dismiss' };

export function advanceTutorial(state: TutorialState, event: TutorialEvent): TutorialState {
  if (state.step === 'done') return state;
  if (event.type === 'dismiss') return { step: 'done' };
  if (event.type === 'selection' && (state.step === 'select' || state.step === 'attack')) {
    const step = event.playerSelected ? 'attack' : 'select';
    return step === state.step ? state : { step };
  }
  if (event.type === 'launch' && event.hostile && (state.step === 'select' || state.step === 'attack')) return { step: 'zoom', zoomStart: event.zoom, zoomGoal: Math.max(0.1, Math.min(event.zoom * 0.9, event.overviewZoom ?? event.zoom * 0.9)) };
  // Only an actual user zoom-out counts, never the automatic camera intro.
  if (event.type === 'zoom' && state.step === 'zoom' && event.after < event.before && event.after <= (state.zoomGoal ?? state.zoomStart! * 0.9)) return { step: 'capitals' };
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
  ctx.strokeStyle = '#3b82f6';
  ctx.shadowColor = '#60a5fa';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3 / zoom;
  const pulse = (Math.sin(time / 240) + 1) / 2;
  for (const base of targets) {
    const radius = (base.isCapital ? 40 : 20) + 15 + Math.sqrt(base.pixelCount) * 5 + (8 + pulse * 12) / zoom;
    ctx.globalAlpha = 0.65 + pulse * 0.35;
    ctx.beginPath();
    ctx.arc(base.x, base.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
